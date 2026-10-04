/// <reference path="./runtime.d.ts" />
import { ApiError, errorResponse } from './errors.ts';

export const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, x-client-info, apikey, content-type, x-firebase-appcheck',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
};

export type Route = {
  method: string;
  pattern: URLPattern;
  handle: (req: Request, params: Record<string, string>) => Promise<Response>;
};

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function withHeaders(res: Response, requestId: string): Response {
  const headers = new Headers(res.headers);
  headers.set('x-request-id', requestId);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** Path after `/functions/v1/<name>` or `/<name>`; `/` when nothing follows. */
function subPath(pathname: string, prefix: string): string {
  for (const base of [`/functions/v1/${prefix}`, `/${prefix}`]) {
    if (pathname === base) return '/';
    if (pathname.startsWith(`${base}/`)) return pathname.slice(base.length);
  }
  return pathname;
}

export function router(prefix: string, routes: Route[]): (req: Request) => Promise<Response> {
  return async (req) => {
    const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID();
    if (req.method === 'OPTIONS')
      return withHeaders(new Response(null, { status: 204 }), requestId);
    try {
      const path = subPath(new URL(req.url).pathname, prefix);
      for (const route of routes) {
        const match = route.pattern.exec({ pathname: path });
        if (!match) continue;
        if (route.method !== req.method) continue;
        const params: Record<string, string> = {};
        for (const [k, v] of Object.entries(match.pathname.groups))
          if (v !== undefined) params[k] = v;
        return withHeaders(await route.handle(req, params), requestId);
      }
      throw new ApiError('not_found', 'Route not found.');
    } catch (e) {
      return withHeaders(errorResponse(e, requestId), requestId);
    }
  };
}

/** Reads a JSON body, rejecting anything over `maxBytes` or that is not valid JSON. */
export async function readJson<T>(req: Request, maxBytes = 64_000): Promise<T> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > maxBytes) throw new ApiError('invalid_input', 'Request body is too large.');
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new ApiError('invalid_input', 'Request body is too large.');
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new ApiError('invalid_input', 'Request body must be valid JSON.');
  }
}
