# AgentMeshStudio Deployment Guide

## Deployed URLs

- **Beta**: https://agentmeshstudio.beta.harmony.a2z.com
- **Prod**: (deploy after testing beta)

## Initial Setup

### 1. Create Package on code.amazon.com

Package created: `AgentMeshStudio`

### 2. Push Code

```bash
# Add remote (if not already added)
git remote add amazon ssh://git.amazon.com/pkg/AgentMeshStudio

# Push to main
git push amazon main:main
```

## Deploy Frontend to Harmony

```bash
# Build the app
harmony app build

# Deploy to beta for testing
harmony app deploy --stage beta

# After testing, deploy to prod
harmony app deploy --stage prod
```

## Access Configuration

The app is deployed with bindle ID: `amzn1.bindle.resource.i56xf3t7cukzyu2xamya`

**Important:** Configure access permissions at:
https://bindles.amazon.com/resource/amzn1.bindle.resource.6s7z7w5puqkgod6zvq6a

Even your own team needs explicit access. See: https://docs.harmony.a2z.com/docs/application-development.html#Restricting%20Access%20to%20Apps

## Python Package (Local Relay)

Users install the relay server locally:

```bash
# From PyPI (after publishing)
pip install ag-mesh-relay

# Or from source
cd p2p-server
pip install -e .

# Run the relay
ag-mesh-relay
```

## Notes

- Frontend is 100% static - no build step required for content
- Python package is optional - users only need it for local P2P mesh networking
- Frontend works standalone with cloud AI providers (Anthropic, OpenAI, Bedrock)
