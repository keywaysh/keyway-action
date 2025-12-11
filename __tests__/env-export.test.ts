/**
 * Tests for env-export utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseEnvContent, exportToGitHubEnv } from '../src/env-export.js';
import * as core from '@actions/core';

// Mock @actions/core
vi.mock('@actions/core', () => ({
  exportVariable: vi.fn(),
}));

describe('parseEnvContent', () => {
  it('should parse simple key=value pairs', () => {
    const content = `KEY1=value1
KEY2=value2`;
    const result = parseEnvContent(content);

    expect(result).toEqual({
      KEY1: 'value1',
      KEY2: 'value2',
    });
  });

  it('should handle quoted values', () => {
    const content = `DOUBLE="double quoted"
SINGLE='single quoted'`;
    const result = parseEnvContent(content);

    expect(result).toEqual({
      DOUBLE: 'double quoted',
      SINGLE: 'single quoted',
    });
  });

  it('should skip comments', () => {
    const content = `# This is a comment
KEY=value
# Another comment`;
    const result = parseEnvContent(content);

    expect(result).toEqual({
      KEY: 'value',
    });
  });

  it('should skip empty lines', () => {
    const content = `KEY1=value1

KEY2=value2

`;
    const result = parseEnvContent(content);

    expect(result).toEqual({
      KEY1: 'value1',
      KEY2: 'value2',
    });
  });

  it('should handle values with equals signs', () => {
    const content = `URL=https://example.com?param=value`;
    const result = parseEnvContent(content);

    expect(result).toEqual({
      URL: 'https://example.com?param=value',
    });
  });

  it('should handle empty values', () => {
    const content = `EMPTY=
KEY=value`;
    const result = parseEnvContent(content);

    expect(result).toEqual({
      EMPTY: '',
      KEY: 'value',
    });
  });

  it('should return empty object for empty content', () => {
    const result = parseEnvContent('');
    expect(result).toEqual({});
  });

  it('should return empty object for only comments', () => {
    const content = `# Comment 1
# Comment 2`;
    const result = parseEnvContent(content);
    expect(result).toEqual({});
  });
});

describe('exportToGitHubEnv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should export all secrets to GitHub environment', () => {
    const secrets = {
      KEY1: 'value1',
      KEY2: 'value2',
    };

    exportToGitHubEnv(secrets);

    expect(core.exportVariable).toHaveBeenCalledTimes(2);
    expect(core.exportVariable).toHaveBeenCalledWith('KEY1', 'value1');
    expect(core.exportVariable).toHaveBeenCalledWith('KEY2', 'value2');
  });

  it('should handle empty secrets object', () => {
    exportToGitHubEnv({});
    expect(core.exportVariable).not.toHaveBeenCalled();
  });
});
