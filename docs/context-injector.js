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
        
        // Check current permission state
        let currentState = 'prompt';
        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            currentState = result.state;
            this.state.permission = currentState;
            
            result.addEventListener('change', () => {
                this.state.permission = result.state;
            });
            
            // If already granted, we're good
            if (currentState === 'granted') {
                return true;
            }
            
            // If denied, don't bother asking
            if (currentState === 'denied') {
                this.state.error = 'Permission denied by user';
                return false;
            }
        } catch (e) {
            // permissions.query not supported, continue to actually request
            console.log('📍 permissions.query not available, will request directly');
        }
        
        // Permission is 'prompt' or unknown - actually request it by getting position
        // This is what triggers the browser's permission dialog!
        return new Promise((resolve) => {
            console.log('📍 Requesting geolocation permission...');
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    console.log('📍 Geolocation permission granted!');
                    this.state.permission = 'granted';
                    // Store the first position too
                    this.state.position = {
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude,
                        accuracy: Math.round(position.coords.accuracy),
                        altitude: position.coords.altitude,
                        heading: position.coords.heading,
                        speed: position.coords.speed
                    };
                    this.state.lastUpdate = Date.now();
                    resolve(true);
                },
                (error) => {
                    console.log('📍 Geolocation permission denied:', error.message);
                    this.state.permission = 'denied';
                    this.state.error = error.message;
                    resolve(false);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 15000,
                    maximumAge: 0
                }
            );
        });
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
// BLUETOOTH SCANNER - Device discovery
// 
// IMPORTANT LIMITATION: Web Bluetooth API can only act as a "central" (client).
// Browsers CANNOT advertise as BLE peripherals, so true browser-to-browser
// Bluetooth communication is NOT possible with this API.
// 
// Use cases that DO work:
// - Scanning for nearby Bluetooth devices
// - Connecting to BLE peripherals (fitness trackers, sensors, etc.)
// - Reading/writing to device characteristics
// 
// For browser-to-browser agent communication, consider:
// - WebRTC (peer-to-peer, works great!)
// - WebSocket server for discovery
// - Shared cloud signaling
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
        
        // Custom service UUID for potential future native AGI apps
        // NOTE: UUID must use valid hex chars (0-9, a-f only). "a610" represents "AGI0"
        this.AGI_SERVICE_UUID = '0000a610-0000-1000-8000-00805f9b34fb';
        this.AGI_CHARACTERISTIC_UUID = '0000a611-0000-1000-8000-00805f9b34fb';
    }
    
    async scan(duration = 10000) {
        if (!this.state.available) {
            this.state.error = 'Web Bluetooth not supported. Requires HTTPS + Chrome/Edge.';
            return [];
        }
        
        this.state.scanning = true;
        this.state.error = null;
        
        try {
            console.log('📡 Opening Bluetooth device picker...');
            
            // Request device - this opens the browser's Bluetooth picker
            // User must manually select a device from the list
            const device = await navigator.bluetooth.requestDevice({
                acceptAllDevices: true,
                optionalServices: ['battery_service', 'device_information', 'generic_access']
            });
            
            if (device) {
                console.log('📡 Device selected:', device.name || device.id);
                
                const deviceInfo = {
                    id: device.id,
                    name: device.name || 'Unknown Device',
                    connected: false,
                    lastSeen: Date.now(),
                    isAgiAgent: false,
                    services: [],
                    batteryLevel: null,
                    device: device
                };
                
                this.state.devices.set(device.id, deviceInfo);
                
                // Try to connect and get more info
                await this._getDeviceInfo(device, deviceInfo);
            }
            
            this.state.lastScan = Date.now();
            return Array.from(this.state.devices.values());
            
        } catch (e) {
            if (e.name === 'NotFoundError') {
                // User cancelled the picker - not an error
                console.log('📡 Bluetooth picker cancelled by user');
            } else {
                console.error('📡 Bluetooth error:', e.message);
                this.state.error = e.message;
            }
            return Array.from(this.state.devices.values());
        } finally {
            this.state.scanning = false;
        }
    }
    
    async _getDeviceInfo(device, deviceInfo) {
        try {
            console.log('📡 Connecting to device...');
            const server = await device.gatt?.connect();
            if (!server) {
                console.log('📡 Device does not support GATT');
                return;
            }
            
            deviceInfo.connected = true;
            console.log('📡 Connected! Getting services...');
            
            // Try to get battery level
            try {
                const batteryService = await server.getPrimaryService('battery_service');
                const batteryChar = await batteryService.getCharacteristic('battery_level');
                const value = await batteryChar.readValue();
                deviceInfo.batteryLevel = value.getUint8(0);
                console.log('📡 Battery level:', deviceInfo.batteryLevel + '%');
            } catch (e) {
                // Battery service not available
            }
            
            // Try to get device name from generic_access
            try {
                const genericService = await server.getPrimaryService('generic_access');
                const nameChar = await genericService.getCharacteristic('gap.device_name');
                const value = await nameChar.readValue();
                const decoder = new TextDecoder();
                const name = decoder.decode(value);
                if (name) deviceInfo.name = name;
            } catch (e) {
                // Generic access not available
            }
            
            // Get list of available services
            try {
                const services = await server.getPrimaryServices();
                deviceInfo.services = services.map(s => s.uuid);
                console.log('📡 Available services:', deviceInfo.services);
            } catch (e) {
                // Can't enumerate services
            }
            
        } catch (e) {
            console.log('📡 Could not connect:', e.message);
            deviceInfo.connected = false;
        }
    }
    
    async sendToAgent(deviceId, message) {
        const deviceInfo = this.state.devices.get(deviceId);
        if (!deviceInfo) {
            throw new Error('Device not found. Scan first.');
        }
        
        // NOTE: This would only work with a native app advertising the AGI service
        // Browser-to-browser BT communication is NOT possible with Web Bluetooth
        if (!deviceInfo.connected) {
            throw new Error('Device not connected');
        }
        
        try {
            const device = deviceInfo.device;
            const server = await device.gatt?.connect();
            if (!server) throw new Error('Could not connect');
            
            // Check if it has our AGI service (would be a native app)
            const service = await server.getPrimaryService(this.AGI_SERVICE_UUID);
            const characteristic = await service.getCharacteristic(this.AGI_CHARACTERISTIC_UUID);
            
            const encoder = new TextEncoder();
            await characteristic.writeValue(encoder.encode(JSON.stringify({
                type: 'message',
                from: 'browser-agent',
                content: message,
                timestamp: Date.now()
            })));
            
            deviceInfo.isAgiAgent = true;
            return true;
        } catch (e) {
            throw new Error(`Cannot send: ${e.message}. Note: Browser-to-browser BT is not supported.`);
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
        const devices = this.getDevices();
        const lines = [];
        
        lines.push(`### Bluetooth Devices`);
        
        if (!s.available) {
            lines.push(`- **Status**: Not available (requires HTTPS + Chrome/Edge)`);
        } else if (s.scanning) {
            lines.push(`- **Status**: Scanning...`);
        } else if (devices.length === 0) {
            lines.push(`- **Status**: No devices paired yet. Click 📡 to scan.`);
        } else {
            lines.push(`- **Paired Devices**: ${devices.length}`);
            devices.forEach(d => {
                let info = `  - **${d.name}** (${d.id.slice(0, 8)}...)`;
                if (d.connected) info += ' ✓ connected';
                if (d.batteryLevel !== null) info += ` 🔋${d.batteryLevel}%`;
                if (d.services?.length > 0) info += ` [${d.services.length} services]`;
                lines.push(info);
            });
        }
        
        if (s.error) {
            lines.push(`- **Error**: ${s.error}`);
        }
        
        // Add limitation note
        lines.push(`- **Note**: Web Bluetooth can scan devices but cannot enable browser-to-browser communication.`);
        
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
