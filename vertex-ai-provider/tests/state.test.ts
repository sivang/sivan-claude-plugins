import { StateManager, VertexState } from '../src/state';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('StateManager', () => {
  const testDir = path.join(os.tmpdir(), 'vertex-state-test-' + Date.now());
  const testStatePath = path.join(testDir, 'state.json');
  let state: StateManager;

  beforeEach(() => {
    fs.mkdirSync(testDir, { recursive: true });
    // Clean up any existing state file
    if (fs.existsSync(testStatePath)) {
      fs.unlinkSync(testStatePath);
    }
    state = new StateManager(testStatePath);
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test('initializes with inactive state', () => {
    const current = state.getState();
    expect(current.active).toBe(false);
    expect(current.sessionId).toBeNull();
  });

  test('activates and tracks session', () => {
    state.activate('session-123', 'claude-opus-4-5');
    const current = state.getState();

    expect(current.active).toBe(true);
    expect(current.sessionId).toBe('session-123');
    expect(current.model).toBe('claude-opus-4-5');
    expect(current.startedAt).toBeDefined();
  });

  test('updates token counts', () => {
    state.activate('session-123', 'claude-opus-4-5');
    state.updateTokens(1000, 500, 0.0525);
    const current = state.getState();

    expect(current.totalInputTokens).toBe(1000);
    expect(current.totalOutputTokens).toBe(500);
    expect(current.totalCost).toBeCloseTo(0.0525, 4);
  });

  test('accumulates token counts across multiple updates', () => {
    state.activate('session-123', 'claude-opus-4-5');
    state.updateTokens(1000, 500, 0.05);
    state.updateTokens(2000, 1000, 0.10);
    const current = state.getState();

    expect(current.totalInputTokens).toBe(3000);
    expect(current.totalOutputTokens).toBe(1500);
    expect(current.totalCost).toBeCloseTo(0.15, 4);
  });

  test('updates model', () => {
    state.activate('session-123', 'claude-opus-4-5');
    state.updateModel('claude-sonnet-4');
    const current = state.getState();

    expect(current.model).toBe('claude-sonnet-4');
  });

  test('deactivates and clears session', () => {
    state.activate('session-123', 'claude-opus-4-5');
    state.updateTokens(1000, 500, 0.0525);
    state.deactivate();
    const current = state.getState();

    expect(current.active).toBe(false);
    expect(current.sessionId).toBeNull();
    expect(current.totalInputTokens).toBe(0);
    expect(current.totalOutputTokens).toBe(0);
  });

  test('persists state to file', () => {
    state.activate('session-123', 'claude-opus-4-5');
    state.updateTokens(5000, 2000, 0.25);

    // Create new StateManager pointing to same file
    const state2 = new StateManager(testStatePath);
    const current = state2.getState();

    expect(current.active).toBe(true);
    expect(current.sessionId).toBe('session-123');
    expect(current.totalInputTokens).toBe(5000);
  });
});
