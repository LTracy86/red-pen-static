# Red Pen (static / client-only)

A dev-mode review-notes overlay for **any website** - static HTML, a built SPA
(React/Vue/Svelte/Astro/Hugo/Jekyll output), a page opened via `file://`, or
anything hosted anywhere. One script tag, no server, no build, no dependencies.
Notes persist to the browser's `localStorage`; export/import JSON to move them.

The client-only sibling of the WP Red Pen plugin and the Express middleware -
same overlay, a different (browser-local) backend. Free, MIT. Dev credit: Lincoln Tracy / Tracy Digital Media LLC.

## Use

Add one line - ideally only in your dev build:

```html
<script src="red-pen.js"></script>
```

A red button appears bottom-right. Click it to leave typed notes on the page;
click **Pin** then an element to anchor a note to it (numbered markers, Locate);
**All notes** opens a cross-page board with Export / Import. Dark mode + a
resizable panel are in the panel header.

Because there's no server, notes live in `localStorage` (per browser, this
origin). Use **Export** to save them to a JSON file and **Import** to load them
elsewhere or share them.

### Keep it dev-only

This is a developer tool - don't ship the overlay to end users. Include the
script only in development (e.g., behind an env flag in your build), or load it
conditionally, e.g.:

```html
<script>if (location.hostname === 'localhost') {
  var s = document.createElement('script'); s.src = '/red-pen.js'; document.body.appendChild(s);
}</script>
```

## Try the demo

Open `example/index.html` in a browser (or serve the folder) and use the red button.

## Storage

- Key: `localStorage["redpen.notes.v1"]` - an array of notes (id, body, type,
  priority, status, url, page, anchor, createdAt).
- Theme (`redpenTheme`) and panel width (`redpenWidth`) are stored too.
- Notes are scoped per page by `location.pathname`; the All-notes board shows every page.

## Status

v0.0.1 - floating button + panel, typed notes (note / idea / problem / question)
+ priority, per-page list, resolve / reopen / delete, click-to-pin with numbered
markers + Locate, dark mode, resizable panel, a cross-page All-notes board, and
JSON export / import. (Ported from the Express widget; localStorage backend.)

## Support

Red Pen is free and open. If it saves you time, you can back the next release.

- [Buy Me a Coffee](https://www.buymeacoffee.com/lincolntracy)
- [GitHub Sponsors](https://github.com/sponsors/LTracy86)
