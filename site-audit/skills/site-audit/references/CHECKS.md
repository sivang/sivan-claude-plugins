# Content Analysis Rules

This document defines the rules for analyzing page content during the Chrome-based crawl. It covers spelling/grammar analysis and broken link detection.

## Spelling & Grammar Analysis

**Objective:** Identify high-confidence spelling and grammar errors in page text content while avoiding false positives from technical terminology, code, and brand names.

### Analysis Process

1. **Get page text** using `get_page_text` tool on the current Chrome tab
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
```

## Broken Link Detection (Chrome-Based)

**Objective:** Identify internal same-domain links that lead to 404/error pages by actually navigating to them in Chrome.

### How It Works

Unlike fetch-based testing, this approach navigates the Chrome browser to each discovered URL and checks whether the resulting page is a 404 error page. This is the same experience a real user would have.

### Detection Method

After navigating to a URL in Chrome and waiting for page load:

1. **Check the tab title** (returned in tool responses):
   - Contains "404" → broken
   - Contains "not found" (case-insensitive) → broken
   - Starts with "undefined" (e.g., "undefined | SiteName") → broken
   - Contains "page not found" (case-insensitive) → broken

2. **Check the page text content** (from `get_page_text`):
   - Contains "404 ERROR" or "404 error" → broken
   - Contains "page you're looking for wasn't found" → broken
   - Contains "page not found" AND the page has minimal content → broken
   - Contains "Oops!" combined with "not found" or "404" → broken

3. **NOT broken indicators** (override the above):
   - Page has substantial content (multiple paragraphs, navigation, forms)
   - The "404" text is part of an article or documentation ABOUT error handling
   - Page title is a normal descriptive title (e.g., "About Us | Company")

### What Counts as a Source

When a broken link is detected, record WHERE the link was found:
- The `link_sources` map tracks which page each URL was first discovered on
- Source is the page whose DOM contained the `<a href="...">` pointing to the broken URL
- If the source is unknown, use "(seed)"

### Scope

- **Internal links only:** Same hostname as seed URL
- **Navigation-based detection:** Actually visit each URL in Chrome
- **No fetch/HEAD testing:** Never use JavaScript `fetch()` or HTTP HEAD requests to test links

### Finding Format

```json
{"type":"broken_link","page":"https://example.com/blog","target":"https://example.com/old-page","error":"404","timestamp":"2024-01-15T10:30:00Z"}
```

**Fields:**
- `type`: Always "broken_link"
- `page`: Source page URL (where the dead link was found in the DOM)
- `target`: The broken URL itself (the page that shows 404)
- `error`: Always "404" (since we're detecting error pages visually)
- `timestamp`: ISO 8601 timestamp when detected

## Progressive Writing

Findings must be written to disk **progressively** as the crawl proceeds.

### Storage Location

All findings are stored in `.audit-data/` directory:

```
.audit-data/
  findings-broken-links.jsonl
  findings-spelling.jsonl
```

### File Format

- **JSONL format:** One JSON object per line
- **Append-only:** Use `echo >> file` to append new findings
- **Write immediately:** After analyzing each page, before moving to next
