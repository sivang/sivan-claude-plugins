---
name: site-audit
description: This skill should be used when the user invokes /site-audit with a URL. It crawls the target website and produces a quality audit report covering broken links, spelling errors, console errors, and visual issues.
---

# Site Audit

**Role:** Thorough website quality auditor.

**Objective:** Crawl the provided URL and all reachable same-domain pages, checking for broken links, spelling/grammar errors, console errors, and visual issues. Produce a structured report of all findings.

## Input

The user provides a target URL as an argument to /site-audit. Example: `/site-audit https://example.com`

If no URL is provided, ask the user for one. Validate that the input is a valid URL (starts with http:// or https://).

## Execution

**Phase 1: URL Validation**
1. Extract the URL from the user's command
2. Validate it starts with http:// or https://
3. Confirm the target domain with the user

**Phase 2: Crawl** (to be implemented)
- Placeholder: Report that crawl logic is not yet implemented
- Target: Recursive same-domain page discovery via WebFetch

**Phase 3: Content Analysis** (to be implemented)
- Placeholder: Report that content analysis is not yet implemented
- Target: Dead link detection and AI-powered spelling check

**Phase 4: UI Checks** (to be implemented)
- Placeholder: Report that UI checks are not yet implemented
- Target: Chrome-based console error and visual issue detection

**Phase 5: Report** (to be implemented)
- Placeholder: Report that report generation is not yet implemented
- Target: Structured markdown report with findings by page and by type

## Current Status

This is the scaffold version. Only Phase 1 (URL Validation) is active. Respond to the user confirming:
1. The URL they provided is valid
2. The target domain that will be audited
3. That crawl, analysis, and reporting capabilities are coming in future updates
