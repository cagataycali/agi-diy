/**
 * Widget Sidebar for agi.diy Dashboard
 * Manages widget launcher with pinning and overflow
 */

export class WidgetSidebar {
  constructor (config) {
    this.container = config.container
    this.widgetRegistry = config.widgetRegistry
    this.onAddWidget = config.onAddWidget
    this.actions = config.actions || []
    this.maxVisible = config.maxVisible || 10
    this.storageKey = config.storageKey || 'pinnedWidgets'
  }

  render () {
    const widgets = Array.from(this.widgetRegistry.widgets.entries())
    const pinned = new Set(JSON.parse(localStorage.getItem(this.storageKey) || '[]'))

    // Sort: pinned first, then alphabetically
    const sorted = widgets.sort(([idA, wA], [idB, wB]) => {
      const aPin = pinned.has(idA) ? 0 : 1
      const bPin = pinned.has(idB) ? 0 : 1
      if (aPin !== bPin) return aPin - bPin
      return (wA.meta.title || idA).localeCompare(wB.meta.title || idB)
    })

    const visible = sorted.slice(0, this.maxVisible)
    const overflow = sorted.slice(this.maxVisible)

    this.container.innerHTML = ''

    // Render visible widgets
    visible.forEach(([id, widget]) => {
      const btn = this.createWidgetButton(id, widget, pinned)
      this.container.appendChild(btn)
    })

    // Overflow menu
    if (overflow.length) {
      const more = this.createOverflowMenu(overflow, pinned)
      this.container.appendChild(more)
    }

    // Divider
    const divider = document.createElement('div')
    divider.className = 'sidebar-divider'
    this.container.appendChild(divider)

    // Actions
    this.actions.forEach(a => {
      const btn = document.createElement('button')
      btn.className = 'widget-btn'
      btn.title = a.title
      btn.onclick = a.fn
      btn.innerHTML = `<span class="icon">${a.icon}</span><span class="label">${a.label}</span>`
      this.container.appendChild(btn)
    })

    // Toggle
    const toggle = document.createElement('div')
    toggle.className = 'sidebar-toggle'
    toggle.title = 'Toggle sidebar'
    toggle.textContent = '📌'
    toggle.onclick = () => this.container.classList.toggle('docked')
    this.container.appendChild(toggle)
  }

  createWidgetButton (id, widget, pinned) {
    const btn = document.createElement('button')
    btn.className = 'widget-btn' + (pinned.has(id) ? ' pinned' : '')
    btn.title = widget.meta.title || id
    btn.onclick = () => this.onAddWidget(id)
    btn.oncontextmenu = (e) => {
      e.preventDefault()
      this.togglePin(id, pinned)
    }
    btn.innerHTML = `<span class="icon">${widget.meta.icon}</span><span class="label">${widget.meta.title}</span>`
    return btn
  }

  createOverflowMenu (overflow, pinned) {
    const more = document.createElement('div')
    more.className = 'widget-more'

    const moreBtn = document.createElement('button')
    moreBtn.className = 'widget-btn'
    moreBtn.title = 'More widgets'
    moreBtn.innerHTML = '<span class="icon">⋯</span><span class="label">More</span>'

    const menu = document.createElement('div')
    menu.className = 'widget-more-menu'

    overflow.forEach(([id, widget]) => {
      const btn = this.createWidgetButton(id, widget, pinned)
      menu.appendChild(btn)
    })

    more.appendChild(moreBtn)
    more.appendChild(menu)
    return more
  }

  togglePin (id, pinned) {
    if (pinned.has(id)) pinned.delete(id)
    else pinned.add(id)
    localStorage.setItem(this.storageKey, JSON.stringify([...pinned]))
    this.render()
  }
}
