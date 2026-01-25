import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface VertexState {
  active: boolean;
  sessionId: string | null;
  model: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  startedAt: string | null;
}

export class StateManager {
  private statePath: string;

  constructor(statePath?: string) {
    this.statePath = statePath || this.getDefaultStatePath();
    this.ensureStateFile();
  }

  private getDefaultStatePath(): string {
    return path.join(os.homedir(), '.claude', 'vertex-provider', 'state.json');
  }

  private ensureStateFile(): void {
    const dir = path.dirname(this.statePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.statePath)) {
      this.saveState(this.getDefaultState());
    }
  }

  private getDefaultState(): VertexState {
    return {
      active: false,
      sessionId: null,
      model: 'claude-opus-4-5',
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      startedAt: null,
    };
  }

  getState(): VertexState {
    try {
      const data = fs.readFileSync(this.statePath, 'utf-8');
      return { ...this.getDefaultState(), ...JSON.parse(data) };
    } catch {
      return this.getDefaultState();
    }
  }

  private saveState(state: VertexState): void {
    fs.writeFileSync(this.statePath, JSON.stringify(state, null, 2));
  }

  activate(sessionId: string, model: string): void {
    const state: VertexState = {
      active: true,
      sessionId,
      model,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      startedAt: new Date().toISOString(),
    };
    this.saveState(state);
  }

  updateTokens(inputTokens: number, outputTokens: number, cost: number): void {
    const state = this.getState();
    state.totalInputTokens += inputTokens;
    state.totalOutputTokens += outputTokens;
    state.totalCost += cost;
    this.saveState(state);
  }

  updateModel(model: string): void {
    const state = this.getState();
    state.model = model;
    this.saveState(state);
  }

  deactivate(): void {
    this.saveState(this.getDefaultState());
  }
}
