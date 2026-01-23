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
3. Create `.audit-data/` directory in current working directory for storing findings
4. Reference @references/URL_RULES.md for URL normalization rules
5. Display initialization summary to user:
   - Seed URL (normalized)
   - Domain to crawl
   - Max pages limit
   - Ask user to confirm before starting crawl

**Crawl Loop:**

Execute the following steps in order, looping until termination:

1. **Termination check** — If queue is empty OR page_count >= max_pages, exit loop and proceed to Phase 3

2. **Dequeue** — Remove first URL from queue front (FIFO / breadth-first)

3. **Duplicate check** — If URL already in visited set, skip to step 1 (continue loop)

4. **Mark visited** — Add current URL to visited set, increment page_count

5. **Fetch page** — Use WebFetch with this exact prompt:
   ```
   Extract all links from this page. Return ONLY a markdown list in [text](url) format.
   Include every <a href="...">, <link href="...">, and <area href="..."> element.
   Example output:
   [Homepage](/)
   [About](/about)
   [Contact](https://example.com/contact)
   ```

6. **Parse links** — Extract URLs from WebFetch response using pattern `[text](url)`. Parse each line looking for markdown link format.

7. **Normalize URLs** — For each extracted URL:
   - Resolve relative URLs to absolute using current page URL as base
   - Apply all 7 normalization rules from @references/URL_RULES.md in order
   - Result: canonical absolute URL

8. **Classify and route** — For each normalized URL:
   - **Skip check:** If URL matches any skip rule (mailto:, .pdf, .jpg, etc. per URL_RULES.md), discard it
   - **Same-domain check:** Extract hostname, compare with seed_hostname using strict matching (www. is significant)
   - **If same-domain:** Add to queue (if not already in visited set)
   - **If external:** Add to external_links list with source page reference
   - **If skip:** Discard (don't crawl, don't record)

9. **State update** — After processing each page, output:
   ```
   Page [page_count]/[max_pages]: [current_url]
   Queue: [queue_length] URLs remaining
   ```

10. **Detailed state** — Every 5 pages (when page_count % 5 == 0), also output:
    ```
    Visited: [visited_count] pages
    External links found: [external_links_count]
    Next in queue: [first 3 URLs from queue, or "empty"]
    ```

11. **Loop back** — Return to step 1 (termination check)

**After crawl completion:**

- Report total pages crawled
- Report queue status (exhausted or hit page limit)
- Report external links count
- Proceed to Phase 3

**Notes:**
- Normalize URLs BEFORE adding to queue or visited set (prevents duplicates like `/page` and `/page/`)
- WebFetch handles fetch errors gracefully — if page fails to load, log error and continue
- Store external_links for future dead link verification (not implemented yet in Phase 2)
- HTTPS preference rule (rule 7): If you encounter both http:// and https:// versions, only queue the https:// version

**Phase 3: Content Analysis** (to be implemented)
- Placeholder: Report that content analysis is not yet implemented
- Target: Dead link detection and AI-powered spelling check

**Phase 4: UI Checks** (to be implemented)
- Placeholder: Report that UI checks are not yet implemented
- Target: Chrome-based console error and visual issue detection

**Phase 5: Report** (to be implemented)
- Placeholder: Report that report generation is not yet implemented
- Target: Structured markdown report with findings by page and by type

## Current Status

Phases 1-2 are implemented. After validating the URL, the skill will:
1. Confirm the target domain
2. Initialize crawl state with BFS queue
3. Crawl up to 50 same-domain pages using WebFetch
4. Track external links for future verification
5. Report crawl completion

Content analysis (Phase 3), UI checks (Phase 4), and final report (Phase 5) are coming in future updates.
