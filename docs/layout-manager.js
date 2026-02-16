/**
 * Layout Manager for agi.diy Dashboard
 * Handles draggable, resizable, dockable widget layout and complications
 */

export class LayoutManager {
  constructor (config) {
    this.rootEl = config.rootEl
    this.widgetRegistry = config.widgetRegistry
    this.complicationRegistry = config.complicationRegistry
    this.state = config.state
    this.onLayoutChange = config.onLayoutChange || (() => {})
    this.dragState = { blockId: null, dropZone: null, targetBlockId: null }

    // Complication containers
    this.statusbarEl = config.statusbarEl
    this.sidebarEl = config.sidebarEl
  }

  render () {
    this.rootEl.innerHTML = ''
    const container = document.createElement('div')
    container.className = 'layout'
    container.style.height = 'calc(100vh - 36px)'
    container.dataset.containerId = 'root'

    this.renderNode(container, this.state.layout)
    this.rootEl.appendChild(container)

    // Render complications
    this.renderComplications()
  }

  renderComplications () {
    if (!this.complicationRegistry) return

    const complications = this.state.complications || {
      statusbar: ['mesh-nav', 'wall-clock']
    }

    const context = { state: this.state, layoutManager: this, widgetRegistry: this.widgetRegistry }

    if (this.statusbarEl) {
      this.complicationRegistry.render(this.statusbarEl, 'statusbar', complications.statusbar, context)
    }
  }

  renderNode (parent, nodes) {
    nodes.forEach((node, idx) => {
      if (idx > 0 && parent.dataset.containerId) {
        // Add resize handle between siblings
        // If parent is vertical (layout-col), use horizontal handle (row)
        // If parent is horizontal (layout or layout-row), use vertical handle (col)
        const isVerticalStack = parent.classList.contains('layout-col')
        const handleType = isVerticalStack ? 'row' : 'col'
        parent.appendChild(this.createResizeHandle(handleType))
      }

      if (node.type === 'col' || node.type === 'row') {
        const container = document.createElement('div')
        container.className = node.type === 'col' ? 'layout-col' : 'layout-row'
        container.style.flex = node.flex || 1
        container.id = node.id
        container.dataset.containerId = node.id

        this.renderNode(container, node.children || [])
        parent.appendChild(container)
      } else {
        parent.appendChild(this.makeBlockEl(node))
      }
    })
  }

  createResizeHandle (orientation) {
    const handle = document.createElement('div')
    handle.className = `resize-handle resize-handle-${orientation}`
    handle.style.cursor = orientation === 'col' ? 'ew-resize' : 'ns-resize'

    let startPos = 0
    let startFlex = [0, 0]
    let elements = []

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      startPos = orientation === 'col' ? e.clientX : e.clientY

      // Get adjacent elements
      elements = [handle.previousElementSibling, handle.nextElementSibling]
      startFlex = elements.map(el => parseFloat(el.style.flex) || 1)

      const onMove = (e) => {
        const delta = (orientation === 'col' ? e.clientX : e.clientY) - startPos
        const totalSize = orientation === 'col'
          ? elements[0].offsetWidth + elements[1].offsetWidth
          : elements[0].offsetHeight + elements[1].offsetHeight

        const ratio = delta / totalSize
        const newFlex0 = Math.max(0.2, startFlex[0] + ratio)
        const newFlex1 = Math.max(0.2, startFlex[1] - ratio)

        elements[0].style.flex = newFlex0
        elements[1].style.flex = newFlex1

        this.updateLayoutFlex(elements[0].id, newFlex0)
        this.updateLayoutFlex(elements[1].id, newFlex1)
      }

      const onUp = () => {
        document.removeEventListener('mousemove', onMove)
        document.removeEventListener('mouseup', onUp)
        this.saveLayout()
      }

      document.addEventListener('mousemove', onMove)
      document.addEventListener('mouseup', onUp)
    })

    return handle
  }

  updateLayoutFlex (nodeId, flex) {
    const cfg = this.findNodeCfg(nodeId)
    if (cfg) cfg.flex = flex
  }

  findNodeCfg (id, nodes = this.state.layout) {
    for (const n of nodes) {
      if (n.id === id) return n
      if (n.children) {
        const found = this.findNodeCfg(id, n.children)
        if (found) return found
      }
    }
    return null
  }

  makeBlockEl (cfg) {
    const meta = this.widgetRegistry.getMeta(cfg.type) || { icon: '📦', title: cfg.type }
    const title = cfg.type === 'agent-chat' ? cfg.agentId : meta.title
    const div = document.createElement('div')
    div.className = 'block'
    div.id = cfg.id
    div.style.flex = cfg.flex || 1
    div.dataset.blockId = cfg.id

    div.innerHTML = `<div class="block-header" draggable="true">
      <span class="block-icon">${meta.icon}</span>
      <span class="block-title">${title}</span>
      <button class="block-btn maximize-btn" title="Maximize">⤢</button>
      <button class="block-btn close-btn" title="Close">✕</button>
    </div>
    <div class="block-body"></div>
    <div class="drop-zones" style="display:none">
      <div class="drop-zone drop-zone-top" data-zone="top"></div>
      <div class="drop-zone drop-zone-right" data-zone="right"></div>
      <div class="drop-zone drop-zone-bottom" data-zone="bottom"></div>
      <div class="drop-zone drop-zone-left" data-zone="left"></div>
      <div class="drop-zone drop-zone-center" data-zone="center"></div>
    </div>`

    const header = div.querySelector('.block-header')
    header.addEventListener('dragstart', (e) => this.handleDragStart(e, cfg.id))
    header.addEventListener('dragend', () => this.handleDragEnd())

    div.addEventListener('dragover', (e) => this.handleDragOver(e, cfg.id))
    div.addEventListener('dragleave', () => this.handleDragLeave(cfg.id))
    div.addEventListener('drop', (e) => this.handleDrop(e, cfg.id))

    div.querySelector('.maximize-btn').addEventListener('click', () => this.toggleMaximize(cfg.id))
    div.querySelector('.close-btn').addEventListener('click', () => this.removeBlock(cfg.id))

    const body = div.querySelector('.block-body')
    this.widgetRegistry.render(cfg.type, body, cfg)
    return div
  }

  handleDragStart (e, blockId) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', blockId)
    this.dragState.blockId = blockId
    document.getElementById(blockId)?.classList.add('dragging')
  }

  handleDragEnd () {
    document.getElementById(this.dragState.blockId)?.classList.remove('dragging')
    this.hideAllDropZones()
    this.dragState = { blockId: null, dropZone: null, targetBlockId: null }
  }

  handleDragOver (e, targetBlockId) {
    e.preventDefault()
    if (this.dragState.blockId === targetBlockId) return
    if (this.isCircularDrop(this.dragState.blockId, targetBlockId)) return

    const block = document.getElementById(targetBlockId)
    const rect = block.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    const zone = this.detectZone(x, y, rect.width, rect.height)

    if (zone !== this.dragState.dropZone || targetBlockId !== this.dragState.targetBlockId) {
      this.hideAllDropZones()
      this.showDropZone(targetBlockId, zone)
      this.dragState.dropZone = zone
      this.dragState.targetBlockId = targetBlockId
    }
  }

  detectZone (x, y, width, height) {
    const threshold = 0.25
    const xRatio = x / width
    const yRatio = y / height

    if (yRatio < threshold) return 'top'
    if (yRatio > 1 - threshold) return 'bottom'
    if (xRatio < threshold) return 'left'
    if (xRatio > 1 - threshold) return 'right'
    return 'center'
  }

  showDropZone (blockId, zone) {
    const block = document.getElementById(blockId)
    const zones = block?.querySelector('.drop-zones')
    if (!zones) return

    zones.style.display = 'block'
    zones.querySelectorAll('.drop-zone').forEach(z => z.classList.remove('active'))
    zones.querySelector(`[data-zone="${zone}"]`)?.classList.add('active')
  }

  hideAllDropZones () {
    document.querySelectorAll('.drop-zones').forEach(z => { z.style.display = 'none' })
  }

  handleDragLeave (targetBlockId) {
    // Only hide if leaving the block entirely
    if (this.dragState.targetBlockId === targetBlockId) {
      this.hideAllDropZones()
      this.dragState.dropZone = null
      this.dragState.targetBlockId = null
    }
  }

  handleDrop (e, targetBlockId) {
    e.preventDefault()
    const sourceBlockId = this.dragState.blockId
    const zone = this.dragState.dropZone

    if (!sourceBlockId || !zone || sourceBlockId === targetBlockId) return
    if (this.isCircularDrop(sourceBlockId, targetBlockId)) return

    this.restructureLayout(sourceBlockId, targetBlockId, zone)
    this.render()
    this.saveLayout()
    this.onLayoutChange()
  }

  restructureLayout (sourceId, targetId, zone) {
    // Remove source from layout
    const sourceCfg = this.findBlockCfg(sourceId)
    if (!sourceCfg) return

    this.removeFromLayout(this.state.layout, sourceId)

    // Find target and restructure
    if (zone === 'center') {
      // Swap positions
      this.replaceInLayout(this.state.layout, targetId, sourceCfg)
    } else {
      // Create split
      this.createSplit(this.state.layout, targetId, sourceCfg, zone)
    }
  }

  removeFromLayout (nodes, blockId) {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === blockId) {
        nodes.splice(i, 1)
        return true
      }
      if (nodes[i].children && this.removeFromLayout(nodes[i].children, blockId)) {
        if (nodes[i].children.length === 1) {
          // Collapse container with single child
          nodes[i] = nodes[i].children[0]
        }
        return true
      }
    }
    return false
  }

  replaceInLayout (nodes, targetId, newCfg) {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === targetId) {
        nodes[i] = newCfg
        return true
      }
      if (nodes[i].children && this.replaceInLayout(nodes[i].children, targetId, newCfg)) {
        return true
      }
    }
    return false
  }

  createSplit (nodes, targetId, sourceCfg, zone) {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === targetId) {
        const targetCfg = nodes[i]
        const containerType = (zone === 'top' || zone === 'bottom') ? 'row' : 'col'
        const children = (zone === 'top' || zone === 'left')
          ? [sourceCfg, targetCfg]
          : [targetCfg, sourceCfg]

        nodes[i] = {
          id: `${containerType}-${Date.now()}`,
          type: containerType,
          flex: targetCfg.flex || 1,
          children: children.map(c => ({ ...c, flex: 1 }))
        }
        return true
      }
      if (nodes[i].children && this.createSplit(nodes[i].children, targetId, sourceCfg, zone)) {
        return true
      }
    }
    return false
  }

  isCircularDrop (sourceId, targetId) {
    const sourceCfg = this.findBlockCfg(sourceId)
    if (!sourceCfg || !sourceCfg.children) return false

    const checkChildren = (node) => {
      if (node.id === targetId) return true
      if (node.children) return node.children.some(checkChildren)
      return false
    }

    return checkChildren(sourceCfg)
  }

  toggleMaximize (blockId) {
    const el = document.getElementById(blockId)
    if (!el) return
    if (this.state.maximizedBlock === blockId) {
      el.classList.remove('maximized')
      this.state.maximizedBlock = null
    } else {
      if (this.state.maximizedBlock) document.getElementById(this.state.maximizedBlock)?.classList.remove('maximized')
      el.classList.add('maximized')
      this.state.maximizedBlock = blockId
    }
  }

  removeBlock (blockId) {
    this.removeFromLayout(this.state.layout, blockId)
    this.render()
    this.saveLayout()
    this.onLayoutChange()
  }

  findBlockCfg (id, nodes = this.state.layout) {
    for (const n of nodes) {
      if (n.id === id) return n
      if (n.children) {
        const found = this.findBlockCfg(id, n.children)
        if (found) return found
      }
    }
    return null
  }

  saveLayout () {
    try {
      localStorage.setItem('dashboard_layout', JSON.stringify(this.state.layout))
    } catch (e) {
      console.error('Failed to save layout:', e)
    }
  }

  loadLayout (name = null) {
    try {
      const key = name ? `dashboard_layout_${name}` : 'dashboard_layout'
      const saved = localStorage.getItem(key)
      if (saved) {
        this.state.layout = JSON.parse(saved)
        this.render()
        return true
      }
    } catch (e) {
      console.error('Failed to load layout:', e)
    }
    return false
  }

  saveLayoutAs (name) {
    try {
      localStorage.setItem(`dashboard_layout_${name}`, JSON.stringify(this.state.layout))
      const presets = this.getLayoutPresets()
      if (!presets.includes(name)) {
        presets.push(name)
        localStorage.setItem('dashboard_layout_presets', JSON.stringify(presets))
      }
    } catch (e) {
      console.error('Failed to save layout preset:', e)
    }
  }

  getLayoutPresets () {
    try {
      return JSON.parse(localStorage.getItem('dashboard_layout_presets') || '[]')
    } catch (e) {
      return []
    }
  }

  deleteLayoutPreset (name) {
    try {
      localStorage.removeItem(`dashboard_layout_${name}`)
      const presets = this.getLayoutPresets().filter(p => p !== name)
      localStorage.setItem('dashboard_layout_presets', JSON.stringify(presets))
    } catch (e) {
      console.error('Failed to delete layout preset:', e)
    }
  }

  resetLayout (defaultLayout) {
    this.state.layout = JSON.parse(JSON.stringify(defaultLayout))
    this.render()
    this.saveLayout()
    this.onLayoutChange()
  }

  // ═══ WIDGET OPENING ═══

  openWidget (widgetType, params = {}, options = {}) {
    const { reuse = true, matchKey = null } = options

    let found = null
    if (reuse) {
      const search = (nodes) => {
        for (const n of nodes) {
          if (n.type === widgetType && (!matchKey || n[matchKey] === params[matchKey])) {
            found = n
            return
          }
          if (n.children) search(n.children)
        }
      }
      search(this.state.layout)
    }

    if (found) {
      Object.assign(found, params)
    } else {
      const id = `b-${widgetType}-${this.state.blockCounter++}`
      this.state.layout.push({ id, type: widgetType, flex: 1, ...params })
    }
    this.render()
  }
}
