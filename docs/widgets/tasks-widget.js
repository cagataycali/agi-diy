import { Widget } from './widget-interface.js';

const STATUS_ICON = { pending:'⬜', 'in-progress':'🔵', waiting:'⏳', complete:'🟢', failed:'🔴' };

function formatElapsed(start, end) {
  const s = Math.floor((end - start) / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s/60)}m${s%60}s`;
}

function saveTasks() {
  try {
    localStorage.setItem('dashboard_tasks', JSON.stringify([...window.dashboardState.tasks.values()]));
  } catch(e) {}
}

export default new Widget({
  id: 'tasks',
  meta: { icon: '📋', title: 'Tasks' },
  
  render(container) {
    const state = window.dashboardState;
    if (!state) return;
    
    const roots = [...state.tasks.values()].filter(t => !t.parentId);
    const html = [];
    
    function isComplete(task) { 
      return task.status === 'complete' && (task.children||[]).every(cid => {
        const c = state.tasks.get(cid);
        return c && isComplete(c);
      });
    }
    
    function walk(task, depth) {
      if (isComplete(task)) return;
      const agent = task.agentId ? state.agents.get(task.agentId) : null;
      const color = agent?.color || 'var(--text-muted)';
      html.push(`<div class="task-item d${depth}" data-task="${task.id}" data-status="${task.status}" style="border-left-color:${color}">
        <span class="task-status">${STATUS_ICON[task.status]}</span>
        <div class="task-info">
          <div class="task-title">${task.title}</div>
          <div class="task-meta">
            ${task.agentId ? `<span style="color:${color}">${task.agentId}</span>` : '<span>unassigned</span>'}
            ${task.worklog.length ? `<span>${task.worklog.length} logs</span>` : ''}
            ${task.worklog.length ? `<span class="task-elapsed" data-start="${task.worklog[0].ts}" data-end="${task.status === 'complete' ? task.worklog[task.worklog.length-1].ts : 0}">${formatElapsed(task.worklog[0].ts, task.status === 'complete' ? task.worklog[task.worklog.length-1].ts : Date.now())}</span>` : ''}
          </div>
        </div>
      </div>`);
      (task.children||[]).forEach(cid => { const c = state.tasks.get(cid); if(c) walk(c, depth+1); });
    }
    
    roots.forEach(t => walk(t, 0));
    container.innerHTML = '<div class="task-tree">' + html.join('') + '</div>';
    container.querySelectorAll('.task-item').forEach(el => 
      el.addEventListener('click', () => window.openTaskDetail?.(el.dataset.task))
    );
  },
  
  actions: {
    stopAllTasks() {
      const state = window.dashboardState;
      state.tasks.forEach(t => { if (t.status !== 'complete') t.status = 'complete'; });
      window.widgetRegistry.emit('tasks', { type: 'tasks' });
      saveTasks();
    },
    
    clearDoneTasks() {
      const state = window.dashboardState;
      [...state.tasks.entries()].forEach(([id, t]) => { if (t.status === 'complete') state.tasks.delete(id); });
      state.tasks.forEach(t => { t.children = t.children.filter(c => state.tasks.has(c)); });
      window.widgetRegistry.emit('tasks', { type: 'tasks' });
      saveTasks();
    }
  }
});
