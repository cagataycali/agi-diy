/**
 * Event Data Model for agi.diy Dashboard
 * 
 * Standardized event types based on object lifecycle, not event source.
 * Inspired by A2A protocol and MCP patterns.
 * 
 * Event naming: <object>-<lifecycle-stage>
 * Examples: agent-created, task-updated, capability-discovered
 */

// ═══════════════════════════════════════════════════════════════════════════
// AGENT EVENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * agent-discovered
 * An agent becomes known to the system (from relay, mesh, blockchain, etc.)
 * @property {string} id - Unique agent identifier
 * @property {string} source - Discovery source: 'relay' | 'mesh' | 'erc8004' | 'local'
 * @property {string} [name] - Human-readable name
 * @property {object} [capabilities] - Agent capabilities (A2A AgentCard format)
 * @property {string} [model] - Model identifier
 * @property {object} [metadata] - Source-specific metadata
 */

/**
 * agent-started
 * An agent instance begins execution
 * @property {string} id - Agent instance identifier
 * @property {string} agentType - Type/template of agent
 * @property {string} [taskId] - Associated task if any
 * @property {number} timestamp - Start time
 */

/**
 * agent-status-changed
 * Agent status transitions
 * @property {string} id - Agent identifier
 * @property {string} status - 'idle' | 'processing' | 'waiting' | 'error' | 'stopped'
 * @property {string} [previousStatus] - Previous status
 * @property {string} [reason] - Reason for change
 */

/**
 * agent-stopped
 * An agent instance terminates
 * @property {string} id - Agent identifier
 * @property {string} reason - 'completed' | 'error' | 'terminated' | 'timeout'
 * @property {object} [result] - Final output if any
 * @property {number} timestamp - Stop time
 */

// ═══════════════════════════════════════════════════════════════════════════
// CAPABILITY EVENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * capabilities-discovered
 * New capabilities become available (tools, agent types, resources)
 * @property {string} source - Source identifier (relay ID, MCP server, etc.)
 * @property {string} sourceType - 'relay' | 'mcp' | 'plugin' | 'local'
 * @property {array} agentCards - Available agent types (A2A AgentCard[])
 * @property {array} [tools] - Available tools (MCP Tool[])
 * @property {array} [resources] - Available resources (MCP Resource[])
 * @property {object} [metadata] - Source-specific metadata
 */

/**
 * capability-invoked
 * A capability is being used
 * @property {string} capabilityId - Tool/agent type identifier
 * @property {string} capabilityType - 'tool' | 'agent' | 'resource'
 * @property {string} invokedBy - Agent/user that invoked it
 * @property {object} [input] - Invocation parameters
 */

/**
 * capability-result
 * Result from capability invocation
 * @property {string} capabilityId - Tool/agent type identifier
 * @property {string} invocationId - Links to capability-invoked event
 * @property {boolean} success - Whether invocation succeeded
 * @property {any} [result] - Result data
 * @property {string} [error] - Error message if failed
 */

// ═══════════════════════════════════════════════════════════════════════════
// TASK EVENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * task-created
 * A new task is added to the system
 * @property {string} id - Task identifier
 * @property {string} title - Task title
 * @property {string} [description] - Detailed description
 * @property {string} [parentId] - Parent task for subtasks
 * @property {string} [assignedTo] - Agent assigned to task
 * @property {string} createdBy - Agent/user that created task
 * @property {number} timestamp - Creation time
 */

/**
 * task-updated
 * Task properties change
 * @property {string} id - Task identifier
 * @property {object} changes - Changed fields
 * @property {string} updatedBy - Agent/user that updated
 * @property {number} timestamp - Update time
 */

/**
 * task-status-changed
 * Task status transitions
 * @property {string} id - Task identifier
 * @property {string} status - 'pending' | 'in-progress' | 'blocked' | 'complete' | 'failed'
 * @property {string} [previousStatus] - Previous status
 * @property {string} [reason] - Reason for change
 * @property {string} changedBy - Agent/user that changed status
 */

/**
 * task-progress
 * Progress update on ongoing task
 * @property {string} id - Task identifier
 * @property {number} [progress] - Progress percentage (0-100)
 * @property {string} [message] - Progress message
 * @property {string} reportedBy - Agent reporting progress
 */

// ═══════════════════════════════════════════════════════════════════════════
// COMMUNICATION EVENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * message-sent
 * A message is sent between agents or to user
 * @property {string} from - Sender identifier
 * @property {string} to - Recipient identifier ('user' for user messages)
 * @property {string} content - Message content
 * @property {string} [conversationId] - Conversation thread
 * @property {number} timestamp - Send time
 */

/**
 * message-received
 * A message is received
 * @property {string} from - Sender identifier
 * @property {string} to - Recipient identifier
 * @property {string} content - Message content
 * @property {string} [conversationId] - Conversation thread
 * @property {number} timestamp - Receive time
 */

/**
 * thinking-update
 * Agent shares internal reasoning (streaming)
 * @property {string} agentId - Agent identifier
 * @property {string} content - Thinking content
 * @property {string} [taskId] - Associated task
 * @property {boolean} [final] - Whether this is the final chunk
 */

// ═══════════════════════════════════════════════════════════════════════════
// RESOURCE EVENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * resource-created
 * A resource is created (file, data, artifact)
 * @property {string} id - Resource identifier
 * @property {string} type - Resource type (file, data, url, etc.)
 * @property {string} uri - Resource URI
 * @property {string} [mimeType] - MIME type
 * @property {string} createdBy - Agent/user that created
 */

/**
 * resource-updated
 * A resource is modified
 * @property {string} id - Resource identifier
 * @property {string} uri - Resource URI
 * @property {object} [changes] - What changed
 * @property {string} updatedBy - Agent/user that updated
 */

/**
 * resource-accessed
 * A resource is read
 * @property {string} id - Resource identifier
 * @property {string} uri - Resource URI
 * @property {string} accessedBy - Agent/user that accessed
 * @property {string} [purpose] - Why it was accessed
 */

// ═══════════════════════════════════════════════════════════════════════════
// CONNECTION EVENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * connection-established
 * A connection to external system is established
 * @property {string} id - Connection identifier
 * @property {string} type - 'relay' | 'mcp' | 'websocket' | 'peer'
 * @property {string} [url] - Connection URL
 * @property {object} [metadata] - Connection metadata
 */

/**
 * connection-lost
 * A connection is lost
 * @property {string} id - Connection identifier
 * @property {string} type - Connection type
 * @property {string} [reason] - Reason for disconnection
 */

// ═══════════════════════════════════════════════════════════════════════════
// MAPPING FROM SOURCE EVENTS
// ═══════════════════════════════════════════════════════════════════════════

export const EventMapper = {
  /**
   * Map A2A protocol events to standard events
   */
  fromA2A(a2aEvent) {
    const { type, data } = a2aEvent;
    
    switch (type) {
      case 'capabilities_response':
        return {
          type: 'capabilities-discovered',
          source: data.relayId || 'unknown',
          sourceType: 'relay',
          agentCards: data.agentCards || [],
          tools: data.tools || [],
          metadata: { activeAgents: data.activeAgents }
        };
        
      case 'presence':
        return {
          type: 'agent-discovered',
          id: data.from,
          source: 'relay',
          name: data.agents?.[0] || data.from,
          metadata: data
        };
        
      default:
        return null;
    }
  },
  
  /**
   * Map MCP events to standard events
   */
  fromMCP(mcpEvent) {
    const { method, params } = mcpEvent;
    
    switch (method) {
      case 'tools/list':
        return {
          type: 'capabilities-discovered',
          source: params.serverId || 'mcp',
          sourceType: 'mcp',
          tools: params.tools || [],
          metadata: params
        };
        
      case 'resources/list':
        return {
          type: 'capabilities-discovered',
          source: params.serverId || 'mcp',
          sourceType: 'mcp',
          resources: params.resources || [],
          metadata: params
        };
        
      case 'tools/call':
        return {
          type: 'capability-invoked',
          capabilityId: params.name,
          capabilityType: 'tool',
          invokedBy: params.invokedBy || 'user',
          input: params.arguments
        };
        
      default:
        return null;
    }
  },
  
  /**
   * Map legacy dashboard events to standard events
   */
  fromLegacy(legacyType, payload) {
    switch (legacyType) {
      case 'agent-status':
        return {
          type: 'agent-status-changed',
          id: payload.agentId,
          status: payload.status,
          previousStatus: payload.previousStatus
        };
        
      case 'agent-spawned':
        return {
          type: 'agent-started',
          id: payload.agentId,
          agentType: payload.type,
          timestamp: Date.now()
        };
        
      case 'agent-terminated':
        return {
          type: 'agent-stopped',
          id: payload.agentId,
          reason: payload.reason || 'terminated',
          timestamp: Date.now()
        };
        
      case 'relay-connected':
        return {
          type: 'connection-established',
          id: payload.relayId,
          type: 'relay',
          url: payload.url
        };
        
      case 'relay-disconnected':
        return {
          type: 'connection-lost',
          id: payload.relayId,
          type: 'relay',
          reason: payload.reason
        };
        
      case 'relay-capabilities':
        return {
          type: 'capabilities-discovered',
          source: payload.relayId,
          sourceType: 'relay',
          agentCards: payload.agentCards || [],
          metadata: { activeAgents: payload.activeAgents }
        };
        
      default:
        return null;
    }
  }
};

/**
 * Event emitter that normalizes all events to standard format
 */
export class StandardEventEmitter {
  constructor() {
    this.listeners = new Map();
  }
  
  /**
   * Subscribe to standard event types
   */
  on(eventType, handler) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(handler);
  }
  
  /**
   * Emit a standard event
   */
  emit(eventType, payload) {
    const handlers = this.listeners.get(eventType);
    if (handlers) {
      handlers.forEach(h => h(payload));
    }
  }
  
  /**
   * Emit from A2A source
   */
  emitA2A(a2aEvent) {
    const standardEvent = EventMapper.fromA2A(a2aEvent);
    if (standardEvent) {
      this.emit(standardEvent.type, standardEvent);
    }
  }
  
  /**
   * Emit from MCP source
   */
  emitMCP(mcpEvent) {
    const standardEvent = EventMapper.fromMCP(mcpEvent);
    if (standardEvent) {
      this.emit(standardEvent.type, standardEvent);
    }
  }
  
  /**
   * Emit from legacy source
   */
  emitLegacy(legacyType, payload) {
    const standardEvent = EventMapper.fromLegacy(legacyType, payload);
    if (standardEvent) {
      this.emit(standardEvent.type, standardEvent);
    }
  }
}
