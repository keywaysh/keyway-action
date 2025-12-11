/**
 * Keyway API client for GitHub Action
 * Simplified version of the CLI client focused on pulling secrets
 */

import type { PullSecretsResponse, APIErrorResponse } from './types.js';

const USER_AGENT = 'keyway-action/1.0.0';
const DEFAULT_TIMEOUT_MS = 30000;

export class APIError extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    message: string,
    public upgradeUrl?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Fetch with timeout handling
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Handle API response and extract data or throw error
 */
async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!response.ok) {
    if (contentType.includes('application/json')) {
      try {
        const error = JSON.parse(text) as APIErrorResponse;
        throw new APIError(
          response.status,
          error.title || 'Error',
          error.detail || `HTTP ${response.status}`,
          error.upgradeUrl
        );
      } catch (e) {
        if (e instanceof APIError) throw e;
        throw new APIError(response.status, 'Error', text || `HTTP ${response.status}`);
      }
    }
    throw new APIError(response.status, 'Error', text || `HTTP ${response.status}`);
  }

  if (!text) {
    return {} as T;
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as T;
    } catch {
      // Fall through to treat as text
    }
  }

  return { content: text } as unknown as T;
}

/**
 * Pull secrets from Keyway vault
 */
export async function pullSecrets(
  repoFullName: string,
  environment: string,
  accessToken: string,
  apiUrl: string
): Promise<PullSecretsResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': USER_AGENT,
    Authorization: `Bearer ${accessToken}`,
  };

  const params = new URLSearchParams({
    repo: repoFullName,
    environment,
  });

  const response = await fetchWithTimeout(`${apiUrl}/v1/secrets/pull?${params}`, {
    method: 'GET',
    headers,
  });

  const result = await handleResponse<{ data?: { content: string }; content?: string }>(response);

  // Handle both wrapped response { data: { content } } and plain { content }
  if (result.data?.content !== undefined) {
    return { content: result.data.content };
  }
  if (result.content !== undefined) {
    return { content: result.content };
  }

  // Fallback for unexpected response format
  throw new APIError(
    500,
    'Invalid Response',
    'Unexpected API response format. Expected { data: { content } } or { content }'
  );
}
