import { Widget } from './widget-interface.js';

const STATUS_ICON = { pending:'⬜', 'in-progress':'🔵', waiting:'⏳', complete:'🟢', failed:'🔴' };
const STATUS_LABEL = { pending:'Pending', 'in-progress':'In Progress', waiting:'Waiting', complete:'Complete', failed:'Failed' };

export default new Widget({
  id: 'task-detail',
  meta: { icon: '🔍', title: 'Task Detail' },
  
  render(container, config) {
    const state = window.dashboardState;
    const taskId = config?.taskId;
    
    if (!taskId) {
      container.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:12px;text-align:center">Click a task to view details</div>';
      return;
    }
    
    const task = state?.tasks.get(taskId);
    if (!task) {
      container.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:12px">Task not found</div>';
      return;
    }
    
    const agent = task.agentId ? state.agents.get(task.agentId) : null;
    const color = agent?.color || 'var(--text-muted)';
    const sc = {'pending':'var(--text-muted)','in-progress':'var(--blue)','waiting':'var(--orange)','complete':'var(--green)','failed':'var(--red)'};
    
    const deps = (task.children || []).map(cid => state.tasks.get(cid)).filter(Boolean);
    const depsHtml = deps.length ? `<div style="margin:12px 0"><div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Sub-tasks (${deps.length})</div>
      ${deps.map(d => `<div style="font-size:11px;padding:4px 8px;border-left:2px solid ${state.agents.get(d.agentId)?.color||'#555'}">${STATUS_ICON[d.status]} ${d.title}</div>`).join('')}</div>` : '';
    
    const trace = task.trace || [];
    const traceHtml = trace.length ? `<div style="margin:12px 0"><div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Execution Trace</div>
      ${trace.map(t => `<div style="font-size:10px;padding:4px 8px;background:var(--bg-card);margin:2px 0;border-radius:4px">
        <div style="color:var(--text-muted)">${new Date(t.ts).toLocaleTimeString()}</div>
        <div style="color:${t.type==='tool'?'var(--cyan)':t.type==='thinking'?'var(--orange)':'var(--text)'}">
          ${t.type==='tool'?'🔧':'💭'} ${t.content.slice(0,200)}${t.content.length>200?'...':''}
        </div>
      </div>`).join('')}</div>` : '';
    
    container.innerHTML = `<div class="task-detail-view">
      <div class="td-header">
        <div><div class="td-title">${task.title}</div>
          <div style="display:flex;gap:8px;margin-top:4px;align-items:center">
            <span class="td-status" style="background:${sc[task.status]}22;color:${sc[task.status]}">${STATUS_ICON[task.status]} ${STATUS_LABEL[task.status]}</span>
            ${task.agentId ? `<span style="font-size:11px;color:${color}">⬤ ${task.agentId}</span>` : '<span style="font-size:11px;color:var(--text-muted)">unassigned</span>'}
          </div>
        </div>
      </div>
      ${depsHtml}
      ${traceHtml}
      <div style="font-size:9px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin:8px 0 4px">Worklog</div>
      <div class="worklog">${task.worklog.length ? task.worklog.map(w => {
        const wa = state.agents.get(w.agentId); const wc = wa?.color || '#888';
        return `<div class="wl-entry" style="border-left-color:${wc}">
          <div class="wl-head"><span style="color:${wc}">${w.agentId}</span><span>${new Date(w.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span></div>
          <div class="wl-msg">${w.msg}</div>
        </div>`;
      }).join('') : '<div style="font-size:11px;color:var(--text-muted);padding:8px">No worklog entries</div>'}</div>
    </div>`;
  }
});
