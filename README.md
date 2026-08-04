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
  priority, status, statusAt, resolvedAt, author, url, page, anchor, replies,
  createdAt).
- Preferences: theme (`redpenTheme`), panel width (`redpenWidth`), remembered
  add-form type/priority (`redpen.addPrefs`), custom note types
  (`redpen.customTypes`), custom pin colour (`redpen.pinColor`), your display
  name (`redpen.author`).
- Hub connection (if you use it): `redpen.hub.url`, `redpen.hub.token`,
  `redpen.hub.project`.
- Notes are scoped per page by `location.pathname`; the All-notes board shows every page.
- **If the store fills up**, the widget says so and offers an Export instead of
  dropping the note silently. Export, delete some notes, then carry on.

## On a phone

The panel becomes a bottom sheet below 600px, pin mode takes touch (tap to pin,
drag to scroll), and inputs are 16px so iOS does not zoom the page on focus.

## Working with someone else

Set **Your name** in Settings and this browser stamps it on the notes and
replies you add, so two people reviewing the same page can tell their notes
apart. It is blank until you set it. There are no accounts - notes still live in
each browser, so share them with Export / Import or push them to a Red Pen Hub.

## Status

Full history in [CHANGELOG.md](CHANGELOG.md).

v0.1.0 - phone support and a second reviewer. Narrow viewports get a bottom
sheet with 36px+ tap targets, `env(safe-area-inset-bottom)` and a 16px input
floor (so iOS stops zooming); pin mode takes touch, where a tap pins and a drag
scrolls. Orphaned pins are surfaced instead of silently hidden, a full
localStorage reports the failure instead of discarding the note, a
`MutationObserver` keeps pins honest through SPA re-renders, and notes carry an
`author` you set once in Settings. Notes now send `statusAt`, `resolvedAt` and
`typeLabel` to the Hub.

v0.0.14 - fixed note cards squishing (and their action rows becoming
unclickable) once the list overflowed the panel's max-height.

v0.0.13 - fixed the Hub status colours never rendering (a plain inline style
lost to the sheet's `!important` `.rp-help` colour), and added `form` to the
armor element list.

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
