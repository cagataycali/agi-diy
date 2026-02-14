/**
 * Event Schemas and Validation
 * 
 * Defines schemas for all standard events and validates payloads.
 * Logs warnings for invalid events but doesn't block them.
 */

// ═══════════════════════════════════════════════════════════════════════════
// SCHEMA DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const EventSchemas = {
  // ─── Agent Events ───
  'agent-discovered': {
    required: ['id', 'source'],
    optional: ['name', 'capabilities', 'model', 'metadata'],
    types: {
      id: 'string',
      source: ['relay', 'mesh', 'erc8004', 'local'],
      name: 'string',
      capabilities: 'object',
      model: 'string',
      metadata: 'object'
    }
  },
  
  'agent-started': {
    required: ['id', 'agentType', 'timestamp'],
    optional: ['taskId'],
    types: {
      id: 'string',
      agentType: 'string',
      taskId: 'string',
      timestamp: 'number'
    }
  },
  
  'agent-status-changed': {
    required: ['id', 'status'],
    optional: ['previousStatus', 'reason'],
    types: {
      id: 'string',
      status: ['idle', 'processing', 'waiting', 'error', 'stopped'],
      previousStatus: ['idle', 'processing', 'waiting', 'error', 'stopped'],
      reason: 'string'
    }
  },
  
  'agent-stopped': {
    required: ['id', 'reason', 'timestamp'],
    optional: ['result'],
    types: {
      id: 'string',
      reason: ['completed', 'error', 'terminated', 'timeout'],
      result: 'object',
      timestamp: 'number'
    }
  },
  
  // ─── Capability Events ───
  'capabilities-discovered': {
    required: ['source', 'sourceType'],
    optional: ['agentCards', 'tools', 'resources', 'metadata'],
    types: {
      source: 'string',
      sourceType: ['relay', 'mcp', 'plugin', 'local'],
      agentCards: 'array',
      tools: 'array',
      resources: 'array',
      metadata: 'object'
    }
  },
  
  'capability-invoked': {
    required: ['capabilityId', 'capabilityType', 'invokedBy'],
    optional: ['input'],
    types: {
      capabilityId: 'string',
      capabilityType: ['tool', 'agent', 'resource'],
      invokedBy: 'string',
      input: 'object'
    }
  },
  
  'capability-result': {
    required: ['capabilityId', 'invocationId', 'success'],
    optional: ['result', 'error'],
    types: {
      capabilityId: 'string',
      invocationId: 'string',
      success: 'boolean',
      result: 'any',
      error: 'string'
    }
  },
  
  // ─── Task Events ───
  'task-created': {
    required: ['id', 'title', 'createdBy', 'timestamp'],
    optional: ['description', 'parentId', 'assignedTo'],
    types: {
      id: 'string',
      title: 'string',
      description: 'string',
      parentId: 'string',
      assignedTo: 'string',
      createdBy: 'string',
      timestamp: 'number'
    }
  },
  
  'task-updated': {
    required: ['id', 'changes', 'updatedBy', 'timestamp'],
    optional: [],
    types: {
      id: 'string',
      changes: 'object',
      updatedBy: 'string',
      timestamp: 'number'
    }
  },
  
  'task-status-changed': {
    required: ['id', 'status', 'changedBy'],
    optional: ['previousStatus', 'reason'],
    types: {
      id: 'string',
      status: ['pending', 'in-progress', 'blocked', 'complete', 'failed'],
      previousStatus: ['pending', 'in-progress', 'blocked', 'complete', 'failed'],
      reason: 'string',
      changedBy: 'string'
    }
  },
  
  'task-progress': {
    required: ['id', 'reportedBy'],
    optional: ['progress', 'message'],
    types: {
      id: 'string',
      progress: 'number',
      message: 'string',
      reportedBy: 'string'
    }
  },
  
  // ─── Communication Events ───
  'message-sent': {
    required: ['from', 'to', 'content', 'timestamp'],
    optional: ['conversationId'],
    types: {
      from: 'string',
      to: 'string',
      content: 'string',
      conversationId: 'string',
      timestamp: 'number'
    }
  },
  
  'message-received': {
    required: ['from', 'to', 'content', 'timestamp'],
    optional: ['conversationId'],
    types: {
      from: 'string',
      to: 'string',
      content: 'string',
      conversationId: 'string',
      timestamp: 'number'
    }
  },
  
  'thinking-update': {
    required: ['agentId', 'content'],
    optional: ['taskId', 'final'],
    types: {
      agentId: 'string',
      content: 'string',
      taskId: 'string',
      final: 'boolean'
    }
  },
  
  // ─── Resource Events ───
  'resource-created': {
    required: ['id', 'type', 'uri', 'createdBy'],
    optional: ['mimeType'],
    types: {
      id: 'string',
      type: 'string',
      uri: 'string',
      mimeType: 'string',
      createdBy: 'string'
    }
  },
  
  'resource-updated': {
    required: ['id', 'uri', 'updatedBy'],
    optional: ['changes'],
    types: {
      id: 'string',
      uri: 'string',
      changes: 'object',
      updatedBy: 'string'
    }
  },
  
  'resource-accessed': {
    required: ['id', 'uri', 'accessedBy'],
    optional: ['purpose'],
    types: {
      id: 'string',
      uri: 'string',
      accessedBy: 'string',
      purpose: 'string'
    }
  },
  
  // ─── Connection Events ───
  'connection-established': {
    required: ['id', 'type'],
    optional: ['url', 'metadata'],
    types: {
      id: 'string',
      type: ['relay', 'mcp', 'websocket', 'peer'],
      url: 'string',
      metadata: 'object'
    }
  },
  
  'connection-lost': {
    required: ['id', 'type'],
    optional: ['reason'],
    types: {
      id: 'string',
      type: ['relay', 'mcp', 'websocket', 'peer'],
      reason: 'string'
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

function getType(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function validateType(value, expectedType) {
  if (expectedType === 'any') return true;
  
  const actualType = getType(value);
  
  // Handle enum types (array of allowed values)
  if (Array.isArray(expectedType)) {
    return expectedType.includes(value);
  }
  
  return actualType === expectedType;
}

export function validateEvent(eventType, payload) {
  const schema = EventSchemas[eventType];
  
  if (!schema) {
    console.warn(`[EventValidator] Unknown event type: ${eventType}`);
    return false;
  }
  
  const errors = [];
  const warnings = [];
  
  // Check required fields
  for (const field of schema.required) {
    if (!(field in payload)) {
      errors.push(`Missing required field: ${field}`);
    } else if (schema.types[field]) {
      const expectedType = schema.types[field];
      if (!validateType(payload[field], expectedType)) {
        if (Array.isArray(expectedType)) {
          errors.push(`Invalid value for ${field}: "${payload[field]}" (expected one of: ${expectedType.join(', ')})`);
        } else {
          errors.push(`Invalid type for ${field}: ${getType(payload[field])} (expected ${expectedType})`);
        }
      }
    }
  }
  
  // Check optional fields if present
  for (const field in payload) {
    if (!schema.required.includes(field) && !schema.optional.includes(field)) {
      warnings.push(`Unexpected field: ${field}`);
    } else if (schema.types[field]) {
      const expectedType = schema.types[field];
      if (!validateType(payload[field], expectedType)) {
        if (Array.isArray(expectedType)) {
          errors.push(`Invalid value for ${field}: "${payload[field]}" (expected one of: ${expectedType.join(', ')})`);
        } else {
          errors.push(`Invalid type for ${field}: ${getType(payload[field])} (expected ${expectedType})`);
        }
      }
    }
  }
  
  // Log errors and warnings
  if (errors.length > 0) {
    console.error(`[EventValidator] Invalid event "${eventType}":`, errors);
    console.error('Payload:', payload);
  }
  
  if (warnings.length > 0) {
    console.warn(`[EventValidator] Event "${eventType}" warnings:`, warnings);
  }
  
  return errors.length === 0;
}

/**
 * Validate and log event, but don't block it
 */
export function validateEventSoft(eventType, payload) {
  try {
    validateEvent(eventType, payload);
  } catch (e) {
    console.error('[EventValidator] Validation error:', e);
  }
  // Always return true - validation is advisory only
  return true;
}

/**
 * Get schema documentation for an event type
 */
export function getEventSchema(eventType) {
  const schema = EventSchemas[eventType];
  if (!schema) return null;
  
  return {
    eventType,
    required: schema.required,
    optional: schema.optional,
    types: schema.types,
    example: generateExample(eventType, schema)
  };
}

/**
 * Generate example payload from schema
 */
function generateExample(eventType, schema) {
  const example = {};
  
  for (const field of schema.required) {
    const type = schema.types[field];
    if (Array.isArray(type)) {
      example[field] = type[0]; // First enum value
    } else {
      switch (type) {
        case 'string': example[field] = 'example'; break;
        case 'number': example[field] = 0; break;
        case 'boolean': example[field] = true; break;
        case 'object': example[field] = {}; break;
        case 'array': example[field] = []; break;
        default: example[field] = null;
      }
    }
  }
  
  return example;
}

/**
 * List all event types
 */
export function listEventTypes() {
  return Object.keys(EventSchemas);
}

/**
 * Get all schemas
 */
export function getAllSchemas() {
  return Object.entries(EventSchemas).map(([eventType, schema]) => 
    getEventSchema(eventType)
  );
}
