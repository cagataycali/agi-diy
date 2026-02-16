import { Widget } from './widget-interface.js';

export default new Widget({
  id: 'ring',
  meta: { icon: '🔵', title: 'Ring Buffer' },
  
  init(state) {
    this.state = state;
    
    // Subscribe to standard events
    if (window.standardEvents) {
      window.standardEvents.on('message-sent', (msg) => {
        this.handleMessage(msg);
      });
      
      window.standardEvents.on('message-received', (msg) => {
        this.handleMessage(msg);
      });
      
      window.standardEvents.on('thinking-update', (update) => {
        if (update.final && this.container) {
          this.render(this.container);
        }
      });
    }
  },
  
  handleMessage(msg) {
    if (this.container) this.render(this.container);
  },
  
  render(container) {
    this.container = container;
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
  },
  
  onEvent(type, payload) {
    if (type === 'ring-entry') {
      // Prepend new entry to all ring widgets
      document.querySelectorAll('.ring-entries').forEach(el => {
        const state = window.dashboardState;
        const agent = state?.agents.get(payload.agentId);
        const color = agent?.color || '#888';
        const time = new Date(payload.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
        const html = `<div class="ring-entry" data-agent="${payload.agentId}" data-ts="${payload.ts}" style="border-left-color:${color}">
          <div class="re-header"><span class="re-agent" style="color:${color}">${payload.agentId}</span><span class="re-time">${time}</span></div>
          <div class="re-text">${(payload.content || '').slice(0,200)}</div>
        </div>`;
        el.insertAdjacentHTML('afterbegin', html);
        el.firstElementChild?.addEventListener('dblclick', () => window.openAgentChat?.(payload.agentId, payload.ts));
        while (el.children.length > 20) el.lastElementChild.remove();
      });
    }
  }
});
