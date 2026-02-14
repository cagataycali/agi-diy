#!/usr/bin/env python3
"""Local P2P server that launches and manages kiro-cli agents."""

import asyncio
import json
import os
import subprocess
import time
from pathlib import Path
from typing import Dict, Optional

import websockets
from websockets.server import WebSocketServerProtocol

# peer_id -> {ws, last_seen, meta}
peers: Dict[str, dict] = {}
# agent_id -> {process, peer_id, config}
agents: Dict[str, dict] = {}

STALE_TIMEOUT = 30
CONFIG_FILE = Path.home() / ".config" / "ag-mesh-relay" / "config.json"


def load_config() -> dict:
    """Load configuration from ~/.config/ag-mesh-relay/config.json."""
    if CONFIG_FILE.exists():
        return json.loads(CONFIG_FILE.read_text())
    
    # Create default config if not exists
    default_config = {"agents": [], "server": {"host": "localhost", "port": 10000}}
    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(default_config, indent=2))
    print(f"Created default config at {CONFIG_FILE}")
    return default_config


async def broadcast(msg: dict, *, exclude: Optional[str] = None):
    """Broadcast message to all connected peers except excluded one."""
    raw = json.dumps(msg)
    gone = []
    for pid, p in peers.items():
        if pid == exclude:
            continue
        try:
            await p["ws"].send(raw)
        except Exception:
            gone.append(pid)
    for pid in gone:
        peers.pop(pid, None)


async def reap_stale():
    """Remove stale peers that haven't sent heartbeat."""
    while True:
        await asyncio.sleep(10)
        now = time.time()
        stale = [pid for pid, p in peers.items() if now - p["last_seen"] > STALE_TIMEOUT]
        for pid in stale:
            p = peers.pop(pid, None)
            if p:
                try:
                    await p["ws"].close()
                except Exception:
                    pass
                await broadcast({
                    "type": "presence",
                    "from": pid,
                    "data": {"status": "offline"},
                    "timestamp": time.time()
                })


async def launch_kiro_agent(agent_id: str, config: dict) -> Optional[subprocess.Popen]:
    """Launch a kiro-cli acp session."""
    working_path = Path(config.get("workingPath", "~/src")).expanduser()
    agent_name = config.get("agent", "default")
    
    if not working_path.exists():
        print(f"Working path does not exist: {working_path}")
        return None
    
    cmd = ["kiro-cli", "acp", "--agent", agent_name, "--cwd", str(working_path)]
    
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )
        print(f"Launched kiro-cli agent {agent_id}: {' '.join(cmd)}")
        return proc
    except Exception as e:
        print(f"Failed to launch agent {agent_id}: {e}")
        return None


async def handle_agent_command(agent_id: str, command: dict):
    """Send command to kiro-cli agent and relay response."""
    if agent_id not in agents:
        return {"error": f"Agent {agent_id} not found"}
    
    agent = agents[agent_id]
    proc = agent["process"]
    
    if proc.poll() is not None:
        return {"error": f"Agent {agent_id} process terminated"}
    
    try:
        # Send command to kiro-cli stdin
        cmd_json = json.dumps(command) + "\n"
        proc.stdin.write(cmd_json)
        proc.stdin.flush()
        
        # Read response from stdout (non-blocking with timeout)
        # In practice, you'd want a more sophisticated protocol
        return {"status": "sent"}
    except Exception as e:
        return {"error": str(e)}


async def handle_message(ws: WebSocketServerProtocol, msg: dict, peer_id: Optional[str]):
    """Handle incoming WebSocket message."""
    mtype = msg.get("type")
    
    if mtype == "presence":
        new_peer_id = msg["from"]
        peers[new_peer_id] = {
            "ws": ws,
            "last_seen": time.time(),
            "meta": msg.get("data", {})
        }
        
        # Send existing peers to newcomer
        for pid, p in peers.items():
            if pid != new_peer_id:
                await ws.send(json.dumps({
                    "type": "presence",
                    "from": pid,
                    "data": p["meta"],
                    "timestamp": p["last_seen"]
                }))
        
        await broadcast(msg, exclude=new_peer_id)
        return new_peer_id
    
    elif mtype == "heartbeat":
        if peer_id and peer_id in peers:
            peers[peer_id]["last_seen"] = time.time()
    
    elif mtype == "direct":
        target = msg.get("to")
        if target and target in peers:
            await peers[target]["ws"].send(json.dumps(msg))
    
    elif mtype == "launch_agent":
        # Custom command to launch kiro-cli agent
        agent_id = msg.get("agentId")
        config = msg.get("config", {})
        
        if agent_id in agents:
            await ws.send(json.dumps({
                "type": "error",
                "data": {"message": f"Agent {agent_id} already exists"}
            }))
            return peer_id
        
        proc = await launch_kiro_agent(agent_id, config)
        if proc:
            agents[agent_id] = {
                "process": proc,
                "peer_id": f"kiro-{agent_id}",
                "config": config
            }
            
            # Announce agent as new peer
            await broadcast({
                "type": "presence",
                "from": f"kiro-{agent_id}",
                "data": {
                    "status": "online",
                    "type": "kiro-cli",
                    "agent": config.get("agent", "default")
                },
                "timestamp": time.time()
            })
            
            await ws.send(json.dumps({
                "type": "agent_launched",
                "agentId": agent_id,
                "peerId": f"kiro-{agent_id}"
            }))
    
    elif mtype == "agent_command":
        # Relay command to kiro-cli agent
        agent_id = msg.get("agentId")
        command = msg.get("command", {})
        result = await handle_agent_command(agent_id, command)
        await ws.send(json.dumps({
            "type": "agent_response",
            "agentId": agent_id,
            "data": result
        }))
    
    else:
        # broadcast, stream, ack, turn_end, error
        await broadcast(msg, exclude=peer_id)
    
    return peer_id


async def handler(ws: WebSocketServerProtocol):
    """WebSocket connection handler."""
    peer_id = None
    try:
        async for raw in ws:
            msg = json.loads(raw)
            peer_id = await handle_message(ws, msg, peer_id)
    except Exception as e:
        print(f"Connection error: {e}")
    finally:
        if peer_id:
            peers.pop(peer_id, None)
            await broadcast({
                "type": "presence",
                "from": peer_id,
                "data": {"status": "offline"},
                "timestamp": time.time()
            })


async def start_autostart_agents(config: dict):
    """Launch agents marked with autoStart."""
    for agent_config in config.get("agents", []):
        if agent_config.get("autoStart", False):
            agent_id = agent_config["id"]
            proc = await launch_kiro_agent(agent_id, agent_config)
            if proc:
                agents[agent_id] = {
                    "process": proc,
                    "peer_id": f"kiro-{agent_id}",
                    "config": agent_config
                }


async def cleanup_agents():
    """Cleanup agent processes on shutdown."""
    for agent_id, agent in agents.items():
        proc = agent["process"]
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        print(f"Cleaned up agent {agent_id}")


async def find_available_port(start_port: int = 10000, max_port: int = 10100) -> Optional[int]:
    """Find an available port starting from start_port."""
    import socket
    for port in range(start_port, max_port + 1):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("", port))
                return port
        except OSError:
            continue
    return None


async def start_server():
    """Start local WebSocket server."""
    config = load_config()
    
    asyncio.create_task(reap_stale())
    await start_autostart_agents(config)
    
    server_config = config.get("server", {})
    host = os.getenv("HOST", server_config.get("host", "localhost"))
    
    # Find available port
    requested_port = int(os.getenv("PORT", server_config.get("port", 10000)))
    port = await find_available_port(requested_port, 10100)
    
    if port is None:
        print(f"❌ No available ports in range {requested_port}-10100")
        return
    
    print(f"ag-mesh-relay starting on ws://{host}:{port}")
    print(f"Config: {CONFIG_FILE}")
    print(f"Active agents: {list(agents.keys())}")
    
    try:
        async with websockets.serve(handler, host, port):
            await asyncio.Future()  # run forever
    finally:
        await cleanup_agents()


def main():
    """CLI entry point."""
    try:
        asyncio.run(start_server())
    except KeyboardInterrupt:
        print("\nShutting down...")


if __name__ == "__main__":
    main()
