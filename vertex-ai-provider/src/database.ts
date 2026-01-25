import BetterSqlite3 from 'better-sqlite3';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from './config';

export interface Session {
  id: string;
  startedAt: string;
  endedAt: string | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  model: string;
}

export interface UsageStats {
  totalSessions: number;
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  byModel: Record<string, { requests: number; cost: number }>;
  dailyBreakdown: Array<{
    date: string;
    sessions: number;
    requests: number;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }>;
}

export class Database {
  private db: BetterSqlite3.Database;

  constructor(dbPath?: string) {
    const filePath = dbPath || this.getDefaultDbPath();
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new BetterSqlite3(filePath);
    this.initialize();
  }

  private getDefaultDbPath(): string {
    return path.join(os.homedir(), '.claude', 'vertex-provider', 'usage.db');
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        total_input_tokens INTEGER DEFAULT 0,
        total_output_tokens INTEGER DEFAULT 0,
        total_cost REAL DEFAULT 0,
        model TEXT
      );

      CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        model TEXT,
        input_tokens INTEGER,
        output_tokens INTEGER,
        cost REAL,
        prompt_preview TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_requests_session ON requests(session_id);
      CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp);
    `);
  }

  createSession(model: string): Session {
    const id = uuidv4();
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, model) VALUES (?, ?)
    `);
    stmt.run(id, model);
    return this.getSession(id)!;
  }

  getSession(id: string): Session | null {
    const stmt = this.db.prepare(`
      SELECT id, started_at as startedAt, ended_at as endedAt,
             total_input_tokens as totalInputTokens,
             total_output_tokens as totalOutputTokens,
             total_cost as totalCost, model
      FROM sessions WHERE id = ?
    `);
    return stmt.get(id) as Session | null;
  }

  endSession(id: string): void {
    const stmt = this.db.prepare(`
      UPDATE sessions SET ended_at = CURRENT_TIMESTAMP WHERE id = ?
    `);
    stmt.run(id);
  }

  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const config = loadConfig();
    const pricing = config.pricing[model] || config.pricing['claude-opus-4-5'];
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  }

  logRequest(sessionId: string, request: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    promptPreview: string;
  }): void {
    const cost = this.calculateCost(request.model, request.inputTokens, request.outputTokens);

    const insertStmt = this.db.prepare(`
      INSERT INTO requests (session_id, model, input_tokens, output_tokens, cost, prompt_preview)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertStmt.run(sessionId, request.model, request.inputTokens, request.outputTokens, cost, request.promptPreview);

    const updateStmt = this.db.prepare(`
      UPDATE sessions SET
        total_input_tokens = total_input_tokens + ?,
        total_output_tokens = total_output_tokens + ?,
        total_cost = total_cost + ?
      WHERE id = ?
    `);
    updateStmt.run(request.inputTokens, request.outputTokens, cost, sessionId);
  }

  getCurrentSession(): Session | null {
    const stmt = this.db.prepare(`
      SELECT id, started_at as startedAt, ended_at as endedAt,
             total_input_tokens as totalInputTokens,
             total_output_tokens as totalOutputTokens,
             total_cost as totalCost, model
      FROM sessions
      WHERE ended_at IS NULL
      ORDER BY started_at DESC
      LIMIT 1
    `);
    return stmt.get() as Session | null;
  }

  getUsageStats(fromDate: string, toDate: string): UsageStats {
    const sessionsStmt = this.db.prepare(`
      SELECT COUNT(*) as count,
             COALESCE(SUM(total_input_tokens), 0) as inputTokens,
             COALESCE(SUM(total_output_tokens), 0) as outputTokens,
             COALESCE(SUM(total_cost), 0) as cost
      FROM sessions
      WHERE DATE(started_at) BETWEEN ? AND ?
    `);
    const sessionsData = sessionsStmt.get(fromDate, toDate) as any;

    const requestsStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM requests
      WHERE DATE(timestamp) BETWEEN ? AND ?
    `);
    const requestsData = requestsStmt.get(fromDate, toDate) as any;

    const byModelStmt = this.db.prepare(`
      SELECT model, COUNT(*) as requests, COALESCE(SUM(cost), 0) as cost
      FROM requests
      WHERE DATE(timestamp) BETWEEN ? AND ?
      GROUP BY model
    `);
    const byModelData = byModelStmt.all(fromDate, toDate) as any[];

    const dailyStmt = this.db.prepare(`
      SELECT DATE(timestamp) as date,
             COUNT(DISTINCT session_id) as sessions,
             COUNT(*) as requests,
             COALESCE(SUM(input_tokens), 0) as inputTokens,
             COALESCE(SUM(output_tokens), 0) as outputTokens,
             COALESCE(SUM(cost), 0) as cost
      FROM requests
      WHERE DATE(timestamp) BETWEEN ? AND ?
      GROUP BY DATE(timestamp)
      ORDER BY date
    `);
    const dailyData = dailyStmt.all(fromDate, toDate) as any[];

    const byModel: Record<string, { requests: number; cost: number }> = {};
    for (const row of byModelData) {
      byModel[row.model] = { requests: row.requests, cost: row.cost || 0 };
    }

    return {
      totalSessions: sessionsData.count || 0,
      totalRequests: requestsData.count || 0,
      totalInputTokens: sessionsData.inputTokens || 0,
      totalOutputTokens: sessionsData.outputTokens || 0,
      totalCost: sessionsData.cost || 0,
      byModel,
      dailyBreakdown: dailyData.map(row => ({
        date: row.date,
        sessions: row.sessions,
        requests: row.requests,
        inputTokens: row.inputTokens || 0,
        outputTokens: row.outputTokens || 0,
        cost: row.cost || 0,
      })),
    };
  }

  close(): void {
    this.db.close();
  }
}
