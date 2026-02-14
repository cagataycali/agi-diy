# Event Model Standardization

## Overview

The dashboard currently uses inconsistent event naming based on sources (relay-connected, agent-status, etc.). We're migrating to a standardized event model based on **object lifecycle**, not event source.

## Event Naming Convention

```
<object>-<lifecycle-stage>
```

Examples:
- `agent-discovered` (not `relay-agent-found` or `mesh-peer-joined`)
- `task-updated` (not `task-change` or `update-task`)
- `capabilities-discovered` (not `relay-capabilities` or `mcp-tools-list`)

## Event Categories

### Agent Events
- `agent-discovered` - Agent becomes known (from any source)
- `agent-started` - Instance begins execution
- `agent-status-changed` - Status transitions
- `agent-stopped` - Instance terminates

### Capability Events
- `capabilities-discovered` - New tools/agent types available
- `capability-invoked` - Tool/agent type being used
- `capability-result` - Result from invocation

### Task Events
- `task-created` - New task added
- `task-updated` - Properties changed
- `task-status-changed` - Status transitions
- `task-progress` - Progress update

### Communication Events
- `message-sent` - Message sent
- `message-received` - Message received
- `thinking-update` - Agent reasoning (streaming)

### Resource Events
- `resource-created` - Resource created
- `resource-updated` - Resource modified
- `resource-accessed` - Resource read

### Connection Events
- `connection-established` - Connection to external system
- `connection-lost` - Connection lost

## Event Mappers

The `EventMapper` translates from source-specific formats:

```javascript
// A2A protocol
EventMapper.fromA2A({ type: 'capabilities_response', data: {...} })
// → { type: 'capabilities-discovered', source: 'relay', ... }

// MCP protocol
EventMapper.fromMCP({ method: 'tools/call', params: {...} })
// → { type: 'capability-invoked', capabilityType: 'tool', ... }

// Legacy dashboard events
EventMapper.fromLegacy('agent-status', { agentId, status })
// → { type: 'agent-status-changed', id, status, ... }
```

## Usage

```javascript
import { StandardEventEmitter } from './event-model.js';

const events = new StandardEventEmitter();

// Subscribe to standard events
events.on('agent-discovered', (agent) => {
  console.log('New agent:', agent.id, 'from', agent.source);
});

events.on('capabilities-discovered', (caps) => {
  console.log('New capabilities from', caps.source);
  console.log('Agent types:', caps.agentCards.length);
  console.log('Tools:', caps.tools?.length);
});

// Emit from any source
events.emitA2A(a2aMessage);
events.emitMCP(mcpNotification);
events.emitLegacy('agent-status', payload);
```

## Benefits

1. **Source Independence**: Widgets don't care if an agent came from relay, mesh, or blockchain
2. **Consistent Payloads**: Same structure regardless of source
3. **Easy Integration**: Add new sources by writing a mapper
4. **Clear Semantics**: Event names describe what happened, not where it came from

## Migration Plan

See [event-model-migration.md](./event-model-migration.md)
