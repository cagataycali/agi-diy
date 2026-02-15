/**
 * Model factory and credential utilities
 * Shared across dashboard.html, agi.html, sauhsoj-ii.html, index.html, mesh.html
 *
 * Usage as ES module:  import { createModel, loadCredentials } from './model-utils.js'
 * Usage as script tag: window.ModelUtils.createModel(...)
 */

function loadCredentials () {
  if (typeof window === 'undefined') return {}
  if (window.AgentMesh?.getCredentials) return window.AgentMesh.getCredentials()
  try { return JSON.parse(localStorage.getItem('agi_shared_credentials') || '{}') } catch (e) { return {} }
}

function detectProvider (credentials) {
  if (!credentials) return 'webllm'
  if (credentials.bedrock?.apiKey) return 'bedrock'
  if (credentials.anthropic?.apiKey) return 'anthropic'
  if (credentials.openai?.apiKey) return 'openai'
  return 'webllm'
}

/**
 * Create a model instance.
 * @param {string} provider - 'anthropic'|'openai'|'openai_compatible'|'bedrock'|'webllm'
 * @param {object} credentials - { [provider]: { apiKey, region, baseUrl, model } }
 * @param {object} models - { AnthropicModel, OpenAIModel, BedrockModel, WebLLMBrowserModel }
 * @param {object} config - { modelId, maxTokens, additionalRequestFields, onProgress }
 */
function createModel (provider, credentials, models, config = {}) {
  const { AnthropicModel, OpenAIModel, BedrockModel, WebLLMBrowserModel } = models
  const creds = credentials[provider] || {}
  const maxTokens = config.maxTokens || undefined

  if (provider === 'anthropic') {
    return new AnthropicModel({
      apiKey: creds.apiKey,
      modelId: config.modelId || creds.model || 'claude-sonnet-4-20250514',
      ...(maxTokens && { maxTokens }),
      additionalRequestFields: config.additionalRequestFields || null,
      customHeaders: config.customHeaders || {}
    })
  }

  if (provider === 'openai') {
    return new OpenAIModel({
      apiKey: creds.apiKey,
      modelId: config.modelId || creds.model || 'gpt-4o',
      ...(maxTokens && { maxTokens }),
      customHeaders: config.customHeaders || {}
    })
  }

  if (provider === 'openai_compatible') {
    if (!creds.baseUrl) throw new Error('OpenAI-compatible endpoint URL not set')
    return new OpenAIModel({
      apiKey: creds.apiKey || 'not-needed',
      modelId: config.modelId || creds.model || '',
      ...(maxTokens && { maxTokens }),
      clientConfig: { baseURL: creds.baseUrl }
    })
  }

  if (provider === 'bedrock') {
    return new BedrockModel({
      apiKey: creds.apiKey,
      region: creds.region || 'us-east-1',
      modelId: config.modelId || creds.model || 'global.anthropic.claude-sonnet-4-20250514-v1:0',
      ...(maxTokens && { maxTokens }),
      additionalRequestFields: config.additionalRequestFields || null
    })
  }

  if (provider === 'webllm') {
    if (!WebLLMBrowserModel) throw new Error('WebLLM not available')
    return new WebLLMBrowserModel({
      modelId: config.modelId || 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
      maxTokens: maxTokens || 4096,
      onProgress: config.onProgress || null
    })
  }

  throw new Error(`Unknown provider: ${provider}`)
}

function createConversationManager (config, managers) {
  const { SlidingWindowConversationManager, NullConversationManager, SummarizingConversationManager } = managers
  const cmConfig = config || { type: 'sliding', windowSize: 40 }

  if (cmConfig.type === 'null') return new NullConversationManager()
  if (cmConfig.type === 'summarizing') {
    return new SummarizingConversationManager({
      windowSize: cmConfig.windowSize || 40,
      summaryPrompt: cmConfig.summaryPrompt
    })
  }
  return new SlidingWindowConversationManager({ windowSize: cmConfig.windowSize || 40 })
}

// ES module exports
export { loadCredentials, detectProvider, createModel, createConversationManager }

// Self-register on window for script tag usage
if (typeof window !== 'undefined') {
  window.ModelUtils = { loadCredentials, detectProvider, createModel, createConversationManager }
}
