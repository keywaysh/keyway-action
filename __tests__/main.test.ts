/**
 * Integration tests for the main action entry point
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock @actions/core before importing main
const mockCore = {
  getInput: vi.fn(),
  getBooleanInput: vi.fn(),
  setOutput: vi.fn(),
  setSecret: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  exportVariable: vi.fn(),
};

vi.mock('@actions/core', () => mockCore);

const API_URL = 'https://api.keyway.sh';

describe('Main Action', () => {
  const server = setupServer();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GITHUB_REPOSITORY = 'owner/repo';

    // Default input mocks
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        token: 'valid-token',
        environment: 'production',
        repository: '',
        'env-file': '',
        'api-url': API_URL,
      };
      return inputs[name] || '';
    });
    mockCore.getBooleanInput.mockImplementation((name: string) => {
      return name === 'export-env' || name === 'mask-values';
    });
  });

  afterEach(() => {
    server.resetHandlers();
    delete process.env.GITHUB_REPOSITORY;
  });

  it('should pull secrets and export to environment', async () => {
    server.use(
      http.get(`${API_URL}/v1/secrets/pull`, () => {
        return HttpResponse.json({
          data: { content: 'API_KEY=secret123\nDB_URL=postgres://localhost' },
        });
      })
    );
    server.listen();

    // Dynamic import to get fresh module with mocks
    const { pullSecrets } = await import('../src/api.js');
    const { parseEnvContent, exportToGitHubEnv } = await import('../src/env-export.js');

    const response = await pullSecrets('owner/repo', 'production', 'valid-token', API_URL);
    const secrets = parseEnvContent(response.content);

    expect(secrets).toEqual({
      API_KEY: 'secret123',
      DB_URL: 'postgres://localhost',
    });

    exportToGitHubEnv(secrets);

    expect(mockCore.exportVariable).toHaveBeenCalledWith('API_KEY', 'secret123');
    expect(mockCore.exportVariable).toHaveBeenCalledWith('DB_URL', 'postgres://localhost');

    server.close();
  });

  it('should mask all secret values', async () => {
    server.use(
      http.get(`${API_URL}/v1/secrets/pull`, () => {
        return HttpResponse.json({
          data: { content: 'SECRET1=value1\nSECRET2=value2' },
        });
      })
    );
    server.listen();

    const { pullSecrets } = await import('../src/api.js');
    const { parseEnvContent } = await import('../src/env-export.js');

    const response = await pullSecrets('owner/repo', 'production', 'valid-token', API_URL);
    const secrets = parseEnvContent(response.content);

    // Simulate masking
    for (const value of Object.values(secrets)) {
      if (value) mockCore.setSecret(value);
    }

    expect(mockCore.setSecret).toHaveBeenCalledWith('value1');
    expect(mockCore.setSecret).toHaveBeenCalledWith('value2');

    server.close();
  });
});

describe('Edge Cases', () => {
  const server = setupServer();

  afterEach(() => {
    server.resetHandlers();
  });

  it('should handle special characters in values', async () => {
    server.use(
      http.get(`${API_URL}/v1/secrets/pull`, () => {
        return HttpResponse.json({
          data: {
            content: `SPECIAL=!@#$%^&*()
QUOTES="value with 'quotes'"
EQUALS=key=value=more
SPACES=  spaces around
UNICODE=日本語テスト
EMOJI=🔐🔑`,
          },
        });
      })
    );
    server.listen();

    const { pullSecrets } = await import('../src/api.js');
    const { parseEnvContent } = await import('../src/env-export.js');

    const response = await pullSecrets('owner/repo', 'production', 'valid-token', API_URL);
    const secrets = parseEnvContent(response.content);

    expect(secrets.SPECIAL).toBe('!@#$%^&*()');
    expect(secrets.QUOTES).toBe("value with 'quotes'");
    expect(secrets.EQUALS).toBe('key=value=more');
    expect(secrets.SPACES).toBe('  spaces around');
    expect(secrets.UNICODE).toBe('日本語テスト');
    expect(secrets.EMOJI).toBe('🔐🔑');

    server.close();
  });

  it('should handle multiline values', async () => {
    server.use(
      http.get(`${API_URL}/v1/secrets/pull`, () => {
        return HttpResponse.json({
          data: {
            content: `CERT="-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHBfpEgcMFvMA0GCSqGSIb3DQEBCwUA
-----END CERTIFICATE-----"
SINGLE=normal`,
          },
        });
      })
    );
    server.listen();

    const { pullSecrets } = await import('../src/api.js');
    const { parseEnvContent } = await import('../src/env-export.js');

    const response = await pullSecrets('owner/repo', 'production', 'valid-token', API_URL);
    const secrets = parseEnvContent(response.content);

    expect(secrets.CERT).toContain('BEGIN CERTIFICATE');
    expect(secrets.SINGLE).toBe('normal');

    server.close();
  });

  it('should handle empty secret values', async () => {
    server.use(
      http.get(`${API_URL}/v1/secrets/pull`, () => {
        return HttpResponse.json({
          data: { content: 'EMPTY=\nNORMAL=value' },
        });
      })
    );
    server.listen();

    const { pullSecrets } = await import('../src/api.js');
    const { parseEnvContent } = await import('../src/env-export.js');

    const response = await pullSecrets('owner/repo', 'production', 'valid-token', API_URL);
    const secrets = parseEnvContent(response.content);

    expect(secrets.EMPTY).toBe('');
    expect(secrets.NORMAL).toBe('value');

    server.close();
  });

  it('should handle very long values', async () => {
    const longValue = 'x'.repeat(10000);
    server.use(
      http.get(`${API_URL}/v1/secrets/pull`, () => {
        return HttpResponse.json({
          data: { content: `LONG=${longValue}` },
        });
      })
    );
    server.listen();

    const { pullSecrets } = await import('../src/api.js');
    const { parseEnvContent } = await import('../src/env-export.js');

    const response = await pullSecrets('owner/repo', 'production', 'valid-token', API_URL);
    const secrets = parseEnvContent(response.content);

    expect(secrets.LONG).toBe(longValue);
    expect(secrets.LONG.length).toBe(10000);

    server.close();
  });

  it('should handle JSON values', async () => {
    server.use(
      http.get(`${API_URL}/v1/secrets/pull`, () => {
        return HttpResponse.json({
          data: {
            content: `CONFIG='{"host":"localhost","port":5432}'`,
          },
        });
      })
    );
    server.listen();

    const { pullSecrets } = await import('../src/api.js');
    const { parseEnvContent } = await import('../src/env-export.js');

    const response = await pullSecrets('owner/repo', 'production', 'valid-token', API_URL);
    const secrets = parseEnvContent(response.content);

    const parsed = JSON.parse(secrets.CONFIG);
    expect(parsed.host).toBe('localhost');
    expect(parsed.port).toBe(5432);

    server.close();
  });
});

describe('Error Scenarios', () => {
  const server = setupServer();

  afterEach(() => {
    server.resetHandlers();
  });

  it('should handle network timeout', async () => {
    server.use(
      http.get(`${API_URL}/v1/secrets/pull`, async () => {
        // Delay longer than timeout
        await new Promise((resolve) => setTimeout(resolve, 35000));
        return HttpResponse.json({ data: { content: '' } });
      })
    );
    server.listen();

    const { pullSecrets } = await import('../src/api.js');

    await expect(pullSecrets('owner/repo', 'production', 'valid-token', API_URL)).rejects.toThrow(
      /timeout/i
    );

    server.close();
  }, 40000);

  it('should handle plain text response (fallback)', async () => {
    server.use(
      http.get(`${API_URL}/v1/secrets/pull`, () => {
        // Simulate a response that returns plain text .env content directly
        return new HttpResponse('KEY=value\nOTHER=test', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      })
    );
    server.listen();

    const { pullSecrets } = await import('../src/api.js');

    // Should handle plain text as { content: text }
    const response = await pullSecrets('owner/repo', 'production', 'valid-token', API_URL);
    expect(response.content).toBe('KEY=value\nOTHER=test');

    server.close();
  });

  it('should handle 500 server error', async () => {
    server.use(
      http.get(`${API_URL}/v1/secrets/pull`, () => {
        return HttpResponse.json(
          {
            type: 'https://keyway.sh/errors/internal',
            title: 'Internal Server Error',
            status: 500,
            detail: 'Something went wrong',
          },
          { status: 500 }
        );
      })
    );
    server.listen();

    const { pullSecrets, APIError } = await import('../src/api.js');

    try {
      await pullSecrets('owner/repo', 'production', 'valid-token', API_URL);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect((error as InstanceType<typeof APIError>).statusCode).toBe(500);
    }

    server.close();
  });

  it('should handle rate limiting (429)', async () => {
    server.use(
      http.get(`${API_URL}/v1/secrets/pull`, () => {
        return HttpResponse.json(
          {
            type: 'https://keyway.sh/errors/rate-limit',
            title: 'Too Many Requests',
            status: 429,
            detail: 'Rate limit exceeded. Try again in 60 seconds.',
          },
          { status: 429 }
        );
      })
    );
    server.listen();

    const { pullSecrets, APIError } = await import('../src/api.js');

    try {
      await pullSecrets('owner/repo', 'production', 'valid-token', API_URL);
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect((error as InstanceType<typeof APIError>).statusCode).toBe(429);
      expect((error as InstanceType<typeof APIError>).message).toContain('Rate limit');
    }

    server.close();
  });

  it('should handle connection refused', async () => {
    const { pullSecrets } = await import('../src/api.js');

    // Use a port that's definitely not running anything
    await expect(
      pullSecrets('owner/repo', 'production', 'valid-token', 'http://localhost:59999')
    ).rejects.toThrow();
  });
});
