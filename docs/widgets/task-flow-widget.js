import { Widget } from './widget-interface.js';

const STATUS_ICON = { pending:'⬜', 'in-progress':'🔵', waiting:'⏳', complete:'🟢', failed:'🔴' };

export default new Widget({
  id: 'task-flow',
  meta: { icon: '🔀', title: 'Task Flow' },
  
  render(container) {
    const state = window.dashboardState;
    if (!state) return;
    
    const roots = [...state.tasks.values()].filter(t => !t.parentId);
    if (!roots.length) {
      container.innerHTML = '<div style="padding:20px;color:var(--text-muted);font-size:12px;text-align:center">No tasks</div>';
      return;
    }
    
    const svg = [];
    let y = 20;
    const drawn = new Set();
    
    function drawTask(task, x, depth) {
      if (drawn.has(task.id)) return;
      drawn.add(task.id);
      
      const agent = task.agentId ? state.agents.get(task.agentId) : null;
      const color = agent?.color || '#555';
      const sc = {'pending':'#555','in-progress':'#3b82f6','waiting':'#ff9500','complete':'#00ff88','failed':'#ff6666'};
      const fill = sc[task.status];
      
      svg.push(`<rect x="${x}" y="${y}" width="180" height="40" rx="6" fill="${fill}22" stroke="${fill}" stroke-width="2"/>`);
      svg.push(`<text x="${x+10}" y="${y+20}" fill="${fill}" font-size="11" font-weight="600">${STATUS_ICON[task.status]} ${task.title.slice(0,20)}</text>`);
      if (task.agentId) svg.push(`<text x="${x+10}" y="${y+32}" fill="${color}" font-size="9">${task.agentId}</text>`);
      
      const taskY = y;
      y += 60;
      
      (task.children || []).forEach((cid, i) => {
        const child = state.tasks.get(cid);
        if (!child) return;
        const childX = x + 220;
        const childY = y;
        svg.push(`<line x1="${x+180}" y1="${taskY+20}" x2="${childX}" y2="${childY+20}" stroke="#555" stroke-width="1" stroke-dasharray="3,3"/>`);
        drawTask(child, childX, depth + 1);
      });
    }
    
    roots.forEach(t => drawTask(t, 20, 0));
    
    container.innerHTML = `<div style="overflow:auto;padding:12px"><svg width="100%" height="${y+20}" style="min-width:600px">${svg.join('')}</svg></div>`;
  }
});
