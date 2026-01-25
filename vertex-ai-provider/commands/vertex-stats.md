---
description: Show Vertex AI usage statistics
allowed-tools: Bash(node:*)
args: "[period] [--graph]"
---

## Context

- Current state: !`cat ~/.claude/vertex-provider/state.json 2>/dev/null || echo '{"active":false}'`
- Arguments: $ARGUMENTS

## Your Task

Show usage statistics based on arguments:

### No arguments (default to current session)
```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli/stats.js"
```

### With period (today, week, month)
```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli/stats.js" today
node "${CLAUDE_PLUGIN_ROOT}/lib/cli/stats.js" week
node "${CLAUDE_PLUGIN_ROOT}/lib/cli/stats.js" month
```

### With --graph flag
```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli/stats.js" week --graph
```

Run the appropriate command based on the user's arguments.
