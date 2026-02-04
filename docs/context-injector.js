/**
 * 🧠 Context Injector for agi.diy
 * 
 * Injects dynamic context from browser APIs into agent system prompt:
 * - User position/activity tracking
 * - Bluetooth device discovery
 * - Screen/window state
 * - Geolocation
 * - Device sensors
 */

// ═══════════════════════════════════════════════════════════════════════════
// USER ACTIVITY TRACKING
// Based on: https://github.com/cagataycali/whats-the-user-doing.js
// ═══════════════════════════════════════════════════════════════════════════

class UserActivityTracker {
    constructor() {
        this.state = {
            isActive: true,
            isTyping: false,
            isScrolling: false,
            isMovingMouse: false,
            lastActivity: Date.now(),
            idleTime: 0,
            mousePosition: { x: 0, y: 0 },
            scrollPosition: { x: 0, y: 0 },
            focusedElement: null,
            visibilityState: document.visibilityState,
            windowFocused: document.hasFocus(),
            screenSize: { width: window.innerWidth, height: window.innerHeight },
            touchDevice: 'ontouchstart' in window,
            deviceOrientation: null,
            batteryLevel: null,
            networkType: null
        };
        
        this._timers = {};
        this._listeners = [];
        this._running = false;
    }
    
    start() {
        if (this._running) return;
        this._running = true;
        
        // Mouse movement
        this._addListener(document, 'mousemove', (e) => {
            this.state.mousePosition = { x: e.clientX, y: e.clientY };
            this.state.isMovingMouse = true;
            this._resetActivity();
            this._debounce('mouse', () => { this.state.isMovingMouse = false; }, 500);
        });
        
        // Keyboard activity
        this._addListener(document, 'keydown', () => {
            this.state.isTyping = true;
            this._resetActivity();
            this._debounce('typing', () => { this.state.isTyping = false; }, 1000);
        });
        
        // Scroll tracking
        this._addListener(window, 'scroll', () => {
            this.state.scrollPosition = { x: window.scrollX, y: window.scrollY };
            this.state.isScrolling = true;
            this._resetActivity();
            this._debounce('scroll', () => { this.state.isScrolling = false; }, 500);
        });
        
        // Click tracking
        this._addListener(document, 'click', () => {
            this._resetActivity();
        });
        
        // Touch tracking
        this._addListener(document, 'touchstart', () => {
            this._resetActivity();
        });
        
        // Focus tracking
        this._addListener(document, 'focusin', (e) => {
            this.state.focusedElement = e.target.tagName?.toLowerCase() || null;
            this._resetActivity();
        });
        
        // Visibility change
        this._addListener(document, 'visibilitychange', () => {
            this.state.visibilityState = document.visibilityState;
            if (document.visibilityState === 'visible') {
                this._resetActivity();
            }
        });
        
        // Window focus
        this._addListener(window, 'focus', () => {
            this.state.windowFocused = true;
            this._resetActivity();
        });
        
        this._addListener(window, 'blur', () => {
            this.state.windowFocused = false;
        });
        
        // Resize tracking
        this._addListener(window, 'resize', () => {
            this.state.screenSize = { width: window.innerWidth, height: window.innerHeight };
        });
        
        // Device orientation (mobile)
        this._addListener(window, 'deviceorientation', (e) => {
            this.state.deviceOrientation = {
                alpha: Math.round(e.alpha || 0),
                beta: Math.round(e.beta || 0),
                gamma: Math.round(e.gamma || 0)
            };
        });
        
        // Battery API
        if (navigator.getBattery) {
            navigator.getBattery().then(battery => {
                this.state.batteryLevel = Math.round(battery.level * 100);
                battery.addEventListener('levelchange', () => {
                    this.state.batteryLevel = Math.round(battery.level * 100);
                });
            });
        }
        
        // Network info
        if (navigator.connection) {
            this.state.networkType = navigator.connection.effectiveType;
            navigator.connection.addEventListener('change', () => {
                this.state.networkType = navigator.connection.effectiveType;
            });
        }
        
        // Idle time tracker
        this._idleInterval = setInterval(() => {
            this.state.idleTime = Math.round((Date.now() - this.state.lastActivity) / 1000);
            this.state.isActive = this.state.idleTime < 30; // 30s threshold
        }, 1000);
        
        console.log('👁️ User activity tracker started');
    }
    
    stop() {
        this._running = false;
        
        // Remove all listeners
        this._listeners.forEach(({ target, event, handler }) => {
            target.removeEventListener(event, handler);
        });
        this._listeners = [];
        
        // Clear timers
        Object.values(this._timers).forEach(clearTimeout);
        this._timers = {};
        
        if (this._idleInterval) {
            clearInterval(this._idleInterval);
        }
        
        console.log('👁️ User activity tracker stopped');
    }
    
    _addListener(target, event, handler) {
        target.addEventListener(event, handler, { passive: true });
        this._listeners.push({ target, event, handler });
    }
    
    _resetActivity() {
        this.state.lastActivity = Date.now();
        this.state.idleTime = 0;
        this.state.isActive = true;
    }
    
    _debounce(key, fn, delay) {
        if (this._timers[key]) clearTimeout(this._timers[key]);
        this._timers[key] = setTimeout(fn, delay);
    }
    
    getState() {
        return { ...this.state };
    }
    
    getContextString() {
        const s = this.state;
        const lines = [];
        
        lines.push(`### User Activity`);
        lines.push(`- **Active**: ${s.isActive ? 'Yes' : 'No'} (idle ${s.idleTime}s)`);
        lines.push(`- **Actions**: ${[
            s.isTyping && 'typing',
            s.isScrolling && 'scrolling',
            s.isMovingMouse && 'moving mouse'
        ].filter(Boolean).join(', ') || 'none'}`);
        lines.push(`- **Mouse**: (${s.mousePosition.x}, ${s.mousePosition.y})`);
        lines.push(`- **Window**: ${s.windowFocused ? 'focused' : 'not focused'}, ${s.visibilityState}`);
        lines.push(`- **Screen**: ${s.screenSize.width}x${s.screenSize.height}`);
        
        if (s.focusedElement) {
            lines.push(`- **Focus**: <${s.focusedElement}>`);
        }
        
        if (s.batteryLevel !== null) {
            lines.push(`- **Battery**: ${s.batteryLevel}%`);
        }
        
        if (s.networkType) {
            lines.push(`- **Network**: ${s.networkType}`);
        }
        
        if (s.deviceOrientation) {
            lines.push(`- **Orientation**: α:${s.deviceOrientation.alpha}° β:${s.deviceOrientation.beta}° γ:${s.deviceOrientation.gamma}°`);
        }
        
        return lines.join('\n');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// GEOLOCATION TRACKER
// ═══════════════════════════════════════════════════════════════════════════

class GeolocationTracker {
    constructor() {
        this.state = {
            available: 'geolocation' in navigator,
            permission: null,
            position: null,
            error: null,
            lastUpdate: null
        };
        
        this._watchId = null;
    }
    
    async requestPermission() {
        if (!this.state.available) {
            this.state.error = 'Geolocation not supported';
            return false;
        }
        
        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            this.state.permission = result.state;
            
            result.addEventListener('change', () => {
                this.state.permission = result.state;
            });
            
            return result.state === 'granted';
        } catch (e) {
            // Fallback: try to get position directly
            return new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(
                    () => {
                        this.state.permission = 'granted';
                        resolve(true);
                    },
                    () => {
                        this.state.permission = 'denied';
                        resolve(false);
                    }
                );
            });
        }
    }
    
    startWatching() {
        if (!this.state.available || this._watchId !== null) return;
        
        this._watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.state.position = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: Math.round(position.coords.accuracy),
                    altitude: position.coords.altitude,
                    heading: position.coords.heading,
                    speed: position.coords.speed
                };
                this.state.lastUpdate = Date.now();
                this.state.error = null;
            },
            (error) => {
                this.state.error = error.message;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 30000
            }
        );
        
        console.log('📍 Geolocation tracking started');
    }
    
    stopWatching() {
        if (this._watchId !== null) {
            navigator.geolocation.clearWatch(this._watchId);
            this._watchId = null;
            console.log('📍 Geolocation tracking stopped');
        }
    }
    
    getState() {
        return { ...this.state };
    }
    
    getContextString() {
        const s = this.state;
        const lines = [];
        
        lines.push(`### Location`);
        
        if (!s.available) {
            lines.push(`- **Status**: Not available`);
        } else if (s.permission === 'denied') {
            lines.push(`- **Status**: Permission denied`);
        } else if (s.error) {
            lines.push(`- **Status**: Error - ${s.error}`);
        } else if (s.position) {
            lines.push(`- **Coordinates**: ${s.position.latitude.toFixed(4)}, ${s.position.longitude.toFixed(4)}`);
            lines.push(`- **Accuracy**: ±${s.position.accuracy}m`);
            if (s.position.altitude !== null) {
                lines.push(`- **Altitude**: ${Math.round(s.position.altitude)}m`);
            }
            if (s.position.speed !== null && s.position.speed > 0) {
                lines.push(`- **Speed**: ${(s.position.speed * 3.6).toFixed(1)} km/h`);
            }
        } else {
            lines.push(`- **Status**: Waiting for position...`);
        }
        
        return lines.join('\n');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// BLUETOOTH SCANNER - For agent-to-agent discovery
// ═══════════════════════════════════════════════════════════════════════════

class BluetoothScanner {
    constructor() {
        this.state = {
            available: 'bluetooth' in navigator,
            scanning: false,
            devices: new Map(),
            lastScan: null,
            error: null
        };
        
        // Agent discovery service UUID (custom)
        this.AGI_SERVICE_UUID = '0000agi0-0000-1000-8000-00805f9b34fb';
        this.AGI_CHARACTERISTIC_UUID = '0000agi1-0000-1000-8000-00805f9b34fb';
    }
    
    async scan(duration = 10000) {
        if (!this.state.available) {
            this.state.error = 'Web Bluetooth not supported';
            return [];
        }
        
        this.state.scanning = true;
        this.state.error = null;
        
        try {
            // Request device with filters
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: [this.AGI_SERVICE_UUID, 'battery_service', 'device_information']
            });
            
            if (device) {
                this.state.devices.set(device.id, {
                    id: device.id,
                    name: device.name || 'Unknown Device',
                    connected: device.gatt?.connected || false,
                    lastSeen: Date.now(),
                    isAgiAgent: false,
                    device: device
                });
                
                // Try to detect if it's an AGI agent
                await this._checkForAgiAgent(device);
            }
            
            this.state.lastScan = Date.now();
            return Array.from(this.state.devices.values());
            
        } catch (e) {
            if (e.name !== 'NotFoundError') {
                this.state.error = e.message;
            }
            return [];
        } finally {
            this.state.scanning = false;
        }
    }
    
    async _checkForAgiAgent(device) {
        try {
            const server = await device.gatt?.connect();
            if (!server) return;
            
            try {
                const service = await server.getPrimaryService(this.AGI_SERVICE_UUID);
                if (service) {
                    const deviceInfo = this.state.devices.get(device.id);
                    if (deviceInfo) {
                        deviceInfo.isAgiAgent = true;
                        
                        // Try to read agent info
                        const characteristic = await service.getCharacteristic(this.AGI_CHARACTERISTIC_UUID);
                        const value = await characteristic.readValue();
                        const decoder = new TextDecoder();
                        deviceInfo.agentInfo = JSON.parse(decoder.decode(value));
                    }
                }
            } catch (e) {
                // Not an AGI agent, that's fine
            }
            
        } catch (e) {
            console.log('Could not connect to device:', e.message);
        }
    }
    
    async sendToAgent(deviceId, message) {
        const deviceInfo = this.state.devices.get(deviceId);
        if (!deviceInfo || !deviceInfo.isAgiAgent) {
            throw new Error('Device is not an AGI agent');
        }
        
        try {
            const device = deviceInfo.device;
            const server = await device.gatt?.connect();
            if (!server) throw new Error('Could not connect');
            
            const service = await server.getPrimaryService(this.AGI_SERVICE_UUID);
            const characteristic = await service.getCharacteristic(this.AGI_CHARACTERISTIC_UUID);
            
            const encoder = new TextEncoder();
            await characteristic.writeValue(encoder.encode(JSON.stringify({
                type: 'message',
                from: 'browser-agent',
                content: message,
                timestamp: Date.now()
            })));
            
            return true;
        } catch (e) {
            throw new Error(`Failed to send: ${e.message}`);
        }
    }
    
    getDevices() {
        return Array.from(this.state.devices.values());
    }
    
    getAgiAgents() {
        return this.getDevices().filter(d => d.isAgiAgent);
    }
    
    getState() {
        return {
            available: this.state.available,
            scanning: this.state.scanning,
            deviceCount: this.state.devices.size,
            agiAgentCount: this.getAgiAgents().length,
            lastScan: this.state.lastScan,
            error: this.state.error
        };
    }
    
    getContextString() {
        const s = this.getState();
        const lines = [];
        
        lines.push(`### Bluetooth`);
        
        if (!s.available) {
            lines.push(`- **Status**: Not available (requires HTTPS + Chrome/Edge)`);
        } else if (s.scanning) {
            lines.push(`- **Status**: Scanning...`);
        } else {
            lines.push(`- **Devices Found**: ${s.deviceCount}`);
            lines.push(`- **AGI Agents Nearby**: ${s.agiAgentCount}`);
            
            const agents = this.getAgiAgents();
            if (agents.length > 0) {
                lines.push(`- **Agents**:`);
                agents.forEach(a => {
                    lines.push(`  - ${a.name} (${a.id.slice(0, 8)}...)`);
                });
            }
        }
        
        if (s.error) {
            lines.push(`- **Error**: ${s.error}`);
        }
        
        return lines.join('\n');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN CONTEXT INJECTOR
// ═══════════════════════════════════════════════════════════════════════════

class ContextInjector {
    constructor() {
        this.activity = new UserActivityTracker();
        this.geolocation = new GeolocationTracker();
        this.bluetooth = new BluetoothScanner();
        
        this._enabled = {
            activity: false,
            geolocation: false,
            bluetooth: false,
            custom: true
        };
        
        this._customContext = {};
        this._contextUpdateCallback = null;
    }
    
    /**
     * Enable/disable context sources
     */
    enable(source, enabled = true) {
        if (source in this._enabled) {
            this._enabled[source] = enabled;
            
            if (source === 'activity') {
                enabled ? this.activity.start() : this.activity.stop();
            } else if (source === 'geolocation') {
                if (enabled) {
                    this.geolocation.requestPermission().then(granted => {
                        if (granted) this.geolocation.startWatching();
                    });
                } else {
                    this.geolocation.stopWatching();
                }
            }
        }
        return this;
    }
    
    /**
     * Set custom context data
     */
    setCustomContext(key, value) {
        this._customContext[key] = value;
        return this;
    }
    
    /**
     * Remove custom context
     */
    removeCustomContext(key) {
        delete this._customContext[key];
        return this;
    }
    
    /**
     * Set callback for context updates
     */
    onContextUpdate(callback) {
        this._contextUpdateCallback = callback;
        return this;
    }
    
    /**
     * Scan for bluetooth devices
     */
    async scanBluetooth() {
        return await this.bluetooth.scan();
    }
    
    /**
     * Send message to nearby AGI agent via bluetooth
     */
    async sendToNearbyAgent(deviceId, message) {
        return await this.bluetooth.sendToAgent(deviceId, message);
    }
    
    /**
     * Get all context as object
     */
    getContext() {
        return {
            activity: this._enabled.activity ? this.activity.getState() : null,
            geolocation: this._enabled.geolocation ? this.geolocation.getState() : null,
            bluetooth: this._enabled.bluetooth ? this.bluetooth.getState() : null,
            custom: this._customContext,
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };
    }
    
    /**
     * Get context as injectable system prompt string
     */
    getContextString() {
        const sections = [];
        
        sections.push(`## 🧠 Dynamic Context (${new Date().toISOString()})`);
        sections.push(`**URL**: ${window.location.href}`);
        
        if (this._enabled.activity) {
            sections.push('');
            sections.push(this.activity.getContextString());
        }
        
        if (this._enabled.geolocation) {
            sections.push('');
            sections.push(this.geolocation.getContextString());
        }
        
        if (this._enabled.bluetooth) {
            sections.push('');
            sections.push(this.bluetooth.getContextString());
        }
        
        // Custom context
        const customKeys = Object.keys(this._customContext);
        if (customKeys.length > 0) {
            sections.push('');
            sections.push('### Custom Context');
            customKeys.forEach(key => {
                const value = this._customContext[key];
                if (typeof value === 'object') {
                    sections.push(`- **${key}**: ${JSON.stringify(value)}`);
                } else {
                    sections.push(`- **${key}**: ${value}`);
                }
            });
        }
        
        return sections.join('\n');
    }
    
    /**
     * Inject context into agent's system prompt
     */
    injectIntoPrompt(basePrompt) {
        const contextStr = this.getContextString();
        return `${basePrompt}\n\n${contextStr}`;
    }
    
    /**
     * Expose to window object for browser access
     */
    exposeToWindow() {
        window.agiContext = {
            getContext: () => this.getContext(),
            getContextString: () => this.getContextString(),
            setCustom: (k, v) => this.setCustomContext(k, v),
            removeCustom: (k) => this.removeCustomContext(k),
            enable: (source) => this.enable(source, true),
            disable: (source) => this.enable(source, false),
            scanBluetooth: () => this.scanBluetooth(),
            sendToAgent: (id, msg) => this.sendToNearbyAgent(id, msg),
            activity: this.activity,
            geolocation: this.geolocation,
            bluetooth: this.bluetooth
        };
        
        console.log('🧠 Context injector exposed as window.agiContext');
        return this;
    }
    
    /**
     * Start all enabled trackers
     */
    startAll() {
        if (this._enabled.activity) this.activity.start();
        if (this._enabled.geolocation) {
            this.geolocation.requestPermission().then(granted => {
                if (granted) this.geolocation.startWatching();
            });
        }
        return this;
    }
    
    /**
     * Stop all trackers
     */
    stopAll() {
        this.activity.stop();
        this.geolocation.stopWatching();
        return this;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export {
    ContextInjector,
    UserActivityTracker,
    GeolocationTracker,
    BluetoothScanner
};

// Expose on window
if (typeof window !== 'undefined') {
    window.ContextInjector = ContextInjector;
    window.UserActivityTracker = UserActivityTracker;
    window.GeolocationTracker = GeolocationTracker;
    window.BluetoothScanner = BluetoothScanner;
}

console.log('🧠 Context injector module loaded');
