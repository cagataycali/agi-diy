# TODO

## Upcoming Pull Requests

### Section Index TOC for agi.html

**Priority**: Medium  
**Scope**: Developer Experience Improvement  

Add a **Section Index TOC** to `agi.html` similar to what exists in `sauhsoj-ii.html`.

**Current State**: 
- `sauhsoj-ii.html` has a comprehensive section index at the top of its `<script>` block
- `agi.html` lacks this navigation aid, making it harder for developers to find specific code sections

**Proposed Changes**:
1. Add TOC comment block at top of `agi.html` `<script>` section
2. Include searchable section markers (`═══ SECTION_NAME`) for:
   - STATE - App state, constants, config
   - PIPELINE MODEL - getPipelines, topoSort, renderPipelineFlow  
   - MODEL PROVIDERS - AnthropicModel, OpenAIModel, BedrockModel
   - TOOLS - render_ui, javascript_eval, storage, fetch
   - AGENT MESH - P2P messaging, processIncomingCommand
   - MESH TOOLS - invoke_agent, broadcast, list_agents
   - SELF-MODIFICATION - create_tool, update_self, custom tools
   - PIPELINE TOOLS - create_pipeline, add_task, update_task_status
   - SANDBOX TOOLS - sandbox_create, sandbox_update, preview mode
   - HOOKS - InterruptHook, SummarizingManager
   - GITHUB - auth, search, read, create PR
   - AGENT MANAGEMENT - createAgent, updateAgentUI, selectAgent
   - MESSAGING - runAgentMessage, sendMessage, clearChat
   - ACTIVITY FEED - appendActivityFeed, filterActivityFeed
   - UI RENDERING - addMessageToUI, streaming, tool calls, ring
   - MODALS - spawn, edit, settings
   - SYNC - encrypted export/import via URL
   - PERSISTENCE - saveState, loadState, credentials
   - CUSTOM TOOLS UI - tool management panel
   - INIT - DOMContentLoaded, query params, startup

3. Update section headings to list key functions they contain

**Benefits**:
- Faster code navigation for contributors
- Better code organization visibility
- Consistent developer experience between files
- Easier maintenance and debugging

**Implementation Notes**:
- Keep TOC synchronized with actual code sections
- Use same format/style as `sauhsoj-ii.html` for consistency
- Add comment noting the TOC should be updated when adding new sections

**Estimated Effort**: 1-2 hours  
**Dependencies**: None  
**Target**: Next development cycle
