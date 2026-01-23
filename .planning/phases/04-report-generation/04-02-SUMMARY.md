---
phase: 04-report-generation
plan: 02
subsystem: report-format
tags: [severity, metadata, toc, truncation, report]
dependency-graph:
  requires: [04-01]
  provides: [severity-rules, metadata-format, toc-logic, truncation-rules]
  affects: []
tech-stack:
  added: []
  patterns: [conditional-toc, per-section-truncation, fixed-severity-mapping]
key-files:
  created: []
  modified:
    - site-audit/skills/site-audit/references/REPORT.md
    - site-audit/skills/site-audit/SKILL.md
decisions:
  - id: severity-fixed-per-type
    choice: "Severity determined entirely by finding type, not individual finding content"
    reason: "Simple, predictable, no ambiguity — broken things are errors, quality things are warnings"
  - id: toc-threshold-50
    choice: "Table of contents only when 50+ findings"
    reason: "Reports under 50 findings are short enough to scan without navigation"
  - id: truncation-cap-100
    choice: "Per-section cap of 100 rows, JSONL has full data"
    reason: "Prevents unreadably large reports while preserving all data in machine-readable format"
  - id: page-cap-in-metadata
    choice: "Show max_pages limit in metadata header"
    reason: "User needs to know if audit was limited (23/50 pages vs 50/50 pages)"
metrics:
  duration: "2m 4s"
  completed: "2026-01-23"
---

# Phase 4 Plan 02: Report Severity, Metadata, TOC, and Truncation Summary

Severity-prioritized findings with run context, conditional TOC for large reports, and per-section truncation at 100 rows pointing to full JSONL data.

## What Was Built

**Severity Assignment:** Fixed mapping of finding types to severity levels (error/warning). Broken links, console errors, and broken resources are errors. Spelling and visual issues are warnings. Each finding table now includes a Severity column.

**Run Metadata Header:** Report starts with a metadata table showing Target URL, Pages Crawled, Page Cap, Duration (Xm Ys format), and Generated timestamp. Provides complete audit context at a glance.

**Conditional TOC:** Table of contents generated only when total findings >= 50. Includes anchor links to each section with finding counts. Short reports skip TOC entirely.

**Large Report Truncation:** Per-section cap of 100 rows in finding tables. Truncated sections include a blockquote pointing to the full JSONL file. Summary counts and page index always show true totals.

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Severity model | Fixed per finding type | Simple, predictable, no ambiguity in assignment |
| TOC threshold | 50 findings | Under 50 findings, report is short enough to scan |
| Truncation cap | 100 rows per section | Prevents unreadable reports; JSONL has full data |
| Page cap display | Show in metadata | User knows if audit was capacity-limited |
| Duration format | Xm Ys | Human-readable at a glance |

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| references/REPORT.md | Added severity, metadata, TOC, truncation sections | +74/-5 |
| SKILL.md | Updated Phase 5 with metadata, severity, TOC, truncation steps | +30/-9 |

## Verification Results

- Severity section with all 5 type mappings: PASS
- Metadata format with all 5 fields: PASS
- TOC conditional logic (50+ threshold): PASS
- Truncation rules (100-row cap): PASS
- Severity column in all finding type tables: PASS
- REPORT.md total: 214 lines (target 180-230): PASS
- SKILL.md total: 424 lines (target 420-460): PASS

## Deviations from Plan

None - plan executed exactly as written.

## Phase Completion

Phase 4 (Report Generation) is now complete. Both plans executed:
- 04-01: Report format specification and Phase 5 generation flow
- 04-02: Severity, metadata, TOC, and truncation enhancements

The site-audit skill is fully functional with all phases implemented:
1. URL Validation
2. Crawl (BFS, broken links, spelling)
3. External Link Verification (placeholder)
4. UI Checks (console errors, broken resources, visual issues)
5. Report Generation (grouped findings, severity, metadata, TOC, truncation)
