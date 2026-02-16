# KAA Design Decisions Log

*All decisions: 2026-02-07 | Branch: main | Push target: fork (jsamuel1/agi-diy)*

## Architectural Principles

| # | Decision | Rationale |
|---|----------|-----------|
| A1 | Single HTML file, no build step | Project philosophy — fully auditable, no toolchain, works with `python3 -m http.server` |
| A2 | Vanilla JS, no frameworks | Zero dependencies, instant load, anyone can read and modify |
| A3 | All state in localStorage + in-memory | No server, no database, works offline, survives refresh |
| A4 | CSS-driven UI states over JS filtering | `data-verbosity` attributes + CSS selectors = zero JS overhead for show/hide |

---

## Design Decisions (Chronological)

### 1. Model Catalog — `9804589`
**Decision:** Add model catalog with autocomplete and per-model feature flags. Remove `delegate_to_agent`, restore `buildSystemPrompt`.
**Rationale:** Users need to discover available models. Feature flags (vision, tools, extended thinking) prevent sending unsupported requests.

### 2. Pipeline Flow Visualization — `9c6ec65`
**Decision:** Pipeline flow bar above chat (not in sidebar), connected boxes with status colors, topoSort for layout.
**Rationale:** Pipeline is shared context across all agents — belongs at the top spanning full width, not buried in a sidebar panel. Topological sort ensures dependency order is visually clear.

### 3. Preview Mode + Back-Lines — `af1bdfc`
**Decision:** Sandbox as fullscreen background (like Maps in index.html). Pipeline back-lines (dashed red) for iteration dependencies.
**Rationale:** Preview mode lets users see the app being built while chatting. Back-lines show when tasks have circular/iterative dependencies — critical for understanding agent workflows.

### 4. Title-Only Pipeline Boxes — `e98b492`
**Decision:** Show only task title (split on " — "), hide redundant right panel.
**Rationale:** Full task descriptions made boxes too wide. Title is sufficient for identification. The old right panel duplicated pipeline info.

### 5. Split Layout — `b6dd2e6`
**Decision:** Content-area wraps header + pipeline (full width) above content-panels (chat left, activity right). Activity panel with `appendActivityFeed()` hooked into message and tool call rendering.
**Rationale:** Two-panel layout lets users see chat AND multi-agent activity simultaneously. Pipeline spans both panels because it's global context.

### 6. Equal-Width Panels + Resizer — `d5bfae3`
**Decision:** Both panels `flex: 1` with draggable 4px resizer, clamped 20-80%.
**Rationale:** Equal default width gives both views fair space. Resizer lets users prioritize whichever panel matters for their current task.

### 7. Activity Filter Select + Pipeline Click — `783114e`
**Decision:** Activity panel header → `<select>` dropdown (All Agents / per-agent / task detail). Pipeline box click → switches to task view. × button to clear pipeline.
**Rationale:** Dropdown is more compact than tabs. Click-to-filter on pipeline boxes creates a natural drill-down from overview to detail.

### 8. Target Select Switches Chat — `caeba2b`
**Decision:** Agent select next to "Send a message..." switches the chat view (same as clicking sidebar). Both stay in sync.
**Rationale:** Users shouldn't have to reach for the sidebar to switch agents. The select is right where they're typing.

### 9. Clear Resets Everything — `2ad375c`
**Decision:** Clear chat also resets activity feed and filter dropdowns.
**Rationale:** Stale filter state after clearing was confusing. Clean slate means clean slate everywhere.

### 10. Clear Stops Agents + Uniform Boxes — `bcee8ae`
**Decision:** Clear button aborts all running agents via `AbortController`. Pipeline boxes: fixed 20ch × 2 lines, all same size.
**Rationale:** "Clear" should mean stop, not just hide. Uniform boxes prevent layout jank when task names vary in length.

### 11. Box Height Fix — `0f2bb0d`
**Decision:** `min-height: 2.8em` instead of fixed `height`.
**Rationale:** Fixed height clipped 2-line text. Min-height accommodates content while keeping single-line boxes compact.

### 12. Uniform Box Height (Final) — `d0df5e5`
**Decision:** Fixed 40px height with flex centering, inner `<span>` for line-clamp.
**Rationale:** `min-height` made boxes different heights. Fixed height + flex center + span with `-webkit-line-clamp: 2` gives uniform boxes with centered text.

### 13. Auto-Scroll Pipeline — `25602d5`
**Decision:** On render, scroll first `working` (or `partial` or `pending`) box into view.
**Rationale:** With many tasks, the active work scrolls off-screen. Auto-scroll keeps focus on what's happening now.

### 14. Timeline Ordering + Tool Outputs — `ac437a8`
**Decision:** Finalize streaming before tool blocks. Show tool output in collapsible `<details>`.
**Rationale:** Text was appearing above tool calls because the streaming element was reused. Tool outputs were invisible — users couldn't see what tools returned.

### 15. No Duplicate Messages — `6dbe9d8`
**Decision:** Move streaming element after tool blocks instead of finalizing (creating a copy).
**Rationale:** Finalizing left a frozen text copy, then new streaming created a second element with all accumulated text. Moving the single element eliminates duplicates.

### 16. All Agents in Activity Feed — `a315fa1`
**Decision:** `appendActivityFeed` calls moved outside `shouldShow` guard in stream loop.
**Rationale:** Activity feed should show ALL agents' work, not just the selected one. The whole point of the panel is multi-agent visibility.

### 17. Invoke Path Reports to Feed — `5634ab5`
**Decision:** `processIncomingCommand` (the invoke_agent path) now calls `appendActivityFeed` for tool calls and responses.
**Rationale:** This was the root cause of the "empty right panel" bug. Agents invoked via mesh used a completely separate code path that had no feed integration.

### 18. Clear Also Clears Pipeline — `d7351b6`
**Decision:** Clear button removes pipeline from localStorage and updates UI.
**Rationale:** Users expected one button to reset everything. Having to click × separately was unintuitive.

### 19. Verbosity Selectors — `b47e5ff`
**Decision:** Both panels get a verbosity dropdown. 4 levels: Chat, +Widgets, +Tool Summary, +Tool Details. Left defaults to 2, right to 4. Implemented via CSS `[data-verbosity]` selectors.
**Rationale:** Different users want different detail levels. Left panel is for reading conversation flow; right panel is for debugging agent behavior. CSS-only implementation means zero JS overhead.

### 20. Data-Driven Activity Feed — `d581ae6`
**Decision:** Replace DOM-only feed with `activityLog[]` backing array. Filtering re-renders from array. Tool blocks use `toolUseId` for identification.
**Rationale:** The DOM-only feed had critical bugs:
- Clicking pipeline box destroyed all entries (`innerHTML = ''`)
- Switching filters lost data permanently
- Same-named tools got wrong status updates
The backing array makes filtering reversible and data permanent.

### 21. Full Pipeline Lifecycle — `b7d9bf1`
**Decision:** Expand task states: `pending → working → done/success/error/failed/partial`. Each with distinct visual style.
**Rationale:** Binary done/not-done was insufficient. `partial` captures "needs more work" (common in iterative agent workflows). `success` vs `done` and `failed` vs `error` give agents more expressive status reporting.

---

## Key Architectural Decisions

### Two Execution Paths
| | `runAgentMessage()` | `processIncomingCommand()` |
|---|---|---|
| Trigger | User sends message | Agent invokes another agent |
| Agent instance | Fresh per call | Reuses stored instance |
| Chat UI | Full streaming + tools | None (background) |
| Activity feed | ✅ Tools + response | ✅ Tools + response |
| Abort support | ✅ AbortController | ❌ Not yet |
| Ring buffer | User msg + response | Response only |

**Why two paths?** Direct messages need full UI treatment. Mesh messages are background work — showing streaming for every sub-agent would be overwhelming. The activity feed bridges the gap.

### Data-Driven vs DOM-Based Feed
**Before:** Feed entries existed only as DOM nodes. Filtering toggled `display: none`. Task view destroyed all nodes.
**After:** `activityLog[]` stores all entries. DOM is a view of the data. Filter changes re-render from the array.
**Trade-off:** Slightly more memory (array + DOM), but eliminates an entire class of data-loss bugs.

### CSS-Driven Verbosity
**Alternative considered:** JS filtering with `querySelectorAll` on each verbosity change.
**Chosen:** CSS `[data-verbosity="N"] .tool-block { display: none }`.
**Why:** Zero JS execution on toggle. Works instantly. No event listeners. Changing the `data-verbosity` attribute is a single DOM write.

### Tool Identification
**Before:** Tools matched by name (last match in reverse DOM order).
**After:** Tools matched by `toolUseId` (unique per invocation), fallback to name.
**Why:** When the same tool runs twice (e.g., `add_task` called 5 times), name-based matching updated the wrong block.
