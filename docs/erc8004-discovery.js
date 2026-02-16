// ERC-8004 Discovery Plugin for AgentMesh
// Read-only on-chain agent discovery — no wallet needed.
// Load AFTER agent-mesh.js. Safe to omit if on-chain discovery not needed.
// Spec: https://eips.ethereum.org/EIPS/eip-8004
import { KeccakHasher } from 'https://cdn.jsdelivr.net/npm/@adraffy/keccak@1.0.4/+esm';
const keccak256 = data => KeccakHasher.unpadded().update(data).finalize().output;

const M = window.AgentMesh;
if (!M) console.warn('[ERC8004] AgentMesh not found');

// ═══ Logging ═══
const erc8004Logs = [];
function logERC8004(level, chain, message, data) {
    const entry = { time: Date.now(), level, chain, message, data };
    erc8004Logs.push(entry);
    if (erc8004Logs.length > 100) erc8004Logs.shift();
    if (M?.broadcast) M.broadcast('erc8004-log', entry);
}
window.getERC8004Logs = () => [...erc8004Logs];

// Blocked domains - won't attempt to fetch from these
const BLOCKED_DOMAINS = ['example.com', 'example.org', 'localhost'];

function isBlockedUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    
    // Check blocked domains
    if (BLOCKED_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))) {
      return true;
    }
    
    // Check RFC1918 private IP ranges
    const ipMatch = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (ipMatch) {
      const [, a, b, c, d] = ipMatch.map(Number);
      if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
        return true;
      }
    }
    
    return false;
  } catch {
    return false;
  }
}

// IPFS gateway — off by default
let ipfsGateway = localStorage.getItem('erc8004_ipfs_gateway') || '';

// ═══ Trusted Owners ═══
// localStorage stores: { "0xaddr": { label, chains, enabled, source } }
const OWNERS_KEY = 'erc8004_owners';
let ownersMap = JSON.parse(localStorage.getItem(OWNERS_KEY) || '{}');
function saveOwners() { localStorage.setItem(OWNERS_KEY, JSON.stringify(ownersMap)); }

// Load defaults from trusted-owners.json (won't overwrite user changes)
fetch('trusted-owners.json', { cache: 'no-cache' }).then(r => r.json()).then(list => {
    for (const o of list) {
        const addr = o.address.toLowerCase();
        if (!ownersMap[addr]) ownersMap[addr] = { label: o.label, chains: o.chains, enabled: true, source: 'default' };
    }
    saveOwners();
}).catch(() => {});

// ═══ Contract addresses (CREATE2 vanity — same on all chains) ═══
const MAINNET = { identity: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432', reputation: '0x8004BAa17C55a88189AE136b182e5fdA19dE9b63' };
const TESTNET = { identity: '0x8004A818BFB912233c491871b3d84c89A494BD9e', reputation: '0x8004B663056A597Dffe9eCcC1965A193B7388713' };

const CHAINS = {
    ethereum:  { rpc: 'https://ethereum-rpc.publicnode.com', ...MAINNET },
    base:      { rpc: 'https://base-rpc.publicnode.com', ...MAINNET },
    polygon:   { rpc: 'https://polygon-bor-rpc.publicnode.com', ...MAINNET },
    arbitrum:  { rpc: 'https://arbitrum-one-rpc.publicnode.com', ...MAINNET },
    optimism:  { rpc: 'https://optimism-rpc.publicnode.com', ...MAINNET },
    celo:      { rpc: 'https://celo-rpc.publicnode.com', ...MAINNET },
    gnosis:    { rpc: 'https://gnosis-rpc.publicnode.com', ...MAINNET },
    scroll:    { rpc: 'https://scroll-rpc.publicnode.com', ...MAINNET },
    bsc:       { rpc: 'https://bsc-rpc.publicnode.com', ...MAINNET },
    sepolia:          { rpc: 'https://ethereum-sepolia-rpc.publicnode.com', ...TESTNET },
    base_sepolia:     { rpc: 'https://base-sepolia-rpc.publicnode.com', ...TESTNET },
    arbitrum_sepolia: { rpc: 'https://arbitrum-sepolia-rpc.publicnode.com', ...TESTNET },
    bsc_testnet:      { rpc: 'https://bsc-testnet-rpc.publicnode.com', ...TESTNET },
};

// ═══ ABI helpers ═══
const pad32 = v => v.padStart(64, '0');
const encUint = n => pad32(BigInt(n).toString(16));
const decAddr = hex => '0x' + hex.slice(24);
const decStr = hex => {
    const off = parseInt(hex.slice(0, 64), 16) * 2;
    const len = parseInt(hex.slice(off, off + 64), 16);
    const raw = hex.slice(off + 64, off + 64 + len * 2);
    let s = ''; for (let i = 0; i < raw.length; i += 2) s += String.fromCharCode(parseInt(raw.substr(i, 2), 16));
    return s;
};

// Function selectors (keccak256 first 4 bytes)
const SEL = { ownerOf: '0x6352211e', tokenURI: '0xc87b56dd', getAgentWallet: '0x00339509' };
// Registered(uint256 indexed agentId, address indexed owner, string agentURI)
const REGISTERED_TOPIC = '0xc118700a4fa70d79a8f1df06b1d2ff9aeaf09bdc4c528a45ddd5182856864594';

// ═══ JSON-RPC ═══
let rpcId = 0;
async function rpc(chain, method, params) {
    const cfg = CHAINS[chain];
    if (!cfg) throw new Error(`Unknown chain: ${chain}`);
    const resp = await fetch(cfg.rpc, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params })
    });
    const json = await resp.json();
    if (json.error) throw new Error(json.error.message);
    return json.result;
}

async function ethCall(chain, to, data) {
    return rpc(chain, 'eth_call', [{ to, data }, 'latest']);
}

// ═══ Core discovery ═══

export async function getAgent(chain, agentId) {
    const id = CHAINS[chain]?.identity;
    if (!id) throw new Error(`Unknown chain: ${chain}`);
    const callData = encUint(agentId);

    let owner;
    try { owner = decAddr((await ethCall(chain, id, SEL.ownerOf + callData)).slice(2)); }
    catch { return null; }

    let uri = '';
    try { uri = decStr((await ethCall(chain, id, SEL.tokenURI + callData)).slice(2)); } catch {}

    let wallet = null;
    try {
        const w = decAddr((await ethCall(chain, id, SEL.getAgentWallet + callData)).slice(2));
        if (w !== '0x0000000000000000000000000000000000000000') wallet = w;
    } catch {}

    const agent = { agentId, owner, uri, wallet, chain, fetchStatus: 'pending', fetchError: null };

    // Fetch registration file (data: and https: auto; ipfs:// requires opt-in)
    if (uri) {
        try {
            if (uri.startsWith('data:')) {
                agent.registration = JSON.parse(atob(uri.split(',')[1]));
                agent.fetchStatus = 'success';
            } else if (uri.startsWith('https://')) {
                if (isBlockedUrl(uri)) {
                    agent.fetchStatus = 'blocked';
                    agent.fetchError = 'Blocked domain or private IP';
                } else {
                    agent.registration = await (await fetch(uri)).json();
                    agent.fetchStatus = 'success';
                }
            } else if (uri.startsWith('ipfs://')) {
                if (ipfsGateway) {
                    agent.registration = await (await fetch(ipfsGateway + uri.slice(7))).json();
                    agent.fetchStatus = 'success';
                } else {
                    agent.fetchStatus = 'no-gateway';
                    agent.fetchError = 'IPFS gateway not configured';
                }
            } else {
                agent.fetchStatus = 'unsupported';
                agent.fetchError = 'Unsupported URI scheme';
            }
        } catch (e) {
            agent.fetchStatus = 'error';
            agent.fetchError = e.message.includes('CORS') ? 'CORS error' : e.message;
        }
    } else {
        agent.fetchStatus = 'no-uri';
    }
    return agent;
}

export async function discoverAgents(chain, maxAgents = 50) {
    // Get agent IDs from event logs
    const id = CHAINS[chain]?.identity;
    if (!id) throw new Error(`Unknown chain: ${chain}`);

    const logs = await rpc(chain, 'eth_getLogs', [{ 
        fromBlock: '0x0', 
        toBlock: 'latest', 
        address: id, 
        topics: [REGISTERED_TOPIC] 
    }]);
    const agentIds = [...new Set(logs.map(l => parseInt(l.topics[1], 16)))].slice(-maxAgents);

    const agents = [];
    const enabled = Object.keys(ownersMap).filter(a => ownersMap[a].enabled);
    const ownerSet = enabled.length ? new Set(enabled) : null;
    for (const aid of agentIds) {
        const a = await getAgent(chain, aid);
        if (a && (!ownerSet || ownerSet.has(a.owner?.toLowerCase()))) agents.push(a);
    }
    
    // Store in AgentMesh for widget access
    if (M?.erc8004) {
        M.erc8004.discoveredAgents = agents;
    }
    
    return agents;
}

export async function totalAgents(chain) {
    const id = CHAINS[chain]?.identity;
    if (!id) throw new Error(`Unknown chain: ${chain}`);
    try {
        const logs = await rpc(chain, 'eth_getLogs', [{ fromBlock: '0x0', toBlock: 'latest', address: id, topics: [REGISTERED_TOPIC] }]);
        return new Set(logs.map(l => l.topics[1])).size;
    } catch {
        let total = 0, misses = 0;
        for (let i = 0; misses <= 5; i++) {
            try { await ethCall(chain, id, SEL.ownerOf + encUint(i)); total = i + 1; misses = 0; }
            catch { misses++; }
        }
        return total;
    }
}

// ═══ Utility: compute selector from signature ═══
export function selector(sig) {
    const hash = keccak256(new TextEncoder().encode(sig));
    return '0x' + [...hash.slice(0, 4)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// ═══ Attach to AgentMesh ═══
if (M) {
    M.erc8004 = {
        chains: Object.keys(CHAINS), CHAINS,
        getAgent, discoverAgents, totalAgents, selector,
        get ipfsGateway() { return ipfsGateway; },
        setIpfsGateway(url) { ipfsGateway = url || ''; localStorage.setItem('erc8004_ipfs_gateway', ipfsGateway); },
        get owners() { return ownersMap; },
        setOwnerEnabled(addr, on) { const k = addr.toLowerCase(); if (ownersMap[k]) { ownersMap[k].enabled = on; saveOwners(); } },
        addOwner(addr, label, chains) { ownersMap[addr.toLowerCase()] = { label, chains: chains || [], enabled: true, source: 'user' }; saveOwners(); },
        removeOwner(addr) { delete ownersMap[addr.toLowerCase()]; saveOwners(); },
        async syncChain(chain) {
            console.log(`[ERC8004] Discovering agents on ${chain}...`);
            const agents = await discoverAgents(chain);
            for (const a of agents) {
                const name = a.registration?.name || `erc8004-${chain}-${a.agentId}`;
                M.registerAgent?.(name, 'erc8004', {
                    chain, agentId: a.agentId, owner: a.owner,
                    uri: a.uri, wallet: a.wallet,
                    services: a.registration?.services,
                });
            }
            console.log(`[ERC8004] Found ${agents.length} agent(s) on ${chain}`);
            return agents;
        }
    };

    // ═══ Register settings tabs ═══
    if (M.settings) {
        M.settings.registerTab('erc8004', 'ERC-8004', body => {
            const owners = ownersMap;
            let html = '<div style="margin-bottom:12px;color:var(--text-dim)">Trusted Owners — only agents from enabled owners are discovered</div>';
            for (const [addr, o] of Object.entries(owners)) {
                html += `<div class="ms-row">
                    <input type="checkbox" ${o.enabled?'checked':''} data-addr="${addr}" class="erc-owner-toggle">
                    <span style="font-size:11px;min-width:80px">${o.label||'Unknown'}</span>
                    <span class="ms-addr" title="${addr}">${addr.slice(0,6)}…${addr.slice(-4)}</span>
                    <span class="ms-hint">${(o.chains||[]).join(', ')}</span>
                    ${o.source==='user'?`<button class="ms-btn danger" data-addr="${addr}" data-action="remove">✕</button>`:''}
                </div>`;
            }
            html += `<div style="margin-top:12px;display:flex;gap:6px">
                <input type="text" id="ercNewAddr" placeholder="0x… address" style="flex:2">
                <input type="text" id="ercNewLabel" placeholder="Label" style="flex:1">
                <input type="text" id="ercNewChains" placeholder="sepolia,base" style="flex:1">
                <button class="ms-btn" id="ercAddBtn">Add</button>
            </div>`;
            body.innerHTML = html;
            body.querySelectorAll('.erc-owner-toggle').forEach(cb => cb.onchange = () => {
                M.erc8004.setOwnerEnabled(cb.dataset.addr, cb.checked);
            });
            body.querySelectorAll('[data-action="remove"]').forEach(btn => btn.onclick = () => {
                M.erc8004.removeOwner(btn.dataset.addr); M.settings.open('erc8004');
            });
            document.getElementById('ercAddBtn')?.addEventListener('click', () => {
                const addr = document.getElementById('ercNewAddr').value.trim();
                const label = document.getElementById('ercNewLabel').value.trim() || 'Custom';
                const chains = document.getElementById('ercNewChains').value.trim().split(',').map(s=>s.trim()).filter(Boolean);
                if (!addr.startsWith('0x') || addr.length < 10) return alert('Invalid address');
                M.erc8004.addOwner(addr, label, chains);
                M.settings.open('erc8004');
            });
        });

        M.settings.registerTab('ipfs', 'IPFS', body => {
            const gw = ipfsGateway;
            body.innerHTML = `<div style="margin-bottom:12px;color:var(--text-dim)">IPFS Gateway — required to fetch ipfs:// registration URIs</div>
                <div style="display:flex;gap:6px">
                    <input type="text" id="ipfsGw" value="${gw}" placeholder="https://ipfs.io/ipfs/ (leave empty to disable)">
                    <button class="ms-btn" id="ipfsSaveBtn">Save</button>
                </div>
                <div class="ms-hint" style="margin-top:8px">${gw ? '✓ Enabled: '+gw : '○ Disabled — ipfs:// URIs will be skipped'}</div>`;
            document.getElementById('ipfsSaveBtn')?.addEventListener('click', () => {
                M.erc8004.setIpfsGateway(document.getElementById('ipfsGw').value.trim());
                M.settings.open('ipfs');
            });
        });
    }

    console.log(`[ERC8004] Plugin loaded — ${Object.keys(CHAINS).length} chains`);
}
