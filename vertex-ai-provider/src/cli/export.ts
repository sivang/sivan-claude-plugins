#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Database } from '../database';

async function main() {
  const args = process.argv.slice(2);
  const db = new Database();

  const getArg = (name: string): string | null => {
    const index = args.indexOf(`--${name}`);
    return index >= 0 && args[index + 1] ? args[index + 1] : null;
  };

  const now = new Date();
  const toDate = getArg('to') || now.toISOString().slice(0, 10);
  const fromDate = getArg('from') || '2020-01-01';

  const stats = db.getUsageStats(fromDate, toDate);

  const exportData = {
    exportedAt: now.toISOString(),
    period: { from: fromDate, to: toDate },
    summary: {
      totalSessions: stats.totalSessions,
      totalRequests: stats.totalRequests,
      totalInputTokens: stats.totalInputTokens,
      totalOutputTokens: stats.totalOutputTokens,
      totalCost: stats.totalCost,
      byModel: stats.byModel,
    },
    dailyBreakdown: stats.dailyBreakdown,
  };

  const exportDir = path.join(os.homedir(), '.claude', 'vertex-provider', 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const filename = `usage-${toDate}.json`;
  const filePath = path.join(exportDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));

  console.log(`✅ Exported to: ${filePath}`);
  console.log(`   Period: ${fromDate} to ${toDate}`);
  console.log(`   Sessions: ${stats.totalSessions}`);
  console.log(`   Total cost: $${stats.totalCost.toFixed(2)}`);

  db.close();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
