# Sivan's Claude Code Plugins

A collection of Claude Code plugins for developer productivity. Built by [Sivan Grunberg](https://github.com/sivang) at [Vitakka Consulting](https://vitakka.co).

## Plugins

| Plugin | Version | Description |
|--------|---------|-------------|
| [vertex-ai-provider](#vertex-ai-provider) | 1.0.0 | Use Claude models via Google Vertex AI |
| [session-workflow](#session-workflow) | 1.0.0 | Session context preservation and restoration |
| [site-audit](#site-audit) | 1.0.0 | Automated website quality auditing |

---

## vertex-ai-provider

Use Claude models (Opus 4.5, Sonnet 4, Haiku 3.5) via Google Cloud Vertex AI with real-time token tracking and cost analytics.

### Features

- **Provider Switching** — Seamlessly switch between Vertex AI and Anthropic
- **Real-time Tracking** — See token usage and cost in the status line
- **Full Analytics** — View stats by session, day, week, or month
- **Flexible Auth** — Support for ADC and Service Account authentication

### Commands

| Command | Description |
|---------|-------------|
| `/vertex` | Activate Vertex AI provider |
| `/vertex setup` | Configuration wizard |
| `/vertex model <name>` | Switch model (opus-4.5, sonnet-4, haiku-3.5) |
| `/anthropic` | Switch back to Anthropic's API |
| `/vertex-stats` | Show usage statistics |
| `/vertex-export` | Export usage data to JSON |

### Prerequisites

1. Enable Vertex AI API: `gcloud services enable aiplatform.googleapis.com`
2. Enable Claude models in [Model Garden](https://console.cloud.google.com/vertex-ai/model-garden)
3. Authenticate: `gcloud auth application-default login`

### Installation

```bash
cd ~/.claude/plugins/sivan-plugins/vertex-ai-provider
npm install && npm run build
```

---

## session-workflow

Session management for Claude Code — save your work context at session end and pick up where you left off.

### Commands

#### `/doomsday` — End-of-Session Shutdown

Executes a structured shutdown protocol that preserves all session context to disk:

- Force-saves all discussed code and file changes
- Updates README, PROJECT_STATUS, and documentation
- Creates a SESSION_HANDOFF file with decisions, gotchas, and next actions
- Prepares a git commit message summarizing the session

Use when ending a session: `/doomsday`, "wrap up", "end session", or "save everything".

#### `/resurrect` — Session Context Restoration

Reconstructs project state from documentation files for a new session:

- Reads README, PROJECT_STATUS, and handoff files
- Identifies the active problem or feature in progress
- Surfaces gotchas and blockers from the last session
- Provides the single highest-priority next action

Use when starting a session: `/resurrect`, "catch me up", "what were we working on", or "continue where we left off".

---

## site-audit

Automated website quality assurance — crawl an entire site and produce a comprehensive audit report in one command.

### Usage

```
/site-audit https://your-site.com
```

### What It Checks

| Category | Checks | Severity |
|----------|--------|----------|
| Broken Links | Internal 404s, timeouts, connection failures | Error |
| Console Errors | JavaScript runtime errors (filtered for noise) | Error |
| Broken Resources | Failed images, stylesheets, scripts, fonts | Error |
| Spelling/Grammar | AI-detected typos with code/jargon filtering | Warning |
| Visual Layout | Horizontal overflow, collapsed containers | Warning |

### How It Works

1. **Crawl** — BFS traversal of all same-domain pages via WebFetch (default cap: 50 pages)
2. **Content Analysis** — Dead link detection and spelling/grammar checks during crawl
3. **UI Checks** — Navigates discovered pages in Chrome for console errors, broken resources, and visual issues
4. **Report** — Compiles findings into a structured markdown file: `audit-{domain}-{date}.md`

### Report Output

The generated report includes:

- Run metadata (target URL, pages crawled, duration)
- Summary counts table with error/warning breakdown
- Findings grouped by type with severity labels
- Page index showing which pages have the most issues
- Conditional table of contents for large reports (50+ findings)

### Requirements

- Chrome browser with [Claude in Chrome](https://chromewebstore.google.com/detail/claude-in-chrome/jnkadgmfaiopchpafpmfjekeghigppco) extension (for UI checks)
- Claude Code with MCP support

---

## Installation

```bash
# Clone the repository
git clone https://github.com/sivang/sivan-claude-plugins.git

# Add as a Claude Code plugin marketplace
# (follow Claude Code plugin installation docs for your setup)
```

The repository uses a multi-plugin layout with a marketplace manifest at `.claude-plugin/marketplace.json`.

## Repository Structure

```
sivan-claude-plugins/
  .claude-plugin/
    marketplace.json        # Plugin registry
  vertex-ai-provider/
    .claude-plugin/
      plugin.json           # Plugin manifest
    commands/
      vertex.md             # /vertex command
      anthropic.md          # /anthropic command
      vertex-stats.md       # /vertex-stats command
      vertex-export.md      # /vertex-export command
    src/                    # TypeScript source
    tests/                  # Jest tests
  session-workflow/
    .claude-plugin/
      plugin.json           # Plugin manifest
    commands/
      doomsday.md           # /doomsday command
      resurrect.md          # /resurrect command
    skills/
      doomsday/SKILL.md     # Shutdown protocol
      resurrect/SKILL.md    # Context restoration
  site-audit/
    .claude-plugin/
      plugin.json           # Plugin manifest
    commands/
      site-audit.md         # /site-audit command
    skills/
      site-audit/
        SKILL.md            # Audit orchestration (5 phases)
        references/
          URL_RULES.md      # URL normalization rules
          CHECKS.md         # Content analysis rules
          UI_CHECKS.md      # Chrome UI check rules
          REPORT.md         # Report format specification
```

## Background

These plugins extend Claude Code with specialized workflows that benefit from structured, repeatable processes. Rather than explaining what you want each session, the plugins encode expert knowledge into skill definitions that Claude follows consistently.

The site-audit plugin uses a two-layer architecture: a backend WebFetch layer handles crawling and content analysis without a browser, then a Chrome layer adds runtime and visual checks on discovered pages. Findings are written progressively to disk (JSONL) to avoid context overflow on large sites.

## License

MIT

---

*Built by [Sivan](https://github.com/sivang) at [Vitakka Consulting](https://vitakka.co)*
