# Phase 3 Research: Chrome UI Checks

## Overview

Phase 3 layers Chrome-based runtime checks on top of the pages discovered by Phase 2's BFS crawl. The skill instructs Claude to open each crawled page in Chrome and inspect for console errors, broken resources, and visual layout issues.

## 1. Iterating Over Discovered Pages

Phase 2's crawl loop maintains a `visited` set in conversation context. After crawl completion, this set contains all successfully-crawled URLs.

**Approach:** Phase 3 reads the visited set from crawl context and iterates:
- Use a single Chrome tab (reuse via navigate, not create new tabs per page)
- Process pages sequentially (parallel tabs would complicate state tracking)
- Track progress: `UI Check [N]/[total]: [url]`

**Tab Setup:**
```
1. Call tabs_context_mcp to get existing tab group
2. Call tabs_create_mcp to create one dedicated tab
3. Use this tab ID for all page navigations
```

## 2. Console Error Detection (UI-01)

**Tool:** `mcp__claude-in-chrome__read_console_messages`

**Strategy:**
1. Navigate to page
2. Wait 3-5 seconds for page load and async scripts
3. Read console messages with `onlyErrors: true` for errors/exceptions
4. Also read warnings separately with pattern `warn|warning`

**Classification:**
- `error` severity: console.error, unhandled exceptions, runtime errors
- `warning` severity: console.warn, deprecation notices

**Filtering:**
- Ignore browser extension noise (patterns like `chrome-extension://`)
- Ignore common benign errors (favicon 404 if already caught by resource check)
- Focus on application-level errors

**Key parameters:**
```json
{
  "tabId": "<tab_id>",
  "onlyErrors": true,
  "clear": true  // Clear after reading to avoid duplicates between pages
}
```

**JSONL Format:**
```json
{"type":"console_error","page":"[url]","level":"error|warning","message":"[msg]","timestamp":"[iso8601]"}
```

## 3. Broken Resource Detection (UI-02)

**Tool:** `mcp__claude-in-chrome__read_network_requests`

**Strategy:**
1. After page load (same navigation as console check)
2. Read network requests
3. Filter for failed requests (status >= 400 or status 0 for blocked/failed)
4. Classify by resource type based on URL extension or content-type

**Resource types to check:**
- Images: .jpg, .jpeg, .png, .gif, .svg, .webp, .ico
- Stylesheets: .css
- Scripts: .js
- Fonts: .woff, .woff2, .ttf, .eot

**Detection approach:**
- Network requests with HTTP error status (4xx, 5xx)
- Requests with status 0 (blocked, CORS, network error)
- For images specifically: can also use JavaScript to check `naturalWidth === 0` on img elements

**JavaScript fallback for images:**
```javascript
// Execute via javascript_tool
Array.from(document.querySelectorAll('img')).filter(img =>
  !img.complete || img.naturalWidth === 0
).map(img => ({ src: img.src, alt: img.alt }))
```

**Key parameters:**
```json
{
  "tabId": "<tab_id>",
  "clear": true  // Clear after reading for next page
}
```

**JSONL Format:**
```json
{"type":"broken_resource","page":"[url]","resource_url":"[failed_url]","resource_type":"image|script|style|font","status":"[http_status_or_error]","timestamp":"[iso8601]"}
```

## 4. Visual Layout Issue Detection (UI-03)

**Tool:** `mcp__claude-in-chrome__javascript_tool` + `mcp__claude-in-chrome__read_page`

**Strategy:** Use JavaScript execution to detect layout anomalies programmatically.

### 4a. Overlapping Elements

```javascript
// Find elements that overlap significantly
const elements = document.querySelectorAll('main *, article *, section *');
const overlaps = [];
const rects = Array.from(elements).map(el => ({
  el, rect: el.getBoundingClientRect()
})).filter(({rect}) => rect.width > 0 && rect.height > 0);

for (let i = 0; i < rects.length; i++) {
  for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i].rect, b = rects[j].rect;
    const overlapX = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const overlapY = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const overlapArea = overlapX * overlapY;
    const minArea = Math.min(a.width * a.height, b.width * b.height);
    if (overlapArea > minArea * 0.5) { // >50% overlap
      overlaps.push({...});
    }
  }
}
```

**Note:** This is computationally expensive. Limit to main content elements, not all DOM nodes. Sample approach is better for a skill.

### 4b. Elements Overflowing Viewport

```javascript
// Find elements wider than viewport
const vw = window.innerWidth;
Array.from(document.querySelectorAll('*')).filter(el => {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && (rect.right > vw + 5 || rect.left < -5);
}).map(el => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width }))
```

### 4c. Collapsed/Zero-Height Containers

```javascript
// Find containers that should have content but are collapsed
Array.from(document.querySelectorAll('div, section, article, main, aside, nav'))
  .filter(el => {
    const rect = el.getBoundingClientRect();
    const hasChildren = el.children.length > 0;
    return hasChildren && (rect.height === 0 || rect.width === 0);
  })
  .map(el => ({ tag: el.tagName, id: el.id, class: el.className, children: el.children.length }))
```

**Practical approach for the skill:**
Rather than running all three expensive checks, use a combined JavaScript snippet that checks:
1. Horizontal overflow (elements wider than viewport)
2. Collapsed containers (height=0 with children)
3. Skip overlap detection (too expensive, too many false positives)

**JSONL Format:**
```json
{"type":"visual_issue","page":"[url]","issue":"overflow|collapsed|overlap","element":"[tag#id.class]","details":"[description]","timestamp":"[iso8601]"}
```

## 5. Page Load Handling

**Wait strategy:**
- After navigate, use `computer` tool with `action: "wait"` for 3 seconds
- Then check if page loaded by reading page or running simple JS
- If page still loading, wait 2 more seconds (max 5s total)
- If page fails to load (navigation error), log and skip

**Error handling:**
- Navigation timeout: Skip page, log as finding
- JavaScript execution error: Skip that check, continue others
- Empty page (no content): Skip visual checks

## 6. State Management

**Single tab reuse pattern:**
1. Create one tab at start of Phase 3
2. Navigate to each page in sequence
3. Clear console and network state between pages (`clear: true`)
4. Track: pages_checked, console_errors_count, broken_resources_count, visual_issues_count

**State declaration (same pattern as Phase 2):**
- Every page: `UI Check [N]/[total]: [url] - [X] issues`
- Every 5 pages: Total findings by type

## 7. JSONL Files

Add to existing `.audit-data/` directory:
- `findings-console-errors.jsonl`
- `findings-broken-resources.jsonl`
- `findings-visual-issues.jsonl`

Initialize with `touch` at Phase 3 start.

## 8. Performance Considerations

- 50 pages × (navigate + wait + 3 checks) = significant time
- Each page takes ~5-10 seconds minimum (load + checks)
- Total: 4-8 minutes for 50 pages
- User should see progress indicators
- Consider: offer to limit UI checks to first N pages (configurable, default 50)

## 9. Anti-Patterns

1. **Don't create a new tab per page** — reuse one tab, navigate between pages
2. **Don't skip the wait** — pages need time to load scripts and resources
3. **Don't run overlap detection on all elements** — too expensive, O(n²) comparisons
4. **Don't accumulate all findings in context** — write to JSONL progressively
5. **Don't fail silently** — if a page fails to load, record it as a finding
6. **Don't check console before page fully loads** — errors from previous page may leak
7. **Don't forget to clear console/network between pages** — use `clear: true` parameter

## 10. Skill Structure Recommendation

Phase 3 in SKILL.md should have:
1. **Initialization:** Create tab, init JSONL files, get page list from Phase 2
2. **UI Check Loop:** For each page: navigate → wait → console check → network check → visual check → write findings → state update
3. **Completion:** Report totals, proceed to Phase 4 (Report)

Reference file: `references/UI_CHECKS.md` with:
- JavaScript snippets for visual checks
- Console message filtering rules
- Network request classification rules
