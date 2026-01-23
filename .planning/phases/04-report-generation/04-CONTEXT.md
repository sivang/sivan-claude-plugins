# Phase 4: Report Generation - Context

**Gathered:** 2026-01-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Compile all findings from crawl, content, and UI checks into a single structured markdown report. The report reads JSONL findings files and produces a human-readable document with severity categorization and multiple grouping views.

</domain>

<decisions>
## Implementation Decisions

### Report structure
- Primary organization by finding type (broken links, spelling, console errors, broken resources, visual issues)
- Page index at the end showing which pages had issues
- Summary counts table at the top with per-type severity breakdown (Type | Errors | Warnings | Info | Total)
- Table of contents with anchor links only if report has 50+ findings
- No overall pass/fail score — just counts

### Finding presentation
- Compact markdown table rows (URL, issue, severity per row)
- Spelling findings include a Context column showing ~50 chars around the misspelled word
- Each findings table includes a Severity column (error/warning/info)
- Finding type sections show individual rows, not aggregated summaries

### Severity assignment
- Fixed rules per finding type (not context-dependent):
  - Broken links → error
  - Console errors → error
  - Broken resources → error
  - Spelling issues → warning
  - Visual layout issues → warning
- Summary table shows breakdown: Type | Errors | Warnings | Info | Total

### Output location & naming
- Report written to working directory root (not inside .audit-data/)
- Filename: `audit-{domain}-{date}.md` (e.g., `audit-example-com-2026-01-23.md`)
- Domain extracted from seed URL, dots replaced with hyphens
- Run metadata header at top: target URL, pages crawled, duration, timestamp, page cap
- .audit-data/ JSONL files kept after report generation (raw data preserved)

### Claude's Discretion
- Ordering of findings within each type section (by severity, by URL, or by frequency)
- Deduplication strategy for findings appearing on multiple pages
- Truncation threshold for very large reports (cap per section with note pointing to JSONL)
- Exact table column widths and formatting

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches for markdown report formatting.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 04-report-generation*
*Context gathered: 2026-01-23*
