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
   ```
5. Initialize counters:
   - `page_check_count`: 0
   - `console_errors_count`: 0
   - `broken_resources_count`: 0
   - `total_pages`: length of visited set
6. Display initialization summary to user:
   - Pages to check: [total_pages] (from Phase 2 crawl)
   - Chrome tab created: [tab_id]
   - Findings files: `.audit-data/findings-console-errors.jsonl`, `.audit-data/findings-broken-resources.jsonl`
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

6. **State update** -- After processing each page, increment page_check_count and output:
   ```
   UI Check [page_check_count]/[total_pages]: [url] - [X] issues (console: [C], resources: [R])
   ```

7. **Detailed state** -- Every 5 pages (when page_check_count % 5 == 0), also output:
   ```
   Total findings: [console_errors_count] console errors, [broken_resources_count] broken resources
   Remaining: [remaining_count] pages
   ```

8. **Loop back** -- Return to step 1 (progress check)

**After UI check completion:**

- Report total pages checked: [page_check_count]
- Report total findings: [console_errors_count] console errors, [broken_resources_count] broken resources
- Report findings files: `.audit-data/findings-console-errors.jsonl`, `.audit-data/findings-broken-resources.jsonl`
- Proceed to Phase 5

**Notes:**
- Single tab reuse pattern: create once, navigate for each page (do not create new tabs)
- Clear console and network state between pages using `clear: true` parameter
- Handle navigation errors: if page fails to load, log as console_error finding with message "Navigation timeout" and continue
- Progressive JSONL writing: same append pattern as Phase 2
- Wait strategy: 3 seconds per page (max 5s if page is slow to load)
- Reference @references/UI_CHECKS.md for all filtering and classification details

**Phase 5: Report** (to be implemented)
- Placeholder: Report that report generation is not yet implemented
- Target: Structured markdown report with findings by page and by type

## Current Status

Phases 1-2 and Phase 4 are implemented. After validating the URL, the skill will:
1. Confirm the target domain
2. Initialize crawl state with BFS queue and JSONL findings files
3. Crawl up to 50 same-domain pages using WebFetch
4. For each page: detect broken links, analyze spelling/grammar, extract links
5. Write findings progressively to `.audit-data/` JSONL files
6. Track external links for future verification
7. Report crawl completion with findings summary
8. Open each visited page in Chrome to check for console errors and broken resources
9. Write UI check findings to dedicated JSONL files

External link verification (Phase 3) and final report (Phase 5) are coming in future updates.
