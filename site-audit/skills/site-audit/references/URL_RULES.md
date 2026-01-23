# URL Normalization and Classification Rules

This file defines how to normalize, classify, and filter URLs during the crawl process.

## URL Normalization Rules (RFC 3986)

Apply these rules in order to every URL before adding to queue or visited set:

1. **Lowercase scheme and host** — Convert `HTTP://EXAMPLE.COM/Path` to `http://example.com/Path` (path stays case-sensitive)

2. **Remove fragment identifiers** — Convert `https://example.com/page#section` to `https://example.com/page`

3. **Remove trailing slash for non-root paths** — Convert `https://example.com/about/` to `https://example.com/about` (but keep `https://example.com/`)

4. **Keep root trailing slash** — `https://example.com/` remains `https://example.com/` (root path always has trailing slash)

5. **Remove default ports** — Convert `https://example.com:443/page` to `https://example.com/page` and `http://example.com:80/page` to `http://example.com/page`

6. **Decode unreserved percent-encoded characters** — Convert `https://example.com/hello%20world` to `https://example.com/hello world` (only unreserved: A-Z a-z 0-9 - _ . ~)

7. **Prefer HTTPS when both protocols encountered** — If both `http://example.com/page` and `https://example.com/page` exist, use HTTPS version only

## Same-Domain Classification

To determine if a URL should be crawled (same-domain) or just recorded (external):

1. **Extract hostname** from normalized URL
2. **Compare with seed hostname** using strict matching
3. **www is significant** — `www.example.com` ≠ `example.com`
4. **If seed has www.**, only `www.example.com` URLs match
5. **If seed has no www.**, only `example.com` URLs match (not `www.example.com`)

Example:
- Seed: `https://www.example.com/` → Only crawl `www.example.com` pages
- Seed: `https://example.com/` → Only crawl `example.com` pages (not www)

## URL Skip Rules

Skip these URLs entirely (don't crawl, don't record as external):

### Skip by Scheme
- `mailto:` links
- `tel:` links
- `javascript:` links
- `data:` links
- Any non-http/https scheme

### Skip by Extension
- `.pdf` — PDF documents
- `.jpg`, `.jpeg`, `.png`, `.gif`, `.svg`, `.webp` — Images
- `.css` — Stylesheets
- `.js` — JavaScript files
- `.ico` — Favicons
- `.zip`, `.tar`, `.gz` — Archives
- `.mp4`, `.mov`, `.avi` — Videos
- `.mp3`, `.wav` — Audio

### Skip by Pattern
- Fragment-only links: `#section` (relative fragment with no path)
- Empty href: `href=""`
- Same-page references: URLs that normalize to current page URL

## Chrome DOM Link Extraction

Links are extracted from the DOM using JavaScript executed on the Chrome tab:

```javascript
(function() {
  const links = Array.from(document.querySelectorAll('a[href]'))
    .map(a => ({ href: a.href, text: a.textContent.trim().substring(0, 50) }))
    .filter(l => l.href && !l.href.startsWith('javascript:') && !l.href.startsWith('mailto:') && !l.href.startsWith('tel:'));
  return JSON.stringify(links);
})()
```

**Key behavior:**
- `a.href` returns the **fully resolved absolute URL** (browser handles relative resolution)
- No need to manually resolve relative URLs — the browser does this automatically
- The extracted URLs are the exact same URLs a user would navigate to by clicking the link
- If JavaScript execution is blocked (e.g., by CSP), skip link extraction for that page — do NOT guess URLs
