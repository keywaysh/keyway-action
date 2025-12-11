/**
 * Tests for API client
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { pullSecrets, APIError } from '../src/api.js';
import { handlers, API_URL } from './helpers/mocks.js';

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('pullSecrets', () => {
  it('should pull secrets successfully', async () => {
    const result = await pullSecrets('owner/repo', 'production', 'valid-token', API_URL);

    expect(result.content).toContain('API_KEY=secret123');
    expect(result.content).toContain('DATABASE_URL=postgres://user:pass@host/db');
  });

  it('should throw APIError on 401 unauthorized', async () => {
    await expect(
      pullSecrets('owner/repo', 'production', 'invalid-token', API_URL)
    ).rejects.toThrow(APIError);

    try {
      await pullSecrets('owner/repo', 'production', 'invalid-token', API_URL);
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(401);
    }
  });

  it('should throw APIError on 403 forbidden with upgradeUrl', async () => {
    try {
      await pullSecrets('owner/repo', 'production', 'limited-token', API_URL);
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(403);
      expect((error as APIError).upgradeUrl).toBe('https://app.keyway.sh/upgrade');
    }
  });

  it('should throw APIError on 404 not found', async () => {
    await expect(
      pullSecrets('owner/nonexistent', 'production', 'valid-token', API_URL)
    ).rejects.toThrow(APIError);

    try {
      await pullSecrets('owner/nonexistent', 'production', 'valid-token', API_URL);
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).statusCode).toBe(404);
    }
  });

  it('should handle empty secrets', async () => {
    const result = await pullSecrets('owner/repo', 'empty', 'valid-token', API_URL);
    expect(result.content).toBe('');
  });
});
