# Mesh Dashboard — Implementation Plan

Branch: `feature/mesh-dashboard`
Date: 2026-02-11

## Goal

Build a simplified mesh dashboard view for a 5-10 minute demo showing dense multi-agent task completion. The dashboard must avoid modifying upstream files (`agi.html`, `index.html`) to prevent merge conflicts with Cagatay's repo.

## Architecture Decision

**New file: `docs/dashboard.html`** — standalone mesh dashboard that imports shared modules (`strands.js`, `agent-mesh.js`, etc.) but owns its own layout and task system. Same pattern as `sauhsoj-ii.html` — diverges intentionally, no mechanical rebasing.

## Layout

```text
┌─────────────────────────────────────────────────────────┐
│  Agent Status        │  Chat (default agent)  │  Ring   │
│  ┌───────────┐       │                        │  Buffer │
│  │ Agent A 🟢│       │  > user message        │         │
│  │ Agent B 🔵│       │  < agent response      │  [A] .. │
│  │ Agent C 🟡│       │                        │  [B] .. │
│  └───────────┘       │                        │  [C] .. │
│                      │                        │         │
│  Tasks               │                        │         │
│  ┌───────────┐       │                        │         │
│  │ 🟢 Task 1 │       │                        │         │
│  │  └ Sub 1a │       │                        │         │
│  │  └ Sub 1b │       │                        │         │
│  │ 🔵 Task 2 │       │                        │         │
│  │ ⏳ Task 3 │       │                        │         │
│  └───────────┘       │                        │         │
│                      ├────────────────────────│         │
│                      │  [input box]    [send] │         │
└─────────────────────────────────────────────────────────┘
```

- **Left panel**: Agent status (live) + Task tree (hierarchical, color-coded)
- **Center**: Chat with default agent (small/fast model — WebLLM or Haiku)
- **Right panel**: Ring buffer (shared context stream)
- **Task click** → center panel switches to task detail view (agent worklog + status)

## Phases

### Phase 1 — Scaffold + Layout (no agent logic)

Static HTML/CSS for the three-panel layout. Hardcoded mock data for agents, tasks, ring buffer. Get the visual right first.

Files:

- `docs/dashboard.html` — new file, self-contained
- No changes to existing files

### Phase 2 — Wire Up Agents + Ring Buffer

Connect to the existing agent mesh and ring buffer infrastructure. Import `strands.js` and `agent-mesh.js`. Default chat agent in center panel.

- Agent status panel reads from `state.agents` Map
- Ring panel reads from `state.ringBuffer` + mesh entries
- Chat sends to/receives from default agent
- Agent color assignment from existing palette

### Phase 3 — Task System

New task data model — not the existing pipeline/scheduler system (too coupled to `agi.html`).

```javascript
// Task model
{
  id: string,
  title: string,
  status: 'pending' | 'in-progress' | 'waiting' | 'complete' | 'failed',
  agentId: string | null,       // which agent owns it
  parentId: string | null,      // hierarchy
  children: string[],           // sub-task ids
  worklog: [],                  // { timestamp, agentId, message }
  source: 'manual' | 'jira' | 'slack' | 'email',  // origin
  metadata: {}                  // source-specific data
}
```

Tools for agents:

- `create_task` — create/decompose tasks
- `update_task` — status changes, add worklog entries
- `list_tasks` — query tasks by status/agent
- `claim_task` — agent takes ownership

UI:

- Task tree in left panel, color = agent color, icon = status
- Click task → detail view in center (worklog timeline + agent activity)
- Back button returns to chat

### Phase 4 — Demo Orchestration

Build the demo scenario tooling. The default chat agent acts as an orchestrator:

1. User gives high-level goal (e.g., "Build Space Minecraft two ways, triage Slack, draft emails")
2. Orchestrator decomposes into tasks (Phase 3 task system)
3. Spawns/assigns agents per task
4. Agents work in parallel, update task status + worklog
5. Dashboard shows real-time progress across all tasks

Key behaviors:

- Auto-spawn agents as needed (up to configured limit)
- Tasks fan out to maximize parallelism
- Ring buffer keeps agents aware of each other's progress
- Wall-clock time minimized by concurrent execution

### Phase 5 — Polish for Demo

- Smooth animations on task state transitions
- Agent "working" indicators (typing dots, spinner)
- Task completion celebrations (subtle)
- Elapsed time counter per task
- Total wall-clock time display
- Mobile-friendly (for showing on phone during demo)

## Non-Goals

- Not modifying `agi.html` or `index.html`
- Not building Jira/Slack/email integrations yet (Phase 4 can mock these)
- Not building the actual Space Minecraft game (that's a demo task, not dashboard work)
- Not replacing the existing pipeline/scheduler system

## File Impact

```text
NEW   docs/dashboard.html        — the mesh dashboard
NEW   docs/PLAN-mesh-dashboard.md — this plan
NONE  docs/agi.html              — untouched
NONE  docs/index.html            — untouched
NONE  docs/sauhsoj-ii.html       — untouched
```
