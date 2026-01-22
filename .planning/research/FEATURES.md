# Feature Landscape: Browser-Based Site Auditor

**Domain:** Website quality auditing / crawling
**Researched:** 2026-01-22
**Confidence:** MEDIUM-HIGH (based on established domain with clear patterns)

## Table Stakes

Features users expect from any site audit tool. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Recursive same-domain crawl | Core function of any site auditor; without it, users must manually enter every URL | Medium | Needs visited-set, URL normalization, depth limiting |
| Dead link detection (internal) | The #1 reason people use site auditors; 404s are the most visible site quality issue | Low | Navigate to each internal link, check response |
| External link verification | Users expect all links checked, not just internal ones; broken outbound links harm credibility | Low | HTTP HEAD/GET without full crawl; check status codes |
| Broken image detection | Second most visible quality issue after dead links; users see broken image icons immediately | Low | Check if img elements loaded successfully via DOM/console |
| Console error capture | JavaScript errors indicate real bugs; developers expect this from any browser-based tool | Low | Read console output per page via Chrome DevTools |
| Structured report output | Users need actionable output; a wall of text is unusable | Medium | Markdown report grouped by issue type, with URLs and context |
| Redirect detection | Redirects are not errors but indicate maintenance issues; all major crawlers report them | Low | Track 301/302 responses, report redirect chains |
| Progress indication | Crawling takes time; users need to know the tool is working, not stuck | Low | Report pages visited count, current URL |
| URL normalization | Without this, crawler visits same page multiple times (trailing slash, query params, fragments) | Medium | Strip fragments, normalize trailing slashes, handle query params |
| Crawl scope control | Users need to limit crawl to avoid runaway processes on large sites | Low | Max pages limit, depth limit, or subdirectory scope |

## Differentiators

Features that set this tool apart from traditional crawlers. These leverage Claude's AI-powered browsing -- things HTTP-based crawlers fundamentally cannot do.

### Tier 1: Core AI Differentiators (build these)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI-powered spelling/typo detection | Traditional spellcheckers use dictionaries; Claude understands context ("their" vs "there", brand names, technical terms) | Medium | Claude reads extracted text and reasons about correctness contextually |
| Contextual content issues | Claude can spot nonsensical text, lorem ipsum left in, placeholder content, duplicate paragraphs | Low | Falls out naturally from AI text analysis |
| Visual issue detection | Claude literally sees the page; can identify broken layouts, overlapping elements, missing images beyond just img tag failures | High | Requires Claude to reason about visual state of rendered page |
| Intelligent error categorization | Claude can prioritize: "this 404 is on your homepage nav" vs "this 404 is on an obscure blog post" | Medium | AI reasons about error severity based on page importance and link location |

### Tier 2: AI-Enhanced Extras (nice to have, post-v1)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Content quality flags | Detect outdated content (references to past years, deprecated products), inconsistent terminology | Medium | AI reads content and flags staleness signals |
| Navigation coherence | AI can tell if nav menus are inconsistent across pages, if breadcrumbs don't match hierarchy | Medium | Requires cross-page reasoning about site structure |
| Form validation testing | Claude can actually fill out forms and check if they work, report broken submissions | High | Requires interaction beyond navigation; complex state |
| Mixed content detection | HTTPS pages loading HTTP resources; Claude can observe browser security warnings | Low | Check for mixed content warnings in console/network |
| Orphan page identification | Pages not reachable from any navigation but present in sitemap | Medium | Requires sitemap parsing + crawl graph comparison |

## Anti-Features

Features to explicitly NOT build. Either out of scope per user requirements, wrong for this tool, or complexity traps.

### Explicitly Excluded by User

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Accessibility audit (WCAG) | Complex specialized domain; dedicated tools (axe, Lighthouse) do this better; scope creep risk | Mention in report that accessibility was not assessed; suggest dedicated tools |
| Performance profiling | Load times depend on network, hardware, caching -- not a quality issue Claude can meaningfully assess via browser navigation | Out of scope entirely; different tool category |
| SEO analysis | Massive domain (meta tags, schema, keywords, backlinks); established tools dominate; not quality assurance | Out of scope entirely |
| Screenshots per page | Adds storage complexity, unclear value since Claude already sees pages; bloats report | Claude's visual reasoning replaces screenshots |

### Deliberately Avoided for v1

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full external domain crawling | Unbounded scope; could crawl the entire internet; most external sites don't want to be crawled | Verify external links respond (HTTP check); do not follow their internal links |
| Login/authentication flows | Massively complex state management; session tokens, MFA, CAPTCHAs | Audit only publicly accessible pages; note auth-gated areas as unreachable |
| PDF/document content analysis | Different parsing pipeline; PDFs are not web pages | Report that linked PDFs exist and respond; do not audit their content |
| Comparative/historical audits | Requires persistent storage, baseline management, diffing infrastructure | Generate one-shot reports; user can diff manually or re-run later |
| Auto-fix suggestions | Tempting but dangerous; fixing content requires write access and deep context | Report issues with clear descriptions; let humans decide fixes |
| Rate limiting / politeness config | Sequential browser navigation is naturally slow; no need for complex throttling | The browser-based approach is inherently rate-limited by navigation speed |
| Multi-domain / multi-site batch | Adds complexity for orchestration, reporting, and scope management | One URL per invocation; user can run multiple times |
| Custom rule definitions | Plugin API complexity; users defining their own checks is a v2+ feature | Ship with opinionated built-in checks |

### Complexity Traps (look easy, are not)

| Anti-Feature | Why It's a Trap | Reality |
|--------------|-----------------|---------|
| SPA/infinite scroll handling | Appears simple ("just scroll down") but SPAs have dynamic routing, lazy loading, virtual DOM that makes crawling fundamentally different | Detect SPA patterns; crawl what's reachable via standard links; note SPA pages as potentially incomplete |
| Cookie consent / popup dismissal | Every site has different popup patterns; automating dismissal is fragile | Claude can reason about and dismiss common patterns, but don't build a popup database |
| iframe content auditing | Iframes load separate documents, often cross-origin; permission model is complex | Report iframe presence; do not audit iframe content |
| JavaScript-rendered navigation | Some sites render nav only via JS; if Chrome MCP renders the page, links should be visible | Rely on Chrome's rendering; don't build a separate JS execution engine |

## Feature Dependencies

```
URL Normalization ─────────┐
                           v
Crawl Scope Control ──> Recursive Crawl ──> All Page-Level Checks
                           │
                           ├──> Dead Link Detection (internal)
                           ├──> External Link Verification
                           ├──> Console Error Capture
                           ├──> Broken Image Detection
                           ├──> AI Spelling/Typo Detection
                           ├──> Contextual Content Issues
                           ├──> Visual Issue Detection
                           └──> Redirect Detection

All Page-Level Checks ──> Report Generation
                           │
                           ├──> Issue Categorization
                           ├──> Severity/Priority Assignment
                           └──> Structured Markdown Output
```

Key dependency insight: The crawler is the foundation. All detection features are independent of each other and can be developed/tested in isolation once the crawler works. Report generation depends on all checks being defined (schema must accommodate all issue types).

## MVP Recommendation

**Phase 1 (MVP): Crawler + Link Checking + Report**

Build the crawl infrastructure first, then add the simplest checks:
1. Recursive same-domain crawl with URL normalization and visited-set
2. Dead link detection (internal 404s)
3. External link verification (HTTP status check)
4. Redirect detection (note chains)
5. Basic markdown report output

Rationale: This delivers immediate value with the lowest-risk features. Pure HTTP-level checks, no AI reasoning needed yet. Validates the crawl architecture.

**Phase 2: AI-Powered Checks**

Layer AI capabilities onto the working crawler:
1. Console error capture (browser-native, no AI needed)
2. Broken image detection (DOM inspection)
3. AI spelling/typo detection (Claude reads page text)
4. Contextual content issues (lorem ipsum, placeholders)

Rationale: These features are what differentiate the tool. They require the crawler to be solid first. Spelling detection is the headline feature -- Claude understanding context beats any dictionary.

**Phase 3: Visual + Intelligence**

Advanced AI reasoning about pages:
1. Visual issue detection (Claude reasons about rendered page)
2. Intelligent error categorization and prioritization
3. Crawl scope controls and progress reporting polish
4. Mixed content detection

Rationale: These are harder, higher-value features that require confidence in the crawler and basic checks working reliably.

**Defer to post-v1:**
- Content quality/staleness flags: Useful but scope creep
- Navigation coherence checking: Cross-page reasoning is complex
- Form testing: Requires interaction design beyond navigation
- Orphan page detection: Requires sitemap parsing infrastructure

## Competitive Landscape Context

Traditional crawlers (Screaming Frog, Sitebulb, Semrush) check 170-300+ parameters but are primarily HTTP-based. They excel at scale (crawling millions of pages) and SEO-specific checks. This tool's advantage is NOT competing on parameter count -- it's competing on intelligence of analysis.

**Where this tool wins:**
- Understanding context (is "teh" a typo or a brand name?)
- Seeing what humans see (visual rendering, not just DOM)
- Zero setup (no API keys, no SaaS subscription, runs in your existing browser)
- Developer-native (markdown output, CLI invocation, part of dev workflow)

**Where traditional tools win:**
- Scale (thousands of pages quickly)
- SEO depth (backlinks, rankings, schema validation)
- Historical tracking (trend analysis over time)
- Enterprise features (team collaboration, scheduled audits)

This is not a replacement for Screaming Frog. This is "quick, intelligent site health check" for developers who want to catch obvious issues before deploying.

## Sources

- [Screaming Frog SEO Spider](https://www.screamingfrog.co.uk/seo-spider/) - Industry-standard crawler feature set
- [Semrush Site Audit Issues](https://www.semrush.com/kb/542-site-audit-issues-list) - Comprehensive issue taxonomy
- [Sitebulb Features](https://sitebulb.com/features/) - Browser-rendering crawler capabilities
- [Spling](https://www.spl.ing/) - Website-specific spelling checker
- [Claude Code Chrome Integration](https://code.claude.com/docs/en/chrome) - MCP browser tool capabilities
- [Percy Visual Testing](https://percy.io/) - Visual regression detection patterns
- [BrowserStack Visual Testing Guide](https://www.browserstack.com/guide/visual-testing-tools) - Visual issue detection approaches
