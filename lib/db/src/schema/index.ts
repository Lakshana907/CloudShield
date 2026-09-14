import { integer, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  companyName: text("company_name").notNull(),
  title: text("title").notNull(),
  tlName: text("tl_name").notNull(),
  referenceKey: text("reference_key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const projectMembers = pgTable(
  "project_members",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").notNull(),
    userId: text("user_id").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    projectUserUnique: unique("project_members_project_user_unique").on(
      table.projectId,
      table.userId,
    ),
  }),
);

export const projectFiles = pgTable("project_files", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  name: text("name").notNull(),
  size: integer("size").notNull(),
  contentType: text("content_type").notNull(),
  objectPath: text("object_path").notNull(),
  uploadedById: text("uploaded_by_id").notNull(),
  uploadedByName: text("uploaded_by_name").notNull(),
  uploadedByRole: text("uploaded_by_role").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).defaultNow().notNull(),
});