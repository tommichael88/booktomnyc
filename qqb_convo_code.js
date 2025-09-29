(() => {
  const messagesEl = document.getElementById('messages');
  const inputEl    = document.getElementById('userInput');
  const sendBtn    = document.getElementById('sendButton');
  const clearBtn   = document.getElementById('clearChat');
  const typingEl   = document.getElementById('bot-typing');
  const errorEl    = document.getElementById('error');

  const botReplies = [
    "Interesting! Can you tell me more?",
    "I see. How can I assist you further?",
    "That's a great question! Let me think...",
    "Got it. Here's what I can suggest:",
    "Hmm, let me process that for a moment."
  ];

  function now() {
    return new Date().toLocaleTimeString([], {
      hour:   '2-digit',
      minute: '2-digit'
    });
  }

  function appendMessage(text, isUser) {
    const wrap = document.createElement('div');
    wrap.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    if (!isUser) {
      const icon = document.createElement('span');
      icon.className = 'robot-icon';
      icon.textContent = '🤖';
      wrap.appendChild(icon);
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-content';
    bubble.textContent = text;
    wrap.appendChild(bubble);

    const ts = document.createElement('div');
    ts.className = 'timestamp';
    ts.textContent = now();
    wrap.appendChild(ts);

    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function clearChat() {
    messagesEl.innerHTML = '';
    errorEl.textContent   = '';
    appendMessage('Hello! How can I help you today?', false);
  }

  function sendMessage() {
    errorEl.textContent = '';
    const txt = inputEl.value.trim();
    if (!txt) {
      errorEl.textContent = 'Please type a message before sending.';
      inputEl.focus();
      return;
    }

    appendMessage(txt, true);
    inputEl.value = '';
    inputEl.focus();

    typingEl.setAttribute('aria-hidden', 'false');

    setTimeout(() => {
      typingEl.setAttribute('aria-hidden', 'true');
      const reply = botReplies[
        Math.floor(Math.random() * botReplies.length)
      ];
      appendMessage(reply, false);
    }, 1500 + Math.random() * 1500);
  }

  clearBtn.addEventListener('click', clearChat);
  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // initialize
  clearChat();
  inputEl.focus();
})();
