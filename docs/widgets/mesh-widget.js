import { Widget } from './widget-interface.js';

export default new Widget({
  id: 'mesh',
  meta: { icon: '🌐', title: 'Mesh' },
  
  render(container) {
    const M = window.AgentMesh;
    const config = M?.getRelayConfig() || { relays: [] };
    const connections = M?.getRelayConnections() || [];
    const connMap = new Map(connections.map(c => [c.id, c.connected]));
    const peers = M?.getRelayPeers() || [];
    
    const enabledRelays = config.relays.filter(r => r.enabled);
    const connectedCount = enabledRelays.filter(r => connMap.get(r.id)).length;
    
    const relayList = enabledRelays.map(r => {
      const connected = connMap.get(r.id);
      const icon = connected ? '●' : '○';
      const color = connected ? 'var(--green)' : 'var(--text-muted)';
      const label = r.type === 'websocket' ? r.url : `${r.id} (auto-renew)`;
      const reauthBtn = !connected && r.type === 'agentcore' 
        ? `<button onclick="window.reauthAgentCore?.()" style="background:var(--orange,#ff9500);color:#fff;border:none;padding:2px 6px;border-radius:3px;font-size:10px;cursor:pointer;margin-left:8px">🔐 Reauth</button>`
        : '';
      return `<div style="margin-bottom:4px;display:flex;align-items:center"><span style="color:${color}">${icon}</span> <span style="flex:1">${label}</span>${reauthBtn}</div>`;
    }).join('');
    
    container.innerHTML = `<div style="padding:12px;font-size:12px">
      <div style="margin-bottom:12px">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Connected Relays (${connectedCount}/${enabledRelays.length})</div>
        ${relayList || '<div style="color:var(--text-muted)">No relays configured</div>'}
      </div>
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Remote Peers (${peers.length})</div>
      <div>${peers.length ? peers.map(p => `<div style="margin-bottom:4px"><span style="color:var(--green)">●</span> ${p.hostname||'?'} <span style="color:var(--text-muted)">(${p.agents?.length||0} agents)</span></div>`).join('') : '<div style="color:var(--text-muted)">None</div>'}</div>
    </div>`;
  },
  
  onEvent(type) {
    if (type === 'relay-status' || type === 'relay-peers') {
      document.querySelectorAll('#b-mesh .block-body').forEach(el => this.render(el));
    }
  }
});
