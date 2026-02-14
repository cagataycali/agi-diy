import { Widget } from './widget-interface.js';

export default new Widget({
  id: 'agents',
  meta: { icon: '👥', title: 'Agents' },
  
  render(container, config) {
    const state = window.dashboardState;
    if (!state) return;
    
    container.innerHTML = '<div class="agent-list">' + [...state.agents.values()].map(a => {
      const instances = a.instances || 1;
      const working = a.workingOn ? `<div style="font-size:9px;color:var(--text-muted);margin-top:2px">${a.workingOn.slice(0,40)}...</div>` : '';
      return `
      <div class="agent-card" data-agent="${a.id}">
        <div class="agent-dot ${a.status==='processing'?'pulse':''}" style="background:${a.color}"></div>
        <div class="agent-info">
          <div class="agent-name">${a.id}${instances>1?` (×${instances})`:''}</div>
          <div class="agent-model">${a.model}</div>
          ${working}
        </div>
        <div class="agent-badge" style="color:${a.status==='processing'?a.color:'var(--text-muted)'}">${a.status === 'processing' ? '<span class="typing-dots"><span></span><span></span><span></span></span>' : a.status}</div>
      </div>
    `;}).join('') + '</div>';
    
    container.querySelectorAll('.agent-card').forEach(el => {
      el.addEventListener('click', () => window.openAgentDetail?.(el.dataset.agent));
      el.addEventListener('dblclick', () => window.openAgentChat?.(el.dataset.agent));
    });
  },
  
  onEvent(type, payload) {
    if (type === 'agent-status' && payload?.agentId) {
      document.querySelectorAll(`.agent-card[data-agent="${payload.agentId}"]`).forEach(card => {
        const a = window.dashboardState?.agents.get(payload.agentId);
        if (!a) return;
        const dot = card.querySelector('.agent-dot');
        const badge = card.querySelector('.agent-badge');
        dot.className = `agent-dot ${a.status === 'processing' ? 'pulse' : ''}`;
        badge.style.color = a.status === 'processing' ? a.color : 'var(--text-muted)';
        badge.innerHTML = a.status === 'processing' ? '<span class="typing-dots"><span></span><span></span><span></span></span>' : a.status;
      });
    }
  }
});
