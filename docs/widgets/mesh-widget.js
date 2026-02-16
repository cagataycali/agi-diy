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
    const relayLogs = M?.getRelayLogs?.() || [];
    
    const enabledRelays = config.relays.filter(r => r.enabled);
    const connectedCount = enabledRelays.filter(r => connMap.get(r.id)).length;
    
    const showRelayLogs = container._showRelayLogs || false;
    
    const relayList = enabledRelays.map(r => {
      const connected = connMap.get(r.id);
      const icon = connected ? '●' : '○';
      const color = connected ? 'var(--green)' : 'var(--text-muted)';
      const label = r.type === 'websocket' ? r.url : `${r.id} (auto-renew)`;
      
      // Show reauth button for agentcore, or connect button for websocket
      let actionBtn = '';
      if (!connected) {
        if (r.type === 'agentcore') {
          actionBtn = `<button onclick="window.reauthAgentCore?.()" style="background:var(--orange,#ff9500);color:#fff;border:none;padding:2px 6px;border-radius:3px;font-size:10px;cursor:pointer;margin-left:8px">🔐 Reauth</button>`;
        } else if (r.type === 'websocket') {
          actionBtn = `<button onclick="window.AgentMesh?.connectRelayById?.('${r.id}')" style="background:var(--blue,#007aff);color:#fff;border:none;padding:2px 6px;border-radius:3px;font-size:10px;cursor:pointer;margin-left:8px">🔌 Connect</button>`;
        }
      }
      
      return `<div style="margin-bottom:4px;display:flex;align-items:center"><span style="color:${color}">${icon}</span> <span style="flex:1">${label}</span>${actionBtn}</div>`;
    }).join('');
    
    const relayLogList = relayLogs.slice(-20).reverse().map(l => {
      const color = l.level === 'error' ? 'var(--red)' : l.level === 'warn' ? 'var(--orange)' : 'var(--text-dim)';
      const time = new Date(l.time).toLocaleTimeString();
      const relay = l.relayId ? '[' + l.relayId.slice(0,12) + ']' : '';
      return '<div style="font-size:10px;margin-bottom:2px;color:' + color + '">' + time + ' ' + relay + ' ' + l.message + '</div>';
    }).join('');
    
    const relayToggleBtn = showRelayLogs ? '▼' : '▶';
    const relayLogsSection = showRelayLogs ? '<div style="margin-top:8px;max-height:200px;overflow-y:auto;background:var(--bg-card);padding:6px;border-radius:4px">' + (relayLogList || '<div style="color:var(--text-muted);font-size:10px">No logs</div>') + '</div>' : '';
    
    container.innerHTML = `<div style="padding:12px;font-size:12px">
      <div style="margin-bottom:12px">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Connected Relays (${connectedCount}/${enabledRelays.length})</div>
        ${relayList || '<div style="color:var(--text-muted)">No relays configured</div>'}
      </div>
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Remote Peers (${peers.length})</div>
      <div style="margin-bottom:12px">${peers.length ? peers.map(p => `<div style="margin-bottom:4px"><span style="color:var(--green)">●</span> ${p.hostname||'?'} <span style="color:var(--text-muted)">(${p.agents?.length||0} agents)</span></div>`).join('') : '<div style="color:var(--text-muted)">None</div>'}</div>
      <div style="border-top:1px solid var(--border);padding-top:8px">
        <button class="mesh-relay-logs-toggle" style="background:none;border:1px solid var(--border);color:var(--text-dim);font-size:10px;padding:4px 8px;border-radius:4px;cursor:pointer;width:100%">${relayToggleBtn} Relay Logs (${relayLogs.length})</button>
        ${relayLogsSection}
      </div>
      </div>
    </div>`;
    
    container.classList.add('mesh-widget');
    container._widget = this;
    
    // Attach toggle handler
    const relayBtn = container.querySelector('.mesh-relay-logs-toggle');
    if (relayBtn) {
      relayBtn.onclick = () => {
        container._showRelayLogs = !container._showRelayLogs;
        this.render(container);
      };
    }
    
    // Subscribe to updates
    if (M?.subscribe && !container._meshSubscribed) {
      const update = () => this.render(container);
      M.subscribe('relay-status', update);
      M.subscribe('relay-peers', update);
      M.subscribe('relay-log', update);
      container._meshSubscribed = true;
    }
  }
});
