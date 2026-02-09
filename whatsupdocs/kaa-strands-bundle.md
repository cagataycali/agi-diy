# strands.js Browser Bundle

## What It Is

`docs/strands.js` is a single-file ESM bundle of the Strands Agents TypeScript SDK plus its dependencies, built for browser use. It's the only external dependency for `agi.html` and `sauhsoj-ii.html`.

## Building

```bash
# Prerequisites: SDK must be built first
cd ../StrandsAgentsSDKTypescript && npm install && npm run build

# Build the bundle
cd ../cagataycali/agi-diy
npm install        # installs esbuild
npm run build      # → docs/strands.js

# With size breakdown
npm run build:analyze
```

The build script is `build-strands.mjs`. It uses esbuild to bundle from the SDK's compiled output (`dist/src/`) with browser-specific stubs for Node-only modules.

## SDK Source

Built from `strands-agents/sdk-typescript` (GitHub: `strands-agents/sdk-typescript`).

Local path: `../../StrandsAgentsSDKTypescript` (relative to agi-diy repo root).

To update: `cd ../StrandsAgentsSDKTypescript && git pull && npm install && npm run build`, then rebuild the bundle.

## What's Included

### Exports (574KB total)

| Export | From | Purpose |
|--------|------|---------|
| `Agent` | strands SDK | Core agent loop |
| `AgentResult` | strands SDK | Agent invocation result |
| `FunctionTool` | strands SDK | Define tools from functions |
| `Tool` | strands SDK | Base tool class |
| `Model` | strands SDK | Base model class |
| `Message`, `TextBlock`, `JsonBlock`, `ToolResultBlock` | strands SDK | Message types |
| `ImageBlock` | strands SDK | Image content blocks |
| `BeforeToolCallEvent`, `AfterInvocationEvent`, etc. | strands SDK | Hook events |
| `SlidingWindowConversationManager` | strands SDK | Conversation window management |
| `NullConversationManager` | strands SDK | No-op conversation manager |
| `BedrockModel` | strands SDK | AWS Bedrock model provider |
| `AnthropicModel` | strands SDK | Anthropic model provider |
| `OpenAIModel` | strands SDK | OpenAI model provider |
| `McpClient` | strands SDK | MCP client for remote tool servers |
| `StreamableHTTPClientTransport` | MCP SDK | HTTP transport for MCP connections |

### Size Breakdown

| Component | Size | What's in it |
|-----------|------|-------------|
| strands SDK | 229 KB | Agent, tools, hooks, conversation managers, model base |
| openai | 218 KB | Chat completions + responses API (other resources stubbed) |
| MCP SDK | 175 KB | Client, StreamableHTTP transport, protocol handling |
| anthropic | 136 KB | Messages API + streaming (beta/batches/models stubbed) |
| AWS (SigV4) | 68 KB | Signature V4, event stream codec, SHA-256 |
| tslib | 17 KB | TypeScript runtime helpers |

## What's Excluded (and Why)

### Stubbed — validation libraries (saves ~960KB)

| Library | Original Size | Why stubbed |
|---------|--------------|-------------|
| zod | 703 KB | MCP SDK uses for protocol validation; pass-through stub |
| ajv + ajv-formats | 221 KB | MCP SDK JSON schema validation; pass-through stub |
| zod-to-json-schema | 53 KB | Schema conversion; not needed at runtime |

Stubs are in `stubs/zod/`, `stubs/ajv.js`, `stubs/zod-to-json-schema.js`. They accept any input and return success — we trust MCP server responses in the browser.

### Stubbed — AWS SDK middleware stack (saves ~564KB)

The full `@aws-sdk/client-bedrock-runtime` pulls in the entire Smithy middleware stack (632KB). Instead, `stubs/bedrock-runtime.js` provides a minimal client (~100 lines) that:

- Signs requests with SigV4 via `@smithy/signature-v4` (24KB)
- Supports bearer token auth (Bedrock API keys)
- Parses event streams via `@smithy/eventstream-codec` (15KB)
- Uses `fetch` directly — no middleware stack

The minimal client implements the same `client.send(command)` interface the SDK's `BedrockModel` expects.

### Stubbed — unused SDK resources

**OpenAI** (saves ~107KB): Only `chat` and `responses` resources kept. Stubbed: audio, batches, beta, completions (legacy), containers, conversations, embeddings, evals, files, fine-tuning, graders, images, models, moderations, realtime, uploads, vector-stores, videos, webhooks.

**Anthropic** (saves ~77KB): Only `messages` resource kept. Stubbed: beta (BetaMessageStream, BetaToolRunner, beta resources), batches, completions, models.

**MCP SDK** (saves ~71KB): `types.js` replaced with minimal stub containing only runtime values (ErrorCode, McpError, JSONRPC type guards, protocol version constants). The 379 zod schema definitions are replaced with `undefined`.

### Stubbed — Node-only modules

All Node builtins (`fs`, `crypto`, `child_process`, `stream`, `http`, `net`, etc.) are stubbed with empty modules. The `events` module has a minimal `EventEmitter` implementation. MCP stdio transport is stubbed (can't spawn processes in browser).

## How to Add/Remove Things

### Adding a new SDK export

1. Add the export line to the `ENTRY` template in `build-strands.mjs`
2. Use direct path imports (e.g., `from '${SDK_DIR}/dist/src/path/to/module.js'`) to avoid pulling in unrelated code via `index.js` barrel exports
3. Rebuild: `npm run build`

### Adding a new model provider

The SDK supports Bedrock, Anthropic, OpenAI, and (as of v0.2.1+) Gemini. To add Gemini:

1. Add `export { GeminiModel } from '${SDK_DIR}/dist/src/models/gemini/gemini.js'` to ENTRY
2. Check what `@google/genai` pulls in — may need resource trimming like OpenAI/Anthropic
3. Rebuild and check size with `npm run build:analyze`

### Trimming a new SDK dependency

The `trimPlugin` in `build-strands.mjs` uses esbuild's `onLoad` hook to intercept resolved files and replace them with stubs. Pattern:

```javascript
// Stub files matching a path pattern
build.onLoad({ filter: /some-package\/resources\/.*\.mjs$/ }, args => {
  const match = args.path.match(/resources\/([^/.]+)/);
  if (match && !KEEP_SET.has(match[1])) {
    return { contents: 'const S = class {}; export default S; export const Foo=S;', loader: 'js' };
  }
});
```

For package-level stubs, use `alias` in the esbuild config:
```javascript
alias: { 'some-package': resolve(STUBS, 'some-package.js') }
```

### Updating the SDK version

```bash
cd ../StrandsAgentsSDKTypescript
git fetch github && git reset --hard github/main
npm install && npm run build
cd ../cagataycali/agi-diy
npm run build
# Test in browser, then commit docs/strands.js
```

### Debugging bundle issues

- `npm run build:analyze` — shows size per package
- Check `stubs/` directory for all stub implementations
- Module comments in `docs/strands.js` show which source file each section came from (search for `// ../../`)
- If a new SDK version adds imports that break the build, check the error for the missing export and add it to the relevant stub

## Optimization History

| Step | Size | Technique |
|------|------|-----------|
| Original (all stubs) | 625 KB | No real SDK code |
| Real SDKs (everything) | 1,740 KB | Full bundle |
| Stub zod/ajv | 1,100 KB | Validation not needed in browser |
| Minimal Bedrock client | 782 KB | SigV4 + fetch, no middleware |
| Trim OpenAI resources | 690 KB | Keep chat + responses only |
| Minimal MCP types | 641 KB | Runtime values only |
| Trim Anthropic | 574 KB | Keep messages only |
