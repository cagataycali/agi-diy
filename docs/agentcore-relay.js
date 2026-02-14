// AgentCore Relay Plugin for AgentMesh
// Adds SigV4 presigned WebSocket URLs with auto-renewal via Cognito credentials.
// Load AFTER agent-mesh.js. Safe to omit if AgentCore relay is not needed.
(async function() {
    'use strict';
    const STORE_KEY = 'mesh_agentcore_config';
    const M = window.AgentMesh;
    if (!M) { return; }
    
    function logRelay(level, relayId, message, data) {
        if (M.logRelay) M.logRelay(level, relayId, message, data);
    }

    // Runtime credential cache (NOT persisted to localStorage)
    const credentialCache = new Map(); // Map<relayId, {accessKeyId, secretAccessKey, sessionToken, expiration}>

    // ═══ Load AWS SDK v3 SignatureV4 ═══
    let SignatureV4, Sha256;
    try {
        const [sigModule, sha256Module] = await Promise.all([
            import('https://cdn.jsdelivr.net/npm/@aws-sdk/signature-v4@3/+esm'),
            import('https://cdn.jsdelivr.net/npm/@aws-crypto/sha256-js@5/+esm')
        ]);
        SignatureV4 = sigModule.SignatureV4;
        Sha256 = sha256Module.Sha256;
    } catch (e) {
        logRelay('error', null, 'Failed to load AWS SDK', e.message);
        return;
    }

    // ═══ SigV4 Presigning using AWS SDK ═══
    async function presignUrl(accessKeyId, secretAccessKey, sessionToken, region, arn, expires = 300) {
        const signer = new SignatureV4({
            service: 'bedrock-agentcore',
            region,
            credentials: { accessKeyId, secretAccessKey, sessionToken },
            sha256: Sha256
        });

        const sid = crypto.randomUUID();
        const host = `bedrock-agentcore.${region}.amazonaws.com`;
        const path = `/runtimes/${encodeURIComponent(arn)}/ws`;

        const request = {
            method: 'GET',
            protocol: 'wss:',
            hostname: host,
            path,
            headers: {
                host,
                'X-Amzn-Bedrock-AgentCore-Runtime-Session-Id': sid
            },
            query: {}
        };

        const presigned = await signer.presign(request, { expiresIn: expires });
        
        // Build presigned URL
        const queryString = Object.entries(presigned.query || {})
            .map(([k, v]) => `${k}=${v}`)
            .join('&');
        
        return `wss://${host}${path}?${queryString}`;
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
        if (!idResp.ok) {
            const err = await idResp.text();
            console.error('GetId failed:', idResp.status, err);
            return null;
        }
        const { IdentityId } = await idResp.json();
        if (!IdentityId) return null;
        const credsResp = await fetch(base, { method: 'POST',
            headers: { ...hdrs, 'X-Amz-Target': 'AWSCognitoIdentityService.GetCredentialsForIdentity' },
            body: JSON.stringify({ IdentityId, Logins: { [providerName]: cfg.idToken } }) });
        if (!credsResp.ok) {
            const err = await credsResp.text();
            console.error('GetCredentialsForIdentity failed:', credsResp.status, err);
            return null;
        }
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
                logRelay('warn', relayId, 'Refresh failed — re-login required', null);
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
                logRelay('warn', relayId, 'No idToken — login required', null);
                M.broadcast?.('relay-auth-required', { reason: 'no_token', relayId });
                return false;
            }
            credentials = await refreshCredentials(cfg);
            if (!credentials) {
                logRelay('warn', relayId, 'Failed to vend credentials', null);
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
                logRelay('warn', relayId, 'No idToken for relay', null);
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

    // ═══ Amplify SDK Session Management ═══
    (async () => {
        try {
            const { Amplify, fetchAuthSession, signInWithRedirect } = await import('./amplify-bundle.js');
            
            // Configure Amplify with first AgentCore relay config
            const cfg = getConfig();
            if (cfg?.cognito) {
                Amplify.configure({
                    Auth: {
                        Cognito: {
                            userPoolId: cfg.cognito.providerName.split('/')[1],
                            userPoolClientId: cfg.cognito.clientId,
                            identityPoolId: cfg.cognito.identityPoolId,
                            loginWith: {
                                oauth: {
                                    domain: cfg.cognito.domain,
                                    scopes: ['openid', 'email', 'profile'],
                                    redirectSignIn: [window.location.origin + window.location.pathname],
                                    redirectSignOut: [window.location.origin + window.location.pathname],
                                    responseType: 'code'
                                }
                            }
                        }
                    }
                });
                
                // Auto-refresh session
                setInterval(async () => {
                    try {
                        const session = await fetchAuthSession();
                        if (session.tokens?.idToken) {
                            const newCfg = getConfig();
                            newCfg.idToken = session.tokens.idToken.toString();
                            saveConfig(newCfg);
                            console.log('[AgentCoreRelay] Session refreshed');
                        }
                    } catch (e) {
                        logRelay('warn', null, 'Session refresh failed', e.message);
                    }
                }, 4 * 60 * 1000); // Every 4 minutes
                
                // Reauth function with popup
                window.reauthAgentCore = async () => {
                    const cfg = getConfig();
                    if (!cfg?.cognito) {
                        alert('No Cognito configuration found. Please configure in Settings.');
                        M.settings?.open('mesh');
                        return;
                    }
                    
                    const { domain, clientId } = cfg.cognito;
                    if (!domain || !clientId) {
                        alert('Cognito domain or client ID missing');
                        return;
                    }
                    
                    const redirectUri = encodeURIComponent(location.origin + '/cognitoauth.html');
                    const state = encodeURIComponent(location.pathname);
                    const authUrl = `https://${domain}/oauth2/authorize?client_id=${clientId}&response_type=token&scope=openid+profile&redirect_uri=${redirectUri}&state=${state}`;
                    
                    const popup = window.open(authUrl, 'AgentCore Auth', 'width=500,height=700');
                    if (!popup) {
                        alert('Popup blocked. Please allow popups for this site.');
                        return;
                    }
                    
                    // Poll for popup close
                    const checkClosed = setInterval(() => {
                        if (popup.closed) {
                            clearInterval(checkClosed);
                            // Reload relay connections
                            setTimeout(() => {
                                const relays = config.relays.filter(r => r.type === 'agentcore');
                                relays.forEach(r => M.connectRelayById?.(r.id));
                            }, 500);
                        }
                    }, 500);
                };
            }
        } catch (e) {
            logRelay('error', null, 'Failed to initialize Amplify SDK', e.message);
        }
    })();

    // Auto-connect on load if we have stored AgentCore relays in config
    setTimeout(() => {
        const config = M.getRelayConfig?.();
        if (!config) return;
        
        config.relays
            .filter(r => r.type === 'agentcore' && r.enabled && r.autoConnect)
            .forEach(relay => {
                connectAgentCoreRelayById(relay.id).catch(e => {
                    logRelay('warn', relay.id, 'Auto-connect failed', e.message);
                });
            });
    }, 1200);

    console.log('[AgentCoreRelay] Plugin loaded');
})();
