# Site Audit Plugin

## What This Is

A Claude Code plugin that provides a `/site-audit` slash command to crawl a website, navigate all reachable same-domain pages, and produce a comprehensive audit report covering spelling errors, dead links, console errors, and visual issues. Part of Sivan's multi-plugin Claude tools repository.

## Core Value

Automated, thorough website quality assurance — catch every broken link, typo, and error across an entire site in one command.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Slash command `/site-audit` accepts a URL and triggers the audit
- [ ] Crawls all same-domain links recursively (avoids infinite loops via visited-set)
- [ ] Verifies external links respond (HTTP check without crawling)
- [ ] Detects dead/broken links (404s, timeouts, unreachable)
- [ ] Reads page text and flags spelling/grammar issues using AI analysis
- [ ] Captures JavaScript console errors on each page
- [ ] Detects visual issues (broken images, failed resource loads)
- [ ] Generates a structured markdown report file with all findings
- [ ] Restructure repository from single-plugin to multi-plugin layout

### Out of Scope

- Full accessibility audit (WCAG compliance) — complex domain, separate tool
- Performance profiling (load times, Core Web Vitals) — different concern
- SEO analysis — separate tool territory
- Crawling external domains fully — only verify they respond
- Screenshots of each page — adds complexity without core value

## Context

- This lives in the `sivan-claude-plugins` repo which currently holds the `session-workflow` plugin
- The repo needs restructuring: from single-plugin root to multi-plugin subdirectories
- The skill relies on Claude-in-Chrome MCP tools (`mcp__claude-in-chrome__*`) for browser interaction
- External link checking can use `WebFetch` for HTTP verification
- Spelling detection is AI-powered: Claude reads extracted page text and identifies typos
- Same-domain crawling needs loop prevention (track visited URLs, normalize paths)

## Constraints

- **Browser dependency**: Requires Claude-in-Chrome MCP extension to be active
- **Same-origin navigation**: Chrome MCP tools operate on visible browser tabs
- **Rate limiting**: Must not overwhelm target sites — sequential page navigation is natural throttling
- **Plugin structure**: Must follow Claude Code plugin conventions (plugin.json, skills/, commands/)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| AI-powered spelling over external tool | No spellcheck API available in Claude Code; Claude's language model is well-suited | — Pending |
| Same-domain crawl + external verify | Full external crawl is unbounded; verifying response is sufficient | — Pending |
| Markdown report output | Consistent with developer workflow; easy to review/commit | — Pending |
| Multi-plugin repo structure | User wants both session-workflow and site-audit in one repo | — Pending |

---
*Last updated: 2026-01-22 after initialization*
