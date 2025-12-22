# Keyway Secrets GitHub Action

[![.env by Keyway](https://keyway.sh/badge.svg?repo=keywaysh/keyway-action)](https://keyway.sh)

Pull secrets from your [Keyway](https://keyway.sh) vault and export them as environment variables in your GitHub Actions workflows.

## Features

- Pull secrets from Keyway vault for any environment
- Export secrets as GitHub Actions environment variables
- Optionally write secrets to a `.env` file
- Automatic secret masking in workflow logs
- Support for self-hosted/enterprise Keyway installations

## Quick Start

```yaml
- uses: keywaysh/keyway-action@v1
  with:
    token: ${{ secrets.KEYWAY_TOKEN }}
```

## Usage

### Basic Usage

Pull production secrets and export as environment variables:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: keywaysh/keyway-action@v1
        with:
          token: ${{ secrets.KEYWAY_TOKEN }}

      - name: Use secrets
        run: |
          echo "Database: $DATABASE_URL"
          ./deploy.sh
```

### Multiple Environments

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: keywaysh/keyway-action@v1
        with:
          token: ${{ secrets.KEYWAY_TOKEN }}
          environment: development

  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: keywaysh/keyway-action@v1
        with:
          token: ${{ secrets.KEYWAY_TOKEN }}
          environment: production
```

### Write to .env File

```yaml
- uses: keywaysh/keyway-action@v1
  with:
    token: ${{ secrets.KEYWAY_TOKEN }}
    env-file: .env
    export-env: false
```

### Full Options

```yaml
- uses: keywaysh/keyway-action@v1
  with:
    # Required: Keyway authentication token
    token: ${{ secrets.KEYWAY_TOKEN }}

    # Vault environment (default: production)
    environment: production

    # Repository in owner/repo format (auto-detected)
    repository: owner/repo

    # Export secrets as GitHub env vars (default: true)
    export-env: true

    # Write secrets to .env file (optional)
    env-file: .env

    # Mask secret values in logs (default: true)
    mask-values: true

    # API URL for self-hosted (default: https://api.keyway.sh)
    api-url: https://api.keyway.sh
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `token` | Keyway API key or GitHub PAT | Yes | - |
| `environment` | Vault environment | No | `production` |
| `repository` | Repository (owner/repo) | No | Auto-detected |
| `export-env` | Export as env vars | No | `true` |
| `env-file` | Write to .env file | No | - |
| `mask-values` | Mask values in logs | No | `true` |
| `api-url` | Keyway API URL | No | `https://api.keyway.sh` |

## Outputs

| Output | Description |
|--------|-------------|
| `secrets-count` | Number of secrets pulled |
| `environment` | Environment that was used |

## Getting a Keyway Token

### Option 1: Keyway API Key (Recommended)

API keys are the most secure option for CI/CD:

1. Go to your [Keyway Dashboard](https://keyway.sh/dashboard/api-keys)
2. Click "Create Key" and select the `read:secrets` scope
3. Copy the generated key (starts with `kw_live_...`)
4. Add it as your `KEYWAY_TOKEN` secret

**Benefits of API keys:**
- Scoped permissions (only what's needed)
- Optional expiration dates
- No access to your GitHub account
- Usage tracking and audit logs

### Option 2: GitHub Personal Access Token

1. Create a [fine-grained PAT](https://github.com/settings/tokens?type=beta) with:
   - **Repository access**: Select the repos you want to use with Keyway
   - **Permissions**: Metadata → Read-only (no other permissions needed)
2. Use this PAT as your `KEYWAY_TOKEN`

### Option 3: Keyway Token via CLI

1. Install the Keyway CLI: `npm install -g @keywaysh/cli`
2. Run `keyway login --token` and follow the prompts
3. The CLI will guide you through creating a GitHub PAT
4. Use that same PAT as your `KEYWAY_TOKEN` in GitHub Actions

> **Note**: Tokens from `keyway login` (device flow without `--token`) are stored encrypted locally and cannot be easily extracted for CI/CD use. Use the `--token` flag to authenticate with a PAT you can reuse.

### Adding to GitHub Secrets

1. Go to your repository Settings > Secrets and variables > Actions
2. Click "New repository secret"
3. Name: `KEYWAY_TOKEN`
4. Value: Your Keyway token
5. Click "Add secret"

## Examples

### Deploy to Vercel

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: keywaysh/keyway-action@v1
        with:
          token: ${{ secrets.KEYWAY_TOKEN }}
          environment: production

      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ env.VERCEL_TOKEN }}
          vercel-org-id: ${{ env.VERCEL_ORG_ID }}
          vercel-project-id: ${{ env.VERCEL_PROJECT_ID }}
```

### Docker Build with Secrets

```yaml
name: Build

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: keywaysh/keyway-action@v1
        with:
          token: ${{ secrets.KEYWAY_TOKEN }}
          env-file: .env

      - name: Build Docker image
        run: docker build --secret id=env,src=.env -t myapp .
```

### Matrix Strategy

```yaml
name: Test

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        environment: [development, staging]
    steps:
      - uses: actions/checkout@v4

      - uses: keywaysh/keyway-action@v1
        with:
          token: ${{ secrets.KEYWAY_TOKEN }}
          environment: ${{ matrix.environment }}

      - run: npm test
```

## Troubleshooting

### "Authentication failed"

- Verify your `KEYWAY_TOKEN` secret is set correctly
- Check if the token has expired
- Ensure the token has access to the repository

### "API key missing required scope"

- Your API key needs the `read:secrets` scope to pull secrets
- Create a new API key with the correct scope in your [Keyway Dashboard](https://keyway.sh/dashboard/api-keys)

### "Vault not found"

- Run `keyway init` locally to create the vault first
- Verify the repository name matches your Keyway vault

### "Access denied"

- Check your Keyway plan limits
- Verify you have access to the repository on GitHub

## License

MIT
