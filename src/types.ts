/**
 * Types for Keyway GitHub Action
 */

export interface PullSecretsResponse {
  content: string;
}

export interface ActionInputs {
  token: string;
  environment: string;
  repository: string;
  exportEnv: boolean;
  envFile: string | undefined;
  maskValues: boolean;
  apiUrl: string;
}

export interface APIErrorResponse {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  upgradeUrl?: string;
}
