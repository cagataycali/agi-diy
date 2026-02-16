"""P2P WebSocket relay server for agi.diy mesh networking.

Deployed via AgentCore starter toolkit. OAuth handled at gateway level.
Protocol: presence, heartbeat, broadcast, direct, stream, ack, turn_end, error

Uses @app.websocket decorator — relay runs on /ws within the AgentCore Starlette app.
"""

import asyncio
import json
import time

from bedrock_agentcore import BedrockAgentCoreApp

app = BedrockAgentCoreApp()

# peer_id -> {ws, last_seen, meta}
peers: dict = {}
STALE_TIMEOUT = 30
_reaper_started = False


async def broadcast(msg, *, exclude=None):
    raw = json.dumps(msg) if isinstance(msg, dict) else msg
    gone = []
    for pid, p in peers.items():
        if pid == exclude:
            continue
        try:
            await p["ws"].send_text(raw)
        except Exception:
            gone.append(pid)
    for pid in gone:
        peers.pop(pid, None)


async def reap_stale():
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
                    "type": "presence", "from": pid,
                    "data": {"status": "offline"}, "timestamp": time.time()
                })


@app.websocket
async def relay(ws, context):
    global _reaper_started
    if not _reaper_started:
        asyncio.create_task(reap_stale())
        _reaper_started = True

    await ws.accept()
    peer_id = None
    try:
        while True:
            raw = await ws.receive_text()
            msg = json.loads(raw)
            mtype = msg.get("type")

            if mtype == "presence":
                peer_id = msg["from"]
                peers[peer_id] = {"ws": ws, "last_seen": time.time(), "meta": msg.get("data", {})}
                # send existing peers to newcomer
                for pid, p in peers.items():
                    if pid != peer_id:
                        await ws.send_text(json.dumps({
                            "type": "presence", "from": pid,
                            "data": p["meta"], "timestamp": p["last_seen"]
                        }))
                await broadcast(msg, exclude=peer_id)

            elif mtype == "heartbeat":
                if peer_id and peer_id in peers:
                    peers[peer_id]["last_seen"] = time.time()

            elif mtype == "direct":
                target = msg.get("to")
                if target and target in peers:
                    await peers[target]["ws"].send_text(raw)

            else:  # broadcast, stream, ack, turn_end, error
                await broadcast(msg, exclude=peer_id)

    except Exception:
        pass
    finally:
        if peer_id:
            peers.pop(peer_id, None)
            await broadcast({
                "type": "presence", "from": peer_id,
                "data": {"status": "offline"}, "timestamp": time.time()
            })


@app.entrypoint
def status(request):
    """Health/status endpoint for AgentCore."""
    return {"status": "ok", "peers": list(peers.keys()), "count": len(peers)}


status.run()
