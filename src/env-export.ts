/**
 * Environment variable export utilities for GitHub Action
 */

import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Parse .env format content into key-value pairs
 * Handles quoted values and comments
 */
export function parseEnvContent(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1);

    // Handle quoted values (double or single quotes)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Export secrets to GITHUB_ENV for use in subsequent workflow steps
 * Uses core.exportVariable which handles multiline values correctly
 */
export function exportToGitHubEnv(secrets: Record<string, string>): void {
  for (const [key, value] of Object.entries(secrets)) {
    core.exportVariable(key, value);
  }
}

/**
 * Write secrets to a .env file
 */
export async function writeEnvFile(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);

  // Create directory if it doesn't exist
  if (dir && dir !== '.') {
    await fs.promises.mkdir(dir, { recursive: true });
  }

  await fs.promises.writeFile(filePath, content, 'utf-8');
}
