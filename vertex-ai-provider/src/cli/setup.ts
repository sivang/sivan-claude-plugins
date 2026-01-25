#!/usr/bin/env node
import { saveConfig, getDefaultConfig } from '../config';

async function main() {
  const args = process.argv.slice(2);

  const getArg = (name: string): string | null => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 && args[index + 1] ? args[index + 1] : null;
  };

  const config = getDefaultConfig();

  const project = getArg('project');
  const region = getArg('region');
  const auth = getArg('auth');
  const serviceAccountPath = getArg('service-account-path');
  const model = getArg('model');

  if (project) config.gcp.projectId = project;
  if (region) config.gcp.region = region;
  if (auth === 'service-account') {
    config.auth.method = 'service-account';
    config.auth.serviceAccountPath = serviceAccountPath;
  } else {
    config.auth.method = 'adc';
  }
  if (model) config.defaultModel = model;

  saveConfig(config);

  console.log('✅ Configuration saved!');
  console.log(`   Project: ${config.gcp.projectId}`);
  console.log(`   Region:  ${config.gcp.region}`);
  console.log(`   Auth:    ${config.auth.method}`);
  console.log(`   Model:   ${config.defaultModel}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
