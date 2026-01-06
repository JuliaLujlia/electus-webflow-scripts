(function () {
  "use strict";

  const SB_DEBUG = /\/schnellbewerbung\/sb-sandbox/.test(location.pathname); // nur sandbox
  if (!SB_DEBUG) return;

  const state = {
    submitEvents: 0,
    nativeSubmitCalls: 0,
    leadRequests: 0,
  };

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function looksLeadRelated(url, body) {
    const hay = (String(url || "") + " " + String(body || "")).toLowerCase();
    return /(webhook|make\.com|zapier|formly|lead|application|bewerbung|submit|crm|hook)/.test(hay);
  }

  function log(...args) {
    console.log("[SB SANDBOX]", ...args);
  }

  // 1) Patch native form.submit()
  (function patchNativeSubmit() {
    const orig = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () {
      state.nativeSubmitCalls += 1;
      log("HTMLFormElement.submit() call #" + state.nativeSubmitCalls, this);
      return orig.apply(this, arguments);
    };
  })();

  // 2) Patch fetch (nur lead-relevant zählen)
  (function patchFetch() {
    if (!window.fetch) return;
    const orig = window.fetch;
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : (input && input.url) || "";
      const body = init && init.body;
      if (looksLeadRelated(url, body)) {
        state.leadRequests += 1;
        log("LEAD fetch #" + state.leadRequests, url, body ? "(has body)" : "");
      }
      return orig.apply(this, arguments);
    };
  })();

  // 3) Patch sendBeacon
  (function patchBeacon() {
    if (!navigator.sendBeacon) return;
    const orig = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (looksLeadRelated(url, data)) {
        state.leadRequests += 1;
        log("LEAD beacon #" + state.leadRequests, url, data ? "(has data)" : "");
      }
      return orig(url, data);
    };
  })();

  // 4) Patch XHR
  (function patchXHR() {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url) {
      this.__sb_url = url;
      this.__sb_method = method;
      return origOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      const url = this.__sb_url || "";
      if (looksLeadRelated(url, body)) {
        state.leadRequests += 1;
        log("LEAD XHR #" + state.leadRequests, this.__sb_method, url, body ? "(has body)" : "");
      }
      return origSend.apply(this, arguments);
    };
  })();

  // 5) Bind submit listener (erst wenn DOM da ist)
  onReady(() => {
    const form = document.querySelector('form[data-form="multistep"]') || document.querySelector("form");
    if (!form) {
      log("Kein form gefunden");
      return;
    }

    form.addEventListener("submit", (e) => {
      state.submitEvents += 1;
      log("SUBMIT event #" + state.submitEvents, "defaultPrevented:", e.defaultPrevented);
    }, true);

    log("Debugger aktiv. Form gefunden:", form);
  });

})();
