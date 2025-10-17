// marquee-fixed.js
(function() {
  if (window.__booktom_marquee_loaded) return;
  window.__booktom_marquee_loaded = true;

  const originalTitle = document.title || "BookTom";
  const messageOne = "Tom's HandyTech";
  const messageTwo = "📐BookToM.NYC🪚";
  const messages = [
    "Wall 🧱 Mounting", "🖼️ Hanging", "🏠 Repairs",
    "🚿 Plumbing", "🔌 Electrical", "💻 Repairs",
    "🪑 Fixes", "🛋️ Assembly"
  ];

  // collect all favicon link elements commonly used
  const faviconLinks = Array.from(document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel~="icon"]'));
  // ensure at least one exists
  if (faviconLinks.length === 0) {
    const l = document.createElement('link');
    l.rel = 'icon';
    document.head.appendChild(l);
    faviconLinks.push(l);
  }
  const originalFavHref = faviconLinks[0].href || '';

  let idx = -1;
  let intervalId = null;
  const HIDE_INTERVAL_MS = 10000;

  function setFavHref(href) {
    if (!href) return;
    for (const ln of faviconLinks) {
      try {
        if (ln.href !== href) ln.href = href;
      } catch (e) { /* ignore setter errors */ }
    }
  }

  function tickOnce() {
    idx = (idx + 1) % (messages.length + 2);
    if (idx === 0) {
      document.title = messageOne;
      setFavHref('https://tommichael88.github.io/booktomnyc/images/TomsHandyTech_logo_today_lowres_nobg.png?raw=true');
    } else if (idx === 1) {
      document.title = messageTwo;
      setFavHref(originalFavHref);
    } else {
      document.title = messages[idx - 2];
      setFavHref('https://tommichael88.github.io/booktomnyc/images/TomKongerslev_nobg.png?raw=true');
    }
  }

  function startTicker() {
    if (intervalId) return;
    // run one cycle immediately on hide to show activity
    tickOnce();
    intervalId = setInterval(tickOnce, HIDE_INTERVAL_MS);
  }

  function stopTicker() {
    if (!intervalId) return;
    clearInterval(intervalId);
    intervalId = null;
    idx = -1;
    document.title = originalTitle;
    setFavHref(originalFavHref);
  }

  // Visibility handler: start when hidden, stop when visible
  function handleVisibility() {
    if (document.hidden) startTicker();
    else stopTicker();
  }

  document.addEventListener('visibilitychange', handleVisibility, { passive: true });

  // If the document is already hidden at load, ensure the ticker runs
  if (document.hidden) startTicker();

  // defensive: when page unloads, clear interval
  window.addEventListener('unload', stopTicker, { passive: true });
})();
