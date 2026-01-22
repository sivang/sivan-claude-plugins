# Domain Pitfalls

**Domain:** Browser-based website audit crawler as a Claude Code skill
**Researched:** 2026-01-22
**Confidence:** HIGH (verified against official Claude Code docs, crawler literature, and MCP architecture)

---

## Critical Pitfalls

Mistakes that cause infinite loops, lost work, or fundamentally broken output.

---

### Pitfall 1: Infinite Crawl Loops from URL Normalization Failures

**What goes wrong:** The crawler visits the same page repeatedly because URLs differ in trivial ways: trailing slashes (`/about` vs `/about/`), query parameters (`?utm_source=x`), fragments (`#section`), protocol (`http` vs `https`), case (`/About` vs `/about`), `www` prefix (`www.site.com` vs `site.com`), and session IDs embedded in paths.

**Why it happens:** URLs are strings, but pages are resources. Many string-different URLs resolve to identical content. Without normalization, the visited-set never matches, so every variation looks "new."

**Consequences:** Claude burns all available tool calls navigating the same pages endlessly. Context window fills with duplicate findings. The audit never completes.

**Prevention:**
1. Normalize ALL URLs before adding to visited-set or queue:
   - Strip fragments (`#anything`)
   - Remove known tracking params (`utm_*`, `fbclid`, `gclid`, `ref`, `source`)
   - Normalize trailing slashes (pick one convention, strip or add consistently)
   - Lowercase the hostname and scheme
   - Treat `www.domain.com` and `domain.com` as equivalent
   - Resolve relative URLs to absolute before comparison
   - Remove default ports (`:80`, `:443`)
   - Sort remaining query parameters alphabetically
2. Implement a hard cap on total pages visited (e.g., 50 pages max by default)
3. Detect repeating path patterns (e.g., `/page/1/page/1/page/1/...`) and abort

**Detection (warning signs):**
- More than 3 URLs with identical path but different query strings
- URL depth exceeding 5 path segments
- Same page title appearing in findings multiple times
- Tool call count growing without new unique URLs being added to findings

**Phase to address:** Phase 1 (core crawl engine) -- this must be solved before any other features work.

**Confidence:** HIGH -- this is the single most documented crawler failure mode across all sources.

---

### Pitfall 2: Context Window Exhaustion During Large Crawls

**What goes wrong:** Claude's 200K token context window fills up before the crawl completes. Each page visit generates tool call output (page text, console logs, link lists). After 20-40 pages, auto-compaction triggers and earlier findings are summarized away, losing detail. The final report is incomplete or fabricated from compressed memory.

**Why it happens:** Claude Code auto-compacts at ~80-95% context usage. MCP tool definitions alone consume 16%+ of the window. Each page's extracted text could be 1,000-5,000 tokens. Console logs, link lists, and intermediate reasoning add up fast. A 50-page crawl could easily generate 100K+ tokens of raw tool output.

**Consequences:**
- Early findings lost during compaction (first pages audited disappear from memory)
- Report confabulates details Claude no longer has in context
- Crawl aborts mid-way with no useful output
- Claude loses track of which pages were visited vs. queued

**Prevention:**
1. **Write findings incrementally to a file** -- after each page, append findings to a running report file on disk. Never rely on context alone for state.
2. **Maintain a visited-URLs file** -- write the visited set to disk, read it back when needed. The context should reference the file, not hold all URLs.
3. **Limit page text extraction** -- only extract visible body text, skip navigation, headers, footers, and scripts. Cap extracted text to first N characters.
4. **Batch processing** -- audit in batches of 10-15 pages, write intermediate results, then continue. This keeps any single context trajectory manageable.
5. **Compact findings format** -- store findings as terse structured data (URL + issue type + excerpt), not full page text.

**Detection:**
- Claude starts referencing "earlier pages" vaguely instead of specifically
- The `/context` command shows >70% usage before crawl is half done
- Auto-compaction messages appear in the conversation

**Phase to address:** Phase 1 (core architecture decision) -- the "write to disk" pattern must be baked in from the start, not bolted on later.

**Confidence:** HIGH -- verified against Claude Code's documented auto-compaction behavior and MCP output limits (25K token max per tool call, warning at 10K).

---

### Pitfall 3: Skill Instructions Too Complex for Reliable Execution

**What goes wrong:** The SKILL.md file contains a multi-phase crawl algorithm with conditionals, state management, error handling, and reporting logic. Claude interprets these instructions but drifts from them over long execution -- skipping steps, reordering phases, or inventing its own approach.

**Why it happens:** Skills are injected instructions, not executable code. Claude follows them probabilistically, not deterministically. As context grows and compaction occurs, the original instructions may be summarized or partially lost. Complex branching logic ("if page has forms, do X; if page has tables, do Y; if external link, do Z") compounds this drift.

**Consequences:**
- Inconsistent behavior between runs (non-reproducible audits)
- Steps silently skipped (e.g., console error checking forgotten after page 15)
- Claude invents new behaviors not in the skill (e.g., trying to fix spelling errors)
- State management logic breaks down (forgets to update visited-set file)

**Prevention:**
1. **Keep instructions linear and simple** -- avoid complex conditionals. One clear loop: visit page, extract text, check links, record findings, pick next URL.
2. **Use a "checklist per page" format** -- for each page, always do these 5 things in this order. Repetitive structure resists drift.
3. **Externalize complex logic** -- put URL normalization rules, ignore-lists, and report templates in separate files Claude reads, not inline in SKILL.md.
4. **Include "anchor phrases"** that Claude can check itself against -- e.g., "Before moving to the next page, confirm: Have I written findings to the report file? Have I updated the visited-URLs file?"
5. **Limit skill scope** -- the skill should orchestrate, not contain all domain knowledge. Keep SKILL.md under 200 lines.

**Detection:**
- Audit runs produce different results on the same site
- Claude asks "should I also check X?" for things already in the instructions
- Report is missing entire categories of findings (e.g., no console errors reported)

**Phase to address:** Phase 1 (skill design) -- the instruction architecture must be validated early with small crawls before scaling up.

**Confidence:** HIGH -- verified against official Claude Code skill authoring best practices which explicitly warn about instruction complexity and context bloat.

---

### Pitfall 4: Browser Tab State Desynchronization

**What goes wrong:** Claude navigates to a URL but the page hasn't finished loading (SPA hydration, AJAX calls, lazy-loaded content). Claude reads the page text and gets incomplete content, navigation-only shells, or loading spinners. Alternatively, a modal dialog, cookie consent banner, or CAPTCHA blocks interaction.

**Why it happens:** Claude-in-Chrome operates on visible browser tabs in real-time. There is no built-in "wait for page fully loaded" semantic beyond what the MCP tools provide. SPAs may show content shells immediately but load actual text asynchronously. Modals (cookie consent, newsletter popups, age gates) overlay the real content.

**Consequences:**
- Spelling check runs on incomplete text (misses errors or flags partial words)
- Links extracted from incomplete DOM miss dynamically-loaded navigation
- Console errors captured before page settles include transient loading errors
- Claude gets stuck waiting for user intervention on modals

**Prevention:**
1. **Wait after navigation** -- instruct Claude to wait 2-3 seconds after navigating before reading page content. This handles most AJAX hydration.
2. **Verify content presence** -- after reading page text, check if it's suspiciously short (< 100 characters) or contains only navigation elements. If so, wait and retry once.
3. **Dismiss common overlays first** -- instruct Claude to look for and dismiss cookie consent banners before reading content. Provide common selectors/patterns.
4. **Accept partial content gracefully** -- if a page consistently returns minimal text after retries, record it as "dynamic content - could not fully extract" rather than reporting false findings.
5. **Handle modal dialogs in instructions** -- Claude-in-Chrome docs note that modal dialogs block automation. Include explicit instructions: "If a dialog appears, dismiss it and retry."

**Detection:**
- Multiple pages returning identical short text (likely just the nav/header shell)
- Page text contains "Loading..." or spinner-like content
- Claude reports being unable to interact with the page

**Phase to address:** Phase 2 (robustness) -- basic crawling works without this, but real-world sites will trigger these issues frequently.

**Confidence:** HIGH -- verified against official Claude-in-Chrome documentation which explicitly documents modal dialog blocking and the visible-browser requirement.

---

## Moderate Pitfalls

Mistakes that cause inaccurate results, wasted effort, or poor user experience.

---

### Pitfall 5: Spelling Detection False Positives Overwhelming Real Issues

**What goes wrong:** Claude flags brand names ("Vite", "Astro", "Vercel"), technical terms ("localhost", "npm", "middleware"), abbreviations ("API", "URL", "SSR"), code snippets in documentation, navigation menu items, and proper nouns as spelling errors. The report is 80% noise, burying real typos.

**Why it happens:** Claude's language model doesn't have a dictionary of "valid words" -- it uses probabilistic judgment. Technical content, especially developer-facing sites, contains many words that look like misspellings to a general-purpose language model. Code blocks, variable names, and CLI commands are particularly problematic.

**Consequences:**
- User loses trust in the audit report immediately
- Real spelling errors hidden among dozens of false positives
- User must manually review every "error" -- defeating the automation purpose
- Repeated false positives across pages (brand name in footer flagged on every page)

**Prevention:**
1. **Provide explicit ignore categories** in instructions:
   - Skip content inside `<code>`, `<pre>`, `<kbd>`, `<samp>` elements
   - Ignore words that are ALL_CAPS (likely acronyms/constants)
   - Ignore words containing special characters (`camelCase`, `kebab-case`, `snake_case`)
   - Ignore single-character "words"
   - Ignore URLs and email addresses within text
2. **Domain-aware context** -- instruct Claude: "This is a [technology/business] website. Terms like [X, Y, Z] are valid."
3. **Confidence threshold** -- only report words Claude is HIGHLY confident are misspelled. "Possible" issues should be in a separate low-priority section.
4. **Deduplicate across pages** -- if the same "error" appears on 10 pages (footer text), report it once with "appears on N pages" not N separate findings.
5. **Provide the sentence context** -- show the word in its surrounding sentence so the user can judge quickly.

**Detection:**
- More than 10 spelling findings on a well-maintained professional site
- Same word flagged on multiple pages (likely a navigation element or brand name)
- Flagged words containing hyphens, dots, or mixed case

**Phase to address:** Phase 2 (spelling accuracy) -- get basic crawling working first, then tune spelling precision.

**Confidence:** HIGH -- this is the most-documented failure mode of automated spell checkers, confirmed by Silktide, Screaming Frog, and SortSite documentation.

---

### Pitfall 6: External Link Checking Triggers Rate Limiting or Blocks

**What goes wrong:** The audit checks dozens of external links by fetching them. External servers rate-limit or block the requests, returning 429 (Too Many Requests), CAPTCHA pages, or connection resets. These get falsely reported as "dead links."

**Why it happens:** Multiple rapid requests from a single IP to the same external domain triggers anti-bot protections. Many sites (GitHub, Twitter/X, LinkedIn) aggressively rate-limit automated requests. Cloudflare, DataDome, and similar WAFs detect bot patterns.

**Consequences:**
- False "broken link" reports for perfectly valid URLs
- External sites temporarily ban the user's IP
- Claude wastes tool calls retrying blocked URLs
- Report credibility undermined by obvious false positives (e.g., reporting google.com as broken)

**Prevention:**
1. **HEAD requests first** -- use lightweight HEAD requests (via WebFetch) rather than full page loads for external link verification.
2. **Per-domain rate limiting** -- never check more than 2-3 links to the same external domain in quick succession. Group by domain, spread checks out.
3. **Accept 2xx and 3xx as "alive"** -- don't follow redirects fully, just confirm the first response is not 4xx/5xx.
4. **Known-good allowlist** -- never report `google.com`, `github.com`, `twitter.com`, major CDNs, etc. as broken. If they return errors, it's rate limiting, not a dead link.
5. **Timeout handling** -- set a reasonable timeout (5-10 seconds). If a link times out, report it as "timeout - may be rate limited" not "broken."
6. **Sequential checking** -- check external links one at a time with delays, not in parallel bursts.
7. **Limit scope** -- check unique external domains only, not every link. If `github.com/org/repo` appears 20 times, check it once.

**Detection:**
- Multiple links to the same domain all "failing" simultaneously
- Well-known domains reported as broken
- 429 status codes in responses

**Phase to address:** Phase 2 (link verification robustness) -- basic "does it 404?" works immediately, but handling rate limits needs refinement.

**Confidence:** HIGH -- rate limiting is extensively documented in web scraping literature and is the default behavior of Cloudflare-protected sites.

---

### Pitfall 7: Same-Domain Scope Boundary Confusion

**What goes wrong:** The crawler either escapes its intended scope (following links to subdomains, protocol-different versions, or CDN-hosted assets) or is too restrictive (missing valid pages on `www.` vs bare domain, or `https` vs `http` redirects).

**Why it happens:** "Same domain" is ambiguous. Is `blog.example.com` same-domain as `example.com`? Is `http://example.com` same as `https://example.com`? What about `cdn.example.com` or `docs.example.com`? The seed URL's format determines scope, but sites often mix these freely in their internal links.

**Consequences:**
- Crawl escapes to subdomains (blog, docs, shop) and audits content the user didn't intend
- Crawl misses pages because canonical domain differs from seed URL format
- Pages on `www.` variant not crawled when seed was bare domain (or vice versa)
- CDN-hosted pages (images, PDFs) treated as same-domain and visited uselessly

**Prevention:**
1. **Explicit scope definition** -- extract the hostname from the seed URL and use it as the boundary. Treat `www.` and bare domain as equivalent.
2. **Protocol-agnostic matching** -- `http://` and `https://` versions of the same hostname are the same scope.
3. **Subdomain exclusion by default** -- do NOT follow links to different subdomains unless explicitly configured. `blog.example.com` is out of scope if seed was `example.com`.
4. **Asset filtering** -- skip links that resolve to non-HTML resources (`.pdf`, `.jpg`, `.png`, `.zip`, `.css`, `.js`). These are not "pages" to audit.
5. **Clear scope reporting** -- the first line of the audit report should state: "Scope: all pages on [hostname], starting from [seed URL]. Subdomains excluded."

**Detection:**
- Crawler visiting URLs with different hostnames than the seed
- Pages with non-HTML content types being "audited"
- Unexpectedly large crawl queue for a small site

**Phase to address:** Phase 1 (scope definition) -- must be correct before crawling begins.

**Confidence:** HIGH -- every crawler tool (Ahrefs, Lumar, Screaming Frog, Archive-It) documents this as a configuration requirement, and the `www` edge case is specifically called out.

---

### Pitfall 8: Repeated Content Inflating Findings (Headers, Footers, Navigation)

**What goes wrong:** Every page on a site shares the same header, footer, navigation, and sidebar. Spelling errors, broken links, or issues in these shared elements get reported N times (once per page), making the report noisy and inflated.

**Why it happens:** When Claude reads full page text, it gets everything including navigation menus, footers, copyright notices, and sidebars. These are identical across pages. If a navigation link is broken or a footer has a typo, every single page "has" that issue.

**Consequences:**
- A single footer typo generates 50 findings in a 50-page audit
- Report looks overwhelming (100+ issues) when the reality is 5 unique issues
- User cannot distinguish "one typo on every page" from "50 different typos"
- Context window wasted on redundant findings

**Prevention:**
1. **Deduplicate by issue text** -- if the same misspelled word or broken link URL appears on multiple pages, consolidate into one finding with a page count.
2. **Template detection** -- after the first 3-5 pages, identify repeated text blocks (likely templates) and skip them on subsequent pages. Only audit unique/body content.
3. **Focus on main content** -- instruct Claude to prioritize text within `<main>`, `<article>`, or the primary content area, deprioritizing `<nav>`, `<header>`, `<footer>`, `<aside>`.
4. **Report structure** -- separate "site-wide issues" (found on >50% of pages) from "page-specific issues" in the final report.

**Detection:**
- Same finding text appearing for many different page URLs
- Findings that reference navigation or footer text
- Issue count disproportionate to site size

**Phase to address:** Phase 2 (report quality) -- basic crawl can work without this, but the report will be noisy.

**Confidence:** MEDIUM -- this is a known pattern in website auditing tools (Screaming Frog, SortSite document it), though the specific Claude behavior is inferred.

---

## Minor Pitfalls

Mistakes that cause annoyance or edge-case failures but are fixable.

---

### Pitfall 9: Login-Required or Gated Pages Blocking Crawl Progress

**What goes wrong:** The crawler encounters a login page, paywall, age gate, or Terms acceptance page. It either gets stuck trying to audit the login form itself, or treats the gated content as the actual page content.

**Why it happens:** Many sites have member-only sections, admin panels, or gated content. Links to these pages exist in the navigation but resolve to login forms. Claude-in-Chrome shares the user's session, but if the user isn't logged into the target site, those pages are inaccessible.

**Prevention:**
1. **Detect login pages** -- if page text contains "sign in", "log in", "password" fields, or redirects to `/login`, mark as "login-required" and skip.
2. **Skip common auth paths** -- maintain a list of common auth URL patterns (`/login`, `/signin`, `/auth`, `/admin`, `/account`, `/dashboard`) and skip them by default.
3. **Report gated pages separately** -- don't flag them as errors; list them as "pages requiring authentication (not audited)."
4. **Let users pre-authenticate** -- since Claude-in-Chrome shares browser session, document that users should log in manually before running the audit if they want authenticated pages included.

**Phase to address:** Phase 2 (edge case handling).

**Confidence:** HIGH -- verified against Claude-in-Chrome docs which explicitly describe login/CAPTCHA handling as a pause-and-ask-user scenario.

---

### Pitfall 10: Crawl Order Causing Important Pages to Be Missed

**What goes wrong:** The crawler follows links depth-first and gets deep into a blog archive or documentation tree, hitting the page limit before visiting important top-level pages like "About", "Contact", "Pricing".

**Why it happens:** Depth-first traversal naturally follows the first link found, which may be a blog post linking to another blog post linking to another. Breadth-first is more appropriate for site auditing but requires maintaining a queue.

**Prevention:**
1. **Breadth-first traversal** -- process all links found on the current page before diving deeper. This ensures all top-level pages are visited before deep pages.
2. **Priority queue** -- prioritize pages linked from the homepage and top-level navigation over pages found deep in the link graph.
3. **Depth limit** -- set a maximum link-depth (e.g., 4 levels from seed) to prevent diving into infinite blog archives or documentation trees.
4. **Report what was NOT visited** -- if the page limit is hit, include a "pages discovered but not audited" section showing what was left in the queue.

**Phase to address:** Phase 1 (crawl algorithm) -- breadth-first should be the default from the start.

**Confidence:** MEDIUM -- this is standard crawler design wisdom, not specific to Claude Code.

---

### Pitfall 11: Tool Call Budget Exhaustion

**What goes wrong:** Each page visit requires multiple MCP tool calls (navigate, wait, read text, check console, extract links). A 50-page audit might require 200-300+ tool calls. Claude Code conversations have practical limits on total turns/tool calls before the session becomes unwieldy.

**Why it happens:** MCP tool calls are the only way to interact with the browser. There's no "batch" operation -- each action is a separate tool invocation. Reading page text, checking console logs, and navigating are all individual calls.

**Prevention:**
1. **Minimize tool calls per page** -- combine operations where possible. Read text and extract links in a single page analysis rather than separate tool calls.
2. **Default to smaller audits** -- start with a 25-page default limit. Users can increase if they want comprehensive coverage.
3. **Skip low-value operations on deep pages** -- for pages beyond depth 2, maybe only check for broken links, skip spelling analysis.
4. **Provide progress indication** -- "Auditing page 15/25..." so users know the scope and can interrupt if needed.

**Phase to address:** Phase 1 (architecture) -- tool call efficiency must be designed in from the start.

**Confidence:** MEDIUM -- based on practical Claude Code usage patterns; exact tool call limits are not officially documented as hard numbers.

---

### Pitfall 12: Report Generated Before Crawl Completes (Partial Results)

**What goes wrong:** An error occurs mid-crawl (browser crash, network issue, context overflow, user interruption), and the partially-complete findings are either lost (if only in context) or the report is generated from incomplete data without acknowledging incompleteness.

**Why it happens:** Long-running skills are inherently fragile. Any disruption means incomplete work. If findings are only in Claude's context (not written to disk), they vanish on error.

**Prevention:**
1. **Incremental file writes** -- append findings to the report file after EACH page, not at the end. The file is always the current state of truth.
2. **Report header includes crawl status** -- always include: "Pages audited: X/Y discovered. Crawl status: [complete/partial/interrupted]."
3. **Queue persistence** -- write the pending URL queue to a file. If the crawl is interrupted, the queue file shows what was missed.
4. **Graceful degradation** -- if an error occurs, catch it, write current findings, and produce whatever report is possible. A partial report is better than no report.

**Phase to address:** Phase 1 (resilience) -- write-to-disk pattern must be the default from day one.

**Confidence:** HIGH -- this is a direct consequence of the context window limits and is the standard pattern for any long-running agent task.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Core crawl engine | Infinite loops (Pitfall 1) | URL normalization + hard page cap |
| Core crawl engine | Context overflow (Pitfall 2) | Write-to-disk pattern from day one |
| Core crawl engine | Scope confusion (Pitfall 7) | Explicit hostname matching, www equivalence |
| Core crawl engine | Poor traversal order (Pitfall 10) | Breadth-first default |
| Core crawl engine | Partial results lost (Pitfall 12) | Incremental file writes |
| Skill design | Instruction drift (Pitfall 3) | Simple linear checklist per page |
| Skill design | Tool call budget (Pitfall 11) | Minimize calls per page, set page limits |
| Browser interaction | Tab desync/SPA (Pitfall 4) | Wait-and-verify pattern |
| Browser interaction | Login gates (Pitfall 9) | Detect and skip, report separately |
| Spelling analysis | False positives (Pitfall 5) | Ignore code, acronyms, brand terms; confidence threshold |
| Spelling analysis | Repeated content (Pitfall 8) | Deduplicate findings, focus on main content |
| Link verification | Rate limiting (Pitfall 6) | Per-domain throttling, known-good allowlist, HEAD requests |

---

## Summary: The Three Laws of This Audit Skill

Based on all pitfalls above, three architectural principles prevent the most damage:

1. **Write to disk, not context** -- Every finding, every visited URL, every queued URL goes to a file immediately. Context is ephemeral; files are durable.

2. **Normalize everything, limit everything** -- Normalize URLs before comparison. Limit page count. Limit crawl depth. Limit text extraction length. Limit external checks. Unbounded anything leads to failure.

3. **Keep instructions simple and repetitive** -- The per-page checklist should be so simple that even a compressed/compacted version of the instructions still produces correct behavior. No complex branching.

---

## Sources

- [Conductor: Crawler Traps](https://www.conductor.com/academy/crawler-traps/) - Crawler trap taxonomy
- [Archive-It: How to identify and avoid crawler traps](https://support.archive-it.org/hc/en-us/articles/208332943-How-to-identify-and-avoid-crawler-traps) - Infinite URL patterns
- [URI Normalization - Wikipedia](https://en.wikipedia.org/wiki/URI_normalization) - Normalization techniques
- [normalize-url (npm)](https://www.npmjs.com/package/normalize-url) - URL normalization library
- [Claude Code: Use Claude Code with Chrome](https://code.claude.com/docs/en/chrome) - Official Claude-in-Chrome docs
- [Claude Code: Extend Claude with skills](https://code.claude.com/docs/en/skills) - Official skills documentation
- [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) - Official skill design guidance
- [Understanding Usage and Length Limits](https://support.claude.com/en/articles/11647753-understanding-usage-and-length-limits) - Context window limits
- [JetBrains Research: Efficient Context Management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/) - Agent context strategies
- [Solving Context Window Overflow in AI Agents (arxiv)](https://arxiv.org/html/2511.22729v1) - Academic research on context overflow
- [LangChain: Context Engineering for Agents](https://www.blog.langchain.com/context-engineering-for-agents/) - Write/Select/Compress/Isolate framework
- [Silktide: AI-powered spell check](https://silktide.com/blog/introducing-ai-powered-spell-check/) - Spell check false positive handling
- [Screaming Frog: Spelling & Grammar Checker](https://www.screamingfrog.co.uk/spelling-grammar-checker/) - Website spell check tool patterns
- [Sitebulb: How to Crawl Responsibly](https://sitebulb.com/resources/guides/how-to-crawl-responsibly-the-need-for-less-speed/) - Rate limiting best practices
- [Archive-It: How our crawler determines scope](https://support.archive-it.org/hc/en-us/articles/208001076-How-our-crawler-determines-scope) - Subdomain scoping
- [Ahrefs: How to define crawl scope](https://help.ahrefs.com/en/articles/2834076-how-to-define-the-scope-of-a-crawl-in-site-audit-using-different-modes) - Domain vs subdomain modes
- [Medium: Claude Code MCP Context Bloat](https://medium.com/@joe.njenga/claude-code-just-cut-mcp-context-bloat-by-46-9-51k-tokens-down-to-8-5k-with-new-tool-search-ddf9e905f734) - MCP token overhead
- [Optimising MCP Server Context Usage](https://scottspence.com/posts/optimising-mcp-server-context-usage-in-claude-code) - MCP optimization
