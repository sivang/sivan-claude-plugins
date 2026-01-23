---
phase: 04-report-generation
plan: 01
subsystem: report-generation
tags: [markdown, report, jsonl, findings, aggregation]
dependency-graph:
  requires: [02-01, 02-02, 03-01, 03-02]
  provides: [report-format-spec, phase-5-implementation]
  affects: [04-02]
tech-stack:
  added: []
  patterns: [type-based-grouping, page-index-aggregation, path-only-urls]
key-files:
  created:
    - site-audit/skills/site-audit/references/REPORT.md
  modified:
    - site-audit/skills/site-audit/SKILL.md
decisions:
  - id: report-type-grouping
    choice: "Primary grouping by finding type (not by page)"
    reason: "Users want to fix one category at a time (all broken links, then all spelling)"
  - id: path-only-urls
    choice: "Show path only for same-domain URLs in tables"
    reason: "Reduces table noise; domain is obvious from report header"
  - id: page-index-at-end
    choice: "Page index at end, sorted by total findings descending"
    reason: "Worst pages surface first; acts as a lookup table after reading type sections"
  - id: severity-mapping
    choice: "Broken links/console/resources=error; spelling/visual=warning"
    reason: "Broken functionality is more urgent than cosmetic issues"
metrics:
  duration: 1m 54s
  completed: 2026-01-23
---

# Phase 4 Plan 01: Report Format and Generation Summary

Report format reference document and Phase 5 implementation that reads all JSONL findings and generates a structured markdown report grouped by finding type with page index.

## What Was Built

### REPORT.md Reference Document
- Complete format specification for the audit report output
- File naming convention: `audit-{domain}-{date}.md`
- Summary counts table with severity columns (Errors, Warnings, Total)
- All 5 finding type table structures with type-specific columns
- Page index format: per-page breakdown sorted by total findings
- URL display rules: path-only for same-domain, full URL for external
- Run metadata header template

### Phase 5 Implementation in SKILL.md
- 8-step report generation process replacing placeholder
- Reads all 5 JSONL findings files (broken-links, spelling, console-errors, broken-resources, visual-issues)
- Builds summary counts with severity mapping
- Generates type-specific tables with appropriate columns per finding type
- Aggregates page index with per-type counts
- Conditional table of contents for 50+ findings
- Writes report to working directory root
- Updated Current Status to reflect all phases implemented

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary grouping | By finding type | Users fix one category at a time |
| URL display | Path-only for same-domain | Reduces noise; domain in header |
| Page index position | End of report | Lookup table after reading sections |
| Sort order | Total findings descending | Worst pages surface first |
| Severity mapping | links/console/resources=error, spelling/visual=warning | Broken functionality more urgent |
| TOC threshold | 50+ findings | Small reports don't need navigation |

## Files Changed

| File | Action | Lines | Purpose |
|------|--------|-------|---------|
| references/REPORT.md | Created | 145 | Format specification with all table templates |
| SKILL.md | Modified | +72/-10 | Phase 5 implementation + status update |

## Verification Results

- REPORT.md: 6 key sections, 31 table rows, all 5 finding types, 145 lines
- SKILL.md: 4 @references/REPORT.md links, 18 JSONL references, filename pattern present, page index referenced, 403 lines total

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Ready for 04-02 (severity classification and metadata enrichment). The report format is established and Phase 5 generates a complete report. Plan 02 can add severity badges, metadata fields, or additional report sections on top of this foundation.
