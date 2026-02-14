/**
 * Layout Manager for agi.diy Dashboard
 * Handles draggable, resizable, dockable widget layout
 */

export class LayoutManager {
  constructor(config) {
    this.rootEl = config.rootEl;
    this.widgetRegistry = config.widgetRegistry;
    this.state = config.state;
    this.onLayoutChange = config.onLayoutChange || (() => {});
  }

  render() {
    this.rootEl.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'layout';
    container.style.height = 'calc(100vh - 36px)';

    for (const node of this.state.layout) {
      if (node.type === 'col') {
        const col = document.createElement('div');
        col.className = 'layout-col';
        col.style.flex = node.flex || 1;
        (node.children || []).forEach(child => col.appendChild(this.makeBlockEl(child)));
        container.appendChild(col);
      } else {
        container.appendChild(this.makeBlockEl(node));
      }
    }
    this.rootEl.appendChild(container);
  }

  makeBlockEl(cfg) {
    const meta = this.widgetRegistry.getMeta(cfg.type) || { icon:'📦', title:cfg.type };
    const title = cfg.type === 'agent-chat' ? cfg.agentId : meta.title;
    const div = document.createElement('div');
    div.className = 'block';
    div.id = cfg.id;
    div.style.flex = cfg.flex || 1;
    div.innerHTML = `<div class="block-header" draggable="true">
      <span class="block-icon">${meta.icon}</span>
      <span class="block-title">${title}</span>
      <button class="block-btn maximize-btn" title="Maximize">⤢</button>
      <button class="block-btn close-btn" title="Close">✕</button>
    </div><div class="block-body"></div>`;
    
    const header = div.querySelector('.block-header');
    header.addEventListener('dragstart', (e) => this.handleDragStart(e, cfg.id));
    header.addEventListener('dragend', () => this.handleDragEnd());
    
    div.querySelector('.maximize-btn').addEventListener('click', () => this.toggleMaximize(cfg.id));
    div.querySelector('.close-btn').addEventListener('click', () => this.removeBlock(cfg.id));
    
    const body = div.querySelector('.block-body');
    this.widgetRegistry.render(cfg.type, body, cfg);
    return div;
  }

  handleDragStart(e, blockId) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', blockId);
    this.state.draggingBlockId = blockId;
  }

  handleDragEnd() {
    this.state.draggingBlockId = null;
  }

  toggleMaximize(blockId) {
    const el = document.getElementById(blockId);
    if (!el) return;
    if (this.state.maximizedBlock === blockId) {
      el.classList.remove('maximized');
      this.state.maximizedBlock = null;
    } else {
      if (this.state.maximizedBlock) document.getElementById(this.state.maximizedBlock)?.classList.remove('maximized');
      el.classList.add('maximized');
      this.state.maximizedBlock = blockId;
    }
  }

  removeBlock(blockId) {
    this.findAndRemove(this.state.layout, blockId);
    this.render();
    this.onLayoutChange();
  }

  findAndRemove(layout, blockId) {
    for (let i = 0; i < layout.length; i++) {
      if (layout[i].id === blockId) { layout.splice(i, 1); return true; }
      if (layout[i].children && this.findAndRemove(layout[i].children, blockId)) {
        if (layout[i].children.length === 0) layout.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  findBlockCfg(id) {
    for (const n of this.state.layout) {
      if (n.id === id) return n;
      if (n.children) { const c = n.children.find(x => x.id === id); if (c) return c; }
    }
    return null;
  }
}
