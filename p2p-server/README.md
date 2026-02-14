# ag-mesh-relay

P2P WebSocket relay for agi.diy mesh networking. Can run:
- **Local server** that launches and manages kiro-cli agents
- **AWS deployment** via [Bedrock AgentCore](https://github.com/aws/bedrock-agentcore-starter-toolkit) with Cognito auth

## Installation

```bash
# Install as a tool
uv tool install .

# Or with AWS support
uv tool install ".[aws]"
```

## Local Server (kiro-cli agents)

Run the relay to launch and manage kiro-cli agents:

```bash
ag-mesh-relay

# Or with custom host/port
HOST=0.0.0.0 PORT=9000 ag-mesh-relay
```

### Configuration

Edit `~/.config/ag-mesh-relay/config.json` (created automatically on first run):

```json
{
  "agents": [
    {
      "id": "default-agent",
      "workingPath": "~/src",
      "agent": "default",
      "autoStart": true
    }
  ],
  "server": {
    "host": "localhost",
    "port": 8080
  }
}
```

See `config.example.json` for more examples.

### Launching Agents

Send a `launch_agent` message via WebSocket:

```javascript
ws.send(JSON.stringify({
  type: "launch_agent",
  agentId: "my-agent",
  config: {
    workingPath: "~/src/myproject",
    agent: "git"
  }
}));
```

The server will:
1. Launch `kiro-cli acp --agent git --cwd ~/src/myproject`
2. Register the agent as peer `kiro-my-agent` in the mesh
3. Relay commands between the mesh and kiro-cli stdin/stdout

### Sending Commands to Agents

```javascript
ws.send(JSON.stringify({
  type: "agent_command",
  agentId: "my-agent",
  command: {
    action: "execute",
    data: { /* command payload */ }
  }
}));
```

## AWS Deployment

For AWS deployment with AgentCore, install with AWS support:

```bash
uv tool install ".[aws]"

```bash
pip install bedrock-agentcore-starter-toolkit

cd p2p-server
agentcore configure --entrypoint relay.py --non-interactive
agentcore launch --local   # test locally on ws://localhost:8080/ws
agentcore launch           # deploy to AWS
```

## Authentication

AgentCore uses IAM SigV4 for WebSocket auth. Browsers can't set custom HTTP headers on WebSocket connections, so we use **Cognito Identity Pool** to bridge OAuth login → temporary AWS credentials → SigV4 presigned URL.

```text
User → Cognito login → id_token → Identity Pool → temp AWS creds → SigV4 presigned URL → WebSocket
```

### Prerequisites

- A Cognito User Pool with an app client (implicit flow, openid scope)
- A Cognito Identity Pool linked to the User Pool, with an authenticated IAM role that allows `bedrock-agentcore:InvokeAgentRuntime`

### Browser Flow

```javascript
const IDENTITY_POOL_ID = 'us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
const USER_POOL_PROVIDER = 'cognito-idp.ap-southeast-2.amazonaws.com/ap-southeast-2_XXXXXXXXX';
const AGENT_ARN = 'arn:aws:bedrock-agentcore:us-east-1:123456789012:runtime/relay-XXXXXXXXXX';

// 1. User logs in via Cognito hosted UI → get id_token from URL hash
// 2. Exchange id_token for AWS credentials:
const idResp = await fetch('https://cognito-identity.us-east-1.amazonaws.com/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'AWSCognitoIdentityService.GetId' },
  body: JSON.stringify({ IdentityPoolId: IDENTITY_POOL_ID, Logins: { [USER_POOL_PROVIDER]: idToken } })
});
const { IdentityId } = await idResp.json();

const credsResp = await fetch('https://cognito-identity.us-east-1.amazonaws.com/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': 'AWSCognitoIdentityService.GetCredentialsForIdentity' },
  body: JSON.stringify({ IdentityId, Logins: { [USER_POOL_PROVIDER]: idToken } })
});
const { Credentials } = await credsResp.json();

// 3. SigV4-sign the WebSocket URL using temp credentials
// 4. new WebSocket(presignedUrl)
```

### Python Client

```python
from bedrock_agentcore.runtime import AgentCoreRuntimeClient

client = AgentCoreRuntimeClient(region="us-east-1")
url = client.generate_presigned_url(runtime_arn="<agent-runtime-arn>")
# Connect with any WebSocket library
```

## Protocol

Messages are JSON:

```json
{
  "type": "presence|heartbeat|broadcast|direct|stream|ack|turn_end|error",
  "from": "<peer-id>",
  "to": "<peer-id>",
  "data": {},
  "timestamp": 1234567890
}
```

| Type | Routing |
|------|---------|
| `presence` | Broadcast to all peers |
| `heartbeat` | Server only (updates last_seen) |
| `broadcast` | All peers except sender |
| `direct` | Single target peer |
| `stream`, `ack`, `turn_end`, `error` | All peers except sender |

Peers that miss heartbeats for 30s are reaped automatically.

## Architecture

```text
Browser A ──ws──┐
Browser B ──ws──┤── AgentCore (SigV4) ──→ relay.py (/ws on port 8080)
Browser C ──ws──┘
        ↑
  Cognito login → Identity Pool → temp AWS creds → presigned URL
```

The relay is stateless between restarts — peers reconnect and re-announce via `presence`.
