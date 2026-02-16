/**
 * Default complications for agi.diy Dashboard
 */

export function registerDefaultComplications (registry, deps) {
  const { state, layoutManager, widgetRegistry } = deps

  // ═══ STATUSBAR ═══

  registry.register({
    id: 'mesh-nav',
    placement: ['statusbar'],
    render: (container) => {
      container.id = 'meshNavSlot'
      container.style.cssText = 'display:flex;align-items:center;gap:4px'
      setTimeout(() => window.MeshNav?.populate('meshNavSlot'), 500)
    }
  })

  registry.register({
    id: 'wall-clock',
    placement: ['statusbar'],
    render: (container) => {
      container.className = 'wall-clock'
      container.style.cssText = 'font-size:11px;color:var(--accent);font-variant-numeric:tabular-nums;margin-left:auto'
      container.textContent = '0:00'
    },
    update: (el, { state }) => {
      if (!state?.wallClockStart) return
      const s = Math.floor((Date.now() - state.wallClockStart) / 1000)
      el.textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
    }
  })

  // ═══ SIDEBAR ═══

  registry.register({
    id: 'stop-all',
    placement: ['sidebar'],
    icon: '⏹',
    label: 'Stop All',
    title: 'Stop all active tasks',
    action: () => window.stopAllTasks?.()
  })

  registry.register({
    id: 'clear-done',
    placement: ['sidebar'],
    icon: '🗑️',
    label: 'Clear Done',
    title: 'Clear completed tasks',
    action: () => window.clearDoneTasks?.()
  })

  registry.register({
    id: 'reset',
    placement: ['sidebar'],
    icon: '🔄',
    label: 'Reset',
    title: 'Reset layout',
    action: () => layoutManager.resetLayout(window.DEFAULT_LAYOUT)
  })

  registry.register({
    id: 'layouts',
    placement: ['sidebar'],
    icon: '💾',
    label: 'Layouts',
    title: 'Manage layouts',
    action: () => window.showLayoutMenu?.()
  })

  registry.register({
    id: 'settings',
    placement: ['sidebar'],
    icon: '⚙',
    label: 'Settings',
    title: 'Settings',
    action: () => window.AgentMesh?.settings?.open()
  })

  // ═══ WIDGETS (dynamic) ═══

  widgetRegistry.getAll?.().forEach(widget => {
    if (widget.meta?.hideFromSidebar) return

    registry.register({
      id: `widget-${widget.type}`,
      placement: ['sidebar'],
      icon: widget.meta?.icon || '📦',
      label: widget.meta?.title || widget.type,
      title: `Add ${widget.meta?.title || widget.type}`,
      action: () => layoutManager.openWidget(widget.type)
    })
  })
}
