---
description: Configure Vertex AI provider settings
allowed-tools: Bash(gcloud:*), Bash(node:*), Bash(cat:*), Bash(mkdir:*)
---

## Context

- Existing config: !`cat ~/.claude/vertex-provider.json 2>/dev/null || echo "No config found"`
- GCP project: !`gcloud config get-value project 2>/dev/null || echo "Not set"`
- ADC status: !`test -f ~/.config/gcloud/application_default_credentials.json && echo "ADC configured" || echo "ADC not configured"`

## Your Task

Guide the user through Vertex AI setup. Ask these questions ONE AT A TIME:

### 1. GCP Project ID
Ask for their GCP project ID. If gcloud shows a project, offer it as default.

### 2. Region
Ask which Vertex AI region:
- us-east5 (Columbus, Ohio) - Recommended
- europe-west1 (Belgium)
- asia-southeast1 (Singapore)

### 3. Authentication Method
Ask how to authenticate:
- ADC (Application Default Credentials) - Recommended for local dev
- Service Account - For CI/CD or servers

If ADC and not configured, guide them to run:
```bash
gcloud auth application-default login
```

If Service Account, ask for the path to the JSON key file.

### 4. Default Model
Ask which Claude model:
- claude-opus-4-5 (Most capable, $15/$75 per 1M tokens)
- claude-sonnet-4 (Balanced, $3/$15 per 1M tokens)
- claude-haiku-3-5 (Fast & cheap, $0.80/$4 per 1M tokens)

### 5. Save Configuration
After collecting all info, save with:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli/setup.js" --project "PROJECT_ID" --region "REGION" --auth "METHOD" --model "MODEL"
```

### 6. Test Connection
Offer to test the connection:
```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli/test-connection.js"
```
