import { randomUUID } from 'crypto';

const DEFAULT_BUCKET = 'cloudshield-files';

export class SupabaseStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseStorageConfigurationError';
  }
}

export class SupabaseStorageService {
  async createUploadUrl(): Promise<{ uploadURL: string; objectPath: string }> {
    const config = getConfig();
    const objectName = `uploads/${randomUUID()}`;
    const objectPath = `/objects/${objectName}`;
    const response = await fetch(
      `${config.url}/storage/v1/object/upload/sign/${encodeStoragePath(`${config.bucket}/${objectName}`)}`,
      {
        method: 'POST',
        headers: getHeaders(config.apiKey, config.authorizationToken),
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(30_000),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Supabase Storage could not create an upload URL (HTTP ${response.status}).`,
      );
    }

    const result = (await response.json()) as {
      url?: unknown;
      token?: unknown;
    };
    if (typeof result.url !== 'string') {
      throw new Error('Supabase Storage returned an invalid upload token.');
    }

    const resolvedUploadUrl = /^https?:\/\//i.test(result.url)
      ? result.url
      : `${config.url}/storage/v1${result.url.startsWith('/') ? result.url : `/${result.url}`}`;
    const uploadURL = new URL(resolvedUploadUrl);
    const token =
      typeof result.token === 'string'
        ? result.token
        : uploadURL.searchParams.get('token');
    if (!token) {
      throw new Error('Supabase Storage returned an invalid upload token.');
    }
    uploadURL.searchParams.set('token', token);

    return { uploadURL: uploadURL.toString(), objectPath };
  }

  async downloadObject(objectName: string): Promise<Response> {
    const config = getConfig();
    if (
      !objectName.startsWith('uploads/') ||
      objectName.split('/').some((segment) => !segment || segment === '.' || segment === '..')
    ) {
      return new Response(null, { status: 404 });
    }

    return fetch(
      `${config.url}/storage/v1/object/${encodeStoragePath(`${config.bucket}/${objectName}`)}`,
      {
        headers: getHeaders(config.apiKey, config.authorizationToken),
        signal: AbortSignal.timeout(30_000),
      },
    );
  }
}

function getConfig() {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim();
  const legacyServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const elevatedKey = secretKey || legacyServiceRoleKey;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET;

  if (!rawUrl) {
    throw new SupabaseStorageConfigurationError(
      'Supabase file storage needs SUPABASE_URL.',
    );
  }
  if (!elevatedKey) {
    throw new SupabaseStorageConfigurationError(
      'A server-only SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) is required. A publishable key alone cannot authorize private uploads.',
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SupabaseStorageConfigurationError(
      'SUPABASE_URL must be a valid HTTP or HTTPS URL.',
    );
  }

  const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (
    (url.protocol !== 'https:' && !(isLocal && url.protocol === 'http:')) ||
    url.username ||
    url.password
  ) {
    throw new SupabaseStorageConfigurationError(
      'SUPABASE_URL must use HTTPS, except for a local development server.',
    );
  }

  return {
    url: url.toString().replace(/\/+$/, ''),
    apiKey: secretKey || publishableKey || elevatedKey,
    authorizationToken: secretKey ? undefined : legacyServiceRoleKey,
    bucket,
  };
}

function getHeaders(apiKey: string, authorizationToken?: string) {
  return {
    apikey: apiKey,
    ...(authorizationToken
      ? { Authorization: `Bearer ${authorizationToken}` }
      : {}),
    'Content-Type': 'application/json',
  };
}

function encodeStoragePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}
