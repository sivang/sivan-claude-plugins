# UI Checks Reference

This document defines the rules for Chrome-based runtime UI checks. It covers console error detection, broken resource detection, and page load wait strategy.

## Console Error Detection

**Objective:** Capture runtime JavaScript errors and exceptions from each crawled page using Chrome DevTools console inspection.

### Tool

`mcp__claude-in-chrome__read_console_messages`

### Parameters

```json
{
  "tabId": "<tab_id>",
  "onlyErrors": true,
  "clear": true
}
```

- `onlyErrors: true` — Only return error-level messages (console.error, uncaught exceptions)
- `clear: true` — Clear console after reading to prevent cross-page contamination

### Classification

| Level | Source |
|-------|--------|
| `error` | console.error(), unhandled exceptions, runtime errors |
| `warning` | console.warn(), deprecation notices |

### Filtering Rules

**Ignore these patterns (not application errors):**

- Messages from `chrome-extension://` (browser extension noise)
- Favicon 404 errors (`favicon.ico` not found)
- Messages containing `[HMR]` or `[WDS]` (dev server hot reload)
- Empty or whitespace-only messages

**Keep these (real application errors):**

- Uncaught TypeError, ReferenceError, SyntaxError
- Failed API calls logged to console
- React/Vue/Angular framework errors
- Custom application error logging

### JSONL Format

```json
{"type":"console_error","page":"https://example.com/about","level":"error","message":"Uncaught TypeError: Cannot read property 'map' of undefined","timestamp":"2024-01-15T10:30:01Z"}
{"type":"console_error","page":"https://example.com/blog","level":"warning","message":"Deprecation: 'KeyboardEvent.keyCode' is deprecated","timestamp":"2024-01-15T10:31:22Z"}
```

**Fields:**
- `type`: Always `"console_error"`
- `page`: URL of the page where error was captured
- `level`: `"error"` or `"warning"`
- `message`: The console message text (truncated to 500 chars if longer)
- `timestamp`: ISO 8601 timestamp when captured

## Broken Resource Detection

**Objective:** Detect failed resource loads (images, scripts, styles, fonts) that indicate broken or missing assets on the page.

### Tool

`mcp__claude-in-chrome__read_network_requests`

### Parameters

```json
{
  "tabId": "<tab_id>",
  "clear": true
}
```

- `clear: true` — Clear network log after reading to prevent cross-page contamination

### Status Classification

| Status | Meaning |
|--------|---------|
| `>= 400` | HTTP error (404 Not Found, 500 Server Error, etc.) |
| `0` | Blocked, CORS failure, or network error (request never completed) |

**Note:** Status 200-399 are successful or redirect responses (not broken).

### Resource Type Detection

Classify resources by URL file extension:

| Extension | Resource Type |
|-----------|--------------|
| `.jpg`, `.jpeg`, `.png`, `.gif`, `.svg`, `.webp`, `.ico` | `image` |
| `.css` | `style` |
| `.js` | `script` |
| `.woff`, `.woff2`, `.ttf`, `.eot` | `font` |

If extension doesn't match any pattern, classify as `"other"`.

### Filtering Rules

**Ignore these (not broken resources):**

- Requests to `chrome-extension://` URLs
- Analytics/tracking requests (google-analytics, facebook pixel, etc.)
- Requests to different domains that are known third-party services
- Favicon requests already captured in console errors

**Keep these (real broken resources):**

- Same-domain resource failures (images, CSS, JS, fonts)
- CDN resources referenced by the page that fail to load
- Any resource that produces a visible rendering issue

### JavaScript Fallback for Images

For additional image verification, execute via JavaScript:

```javascript
Array.from(document.querySelectorAll('img')).filter(img =>
  img.src && (!img.complete || img.naturalWidth === 0)
).map(img => ({
  src: img.src,
  alt: img.alt || '(no alt)',
  parent: img.parentElement ? img.parentElement.tagName : 'unknown'
}))
```

This catches images that:
- Have `naturalWidth === 0` (failed to decode or load)
- Are still loading (`complete === false`) after page load wait

### JSONL Format

```json
{"type":"broken_resource","page":"https://example.com/about","resource_url":"https://example.com/images/team.jpg","resource_type":"image","status":"404","timestamp":"2024-01-15T10:30:01Z"}
{"type":"broken_resource","page":"https://example.com/blog","resource_url":"https://cdn.example.com/app.js","resource_type":"script","status":"0","timestamp":"2024-01-15T10:31:22Z"}
```

**Fields:**
- `type`: Always `"broken_resource"`
- `page`: URL of the page where broken resource was detected
- `resource_url`: The URL of the failed resource
- `resource_type`: One of `"image"`, `"script"`, `"style"`, `"font"`, `"other"`
- `status`: HTTP status code as string, or `"0"` for blocked/failed requests
- `timestamp`: ISO 8601 timestamp when detected

## Page Load Wait Strategy

**Objective:** Ensure page is fully loaded before running console and network checks, to capture all runtime errors and resource load failures.

### Wait Sequence

1. **Navigate** to target URL using Chrome tab navigation
2. **Wait 3 seconds** after navigation for initial page load
3. **Run checks** (console errors, network requests)
4. **Maximum 5 seconds** total wait per page (3s initial + 2s buffer if needed)

### Timing Rationale

- 3 seconds covers: DOM parse, CSS load, JS execution, API calls, image loads
- Additional 2 seconds (if needed): Late-loading resources, lazy-loaded content
- Beyond 5 seconds: Diminishing returns, page likely has performance issues itself

### Error Handling

| Scenario | Action |
|----------|--------|
| Navigation timeout (page won't load) | Log as console_error finding with message "Navigation timeout", skip page |
| Page returns HTTP error (404, 500) | Still check console/network (error pages may have their own issues), then continue |
| JavaScript execution error | Skip that specific check, continue with remaining checks |
| Empty page (no content) | Run checks normally (may catch resource errors), then continue |

### State Between Pages

**Critical:** Always clear state between pages to prevent cross-contamination:

- Use `clear: true` in `read_console_messages` — clears console after reading
- Use `clear: true` in `read_network_requests` — clears network log after reading
- Navigate to new page (replaces previous page content)

This ensures each page's findings are independent and accurately attributed.

## Progressive JSONL Writing

Same pattern as Phase 2: write findings immediately to disk after each page check.

### Storage Location

Files are created in the existing `.audit-data/` directory:

```
.audit-data/
  findings-console-errors.jsonl    (new in Phase 4)
  findings-broken-resources.jsonl  (new in Phase 4)
  findings-broken-links.jsonl      (from Phase 2)
  findings-spelling.jsonl          (from Phase 2)
```

### Writing Commands

**For console errors:**
```bash
echo '{"type":"console_error","page":"[url]","level":"[level]","message":"[msg]","timestamp":"[iso8601]"}' >> .audit-data/findings-console-errors.jsonl
```

**For broken resources:**
```bash
echo '{"type":"broken_resource","page":"[url]","resource_url":"[failed_url]","resource_type":"[type]","status":"[status]","timestamp":"[iso8601]"}' >> .audit-data/findings-broken-resources.jsonl
```

### Benefits

- **Memory efficient:** No need to store all findings in conversation context
- **Crash resilient:** Findings preserved even if audit is interrupted
- **Consistent:** Same pattern as Phase 2 (broken links, spelling) — familiar to the skill

## Visual Layout Checks

**Objective:** Detect visual layout problems (horizontal overflow, collapsed containers) using JavaScript-based DOM inspection. These checks catch CSS/rendering issues that are invisible to backend crawling.

### Tool

`javascript_tool` — Execute JavaScript on the current Chrome tab after navigation and wait period.

### Horizontal Overflow Detection

Find elements wider than the viewport, indicating broken layouts or CSS overflow issues.

```javascript
const vw = window.innerWidth;
Array.from(document.querySelectorAll('*')).filter(el => {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && (rect.right > vw + 5 || rect.left < -5);
}).map(el => ({
  tag: el.tagName,
  id: el.id || '(none)',
  class: el.className || '(none)',
  width: Math.round(el.getBoundingClientRect().width)
}))
```

**Threshold:** 5px tolerance to avoid false positives from sub-pixel rounding and scrollbar variations.

### Collapsed Container Detection

Find semantic containers that have children but zero height or width, indicating CSS collapse issues (missing clearfix, broken flexbox, etc.).

```javascript
Array.from(document.querySelectorAll('div, section, article, main, aside, nav'))
  .filter(el => {
    const rect = el.getBoundingClientRect();
    const hasChildren = el.children.length > 0;
    return hasChildren && (rect.height === 0 || rect.width === 0);
  })
  .map(el => ({
    tag: el.tagName,
    id: el.id || '(none)',
    class: el.className || '(none)',
    children: el.children.length,
    height: el.getBoundingClientRect().height,
    width: el.getBoundingClientRect().width
  }))
```

**Scope:** Only checks semantic containers (`div`, `section`, `article`, `main`, `aside`, `nav`). Empty containers (no children) are excluded since they may be intentionally hidden.

### Overlap Detection -- SKIP

Overlap detection (checking if elements visually overlap unintentionally) is deliberately excluded:

- **Performance:** O(n^2) comparison of all element pairs is too expensive for large pages
- **False positives:** Dropdowns, tooltips, modals, sticky headers, and overlays all produce intentional overlaps
- **Recommendation:** Skip overlap detection for skill-based checks; visual screenshot comparison is more appropriate for this class of issues

### Combined Check Function

A single JavaScript snippet that performs both overflow and collapsed container detection in one execution:

```javascript
(function checkLayout() {
  const vw = window.innerWidth;
  const overflows = Array.from(document.querySelectorAll('*'))
    .filter(el => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && (rect.right > vw + 5 || rect.left < -5);
    })
    .map(el => {
      const rect = el.getBoundingClientRect();
      return {
        issue: 'overflow',
        tag: el.tagName,
        id: el.id || '(none)',
        class: el.className || '(none)',
        width: Math.round(rect.width)
      };
    });

  const collapsed = Array.from(document.querySelectorAll('div, section, article, main, aside, nav'))
    .filter(el => {
      const rect = el.getBoundingClientRect();
      return el.children.length > 0 && (rect.height === 0 || rect.width === 0);
    })
    .map(el => {
      const rect = el.getBoundingClientRect();
      return {
        issue: 'collapsed',
        tag: el.tagName,
        id: el.id || '(none)',
        class: el.className || '(none)',
        children: el.children.length
      };
    });

  return { overflows, collapsed };
})();
```

**Returns:** Object with two arrays:
- `overflows`: Elements extending beyond viewport (each with `issue`, `tag`, `id`, `class`, `width`)
- `collapsed`: Zero-dimension containers with children (each with `issue`, `tag`, `id`, `class`, `children`)

### JSONL Format

```json
{"type":"visual_issue","page":"https://example.com/about","issue":"overflow","element":"DIV#hero.hero-banner","details":"width: 1450px","timestamp":"2024-01-15T10:30:01Z"}
{"type":"visual_issue","page":"https://example.com/blog","issue":"collapsed","element":"SECTION#content.main-content","details":"children: 5","timestamp":"2024-01-15T10:31:22Z"}
```

**Fields:**
- `type`: Always `"visual_issue"`
- `page`: URL of the page where issue was detected
- `issue`: One of `"overflow"` or `"collapsed"`
- `element`: Formatted as `TAG#id.class` (e.g., `DIV#sidebar.nav-wrapper`)
- `details`: For overflow: `"width: [N]px"`, for collapsed: `"children: [N]"`
- `timestamp`: ISO 8601 timestamp when detected

### Usage Notes

- Execute via `javascript_tool` after console/network checks complete (same tab, already navigated)
- Parse the returned object: iterate `overflows` array and `collapsed` array separately
- Format element string as `TAG#id.class` for human-readable identification
- Write each finding individually to JSONL (append pattern)
- Skip visual checks if page failed to load (navigation timeout logged in step 2)
- No additional wait needed: page is already loaded from the 3-second wait in step 3
