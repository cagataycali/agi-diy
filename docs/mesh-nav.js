// Mesh Navigation - Tab switcher for mesh pages and custom layouts
window.MeshNav = {
  populate(containerId = 'meshNavSlot') {
    const slot = document.getElementById(containerId);
    if (!slot) return;
    
    const pages = window.AgentMesh?.pages || {};
    const current = window.AgentMesh?.currentPage?.id;
    const savedLayouts = JSON.parse(localStorage.getItem('dashboard_layouts') || '{}');
    
    slot.innerHTML = '';
    
    // Mesh pages as tabs
    Object.entries(pages).forEach(([file, p]) => {
      const btn = document.createElement('a');
      btn.href = file;
      btn.target = '_blank';
      btn.className = 'add-btn';
      btn.title = p.label;
      btn.textContent = p.icon;
      if (p.id === current) {
        btn.style.color = 'var(--accent)';
        btn.style.borderColor = 'var(--accent)';
      }
      slot.appendChild(btn);
    });
    
    // Custom layouts
    Object.entries(savedLayouts).forEach(([name, layout]) => {
      const btn = document.createElement('button');
      btn.className = 'add-btn';
      btn.title = `Load layout: ${name}`;
      btn.textContent = '📐';
      btn.onclick = () => window.layoutManager?.loadLayout(name);
      slot.appendChild(btn);
    });
    
    // Hide floating nav
    const floatingNav = document.getElementById('agent-mesh-nav');
    if (floatingNav) floatingNav.style.display = 'none';
  }
};
