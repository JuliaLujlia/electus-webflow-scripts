/**
 * Electus – SB Sandbox Debug
 * Phase 2: Logging (KEIN Blocken)
 */
(function () {
  // === SANDBOX GATE ===
  if (!location.pathname.includes('/sb-sandbox')) return;

  const TAG = '[SB SANDBOX]';
  const now = () => new Date().toISOString();

  console.log(`${TAG} electus-sb.js Phase 2 geladen`, { time: now(), path: location.pathname });

  // --- kleine Anzeige unten rechts ---
  const state = {
    submitEvents: 0,
    nativeSubmitCalls: 0,
    fetchCalls: 0,
    last: ''
  };

  function ensureBadge() {
    let el = document.getElementById('__sb_dbg_badge__');
    if (el) return el;

    el = document.createElement('div');
    el.id = '__sb_dbg_badge__';
    el.style.position = 'fixed';
    el.style.bottom = '12px';
    el.style.right = '12px';
    el.style.zIndex = '99999';
    el.style.background = '#0aa';
    el.style.color = '#fff';
    el.style.padding = '8px 10px';
    el.style.fontSize = '12px';
    el.style.borderRadius = '8px';
    el.style.fontFamily = 'system-ui, sans-serif';
    el.style.whiteSpace = 'pre';
    el.style.boxShadow = '0 6px 20px rgba(0,0,0,.18)';
    document.body.appendChild(el);
    return el;
  }

  function renderBadge() {
    const el = ensureBadge();
    el.textContent =
      `SB DEBUG\n` +
      `submit events: ${state.submitEvents}\n` +
      `form.submit(): ${state.nativeSubmitCalls}\n` +
      `fetch(): ${state.fetchCalls}\n` +
      `${state.last ? 'last: ' + state.last : ''}`;
  }

  function shortFormInfo(form) {
    if (!form) return { found: false };
    const name = form.getAttribute('name') || '';
    const action = form.getAttribute('action') || '';
    const id = form.id || '';
    const dataForm = form.getAttribute('data-form') || '';
    return { found: true, id, name, action, dataForm };
  }

  function logWithStack(label, payload) {
    // console.groupCollapsed + stack
    console.groupCollapsed(`${TAG} ${label}`);
    console.log('time:', now());
    console.log('payload:', payload);
    try {
      throw new Error('stack');
    } catch (e) {
      console.log('stack:', e.stack);
    }
    console.groupEnd();
  }

  // --- 1) Submit Events zählen (Capture, damit wir ALLES sehen) ---
  document.addEventListener(
    'submit',
    (e) => {
      state.submitEvents += 1;

      const form = e.target && e.target.tagName === 'FORM' ? e.target : null;
      const info = shortFormInfo(form);

      state.last = `submit#${state.submitEvents}`;
      renderBadge();

      logWithStack(`SUBMIT event #${state.submitEvents}`, {
        info,
        defaultPrevented: e.defaultPrevented,
        isTrusted: e.isTrusted,
      });
    },
    true // CAPTURE!
  );

  // --- 2) Programmatic form.submit() sichtbar machen ---
  (function patchNativeSubmit() {
    const orig = HTMLFormElement.prototype.submit;
    if (orig.__sb_patched__) return;

    function patchedSubmit() {
      state.nativeSubmitCalls += 1;
      state.last = `form.submit#${state.nativeSubmitCalls}`;
      renderBadge();

      const info = shortFormInfo(this);
      logWithStack(`HTMLFormElement.submit() call #${state.nativeSubmitCalls}`, { info });

      return orig.apply(this, arguments);
    }

    patchedSubmit.__sb_patched__ = true;
    HTMLFormElement.prototype.submit = patchedSubmit;
  })();

  // --- 3) fetch() Calls zählen (nur Beobachtung) ---
  (function patchFetch() {
    if (!window.fetch) return;
    const origFetch = window.fetch;
    if (origFetch.__sb_patched__) return;

    async function patchedFetch() {
      state.fetchCalls += 1;
      state.last = `fetch#${state.fetchCalls}`;
      renderBadge();

      const url = arguments[0];
      const opts = arguments[1];
      // Nur kurz loggen, nicht alles vollspammen:
      console.groupCollapsed(`${TAG} fetch() #${state.fetchCalls}`);
      console.log('time:', now());
      console.log('url:', url);
      if (opts) console.log('opts.method:', opts.method, 'opts.headers:', opts.headers);
      console.groupEnd();

      return origFetch.apply(this, arguments);
    }

    patchedFetch.__sb_patched__ = true;
    window.fetch = patchedFetch;
  })();

  // initial render
  renderBadge();
})();
