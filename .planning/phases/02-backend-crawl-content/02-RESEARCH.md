# Phase 2: Backend Crawl + Content - Research

**Researched:** 2026-01-23
**Domain:** WebFetch-based web crawling and content analysis in Claude Code plugin
**Confidence:** HIGH

## Summary

Phase 2 implements the core crawling and content analysis logic for the site-audit plugin. The fundamental challenge is instructing Claude to execute a multi-step BFS crawl using WebFetch while maintaining state across iterations, without executable code.

**Key architectural insight:** This is NOT a code-based crawler. It's a markdown-based instruction set (SKILL.md) that guides Claude's reasoning. The "architecture" is how we structure instructions so Claude reliably maintains crawl state (visited set, queue, findings) in conversation context across many WebFetch calls.

**Critical constraint:** WebFetch requires a prompt parameter for every request - it cannot perform bare HTTP status checks. This affects how we structure link extraction and dead link detection. WebFetch fetches pages, converts HTML to markdown, and uses a small model (Haiku) to answer the provided prompt about the content.

**State management strategy:** Findings must be written to disk progressively using JSONL (newline-delimited JSON) format, which supports append-only writes. Claude maintains the crawl queue and visited set in conversation context, but accumulated findings are persisted to files to prevent context overflow.

**Primary recommendation:** Structure SKILL.md as explicit phases (Initialization → Crawl Loop → Content Analysis → External Verification → Report Generation) with clear state tracking instructions. Use BFS for breadth-first coverage. Write findings to JSONL files progressively during the crawl, then compile final markdown report at the end.

## Standard Stack

The established tools and patterns for implementing a WebFetch-based crawler in a Claude Code plugin:

### Core Tools

| Tool | Purpose | Why Standard |
|------|---------|--------------|
| WebFetch | Fetch and analyze web pages | Built into Claude Code; designed for AI-driven content extraction |
| Write | Persist findings to disk progressively | Prevents context overflow; enables durable state |
| Read | Load accumulated findings for final report | Retrieval of persisted state |
| Bash | Execute shell commands for file operations | Standard for file manipulation in Claude Code |

**WebFetch Key Characteristics:**
- Requires URL + prompt (no bare HTTP checks)
- Converts HTML → Markdown (via Turndown library)
- Content truncated to 100 KB with warning
- Processes with Claude 3.5 Haiku model
- 15-minute cache per URL
- Same-host redirects followed automatically; cross-host redirects return metadata requiring new call
- Source: [WebFetch Tool Description](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/tool-description-webfetch.md)

### Supporting Patterns

| Pattern | Purpose | When to Use |
|---------|---------|-------------|
| JSONL (JSON Lines) | Progressive findings storage | Writing findings during crawl without rewriting entire file |
| BFS Queue Algorithm | Breadth-first page discovery | Standard crawler pattern for comprehensive coverage |
| URL Normalization | Prevent duplicate visits | Every URL before adding to visited set or queue |
| State Declaration | Maintain context coherence | Periodic explicit state summaries in conversation |

**Installation:**
None - WebFetch is built into Claude Code. No npm packages required for plugin.

## Architecture Patterns

### Recommended Project Structure

```
site-audit/
├── .claude-plugin/
│   └── plugin.json                    # Plugin metadata
├── commands/
│   └── site-audit.md                  # Slash command entry point
├── skills/
│   └── site-audit/
│       ├── SKILL.md                   # Main crawl orchestration (< 500 lines)
│       └── references/
│           ├── CHECKS.md              # Detailed analysis instructions
│           ├── REPORT_TEMPLATE.md     # Output format specification
│           └── URL_RULES.md           # Normalization rules
└── .audit-data/                       # Runtime state (gitignored)
    ├── findings-broken-links.jsonl
    ├── findings-spelling.jsonl
    ├── findings-console.jsonl
    └── crawl-state.json
```

### Pattern 1: Explicit State Declaration in Conversation

**What:** Instruct Claude to explicitly write out crawl state at defined intervals during the crawl loop.

**When to use:** Every crawl iteration (abbreviated status) and every 5 pages (full state).

**Example instruction for SKILL.md:**
```markdown
After analyzing each page, state your current crawl status:
"Page [N]: [URL] - Found [X] issues. Queue: [Y] URLs remaining. Total findings: [Z]."

Every 5 pages, provide full state:
- Queue: [list next 3 URLs]
- Visited count: [N]
- Findings: [count by type]
```

**Why it works:** Without explicit state declaration, Claude may "forget" queued URLs or earlier findings as context grows. By restating state periodically, it remains in active conversation context. This is the key pattern for maintaining multi-step coherence in markdown-based instructions.

**Source:** [Claude Agent Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) - Progressive disclosure architecture

### Pattern 2: BFS Crawl Loop with FIFO Queue

**What:** Breadth-first search algorithm for discovering and visiting pages. Queue holds discovered URLs; visited set prevents revisits.

**When to use:** Always for site crawling. BFS ensures important pages (closer to homepage) are visited before deep pagination or archives.

**Example instruction for SKILL.md:**
```markdown
CRAWL LOOP (repeat until queue empty or page limit reached):
1. Check termination: queue empty OR visited count >= max_pages?
   → YES: Exit to External Verification phase
   → NO: Continue
2. Dequeue next URL from front of queue
3. Is URL in visited set?
   → YES: Skip to step 1
   → NO: Continue to step 4
4. Add URL to visited set, increment page count
5. Use WebFetch with prompt: "Extract all links from this page. List each as: [text](url)"
6. Analyze page content (spelling, grammar)
7. Parse extracted links:
   - Normalize each URL
   - If same-domain AND not visited: append to queue
   - If external: add to external_links list
8. Write findings to JSONL files
9. State current status
10. Go to step 1
```

**Why BFS over DFS:** BFS visits homepage, then all pages linked from homepage, then their children. This gives better coverage of important content first. DFS risks diving deep into pagination before covering main sections.

**Sources:**
- [BFS Web Crawler Pattern](https://www.geeksforgeeks.org/python/web-crawling-using-breadth-first-search-at-a-specified-depth/)
- [Running BFS on the Web](https://mohitkarekar.com/posts/2021/bfs-on-the-web/)

### Pattern 3: JSONL Progressive Findings Storage

**What:** Write each finding as a single-line JSON object to a .jsonl file during the crawl. Append-only, no file rewrites.

**When to use:** After every page analysis to persist findings before moving to next page.

**Example findings format:**
```jsonl
{"type":"broken_link","page":"https://example.com/about","link":"https://example.com/missing","status":"404","timestamp":"2026-01-23T10:30:00Z"}
{"type":"spelling","page":"https://example.com/blog","word":"occured","suggestion":"occurred","context":"The event occured yesterday","timestamp":"2026-01-23T10:30:15Z"}
{"type":"console_error","page":"https://example.com/contact","message":"Uncaught TypeError: Cannot read property 'value' of null","timestamp":"2026-01-23T10:30:30Z"}
```

**Why JSONL:** Append-only writes prevent file corruption from incomplete writes. Each line is independent, so partial reads work. Memory-efficient: can process line-by-line at report generation without loading entire file. Standard for streaming and logging use cases.

**Implementation in SKILL.md:**
```markdown
After analyzing each page, append findings to JSONL files:
- Use Bash: echo '{json}' >> .audit-data/findings-[type].jsonl
- One file per finding type (broken-links, spelling, console, visual)
- Each finding is a single-line JSON object
```

**Sources:**
- [JSON Lines Specification](https://jsonlines.org/)
- [JSONL vs JSON for Data Processing](https://superjson.ai/blog/2025-09-07-jsonl-vs-json-data-processing/)

### Pattern 4: URL Normalization Rules

**What:** Standardize URLs before comparing or storing to prevent duplicate visits.

**When to use:** Before adding any URL to visited set or queue.

**Normalization rules (from RFC 3986):**

| Rule | Example | Why |
|------|---------|-----|
| Lowercase scheme and host | `HTTPS://Example.COM/path` → `https://example.com/path` | Case-insensitive per RFC 3986 |
| Remove fragment identifiers | `https://example.com/page#section` → `https://example.com/page` | Fragment is client-side only; same resource |
| Remove trailing slash (non-root) | `https://example.com/about/` → `https://example.com/about` | Duplicate content prevention |
| Keep root trailing slash | `https://example.com/` (unchanged) | Root path requires trailing slash per HTTP spec |
| Normalize percent-encoding | `%7Euser` → `~user` | Decode unreserved characters |
| Remove default ports | `https://example.com:443/` → `https://example.com/` | Port 443 is default for HTTPS |
| Treat http/https as same | Prefer https version | Same content, security preference |

**SKIP these URL types:**
- `mailto:`, `tel:`, `javascript:` - Not web pages
- Asset extensions: `.pdf`, `.jpg`, `.png`, `.css`, `.js` - Not pages to crawl
- Fragment-only: `#section` - Doesn't change page

**Implementation note for SKILL.md:** Express these rules as a checklist Claude follows before adding URLs to queue/visited. Don't try to write pseudo-code; trust Claude's URL parsing ability with clear rules.

**Sources:**
- [RFC 3986: URI Normalization](https://datatracker.ietf.org/doc/html/rfc3986) - Section 6.2
- [Trailing Slash SEO Best Practices 2026](https://www.safaridigital.com.au/blog/trailing-slash-seo/)
- [URL Normalization Wikipedia](https://en.wikipedia.org/wiki/URI_normalization)

### Pattern 5: WebFetch Link Extraction Prompt

**What:** Since WebFetch requires a prompt, use a structured prompt to extract links from pages in a parseable format.

**Recommended prompt pattern:**
```
"Extract all hyperlinks from this page. For each link, provide:
- The link text (first 50 chars)
- The full URL

Format as markdown: [text](url)
One link per line.
Ignore navigation menus and footers - focus on main content links."
```

**Alternative for more control:**
```
"List all unique URLs found in anchor tags (<a href>) on this page.
Return only the URLs, one per line, fully resolved to absolute URLs.
Do not include:
- mailto: or tel: links
- JavaScript: links
- Fragment-only (#) links
Skip duplicates."
```

**Why this matters:** WebFetch converts HTML to markdown and processes with Haiku. The prompt must be specific enough to get structured output that Claude can parse reliably. Markdown link format `[text](url)` is ideal because it's what WebFetch already outputs.

**Critical constraint:** WebFetch truncates content to 100 KB. Pages with thousands of links may be truncated. The skill should handle incomplete results gracefully.

**Source:** [Inside Claude Code's Web Tools](https://mikhail.io/2025/10/claude-code-web-tools/)

### Anti-Patterns to Avoid

- **Attempting to store crawl state in files:** Writing queue/visited to disk each iteration adds overhead. Context window IS the state store; just restate it periodically.

- **DFS crawling:** Depth-first search can get trapped in deep pagination before covering important top-level pages.

- **No page limit:** Large sites can have thousands of pages. Default limit of 50 prevents context overflow and runaway crawls.

- **Checking external links during crawl:** Verify external links in batch after crawl completes. Same external link may appear on many pages - deduplicate first.

- **Overly granular skill instructions:** Don't write SKILL.md as pseudo-code. Write clear intent with key constraints; trust Claude's reasoning.

- **Carrying raw page content forward:** WebFetch returns full markdown content (up to 100 KB). Extract findings immediately; don't accumulate raw content in context.

## Don't Hand-Roll

Problems that look simple but have existing solutions or established patterns:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL parsing and validation | Custom regex URL parser | WebFetch + Claude's URL understanding | Claude handles relative→absolute resolution, protocol normalization automatically |
| Dead link detection | Custom HTTP client | WebFetch with existence check prompt | WebFetch is the only HTTP tool available in Claude Code plugin context |
| Spelling/grammar checking | External spellcheck API | Claude's language analysis | Claude is excellent at detecting typos in context; no external API needed or available |
| HTML parsing for links | Regex-based link extraction | WebFetch with structured prompt | WebFetch converts HTML→Markdown; Claude extracts links from markdown reliably |
| Crawl state persistence | Database, Redis, etc. | Conversation context + JSONL files | No database available in plugin context; context window + disk writes are sufficient |
| Queue data structure | Implementing queue logic | Instruct Claude to maintain array with FIFO semantics | Claude understands queues; explicit instructions suffice |
| URL deduplication | Hash-based visited set | Instruct Claude to check "is URL in visited list?" | Claude can maintain lists and check membership; trust its reasoning |

**Key insight:** Claude Code plugins leverage Claude's reasoning abilities. Don't try to simulate code execution with complex instruction logic. Express the WHAT and WHY clearly; let Claude figure out the HOW using its capabilities.

**Exception:** URL normalization rules should be explicit (Pattern 4 above) because inconsistent normalization breaks duplicate detection. Other logic can be higher-level instructions.

## Common Pitfalls

### Pitfall 1: Context Window Overflow

**What goes wrong:** Crawling 50+ pages accumulates massive context from WebFetch results (each page → 5-10K tokens). Context fills up, Claude loses coherence.

**Why it happens:** Each WebFetch returns full markdown content. If Claude carries all raw content forward in reasoning, context explodes.

**How to avoid:**
- **Instruct Claude to extract findings immediately** after each WebFetch and discard raw content
- **Write findings to JSONL files** during crawl, not just at the end
- **Periodic state summaries** replace detailed findings in active context (e.g., "12 broken links found" instead of listing all 12)
- **Set page limit** (default 50) to bound total context consumption

**Warning signs:**
- Claude starts repeating itself or losing track of queue
- Responses become shorter or less detailed
- Claude "forgets" pages it visited earlier in the crawl

### Pitfall 2: Infinite Pagination Loops

**What goes wrong:** Crawler discovers URL patterns like `/page/1`, `/page/2`, `/page/3`... and crawls indefinitely or until page cap.

**Why it happens:** BFS naturally follows all links. Paginated content creates many similar URLs that all get queued.

**How to avoid:**
- **Page limit** (default 50) is primary defense
- **Instruct Claude to detect pagination patterns:** If 3+ consecutive URLs match pattern `/page/N`, stop following that pattern
- **Breadth cap:** Optionally limit queue size to 100 URLs; if exceeded, warn user about site size

**Warning signs:**
- Queue size keeps growing faster than visited count
- Many URLs with similar patterns (dates, numbers, page=N)
- Crawl is slow and repetitive

### Pitfall 3: WebFetch Prompt Ambiguity

**What goes wrong:** Vague WebFetch prompts like "get the links" return inconsistent or unparseable results. Haiku interprets the prompt differently for each page.

**Why it happens:** WebFetch uses Haiku with the provided prompt. Ambiguous prompts produce variable output formats.

**How to avoid:**
- **Use structured prompt format** (see Pattern 5 above)
- **Request specific output format:** "Return as markdown: [text](url), one per line"
- **Test prompts on varied pages:** Homepage (few links), blog index (many links), article (moderate links)

**Warning signs:**
- Claude says "I couldn't parse the links"
- Link extraction works on some pages but fails on others
- Duplicate URLs not being caught (indicates parsing inconsistency)

### Pitfall 4: Same-Domain Detection Edge Cases

**What goes wrong:** Subdomains, www prefix, or port numbers cause same URLs to be treated as different domains.

**Why it happens:** Naive string comparison of hostnames misses normalization edge cases.

**How to avoid:**
- **Normalize before comparing:** `www.example.com` === `example.com`
- **Treat all subdomains of seed domain as external** (or make this configurable)
  - If seed is `example.com`, should `blog.example.com` be crawled? Probably not (different subdomain)
  - If seed is `blog.example.com`, crawl only that subdomain
- **Port numbers:** `example.com:8080` vs `example.com` are different; normalize ports

**Warning signs:**
- Crawler stops immediately after homepage (overly strict domain matching)
- Crawler visits many external subdomains (overly permissive domain matching)

### Pitfall 5: Spelling Check False Positives

**What goes wrong:** Technical terms, brand names, code snippets, or proper nouns flagged as spelling errors. Report fills with false positives.

**Why it happens:** Claude's language model is general-purpose, not domain-aware.

**How to avoid:**
- **Instruct Claude to filter technical content:** "Ignore code blocks, URLs, camelCase identifiers, and technical terms"
- **Confidence threshold:** Only report HIGH confidence spelling errors (obvious typos)
- **Context-aware analysis:** "Flag only words that are clearly wrong in their context, not industry jargon"
- **Brand name handling:** "Skip capitalized words that may be product/brand names unless obviously misspelled"

**Warning signs:**
- Report has 100+ spelling issues on technical site
- Common technical terms flagged (API, OAuth, webpack, etc.)
- Brand names or product names flagged

## Code Examples

Verified patterns for implementation:

### Crawl State Initialization (SKILL.md)

```markdown
## Phase 1: Initialization

When the user invokes /site-audit <url>, follow these steps:

1. **Parse the seed URL:**
   - Extract: protocol, domain, path
   - Example: `https://example.com/blog/` → domain: `example.com`

2. **Initialize crawl state (declare explicitly):**
   ```
   CRAWL STATE:
   - Seed: [url]
   - Domain: [extracted domain]
   - Queue: [seed url]
   - Visited: [] (empty)
   - Page count: 0
   - Max pages: 50 (default)
   - External links: []
   - Findings: {
       broken_links: [],
       spelling: [],
       console_errors: [],
       visual_issues: []
     }
   ```

3. **Create findings directory:**
   - Use Bash: mkdir -p .audit-data
   - Create empty JSONL files for progressive writing

4. **Confirm with user:**
   "Starting audit of [domain]. Will crawl up to 50 pages. Proceed?"
```

### BFS Crawl Loop (SKILL.md)

```markdown
## Phase 2: Crawl Loop

Execute BFS crawl until queue is empty OR page count >= max_pages:

**Loop Iteration:**

1. **Termination check:**
   - If queue is empty: → Exit to Phase 3 (External Verification)
   - If page_count >= max_pages: → Exit to Phase 3
   - Otherwise: Continue

2. **Dequeue next URL:**
   - Take URL from front of queue (FIFO)
   - Check: Is this URL in visited set?
     → YES: Skip, go to step 1
     → NO: Continue to step 3

3. **Mark as visited:**
   - Add URL to visited set
   - Increment page_count

4. **Fetch page:**
   - Use WebFetch with URL and prompt:
     "Extract all hyperlinks from this page's main content. For each link, provide [text](url) format, one per line. Ignore navigation and footer links. Also, provide the main text content of the page (skip code blocks)."

5. **Analyze page content:**
   - From the returned content:
     a) Extract links (markdown format)
     b) Check for spelling/grammar issues in body text (ignore code, URLs, technical terms)
     c) Note any broken embedded resources mentioned
   - Write findings to JSONL files:
     ```bash
     echo '{"type":"spelling","page":"[url]","word":"[word]","suggestion":"[fix]","context":"[context]"}' >> .audit-data/findings-spelling.jsonl
     ```

6. **Process extracted links:**
   - For each link:
     a) Normalize URL (lowercase host, remove fragment, resolve relative)
     b) Classify:
        - Same domain? Check hostname matches seed domain
        - External? Different hostname
        - Skip? (mailto:, tel:, javascript:, assets)
     c) If same-domain AND not in visited: Append to queue
     d) If external: Add to external_links list (deduplicated)

7. **State update (every page):**
   - Output: "Page [N]/[max]: [url] - [X] findings. Queue: [Y] URLs."

8. **Full state (every 5 pages):**
   - Output:
     ```
     CRAWL STATE UPDATE:
     - Visited: [count] pages
     - Queue: [next 3 URLs]...
     - Findings so far: [broken_links count], [spelling count], [console count]
     ```

9. **Repeat:** Go to step 1
```

### URL Normalization (in URL_RULES.md reference file)

```markdown
# URL Normalization Rules

Apply these rules to every URL before adding to queue or visited set:

1. **Lowercase scheme and host:**
   - `HTTPS://Example.COM/Path` → `https://example.com/Path`
   - Path remains case-sensitive

2. **Remove fragment:**
   - `https://example.com/page#section` → `https://example.com/page`

3. **Remove trailing slash (non-root):**
   - `https://example.com/about/` → `https://example.com/about`
   - BUT: `https://example.com/` (root) → unchanged

4. **Decode unreserved characters in percent-encoding:**
   - `%7Euser` → `~user`
   - Keep reserved character encoding unchanged

5. **Remove default ports:**
   - `https://example.com:443/` → `https://example.com/`
   - `http://example.com:80/` → `http://example.com/`

6. **Prefer HTTPS:**
   - If you encounter both http:// and https:// versions, use https://

7. **Same-domain check:**
   - Extract hostname from normalized URL
   - Compare to seed domain hostname
   - `www.example.com` ≠ `example.com` (different subdomains - treat as external)
   - Exception: If seed has `www.`, then `www.example.com` === `www.example.com` (exact match)
```

### WebFetch Link Extraction Prompt

```markdown
## Link Extraction Prompt

When using WebFetch to extract links from a page, use this exact prompt:

"Extract all hyperlinks from the main content of this page. For each link, provide the format:

[link text](full URL)

Rules:
- One link per line
- Use the full resolved URL (absolute, not relative)
- Include only links from the main content area
- Skip navigation menus, footers, and sidebars
- Ignore mailto:, tel:, and javascript: links
- Do not include duplicate links

After the links, provide the main text content of the page (skip code blocks, navigation, and boilerplate)."
```

This prompt:
- Requests markdown format `[text](url)` which is easy to parse
- Specifies absolute URLs (WebFetch's markdown conversion resolves relatives)
- Filters out navigation/footer (noise reduction)
- Excludes non-HTTP links
- Also gets page content for spelling analysis in one call

### JSONL Findings Writing

```bash
# Append broken link finding
echo '{"type":"broken_link","page":"https://example.com/about","target":"https://example.com/missing","status":"404","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >> .audit-data/findings-broken-links.jsonl

# Append spelling issue
echo '{"type":"spelling","page":"https://example.com/blog/post","word":"occured","suggestion":"occurred","context":"The event occured yesterday","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >> .audit-data/findings-spelling.jsonl

# Append console error
echo '{"type":"console_error","page":"https://example.com/contact","level":"error","message":"Uncaught TypeError: Cannot read property value of null","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}' >> .audit-data/findings-console.jsonl
```

**Why JSONL:**
- Append-only: No file rewrites
- Line-independent: Incomplete writes don't corrupt earlier lines
- Easy parsing: Read line-by-line at report generation
- Standard format: JSON tooling works out of the box

### Final Report Generation (SKILL.md)

```markdown
## Phase 5: Report Generation

After all crawling and verification is complete:

1. **Read all JSONL findings files:**
   - Use Bash: cat .audit-data/findings-*.jsonl
   - Parse each line as JSON
   - Group by type

2. **Compile report:**
   - Use REPORT_TEMPLATE.md as structure
   - Fill in:
     - Summary stats (pages crawled, findings count by type)
     - Broken links section (sorted by page)
     - Spelling issues section (with context and suggestions)
     - Console errors section (with error messages)
     - Visual issues section
     - Dead external links section
   - List all pages crawled

3. **Write report file:**
   - Filename: `site-audit-[domain]-[date].md`
   - Location: Current working directory
   - Use Write tool

4. **Confirm with user:**
   "Audit complete. Report written to: [filename]"
   - X pages crawled
   - Y total findings (breakdown by type)
```

## State of the Art

| Old Approach | Current Approach (2026) | When Changed | Impact |
|--------------|------------------------|--------------|--------|
| Code-based crawlers (Scrapy, Puppeteer) | Markdown instruction-based crawlers (Claude skills) | 2025 | Skills leverage AI reasoning; no executable code needed |
| Bare HTTP status checks for link validation | WebFetch with prompt-based validation | 2025 | WebFetch always requires prompt; must extract content to verify |
| Single-pass HTML parsing | HTML→Markdown→AI analysis | 2025 | Markdown intermediate format simplifies AI processing |
| BeautifulSoup, regex for link extraction | WebFetch structured prompts | 2025-26 | AI extracts links more reliably than regex; handles varied HTML |
| Database-backed crawl state | Context window + JSONL files | 2025 | No database in Claude Code plugin context; simpler state management |
| External spellcheck APIs (Grammarly API, LanguageTool) | Claude's built-in language analysis | 2025 | No external APIs available in plugin context; Claude is excellent at this |

**Deprecated/outdated:**
- **Custom HTTP clients:** WebFetch is the only HTTP tool available in Claude Code plugins. No `fetch()`, `axios`, or `requests`.
- **Headless browser automation (Puppeteer, Playwright):** Phase 2 uses WebFetch (no browser). Chrome MCP comes in Phase 3 for console errors and visual checks.
- **State machines with explicit transitions:** Claude skills use phase-based instructions, not formal state machines. Claude's reasoning handles transitions.

**Current best practice (2026):**
- Express crawl logic as phases with clear instructions
- Trust Claude's reasoning for routine decisions (URL parsing, link classification)
- Be explicit about critical rules (normalization, termination conditions)
- Use JSONL for progressive findings storage
- Keep raw tool results out of active context (extract findings immediately)

## Open Questions

Things that couldn't be fully resolved or need validation during implementation:

1. **WebFetch link extraction reliability**
   - What we know: WebFetch converts HTML to markdown and uses Haiku to process prompts. Structured prompts should return parseable results.
   - What's unclear: Will Haiku consistently return links in `[text](url)` format across diverse page structures? Or will output format vary?
   - Recommendation: Implement with structured prompt (Pattern 5). During testing, monitor for parsing failures. If Haiku output is inconsistent, add fallback parsing logic in skill instructions.
   - Confidence: MEDIUM (structured prompts should work, but Haiku's consistency is not verified)

2. **Context window capacity for 50-page crawls**
   - What we know: Each WebFetch returns ~5-10K tokens of markdown content. Claude's context window is 200K tokens.
   - What's unclear: Will periodic state summaries and JSONL writing keep context manageable? Or will 50 pages still overflow?
   - Recommendation: Start with 50-page limit. If context issues arise during testing, reduce to 30 or implement more aggressive summarization.
   - Confidence: MEDIUM (calculation suggests it works, but real-world testing needed)

3. **URL normalization edge cases**
   - What we know: RFC 3986 defines normalization rules. Standard patterns exist.
   - What's unclear: How should subdomain crawling be handled? Should `blog.example.com` be crawled if seed is `example.com`?
   - Recommendation: Default to strict same-hostname matching (no subdomain hopping). Make it configurable via command parameter if user requests.
   - Confidence: HIGH (standard practice is strict hostname matching)

4. **Spelling analysis filtering effectiveness**
   - What we know: Claude can identify typos and grammar issues. Technical content needs filtering.
   - What's unclear: Will Claude's filtering ("ignore code blocks, technical terms") be reliable? Or will false positives dominate?
   - Recommendation: Implement with filtering instructions. During testing, review spelling findings for false positive rate. If >30% false positives, increase specificity of filtering rules or add confidence threshold.
   - Confidence: LOW (Claude's ability to filter technical content is unverified in this context)

5. **WebFetch rate limiting and timeouts**
   - What we know: WebFetch has 15-minute cache. Sequential calls are naturally rate-limited.
   - What's unclear: Will WebFetch timeout on slow sites? What's the timeout threshold? How should skill handle timeouts?
   - Recommendation: Instruct Claude to handle WebFetch failures gracefully: record as finding ("Could not fetch: [URL] - timeout"), continue crawl. Test with intentionally slow site.
   - Confidence: MEDIUM (graceful degradation is standard pattern, but timeout behavior is undocumented)

## Sources

### Primary (HIGH confidence)

- [WebFetch Tool Description](https://github.com/Piebald-AI/claude-code-system-prompts/blob/main/system-prompts/tool-description-webfetch.md) - Official system prompt docs
- [Inside Claude Code's Web Tools](https://mikhail.io/2025/10/claude-code-web-tools/) - WebFetch internals and behavior
- [RFC 3986: URI Normalization](https://datatracker.ietf.org/doc/html/rfc3986) - Section 6.2, URL equivalence rules
- [JSON Lines Specification](https://jsonlines.org/) - Official JSONL format spec
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) - Official skill structure
- [BFS Algorithm - GeeksforGeeks](https://www.geeksforgeeks.org/dsa/breadth-first-search-bfs/) - Queue-based BFS pattern

### Secondary (MEDIUM confidence)

- [Claude Agent Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) - Progressive disclosure architecture
- [Web Crawling Using BFS](https://www.geeksforgeeks.org/python/web-crawling-using-breadth-first-search-at-a-specified-depth/) - BFS crawler pattern
- [Running BFS on the Web](https://mohitkarekar.com/posts/2021/bfs-on-the-web/) - Web as graph structure
- [Trailing Slash SEO Best Practices](https://www.safaridigital.com.au/blog/trailing-slash-seo/) - URL normalization for consistency
- [JSONL vs JSON for Data Processing](https://superjson.ai/blog/2025-09-07-jsonl-vs-json-data-processing/) - Append-only benefits
- [How to Create a Claude Code Skill](https://www.firecrawl.dev/blog/claude-code-skill) - Real-world skill example
- [Markdown for Prompt Engineering](https://tenacity.io/snippets/supercharge-ai-prompts-with-markdown-for-better-results/) - Structured prompts

### Tertiary (LOW confidence - marked for validation)

- [Broken Link Checker Implementation Patterns](https://www.softwaretestinghelp.com/broken-link-checker/) - General dead link detection approaches (not Claude-specific)
- [LLM Grammar Checking Capabilities](https://medium.com/@ravichandra009/are-llms-good-spell-checkers-48dfbd30deb6) - LLM spell-check analysis (not Claude Code context)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - WebFetch, Write, JSONL are verified tools and formats
- Architecture patterns: HIGH - BFS, state declaration, JSONL writing are established patterns
- URL normalization: HIGH - RFC 3986 is authoritative standard
- WebFetch link extraction: MEDIUM - Prompt patterns should work but need validation
- Spelling analysis filtering: LOW - Claude's ability to filter technical content unverified in this context
- Context window capacity: MEDIUM - Calculations suggest 50 pages work, but testing needed

**Research date:** 2026-01-23
**Valid until:** ~30 days (February 2026) - Claude Code and WebFetch are stable; patterns are foundational

**Key assumptions:**
1. WebFetch behavior documented in system prompts is current and accurate
2. Claude can maintain BFS queue state in conversation context for 50-page crawls
3. JSONL append writes are reliable in Claude Code Bash environment
4. Haiku (WebFetch's model) will return consistent output for structured prompts
5. Claude's language analysis can filter technical content with clear instructions

**Next steps for planner:**
- Use BFS crawl loop pattern (Pattern 2) as task structure
- Implement URL normalization rules (Pattern 4) as checklist in SKILL.md
- Use JSONL progressive writing (Pattern 3) for findings persistence
- Structure SKILL.md as phases: Init → Crawl → Verify → Report
- Reference this research for WebFetch prompt patterns and pitfall avoidance
