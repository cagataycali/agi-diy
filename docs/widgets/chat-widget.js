import { Widget } from './widget-interface.js';

function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

export default new Widget({
  id: 'chat',
  meta: { icon: '💬', title: 'Chat' },
  
  render(container) {
    if (container.querySelector('.chat-wrap')) return;
    
    const blockId = container.closest('.block').id;
    container.innerHTML = `<div class="chat-wrap">
      <div class="messages" id="msg-${blockId}"></div>
      <div class="input-area">
        <textarea placeholder="Message the mesh…" rows="1"></textarea>
        <button class="send-btn">Send</button>
        <button class="clear-btn" title="Clear chat" style="background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:var(--radius);padding:0 8px;cursor:pointer;font-size:11px">✕</button>
      </div>
    </div>`;
    
    const ta = container.querySelector('textarea');
    const chatHistory = JSON.parse(localStorage.getItem('mesh_chat_history') || '[]');
    let histIdx = -1;
    let draft = '';
    
    const send = () => {
      const t = ta.value.trim();
      if (!t) return;
      ta.value = '';
      ta.style.height = 'auto';
      chatHistory.unshift(t);
      if (chatHistory.length > 15) chatHistory.length = 15;
      localStorage.setItem('mesh_chat_history', JSON.stringify(chatHistory));
      histIdx = -1;
      window.sendChatMessage?.(t, blockId);
    };
    
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
      if (e.key === 'ArrowUp' && ta.selectionStart === 0) {
        if (histIdx < 0) draft = ta.value;
        if (histIdx < chatHistory.length - 1) { histIdx++; ta.value = chatHistory[histIdx]; }
        e.preventDefault();
      }
      if (e.key === 'ArrowDown' && ta.selectionStart === ta.value.length) {
        if (histIdx > 0) { histIdx--; ta.value = chatHistory[histIdx]; }
        else if (histIdx === 0) { histIdx = -1; ta.value = draft; }
        e.preventDefault();
      }
    });
    
    container.querySelector('.send-btn').addEventListener('click', send);
    container.querySelector('.clear-btn').addEventListener('click', () => {
      const m = document.querySelector(`#msg-${blockId}`);
      if (m) m.innerHTML = '';
      if (window.dashboardState) window.dashboardState.chatMessages.length = 0;
    });
  }
});
