# Agent Launch Detection and Capabilities

## Overview

The ag-mesh-relay server can launch multiple types of agents (kiro-cli, Claude Code, AgentCore, etc.). Each agent type advertises its capabilities using the A2A AgentCard specification.

## Detection Flow

```
Frontend connects to relay
    ↓
Send { type: 'capabilities' }
    ↓
Relay responds with { type: 'capabilities_response', data: { agentCards: [...], activeAgents: [...] } }
    ↓
Frontend stores AgentCards in connection object
    ↓
Query available agents by name, skill, or capability
```

## AgentCard Structure

Each agent type is described by an AgentCard following the A2A Protocol specification:

```typescript
interface AgentCard {
  name: string;                    // e.g., "kiro-cli", "claude-code"
  description: string;
  url: string;
  provider?: { organization: string; url: string; };
  version: string;
  capabilities: {
    streaming?: boolean;
    pushNotifications?: boolean;
    stateTransitionHistory?: boolean;
  };
  authentication: {
    schemes: string[];             // e.g., ["None", "Bearer", "OAuth2"]
    credentials?: string;
  };
  defaultInputModes: string[];     // MIME types
  defaultOutputModes: string[];    // MIME types
  skills: {
    id: string;
    name: string;
    description: string;
    tags: string[];                // e.g., ["filesystem", "aws", "code"]
    examples?: string[];
    inputModes?: string[];
    outputModes?: string[];
  }[];
}
```

## API

### Get all available agent types

```javascript
const agentCards = window.AgentMesh.getAvailableAgentCards();
// Returns: [{ name: 'kiro-cli', skills: [...], ... }, { name: 'claude-code', ... }]
```

### Find agents by skill

```javascript
// Find all agents that can do file operations
const fileAgents = window.AgentMesh.getAgentCardsBySkill('filesystem');

// Find all agents that can interact with AWS
const awsAgents = window.AgentMesh.getAgentCardsBySkill('aws');
```

### Check if specific agent type is available

```javascript
if (window.AgentMesh.canLaunchAgent('kiro-cli')) {
    console.log('kiro-cli agents can be launched!');
}

if (window.AgentMesh.canLaunchAgent('claude-code')) {
    console.log('Claude Code agents can be launched!');
}
```

### Get relays that support specific agent

```javascript
const kiroRelays = window.AgentMesh.getRelaysForAgent('kiro-cli');
// Returns: [{ id: 'relay-1', agentCard: { name: 'kiro-cli', ... } }]
```

### Launch an agent

```javascript
const relays = window.AgentMesh.getRelaysForAgent('kiro-cli');
if (relays.length > 0) {
    window.AgentMesh.sendRelay({
        type: 'launch_agent',
        agentType: 'kiro-cli',  // Specify which agent type to launch
        agentId: 'my-agent',
        config: {
            workingPath: '~/src/my-project',
            agent: 'default'
        }
    }, relays[0].id);
}
```

## Prompting Users

### Skill-based agent selection

When a user asks to perform a task, find the best agent by skill:

```javascript
async function handleUserRequest(message) {
    // User wants to work with files
    if (message.includes('read file') || message.includes('edit code')) {
        const fileAgents = window.AgentMesh.getAgentCardsBySkill('filesystem');
        
        if (fileAgents.length > 0) {
            const agent = fileAgents[0];  // Pick best match
            const relays = window.AgentMesh.getRelaysForAgent(agent.name);
            
            const shouldLaunch = confirm(
                `Launch ${agent.name} agent?\n\n` +
                `${agent.description}\n\n` +
                `Skills: ${agent.skills.map(s => s.name).join(', ')}`
            );
            
            if (shouldLaunch) {
                window.AgentMesh.sendRelay({
                    type: 'launch_agent',
                    agentType: agent.name,
                    agentId: `agent-${Date.now()}`,
                    config: { workingPath: '~/src' }
                }, relays[0].id);
            }
        }
    }
}
```

### Tool for orchestrator

```javascript
const launchAgentTool = tool({
    name: 'launch_agent',
    description: 'Launch an agent based on required skills. Available agents: ' + 
                 window.AgentMesh.getAvailableAgentCards().map(c => c.name).join(', '),
    inputSchema: z.object({
        agentType: z.string().describe('Agent type to launch (e.g., kiro-cli, claude-code)'),
        workingPath: z.string().describe('Working directory path'),
        config: z.record(z.any()).optional().describe('Additional agent-specific config')
    }),
    callback: async (input) => {
        const relays = window.AgentMesh.getRelaysForAgent(input.agentType);
        
        if (relays.length === 0) {
            return { error: `No relay supports agent type: ${input.agentType}` };
        }
        
        const agentId = `${input.agentType}-${Date.now()}`;
        
        window.AgentMesh.sendRelay({
            type: 'launch_agent',
            agentType: input.agentType,
            agentId,
            config: {
                workingPath: input.workingPath,
                ...input.config
            }
        }, relays[0].id);
        
        return { 
            success: true, 
            agentId, 
            agentType: input.agentType,
            agentCard: relays[0].agentCard
        };
    }
});
```

### Smart agent recommendation

```javascript
function recommendAgent(userIntent) {
    const cards = window.AgentMesh.getAvailableAgentCards();
    
    // Score each agent based on skills matching intent
    const scored = cards.map(card => {
        let score = 0;
        for (const skill of card.skills) {
            for (const tag of skill.tags) {
                if (userIntent.toLowerCase().includes(tag)) {
                    score += 1;
                }
            }
        }
        return { card, score };
    });
    
    // Return best match
    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.card;
}

// Usage
const intent = "I need to read AWS CloudFormation templates and deploy them";
const bestAgent = recommendAgent(intent);
console.log(`Recommended: ${bestAgent.name}`);
```

## Events

Listen for new agent capabilities:

```javascript
window.AgentMesh.subscribe('relay-capabilities', ({ relayId, agentCards, activeAgents }) => {
    console.log(`Relay ${relayId} supports ${agentCards.length} agent types:`);
    agentCards.forEach(card => {
        console.log(`  - ${card.name}: ${card.skills.length} skills`);
    });
    
    // Update UI to show available agents
    updateAgentLaunchMenu(agentCards);
});
```

## Server Configuration

### Adding new agent types

Edit `ag_mesh_relay/server.py` to add more agent cards:

```python
# Add Claude Code agent card
agent_cards.append({
    "name": "claude-code",
    "description": "Anthropic Claude with code editing capabilities",
    "url": "local://claude-code",
    "provider": {
        "organization": "Anthropic",
        "url": "https://claude.ai"
    },
    "version": "1.0.0",
    "capabilities": {
        "streaming": True,
        "pushNotifications": False,
        "stateTransitionHistory": False
    },
    "authentication": {
        "schemes": ["Bearer"],
        "credentials": None
    },
    "defaultInputModes": ["text/plain", "application/json"],
    "defaultOutputModes": ["text/plain", "application/json", "text/markdown"],
    "skills": [
        {
            "id": "code-editing",
            "name": "Code Editing",
            "description": "Multi-file code editing with context awareness",
            "tags": ["code", "editing", "refactor"],
            "examples": ["Refactor this function", "Add error handling", "Optimize performance"]
        },
        {
            "id": "code-review",
            "name": "Code Review",
            "description": "Review code for bugs, style, and best practices",
            "tags": ["review", "quality", "analysis"],
            "examples": ["Review this PR", "Check for security issues", "Suggest improvements"]
        }
    ]
})
```

### Launch handler for new agent types

```python
async def launch_agent(agent_type: str, agent_id: str, config: dict):
    """Launch agent based on type."""
    if agent_type == "kiro-cli":
        return await launch_kiro_agent(agent_id, config)
    elif agent_type == "claude-code":
        return await launch_claude_code_agent(agent_id, config)
    elif agent_type == "agentcore":
        return await launch_agentcore_agent(agent_id, config)
    else:
        raise ValueError(f"Unknown agent type: {agent_type}")
```

## References

- [A2A Protocol AgentCard Specification](https://a2acn.com/en/docs/concepts/agentcard/)
- [A2A Protocol Documentation](https://a2a-protocol.org/)

