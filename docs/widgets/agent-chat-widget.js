import { Widget } from './widget-interface.js';

function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

export default new Widget({
  id: 'agent-chat',
  meta: { icon: '💬', title: 'Agent Chat' },
  
  render(container, config) {
    const state = window.dashboardState;
    const agentId = config?.agentId;
    
    if (!agentId) {
      container.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:12px;text-align:center">No agent selected</div>';
      return;
    }
    
    const agent = state?.agents.get(agentId);
    const color = agent?.color || '#888';
    const entries = state?.ringBuffer.filter(e => e.agentId === agentId || (agentId === 'chat' && e.agentId === 'user')).sort((a,b) => a.ts - b.ts) || [];
    
    const msgsHtml = entries.map(e => {
      const time = new Date(e.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
      const parsed = typeof marked !== 'undefined' ? marked.parse(e.content.slice(0, 500)) : escapeHtml(e.content.slice(0, 500));
      return `<div class="msg assistant" data-ts="${e.ts}"><div class="msg-agent" style="color:${color}">${e.agentId}</div><span class="stream-text">${parsed}</span><div class="msg-time">${time}</div></div>`;
    }).join('');
    
    container.innerHTML = `<div class="chat-wrap"><div class="messages" style="flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px">${msgsHtml}</div></div>`;
    
    const msgs = container.querySelector('.messages');
    if (config?._scrollTs) {
      const target = msgs.querySelector(`[data-ts="${config._scrollTs}"]`);
      if (target) {
        target.scrollIntoView({ block: 'center' });
        target.style.outline = '1px solid ' + color;
        setTimeout(() => target.style.outline = '', 2000);
        return;
      }
    }
    msgs.scrollTop = msgs.scrollHeight;
  }
});
