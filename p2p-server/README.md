# ag-mesh-relay

WebSocket relay server for agi.diy agent mesh networking. Broadcasts agent presence, manages kiro-cli agent processes, and validates events.

## Quick Start

```bash
# Install dependencies
pip install websockets

# Start relay server
python3 -m ag_mesh_relay.server

# Server runs on ws://localhost:10000
```

## Configuration

Config file: `~/.config/ag-mesh-relay/config.json`

```json
{
  "agents": [
    {
      "id": "my-agent-1",
      "agent": "default",
      "workingPath": "~/src/my-project"
    },
    {
      "id": "my-agent-2",
      "agent": "git",
      "workingPath": "~/src/another-project"
    }
  ],
  "server": {
    "host": "localhost",
    "port": 10000
  }
}
```

### Agent Configuration

- `id`: Unique identifier for the agent instance
- `agent`: Kiro CLI agent profile name (default, git, jupyter, etc.)
- `workingPath`: Working directory for the agent

## Features

### Agent Management

The relay automatically launches and manages kiro-cli agents defined in config:

```bash
kiro-cli acp --agent <agent> --cwd <workingPath>
```

Agents are:
- Launched on relay startup
- Restarted if they crash
- Stopped when relay shuts down

### Event Validation

Set `VALIDATE_EVENTS=true` (default) to validate all events against schemas:

```bash
VALIDATE_EVENTS=true python3 -m ag_mesh_relay.server
```

Invalid events are logged but not blocked.

### Capabilities Discovery

Dashboards can query available agents:

```javascript
ws.send(JSON.stringify({ type: 'capabilities' }));
// Response: { type: 'capabilities_response', data: { agentCards, activeAgents } }
```

Returns:
- `agentCards`: Array of AgentCard objects (kiro-cli, claude-code)
- `activeAgents`: Array of running agent IDs

### Schema Export

Get event schemas for external integrations:

```javascript
ws.send(JSON.stringify({ type: 'get_schemas' }));
// Response: { type: 'schemas_response', data: { ... } }
```

## WebSocket Protocol

### Client → Relay

```javascript
// Presence heartbeat
{ type: 'presence', from: 'peer-id', data: { agents, hostname, pageId, timestamp } }

// Query capabilities
{ type: 'capabilities' }

// Get schemas
{ type: 'get_schemas' }

// Launch agent
{ type: 'launch_agent', data: { agentId, agent, workingPath } }

// Stop agent
{ type: 'stop_agent', data: { agentId } }
```

### Relay → Client

```javascript
// Capabilities response
{ type: 'capabilities_response', data: { agentCards, activeAgents } }

// Schemas response
{ type: 'schemas_response', data: { ... } }

// Agent launched
{ type: 'agent_launched', data: { agentId } }

// Agent stopped
{ type: 'agent_stopped', data: { agentId, reason } }

// Presence broadcast
{ type: 'presence', from: 'peer-id', data: { ... } }
```

## Event Schemas

All events are validated against schemas in `event_schemas.py`. See `docs/event-schemas.js` for full schema definitions.

Standard events:
- Agent: `agent-discovered`, `agent-started`, `agent-status-changed`, `agent-stopped`
- Capability: `capabilities-discovered`, `capability-invoked`, `capability-result`
- Task: `task-created`, `task-updated`, `task-status-changed`, `task-progress`
- Communication: `message-sent`, `message-received`, `thinking-update`
- Connection: `connection-established`, `connection-lost`
- Relay: `relay-connected`, `relay-disconnected`, `relay-log`, `relay-capabilities`, `presence`

## Connecting from Dashboard

In `docs/dashboard.html`:

```javascript
// Connect to relay
const ws = new WebSocket('ws://localhost:10000');

ws.onopen = () => {
  // Query capabilities
  ws.send(JSON.stringify({ type: 'capabilities' }));
  
  // Send heartbeat
  setInterval(() => {
    ws.send(JSON.stringify({
      type: 'presence',
      from: 'dashboard-' + Date.now(),
      data: {
        agents: [],
        hostname: location.hostname,
        pageId: 'dashboard',
        timestamp: Date.now()
      }
    }));
  }, 10000);
};

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.type === 'capabilities_response') {
    console.log('Available agents:', msg.data.agentCards);
    console.log('Active agents:', msg.data.activeAgents);
  }
};
```

## Development

### Running Tests

```bash
# Validate schemas
python3 -c "from ag_mesh_relay.event_schemas import validate_event; print(validate_event('agent-discovered', {'id': 'test', 'source': 'relay'}))"
```

### Adding New Events

1. Add schema to `event_schemas.py` and `docs/event-schemas.js`
2. Include `description` field
3. Test validation with sample payloads

## Troubleshooting

**Relay won't start:**
- Check port 10000 is available: `lsof -i :10000`
- Check config file exists: `cat ~/.config/ag-mesh-relay/config.json`

**Agents not launching:**
- Verify kiro-cli is installed: `which kiro-cli`
- Check working paths exist
- Check agent profiles exist: `kiro-cli chat --agent <name> --help`

**Validation errors:**
- Check event payload matches schema
- Set `VALIDATE_EVENTS=false` to disable validation
- Check logs for specific field errors
