import { Widget } from './widget-interface.js';

export default new Widget({
  id: 'agents',
  meta: { icon: '👥', title: 'Agents' },
  
  render(container, config) {
    const state = window.dashboardState;
    if (!state) return;
    
    container.innerHTML = '<div class="agent-list">' + [...state.agents.values()].map(a => {
      const instances = a.instances || 0;
      const maxInstances = a.maxInstances || 1;
      const tasks = [...state.tasks.values()].filter(t => t.agentId === a.id);
      const active = tasks.filter(t => t.status === 'in-progress').length;
      const done = tasks.filter(t => t.status === 'complete').length;
      
      return `
      <div class="agent-card" data-agent="${a.id}">
        <div class="agent-dot ${a.status==='processing'?'pulse':''}" style="background:${a.color}"></div>
        <div class="agent-info">
          <div class="agent-name">${a.id}</div>
          <div class="agent-model">${a.model}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;font-size:9px;color:var(--text-muted)">
          <span>⚡${instances}/${maxInstances}</span>
          <span>🔵${active}</span>
          <span>🟢${done}</span>
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
