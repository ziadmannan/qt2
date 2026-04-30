# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Quran Revision Tracker (qt2) — a single-page Progressive Web App for tracking Quran memorization (hifz) revision progress. Built as a zero-dependency, fully offline static site.

## Architecture

Zero-dependency, fully offline static site with no build system, bundler, or package manager.

- **`index.html`** — Markup and page structure only; references `styles.css` and `app.js`
- **`styles.css`** — All CSS including dark mode via `prefers-color-scheme`
- **`app.js`** — All JavaScript: state management, rendering, swipe gestures, service worker registration
- **`sw.js`** — Service worker for offline caching (cache-first strategy)
- **`manifest.json`** — PWA manifest (standalone, portrait, green theme)
- **`surahs.json`** — Static data: 114 surahs with `id` and `name`
- **`docker-compose.yml`** — nginx:alpine dev server on port 8080
- **SVG icons** — `tick.svg`, `book.svg`, `restart.svg`, `filter.svg`, `manage.svg` — loaded dynamically via `loadIcons()`

## Data Model

All state persists in `localStorage`:
- **`hifzData`** — Array of `{id, revised, lastDate}` objects for surahs the user has added
- **`streakData`** — `{count, lastDate}` for consecutive-day streak tracking
- **`cycleStartDate`** — ISO date string for the current revision cycle
- **`showRevisedSetting`** — Boolean toggle for hiding already-revised surahs

## Key UI Patterns

- Swipe gestures on surah cards: swipe left to mark revised, swipe right to undo
- Bottom navigation bar with 3 actions: restart cycle, toggle revised visibility, manage surah list
- Toast notifications with undo action on surah revision
- Confetti animation fires when all surahs in a cycle are completed
- Dark mode via `prefers-color-scheme` media query (CSS custom properties)

## Development

Serve the root directory with any static file server. No build or compile step needed. Examples:

```bash
python3 -m http.server 8000
docker compose up
```

There are no tests, linter, or formatter configured.