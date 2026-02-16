# TODO: Replace window globals with event bus for widget communication

## Problem

Widgets currently communicate with the dashboard via `window.*` globals (e.g. `window.sendChatMessage`, `window.dashboardState`, `window.stopAllTasks`). This is fragile — functions defined as `const` in ES modules aren't automatically global, so they must be manually exposed on `window`. Several were lost during module extraction.

## Proposal

Replace `window.*` globals with the existing `StandardEventEmitter` (`window.standardEvents`) or a dedicated widget event bus. Widgets would emit named events instead of calling globals directly.

### Example

```js
// Before (chat-widget.js)
window.sendChatMessage?.(text, blockId);

// After
window.standardEvents.emit('chat:send', { text, blockId });
```

Dashboard subscribes:
```js
window.standardEvents.on('chat:send', ({ text, blockId }) => {
  chatHandler.sendChatMessage(text, blockId);
});
```

## Globals to migrate

- `window.sendChatMessage`
- `window.dashboardState`
- `window.stopAllTasks`
- `window.clearDoneTasks`
- `window.resetLayout`
- `window.addBlock`
- `window.showLayoutMenu` / `window.saveCurrentLayout` / `window.loadLayoutPreset` / `window.deleteLayoutPreset`

## Benefits

- No more forgotten `window.` exposures after refactoring
- Decoupled widgets — no direct dependency on dashboard internals
- Testable — events can be mocked
- Consistent with existing `standardEvents` and `widgetRegistry.emit` patterns
