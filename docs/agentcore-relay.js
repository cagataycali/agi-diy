// AgentCore Relay Plugin for AgentMesh
// Adds SigV4 presigned WebSocket URLs with auto-renewal via Cognito credentials.
// Load AFTER agent-mesh.js. Safe to omit if AgentCore relay is not needed.
(function() {
    'use strict';
    const STORE_KEY = 'mesh_agentcore_config';
    const M = window.AgentMesh;
    if (!M) { console.warn('[AgentCoreRelay] AgentMesh not found — load agent-mesh.js first'); return; }

    // ═══ SigV4 Presigning ═══
    const _enc = new TextEncoder();
    async function _hmac(key, data) {
        const k = key instanceof ArrayBuffer ? key : _enc.encode(key);
        const ck = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        return crypto.subtle.sign('HMAC', ck, typeof data === 'string' ? _enc.encode(data) : data);
    }
    async function _sha256hex(data) {
        const buf = await crypto.subtle.digest('SHA-256', typeof data === 'string' ? _enc.encode(data) : data);
        return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    function _uri(str) { return encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase()); }

    async function presignUrl(accessKeyId, secretAccessKey, sessionToken, region, arn, expires = 300) {
        const svc = 'bedrock-agentcore', host = `${svc}.${region}.amazonaws.com`;
        const path = `/runtimes/${_uri(arn)}/ws`, sid = crypto.randomUUID();
        const now = new Date(), ds = now.toISOString().replace(/[-:]/g, '').slice(0, 8);
        const amzDate = ds + 'T' + now.toISOString().replace(/[-:]/g, '').slice(9, 15) + 'Z';
        const cred = `${accessKeyId}/${ds}/${region}/${svc}/aws4_request`;
        const qp = [
            ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'], ['X-Amz-Credential', cred],
            ['X-Amz-Date', amzDate], ['X-Amz-Expires', String(expires)],
            ...(sessionToken ? [['X-Amz-Security-Token', sessionToken]] : []),
            ['X-Amz-SignedHeaders', 'host'],
            ['X-Amzn-Bedrock-AgentCore-Runtime-Session-Id', sid],
        ].sort((a, b) => a[0] < b[0] ? -1 : 1);
        const qs = qp.map(([k, v]) => `${_uri(k)}=${_uri(v)}`).join('&');
        const canonical = `GET\n${path}\n${qs}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;
        const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${ds}/${region}/${svc}/aws4_request\n${await _sha256hex(canonical)}`;
        let key = await _hmac('AWS4' + secretAccessKey, ds);
        for (const s of [region, svc, 'aws4_request']) key = await _hmac(key, s);
        const sig = [...new Uint8Array(await _hmac(key, sts))].map(b => b.toString(16).padStart(2, '0')).join('');
        return `wss://${host}${path}?${qs}&X-Amz-Signature=${sig}`;
    }

    // ═══ Config persistence ═══
    function getConfig() { try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; } }
    function saveConfig(cfg) { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); }
    function clearConfig() { localStorage.removeItem(STORE_KEY); }

    // ═══ Credential refresh via Cognito Identity Pool ═══
    async function refreshCredentials(cfg) {
        if (!cfg.idToken || !cfg.cognito) return null;
        const { identityPoolId, providerName } = cfg.cognito;
        const idpRegion = identityPoolId.split(':')[0];
        const base = `https://cognito-identity.${idpRegion}.amazonaws.com/`;
        const hdrs = { 'Content-Type': 'application/x-amz-json-1.1' };
        const idResp = await fetch(base, { method: 'POST',
            headers: { ...hdrs, 'X-Amz-Target': 'AWSCognitoIdentityService.GetId' },
            body: JSON.stringify({ IdentityPoolId: identityPoolId, Logins: { [providerName]: cfg.idToken } }) });
        const { IdentityId } = await idResp.json();
        if (!IdentityId) return null;
        const credsResp = await fetch(base, { method: 'POST',
            headers: { ...hdrs, 'X-Amz-Target': 'AWSCognitoIdentityService.GetCredentialsForIdentity' },
            body: JSON.stringify({ IdentityId, Logins: { [providerName]: cfg.idToken } }) });
        const { Credentials } = await credsResp.json();
        if (!Credentials) return null;
        return { accessKeyId: Credentials.AccessKeyId, secretAccessKey: Credentials.SecretKey,
            sessionToken: Credentials.SessionToken, expiration: Credentials.Expiration };
    }

    // ═══ Renew presigned URL and reconnect ═══
    async function renewAndConnect() {
        const cfg = getConfig();
        if (!cfg) return false;
        let { credentials } = cfg;
        if (credentials?.expiration && new Date(credentials.expiration * 1000) < new Date()) {
            console.log('[AgentCoreRelay] Credentials expired, refreshing via id_token...');
            const fresh = await refreshCredentials(cfg);
            if (!fresh) {
                console.warn('[AgentCoreRelay] Refresh failed — re-login required');
                M.subscribe?.('relay-auth-required', null); // clear
                const h = M._subscribers?.get?.('relay-auth-required');
                // Broadcast auth-required event for UI to handle
                M.broadcast?.('relay-auth-required', { reason: 'credentials_expired' });
                return false;
            }
            credentials = fresh;
            cfg.credentials = fresh;
            saveConfig(cfg);
        }
        if (!credentials?.accessKeyId) return false;
        const url = await presignUrl(credentials.accessKeyId, credentials.secretAccessKey, credentials.sessionToken, cfg.region, cfg.arn);
        M.connectRelay(url);
        return true;
    }

    // ═══ Public API — extends AgentMesh ═══
    async function connectAgentCoreRelay({ arn, region, credentials, cognito, idToken }) {
        saveConfig({ arn, region, credentials, cognito, idToken });
        M.setRelayReconnectProvider(renewAndConnect);
        const url = await presignUrl(credentials.accessKeyId, credentials.secretAccessKey, credentials.sessionToken, region, arn);
        M.connectRelay(url);
    }

    // Attach to AgentMesh
    M.connectAgentCoreRelay = connectAgentCoreRelay;
    M.presignAgentCoreUrl = presignUrl;
    M.getAgentCoreConfig = getConfig;
    M.clearAgentCoreConfig = () => { clearConfig(); M.setRelayReconnectProvider(null); };

    // Auto-connect on load if we have stored AgentCore credentials
    const cfg = getConfig();
    if (cfg?.credentials) {
        M.setRelayReconnectProvider(renewAndConnect);
        setTimeout(() => renewAndConnect().catch(e => console.warn('[AgentCoreRelay] Auto-connect failed:', e)), 1200);
    }

    // ═══ Register settings tab ═══
    if (M.settings) {
        M.settings.registerTab('relay', 'AgentCore Relay', body => {
            const cfg = getConfig() || {};
            const arn = cfg.arn || localStorage.getItem('agentcore_arn') || '';
            const region = cfg.region || (arn.match(/:([a-z0-9-]+):\d{12}:/)?.[1]) || 'us-east-1';
            const cog = cfg.cognito || {};
            const cogDomain = cog.domain || localStorage.getItem('cognito_domain') || '';
            const cogClient = cog.clientId || localStorage.getItem('cognito_client_id') || '';
            const idPool = cog.identityPoolId || localStorage.getItem('identity_pool_id') || '';
            const provider = cog.providerName || localStorage.getItem('cognito_provider_name') || '';
            const hasCreds = !!cfg.credentials?.accessKeyId;
            body.innerHTML = `<div style="margin-bottom:12px;color:var(--text-dim)">SigV4 presigned WebSocket with auto-renewal</div>
                <div style="display:flex;flex-direction:column;gap:6px">
                <label>Runtime ARN<input type="text" id="acArn" value="${arn}" placeholder="arn:aws:bedrock-agentcore:…:runtime/relay-…"></label>
                <label>Region<input type="text" id="acRegion" value="${region}"></label>
                <div style="margin-top:8px;color:var(--text-dim);font-size:11px">Cognito (browser login)</div>
                <label>Domain<input type="text" id="acCogDomain" value="${cogDomain}" placeholder="auth.example.com"></label>
                <label>Client ID<input type="text" id="acCogClient" value="${cogClient}"></label>
                <label>Identity Pool ID<input type="text" id="acIdPool" value="${idPool}"></label>
                <label>Provider Name<input type="text" id="acProvider" value="${provider}"></label>
                <div style="margin-top:8px;color:var(--text-dim);font-size:11px">Or direct credentials</div>
                <label>Access Key ID<input type="text" id="acAKID" value="${cfg.credentials?.accessKeyId||''}"></label>
                <label>Secret Access Key<input type="text" id="acSAK" value="${cfg.credentials?.secretAccessKey||''}"></label>
                <label>Session Token<input type="text" id="acST" value="${cfg.credentials?.sessionToken||''}"></label>
                <div style="display:flex;gap:8px;margin-top:10px">
                    ${cogDomain?'<button class="ms-btn primary" id="acCogLogin">Login via Cognito</button>':''}
                    <button class="ms-btn success" id="acSave">Save & Connect</button>
                    <button class="ms-btn danger" id="acClear">Clear</button>
                </div>
                <div class="ms-hint" style="margin-top:6px">${hasCreds?'✓ Credentials stored':'○ No credentials — login via Cognito or enter directly'}</div>
                </div>`;
            document.getElementById('acCogLogin')?.addEventListener('click', () => {
                const d = document.getElementById('acCogDomain').value.trim();
                const c = document.getElementById('acCogClient').value.trim();
                if (!d||!c) return alert('Cognito Domain and Client ID required');
                const cb = encodeURIComponent(location.origin + '/cognitoauth.html');
                const state = encodeURIComponent(location.href);
                location.href = `https://${d}/oauth2/authorize?client_id=${c}&response_type=token&scope=openid+email+profile&redirect_uri=${cb}&state=${state}`;
            });
            document.getElementById('acSave')?.addEventListener('click', async () => {
                const arn = document.getElementById('acArn').value.trim();
                const region = document.getElementById('acRegion').value.trim();
                if (!arn||!region) return alert('ARN and Region required');
                const cogDomain = document.getElementById('acCogDomain').value.trim();
                const cogClient = document.getElementById('acCogClient').value.trim();
                const idPool = document.getElementById('acIdPool').value.trim();
                const provider = document.getElementById('acProvider').value.trim();
                // Persist to legacy keys
                localStorage.setItem('agentcore_arn', arn);
                if (cogDomain) localStorage.setItem('cognito_domain', cogDomain);
                if (cogClient) localStorage.setItem('cognito_client_id', cogClient);
                if (idPool) localStorage.setItem('identity_pool_id', idPool);
                if (provider) localStorage.setItem('cognito_provider_name', provider);
                const ak = document.getElementById('acAKID').value.trim();
                const sk = document.getElementById('acSAK').value.trim();
                const st = document.getElementById('acST').value.trim();
                const cognito = idPool ? { identityPoolId: idPool, providerName: provider, domain: cogDomain, clientId: cogClient } : undefined;
                if (ak && sk) {
                    try {
                        await connectAgentCoreRelay({ arn, region, credentials: { accessKeyId: ak, secretAccessKey: sk, sessionToken: st||undefined }, cognito });
                    } catch(e) { alert('Connection failed: ' + e.message); }
                } else {
                    saveConfig({ arn, region, cognito });
                }
                M.settings.open('relay');
            });
            document.getElementById('acClear')?.addEventListener('click', () => {
                clearConfig(); M.setRelayReconnectProvider(null); M.settings.open('relay');
            });
        });
    }

    console.log('[AgentCoreRelay] Plugin loaded');
})();
