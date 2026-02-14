import { Widget } from './widget-interface.js';

export default new Widget({
  id: 'agent-detail',
  meta: { icon: '🤖', title: 'Agent Detail' },
  
  render(container, config) {
    const state = window.dashboardState;
    const agentId = config?.agentId;
    
    if (!agentId) {
      container.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:12px;text-align:center">Click an agent to view details</div>';
      return;
    }
    
    const agent = state?.agents.get(agentId);
    if (!agent) {
      container.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:12px">Agent not found</div>';
      return;
    }
    
    const instances = agent.instances || 0;
    const tasks = [...state.tasks.values()].filter(t => t.agentId === agentId);
    const activeTasks = tasks.filter(t => t.status === 'in-progress');
    const completedTasks = tasks.filter(t => t.status === 'complete');
    
    const ringEntries = state.ringBuffer.filter(e => e.agentId === agentId).slice(-10).reverse();
    
    container.innerHTML = `<div style="padding:12px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="width:16px;height:16px;border-radius:50%;background:${agent.color}"></div>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:600">${agentId}</div>
          <div style="font-size:11px;color:var(--text-muted)">${agent.model}</div>
        </div>
        <div style="font-size:11px;padding:4px 8px;border-radius:4px;background:${agent.status==='processing'?agent.color+'22':'var(--bg-card)'};color:${agent.status==='processing'?agent.color:'var(--text-muted)'}">
          ${agent.status}
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px">
        <div style="background:var(--bg-card);padding:8px;border-radius:6px">
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase">Instances</div>
          <div style="font-size:18px;font-weight:600;color:${instances>0?agent.color:'var(--text-muted)'}">${instances}</div>
        </div>
        <div style="background:var(--bg-card);padding:8px;border-radius:6px">
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase">Active</div>
          <div style="font-size:18px;font-weight:600;color:var(--blue)">${activeTasks.length}</div>
        </div>
        <div style="background:var(--bg-card);padding:8px;border-radius:6px">
          <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase">Done</div>
          <div style="font-size:18px;font-weight:600;color:var(--green)">${completedTasks.length}</div>
        </div>
      </div>
      
      ${agent.workingOn ? `<div style="margin-bottom:16px;padding:8px;background:var(--bg-card);border-radius:6px;border-left:3px solid ${agent.color}">
        <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Currently Working On</div>
        <div style="font-size:11px">${agent.workingOn}</div>
      </div>` : ''}
      
      ${activeTasks.length ? `<div style="margin-bottom:16px">
        <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Active Tasks</div>
        ${activeTasks.map(t => `<div style="font-size:11px;padding:6px 8px;background:var(--bg-card);margin:2px 0;border-radius:4px;border-left:2px solid ${agent.color}">
          🔵 ${t.title}
        </div>`).join('')}
      </div>` : ''}
      
      ${ringEntries.length ? `<div>
        <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Recent Activity</div>
        ${ringEntries.map(e => `<div style="font-size:10px;padding:6px 8px;background:var(--bg-card);margin:2px 0;border-radius:4px">
          <div style="color:var(--text-muted);font-size:9px">${new Date(e.ts).toLocaleTimeString()}</div>
          <div style="margin-top:2px">${e.content.slice(0,150)}${e.content.length>150?'...':''}</div>
        </div>`).join('')}
      </div>` : ''}
    </div>`;
  }
});
