#!/usr/bin/env node
import { Database } from '../database';
import { StateManager } from '../state';

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k`;
  return tokens.toString();
}

function formatDuration(startedAt: string): string {
  const start = new Date(startedAt);
  const now = new Date();
  const ms = now.getTime() - start.getTime();
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function drawGraph(data: Array<{ date: string; cost: number }>): void {
  if (data.length === 0) return;

  const maxCost = Math.max(...data.map(d => d.cost), 0.01);
  const barWidth = 16;

  console.log('\n📈 Daily Cost');
  console.log('━'.repeat(45));

  for (const day of data) {
    const filled = Math.round((day.cost / maxCost) * barWidth);
    const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
    const date = day.date.slice(5); // MM-DD
    console.log(`${date} │${bar}│ $${day.cost.toFixed(2)}`);
  }
  console.log('━'.repeat(45));
}

async function main() {
  const args = process.argv.slice(2);
  const db = new Database();
  const state = new StateManager();

  const showGraph = args.includes('--graph');
  let period = args.find(a => !a.startsWith('--')) || 'session';

  if (period === 'session') {
    const currentState = state.getState();

    if (!currentState.active) {
      console.log('ℹ️ No active Vertex AI session.');
      console.log('   Run /vertex to start a session.');
      db.close();
      return;
    }

    const totalTokens = currentState.totalInputTokens + currentState.totalOutputTokens;

    console.log('\n📊 Current Session Usage');
    console.log('━'.repeat(40));
    console.log(`Model:          ${currentState.model}`);
    console.log(`Duration:       ${formatDuration(currentState.startedAt!)}`);
    console.log('');
    console.log('Tokens:');
    console.log(`  Input:        ${formatTokens(currentState.totalInputTokens).padStart(10)}`);
    console.log(`  Output:       ${formatTokens(currentState.totalOutputTokens).padStart(10)}`);
    console.log(`  Total:        ${formatTokens(totalTokens).padStart(10)}`);
    console.log('');
    console.log(`Cost:           $${currentState.totalCost.toFixed(4)}`);
    console.log('━'.repeat(40));
  } else {
    const now = new Date();
    let fromDate: string;
    const toDate = now.toISOString().slice(0, 10);

    switch (period) {
      case 'today':
        fromDate = toDate;
        break;
      case 'week':
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        break;
      case 'month':
        fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        break;
      default:
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    }

    const stats = db.getUsageStats(fromDate, toDate);

    console.log(`\n📊 Usage: ${period}`);
    console.log('━'.repeat(40));
    console.log(`Sessions:       ${stats.totalSessions}`);
    console.log(`Requests:       ${stats.totalRequests}`);
    console.log(`Input tokens:   ${formatTokens(stats.totalInputTokens)}`);
    console.log(`Output tokens:  ${formatTokens(stats.totalOutputTokens)}`);
    console.log(`Total cost:     $${stats.totalCost.toFixed(2)}`);

    if (Object.keys(stats.byModel).length > 0) {
      console.log('\nBy Model:');
      for (const [model, data] of Object.entries(stats.byModel)) {
        const shortModel = model.replace('claude-', '').replace('-4-5', '-4.5').replace('-3-5', '-3.5');
        console.log(`  ${shortModel}: ${data.requests} requests, $${data.cost.toFixed(2)}`);
      }
    }

    if (showGraph && stats.dailyBreakdown.length > 0) {
      drawGraph(stats.dailyBreakdown);
      console.log(`\nPeriod Total: $${stats.totalCost.toFixed(2)}`);
    }

    console.log('━'.repeat(40));
  }

  db.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
