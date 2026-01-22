# Project Research Summary

**Project:** site-audit (Claude Code Plugin)
**Domain:** Browser-based website auditing / crawling plugin
**Researched:** 2026-01-22
**Confidence:** HIGH

## Executive Summary

This is a Claude Code plugin that performs intelligent website auditing through browser automation. Unlike traditional HTTP-based crawlers, this plugin leverages Claude's AI-powered reasoning combined with real browser rendering to detect issues that automated tools miss. The plugin uses markdown-based instructions (not compiled code) to guide Claude through recursive site crawling, checking for broken links, spelling errors, console errors, and visual issues.

The recommended approach is to build the core crawl infrastructure first with aggressive safeguards (URL normalization, page limits, write-to-disk state management), then layer AI-powered checks incrementally. The plugin structure follows established Claude Code conventions: command file dispatches to a skill, skill orchestrates the multi-phase audit loop, and findings are accumulated in an incremental report file to avoid context window exhaustion.

The critical risk is infinite crawl loops and context overflow. Prevention requires three architectural commitments from day one: (1) write all state to disk immediately, never trust context alone; (2) normalize and limit everything (URLs, page counts, crawl depth); (3) keep skill instructions linear and repetitive to resist instruction drift as context grows. Getting these right in Phase 1 makes all subsequent features straightforward to add.

## Key Findings

### Recommended Stack

This is NOT a traditional software stack. Claude Code plugins are markdown instruction sets that leverage Claude's reasoning and MCP tools. The "stack" is filesystem conventions, browser automation capabilities, and skill design patterns.

**Core technologies:**
- **Plugin structure** (filesystem-based) — Multi-plugin repo using marketplace.json with site-audit as subdirectory, following existing session-workflow pattern
- **claude-in-chrome MCP tools** — Built-in browser automation (navigate, read_page, javascript_tool, get_page_text, read_console_messages, read_network_requests) for all page interaction
- **WebFetch** (built-in Claude Code tool) — HTTP verification for external links despite prompt parameter requirement
- **Markdown skill format** — SKILL.md under 500 lines with progressive disclosure via linked reference docs

**Critical architectural decision:** Use `javascript_tool` to execute DOM queries for link extraction rather than parsing accessibility trees. Execute `Array.from(document.querySelectorAll('a[href]')).map(a => a.href)` returns resolved absolute URLs directly, avoiding relative path resolution bugs.

**Write-to-disk pattern required:** Context window (200K tokens) exhausts after 20-40 pages. Findings and crawl state must be written to files incrementally, not held in conversation context.

### Expected Features

The plugin competes on intelligence of analysis, not parameter count. Traditional crawlers check 170-300+ metrics at scale; this plugin checks fewer metrics but understands context.

**Must have (table stakes):**
- Recursive same-domain crawl with URL normalization and visited-set tracking
- Dead link detection (internal 404s)
- External link verification (HTTP status check only, no crawling)
- Broken image detection via network requests
- Console error capture from browser DevTools
- Structured markdown report output with issue categorization
- Redirect detection (301/302 tracking)
- Progress indication during crawl
- Crawl scope control (page limits, depth limits)

**Should have (AI differentiators):**
- AI-powered spelling/typo detection (contextual understanding vs dictionary matching — understands "their" vs "there", brand names, technical terms)
- Contextual content issues (lorem ipsum, placeholders, nonsensical text)
- Intelligent error categorization (homepage nav 404 vs obscure blog post 404)
- Visual issue detection (Claude sees the rendered page, can identify layout breaks)

**Defer (v2+):**
- Content quality/staleness flags (outdated references, deprecated terminology)
- Navigation coherence across pages
- Form validation testing
- Mixed content detection (HTTPS/HTTP issues)
- Orphan page identification (sitemap vs crawl graph comparison)

**Explicitly excluded:**
- Accessibility audit (WCAG) — dedicated tools handle this better
- Performance profiling — network-dependent, not quality assurance
- SEO analysis — massive domain, established tools dominate
- Screenshot capture — Claude's visual reasoning replaces this

### Architecture Approach

Architecture is instruction design in markdown, not traditional software components. The challenge is maintaining crawl state across many tool-call iterations within Claude's context window, which IS the runtime.

**Major components:**
1. **Initializer** — Parses seed URL, extracts domain for same-origin filtering, declares explicit state structure (queue, visited, findings) in context
2. **Crawl Controller** — BFS loop with explicit numbered protocol per page: dequeue → check visited → navigate → analyze → extract links → classify same-domain vs external → update state
3. **Page Analyzer** — Runs all checks on current page: console errors, spelling (get_page_text + Claude reasoning), broken images (network requests), visual issues (accessibility tree)
4. **External Link Verifier** — Batch WebFetch checks after crawl completes; deduplicate first, check sequentially to avoid rate limiting
5. **Report Generator** — Compiles accumulated findings from incremental file writes into final structured markdown

**Critical patterns to follow:**
- **Explicit state declaration** — Claude restates crawl status periodically ("Page N: URL - X issues found. Queue: Y remaining") to anchor working memory
- **Separation of crawl and verify phases** — Complete same-domain crawling before external link verification to enable deduplication
- **Fail-safe loop termination** — Multiple conditions: max pages (default 50), queue empty, repeating URL patterns (infinite pagination detection)
- **Progressive disclosure via linked files** — Keep SKILL.md focused on crawl loop; move detailed rules to references/ directory

**Data flow:** Findings accumulate in incremental file writes, NOT in context. After each page analysis, append to report file. Context window only holds current state summary and recent findings, not all raw tool results.

### Critical Pitfalls

1. **Infinite crawl loops from URL normalization failures** — Same page visited repeatedly because URLs differ trivially (trailing slashes, query params, fragments, http vs https, www variants). PREVENTION: Normalize all URLs before visited-set comparison (strip fragments, normalize slashes, lowercase hostname, www equivalence). Hard cap at 50 pages default.

2. **Context window exhaustion during large crawls** — 200K token limit reached after 20-40 pages; auto-compaction loses early findings. Tool call outputs (page text, console logs) accumulate 4K-11K tokens per page. PREVENTION: Write findings incrementally to disk after EACH page. Maintain visited-URLs file. Never rely on context alone for state. Store findings as terse structured data, not full page text.

3. **Skill instructions too complex for reliable execution** — Multi-phase algorithm with conditionals causes Claude to drift over long execution, skipping steps or inventing behaviors. PREVENTION: Keep instructions linear and simple. Use "checklist per page" format. Avoid complex branching. Externalize rules to separate files. Limit SKILL.md scope to orchestration.

4. **Browser tab state desynchronization** — Page hasn't finished loading (SPA hydration, AJAX), or modal dialog/cookie consent blocks content. PREVENTION: Wait 2-3 seconds after navigation. Verify content length isn't suspiciously short. Dismiss common overlays first. Accept partial content gracefully and record as dynamic content.

5. **Spelling detection false positives overwhelming real issues** — Brand names, technical terms, code snippets flagged as errors; 80% noise buries real typos. PREVENTION: Skip content in code/pre elements. Ignore ALL_CAPS, camelCase, words with hyphens. Require high confidence. Deduplicate across pages (footer text flagged on every page = report once). Provide sentence context.

6. **External link checking triggers rate limiting** — Rapid requests to same domain return 429, CAPTCHA, or blocks; falsely reported as dead links. PREVENTION: HEAD requests only. Per-domain rate limiting (max 2-3 links to same domain). Known-good allowlist (google.com, github.com never "broken"). Sequential checking with delays. Report timeouts as "may be rate limited" not "broken."

7. **Same-domain scope boundary confusion** — Crawler escapes to subdomains (blog.example.com when seed was example.com) or misses pages on www vs bare domain variants. PREVENTION: Extract hostname from seed as boundary. Treat www and bare domain as equivalent. Protocol-agnostic matching (http/https same scope). Exclude subdomains by default. Filter out asset URLs (.pdf, .jpg, .css).

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Core Crawl Infrastructure
**Rationale:** Foundation must be bulletproof before any checks are meaningful. URL normalization, visited-set tracking, and write-to-disk state management prevent the two deadliest pitfalls (infinite loops and context overflow).

**Delivers:** Working recursive crawler that navigates same-domain pages in BFS order, maintains state in disk files, and terminates gracefully at page limit.

**Addresses (from FEATURES.md):**
- Recursive same-domain crawl
- URL normalization
- Crawl scope control
- Progress indication

**Avoids (from PITFALLS.md):**
- Pitfall 1: Infinite loops (via URL normalization)
- Pitfall 2: Context overflow (via write-to-disk pattern)
- Pitfall 7: Scope confusion (via explicit hostname matching)
- Pitfall 10: Poor traversal order (via BFS queue)
- Pitfall 12: Partial results lost (via incremental file writes)

**Research flag:** Standard crawler patterns; no additional research needed.

### Phase 2: Link Checking (Internal + External)
**Rationale:** With solid crawl mechanics, add the #1 user-expected feature: broken link detection. Internal links use navigation results; external links use WebFetch batch verification.

**Delivers:** Report showing all dead internal links (404s) and unresponsive external links, separated by type.

**Addresses (from FEATURES.md):**
- Dead link detection (internal)
- External link verification
- Redirect detection

**Avoids (from PITFALLS.md):**
- Pitfall 6: Rate limiting on external checks (via per-domain throttling and known-good allowlist)

**Uses (from STACK.md):**
- WebFetch for external link verification
- javascript_tool for link extraction

**Research flag:** WebFetch prompt requirement is documented; no deeper research needed.

### Phase 3: Browser-Native Checks
**Rationale:** Layer checks that don't require AI reasoning: console errors and broken resources. These validate the browser automation works reliably.

**Delivers:** Console error section in report, broken image detection.

**Addresses (from FEATURES.md):**
- Console error capture
- Broken image detection

**Uses (from STACK.md):**
- read_console_messages
- read_network_requests

**Avoids (from PITFALLS.md):**
- Pitfall 4: Tab desynchronization (via wait-and-verify pattern for page load)

**Research flag:** Straightforward MCP tool usage; no additional research.

### Phase 4: AI-Powered Content Analysis
**Rationale:** This is the differentiator. Claude reads page text and applies contextual understanding to find spelling/grammar issues that dictionary-based tools miss.

**Delivers:** Spelling issues section with contextual corrections, placeholder content detection (lorem ipsum).

**Addresses (from FEATURES.md):**
- AI-powered spelling/typo detection
- Contextual content issues

**Avoids (from PITFALLS.md):**
- Pitfall 5: False positive explosion (via code element skipping, confidence threshold, deduplication)
- Pitfall 8: Repeated content inflation (via deduplication and main-content focus)

**Uses (from STACK.md):**
- get_page_text
- Claude's language model reasoning

**Research flag:** Needs refinement through testing to tune false positive rate, but approach is clear.

### Phase 5: Intelligent Prioritization + Visual Checks
**Rationale:** Advanced AI features that require confidence in earlier phases. Visual reasoning and error severity categorization add polish.

**Delivers:** Severity levels on findings (homepage nav broken = high, archive page = low), visual issue detection.

**Addresses (from FEATURES.md):**
- Intelligent error categorization
- Visual issue detection

**Uses (from STACK.md):**
- read_page (accessibility tree for visual analysis)
- Claude's reasoning about page importance

**Avoids (from PITFALLS.md):**
- Pitfall 3: Instruction drift (via simple checklist structure that's been validated in earlier phases)

**Research flag:** Visual reasoning is less documented; may need experimentation during planning.

### Phase Ordering Rationale

- **Phase 1 before all others:** Crawl infrastructure must be rock-solid. Pitfalls 1, 2, 7 are show-stoppers that make everything else impossible.
- **Phase 2 early:** Link checking is table-stakes and validates that navigation and link extraction work correctly before adding complex analysis.
- **Phase 3 before 4:** Browser-native checks are simpler than AI reasoning; success here proves the tool integration is stable before tackling AI features.
- **Phase 4 as differentiator:** Once mechanics work, add the AI-powered analysis that sets this plugin apart from traditional crawlers.
- **Phase 5 last:** Advanced features that require all earlier phases to be reliable and well-tested.

**Dependency chain:** 1 → 2 → 3 → 4 → 5 (strictly sequential, no parallelization)

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 5 (Visual Checks):** Visual issue detection via read_page accessibility tree is less documented. May need experimentation to determine what Claude can reliably detect vs what's noise.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Crawl):** BFS crawling and URL normalization are well-documented patterns with high-confidence sources.
- **Phase 2 (Link Checking):** HTTP status checking is straightforward; WebFetch behavior is documented.
- **Phase 3 (Console/Network):** MCP tool usage is well-documented in official Claude Code Chrome integration docs.
- **Phase 4 (Spelling):** Approach is clear; may need tuning but doesn't require new research.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Plugin structure, MCP tools, and file organization verified against official Claude Code docs and existing repo conventions |
| Features | MEDIUM-HIGH | Feature expectations verified against established site auditor tools (Screaming Frog, Semrush, Sitebulb); AI differentiators are inferred from Claude's capabilities |
| Architecture | HIGH | Skill structure, state management patterns, and progressive disclosure verified against official best practices and real-world skill examples |
| Pitfalls | HIGH | Infinite loops, context overflow, and scope issues extensively documented in crawler literature; Claude-specific pitfalls verified in official docs |

**Overall confidence:** HIGH

Research quality is strong across all areas. Stack and pitfalls have the highest confidence (official sources + established patterns). Features are slightly lower confidence because AI-powered analysis capabilities are partially inferred, though the table-stakes features are well-established.

### Gaps to Address

- **Visual issue detection specifics:** Research identifies that Claude can reason about rendered pages via read_page, but exact reliability and types of visual issues detectable aren't fully documented. HANDLE: Experiment during Phase 5 planning with test cases to determine what's feasible.

- **WebFetch prompt overhead:** Research confirms WebFetch requires a prompt parameter even for simple "does this URL respond" checks. Workaround is documented (use minimal prompt), but actual performance impact at scale (100+ external links) is unknown. HANDLE: Test during Phase 2 with link-heavy site; consider batching strategy if slow.

- **Spelling false positive rate tuning:** Research provides clear prevention strategies (skip code elements, confidence threshold, etc.) but optimal balance between catching real errors vs generating noise requires empirical testing. HANDLE: Build Phase 4 with conservative settings first, tune based on real-world sites.

- **SPA/dynamic content handling:** Research flags that SPAs present special challenges (client-side routing, hydration timing). Basic wait-and-verify pattern is documented, but complex SPAs may need additional handling. HANDLE: Test Phase 1 crawler against known SPA frameworks (React, Vue, Next.js sites) to identify specific issues.

## Sources

### Primary (HIGH confidence)
- [Create plugins - Claude Code Docs](https://code.claude.com/docs/en/plugins) — Plugin structure, filesystem conventions, marketplace.json
- [Use Claude Code with Chrome (beta)](https://code.claude.com/docs/en/chrome) — MCP tool availability, browser requirements, modal handling
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) — Skill structure, frontmatter spec, progressive disclosure
- [Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) — Instruction complexity, context management
- [anthropics/claude-code plugins README](https://github.com/anthropics/claude-code/blob/main/plugins/README.md) — Official examples, allowed-tools behavior

### Secondary (MEDIUM confidence)
- [Claude Chrome MCP - LobeHub](https://lobehub.com/mcp/nonsleepr-claude-chrome-mcp) — Tool name verification, capabilities
- [Claude Agent Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/) — Progressive disclosure architecture
- [Inside Claude Code's Web Tools](https://mikhail.io/2025/10/claude-code-web-tools/) — WebFetch internals
- [Screaming Frog SEO Spider](https://www.screamingfrog.co.uk/seo-spider/) — Industry-standard crawler features
- [Semrush Site Audit Issues](https://www.semrush.com/kb/542-site-audit-issues-list) — Comprehensive issue taxonomy
- [Sitebulb Features](https://sitebulb.com/features/) — Browser-rendering crawler capabilities
- [Archive-It: Crawler traps](https://support.archive-it.org/hc/en-us/articles/208332943-How-to-identify-and-avoid-crawler-traps) — Infinite URL patterns
- [URI Normalization - Wikipedia](https://en.wikipedia.org/wiki/URI_normalization) — Normalization techniques
- [BFS Web Crawler Pattern](https://www.geeksforgeeks.org/python/web-crawling-using-breadth-first-search-at-a-specified-depth/) — Standard crawler architecture

### Tertiary (LOW confidence)
- [Firecrawl Claude Code Skill](https://www.firecrawl.dev/blog/claude-code-skill) — Real-world crawling skill example (external tool, not Claude-native)
- [Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — Context management strategies
- [Task Memory Engine (TME)](https://arxiv.org/html/2504.08525v1) — Structured state tracking for multi-step LLM tasks

---
*Research completed: 2026-01-22*
*Ready for roadmap: yes*
