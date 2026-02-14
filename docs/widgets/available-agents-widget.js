import { Widget } from './widget-interface.js';

/**
 * Available Agents Widget
 * Shows discoverable agent types that can be launched:
 * - AgentCards from relay capabilities (A2A protocol)
 * - ERC8004 blockchain agents
 * - Configured agent templates (agents.json)
 * - Any other discovery mechanism
 */
export default new Widget({
  id: 'available-agents',
  meta: { icon: '📦', title: 'Available Agents' },
  
  render(container, config) {
    const availableAgents = [];
    
    // 1. Get AgentCards from relay capabilities
    if (window.AgentMesh?.getAvailableAgentCards) {
      const agentCards = window.AgentMesh.getAvailableAgentCards();
      for (const card of agentCards) {
        availableAgents.push({
          id: card.name,
          name: card.name,
          description: card.description,
          provider: card.provider?.organization,
          skills: card.skills || [],
          source: 'relay-agentcard',
          launchable: true,
          card
        });
      }
    }
    
    // 2. Get ERC8004 discovered agents
    if (window.AgentMesh?.getERC8004Agents) {
      const erc8004Agents = window.AgentMesh.getERC8004Agents();
      for (const agent of erc8004Agents) {
        availableAgents.push({
          id: `erc8004:${agent.chain}:${agent.tokenId}`,
          name: agent.name || `Agent #${agent.tokenId}`,
          description: agent.description || agent.uri,
          provider: agent.owner,
          skills: agent.capabilities || [],
          source: 'erc8004',
          launchable: !!agent.endpoint,
          agent
        });
      }
    }
    
    // 3. Get configured agent templates (agents.json)
    if (window.dashboardState?.agents) {
      for (const [id, agent] of window.dashboardState.agents) {
        // Only show if not already running
        if ((agent.instances || 0) === 0) {
          availableAgents.push({
            id,
            name: id,
            description: agent.role,
            provider: 'local',
            skills: [],
            model: agent.model,
            source: 'template',
            launchable: true,
            agent
          });
        }
      }
    }
    
    if (availableAgents.length === 0) {
      container.innerHTML = `
        <div style="padding:24px;text-align:center;color:var(--text-muted)">
          <div style="font-size:32px;margin-bottom:8px">📦</div>
          <div style="font-size:12px">No available agents</div>
          <div style="font-size:10px;margin-top:4px">Connect to relay or configure agents.json</div>
        </div>
      `;
      return;
    }
    
    // Group by source
    const groups = {};
    for (const agent of availableAgents) {
      const source = agent.source;
      if (!groups[source]) groups[source] = [];
      groups[source].push(agent);
    }
    
    const sourceLabels = {
      'relay-agentcard': 'Relay (AgentCard)',
      'erc8004': 'Blockchain (ERC8004)',
      'template': 'Templates'
    };
    
    const sourceIcons = {
      'relay-agentcard': '🔌',
      'erc8004': '⛓️',
      'template': '📋'
    };
    
    let html = '<div class="available-agents-list">';
    
    for (const [source, agents] of Object.entries(groups)) {
      html += `
        <div class="agent-group">
          <div class="group-header">
            <span class="group-icon">${sourceIcons[source] || '📦'}</span>
            <span class="group-title">${sourceLabels[source] || source}</span>
            <span class="group-count">${agents.length}</span>
          </div>
      `;
      
      for (const agent of agents) {
        const skillTags = agent.skills.slice(0, 3).map(s => 
          typeof s === 'string' ? s : s.tags?.[0] || s.name || s.id
        ).filter(Boolean);
        
        html += `
          <div class="agent-card available" data-agent-id="${agent.id}" data-source="${agent.source}">
            <div class="agent-info">
              <div class="agent-name">
                ${agent.name}
                ${agent.provider ? `<span class="provider-badge">${agent.provider}</span>` : ''}
              </div>
              <div class="agent-description">${agent.description || ''}</div>
              ${skillTags.length > 0 ? `
                <div class="skill-tags">
                  ${skillTags.map(tag => `<span class="skill-tag">${tag}</span>`).join('')}
                  ${agent.skills.length > 3 ? `<span class="skill-tag">+${agent.skills.length - 3}</span>` : ''}
                </div>
              ` : ''}
            </div>
            ${agent.launchable ? `
              <button class="launch-btn" data-agent-id="${agent.id}" data-source="${agent.source}">
                Launch
              </button>
            ` : `
              <div class="not-launchable">No endpoint</div>
            `}
          </div>
        `;
      }
      
      html += '</div>';
    }
    
    html += '</div>';
    
    container.innerHTML = html;
    
    // Add launch handlers
    container.querySelectorAll('.launch-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const agentId = btn.dataset.agentId;
        const source = btn.dataset.source;
        this.launchAgent(agentId, source);
      });
    });
    
    // Add detail view handlers
    container.querySelectorAll('.agent-card').forEach(card => {
      card.addEventListener('click', () => {
        const agentId = card.dataset.agentId;
        const source = card.dataset.source;
        this.showAgentDetails(agentId, source);
      });
    });
  },
  
  launchAgent(agentId, source) {
    if (source === 'relay-agentcard') {
      const relays = window.AgentMesh?.getRelaysForAgent(agentId);
      if (!relays || relays.length === 0) {
        alert('No relay available for this agent type');
        return;
      }
      
      const workingPath = prompt('Working directory:', '~/src');
      if (!workingPath) return;
      
      window.AgentMesh.sendRelay({
        type: 'launch_agent',
        agentType: agentId,
        agentId: `${agentId}-${Date.now()}`,
        config: { workingPath }
      }, relays[0].id);
      
      this.showToast(`Launching ${agentId}...`);
      
    } else if (source === 'template') {
      // Launch from dashboard template
      if (window.spawnAgent) {
        const agent = window.dashboardState?.agents.get(agentId);
        if (agent) {
          window.spawnAgent(agentId, {
            systemPrompt: agent.role,
            provider: 'anthropic',
            modelId: agent.model
          });
          this.showToast(`Spawned ${agentId}`);
        }
      }
      
    } else if (source === 'erc8004') {
      // Launch ERC8004 agent (would need endpoint connection)
      alert('ERC8004 agent launch not yet implemented');
    }
  },
  
  showAgentDetails(agentId, source) {
    // Find the agent
    let agent = null;
    
    if (source === 'relay-agentcard') {
      const cards = window.AgentMesh?.getAvailableAgentCards() || [];
      agent = cards.find(c => c.name === agentId);
    }
    
    if (!agent) return;
    
    // Show modal with agent details
    const modal = document.createElement('div');
    modal.className = 'agent-detail-modal';
    modal.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h3>${agent.name}</h3>
          <button onclick="this.closest('.agent-detail-modal').remove()">×</button>
        </div>
        <div class="modal-body">
          <p>${agent.description}</p>
          ${agent.provider ? `<p><strong>Provider:</strong> ${agent.provider.organization}</p>` : ''}
          ${agent.version ? `<p><strong>Version:</strong> ${agent.version}</p>` : ''}
          ${agent.skills ? `
            <div class="skills-section">
              <h4>Skills</h4>
              ${agent.skills.map(skill => `
                <div class="skill-detail">
                  <strong>${skill.name}</strong>
                  <p>${skill.description}</p>
                  <div class="skill-tags">
                    ${skill.tags.map(tag => `<span class="skill-tag">${tag}</span>`).join('')}
                  </div>
                  ${skill.examples ? `
                    <div class="skill-examples">
                      <em>Examples:</em>
                      <ul>
                        ${skill.examples.map(ex => `<li>${ex}</li>`).join('')}
                      </ul>
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  },
  
  showToast(message) {
    if (window.showToast) {
      window.showToast(message);
    } else if (window.toast) {
      window.toast(message, 'ok');
    } else {
      console.log(message);
    }
  },
  
  onEvent(type, payload) {
    if (type === 'relay-capabilities' || type === 'erc8004-discovered') {
      this.requestRender();
    }
  }
});
