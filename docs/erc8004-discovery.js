// ERC-8004 Discovery Plugin for AgentMesh
// Read-only on-chain agent discovery — no wallet needed.
// Load AFTER agent-mesh.js. Safe to omit if on-chain discovery not needed.
// Spec: https://eips.ethereum.org/EIPS/eip-8004
import { KeccakHasher } from 'https://cdn.jsdelivr.net/npm/@adraffy/keccak@1.0.4/+esm';
const keccak256 = data => KeccakHasher.unpadded().update(data).finalize().output;

const M = window.AgentMesh;
if (!M) console.warn('[ERC8004] AgentMesh not found');

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

    const agent = { agentId, owner, uri, wallet, chain };

    // Fetch registration file
    if (uri) {
        try {
            if (uri.startsWith('data:')) {
                agent.registration = JSON.parse(atob(uri.split(',')[1]));
            } else {
                const fetchUrl = uri.startsWith('ipfs://') ? 'https://ipfs.io/ipfs/' + uri.slice(7) : uri;
                agent.registration = await (await fetch(fetchUrl)).json();
            }
        } catch {}
    }
    return agent;
}

export async function discoverAgents(chain, maxAgents = 50) {
    // Try event logs first (fast), fall back to sequential probe
    const id = CHAINS[chain]?.identity;
    if (!id) throw new Error(`Unknown chain: ${chain}`);

    let agentIds = [];
    try {
        const logs = await rpc(chain, 'eth_getLogs', [{ fromBlock: '0x0', toBlock: 'latest', address: id, topics: [REGISTERED_TOPIC] }]);
        agentIds = [...new Set(logs.map(l => parseInt(l.topics[1], 16)))].slice(-maxAgents);
    } catch {
        // Fallback: sequential probe
        let misses = 0;
        for (let i = 0; agentIds.length < maxAgents && misses <= 5; i++) {
            try { await ethCall(chain, id, SEL.ownerOf + encUint(i)); agentIds.push(i); misses = 0; }
            catch { misses++; }
        }
    }

    const agents = [];
    for (const aid of agentIds) {
        const a = await getAgent(chain, aid);
        if (a) agents.push(a);
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
    console.log(`[ERC8004] Plugin loaded — ${Object.keys(CHAINS).length} chains`);
}
