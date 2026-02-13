// AgentCore Relay Plugin for AgentMesh
// Adds SigV4 presigned WebSocket URLs with auto-renewal via Cognito credentials.
// Load AFTER agent-mesh.js. Safe to omit if AgentCore relay is not needed.
(function() {
    'use strict';
    const STORE_KEY = 'mesh_agentcore_config';
    const M = window.AgentMesh;
    if (!M) { console.warn('[AgentCoreRelay] AgentMesh not found — load agent-mesh.js first'); return; }

    // Runtime credential cache (NOT persisted to localStorage)
    const credentialCache = new Map(); // Map<relayId, {accessKeyId, secretAccessKey, sessionToken, expiration}>

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
        // SigV4 requires double-encoding the path in the canonical URI (non-S3 services)
        const canonPath = '/' + path.slice(1).split('/').map(s => _uri(s)).join('/');
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
        const canonical = `GET\n${canonPath}\n${qs}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`;
        const sts = `AWS4-HMAC-SHA256\n${amzDate}\n${ds}/${region}/${svc}/aws4_request\n${await _sha256hex(canonical)}`;
        let key = await _hmac('AWS4' + secretAccessKey, ds);
        for (const s of [region, svc, 'aws4_request']) key = await _hmac(key, s);
        const sig = [...new Uint8Array(await _hmac(key, sts))].map(b => b.toString(16).padStart(2, '0')).join('');
        return `wss://${host}${path}?${qs}&X-Amz-Signature=${sig}`;
    }

    // ═══ Config persistence (NO credentials) ═══
    function getConfig() { try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; } }
    function saveConfig(cfg) { 
        // Ensure credentials are never saved
        if (cfg.credentials) delete cfg.credentials;
        localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); 
    }
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
    async function renewAndConnect(relayId) {
        const config = M.getRelayConfig();
        const relay = config.relays.find(r => r.id === relayId);
        if (!relay || relay.type !== 'agentcore') return false;
        
        let credentials = credentialCache.get(relayId);
        
        // Check if credentials expired
        if (credentials?.expiration && new Date(credentials.expiration * 1000) < new Date()) {
            console.log(`[AgentCoreRelay] Credentials expired [${relayId}], refreshing via id_token...`);
            const cfg = getConfig();
            const fresh = await refreshCredentials(cfg);
            if (!fresh) {
                console.warn(`[AgentCoreRelay] Refresh failed [${relayId}] — re-login required`);
                M.broadcast?.('relay-auth-required', { reason: 'credentials_expired', relayId });
                return false;
            }
            credentials = fresh;
            credentialCache.set(relayId, fresh);
        }
        
        // If no credentials at all, try to vend from Cognito
        if (!credentials) {
            const cfg = getConfig();
            if (!cfg?.idToken) {
                console.warn(`[AgentCoreRelay] No idToken [${relayId}] — login required`);
                M.broadcast?.('relay-auth-required', { reason: 'no_token', relayId });
                return false;
            }
            credentials = await refreshCredentials(cfg);
            if (!credentials) {
                console.warn(`[AgentCoreRelay] Failed to vend credentials [${relayId}]`);
                return false;
            }
            credentialCache.set(relayId, credentials);
        }
        
        const url = await presignUrl(credentials.accessKeyId, credentials.secretAccessKey, credentials.sessionToken, relay.region, relay.arn);
        M.connectRelay(url, relayId);
        return true;
    }

    // ═══ Public API — extends AgentMesh ═══
    async function connectAgentCoreRelayById(relayId) {
        const config = M.getRelayConfig();
        const relay = config.relays.find(r => r.id === relayId);
        if (!relay || relay.type !== 'agentcore') return false;
        
        // Get credentials from cache or vend new ones
        let credentials = credentialCache.get(relayId);
        if (!credentials || (credentials.expiration && new Date(credentials.expiration * 1000) < new Date())) {
            const cfg = getConfig();
            if (!cfg?.idToken) {
                console.warn(`[AgentCoreRelay] No idToken for relay [${relayId}]`);
                return false;
            }
            credentials = await refreshCredentials(cfg);
            if (!credentials) return false;
            credentialCache.set(relayId, credentials);
        }
        
        M.setRelayReconnectProvider(relayId, () => renewAndConnect(relayId));
        const url = await presignUrl(credentials.accessKeyId, credentials.secretAccessKey, credentials.sessionToken, relay.region, relay.arn);
        M.connectRelay(url, relayId);
        return true;
    }

    // Legacy support
    async function connectAgentCoreRelay({ arn, region, credentials, cognito, idToken }) {
        // Save config without credentials
        saveConfig({ arn, region, cognito, idToken });
        
        // Store credentials in runtime cache with temp ID
        const tempId = 'legacy-' + Date.now();
        if (credentials) credentialCache.set(tempId, credentials);
        
        M.setRelayReconnectProvider(tempId, () => renewAndConnect(tempId));
        const url = await presignUrl(credentials.accessKeyId, credentials.secretAccessKey, credentials.sessionToken, region, arn);
        M.connectRelay(url, tempId);
    }

    // Attach to AgentMesh
    M.connectAgentCoreRelay = connectAgentCoreRelay; // Legacy
    M.connectAgentCoreRelayById = connectAgentCoreRelayById;
    M.presignAgentCoreUrl = presignUrl;
    M.getAgentCoreConfig = getConfig;
    M.clearAgentCoreConfig = () => { 
        clearConfig(); 
        credentialCache.clear();
    };

    // Auto-connect on load if we have stored AgentCore relays in config
    setTimeout(() => {
        const config = M.getRelayConfig?.();
        if (!config) return;
        
        config.relays
            .filter(r => r.type === 'agentcore' && r.enabled && r.autoConnect)
            .forEach(relay => {
                connectAgentCoreRelayById(relay.id).catch(e => 
                    console.warn(`[AgentCoreRelay] Auto-connect failed [${relay.id}]:`, e)
                );
            });
    }, 1200);


    console.log('[AgentCoreRelay] Plugin loaded');
})();
