# Technology Stack

**Project:** site-audit (Claude Code Plugin)
**Researched:** 2026-01-22
**Overall Confidence:** HIGH

## Nature of This Stack

This is NOT a traditional code project. Claude Code plugins are markdown-based instruction sets that leverage Claude's reasoning and available tools. The "stack" consists of:

1. **Plugin structure** -- filesystem conventions that Claude Code discovers
2. **MCP tools** -- browser automation capabilities provided by claude-in-chrome
3. **Built-in tools** -- WebFetch for HTTP verification
4. **Skill design** -- markdown instructions that shape Claude's behavior during audit

---

## Recommended Stack

### Plugin Structure (Filesystem)

| Component | Location | Purpose | Why |
|-----------|----------|---------|-----|
| Marketplace manifest | `.claude-plugin/marketplace.json` | Registers site-audit as second plugin in this repo | Already exists; add new plugin entry |
| Plugin manifest | `site-audit/.claude-plugin/plugin.json` | Plugin identity and metadata | Required by Claude Code plugin spec |
| Command file | `site-audit/commands/site-audit.md` | User-invoked `/site-audit` slash command | Entry point; user types this to start |
| Main skill | `site-audit/skills/audit-crawl/SKILL.md` | Core audit logic instructions | Complex behavior needs dedicated skill |
| Reference docs | `site-audit/skills/audit-crawl/references/` | Tool usage patterns, report templates | Keeps SKILL.md under 500 lines |

**Confidence:** HIGH -- verified against existing repo structure and official Claude Code plugin docs.

### Multi-Plugin Repository Layout

The repo already uses marketplace structure. The site-audit plugin should be a subdirectory with its own `.claude-plugin/plugin.json`:

```
sivan-claude-plugins/
├── .claude-plugin/
│   ├── marketplace.json          # Add site-audit entry here
│   └── plugin.json               # Existing (session-workflow root)
├── commands/                      # Existing session-workflow commands
├── skills/                        # Existing session-workflow skills
├── site-audit/                    # NEW PLUGIN SUBDIRECTORY
│   ├── .claude-plugin/
│   │   └── plugin.json           # site-audit identity
│   ├── commands/
│   │   └── site-audit.md         # /site-audit slash command
│   └── skills/
│       └── audit-crawl/
│           ├── SKILL.md           # Core audit instructions
│           └── references/
│               ├── tool-patterns.md
│               └── report-template.md
└── README.md
```

**Rationale:** The marketplace.json `plugins` array currently has `"source": "./"` for session-workflow. The site-audit plugin gets `"source": "./site-audit"` pointing to its subdirectory. Each plugin has its own `.claude-plugin/plugin.json` (strict mode is default).

---

## MCP Tools: claude-in-chrome

The plugin relies on the `mcp__claude-in-chrome__*` tool family. These are the built-in Chrome integration tools (distinct from Chrome DevTools MCP which has different tool names).

### Tool-to-Capability Mapping

| MCP Tool | Purpose in Audit | When Used |
|----------|-------------------|-----------|
| `mcp__claude-in-chrome__navigate` | Load each page URL | Every page visit during crawl |
| `mcp__claude-in-chrome__get_page_text` | Extract visible text content | Spelling/grammar analysis on each page |
| `mcp__claude-in-chrome__read_page` | Get DOM with element refs, find all links | Link discovery (crawl frontier) |
| `mcp__claude-in-chrome__find` | Search for elements by text/selector | Locating specific elements if needed |
| `mcp__claude-in-chrome__read_console_messages` | Capture JS errors | Console error detection per page |
| `mcp__claude-in-chrome__read_network_requests` | Check failed resource loads | Broken images, failed CSS/JS loads |
| `mcp__claude-in-chrome__javascript_tool` | Execute JS in page context | Extract all anchor hrefs programmatically |
| `mcp__claude-in-chrome__computer` | Click, type, scroll, screenshot | Visual inspection, scrolling to load lazy content |

**Confidence:** HIGH -- tool names verified from Claude Chrome MCP documentation (lobehub.com/mcp/nonsleepr-claude-chrome-mcp). These are the built-in claude-in-chrome tools, not the Chrome DevTools MCP server tools.

### Tool Usage Strategy

**For link discovery (the crawl):**
Use `javascript_tool` to extract all anchor hrefs from the page in a single call:
```
Execute: Array.from(document.querySelectorAll('a[href]')).map(a => a.href)
```
This is more reliable than `read_page` + parsing because it returns resolved absolute URLs.

**For text extraction (spelling check):**
Use `get_page_text` which returns visible text content. Claude then analyzes this text for spelling/grammar issues using its own language model capabilities. No external spellcheck API needed.

**For console errors:**
Use `read_console_messages` after page load completes. Filter for `error` level messages.

**For broken resources (images, CSS, JS):**
Use `read_network_requests` and filter for failed requests (4xx, 5xx status codes, or failed/aborted).

**For navigation:**
Use `navigate` with full URL. Wait for page load before extracting content.

### Tool Constraints

| Constraint | Impact | Mitigation |
|------------|--------|------------|
| Requires visible Chrome window | Cannot run headless | Document as requirement in skill |
| Shares user's browser session | Login state inherited (good for authenticated sites) | Warn about privacy in docs |
| Sequential page navigation | Natural rate limiting (good for target sites) | No artificial delays needed |
| No built-in "wait for load" | May read incomplete pages | Use javascript_tool to check document.readyState |

---

## Built-in Tools for External Link Verification

### WebFetch (for external links)

| Aspect | Detail |
|--------|--------|
| **Tool** | `WebFetch` (built into Claude Code) |
| **Purpose** | Verify external links respond |
| **Constraint** | Requires a `prompt` parameter -- cannot just check HTTP status |
| **Workaround** | Use prompt like "Does this page load successfully? Return YES or NO" |
| **Caching** | 15-minute TTL per URL |
| **Redirect handling** | Same-host followed; cross-host returns redirect info |
| **URL restriction** | Can only fetch URLs that appear in conversation context |

**Important limitation:** WebFetch is designed to fetch-and-summarize, not to perform bare HTTP health checks. The skill must instruct Claude to:
1. Collect external URLs from page crawl
2. For each external URL, use WebFetch with a minimal prompt to verify it loads
3. Treat fetch failures as "dead link" indicators

**Alternative considered:** Using `javascript_tool` to make fetch() requests from the page. However, CORS restrictions would block most cross-origin requests. WebFetch is the correct approach despite the prompt overhead.

**Confidence:** MEDIUM -- WebFetch is confirmed to work for URL verification but the prompt requirement adds friction. The skill instructions must handle this cleanly.

---

## Command File Structure

### Frontmatter Specification

```yaml
---
name: site-audit
description: Crawl a website and audit for dead links, spelling errors, console errors, and visual issues
argument-hint: <url>
allowed-tools: mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__get_page_text, mcp__claude-in-chrome__read_page, mcp__claude-in-chrome__find, mcp__claude-in-chrome__read_console_messages, mcp__claude-in-chrome__read_network_requests, mcp__claude-in-chrome__javascript_tool, mcp__claude-in-chrome__computer, WebFetch, Write, Read
---
```

**Key fields:**
- `name` -- becomes the `/site-audit` command
- `description` -- shown in command list; also used for auto-discovery if placed in a skill
- `argument-hint` -- tells user what argument to provide (the target URL)
- `allowed-tools` -- restricts Claude to only these tools during execution (security)

**Why `allowed-tools` matters:** Without it, Claude could use Bash, Edit, or other tools that are unnecessary for auditing. Restricting tools prevents accidental file modifications and focuses behavior.

**Confidence:** HIGH -- frontmatter fields verified from official documentation and issue tracker discussions.

---

## Skill Structure (SKILL.md)

### Frontmatter for the Audit Skill

```yaml
---
name: audit-crawl
description: This skill performs comprehensive website auditing. It should be used when the user invokes /site-audit, asks to "audit a website", "check a site for errors", "crawl and check links", or "find broken links on a site". Crawls same-domain pages and checks for dead links, spelling errors, console errors, and broken resources.
allowed-tools: mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__get_page_text, mcp__claude-in-chrome__read_page, mcp__claude-in-chrome__read_console_messages, mcp__claude-in-chrome__read_network_requests, mcp__claude-in-chrome__javascript_tool, mcp__claude-in-chrome__computer, WebFetch, Write, Read
---
```

**Design principles for SKILL.md body:**
- Keep under 500 lines (official recommendation)
- Put detailed tool usage patterns in `references/tool-patterns.md`
- Put report format template in `references/report-template.md`
- Use `${CLAUDE_PLUGIN_ROOT}` for any path references to bundled files

### Skill vs Command: When to Use Each

| Aspect | Command (`commands/site-audit.md`) | Skill (`skills/audit-crawl/SKILL.md`) |
|--------|-------------------------------------|---------------------------------------|
| Invocation | User types `/site-audit <url>` | Claude auto-activates on matching context |
| Content | Brief: "Execute the audit-crawl skill on the provided URL" | Detailed: full audit logic and instructions |
| Purpose | Entry point, argument handling | Complex behavior definition |
| Size | 2-5 lines | Up to 500 lines (with references) |

**Recommended pattern:** Command file is a thin dispatcher that invokes the skill. Skill file contains all the logic. This matches the existing repo pattern (see `commands/doomsday.md` dispatching to `skills/doomsday/SKILL.md`).

---

## Plugin Manifest (plugin.json)

```json
{
  "name": "site-audit",
  "version": "1.0.0",
  "description": "Comprehensive website auditing: crawl pages, check links, find spelling errors, detect console errors and broken resources",
  "author": {
    "name": "Sivan Grunberg",
    "email": "sivan@vitakka.co",
    "url": "https://vitakka.co"
  }
}
```

**Naming creates namespace:** Skills from this plugin get prefixed as `/site-audit:audit-crawl`. The command stays as `/site-audit` (commands use plugin name as namespace root).

---

## Marketplace Registration

Add to existing `.claude-plugin/marketplace.json`:

```json
{
  "name": "site-audit",
  "description": "Comprehensive website auditing: dead links, spelling, console errors, visual issues",
  "version": "1.0.0",
  "source": "./site-audit",
  "author": {
    "name": "Sivan Grunberg",
    "email": "sivan@vitakka.co",
    "url": "https://vitakka.co"
  }
}
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Browser automation | claude-in-chrome MCP | Chrome DevTools MCP server | DevTools MCP requires separate setup (`npx chrome-devtools-mcp`); claude-in-chrome is built-in |
| External link check | WebFetch | javascript_tool fetch() | CORS blocks cross-origin requests from page context |
| Spell checking | Claude's own language analysis | External spellcheck API | No API available in Claude Code plugin context; Claude is excellent at this |
| Link extraction | javascript_tool (DOM query) | read_page + regex parsing | JS execution returns resolved URLs directly; more reliable |
| Report output | Write tool (markdown file) | Console output only | User wants persistent report; Write creates a file they can review/commit |

---

## Development & Testing

### Testing During Development

```bash
# Load plugin from local directory during development
claude --plugin-dir /Users/sivan/VitakkaProjects/sivan-claude-plugins/site-audit

# Or test the whole marketplace
claude --plugin-dir /Users/sivan/VitakkaProjects/sivan-claude-plugins
```

### Verifying Tool Availability

After loading the plugin, run `/mcp` in Claude Code and verify:
- `claude-in-chrome` provider shows all expected tools
- Chrome extension is active (version 1.0.36+)
- Claude Code version is 2.0.73+

---

## Sources

- [Create plugins - Claude Code Docs](https://code.claude.com/docs/en/plugins) -- official plugin structure
- [Use Claude Code with Chrome (beta)](https://code.claude.com/docs/en/chrome) -- Chrome integration docs
- [Claude Chrome MCP - LobeHub](https://lobehub.com/mcp/nonsleepr-claude-chrome-mcp) -- tool name verification
- [Plugin Structure - Claude Skills](https://claude-plugins.dev/skills/@anthropics/claude-plugins-official/plugin-structure) -- plugin.json fields
- [Claude Agent Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) -- SKILL.md frontmatter spec
- [SKILL.md allowed-tools issue #18737](https://github.com/anthropics/claude-code/issues/18737) -- allowed-tools behavior
- [Inside Claude Code's Web Tools](https://mikhail.io/2025/10/claude-code-web-tools/) -- WebFetch internals
- [anthropics/claude-code plugins README](https://github.com/anthropics/claude-code/blob/main/plugins/README.md) -- official examples
