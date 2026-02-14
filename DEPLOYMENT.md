# AgentMeshStudio Deployment Guide

## Initial Setup

### 1. Create Package on code.amazon.com

```bash
# Create the package
brazil create-package --name AgentMeshStudio --type StaticWebsite

# Or if package already exists, just clone
git clone ssh://git.amazon.com/pkg/AgentMeshStudio
```

### 2. Push Code

```bash
# Add remote (if not already added)
git remote add amazon ssh://git.amazon.com/pkg/AgentMeshStudio

# Push to mainline
git push amazon main:mainline
```

## Deploy Frontend to Harmony Spaces

```bash
# Deploy to beta for testing
harmony-spaces deploy --environment beta

# After testing, deploy to prod
harmony-spaces deploy --environment prod
```

Your app will be available at:
- Beta: `https://spaces.harmony.a2z.com/YOUR_SPACE_ID-beta`
- Prod: `https://spaces.harmony.a2z.com/YOUR_SPACE_ID`

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

- Frontend is 100% static - no build step required
- Python package is optional - users only need it for local P2P mesh networking
- Frontend works standalone with cloud AI providers (Anthropic, OpenAI, Bedrock)
