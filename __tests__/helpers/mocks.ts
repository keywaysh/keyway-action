/**
 * MSW handlers for API mocking in tests
 */

import { http, HttpResponse } from 'msw';

const API_URL = 'https://api.keyway.sh';

export const handlers = [
  // Successful pull
  http.get(`${API_URL}/v1/secrets/pull`, ({ request }) => {
    const url = new URL(request.url);
    const auth = request.headers.get('Authorization');

    // Check authentication
    if (!auth?.startsWith('Bearer ')) {
      return HttpResponse.json(
        {
          type: 'https://keyway.sh/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Check for invalid token
    if (auth === 'Bearer invalid-token') {
      return HttpResponse.json(
        {
          type: 'https://keyway.sh/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid or expired token',
        },
        { status: 401 }
      );
    }

    // Check for forbidden (plan limit)
    if (auth === 'Bearer limited-token') {
      return HttpResponse.json(
        {
          type: 'https://keyway.sh/errors/forbidden',
          title: 'Forbidden',
          status: 403,
          detail: 'Free plan limit exceeded',
          upgradeUrl: 'https://app.keyway.sh/upgrade',
        },
        { status: 403 }
      );
    }

    const repo = url.searchParams.get('repo');
    const environment = url.searchParams.get('environment');

    // Check for non-existent vault
    if (repo === 'owner/nonexistent') {
      return HttpResponse.json(
        {
          type: 'https://keyway.sh/errors/not-found',
          title: 'Not Found',
          status: 404,
          detail: 'Vault not found for this repository',
        },
        { status: 404 }
      );
    }

    // Return mock secrets
    const content =
      environment === 'empty'
        ? ''
        : `API_KEY=secret123
DATABASE_URL=postgres://user:pass@host/db
JWT_SECRET=supersecret
MULTILINE="line1
line2"`;

    return HttpResponse.json({
      data: { content },
    });
  }),
];

export { API_URL };
