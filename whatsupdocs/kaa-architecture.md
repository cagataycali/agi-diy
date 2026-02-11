# KAA Multi-Agent Architecture

*Last updated: 2026-02-07*

## 1. System Architecture Overview

```mermaid
graph TB
    subgraph Browser["Browser (Single HTML File)"]
        subgraph UI["UI Layer"]
            SB[Sidebar<br/>Agent List]
            subgraph CA["Content Area"]
                HD[Header]
                PF[Pipeline Flow Bar]
                subgraph CP["Content Panels"]
                    CH[Chat Panel<br/>data-verbosity=2]
                    RS[Panel Resizer]
                    AP[Activity Panel<br/>data-verbosity=4]
                end
            end
        end

        subgraph State["State Management"]
            MS[In-Memory State<br/>agents, ringBuffer, activeAgentId]
            LS[localStorage<br/>pipelines, settings, messages]
            AL[activityLog Array]
        end

        subgraph Exec["Execution Layer"]
            RAM[runAgentMessage<br/>Direct user path]
            PIC[processIncomingCommand<br/>Mesh/invoke path]
            AM[Agent Mesh<br/>BroadcastChannel + WS]
        end

        subgraph Models["Model Providers"]
            BR[Amazon Bedrock]
            AN[Anthropic Direct]
            OA[OpenAI]
            WL[WebLLM Local]
        end
    end

    SB --> CA
    RAM --> CH
    RAM --> AL
    PIC --> AL
    PIC --> AM
    AM --> PIC
    RAM --> MS
    PIC --> MS
    MS --> LS
```

## 2. Agent Execution Flow

```mermaid
sequenceDiagram
    participant U as User
    participant SM as sendMessage()
    participant RAM as runAgentMessage()
    participant SDK as Strands Agent
    participant UI as Chat Panel
    participant AF as Activity Feed
    participant PIC as processIncomingCommand()
    participant MESH as Agent Mesh

    Note over U,AF: Path A: Direct User Message
    U->>SM: Type message + send
    SM->>RAM: runAgentMessage(agentId, text)
    RAM->>SDK: agent.stream(message)
    loop Stream Events
        SDK-->>RAM: textDelta
        RAM-->>UI: updateStreaming()
        SDK-->>RAM: beforeToolCallEvent
        RAM-->>UI: addToolCall()
        RAM-->>AF: appendActivityFeed(tool)
        RAM-->>UI: move streaming el after tool
        SDK-->>RAM: afterToolCallEvent
        RAM-->>UI: updateToolStatus(toolId)
    end
    RAM-->>UI: finalizeStreaming()
    RAM-->>AF: appendActivityFeed(response)

    Note over U,AF: Path B: Agent-to-Agent (invoke_agent)
    RAM->>SDK: invoke_agent tool executes
    SDK->>MESH: agentMesh.sendTo()
    MESH->>PIC: processIncomingCommand()
    PIC->>SDK: agentData.agent.stream()
    loop Stream Events
        SDK-->>PIC: textDelta
        PIC-->>MESH: publish stream chunk
        SDK-->>PIC: beforeToolCallEvent
        PIC-->>AF: appendActivityFeed(tool)
    end
    PIC-->>MESH: publish turn_end
    PIC-->>AF: appendActivityFeed(response)
    MESH-->>RAM: resolve pending request
```

## 3. Pipeline State Machine

```mermaid
stateDiagram-v2
    [*] --> pending: create_pipeline / add_task

    pending --> working: update_task_status(working)

    working --> done: update_task_status(done)
    working --> success: update_task_status(success)
    working --> error: update_task_status(error)
    working --> failed: update_task_status(failed)
    working --> partial: update_task_status(partial)

    partial --> working: retry / iterate
    error --> working: retry

    done --> [*]
    success --> [*]
    failed --> [*]

    note right of pending
        Dashed gray border
        Default state on creation
    end note

    note right of working
        Amber border, pulse animation
        Agent actively processing
    end note

    note right of done
        Green border
        Completed successfully
    end note

    note right of partial
        Orange border, slow pulse
        Needs more work
    end note

    note right of error
        Red border
        Failed
    end note
```

### Visual States

| State | Border | Color | Animation | Meaning |
|-------|--------|-------|-----------|---------|
| `pending` | dashed | #888 gray | none | Created, waiting for deps |
| `working` | solid | #ffaa00 amber | pillPulse 2s | Agent actively processing |
| `done` / `success` | solid | #00ff88 green | none | Completed successfully |
| `error` / `failed` | solid | #ff6666 red | none | Failed |
| `partial` | solid | #ff9933 orange | pillPulse 3s | Needs more work |

## 4. Message Rendering Lifecycle

```mermaid
flowchart TD
    A[User sends message] --> B[addMessageToUI - user msg]
    B --> C[addThinking - dots indicator]
    C --> D{Stream events}

    D -->|textDelta| E[updateStreaming]
    E -->|first delta| F[removeThinking + create streaming el]
    E -->|subsequent| G[update markdown content]

    D -->|beforeToolCallEvent| H[addToolCall - tool block]
    H --> I[Move streaming el AFTER tool block]

    D -->|afterToolCallEvent| J[updateToolStatus by toolId]
    J --> K[Add output details section]

    D -->|stream ends| L[finalizeStreaming]
    L --> M[appendActivityFeed - response]

    style F fill:#ffaa00,color:#000
    style H fill:#555,color:#fff
    style L fill:#00ff88,color:#000
```

### Key Design: Single Streaming Element

Instead of finalizing the streaming element before each tool block (which created duplicates), we move the single streaming element after each tool block. This means:
- Tool blocks appear in chronological order
- Text accumulates in one element
- No duplicate messages

## 5. Activity Feed Data Flow

```mermaid
flowchart LR
    subgraph Sources
        RAM[runAgentMessage<br/>tool calls + response]
        PIC[processIncomingCommand<br/>tool calls + response]
    end

    subgraph Store
        AL[activityLog Array<br/>agentId, text, type, ts, color]
    end

    subgraph Render
        FF[filterActivityFeed]
        DOM[Activity Feed DOM]
    end

    RAM -->|appendActivityFeed| AL
    PIC -->|appendActivityFeed| AL
    AL -->|append if matches filter| DOM
    AL -->|re-render all on filter change| FF
    FF --> DOM

    subgraph Filters
        ALL[All Agents]
        AGT[Specific Agent]
        TSK[task:id - Pipeline Task]
    end

    ALL --> FF
    AGT --> FF
    TSK --> FF
```

### Why Data-Driven?

The original DOM-based feed had critical bugs:
- Clicking a pipeline box destroyed all feed entries (`innerHTML = ''`)
- Switching filters lost data permanently
- No way to restore previous entries

The `activityLog[]` array stores everything. Filtering re-renders from the array. Data is never lost.

## 6. Panel Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ .app (display: flex)                                            │
│ ┌──────────┐ ┌────────────────────────────────────────────────┐ │
│ │ aside     │ │ .content-area (flex: 1, flex-direction: col)  │ │
│ │ .sidebar  │ │ ┌──────────────────────────────────────────┐  │ │
│ │           │ │ │ header.header                             │  │ │
│ │ • agent 1 │ │ ├──────────────────────────────────────────┤  │ │
│ │ • agent 2 │ │ │ .pipeline-flow (full width, overflow-x)  │  │ │
│ │ • agent 3 │ │ │ [×][Box]──[Box]──[Box]──[Box]──[Box]     │  │ │
│ │           │ │ ├──────────────────────────────────────────┤  │ │
│ │ + New     │ │ │ .content-panels (display: flex)           │  │ │
│ │           │ │ │ ┌──────────┐│ ┐│┌──────────────────────┐ │  │ │
│ │ SCHEDULED │ │ │ │chat-panel││R││ │ activity-panel       │ │  │ │
│ │           │ │ │ │          ││e││ │                      │ │  │ │
│ │           │ │ │ │ [verb ▾] ││s││ │ [filter▾] [verb ▾]  │ │  │ │
│ │           │ │ │ │          ││i││ │                      │ │  │ │
│ │           │ │ │ │ messages ││z││ │ activity feed        │ │  │ │
│ │           │ │ │ │          ││e││ │                      │ │  │ │
│ │           │ │ │ │          ││r││ │                      │ │  │ │
│ │           │ │ │ │ ┌──────┐ ││ ││ │                      │ │  │ │
│ │           │ │ │ │ │input │ ││ ││ │                      │ │  │ │
│ │           │ │ │ └──────────┘│ │└──────────────────────┘ │  │ │
│ │           │ │ └──────────────────────────────────────────┘  │ │
│ └──────────┘ └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

- Both panels `flex: 1` (equal width by default)
- Resizer: 4px wide, draggable, clamped 20-80%
- Pipeline flow spans full width above both panels

## 7. Verbosity System

| Level | Label | Shows | Hides |
|-------|-------|-------|-------|
| 1 | Chat | Messages only | Widgets, all tool blocks |
| 2 | Chat + Widgets | Messages + sandbox iframes | All tool blocks |
| 3 | + Tool Summary | Above + tool name/status bar | Tool input/output details |
| 4 | + Tool Details | Everything | Nothing |

**Implementation:** CSS attribute selectors on parent panel:
```css
[data-verbosity="1"] .tool-block, [data-verbosity="1"] .sandbox-wrap { display: none !important; }
[data-verbosity="2"] .tool-block { display: none !important; }
[data-verbosity="3"] .tool-block details { display: none !important; }
```

- Left panel default: Level 2 (Chat + Widgets)
- Right panel default: Level 4 (+ Tool Details)
- No JS filtering needed — pure CSS

## 8. Key Data Structures

### State Object
```javascript
state = {
    agents: Map<agentId, AgentData>,
    activeAgentId: string | null,
    ringBuffer: Array<{ agentId, role, content, timestamp }>,  // max 100
    settings: { provider, modelId, apiKey, ... }
}
```

### AgentData
```javascript
{
    config: { provider, modelId, maxTokens, systemPrompt, enabledTools, toolChoice, additionalRequestFields },
    agent: Agent,           // Strands SDK instance
    messages: Array<{ role, content, timestamp }>,
    status: 'ready' | 'processing' | 'error',
    color: string           // hex color for UI
}
```

### Pipeline
```javascript
{
    id: string,
    name: string,
    tasks: Array<Task>,
    completionActions: Array<{ type, description }>,
    createdAt: number
}
```

### Task
```javascript
{
    id: string,
    name: string,
    dependsOn: string[],    // task IDs
    status: 'pending' | 'working' | 'done' | 'success' | 'error' | 'failed' | 'partial',
    assignedTo: string | null,
    color: string,
    activities: Array<{ text, done, timestamp }>
}
```

### Activity Log Entry
```javascript
{
    agentId: string,
    text: string,           // up to 300 chars displayed
    type: 'msg' | 'tool',
    ts: number,
    color: string
}
```

### Tracking Maps
```javascript
streamingEls: Map<agentId, HTMLElement>     // active streaming elements
abortControllers: Map<agentId, AbortController>  // cancellation
```

### Storage Keys
| Key | Contents |
|-----|----------|
| `agi_pipelines` | JSON array of Pipeline objects |
| `agi_settings` | Provider, model, API keys |
| `agi_state` | Agent configs and message history |
| `agi_custom_tools` | User-created tool definitions |

## 9. Pipeline Tools

| Tool | Purpose | Calls updatePipelineUI? |
|------|---------|------------------------|
| `create_pipeline` | Create pipeline with initial tasks | ✅ |
| `add_task` | Add task to existing pipeline | ✅ |
| `update_task_status` | Change task state + optional activity | ✅ |
| `update_task_deps` | Modify task dependencies | ✅ |
| `complete_pipeline` | Mark pipeline done, add completion actions | ✅ |
| `emit_status` | Add activity message to task | ⚠️ Only renderPipelineActivity |
| `read_pipeline` | Read current pipeline state | ❌ (read-only) |

## 10. Agent Mesh

```mermaid
flowchart TB
    subgraph Local["Same Tab"]
        A1[Agent 1] -->|publish| BUS[BroadcastChannel]
        A2[Agent 2] -->|publish| BUS
        BUS -->|handleMessage| A1
        BUS -->|handleMessage| A2
    end

    subgraph Remote["Other Tabs/Devices"]
        WS[WebSocket Relay]
        A3[Remote Agent]
    end

    BUS <-->|bridge| WS
    WS <--> A3
```

Message types: `direct`, `broadcast`, `stream`, `ack`, `turn_end`, `error`
