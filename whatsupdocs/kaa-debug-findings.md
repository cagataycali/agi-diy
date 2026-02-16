# KAA Debug Findings — 2026-02-07

## Issue 1: kaa-chat Stuck in "Processing" After invoke_agent

### Symptoms
- kaa-chat stays "processing" forever after kaa-coding finishes all 14 tasks
- No pending network requests, no streaming element, no console errors
- Pipeline shows all tasks done, kaa-coding is READY

### Root Causes

**A. No timeout on agent loop** (CRITICAL)
`runAgentMessage()` uses `for await (const event of activeAgent.stream(message))` with no timeout. If the Strands framework hangs (e.g., processing a massive tool result), the loop hangs forever.

**B. invoke_agent responses not size-limited**
kaa-coding returns 14 tasks worth of sandbox HTML (~100KB+). This gets passed back as the tool result to kaa-chat's model call. The model may fail to process it, causing the stream to hang.

**C. AbortController never cleaned up**
In both success and error paths, `abortControllers.delete(agentId)` is never called. Memory leak + stale state.

**D. SummarizingManager doesn't cover inter-agent responses**
The context compaction only works within each agent's own conversation. invoke_agent tool results bypass it entirely.

### Fixes
1. Add 5-minute watchdog timeout to `runAgentMessage` loop
2. Truncate invoke_agent responses to 50KB
3. Clean up AbortController in success, error, and abort paths
4. Set status to 'error' (not stuck on 'processing') when timeout fires

### Test Results (commit c332772)
- Watchdog fires correctly after 5 min ✅
- `ac.abort()` does NOT interrupt a blocked `for await` iterator ⚠️
- Watchdog now directly sets error state, cleans up, shows error message ✅
- Root cause: the Strands SDK `agent.stream()` async iterator blocks indefinitely when the model fails to respond after receiving a massive tool result
- The watchdog is a recovery mechanism, not a fix for the underlying hang

## Issue 2: Activity Feed Stops Updating Mid-Run

### Symptoms
- Feed shows first few tool calls from kaa-coding, then stops
- Stuck on "localStorage Persistence Service" despite 14 tasks completing
- Data IS in `activityLog[]` array, just not rendered

### Root Causes

**A. Task filter blocks all updates** (PRIMARY)
`appendActivityFeed()` has early return: `if (filter && filter.startsWith('task:')) return;`
When the right panel's activity filter auto-switches to a task view, ALL subsequent feed updates are silently dropped from rendering.

**B. appendToolOutput fails silently**
When DOM element doesn't exist (because it was never rendered due to filter), `appendToolOutput` returns without logging.

### Fixes
1. Remove the task filter early return — always render new entries
2. Add console.warn to appendToolOutput when element not found

## Issue 3: Context Window Management

### Current State
- `SummarizingManager` exists (windowSize=40, summarizeAfter=30)
- Applied to ALL agents via `createAgent`
- Wraps `SlidingWindowConversationManager` from Strands SDK
- Compacts by summarizing first half of messages when threshold reached

### Gap
- Only works within each agent's own conversation loop
- invoke_agent tool results are NOT compacted before returning to caller
- A 14-task coding session can produce 100KB+ of text that gets injected as a single tool result

### Fix
- Truncate invoke_agent response text to prevent context overflow
