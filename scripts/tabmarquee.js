<script>
        (function() {
            const originalTitle = document.title;
            const messageOne = "Tom's 🧰 HandyTech";
            const messageTwo = "📐BookTOM.NYC🪚";
            // Array of messages to randomly pick from
            const messages = [
                "🖼Wall🧱Mounting",
                "Minor 🏠 Repairs",
                "🚿 Plumbing 🪣",
                "🔌 Electrical 💡",
                "💻 Repairs",
                "🪑 Fixes"
            ];
            let currentTitleIndex = 0; // Start with index 0
            let interval;

            function toggleTitle() {
                currentTitleIndex = (currentTitleIndex + 1) % 3; // Cycle through 0, 1, 2
                if (currentTitleIndex === 0) {
                    document.title = messageOne;
                } else if (currentTitleIndex === 1) {
                    document.title = messageTwo;
                } else { // messageThree logic
                    const randomIndex = Math.floor(Math.random() * messages.length);
                    document.title = messages[randomIndex];
                }
            }
            document.addEventListener("visibilitychange", function() {
                if (document.hidden) {
                    // Immediately toggle once and then start interval
                    toggleTitle();
                    interval = setInterval(toggleTitle, 2000); // Adjust time as needed
                } else {
                    clearInterval(interval); // Clear the interval when tab is active again
                    document.title = originalTitle; // Restore original title
                }
            });
        })();
    </script>
