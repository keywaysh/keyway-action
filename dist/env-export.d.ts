/**
 * Environment variable export utilities for GitHub Action
 */
/**
 * Parse .env format content into key-value pairs
 * Handles quoted values and comments
 */
export declare function parseEnvContent(content: string): Record<string, string>;
/**
 * Export secrets to GITHUB_ENV for use in subsequent workflow steps
 * Uses core.exportVariable which handles multiline values correctly
 */
export declare function exportToGitHubEnv(secrets: Record<string, string>): void;
/**
 * Write secrets to a .env file
 */
export declare function writeEnvFile(filePath: string, content: string): Promise<void>;
