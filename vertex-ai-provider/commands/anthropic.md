---
description: Switch back to Anthropic's API (deactivate Vertex AI)
allowed-tools: Bash(node:*), AskUserQuestion
---

## Context

- Current state: !`cat ~/.claude/vertex-provider/state.json 2>/dev/null || echo '{"active":false}'`

## Your Task

Deactivate Vertex AI and switch back to Anthropic's API:

1. Run the deactivation script and capture output:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli/deactivate.js"
```

2. **If exit code is 2** (needs prompt): Parse the JSON output and use AskUserQuestion:
   - Extract the `reason`, `question`, and `options` from the JSON
   - Present to user with AskUserQuestion
   - Based on selection:
     - If "vertex": Tell user they remain on Vertex AI
     - If "retry": Re-run the deactivation script
     - If "cancel": Tell user they remain on current provider
   - If Anthropic needs setup (API key), tell them to set ANTHROPIC_API_KEY

3. **If exit code is 0**: Confirm they are now using Anthropic's API

4. **If exit code is 1**: Show the error message to the user
