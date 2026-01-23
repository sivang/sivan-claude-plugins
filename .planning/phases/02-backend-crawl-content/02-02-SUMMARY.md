---
phase: 2
plan: 2
subsystem: backend-crawl
tags: [content-analysis, spelling-check, dead-links, jsonl, progressive-writing]
requires: [02-01]
provides: [content-analysis-rules, integrated-crawl-analysis, findings-storage]
affects: [phase-3-external-links, phase-5-report]
tech-stack:
  added: []
  patterns: [progressive-jsonl-writing, two-phase-detection]
key-files:
  created:
    - site-audit/skills/site-audit/references/CHECKS.md
  modified:
    - site-audit/skills/site-audit/SKILL.md
decisions:
  - Progressive JSONL writing prevents memory overflow on large sites
  - Two-phase dead link detection (immediate on fetch error, deferred when queued URL fails)
  - HIGH confidence spelling errors only to avoid technical term false positives
  - Single WebFetch call returns both links and content for efficiency
  - link_sources map enables accurate broken link source tracking
metrics:
  duration: 3m 38s
  completed: 2026-01-23
---

# Phase 2 Plan 2: Content Analysis Integration Summary

**One-liner:** Progressive JSONL content analysis (spelling + dead links) integrated into BFS crawl with high-confidence filtering to avoid technical term false positives

## What Was Built

### 1. Content Analysis Reference (CHECKS.md)

Created comprehensive reference document defining rules for:

**Spelling/Grammar Analysis:**
- Filter out code blocks (indented, fenced, inline)
- Filter out technical identifiers (camelCase, SCREAMING_CASE, snake_case)
- Filter out URLs, emails, brand names, acronyms
- Flag HIGH confidence errors only (obvious typos, repeated words, common misspellings)
- Provide context snippet and suggestion for each finding

**Dead Link Detection:**
- Internal same-domain URLs that return errors (404, timeout, connection refused, DNS errors)
- Two detection points: WebFetch fails on dequeued URL, or link points to URL that later fails
- Track source page for accurate reporting using link_sources map

**Progressive Writing Pattern:**
- Append-only JSONL files in .audit-data/ directory
- Write after EACH page analysis, before moving to next
- One file per finding type: findings-spelling.jsonl, findings-broken-links.jsonl

### 2. Integrated Crawl Analysis (SKILL.md Phase 2)

Enhanced the BFS crawl loop with content analysis:

**Initialization updates:**
- Added link_sources map for tracking where each URL was found
- Added broken_links_count and spelling_issues_count counters
- Create .audit-data/ directory and empty JSONL files

**WebFetch prompt enhancement:**
- Single call now returns BOTH links and page text content
- Structured response format: "LINKS:" section followed by "CONTENT:" section
- Error handling: detect dead links immediately when WebFetch fails

**New analysis step (step 9):**
- Parse page text content from WebFetch response
- Apply spelling/grammar filtering rules from CHECKS.md
- Identify HIGH confidence errors only
- Write findings to JSONL files with bash echo commands
- Increment counters

**State output updates:**
- Every page: show issues found (broken links + spelling counts)
- Every 5 pages: show total findings across all pages
- Final summary: report findings files and totals

**Routing updates:**
- Record link_sources mapping when adding same-domain URLs to queue
- Enables accurate source page reporting when target URL later fails

## Technical Decisions

### Progressive JSONL Writing

**Decision:** Write findings to append-only JSONL files after each page, not accumulate in memory.

**Rationale:**
- Large sites (50+ pages) could generate thousands of findings
- Memory accumulation would overflow context window
- Disk writes are cheap, context tokens are expensive
- Crash resilient: findings preserved even if crawl interrupted
- Enables real-time monitoring (tail -f files)

**Implementation:**
- bash echo commands append single-line JSON objects
- One file per finding type for easy filtering
- ISO 8601 timestamps for temporal analysis

### Two-Phase Dead Link Detection

**Decision:** Detect dead links at two points in the crawl process.

**Phase 1 - Immediate detection (step 5):**
- URL is dequeued and WebFetch is called
- WebFetch returns error (404, timeout, etc.)
- Dead link detected immediately
- Look up source page from link_sources map

**Phase 2 - Deferred detection (step 8):**
- Page A contains link to URL B
- URL B is normalized and added to queue
- Record link_sources[B] = A
- Later, when B is dequeued, if WebFetch fails, we have source page A

**Benefit:** Accurate source page attribution for all broken links, whether discovered immediately or later in crawl.

### High-Confidence Filtering Strategy

**Decision:** Only flag obvious spelling errors, apply aggressive filtering to exclude technical content.

**Filters applied:**
- Code blocks (indented, fenced, inline)
- Technical identifiers (camelCase, SCREAMING_CASE, snake_case)
- URLs, emails, domain names
- Brand/product names (Capitalized, acronyms)

**Confidence criteria:**
- Obvious typos: "occured" → "occurred"
- Repeated words: "the the" → "the"
- Common misspellings: "seperate" → "separate"

**Rationale:**
- Developer sites contain jargon, framework names, API terms
- False positives reduce report value
- Better to miss some errors than flood with false positives
- Context-aware: if word appears multiple times, likely intentional

### Single WebFetch Call Efficiency

**Decision:** Request links AND content in one WebFetch call, not two separate calls.

**Previous approach (02-01):**
- WebFetch extracts links only
- Would need second WebFetch for content

**New approach (02-02):**
- WebFetch extracts BOTH links and content
- Structured response: "LINKS:" section + "CONTENT:" section
- Parse sections separately for routing vs analysis

**Benefits:**
- Half the WebFetch calls (50 instead of 100 for 50 pages)
- Faster crawl completion
- Reduced API usage

## Files Changed

**Created:**
- `site-audit/skills/site-audit/references/CHECKS.md` - Content analysis rules reference (175 lines)

**Modified:**
- `site-audit/skills/site-audit/SKILL.md` - Phase 2 integration (194 lines total, +83 -21)
  - Added initialization for .audit-data directory and JSONL files
  - Updated WebFetch prompt to extract links + content
  - Added dead link detection on fetch errors
  - Added content analysis step (step 9) with spelling/grammar check
  - Updated state output to include findings counts
  - Added link_sources map for source tracking
  - Updated Phase 3 description (now "External Link Verification")
  - Updated Current Status section

## Requirements Coverage

All 7 Phase 2 content analysis requirements met:

**CRAWL-01:** BFS crawl with WebFetch - ✓ (from 02-01, enhanced with content extraction)
**CRAWL-02:** URL normalization - ✓ (from 02-01, now used for link_sources tracking)
**CRAWL-03:** Same-domain filtering - ✓ (from 02-01, preserved)
**CRAWL-04:** External link tracking - ✓ (from 02-01, preserved)
**CRAWL-05:** Progressive state reporting - ✓ (enhanced with findings counts)
**CONT-01:** Dead link detection - ✓ (two-phase detection, immediate + deferred)
**CONT-02:** Spelling/grammar analysis - ✓ (HIGH confidence with filtering)

## Verification

To verify the implementation:

1. **CHECKS.md exists with complete rules:**
   ```bash
   cat site-audit/skills/site-audit/references/CHECKS.md
   ```
   Should show: spelling filtering rules, dead link detection rules, JSONL format examples

2. **SKILL.md Phase 2 includes analysis:**
   ```bash
   grep -A 5 "Analyze content" site-audit/skills/site-audit/SKILL.md
   ```
   Should show: step 9 with spelling check and JSONL writing

3. **WebFetch prompt requests both links and content:**
   ```bash
   grep -A 10 "Fetch page" site-audit/skills/site-audit/SKILL.md
   ```
   Should show: "1) All links... 2) Main text content..."

4. **Initialization creates JSONL files:**
   ```bash
   grep -A 3 "mkdir -p .audit-data" site-audit/skills/site-audit/SKILL.md
   ```
   Should show: touch findings-broken-links.jsonl and findings-spelling.jsonl

5. **State output includes findings:**
   ```bash
   grep "issues found" site-audit/skills/site-audit/SKILL.md
   ```
   Should show: per-page issues and total findings in detailed state

6. **Phase 2 line count under 300:**
   ```bash
   wc -l site-audit/skills/site-audit/SKILL.md
   ```
   Should show: 194 lines total (well under limit)

## Deviations from Plan

None - plan executed exactly as written.

## Next Phase Readiness

Phase 2 is now complete with integrated content analysis. Ready for:

**Phase 3: External Link Verification**
- External links collected during crawl are stored but not yet verified
- Need to verify external links (different domains) in separate phase
- Findings would be written to `.audit-data/findings-external-links.jsonl`

**Phase 4: UI Checks**
- Chrome-based console error detection
- Visual issue detection
- Requires Chrome automation layer

**Phase 5: Report Generation**
- Read JSONL findings files
- Generate structured markdown report
- Group by page and by issue type

**Blockers:** None

**Dependencies satisfied:** Phase 2 Wave 1 (02-01) provided URL normalization and BFS crawl loop foundation.

## Performance Notes

**Execution time:** 3m 38s
- Task 1 (CHECKS.md creation): ~1m
- Task 2 (SKILL.md integration): ~2m 30s

**Line count impact:**
- CHECKS.md: 175 lines (new file)
- SKILL.md: +83 lines added, -21 lines modified (net +62 lines)
- Total SKILL.md: 194 lines (within Phase 2 limit of 300)

**Efficiency gains:**
- Single WebFetch call per page (not two) saves ~50% API calls
- Progressive JSONL writing prevents context overflow
- link_sources map enables O(1) source page lookup

## Lessons Learned

**1. Progressive writing is essential for large-scale crawls**
- Accumulating findings in context would overflow on 50+ page sites
- Disk writes are cheap, append-only is simple and reliable

**2. Two-phase detection requires explicit tracking**
- link_sources map is necessary to attribute source page when URL fails later
- Without it, we'd only know "this URL is dead" but not "found on page X"

**3. Filtering is more important than detection**
- Technical sites have lots of jargon that looks like misspellings
- Better to under-report than over-report false positives
- HIGH confidence threshold maintains signal-to-noise ratio

**4. Single-call efficiency compounds**
- Extracting links + content in one WebFetch call doubles efficiency
- On 50-page crawl: 50 calls instead of 100
- Matters more on larger sites

## Wave Completion

**Wave 2 Status:** Complete (02-02 done)

**Wave 2 deliverable:** Backend crawl with integrated content analysis (dead links + spelling)

**Next:** Phase 3 (External Link Verification) or Phase 4 (UI Checks) planning
