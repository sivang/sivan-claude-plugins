# Site Audit Plugin

## What This Is

A Claude Code plugin that provides a `/site-audit` slash command to crawl a website, navigate all reachable same-domain pages, and produce a comprehensive audit report covering spelling errors, dead links, console errors, and visual issues. Part of Sivan's multi-plugin Claude tools repository.

The plugin uses a two-layer architecture: a backend WebFetch crawl discovers pages and detects content issues (broken links, spelling), then a Chrome UI layer navigates discovered pages to capture runtime errors, broken resources, and visual layout problems. Findings are written progressively to JSONL files and compiled into a structured markdown report.

## Core Value

Automated, thorough website quality assurance — catch every broken link, typo, and error across an entire site in one command.

## Requirements

### Validated (v1 — shipped 2026-01-23)

- [x] Multi-plugin repository layout (session-workflow + site-audit subdirectories)
- [x] `/site-audit` slash command accepts a URL and triggers the audit
- [x] Recursive same-domain crawling via WebFetch with BFS traversal and 50-page cap
- [x] RFC 3986 URL normalization preventing duplicate crawls
- [x] Dead link detection (404s, timeouts, connection failures)
- [x] AI-powered spelling/grammar detection with high-confidence filtering
- [x] Chrome-based console error capture
- [x] Broken image and resource detection via network inspection
- [x] Visual layout issue detection (overflow, collapsed containers)
- [x] Structured markdown report with severity categorization and page index

### Planned (v2)

- [ ] External link verification (check response status for off-domain links)
- [ ] Placeholder/lorem ipsum detection in page content
- [ ] Interactive element verification (buttons, forms responding to clicks)

### Out of Scope

- Full accessibility audit (WCAG compliance) — complex domain, separate tool
- Performance profiling (load times, Core Web Vitals) — different concern
- SEO analysis — separate tool territory
- Crawling external domains — unbounded scope
- Screenshots of each page — adds complexity without core value
- Mobile viewport testing — adds scope, defer

## Context

- Lives in `sivan-claude-plugins` repo alongside `session-workflow` plugin
- Two-layer architecture: backend (WebFetch) handles crawl and content; Chrome handles visual/runtime
- Backend layer runs first — no browser needed for link crawling and spelling
- Chrome layer runs second — navigates pages already discovered
- Progressive JSONL writing: findings written to disk after each page, not held in context
- Skill-based architecture: SKILL.md contains procedural instructions for Claude, not code

## Constraints

- **Chrome dependency**: Chrome MCP only needed for UI layer (visual checks, console errors)
- **Context budget**: Write findings to disk after each page — don't accumulate in context
- **Rate limiting**: Sequential navigation provides natural throttling
- **Plugin structure**: Must follow Claude Code plugin conventions (plugin.json, skills/, commands/)
- **Page cap**: Hard limit on pages crawled (default 50) to prevent unbounded execution

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two-layer architecture (backend + Chrome) | Backend WebFetch crawl is faster and browser-independent; Chrome adds visual layer on top | Validated — clean separation, phases 2+4 independent |
| AI-powered spelling over external tool | No spellcheck API available in Claude Code; Claude's language model is well-suited | Validated — HIGH confidence filtering avoids false positives |
| Same-domain crawl only (v1) | External link verification deferred to v2; keeps scope bounded | Validated — scope well-bounded, v2 can add externals |
| Markdown report output | Consistent with developer workflow; easy to review/commit | Validated — type-grouped tables with severity work well |
| Multi-plugin repo structure | User wants both session-workflow and site-audit in one repo | Validated — clean subdirectory separation |
| Write state to disk, not context | Prevents context overflow on large sites; findings persist if session ends | Validated — progressive JSONL is crash-resilient |
| Single WebFetch call per page | Returns both links and content in one call | Validated — halves API calls vs two-call approach |
| Fixed severity per finding type | Broken functionality=error, quality issues=warning | Validated — simple, predictable prioritization |

---
*Last updated: 2026-01-23 after v1 milestone completion*
