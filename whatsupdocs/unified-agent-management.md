# Unified Agent Management System

## Overview

Two new widgets provide unified agent visibility across mesh.html and dashboard.html:

1. **Running Agents** - Shows actively running agent instances
2. **Available Agents** - Shows discoverable agent types that can be launched

## Architecture

### Running Agents Widget (`running-agents-widget.js`)

**Purpose**: Display all actively running agent instances regardless of type or source.

**Data Sources**:
- `window.S.agents` (mesh.html) - Runtime agents (local, virtual, browser, github, agentcore, zenoh)
- `window.dashboardState.agents` (dashboard.html) - Orchestrator agents with active instances

**Agent Types Shown**:
- **Local** - DevDuck via WebSocket
- **Virtual** - Backend-routed agents
- **Browser** - Strands agents running in-browser
- **GitHub** - GitHub Actions workflows
- **AgentCore** - Cloud agents via Bedrock
- **Zenoh** - P2P mesh peers
- **Orchestrator** - Dashboard task agents
- **Launched** - Agents launched via relay from AgentCards

**Features**:
- Groups agents by type
- Shows status (ready, streaming, processing, failed)
- Click to select/view agent details
- Real-time status updates via events

### Available Agents Widget (`available-agents-widget.js`)

**Purpose**: Display discoverable agent types that can be launched.

**Discovery Sources**:
1. **Relay AgentCards** (A2A Protocol)
   - Retrieved via `window.AgentMesh.getAvailableAgentCards()`
   - Includes kiro-cli, claude-code, and other relay-supported agents
   - Full skill descriptions and capabilities

2. **ERC8004 Blockchain**
   - Retrieved via `window.AgentMesh.getERC8004Agents()`
   - On-chain agent registry
   - Includes endpoint URLs and capabilities

3. **Agent Templates** (agents.json)
   - Local agent definitions
   - Orchestrator roles (planner, coder, reviewer, etc.)
   - Only shown if not already running

**Features**:
- Groups agents by discovery source
- Shows agent description and skills
- Launch button for launchable agents
- Click for detailed view with full AgentCard info
- Skill tags for quick capability identification

## Integration

### mesh.html

Replace the existing agent list with Running Agents widget:

```javascript
// In mesh.html, replace updateAgentsList() with:
function updateAgentsList() {
  const container = document.getElementById('agentsList');
  window.widgetRegistry.render('running-agents', container, {});
}
```

Add Available Agents section:

```html
<div class="sec-hdr">
  <span class="sec-icon">📦</span>
  <span class="sec-title">Available</span>
</div>
<div id="availableAgentsList"></div>

<script>
function updateAvailableAgents() {
  const container = document.getElementById('availableAgentsList');
  window.widgetRegistry.render('available-agents', container, {});
}
</script>
```

### dashboard.html

The widgets are already registered and can be used in layouts:

```javascript
// Add to layout config
{
  id: 'b-running-agents',
  type: 'running-agents',
  flex: 1
},
{
  id: 'b-available-agents',
  type: 'available-agents',
  flex: 1
}
```

## Event System

Both widgets respond to events:

**Running Agents**:
- `agent-status` - Agent status changed
- `agent-spawned` - New agent launched
- `agent-terminated` - Agent stopped

**Available Agents**:
- `relay-capabilities` - New relay connected with AgentCards
- `erc8004-discovered` - Blockchain agents discovered

Emit events via:
```javascript
window.widgetRegistry.emit('agent-status', { agentId: 'my-agent' });
```

## Launch Flow

### From Available Agents Widget

1. User clicks "Launch" on an AgentCard
2. Widget prompts for configuration (working directory, etc.)
3. Sends `launch_agent` message to relay:
   ```javascript
   window.AgentMesh.sendRelay({
     type: 'launch_agent',
     agentType: 'kiro-cli',
     agentId: 'kiro-cli-1234',
     config: { workingPath: '~/src' }
   }, relayId);
   ```
4. Relay launches agent and responds with `agent_launched`
5. Agent appears in Running Agents widget

### Auto-Registration

When relay confirms agent launch, add to running agents:

```javascript
// In relay message handler
if (msg.type === 'agent_launched') {
  window.S.agents.set(msg.agentId, {
    id: msg.agentId,
    name: msg.agentType,
    type: 'launched',
    status: 'ready',
    color: '#00ff88',
    agentType: msg.agentType,
    peerId: msg.peerId
  });
  window.widgetRegistry.emit('agent-spawned', { agentId: msg.agentId });
}
```

## Styling

CSS is in `widgets/agents-widgets.css` and includes:
- Agent cards with hover effects
- Status indicators with pulse animation
- Skill tags
- Launch buttons
- Modal for agent details
- Responsive layout

## API Reference

### AgentMesh Methods

```javascript
// Get all available AgentCards from relays
window.AgentMesh.getAvailableAgentCards()
// Returns: [{ name, description, provider, skills, ... }]

// Get AgentCards by skill tag
window.AgentMesh.getAgentCardsBySkill('filesystem')
// Returns: [{ name, skills: [{ tags: ['filesystem'] }] }]

// Check if agent type can be launched
window.AgentMesh.canLaunchAgent('kiro-cli')
// Returns: boolean

// Get relays that support agent type
window.AgentMesh.getRelaysForAgent('kiro-cli')
// Returns: [{ id, agentCard }]

// Get ERC8004 discovered agents
window.AgentMesh.getERC8004Agents()
// Returns: [{ chain, tokenId, name, endpoint, ... }]

// Send launch command to relay
window.AgentMesh.sendRelay({
  type: 'launch_agent',
  agentType: 'kiro-cli',
  agentId: 'unique-id',
  config: { workingPath: '~/src' }
}, relayId);
```

## Next Steps

1. **mesh.html Integration**
   - Replace `updateAgentsList()` with Running Agents widget
   - Add Available Agents section to sidebar
   - Handle `agent_launched` messages from relay

2. **dashboard.html Layouts**
   - Add Running/Available Agents to default layouts
   - Create "Agent Management" preset layout

3. **ERC8004 Integration**
   - Connect erc8004-discovery.js to `window.erc8004Agents`
   - Emit `erc8004-discovered` events
   - Implement launch flow for blockchain agents

4. **Testing**
   - Connect to relay with AgentCards
   - Launch kiro-cli agent
   - Verify appears in Running Agents
   - Test skill-based filtering
