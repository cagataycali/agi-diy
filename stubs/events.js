// Minimal EventEmitter for browser
export class EventEmitter {
  constructor() { this._events = {}; }
  on(e, fn) { (this._events[e] = this._events[e] || []).push(fn); return this; }
  off(e, fn) { this._events[e] = (this._events[e] || []).filter(f => f !== fn); return this; }
  emit(e, ...args) { (this._events[e] || []).forEach(fn => fn(...args)); return true; }
  once(e, fn) { const w = (...a) => { this.off(e, w); fn(...a); }; return this.on(e, w); }
  removeAllListeners(e) { if (e) delete this._events[e]; else this._events = {}; return this; }
}
export default EventEmitter;
