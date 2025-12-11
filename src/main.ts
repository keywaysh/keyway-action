/**
 * Keyway GitHub Action - Main Entry Point
 *
 * Pull secrets from Keyway vault and export as environment variables
 */

import * as core from '@actions/core';
import { pullSecrets, APIError } from './api.js';
import { parseEnvContent, exportToGitHubEnv, writeEnvFile } from './env-export.js';

async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('token', { required: true });
    const environment = core.getInput('environment') || 'production';
    const repository = core.getInput('repository') || process.env.GITHUB_REPOSITORY;
    const exportEnv = core.getBooleanInput('export-env');
    const envFile = core.getInput('env-file') || undefined;
    const maskValues = core.getBooleanInput('mask-values');
    const apiUrl = core.getInput('api-url') || 'https://api.keyway.sh';

    // Validate required inputs
    if (!repository) {
      throw new Error(
        'Repository not specified and GITHUB_REPOSITORY environment variable not set. ' +
          'Please provide the repository input in owner/repo format.'
      );
    }

    // Validate repository format
    if (!repository.includes('/')) {
      throw new Error(
        `Invalid repository format: "${repository}". Expected format: owner/repo`
      );
    }

    core.info(`Pulling secrets from Keyway for ${repository} (${environment})`);

    // Pull secrets from Keyway API
    const response = await pullSecrets(repository, environment, token, apiUrl);
    const secrets = parseEnvContent(response.content);
    const secretCount = Object.keys(secrets).length;

    if (secretCount === 0) {
      core.warning(`No secrets found for ${repository} in environment "${environment}"`);
    } else {
      core.info(`Retrieved ${secretCount} secret${secretCount === 1 ? '' : 's'}`);
    }

    // Mask secret values in logs if enabled (default: true)
    if (maskValues) {
      for (const value of Object.values(secrets)) {
        if (value) {
          core.setSecret(value);
        }
      }
    }

    // Export to GITHUB_ENV for subsequent steps
    if (exportEnv) {
      exportToGitHubEnv(secrets);
      core.info(`Exported ${secretCount} secret${secretCount === 1 ? '' : 's'} to environment`);
    }

    // Write to .env file if path specified
    if (envFile) {
      await writeEnvFile(envFile, response.content);
      core.info(`Wrote secrets to ${envFile}`);
    }

    // Set outputs
    core.setOutput('secrets-count', secretCount);
    core.setOutput('environment', environment);
  } catch (error) {
    if (error instanceof APIError) {
      // Handle specific API errors
      if (error.statusCode === 401) {
        core.setFailed(
          'Authentication failed. Please check your KEYWAY_TOKEN is valid and not expired.'
        );
      } else if (error.statusCode === 403) {
        let message = `Access denied: ${error.message}`;
        if (error.upgradeUrl) {
          message += `\nUpgrade your plan: ${error.upgradeUrl}`;
        }
        core.setFailed(message);
      } else if (error.statusCode === 404) {
        core.setFailed(
          `Vault not found. Make sure the vault is initialized for this repository. ` +
            `Run "keyway init" locally first.`
        );
      } else {
        core.setFailed(`API Error (${error.statusCode}): ${error.message}`);
      }
    } else if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

run();
