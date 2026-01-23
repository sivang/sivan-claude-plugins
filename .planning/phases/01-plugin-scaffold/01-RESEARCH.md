# Phase 1 Research: Plugin Scaffold

## Current State

The repo currently has a flat single-plugin structure:
```
sivan-claude-plugins/
├── .claude-plugin/plugin.json  (session-workflow)
├── commands/ (doomsday.md, resurrect.md)
└── skills/ (doomsday/, resurrect/)
```

## Multi-Plugin Restructuring

### Target Structure

Each plugin needs its own root directory with `.claude-plugin/plugin.json`:

```
sivan-claude-plugins/
├── README.md (repo-level, describes both plugins)
├── session-workflow/
│   ├── .claude-plugin/plugin.json
│   ├── commands/
│   │   ├── doomsday.md
│   │   └── resurrect.md
│   └── skills/
│       ├── doomsday/SKILL.md
│       └── resurrect/SKILL.md
└── site-audit/
    ├── .claude-plugin/plugin.json
    ├── commands/
    │   └── site-audit.md
    └── skills/
        └── site-audit/
            └── SKILL.md
```

### Installation

Users install each plugin by pointing Claude Code at the subdirectory:
- `claude plugin add ./session-workflow`
- `claude plugin add ./site-audit`

Or for remote install from GitHub, users reference the subdirectory path.

### Key Consideration

The existing root `.claude-plugin/` directory must be removed or the repo itself will be treated as a plugin. The root becomes just a collection/monorepo wrapper.

## Command Structure (with Arguments)

Commands accept arguments via frontmatter. The `/site-audit` command needs a URL argument:

```yaml
---
name: site-audit
description: Audit a website for broken links, spelling errors, and visual issues
---

Execute the site-audit skill to perform a comprehensive website audit on the provided URL.

The user should provide a URL as an argument: `/site-audit https://example.com`

Pass the URL to the skill for processing.
```

The command body instructs Claude to invoke the skill. The URL is passed as the command argument and Claude picks it up from context.

## Skill Skeleton Design

The site-audit SKILL.md needs to:
1. Accept a URL from the command invocation
2. Be structured to receive Phase 2-4 logic incrementally
3. Start with a skeleton that validates input and sets up audit state

Initial skeleton should:
- Validate the URL argument
- Define the audit workflow phases (crawl → analyze → chrome checks → report)
- Set up the findings accumulation pattern (write to disk)
- Placeholder sections for each phase's logic

## Plugin Manifest

```json
{
  "name": "site-audit",
  "version": "0.1.0",
  "description": "Website quality auditor: crawl, check links, spelling, console errors, and visual issues",
  "author": {
    "name": "Sivan Grünberg",
    "email": "sivan@vitakka.co",
    "url": "https://vitakka.co"
  }
}
```

## Build Order

1. Move session-workflow files into `session-workflow/` subdirectory
2. Remove root `.claude-plugin/`
3. Create `site-audit/` directory structure
4. Create plugin.json for site-audit
5. Create command file
6. Create skill skeleton
7. Update root README

## Risks

- **Breaking existing installations**: Users who installed from the root will need to reinstall from the subdirectory. The README should note this.
- **Git history**: Moving files preserves history with `git mv`
- **Path references**: Skill descriptions that reference relative paths need checking after move
