import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface ModelPricing {
  input: number;  // per 1M tokens
  output: number; // per 1M tokens
}

export interface Config {
  auth: {
    method: 'adc' | 'service-account';
    serviceAccountPath: string | null;
  };
  gcp: {
    projectId: string;
    region: string;
  };
  defaultModel: string;
  pricing: Record<string, ModelPricing>;
  active: boolean;
}

export function getDefaultConfig(): Config {
  return {
    auth: {
      method: 'adc',
      serviceAccountPath: null,
    },
    gcp: {
      projectId: '',
      region: 'us-east5',
    },
    defaultModel: 'claude-opus-4-5',
    pricing: {
      'claude-opus-4-5': { input: 15.0, output: 75.0 },
      'claude-sonnet-4': { input: 3.0, output: 15.0 },
      'claude-haiku-3-5': { input: 0.8, output: 4.0 },
    },
    active: false,
  };
}

export function getConfigPath(): string {
  return path.join(os.homedir(), '.claude', 'vertex-provider.json');
}

export function loadConfig(configPath?: string): Config {
  const filePath = configPath || getConfigPath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      return { ...getDefaultConfig(), ...JSON.parse(data) };
    }
  } catch (error) {
    // Return defaults on error
  }
  return getDefaultConfig();
}

export function saveConfig(config: Config, configPath?: string): void {
  const filePath = configPath || getConfigPath();
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
}
