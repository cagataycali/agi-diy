/**
 * Chat Handler for agi.diy Dashboard
 * Manages chat agent and message streaming
 */

import { Agent } from './strands.js'

export class ChatHandler {
  constructor (config) {
    this.state = config.state
    this.createModel = config.createModel
    this.detectProvider = config.detectProvider
    this.createConversationManager = config.createConversationManager
    this.buildOrchestratorPrompt = config.buildOrchestratorPrompt
    this.seedAgentList = config.seedAgentList
    this.ORCHESTRATOR_TOOLS = config.ORCHESTRATOR_TOOLS
    this.notifyAgentStatus = config.notifyAgentStatus
    this.notifyRingEntry = config.notifyRingEntry
  }

  ensureChatAgent () {
    if (this.state.chatAgent) return true
    const chatCfg = this.state.agents.get('chat')
    if (!chatCfg) return false

    try {
      const model = this.createModel(chatCfg.provider || this.detectProvider(), { modelId: chatCfg.modelId, maxTokens: 8192 })
      this.state.chatAgent = new Agent({
        model,
        tools: this.ORCHESTRATOR_TOOLS,
        systemPrompt: this.buildOrchestratorPrompt(),
        printer: false,
        conversationManager: this.createConversationManager(chatCfg.conversationManager)
      })
      this.seedAgentList(this.state.chatAgent)
      if (window.AgentMesh?.registerAgent) window.AgentMesh.registerAgent('chat', 'browser', { model: chatCfg.modelId })
      return true
    } catch (e) {
      console.error('Failed to create chat agent:', e)
      return false
    }
  }

  startWallClock () {
    if (!this.state.wallClockStart) this.state.wallClockStart = Date.now()
  }

  async sendChatMessage (text, blockId) {
    if (!text.trim()) return
    if (!this.ensureChatAgent()) {
      alert('Failed to create chat agent. Check API key in Settings or select WebLLM.')
      return
    }
    this.startWallClock()

    const msgEl = document.querySelector(`#msg-${blockId}`)
    if (!msgEl) return
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    // Show user message
    msgEl.insertAdjacentHTML('beforeend', `<div class="msg user">${this.escapeHtml(text)}<div class="msg-time">${time}</div></div>`)
    msgEl.scrollTop = msgEl.scrollHeight

    // Add to ring
    this.state.ringBuffer.push({ agentId: 'user', content: text.slice(0, 300), ts: Date.now() })
    this.notifyRingEntry(this.state.ringBuffer[this.state.ringBuffer.length - 1])
    if (window.AgentMesh?.addToRingContext) window.AgentMesh.addToRingContext('chat', 'browser', `[User] ${text.slice(0, 300)}`)

    // Update agent status
    const agentData = this.state.agents.get('chat')
    if (agentData) {
      agentData.status = 'processing'
      this.notifyAgentStatus('chat')
    }

    // Stream response
    const streamDiv = document.createElement('div')
    streamDiv.className = 'msg assistant'
    streamDiv.innerHTML = `<div class="msg-agent" style="color:${agentData?.color || 'var(--green)'}">chat</div><span class="stream-text"></span>`
    msgEl.appendChild(streamDiv)

    try {
      let currentText = ''
      // Fresh agent per message for parallelism
      const chatCfg = this.state.agents.get('chat')
      const model = this.createModel(chatCfg?.provider || this.detectProvider(), { modelId: chatCfg?.modelId, maxTokens: 8192 })
      const agent = new Agent({
        model,
        tools: this.ORCHESTRATOR_TOOLS,
        systemPrompt: this.buildOrchestratorPrompt(),
        printer: false,
        conversationManager: this.createConversationManager(chatCfg?.conversationManager)
      })
      this.seedAgentList(agent)

      // Inject history
      for (const m of this.state.chatMessages.slice(-20)) {
        agent.messages.push({ role: m.role, content: [{ type: 'textBlock', text: m.content }] })
      }

      for await (const event of agent.stream(text)) {
        if (event?.type === 'modelContentBlockDeltaEvent' && event.delta?.type === 'textDelta') {
          currentText += event.delta.text
          streamDiv.querySelector('.stream-text').textContent = currentText
          msgEl.scrollTop = msgEl.scrollHeight
        }
      }

      streamDiv.querySelector('.stream-text').innerHTML = typeof window.marked !== 'undefined' ? window.marked.parse(currentText) : this.escapeHtml(currentText)
      streamDiv.insertAdjacentHTML('beforeend', `<div class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`)
      this.state.chatMessages.push({ role: 'user', content: text }, { role: 'assistant', content: currentText })

      // Ring buffer
      this.state.ringBuffer.push({ agentId: 'chat', content: currentText.slice(0, 500), ts: Date.now() })
      this.notifyRingEntry(this.state.ringBuffer[this.state.ringBuffer.length - 1])
      if (window.AgentMesh?.addToRingContext) window.AgentMesh.addToRingContext('chat', 'browser', currentText.slice(0, 500))
    } catch (e) {
      streamDiv.querySelector('.stream-text').textContent = `Error: ${e.message}`
      streamDiv.style.color = 'var(--red)'
    }

    if (agentData) {
      agentData.status = 'ready'
      this.notifyAgentStatus('chat')
    }
  }

  escapeHtml (s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  formatElapsed (start, end) {
    const s = Math.floor((end - start) / 1000)
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m${s % 60}s`
  }
}
