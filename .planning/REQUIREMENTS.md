# Requirements: Site Audit Plugin

**Defined:** 2026-01-22
**Core Value:** Automated, thorough website quality assurance — catch every broken link, typo, and error across an entire site in one command.

## v1 Requirements

### Plugin Structure

- [x] **PLUG-01**: Restructure repo to multi-plugin layout (session-workflow + site-audit subdirectories)
- [x] **PLUG-02**: Create site-audit plugin with plugin.json manifest
- [x] **PLUG-03**: Create `/site-audit` slash command that accepts a URL argument

### Crawling

- [x] **CRAWL-01**: Recursive same-domain crawling via WebFetch with HTML link extraction
- [x] **CRAWL-02**: URL normalization (trailing slashes, fragments, query params, www prefix, protocol)
- [x] **CRAWL-03**: Visited-set tracking to prevent infinite loops
- [x] **CRAWL-04**: Configurable page cap to bound crawl size
- [x] **CRAWL-05**: Dead link detection (internal pages returning 404/error)

### Content Analysis

- [x] **CONT-01**: AI-powered spelling/grammar detection on extracted page text
- [x] **CONT-02**: Filter code blocks, technical terms, and brand names from spell-check analysis

### Visual/UI Checks (Chrome)

- [x] **UI-01**: Navigate crawled pages in Chrome and capture console errors
- [x] **UI-02**: Detect broken images and failed resource loads
- [x] **UI-03**: Detect visual layout issues (overlapping elements, collapsed layouts)

### Report

- [ ] **RPT-01**: Generate structured markdown report file
- [ ] **RPT-02**: Findings grouped by page and by issue type
- [ ] **RPT-03**: Severity categorization (error/warning/info)

## v2 Requirements

### External Links

- **EXT-01**: External link verification via WebFetch (check response status)

### Content Analysis (Extended)

- **CONT-03**: Placeholder/lorem ipsum detection in page content

### Visual/UI Checks (Extended)

- **UI-04**: Interactive element verification (buttons, forms responding to clicks)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Accessibility audit (WCAG) | Complex domain, separate tool |
| Performance profiling | Different concern entirely |
| SEO analysis | Separate tool territory |
| Screenshots per page | Adds complexity without core value |
| Full external domain crawling | Unbounded scope |
| Mobile viewport testing | Adds scope, defer |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLUG-01 | Phase 1 | Complete |
| PLUG-02 | Phase 1 | Complete |
| PLUG-03 | Phase 1 | Complete |
| CRAWL-01 | Phase 2 | Complete |
| CRAWL-02 | Phase 2 | Complete |
| CRAWL-03 | Phase 2 | Complete |
| CRAWL-04 | Phase 2 | Complete |
| CRAWL-05 | Phase 2 | Complete |
| CONT-01 | Phase 2 | Complete |
| CONT-02 | Phase 2 | Complete |
| UI-01 | Phase 3 | Complete |
| UI-02 | Phase 3 | Complete |
| UI-03 | Phase 3 | Complete |
| RPT-01 | Phase 4 | Pending |
| RPT-02 | Phase 4 | Pending |
| RPT-03 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0

---
*Requirements defined: 2026-01-22*
*Last updated: 2026-01-22 after roadmap creation*
