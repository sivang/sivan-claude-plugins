# Site Audit Plugin

## What This Is

A Claude Code plugin that provides a `/site-audit` slash command to crawl a website, navigate all reachable same-domain pages, and produce a comprehensive audit report covering spelling errors, dead links, console errors, and visual issues. Part of Sivan's multi-plugin Claude tools repository.

## Core Value

Automated, thorough website quality assurance — catch every broken link, typo, and error across an entire site in one command.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Restructure repository from single-plugin to multi-plugin layout
- [ ] Slash command `/site-audit` accepts a URL and triggers the audit
- [ ] Backend crawl layer: recursive same-domain crawling via WebFetch + HTML parsing
- [ ] Backend content layer: AI-powered spelling/grammar detection on page text
- [ ] Chrome UI layer: console errors, broken images, visual layout issues
- [ ] Detects dead/broken links (404s, timeouts, unreachable)
- [ ] Generates a structured markdown report file with all findings

### Out of Scope

- External link verification — deferred to v2
- Full accessibility audit (WCAG compliance) — complex domain, separate tool
- Performance profiling (load times, Core Web Vitals) — different concern
- SEO analysis — separate tool territory
- Crawling external domains — unbounded scope
- Screenshots of each page — adds complexity without core value

## Context

- This lives in the `sivan-claude-plugins` repo which currently holds the `session-workflow` plugin
- The repo needs restructuring: from single-plugin root to multi-plugin subdirectories
- Two-layer architecture: backend (WebFetch + HTML parsing) handles crawl and content checks; Chrome layer handles visual/runtime checks
- Backend layer runs first — no browser needed for link crawling and spelling
- Chrome layer runs second — navigates pages already discovered to check console/visual
- Spelling detection is AI-powered: Claude reads extracted page text and identifies typos
- Same-domain crawling needs loop prevention (track visited URLs, normalize paths)
- State written to disk progressively — not held in context alone

## Constraints

- **Chrome dependency**: Chrome MCP only needed for UI layer (visual checks, console errors)
- **Context budget**: Write findings to disk after each page — don't accumulate in context
- **Rate limiting**: Sequential navigation provides natural throttling
- **Plugin structure**: Must follow Claude Code plugin conventions (plugin.json, skills/, commands/)
- **Page cap**: Hard limit on pages crawled to prevent unbounded execution

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Two-layer architecture (backend + Chrome) | Backend WebFetch crawl is faster and browser-independent; Chrome adds visual layer on top | — Pending |
| AI-powered spelling over external tool | No spellcheck API available in Claude Code; Claude's language model is well-suited | — Pending |
| Same-domain crawl only (v1) | External link verification deferred to v2; keeps scope bounded | — Pending |
| Markdown report output | Consistent with developer workflow; easy to review/commit | — Pending |
| Multi-plugin repo structure | User wants both session-workflow and site-audit in one repo | — Pending |
| Write state to disk, not context | Prevents context overflow on large sites; findings persist if session ends | — Pending |

---
*Last updated: 2026-01-22 after requirements definition*
