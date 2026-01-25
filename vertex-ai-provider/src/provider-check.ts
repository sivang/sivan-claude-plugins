import { Config } from './config';

export type ErrorType = 'credits' | 'auth' | 'config' | 'other';

export interface ProviderStatus {
  provider: 'vertex' | 'anthropic';
  available: boolean;
  error?: string;
  errorType?: ErrorType;
}

export interface PromptOption {
  label: string;
  value: string;
  description?: string;
  available: boolean;
}

export interface PromptResponse {
  promptUser: boolean;
  reason: string;
  question: string;
  options: PromptOption[];
}

const VERTEX_CREDIT_PATTERNS: (string | RegExp)[] = [
  'RESOURCE_EXHAUSTED',
  'quotaExceeded',
  /PERMISSION_DENIED.*billing/i,
];

const VERTEX_AUTH_PATTERNS: (string | RegExp)[] = ['UNAUTHENTICATED'];
const VERTEX_CONFIG_PATTERNS: (string | RegExp)[] = [/NOT_FOUND.*model/i];

const ANTHROPIC_CREDIT_PATTERNS: (string | RegExp)[] = [
  'credit_balance_too_low',
  'insufficient_quota',
  'Credit balance is too low',
];

const ANTHROPIC_AUTH_PATTERNS: (string | RegExp)[] = ['authentication_error', 'invalid_api_key'];

function matchesPattern(error: string, patterns: (string | RegExp)[]): boolean {
  return patterns.some(pattern => {
    if (typeof pattern === 'string') {
      return error.includes(pattern);
    }
    return pattern.test(error);
  });
}

export function classifyError(error: string, provider: 'vertex' | 'anthropic'): ErrorType {
  if (provider === 'vertex') {
    if (matchesPattern(error, VERTEX_CREDIT_PATTERNS)) return 'credits';
    if (matchesPattern(error, VERTEX_AUTH_PATTERNS)) return 'auth';
    if (matchesPattern(error, VERTEX_CONFIG_PATTERNS)) return 'config';
  } else {
    if (matchesPattern(error, ANTHROPIC_CREDIT_PATTERNS)) return 'credits';
    if (matchesPattern(error, ANTHROPIC_AUTH_PATTERNS)) return 'auth';
  }
  return 'other';
}

export async function checkAnthropic(): Promise<ProviderStatus> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    // No API key - assume available via Claude Code's built-in auth
    return {
      provider: 'anthropic',
      available: true,
    };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: { type?: string; message?: string } };
      const errorMessage = data.error?.type || data.error?.message || 'Unknown error';
      return {
        provider: 'anthropic',
        available: false,
        error: errorMessage,
        errorType: classifyError(errorMessage, 'anthropic'),
      };
    }

    return {
      provider: 'anthropic',
      available: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return {
      provider: 'anthropic',
      available: false,
      error: message,
      errorType: 'other',
    };
  }
}

export async function checkVertexAI(config: Config, skipApiCall = false): Promise<ProviderStatus> {
  // Check configuration first
  if (!config.gcp.projectId) {
    return {
      provider: 'vertex',
      available: false,
      error: 'No GCP project configured. Run /vertex setup first.',
      errorType: 'config',
    };
  }

  if (skipApiCall) {
    return {
      provider: 'vertex',
      available: true,
    };
  }

  try {
    // Use Google Auth Library to get credentials
    const { GoogleAuth } = await import('google-auth-library');

    const authOptions: { scopes: string[]; keyFilename?: string } = {
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    };

    if (config.auth.method === 'service-account' && config.auth.serviceAccountPath) {
      authOptions.keyFilename = config.auth.serviceAccountPath;
    }

    const auth = new GoogleAuth(authOptions);
    const client = await auth.getClient();
    const projectId = config.gcp.projectId;
    const region = config.gcp.region;
    const model = 'claude-3-haiku@20240307'; // Cheapest model for health check

    const url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/anthropic/models/${model}:rawPredict`;

    await client.request({
      url,
      method: 'POST',
      data: {
        anthropic_version: 'vertex-2023-10-16',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      },
    });

    return {
      provider: 'vertex',
      available: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      provider: 'vertex',
      available: false,
      error: message,
      errorType: classifyError(message, 'vertex'),
    };
  }
}

export function buildPromptResponse(
  failed: ProviderStatus,
  alternative: ProviderStatus
): PromptResponse {
  const failedName = failed.provider === 'vertex' ? 'Vertex AI' : 'Anthropic';
  const altName = alternative.provider === 'vertex' ? 'Vertex AI' : 'Anthropic';

  const options: PromptOption[] = [
    {
      label: `Switch to ${altName}`,
      value: alternative.provider,
      description: alternative.available
        ? `Use ${altName} instead`
        : `Requires setup (${alternative.error})`,
      available: alternative.available,
    },
    {
      label: 'Use Claude subscription',
      value: 'subscription',
      description: 'Log in with Claude Pro/Max (run: claude login)',
      available: true,
    },
    {
      label: `Retry ${failedName}`,
      value: 'retry',
      description: 'Try again (may be a transient error)',
      available: true,
    },
    {
      label: 'Cancel',
      value: 'cancel',
      description: 'Stay with current provider',
      available: true,
    },
  ];

  return {
    promptUser: true,
    reason: `${failedName} error: ${failed.error}`,
    question: 'Which provider would you like to use?',
    options,
  };
}
