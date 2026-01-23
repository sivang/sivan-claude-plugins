---
name: site-audit
description: This skill should be used when the user invokes /site-audit with a URL. It crawls the target website and produces a quality audit report covering broken links, spelling errors, console errors, and visual issues.
---

# Site Audit

**Role:** Thorough website quality auditor.

**Objective:** Crawl the provided URL and all reachable same-domain pages, checking for broken links, spelling/grammar errors, console errors, and visual issues. Produce a structured report of all findings.

## Input

The user provides a target URL as an argument to /site-audit. Example: `/site-audit https://example.com`

If no URL is provided, ask the user for one. Validate that the input is a valid URL (starts with http:// or https://).

## Execution

**Phase 1: URL Validation**
1. Extract the URL from the user's command
2. Validate it starts with http:// or https://
3. Confirm the target domain with the user

**Phase 2: Crawl**

After URL validation, begin the breadth-first crawl process.

**Initialization:**

1. Parse the seed URL to extract protocol, domain (hostname), and path
2. Initialize crawl state:
   - `queue`: List containing only the seed URL (normalized)
   - `visited`: Empty set for tracking crawled URLs
   - `page_count`: 0
   - `max_pages`: 50 (crawl limit)
   - `external_links`: Empty list for recording off-domain links
   - `seed_hostname`: Extracted hostname from seed URL (for same-domain checks)
   - `link_sources`: Map of {target_url: source_page} for dead link tracking
   - `broken_links_count`: 0
   - `spelling_issues_count`: 0
3. Create `.audit-data/` directory and initialize JSONL files:
   ```bash
   mkdir -p .audit-data
   touch .audit-data/findings-broken-links.jsonl
   touch .audit-data/findings-spelling.jsonl
   ```
4. Reference @references/URL_RULES.md for URL normalization rules
5. Reference @references/CHECKS.md for content analysis rules
6. Display initialization summary to user:
   - Seed URL (normalized)
   - Domain to crawl
   - Max pages limit
   - Findings will be written to `.audit-data/` directory
   - Ask user to confirm before starting crawl

**Crawl Loop:**

Execute the following steps in order, looping until termination:

1. **Termination check** — If queue is empty OR page_count >= max_pages, exit loop and proceed to Phase 3

2. **Dequeue** — Remove first URL from queue front (FIFO / breadth-first)

3. **Duplicate check** — If URL already in visited set, skip to step 1 (continue loop)

4. **Mark visited** — Add current URL to visited set, increment page_count

5. **Fetch page** — Use WebFetch with this exact prompt:
   ```
   Extract from this page:
   1) All links in [text](url) format, one per line. Include every <a href="...">, <link href="...">, and <area href="..."> element.
   2) Main text content of the page (skip code blocks, navigation, footer).

   Format your response as:
   LINKS:
   [Homepage](/)
   [About](/about)

   CONTENT:
   [page text content here]
   ```

   **If WebFetch returns an error (404, timeout, connection refused, etc.):**
   - This is a broken link — the current URL is dead
   - Get source page from `link_sources` map (use current URL as key)
   - If source not found, use "(seed)" as source
   - Record finding:
     ```bash
     echo '{"type":"broken_link","page":"[source_page]","target":"[current_url]","error":"[error_type]","timestamp":"[iso8601_timestamp]"}' >> .audit-data/findings-broken-links.jsonl
     ```
   - Increment `broken_links_count`
   - Skip to step 11 (loop back) — no links to extract from failed page

6. **Parse response** — Split WebFetch response into two sections:
   - Extract links from "LINKS:" section using pattern `[text](url)`
   - Extract page text content from "CONTENT:" section for analysis

7. **Normalize URLs** — For each extracted URL:
   - Resolve relative URLs to absolute using current page URL as base
   - Apply all 7 normalization rules from @references/URL_RULES.md in order
   - Result: canonical absolute URL

8. **Classify and route** — For each normalized URL:
   - **Skip check:** If URL matches any skip rule (mailto:, .pdf, .jpg, etc. per URL_RULES.md), discard it
   - **Same-domain check:** Extract hostname, compare with seed_hostname using strict matching (www. is significant)
   - **If same-domain:** Add to queue (if not already in visited set), record in `link_sources` map: `link_sources[normalized_url] = current_page_url`
   - **If external:** Add to external_links list with source page reference
   - **If skip:** Discard (don't crawl, don't record)

9. **Analyze content** — Reference @references/CHECKS.md for detailed rules. Analyze the page text content extracted in step 6:

   **Spelling/Grammar Check:**
   - Apply filtering rules to exclude non-prose content:
     - Code blocks (indented text, ```fenced```, `inline`)
     - Technical identifiers (camelCase, SCREAMING_CASE, snake_case)
     - URLs, email addresses, domain names
     - Brand/product names (Capitalized words, acronyms)
   - Identify HIGH confidence spelling errors only:
     - Obvious typos: "occured" → "occurred", "recieve" → "receive"
     - Repeated words: "the the" → "the"
     - Common misspellings: "seperate" → "separate"
   - For each error found:
     - Extract context snippet (~50 chars before/after)
     - Determine suggested correction
     - Get current timestamp in ISO 8601 format
     - Write finding to JSONL:
       ```bash
       echo '{"type":"spelling","page":"[current_url]","word":"[misspelled]","suggestion":"[correction]","context":"[snippet]","timestamp":"[iso8601]"}' >> .audit-data/findings-spelling.jsonl
       ```
     - Increment `spelling_issues_count`

   **Note:** Dead link detection for this page already happened in step 5 (if WebFetch failed). This step only analyzes successfully fetched content.

10. **State update** — After processing each page, output:
   ```
   Page [page_count]/[max_pages]: [current_url] - [issues_found_this_page] issues (broken links: [B], spelling: [S])
   Queue: [queue_length] URLs remaining
   ```

11. **Detailed state** — Every 5 pages (when page_count % 5 == 0), also output:
    ```
    Visited: [visited_count] pages
    External links found: [external_links_count]
    Total findings: [broken_links_count] broken links, [spelling_issues_count] spelling issues
    Next in queue: [first 3 URLs from queue, or "empty"]
    ```

12. **Loop back** — Return to step 1 (termination check)

**After crawl completion:**

- Report total pages crawled
- Report queue status (exhausted or hit page limit)
- Report external links count
- Report total findings: broken links and spelling issues
- Report findings files: `.audit-data/findings-broken-links.jsonl` and `.audit-data/findings-spelling.jsonl`
- Proceed to Phase 3

**Notes:**
- Normalize URLs BEFORE adding to queue or visited set (prevents duplicates like `/page` and `/page/`)
- Dead link detection happens in TWO places:
  - **Immediate:** When WebFetch fails to fetch a dequeued URL (step 5)
  - **Deferred:** When a link found on page A points to URL B, and URL B fails when later dequeued
- Source page tracking via `link_sources` map enables accurate broken link reporting
- Content analysis (step 9) only runs for successfully fetched pages (WebFetch returned content)
- Findings are written progressively to disk (JSONL append) to avoid memory overflow on large sites
- Store external_links for future external link verification (not implemented yet in Phase 2)
- HTTPS preference rule (rule 7): If you encounter both http:// and https:// versions, only queue the https:// version

**Phase 3: External Link Verification** (to be implemented)
- Placeholder: Report that external link verification is not yet implemented
- Target: Verify external links collected during crawl (different domains)

**Phase 4: UI Checks**

After crawl completion, perform Chrome-based runtime checks on all visited pages to detect console errors and broken resources that backend-only crawling cannot find.

**Initialization:**

1. Reference @references/UI_CHECKS.md for console filtering and resource classification rules
2. Get the visited pages list from Phase 2 crawl context (the `visited` set)
3. Create a Chrome tab for UI checks:
   - Call `tabs_context_mcp` to get existing tab group
   - Call `tabs_create_mcp` to create one dedicated tab for all UI checks
   - Store the returned tab ID for all subsequent navigations
4. Initialize JSONL findings files:
   ```bash
   touch .audit-data/findings-console-errors.jsonl
   touch .audit-data/findings-broken-resources.jsonl
   touch .audit-data/findings-visual-issues.jsonl
   ```
5. Initialize counters:
   - `page_check_count`: 0
   - `console_errors_count`: 0
   - `broken_resources_count`: 0
   - `visual_issues_count`: 0
   - `total_pages`: length of visited set
6. Display initialization summary to user:
   - Pages to check: [total_pages] (from Phase 2 crawl)
   - Chrome tab created: [tab_id]
   - Findings files: `.audit-data/findings-console-errors.jsonl`, `.audit-data/findings-broken-resources.jsonl`, `.audit-data/findings-visual-issues.jsonl`
   - Ask user to confirm before starting UI checks

**UI Check Loop:**

Execute the following steps in order for each URL in visited pages:

1. **Progress check** -- If page_check_count >= total_pages, exit loop and proceed to completion

2. **Navigate** -- Navigate the Chrome tab to the current URL using the navigate tool with the stored tab ID

3. **Wait** -- Wait 3 seconds for page load (scripts, resources, async content)

4. **Console error check** -- Reference @references/UI_CHECKS.md for filtering rules:
   - Call `read_console_messages` with `{"tabId": tab_id, "onlyErrors": true, "clear": true}`
   - Filter out messages from `chrome-extension://` URLs
   - Filter out favicon 404 messages
   - For each remaining error message:
     - Extract level (error/warning) and message text (truncate to 500 chars)
     - Get current timestamp in ISO 8601 format
     - Write finding to JSONL:
       ```bash
       echo '{"type":"console_error","page":"[url]","level":"[level]","message":"[msg]","timestamp":"[iso8601]"}' >> .audit-data/findings-console-errors.jsonl
       ```
     - Increment `console_errors_count`

5. **Broken resource check** -- Reference @references/UI_CHECKS.md for classification rules:
   - Call `read_network_requests` with `{"tabId": tab_id, "clear": true}`
   - Filter for failed requests: status >= 400 or status == 0
   - Filter out `chrome-extension://` requests
   - For each broken resource:
     - Classify resource type by URL extension:
       - `.jpg`, `.jpeg`, `.png`, `.gif`, `.svg`, `.webp`, `.ico` -> `image`
       - `.css` -> `style`
       - `.js` -> `script`
       - `.woff`, `.woff2`, `.ttf`, `.eot` -> `font`
       - Other -> `other`
     - Extract resource_url, resource_type, status
     - Get current timestamp in ISO 8601 format
     - Write finding to JSONL:
       ```bash
       echo '{"type":"broken_resource","page":"[url]","resource_url":"[failed_url]","resource_type":"[type]","status":"[status]","timestamp":"[iso8601]"}' >> .audit-data/findings-broken-resources.jsonl
       ```
     - Increment `broken_resources_count`

6. **Visual layout check** -- Reference @references/UI_CHECKS.md for JavaScript snippets:
   - Execute combined layout check JavaScript via `javascript_tool` on the same tab:
     ```javascript
     (function checkLayout() {
       const vw = window.innerWidth;
       const overflows = Array.from(document.querySelectorAll('*'))
         .filter(el => {
           const rect = el.getBoundingClientRect();
           return rect.width > 0 && (rect.right > vw + 5 || rect.left < -5);
         })
         .map(el => {
           const rect = el.getBoundingClientRect();
           return {
             issue: 'overflow',
             tag: el.tagName,
             id: el.id || '(none)',
             class: el.className || '(none)',
             width: Math.round(rect.width)
           };
         });
       const collapsed = Array.from(document.querySelectorAll('div, section, article, main, aside, nav'))
         .filter(el => {
           const rect = el.getBoundingClientRect();
           return el.children.length > 0 && (rect.height === 0 || rect.width === 0);
         })
         .map(el => {
           const rect = el.getBoundingClientRect();
           return {
             issue: 'collapsed',
             tag: el.tagName,
             id: el.id || '(none)',
             class: el.className || '(none)',
             children: el.children.length
           };
         });
       return { overflows, collapsed };
     })();
     ```
   - Parse result object containing `overflows` and `collapsed` arrays
   - For each overflow: format element string as `TAG#id.class`, record `"width: [N]px"` as details
   - For each collapsed: format element string as `TAG#id.class`, record `"children: [N]"` as details
   - Write each finding to JSONL:
     ```bash
     echo '{"type":"visual_issue","page":"[url]","issue":"overflow|collapsed","element":"[element_string]","details":"[details]","timestamp":"[iso8601]"}' >> .audit-data/findings-visual-issues.jsonl
     ```
   - Increment `visual_issues_count` for each finding

7. **State update** -- After processing each page, increment page_check_count and output:
   ```
   UI Check [page_check_count]/[total_pages]: [url] - [X] issues (console: [C], resources: [R], visual: [V])
   ```

8. **Detailed state** -- Every 5 pages (when page_check_count % 5 == 0), also output:
   ```
   Total findings: [console_errors_count] console errors, [broken_resources_count] broken resources, [visual_issues_count] visual issues
   Remaining: [remaining_count] pages
   ```

9. **Loop back** -- Return to step 1 (progress check)

**After UI check completion:**

- Report total pages checked: [page_check_count]
- Report total findings: [console_errors_count] console errors, [broken_resources_count] broken resources, [visual_issues_count] visual issues
- Report findings files: `.audit-data/findings-console-errors.jsonl`, `.audit-data/findings-broken-resources.jsonl`, `.audit-data/findings-visual-issues.jsonl`
- Proceed to Phase 5

**Notes:**
- Single tab reuse pattern: create once, navigate for each page (do not create new tabs)
- Clear console and network state between pages using `clear: true` parameter
- Handle navigation errors: if page fails to load, log as console_error finding with message "Navigation timeout" and skip visual checks for that page
- Progressive JSONL writing: same append pattern as Phase 2
- Wait strategy: 3 seconds per page (max 5s if page is slow to load)
- Visual layout checks run after console/network checks on the same already-loaded page (no additional navigation or wait needed)
- Reference @references/UI_CHECKS.md for all filtering, classification, and visual check details

**Phase 5: Report**

After UI checks complete, generate the structured markdown report.

**Timing:** Record the current time. The audit start time is when Phase 2 began (crawl initialization). Calculate duration as the difference, formatted as "Xm Ys" (e.g., "4m 32s").

**Report Generation:**

1. **Reference rules** -- Reference @references/REPORT.md for format specification

2. **Generate filename** -- Derive report filename:
   - Extract hostname from seed URL
   - Replace dots with hyphens (e.g., `example.com` -> `example-com`)
   - Get current date in YYYY-MM-DD format
   - Result: `audit-{domain}-{date}.md` (e.g., `audit-example-com-2026-01-23.md`)

3. **Read all JSONL findings** -- Read each findings file:
   ```bash
   cat .audit-data/findings-broken-links.jsonl 2>/dev/null
   cat .audit-data/findings-spelling.jsonl 2>/dev/null
   cat .audit-data/findings-console-errors.jsonl 2>/dev/null
   cat .audit-data/findings-broken-resources.jsonl 2>/dev/null
   cat .audit-data/findings-visual-issues.jsonl 2>/dev/null
   ```
   - Parse each line as JSON
   - Group findings by type
   - Count totals per type and per severity
   - If a file is empty or missing, that type has zero findings

4. **Build run metadata** -- Create the report header as a metadata table (see @references/REPORT.md for exact format):
   - H1 title: `# Site Audit Report`
   - Metadata table with fields:
     - **Target URL**: seed URL from Phase 1
     - **Pages Crawled**: page_count from Phase 2 (visited set size)
     - **Page Cap**: max_pages value (default 50)
     - **Duration**: calculated from audit start to now (format: Xm Ys)
     - **Generated**: current timestamp in ISO 8601 format

5. **Build summary counts** -- For each finding type, count findings by severity:
   - Broken links: all are "error"
   - Console errors: all are "error"
   - Broken resources: all are "error"
   - Spelling issues: all are "warning"
   - Visual issues: all are "warning"
   - Build the summary table (see @references/REPORT.md for format)
   - Only include rows for types that have findings
   - Calculate grand totals for the bold Total row

6. **Conditional TOC** -- After summary counts, check total findings:
   - If total findings >= 50: generate table of contents with anchor links to each section that has findings, with finding count in parentheses (see @references/REPORT.md for format)
   - If total findings < 50: skip TOC entirely (report is short enough to scan)

7. **Build finding type sections** -- For each type that has findings, in order (Broken Links, Spelling Issues, Console Errors, Broken Resources, Visual Issues):
   - Create H2 section header
   - Build markdown table with type-specific columns plus Severity column:
     - Broken Links: `| Page | Target URL | Error | Severity |`
     - Spelling: `| Page | Word | Suggestion | Context | Severity |`
     - Console Errors: `| Page | Level | Message | Severity |`
     - Broken Resources: `| Page | Resource URL | Type | Status | Severity |`
     - Visual Issues: `| Page | Issue | Element | Details | Severity |`
   - Severity values (fixed per type, see @references/REPORT.md severity section):
     - Broken links, console errors, broken resources: "error"
     - Spelling issues, visual issues: "warning"
   - One row per finding
   - Strip protocol and domain from same-domain URLs (show path only)
   - Truncate long messages to 100 chars
   - Context column for spelling: ~50 chars around the word, quoted
   - **Truncation:** If a section has more than 100 findings, only include first 100 rows in table, then add: `> Showing 100 of {N} findings. Full data: \`.audit-data/findings-{type}.jsonl\``
   - Summary counts always show true totals (not affected by truncation)

8. **Build page index** -- Aggregate findings by page URL (using ALL findings, not truncated):
   - For each unique page URL across all findings
   - Count findings per type for that page
   - Sort by total findings descending (ties broken alphabetically by path)
   - Build the page index table (see @references/REPORT.md)
   - Only include pages that have at least one finding
   - Page index is never truncated

9. **Write report file** -- Assemble and write the complete report:
   - Concatenate: metadata header + summary table + [TOC if applicable] + finding sections + page index
   - Use the Write tool to write the markdown file to working directory root
   - File path: `./audit-{domain}-{date}.md`

**After report generation:**
- Report file path to user
- Report total findings count and breakdown by type
- Note that raw JSONL data is preserved in `.audit-data/` for further analysis
- Audit is complete

## Current Status

All phases are implemented. After validating the URL, the skill will:
1. Confirm the target domain
2. Initialize crawl state with BFS queue and JSONL findings files
3. Crawl up to 50 same-domain pages using WebFetch
4. For each page: detect broken links, analyze spelling/grammar, extract links
5. Write findings progressively to `.audit-data/` JSONL files
6. Open each visited page in Chrome for console errors, broken resources, and visual issues
7. Generate structured markdown report with findings grouped by type and page index
8. Write report to `audit-{domain}-{date}.md` in working directory

External link verification (Phase 3) is coming in future updates.
