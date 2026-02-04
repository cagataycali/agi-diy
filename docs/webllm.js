/**
 * WebLLM Browser Model - Local LLM running entirely in browser via WebGPU
 * 
 * This provides a Model implementation for the Strands SDK that runs
 * models locally using WebLLM (MLC-AI). No API keys needed - runs on device!
 * 
 * Supported models: https://github.com/mlc-ai/web-llm#available-models
 * 
 * @example
 * ```javascript
 * import { WebLLMBrowserModel, WEBLLM_MODELS } from './webllm.js';
 * 
 * const model = new WebLLMBrowserModel({
 *   modelId: WEBLLM_MODELS.LLAMA_3_8B,
 *   onProgress: (progress) => console.log(`Loading: ${progress}%`)
 * });
 * 
 * await model.load();
 * 
 * const agent = new Agent({ model, tools: [...] });
 * ```
 */

import { Model } from './strands.js';

// Available WebLLM models with tool/function calling support
export const WEBLLM_MODELS = {
    // Recommended for function calling
    HERMES_LLAMA3_8B: 'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC',
    HERMES_MISTRAL_7B: 'Hermes-2-Pro-Mistral-7B-q4f16_1-MLC',
    
    // Smaller/faster models
    LLAMA_3_8B: 'Llama-3-8B-Instruct-q4f16_1-MLC',
    LLAMA_3_2_3B: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    LLAMA_3_2_1B: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    
    // Qwen models
    QWEN_2_5_7B: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
    QWEN_2_5_3B: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    QWEN_2_5_1B: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',
    
    // Phi models (small but capable)
    PHI_3_5_MINI: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    
    // SmolLM (very small)
    SMOLLM_1_7B: 'SmolLM2-1.7B-Instruct-q4f16_1-MLC',
    SMOLLM_360M: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
};

/**
 * WebLLM Browser Model - runs LLMs locally via WebGPU
 * Extends Strands Model class for full SDK compatibility
 */
export class WebLLMBrowserModel extends Model {
    constructor(config = {}) {
        super();
        this._config = {
            modelId: config.modelId || WEBLLM_MODELS.QWEN_2_5_3B,
            temperature: config.temperature || 0.7,
            maxTokens: config.maxTokens || 4096,
            onProgress: config.onProgress || null,
        };
        
        this._engine = null;
        this._loading = false;
        this._loaded = false;
        
        // WebLLM module (loaded dynamically)
        this._webllm = null;
    }

    updateConfig(config) {
        this._config = { ...this._config, ...config };
    }

    getConfig() {
        return this._config;
    }

    /**
     * Check if WebGPU is supported
     */
    static async isSupported() {
        if (!navigator.gpu) return false;
        try {
            const adapter = await navigator.gpu.requestAdapter();
            return adapter !== null;
        } catch {
            return false;
        }
    }

    /**
     * Load the model (must be called before streaming)
     */
    async load() {
        if (this._loaded) return;
        if (this._loading) {
            // Wait for existing load
            while (this._loading) {
                await new Promise(r => setTimeout(r, 100));
            }
            return;
        }

        this._loading = true;

        try {
            // Check WebGPU support
            if (!await WebLLMBrowserModel.isSupported()) {
                throw new Error('WebGPU is not supported in this browser. Try Chrome 113+ or Edge 113+.');
            }

            // Dynamically import WebLLM
            if (!this._webllm) {
                this._webllm = await import('https://esm.run/@mlc-ai/web-llm');
            }

            // Progress callback
            const initProgressCallback = (report) => {
                if (this._config.onProgress) {
                    const percent = Math.round(report.progress * 100);
                    this._config.onProgress(percent, report.text || 'Loading...');
                }
            };

            // Create engine
            this._engine = await this._webllm.CreateMLCEngine(this._config.modelId, {
                initProgressCallback
            });

            this._loaded = true;
            console.log(`✅ WebLLM model loaded: ${this._config.modelId}`);

        } catch (error) {
            console.error('Failed to load WebLLM model:', error);
            throw error;
        } finally {
            this._loading = false;
        }
    }

    /**
     * Unload the model to free memory
     */
    async unload() {
        if (this._engine) {
            // WebLLM doesn't have explicit unload, but we can release reference
            this._engine = null;
            this._loaded = false;
        }
    }

    /**
     * Build tool-calling system prompt for models that support it
     */
    _buildToolSystemPrompt(toolSpecs) {
        if (!toolSpecs || toolSpecs.length === 0) return '';

        const tools = toolSpecs.map(spec => ({
            type: 'function',
            function: {
                name: spec.name,
                description: spec.description,
                parameters: spec.inputSchema
            }
        }));

        return `You are a function calling AI model. You are provided with function signatures within <tools></tools> XML tags. You may call one or more functions to assist with the user query. Don't make assumptions about what values to plug into functions. Here are the available tools: <tools> ${JSON.stringify(tools)} </tools>. Use the following pydantic model json schema for each tool call you will make: {"properties": {"arguments": {"title": "Arguments", "type": "object"}, "name": {"title": "Name", "type": "string"}}, "required": ["arguments", "name"], "title": "FunctionCall", "type": "object"} For each function call return a json object with function name and arguments within <tool_call></tool_call> XML tags as follows:
<tool_call>
{"arguments": <args-dict>, "name": <function-name>}
</tool_call>`;
    }

    /**
     * Parse tool calls from model response
     */
    _parseToolCalls(content) {
        if (!content) return [];

        const toolCalls = [];
        const regex = /<tool_call>\s*\n?({[\s\S]*?})\s*\n?<\/tool_call>/g;
        let match;
        let index = 0;

        while ((match = regex.exec(content)) !== null) {
            try {
                const toolData = JSON.parse(match[1].trim());
                toolCalls.push({
                    index: index++,
                    id: `call_${Date.now()}_${index}`,
                    name: toolData.name,
                    arguments: toolData.arguments || {}
                });
            } catch (e) {
                console.warn('Failed to parse tool call:', match[1], e);
            }
        }

        return toolCalls;
    }

    /**
     * Format messages for WebLLM chat format
     */
    _formatMessages(messages, options) {
        const formatted = [];

        // Build system prompt
        let systemContent = '';
        
        // Add tool definitions to system prompt
        if (options?.toolSpecs && options.toolSpecs.length > 0) {
            systemContent += this._buildToolSystemPrompt(options.toolSpecs);
        }

        // Add user's system prompt
        if (options?.systemPrompt) {
            const userSystem = typeof options.systemPrompt === 'string'
                ? options.systemPrompt
                : options.systemPrompt.filter(b => b.type === 'textBlock').map(b => b.text).join('\n');
            if (userSystem) {
                systemContent += (systemContent ? '\n\n' : '') + userSystem;
            }
        }

        if (systemContent) {
            formatted.push({ role: 'system', content: systemContent });
        }

        // Convert messages
        for (const msg of messages) {
            if (msg.role === 'user') {
                const toolResults = msg.content.filter(b => b.type === 'toolResultBlock');
                const otherContent = msg.content.filter(b => b.type !== 'toolResultBlock');

                // Add regular user content
                if (otherContent.length > 0) {
                    const text = otherContent.map(block => {
                        if (block.type === 'textBlock') return block.text;
                        return String(block);
                    }).join('\n');
                    formatted.push({ role: 'user', content: text });
                }

                // Add tool results
                if (toolResults.length > 0) {
                    const results = toolResults.map(tr => {
                        const content = tr.content.map(c => {
                            if (c.type === 'textBlock') return c.text;
                            if (c.type === 'jsonBlock') return JSON.stringify(c.json);
                            return String(c);
                        }).join('');
                        return tr.status === 'error' ? { error: content } : JSON.parse(content || '{}');
                    });
                    
                    // Format as tool response
                    const toolResponse = `<tool_response>\n${JSON.stringify({ results })}\n</tool_response>`;
                    formatted.push({ role: 'user', content: toolResponse });
                }

            } else if (msg.role === 'assistant') {
                const textParts = [];
                const toolUseParts = [];

                for (const block of msg.content) {
                    if (block.type === 'textBlock') {
                        textParts.push(block.text);
                    } else if (block.type === 'toolUseBlock') {
                        // Format as XML tool call
                        toolUseParts.push(`<tool_call>\n${JSON.stringify({
                            name: block.name,
                            arguments: block.input
                        })}\n</tool_call>`);
                    }
                }

                const content = [...textParts, ...toolUseParts].join('\n');
                if (content) {
                    formatted.push({ role: 'assistant', content });
                }
            }
        }

        return formatted;
    }

    /**
     * Stream a conversation with the model
     * Yields SDK-compatible streaming events
     */
    async *stream(messages, options) {
        // Ensure model is loaded
        if (!this._loaded) {
            await this.load();
        }

        // Format messages
        const formattedMessages = this._formatMessages(messages, options);

        // Emit message start
        yield { type: 'modelMessageStartEvent', role: 'assistant' };

        let fullContent = '';
        let contentBlockStarted = false;

        try {
            // Create streaming request
            const stream = await this._engine.chat.completions.create({
                messages: formattedMessages,
                temperature: this._config.temperature,
                max_tokens: this._config.maxTokens,
                stream: true,
                stream_options: { include_usage: true }
            });

            // Process stream
            for await (const chunk of stream) {
                if (!chunk.choices || chunk.choices.length === 0) {
                    // Usage chunk
                    if (chunk.usage) {
                        yield {
                            type: 'modelMetadataEvent',
                            usage: {
                                inputTokens: chunk.usage.prompt_tokens || 0,
                                outputTokens: chunk.usage.completion_tokens || 0,
                                totalTokens: chunk.usage.total_tokens || 0
                            }
                        };
                    }
                    continue;
                }

                const choice = chunk.choices[0];
                const delta = choice.delta;

                // Handle content delta
                if (delta?.content) {
                    if (!contentBlockStarted) {
                        contentBlockStarted = true;
                        yield { type: 'modelContentBlockStartEvent' };
                    }

                    fullContent += delta.content;
                    yield {
                        type: 'modelContentBlockDeltaEvent',
                        delta: { type: 'textDelta', text: delta.content }
                    };
                }

                // Handle finish
                if (choice.finish_reason) {
                    // Close text block if open
                    if (contentBlockStarted) {
                        yield { type: 'modelContentBlockStopEvent' };
                        contentBlockStarted = false;
                    }

                    // Parse tool calls from accumulated content
                    const toolCalls = this._parseToolCalls(fullContent);

                    if (toolCalls.length > 0) {
                        // Emit tool use events
                        for (const tc of toolCalls) {
                            yield {
                                type: 'modelContentBlockStartEvent',
                                start: {
                                    type: 'toolUseStart',
                                    name: tc.name,
                                    toolUseId: tc.id
                                }
                            };
                            yield {
                                type: 'modelContentBlockDeltaEvent',
                                delta: {
                                    type: 'toolUseInputDelta',
                                    input: JSON.stringify(tc.arguments)
                                }
                            };
                            yield { type: 'modelContentBlockStopEvent' };
                        }

                        yield { type: 'modelMessageStopEvent', stopReason: 'toolUse' };
                    } else {
                        yield { type: 'modelMessageStopEvent', stopReason: 'endTurn' };
                    }
                }
            }

        } catch (error) {
            console.error('WebLLM stream error:', error);
            
            // Close any open blocks
            if (contentBlockStarted) {
                yield { type: 'modelContentBlockStopEvent' };
            }
            yield { type: 'modelMessageStopEvent', stopReason: 'endTurn' };
            
            throw error;
        }
    }
}

// Default export
export default WebLLMBrowserModel;
