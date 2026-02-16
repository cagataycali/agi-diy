/**
 * Orchestrator for agi.diy Dashboard
 * Handles multi-agent task delegation and coordination
 */

import { Agent, McpClient, StreamableHTTPClientTransport } from './strands.js'

export class Orchestrator {
  constructor (config) {
    this.state = config.state
    this.createModel = config.createModel
    this.detectProvider = config.detectProvider
    this.createConversationManager = config.createConversationManager
    this.browserTools = config.browserTools
    this.notify = config.notify
    this.saveTasks = config.saveTasks
    this.notifyAgentStatus = config.notifyAgentStatus
    this.notifyRingEntry = config.notifyRingEntry

    // Build tool sets
    const { storageGetTool, storageSetTool } = this.browserTools.storage
    const { createTaskTool, updateTaskTool, listTasksTool, claimTaskTool } = this.browserTools.tasks
    const { listAgentsTool, delegateTaskTool } = this.browserTools.orchestration

    this.TASK_TOOLS = [createTaskTool, updateTaskTool, listTasksTool, claimTaskTool]
    this.EXTRA_TOOLS = { storage_get: storageGetTool, storage_set: storageSetTool }
    this.ORCHESTRATOR_TOOLS = [...this.TASK_TOOLS, listAgentsTool, delegateTaskTool]
  }

  async runDelegatedAgent (agentId, taskId, instructions) {
    const task = this.state.tasks.get(taskId)
    const agentData = this.state.agents.get(agentId)
    if (!agentData || !task) return

    // Track instance
    agentData.instances = (agentData.instances || 0) + 1
    agentData.workingOn = task.title
    this.notifyAgentStatus(agentId)

    // Initialize trace
    task.trace = task.trace || []

    try {
      const model = this.createModel(agentData.provider || this.detectProvider(), { modelId: agentData.modelId, maxTokens: 4096 })
      const agentTools = [this.browserTools.tasks.updateTaskTool, this.browserTools.tasks.createTaskTool]

      // Add extra named tools from agent config
      if (agentData.tools) agentData.tools.forEach(n => { if (this.EXTRA_TOOLS[n]) agentTools.push(this.EXTRA_TOOLS[n]) })

      // Connect MCP servers from agent config
      if (agentData.mcp) {
        for (const srv of agentData.mcp) {
          const token = srv.tokenKey?.split('.').reduce((o, k) => o?.[k], this.state.credentials)
          const opts = token ? { requestInit: { headers: { Authorization: `Bearer ${token}` } } } : {}
          const client = new McpClient({ transport: new StreamableHTTPClientTransport(srv.url, opts) })
          agentTools.push(client)
        }
      }

      const agent = new Agent({
        model,
        tools: agentTools,
        systemPrompt: `You are agent "${agentId}". You are working on task "${task.title}" (ID: ${taskId}). Use update_task to report progress (add worklog entries) and mark complete when done. If the task needs sub-tasks, use create_task with parentId="${taskId}". Be thorough but concise.`,
        printer: false,
        conversationManager: this.createConversationManager(agentData.conversationManager)
      })

      let result = ''
      for await (const event of agent.stream(instructions)) {
        if (event?.type === 'modelContentBlockDeltaEvent' && event.delta?.type === 'textDelta') {
          result += event.delta.text
          task.trace.push({ type: 'thinking', content: event.delta.text, ts: Date.now() })
        }
        if (event?.type === 'modelContentBlockStartEvent' && event.contentBlock?.type === 'toolUse') {
          task.trace.push({ type: 'tool', content: `${event.contentBlock.name}(${JSON.stringify(event.contentBlock.input).slice(0, 100)})`, ts: Date.now() })
        }
      }

      // Mark complete if agent didn't already
      if (task.status === 'in-progress') {
        task.status = 'complete'
        task.worklog.push({ ts: Date.now(), agentId, msg: result.slice(0, 300) || 'Completed' })
      }

      // Ring buffer
      this.state.ringBuffer.push({ agentId, content: `[${task.title}] ${result.slice(0, 200)}`, ts: Date.now(), taskId })
      this.notifyRingEntry(this.state.ringBuffer[this.state.ringBuffer.length - 1])
      if (window.AgentMesh?.addToRingContext) window.AgentMesh.addToRingContext(agentId, 'browser', `[${task.title}] ${result.slice(0, 500)}`)
    } catch (e) {
      task.status = 'failed'
      task.worklog.push({ ts: Date.now(), agentId, msg: `Error: ${e.message}` })
      task.trace.push({ type: 'error', content: e.message, ts: Date.now() })
    }

    if (agentData) {
      agentData.instances = Math.max(0, (agentData.instances || 1) - 1)
      agentData.status = agentData.instances > 0 ? 'processing' : 'ready'
      agentData.workingOn = null
      this.notifyAgentStatus(agentId)
    }
    this.notify('tasks')
    this.saveTasks()
  }

  buildOrchestratorPrompt () {
    return `You are an orchestrator agent in a multi-agent mesh dashboard. Your job:
1. When given a goal, decompose it into tasks using create_task (use parentId for sub-tasks)
2. Delegate tasks to available agents with delegate_task — they run in parallel automatically
3. Use list_agents to check available agents and their status
4. Maximize parallelism: delegate multiple tasks at once to minimize wall-clock time
5. Monitor progress with list_tasks and update_task

Be concise. Act immediately — create tasks and delegate them, don't just describe what you'd do.`
  }

  async loadDefaultAgents (state, COLORS, notifyAgentStatus) {
    let DEFAULT_AGENTS = []
    try {
      const resp = await fetch('./agents.json')
      DEFAULT_AGENTS = await resp.json()
    } catch (e) { console.warn('Failed to load agents.json, using empty defaults:', e) }

    DEFAULT_AGENTS.forEach((a, i) => {
      if (!state.agents.has(a.id)) {
        state.agents.set(a.id, {
          ...a,
          color: a.color || COLORS[i % COLORS.length],
          status: 'ready',
          instances: 0,
          minInstances: a.minInstances || 0,
          maxInstances: a.maxInstances || 1
        })
      }
    })
    state.colorIndex = state.agents.size

    // Start minimum instances
    state.agents.forEach((agent, id) => {
      const minInstances = agent.minInstances || 0
      if (minInstances > 0 && (agent.instances || 0) < minInstances) {
        for (let i = 0; i < minInstances; i++) {
          this.startAgentInstance(id, state, notifyAgentStatus)
        }
      }
    })

    // Register with AgentMesh
    if (window.AgentMesh?.registerAgent) {
      state.agents.forEach((a, id) => window.AgentMesh.registerAgent(id, 'browser', { model: a.model }))
    }
  }

  startAgentInstance (agentId, state, notifyAgentStatus) {
    const agent = state.agents.get(agentId)
    if (!agent) return

    agent.instances = (agent.instances || 0) + 1
    agent.status = 'idle'
    notifyAgentStatus(agentId)

    // Scheduled execution
    if (agent.schedule?.interval) {
      const intervalId = setInterval(async () => {
        const currentAgent = state.agents.get(agentId)
        if (!currentAgent || currentAgent.instances === 0) {
          clearInterval(intervalId)
          return
        }
        if (currentAgent.status === 'processing') return

        currentAgent.status = 'processing'
        notifyAgentStatus(agentId)

        try {
          const model = this.createModel(currentAgent.provider || this.detectProvider(), {
            modelId: currentAgent.modelId,
            maxTokens: 4096
          })
          const agentInstance = new Agent({
            model,
            tools: this.ORCHESTRATOR_TOOLS,
            systemPrompt: currentAgent.role,
            printer: false,
            conversationManager: this.createConversationManager(currentAgent.conversationManager)
          })

          let response = ''
          for await (const event of agentInstance.stream(agent.schedule.prompt)) {
            if (event?.type === 'modelContentBlockDeltaEvent' && event.delta?.type === 'textDelta') {
              response += event.delta.text
            }
          }

          if (!response.includes('[IDLE]')) {
            console.log(`${agentId} scheduled run:`, response.slice(0, 200))
          }
        } catch (e) {
          console.error(`${agentId} scheduled run error:`, e)
        }

        currentAgent.status = 'idle'
        notifyAgentStatus(agentId)
      }, agent.schedule.interval)
    }
  }

  seedAgentList (agent) {
    const agents = [...this.state.agents.values()].map(a => ({ id: a.id, model: a.model, role: a.role, status: a.status }))
    agent.messages.push(
      { role: 'user', content: [{ type: 'textBlock', text: 'list_agents' }] },
      { role: 'assistant', content: [{ type: 'toolUse', toolUseId: 'seed-list', name: 'list_agents', input: {} }] },
      { role: 'user', content: [{ type: 'toolResult', toolUseId: 'seed-list', content: [{ type: 'text', text: JSON.stringify(agents) }] }] }
    )
  }
}
