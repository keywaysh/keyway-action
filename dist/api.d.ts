/**
 * Keyway API client for GitHub Action
 * Simplified version of the CLI client focused on pulling secrets
 */
import type { PullSecretsResponse } from './types.js';
export declare class APIError extends Error {
    statusCode: number;
    error: string;
    upgradeUrl?: string | undefined;
    constructor(statusCode: number, error: string, message: string, upgradeUrl?: string | undefined);
}
/**
 * Pull secrets from Keyway vault
 */
export declare function pullSecrets(repoFullName: string, environment: string, accessToken: string, apiUrl: string): Promise<PullSecretsResponse>;
