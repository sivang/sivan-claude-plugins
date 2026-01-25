import { Database } from '../src/database';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Database', () => {
  const testDir = path.join(os.tmpdir(), 'vertex-db-test-' + Date.now());
  const testDbPath = path.join(testDir, 'usage.db');
  let db: Database;

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
    db = new Database(testDbPath);
  });

  afterAll(() => {
    db.close();
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('creates session', () => {
    const session = db.createSession('claude-opus-4-5');
    expect(session.id).toBeDefined();
    expect(session.model).toBe('claude-opus-4-5');
    expect(session.totalInputTokens).toBe(0);
    expect(session.totalOutputTokens).toBe(0);
    expect(session.totalCost).toBe(0);
  });

  test('logs request and updates session totals', () => {
    const session = db.createSession('claude-opus-4-5');

    db.logRequest(session.id, {
      model: 'claude-opus-4-5',
      inputTokens: 1000,
      outputTokens: 500,
      promptPreview: 'Hello world',
    });

    const updated = db.getSession(session.id);
    expect(updated?.totalInputTokens).toBe(1000);
    expect(updated?.totalOutputTokens).toBe(500);
    expect(updated?.totalCost).toBeGreaterThan(0);
  });

  test('calculates cost correctly for Opus', () => {
    // Opus 4.5: input $15/1M, output $75/1M
    // 1000 input = $0.015, 500 output = $0.0375
    // Total = $0.0525
    const cost = db.calculateCost('claude-opus-4-5', 1000, 500);
    expect(cost).toBeCloseTo(0.0525, 4);
  });

  test('calculates cost correctly for Sonnet', () => {
    // Sonnet 4: input $3/1M, output $15/1M
    const cost = db.calculateCost('claude-sonnet-4', 1000, 500);
    expect(cost).toBeCloseTo(0.0105, 4);
  });

  test('gets current session', () => {
    // End any existing open sessions first
    let existingSession = db.getCurrentSession();
    while (existingSession) {
      db.endSession(existingSession.id);
      existingSession = db.getCurrentSession();
    }

    const session = db.createSession('claude-opus-4-5');
    const current = db.getCurrentSession();
    expect(current).toBeDefined();
    expect(current?.id).toBe(session.id);
  });

  test('ends session', () => {
    const session = db.createSession('claude-opus-4-5');
    db.endSession(session.id);
    const ended = db.getSession(session.id);
    expect(ended?.endedAt).toBeDefined();
  });
});
