#!/bin/bash
#
# Local testing script for keyway-action
# Starts a mock server and runs the action locally
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ACTION_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔧 Keyway Action Local Test"
echo "============================"

# Check if node is available
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed"
    exit 1
fi

# Build the action if needed
if [ ! -f "$ACTION_DIR/dist/index.js" ]; then
    echo "📦 Building action..."
    cd "$ACTION_DIR"
    pnpm build
fi

# Create test runner that can set env vars with hyphens
cat > /tmp/keyway-test-runner.js << 'TEST_RUNNER'
const { spawn } = require('child_process');
const path = require('path');

// Set environment variables (including those with hyphens)
const env = {
  ...process.env,
  'INPUT_TOKEN': 'test-token',
  'INPUT_ENVIRONMENT': 'development',
  'INPUT_REPOSITORY': 'test/repo',
  'INPUT_EXPORT-ENV': 'false',
  'INPUT_ENV-FILE': '/tmp/test-output.env',
  'INPUT_MASK-VALUES': 'true',
  'INPUT_API-URL': 'http://localhost:9999',
  'GITHUB_REPOSITORY': 'test/repo',
};

const actionPath = process.argv[2];

const child = spawn('node', [actionPath], {
  env,
  stdio: 'inherit',
});

child.on('close', (code) => {
  process.exit(code || 0);
});
TEST_RUNNER

# Create mock server
echo "🚀 Starting mock server..."

cat > /tmp/keyway-mock-server.js << 'MOCK_SERVER'
const http = require('http');

const testSecrets = {
  API_KEY: 'sk-test-12345',
  DATABASE_URL: 'postgres://user:pass@localhost:5432/testdb',
  JWT_SECRET: 'super-secret-jwt-token',
  REDIS_URL: 'redis://localhost:6379',
  SPECIAL_CHARS: '!@#$%^&*()',
  JSON_CONFIG: '{"host":"localhost","port":3000}',
};

const content = Object.entries(testSecrets)
  .map(([k, v]) => `${k}=${v}`)
  .join('\n');

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname}`);

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200);
    res.end('OK');
    return;
  }

  // Pull secrets
  if (url.pathname === '/v1/secrets/pull') {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        type: 'https://keyway.sh/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Authentication required'
      }));
      return;
    }

    const token = auth.replace('Bearer ', '');

    if (token === 'invalid') {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        type: 'https://keyway.sh/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Invalid or expired token'
      }));
      return;
    }

    const repo = url.searchParams.get('repo');
    const environment = url.searchParams.get('environment');

    console.log(`  → repo: ${repo}, env: ${environment}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: { content } }));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = process.env.PORT || 9999;
server.listen(PORT, () => {
  console.log(`\n🎯 Mock Keyway API running on http://localhost:${PORT}`);
  console.log(`\nTest secrets available:`);
  Object.keys(testSecrets).forEach(k => console.log(`  - ${k}`));
  console.log(`\nPress Ctrl+C to stop\n`);
});
MOCK_SERVER

# Start mock server in background
node /tmp/keyway-mock-server.js &
MOCK_PID=$!

# Wait for server to start
sleep 1

# Cleanup function
cleanup() {
    echo ""
    echo "🛑 Stopping mock server..."
    kill $MOCK_PID 2>/dev/null || true
    rm -f /tmp/keyway-mock-server.js /tmp/test-output.env /tmp/keyway-test-runner.js
}
trap cleanup EXIT

# Check if server is running
if ! curl -s http://localhost:9999/health > /dev/null; then
    echo "❌ Mock server failed to start"
    exit 1
fi

echo ""
echo "📋 Running action test..."
echo ""

# Run the action using our Node.js wrapper
node /tmp/keyway-test-runner.js "$ACTION_DIR/dist/index.js"

echo ""
echo "📄 Output .env file:"
echo "--------------------"
cat /tmp/test-output.env

echo ""
echo ""
echo "✅ Local test completed successfully!"
