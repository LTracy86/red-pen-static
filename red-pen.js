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

  // ---- styles ----
  var css = '\
  #rp-fab{position:fixed;right:20px;bottom:20px;z-index:2147483000;width:46px;height:46px;border-radius:50%;border:none;background:' + RED + ';color:#fff;font-size:20px;cursor:pointer;box-shadow:0 4px 14px rgba(211,47,47,.45);display:flex;align-items:center;justify-content:center}\
  #rp-fab:hover{background:#b71c1c}\
  #rp-badge{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#fff;color:' + RED + ';font:700 11px/18px sans-serif;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.3)}\
  #rp-panel{position:fixed;right:20px;bottom:78px;z-index:2147483000;width:344px;max-height:74vh;display:none;flex-direction:column;background:#fff;color:#1e2225;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.28);font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;overflow:hidden}\
  #rp-panel.open{display:flex}\
  .rp-head{display:flex;align-items:center;gap:.4rem;padding:.6rem .75rem;background:' + RED + ';color:#fff;font-weight:600}\
  .rp-head .rp-nib{width:14px;height:14px;flex:none}\
  .rp-head .rp-repo{margin-left:auto;color:#fff;font-size:12px;font-weight:500;text-decoration:underline;cursor:pointer;background:none;border:none}\
  .rp-close{background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;padding:0 .1rem}\
  .rp-list{flex:1;overflow-y:auto;padding:.5rem .6rem;display:flex;flex-direction:column;gap:.45rem}\
  .rp-empty{color:#888;text-align:center;padding:1rem 0}\
  .rp-note{border:1px solid #e6e9ec;border-left:3px solid ' + RED + ';border-radius:5px;padding:.4rem .5rem}\
  .rp-note.resolved{opacity:.6;border-left-color:#9aa0a6}\
  .rp-note.progress{border-left-color:' + AMBER + '}\
  .rp-status{border:1px solid #d4d7da;border-radius:4px;background:#fff;color:#444;font:inherit;font-size:12px;padding:.05rem .2rem;cursor:pointer}\
  .rp-status:hover{border-color:' + RED + '}\
  .rp-meta{display:flex;gap:.35rem;align-items:center;margin-bottom:.25rem;font-size:12px}\
  .rp-num{display:inline-flex;align-items:center;justify-content:center;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:' + RED + ';color:#fff;font:700 10px/16px sans-serif}\
  .rp-tag{background:#f1f1f3;border-radius:3px;padding:.02rem .3rem}\
  .rp-tag.bug{color:#c62828}.rp-tag.suggestion{color:#1565c0}.rp-tag.question{color:#9a6a00}\
  .rp-prio.high{color:' + RED + ';font-weight:700}\
  .rp-when{margin-left:auto;color:#999}\
  .rp-body{white-space:pre-wrap;word-break:break-word}\
  .rp-acts{display:flex;gap:.4rem;margin-top:.3rem;flex-wrap:wrap;align-items:center}\
  .rp-acts button{background:none;border:none;color:#666;cursor:pointer;padding:.1rem .2rem;font-size:12px}\
  .rp-acts button:hover{color:' + RED + '}\
  .rp-replies{margin-top:.4rem;border-top:1px dashed #e6e9ec;padding-top:.4rem;display:flex;flex-direction:column;gap:.3rem}\
  .rp-reply{font-size:12px;padding:.2rem .4rem;background:#f3f5f6;border-radius:4px}\
  .rp-reply-meta{font-size:11px;color:#999;margin-bottom:.1rem}\
  .rp-reply-body{white-space:pre-wrap;word-break:break-word}\
  .rp-replyform{display:flex;gap:.3rem}\
  .rp-replytext{flex:1;min-width:0;border:1px solid #d4d7da;border-radius:4px;padding:.25rem .4rem;font:inherit;font-size:12px;resize:vertical;box-sizing:border-box}\
  .rp-replysend{background:#fff;border:1px solid #d4d7da;border-radius:4px;color:#444;font:inherit;font-size:12px;padding:.2rem .55rem;cursor:pointer;white-space:nowrap}\
  .rp-replysend:hover{border-color:' + RED + ';color:' + RED + '}\
  .rp-replycount{font-size:11.5px;color:#888;margin-top:.25rem}\
  #rp-panel.rp-dark .rp-replies{border-top-color:#3a3f44}\
  #rp-panel.rp-dark .rp-reply{background:#1f2327}\
  #rp-panel.rp-dark .rp-reply-meta,#rp-panel.rp-dark .rp-replycount{color:#9aa0a6}\
  #rp-panel.rp-dark .rp-replytext,#rp-panel.rp-dark .rp-replysend{background:#1a1d20;color:#e6e9ec;border-color:#3a3f44}\
  #rp-allmodal.rp-dark .rp-reply{background:#1f2327}\
  #rp-allmodal.rp-dark .rp-replycount{color:#9aa0a6}\
  .rp-add{border-top:1px solid #eee;padding:.55rem .6rem;display:flex;flex-direction:column;gap:.4rem}\
  .rp-add textarea{width:100%;box-sizing:border-box;resize:vertical;min-height:46px;border:1px solid #d4d7da;border-radius:4px;padding:.4rem;font:inherit}\
  .rp-add .rp-row{display:flex;gap:.4rem;align-items:center}\
  .rp-add select{border:1px solid #d4d7da;border-radius:4px;padding:.2rem}\
  .rp-add .rp-grow{flex:1}\
  .rp-pinbtn{background:#f1f1f3;border:1px solid #d4d7da;border-radius:4px;padding:.2rem .5rem;cursor:pointer;font:inherit;color:#444}\
  .rp-pinbtn.set{background:' + RED + ';color:#fff;border-color:' + RED + '}\
  .rp-add .rp-save{background:' + RED + ';color:#fff;border:none;border-radius:14px;padding:.35rem .9rem;cursor:pointer}\
  .rp-add .rp-save:hover{background:#b71c1c}\
  #rp-pinlayer{position:fixed;inset:0;z-index:2147482000;pointer-events:none}\
  .rp-pin{position:fixed;transform:translate(-50%,-50%);min-width:22px;height:22px;padding:0 5px;border-radius:11px;background:' + RED + ';color:#fff;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);font:700 11px/1 sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;box-sizing:border-box}\
  .rp-pin.resolved{background:#9aa0a6}\
  .rp-pin.progress{background:' + AMBER + '}\
  .rp-pin:hover{filter:brightness(.9)}\
  #rp-pinmode{position:fixed;inset:0;z-index:2147483600;cursor:crosshair;background:rgba(211,47,47,.06)}\
  #rp-pinhl{position:fixed;z-index:2147483500;border:2px solid ' + RED + ';background:rgba(211,47,47,.12);pointer-events:none;box-sizing:border-box;display:none}\
  #rp-hint{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:2147483700;background:#1e2225;color:#fff;font:13px/1 -apple-system,sans-serif;padding:.5rem .9rem;border-radius:6px;pointer-events:none}\
  #rp-loc{position:fixed;z-index:2147482500;border:3px solid ' + RED + ';border-radius:4px;background:rgba(211,47,47,.08);box-shadow:0 0 0 2px rgba(255,255,255,.5);pointer-events:none;transition:opacity .3s;display:none}\
  .rp-theme{background:none;border:none;color:#fff;font-size:15px;cursor:pointer;line-height:1;padding:0 .15rem}\
  #rp-panel.rp-dark{background:#23272b;color:#e6e9ec}\
  #rp-panel.rp-dark .rp-note{background:#2a2f34;border-color:#3a3f44}\
  #rp-panel.rp-dark .rp-note.resolved{border-left-color:#6b7177}\
  #rp-panel.rp-dark .rp-tag{background:#3a3f44;color:#e6e9ec}\
  #rp-panel.rp-dark .rp-when,#rp-panel.rp-dark .rp-empty{color:#9aa0a6}\
  #rp-panel.rp-dark .rp-add{border-top-color:#3a3f44}\
  #rp-panel.rp-dark textarea,#rp-panel.rp-dark select,#rp-panel.rp-dark input[type="text"]{background:#1a1d20;color:#e6e9ec;border-color:#3a3f44}\
  #rp-panel.rp-dark .rp-pinbtn{background:#3a3f44;color:#e6e9ec;border-color:#4a4f55}\
  #rp-panel.rp-dark .rp-acts button{color:#9aa0a6}\
  #rp-panel.rp-dark .rp-status{background:#1a1d20;color:#e6e9ec;border-color:#3a3f44}\
  .rp-editbar{display:none;align-items:center;justify-content:space-between;gap:.5rem;font-size:12px;color:' + RED + ';background:#fff4f4;border:1px solid #f3c0c0;border-radius:5px;padding:.25rem .5rem;margin-bottom:.4rem}\
  .rp-editbar.on{display:flex}\
  .rp-editbar button{background:none;border:none;color:#666;text-decoration:underline;cursor:pointer;font:inherit}\
  .rp-editbar button:hover{color:' + RED + '}\
  #rp-panel.rp-dark .rp-editbar{background:#3a2526;border-color:#6b3a3c;color:#ff8a80}\
  #rp-toast{position:fixed;left:50%;bottom:78px;transform:translateX(-50%);z-index:2147483900;background:#b71c1c;color:#fff;font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:.45rem .8rem;border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.4);max-width:80vw;display:none;align-items:center;gap:.6rem}\
  #rp-toast.on{display:flex}\
  .rp-toast-btn{background:none;border:1px solid rgba(255,255,255,.55);color:#fff;border-radius:4px;font:inherit;font-size:12px;font-weight:600;padding:.1rem .5rem;cursor:pointer}\
  .rp-toast-btn:hover{background:rgba(255,255,255,.18)}\
  .rp-resize{position:absolute;left:0;top:0;width:8px;height:100%;cursor:ew-resize;z-index:5}\
  .rp-resize::before{content:"";position:absolute;left:2px;top:50%;transform:translateY(-50%);width:3px;height:34px;border-radius:2px;background:#cfd4d8;transition:background .12s}\
  .rp-resize:hover::before{background:' + RED + '}\
  #rp-panel.rp-dark .rp-resize::before{background:#4a4f55}\
  #rp-allmodal{position:fixed;inset:0;z-index:2147483800;background:rgba(0,0,0,.45);display:none;align-items:center;justify-content:center;font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}\
  #rp-allmodal.open{display:flex}\
  .rp-allcard{background:#fff;color:#1e2225;width:600px;max-width:92vw;max-height:82vh;border-radius:8px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.4)}\
  .rp-allhead{display:flex;align-items:center;gap:.4rem;padding:.6rem .8rem;background:' + RED + ';color:#fff;font-weight:600}\
  .rp-allhead .rp-grow{flex:1}\
  .rp-allhead button{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.45);color:#fff;border-radius:5px;padding:.2rem .55rem;cursor:pointer;font:inherit;font-size:12px}\
  .rp-allhead button.rp-x{background:none;border:none;font-size:18px;padding:0 .15rem}\
  .rp-alltabs{display:flex;gap:.3rem;padding:.4rem .8rem 0}\
  .rp-alltab{background:none;border:none;border-bottom:2px solid transparent;color:#888;font:inherit;cursor:pointer;padding:.25rem .4rem}\
  .rp-alltab.active{color:' + RED + ';border-bottom-color:' + RED + '}\
  .rp-allfilters{display:flex;gap:.4rem;padding:.45rem .8rem 0}\
  .rp-allfilters input,.rp-allfilters select{border:1px solid #d4d7da;border-radius:4px;padding:.25rem .4rem;font:inherit;font-size:12px;color:#1e2225;background:#fff}\
  .rp-allfilters input{flex:1;min-width:0}\
  .rp-bulkbar{display:flex;gap:.4rem;align-items:center;padding:.45rem .8rem 0;font-size:12px;color:#666}\
  .rp-bulkbar select,.rp-bulkbar button{border:1px solid #d4d7da;border-radius:4px;padding:.2rem .4rem;font:inherit;font-size:12px;cursor:pointer;background:#fff;color:#444}\
  .rp-bulkbar button:hover{border-color:' + RED + ';color:' + RED + '}\
  .rp-allnote .rp-allcb{margin-right:.4rem}\
  #rp-allmodal.rp-dark .rp-allfilters input,#rp-allmodal.rp-dark .rp-allfilters select,#rp-allmodal.rp-dark .rp-bulkbar select,#rp-allmodal.rp-dark .rp-bulkbar button{background:#1a1d20;color:#e6e9ec;border-color:#3a3f44}\
  #rp-allmodal.rp-dark .rp-bulkbar{color:#9aa0a6}\
  .rp-alllist{flex:1;overflow-y:auto;padding:.5rem .8rem .8rem;display:flex;flex-direction:column;gap:.45rem}\
  .rp-allnote{border:1px solid #e6e9ec;border-left:3px solid ' + RED + ';border-radius:5px;padding:.4rem .55rem}\
  .rp-allnote.resolved{opacity:.6;border-left-color:#9aa0a6}\
  .rp-allnote.progress{border-left-color:' + AMBER + '}\
  .rp-allpage{color:#1565c0;font-size:11.5px;word-break:break-all;cursor:pointer;text-decoration:underline}\
  #rp-allmodal.rp-dark .rp-allcard{background:#23272b;color:#e6e9ec}\
  #rp-allmodal.rp-dark .rp-allnote{background:#2a2f34;border-color:#3a3f44}\
  #rp-allmodal.rp-dark .rp-allpage{color:#6db3ff}\
  #rp-allmodal.rp-dark .rp-alltab{color:#9aa0a6}\
  #rp-allmodal.rp-dark .rp-tag{background:#3a3f44;color:#e6e9ec}\
  #rp-allmodal.rp-dark #rp-hubbox{border-bottom-color:#3a3f44}\
  #rp-allmodal.rp-dark #rp-hubbox input{background:#1a1d20;color:#e6e9ec;border-color:#3a3f44}\
  #rp-allmodal.rp-dark #rp-hubsync{background:#3a3f44;color:#e6e9ec;border-color:#4a4f55}\
  #rp-allmodal.rp-dark #rp-setbox{border-bottom-color:#3a3f44}\
  #rp-allmodal.rp-dark #rp-setbox textarea{background:#1a1d20;color:#e6e9ec;border-color:#3a3f44}';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  // ---- elements ----
  var fab = el('button', { id: 'rp-fab', title: 'Red Pen', html: '<svg viewBox="0 0 24 24" aria-hidden="true" style="width:22px;height:22px;display:block"><path fill="currentColor" fill-rule="evenodd" d="M12 2l6.5 6.5-4.6 11.8a2 2 0 0 1-3.8 0L5.5 8.5 12 2zM13.7 11.4a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 1 1 3.4 0zM11.3 4.6h1.4v5h-1.4z"/></svg><span id="rp-badge" style="display:none">0</span>' });
  var panel = el('div', { id: 'rp-panel' });
  panel.innerHTML =
    '<div class="rp-resize" id="rp-resize" title="Drag to resize"></div>' +
    '<div class="rp-head"><svg class="rp-nib" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M12 2l6.5 6.5-4.6 11.8a2 2 0 0 1-3.8 0L5.5 8.5 12 2zM13.7 11.4a1.7 1.7 0 1 1-3.4 0 1.7 1.7 0 1 1 3.4 0zM11.3 4.6h1.4v5h-1.4z"/></svg>Red Pen' +
      '<button class="rp-repo" id="rp-repo" title="All notes across pages">All notes</button>' +
      '<button class="rp-theme" id="rp-theme" title="Toggle dark mode">&#9789;</button>' +
      '<button class="rp-close" title="Close">&times;</button></div>' +
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
      '<div id="rp-setbox" style="display:none;flex-direction:column;gap:.45rem;padding:.55rem .8rem;border-bottom:1px solid #eee">' +
        '<div style="font-weight:600">Settings</div>' +
        '<label style="font-size:12px;display:flex;flex-direction:column;gap:.2rem">Custom note types <span style="color:#888;font-weight:400">one per line: "Label" or "Label|#hexcolor"</span>' +
          '<textarea id="rp-customtypes" rows="3" placeholder="Design nit|#9C27B0&#10;Content|#2E7D32" style="box-sizing:border-box;width:100%;border:1px solid #d4d7da;border-radius:4px;padding:.35rem;font:ui-monospace,Menlo,Consolas,monospace;font-size:12px"></textarea></label>' +
        '<label style="font-size:12px;display:flex;align-items:center;gap:.4rem"><input type="checkbox" id="rp-pincustom"> Custom pin colour <input type="color" id="rp-pincolor" value="' + RED + '"></label>' +
        '<div><button id="rp-setsave" class="rp-save" style="background:' + RED + ';color:#fff;border:none;border-radius:14px;padding:.35rem .9rem;cursor:pointer">Save</button></div>' +
      '</div>' +
      '<div id="rp-hubbox" style="display:none;flex-direction:column;gap:.35rem;padding:.55rem .8rem;border-bottom:1px solid #eee">' +
        '<div style="font-weight:600">Connect to Red Pen Hub</div>' +
        '<div style="font-size:12px;color:#888">Push this site\'s notes to your local Hub so they show on the combined board. Copy the Hub URL + token from the Hub\'s "Connect a Site" panel.</div>' +
        '<input type="text" id="rp-huburl" placeholder="Hub URL (e.g. http://localhost:3900)" style="box-sizing:border-box;width:100%;border:1px solid #d4d7da;border-radius:4px;padding:.35rem;font:inherit">' +
        '<input type="text" id="rp-hubtoken" placeholder="Connect token" style="box-sizing:border-box;width:100%;border:1px solid #d4d7da;border-radius:4px;padding:.35rem;font:ui-monospace,Menlo,Consolas,monospace">' +
        '<input type="text" id="rp-hubproject" placeholder="Project name (shown on the board)" style="box-sizing:border-box;width:100%;border:1px solid #d4d7da;border-radius:4px;padding:.35rem;font:inherit">' +
        '<div style="display:flex;gap:.5rem;align-items:center">' +
          '<button id="rp-hubsave" class="rp-save" style="background:' + RED + ';color:#fff;border:none;border-radius:14px;padding:.35rem .9rem;cursor:pointer">Save &amp; Sync</button>' +
          '<button id="rp-hubsync" style="background:none;border:1px solid #d4d7da;border-radius:14px;padding:.35rem .8rem;cursor:pointer;color:#444">Sync now</button>' +
          '<span id="rp-hubstatus" style="font-size:12px;color:#888"></span>' +
        '</div>' +
      '</div>' +
      '<div class="rp-alltabs">' +
        '<button class="rp-alltab active" data-f="open">Open</button>' +
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
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) load();
  });
  panel.querySelector('.rp-close').addEventListener('click', function () { panel.classList.remove('open'); });
  document.getElementById('rp-repo').addEventListener('click', openAll);
  document.getElementById('rp-allclose').addEventListener('click', function () { allModal.classList.remove('open'); });
  allModal.addEventListener('click', function (e) { if (e.target === allModal) allModal.classList.remove('open'); });
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
    [].forEach.call(document.querySelectorAll('.rp-alltab'), function (t) { t.classList.toggle('active', t === b); });
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
    if (allModal.classList.contains('open')) { allModal.classList.remove('open'); return; }
    if (panel.classList.contains('open')) { if (editingId) exitEdit(); panel.classList.remove('open'); }
  });
  (function () { // resizable panel
    try { var w0 = parseInt(localStorage.getItem(WIDTH_KEY), 10); if (w0 >= 300 && w0 <= 900) panel.style.width = w0 + 'px'; } catch (e) {}
    var handle = document.getElementById('rp-resize');
    var dragging = false;
    handle.addEventListener('mousedown', function (e) { dragging = true; e.preventDefault(); document.body.style.userSelect = 'none'; });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      var w = (window.innerWidth - 20) - e.clientX;
      w = Math.max(300, Math.min(w, window.innerWidth - 40));
      panel.style.width = w + 'px';
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
  function saveAll(arr) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(arr)); } catch (e) {}
  }
  function uid() { return 'n_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function byId(arr, id) { for (var i = 0; i < arr.length; i++) { if (arr[i].id === id) return arr[i]; } return null; }

  function load() {
    notes = loadAll().filter(function (n) { return n.page === PAGE; });
    render();
    buildPins();
  }
  function add() {
    var body = document.getElementById('rp-body').value.trim();
    if (!body) return;
    var type = document.getElementById('rp-type').value;
    var priority = document.getElementById('rp-prio').value;
    var all = loadAll();
    if (editingId) {
      var n = byId(all, editingId);
      if (n) {
        n.body = body; n.type = type; n.priority = priority;
        n.anchor = pendingAnchor;              // preserved on edit-enter; Pin can replace/clear it
        n.updatedAt = new Date().toISOString();
        saveAll(all);
      }
      exitEdit();
    } else {
      all.push({
        id: uid(),
        body: body,
        type: type,
        priority: priority,
        status: 'open',
        url: location.href,
        page: PAGE,
        anchor: pendingAnchor,
        createdAt: new Date().toISOString(),
      });
      saveAll(all);
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
      n.status = status;
      // Stamp a resolved timestamp so the Hub board can show/sort when this note was
      // closed (matches the WordPress + Hub surfaces); clear it on reopen.
      if (status === 'resolved') { if (!n.resolvedAt) { n.resolvedAt = new Date().toISOString(); } }
      else { delete n.resolvedAt; }
      saveAll(all);
    }
    load(); if (allModal.classList.contains('open')) renderAll();
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
    document.getElementById('rp-type').value = TYPES[n.type] ? n.type : 'note';
    setSelVal(document.getElementById('rp-prio'), n.priority);
    pendingAnchor = (n.anchor && n.anchor.sel) ? n.anchor : null;
    var pb = document.getElementById('rp-pin');
    if (pendingAnchor) { pb.classList.add('set'); pb.innerHTML = '&#128205; Pinned'; }
    else { pb.classList.remove('set'); pb.innerHTML = '&#128205; Pin'; }
    document.getElementById('rp-editbar').classList.add('on');
    document.getElementById('rp-add').textContent = 'Save';
    panel.classList.add('open');
    document.getElementById('rp-body').focus();
  }
  function exitEdit() {
    editingId = null;
    document.getElementById('rp-body').value = '';
    document.getElementById('rp-editbar').classList.remove('on');
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
      var pc = pinColor();
      document.getElementById('rp-pincustom').checked = !!pc;
      document.getElementById('rp-pincolor').value = pc || RED;
    }
  }
  function saveSettings() {
    try {
      localStorage.setItem(CUSTOM_TYPES_KEY, document.getElementById('rp-customtypes').value);
      var custom = document.getElementById('rp-pincustom').checked;
      var col = document.getElementById('rp-pincolor').value;
      localStorage.setItem(PIN_COLOR_KEY, (custom && HEX_RE.test(col)) ? col : '');
    } catch (e) {}
    rebuildTypeSelect();
    rebuildTypeFilter();
    document.getElementById('rp-setbox').style.display = 'none';
    load(); if (allModal.classList.contains('open')) renderAll();
  }
  // ---- transient toast (with an optional action, e.g. Undo) ----
  var toastEl = null, toastTimer = null;
  function toast(msg, actionLabel, actionFn) {
    if (!toastEl) { toastEl = el('div', { id: 'rp-toast' }); document.body.appendChild(toastEl); }
    toastEl.textContent = '';
    var span = document.createElement('span'); span.textContent = msg; toastEl.appendChild(span);
    if (actionLabel && actionFn) {
      var btn = el('button', { cls: 'rp-toast-btn' }); btn.textContent = actionLabel;
      btn.addEventListener('click', function () { if (toastTimer) clearTimeout(toastTimer); toastEl.classList.remove('on'); actionFn(); });
      toastEl.appendChild(btn);
    }
    toastEl.classList.add('on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (toastEl) toastEl.classList.remove('on'); }, actionLabel ? 6000 : 3500);
  }
  function del(id) {
    saveAll(loadAll().filter(function (n) { return n.id !== id; }));
    load(); if (allModal.classList.contains('open')) renderAll();
    maybeAutoPush();
  }
  function addReply(id, text) {
    text = (text || '').trim();
    if (!text) return;
    var all = loadAll(); var n = byId(all, id);
    if (!n) return;
    if (!n.replies) n.replies = [];
    n.replies.push({ id: uid(), body: text, createdAt: new Date().toISOString() });
    saveAll(all);
    load(); if (allModal.classList.contains('open')) renderAll();
    // Replies aren't part of the Hub payload (mirrors the WP push), so no auto-push here.
  }
  function replyCount(n) { return (n.replies && n.replies.length) || 0; }
  function clearPending() {
    pendingAnchor = null;
    var b = document.getElementById('rp-pin');
    b.classList.remove('set');
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
    s.style.color = kind === 'err' ? RED : (kind === 'ok' ? '#2e7d32' : '#888');
  }
  function defaultProject() { return document.title || location.hostname || 'static-site'; }
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
      n.status = to;
      if (to === 'resolved') { if (changes[id].resolvedAt) { n.resolvedAt = changes[id].resolvedAt; } }
      else if (n.resolvedAt) { delete n.resolvedAt; }
      applied++;
    });
    if (applied) { saveAll(all); load(); if (allModal.classList.contains('open')) { renderAll(); } }
    return applied;
  }
  function pushToHub(opts) {
    opts = opts || {};
    var c = hubCfg();
    if (!c.url || !c.token) { if (!opts.silent) hubStatus('Enter a Hub URL and token first.', 'err'); return; }
    // Mirror the WP plugin's fix: a missing scheme makes the request fail silently, so default to http://.
    var url = c.url.replace(/^(?!https?:\/\/)/i, 'http://').replace(/\/+$/, '');
    var project = c.project || defaultProject();
    var notes = loadAll().map(function (n) {
      return {
        id: n.id, body: n.body, type: n.type, priority: n.priority, status: n.status,
        url: n.url || location.href, page: n.page,
        anchor: (n.anchor && n.anchor.sel) ? n.anchor.sel : '',
        createdAt: n.createdAt, resolvedAt: n.resolvedAt || null
      };
    });
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
      out += '<div class="rp-reply"><div class="rp-reply-meta">' + esc(when(r.createdAt)) + '</div>' +
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

    var list = document.getElementById('rp-list');
    if (!notes.length) { list.innerHTML = '<div class="rp-empty">No notes on this page yet.</div>'; return; }
    var sorted = notes.slice().sort(function (a, b) {
      if ((a.status === 'resolved') !== (b.status === 'resolved')) return a.status === 'resolved' ? 1 : -1;
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
    var pinNums = pinNumbers();
    list.innerHTML = '';
    sorted.forEach(function (n) {
      var num = pinNums[n.id];
      var d = el('div', { cls: 'rp-note ' + statusKey(n) });
      d.innerHTML =
        '<div class="rp-meta">' +
          (num ? '<span class="rp-num">' + num + '</span>' : '') +
          tagHtml(n) +
          '<span class="rp-prio ' + esc(n.priority) + '">' + esc(n.priority) + '</span>' +
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
  function openAll() { rebuildTypeFilter(); allModal.classList.add('open'); renderAll(); }
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
      ids.forEach(function (id) { var n = byId(all, id); if (n) n.status = action; });
    }
    saveAll(all);
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
      var d = el('div', { cls: 'rp-allnote ' + statusKey(n) });
      d.innerHTML =
        '<div class="rp-meta">' +
          '<input type="checkbox" class="rp-allcb" data-id="' + esc(n.id) + '">' +
          tagHtml(n) +
          '<span class="rp-prio ' + esc(n.priority) + '">' + esc(n.priority) + '</span>' +
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
      var marker = el('button', { cls: 'rp-pin ' + statusKey(n) });
      marker.textContent = nums[n.id] || '';
      if (pc && statusKey(n) === 'open') marker.style.background = pc; // custom colour, open pins only
      marker.title = typeLabel(n.type) + ': ' + (n.body || '').slice(0, 80);
      (function (note) { marker.addEventListener('click', function () { openTo(note); }); })(n);
      pinLayer.appendChild(marker);
      pins.push({ note: n, marker: marker });
    });
    positionPins();
  }
  function positionPins() {
    pins.forEach(function (p) {
      var target;
      try { target = document.querySelector(p.note.anchor.sel); } catch (e) { target = null; }
      if (!target) { p.marker.style.display = 'none'; return; }
      var r = target.getBoundingClientRect();
      p.marker.style.display = 'flex';
      p.marker.style.left = (r.left + (p.note.anchor.x || 0.5) * r.width) + 'px';
      p.marker.style.top = (r.top + (p.note.anchor.y || 0.5) * r.height) + 'px';
    });
  }
  function openTo(note) { panel.classList.add('open'); load(); locate(note); }

  // ---- pin mode ----
  var pinmode = null, pinhl = null, hint = null;
  function enterPinMode() {
    if (pinmode) return;
    panel.classList.remove('open');
    pinmode = el('div', { id: 'rp-pinmode' });
    pinhl = el('div', { id: 'rp-pinhl' });
    hint = el('div', { id: 'rp-hint', html: 'Click an element to pin the note (Esc to cancel)' });
    document.body.appendChild(pinmode);
    document.body.appendChild(pinhl);
    document.body.appendChild(hint);
    document.addEventListener('mousemove', onPinMove, true);
    document.addEventListener('click', onPinClick, true);
    document.addEventListener('keydown', onPinKey, true);
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
    if (!t) { pinhl.style.display = 'none'; return; }
    var r = t.getBoundingClientRect();
    pinhl.style.display = 'block';
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
    b.classList.add('set'); b.innerHTML = '&#128205; Pinned';
    exitPinMode();
    panel.classList.add('open');
    document.getElementById('rp-body').focus();
  }
  function onPinKey(e) { if (e.key === 'Escape') { e.preventDefault(); exitPinMode(); } }

  // ---- locate ----
  var locTimer = null;
  // Draw the roaming highlight box around an element (shared by Locate + jump-to-next).
  function showLoc(t) {
    var r = t.getBoundingClientRect();
    loc.style.display = 'block'; loc.style.opacity = '1';
    loc.style.left = (r.left - 4) + 'px'; loc.style.top = (r.top - 4) + 'px';
    loc.style.width = (r.width + 8) + 'px'; loc.style.height = (r.height + 8) + 'px';
    clearTimeout(locTimer);
    locTimer = setTimeout(function () { loc.style.opacity = '0'; setTimeout(function () { loc.style.display = 'none'; }, 350); }, 1800);
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
