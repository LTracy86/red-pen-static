# Contributing to Red Pen (static)

Red Pen is free and open. Bug reports, fixes and small features are welcome.

## The one rule everything else follows from

**It is one file.** `red-pen.js` is the whole product. No build step, no
bundler, no dependencies, no npm install to make it work. Someone drops
`<script src="red-pen.js"></script>` into a page and it works. Every proposal
gets measured against that first:

- No imports, no `require`, no CDN links, no web fonts.
- ES5-flavoured, IIFE-scoped vanilla JS. Feature-detect anything newer
  (`typeof MutationObserver === 'function'`, `typeof fetch === 'function'`)
  rather than assuming it.
- No second file. Styles are a string injected into a `<style>` tag; markup is
  built in JS.

## Theme armor - read this before adding any UI

The widget lives inside somebody else's page, and that page may style bare
elements (`button {}`, `p {}`, `form {}`) with `!important`. Namespaced classes
cannot block element selectors, so the defense is layered:

1. **Every declaration in the sheet carries `!important`.** No exceptions.
2. **Every component rule is prefixed with `S`** - written as
   `S + '.rp-thing{...}'`. `S` is `:is(ROOTS) `, which puts component rules at
   specificity (1,1,0), above an attribute-qualified site rule at (0,1,1).
3. **`ROOTS` must list every element mounted at the top level.** If you mount a
   new element, add its id to `ROOTS` in the same commit. Two roots were once
   missing from that list and nothing armored them.
4. **The root rule resets the roots themselves.** The `:is(ROOTS) descendant`
   armor does not reach the roots, and `#rp-fab` is a `<button>` - a host page's
   `button{padding:30px!important}` inflated it until the root rule declared
   `padding:0`.

A bare `.rp-thing{...}` in the sheet is not armored and will be rejected.

Media queries follow the same rules: everything inside `@media` still needs the
`S` prefix and `!important`.

## Contracts with the rest of the Red Pen family

- **`statusAt`** must be stamped on every status change. Go through
  `stampStatus()`; never assign `n.status` directly. The Hub's conflict resolver
  compares `statusAt` against its own override timestamp, and a surface that
  does not send it gets force-reverted by one stale board-side click.
- **`resolvedAt`** is set on resolve and cleared on reopen - `stampStatus()`
  does both.
- **The Hub payload is built in exactly one place**, `hubRecord()`. Add fields
  there, not inline at the call site.
- **`author` is blank until the user sets a name.** Never synthesize one.

## Storage

- Everything is in `localStorage`; the keys are documented in the README.
- `saveAll()` returns a boolean. **Check it.** A full store used to throw
  `QuotaExceededError` into an empty `catch` and lose the note silently. A failed
  write must leave the user's input alone and must not let the in-memory list
  drift from what is actually persisted - re-read via `load()`.

## Verifying a change

There is no test runner (that would be a dependency). Verify against a
deliberately hostile host page - one that sets `button, input, select, textarea
{ font-size:40px!important; padding:30px!important; color:#0f0!important }` and
`div, span, p { line-height:5!important; letter-spacing:8px!important }` - and
check with `getComputedStyle` that the widget holds its own values. Check at a
360px viewport as well as a desktop one; headless Chromium in an iframe sized
360x740 gives a true narrow viewport (`--window-size` alone does not).

Worth walking through by hand for anything non-trivial: pin a note and reload,
delete the pinned element and confirm the orphan bar appears, fill localStorage
and confirm the failure is reported, and open the panel on a phone-width window.

## Dogfood copies

`red-pen.js` is copied verbatim into other projects that use it
(`elden-ring-tracker/`, `tarkov-tracker/`). After changing the canonical file,
refresh those copies so they stay md5-identical.

## Style

- **No emoji** anywhere - code, UI copy, commit messages or docs.
- Comments explain *why*, especially where a line looks redundant but is load
  bearing (the `!important` on `setProperty`, the observer's own-mutation guard).
- Commits: short, present tense, one logical change each.

## Versioning

`package.json` holds the version. Bump it and add a `CHANGELOG.md` entry in the
same commit. Versions start at 0.0.1; **1.0.0 means ready for a public release**.

## License

MIT. Credit: Lincoln Tracy / Tracy Digital Media LLC.
