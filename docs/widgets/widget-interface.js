/**
 * Widget Interface for agi.diy Dashboard
 * 
 * Required Properties:
 * - id: string - Unique widget identifier (e.g., 'agents', 'tasks')
 * - meta: { icon: string, title: string } - Display metadata
 * - render: (container: HTMLElement, config: object) => void - Render function
 * 
 * Optional Properties:
 * - onEvent: (eventType: string, payload: any) => void - Event handler
 * - init: (state: object) => void - Initialize with app state
 * - cleanup: () => void - Cleanup on widget removal
 * - actions: { [name: string]: Function } - Widget-specific actions
 */

export class Widget {
  constructor(config) {
    this.id = config.id;
    this.meta = config.meta;
    this.render = config.render;
    this.onEvent = config.onEvent || (() => {});
    this.init = config.init || (() => {});
    this.cleanup = config.cleanup || (() => {});
    this.actions = config.actions || {};
  }
}

export class WidgetRegistry {
  constructor() {
    this.widgets = new Map();
  }

  register(widget) {
    if (!widget.id || !widget.meta || !widget.render) {
      throw new Error('Widget must have id, meta, and render');
    }
    this.widgets.set(widget.id, widget);
    
    // Expose widget actions globally
    if (widget.actions) {
      Object.entries(widget.actions).forEach(([name, fn]) => {
        window[name] = fn;
      });
    }
  }

  get(id) {
    return this.widgets.get(id);
  }

  getMeta(id) {
    return this.widgets.get(id)?.meta;
  }

  render(id, container, config) {
    this.widgets.get(id)?.render(container, config);
  }

  emit(eventType, payload) {
    this.widgets.forEach(w => w.onEvent(eventType, payload));
  }

  getAll() {
    return Array.from(this.widgets.values());
  }
}
