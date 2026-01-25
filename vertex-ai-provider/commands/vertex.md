---
description: Activate Vertex AI provider for Claude
allowed-tools: Bash(node:*), AskUserQuestion
---

## Context

- Current state: !`cat ~/.claude/vertex-provider/state.json 2>/dev/null || echo '{"active":false}'`
- Config exists: !`test -f ~/.claude/vertex-provider.json && echo "yes" || echo "no"`

## Your Task

Activate the Vertex AI provider:

1. If config doesn't exist, tell the user to run `/vertex setup` first

2. Run the activation script and capture output:

```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli/activate.js"
```

3. **If exit code is 2** (needs prompt): Parse the JSON output and use AskUserQuestion to present options:
   - Extract the `reason`, `question`, and `options` from the JSON
   - Present to user with AskUserQuestion
   - Based on selection:
     - If "anthropic": Run `node "${CLAUDE_PLUGIN_ROOT}/lib/cli/deactivate.js"` to switch
     - If "retry": Re-run the activation script
     - If "cancel": Tell user they remain on current provider
   - If selected provider needs setup, guide them through it

4. **If exit code is 0**: Confirm Vertex AI is now active

5. **If exit code is 1**: Show the error message to the user
