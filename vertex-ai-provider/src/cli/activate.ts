#!/usr/bin/env node
import { Database } from '../database';
import { StateManager } from '../state';
import { loadConfig } from '../config';
import { checkVertexAI, checkAnthropic, buildPromptResponse } from '../provider-check';

async function main() {
  const config = loadConfig();

  if (!config.gcp.projectId) {
    console.error('❌ No configuration found. Run /vertex setup first.');
    process.exit(1);
  }

  // Health check before activation
  const vertexStatus = await checkVertexAI(config);

  if (!vertexStatus.available && vertexStatus.errorType === 'credits') {
    // Check alternative
    const anthropicStatus = await checkAnthropic();
    const prompt = buildPromptResponse(vertexStatus, anthropicStatus);

    // Output JSON for command to parse
    console.log(JSON.stringify(prompt));
    process.exit(2); // Special exit code for "needs prompt"
  }

  if (!vertexStatus.available) {
    // Non-credit error - show fix instructions
    console.error(`❌ Vertex AI error: ${vertexStatus.error}`);
    if (vertexStatus.errorType === 'auth') {
      console.error('   Fix: Run "gcloud auth application-default login"');
    } else if (vertexStatus.errorType === 'config') {
      console.error('   Fix: Run /vertex setup to configure');
    }
    process.exit(1);
  }

  // All good - activate
  const db = new Database();
  const state = new StateManager();

  const session = db.createSession(config.defaultModel);
  state.activate(session.id, config.defaultModel);

  console.log('✅ Vertex AI activated');
  console.log(`   Model: ${config.defaultModel}`);
  console.log(`   Project: ${config.gcp.projectId}`);
  console.log(`   Region: ${config.gcp.region}`);

  db.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
