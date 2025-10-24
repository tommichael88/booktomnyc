/*!
  marquee.js — improved safe marquee for tab title & favicon changes
  - respects prefers-reduced-motion
  - only runs when document.hidden
  - uses setTimeout scheduling (safer than continuous setInterval)
  - idempotent (guard via window.__booktom_marquee_loaded)
  - defensive try/catch around DOM writes
  - cleans up event listeners on pagehide/unload
*/
(function () {
  if (window.__booktom_marquee_loaded) return;
  window.__booktom_marquee_loaded = true;

  // If user prefers reduced motion, do nothing.
  try {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
  } catch (e) {
    // If matchMedia throws for any reason, continue (safe fallback).
  }

  const HIDE_INTERVAL_MS = 10000; // 10s between changes when hidden (keeps CPU low)
  const ICON_TOM = 'https://tommichael88.github.io/booktomnyc/images/tomshandytech_favicon.webp?raw=true';
  const ICON_TOMK = 'https://tommichael88.github.io/booktomnyc/images/TomKongerslev_nobg.png?raw=true';

  const originalTitle = (typeof document !== 'undefined' && document.title) ? document.title : 'BookTom';
  const messageOne = "Tom's HandyTech";
  const messageTwo = "📐BookToM.NYC🪚";
  const messages = [
    "Wall 🧱 Mounting", "🖼️ Hanging", "🏠 Repairs",
    "🚿 Plumbing", "🔌 Electrical", "💻 Repairs",
    "🪑 Fixes", "🛋️ Assembly"
  ];

  // collect favicon link elements safely
  const faviconLinks = Array.from(
    (typeof document !== 'undefined' && document.querySelectorAll)
      ? document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel~="icon"]')
      : []
  );

  // ensure at least one exists (create a lightweight one if none)
  if (faviconLinks.length === 0 && typeof document !== 'undefined' && document.head) {
    try {
      const l = document.createElement('link');
      l.rel = 'icon';
      // add a blank data URL to avoid network if nothing else
      l.href = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
      document.head.appendChild(l);
      faviconLinks.push(l);
    } catch (e) {
      // ignore creation failure
    }
  }

  const originalFavHref = (faviconLinks[0] && faviconLinks[0].href) ? faviconLinks[0].href : '';

  let idx = -1;
  let timeoutId = null;
  let running = false;

  function safeSetTitle(t) {
    try {
      if (typeof document !== 'undefined') {
        if (document.title !== t) document.title = t;
      }
    } catch (e) {
      // ignore failures to set title under strict CSP or odd environments
    }
  }

  function safeSetFavHref(href) {
    if (!href) return;
    for (const ln of faviconLinks) {
      try {
        // prefer setAttribute to avoid some browser normalization issues
        if (ln.getAttribute && ln.getAttribute('href') !== href) {
          ln.setAttribute('href', href);
        }
      } catch (e) {
        // ignore setter errors
      }
    }
  }

  function resetTitleAndIcon() {
    safeSetTitle(originalTitle);
    safeSetFavHref(originalFavHref || '');
  }

  function tickOnce() {
    // rotate messages: 0 -> messageOne, 1 -> messageTwo, >=2 -> messages[idx-2]
    idx = (idx + 1) % (messages.length + 2);
    if (idx === 0) {
      safeSetTitle(messageOne);
      safeSetFavHref(ICON_TOM);
    } else if (idx === 1) {
      safeSetTitle(messageTwo);
      // restore original favicon if known, otherwise keep existing
      safeSetFavHref(originalFavHref || ICON_TOMK);
    } else {
      safeSetTitle(messages[idx - 2]);
      safeSetFavHref(ICON_TOMK);
    }
  }

  // schedule pattern using setTimeout so we can more easily control/clear between runs
  function scheduleNext() {
    clearScheduled();
    timeoutId = setTimeout(() => {
      tickOnce();
      // schedule again only if still hidden and allowed
      if (shouldRun()) scheduleNext();
      else stopTicker();
    }, HIDE_INTERVAL_MS);
  }

  function clearScheduled() {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function shouldRun() {
    // Only run when document.hidden and user hasn't opted out (reduced motion) and not already visible
    try {
      if (typeof document === 'undefined') return false;
      if (!document.hidden) return false;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function startTicker() {
    if (running) return;
    if (!shouldRun()) return;
    running = true;
    // immediate tick for feedback, then schedule next
    try { tickOnce(); } catch (e) { /* ignore */ }
    scheduleNext();
  }

  function stopTicker() {
    if (!running && !timeoutId) {
      // ensure we still restore title/icon if not running
      resetTitleAndIcon();
      return;
    }
    running = false;
    clearScheduled();
    idx = -1;
    resetTitleAndIcon();
  }

  // Visibility handler: start when hidden, stop when visible
  function handleVisibility() {
    try {
      if (document.hidden) {
        startTicker();
      } else {
        stopTicker();
      }
    } catch (e) {
      // ignore
    }
  }

  // Attach handlers
  try {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility, { passive: true });
      // start immediately if already hidden at load time
      if (document.hidden) startTicker();
    }
  } catch (e) {
    // ignore event binding errors
  }

  // Clean up when page is unloading / navigating away
  function cleanup() {
    try {
      stopTicker();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      // clear any leftover timers
      clearScheduled();
    } catch (e) {
      // ignore
    }
  }

  try {
    // pagehide covers bfcache and more; unload as fallback
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('pagehide', cleanup, { passive: true });
      window.addEventListener('unload', cleanup, { passive: true });
    }
  } catch (e) {
    // ignore
  }

  // provide a way to programmatically stop/destroy from outside if needed
  try {
    window.__booktom_marquee = {
      start: startTicker,
      stop: stopTicker,
      destroy: () => {
        cleanup();
        try { delete window.__booktom_marquee_loaded; } catch (e) { /* ignore */ }
      }
    };
  } catch (e) {
    // ignore
  }
})();
