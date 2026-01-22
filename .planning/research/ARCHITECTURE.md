# Architecture Patterns

**Domain:** Claude Code browser-automation skill for website auditing
**Researched:** 2026-01-22
**Confidence:** HIGH (verified against official Claude Code skill conventions and established crawler patterns)

## The Unique Challenge: Architecture in Markdown

This is not a traditional software architecture document. The site-audit "system" is a set of markdown instructions (SKILL.md) that guide Claude's behavior. There is no compiled code, no runtime, no persistent state store. The "architecture" is how we structure instructions so that Claude reliably executes a multi-step crawl loop, accumulates findings, and produces a report.

**Key constraint:** Claude's context window IS the runtime. State lives in the conversation history. The skill instructions must be structured so that Claude naturally maintains crawl state (visited set, queue, findings) across many tool-call iterations without losing coherence.

This means our architecture must address:
1. How to instruct Claude to maintain an explicit mental model of crawl state
2. How to structure the crawl loop as a repeatable instruction pattern
3. How to accumulate findings without polluting context
4. How to trigger report generation at the right time

---

## Recommended Architecture

### High-Level Flow

```
User invokes /site-audit <URL>
        |
        v
+------------------+
| 1. INITIALIZATION|  Parse URL, set up state variables
+------------------+
        |
        v
+------------------+
| 2. CRAWL LOOP    |  BFS: dequeue URL -> navigate -> analyze -> enqueue links
+------------------+
        |  (repeats until queue empty or limit reached)
        v
+------------------+
| 3. EXTERNAL CHECK|  Verify external links via WebFetch
+------------------+
        |
        v
+------------------+
| 4. REPORT GEN    |  Compile findings -> write markdown file
+------------------+
        |
        v
Report file written to disk
```

### Component Boundaries

| Component | Responsibility | MCP Tools Used | Outputs |
|-----------|---------------|----------------|---------|
| **Initializer** | Parse seed URL, extract domain, initialize state | None (reasoning) | Domain, seed URL, empty state |
| **Crawl Controller** | Manage BFS queue, visited set, loop termination | None (reasoning) | Next URL to visit |
| **Page Navigator** | Navigate to URL, wait for load | `navigate` | Page loaded in browser |
| **Link Extractor** | Find all links on page, classify same-domain vs external | `read_page`, `javascript_tool` | Link lists |
| **Page Analyzer** | Run all checks on current page | `get_page_text`, `read_console_messages`, `read_page`, `read_network_requests` | Page findings |
| **External Verifier** | Check external URLs respond | `WebFetch` | Dead link findings |
| **Report Generator** | Compile all findings into structured markdown | `Write` | Report file |

---

## Component Details

### 1. Initializer

**What it does:** Takes the user-provided URL, extracts the domain for same-origin filtering, and establishes the initial state structure.

**State initialized:**
```
- Seed URL: [user-provided URL]
- Domain: [extracted from seed URL]
- Queue: [seed URL]
- Visited: [] (empty set)
- Findings: {
    broken_links: [],
    spelling_issues: [],
    console_errors: [],
    visual_issues: [],
    external_links_dead: []
  }
- Page count: 0
- Max pages: [configurable, default 50]
```

**Critical instruction:** The skill must tell Claude to explicitly state this structure at the start so it becomes part of the conversation context. This is the "state declaration" pattern -- by writing it out, Claude anchors to it.

### 2. Crawl Controller (BFS Loop)

**What it does:** Implements breadth-first search over the site. Each iteration: picks next URL from queue, checks if visited, delegates to Navigator and Analyzer, then updates state.

**The Loop Pattern in Skill Instructions:**

The skill must instruct Claude to follow a repeatable cycle. The recommended pattern is an explicit numbered protocol:

```
CRAWL CYCLE (repeat until queue is empty or page limit reached):
  1. Check termination: Is queue empty? Is page count >= max?
     -> YES: Proceed to External Verification phase
     -> NO: Continue
  2. Dequeue next URL from queue
  3. Check: Is this URL in visited set?
     -> YES: Skip, go to step 1
     -> NO: Continue
  4. Add URL to visited set, increment page count
  5. Navigate to URL
  6. Run Page Analysis (all checks)
  7. Extract links from page
  8. For each link:
     - Normalize URL (remove fragments, trailing slashes)
     - If same-domain AND not in visited: add to queue
     - If external: add to external_links list
  9. Report current state: "Visited X pages, Y in queue, Z findings so far"
  10. Go to step 1
```

**Why BFS over DFS:** BFS ensures coverage breadth. For a website audit, visiting the homepage, then all pages linked from homepage, then their children, gives better coverage of important pages first. DFS risks going deep into pagination or archive paths before covering main content.

**URL Normalization Rules (must be in skill):**
- Remove fragment identifiers (#section)
- Remove trailing slashes for consistency
- Resolve relative URLs to absolute
- Treat http:// and https:// as same (prefer https)
- Ignore query parameters for mailto:, tel:, javascript: links
- Skip asset URLs (.pdf, .jpg, .png, .css, .js) -- these are not pages to crawl

### 3. Page Navigator

**What it does:** Uses `mcp__claude-in-chrome__navigate` to load a URL in the browser tab.

**Considerations:**
- Wait for page load (the MCP tool handles this)
- Handle navigation failures (timeout, error page) -- record as finding, do not crash the loop
- The browser must be visible (Chrome MCP requirement -- no headless mode)

### 4. Link Extractor

**What it does:** Extracts all hyperlinks from the current page and classifies them.

**Recommended approach:** Use `mcp__claude-in-chrome__javascript_tool` to run a DOM query:

```javascript
// Extract all links with href attributes
Array.from(document.querySelectorAll('a[href]')).map(a => ({
  href: a.href,
  text: a.textContent.trim().substring(0, 100)
}))
```

This is more reliable than parsing the accessibility tree for links, because:
- It gets the resolved absolute URL (browser handles relative resolution)
- It captures all anchor elements regardless of ARIA role
- It returns clean structured data

**Classification logic (in Claude's reasoning):**
- Same domain = URL hostname matches seed domain -> add to crawl queue
- External = different hostname -> add to external links list for later verification
- Skip = mailto:, tel:, javascript:, # (fragment-only)

### 5. Page Analyzer

**What it does:** Runs all quality checks on the currently loaded page. This is the core value component.

**Sub-checks (run in sequence on each page):**

| Check | Tool Used | What It Finds |
|-------|-----------|---------------|
| Console Errors | `read_console_messages` | JavaScript errors, warnings, failed loads |
| Spelling/Grammar | `get_page_text` + Claude reasoning | Typos, grammar issues in visible text |
| Broken Images | `read_network_requests` or `javascript_tool` | Images that failed to load (404, error) |
| Visual Issues | `read_page` (accessibility tree) | Missing alt text, empty links, form issues |

**Spelling Analysis Approach:**

Claude reads the extracted page text and uses its language understanding to identify likely typos and grammar issues. The skill should instruct:
- Focus on body content, not navigation/footer boilerplate
- Ignore code blocks, URLs, and technical identifiers
- Flag words that appear misspelled with suggested corrections
- Note grammar issues only if clearly wrong (not style preferences)
- Skip common brand names and technical terms

**Console Error Filtering:**

Not all console messages are problems. The skill should instruct Claude to:
- Report ERROR level messages always
- Report WARNING level only if they indicate broken functionality
- Ignore INFO/DEBUG level messages
- Ignore third-party script errors (analytics, ads) unless they indicate site breakage

### 6. External Link Verifier

**What it does:** After crawling is complete, checks that external links actually respond.

**Approach:** Use `WebFetch` for each unique external URL. Check if it returns content or errors.

**Important constraints:**
- Deduplicate external URLs first (same link may appear on multiple pages)
- Do NOT crawl external sites -- only verify they respond
- Rate limiting: sequential requests are natural throttling
- Some sites block automated requests -- a non-response does not definitively mean "dead"
- Record: URL, pages it appeared on, response status (ok/error/timeout)

**Batch strategy:** Group external links and verify them after the crawl loop completes. This avoids context-switching between crawling and verifying on each page.

### 7. Report Generator

**What it does:** Compiles all accumulated findings into a structured markdown report and writes it to disk.

**Report structure:**

```markdown
# Site Audit Report: [domain]

**Audited:** [date]
**Pages crawled:** [count]
**Total findings:** [count]

## Summary

| Category | Count | Severity |
|----------|-------|----------|
| Broken Links | X | High |
| Console Errors | X | High |
| Spelling Issues | X | Medium |
| Visual Issues | X | Medium |
| Dead External Links | X | Low |

## Broken Links
[For each: source page, link URL, status]

## Console Errors
[For each: page URL, error message, severity]

## Spelling Issues
[For each: page URL, word, suggestion, surrounding context]

## Visual Issues
[For each: page URL, issue description, element]

## Dead External Links
[For each: URL, pages it appears on, error]

## Pages Crawled
[List of all visited URLs]
```

**File naming:** `site-audit-[domain]-[date].md` written to current working directory.

---

## Data Flow: How Findings Accumulate

This is the critical architectural challenge. Claude's context window is the only "database." Findings must accumulate without overwhelming context.

### Strategy: Periodic State Summaries

Rather than carrying every raw finding in working memory, the skill instructs Claude to:

1. **After each page analysis:** Append findings to a running summary in a structured format
2. **Every 5 pages:** Write a brief state checkpoint ("Crawled 5/50 pages, 3 broken links found, 12 in queue")
3. **At end of crawl:** Compile the full report from accumulated findings

### The Context Pollution Problem

Each tool call (read_page, get_page_text, etc.) dumps potentially large content into context. The skill must instruct Claude to:
- Extract only relevant findings from tool results
- Do NOT carry raw page text forward -- summarize to findings immediately
- Keep the running findings list compact (URL + issue, not full page content)

### Recommended State Tracking Format

The skill instructs Claude to maintain state in this format throughout the crawl:

```
## Current Crawl State
- Queue: [list of pending URLs]
- Visited: [count] pages
- Findings so far: [count] broken links, [count] spelling, [count] console, [count] visual

## Accumulated Findings
### Broken Links
- [page] -> [dead URL]
...

### Console Errors
- [page]: [error summary]
...
```

This "state block" gets restated periodically to anchor Claude's working memory.

---

## Patterns to Follow

### Pattern 1: Explicit State Declaration

**What:** Instruct Claude to explicitly write out its current state at defined intervals.
**When:** Every crawl cycle iteration (abbreviated) and every 5 pages (full).
**Why:** Without explicit state declaration, Claude may "forget" URLs in the queue or findings from earlier pages as context grows. By restating state, it remains in active context.

**Example in SKILL.md:**
```markdown
After analyzing each page, state your current crawl status:
"Page [N]: [URL] - Found [X] issues. Queue: [Y] remaining. Total findings: [Z]."
```

### Pattern 2: Separation of Crawl and Verify Phases

**What:** Complete all same-domain crawling before verifying external links.
**When:** Always.
**Why:** Mixing crawl and verify creates context switching overhead. External verification is a simpler batch operation that benefits from deduplication (same external link on many pages = one check).

### Pattern 3: Fail-Safe Loop Termination

**What:** Multiple termination conditions prevent infinite crawling.
**When:** Every loop iteration.
**Why:** Websites can have effectively infinite pages (pagination, search results, calendars). The skill must enforce:
- Maximum page count (default: 50)
- Queue empty (natural termination)
- Same URL patterns repeating (detection of infinite pagination)

**Example:**
```markdown
STOP CRAWLING if any of these are true:
1. You have visited [max_pages] pages
2. The queue is empty
3. You notice URLs following a repetitive pattern (e.g., /page/1, /page/2, /page/3...)
   that suggests infinite pagination -- stop after 3 such pages
```

### Pattern 4: Progressive Disclosure via Linked Files

**What:** Keep SKILL.md focused on the crawl loop and high-level flow. Move detailed reference material (URL normalization rules, report template, check-specific instructions) to linked files.
**When:** Skill exceeds 300 lines.
**Why:** Claude's progressive disclosure architecture loads linked files only when needed. The crawl controller does not need the full report template in context; it loads that file only at report generation time.

**Suggested file structure:**
```
skills/site-audit/
  SKILL.md              -- Main crawl loop instructions (< 500 lines)
  references/
    CHECKS.md           -- Detailed per-check instructions
    REPORT_TEMPLATE.md  -- Report format specification
    URL_RULES.md        -- URL normalization and filtering rules
```

### Pattern 5: Graceful Degradation on Tool Failure

**What:** If a tool call fails (navigation timeout, console read fails), record the failure as a finding and continue.
**When:** Any tool call in the crawl loop.
**Why:** A single page failure should not abort the entire audit. The skill must instruct:
```markdown
If navigation to a URL fails:
- Record it as a finding: "Could not load: [URL] - [error]"
- Remove from queue, add to visited
- Continue to next URL in queue
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Attempting to "Store" State Outside Context

**What:** Trying to write crawl state to a file and re-read it each iteration.
**Why bad:** This adds tool-call overhead (Write + Read each iteration), pollutes context with file operations, and is slower than simply maintaining state in conversation. The context window IS the state store for this use case.
**Instead:** Maintain state as part of Claude's ongoing reasoning. Restate key state elements periodically.

### Anti-Pattern 2: Analyzing Everything at Once

**What:** Trying to load all page content, then do all analysis in one pass.
**Why bad:** A single page's full text + accessibility tree + console + network can be 10K+ tokens. Loading all at once wastes context on raw data.
**Instead:** Run checks sequentially, extracting only findings from each before moving to the next check.

### Anti-Pattern 3: DFS Crawling

**What:** Following links depth-first (go deep before going wide).
**Why bad:** DFS can get trapped in deep pagination, archive pages, or tag clouds before visiting important top-level pages. For an audit, breadth gives better coverage of the important parts of a site.
**Instead:** BFS via queue (FIFO ordering of discovered links).

### Anti-Pattern 4: No Page Limit

**What:** Crawling until the queue is empty with no maximum.
**Why bad:** Large sites can have thousands of pages. Claude's context window will overflow, the audit will take hours, and findings become unmanageable.
**Instead:** Default limit of 50 pages. User can override with a parameter.

### Anti-Pattern 5: Checking External Links During Crawl

**What:** Verifying each external link immediately when discovered during page analysis.
**Why bad:** External verification is slow (network requests) and interrupts the crawl flow. Same external link may appear on 20 pages -- checking it 20 times wastes time.
**Instead:** Collect unique external URLs during crawl, verify in batch after crawl completes.

### Anti-Pattern 6: Overly Granular Skill Instructions

**What:** Writing the SKILL.md as pseudo-code with if/else branches for every edge case.
**Why bad:** Claude is a language model, not a code interpreter. Overly granular instructions fight against Claude's natural reasoning. The skill becomes rigid and brittle.
**Instead:** Write at the level of clear intent with key constraints. Trust Claude to handle routine decisions (like URL parsing) while constraining the important ones (like loop termination).

---

## Skill File Architecture

### Directory Structure

```
plugins/site-audit/
  .claude-plugin/
    plugin.json                 -- Plugin metadata
  commands/
    site-audit.md               -- Slash command entry point
  skills/
    site-audit/
      SKILL.md                  -- Main crawl loop + orchestration
      references/
        CHECKS.md               -- Detailed analysis instructions per check type
        REPORT_TEMPLATE.md      -- Report output format
        URL_RULES.md            -- URL normalization, filtering, classification
```

### SKILL.md Structure (Recommended Sections)

```markdown
---
name: site-audit
description: Crawls a website and produces a comprehensive audit report covering
  broken links, spelling errors, console errors, and visual issues. Use when the
  user asks to audit, check, or scan a website for quality issues.
disable-model-invocation: true
---

# Website Audit Skill

## Prerequisites
[Chrome MCP tools required, browser must be visible]

## Input
[URL parameter, optional max_pages parameter]

## Phase 1: Initialization
[Domain extraction, state setup]

## Phase 2: Crawl Loop
[BFS algorithm, per-page analysis, state tracking]

## Phase 3: External Link Verification
[Batch WebFetch checks]

## Phase 4: Report Generation
[Read REPORT_TEMPLATE.md, compile findings, write file]
```

### Command Entry Point (site-audit.md)

```markdown
---
name: site-audit
description: Audit a website for broken links, spelling errors, console errors,
  and visual issues
---

Execute the site-audit skill to crawl and audit the provided website URL.
```

---

## Build Order (Dependencies)

The following build order respects component dependencies:

| Phase | Component | Depends On | Rationale |
|-------|-----------|------------|-----------|
| 1 | Plugin scaffold + command | Nothing | Establishes project structure |
| 2 | Initialization + URL rules | Plugin scaffold | Must parse URLs before crawling |
| 3 | Navigation + link extraction | Initialization | Core crawl mechanics |
| 4 | Crawl loop (BFS) | Navigation, link extraction | Orchestrates the above |
| 5 | Page analysis checks | Crawl loop | Runs within each iteration |
| 6 | External link verification | Crawl loop (needs collected links) | Post-crawl batch operation |
| 7 | Report generation | All above (needs findings) | Final compilation step |

**Phase 1-2** can be validated without a browser (just test URL parsing logic in the instructions).
**Phase 3-4** require Chrome MCP but can be tested with a simple 2-3 page site.
**Phase 5** adds analysis depth -- each check type can be added incrementally.
**Phase 6-7** are the output stages and can be developed once crawling works.

---

## Scalability Considerations

| Concern | Small site (5 pages) | Medium site (50 pages) | Large site (200+ pages) |
|---------|---------------------|----------------------|------------------------|
| Context window | Comfortable | Needs periodic state summaries | May need page limit or chunked runs |
| Crawl time | < 5 minutes | 15-30 minutes | May exceed session limits |
| Findings volume | Easily fits in report | Needs categorization | Needs severity filtering |
| External links | Few, fast to verify | Dozens, manageable | Hundreds, needs dedup + batching |

**Recommendation:** Default page limit of 50 with user override. For sites > 50 pages, the skill should inform the user and suggest increasing the limit or focusing on specific sections.

---

## Context Window Budget Estimation

Rough token budget per crawl cycle iteration:

| Operation | Estimated Tokens | Notes |
|-----------|-----------------|-------|
| Navigation tool call | ~100 | URL + response |
| read_page result | ~2000-5000 | Accessibility tree varies by page complexity |
| get_page_text result | ~1000-3000 | Depends on page content length |
| read_console_messages | ~200-500 | Usually short |
| javascript_tool (links) | ~500-2000 | Depends on number of links |
| Claude's reasoning | ~300-500 | State update, findings extraction |
| **Total per page** | **~4000-11000** | Average ~7000 tokens |

For 50 pages: ~350K tokens of tool results accumulating in context. This is within Claude's context window (200K) only if we are disciplined about not carrying raw results forward. The skill MUST instruct Claude to summarize findings immediately and not retain raw page content.

**Mitigation:** The periodic state summary pattern keeps only structured findings in active context, while raw tool results scroll out of the attention window naturally.

---

## Sources

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) - Official skill structure and conventions (HIGH confidence)
- [Claude Code Chrome Integration](https://code.claude.com/docs/en/chrome) - MCP tool availability and requirements (HIGH confidence)
- [Claude Agent Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) - Progressive disclosure architecture (MEDIUM confidence)
- [Inside Claude Code Skills](https://mikhail.io/2025/10/claude-code-skills/) - Skill invocation mechanics (MEDIUM confidence)
- [Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) - Official best practices (HIGH confidence)
- [The Canonical Agent Loop](https://www.braintrust.dev/blog/agent-while-loop) - While-loop agent architecture pattern (MEDIUM confidence)
- [Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) - Anthropic's context management strategies (HIGH confidence)
- [Task Memory Engine (TME)](https://arxiv.org/html/2504.08525v1) - Structured state tracking for multi-step LLM tasks (MEDIUM confidence)
- [BFS Web Crawler Pattern](https://www.geeksforgeeks.org/python/web-crawling-using-breadth-first-search-at-a-specified-depth/) - Standard crawler architecture (HIGH confidence)
- [Firecrawl Claude Code Skill](https://www.firecrawl.dev/blog/claude-code-skill) - Real-world crawling skill example (MEDIUM confidence)
