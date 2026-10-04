import type { ApiErrorCode } from '@core/api.ts';
import { log } from './log.ts';

export type { ApiErrorCode };

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: Record<string, unknown>;
  constructor(code: ApiErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

const STATUS: Record<ApiErrorCode, number> = {
  invalid_input: 400,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  quota_exceeded: 429,
  provider_unavailable: 503,
  internal: 500,
};

export function statusFor(code: ApiErrorCode): number {
  return STATUS[code];
}

/** Unknown errors never leak their message; they are logged with the request ID. */
export function errorResponse(e: unknown, requestId: string): Response {
  let body: { error: { code: ApiErrorCode; message: string; details?: Record<string, unknown> } };
  if (e instanceof ApiError) {
    body = {
      error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) },
    };
  } else {
    log('error', 'unhandled error', {
      requestId,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    });
    body = { error: { code: 'internal', message: 'Something went wrong.' } };
  }
  return Response.json(body, {
    status: statusFor(body.error.code),
    headers: { 'x-request-id': requestId },
  });
}
