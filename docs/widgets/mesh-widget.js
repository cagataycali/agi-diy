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
    const erc8004Logs = window.getERC8004Logs?.() || [];
    
    const enabledRelays = config.relays.filter(r => r.enabled);
    const connectedCount = enabledRelays.filter(r => connMap.get(r.id)).length;
    
    const showRelayLogs = container._showRelayLogs || false;
    const showERC8004Logs = container._showERC8004Logs || false;
    
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
    
    const relayLogList = relayLogs.slice(-20).reverse().map(l => {
      const color = l.level === 'error' ? 'var(--red)' : l.level === 'warn' ? 'var(--orange)' : 'var(--text-dim)';
      const time = new Date(l.time).toLocaleTimeString();
      const relay = l.relayId ? '[' + l.relayId.slice(0,12) + ']' : '';
      return '<div style="font-size:10px;margin-bottom:2px;color:' + color + '">' + time + ' ' + relay + ' ' + l.message + '</div>';
    }).join('');
    
    const erc8004LogList = erc8004Logs.slice(-20).reverse().map(l => {
      const color = l.level === 'error' ? 'var(--red)' : l.level === 'warn' ? 'var(--orange)' : 'var(--text-dim)';
      const time = new Date(l.time).toLocaleTimeString();
      const chain = l.chain ? '[' + l.chain + ']' : '';
      return '<div style="font-size:10px;margin-bottom:2px;color:' + color + '">' + time + ' ' + chain + ' ' + l.message + '</div>';
    }).join('');
    
    const relayToggleBtn = showRelayLogs ? '▼' : '▶';
    const erc8004ToggleBtn = showERC8004Logs ? '▼' : '▶';
    const relayLogsSection = showRelayLogs ? '<div style="margin-top:8px;max-height:200px;overflow-y:auto;background:var(--bg-card);padding:6px;border-radius:4px">' + (relayLogList || '<div style="color:var(--text-muted);font-size:10px">No logs</div>') + '</div>' : '';
    const erc8004LogsSection = showERC8004Logs ? '<div style="margin-top:8px;max-height:200px;overflow-y:auto;background:var(--bg-card);padding:6px;border-radius:4px">' + (erc8004LogList || '<div style="color:var(--text-muted);font-size:10px">No logs</div>') + '</div>' : '';
    
    container.innerHTML = `<div style="padding:12px;font-size:12px">
      <div style="margin-bottom:12px">
        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Connected Relays (${connectedCount}/${enabledRelays.length})</div>
        ${relayList || '<div style="color:var(--text-muted)">No relays configured</div>'}
      </div>
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Remote Peers (${peers.length})</div>
      <div style="margin-bottom:12px">${peers.length ? peers.map(p => `<div style="margin-bottom:4px"><span style="color:var(--green)">●</span> ${p.hostname||'?'} <span style="color:var(--text-muted)">(${p.agents?.length||0} agents)</span></div>`).join('') : '<div style="color:var(--text-muted)">None</div>'}</div>
      <div style="border-top:1px solid var(--border);padding-top:8px;margin-bottom:8px">
        <button class="mesh-relay-logs-toggle" style="background:none;border:1px solid var(--border);color:var(--text-dim);font-size:10px;padding:4px 8px;border-radius:4px;cursor:pointer;width:100%">${relayToggleBtn} Relay Logs (${relayLogs.length})</button>
        ${relayLogsSection}
      </div>
      <div style="border-top:1px solid var(--border);padding-top:8px">
        <button class="mesh-erc8004-logs-toggle" style="background:none;border:1px solid var(--border);color:var(--text-dim);font-size:10px;padding:4px 8px;border-radius:4px;cursor:pointer;width:100%">${erc8004ToggleBtn} ERC8004 Logs (${erc8004Logs.length})</button>
        ${erc8004LogsSection}
      </div>
    </div>`;
    
    container.classList.add('mesh-widget');
    container._widget = this;
    
    // Attach toggle handlers
    const relayBtn = container.querySelector('.mesh-relay-logs-toggle');
    const erc8004Btn = container.querySelector('.mesh-erc8004-logs-toggle');
    if (relayBtn) {
      const widget = this;
      relayBtn.onclick = () => widget.toggleRelayLogs();
    }
    if (erc8004Btn) {
      const widget = this;
      erc8004Btn.onclick = () => widget.toggleERC8004Logs();
    }
    
    // Subscribe to updates
    if (M?.subscribe && !container._meshSubscribed) {
      const update = () => this.render(container);
      M.subscribe('relay-status', update);
      M.subscribe('relay-peers', update);
      M.subscribe('relay-log', update);
      M.subscribe('erc8004-log', update);
      container._meshSubscribed = true;
    }
  },
  
  toggleRelayLogs() {
    const container = document.querySelector('.mesh-widget');
    if (container) {
      container._showRelayLogs = !container._showRelayLogs;
      this.render(container);
    }
  },
  
  toggleERC8004Logs() {
    const container = document.querySelector('.mesh-widget');
    if (container) {
      container._showERC8004Logs = !container._showERC8004Logs;
      this.render(container);
    }
  }
});
