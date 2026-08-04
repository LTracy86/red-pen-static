/* Red Pen (static / client-only) - a dev review-notes overlay for ANY website.
   Drop in <script src="red-pen.js"></script>. No server, no build, no deps.
   Notes persist to localStorage (per-browser); export/import JSON to move them.
   Dev-only: include the script in dev builds only. Vanilla JS. */
(function () {
  if (window.__redPenLoaded) return;
  window.__redPenLoaded = true;

  var PAGE = location.pathname;
  var STORE_KEY = 'redpen.notes.v1';     // all notes, all pages
  var THEME_KEY = 'redpenTheme';
  var WIDTH_KEY = 'redpenWidth';
  var HUB_URL_KEY = 'redpen.hub.url';      // optional: push notes to a Red Pen Hub
  var HUB_TOKEN_KEY = 'redpen.hub.token';
  var HUB_PROJECT_KEY = 'redpen.hub.project';
  var TYPES = { note: 'Note', bug: 'Problem', suggestion: 'Idea', question: 'Question' };
  var STATUSES = { open: 'Open', progress: 'In Progress', resolved: 'Resolved' };
  var PREFS_KEY = 'redpen.addPrefs';       // remembered type/priority for the add form
  var CUSTOM_TYPES_KEY = 'redpen.customTypes'; // raw "Label|#hex" lines (user-defined note types)
  var PIN_COLOR_KEY = 'redpen.pinColor';   // custom hex for the numbered pins ('' = app red)
  var AUTHOR_KEY = 'redpen.author';        // display name stamped on notes + replies
  var RED = '#D32F2F';
  var AMBER = '#E8A100';                    // In Progress accent (mirrors the WP plugin)
  var HEX_RE = /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/;
  // Normalise any stored status to a known key ('open' | 'progress' | 'resolved').
  function statusKey(n) { var s = n && n.status; return (s === 'resolved' || s === 'progress') ? s : 'open'; }
  // User-defined note types: { ct_slug: { label, color } }, parsed from "Label|#hex" lines.
  function customTypes() {
    var raw = ''; try { raw = localStorage.getItem(CUSTOM_TYPES_KEY) || ''; } catch (e) {}
    var out = {};
    raw.split(/\r\n|\r|\n/).forEach(function (line) {
      line = line.trim(); if (!line) return;
      var parts = line.split('|');
      var label = parts[0].trim(); if (!label) return;
      var slug = 'ct_' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      if (slug === 'ct_') return;
      var color = (parts[1] || '').trim();
      out[slug] = { label: label, color: HEX_RE.test(color) ? color : '' };
    });
    return out;
  }
  function typeLabel(t) { var c = customTypes(); return (c[t] && c[t].label) || TYPES[t] || 'Note'; }
  function typeColor(t) { var c = customTypes(); return (c[t] && c[t].color) || ''; }
  function pinColor() { var v = ''; try { v = (localStorage.getItem(PIN_COLOR_KEY) || '').trim(); } catch (e) {} return HEX_RE.test(v) ? v : ''; }
  // There are no accounts here, so identity is one name the user sets once and
  // this browser stamps on everything it writes. It is the whole difference
  // between a private scratchpad and a page two people can review together.
  function authorName() { var v = ''; try { v = (localStorage.getItem(AUTHOR_KEY) || '').trim(); } catch (e) {} return v.slice(0, 60); }
  // Every status change goes through here: `statusAt` is the cross-surface
  // contract field the Hub's conflict resolver compares against its own override
  // timestamp. Without it one stale board-side click keeps force-reverting every
  // later change made on this page.
  function stampStatus(n, status, resolvedAt) {
    n.status = status;
    n.statusAt = new Date().toISOString();
    if (status === 'resolved') { if (!n.resolvedAt) { n.resolvedAt = resolvedAt || new Date().toISOString(); } }
    else { delete n.resolvedAt; }
    return n;
  }

  // ---- styles ----
  // Host-page armor: the widget lives inside the host page, so site rules that
  // style bare elements (button{}, p{}, a{} - often with !important) match our
  // DOM too; namespaced classes cannot block element selectors. Defense:
  // every declaration in this sheet carries !important (the widget wins any
  // property it declares), and the two armor rules below pin the typography/
  // reset properties the component rules do not declare. The whole sheet
  // lives one ID tier up: component rules are scoped :is(#roots) .rp-x
  // (1,1,0) and the second armor rule sits just under them at (1,0,1), so
  // even attribute-qualified site rules like button[type="submit"]{...
  // !important} (0,1,1 - out-ranks a bare class) lose to both layers.
  // Do not add display here - it is toggled from JS/classes.
  // Known residual gap: rem/vh units track the host page's root sizing.
  //
  // ROOTS is every element we mount at the top level, and S is the ID-tier
  // prefix every component rule must carry. They are hoisted into variables
  // because the list appeared verbatim 88 times: adding a mount root, or a new
  // piece of UI that forgets the prefix, is how a hostile host page gets a foot
  // in the door. Keeping it in one place makes the armor a one-line change.
  // ANY new UI added below must be written as `S + '.rp-thing{...}'`, with
  // !important on every declaration - a bare `.rp-thing{}` is not armored.
  var ROOTS = '#rp-fab,#rp-panel,#rp-pinlayer,#rp-pinmode,#rp-hint,#rp-toast,#rp-allmodal';
  var S = ':is(' + ROOTS + ') ';
  var css = '\
  ' + ROOTS + '{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;font-size:13px!important;line-height:1.4!important;letter-spacing:normal!important;text-transform:none!important;text-align:left!important;text-shadow:none!important}\
  ' + S + ':is(a,button,select,textarea,input,label,form,p,span,div,ul,ol,li,img,svg,h1,h2,h3,h4,h5,h6){transform:none!important;font-family:inherit!important;font-size:inherit!important;font-weight:inherit!important;font-style:inherit!important;line-height:inherit!important;color:inherit!important;letter-spacing:inherit!important;text-transform:inherit!important;text-shadow:none!important;text-decoration:none!important;box-shadow:none!important;border:none!important;margin:0!important;padding:0!important;min-width:0!important;min-height:0!important;float:none!important;list-style:none!important}\
  #rp-fab{position:fixed!important;right:20px!important;bottom:20px!important;z-index:2147483000!important;width:46px!important;height:46px!important;border-radius:50%!important;border:none!important;background:' + RED + '!important;color:#fff!important;font-size:20px!important;cursor:pointer!important;box-shadow:0 4px 14px rgba(211,47,47,.45)!important;display:flex!important;align-items:center!important;justify-content:center!important}\
  #rp-fab:hover{background:#b71c1c!important}\
  #rp-fab #rp-badge{position:absolute!important;top:-4px!important;right:-4px!important;min-width:18px!important;height:18px!important;padding:0 4px!important;border-radius:9px!important;background:#fff!important;color:' + RED + '!important;font:700 11px/18px sans-serif!important;text-align:center!important;box-shadow:0 1px 3px rgba(0,0,0,.3)!important}\
  #rp-panel{position:fixed!important;right:20px!important;bottom:78px!important;z-index:2147483000!important;width:344px!important;max-height:74vh!important;display:none!important;flex-direction:column!important;background:#fff!important;color:#1e2225!important;border-radius:8px!important;box-shadow:0 8px 30px rgba(0,0,0,.28)!important;font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;overflow:hidden!important}\
  #rp-panel.rp-open{display:flex!important}\
  ' + S + '.rp-head{display:flex!important;align-items:center!important;gap:.4rem!important;padding:.6rem .75rem!important;background:' + RED + '!important;color:#fff!important;font-weight:600!important}\
  ' + S + '.rp-head .rp-nib{width:14px!important;height:14px!important;flex:none!important}\
  ' + S + '.rp-head .rp-repo{margin-left:auto!important;color:#fff!important;font-size:12px!important;font-weight:500!important;text-decoration:underline!important;cursor:pointer!important;background:none!important;border:none!important}\
  ' + S + '.rp-close{background:none!important;border:none!important;color:#fff!important;font-size:18px!important;cursor:pointer!important;line-height:1!important;padding:0 .1rem!important}\
  ' + S + '.rp-list{flex:1!important;min-height:0!important;overflow-y:auto!important;padding:.5rem .6rem!important;display:flex!important;flex-direction:column!important;gap:.45rem!important}\
  /* Anti-squish: every non-scrolling child of a flex column (panel, all-notes card,\
     and the note lists themselves) must not shrink. Without flex:none the browser\
     compresses them past their content height once the list overflows the panel\
     max-height, and the note action rows collapse under each other. */\
  ' + S + ':is(.rp-head,.rp-add,.rp-box,.rp-allhead,.rp-alltabs,.rp-allfilters,.rp-bulkbar,.rp-note,.rp-allnote,.rp-empty){flex:none!important}\
  ' + S + '.rp-empty{color:#888!important;text-align:center!important;padding:1rem 0!important}\
  ' + S + '.rp-note{border:1px solid #e6e9ec!important;border-left:3px solid ' + RED + '!important;border-radius:5px!important;padding:.4rem .5rem!important}\
  ' + S + '.rp-note.rp-resolved{opacity:.6!important;border-left-color:#9aa0a6!important}\
  ' + S + '.rp-note.rp-progress{border-left-color:' + AMBER + '!important}\
  ' + S + '.rp-status{border:1px solid #d4d7da!important;border-radius:4px!important;background:#fff!important;color:#444!important;font:inherit!important;font-size:12px!important;padding:.05rem .2rem!important;cursor:pointer!important}\
  ' + S + '.rp-status:hover{border-color:' + RED + '!important}\
  ' + S + '.rp-meta{display:flex!important;gap:.35rem!important;align-items:center!important;margin-bottom:.25rem!important;font-size:12px!important}\
  ' + S + '.rp-num{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:16px!important;height:16px!important;padding:0 3px!important;border-radius:8px!important;background:' + RED + '!important;color:#fff!important;font:700 10px/16px sans-serif!important}\
  ' + S + '.rp-tag{background:#f1f1f3!important;border-radius:3px!important;padding:.02rem .3rem!important}\
  ' + S + '.rp-tag.bug{color:#c62828!important}' + S + '.rp-tag.suggestion{color:#1565c0!important}' + S + '.rp-tag.question{color:#9a6a00!important}\
  ' + S + '.rp-prio.high{color:' + RED + '!important;font-weight:700!important}\
  ' + S + '.rp-when{margin-left:auto!important;color:#999!important}\
  ' + S + '.rp-body{white-space:pre-wrap!important;word-break:break-word!important}\
  ' + S + '.rp-acts{display:flex!important;gap:.4rem!important;margin-top:.3rem!important;flex-wrap:wrap!important;align-items:center!important}\
  ' + S + '.rp-acts button{background:none!important;border:none!important;color:#666!important;cursor:pointer!important;padding:.1rem .2rem!important;font-size:12px!important}\
  ' + S + '.rp-acts button:hover{color:' + RED + '!important}\
  ' + S + '.rp-replies{margin-top:.4rem!important;border-top:1px dashed #e6e9ec!important;padding-top:.4rem!important;display:flex!important;flex-direction:column!important;gap:.3rem!important}\
  ' + S + '.rp-reply{font-size:12px!important;padding:.2rem .4rem!important;background:#f3f5f6!important;border-radius:4px!important}\
  ' + S + '.rp-reply-meta{font-size:11px!important;color:#999!important;margin-bottom:.1rem!important}\
  ' + S + '.rp-reply-body{white-space:pre-wrap!important;word-break:break-word!important}\
  ' + S + '.rp-replyform{display:flex!important;gap:.3rem!important}\
  ' + S + '.rp-replytext{flex:1!important;min-width:0!important;border:1px solid #d4d7da!important;border-radius:4px!important;padding:.25rem .4rem!important;font:inherit!important;font-size:12px!important;resize:vertical!important;box-sizing:border-box!important}\
  ' + S + '.rp-replysend{background:#fff!important;border:1px solid #d4d7da!important;border-radius:4px!important;color:#444!important;font:inherit!important;font-size:12px!important;padding:.2rem .55rem!important;cursor:pointer!important;white-space:nowrap!important}\
  ' + S + '.rp-replysend:hover{border-color:' + RED + '!important;color:' + RED + '!important}\
  ' + S + '.rp-replycount{font-size:11.5px!important;color:#888!important;margin-top:.25rem!important}\
  #rp-panel.rp-dark .rp-replies{border-top-color:#3a3f44!important}\
  #rp-panel.rp-dark .rp-reply{background:#1f2327!important}\
  #rp-panel.rp-dark .rp-reply-meta,#rp-panel.rp-dark .rp-replycount{color:#9aa0a6!important}\
  #rp-panel.rp-dark .rp-replytext,#rp-panel.rp-dark .rp-replysend{background:#1a1d20!important;color:#e6e9ec!important;border-color:#3a3f44!important}\
  #rp-allmodal.rp-dark .rp-reply{background:#1f2327!important}\
  #rp-allmodal.rp-dark .rp-replycount{color:#9aa0a6!important}\
  ' + S + '.rp-add{border-top:1px solid #eee!important;padding:.55rem .6rem!important;display:flex!important;flex-direction:column!important;gap:.4rem!important}\
  ' + S + '.rp-add textarea{width:100%!important;box-sizing:border-box!important;resize:vertical!important;min-height:46px!important;border:1px solid #d4d7da!important;border-radius:4px!important;padding:.4rem!important;font:inherit!important}\
  ' + S + '.rp-add .rp-row{display:flex!important;gap:.4rem!important;align-items:center!important}\
  ' + S + '.rp-add select{border:1px solid #d4d7da!important;border-radius:4px!important;padding:.2rem!important}\
  ' + S + '.rp-add .rp-grow{flex:1!important}\
  ' + S + '.rp-pinbtn{background:#f1f1f3!important;border:1px solid #d4d7da!important;border-radius:4px!important;padding:.2rem .5rem!important;cursor:pointer!important;font:inherit!important;color:#444!important}\
  ' + S + '.rp-pinbtn.rp-set{background:' + RED + '!important;color:#fff!important;border-color:' + RED + '!important}\
  ' + S + '.rp-save{background:' + RED + '!important;color:#fff!important;border:none!important;border-radius:14px!important;padding:.35rem .9rem!important;cursor:pointer!important}\
  ' + S + '.rp-save:hover{background:#b71c1c!important}\
  ' + S + '.rp-box{flex-direction:column!important;gap:.4rem!important;padding:.55rem .8rem!important;border-bottom:1px solid #eee!important}\
  ' + S + '.rp-b{font-weight:600!important}\
  ' + S + '.rp-help{font-size:12px!important;color:#888!important;font-weight:400!important}\
  ' + S + '.rp-lbl{font-size:12px!important;display:flex!important;flex-direction:column!important;gap:.2rem!important}\
  ' + S + '.rp-lblrow{font-size:12px!important;display:flex!important;align-items:center!important;gap:.4rem!important}\
  ' + S + '.rp-field{box-sizing:border-box!important;width:100%!important;border:1px solid #d4d7da!important;border-radius:4px!important;padding:.35rem!important;font:inherit!important}\
  ' + S + '.rp-mono{font-family:ui-monospace,Menlo,Consolas,monospace!important;font-size:12px!important}\
  ' + S + '.rp-ghostbtn{background:none!important;border:1px solid #d4d7da!important;border-radius:14px!important;padding:.35rem .8rem!important;cursor:pointer!important;color:#444!important}\
  ' + S + '.rp-hubrow{display:flex!important;gap:.5rem!important;align-items:center!important}\
  #rp-pinlayer{position:fixed!important;inset:0!important;z-index:2147482000!important;pointer-events:none!important}\
  ' + S + '.rp-pin{position:fixed!important;transform:translate(-50%,-50%)!important;min-width:22px!important;height:22px!important;padding:0 5px!important;border-radius:11px!important;background:' + RED + '!important;color:#fff!important;border:2px solid #fff!important;box-shadow:0 2px 6px rgba(0,0,0,.4)!important;font:700 11px/1 sans-serif!important;display:flex!important;align-items:center!important;justify-content:center!important;cursor:pointer!important;pointer-events:auto!important;box-sizing:border-box!important}\
  ' + S + '.rp-pin.rp-resolved{background:#9aa0a6!important}\
  ' + S + '.rp-pin.rp-progress{background:' + AMBER + '!important}\
  ' + S + '.rp-pin:hover{filter:brightness(.9)!important}\
  #rp-pinmode{position:fixed!important;inset:0!important;z-index:2147483600!important;cursor:crosshair!important;background:rgba(211,47,47,.06)!important}\
  #rp-pinhl{position:fixed!important;z-index:2147483500!important;border:2px solid ' + RED + '!important;background:rgba(211,47,47,.12)!important;pointer-events:none!important;box-sizing:border-box!important;display:none!important}\
  #rp-hint{position:fixed!important;top:14px!important;left:50%!important;transform:translateX(-50%)!important;z-index:2147483700!important;background:#1e2225!important;color:#fff!important;font:13px/1 -apple-system,sans-serif!important;padding:.5rem .9rem!important;border-radius:6px!important;pointer-events:none!important}\
  #rp-loc{position:fixed!important;z-index:2147482500!important;border:3px solid ' + RED + '!important;border-radius:4px!important;background:rgba(211,47,47,.08)!important;box-shadow:0 0 0 2px rgba(255,255,255,.5)!important;pointer-events:none!important;transition:opacity .3s!important;display:none!important}\
  ' + S + '.rp-theme{background:none!important;border:none!important;color:#fff!important;font-size:15px!important;cursor:pointer!important;line-height:1!important;padding:0 .15rem!important}\
  #rp-panel.rp-dark{background:#23272b!important;color:#e6e9ec!important}\
  #rp-panel.rp-dark .rp-note{background:#2a2f34!important;border-color:#3a3f44!important}\
  #rp-panel.rp-dark .rp-note.rp-resolved{border-left-color:#6b7177!important}\
  #rp-panel.rp-dark .rp-tag{background:#3a3f44!important;color:#e6e9ec!important}\
  #rp-panel.rp-dark .rp-when,#rp-panel.rp-dark .rp-empty{color:#9aa0a6!important}\
  #rp-panel.rp-dark .rp-add{border-top-color:#3a3f44!important}\
  #rp-panel.rp-dark textarea,#rp-panel.rp-dark select,#rp-panel.rp-dark input[type="text"]{background:#1a1d20!important;color:#e6e9ec!important;border-color:#3a3f44!important}\
  #rp-panel.rp-dark .rp-pinbtn{background:#3a3f44!important;color:#e6e9ec!important;border-color:#4a4f55!important}\
  #rp-panel.rp-dark .rp-acts button{color:#9aa0a6!important}\
  #rp-panel.rp-dark .rp-status{background:#1a1d20!important;color:#e6e9ec!important;border-color:#3a3f44!important}\
  ' + S + '.rp-editbar{display:none!important;align-items:center!important;justify-content:space-between!important;gap:.5rem!important;font-size:12px!important;color:' + RED + '!important;background:#fff4f4!important;border:1px solid #f3c0c0!important;border-radius:5px!important;padding:.25rem .5rem!important;margin-bottom:.4rem!important}\
  ' + S + '.rp-editbar.rp-on{display:flex!important}\
  ' + S + '.rp-editbar button{background:none!important;border:none!important;color:#666!important;text-decoration:underline!important;cursor:pointer!important;font:inherit!important}\
  ' + S + '.rp-editbar button:hover{color:' + RED + '!important}\
  #rp-panel.rp-dark .rp-editbar{background:#3a2526!important;border-color:#6b3a3c!important;color:#ff8a80!important}\
  #rp-toast{position:fixed!important;left:50%!important;bottom:78px!important;transform:translateX(-50%)!important;z-index:2147483900!important;background:#b71c1c!important;color:#fff!important;font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important;padding:.45rem .8rem!important;border-radius:6px!important;box-shadow:0 4px 14px rgba(0,0,0,.4)!important;max-width:80vw!important;display:none!important;align-items:center!important;gap:.6rem!important}\
  #rp-toast.rp-on{display:flex!important}\
  ' + S + '.rp-toast-btn{background:none!important;border:1px solid rgba(255,255,255,.55)!important;color:#fff!important;border-radius:4px!important;font:inherit!important;font-size:12px!important;font-weight:600!important;padding:.1rem .5rem!important;cursor:pointer!important}\
  ' + S + '.rp-toast-btn:hover{background:rgba(255,255,255,.18)!important}\
  ' + S + '.rp-resize{position:absolute!important;left:0!important;top:0!important;width:8px!important;height:100%!important;cursor:ew-resize!important;z-index:5!important}\
  ' + S + '.rp-resize::before{content:""!important;position:absolute!important;left:2px!important;top:50%!important;transform:translateY(-50%)!important;width:3px!important;height:34px!important;border-radius:2px!important;background:#cfd4d8!important;transition:background .12s!important}\
  ' + S + '.rp-resize:hover::before{background:' + RED + '!important}\
  #rp-panel.rp-dark .rp-resize::before{background:#4a4f55!important}\
  #rp-allmodal{position:fixed!important;inset:0!important;z-index:2147483800!important;background:rgba(0,0,0,.45)!important;display:none!important;align-items:center!important;justify-content:center!important;font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif!important}\
  #rp-allmodal.rp-open{display:flex!important}\
  ' + S + '.rp-allcard{background:#fff!important;color:#1e2225!important;width:600px!important;max-width:92vw!important;max-height:82vh!important;border-radius:8px!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;box-shadow:0 12px 40px rgba(0,0,0,.4)!important}\
  ' + S + '.rp-allhead{display:flex!important;align-items:center!important;gap:.4rem!important;padding:.6rem .8rem!important;background:' + RED + '!important;color:#fff!important;font-weight:600!important}\
  ' + S + '.rp-allhead .rp-grow{flex:1!important}\
  ' + S + '.rp-allhead button{background:rgba(255,255,255,.16)!important;border:1px solid rgba(255,255,255,.45)!important;color:#fff!important;border-radius:5px!important;padding:.2rem .55rem!important;cursor:pointer!important;font:inherit!important;font-size:12px!important}\
  ' + S + '.rp-allhead button.rp-x{background:none!important;border:none!important;font-size:18px!important;padding:0 .15rem!important}\
  ' + S + '.rp-alltabs{display:flex!important;gap:.3rem!important;padding:.4rem .8rem 0!important}\
  ' + S + '.rp-alltab{background:none!important;border:none!important;border-bottom:2px solid transparent!important;color:#888!important;font:inherit!important;cursor:pointer!important;padding:.25rem .4rem!important}\
  ' + S + '.rp-alltab.rp-active{color:' + RED + '!important;border-bottom-color:' + RED + '!important}\
  ' + S + '.rp-allfilters{display:flex!important;gap:.4rem!important;padding:.45rem .8rem 0!important}\
  ' + S + '.rp-allfilters input,' + S + '.rp-allfilters select{border:1px solid #d4d7da!important;border-radius:4px!important;padding:.25rem .4rem!important;font:inherit!important;font-size:12px!important;color:#1e2225!important;background:#fff!important}\
  ' + S + '.rp-allfilters input{flex:1!important;min-width:0!important}\
  ' + S + '.rp-bulkbar{display:flex!important;gap:.4rem!important;align-items:center!important;padding:.45rem .8rem 0!important;font-size:12px!important;color:#666!important}\
  ' + S + '.rp-bulkbar select,' + S + '.rp-bulkbar button{border:1px solid #d4d7da!important;border-radius:4px!important;padding:.2rem .4rem!important;font:inherit!important;font-size:12px!important;cursor:pointer!important;background:#fff!important;color:#444!important}\
  ' + S + '.rp-bulkbar button:hover{border-color:' + RED + '!important;color:' + RED + '!important}\
  ' + S + '.rp-allnote .rp-allcb{margin-right:.4rem!important}\
  #rp-allmodal.rp-dark .rp-allfilters input,#rp-allmodal.rp-dark .rp-allfilters select,#rp-allmodal.rp-dark .rp-bulkbar select,#rp-allmodal.rp-dark .rp-bulkbar button{background:#1a1d20!important;color:#e6e9ec!important;border-color:#3a3f44!important}\
  #rp-allmodal.rp-dark .rp-bulkbar{color:#9aa0a6!important}\
  ' + S + '.rp-alllist{flex:1!important;min-height:0!important;overflow-y:auto!important;padding:.5rem .8rem .8rem!important;display:flex!important;flex-direction:column!important;gap:.45rem!important}\
  ' + S + '.rp-allnote{border:1px solid #e6e9ec!important;border-left:3px solid ' + RED + '!important;border-radius:5px!important;padding:.4rem .55rem!important}\
  ' + S + '.rp-allnote.rp-resolved{opacity:.6!important;border-left-color:#9aa0a6!important}\
  ' + S + '.rp-allnote.rp-progress{border-left-color:' + AMBER + '!important}\
  ' + S + '.rp-allpage{color:#1565c0!important;font-size:11.5px!important;word-break:break-all!important;cursor:pointer!important;text-decoration:underline!important}\
  #rp-allmodal.rp-dark .rp-allcard{background:#23272b!important;color:#e6e9ec!important}\
  #rp-allmodal.rp-dark .rp-allnote{background:#2a2f34!important;border-color:#3a3f44!important}\
  #rp-allmodal.rp-dark .rp-allpage{color:#6db3ff!important}\
  #rp-allmodal.rp-dark .rp-alltab{color:#9aa0a6!important}\
  #rp-allmodal.rp-dark .rp-tag{background:#3a3f44!important;color:#e6e9ec!important}\
  #rp-allmodal.rp-dark #rp-hubbox{border-bottom-color:#3a3f44!important}\
  #rp-allmodal.rp-dark #rp-hubbox input{background:#1a1d20!important;color:#e6e9ec!important;border-color:#3a3f44!important}\
  #rp-allmodal.rp-dark #rp-hubsync{background:#3a3f44!important;color:#e6e9ec!important;border-color:#4a4f55!important}\
  #rp-allmodal.rp-dark #rp-setbox{border-bottom-color:#3a3f44!important}\
  #rp-allmodal.rp-dark #rp-setbox textarea{background:#1a1d20!important;color:#e6e9ec!important;border-color:#3a3f44!important}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ---- elements ----
  var fab = el('button', { id: 'rp-fab', title: 'Red Pen', html: '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:22px;height:22px;display:block"><path fill="currentColor" fill-rule="evenodd" d="M12 2l6.5 6.5-4.6 11.8a2 2 0 0 1-3.8 0L5.5 8.5 12 2zM13.7 11.4a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 1 1 3.4 0zM11.3 4.6h1.4v5h-1.4zM11.6 12.9h.8v6.7h-.8z"/></svg><span id="rp-badge" style="display:none">0</span>' });
  var panel = el('div', { id: 'rp-panel' });
  panel.innerHTML =
    '<div class="rp-resize" id="rp-resize" title="Drag to resize"></div>' +
    '<div class="rp-head"><svg class="rp-nib" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M12 2l6.5 6.5-4.6 11.8a2 2 0 0 1-3.8 0L5.5 8.5 12 2zM13.7 11.4a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 1 1 3.4 0zM11.3 4.6h1.4v5h-1.4zM11.6 12.9h.8v6.7h-.8z"/></svg>Red Pen' +
      '<button class="rp-repo" id="rp-repo" title="All notes across pages">All notes</button>' +
      '<button class="rp-theme" id="rp-theme" title="Toggle dark mode">&#9789;</button>' +
      '<button class="rp-close" title="Close">&times;</button></div>' +
    '<div class="rp-orphanbar" id="rp-orphanbar"></div>' +
    '<div class="rp-list" id="rp-list"></div>' +
    '<div class="rp-add">' +
      '<div class="rp-editbar" id="rp-editbar"><span>Editing note</span><button type="button" id="rp-editcancel">Cancel</button></div>' +
      '<textarea id="rp-body" placeholder="Leave a note on this page..."></textarea>' +
      '<div class="rp-row">' +
        '<button class="rp-pinbtn" id="rp-pin" title="Pin this note to an element">&#128205; Pin</button>' +
        '<select id="rp-type"><option value="note">Note</option><option value="suggestion">Idea</option><option value="bug">Problem</option><option value="question">Question</option></select>' +
        '<select id="rp-prio"><option value="low">Low</option><option value="normal" selected>Normal</option><option value="high">High</option></select>' +
        '<span class="rp-grow"></span>' +
        '<button class="rp-save" id="rp-add">Add</button>' +
      '</div>' +
    '</div>';
  var pinLayer = el('div', { id: 'rp-pinlayer' });
  var loc = el('div', { id: 'rp-loc' });
  var allModal = el('div', { id: 'rp-allmodal' });
  allModal.innerHTML =
    '<div class="rp-allcard">' +
      '<div class="rp-allhead"><span>All notes</span><span class="rp-grow"></span>' +
        '<button id="rp-settings" title="Settings: custom note types + pin colour">Settings</button>' +
        '<button id="rp-hub" title="Connect to a Red Pen Hub">Hub</button>' +
        '<button id="rp-export" title="Download all notes as JSON">Export</button>' +
        '<button id="rp-import" title="Import notes from a JSON file">Import</button>' +
        '<button class="rp-x" id="rp-allclose" title="Close">&times;</button></div>' +
      '<div id="rp-setbox" class="rp-box" style="display:none">' +
        '<div class="rp-b">Settings</div>' +
        '<label class="rp-lbl">Your name <span class="rp-help">stamped on notes and replies you add from this browser, so a second person can tell them apart</span>' +
          '<input type="text" id="rp-authorname" placeholder="e.g. Lincoln" class="rp-field"></label>' +
        '<label class="rp-lbl">Custom note types <span class="rp-help">one per line: "Label" or "Label|#hexcolor"</span>' +
          '<textarea id="rp-customtypes" rows="3" placeholder="Design nit|#9C27B0&#10;Content|#2E7D32" class="rp-field rp-mono"></textarea></label>' +
        '<label class="rp-lblrow"><input type="checkbox" id="rp-pincustom"> Custom pin colour <input type="color" id="rp-pincolor" value="' + RED + '"></label>' +
        '<div><button id="rp-setsave" class="rp-save">Save</button></div>' +
      '</div>' +
      '<div id="rp-hubbox" class="rp-box" style="display:none">' +
        '<div class="rp-b">Connect to Red Pen Hub</div>' +
        '<div class="rp-help">Push this site\'s notes to your local Hub so they show on the combined board. Copy the Hub URL + token from the Hub\'s "Connect a Site" panel.</div>' +
        '<input type="text" id="rp-huburl" placeholder="Hub URL (e.g. http://localhost:3900)" class="rp-field">' +
        '<input type="text" id="rp-hubtoken" placeholder="Connect token" class="rp-field rp-mono">' +
        '<input type="text" id="rp-hubproject" placeholder="Project name (shown on the board)" class="rp-field">' +
        '<div class="rp-hubrow">' +
          '<button id="rp-hubsave" class="rp-save">Save &amp; Sync</button>' +
          '<button id="rp-hubsync" class="rp-ghostbtn">Sync now</button>' +
          '<span id="rp-hubstatus" class="rp-help"></span>' +
        '</div>' +
      '</div>' +
      '<div class="rp-alltabs">' +
        '<button class="rp-alltab rp-active" data-f="open">Open</button>' +
        '<button class="rp-alltab" data-f="progress">In Progress</button>' +
        '<button class="rp-alltab" data-f="resolved">Resolved</button>' +
        '<button class="rp-alltab" data-f="all">All</button></div>' +
      '<div class="rp-allfilters">' +
        '<input type="text" id="rp-search" placeholder="Search notes...">' +
        '<select id="rp-typefilter"><option value="">All types</option></select>' +
      '</div>' +
      '<div class="rp-bulkbar">' +
        '<label><input type="checkbox" id="rp-selall"> Select all</label>' +
        '<span class="rp-grow"></span>' +
        '<select id="rp-bulk"><option value="">Bulk actions</option><option value="open">Reopen</option><option value="progress">Mark In Progress</option><option value="resolved">Resolve</option><option value="delete">Delete</option></select>' +
        '<button id="rp-bulkapply">Apply</button>' +
      '</div>' +
      '<div class="rp-alllist" id="rp-alllist"></div>' +
    '</div>' +
    '<input type="file" id="rp-importfile" accept="application/json,.json" style="display:none">';
  document.body.appendChild(fab);
  document.body.appendChild(panel);
  document.body.appendChild(pinLayer);
  document.body.appendChild(loc);
  document.body.appendChild(allModal);

  var notes = [];          // notes for the current page
  var pendingAnchor = null;
  var pins = [];
  var allFilter = 'open';
  var searchTerm = '';     // repo modal: body search (lowercased)
  var typeFilter = '';     // repo modal: type filter ('' = all types)
  var jumpIdx = -1;        // jump-to-next cursor over this page's pins
  var editingId = null;    // id of the note being edited, or null in add mode

  fab.addEventListener('click', function () {
    panel.classList.toggle('rp-open');
    if (panel.classList.contains('rp-open')) load();
  });
  panel.querySelector('.rp-close').addEventListener('click', function () { panel.classList.remove('rp-open'); });
  document.getElementById('rp-repo').addEventListener('click', openAll);
  document.getElementById('rp-allclose').addEventListener('click', function () { allModal.classList.remove('rp-open'); });
  allModal.addEventListener('click', function (e) { if (e.target === allModal) allModal.classList.remove('rp-open'); });
  document.getElementById('rp-export').addEventListener('click', exportNotes);
  document.getElementById('rp-import').addEventListener('click', function () { document.getElementById('rp-importfile').click(); });
  document.getElementById('rp-importfile').addEventListener('change', importNotes);
  document.getElementById('rp-settings').addEventListener('click', toggleSettingsBox);
  document.getElementById('rp-setsave').addEventListener('click', saveSettings);
  document.getElementById('rp-hub').addEventListener('click', toggleHubBox);
  document.getElementById('rp-hubsave').addEventListener('click', function () { saveHubCfg(); pushToHub({}); });
  document.getElementById('rp-hubsync').addEventListener('click', function () { pushToHub({}); });
  document.querySelector('.rp-alltabs').addEventListener('click', function (e) {
    var b = e.target.closest('.rp-alltab'); if (!b) return;
    allFilter = b.getAttribute('data-f');
    [].forEach.call(document.querySelectorAll('.rp-alltab'), function (t) { t.classList.toggle('rp-active', t === b); });
    renderAll();
  });
  document.getElementById('rp-search').addEventListener('input', function () { searchTerm = this.value.trim().toLowerCase(); renderAll(); });
  document.getElementById('rp-typefilter').addEventListener('change', function () { typeFilter = this.value; renderAll(); });
  document.getElementById('rp-bulkapply').addEventListener('click', bulkApply);
  document.getElementById('rp-selall').addEventListener('change', function () {
    var on = this.checked;
    [].forEach.call(document.querySelectorAll('.rp-allcb'), function (c) { c.checked = on; });
  });

  // ---- theme ----
  function applyTheme(t) {
    var dark = t === 'dark';
    panel.classList.toggle('rp-dark', dark);
    allModal.classList.toggle('rp-dark', dark);
    var b = document.getElementById('rp-theme');
    if (b) b.innerHTML = dark ? '&#9728;' : '&#9789;';
  }
  (function () {
    var saved = 'light';
    try { saved = localStorage.getItem(THEME_KEY) || 'light'; } catch (e) {}
    applyTheme(saved);
    document.getElementById('rp-theme').addEventListener('click', function () {
      var next = panel.classList.contains('rp-dark') ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
      applyTheme(next);
    });
  })();

  document.getElementById('rp-add').addEventListener('click', add);
  document.getElementById('rp-pin').addEventListener('click', enterPinMode);
  document.getElementById('rp-editcancel').addEventListener('click', exitEdit);
  document.getElementById('rp-type').addEventListener('change', savePrefs);
  document.getElementById('rp-prio').addEventListener('change', savePrefs);
  rebuildTypeSelect();
  applyPrefs();
  // Esc closes the All-notes modal, then the panel (pin mode owns Esc while it's active).
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || pinmode) return;
    if (allModal.classList.contains('rp-open')) { allModal.classList.remove('rp-open'); return; }
    if (panel.classList.contains('rp-open')) { if (editingId) exitEdit(); panel.classList.remove('rp-open'); }
  });
  (function () { // resizable panel
    try { var w0 = parseInt(localStorage.getItem(WIDTH_KEY), 10); if (w0 >= 300 && w0 <= 900) panel.style.setProperty('width', w0 + 'px', 'important'); } catch (e) {}
    var handle = document.getElementById('rp-resize');
    var dragging = false;
    handle.addEventListener('mousedown', function (e) { dragging = true; e.preventDefault(); document.body.style.userSelect = 'none'; });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var w = (window.innerWidth - 20) - e.clientX;
      w = Math.max(300, Math.min(w, window.innerWidth - 40));
      panel.style.setProperty('width', w + 'px', 'important');
    });
    document.addEventListener('mouseup', function () {
      if (!dragging) return;
      dragging = false; document.body.style.userSelect = '';
      try { localStorage.setItem(WIDTH_KEY, parseInt(panel.style.width, 10)); } catch (e) {}
    });
  })();
  document.getElementById('rp-body').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); }
  });

  // ---- data (localStorage) ----
  function loadAll() {
    try { var a = JSON.parse(localStorage.getItem(STORE_KEY)); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  // Returns true when the write landed. A full localStorage used to throw
  // QuotaExceededError straight into an empty catch, so the note vanished with
  // no warning at all. Callers must check the result before clearing an input:
  // in-memory state cannot be allowed to diverge from what was persisted, so
  // every mutation path re-reads the store via load() and reverts to disk truth.
  function saveAll(arr) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(arr));
      return true;
    } catch (e) {
      var name = (e && e.name) || '';
      var code = e && e.code;
      var full = name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
                 code === 22 || code === 1014;
      toast(
        full ? 'Storage is full - that change was NOT saved. Export your notes, then delete some.'
             : 'Could not save notes (' + (name || 'storage error') + '). That change was NOT saved.',
        'Export', exportNotes
      );
      return false;
    }
  }
  function uid() { return 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function byId(arr, id) { for (var i = 0; i < arr.length; i++) { if (arr[i].id === id) return arr[i]; } return null; }

  function load() {
    notes = loadAll().filter(function (n) { return n.page === PAGE; });
    computeOrphans();      // before render() so the first paint already knows
    render();
    buildPins();
  }
  // ---- orphaned pins ----
  // positionPins() has always known when an anchor stopped resolving; it hid the
  // pin and dropped the finding on the floor, so the note stayed in the store
  // with no way to see that it had come unstuck. Nothing is deleted - the note is
  // flagged and can be filtered to, which is the only safe response: a selector
  // can stop resolving because the element genuinely went away OR because this
  // render simply has not produced it yet.
  var orphanIds = {};        // id -> true, for THIS page only
  var showOrphansOnly = false;
  function anchorResolves(n) {
    try { return !!document.querySelector(n.anchor.sel); } catch (e) { return false; }
  }
  function computeOrphans() {
    var next = {}, changed = false, k;
    notes.forEach(function (n) {
      if (!anchored(n) || statusKey(n) === 'resolved') return;
      if (!anchorResolves(n)) next[n.id] = true;
    });
    for (k in next) { if (next.hasOwnProperty(k) && !orphanIds[k]) changed = true; }
    for (k in orphanIds) { if (orphanIds.hasOwnProperty(k) && !next[k]) changed = true; }
    orphanIds = next;
    return changed;
  }
  function orphanCount() { var c = 0, k; for (k in orphanIds) { if (orphanIds.hasOwnProperty(k)) c++; } return c; }
  function renderOrphanBar() {
    var bar = document.getElementById('rp-orphanbar');
    if (!bar) return;
    var lost = orphanCount();
    if (!lost) { showOrphansOnly = false; bar.classList.remove('rp-on'); bar.innerHTML = ''; return; }
    bar.classList.add('rp-on');
    bar.innerHTML = '<span>' + lost + (lost === 1 ? ' note has' : ' notes have') +
      ' lost the element it was pinned to.</span><span class="rp-grow"></span>' +
      '<button type="button" id="rp-orphantoggle">' + (showOrphansOnly ? 'Show all' : 'Show them') + '</button>';
    var b = document.getElementById('rp-orphantoggle');
    if (b) b.addEventListener('click', function () { showOrphansOnly = !showOrphansOnly; render(); });
  }
  function add() {
    var body = document.getElementById('rp-body').value.trim();
    if (!body) return;
    var type = document.getElementById('rp-type').value;
    var priority = document.getElementById('rp-prio').value;
    var all = loadAll();
    var now = new Date().toISOString();
    if (editingId) {
      var n = byId(all, editingId);
      if (n) {
        n.body = body; n.type = type; n.priority = priority;
        n.anchor = pendingAnchor;              // preserved on edit-enter; Pin can replace/clear it
        n.updatedAt = now;
        if (!saveAll(all)) return;             // keep the form as-is so the edit is not lost
      }
      exitEdit();
    } else {
      all.push({
        id: uid(),
        body: body,
        type: type,
        priority: priority,
        status: 'open',
        statusAt: now,
        author: authorName(),
        url: location.href,
        page: PAGE,
        anchor: pendingAnchor,
        createdAt: now,
      });
      // A failed write must leave the textarea and the pending pin alone -
      // clearing them would throw away the note the user just wrote.
      if (!saveAll(all)) return;
      document.getElementById('rp-body').value = '';
      clearPending();
    }
    load();
    maybeAutoPush();
  }
  function setStatus(id, status, opts) {
    opts = opts || {};
    var all = loadAll(); var n = byId(all, id);
    var prev = n ? statusKey(n) : null;
    if (n) {
      // stampStatus sets status, statusAt and resolvedAt together - see its comment.
      stampStatus(n, status);
      if (!saveAll(all)) { load(); return; }   // re-read so the UI shows what is actually stored
    }
    load(); if (allModal.classList.contains('rp-open')) renderAll();
    maybeAutoPush();
    // Offer an Undo for a real, user-initiated status change (not the undo itself).
    if (n && !opts.isUndo && prev !== status) {
      toast('Marked ' + (STATUSES[status] || status) + '.', 'Undo', function () { setStatus(id, prev, { isUndo: true }); });
    }
  }
  // ---- edit an existing note (loads it into the add form; Add becomes Save) ----
  function enterEdit(n) {
    editingId = n.id;
    document.getElementById('rp-body').value = n.body || '';
    setSelVal(document.getElementById('rp-type'), TYPES[n.type] ? n.type : 'note');
    setSelVal(document.getElementById('rp-prio'), n.priority);
    pendingAnchor = (n.anchor && n.anchor.sel) ? n.anchor : null;
    var pb = document.getElementById('rp-pin');
    if (pendingAnchor) { pb.classList.add('rp-set'); pb.innerHTML = '&#128205; Pinned'; }
    else { pb.classList.remove('rp-set'); pb.innerHTML = '&#128205; Pin'; }
    document.getElementById('rp-editbar').classList.add('rp-on');
    document.getElementById('rp-add').textContent = 'Save';
    panel.classList.add('rp-open');
    document.getElementById('rp-body').focus();
  }
  function exitEdit() {
    editingId = null;
    document.getElementById('rp-body').value = '';
    document.getElementById('rp-editbar').classList.remove('rp-on');
    document.getElementById('rp-add').textContent = 'Add';
    clearPending();
    applyPrefs();
  }
  // ---- remembered add-form prefs (type + priority) across page loads ----
  function setSelVal(sel, val) { if (!sel || val == null) return; for (var i = 0; i < sel.options.length; i++) { if (sel.options[i].value === String(val)) { sel.value = String(val); return; } } }
  function savePrefs() {
    if (editingId) return;
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ type: document.getElementById('rp-type').value, priority: document.getElementById('rp-prio').value })); } catch (e) {}
  }
  function applyPrefs() {
    var p; try { p = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null'); } catch (e) { p = null; }
    if (!p) return;
    if (p.type) setSelVal(document.getElementById('rp-type'), p.type); // may be a custom slug
    setSelVal(document.getElementById('rp-prio'), p.priority);
  }
  // ---- settings: custom note types + custom pin colour ----
  // Rebuild the add-form type dropdown so user-defined types appear alongside the built-ins.
  function rebuildTypeSelect() {
    var sel = document.getElementById('rp-type'); if (!sel) return;
    var cur = sel.value;
    var html = '';
    ['note', 'suggestion', 'bug', 'question'].forEach(function (k) { html += '<option value="' + k + '">' + esc(TYPES[k]) + '</option>'; });
    var c = customTypes();
    for (var slug in c) { if (c.hasOwnProperty(slug)) { html += '<option value="' + slug + '">' + esc(c[slug].label) + '</option>'; } }
    sel.innerHTML = html;
    setSelVal(sel, cur);
  }
  function toggleSettingsBox() {
    var box = document.getElementById('rp-setbox');
    var show = box.style.display === 'none';
    box.style.display = show ? 'flex' : 'none';
    if (show) {
      try { document.getElementById('rp-customtypes').value = localStorage.getItem(CUSTOM_TYPES_KEY) || ''; } catch (e) {}
      document.getElementById('rp-authorname').value = authorName();
      var pc = pinColor();
      document.getElementById('rp-pincustom').checked = !!pc;
      document.getElementById('rp-pincolor').value = pc || RED;
    }
  }
  function saveSettings() {
    try {
      localStorage.setItem(CUSTOM_TYPES_KEY, document.getElementById('rp-customtypes').value);
      localStorage.setItem(AUTHOR_KEY, document.getElementById('rp-authorname').value.trim().slice(0, 60));
      var custom = document.getElementById('rp-pincustom').checked;
      var col = document.getElementById('rp-pincolor').value;
      localStorage.setItem(PIN_COLOR_KEY, (custom && HEX_RE.test(col)) ? col : '');
    } catch (e) {}
    rebuildTypeSelect();
    rebuildTypeFilter();
    document.getElementById('rp-setbox').style.display = 'none';
    load(); if (allModal.classList.contains('rp-open')) renderAll();
  }
  // ---- transient toast (with an optional action, e.g. Undo) ----
  var toastEl = null, toastTimer = null;
  function toast(msg, actionLabel, actionFn) {
    if (!toastEl) { toastEl = el('div', { id: 'rp-toast' }); document.body.appendChild(toastEl); }
    toastEl.textContent = '';
    var span = document.createElement('span'); span.textContent = msg; toastEl.appendChild(span);
    if (actionLabel && actionFn) {
      var btn = el('button', { cls: 'rp-toast-btn' }); btn.textContent = actionLabel;
      btn.addEventListener('click', function () { if (toastTimer) clearTimeout(toastTimer); toastEl.classList.remove('rp-on'); actionFn(); });
      toastEl.appendChild(btn);
    }
    toastEl.classList.add('rp-on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (toastEl) toastEl.classList.remove('rp-on'); }, actionLabel ? 6000 : 3500);
  }
  function del(id) {
    saveAll(loadAll().filter(function (n) { return n.id !== id; }));
    load(); if (allModal.classList.contains('rp-open')) renderAll();
    maybeAutoPush();
  }
  function addReply(id, text) {
    text = (text || '').trim();
    if (!text) return;
    var all = loadAll(); var n = byId(all, id);
    if (!n) return;
    if (!n.replies) n.replies = [];
    n.replies.push({ id: uid(), body: text, author: authorName(), createdAt: new Date().toISOString() });
    if (!saveAll(all)) return;                 // leave the reply box filled so the text survives
    load(); if (allModal.classList.contains('rp-open')) renderAll();
    // Replies aren't part of the Hub payload (mirrors the WP push), so no auto-push here.
  }
  function replyCount(n) { return (n.replies && n.replies.length) || 0; }
  function clearPending() {
    pendingAnchor = null;
    var b = document.getElementById('rp-pin');
    b.classList.remove('rp-set');
    b.innerHTML = '&#128205; Pin';
  }

  // ---- export / import ----
  function exportNotes() {
    var data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), notes: loadAll() }, null, 2);
    var blob = new Blob([data], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'red-pen-notes.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }
  function importNotes(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        var incoming = Array.isArray(parsed) ? parsed : (parsed && parsed.notes);
        if (!Array.isArray(incoming)) throw new Error('no notes array');
        var replace = window.confirm('Import ' + incoming.length + ' note(s)?\n\nOK = replace all current notes.\nCancel = merge with current notes.');
        if (replace) { saveAll(incoming); }
        else {
          var have = loadAll(); var ids = {};
          have.forEach(function (n) { ids[n.id] = true; });
          incoming.forEach(function (n) { if (!ids[n.id]) have.push(n); });
          saveAll(have);
        }
        load(); renderAll();
      } catch (err) { window.alert('Could not import: ' + err.message); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ---- Red Pen Hub (optional push) ----
  function hubCfg() {
    try {
      return {
        url: (localStorage.getItem(HUB_URL_KEY) || '').trim(),
        token: (localStorage.getItem(HUB_TOKEN_KEY) || '').trim(),
        project: (localStorage.getItem(HUB_PROJECT_KEY) || '').trim()
      };
    } catch (e) { return { url: '', token: '', project: '' }; }
  }
  function saveHubCfg() {
    try {
      localStorage.setItem(HUB_URL_KEY, document.getElementById('rp-huburl').value.trim());
      localStorage.setItem(HUB_TOKEN_KEY, document.getElementById('rp-hubtoken').value.trim());
      localStorage.setItem(HUB_PROJECT_KEY, document.getElementById('rp-hubproject').value.trim());
    } catch (e) {}
  }
  function toggleHubBox() {
    var box = document.getElementById('rp-hubbox');
    var show = box.style.display === 'none';
    box.style.display = show ? 'flex' : 'none';
    if (show) {
      var c = hubCfg();
      document.getElementById('rp-huburl').value = c.url;
      document.getElementById('rp-hubtoken').value = c.token;
      document.getElementById('rp-hubproject').value = c.project || defaultProject();
      hubStatus(c.url && c.token ? 'Connected. Notes sync automatically when they change.' : '', '');
    }
  }
  function hubStatus(msg, kind) {
    var s = document.getElementById('rp-hubstatus');
    if (!s) return;
    s.textContent = msg || '';
    // must be set 'important': the sheet's .rp-help color is !important and would eat the state colors
    s.style.setProperty('color', kind === 'err' ? RED : (kind === 'ok' ? '#2e7d32' : '#888'), 'important');
  }
  function defaultProject() { return document.title || location.hostname || 'static-site'; }
  // The one place a note is flattened for the wire. Every field the Hub reads is
  // listed here exactly once, so a new field cannot land in one code path and be
  // missing from another. `typeLabel` carries custom type names the Hub has no
  // map for; `statusAt` is what stops the Hub's resolver reverting our changes;
  // `author` is blank until the user sets a name in Settings, never faked.
  function hubRecord(n) {
    return {
      id: n.id,
      body: n.body,
      type: n.type,
      typeLabel: typeLabel(n.type),
      typeColor: typeColor(n.type),
      priority: n.priority,
      status: statusKey(n),
      statusAt: n.statusAt || null,
      resolvedAt: n.resolvedAt || null,
      author: n.author || '',
      url: n.url || location.href,
      page: n.page,
      anchor: (n.anchor && n.anchor.sel) ? n.anchor.sel : '',
      replyCount: (n.replies && n.replies.length) || 0,
      createdAt: n.createdAt
    };
  }
  function maybeAutoPush() { var c = hubCfg(); if (c.url && c.token) pushToHub({ silent: true }); }
  // Two-way sync: apply status changes the Hub made to our notes (resolve/reopen/start on
  // the board). Writes straight to the store + re-renders; deliberately does NOT re-push,
  // so there's no ping-pong (the change retires on the next natural push once we match).
  function applyHubChanges(changes) {
    if (!changes) { return 0; }
    var all = loadAll(), applied = 0;
    Object.keys(changes).forEach(function (id) {
      var n = byId(all, id); if (!n) { return; }
      var to = changes[id] && changes[id].status;
      if (!to || n.status === to) { return; }
      stampStatus(n, to, changes[id].resolvedAt);
      applied++;
    });
    if (applied) { saveAll(all); load(); if (allModal.classList.contains('rp-open')) { renderAll(); } }
    return applied;
  }
  function pushToHub(opts) {
    opts = opts || {};
    var c = hubCfg();
    if (!c.url || !c.token) { if (!opts.silent) hubStatus('Enter a Hub URL and token first.', 'err'); return; }
    // Mirror the WP plugin's fix: a missing scheme makes the request fail silently, so default to http://.
    var url = c.url.replace(/^(?!https?:\/\/)/i, 'http://').replace(/\/+$/, '');
    var project = c.project || defaultProject();
    var notes = loadAll().map(hubRecord);
    if (!opts.silent) hubStatus('Syncing...', '');
    if (typeof fetch !== 'function') { if (!opts.silent) hubStatus('This browser cannot push (no fetch).', 'err'); return; }
    fetch(url + '/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: c.token, project: project, surface: 'static', notes: notes })
    }).then(function (r) {
      if (r.status === 401) { hubStatus('Hub rejected the token (401). Recheck the token.', 'err'); return; }
      if (!r.ok) { hubStatus('Hub error (HTTP ' + r.status + ').', 'err'); return; }
      return r.json().then(function (j) {
        var applied = applyHubChanges(j && j.changes);
        var n = (j && j.count != null) ? j.count : notes.length;
        hubStatus('Synced ' + n + ' note(s) to the Hub.' + (applied ? ' ' + applied + ' updated from Hub.' : ''), 'ok');
      }, function () { hubStatus('Synced to the Hub.', 'ok'); });
    }).catch(function (e) {
      hubStatus('Could not reach the Hub at ' + url + '. Is it running? (' + (e && e.message ? e.message : 'network error') + ')', 'err');
    });
  }

  // ---- render current-page panel ----
  function anchored(n) { return n.anchor && n.anchor.sel; }
  // Type flag: a custom type paints its own colour (white text); built-ins use their CSS class.
  function tagHtml(n) {
    var tc = typeColor(n.type);
    return '<span class="rp-tag ' + esc(n.type) + '"' + (tc ? ' style="background:' + esc(tc) + ';color:#fff"' : '') + '>' + esc(typeLabel(n.type)) + '</span>';
  }
  // Shared 3-state status dropdown (panel + All-notes modal).
  function statusSelectHtml(n) {
    var sk = statusKey(n), o = '';
    for (var k in STATUSES) { if (STATUSES.hasOwnProperty(k)) { o += '<option value="' + k + '"' + (k === sk ? ' selected' : '') + '>' + esc(STATUSES[k]) + '</option>'; } }
    return '<select class="rp-status" title="Change status">' + o + '</select>';
  }
  // Reply thread + reply box for a note (front-end panel only; the repo shows a count).
  function repliesHtml(n) {
    var out = '<div class="rp-replies">';
    (n.replies || []).forEach(function (r) {
      out += '<div class="rp-reply"><div class="rp-reply-meta">' +
        (r.author ? esc(r.author) + ' &middot; ' : '') + esc(when(r.createdAt)) + '</div>' +
        '<div class="rp-reply-body">' + esc(r.body) + '</div></div>';
    });
    out += '<form class="rp-replyform"><textarea class="rp-replytext" rows="1" placeholder="Reply..."></textarea>' +
      '<button type="submit" class="rp-replysend">Reply</button></form></div>';
    return out;
  }
  function wireReplies(noteEl, n) {
    var rf = noteEl.querySelector('.rp-replyform'); if (!rf) return;
    var ta = rf.querySelector('.rp-replytext');
    rf.addEventListener('submit', function (e) { e.preventDefault(); addReply(n.id, ta.value); });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); addReply(n.id, ta.value); } });
  }
  // Wire the status dropdown + action buttons in a rendered note's action row.
  function wireActs(row, n, opts) {
    opts = opts || {};
    row.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'delete') del(n.id);
      else if (act === 'edit') enterEdit(n);
      else if (act === 'locate') locate(n);
    });
    row.addEventListener('change', function (e) {
      var sel = e.target.closest('.rp-status'); if (!sel) return;
      setStatus(n.id, sel.value);
    });
  }
  function render() {
    var open = notes.filter(function (n) { return statusKey(n) === 'open'; });
    var badge = document.getElementById('rp-badge');
    badge.textContent = open.length;
    badge.style.display = open.length ? 'block' : 'none';

    renderOrphanBar();
    var list = document.getElementById('rp-list');
    if (!notes.length) { list.innerHTML = '<div class="rp-empty">No notes on this page yet.</div>'; return; }
    var sorted = notes.slice().sort(function (a, b) {
      if ((a.status === 'resolved') !== (b.status === 'resolved')) return a.status === 'resolved' ? 1 : -1;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    if (showOrphansOnly) sorted = sorted.filter(function (n) { return orphanIds[n.id]; });
    if (!sorted.length) { list.innerHTML = '<div class="rp-empty">No notes to show.</div>'; return; }
    var pinNums = pinNumbers();
    list.innerHTML = '';
    sorted.forEach(function (n) {
      var num = pinNums[n.id];
      var lost = !!orphanIds[n.id];
      var d = el('div', { cls: 'rp-note rp-' + statusKey(n) + (lost ? ' rp-lost' : '') });
      d.innerHTML =
        '<div class="rp-meta">' +
          (num ? '<span class="rp-num">' + num + '</span>' : '') +
          tagHtml(n) +
          (lost ? '<span class="rp-lostflag" title="' + esc(n.anchor.sel) + '">pin lost</span>' : '') +
          '<span class="rp-prio ' + esc(n.priority) + '">' + esc(n.priority) + '</span>' +
          (n.author ? '<span class="rp-author">' + esc(n.author) + '</span>' : '') +
          '<span class="rp-when">' + esc(when(n.createdAt)) + '</span>' +
        '</div>' +
        '<div class="rp-body">' + esc(n.body) + '</div>' +
        '<div class="rp-acts">' +
          (anchored(n) ? '<button data-act="locate">Locate</button>' : '') +
          statusSelectHtml(n) +
          '<button data-act="edit">Edit</button>' +
          '<button data-act="delete">Delete</button>' +
        '</div>' +
        repliesHtml(n);
      wireActs(d.querySelector('.rp-acts'), n);
      wireReplies(d, n);
      list.appendChild(d);
    });
  }

  // ---- All notes modal (the repository, across pages) ----
  function openAll() { rebuildTypeFilter(); allModal.classList.add('rp-open'); renderAll(); }
  // Populate the repo type-filter dropdown (built-ins + custom types).
  function rebuildTypeFilter() {
    var sel = document.getElementById('rp-typefilter'); if (!sel) return;
    var cur = sel.value;
    var html = '<option value="">All types</option>';
    ['note', 'suggestion', 'bug', 'question'].forEach(function (k) { html += '<option value="' + k + '">' + esc(TYPES[k]) + '</option>'; });
    var c = customTypes();
    for (var slug in c) { if (c.hasOwnProperty(slug)) { html += '<option value="' + slug + '">' + esc(c[slug].label) + '</option>'; } }
    sel.innerHTML = html;
    setSelVal(sel, cur);
  }
  // Bulk action over the checked repo rows: reopen / in progress / resolve / delete.
  function bulkApply() {
    var action = document.getElementById('rp-bulk').value;
    if (!action) return;
    var ids = [].slice.call(document.querySelectorAll('.rp-allcb:checked')).map(function (c) { return c.getAttribute('data-id'); });
    if (!ids.length) return;
    if (action === 'delete' && !window.confirm('Delete ' + ids.length + ' note(s) permanently? This cannot be undone.')) return;
    var all = loadAll();
    if (action === 'delete') {
      var set = {}; ids.forEach(function (id) { set[id] = true; });
      all = all.filter(function (n) { return !set[n.id]; });
    } else {
      ids.forEach(function (id) { var n = byId(all, id); if (n) stampStatus(n, action); });
    }
    if (!saveAll(all)) { load(); renderAll(); return; }
    document.getElementById('rp-bulk').value = '';
    load(); renderAll(); maybeAutoPush();
  }
  function renderAll() {
    var all = loadAll();
    var rows = all.filter(function (n) {
      if (allFilter !== 'all' && statusKey(n) !== allFilter) return false;
      if (typeFilter && n.type !== typeFilter) return false;
      if (searchTerm && (n.body || '').toLowerCase().indexOf(searchTerm) < 0) return false;
      return true;
    }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    var selAll = document.getElementById('rp-selall'); if (selAll) selAll.checked = false;

    var list = document.getElementById('rp-alllist');
    if (!rows.length) {
      var msg = (searchTerm || typeFilter) ? 'No matching notes.' : ('No notes' + (allFilter === 'all' ? '' : ' (' + allFilter + ')') + ' yet.');
      list.innerHTML = '<div class="rp-empty">' + msg + '</div>'; return;
    }
    list.innerHTML = '';
    rows.forEach(function (n) {
      // Orphan state is only knowable for the page currently in the DOM - a
      // selector for another page cannot be resolved from here, so those rows
      // are left unflagged rather than guessed at.
      var lost = n.page === PAGE && !!orphanIds[n.id];
      var d = el('div', { cls: 'rp-allnote rp-' + statusKey(n) + (lost ? ' rp-lost' : '') });
      d.innerHTML =
        '<div class="rp-meta">' +
          '<input type="checkbox" class="rp-allcb" data-id="' + esc(n.id) + '">' +
          tagHtml(n) +
          (lost ? '<span class="rp-lostflag" title="' + esc(n.anchor.sel) + '">pin lost</span>' : '') +
          '<span class="rp-prio ' + esc(n.priority) + '">' + esc(n.priority) + '</span>' +
          (n.author ? '<span class="rp-author">' + esc(n.author) + '</span>' : '') +
          '<span class="rp-when">' + esc(when(n.createdAt)) + '</span>' +
        '</div>' +
        '<div class="rp-body">' + esc(n.body) + '</div>' +
        '<div style="margin-top:.25rem"><span class="rp-allpage" data-page="' + esc(n.page) + '">' + esc(n.page || '/') + '</span></div>' +
        (replyCount(n) ? '<div class="rp-replycount">' + replyCount(n) + (replyCount(n) === 1 ? ' reply' : ' replies') + '</div>' : '') +
        '<div class="rp-acts">' +
          statusSelectHtml(n) +
          '<button data-act="delete">Delete</button>' +
        '</div>';
      wireActs(d.querySelector('.rp-acts'), n);
      var pg = d.querySelector('.rp-allpage');
      if (pg) pg.addEventListener('click', function () { if (n.page && n.page !== PAGE) location.pathname = n.page; });
      list.appendChild(d);
    });
  }

  // ---- pins ----
  function pinNumbers() {
    var map = {}, i = 0;
    notes.slice().sort(function (a, b) { return String(a.createdAt).localeCompare(String(b.createdAt)); })
      .forEach(function (n) { if (anchored(n) && n.status !== 'resolved') { map[n.id] = ++i; } });
    return map;
  }
  function buildPins() {
    pinLayer.innerHTML = '';
    pins = [];
    var nums = pinNumbers();
    var pc = pinColor();
    notes.forEach(function (n) {
      if (!anchored(n) || n.status === 'resolved') return;
      var marker = el('button', { cls: 'rp-pin rp-' + statusKey(n) });
      marker.textContent = nums[n.id] || '';
      if (pc && statusKey(n) === 'open') marker.style.setProperty('background', pc, 'important'); // custom colour, open pins only
      marker.title = typeLabel(n.type) + ': ' + (n.body || '').slice(0, 80);
      (function (note) { marker.addEventListener('click', function () { openTo(note); }); })(n);
      pinLayer.appendChild(marker);
      pins.push({ note: n, marker: marker });
    });
    positionPins();
  }
  function positionPins() {
    var lostNow = false;
    pins.forEach(function (p) {
      var target;
      try { target = document.querySelector(p.note.anchor.sel); } catch (e) { target = null; }
      if (!target) { p.marker.style.setProperty('display', 'none', 'important'); lostNow = true; return; }
      var r = target.getBoundingClientRect();
      p.marker.style.setProperty('display', 'flex', 'important');
      p.marker.style.left = (r.left + (p.note.anchor.x || 0.5) * r.width) + 'px';
      p.marker.style.top = (r.top + (p.note.anchor.y || 0.5) * r.height) + 'px';
    });
    // A hidden pin is a finding, not a shrug: re-check and repaint the list so the
    // orphan bar appears (or clears) the moment the DOM changes under us.
    if ((lostNow || orphanCount()) && computeOrphans()) render();
  }
  function openTo(note) { panel.classList.add('rp-open'); load(); locate(note); }

  // ---- pin mode ----
  var pinmode = null, pinhl = null, hint = null;
  var isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  function enterPinMode() {
    if (pinmode) return;
    panel.classList.remove('rp-open');
    pinmode = el('div', { id: 'rp-pinmode' });
    pinhl = el('div', { id: 'rp-pinhl' });
    hint = el('div', {
      id: 'rp-hint',
      html: isTouch ? 'Tap an element to pin the note. Drag to scroll, tap the hint to cancel.'
                    : 'Click an element to pin the note (Esc to cancel)'
    });
    document.body.appendChild(pinmode);
    document.body.appendChild(pinhl);
    document.body.appendChild(hint);
    document.addEventListener('mousemove', onPinMove, true);
    document.addEventListener('click', onPinClick, true);
    document.addEventListener('keydown', onPinKey, true);
    if (isTouch) {
      // There is no Esc on a phone, so the hint doubles as the cancel target.
      hint.style.setProperty('pointer-events', 'auto', 'important');
      hint.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); exitPinMode(); }, true);
      pinmode.addEventListener('touchstart', onPinTouchStart, { passive: true });
      pinmode.addEventListener('touchmove', onPinTouchMove, { passive: true });
      pinmode.addEventListener('touchend', onPinTouchEnd, false);
      pinmode.addEventListener('touchcancel', function () { touchStart = null; }, { passive: true });
    }
  }
  function exitPinMode() {
    if (!pinmode) return;
    document.removeEventListener('mousemove', onPinMove, true);
    document.removeEventListener('click', onPinClick, true);
    document.removeEventListener('keydown', onPinKey, true);
    [pinmode, pinhl, hint].forEach(function (n) { if (n && n.parentNode) n.parentNode.removeChild(n); });
    pinmode = pinhl = hint = null;
  }
  function targetUnder(x, y) {
    pinmode.style.display = 'none';
    var t = document.elementFromPoint(x, y);
    pinmode.style.display = '';
    if (!t || t === document.body || t === document.documentElement) return null;
    if (fab.contains(t) || panel.contains(t) || pinLayer.contains(t)) return null;
    return t;
  }
  function onPinMove(e) {
    var t = targetUnder(e.clientX, e.clientY);
    if (!t) { pinhl.style.setProperty('display', 'none', 'important'); return; }
    var r = t.getBoundingClientRect();
    pinhl.style.setProperty('display', 'block', 'important');
    pinhl.style.left = r.left + 'px'; pinhl.style.top = r.top + 'px';
    pinhl.style.width = r.width + 'px'; pinhl.style.height = r.height + 'px';
  }
  function onPinClick(e) {
    var t = targetUnder(e.clientX, e.clientY);
    e.preventDefault(); e.stopPropagation();
    if (!t) { exitPinMode(); return; }
    var r = t.getBoundingClientRect();
    pendingAnchor = {
      sel: cssPath(t),
      x: r.width ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : 0.5,
      y: r.height ? Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) : 0.5,
    };
    var b = document.getElementById('rp-pin');
    b.classList.add('rp-set'); b.innerHTML = '&#128205; Pinned';
    exitPinMode();
    panel.classList.add('rp-open');
    document.getElementById('rp-body').focus();
  }
  function onPinKey(e) { if (e.key === 'Escape') { e.preventDefault(); exitPinMode(); } }

  // ---- locate ----
  var locTimer = null;
  // Draw the roaming highlight box around an element (shared by Locate + jump-to-next).
  function showLoc(t) {
    var r = t.getBoundingClientRect();
    loc.style.setProperty('display', 'block', 'important'); loc.style.opacity = '1';
    loc.style.left = (r.left - 4) + 'px'; loc.style.top = (r.top - 4) + 'px';
    loc.style.width = (r.width + 8) + 'px'; loc.style.height = (r.height + 8) + 'px';
    clearTimeout(locTimer);
    locTimer = setTimeout(function () { loc.style.opacity = '0'; setTimeout(function () { loc.style.setProperty('display', 'none', 'important'); }, 350); }, 1800);
  }
  function locate(note) {
    if (!anchored(note)) return;
    var t;
    try { t = document.querySelector(note.anchor.sel); } catch (e) { t = null; }
    if (!t) return;
    t.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showLoc(t);
  }
  // ---- jump to next open note: cycle this page's pins, scroll + highlight each ("J") ----
  function jumpToNext() {
    var targets = [];
    pins.forEach(function (p) {
      var t; try { t = document.querySelector(p.note.anchor.sel); } catch (e) { t = null; }
      if (!t) return;
      var r = t.getBoundingClientRect();
      if (r.width || r.height) targets.push(t);
    });
    if (!targets.length) { toast('No pinned notes on this page.'); return; }
    jumpIdx = (jumpIdx + 1) % targets.length;
    var el = targets[jumpIdx];
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showLoc(el);
  }
  document.addEventListener('keydown', function (e) {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    if (e.key === 'j' || e.key === 'J') jumpToNext();
  });

  var raf = null;
  function onScrollResize() { if (raf) return; raf = requestAnimationFrame(function () { raf = null; positionPins(); }); }
  window.addEventListener('scroll', onScrollResize, true);
  window.addEventListener('resize', onScrollResize);

  // ---- helpers ----
  function cssPath(node) {
    if (!(node instanceof Element)) return '';
    if (node.id) return '#' + cssEsc(node.id);
    var parts = [];
    while (node && node.nodeType === 1 && parts.length < 6 && node !== document.body) {
      var sel = node.nodeName.toLowerCase();
      if (node.id) { parts.unshift('#' + cssEsc(node.id)); break; }
      var parent = node.parentNode;
      if (parent && parent.children) {
        var same = [];
        for (var i = 0; i < parent.children.length; i++) {
          if (parent.children[i].nodeName === node.nodeName) same.push(parent.children[i]);
        }
        if (same.length > 1) sel += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(sel);
      node = parent;
    }
    return parts.join(' > ');
  }
  function cssEsc(s) { return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/[^a-zA-Z0-9_-]/g, '\\$&'); }
  function el(tag, o) {
    var n = document.createElement(tag);
    o = o || {};
    if (o.id) n.id = o.id;
    if (o.cls) n.className = o.cls;
    if (o.title) n.title = o.title;
    if (o.html) n.innerHTML = o.html;
    return n;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function when(iso) {
    try {
      var dt = new Date(iso);
      return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
        dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  load();
  // On a connected site, sync with the Hub on load so a Hub-side resolve/reopen shows up
  // without waiting for the next local edit. No-op when not connected (maybeAutoPush guards).
  maybeAutoPush();
})();
