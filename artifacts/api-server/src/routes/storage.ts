import { Readable } from 'stream';
import { getAuth } from '@clerk/express';
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import { Router, type IRouter, type Request, type Response } from 'express';

import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';
import {
  SupabaseStorageConfigurationError,
  SupabaseStorageService,
} from '../lib/supabaseStorage';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const supabaseStorageService = new SupabaseStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Requires auth middleware so public callers cannot mint write-capable URLs.
 */
router.post(
  '/storage/uploads/request-url',
  async (req: Request, res: Response) => {
    if (!getAuth(req).userId) {
      res.status(401).json({ error: 'Unauthorized' });

      return;
    }

    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;

      const { uploadURL, objectPath } =
        await supabaseStorageService.createUploadUrl();

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload URL');
      const status =
        error instanceof SupabaseStorageConfigurationError ? 503 : 502;
      res.status(status).json({
        error:
          error instanceof SupabaseStorageConfigurationError
            ? error.message
            : 'Supabase Storage could not prepare the upload. Check the API logs and bucket configuration.',
      });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * These are unconditionally public — no authentication or ACL checks.
 * IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const response = await objectStorageService.downloadObject(file);

      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));

      if (response.body) {
        const nodeStream = Readable.fromWeb(
          response.body as ReadableStream<Uint8Array>,
        );
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve private project files from the configured Supabase Storage bucket.
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  try {
    if (!getAuth(req).userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const response = await supabaseStorageService.downloadObject(wildcardPath);
    if (response.status === 404) {
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    if (!response.ok) {
      req.log.error(
        { status: response.status },
        'Supabase Storage failed to serve object',
      );
      res.status(502).json({ error: 'Failed to retrieve stored file' });
      return;
    }

    res.setHeader(
      'Content-Type',
      response.headers.get('content-type') ?? 'application/octet-stream',
    );
    const contentLength = response.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    res.setHeader('Cache-Control', 'private, no-store');

    if (response.body) {
      Readable.fromWeb(
        response.body as ReadableStream<Uint8Array>,
      ).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof SupabaseStorageConfigurationError) {
      req.log.error({ err: error }, 'Supabase Storage is not configured');
      res.status(503).json({ error: error.message });
      return;
    }
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    req.log.error({ err: error }, 'Error serving Supabase object');
    res.status(502).json({ error: 'Failed to retrieve stored file' });
  }
});

export default router;
