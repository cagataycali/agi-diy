"""
Event schemas for agi.diy relay server
Validates events against standardized schema
"""

EVENT_SCHEMAS = {
    # Agent Events
    "agent-discovered": {
        "required": ["id", "source"],
        "optional": ["name", "capabilities", "model", "metadata"],
        "types": {
            "id": str,
            "source": ["relay", "mesh", "erc8004", "local"],
            "name": str,
            "capabilities": dict,
            "model": str,
            "metadata": dict
        }
    },
    
    "agent-started": {
        "required": ["id", "agentType", "timestamp"],
        "optional": ["taskId"],
        "types": {
            "id": str,
            "agentType": str,
            "taskId": str,
            "timestamp": (int, float)
        }
    },
    
    "agent-status-changed": {
        "required": ["id", "status"],
        "optional": ["previousStatus", "reason"],
        "types": {
            "id": str,
            "status": ["idle", "processing", "waiting", "error", "stopped"],
            "previousStatus": ["idle", "processing", "waiting", "error", "stopped"],
            "reason": str
        }
    },
    
    "agent-stopped": {
        "required": ["id", "reason", "timestamp"],
        "optional": ["result"],
        "types": {
            "id": str,
            "reason": ["completed", "error", "terminated", "timeout"],
            "result": dict,
            "timestamp": (int, float)
        }
    },
    
    # Capability Events
    "capabilities-discovered": {
        "required": ["source", "sourceType"],
        "optional": ["agentCards", "tools", "resources", "metadata"],
        "types": {
            "source": str,
            "sourceType": ["relay", "mcp", "plugin", "local"],
            "agentCards": list,
            "tools": list,
            "resources": list,
            "metadata": dict
        }
    },
    
    # Task Events
    "task-created": {
        "required": ["id", "title", "createdBy", "timestamp"],
        "optional": ["description", "parentId", "assignedTo"],
        "types": {
            "id": str,
            "title": str,
            "description": str,
            "parentId": str,
            "assignedTo": str,
            "createdBy": str,
            "timestamp": (int, float)
        }
    },
    
    "task-status-changed": {
        "required": ["id", "status", "changedBy"],
        "optional": ["previousStatus", "reason"],
        "types": {
            "id": str,
            "status": ["pending", "in-progress", "blocked", "complete", "failed"],
            "previousStatus": ["pending", "in-progress", "blocked", "complete", "failed"],
            "reason": str,
            "changedBy": str
        }
    },
    
    # Communication Events
    "message-sent": {
        "required": ["from", "to", "content", "timestamp"],
        "optional": ["conversationId"],
        "types": {
            "from": str,
            "to": str,
            "content": str,
            "conversationId": str,
            "timestamp": (int, float)
        }
    },
    
    # Connection Events
    "connection-established": {
        "required": ["id", "type"],
        "optional": ["url", "metadata"],
        "types": {
            "id": str,
            "type": ["relay", "mcp", "websocket", "peer"],
            "url": str,
            "metadata": dict
        }
    },
    
    "connection-lost": {
        "required": ["id", "type"],
        "optional": ["reason"],
        "types": {
            "id": str,
            "type": ["relay", "mcp", "websocket", "peer"],
            "reason": str
        }
    },
    
    # Relay Infrastructure Events
    "relay-connected": {
        "required": ["relayId"],
        "optional": ["url"],
        "types": {
            "relayId": str,
            "url": str
        }
    },
    
    "relay-disconnected": {
        "required": ["relayId"],
        "optional": [],
        "types": {
            "relayId": str
        }
    },
    
    "relay-log": {
        "required": ["time", "level", "relayId", "message"],
        "optional": ["data"],
        "types": {
            "time": (int, float),
            "level": ["info", "warn", "error"],
            "relayId": str,
            "message": str,
            "data": (str, dict)
        }
    },
    
    "relay-capabilities": {
        "required": ["relayId"],
        "optional": ["agentCards", "activeAgents", "tools"],
        "types": {
            "relayId": str,
            "agentCards": list,
            "activeAgents": list,
            "tools": list
        }
    },
    
    "presence": {
        "required": ["from"],
        "optional": ["data", "timestamp"],
        "types": {
            "from": str,
            "data": dict,
            "timestamp": (int, float)
        }
    },
    
    "relay-config-updated": {
        "required": [],
        "optional": ["config"],
        "types": {
            "config": dict
        }
    }
}


def validate_event(event_type: str, payload: dict) -> tuple[bool, list[str]]:
    """
    Validate event against schema
    Returns (is_valid, errors)
    """
    schema = EVENT_SCHEMAS.get(event_type)
    if not schema:
        return False, [f"Unknown event type: {event_type}"]
    
    errors = []
    
    # Check required fields
    for field in schema["required"]:
        if field not in payload:
            errors.append(f"Missing required field: {field}")
        elif field in schema["types"]:
            expected_type = schema["types"][field]
            if not validate_type(payload[field], expected_type):
                errors.append(f"Invalid type for {field}: {type(payload[field]).__name__}")
    
    # Check optional fields if present
    for field in payload:
        if field not in schema["required"] and field not in schema["optional"]:
            errors.append(f"Unexpected field: {field}")
        elif field in schema["types"]:
            expected_type = schema["types"][field]
            if not validate_type(payload[field], expected_type):
                errors.append(f"Invalid type for {field}: {type(payload[field]).__name__}")
    
    return len(errors) == 0, errors


def validate_type(value, expected_type):
    """Validate value against expected type"""
    # Handle enum (list of allowed values)
    if isinstance(expected_type, list):
        return value in expected_type
    
    # Handle tuple of types
    if isinstance(expected_type, tuple):
        return isinstance(value, expected_type)
    
    # Handle single type
    return isinstance(value, expected_type)


def export_schemas_json():
    """Export schemas in JSON Schema format"""
    schemas = {}
    
    for event_type, schema in EVENT_SCHEMAS.items():
        properties = {}
        required = []
        
        for field in schema["required"] + schema["optional"]:
            field_type = schema["types"].get(field)
            
            if isinstance(field_type, list):
                # Enum
                properties[field] = {"enum": field_type}
            elif field_type == str:
                properties[field] = {"type": "string"}
            elif field_type in (int, float) or field_type == (int, float):
                properties[field] = {"type": "number"}
            elif field_type == bool:
                properties[field] = {"type": "boolean"}
            elif field_type == dict:
                properties[field] = {"type": "object"}
            elif field_type == list:
                properties[field] = {"type": "array"}
            else:
                properties[field] = {}
        
        required = schema["required"]
        
        schemas[event_type] = {
            "type": "object",
            "properties": properties,
            "required": required,
            "additionalProperties": False
        }
    
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "agi.diy Event Schemas",
        "version": "1.0.0",
        "definitions": schemas
    }
