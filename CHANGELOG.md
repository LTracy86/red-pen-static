# Changelog

All notable changes to Red Pen (static). Versions track `package.json`.
1.0.0 will mean "ready for a public release".

Entries for 0.0.13 and 0.0.14 were never written at the time; they are
reconstructed here from the commits that shipped them, not invented.

## 0.1.0 - 2026-08-04

The release that makes the widget usable on a phone and safe to share with a
second person.

### Added

- **Phone support.** The file had no media query at all: a fixed 344px panel at
  `right:20px` overflowed a 360px screen, and there were no touch handlers. Narrow
  viewports now get a bottom sheet (full width, anchored to the bottom edge,
  clear of `env(safe-area-inset-bottom)`), the All-notes board becomes a sheet
  too, tap targets grow to at least 36px, the FAB to 52px, and every input is
  floored at 16px so iOS stops zooming the page on focus.
- **Touch pin mode.** A tap pins, a drag scrolls. The overlay carries
  `touch-action:pan-y` so the browser keeps handling the pan natively, and a
  touch only counts as a pin if it moved less than 10px. There is no Esc key on
  a phone, so the hint doubles as the cancel target.
- **Orphaned pins are surfaced.** `positionPins()` already detected that an
  anchor no longer resolved, then hid the pin and discarded the finding, so a
  note could come unstuck with no way to notice. Orphans are now counted in a bar
  at the top of the panel, flagged on the note itself, and filterable. Nothing is
  deleted - a selector can stop resolving because the element went away or
  because this render has not produced it yet.
- **`author` on notes and replies.** There are no accounts here, so the user sets
  a display name once in Settings and this browser stamps it on everything it
  writes. It is blank until set, never faked. This is the change that admits a
  second person, and it fills a field the Hub board already carries.
- **`statusAt` on every status change**, plus `resolvedAt`, and `typeLabel` /
  `typeColor` / `replyCount` on Hub push. `statusAt` is the cross-surface
  contract field: the Hub's conflict resolver compares it with its own override
  timestamp, and a surface that does not send it gets its changes force-reverted
  by one stale board-side click.
- **A `MutationObserver`** so pins re-resolve when the DOM changes. Scroll and
  resize were the only triggers, so an SPA route change or a lazy-loaded section
  left every pin frozen at a stale coordinate. Debounced at 150ms, and mutations
  inside the widget are ignored so repainting the note list cannot re-trigger it.

### Fixed

- **A full localStorage no longer discards notes in silence.** `saveAll` threw
  `QuotaExceededError` into an empty `catch`. It now reports the failure with an
  Export shortcut, returns whether the write landed, and every caller checks:
  a failed save leaves the textarea and the pending pin untouched, and the UI
  re-reads the store so what is on screen matches what is on disk.
- **The widget's own mount roots were not armored.** The armor rule only reached
  *descendants* of the roots, so `#rp-fab` - a `<button>` - was inflated from
  46px to 60px by a host page's `button{padding:30px!important}`. The root rule
  now carries the reset properties, and `#rp-loc` and `#rp-pinhl`, which were
  mounted but missing from the root list entirely, were added to it.

### Changed

- **The armor root list is hoisted into `ROOTS` and `S`.** It appeared verbatim
  88 times in the stylesheet, which made adding a mount root - or adding UI that
  forgets the prefix - the easy way to lose the theme armor. The generated
  stylesheet is byte-for-byte identical after the hoist.
- **The Hub push mapper is one `hubRecord()` serializer** instead of an inline
  object literal, so a new field cannot land in one code path and be missing from
  another.
- Added `CHANGELOG.md` and `CONTRIBUTING.md`.

## 0.0.14 - 2026-07-29

- Fixed note cards squishing when the list overflowed the panel. Children of the
  panel, the All-notes card and both note lists inherited `flex-shrink:1` from
  their flex-column parents, so once the notes exceeded the panel's max-height
  the browser compressed every card past its content height and the
  Locate / Edit / Delete rows overlapped and became unclickable. `flex:none` on
  the non-scrolling children and `min-height:0` on the two scroll containers.

## 0.0.13 - 2026-07-22

- Fixed dead Hub status colours: `hubStatus()` set its state colour with a plain
  inline style, which loses to the sheet's `!important` `.rp-help` colour, so the
  error red and success green never rendered.
- Added `form` to the armor element list - the reply form is a `<form>`, so a
  host page's `form{margin}` reset could leak in.
- Manual refreshed and the PDF regenerated.

## 0.0.12 - 2026-07-21

- Theme-proofing round two: the whole stylesheet moved one ID tier up (component
  rules scoped under the widget's mount-root IDs), so even attribute-qualified
  site rules like `button[type="submit"]{ ... !important }` - which out-rank
  plain classes - cannot restyle the widget.

## 0.0.11 - 2026-07-21

- Theme-proofing: every widget style asserted at full strength, an armor layer
  pinning the typography properties components inherit, generic state classes
  namespaced to `rp-*`, and the Settings / Hub form controls moved from inline
  styles to armored classes.

## 0.0.1

- Floating button and panel, typed notes (note / idea / problem / question) plus
  priority, per-page list, resolve / reopen / delete, click-to-pin with numbered
  markers and Locate, dark mode, resizable panel, a cross-page All-notes board,
  and JSON export / import. Ported from the Express widget, localStorage backend.
