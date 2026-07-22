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
- Preferences: theme (`redpenTheme`), panel width (`redpenWidth`), remembered
  add-form type/priority (`redpen.addPrefs`), custom note types
  (`redpen.customTypes`), custom pin colour (`redpen.pinColor`).
- Hub connection (if you use it): `redpen.hub.url`, `redpen.hub.token`,
  `redpen.hub.project`.
- Notes are scoped per page by `location.pathname`; the All-notes board shows every page.

## Status

v0.0.12 - theme-proofing round two: the whole stylesheet now lives one ID
tier up (component rules scoped under the widget's mount-root IDs), so even
attribute-qualified site rules like `button[type="submit"] { ... !important }`
- which out-rank plain classes - cannot restyle the widget.

v0.0.11 - theme-proofing: the widget now holds its look on sites whose CSS
restyles bare elements (`button`, `p`, `a`, focus rings) with `!important`.
Every widget style is asserted at full strength, an armor layer pins the
typography properties components inherit, the generic state classes (`open`,
`on`, `active`, `set`, `resolved`, `progress`) are namespaced to `rp-*`, and
the Settings / Hub form controls moved from inline styles to armored classes.

v0.0.1 - floating button + panel, typed notes (note / idea / problem / question)
+ priority, per-page list, resolve / reopen / delete, click-to-pin with numbered
markers + Locate, dark mode, resizable panel, a cross-page All-notes board, and
JSON export / import. (Ported from the Express widget; localStorage backend.)

## Support

Red Pen is free and open. If it saves you time, you can back the next release.

- [Buy Me a Coffee](https://www.buymeacoffee.com/lincolntracy)
