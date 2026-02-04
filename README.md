# agi.diy

**Your own AGI. In your browser. Right now.**

[agi.diy](https://agi.diy)

---

No servers. No cloud. No bullshit.

This is a fully autonomous AI agent that runs **entirely in your browser**. Your API keys never leave your machine. Your conversations stay on your device. You own everything.

Built on [Strands Agents SDK](https://github.com/strands-agents/sdk-typescript).

---

## Why?

Because you shouldn't need a $200/month subscription to have an AI that actually *does things*.

Because your private data shouldn't live on someone else's servers.

Because an AI that can modify itself, create its own tools, and keep thinking while you're away is way more interesting than a chatbot.

---

## What can it do?

**It writes code and runs it.** JavaScript executes right in your browser. Build a calculator. Scrape a website. Make a game. Whatever.

**It remembers.** Everything persists in localStorage. Close the tab, come back tomorrow — your tools, your conversations, your data are still there.

**It evolves.** The agent can create new tools on the fly. Ask it to build a weather tool, and it will. That tool persists. Next time you ask about weather, it just uses what it built.

**It thinks when you're gone.** Enable ambient mode and walk away. It'll keep exploring, keep iterating, keep working. Come back and your insights are waiting.

**It sees.** Upload images. Share your screen. Let it watch what you're doing and help in real-time.

**It's local.** Select WebLLM and run everything on-device. No API keys. No internet. Just you and a 3B parameter model running in WebGPU.

---

## The tools

```
render_ui        → Build interactive HTML components inline
javascript_eval  → Run code, get results
storage_get/set  → Persistent memory across sessions
fetch_url        → HTTP requests from the browser
create_tool      → Make new tools at runtime
update_self      → Rewrite its own system prompt
notify           → Push notifications (yes, even backgrounded)
```

Vision:
```
Screen capture at intervals
Image upload with messages
Activity tracking (mouse, keyboard, idle time)
Geolocation
Bluetooth device scanning
```

Maps:
```
Full-screen Google Maps background
Live GPS tracking
Custom markers with emoji
Fly animations between points
Automated tours through locations
```

Google:
```
OAuth in one click
Gmail (read, send, compose)
Drive, Calendar, YouTube, Sheets, Docs...
200+ Google APIs via discovery
```

---

## Get started

1. Go to [agi.diy](https://agi.diy)
2. Settings → add your Anthropic or OpenAI key
3. Talk to it

Or skip the API key entirely — pick **WebLLM** and run Qwen/Llama/Phi locally. First load downloads the model (~1-4GB), then it's yours forever.

---

## Run it yourself

```bash
cd docs
python3 -m http.server 8080
```

That's it. Open `localhost:8080`.

---

## Privacy

- Keys stay in localStorage. Period.
- No analytics. No tracking. No telemetry.
- Settings sync uses AES-256-GCM. Your password, your encryption.
- We literally cannot see your data. There's no server to see it.

---

## How it works

```
Browser
├── Strands Agent (orchestrates everything)
├── Model Provider
│   ├── Anthropic (Claude)
│   ├── OpenAI (GPT-4o)
│   └── WebLLM (local, no API)
├── Tools (built-in + custom)
├── Vision (images, screen, ambient mode)
├── Maps (GPS, markers, animations)
├── Context (activity, location, bluetooth)
└── Google APIs (OAuth, 200+ services)
```

All vanilla JS. No React. No build step. Just files.

---

## The console

```javascript
agi.agent          // the agent instance
agi.clear()        // wipe the chat
agi.tools.list()   // see custom tools
agi.tools.delete() // remove one

agiContext.getContext()    // everything the agent knows about you
agiContext.scanBluetooth() // find nearby devices
```

---

## Ambient Mode

This is the magic.

Enable it. Walk away. The agent keeps thinking — exploring your last topic, finding edge cases, validating assumptions. When you come back, it injects everything it learned into your next message.

**Autonomous mode** goes further. It keeps working until it decides it's done (or you stop it). Give it a task, let it run.

---

## This is just the beginning

The agent can rewrite its own system prompt. It can create tools that create tools. It has eyes (vision), ears (context), and legs (Google APIs, fetch, maps).

What you build with it is up to you.

---

[Strands Agents SDK](https://github.com/strands-agents/sdk-typescript) · Apache 2.0
