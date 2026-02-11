# MCP Client Support — Design Plan

## Goal

Add MCP (Model Context Protocol) client support to the multi-agent UI, allowing agents to connect to remote MCP servers and use their tools. Browser-only — no stdio, only HTTP-based transports.

## Current State

`strands.js` bundle contains:
- `McpClient` class (line 16098) — fully implemented, takes `{ transport }`, has `connect()`, `disconnect()`, `listTools()`, `callTool()`
- `McpTool` class (line 16031) — extends `Tool`, wraps MCP tool calls, returns `ToolResultBlock`
- `Client` class (line 16022) — **STUBBED** (empty class). The `@modelcontextprotocol/sdk` was excluded from the bundle.

Neither `McpClient` nor `McpTool` are exported from the bundle.

## What Needs to Happen

### 1. Rebuild strands.js with MCP SDK

The `Client` stub must be replaced with the real `@modelcontextprotocol/sdk` Client. Two options:

**Option A: Rebuild the bundle** — Include `@modelcontextprotocol/sdk` in the build. This gives us `Client`, `SSEClientTransport`, and `StreamableHTTPClientTransport` all bundled.

**Option B: Load MCP SDK separately** — Import `@modelcontextprotocol/sdk` as a separate script, patch the `Client` reference. More fragile.

Recommend Option A. Also export `McpClient` from the bundle.

### 2. Browser-Compatible Transports

Only HTTP-based transports work in browser:
- **SSE** (`SSEClientTransport`) — Server-Sent Events, widely supported
- **Streamable HTTP** (`StreamableHTTPClientTransport`) — newer, bidirectional

No stdio (no subprocess spawning in browser).

### 3. McpClient API (already in bundle)

```javascript
// Constructor takes a transport instance
const client = new McpClient({
  transport: new SSEClientTransport(new URL('https://example.com/sse')),
  applicationName: 'agi-diy'
});

// Connect and get tools
await client.connect();
const tools = await client.listTools();  // returns McpTool[]

// Pass tools to agent
const agent = new Agent({ model, tools: [...builtinTools, ...tools] });

// Cleanup
await client.disconnect();
```

### 4. UI: MCP Server Configuration

Add to agent spawn/edit modal:
- MCP Servers section with URL input + transport type selector (SSE / Streamable HTTP)
- Each server entry: `{ name, url, transport: 'sse'|'streamable-http' }`
- Stored in `agentData.mcpServers[]`

On agent creation:
1. Create `McpClient` per server config
2. `await client.connect()` + `await client.listTools()`
3. Merge MCP tools into agent's tool list
4. Store client references for cleanup on agent kill

### 5. Agent Data Model Change

```javascript
// agentData gains:
{
  mcpServers: [
    { name: 'aws-knowledge', url: 'https://knowledge-mcp.global.api.aws', transport: 'streamable-http' },
    { name: 'github', url: 'https://github-mcp.example.com/sse', transport: 'sse' }
  ],
  mcpClients: [],  // runtime only, not persisted
}
```

### 6. Lifecycle

- **Agent spawn**: Connect MCP clients, list tools, merge into agent tools
- **Agent kill**: Disconnect all MCP clients
- **Reconnect**: If MCP server drops, reconnect on next tool call (McpClient handles this)
- **Error**: Surface MCP connection failures in agent status

## Test Plan Additions

### kaa-sourcecontrol agent
```javascript
{
  name: 'kaa-sourcecontrol',
  systemPrompt: 'You are a source control specialist. Use GitHub MCP tools for repository operations.',
  mcpServers: [
    { name: 'github', url: '<github-mcp-url>', transport: 'sse' }
  ],
  enabledTools: ['invoke_agent', 'read_pipeline', 'update_task_status']
}
```

### AWS Knowledge MCP
```javascript
{
  name: 'kaa-aws-knowledge',
  systemPrompt: 'You are an AWS documentation specialist.',
  mcpServers: [
    { name: 'aws-knowledge', url: 'https://knowledge-mcp.global.api.aws', transport: 'streamable-http' }
  ],
  enabledTools: ['invoke_agent', 'read_pipeline']
}
```

## Open Questions

1. **CORS**: Will remote MCP servers allow browser requests? May need proxy or CORS headers.
2. **Auth**: Some MCP servers need auth headers — need UI for optional headers/tokens.
3. **Bundle rebuild**: Need access to the strands SDK build system to rebuild with MCP SDK included.
4. **GitHub MCP URL**: Need to identify the correct hosted GitHub MCP server endpoint (or self-host one).

## Non-Goals

- No stdio transport (impossible in browser)
- No MCP server hosting (we're client only)
- No tool creation via MCP (we already have `create_tool`)
