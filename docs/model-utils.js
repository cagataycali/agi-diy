// Model factory and credential utilities
// Shared across dashboard.html, agi.html, sauhsoj-ii.html, index.html

export function loadCredentials() {
  if (typeof window === 'undefined') return {};
  
  if (window.AgentMesh?.getCredentials) {
    return window.AgentMesh.getCredentials();
  }
  
  try {
    return JSON.parse(localStorage.getItem('agi_shared_credentials') || '{}');
  } catch (e) {
    return {};
  }
}

export function detectProvider(credentials) {
  if (!credentials) return 'webllm';
  if (credentials.bedrock?.apiKey) return 'bedrock';
  if (credentials.anthropic?.apiKey) return 'anthropic';
  if (credentials.openai?.apiKey) return 'openai';
  return 'webllm';
}

export function createModel(provider, credentials, models, config = {}) {
  const { AnthropicModel, OpenAIModel, BedrockModel, WebLLMBrowserModel } = models;
  const creds = credentials[provider] || {};
  const maxTokens = config.maxTokens || 60000;
  
  if (provider === 'anthropic') {
    return new AnthropicModel({ 
      apiKey: creds.apiKey, 
      modelId: config.modelId || creds.model || 'claude-sonnet-4-20250514', 
      maxTokens 
    });
  }
  
  if (provider === 'openai') {
    return new OpenAIModel({ 
      apiKey: creds.apiKey, 
      modelId: config.modelId || creds.model || 'gpt-4o', 
      maxTokens 
    });
  }
  
  if (provider === 'bedrock') {
    return new BedrockModel({ 
      apiKey: creds.apiKey, 
      region: creds.region || 'us-east-1', 
      modelId: config.modelId || creds.model || 'global.anthropic.claude-sonnet-4-20250514-v1:0', 
      maxTokens 
    });
  }
  
  if (provider === 'webllm') {
    return new WebLLMBrowserModel({ 
      modelId: config.modelId || 'Qwen2.5-3B-Instruct-q4f16_1-MLC', 
      maxTokens 
    });
  }
  
  throw new Error(`Unknown provider: ${provider}`);
}

export function createConversationManager(config, managers) {
  const { SlidingWindowConversationManager, NullConversationManager, SummarizingConversationManager } = managers;
  const cmConfig = config || { type: 'sliding', windowSize: 40 };
  
  if (cmConfig.type === 'null') {
    return new NullConversationManager();
  }
  
  if (cmConfig.type === 'summarizing') {
    return new SummarizingConversationManager({
      windowSize: cmConfig.windowSize || 40,
      summaryPrompt: cmConfig.summaryPrompt
    });
  }
  
  // Default: sliding window
  return new SlidingWindowConversationManager({
    windowSize: cmConfig.windowSize || 40
  });
}
