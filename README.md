# agi.diy

[![License](https://img.shields.io/badge/Apache_2.0-blue.svg)](LICENSE)
[![Strands](https://img.shields.io/badge/Strands_Agents-purple.svg)](https://github.com/strands-agents/sdk-typescript)
[![Browser](https://img.shields.io/badge/100%25_Client_Side-green.svg)](#privacy)

**Build your own AGI. In your browser. Right now.**

[▶️ Launch](https://agi.diy) • [📖 SDK](https://github.com/strands-agents/sdk-typescript) • [📱 Install](#install)

---

## What is this?

> **One sentence:** An AI assistant that runs entirely in your browser, can create its own tools, and keeps thinking even when you walk away.

```mermaid
graph LR
    You[👤 You] --> Browser[🌐 Browser]
    Browser --> Agent[🤖 Agent]
    Agent --> Tools[🛠️ Tools]
    Agent --> Memory[💾 Memory]
    Agent --> Vision[👁️ Vision]
    
    style Browser fill:#1a1a2e,stroke:#16213e,color:#fff
    style Agent fill:#0f3460,stroke:#16213e,color:#fff
```

**Nothing leaves your browser.** Your API keys, conversations, and custom tools stay on your device.

---

## How It Works

```mermaid
sequenceDiagram
    participant You
    participant Browser
    participant Agent
    participant AI Provider
    
    You->>Browser: "Check my emails"
    Browser->>Agent: Process request
    Agent->>Agent: Select tools needed
    Agent->>AI Provider: Send to Claude/GPT
    AI Provider-->>Agent: Stream response
    Agent->>Browser: Execute tools
    Browser-->>You: Show results
```

**The flow:**
1. You type a message
2. Agent figures out what tools to use
3. Calls AI provider (or local model)
4. Executes tools in your browser
5. Shows you the result

---

## Quick Start

```mermaid
flowchart TD
    Start([🚀 Start]) --> Choice{API Key?}
    Choice -->|Yes| Cloud[☁️ Cloud AI]
    Choice -->|No| Local[💻 Local AI]
    
    Cloud --> Settings[Settings → Add Key]
    Settings --> Chat[💬 Start Chatting]
    
    Local --> WebLLM[Select WebLLM]
    WebLLM --> Download[Download Model ~2GB]
    Download --> Offline[Works Offline Forever]
    Offline --> Chat
    
    style Start fill:#10b981,stroke:#059669,color:#fff
    style Chat fill:#3b82f6,stroke:#2563eb,color:#fff
```

**Three commands:**
```bash
# Option 1: Use hosted version
open https://agi.diy

# Option 2: Self-host
git clone https://github.com/cagataycali/agi-diy.git
cd agi-diy/docs
python3 -m http.server 8080
```

---

## Two Modes Explained

### Single Agent Mode (`index.html`)

```mermaid
graph TD
    You[👤 You] <--> Agent[🤖 Single Agent]
    Agent --> Tool1[🔧 Tool]
    Agent --> Tool2[🔧 Tool]
    Agent --> Tool3[🔧 Tool]
```

**Like having one smart assistant** who can do many things.

### Multi-Agent Mode (`agi.html`)

```mermaid
graph TD
    You[👤 You] --> Orchestrator[🎯 Main Agent]
    Orchestrator --> R[📚 Researcher]
    Orchestrator --> A[📊 Analyst]
    Orchestrator --> W[✍️ Writer]
    
    R <-.->|Share Context| Ring[(🔄 Ring Buffer)]
    A <-.->|Share Context| Ring
    W <-.->|Share Context| Ring
```

**Like having a team.** Agents share what they learn through "ring attention" - when one discovers something, others see it too.

---

## The Tool System

```mermaid
mindmap
  root((🛠️ Tools))
    Core
      render_ui
      javascript_eval
      storage
      fetch_url
      notify
    Self-Modification
      create_tool
      delete_tool
      update_self
    Vision
      screen_capture
      activity_tracking
      bluetooth_scan
    Maps
      markers
      fly_to
      tour
      gps
    Google
      gmail
      drive
      calendar
    Multi-Agent
      spawn_agent
      invoke
      broadcast
      schedule
```

### How Tool Creation Works

```mermaid
sequenceDiagram
    participant You
    participant Agent
    participant localStorage
    
    You->>Agent: "Create a weather tool"
    Agent->>Agent: Write JavaScript code
    Agent->>localStorage: Save tool definition
    Note over localStorage: Tool persists forever
    
    You->>Agent: "What's the weather?"
    Agent->>localStorage: Load weather tool
    Agent->>Agent: Execute tool
    Agent-->>You: "72°F and sunny"
```

**Tools you create stick around.** Close the browser, come back next week - your tools are still there.

---

## Ambient Mode: Background Thinking

```mermaid
stateDiagram-v2
    [*] --> Active: You're chatting
    Active --> Idle: No input for 30s
    Idle --> Thinking: 🌙 Ambient activates
    Thinking --> Thinking: Explore topic
    Thinking --> Ready: 3 cycles done
    Ready --> Active: You return
    
    note right of Thinking: Agent keeps<br/>researching
    note right of Ready: Findings stored<br/>for next message
```

**Think of it like this:** You ask about quantum computing, then go make coffee. When you come back, the agent has already explored related topics and will include those findings in your next conversation.

### Two Ambient Modes

| Mode | Icon | What happens |
|------|------|--------------|
| **Standard** 🌙 | Moon | Thinks 3 times when you're idle, then waits |
| **Autonomous** 🚀 | Rocket | Keeps going until it decides it's done |

---

## Model Options

### Decision Tree: Which Model?

```mermaid
flowchart TD
    Start([Need AI?]) --> Privacy{Privacy Critical?}
    
    Privacy -->|Yes| Local[💻 WebLLM Local]
    Privacy -->|No| Speed{Need Speed?}
    
    Speed -->|Yes| Fast[⚡ Claude Haiku / GPT-3.5]
    Speed -->|No| Quality{Need Best Quality?}
    
    Quality -->|Yes| Best[🧠 Claude Opus / GPT-4o]
    Quality -->|No| Balanced[⚖️ Claude Sonnet]
    
    Local --> Qwen[Qwen 2.5 3B ⭐]
    
    style Local fill:#10b981,stroke:#059669,color:#fff
    style Best fill:#8b5cf6,stroke:#7c3aed,color:#fff
```

### Model Comparison

| Model | Speed | Quality | Privacy | Cost |
|-------|-------|---------|---------|------|
| **Claude Opus** | 🐢 | ⭐⭐⭐⭐⭐ | ☁️ Cloud | $$$ |
| **Claude Sonnet** | 🐇 | ⭐⭐⭐⭐ | ☁️ Cloud | $$ |
| **Claude Haiku** | 🚀 | ⭐⭐⭐ | ☁️ Cloud | $ |
| **GPT-4o** | 🐇 | ⭐⭐⭐⭐ | ☁️ Cloud | $$ |
| **WebLLM Qwen 3B** | 🐇 | ⭐⭐⭐ | 🔒 Local | Free |
| **WebLLM Qwen 1.5B** | 🚀 | ⭐⭐ | 🔒 Local | Free |

---

## Real Examples

### Example 1: Email Assistant

```mermaid
sequenceDiagram
    participant You
    participant Agent
    participant Google
    participant Notification
    
    You->>Agent: "Every 9am, check Gmail for urgent emails"
    Agent->>Agent: Create scheduled task
    
    Note over Agent: Next morning, 9:00 AM
    
    Agent->>Google: Fetch unread emails
    Google-->>Agent: 5 emails found
    Agent->>Agent: Analyze urgency
    Agent->>Notification: 🔔 "2 urgent emails"
    Notification-->>You: Push notification
```

### Example 2: Research Team

```mermaid
sequenceDiagram
    participant You
    participant Main
    participant Researcher
    participant Writer
    participant Ring as Ring Buffer
    
    You->>Main: "Research AI safety, write report"
    Main->>Researcher: Spawn + "Find papers"
    Main->>Writer: Spawn + "Wait for research"
    
    Researcher->>Ring: Papers found
    Note over Ring: Context shared
    Ring-->>Writer: Sees research
    
    Writer->>Main: Draft report
    Main-->>You: Final report
```

### Example 3: Custom Tool Creation

```
You: "Create a tool that gets cryptocurrency prices"

Agent thinks: I'll use the CoinGecko API...

Agent creates:
┌─────────────────────────────────────┐
│ Tool: crypto_price                  │
│ Input: { coin: "bitcoin" }          │
│ Output: { price: 45000, change: 2%} │
└─────────────────────────────────────┘

Tool saved to localStorage ✓

You: "What's the crypto_price of ethereum?"
Agent: "Ethereum is $3,421 (+1.5% today)"
```

---

## Architecture

```mermaid
graph TB
    subgraph Browser["🌐 Your Browser"]
        subgraph App["agi.diy"]
            UI[Chat Interface]
            Agent[Strands Agent]
            Tools[Tool Engine]
            Storage[(localStorage)]
        end
        
        subgraph Models["Model Providers"]
            Anthropic[Anthropic API]
            OpenAI[OpenAI API]
            Bedrock[AWS Bedrock]
            WebLLM[WebLLM Local]
        end
    end
    
    UI <--> Agent
    Agent <--> Tools
    Agent <--> Storage
    Agent <--> Models
    
    style Browser fill:#1e1e2e,stroke:#45475a,color:#cdd6f4
    style App fill:#313244,stroke:#45475a,color:#cdd6f4
```

**Key insight:** Everything happens in your browser. The only external calls are to the AI provider you choose (or none, with WebLLM).

---

## Privacy Model

```mermaid
flowchart LR
    subgraph Your Device
        Browser[🌐 Browser]
        Keys[🔑 API Keys]
        Data[💾 Your Data]
        Tools[🛠️ Custom Tools]
    end
    
    subgraph External
        AI[☁️ AI Provider]
    end
    
    Browser -->|Queries only| AI
    AI -->|Responses only| Browser
    
    Keys -.->|Never sent| External
    Data -.->|Never sent| External
    Tools -.->|Never sent| External
    
    style External fill:#ef4444,stroke:#dc2626,color:#fff
    style Your Device fill:#10b981,stroke:#059669,color:#fff
```

| What | Where it stays |
|------|----------------|
| API Keys | Your browser's localStorage |
| Conversations | Your browser's localStorage |
| Custom Tools | Your browser's localStorage |
| Settings | Your browser's localStorage |

**With WebLLM:** Even queries stay local. Zero external calls.

---

## Installation

```mermaid
flowchart TD
    Platform{What device?}
    
    Platform -->|iPhone/iPad| iOS[Safari → Share → Add to Home Screen]
    Platform -->|Android| Android[Chrome → Menu → Install App]
    Platform -->|Desktop| Desktop[Click install icon in URL bar]
    
    iOS --> PWA[📱 PWA Installed]
    Android --> PWA
    Desktop --> PWA
    
    PWA --> Features[✅ Home icon<br/>✅ Offline support<br/>✅ Push notifications]
```

### Sync Between Devices

```mermaid
sequenceDiagram
    participant Phone
    participant Desktop
    
    Desktop->>Desktop: Settings → Sync → Set password
    Desktop->>Desktop: Generate encrypted URL
    Desktop-->>Phone: Copy URL (any method)
    Phone->>Phone: Paste URL + Enter password
    Phone->>Phone: All settings imported ✓
    
    Note over Phone,Desktop: Uses AES-256-GCM encryption
```

---

## Configuration Cheat Sheet

### API Keys
| Provider | Where to get |
|----------|--------------|
| Anthropic | [console.anthropic.com](https://console.anthropic.com) |
| OpenAI | [platform.openai.com](https://platform.openai.com) |
| Bedrock | [AWS Console](https://console.aws.amazon.com/bedrock) → API Keys |

### Extended Thinking (Bedrock)
```json
{
  "thinking": { 
    "type": "enabled", 
    "budget_tokens": 10000 
  }
}
```

### Google OAuth Setup
```mermaid
flowchart LR
    A[Cloud Console] --> B[Create OAuth Client]
    B --> C[Add origin: agi.diy]
    C --> D[Copy Client ID]
    D --> E[Paste in Settings]
```

---

## Console Commands

```javascript
// Quick reference
agi.agent           // Get agent instance
agi.clear()         // Clear conversation
agi.tools.list()    // See your custom tools
agi.tools.delete(x) // Remove a tool

// Context
agiContext.getContext()      // What agent knows about you
agiContext.scanBluetooth()   // Find nearby devices
```

---

## Troubleshooting

```mermaid
flowchart TD
    Problem{What's wrong?}
    
    Problem -->|No response| Key[Check API key in Settings]
    Problem -->|WebLLM won't load| GPU[Use Chrome/Edge 113+]
    Problem -->|Model stuck| Refresh[Refresh the page]
    Problem -->|No notifications| Perms[Enable in browser settings]
    Problem -->|Screen capture fails| Allow[Allow permission when prompted]
```

---

## File Structure

```
docs/
├── index.html      # Single agent mode
├── agi.html        # Multi-agent mode
├── strands.js      # Strands SDK
├── vision.js       # Screen capture, ambient mode
├── webllm.js       # Local model inference
├── map.js          # Google Maps integration
├── tools/
│   └── google.js   # Gmail, Drive, Calendar
├── sw.js           # Service worker (PWA)
└── manifest.json   # PWA config
```

---

## Contributing

```mermaid
flowchart LR
    A[Your idea] --> B{Type?}
    B -->|New tool| C[✅ Welcome!]
    B -->|Bug fix| C
    B -->|New provider| C
    B -->|Add framework| D[❌ Keep it simple]
    B -->|Build system| D
```

---

## License

Apache 2.0 - Do whatever you want, just include the license.

---

<p align="center">
Built with <a href="https://github.com/strands-agents/sdk-typescript">Strands Agents SDK</a><br/>
<strong><a href="https://agi.diy">agi.diy</a></strong>
</p>
