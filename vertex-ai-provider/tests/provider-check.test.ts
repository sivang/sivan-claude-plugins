import { ProviderStatus, PromptResponse, classifyError, checkAnthropic, checkVertexAI, buildPromptResponse } from '../src/provider-check';
import { getDefaultConfig } from '../src/config';

describe('ProviderCheck Types', () => {
  test('ProviderStatus has required fields', () => {
    const status: ProviderStatus = {
      provider: 'vertex',
      available: true,
    };
    expect(status.available).toBe(true);
    expect(status.provider).toBe('vertex');
  });

  test('ProviderStatus with error', () => {
    const status: ProviderStatus = {
      provider: 'anthropic',
      available: false,
      error: 'Credit balance is too low',
      errorType: 'credits',
    };
    expect(status.available).toBe(false);
    expect(status.errorType).toBe('credits');
  });

  test('PromptResponse has required fields', () => {
    const prompt: PromptResponse = {
      promptUser: true,
      reason: 'Vertex AI credit limit reached',
      question: 'Which provider would you like to use?',
      options: [
        { label: 'Switch to Anthropic', value: 'anthropic', available: true },
      ],
    };
    expect(prompt.promptUser).toBe(true);
    expect(prompt.options.length).toBe(1);
  });
});

describe('classifyError', () => {
  test('classifies Vertex AI quota errors as credits', () => {
    expect(classifyError('RESOURCE_EXHAUSTED', 'vertex')).toBe('credits');
  });

  test('classifies Vertex AI billing errors as credits', () => {
    expect(classifyError('PERMISSION_DENIED: billing', 'vertex')).toBe('credits');
    expect(classifyError('quotaExceeded', 'vertex')).toBe('credits');
  });

  test('classifies Vertex AI auth errors as auth', () => {
    expect(classifyError('UNAUTHENTICATED', 'vertex')).toBe('auth');
  });

  test('classifies Vertex AI model errors as config', () => {
    expect(classifyError('NOT_FOUND: model', 'vertex')).toBe('config');
  });

  test('classifies Anthropic credit errors as credits', () => {
    expect(classifyError('credit_balance_too_low', 'anthropic')).toBe('credits');
    expect(classifyError('insufficient_quota', 'anthropic')).toBe('credits');
  });

  test('classifies Anthropic auth errors as auth', () => {
    expect(classifyError('authentication_error', 'anthropic')).toBe('auth');
  });

  test('classifies unknown errors as other', () => {
    expect(classifyError('random error', 'vertex')).toBe('other');
    expect(classifyError('something else', 'anthropic')).toBe('other');
  });
});

describe('checkAnthropic', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('returns available with note when no API key', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const status = await checkAnthropic();
    expect(status.available).toBe(true);
    expect(status.provider).toBe('anthropic');
  });

  test('returns unavailable on credit error', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    // Mock fetch to return credit error
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { type: 'credit_balance_too_low', message: 'Credit balance is too low' }
      }),
    });

    const status = await checkAnthropic();
    expect(status.available).toBe(false);
    expect(status.errorType).toBe('credits');
  });

  test('returns available on success', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'msg_123', content: [] }),
    });

    const status = await checkAnthropic();
    expect(status.available).toBe(true);
  });
});

describe('checkVertexAI', () => {
  test('returns config error when no project ID', async () => {
    const config = getDefaultConfig();
    config.gcp.projectId = '';

    const status = await checkVertexAI(config);
    expect(status.available).toBe(false);
    expect(status.errorType).toBe('config');
  });

  test('returns available on mock success', async () => {
    const config = getDefaultConfig();
    config.gcp.projectId = 'test-project';
    config.gcp.region = 'us-east5';

    // This test will need mocking in real implementation
    // For now, we test the config validation path
    const status = await checkVertexAI(config, true); // skipApiCall flag for testing
    expect(status.provider).toBe('vertex');
  });
});

describe('buildPromptResponse', () => {
  test('builds prompt with available alternative', () => {
    const failed: ProviderStatus = {
      provider: 'vertex',
      available: false,
      error: 'RESOURCE_EXHAUSTED',
      errorType: 'credits',
    };
    const alternative: ProviderStatus = {
      provider: 'anthropic',
      available: true,
    };

    const prompt = buildPromptResponse(failed, alternative);

    expect(prompt.promptUser).toBe(true);
    expect(prompt.reason).toContain('Vertex');
    expect(prompt.options.length).toBe(4); // Switch, Subscription, Retry, Cancel
    expect(prompt.options[0].value).toBe('anthropic');
    expect(prompt.options[0].available).toBe(true);
  });

  test('builds prompt with unavailable alternative', () => {
    const failed: ProviderStatus = {
      provider: 'anthropic',
      available: false,
      error: 'credit_balance_too_low',
      errorType: 'credits',
    };
    const alternative: ProviderStatus = {
      provider: 'vertex',
      available: false,
      error: 'No config',
      errorType: 'config',
    };

    const prompt = buildPromptResponse(failed, alternative);

    expect(prompt.options[0].available).toBe(false);
    expect(prompt.options[0].description).toContain('setup');
  });
});
