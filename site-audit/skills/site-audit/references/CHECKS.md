# Content Analysis Rules

This document defines the rules for analyzing page content during the crawl. It covers spelling/grammar analysis and dead link detection.

## Spelling & Grammar Analysis

**Objective:** Identify high-confidence spelling and grammar errors in page text content while avoiding false positives from technical terminology, code, and brand names.

### Analysis Process

1. **Analyze extracted page text** for typos and grammar issues
2. **Apply filtering rules** to exclude non-prose content
3. **Flag only HIGH confidence errors** (obvious typos)
4. **Provide context and suggestions** for each finding

### Filtering Rules

Apply these filters to EXCLUDE content from spelling analysis:

**Code blocks:**
- Indented text (4+ spaces or tab at line start)
- Fenced code blocks (```...```)
- Inline code (`...`)

**Technical identifiers:**
- camelCase identifiers (e.g., `getUserData`, `isActive`)
- SCREAMING_CASE constants (e.g., `MAX_RETRIES`, `API_KEY`)
- snake_case identifiers (e.g., `user_count`, `get_data`)
- Lowercase concatenated words without spaces (e.g., `pagenotfound`, `userid`)

**URLs and contact info:**
- Full URLs (http://, https://, /path/to/resource)
- Email addresses (user@domain.com)
- Domain names (example.com, api.github.com)

**Brand and product names:**
- Capitalized words that may be brand names (e.g., `WebFetch`, `GitHub`, `JavaScript`)
- All-caps acronyms (e.g., `API`, `HTML`, `CSS`)

### Spelling Check Strategy

**HIGH confidence errors only:**
- Obvious typos: "occured" → "occurred", "recieve" → "receive"
- Repeated words: "the the" → "the"
- Common misspellings: "seperate" → "separate", "definately" → "definitely"

**Context-aware filtering:**
- Consider surrounding words to identify jargon
- If a "misspelled" word appears multiple times on the same page, it's likely intentional (brand/term)
- If a word is near code/technical content, be conservative

**For each finding, record:**
- Page URL
- Misspelled word
- Suggested correction
- Context snippet (surrounding text, ~50 characters before/after)
- Timestamp (ISO 8601 format)

### Example Findings

```json
{"type":"spelling","page":"https://example.com/about","word":"occured","suggestion":"occurred","context":"This occured during the migration process","timestamp":"2024-01-15T10:30:01Z"}
{"type":"spelling","page":"https://example.com/blog/post","word":"recieve","suggestion":"receive","context":"You will recieve a confirmation email","timestamp":"2024-01-15T10:31:22Z"}
{"type":"spelling","page":"https://example.com/docs","word":"the the","suggestion":"the","context":"in the the documentation section","timestamp":"2024-01-15T10:32:15Z"}
```

## Dead Link Detection

**Objective:** Identify internal same-domain links that return errors (404, timeout, connection failures).

### What is a Dead Link?

A dead link is an **internal same-domain URL** that returns an error when fetched. Dead links break user navigation and hurt SEO.

**Scope:**
- **Internal links only:** Same hostname as seed URL
- **Error responses:** 404, 500, 503, timeouts, connection refused, DNS errors
- **During crawl:** Detected when WebFetch fails to retrieve a page

**Out of scope (not checked in Phase 2):**
- External links (different domain) — deferred to separate phase
- Redirect chains — followed automatically by WebFetch
- Anchor links (#section) — not fetched separately

### Detection Points

Dead links are detected in **TWO scenarios:**

**1. WebFetch fails on dequeued URL (immediate detection):**
- URL was found on a page and added to queue
- When dequeued and fetched, WebFetch returns an error
- Record source page (where link was found), target URL (dead link), error type

**2. WebFetch fails on initial seed URL:**
- Rare case: seed URL itself is dead
- Record source as "(seed)", target as seed URL, error type

### Error Types

Record the specific error returned by WebFetch:

- `404` — Not Found
- `500` — Internal Server Error
- `503` — Service Unavailable
- `timeout` — Request timed out
- `connection_refused` — Connection refused
- `dns_error` — DNS resolution failed
- `ssl_error` — SSL/TLS error
- `unknown` — Other error (include details if available)

### Finding Format

Each dead link finding is a single-line JSON object:

```json
{"type":"broken_link","page":"https://example.com/blog","target":"https://example.com/old-page","error":"404","timestamp":"2024-01-15T10:30:00Z"}
{"type":"broken_link","page":"https://example.com/docs","target":"https://example.com/missing","error":"timeout","timestamp":"2024-01-15T10:35:12Z"}
```

**Fields:**
- `type`: Always "broken_link"
- `page`: Source page URL (where the dead link was found)
- `target`: The broken URL itself
- `error`: Error type (404, timeout, etc.)
- `timestamp`: ISO 8601 timestamp when detected

### Special Cases

**Source page tracking:**
- Keep a map of `{target_url: source_page}` as you add URLs to queue
- When a URL fails to fetch, look up its source page for the finding
- If multiple pages link to the same dead URL, record the first source page encountered

**Redirects:**
- If WebFetch follows a redirect successfully, not a dead link (no finding)
- If redirect chain fails (redirect to 404), record as dead link

## Progressive Writing

Findings must be written to disk **progressively** as the crawl proceeds, not accumulated in memory.

### Storage Location

All findings are stored in `.audit-data/` directory in the current working directory:

```
.audit-data/
  findings-broken-links.jsonl
  findings-spelling.jsonl
```

### File Format

- **JSONL format:** One JSON object per line
- **Append-only:** Use `echo >> file` to append new findings
- **Write immediately:** After analyzing each page, before moving to next

### Writing Commands

**For broken links:**
```bash
echo '{"type":"broken_link","page":"[source_url]","target":"[target_url]","error":"[error_type]","timestamp":"[iso8601]"}' >> .audit-data/findings-broken-links.jsonl
```

**For spelling issues:**
```bash
echo '{"type":"spelling","page":"[page_url]","word":"[misspelled]","suggestion":"[correction]","context":"[context_snippet]","timestamp":"[iso8601]"}' >> .audit-data/findings-spelling.jsonl
```

### Benefits of Progressive Writing

- **Memory efficient:** No need to store thousands of findings in context
- **Crash resilient:** Findings are preserved even if crawl is interrupted
- **Real-time monitoring:** User can `tail -f` files to watch progress
- **Incremental processing:** Report generation can start before crawl completes
