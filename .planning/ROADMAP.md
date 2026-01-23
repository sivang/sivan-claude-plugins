# Roadmap: Site Audit Plugin

## Overview

Deliver a Claude Code plugin that crawls a website and produces a comprehensive quality audit. The build progresses from plugin scaffold, through backend crawl and content analysis (WebFetch-based, no browser needed), then layers Chrome-based UI checks on discovered pages, and finally compiles all findings into a structured report.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases (e.g., 2.1): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Plugin Scaffold** - Restructure repo and create site-audit plugin entry point
- [x] **Phase 2: Backend Crawl + Content** - Recursive crawl via WebFetch with dead link detection and AI spelling analysis
- [x] **Phase 3: Chrome UI Checks** - Navigate discovered pages in Chrome for console errors, broken images, and visual issues
- [ ] **Phase 4: Report Generation** - Compile findings into structured, categorized markdown report

## Phase Details

### Phase 1: Plugin Scaffold
**Goal**: User can invoke `/site-audit` and the plugin infrastructure is ready to receive crawl logic
**Depends on**: Nothing (first phase)
**Requirements**: PLUG-01, PLUG-02, PLUG-03
**Success Criteria** (what must be TRUE):
  1. Repository contains separate subdirectories for session-workflow and site-audit plugins
  2. site-audit plugin has a valid plugin.json manifest recognized by Claude Code
  3. User can type `/site-audit <url>` and the command dispatches to the audit skill
**Plans:** 2 plans

Plans:
- [x] 01-01-PLAN.md — Repo restructure and plugin manifest
- [x] 01-02-PLAN.md — Slash command and skill skeleton

### Phase 2: Backend Crawl + Content
**Goal**: Plugin crawls all same-domain pages via WebFetch, detects dead links, and identifies spelling/grammar issues without needing a browser
**Depends on**: Phase 1
**Requirements**: CRAWL-01, CRAWL-02, CRAWL-03, CRAWL-04, CRAWL-05, CONT-01, CONT-02
**Success Criteria** (what must be TRUE):
  1. Plugin recursively discovers and visits all same-domain pages from the seed URL
  2. URLs are normalized so the same page is never visited twice regardless of trailing slashes, fragments, or protocol variants
  3. Crawl stops at a configurable page cap (default 50) and terminates gracefully
  4. Dead internal links (404s, errors) are detected and recorded to disk
  5. Spelling/grammar issues are identified on page text with code blocks and technical terms filtered out
**Plans:** 2 plans

Plans:
- [x] 02-01-PLAN.md — Core BFS crawl infrastructure with URL normalization and visited-set tracking
- [x] 02-02-PLAN.md — Content analysis integration (dead links + spelling/grammar with filtering)

### Phase 3: Chrome UI Checks
**Goal**: Plugin navigates already-discovered pages in Chrome to capture runtime errors, broken resources, and visual layout issues
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03
**Success Criteria** (what must be TRUE):
  1. Plugin opens each crawled page in Chrome and captures JavaScript console errors
  2. Broken images and failed resource loads are detected via network request inspection
  3. Visual layout issues (overlapping elements, collapsed layouts) are identified
**Plans:** 2 plans

Plans:
- [x] 03-01-PLAN.md — UI_CHECKS.md reference + console errors and broken resource detection
- [x] 03-02-PLAN.md — Visual layout issue detection (overflow, collapsed containers)

### Phase 4: Report Generation
**Goal**: All findings from crawl, content, and UI phases compile into a single structured markdown report
**Depends on**: Phase 3
**Requirements**: RPT-01, RPT-02, RPT-03
**Success Criteria** (what must be TRUE):
  1. A markdown report file is generated at a predictable path after audit completes
  2. Findings are grouped both by page and by issue type for easy navigation
  3. Each finding has a severity level (error/warning/info) so users can prioritize fixes
**Plans:** 2 plans

Plans:
- [ ] 04-01-PLAN.md — Report structure, type-based grouping, summary counts, and page index
- [ ] 04-02-PLAN.md — Severity categorization, run metadata, conditional TOC, and truncation

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Plugin Scaffold | 2/2 | Done | 2026-01-23 |
| 2. Backend Crawl + Content | 2/2 | Done | 2026-01-23 |
| 3. Chrome UI Checks | 2/2 | Done | 2026-01-23 |
| 4. Report Generation | 0/2 | Not started | - |
