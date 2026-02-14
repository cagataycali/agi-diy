import { Widget } from './widget-interface.js';

export default new Widget({
  id: 'ring',
  meta: { icon: '🔵', title: 'Ring Buffer' },
  
  render(container) {
    const state = window.dashboardState;
    if (!state) return;
    
    const sorted = [...state.ringBuffer].sort((a,b) => b.ts - a.ts);
    container.innerHTML = '<div class="ring-entries">' + sorted.map(e => {
      const agent = state.agents.get(e.agentId);
      const color = agent?.color || '#888';
      const time = new Date(e.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
      return `<div class="ring-entry" data-agent="${e.agentId}" data-ts="${e.ts}" style="border-left-color:${color}">
        <div class="re-header"><span class="re-agent" style="color:${color}">${e.agentId}</span><span class="re-time">${time}</span></div>
        <div class="re-text">${e.content.slice(0,200)}</div>
      </div>`;
    }).join('') + '</div>';
    
    container.querySelectorAll('.ring-entry').forEach(el => 
      el.addEventListener('dblclick', () => window.openAgentChat?.(el.dataset.agent, parseInt(el.dataset.ts)))
    );
  }
});
