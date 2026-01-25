import { Config, loadConfig, saveConfig, getDefaultConfig, getConfigPath } from '../src/config';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Config', () => {
  const testDir = path.join(os.tmpdir(), 'vertex-test-' + Date.now());
  const testConfigPath = path.join(testDir, 'vertex-provider.json');

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('getDefaultConfig returns valid defaults', () => {
    const config = getDefaultConfig();
    expect(config.auth.method).toBe('adc');
    expect(config.defaultModel).toBe('claude-opus-4-5');
    expect(config.pricing['claude-opus-4-5'].input).toBe(15.0);
    expect(config.pricing['claude-opus-4-5'].output).toBe(75.0);
  });

  test('saveConfig and loadConfig round-trip', () => {
    const config = getDefaultConfig();
    config.gcp.projectId = 'test-project';
    config.gcp.region = 'us-east5';

    saveConfig(config, testConfigPath);
    const loaded = loadConfig(testConfigPath);

    expect(loaded.gcp.projectId).toBe('test-project');
    expect(loaded.gcp.region).toBe('us-east5');
  });

  test('loadConfig returns defaults for missing file', () => {
    const config = loadConfig('/nonexistent/path.json');
    expect(config.auth.method).toBe('adc');
    expect(config.defaultModel).toBe('claude-opus-4-5');
  });

  test('getConfigPath returns path in .claude directory', () => {
    const configPath = getConfigPath();
    expect(configPath).toContain('.claude');
    expect(configPath).toContain('vertex-provider.json');
  });
});
