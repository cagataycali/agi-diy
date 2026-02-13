// AgentMesh Settings — shared modal with plugin-registered tabs
// Load AFTER agent-mesh.js. Plugins call AgentMesh.settings.registerTab() to add tabs.
(function() {
    'use strict';
    const M = window.AgentMesh;
    if (!M) return;

    const tabs = [];
    let activeTab = null;

    function registerTab(id, label, renderFn) {
        if (!tabs.find(t => t.id === id)) tabs.push({ id, label, render: renderFn });
    }

    function injectCSS() {
        if (document.getElementById('mesh-settings-css')) return;
        const s = document.createElement('style');
        s.id = 'mesh-settings-css';
        s.textContent = `
.ms-overlay { position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:200;display:flex;align-items:center;justify-content:center; }
.ms-modal { background:var(--bg-panel,#12121a);border:1px solid var(--border,#2a2a3a);border-radius:12px;width:520px;max-width:90vw;max-height:80vh;display:flex;flex-direction:column;position:relative; }
.ms-tabs { display:flex;border-bottom:1px solid var(--border,#2a2a3a);padding:0 12px;overflow-x:auto; }
.ms-tab { padding:10px 16px;font-size:11px;color:var(--text-muted,#555);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap; }
.ms-tab.active { color:var(--accent,#7c5cff);border-bottom-color:var(--accent,#7c5cff); }
.ms-body { flex:1;overflow-y:auto;padding:16px;font-size:12px;color:var(--text,#e0e0e8); }
.ms-body label { display:flex;flex-direction:column;gap:4px;padding:4px 0; }
.ms-body input[type="text"] { background:var(--bg-card,#1a1a26);border:1px solid var(--border,#2a2a3a);color:var(--text,#e0e0e8);padding:5px 8px;border-radius:4px;font-size:11px;width:100%; }
.ms-body input[type="checkbox"] { width:16px;height:16px; }
.ms-body .ms-row { display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border,#2a2a3a); }
.ms-body .ms-hint { font-size:10px;color:var(--text-muted,#555);margin-top:4px; }
.ms-body .ms-addr { font-family:monospace;font-size:10px;color:var(--text-dim,#888);flex:1;overflow:hidden;text-overflow:ellipsis; }
.ms-btn { background:var(--bg-hover,#22222e);border:1px solid var(--border,#2a2a3a);color:var(--text-dim,#888);font-size:10px;padding:4px 10px;border-radius:4px;cursor:pointer; }
.ms-btn:hover { color:var(--text,#e0e0e8);border-color:var(--accent,#7c5cff); }
.ms-btn.primary { background:var(--accent,#7c5cff);color:#000;border-color:var(--accent,#7c5cff); }
.ms-btn.success { background:var(--green,#00ff88);color:#000;border-color:var(--green,#00ff88); }
.ms-btn.danger { color:var(--red,#ff6666); }
.ms-btn.danger:hover { border-color:var(--red,#ff6666); }
.ms-close { position:absolute;top:8px;right:12px;background:none;border:none;color:var(--text-muted,#555);font-size:16px;cursor:pointer; }
`;
        document.head.appendChild(s);
    }

    function open(tabId) {
        injectCSS();
        activeTab = tabId || tabs[0]?.id;
        let root = document.getElementById('meshSettingsRoot');
        if (!root) { root = document.createElement('div'); root.id = 'meshSettingsRoot'; document.body.appendChild(root); }
        render(root);
    }

    function close() {
        const root = document.getElementById('meshSettingsRoot');
        if (root) root.innerHTML = '';
    }

    function render(root) {
        const tab = tabs.find(t => t.id === activeTab) || tabs[0];
        if (!tab) { root.innerHTML = ''; return; }
        root.innerHTML = `<div class="ms-overlay" onclick="if(event.target===this)AgentMesh.settings.close()">
            <div class="ms-modal">
                <button class="ms-close" onclick="AgentMesh.settings.close()">✕</button>
                <div class="ms-tabs">${tabs.map(t =>
                    `<div class="ms-tab ${t.id===activeTab?'active':''}" onclick="AgentMesh.settings.open('${t.id}')">${t.label}</div>`
                ).join('')}</div>
                <div class="ms-body" id="msTabBody"></div>
            </div>
        </div>`;
        const body = document.getElementById('msTabBody');
        if (body && tab.render) tab.render(body);
    }

    M.settings = { registerTab, open, close };
    
    // ═══ Built-in Mesh Tab ═══
    registerTab('mesh', 'Mesh Relays', body => {
        const config = M.getRelayConfig();
        const connections = M.getRelayConnections();
        const connMap = new Map(connections.map(c => [c.id, c.connected]));
        
        body.innerHTML = `
            <div style="margin-bottom:12px;color:var(--text-dim);font-size:11px">Configure WebSocket relay endpoints for agent mesh communication</div>
            <div id="relayList" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px"></div>
            <div style="display:flex;gap:8px">
                <button class="ms-btn primary" id="addWsRelay">+ WebSocket Relay</button>
                <button class="ms-btn primary" id="addAcRelay">+ AgentCore Relay</button>
            </div>
        `;
        
        function renderRelayList() {
            const list = document.getElementById('relayList');
            if (!list) return;
            
            if (config.relays.length === 0) {
                list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:11px">No relays configured</div>';
                return;
            }
            
            list.innerHTML = config.relays.map(r => {
                const connected = connMap.get(r.id);
                const statusIcon = connected ? '●' : '○';
                const statusColor = connected ? 'var(--green)' : 'var(--text-muted)';
                const typeLabel = r.type === 'websocket' ? 'WebSocket' : 'AgentCore';
                const detail = r.type === 'websocket' ? r.url : `${r.region} • ${r.arn?.split('/').pop() || 'no ARN'}`;
                
                return `<div class="ms-row" style="flex-direction:column;align-items:stretch;padding:8px">
                    <div style="display:flex;align-items:center;gap:8px">
                        <input type="checkbox" ${r.enabled?'checked':''} onchange="window._toggleRelay('${r.id}', this.checked)">
                        <div style="flex:1">
                            <div style="font-size:11px;font-weight:600">${r.id}</div>
                            <div style="font-size:10px;color:var(--text-dim)">${typeLabel} • ${detail}</div>
                        </div>
                        <span style="color:${statusColor};font-size:10px">${statusIcon} ${connected?'Connected':'Disconnected'}</span>
                    </div>
                    <div style="display:flex;gap:6px;margin-top:6px;font-size:10px">
                        <label style="flex-direction:row;align-items:center;gap:4px">
                            <input type="checkbox" ${r.autoConnect?'checked':''} onchange="window._toggleAutoConnect('${r.id}', this.checked)">
                            Auto-connect
                        </label>
                        <div style="flex:1"></div>
                        ${connected ? `<button class="ms-btn" onclick="window._disconnectRelay('${r.id}')">Disconnect</button>` : `<button class="ms-btn success" onclick="window._connectRelay('${r.id}')">Connect</button>`}
                        <button class="ms-btn" onclick="window._editRelay('${r.id}')">Edit</button>
                        <button class="ms-btn danger" onclick="window._deleteRelay('${r.id}')">Delete</button>
                    </div>
                </div>`;
            }).join('');
        }
        
        renderRelayList();
        
        // Global handlers
        window._toggleRelay = (id, enabled) => {
            M.updateRelay(id, { enabled });
            if (!enabled) M.disconnectRelayById(id);
            M.settings.open('mesh');
        };
        
        window._toggleAutoConnect = (id, autoConnect) => {
            M.updateRelay(id, { autoConnect });
        };
        
        window._connectRelay = (id) => {
            M.connectRelayById(id);
            setTimeout(() => M.settings.open('mesh'), 500);
        };
        
        window._disconnectRelay = (id) => {
            M.disconnectRelayById(id);
            M.settings.open('mesh');
        };
        
        window._editRelay = (id) => {
            const relay = config.relays.find(r => r.id === id);
            if (!relay) return;
            
            if (relay.type === 'websocket') {
                const url = prompt('WebSocket URL:', relay.url);
                if (url) {
                    M.updateRelay(id, { url });
                    M.settings.open('mesh');
                }
            } else if (relay.type === 'agentcore') {
                showAgentCoreEdit(relay);
            }
        };
        
        window._deleteRelay = (id) => {
            if (!confirm('Delete this relay?')) return;
            M.deleteRelay(id);
            M.settings.open('mesh');
        };
        
        document.getElementById('addWsRelay')?.addEventListener('click', () => {
            const url = prompt('WebSocket URL:', 'ws://localhost:10000');
            if (!url) return;
            const id = M.addRelay({ type: 'websocket', url, enabled: true, autoConnect: false });
            M.settings.open('mesh');
        });
        
        document.getElementById('addAcRelay')?.addEventListener('click', () => {
            showAgentCoreEdit(null);
        });
        
        function showAgentCoreEdit(relay) {
            const isNew = !relay;
            const cfg = M.getAgentCoreConfig?.() || {};
            const arn = relay?.arn || cfg.arn || '';
            const region = relay?.region || cfg.region || 'us-east-1';
            const cog = relay?.cognito || cfg.cognito || {};
            
            body.innerHTML = `
                <button class="ms-btn" onclick="AgentMesh.settings.open('mesh')" style="margin-bottom:12px">← Back to Relays</button>
                <div style="margin-bottom:12px;color:var(--text-dim);font-size:11px">AgentCore relay with SigV4 presigned WebSocket</div>
                <div style="display:flex;flex-direction:column;gap:6px">
                    <label>Runtime ARN<input type="text" id="acArn" value="${arn}" placeholder="arn:aws:bedrock-agentcore:…:runtime/relay-…"></label>
                    <label>Region<input type="text" id="acRegion" value="${region}"></label>
                    <div style="margin-top:8px;color:var(--text-dim);font-size:11px">Cognito Authentication</div>
                    <label>Domain<input type="text" id="acCogDomain" value="${cog.domain||''}" placeholder="auth.example.com"></label>
                    <label>Client ID<input type="text" id="acCogClient" value="${cog.clientId||''}"></label>
                    <label>Identity Pool ID<input type="text" id="acIdPool" value="${cog.identityPoolId||''}"></label>
                    <label>Provider Name<input type="text" id="acProvider" value="${cog.providerName||''}"></label>
                    <div style="display:flex;gap:8px;margin-top:10px">
                        ${cog.domain?'<button class="ms-btn primary" id="acCogLogin">Login via Cognito</button>':''}
                        <button class="ms-btn success" id="acSave">${isNew?'Add':'Update'} Relay</button>
                    </div>
                </div>
            `;
            
            document.getElementById('acCogLogin')?.addEventListener('click', () => {
                const d = document.getElementById('acCogDomain').value.trim();
                const c = document.getElementById('acCogClient').value.trim();
                if (!d||!c) return alert('Cognito Domain and Client ID required');
                
                // Save config before redirecting
                const arn = document.getElementById('acArn').value.trim();
                const region = document.getElementById('acRegion').value.trim();
                const idPool = document.getElementById('acIdPool').value.trim();
                const provider = document.getElementById('acProvider').value.trim();
                
                localStorage.setItem('agentcore_arn', arn);
                localStorage.setItem('cognito_domain', d);
                localStorage.setItem('cognito_client_id', c);
                localStorage.setItem('identity_pool_id', idPool);
                localStorage.setItem('cognito_provider_name', provider);
                
                const cb = encodeURIComponent(location.origin + '/cognitoauth.html');
                const state = encodeURIComponent(location.href);
                location.href = `https://${d}/oauth2/authorize?client_id=${c}&response_type=token&scope=openid+email+profile&redirect_uri=${cb}&state=${state}`;
            });
            
            document.getElementById('acSave')?.addEventListener('click', () => {
                const arn = document.getElementById('acArn').value.trim();
                const region = document.getElementById('acRegion').value.trim();
                if (!arn||!region) return alert('ARN and Region required');
                
                const cogDomain = document.getElementById('acCogDomain').value.trim();
                const cogClient = document.getElementById('acCogClient').value.trim();
                const idPool = document.getElementById('acIdPool').value.trim();
                const provider = document.getElementById('acProvider').value.trim();
                
                const cognito = idPool ? { identityPoolId: idPool, providerName: provider, domain: cogDomain, clientId: cogClient } : undefined;
                
                // Save to legacy keys for cognitoauth.html
                localStorage.setItem('agentcore_arn', arn);
                if (cogDomain) localStorage.setItem('cognito_domain', cogDomain);
                if (cogClient) localStorage.setItem('cognito_client_id', cogClient);
                if (idPool) localStorage.setItem('identity_pool_id', idPool);
                if (provider) localStorage.setItem('cognito_provider_name', provider);
                
                if (isNew) {
                    M.addRelay({ type: 'agentcore', arn, region, cognito, enabled: true, autoConnect: false });
                } else {
                    M.updateRelay(relay.id, { arn, region, cognito });
                }
                
                M.settings.open('mesh');
            });
        }
    });
})();
