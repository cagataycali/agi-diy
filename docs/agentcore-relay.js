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

    console.log('[AgentCoreRelay] Plugin loaded');
})();
