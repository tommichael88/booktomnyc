// marquee.js
(function() {
    const originalTitle = "BookTom";
    const originalFavicon = document.querySelector('link[rel="icon"]').href;
    const messageOne = "Tom's HandyTech";
    const messageTwo = "📐BookToM.NYC🪚";
    const messages = [
        "Wall 🧱 Mounting", "🖼️ Hanging", "🏠 Repairs", 
        "🚿Plumbing 🪣", "🔌 Electrical 💡", "💻 Repairs", 
        "🪑 Fixes", "🛋 Assembly️"
    ];
    let currentTitleIndex = 0;
    let interval;

    function toggleTitle() {
        currentTitleIndex = (currentTitleIndex + 1) % (messages.length + 2);
        if (currentTitleIndex === 0) {
            document.title = messageOne;
            document.querySelector('link[rel="icon"]').href = 'https://tommichael88.github.io/booktomnyc/images/TomsHandyTech_logo_today_lowres_nobg.png?raw=true';
        } else if (currentTitleIndex === 1) {
            document.title = messageTwo;
            document.querySelector('link[rel="icon"]').href = originalFavicon;
        } else {
            document.title = messages[currentTitleIndex - 2];
            document.querySelector('link[rel="icon"]').href = 'https://tommichael88.github.io/booktomnyc/images/TomKongerslev_nobg.png?raw=true';
        }
    }

    document.addEventListener("visibilitychange", function() {
        if (document.hidden) {
            interval = setInterval(toggleTitle, 10000);
        } else {
            clearInterval(interval);
            document.title = originalTitle;
            document.querySelector('link[rel="icon"]').href = originalFavicon;
        }
    });
})();
