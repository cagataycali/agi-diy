# Dashboard Widget System

## Overview

The dashboard uses a plugin-based widget system where each UI component is a self-contained, reusable module.

## Widget Interface

All widgets must implement:

```javascript
{
  id: string,              // Unique identifier (e.g., 'agents', 'tasks')
  meta: {
    icon: string,          // Emoji or icon
    title: string          // Display title
  },
  render: (container, config) => void  // Render function
}
```

Optional properties:

```javascript
{
  onEvent: (eventType, payload) => void,  // Event handler
  init: (state) => void,                  // Initialize with app state
  cleanup: () => void,                    // Cleanup on removal
  actions: { [name: string]: Function }   // Widget-specific actions (auto-exposed globally)
}
```

## Creating a Widget

```javascript
import { Widget } from './widget-interface.js';

export default new Widget({
  id: 'my-widget',
  meta: { icon: '🎯', title: 'My Widget' },
  
  render(container, config) {
    const state = window.dashboardState;
    container.innerHTML = `<div>Widget content</div>`;
  },
  
  onEvent(type, payload) {
    if (type === 'my-event') {
      // Handle event
    }
  },
  
  actions: {
    myAction() {
      // Widget-specific action
      // Automatically exposed as window.myAction()
    }
  }
});
```

## Registering a Widget

Add to `widgets/index.js`:

```javascript
import myWidget from './my-widget.js';
registry.register(myWidget);
```

## Event System

Widgets can listen to and respond to events:

- `agent-status` - Agent status changed
- `ring-entry` - New ring buffer entry
- `relay-status` - Relay connection status changed
- `relay-peers` - Peer list updated
- `tasks` - Task list updated

Emit events:

```javascript
window.widgetRegistry.emit('my-event', { data: 'value' });
```

## Accessing State

Widgets access shared state via `window.dashboardState`:

```javascript
const state = window.dashboardState;
const agents = state.agents;  // Map of agents
const tasks = state.tasks;    // Map of tasks
const ringBuffer = state.ringBuffer;  // Array of ring entries
```

## Widget Actions

Widgets can expose actions that are automatically made available globally:

```javascript
actions: {
  stopAllTasks() {
    const state = window.dashboardState;
    state.tasks.forEach(t => { if (t.status !== 'complete') t.status = 'complete'; });
    window.widgetRegistry.emit('tasks', { type: 'tasks' });
  }
}
```

Actions are called from HTML:
```html
<button onclick="stopAllTasks()">Stop All</button>
```

**Current widget actions:**
- `stopAllTasks()` - Mark all tasks complete (tasks widget)
- `clearDoneTasks()` - Remove completed tasks (tasks widget)

## Available Widgets

- `agents` - Agent list with status (click for detail, double-click for chat)
- `agent-detail` - Detailed agent view with stats and activity
- `agent-chat` - Agent-specific chat history
- `tasks` - Task tree with dependencies
- `task-detail` - Detailed task view with execution trace
- `task-flow` - Visual dependency graph
- `ring` - Ring buffer entries
- `chat` - Chat interface
- `mesh` - Mesh network status

## Widget Lifecycle

1. **Registration** - Widget added to registry
2. **Initialization** - `init()` called with state
3. **Rendering** - `render()` called when block created
4. **Events** - `onEvent()` called for subscribed events
5. **Cleanup** - `cleanup()` called when block removed

## Opening Widgets Programmatically

Use the generic `openWidget()` function:

```javascript
openWidget(widgetType, params, options)
```

**Parameters:**
- `widgetType` - Widget ID (e.g., 'agent-detail', 'task-detail')
- `params` - Object with widget-specific parameters
- `options` - Configuration:
  - `reuse` - Reuse existing widget of this type (default: true)
  - `matchKey` - Match on specific param key for reuse (e.g., 'agentId')

**Examples:**
```javascript
// Open agent detail (reuses existing agent-detail widget)
openWidget('agent-detail', { agentId: 'researcher' });

// Open task detail (reuses existing task-detail widget)
openWidget('task-detail', { taskId: 't123' });

// Open agent chat (reuses if same agentId)
openWidget('agent-chat', { agentId: 'researcher', _scrollTs: 0 }, { matchKey: 'agentId' });

// Add new widget (never reuse)
openWidget('tasks', {}, { reuse: false });
```

**Convenience wrappers:**
```javascript
window.openAgentChat(agentId, scrollTs)
window.openAgentDetail(agentId)
window.openTaskDetail(taskId)
```

## Best Practices

- Keep widgets self-contained
- Use `window.dashboardState` for shared state
- Emit events for cross-widget communication
- Clean up event listeners in `cleanup()`
- Use minimal DOM manipulation
- Leverage existing CSS classes
