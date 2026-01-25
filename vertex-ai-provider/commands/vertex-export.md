---
description: Export Vertex AI usage data to JSON
allowed-tools: Bash(node:*)
args: "[--from DATE] [--to DATE]"
---

## Context

- Arguments: $ARGUMENTS
- Export directory: ~/.claude/vertex-provider/exports/

## Your Task

Export usage data to JSON:

### Default (all data)
```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli/export.js"
```

### With date range
```bash
node "${CLAUDE_PLUGIN_ROOT}/lib/cli/export.js" --from 2025-01-01 --to 2025-01-25
```

Tell the user the full path to the exported file.
