# Event Model Migration Plan

## ✅ MIGRATION COMPLETE

All phases completed as of 2026-02-14.

## Summary

Successfully migrated from legacy event system to standardized object-lifecycle event model:

- ✅ **Phase 1**: StandardEventEmitter integrated with parallel operation
- ✅ **Phase 2**: All 6 widgets migrated to standard events
- ✅ **Phase 3**: Event emissions updated throughout codebase
- ✅ **Phase 4**: Legacy system removed (onEvent methods, bridges)
- ✅ **A2A Integration**: Endpoint management and agent discovery

## Current State

All events use object-lifecycle format:
- `agent-discovered`, `agent-started`, `agent-status-changed`, `agent-stopped`
- `connection-established`, `connection-lost`
- `capabilities-discovered`
- `task-created`, `task-updated`, `task-status-changed`, `task-progress`
- `message-sent`, `message-received`, `thinking-update`

Widgets subscribe via `window.standardEvents` in their `init()` methods.

## Files Modified

- `docs/event-model.js` - StandardEventEmitter, EventMapper
- `docs/event-schemas.js` - Schema definitions, validation
- `docs/dashboard.html` - window.standardEvents instance, emissions
- `docs/agent-mesh.js` - Connection event emissions
- `docs/agent-mesh-settings.js` - A2A endpoint management
- `docs/widgets/*.js` - All widgets migrated to standard events
- `p2p-server/ag_mesh_relay/event_schemas.py` - Python schemas
- `p2p-server/ag_mesh_relay/server.py` - Relay validation

## Original Migration Strategy

### Phase 1: Parallel System (Non-Breaking) ✅ COMPLETE

**Goal**: Run both systems side-by-side, no breaking changes.

1. **Add StandardEventEmitter to dashboard** ✅
   ```javascript
   import { StandardEventEmitter } from './event-model.js';
   const standardEvents = new StandardEventEmitter();
   window.standardEvents = standardEvents;
   ```

2. **Bridge legacy events to standard events** ✅ (Removed in Phase 4)
   ```javascript
   // In widgetRegistry.emit()
   widgetRegistry.emit = function(type, payload) {
     // Emit to legacy listeners
     this.listeners.forEach(listener => listener.onEvent(type, payload));
     
     // Also emit to standard event system
     window.standardEvents?.emitLegacy(type, payload);
   };
   ```

3. **Bridge A2A events to standard events** ✅ (Removed in Phase 4)
   ```javascript
   // In agent-mesh.js handleRelayMessage()
   if (window.standardEvents) {
     window.standardEvents.emitA2A({ type, data });
   }
   ```

4. **Update one widget as proof-of-concept**
   - Choose `running-agents-widget.js`
   - Subscribe to standard events in addition to legacy
   - Verify both work

### Phase 2: Widget Migration (Incremental)

**Goal**: Migrate widgets one at a time.

For each widget:

1. **Add standard event subscriptions**
   ```javascript
   init(state) {
     this.state = state;
     
     // Subscribe to standard events
     if (window.standardEvents) {
       window.standardEvents.on('agent-discovered', (agent) => {
         this.handleAgentDiscovered(agent);
       });
       
       window.standardEvents.on('agent-status-changed', (agent) => {
         this.handleAgentStatusChanged(agent);
       });
     }
   }
   ```

2. **Keep legacy onEvent() for backward compatibility**
   ```javascript
   onEvent(type, payload) {
     // Legacy support - map to standard handlers
     if (type === 'agent-status') {
       this.handleAgentStatusChanged({
         id: payload.agentId,
         status: payload.status
       });
     }
   }
   ```

3. **Test both paths work**

4. **Remove legacy onEvent() once all events migrated**

**Migration Order**:
1. `running-agents-widget.js` (proof of concept)
2. `available-agents-widget.js`
3. `tasks-widget.js`
4. `ring-widget.js`
5. `mesh-widget.js`
6. `chat-widget.js`
7. Other widgets

### Phase 3: Source Migration

**Goal**: Update event sources to emit standard events directly.

1. **Update dashboard.html**
   - Replace `widgetRegistry.emit('agent-status', ...)` with `standardEvents.emit('agent-status-changed', ...)`
   - Replace `notifyAgentStatus()` to use standard events

2. **Update agent-mesh.js**
   - Add `emitStandardEvent()` helper
   - Call it alongside legacy `broadcast()`

3. **Update agentcore-relay.js**
   - Emit standard events for connection lifecycle

### Phase 4: Cleanup (Breaking)

**Goal**: Remove legacy event system.

1. **Remove widgetRegistry.emit() bridge**
2. **Remove widget onEvent() methods**
3. **Remove legacy event subscriptions from agent-mesh.js**
4. **Update documentation**

## Implementation Checklist

### Phase 1: Setup
- [ ] Import StandardEventEmitter in dashboard.html
- [ ] Create global `window.standardEvents` instance
- [ ] Add bridge in widgetRegistry.emit()
- [ ] Add bridge in agent-mesh.js handleRelayMessage()
- [ ] Test: verify events flow to both systems

### Phase 2: Widget Migration
- [ ] Migrate running-agents-widget.js
  - [ ] Add init() with standard subscriptions
  - [ ] Add handler methods
  - [ ] Test with both event systems
  - [ ] Remove legacy onEvent() when ready
- [ ] Migrate available-agents-widget.js
- [ ] Migrate tasks-widget.js
- [ ] Migrate ring-widget.js
- [ ] Migrate mesh-widget.js
- [ ] Migrate chat-widget.js
- [ ] Migrate remaining widgets

### Phase 3: Source Migration
- [ ] Update dashboard.html event emissions
- [ ] Update agent-mesh.js event emissions
- [ ] Update agentcore-relay.js event emissions
- [ ] Test: all widgets work with standard events only

### Phase 4: Cleanup
- [ ] Remove widgetRegistry.emit() bridge
- [ ] Remove widget onEvent() methods
- [ ] Remove legacy subscriptions
- [ ] Update documentation
- [ ] Remove legacy event constants/types

## Testing Strategy

### Per-Widget Testing
1. Subscribe to both legacy and standard events
2. Trigger event from source
3. Verify both handlers called with correct data
4. Remove legacy handler
5. Verify standard handler still works

### Integration Testing
1. Connect relay → verify `capabilities-discovered` fires
2. Start agent → verify `agent-started` fires
3. Update task → verify `task-updated` fires
4. Disconnect relay → verify `connection-lost` fires

### Regression Testing
1. All widgets render correctly
2. All widgets update on events
3. No console errors
4. No duplicate updates

## Rollback Plan

If issues arise:
1. Revert to legacy event system (keep bridge in place)
2. Fix issues in standard event system
3. Re-enable standard events
4. Continue migration

The parallel system ensures we can always fall back to legacy events.

## Timeline Estimate

- Phase 1 (Setup): 1-2 hours
- Phase 2 (Widget Migration): 4-6 hours (30-45 min per widget)
- Phase 3 (Source Migration): 2-3 hours
- Phase 4 (Cleanup): 1 hour
- Testing: 2-3 hours

**Total**: 10-15 hours

## Success Criteria

- [ ] All widgets use standard events
- [ ] No legacy event subscriptions remain
- [ ] Event payloads consistent across sources
- [ ] Documentation updated
- [ ] No regressions in functionality
