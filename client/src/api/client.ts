import axios, { AxiosError, type AxiosInstance } from 'axios';

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
  details?: unknown;
}

export const api: AxiosInstance = axios.create({
  baseURL: '/api',
  // The session is an httpOnly cookie, so it must ride along with requests.
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Normalises every failure into ApiError, so callers branch on a stable code
 * rather than pattern-matching prose or poking at axios internals.
 */
export function toApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiError | undefined;
    if (data?.code !== undefined) {
      return data;
    }
    if (error.code === 'ERR_NETWORK') {
      return {
        code: 'NETWORK_ERROR',
        message: 'Cannot reach the server. Is the API running?',
      };
    }
  }
  return { code: 'UNKNOWN', message: 'Something went wrong' };
}

/** True for the 401 that means "not signed in", so the app can redirect. */
export function isUnauthorized(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 401;
}
