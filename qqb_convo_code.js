(() => {
  'use strict';

  // Prevent accidental file drops
  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => e.preventDefault());

  // DOM refs
  const messagesEl       = document.getElementById('messages');
  const inputEl          = document.getElementById('userInput');
  const sendBtn          = document.getElementById('sendButton');
  const clearBtn         = document.getElementById('clearChat');
  const menuToggle       = document.getElementById('menuToggle');
  const closePanel       = document.getElementById('closePanel');
  const sidePanel        = document.getElementById('sidePanel');
  const panelOverlay     = document.getElementById('panelOverlay');
  const typingEl         = document.getElementById('bot-typing');
  const errorEl          = document.getElementById('error');
  const clearChatOption  = document.getElementById('clearChatOption');
  const exportChatOption = document.getElementById('exportChatOption');
  const darkModeToggle   = document.getElementById('darkModeToggle');

  // Storage keys
  const STORAGE_KEY    = 'chat_messages';
  const DARK_MODE_KEY  = 'dark_mode_enabled';

  // Bot replies
  const botReplies = [
    "Interesting! Can you tell me more?",
    "I see. How can I assist you further?",
    "That's a great question! Let me think...",
    "Got it. Here's what I can suggest:",
    "Hmm, let me process that for a moment."
  ];

  // Initialize
  function init() {
    loadMessages();
    loadDarkMode();
    inputEl.focus();

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    clearBtn.addEventListener('click', clearChat);
    menuToggle.addEventListener('click', openSidePanel);
    closePanel.addEventListener('click', closeSidePanel);
    panelOverlay.addEventListener('click', closeSidePanel);
    clearChatOption.addEventListener('click', clearChat);
    exportChatOption.addEventListener('click', exportChat);
    darkModeToggle.addEventListener('change', toggleDarkMode);

    if (messagesEl.children.length === 0) {
      appendMessage('Hello! How can I help you today?', false);
    }
  }

  // Timestamp without leading zero on hour
  function now() {
    const d = new Date();
    let h = d.getHours() % 12 || 12;
    let m = d.getMinutes();
    const ampm = d.getHours() >= 12 ? 'p' : 'a';
    return `${h}:${m}${ampm}`;
  }

  // Append message node
  function appendMessage(text, isUser, timestamp = now(), status = 'sent') {
    const id      = `msg-${Date.now()}`;
    const wrap    = document.createElement('div');
    wrap.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
    wrap.id        = id;

    const container = document.createElement('div');
    container.className = 'message-container';

    if (!isUser) {
      const icon = document.createElement('span');
      icon.className = 'robot-icon';
      icon.textContent = '🤖';
      container.appendChild(icon);
    }

    const bubble = document.createElement('div');
    bubble.className = 'message-content';
    bubble.textContent = text;
    bubble.setAttribute('role', 'button');
    bubble.setAttribute('tabindex', '0');
    bubble.setAttribute('aria-label', `Message: ${text}. Double tap to copy`);

    // Copy tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'copy-tooltip';
    tooltip.textContent = 'Tap to copy';
    bubble.appendChild(tooltip);

    bubble.addEventListener('mouseenter', () => tooltip.classList.add('show'));
    bubble.addEventListener('mouseleave', () => tooltip.classList.remove('show'));
    bubble.addEventListener('focus',     () => tooltip.classList.add('show'));
    bubble.addEventListener('blur',      () => tooltip.classList.remove('show'));

    bubble.addEventListener('click',   () => copyMessage(text, tooltip));
    bubble.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        copyMessage(text, tooltip);
      }
    });

    container.appendChild(bubble);

    const meta = document.createElement('div');
    meta.className = 'message-meta';

    const ts = document.createElement('span');
    ts.className = 'timestamp';
    ts.textContent = timestamp;
    meta.appendChild(ts);

    if (isUser) {
      const statusEl   = document.createElement('div');
      statusEl.className = 'status-indicator';

      const statusText = document.createElement('span');
      statusText.className = 'status-text';
      statusText.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      statusEl.appendChild(statusText);

      const statusIcon = document.createElement('span');
      statusIcon.className = `status-icon ${status}`;
      statusIcon.textContent = status === 'sent' ? '✓'
        : status === 'delivered' ? '✓✓'
        : '✓✓';
      statusEl.appendChild(statusIcon);

      meta.appendChild(statusEl);
    }

    wrap.appendChild(container);
    wrap.appendChild(meta);
    messagesEl.appendChild(wrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    saveMessages();
    return wrap;
  }

  // Copy text to clipboard
  function copyMessage(text, tooltip) {
    tooltip.textContent = 'Copying…';
    navigator.clipboard.writeText(text).then(() => {
      tooltip.textContent = 'Copied!';
      setTimeout(() => {
        tooltip.textContent = 'Tap to copy';
        tooltip.classList.remove('show');
      }, 1500);
    }).catch(() => {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      tooltip.textContent = 'Copied!';
      setTimeout(() => {
        tooltip.textContent = 'Tap to copy';
        tooltip.classList.remove('show');
      }, 1500);
    });
  }

  // Send message workflow
  function sendMessage() {
    errorEl.textContent = '';
    const txt = inputEl.value.trim();
    if (!txt) {
      errorEl.textContent = 'Please type a message before sending.';
      inputEl.focus();
      return;
    }

    const msgEl = appendMessage(txt, true);
    inputEl.value = '';
    inputEl.focus();

    // Simulate delivered & read
    setTimeout(() => updateStatus(msgEl, 'delivered'), 500 + Math.random()*500);
    setTimeout(() => updateStatus(msgEl, 'read'),      1000 + Math.random()*1000);

    typingEl.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      typingEl.setAttribute('aria-hidden', 'true');
      appendMessage(botReplies[Math.floor(Math.random() * botReplies.length)], false);
    }, 1500 + Math.random() * 1500);
  }

  // Update status indicator
  function updateStatus(msgEl, status) {
    const textEl = msgEl.querySelector('.status-text');
    const iconEl = msgEl.querySelector('.status-icon');
    textEl.textContent = status.charAt(0).toUpperCase() + status.slice(1);
    iconEl.className = `status-icon ${status}`;
  }

  // Clear chat
  function clearChat() {
    messagesEl.innerHTML = '';
    errorEl.textContent = '';
    appendMessage('Hello! How can I help you today?', false);
    closeSidePanel();
  }

  // Export chat
  function exportChat() {
    const lines = Array.from(messagesEl.children).map(el => {
      const who = el.classList.contains('user-message') ? 'You' : 'Bot';
      const txt = el.querySelector('.message-content').textContent;
      const ts  = el.querySelector('.timestamp').textContent;
      return `${ts} ${who}: ${txt}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `chat-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    closeSidePanel();
  }

  // Dark mode toggle
  function toggleDarkMode() {
    const on = darkModeToggle.checked;
    document.body.classList.toggle('dark-mode', on);
    localStorage.setItem(DARK_MODE_KEY, on);
  }
  function loadDarkMode() {
    const on = localStorage.getItem(DARK_MODE_KEY) === 'true';
    darkModeToggle.checked = on;
    document.body.classList.toggle('dark-mode', on);
  }

  // Persistence
  function saveMessages() {
    const data = Array.from(messagesEl.children).map(el => ({
      text: el.querySelector('.message-content').textContent,
      isUser: el.classList.contains('user-message'),
      ts: el.querySelector('.timestamp').textContent,
      status: el.querySelector('.status-text')?.textContent.toLowerCase() || 'sent'
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  function loadMessages() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      JSON.parse(raw).forEach(msg => {
        appendMessage(msg.text, msg.isUser, msg.ts, msg.status);
      });
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // Side panel
  function openSidePanel() {
    sidePanel.classList.add('open');
    panelOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
  function closeSidePanel() {
    sidePanel.classList.remove('open');
    panelOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // kickoff
  init();
})();
```
