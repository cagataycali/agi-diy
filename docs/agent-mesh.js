/**
 * 🌐 AgentMesh - Cross-page agent communication bridge
 * 
 * Enables:
 * - Unified navigation across all agi.diy pages
 * - BroadcastChannel for same-origin tab communication
 * - postMessage for iframe communication
 * - Cross-invoke: send prompts to agents in other views
 * 
 * Usage: Include this script in any agi.diy page
 */

(function() {
    'use strict';
    
    const MESH_VERSION = '2.0.0'; // SPA Navigation support
    const CHANNEL_NAME = 'agi-mesh';
    
    // Page detection — loaded from mesh-pages.json
    let PAGES = {};
    const _pagesReady = fetch('mesh-pages.json', {cache:'no-cache'}).then(r => r.json()).then(j => { Object.assign(PAGES, j); }).catch(() => {});
    
    // Detect current page
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    let currentPage = { id: 'unknown', label: currentPath, icon: '?', color: '#fff' };
    _pagesReady.then(() => { Object.assign(currentPage, PAGES[currentPath] || Object.values(PAGES)[0] || {}); });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // UNIFIED CREDENTIALS - Shared API keys across all tabs
    // ═══════════════════════════════════════════════════════════════════════════
    
    const CREDENTIALS_KEY = 'agi_shared_credentials';
    
    const defaultCredentials = {
        anthropic: { apiKey: '', model: 'claude-sonnet-4-20250514' },
        openai: { apiKey: '', model: 'gpt-4o' },
        bedrock: { apiKey: '', region: 'us-east-1', model: 'us.anthropic.claude-sonnet-4-20250514-v1:0' },
        google: { apiKey: '', model: 'gemini-2.0-flash' }
    };
    
    function getCredentials() {
        try {
            const stored = localStorage.getItem(CREDENTIALS_KEY);
            if (stored) {
                return { ...defaultCredentials, ...JSON.parse(stored) };
            }
            
            // Migration: Try to load from old individual keys (index.html format)
            const anthropicKey = localStorage.getItem('anthropic_api_key');
            const openaiKey = localStorage.getItem('openai_api_key');
            const bedrockKey = localStorage.getItem('bedrock_api_key');
            const googleKey = localStorage.getItem('google_api_key');
            
            if (anthropicKey || openaiKey || bedrockKey || googleKey) {
                const migrated = { ...defaultCredentials };
                if (anthropicKey) migrated.anthropic.apiKey = anthropicKey;
                if (openaiKey) migrated.openai.apiKey = openaiKey;
                if (bedrockKey) migrated.bedrock.apiKey = bedrockKey;
                if (googleKey) migrated.google.apiKey = googleKey;
                
                // Save migrated credentials
                setCredentials(migrated);
                console.log('[AgentMesh] Migrated credentials to unified storage');
                return migrated;
            }
            
            return defaultCredentials;
        } catch (e) {
            console.error('[AgentMesh] Error loading credentials:', e);
            return defaultCredentials;
        }
    }
    
    function setCredentials(credentials) {
        try {
            localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
            
            // Also update old keys for backward compatibility
            if (credentials.anthropic?.apiKey) {
                localStorage.setItem('anthropic_api_key', credentials.anthropic.apiKey);
            }
            if (credentials.openai?.apiKey) {
                localStorage.setItem('openai_api_key', credentials.openai.apiKey);
            }
            if (credentials.bedrock?.apiKey) {
                localStorage.setItem('bedrock_api_key', credentials.bedrock.apiKey);
            }
            if (credentials.google?.apiKey) {
                localStorage.setItem('google_api_key', credentials.google.apiKey);
            }
            
            // Broadcast to other tabs
            if (channel) {
                channel.postMessage({
                    type: 'credentials_updated',
                    payload: { timestamp: Date.now() },
                    source: { page: currentPage.id, tabId: getTabId() },
                    timestamp: Date.now()
                });
            }
            
            return true;
        } catch (e) {
            console.error('[AgentMesh] Error saving credentials:', e);
            return false;
        }
    }
    
    function updateCredential(provider, key, value) {
        const creds = getCredentials();
        if (!creds[provider]) creds[provider] = {};
        creds[provider][key] = value;
        return setCredentials(creds);
    }
    
    function getApiKey(provider) {
        const creds = getCredentials();
        return creds[provider]?.apiKey || '';
    }
    
    function setApiKey(provider, apiKey) {
        return updateCredential(provider, 'apiKey', apiKey);
    }
    
    // Listen for credential changes from other tabs
    window.addEventListener('storage', (e) => {
        if (e.key === CREDENTIALS_KEY) {
            console.log('[AgentMesh] Credentials updated from another tab');
            // Dispatch custom event for pages to handle
            window.dispatchEvent(new CustomEvent('agimesh:credentials', {
                detail: getCredentials()
            }));
        }
    });
    
    // ═══════════════════════════════════════════════════════════════════════════
    // BROADCAST CHANNEL - Same-origin tab communication
    // ═══════════════════════════════════════════════════════════════════════════
    
    let channel = null;
    const subscribers = new Map();
    const connectedPeers = new Map();
    
    // 🤖 Registered Agents - Track agents on this page and remote peers
    const registeredAgents = new Map();  // Local agents on this page
    const remoteAgents = new Map();      // Agents from other tabs
    
    function initBroadcastChannel() {
        if (!('BroadcastChannel' in window)) {
            console.warn('[AgentMesh] BroadcastChannel not supported');
            return;
        }
        
        channel = new BroadcastChannel(CHANNEL_NAME);
        
        channel.onmessage = (event) => {
            const { type, payload, source, timestamp } = event.data;
            
            // Track peers
            if (type === 'ping' || type === 'pong') {
                const peerKey = source.id + '-' + source.tabId;
                connectedPeers.set(peerKey, {
                    ...source,
                    lastSeen: timestamp
                });
                
                // 🤖 Track remote agents from this peer
                if (source.agents && Array.isArray(source.agents)) {
                    // Remove old agents from this peer
                    for (const [key, agent] of remoteAgents) {
                        if (agent.peerId === peerKey) {
                            remoteAgents.delete(key);
                        }
                    }
                    // Add current agents
                    for (const agent of source.agents) {
                        remoteAgents.set(`${peerKey}-${agent.agentId}`, {
                            ...agent,
                            peerId: peerKey,
                            pageId: source.id,
                            pageLabel: source.label,
                            lastSeen: timestamp
                        });
                    }
                }
                
                if (type === 'ping') {
                    // Respond with pong
                    broadcast('pong', {}, false);
                }
                
                updatePeerUI();
                return;
            }
            
            // Handle invoke requests
            if (type === 'invoke') {
                handleInvokeRequest(payload, source);
                return;
            }
            
            // Handle invoke responses
            if (type === 'invoke-response') {
                const callback = subscribers.get(`invoke-${payload.requestId}`);
                if (callback) {
                    callback(payload);
                    subscribers.delete(`invoke-${payload.requestId}`);
                }
                return;
            }
            
            // Handle ring context updates from other tabs
            if (type === 'ring-update') {
                updateRingContextUI();
                updateRingButtonState();
                return;
            }
            
            // Handle ring context clear from other tabs
            if (type === 'ring-clear') {
                updateRingContextUI();
                updateRingButtonState();
                return;
            }
            
            // Notify subscribers
            const handler = subscribers.get(type);
            if (handler) handler(payload, source);
        };
        
        // Announce presence
        broadcast('ping', {});
        
        // Periodic heartbeat
        setInterval(() => {
            broadcast('ping', {}, false);
            cleanupStalepeers();
        }, 5000);
    }
    
    function broadcast(type, payload, log = true) {
        if (!channel) return;
        
        // Include registered agents in ping/pong
        const agents = (type === 'ping' || type === 'pong') 
            ? [...registeredAgents.values()] 
            : undefined;
        
        const message = {
            type,
            payload,
            source: {
                id: currentPage.id,
                label: currentPage.label,
                tabId: getTabId(),
                url: window.location.href,
                agents: agents  // 🤖 Include agents in heartbeat
            },
            timestamp: Date.now()
        };
        
        channel.postMessage(message);
        if (log) console.log('[AgentMesh] Broadcast:', type, payload);
        
        // Bridge to relay if connected
        if (relayConnected && type !== 'ping' && type !== 'pong') {
            sendRelay({ type, from: relayInstanceId, data: payload });
        }
    }
    
    function subscribe(type, handler) {
        subscribers.set(type, handler);
    }
    
    function cleanupStalepeers() {
        const now = Date.now();
        for (const [key, peer] of connectedPeers) {
            if (now - peer.lastSeen > 15000) {
                connectedPeers.delete(key);
                // 🤖 Also remove agents from this peer
                for (const [agentKey, agent] of remoteAgents) {
                    if (agent.peerId === key) {
                        remoteAgents.delete(agentKey);
                    }
                }
            }
        }
        updatePeerUI();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🤖 AGENT REGISTRATION - Track agents on this page and remote peers
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * Register an agent on this page (broadcasts to all tabs)
     * @param {string} agentId - Unique agent identifier
     * @param {string} agentType - Type: 'browser', 'backend', 'agentcore'
     * @param {object} config - Optional config (systemPrompt preview, model, etc.)
     */
    function registerAgent(agentId, agentType, config = {}) {
        const agent = {
            agentId,
            agentType,
            systemPrompt: config.systemPrompt?.slice(0, 100) || '',
            model: config.model || '',
            status: config.status || 'idle',
            registeredAt: Date.now()
        };
        registeredAgents.set(agentId, agent);
        
        // Immediately broadcast to update other tabs
        broadcast('ping', {}, false);
        console.log(`[AgentMesh] Registered agent: ${agentId} (${agentType})`);
        return agent;
    }
    
    /**
     * Unregister an agent from this page
     * @param {string} agentId - Agent to unregister
     */
    function unregisterAgent(agentId) {
        registeredAgents.delete(agentId);
        broadcast('ping', {}, false);
        console.log(`[AgentMesh] Unregistered agent: ${agentId}`);
    }
    
    /**
     * Update agent status (idle, running, etc.)
     * @param {string} agentId - Agent to update
     * @param {string} status - New status
     */
    function updateAgentStatus(agentId, status) {
        const agent = registeredAgents.get(agentId);
        if (agent) {
            agent.status = status;
            agent.lastActivity = Date.now();
            // Don't broadcast on every status change - let heartbeat handle it
        }
    }
    
    /**
     * Get all known agents (local + remote)
     * @returns {Array} All agents in the mesh
     */
    function getAllMeshAgents() {
        const local = [...registeredAgents.values()].map(a => ({
            ...a,
            pageId: currentPage.id,
            pageLabel: currentPage.label,
            isLocal: true
        }));
        const remote = [...remoteAgents.values()].map(a => ({
            ...a,
            isLocal: false
        }));
        return [...local, ...remote];
    }
    
    /**
     * Get agents from remote tabs only
     * @returns {Array} Remote agents
     */
    function getRemoteMeshAgents() {
        return [...remoteAgents.values()];
    }
    
    /**
     * Get local registered agents
     * @returns {Array} Local agents
     */
    function getLocalAgents() {
        return [...registeredAgents.values()];
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // TAB ID - Unique identifier for this tab
    // ═══════════════════════════════════════════════════════════════════════════
    
    function getTabId() {
        let tabId = sessionStorage.getItem('mesh-tab-id');
        if (!tabId) {
            tabId = Math.random().toString(36).substring(2, 8);
            sessionStorage.setItem('mesh-tab-id', tabId);
        }
        return tabId;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // CROSS-INVOKE - Send prompts to agents in other tabs/pages
    // ═══════════════════════════════════════════════════════════════════════════
    
    function invoke(targetPageId, prompt, options = {}) {
        return new Promise((resolve, reject) => {
            const requestId = Math.random().toString(36).substring(2, 10);
            const timeout = options.timeout || 120000; // 2 min default
            
            // Set up response handler
            subscribers.set(`invoke-${requestId}`, (response) => {
                resolve(response);
            });
            
            // Timeout
            setTimeout(() => {
                if (subscribers.has(`invoke-${requestId}`)) {
                    subscribers.delete(`invoke-${requestId}`);
                    reject(new Error('Invoke timeout'));
                }
            }, timeout);
            
            // Send invoke request
            broadcast('invoke', {
                requestId,
                targetPageId,
                prompt,
                options
            });
        });
    }
    
    function handleInvokeRequest(payload, source) {
        const { requestId, targetPageId, prompt, options } = payload;
        
        // Check if this request is for us
        if (targetPageId !== 'all' && targetPageId !== currentPage.id) {
            return;
        }
        
        console.log('[AgentMesh] Invoke request from', source.label, ':', prompt);
        
        // Try to find and invoke the agent
        runLocalAgent(prompt, options)
            .then(result => {
                broadcast('invoke-response', {
                    requestId,
                    success: true,
                    result: String(result).substring(0, 10000),
                    handler: currentPage.id
                });
            })
            .catch(err => {
                broadcast('invoke-response', {
                    requestId,
                    success: false,
                    error: err.message,
                    handler: currentPage.id
                });
            });
    }
    
    async function runLocalAgent(prompt, options) {
        // Page-specific agent invocation
        // Each page exposes different agent interfaces
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Agent execution timeout'));
            }, options.timeout || 120000);
            
            try {
                if (currentPage.id === 'single') {
                    // index.html - single agent
                    if (window.runAgent) {
                        window.runAgent(prompt).then(result => {
                            clearTimeout(timeout);
                            resolve(result || 'Completed');
                        }).catch(err => {
                            clearTimeout(timeout);
                            reject(err);
                        });
                        return;
                    }
                    throw new Error('Single agent not ready');
                }
                
                if (currentPage.id === 'multi') {
                    // agi.html - multi-agent with runAgentMessage
                    if (window.runAgentMessage && window.state?.agents?.size > 0) {
                        const targetAgent = options.agentId || window.state.activeAgentId || window.state.agents.keys().next().value;
                        window.runAgentMessage(targetAgent, prompt).then(result => {
                            clearTimeout(timeout);
                            resolve(result || 'Completed');
                        }).catch(err => {
                            clearTimeout(timeout);
                            reject(err);
                        });
                        return;
                    }
                    throw new Error('Multi-agent not ready (no agents spawned)');
                }
                
                if (currentPage.id === 'unified') {
                    // mesh.html - unified multi-agent
                    const hasAgents = window.state?.browserAgents?.size > 0 || 
                                      window.state?.backendAgents?.size > 0 ||
                                      window.state?.agentcoreAgents?.size > 0;
                    
                    // Prefer runAgent-style async function (returns Promise with full response)
                    if (window.runUnifiedAgent && hasAgents) {
                        window.runUnifiedAgent(prompt).then(result => {
                            clearTimeout(timeout);
                            resolve(result || 'Completed');
                        }).catch(err => {
                            clearTimeout(timeout);
                            reject(err);
                        });
                        return;
                    }
                    
                    // Fallback: fire-and-forget sendSingle
                    if (window.sendSingle && hasAgents) {
                        const input = document.getElementById('singleInput');
                        if (input) {
                            input.value = prompt;
                            window.sendSingle();
                            clearTimeout(timeout);
                            resolve('Message sent to unified agent');
                            return;
                        }
                    }
                    throw new Error('Unified agent not ready (no agents configured)');
                }
                
                throw new Error('Unknown page type: ' + currentPage.id);
            } catch (err) {
                clearTimeout(timeout);
                reject(err);
            }
        });
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // NAVIGATION UI
    // ═══════════════════════════════════════════════════════════════════════════
    
    function injectNavigation() {
        // Create navigation bar
        const nav = document.createElement('div');
        nav.id = 'agent-mesh-nav';
        nav.innerHTML = `
            <style>
                #agent-mesh-nav {
                    position: fixed;
                    bottom: calc(140px + env(safe-area-inset-bottom));
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 4px;
                    padding: 6px;
                    background: rgba(0,0,0,0.8);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 16px;
                    z-index: 10000;
                    font-family: 'Inter', -apple-system, sans-serif;
                }
                #agent-mesh-nav .mesh-tab {
                    padding: 8px 16px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 500;
                    color: rgba(255,255,255,0.6);
                    cursor: pointer;
                    transition: all 0.2s;
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    position: relative;
                }
                #agent-mesh-nav .mesh-tab:hover {
                    color: rgba(255,255,255,0.9);
                    background: rgba(255,255,255,0.1);
                }
                #agent-mesh-nav .mesh-tab.active {
                    color: #000;
                    background: var(--tab-color, #fff);
                }
                #agent-mesh-nav .mesh-tab .peer-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #30d158;
                    position: absolute;
                    top: 6px;
                    right: 6px;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
                #agent-mesh-nav .mesh-peers {
                    padding: 4px 10px;
                    font-size: 10px;
                    color: rgba(255,255,255,0.4);
                    border-left: 1px solid rgba(255,255,255,0.1);
                    margin-left: 4px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                #agent-mesh-nav .mesh-peers .peer-count {
                    color: #30d158;
                    font-weight: 600;
                }
                @media (max-width: 600px) {
                    #agent-mesh-nav {
                        bottom: calc(130px + env(safe-area-inset-bottom));
                        padding: 4px;
                        gap: 2px;
                    }
                    #agent-mesh-nav .mesh-tab {
                        padding: 6px 10px;
                        font-size: 11px;
                    }
                    #agent-mesh-nav .mesh-tab span.label { display: none; }
                }
            </style>
            ${Object.entries(PAGES).map(([file, page]) => {
                const isActive = page.id === currentPage.id;
                const hasPeer = [...connectedPeers.values()].some(p => p.id === page.id);
                return `
                    <a href="${file}" class="mesh-tab ${isActive ? 'active' : ''}" 
                       style="--tab-color: ${page.color}"
                       title="${page.label}">
                        <span class="icon">${page.icon}</span>
                        <span class="label">${page.label}</span>
                        ${!isActive && hasPeer ? '<span class="peer-dot"></span>' : ''}
                    </a>
                `;
            }).join('')}
            <div class="mesh-peers" id="mesh-peer-count">
                <span class="peer-count">0</span> peers
            </div>
            <div class="mesh-ring-btn" id="mesh-ring-btn" onclick="AgentMesh.toggleRingPanel()" title="Toggle Ring Context">
                🔗
            </div>
        `;
        
        // Add ring button styles
        const style = document.createElement('style');
        style.textContent = `
            #agent-mesh-nav .mesh-ring-btn {
                padding: 8px 12px;
                border-radius: 12px;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.2s;
                margin-left: 4px;
                border: 1px solid rgba(255,255,255,0.1);
            }
            #agent-mesh-nav .mesh-ring-btn:hover {
                background: rgba(255,255,255,0.1);
            }
            #agent-mesh-nav .mesh-ring-btn.has-entries {
                background: rgba(48,209,88,0.2);
                border-color: rgba(48,209,88,0.3);
            }
        `;
        nav.appendChild(style);
        
        document.body.appendChild(nav);
        
        // Hide tabs for pages that don't exist on this server
        for (const [file, page] of Object.entries(PAGES)) {
            if (page.id === currentPage.id) continue;
            fetch(file, {method:'HEAD'}).then(r => {
                if (!r.ok) { const tab = nav.querySelector(`a[href="${file}"]`); if (tab) tab.style.display = 'none'; }
            }).catch(() => { const tab = nav.querySelector(`a[href="${file}"]`); if (tab) tab.style.display = 'none'; });
        }
    }
    
    function updatePeerUI() {
        const peerCountEl = document.getElementById('mesh-peer-count');
        if (peerCountEl) {
            const count = connectedPeers.size;
            peerCountEl.innerHTML = `<span class="peer-count">${count}</span> peer${count !== 1 ? 's' : ''}`;
        }
        
        // Update peer dots on tabs
        const nav = document.getElementById('agent-mesh-nav');
        if (nav) {
            for (const [file, page] of Object.entries(PAGES)) {
                if (page.id === currentPage.id) continue;
                
                const tab = nav.querySelector(`a[href="${file}"]`);
                if (!tab) continue;
                
                const hasPeer = [...connectedPeers.values()].some(p => p.id === page.id);
                let dot = tab.querySelector('.peer-dot');
                
                if (hasPeer && !dot) {
                    dot = document.createElement('span');
                    dot.className = 'peer-dot';
                    tab.appendChild(dot);
                } else if (!hasPeer && dot) {
                    dot.remove();
                }
            }
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SPA NAVIGATION - Smooth page transitions (PWA-style)
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Check if View Transitions API is supported
    const supportsViewTransitions = 'startViewTransition' in document;
    
    /**
     * Prefetch all pages in background for instant navigation
     */
    function prefetchPages() {
        Object.keys(PAGES).forEach(file => {
            if (file !== currentPath) {
                // Use link prefetch for browser-native optimization
                const link = document.createElement('link');
                link.rel = 'prefetch';
                link.href = file;
                link.as = 'document';
                document.head.appendChild(link);
                console.log(`[AgentMesh] Prefetching: ${file}`);
            }
        });
    }
    
    /**
     * Navigate to a page with smooth transition
     * Uses cross-document View Transitions when supported
     */
    async function navigateToPage(targetFile, pushState = true) {
        if (targetFile === currentPath) return;
        
        const targetPage = PAGES[targetFile];
        if (!targetPage) {
            window.location.href = targetFile;
            return;
        }
        
        console.log(`[AgentMesh] Navigating to: ${targetFile}`);
        
        // Broadcast navigation event to other tabs
        broadcast('page-change', { from: currentPath, to: targetFile });
        
        // Save any state that needs to persist
        saveNavigationState();
        
        // For cross-document View Transitions, just navigate
        // The CSS @view-transition rule handles the animation
        if (supportsViewTransitions && document.startViewTransition) {
            // Same-document transition with redirect
            document.startViewTransition(() => {
                window.location.href = targetFile;
            });
        } else {
            // Fallback: fade out then navigate
            document.body.style.opacity = '0';
            document.body.style.transition = 'opacity 0.15s ease-out';
            await new Promise(r => setTimeout(r, 150));
            window.location.href = targetFile;
        }
    }
    
    /**
     * Save state before navigation
     */
    function saveNavigationState() {
        // Save scroll position
        sessionStorage.setItem('mesh-scroll-' + currentPath, String(window.scrollY));
        
        // Save any page-specific state
        const pageState = {
            timestamp: Date.now(),
            page: currentPath
        };
        sessionStorage.setItem('mesh-nav-state', JSON.stringify(pageState));
    }
    
    /**
     * Restore state after navigation
     */
    function restoreNavigationState() {
        // Restore scroll position if coming from another mesh page
        const navState = sessionStorage.getItem('mesh-nav-state');
        if (navState) {
            try {
                const state = JSON.parse(navState);
                // Only restore if navigated recently (within 5 seconds)
                if (Date.now() - state.timestamp < 5000) {
                    // Fade in effect for pages without native view transitions
                    if (!supportsViewTransitions) {
                        document.body.style.opacity = '0';
                        requestAnimationFrame(() => {
                            document.body.style.transition = 'opacity 0.15s ease-in';
                            document.body.style.opacity = '1';
                        });
                    }
                }
            } catch (e) {}
        }
    }
    
    /**
     * Update navigation active state
     */
    function updateNavActiveState(activeFile) {
        const nav = document.getElementById('agent-mesh-nav');
        if (!nav) return;
        
        nav.querySelectorAll('.mesh-tab').forEach(tab => {
            const href = tab.getAttribute('href');
            const page = PAGES[href];
            if (page) {
                tab.classList.toggle('active', href === activeFile);
            }
        });
    }
    
    /**
     * Initialize SPA-style navigation
     */
    function initSPANavigation() {
        // Add View Transition styles for cross-document navigation
        const style = document.createElement('style');
        style.textContent = `
            /* Enable cross-document View Transitions (Chrome 126+) */
            @view-transition {
                navigation: auto;
            }
            
            /* Transition animations */
            ::view-transition-old(root) {
                animation: 0.2s ease-out both mesh-slide-out;
            }
            
            ::view-transition-new(root) {
                animation: 0.2s ease-in both mesh-slide-in;
            }
            
            @keyframes mesh-slide-out {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(-20px); }
            }
            
            @keyframes mesh-slide-in {
                from { opacity: 0; transform: translateX(20px); }
                to { opacity: 1; transform: translateX(0); }
            }
            
            /* Reduce motion for accessibility */
            @media (prefers-reduced-motion: reduce) {
                ::view-transition-old(root),
                ::view-transition-new(root) {
                    animation: none;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Intercept navigation clicks to mesh pages
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;
            
            // Skip if modifier key pressed (open in new tab)
            if (e.ctrlKey || e.metaKey || e.shiftKey) return;
            
            const href = link.getAttribute('href');
            if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('javascript:')) {
                return;
            }
            
            // Skip if explicitly marked to skip SPA
            if (link.hasAttribute('data-no-spa')) return;
            
            const targetFile = href.split('?')[0].split('#')[0];
            if (PAGES[targetFile] && targetFile !== currentPath) {
                e.preventDefault();
                navigateToPage(targetFile);
            }
        });
        
        // Restore state on page load
        restoreNavigationState();
        
        // Prefetch other pages after initial load
        if (document.readyState === 'complete') {
            setTimeout(prefetchPages, 1000);
        } else {
            window.addEventListener('load', () => setTimeout(prefetchPages, 1000));
        }
        
        console.log(`[AgentMesh] Navigation initialized (View Transitions: ${supportsViewTransitions ? '✓' : 'fallback'})`);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // POSTMESSAGE BRIDGE - For iframe communication
    // ═══════════════════════════════════════════════════════════════════════════
    
    function initPostMessageBridge() {
        window.addEventListener('message', (event) => {
            // Validate origin (same-origin or trusted origins)
            if (event.origin !== window.location.origin) {
                // Add trusted origins here if needed
                const trustedOrigins = [
                    'https://agi.diy',
                    'http://localhost:8000',
                    'http://localhost:8080',
                    'http://127.0.0.1:8000'
                ];
                if (!trustedOrigins.includes(event.origin)) {
                    return;
                }
            }
            
            const { type, payload, meshVersion } = event.data || {};
            
            if (!type || !meshVersion) return;
            
            console.log('[AgentMesh] postMessage received:', type, payload);
            
            if (type === 'mesh-invoke') {
                // Handle invoke from iframe/parent
                runLocalAgent(payload.prompt, payload.options || {})
                    .then(result => {
                        event.source.postMessage({
                            type: 'mesh-invoke-response',
                            meshVersion: MESH_VERSION,
                            payload: {
                                requestId: payload.requestId,
                                success: true,
                                result: String(result).substring(0, 10000)
                            }
                        }, event.origin);
                    })
                    .catch(err => {
                        event.source.postMessage({
                            type: 'mesh-invoke-response',
                            meshVersion: MESH_VERSION,
                            payload: {
                                requestId: payload.requestId,
                                success: false,
                                error: err.message
                            }
                        }, event.origin);
                    });
            }
        });
    }
    
    // Helper to invoke via postMessage (for iframes)
    function postMessageInvoke(targetWindow, prompt, options = {}) {
        return new Promise((resolve, reject) => {
            const requestId = Math.random().toString(36).substring(2, 10);
            const timeout = options.timeout || 120000;
            
            const handler = (event) => {
                const { type, payload, meshVersion } = event.data || {};
                if (type === 'mesh-invoke-response' && payload?.requestId === requestId) {
                    window.removeEventListener('message', handler);
                    if (payload.success) {
                        resolve(payload.result);
                    } else {
                        reject(new Error(payload.error));
                    }
                }
            };
            
            window.addEventListener('message', handler);
            
            setTimeout(() => {
                window.removeEventListener('message', handler);
                reject(new Error('postMessage invoke timeout'));
            }, timeout);
            
            targetWindow.postMessage({
                type: 'mesh-invoke',
                meshVersion: MESH_VERSION,
                payload: { requestId, prompt, options }
            }, '*');
        });
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // SHARED STATE BRIDGE - Cross-page state synchronization
    // ═══════════════════════════════════════════════════════════════════════════
    
    const SHARED_STATE_KEY = 'agi-mesh-shared';
    const RING_CONTEXT_KEY = 'agi-mesh-ring-context';
    const MAX_RING_ENTRIES = 50;
    
    function getSharedState() {
        try {
            return JSON.parse(localStorage.getItem(SHARED_STATE_KEY) || '{}');
        } catch {
            return {};
        }
    }
    
    function setSharedState(key, value) {
        const state = getSharedState();
        state[key] = value;
        state._lastUpdated = Date.now();
        state._updatedBy = currentPage.id;
        localStorage.setItem(SHARED_STATE_KEY, JSON.stringify(state));
        
        // Notify other tabs
        broadcast('state-update', { key, value });
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // RING CONTEXT - Shared across all pages
    // ═══════════════════════════════════════════════════════════════════════════
    
    function getRingContext() {
        try {
            return JSON.parse(localStorage.getItem(RING_CONTEXT_KEY) || '[]');
        } catch {
            return [];
        }
    }
    
    function addToRingContext(agentId, agentType, text, pageId = null) {
        const ring = getRingContext();
        const entry = {
            agentId,
            agentType, // 'browser', 'backend', 'agentcore'
            pageId: pageId || currentPage.id,
            text: text.length > 500 ? text.slice(0, 500) + '...' : text,
            timestamp: Date.now()
        };
        
        ring.push(entry);
        
        // Keep only last N entries
        const trimmed = ring.slice(-MAX_RING_ENTRIES);
        localStorage.setItem(RING_CONTEXT_KEY, JSON.stringify(trimmed));
        
        // Broadcast to other tabs
        broadcast('ring-update', entry, false);
        
        // Update UI if ring panel exists
        updateRingContextUI();
        
        return entry;
    }
    
    function getRingContextForAgent(excludeAgentId, maxEntries = 5) {
        const ring = getRingContext();
        const relevant = ring
            .filter(r => r.agentId !== excludeAgentId)
            .slice(-maxEntries);
        
        if (relevant.length === 0) return '';
        
        let ctx = '\n\n[Ring Context - What other agents are working on:]\n';
        for (const r of relevant) {
            ctx += `• ${r.agentId} (${r.agentType}): ${r.text.slice(0, 150)}...\n`;
        }
        return ctx;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // PEER CONTEXT INJECTION - Injects connected peers into system prompt
    // ═══════════════════════════════════════════════════════════════════════════
    
    function getPeerContextForSystemPrompt() {
        const peers = [...connectedPeers.values()];
        const allRemoteAgents = [...remoteAgents.values()];
        
        if (peers.length === 0) {
            return `
## 🌐 AgentMesh Network
- **My Page**: ${currentPage.label} (${currentPage.id})
- **Connected Peers**: None discovered yet
- **Note**: Other agi.diy tabs will auto-discover when opened

**Cross-Tab Tools Available:**
- \`invoke_mesh_agent(target, prompt)\` - Send to another tab's agent
- \`list_mesh_peers()\` - List connected tabs
- \`broadcast_mesh(message)\` - Broadcast to all tabs
`;
        }
        
        let ctx = `
## 🌐 AgentMesh Network
- **My Page**: ${currentPage.label} (${currentPage.id})
- **My Tab ID**: ${getTabId()}
- **Connected Peers**: ${peers.length}
- **Remote Agents**: ${allRemoteAgents.length}

### Active Peers:
`;
        for (const peer of peers) {
            const age = Math.round((Date.now() - peer.lastSeen) / 1000);
            ctx += `- **${peer.label}** (${peer.id}) - Tab: ${peer.tabId}, seen ${age}s ago\n`;
            
            // 🤖 Show agents from this peer
            const peerKey = peer.id + '-' + peer.tabId;
            const peerAgents = allRemoteAgents.filter(a => a.peerId === peerKey);
            if (peerAgents.length > 0) {
                for (const agent of peerAgents) {
                    const statusIcon = agent.status === 'running' ? '🔄' : '💤';
                    ctx += `  └─ ${statusIcon} **${agent.agentId}** (${agent.agentType})${agent.model ? ` - ${agent.model}` : ''}\n`;
                }
            }
        }
        
        ctx += `
### Cross-Tab Tools:
- \`invoke_mesh_agent(target, prompt)\` - Send prompt to: ${[...new Set(peers.map(p => p.id))].join(', ')}
- \`list_mesh_peers()\` - Get live peer status
- \`broadcast_mesh(message)\` - Send to ALL ${peers.length} peers
- \`add_to_ring(agentId, agentType, text)\` - Share context across all tabs
- \`get_ring_context()\` - See what other agents are doing
`;
        return ctx;
    }
    
    function getFullMeshContextForSystemPrompt(excludeAgentId = null) {
        let ctx = getPeerContextForSystemPrompt();
        
        // Add ring context too
        const ringCtx = getRingContextForAgent(excludeAgentId, 5);
        if (ringCtx) {
            ctx += ringCtx;
        }
        
        return ctx;
    }
    
    function clearRingContext() {
        localStorage.setItem(RING_CONTEXT_KEY, '[]');
        broadcast('ring-clear', {}, false);
        updateRingContextUI();
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // RING CONTEXT UI - Floating panel for any page
    // ═══════════════════════════════════════════════════════════════════════════
    
    let ringPanelVisible = false;
    
    function createRingPanel() {
        if (document.getElementById('mesh-ring-panel')) return;
        
        const panel = document.createElement('div');
        panel.id = 'mesh-ring-panel';
        panel.innerHTML = `
            <style>
                #mesh-ring-panel {
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    width: 280px;
                    max-height: 400px;
                    background: rgba(0,0,0,0.9);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    z-index: 9999;
                    font-family: 'Inter', -apple-system, sans-serif;
                    display: none;
                    flex-direction: column;
                    overflow: hidden;
                }
                #mesh-ring-panel.visible { display: flex; }
                #mesh-ring-header {
                    padding: 12px 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                #mesh-ring-title {
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    color: rgba(255,255,255,0.5);
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                #mesh-ring-title .dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    background: #30d158;
                    animation: pulse 2s infinite;
                }
                @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
                #mesh-ring-clear {
                    font-size: 10px;
                    color: rgba(255,255,255,0.4);
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                #mesh-ring-clear:hover { color: #ff453a; border-color: rgba(255,69,58,0.3); }
                #mesh-ring-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 10px;
                    max-height: 300px;
                }
                .mesh-ring-entry {
                    background: rgba(255,255,255,0.03);
                    border-radius: 8px;
                    padding: 10px;
                    margin-bottom: 8px;
                    font-size: 11px;
                }
                .mesh-ring-entry-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 4px;
                }
                .mesh-ring-entry-agent { font-weight: 500; color: #fff; }
                .mesh-ring-entry-time { color: rgba(255,255,255,0.4); font-size: 10px; }
                .mesh-ring-entry-text { color: rgba(255,255,255,0.6); line-height: 1.5; }
                .mesh-ring-entry-type {
                    font-size: 8px;
                    padding: 1px 4px;
                    border-radius: 3px;
                    margin-left: 6px;
                }
                .mesh-ring-entry-type.browser { background: rgba(0,122,255,0.2); color: #007aff; }
                .mesh-ring-entry-type.backend { background: rgba(255,149,0,0.2); color: #ff9500; }
                .mesh-ring-entry-type.agentcore { background: rgba(191,90,242,0.2); color: #bf5af2; }
                .mesh-ring-entry-page {
                    font-size: 8px;
                    color: rgba(255,255,255,0.3);
                    margin-left: 4px;
                }
                #mesh-ring-empty {
                    text-align: center;
                    color: rgba(255,255,255,0.3);
                    padding: 20px;
                    font-size: 11px;
                }
                #mesh-ring-stats {
                    padding: 8px 12px;
                    border-top: 1px solid rgba(255,255,255,0.1);
                    font-size: 10px;
                    color: rgba(255,255,255,0.4);
                    display: flex;
                    justify-content: space-between;
                }
            </style>
            <div id="mesh-ring-header">
                <div id="mesh-ring-title"><span class="dot"></span> Ring Context</div>
                <span id="mesh-ring-clear" onclick="AgentMesh.clearRing()">Clear</span>
            </div>
            <div id="mesh-ring-content">
                <div id="mesh-ring-empty">Agent activity will appear here</div>
            </div>
            <div id="mesh-ring-stats">
                <span id="mesh-ring-count">0 entries</span>
                <span id="mesh-ring-peers">0 peers</span>
            </div>
        `;
        document.body.appendChild(panel);
    }
    
    function updateRingContextUI() {
        const content = document.getElementById('mesh-ring-content');
        const countEl = document.getElementById('mesh-ring-count');
        const peersEl = document.getElementById('mesh-ring-peers');
        
        if (!content) return;
        
        const ring = getRingContext();
        
        if (ring.length === 0) {
            content.innerHTML = '<div id="mesh-ring-empty">Agent activity will appear here</div>';
        } else {
            content.innerHTML = ring.slice(-15).reverse().map(r => {
                const time = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return `<div class="mesh-ring-entry">
                    <div class="mesh-ring-entry-header">
                        <span class="mesh-ring-entry-agent">${r.agentId}</span>
                        <span class="mesh-ring-entry-type ${r.agentType}">${r.agentType}</span>
                        <span class="mesh-ring-entry-page">${r.pageId}</span>
                        <span class="mesh-ring-entry-time">${time}</span>
                    </div>
                    <div class="mesh-ring-entry-text">${r.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
                </div>`;
            }).join('');
        }
        
        if (countEl) countEl.textContent = `${ring.length} entries`;
        if (peersEl) peersEl.textContent = `${connectedPeers.size} peers`;
    }
    
    function toggleRingPanel() {
        ringPanelVisible = !ringPanelVisible;
        const panel = document.getElementById('mesh-ring-panel');
        if (panel) {
            panel.classList.toggle('visible', ringPanelVisible);
            if (ringPanelVisible) updateRingContextUI();
        }
    }
    
    function updateRingButtonState() {
        const btn = document.getElementById('mesh-ring-btn');
        if (btn) {
            const ring = getRingContext();
            btn.classList.toggle('has-entries', ring.length > 0);
            btn.title = `Ring Context (${ring.length} entries)`;
        }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // AGENT TOOLS - Expose as tools that agents can call
    // ═══════════════════════════════════════════════════════════════════════════
    
    function createMeshTools() {
        return {
            // Tool: invoke_mesh_agent - Call an agent in another tab
            invoke_mesh_agent: {
                name: 'invoke_mesh_agent',
                description: 'Invoke an agent running in another browser tab. Targets: "single" (index.html), "multi" (agi.html), "mesh" (mesh.html), or "all" for broadcast.',
                parameters: {
                    type: 'object',
                    properties: {
                        target: {
                            type: 'string',
                            description: 'Target page: "single", "multi", "unified", or "all"',
                            enum: ['single', 'multi', 'unified', 'all']
                        },
                        prompt: {
                            type: 'string',
                            description: 'The message/prompt to send to the target agent'
                        }
                    },
                    required: ['target', 'prompt']
                },
                handler: async ({ target, prompt }) => {
                    try {
                        const result = await invoke(target, prompt);
                        return { success: true, result: result.result || result, handler: result.handler };
                    } catch (err) {
                        return { success: false, error: err.message };
                    }
                }
            },
            
            // Tool: list_mesh_peers - List connected tabs/peers
            list_mesh_peers: {
                name: 'list_mesh_peers',
                description: 'List all connected agi.diy tabs/peers in the mesh network',
                parameters: { type: 'object', properties: {} },
                handler: async () => {
                    const peers = [...connectedPeers.values()];
                    return {
                        currentPage: currentPage.id,
                        tabId: getTabId(),
                        peers: peers.map(p => ({
                            id: p.id,
                            label: p.label,
                            tabId: p.tabId,
                            lastSeen: Math.round((Date.now() - p.lastSeen) / 1000) + 's ago'
                        })),
                        totalPeers: peers.length
                    };
                }
            },
            
            // Tool: broadcast_mesh - Send message to ALL connected tabs
            broadcast_mesh: {
                name: 'broadcast_mesh',
                description: 'Broadcast a message to all connected agi.diy tabs. All agents will receive and process it.',
                parameters: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                            description: 'Message to broadcast to all tabs'
                        }
                    },
                    required: ['message']
                },
                handler: async ({ message }) => {
                    broadcast('chat', { message, from: currentPage.id });
                    // Also invoke all
                    try {
                        const result = await invoke('all', message);
                        return { success: true, broadcast: true, responses: result };
                    } catch (err) {
                        return { success: true, broadcast: true, note: 'Message broadcast, but invoke failed: ' + err.message };
                    }
                }
            },
            
            // Tool: get_mesh_status - Get current mesh connection status
            get_mesh_status: {
                name: 'get_mesh_status',
                description: 'Get the current AgentMesh connection status and peer information',
                parameters: { type: 'object', properties: {} },
                handler: async () => {
                    return {
                        version: MESH_VERSION,
                        currentPage: currentPage,
                        tabId: getTabId(),
                        channelActive: channel !== null,
                        peerCount: connectedPeers.size,
                        peers: [...connectedPeers.values()].map(p => p.id + '/' + p.tabId)
                    };
                }
            },
            
            // Tool: add_to_ring - Add entry to shared ring context
            add_to_ring: {
                name: 'add_to_ring',
                description: 'Add an entry to the shared ring context. All pages will see this. Use to share agent work/findings.',
                parameters: {
                    type: 'object',
                    properties: {
                        agentId: {
                            type: 'string',
                            description: 'ID of the agent adding this entry'
                        },
                        agentType: {
                            type: 'string',
                            description: 'Type: "browser", "backend", or "agentcore"',
                            enum: ['browser', 'backend', 'agentcore']
                        },
                        text: {
                            type: 'string',
                            description: 'The content/finding to share (max 500 chars)'
                        }
                    },
                    required: ['agentId', 'agentType', 'text']
                },
                handler: async ({ agentId, agentType, text }) => {
                    const entry = addToRingContext(agentId, agentType, text);
                    return { success: true, entry, totalEntries: getRingContext().length };
                }
            },
            
            // Tool: get_ring_context - Get shared ring context
            get_ring_context: {
                name: 'get_ring_context',
                description: 'Get the shared ring context - what other agents across all tabs are working on.',
                parameters: {
                    type: 'object',
                    properties: {
                        excludeAgentId: {
                            type: 'string',
                            description: 'Optional: exclude entries from this agent'
                        },
                        maxEntries: {
                            type: 'number',
                            description: 'Maximum entries to return (default: 10)'
                        }
                    }
                },
                handler: async ({ excludeAgentId, maxEntries = 10 } = {}) => {
                    const ring = getRingContext();
                    let filtered = excludeAgentId 
                        ? ring.filter(r => r.agentId !== excludeAgentId)
                        : ring;
                    filtered = filtered.slice(-maxEntries);
                    return {
                        entries: filtered,
                        totalCount: ring.length,
                        contextString: getRingContextForAgent(excludeAgentId, maxEntries)
                    };
                }
            },
            
            // Tool: clear_ring_context - Clear shared ring context
            clear_ring_context: {
                name: 'clear_ring_context',
                description: 'Clear all entries from the shared ring context across all tabs.',
                parameters: { type: 'object', properties: {} },
                handler: async () => {
                    clearRingContext();
                    return { success: true, message: 'Ring context cleared on all tabs' };
                }
            }
        };
    }
    
    // Convert JSON Schema parameters to Zod schema for Strands SDK compatibility
    function jsonSchemaToZod(params) {
        if (!window.z) {
            console.warn('[AgentMesh] Zod (z) not available, skipping tool registration');
            return null;
        }
        
        const z = window.z;
        const props = params.properties || {};
        const required = params.required || [];
        const schemaObj = {};
        
        for (const [key, prop] of Object.entries(props)) {
            let zodType;
            
            if (prop.enum) {
                zodType = z.enum(prop.enum);
            } else {
                switch (prop.type) {
                    case 'number':
                    case 'integer':
                        zodType = z.number();
                        break;
                    case 'boolean':
                        zodType = z.boolean();
                        break;
                    case 'array':
                        zodType = z.array(z.any());
                        break;
                    case 'object':
                        zodType = z.object({}).passthrough();
                        break;
                    default:
                        zodType = z.string();
                }
            }
            
            if (prop.description) {
                zodType = zodType.describe(prop.description);
            }
            
            if (!required.includes(key)) {
                zodType = zodType.optional();
            }
            
            schemaObj[key] = zodType;
        }
        
        return z.object(schemaObj);
    }
    
    // Create a Strands-compatible tool from mesh tool definition
    function createStrandsTool(meshTool) {
        if (!window.tool) {
            console.warn('[AgentMesh] Strands tool() function not available');
            return null;
        }
        
        const inputSchema = jsonSchemaToZod(meshTool.parameters);
        if (!inputSchema) return null;
        
        return window.tool({
            name: meshTool.name,
            description: meshTool.description,
            inputSchema: inputSchema,
            callback: meshTool.handler
        });
    }
    
    // Register tools with each page's tool system
    function registerMeshTools() {
        const tools = createMeshTools();
        let registered = false;
        
        // Check if Strands SDK's tool() and z (Zod) are available
        if (!window.tool || !window.z) {
            console.log('[AgentMesh] ⏳ Waiting for Strands SDK (tool, z)...');
            return false;
        }
        
        // For index.html - uses BROWSER_TOOLS array
        if (currentPage.id === 'single' && window.BROWSER_TOOLS) {
            for (const [name, meshTool] of Object.entries(tools)) {
                // Check if tool already exists (with null safety)
                if (!window.BROWSER_TOOLS.find(t => t && t.name === name)) {
                    const strandsTool = createStrandsTool(meshTool);
                    if (strandsTool) {
                        window.BROWSER_TOOLS.push(strandsTool);
                    }
                }
            }
            registered = true;
            // Trigger agent reinitialization to pick up new tools
            window._agentNeedsReinit = true;
            // Also try to reinitialize immediately if function available
            if (typeof window.initializeAgent === 'function') {
                setTimeout(() => window.initializeAgent(), 100);
            }
            console.log('[AgentMesh] ✅ Registered mesh tools with single agent (BROWSER_TOOLS)');
        }
        
        // For agi.html - uses TOOLS array
        if (currentPage.id === 'multi' && window.TOOLS) {
            for (const [name, meshTool] of Object.entries(tools)) {
                if (!window.TOOLS.find(t => t && t.name === name)) {
                    const strandsTool = createStrandsTool(meshTool);
                    if (strandsTool) {
                        window.TOOLS.push(strandsTool);
                    }
                }
            }
            registered = true;
            console.log('[AgentMesh] ✅ Registered mesh tools with multi-agent (TOOLS)');
        }
        
        // For mesh.html - uses BROWSER_TOOLS
        if (currentPage.id === 'mesh' && window.BROWSER_TOOLS) {
            for (const [name, meshTool] of Object.entries(tools)) {
                if (!window.BROWSER_TOOLS.find(t => t && t.name === name)) {
                    const strandsTool = createStrandsTool(meshTool);
                    if (strandsTool) {
                        window.BROWSER_TOOLS.push(strandsTool);
                    }
                }
            }
            registered = true;
            console.log('[AgentMesh] ✅ Registered mesh tools with unified agent (BROWSER_TOOLS)');
        }
        
        // Make tools globally available for all pages
        window.MeshTools = tools;
        
        if (!registered) {
            console.log('[AgentMesh] ⏳ Tools not registered yet, will retry...');
        }
        
        return registered;
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // RELAY CONFIGURATION
    // ═══════════════════════════════════════════════════════════════════════════
    
    const RELAY_CONFIG_KEY = 'agi_mesh_relay_config';
    
    function getRelayConfig() {
        try {
            const stored = localStorage.getItem(RELAY_CONFIG_KEY);
            if (stored) return JSON.parse(stored);
        } catch (e) { console.error('[AgentMesh] Error loading relay config:', e); }
        return { relays: [] };
    }
    
    function saveRelayConfig(config) {
        try {
            localStorage.setItem(RELAY_CONFIG_KEY, JSON.stringify(config));
            broadcast('relay-config-updated', config);
            return true;
        } catch (e) {
            console.error('[AgentMesh] Error saving relay config:', e);
            return false;
        }
    }
    
    function addRelay(relay) {
        const config = getRelayConfig();
        if (!relay.id) relay.id = `relay-${Date.now()}`;
        config.relays.push(relay);
        saveRelayConfig(config);
        return relay.id;
    }
    
    function updateRelay(id, updates) {
        const config = getRelayConfig();
        const relay = config.relays.find(r => r.id === id);
        if (relay) {
            Object.assign(relay, updates);
            saveRelayConfig(config);
            return true;
        }
        return false;
    }
    
    function deleteRelay(id) {
        const config = getRelayConfig();
        config.relays = config.relays.filter(r => r.id !== id);
        saveRelayConfig(config);
        disconnectRelayById(id);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WEBSOCKET RELAY - Multi-connection support
    // ═══════════════════════════════════════════════════════════════════════════
    
    const relayConnections = new Map(); // Map<relayId, {ws, connected, heartbeat, reconnectTimer}>
    const relayReconnectProviders = new Map(); // Map<relayId, reconnectFn>
    const relayInstanceId = localStorage.getItem('mesh_instance_id') || (() => {
        const id = `agi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,6)}`;
        localStorage.setItem('mesh_instance_id', id);
        return id;
    })();
    const remotePeers = new Map();

    function connectRelay(url, relayId) {
        if (!relayId) relayId = `temp-${Date.now()}`;
        disconnectRelayById(relayId);
        try {
            const ws = new WebSocket(url);
            const conn = { ws, connected: false, heartbeat: null, reconnectTimer: null };
            relayConnections.set(relayId, conn);
            
            ws.onopen = () => {
                conn.connected = true;
                console.log(`[AgentMesh] 🌐 Relay connected [${relayId}]:`, url);
                sendRelayPresence(relayId);
                conn.heartbeat = setInterval(() => {
                    if (!conn.connected) return;
                    sendRelayPresence(relayId);
                    const now = Date.now();
                    for (const [id, peer] of remotePeers) {
                        if (now - peer.lastSeen > 30000) remotePeers.delete(id);
                    }
                }, 10000);
                broadcast('relay-connected', { relayId, url });
                const handler = subscribers.get('relay-status');
                if (handler) handler({ connected: true, url, relayId });
            };
            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data);
                    if (msg.from === relayInstanceId) return;
                    handleRelayMessage(msg, relayId);
                } catch (err) { console.warn(`[AgentMesh] Invalid relay message [${relayId}]:`, err); }
            };
            ws.onclose = () => {
                conn.connected = false;
                if (conn.heartbeat) { clearInterval(conn.heartbeat); conn.heartbeat = null; }
                console.log(`[AgentMesh] 🌐 Relay disconnected [${relayId}]`);
                broadcast('relay-disconnected', { relayId });
                const handler = subscribers.get('relay-status');
                if (handler) handler({ connected: false, url, relayId });
                // Auto-reconnect if provider exists
                const provider = relayReconnectProviders.get(relayId);
                if (provider && !conn.reconnectTimer) {
                    conn.reconnectTimer = setTimeout(async () => {
                        conn.reconnectTimer = null;
                        console.log(`[AgentMesh] 🔄 Relay reconnect [${relayId}]...`);
                        try { await provider(); } catch (e) { console.warn(`[AgentMesh] Reconnect failed [${relayId}]:`, e); }
                    }, 3000);
                }
            };
            ws.onerror = (err) => console.error(`[AgentMesh] Relay error [${relayId}]:`, err);
        } catch (err) { console.error(`[AgentMesh] Failed to connect relay [${relayId}]:`, err); }
    }

    function disconnectRelayById(relayId) {
        const conn = relayConnections.get(relayId);
        if (!conn) return;
        if (conn.reconnectTimer) { clearTimeout(conn.reconnectTimer); conn.reconnectTimer = null; }
        if (conn.ws) { conn.ws.close(); conn.ws = null; }
        if (conn.heartbeat) { clearInterval(conn.heartbeat); conn.heartbeat = null; }
        relayConnections.delete(relayId);
        relayReconnectProviders.delete(relayId);
        broadcast('relay-disconnected', { relayId });
    }
    
    function disconnectRelay() {
        // Legacy: disconnect all
        for (const relayId of relayConnections.keys()) {
            disconnectRelayById(relayId);
        }
        remotePeers.clear();
    }

    function sendRelay(msg, relayId) {
        if (relayId) {
            const conn = relayConnections.get(relayId);
            if (conn?.ws && conn.connected) conn.ws.send(JSON.stringify(msg));
        } else {
            // Broadcast to all connected relays
            for (const conn of relayConnections.values()) {
                if (conn.ws && conn.connected) conn.ws.send(JSON.stringify(msg));
            }
        }
    }

    function sendRelayPresence(relayId) {
        sendRelay({
            type: 'presence',
            from: relayInstanceId,
            data: {
                agents: [...registeredAgents.keys()],
                hostname: location.hostname,
                pageId: currentPage.id,
                timestamp: Date.now()
            }
        }, relayId);
    }

    function handleRelayMessage(msg, relayId) {
        const { type, from, data } = msg;
        if (type === 'presence' || type === 'heartbeat') {
            remotePeers.set(from, { agents: data?.agents || [], hostname: data?.hostname, lastSeen: Date.now(), relayId });
            // Register remote agents
            if (data?.agents) {
                for (const agentId of data.agents) {
                    if (!remoteAgents.has(agentId)) {
                        remoteAgents.set(agentId, { agentId, agentType: 'remote', peerId: from, status: 'idle' });
                    }
                }
            }
            const handler = subscribers.get('relay-peers');
            if (handler) handler({ peers: [...remotePeers.values()] });
            return;
        }
        // Bridge relay messages to local subscribers
        const handler = subscribers.get(type);
        if (handler) handler(data, { id: from, remote: true });
        // Also bridge to BroadcastChannel for local tabs
        if (type === 'invoke' || type === 'broadcast' || type === 'ring-update') {
            broadcast(type, data, false);
        }
    }
    
    function connectRelayById(relayId) {
        const config = getRelayConfig();
        const relay = config.relays.find(r => r.id === relayId);
        if (!relay || !relay.enabled) return false;
        
        if (relay.type === 'websocket') {
            connectRelay(relay.url, relayId);
            return true;
        } else if (relay.type === 'agentcore') {
            // Delegate to agentcore-relay.js plugin
            if (window.AgentMesh.connectAgentCoreRelayById) {
                window.AgentMesh.connectAgentCoreRelayById(relayId);
                return true;
            }
        }
        return false;
    }

    // Auto-connect configured relays on init
    function autoConnectConfiguredRelays() {
        const config = getRelayConfig();
        config.relays
            .filter(r => r.enabled && r.autoConnect)
            .forEach(relay => {
                setTimeout(() => connectRelayById(relay.id), 1000);
            });
    }
    
    // Migration from old config
    function migrateRelayConfig() {
        // Migrate old mesh_relay_url
        const oldUrl = localStorage.getItem('mesh_relay_url');
        if (oldUrl) {
            const config = getRelayConfig();
            if (!config.relays.find(r => r.url === oldUrl)) {
                config.relays.push({
                    id: 'migrated-' + Date.now(),
                    type: 'websocket',
                    url: oldUrl,
                    enabled: true,
                    autoConnect: true
                });
                saveRelayConfig(config);
                console.log('[AgentMesh] Migrated mesh_relay_url to relay config');
            }
            localStorage.removeItem('mesh_relay_url');
        }

        // Migrate AgentCore config, REMOVE credentials
        const oldAC = localStorage.getItem('mesh_agentcore_config');
        if (oldAC) {
            try {
                const ac = JSON.parse(oldAC);
                if (ac.credentials) {
                    delete ac.credentials;
                    localStorage.setItem('mesh_agentcore_config', JSON.stringify(ac));
                    console.log('[AgentMesh] Cleared stored AWS credentials - will re-vend from Cognito');
                }
                // Migrate to relay config if has arn
                if (ac.arn) {
                    const config = getRelayConfig();
                    if (!config.relays.find(r => r.type === 'agentcore' && r.arn === ac.arn)) {
                        config.relays.push({
                            id: 'agentcore-' + Date.now(),
                            type: 'agentcore',
                            arn: ac.arn,
                            region: ac.region,
                            cognito: ac.cognito,
                            enabled: true,
                            autoConnect: true
                        });
                        saveRelayConfig(config);
                        console.log('[AgentMesh] Migrated AgentCore config to relay config');
                    }
                }
            } catch (e) { console.error('[AgentMesh] Migration error:', e); }
        }
    }

    // Auto-connect saved relay on init (legacy support)
    function autoConnectRelay() {
        migrateRelayConfig();
        autoConnectConfiguredRelays();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PUBLIC API
    // ═══════════════════════════════════════════════════════════════════════════
    
    window.AgentMesh = {
        version: MESH_VERSION,
        currentPage,
        pages: PAGES,
        
        // Communication
        broadcast,
        subscribe,
        invoke,
        postMessageInvoke,
        
        // State
        getSharedState,
        setSharedState,
        
        // 🔑 Unified Credentials (shared across all tabs)
        getCredentials,
        setCredentials,
        updateCredential,
        getApiKey,
        setApiKey,
        
        // Ring Context (shared across all pages)
        getRingContext,
        addToRingContext,
        getRingContextForAgent,
        clearRing: clearRingContext,
        toggleRingPanel,
        
        // Peers
        getPeers: () => [...connectedPeers.values()],
        
        // 🌐 WebSocket Relay
        getRelayConfig,
        saveRelayConfig,
        addRelay,
        updateRelay,
        deleteRelay,
        connectRelay,
        connectRelayById,
        disconnectRelay,
        disconnectRelayById,
        sendRelay,
        setRelayReconnectProvider: (relayId, fn) => { relayReconnectProviders.set(relayId, fn); },
        get relayConnected() { return relayConnections.size > 0 && [...relayConnections.values()].some(c => c.connected); },
        getRelayPeers: () => [...remotePeers.values()],
        getRelayConnections: () => Array.from(relayConnections.entries()).map(([id, conn]) => ({ id, connected: conn.connected })),
        relayInstanceId,
        
        // 🤖 Agent Registration (track agents across tabs)
        registerAgent,
        unregisterAgent,
        updateAgentStatus,
        getAllMeshAgents,
        getRemoteMeshAgents,
        getLocalAgents,
        
        // 🌐 Peer Context Injection - for system prompts
        getPeerContext: getPeerContextForSystemPrompt,
        getFullMeshContext: getFullMeshContextForSystemPrompt,
        
        // Navigation (SPA-style)
        navigateTo: (pageId) => {
            const entry = Object.entries(PAGES).find(([_, p]) => p.id === pageId);
            if (entry) navigateToPage(entry[0]);
        },
        navigateToPage, // Direct page navigation
        prefetchPages, // Manually trigger prefetch
        
        // Tools (callable by agents)
        tools: createMeshTools(),
        registerTools: registerMeshTools,
        
        // Direct tool invocation helpers
        invokeMeshAgent: async (target, prompt) => {
            return createMeshTools().invoke_mesh_agent.handler({ target, prompt });
        },
        listMeshPeers: async () => {
            return createMeshTools().list_mesh_peers.handler({});
        },
        broadcastMesh: async (message) => {
            return createMeshTools().broadcast_mesh.handler({ message });
        },
        getMeshStatus: async () => {
            return createMeshTools().get_mesh_status.handler({});
        },
        // Ring context helpers
        addToRing: async (agentId, agentType, text) => {
            return createMeshTools().add_to_ring.handler({ agentId, agentType, text });
        },
        getRing: async (excludeAgentId, maxEntries) => {
            return createMeshTools().get_ring_context.handler({ excludeAgentId, maxEntries });
        }
    };
    
    // ═══════════════════════════════════════════════════════════════════════════
    // INIT
    // ═══════════════════════════════════════════════════════════════════════════
    
    function init() {
        console.log(`%c🕸️ mesh v${MESH_VERSION}`, 'font-size:14px;font-weight:bold;color:#ff9500');
        console.log(`Page: ${currentPage.label} (${currentPage.id})`);
        
        initBroadcastChannel();
        initPostMessageBridge();
        initSPANavigation();
        autoConnectRelay();
        
        // Inject nav after DOM ready + pages loaded
        const _initNav = () => _pagesReady.then(() => {
            currentPage = PAGES[currentPath] || Object.values(PAGES)[0] || { id: 'unknown', label: currentPath, icon: '?', color: '#fff' };
            injectNavigation();
            createRingPanel();
            updateRingButtonState();
            setTimeout(registerMeshTools, 500);
        });
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', _initNav);
        } else {
            _initNav();
        }
        
        // Also try to register tools periodically until successful
        let retries = 0;
        const toolsInterval = setInterval(() => {
            retries++;
            const hasTools = window.TOOLS || window.BROWSER_TOOLS;
            if (hasTools) {
                const success = registerMeshTools();
                if (success) {
                    clearInterval(toolsInterval);
                    console.log('[AgentMesh] Tools registration complete');
                }
            }
            if (retries > 20) {
                clearInterval(toolsInterval);
                console.warn('[AgentMesh] Gave up waiting for TOOLS array');
            }
        }, 500);
        
        // Update ring button state when storage changes (cross-tab sync)
        window.addEventListener('storage', (e) => {
            if (e.key === RING_CONTEXT_KEY) {
                updateRingContextUI();
                updateRingButtonState();
            }
        });
    }
    
    init();
})();
