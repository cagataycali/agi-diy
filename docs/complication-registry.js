/**
 * Complication Registry
 * Manages statusbar and sidebar UI elements
 */

export class ComplicationRegistry {
  constructor () {
    this.complications = new Map()
  }

  register (config) {
    this.complications.set(config.id, config)
  }

  get (id) {
    return this.complications.get(id)
  }

  render (container, placement, ids, context) {
    container.innerHTML = ''

    for (const id of ids) {
      const comp = this.complications.get(id)
      if (!comp) continue

      if (comp.render) {
        const wrapper = document.createElement('div')
        wrapper.className = `complication complication-${id}`
        wrapper.dataset.complicationId = id
        comp.render(wrapper, context)
        container.appendChild(wrapper)
      } else if (comp.action) {
        container.appendChild(this.createButton(comp, placement))
      }
    }
  }

  createButton (comp, placement) {
    const btn = document.createElement('button')
    btn.className = placement === 'statusbar' ? 'complication-btn' : 'widget-btn'
    btn.dataset.complicationId = comp.id
    btn.title = comp.title
    btn.onclick = comp.action

    if (placement === 'sidebar') {
      btn.innerHTML = `<span class="widget-icon">${comp.icon}</span><span class="widget-label">${comp.label}</span>`
    } else {
      btn.textContent = comp.icon + (comp.label ? ' ' + comp.label : '')
    }

    return btn
  }

  update (id, context) {
    const comp = this.complications.get(id)
    if (!comp?.update) return

    document.querySelectorAll(`[data-complication-id="${id}"]`)
      .forEach(el => comp.update(el, context))
  }
}

export const DEFAULT_COMPLICATIONS = {
  statusbar: ['mesh-nav', 'wall-clock'],
  sidebar: ['stop-all', 'clear-done', 'reset', 'layouts', 'settings']
}
