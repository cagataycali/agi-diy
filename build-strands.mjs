/**
 * Build strands.js browser bundle for agi-diy
 *
 * Bundles the Strands Agents TypeScript SDK for browser use:
 * - Real AWS SDK (BedrockModel with SigV4 + bearer token auth)
 * - Real Anthropic SDK (AnthropicModel)
 * - Real OpenAI SDK (OpenAIModel)
 * - Real MCP SDK (McpClient, SSE + Streamable HTTP transports)
 * - Node-only modules stubbed (stdio, fs, child_process, etc.)
 *
 * Usage:
 *   node build-strands.mjs
 *
 * Prerequisites:
 *   cd ../StrandsAgentsSDKTypescript && npm install && npm run build
 */

import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SDK_DIR = resolve(__dirname, '../../StrandsAgentsSDKTypescript');
const OUT_FILE = resolve(__dirname, 'docs/strands.js');

const ENTRY = `
  // Core SDK — import directly to avoid pulling in zod-tool (zod = 703KB)
  export { Agent } from '${SDK_DIR}/dist/src/agent/agent.js';
  export { AgentResult } from '${SDK_DIR}/dist/src/types/agent.js';
  export { FunctionTool } from '${SDK_DIR}/dist/src/tools/function-tool.js';
  export { Tool } from '${SDK_DIR}/dist/src/tools/tool.js';
  export { Model } from '${SDK_DIR}/dist/src/models/model.js';
  export { Message, TextBlock, JsonBlock, ToolResultBlock } from '${SDK_DIR}/dist/src/types/messages.js';
  export { ImageBlock } from '${SDK_DIR}/dist/src/types/media.js';
  export {
    AfterInvocationEvent, AfterModelCallEvent, BeforeModelCallEvent, BeforeToolCallEvent
  } from '${SDK_DIR}/dist/src/hooks/index.js';
  export { SlidingWindowConversationManager } from '${SDK_DIR}/dist/src/conversation-manager/sliding-window-conversation-manager.js';
  export { NullConversationManager } from '${SDK_DIR}/dist/src/conversation-manager/null-conversation-manager.js';
  export { McpClient } from '${SDK_DIR}/dist/src/mcp.js';

  // Model providers
  export { BedrockModel } from '${SDK_DIR}/dist/src/models/bedrock.js';
  export { AnthropicModel } from '${SDK_DIR}/dist/src/models/anthropic.js';
  export { OpenAIModel } from '${SDK_DIR}/dist/src/models/openai.js';

  // MCP transport (browser-compatible, streamable HTTP only)
  export { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
`;

const STUBS = resolve(__dirname, 'stubs');

await build({
  stdin: { contents: ENTRY, resolveDir: SDK_DIR, loader: 'js' },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile: OUT_FILE,
  target: ['es2022'],
  treeShaking: true,
  alias: {
    // Zod — MCP SDK uses for protocol validation, stub with pass-through (saves ~700KB)
    'zod': resolve(STUBS, 'zod'),
    'zod/v3': resolve(STUBS, 'zod/v3.js'),
    'zod/v4': resolve(STUBS, 'zod/v4.js'),
    'zod/v4/mini': resolve(STUBS, 'zod/v4-mini.js'),
    'zod/v4-mini': resolve(STUBS, 'zod/v4-mini.js'),
    'zod-to-json-schema': resolve(STUBS, 'zod-to-json-schema.js'),
    'ajv': resolve(STUBS, 'ajv.js'),
    'ajv-formats': resolve(STUBS, 'empty.js'),
    // Node-only transports
    '@modelcontextprotocol/sdk/client/stdio.js': resolve(STUBS, 'empty.js'),
    'node:child_process': resolve(STUBS, 'empty.js'),
    'node:events': resolve(STUBS, 'events.js'),
    'node:process': resolve(STUBS, 'empty.js'),
    'node:stream': resolve(STUBS, 'empty.js'),
    'node:stream/web': resolve(STUBS, 'empty.js'),
    'node:url': resolve(STUBS, 'empty.js'),
    'node:path': resolve(STUBS, 'empty.js'),
    'node:fs': resolve(STUBS, 'empty.js'),
    'node:os': resolve(STUBS, 'empty.js'),
    'node:crypto': resolve(STUBS, 'empty.js'),
    'node:http': resolve(STUBS, 'empty.js'),
    'node:https': resolve(STUBS, 'empty.js'),
    'node:net': resolve(STUBS, 'empty.js'),
    'node:zlib': resolve(STUBS, 'empty.js'),
    'node:buffer': resolve(STUBS, 'empty.js'),
    'node:util': resolve(STUBS, 'empty.js'),
    'node:async_hooks': resolve(STUBS, 'empty.js'),
    'child_process': resolve(STUBS, 'empty.js'),
    'events': resolve(STUBS, 'events.js'),
    'stream': resolve(STUBS, 'empty.js'),
    'fs': resolve(STUBS, 'empty.js'),
    'os': resolve(STUBS, 'empty.js'),
    'path': resolve(STUBS, 'empty.js'),
    'crypto': resolve(STUBS, 'empty.js'),
    'http': resolve(STUBS, 'empty.js'),
    'https': resolve(STUBS, 'empty.js'),
    'net': resolve(STUBS, 'empty.js'),
    'zlib': resolve(STUBS, 'empty.js'),
    'util': resolve(STUBS, 'empty.js'),
    'async_hooks': resolve(STUBS, 'empty.js'),
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env': '{}',
    'process.version': '"v20.0.0"',
    'process.platform': '"browser"',
    'process.stdout': '{}',
    'process.stderr': '{}',
    'global': 'globalThis',
  },
  logLevel: 'info',
  metafile: true,
}).then(result => {
  const meta = result.metafile;
  const sizes = {};
  for (const [file, info] of Object.entries(meta.inputs)) {
    const pkg = file.match(/node_modules\/(@[^/]+\/[^/]+|[^/]+)/)?.[1] || 'sdk';
    sizes[pkg] = (sizes[pkg] || 0) + info.bytes;
  }
  if (process.argv.includes('--analyze')) {
    const sorted = Object.entries(sizes).sort((a, b) => b[1] - a[1]);
    console.log('\nBundle size breakdown:');
    for (const [pkg, bytes] of sorted) {
      console.log(`  ${(bytes/1024).toFixed(0).padStart(6)} KB  ${pkg}`);
    }
  }
});

console.log(`\n✅ Built ${OUT_FILE}`);
