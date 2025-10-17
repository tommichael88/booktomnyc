// optimized-marquee.js
(function(){
  const originalTitle = document.title || "BookTom";
  const faviconLink = document.querySelector('link[rel="icon"]') || (() => {
    const l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); return l;
  })();
  const originalFavicon = faviconLink.href || '';
  const messageOne = "Tom's HandyTech";
  const messageTwo = "📐BookToM.NYC🪚";
  const messages = ["Wall 🧱 Mounting","🖼️ Hanging","🏠 Repairs","🚿 Plumbing","🔌 Electrical","💻 Repairs","🪑 Fixes","🛋 Assembly"];
  let idx = -1;
  let intervalId = null;

  function setFaviconOnce(href) {
    if (!href) return;
    try {
      if (faviconLink.href !== href) faviconLink.href = href;
    } catch (e) { /* noop */ }
  }

  function toggleTitleOnce() {
    idx = (idx + 1) % (messages.length + 2);
    if (idx === 0) {
      document.title = messageOne;
      setFaviconOnce('https://tommichael88.github.io/booktomnyc/images/TomsHandyTech_logo_today_lowres_nobg.png?raw=true');
    } else if (idx === 1) {
      document.title = messageTwo;
      setFaviconOnce(originalFavicon);
    } else {
      document.title = messages[idx - 2];
      setFaviconOnce('https://tommichael88.github.io/booktomnyc/images/TomKongerslev_nobg.png?raw=true');
    }
  }

  function startTicker() {
    if (intervalId) return;
    intervalId = setInterval(toggleTitleOnce, 10000);
  }

  function stopTicker() {
    if (!intervalId) return;
    clearInterval(intervalId);
    intervalId = null;
    document.title = originalTitle;
    setFaviconOnce(originalFavicon);
    idx = -1;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) startTicker();
    else stopTicker();
  }, {passive:true});

  // defensive: stop any stray interval when the script loads
  stopTicker();
})();
