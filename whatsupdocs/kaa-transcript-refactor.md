# Structured Transcript Refactor — Design Plan

## Goal

Replace ad-hoc string concatenation and side-channel activity feed updates with a structured transcript array that serves as the single source of truth for agent turn data.

## Current Problems

1. `processIncomingCommand` concatenates all text into `fullText` string — loses block boundaries
2. Activity feed is a parallel side-channel (`activityLog[]`) populated by separate `appendActivityFeed` calls
3. `agentData.messages[]` stores flat `{ role, content }` strings — no tool call history
4. invoke_agent response required `lastTextStart` hack to extract final response
5. No standard data format for inter-agent communication
6. Filtering/display in activity panel can't distinguish text blocks from tool calls

## Standard Transcript Format

Each agent turn produces a transcript — an ordered array of events:

```javascript
// A single turn's transcript
[
  { type: 'text', content: "I'll start with the foundation..." },
  { type: 'tool_use', name: 'update_task_status', toolId: 'tooluse_abc', input: { taskId: 'html-shell', status: 'working' } },
  { type: 'tool_result', name: 'update_task_status', toolId: 'tooluse_abc', status: 'success', output: { updated: 'html-shell' } },
  { type: 'text', content: "Now building the CSS..." },
  { type: 'tool_use', name: 'sandbox_create', toolId: 'tooluse_def', input: { name: 'Kanban', html: '...' } },
  { type: 'tool_result', name: 'sandbox_create', toolId: 'tooluse_def', status: 'success', output: { created: 'sandbox-1' } },
  { type: 'text', content: "All 14 tasks complete!" }
]
```

### Derived Properties

```javascript
// Last text response (what invoke_agent returns)
transcript.findLast(e => e.type === 'text')?.content

// Full text (for message history)
transcript.filter(e => e.type === 'text').map(e => e.content).join('')

// Tool calls only (for activity feed tool view)
transcript.filter(e => e.type === 'tool_use' || e.type === 'tool_result')

// Tool call count
transcript.filter(e => e.type === 'tool_use').length
```

## Message History Format

```javascript
// agentData.messages[] — each entry is a turn
{
  role: 'user',
  content: 'Build a kanban board app',  // user messages stay as strings
  timestamp: 1234567890
}

{
  role: 'assistant',
  transcript: [ ... ],                   // structured transcript array
  content: 'All 14 tasks complete!',     // last text response (convenience)
  timestamp: 1234567890
}
```

The `content` field on assistant messages is the last text block — used for display and for injecting into model conversation history. The `transcript` has the full detail.

## Changes Required

### 1. processIncomingCommand
- Build `transcript[]` instead of `fullText` string
- On `modelContentBlockDeltaEvent`: append to current text entry or create new one
- On `beforeToolCallEvent`: push `{ type: 'tool_use', ... }`
- On `afterToolCallEvent`: push `{ type: 'tool_result', ... }`
- `turn_end` carries `{ transcript, lastResponse, chunks }`
- Store transcript in `agentData.messages[]`
- Activity feed renders from transcript

### 2. runAgentMessage
- Same transcript building logic
- Replace `currentText` string with transcript array
- Tool call UI (`addToolCall`, `updateToolStatus`) driven from transcript
- Activity feed entries derived from transcript

### 3. invoke_agent
- Return `{ success, from, response: lastResponse, transcript_summary }` 
- `transcript_summary`: count of text blocks, tool calls, tool results
- No more `lastTextStart` hack

### 4. Activity Feed
- `appendActivityFeed` can accept transcript entries directly
- `activityLog[]` entries reference transcript entries
- Filtering by tool name, status, agent becomes trivial
- Right panel can render full transcript for a selected agent/task

### 5. turn_end message format
```javascript
{
  type: 'turn_end',
  from: agentId,
  to: fromId,
  turnId,
  data: {
    transcript: [...],
    lastResponse: '...',
    chunks: N
  }
}
```

### 6. handleMessage for turn_end
- Store transcript in `pending.responses[]`
- invoke_agent reads `response.transcript` and `response.lastResponse`

## Migration Strategy

All work happens in `sauhsoj-ii.html`. The refactor touches:
- `processIncomingCommand` (~30 lines)
- `runAgentMessage` (~50 lines)
- `invoke_agent` tool callback (~10 lines)
- `handleMessage` turn_end handler (~5 lines)
- `appendActivityFeed` / `renderActivityEntry` (~20 lines)
- `agentData.messages` storage format (~10 lines)
- History injection in `createAgent` (~10 lines)

Estimated: ~135 lines changed across 7 functions. No new files, no new dependencies.

## Non-Goals

- Don't change the Strands SDK event format
- Don't change the model conversation format (messages sent to API)
- Don't change the pipeline data model
- Don't change the sandbox/tool implementations
