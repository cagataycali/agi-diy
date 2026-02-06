#!/usr/bin/env node
/**
 * 🌐 AGI Mesh Relay Server
 * 
 * Simple WebSocket relay for agi.diy multi-agent P2P communication.
 * All connected clients can broadcast to each other.
 * 
 * Usage:
 *   node relay-server.js [port]
 *   
 * Default port: 8765
 * 
 * Connect from agi.html Settings → Network → ws://localhost:8765
 */

const WebSocket = require('ws');

const PORT = process.argv[2] || 8765;
const wss = new WebSocket.Server({ port: PORT });

const clients = new Map(); // ws -> { instanceId, agents, lastSeen }

console.log(`🌐 AGI Mesh Relay Server`);
console.log(`   Listening on ws://0.0.0.0:${PORT}`);
console.log(`   Connect from agi.html → Settings → Network`);
console.log('');

wss.on('connection', (ws, req) => {
    const ip = req.socket.remoteAddress;
    console.log(`✅ Client connected from ${ip}`);
    
    clients.set(ws, { instanceId: null, agents: [], lastSeen: Date.now() });
    
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            const client = clients.get(ws);
            
            // Update client info
            if (msg.from || msg.instanceId) {
                client.instanceId = msg.from || msg.instanceId;
                client.lastSeen = Date.now();
            }
            
            if (msg.data?.agents) {
                client.agents = msg.data.agents;
            }
            
            // Log activity
            const logMsg = `📨 ${client.instanceId || 'unknown'} → ${msg.type}`;
            if (msg.to) {
                console.log(`${logMsg} → ${msg.to}`);
            } else {
                console.log(logMsg);
            }
            
            // Relay to all other clients
            const msgStr = JSON.stringify(msg);
            for (const [otherWs, otherClient] of clients) {
                if (otherWs !== ws && otherWs.readyState === WebSocket.OPEN) {
                    otherWs.send(msgStr);
                }
            }
            
        } catch (err) {
            console.warn('Invalid message:', err.message);
        }
    });
    
    ws.on('close', () => {
        const client = clients.get(ws);
        console.log(`❌ Client disconnected: ${client?.instanceId || 'unknown'}`);
        clients.delete(ws);
    });
    
    ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
    });
});

// Periodic status
setInterval(() => {
    const activeClients = [...clients.values()].filter(c => c.instanceId);
    if (activeClients.length > 0) {
        console.log(`\n📊 Status: ${activeClients.length} peer(s) connected`);
        activeClients.forEach(c => {
            console.log(`   • ${c.instanceId} (${c.agents.length} agents)`);
        });
        console.log('');
    }
}, 30000);

console.log('Waiting for connections...\n');
