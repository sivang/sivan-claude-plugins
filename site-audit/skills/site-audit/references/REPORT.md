# Report Format Specification

This document defines the structure and format of the audit report generated after all phases complete.

## Report File Naming

- Pattern: `audit-{domain}-{date}.md`
- Domain: seed URL hostname with dots replaced by hyphens (e.g., `example.com` -> `example-com`)
- Date: YYYY-MM-DD format
- Examples: `audit-example-com-2026-01-23.md`, `audit-my-site-io-2026-01-23.md`
- Location: working directory root (not inside `.audit-data/`)

## Report Structure

The report contains these sections in order:

1. Run metadata header (H1 title, seed URL, date, pages crawled)
2. Summary counts table
3. Table of contents (conditional: only if 50+ total findings)
4. Finding type sections (one per type that has findings)
5. Page index

## Summary Counts Table

```markdown
## Summary

| Type | Errors | Warnings | Total |
|------|--------|----------|-------|
| Broken Links | 3 | 0 | 3 |
| Spelling | 0 | 5 | 5 |
| Console Errors | 2 | 0 | 2 |
| Broken Resources | 1 | 0 | 1 |
| Visual Issues | 0 | 2 | 2 |
| **Total** | **6** | **7** | **13** |
```

- Only include rows for types that have findings
- Always include the bold Total row
- Severity mapping:
  - Broken Links: error
  - Console Errors: error
  - Broken Resources: error
  - Spelling: warning
  - Visual Issues: warning

## Finding Type Sections

One H2 section per finding type, only if that type has findings. Section order: Broken Links, Spelling Issues, Console Errors, Broken Resources, Visual Issues.

### Broken Links

```markdown
## Broken Links

| Page | Target URL | Error |
|------|-----------|-------|
| /about | /old-page | 404 |
| /blog | https://gone.example.com/api | timeout |
```

### Spelling Issues

```markdown
## Spelling Issues

| Page | Word | Suggestion | Context |
|------|------|------------|---------|
| /about | occured | occurred | "...this occured during the..." |
```

- Context column: ~50 chars around the word, quoted

### Console Errors

```markdown
## Console Errors

| Page | Level | Message |
|------|-------|---------|
| /app | error | Uncaught TypeError: Cannot read properties of null |
```

- Message truncated to 100 chars in table

### Broken Resources

```markdown
## Broken Resources

| Page | Resource URL | Type | Status |
|------|-------------|------|--------|
| /about | /images/team.jpg | image | 404 |
| /app | /js/legacy.js | script | 403 |
```

### Visual Issues

```markdown
## Visual Issues

| Page | Issue | Element | Details |
|------|-------|---------|---------|
| /app | overflow | DIV#hero.banner | width: 1450px |
| /blog | collapsed | SECTION#comments.(none) | children: 3 |
```

## Page Index

Lists each page that had at least one finding, sorted by total findings descending.

```markdown
## Page Index

| Page | Broken Links | Spelling | Console | Resources | Visual | Total |
|------|-------------|----------|---------|-----------|--------|-------|
| /about | 1 | 2 | 0 | 1 | 0 | 4 |
| /blog | 0 | 1 | 1 | 0 | 1 | 3 |
| /app | 0 | 0 | 2 | 0 | 0 | 2 |
```

- Only pages with at least one finding appear
- Sorted by Total column descending
- Ties broken by page path alphabetically

## URL Display Rules

- Same-domain URLs: show path only (strip protocol and hostname)
- External URLs: show full URL
- Root path: show "/"
- Examples:
  - `https://example.com/about` on example.com audit -> `/about`
  - `https://other.com/api` -> `https://other.com/api`
  - `https://example.com/` -> `/`

## Run Metadata Header

The report begins with a metadata table before the summary:

```markdown
# Site Audit Report

| Field | Value |
|-------|-------|
| Target URL | https://example.com |
| Pages Crawled | 23 |
| Page Cap | 50 |
| Duration | 4m 32s |
| Generated | 2026-01-23 14:30:00 UTC |
```

Fields:
- **Target URL**: The seed URL provided by the user
- **Pages Crawled**: Number of pages actually visited (page_count from Phase 2)
- **Page Cap**: The max_pages limit (default 50)
- **Duration**: Time from crawl start to report generation (format: Xm Ys)
- **Generated**: Timestamp when report was generated (ISO 8601)

## Severity Assignment

Severity is fixed per finding type (not context-dependent):

| Finding Type | Severity |
|-------------|----------|
| Broken Links | error |
| Console Errors | error |
| Broken Resources | error |
| Spelling Issues | warning |
| Visual Issues | warning |

- Severity is determined entirely by finding type
- No "info" severity currently assigned (reserved for future finding types)
- Each finding type table includes a Severity column
- Summary counts table uses these rules for the breakdown

## Table of Contents

Conditional: Only generate TOC when total findings count >= 50.

Format (when included):
```markdown
## Contents

- [Summary](#summary)
- [Broken Links](#broken-links) (3)
- [Spelling Issues](#spelling-issues) (5)
- [Console Errors](#console-errors) (2)
- [Broken Resources](#broken-resources) (1)
- [Visual Issues](#visual-issues) (2)
- [Page Index](#page-index)
```

- Only include entries for finding types that have findings
- Count in parentheses shows findings in that section
- Anchor links use lowercase-hyphenated section names
- When total findings < 50, skip TOC entirely (report is short enough to scan)

## Large Report Truncation

When a single finding type section exceeds 100 rows:

- Show first 100 rows in the table
- Add a note after the table:
  ```markdown
  > Showing 100 of {N} findings. Full data: `.audit-data/findings-{type}.jsonl`
  ```
- This prevents reports from becoming unreadably large
- Raw JSONL always has complete data

Truncation thresholds:
- Per-section cap: 100 rows
- Applies independently to each finding type section
- Page index is never truncated (shows all pages with findings)
- Summary counts always show true totals (not truncated counts)
