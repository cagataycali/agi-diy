import { Widget } from './widget-interface.js'

/**
 * Running Agents Widget
 * Shows actively running agent instances across all types:
 * - Browser agents (Strands in-browser)
 * - Local agents (DevDuck via WebSocket)
 * - Virtual agents (backend-routed)
 * - GitHub agents (Actions workflows)
 * - AgentCore agents (cloud)
 * - Zenoh agents (P2P mesh)
 * - Launched agents (from relay via AgentCards)
 */
export default new Widget({
  id: 'running-agents',
  meta: { icon: '🏃', title: 'Running Agents' },

  render (container, config) {
    this.container = container
    // Get running agents from both mesh state and dashboard state
    const meshAgents = window.S?.agents || new Map()
    const dashAgents = window.dashboardState?.agents || new Map()

    // Merge running instances (prefer mesh state as it has runtime info)
    const runningAgents = new Map()

    // Add mesh agents (these are actual running instances)
    for (const [id, agent] of meshAgents) {
      if (!agent.is_self) { // Skip self-reference
        runningAgents.set(id, {
          id,
          name: agent.name || id,
          type: agent.type,
          status: agent.streaming ? 'streaming' : (agent.status || 'ready'),
          color: agent.color,
          model: agent.model,
          hostname: agent.hostname,
          description: agent.description,
          toolCount: agent.tool_count || agent.tools?.length,
          source: 'mesh'
        })
      }
    }

    // Add dashboard agents that have active instances or are remote
    for (const [id, agent] of dashAgents) {
      if (((agent.instances || 0) > 0 || agent.remote) && !runningAgents.has(id)) {
        runningAgents.set(id, {
          id,
          name: agent.id,
          type: 'orchestrator',
          status: agent.status || 'ready',
          color: agent.color,
          model: agent.model,
          role: agent.role,
          instances: agent.instances,
          source: 'dashboard'
        })
      }
    }

    if (runningAgents.size === 0) {
      container.innerHTML = `
        <div style="padding:24px;text-align:center;color:var(--text-muted)">
          <div style="font-size:32px;margin-bottom:8px">🏃</div>
          <div style="font-size:12px">No running agents</div>
          <div style="font-size:10px;margin-top:4px">Launch agents from Available Agents</div>
        </div>
      `
      return
    }

    // Group by type
    const groups = {}
    for (const agent of runningAgents.values()) {
      const type = agent.type || 'unknown'
      if (!groups[type]) groups[type] = []
      groups[type].push(agent)
    }

    const typeIcons = {
      local: '🖥️',
      virtual: '👻',
      browser: '🌐',
      github: '🐙',
      agentcore: '☁️',
      zenoh: '🕸️',
      orchestrator: '🎯',
      launched: '🚀'
    }

    let html = '<div class="running-agents-list">'

    for (const [type, agents] of Object.entries(groups)) {
      html += `
        <div class="agent-group">
          <div class="group-header">
            <span class="group-icon">${typeIcons[type] || '🤖'}</span>
            <span class="group-title">${type}</span>
            <span class="group-count">${agents.length}</span>
          </div>
      `

      for (const agent of agents) {
        const statusClass = agent.status === 'streaming' ? 'pulse' : ''
        html += `
          <div class="agent-card" data-agent-id="${agent.id}" data-source="${agent.source}">
            <div class="agent-dot ${statusClass}" style="background:${agent.color || 'var(--accent)'}"></div>
            <div class="agent-info">
              <div class="agent-name">${agent.name}</div>
              <div class="agent-meta">
                ${agent.model ? `${agent.model}` : ''}
                ${agent.hostname ? ` · ${agent.hostname}` : ''}
                ${agent.role ? ` · ${agent.role}` : ''}
                ${agent.toolCount ? ` · ${agent.toolCount} tools` : ''}
                ${agent.instances ? ` · ${agent.instances} instance${agent.instances > 1 ? 's' : ''}` : ''}
              </div>
            </div>
            <div class="agent-status ${agent.status}">${agent.status}</div>
          </div>
        `
      }

      html += '</div>'
    }

    html += '</div>'

    container.innerHTML = html

    // Add click handlers
    container.querySelectorAll('.agent-card').forEach(card => {
      card.addEventListener('click', () => {
        const agentId = card.dataset.agentId
        const source = card.dataset.source

        if (source === 'mesh' && window.selectAgent) {
          window.selectAgent(agentId)
        } else if (source === 'dashboard' && window.openAgentDetail) {
          window.openAgentDetail(agentId)
        }
      })
    })
  }
})
