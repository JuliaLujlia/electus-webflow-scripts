(function () {
  "use strict";

  const SB_DEBUG = /\/schnellbewerbung\/sb-sandbox/.test(location.pathname);
  if (!SB_DEBUG) return;

  const state = {
    submitEvents: 0,
    nativeSubmitCalls: 0,
    requestSubmitCalls: 0,
    clickCalls: 0,
    listenerAdds: 0,
    leadRequests: 0,
    submitListenerRegistry: new WeakMap(), // form -> [{capture, once, passive, stack, listener}]
  };

  const MAX_STACK_LINES = 12;
  const DEDUPE_STACK = true;

  function stack(label) {
    const s = new Error(label || "stack").stack || "";
    const lines = s.split("\n").slice(1, 1 + MAX_STACK_LINES);
    return lines.join("\n");
  }

  function log(...args) {
    console.log("[SB SANDBOX]", ...args);
  }

  function warn(...args) {
    console.warn("[SB SANDBOX]", ...args);
  }

  function onReady(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function looksLeadRelated(url, body) {
    const hay = (String(url || "") + " " + String(body || "")).toLowerCase();
    return /(webflow\.com\/api\/v1\/form\/|webhook|make\.com|zapier|formly|lead|application|bewerbung|submit|crm|hook)/.test(hay);
  }

  function isSubmitButton(el) {
    if (!el) return false;
    const t = (el.getAttribute && el.getAttribute("type")) || "";
    return el.tagName === "BUTTON" && (t === "" || t.toLowerCase() === "submit")
      || el.tagName === "INPUT" && t.toLowerCase() === "submit";
  }

  function getFormOfTarget(target) {
    if (!target) return null;
    if (target.tagName === "FORM") return target;
    return target.closest ? target.closest("form") : null;
  }

  function noteListener(form, meta) {
    if (!form) return;
    const arr = state.submitListenerRegistry.get(form) || [];
    arr.push(meta);
    state.submitListenerRegistry.set(form, arr);
  }

  function summarizeListeners(form) {
    const arr = state.submitListenerRegistry.get(form) || [];
    const count = arr.length;
    const byCapture = arr.reduce((acc, x) => {
      const k = x.capture ? "capture" : "bubble";
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    return { count, byCapture, entries: arr };
  }

  // A) Patch addEventListener: wer bindet "submit" wo?
  (function patchAddEventListener() {
    const orig = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      try {
        if (type === "submit") {
          state.listenerAdds += 1;
          const form = (this && this.tagName === "FORM") ? this : null;

          const capture =
            typeof options === "boolean" ? options :
            options && typeof options === "object" ? !!options.capture :
            false;

          const once =
            options && typeof options === "object" ? !!options.once : false;

          const passive =
            options && typeof options === "object" ? !!options.passive : false;

          const st = stack("addEventListener(submit)");
          noteListener(form, { capture, once, passive, stack: st, listener });

          warn(
            `addEventListener("submit") #${state.listenerAdds}`,
            { target: this, capture, once, passive },
            "\n" + st
          );
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
  })();

  // B) Patch dispatchEvent: wenn ein submit-event dispatched wird, woher?
  (function patchDispatchEvent() {
    const orig = EventTarget.prototype.dispatchEvent;
    EventTarget.prototype.dispatchEvent = function (evt) {
      try {
        if (evt && evt.type === "submit") {
          const st = stack("dispatchEvent(submit)");
          warn("dispatchEvent('submit') fired on:", this, "\n" + st);
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
  })();

  // C) Patch native form.submit()
  (function patchNativeSubmit() {
    const orig = HTMLFormElement.prototype.submit;
    HTMLFormElement.prototype.submit = function () {
      state.nativeSubmitCalls += 1;
      warn("HTMLFormElement.submit() call #" + state.nativeSubmitCalls, this, "\n" + stack("form.submit()"));
      return orig.apply(this, arguments);
    };
  })();

  // D) Patch requestSubmit() (wichtiger als submit() in modernen libs)
  (function patchRequestSubmit() {
    const orig = HTMLFormElement.prototype.requestSubmit;
    if (!orig) return;
    HTMLFormElement.prototype.requestSubmit = function (submitter) {
      state.requestSubmitCalls += 1;
      warn(
        "HTMLFormElement.requestSubmit() call #" + state.requestSubmitCalls,
        { form: this, submitter },
        "\n" + stack("form.requestSubmit()")
      );
      return orig.apply(this, arguments);
    };
  })();

  // E) Patch click() – oft wird submit über Button.click() ausgelöst
  (function patchClick() {
    const orig = HTMLElement.prototype.click;
    HTMLElement.prototype.click = function () {
      try {
        if (isSubmitButton(this)) {
          state.clickCalls += 1;
          warn("submitter.click() #" + state.clickCalls, this, "\n" + stack("submit button click()"));
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
  })();

  // F) Patch XHR/fetch/sendBeacon inkl. Stacktrace
  (function patchNetwork() {
    // fetch
    if (window.fetch) {
      const origFetch = window.fetch;
      window.fetch = function (input, init) {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        const body = init && init.body;
        if (looksLeadRelated(url, body)) {
          state.leadRequests += 1;
          warn("LEAD fetch #" + state.leadRequests, url, body ? "(has body)" : "", "\n" + stack("fetch lead"));
        }
        return origFetch.apply(this, arguments);
      };
    }

    // sendBeacon
    if (navigator.sendBeacon) {
      const origBeacon = navigator.sendBeacon.bind(navigator);
      navigator.sendBeacon = function (url, data) {
        if (looksLeadRelated(url, data)) {
          state.leadRequests += 1;
          warn("LEAD beacon #" + state.leadRequests, url, data ? "(has data)" : "", "\n" + stack("beacon lead"));
        }
        return origBeacon(url, data);
      };
    }

    // XHR
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
        warn(
          "LEAD XHR #" + state.leadRequests,
          this.__sb_method,
          url,
          body ? "(has body)" : "",
          "\n" + stack("xhr lead")
        );
      }
      return origSend.apply(this, arguments);
    };
  })();

  // G) Der “real” submit listener: zählt echte Events + zeigt Listener-Status
  onReady(() => {
    const form =
      document.querySelector('form[data-form="multistep"]')
      || document.querySelector("form");

    if (!form) {
      log("Kein form gefunden");
      return;
    }

    form.addEventListener(
      "submit",
      (e) => {
        state.submitEvents += 1;
        const submitter = e.submitter || null;
        const info = summarizeListeners(form);

        warn(
          `SUBMIT event #${state.submitEvents}`,
          {
            defaultPrevented: e.defaultPrevented,
            submitter,
            listenerCountTracked: info.count,
            byCapture: info.byCapture
          },
          "\nEvent stack (listener):\n" + stack("submit event")
        );
      },
      true // capture
    );

    log("Debugger aktiv. Form gefunden:", form);
    log("Tipp: In Chrome kannst du am Form-Element -> 'getEventListeners($0).submit' prüfen.");
  });
})();
