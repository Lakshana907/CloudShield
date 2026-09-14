import { getAuth } from "@clerk/express";
import {
  CreateProjectBody,
  CreateProjectFileBody,
  CreateProjectFileResponse,
  CreateProjectResponse,
  GetDashboardSummaryResponse,
  GetProjectResponse,
  JoinProjectBody,
  JoinProjectResponse,
  ListProjectFilesResponse,
  ListProjectsResponse,
} from "@workspace/api-zod";
import { db, projectFiles, projectMembers, projects } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";

const router: IRouter = Router();

type AuthenticatedRequest = Request & { userId: string };

function getUserId(req: Request): string | null {
  const auth = getAuth(req);
  return auth.userId ?? null;
}

function requireUser(req: Request, res: Response): string | null {
  const userId = getUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return userId;
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 4)
    .padEnd(2, "X");
}

function makeReferenceKey(companyName: string, title: string) {
  const randomBlock = randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `BLK-${initials(companyName)}-${initials(title)}-${randomBlock}`;
}

async function getMembership(projectId: string, userId: string) {
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) return null;
  if (project.ownerId === userId) {
    return { project, role: "tl" as const, displayName: project.tlName };
  }
  const [member] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
    );
  return member ? { project, role: "member" as const, displayName: member.displayName } : null;
}

async function serializeProject(project: typeof projects.$inferSelect, role: "tl" | "member") {
  const [members, files] = await Promise.all([
    db.select().from(projectMembers).where(eq(projectMembers.projectId, project.id)),
    db.select().from(projectFiles).where(eq(projectFiles.projectId, project.id)),
  ]);
  return {
    id: project.id,
    companyName: project.companyName,
    title: project.title,
    tlName: project.tlName,
    referenceKey: project.referenceKey,
    role,
    memberCount: members.length,
    filesCount: files.length,
    createdAt: project.createdAt.toISOString(),
  };
}

router.get("/dashboard/summary", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const memberships = await db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));
  const memberProjectIds = new Set(memberships.map((member) => member.projectId));
  const visibleProjects = allProjects.filter(
    (project) => project.ownerId === userId || memberProjectIds.has(project.id),
  );
  const visibleProjectIds = visibleProjects.map((project) => project.id);
  const files = visibleProjectIds.length
    ? await db.select().from(projectFiles).orderBy(desc(projectFiles.uploadedAt))
    : [];
  const visibleFiles = files.filter((file) => visibleProjectIds.includes(file.projectId));
  const recentActivity = [
    ...visibleProjects.slice(0, 4).map((project) => ({
      id: `project-${project.id}`,
      type: "project_created" as const,
      title: project.title,
      detail: `${project.companyName} project room`,
      occurredAt: project.createdAt.toISOString(),
    })),
    ...visibleFiles.slice(0, 6).map((file) => ({
      id: `file-${file.id}`,
      type: "file_uploaded" as const,
      title: file.name,
      detail: `Added to ${visibleProjects.find((project) => project.id === file.projectId)?.title ?? "project room"}`,
      occurredAt: file.uploadedAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 6);

  res.json(
    GetDashboardSummaryResponse.parse({
      projectCount: visibleProjects.length,
      fileCount: visibleFiles.length,
      sharedWithMeCount: visibleProjects.filter((project) => project.ownerId !== userId).length,
      recentActivity,
    }),
  );
});

router.get("/projects", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const allProjects = await db.select().from(projects).orderBy(desc(projects.createdAt));
  const memberships = await db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId));
  const memberProjectIds = new Set(memberships.map((member) => member.projectId));
  const visibleProjects = allProjects.filter(
    (project) => project.ownerId === userId || memberProjectIds.has(project.id),
  );
  const data = await Promise.all(
    visibleProjects.map((project) =>
      serializeProject(project, project.ownerId === userId ? "tl" : "member"),
    ),
  );
  res.json(ListProjectsResponse.parse(data));
});

router.post("/projects", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a company name, project title, and TL name." });
    return;
  }

  const input = parsed.data;
  const project = {
    id: randomUUID(),
    ownerId: userId,
    companyName: input.companyName.trim(),
    title: input.title.trim(),
    tlName: input.tlName.trim(),
    referenceKey: makeReferenceKey(input.companyName, input.title),
  };
  await db.insert(projects).values(project);
  await db.insert(projectMembers).values({
    id: randomUUID(),
    projectId: project.id,
    userId,
    displayName: project.tlName,
    role: "tl",
  });

  const data = await serializeProject(
    { ...project, createdAt: new Date() },
    "tl",
  );
  res.status(201).json(CreateProjectResponse.parse(data));
});

router.post("/projects/join", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const parsed = JoinProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter all project room credentials." });
    return;
  }
  const input = parsed.data;
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.referenceKey, input.referenceKey.trim().toUpperCase()));
  if (
    !project ||
    project.companyName.toLowerCase() !== input.companyName.trim().toLowerCase() ||
    project.title.toLowerCase() !== input.projectTitle.trim().toLowerCase()
  ) {
    res.status(404).json({ error: "We could not find a project room with those credentials." });
    return;
  }
  await db
    .insert(projectMembers)
    .values({
      id: randomUUID(),
      projectId: project.id,
      userId,
      displayName: input.person.trim(),
      role: "member",
    })
    .onConflictDoNothing();

  const data = await serializeProject(project, project.ownerId === userId ? "tl" : "member");
  res.json(JoinProjectResponse.parse(data));
});

router.get("/projects/:projectId", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const membership = await getMembership(req.params.projectId, userId);
  if (!membership) {
    res.status(404).json({ error: "Project room not found." });
    return;
  }
  res.json(
    GetProjectResponse.parse(
      await serializeProject(membership.project, membership.role),
    ),
  );
});

router.get("/projects/:projectId/files", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const membership = await getMembership(req.params.projectId, userId);
  if (!membership) {
    res.status(404).json({ error: "Project room not found." });
    return;
  }
  const files = await db
    .select()
    .from(projectFiles)
    .where(eq(projectFiles.projectId, req.params.projectId))
    .orderBy(desc(projectFiles.uploadedAt));
  res.json(
    ListProjectFilesResponse.parse(
      files.map((file) => ({
        id: file.id,
        projectId: file.projectId,
        name: file.name,
        size: file.size,
        contentType: file.contentType,
        objectPath: file.objectPath,
        uploadedBy: file.uploadedByName,
        uploadedByRole: file.uploadedByRole,
        uploadedAt: file.uploadedAt.toISOString(),
      })),
    ),
  );
});

router.post("/projects/:projectId/files", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const membership = await getMembership(req.params.projectId, userId);
  if (!membership) {
    res.status(404).json({ error: "Project room not found." });
    return;
  }
  const parsed = CreateProjectFileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "File metadata is incomplete." });
    return;
  }
  const input = parsed.data;
  const file = {
    id: randomUUID(),
    projectId: req.params.projectId,
    name: input.name,
    size: input.size,
    contentType: input.contentType,
    objectPath: input.objectPath,
    uploadedById: userId,
    uploadedByName: membership.displayName,
    uploadedByRole: membership.role,
  };
  await db.insert(projectFiles).values(file);
  res.status(201).json(
    CreateProjectFileResponse.parse({
      id: file.id,
      projectId: file.projectId,
      name: file.name,
      size: file.size,
      contentType: file.contentType,
      objectPath: file.objectPath,
      uploadedBy: file.uploadedByName,
      uploadedByRole: file.uploadedByRole,
      uploadedAt: new Date().toISOString(),
    }),
  );
});

export default router;