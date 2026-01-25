#!/usr/bin/env node
import { Database } from '../database';
import { StateManager } from '../state';
import { checkAnthropic, checkVertexAI, buildPromptResponse } from '../provider-check';
import { loadConfig } from '../config';

async function main() {
  const db = new Database();
  const state = new StateManager();

  const currentState = state.getState();

  if (!currentState.active) {
    console.log('ℹ️ Vertex AI is not currently active.');
    db.close();
    return;
  }

  // Health check Anthropic before switching
  const anthropicStatus = await checkAnthropic();

  if (!anthropicStatus.available && anthropicStatus.errorType === 'credits') {
    // Check if Vertex is still available as alternative
    const config = loadConfig();
    const vertexStatus = await checkVertexAI(config);
    const prompt = buildPromptResponse(anthropicStatus, vertexStatus);

    console.log(JSON.stringify(prompt));
    process.exit(2);
  }

  if (!anthropicStatus.available && anthropicStatus.errorType === 'auth') {
    console.error(`❌ Anthropic error: ${anthropicStatus.error}`);
    console.error('   Fix: Set ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }

  // End session in database
  if (currentState.sessionId) {
    db.endSession(currentState.sessionId);
  }

  // Show final stats
  console.log('📊 Session Summary:');
  console.log(`   Input tokens:  ${currentState.totalInputTokens.toLocaleString()}`);
  console.log(`   Output tokens: ${currentState.totalOutputTokens.toLocaleString()}`);
  console.log(`   Total cost:    $${currentState.totalCost.toFixed(4)}`);

  // Deactivate
  state.deactivate();

  console.log('\n✅ Switched back to Anthropic API');

  db.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
