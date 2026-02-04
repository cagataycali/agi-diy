/**
 * 🔮 Vision Module for agi.diy
 * 
 * Adds image upload, screenshot capture, and ambient mode support.
 * Uses Strands SDK ImageBlock for multimodal messages.
 */

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a File/Blob to base64 Uint8Array for ImageBlock
 */
async function fileToBytes(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const arrayBuffer = reader.result;
            resolve(new Uint8Array(arrayBuffer));
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Get image format from file type
 */
function getImageFormat(file) {
    const type = file.type.toLowerCase();
    if (type.includes('png')) return 'png';
    if (type.includes('gif')) return 'gif';
    if (type.includes('webp')) return 'webp';
    return 'jpeg'; // default to jpeg for jpg and others
}

/**
 * Create ImageBlock from File
 */
async function createImageBlock(file) {
    const bytes = await fileToBytes(file);
    const format = getImageFormat(file);
    
    // Use the ImageBlock class from strands.js
    return {
        image: {
            format: format,
            source: { bytes: bytes }
        }
    };
}

/**
 * Resize image if too large (max 5MB for most APIs)
 */
async function resizeImageIfNeeded(file, maxSizeBytes = 4 * 1024 * 1024) {
    if (file.size <= maxSizeBytes) {
        return file;
    }
    
    return new Promise((resolve) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        img.onload = () => {
            // Calculate scale to get under max size
            let scale = Math.sqrt(maxSizeBytes / file.size);
            canvas.width = Math.floor(img.width * scale);
            canvas.height = Math.floor(img.height * scale);
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob((blob) => {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.85);
        };
        
        img.src = URL.createObjectURL(file);
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// SCREENSHOT CAPTURE
// ═══════════════════════════════════════════════════════════════════════════

class ScreenCapture {
    constructor() {
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.intervalId = null;
        this.isCapturing = false;
        this.onCapture = null;
    }
    
    /**
     * Start screen capture (requests permission)
     */
    async start() {
        try {
            // Request screen capture permission
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    displaySurface: 'monitor'
                },
                audio: false
            });
            
            // Create video element to receive stream
            this.video = document.createElement('video');
            this.video.srcObject = this.stream;
            this.video.autoplay = true;
            this.video.playsInline = true;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                this.video.onloadedmetadata = resolve;
            });
            await this.video.play();
            
            // Create canvas for capturing frames
            this.canvas = document.createElement('canvas');
            
            this.isCapturing = true;
            console.log('📸 Screen capture started');
            return true;
        } catch (err) {
            console.error('Screen capture failed:', err);
            return false;
        }
    }
    
    /**
     * Capture current frame as ImageBlock data
     */
    captureFrame() {
        if (!this.isCapturing || !this.video) {
            return null;
        }
        
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        const ctx = this.canvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0);
        
        // Convert to blob then to bytes
        return new Promise((resolve) => {
            this.canvas.toBlob((blob) => {
                if (!blob) {
                    resolve(null);
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = () => {
                    const bytes = new Uint8Array(reader.result);
                    resolve({
                        image: {
                            format: 'jpeg',
                            source: { bytes: bytes }
                        }
                    });
                };
                reader.readAsArrayBuffer(blob);
            }, 'image/jpeg', 0.8);
        });
    }
    
    /**
     * Start interval capture
     */
    startInterval(intervalMs, callback) {
        if (this.intervalId) {
            this.stopInterval();
        }
        
        this.onCapture = callback;
        this.intervalId = setInterval(async () => {
            const frame = await this.captureFrame();
            if (frame && this.onCapture) {
                this.onCapture(frame);
            }
        }, intervalMs);
        
        console.log(`📸 Interval capture started (${intervalMs}ms)`);
    }
    
    /**
     * Stop interval capture
     */
    stopInterval() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('📸 Interval capture stopped');
        }
    }
    
    /**
     * Stop all capture
     */
    stop() {
        this.stopInterval();
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        this.video = null;
        this.canvas = null;
        this.isCapturing = false;
        
        console.log('📸 Screen capture stopped');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// AMBIENT MODE (Background Thinking)
// ═══════════════════════════════════════════════════════════════════════════

class AmbientMode {
    constructor(agent, options = {}) {
        this.agent = agent;
        this.running = false;
        this.autonomous = false;
        
        // Configuration
        this.idleThreshold = options.idleThreshold || 30000; // 30s
        this.maxIterations = options.maxIterations || 3;
        this.cooldown = options.cooldown || 60000; // 60s
        this.autonomousCooldown = options.autonomousCooldown || 10000; // 10s
        this.autonomousMaxIterations = options.autonomousMaxIterations || 50;
        
        // State
        this.lastInteraction = Date.now();
        this.lastQuery = null;
        this.lastResponse = null;
        this.ambientResult = null;
        this.ambientResultsHistory = [];
        this.ambientIterations = 0;
        this.lastAmbientRun = 0;
        this.interrupted = false;
        this.intervalId = null;
        
        // Callbacks
        this.onThinking = null;
        this.onResult = null;
        this.onComplete = null;
        
        // Completion signals
        this.completionSignals = [
            '[AMBIENT_DONE]',
            '[TASK_COMPLETE]',
            '[NOTHING_MORE_TO_DO]',
            "I've completed my exploration",
            "Nothing more to explore"
        ];
    }
    
    /**
     * Start ambient mode
     */
    start(autonomous = false) {
        if (this.running && !autonomous) return;
        
        this.running = true;
        this.autonomous = autonomous;
        this.interrupted = false;
        
        this.intervalId = setInterval(() => this._checkAndRun(), 5000);
        
        console.log(`🌙 Ambient mode started (${autonomous ? 'AUTONOMOUS' : 'standard'})`);
        return this;
    }
    
    /**
     * Stop ambient mode
     */
    stop() {
        this.running = false;
        this.autonomous = false;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        console.log('🌙 Ambient mode stopped');
    }
    
    /**
     * Record user interaction
     */
    recordInteraction(query, response) {
        this.lastInteraction = Date.now();
        this.lastQuery = query;
        this.lastResponse = String(response).slice(0, 5000);
        
        if (!this.autonomous) {
            this.ambientIterations = 0;
            this.ambientResultsHistory = [];
        }
        
        this.interrupted = false;
    }
    
    /**
     * Interrupt ambient work
     */
    interrupt() {
        this.interrupted = true;
    }
    
    /**
     * Get and clear result
     */
    getAndClearResult() {
        if (this.autonomous && this.ambientResultsHistory.length > 0) {
            const count = this.ambientResultsHistory.length;
            const result = this.ambientResultsHistory.join('\n\n');
            this.ambientResultsHistory = [];
            this.ambientResult = null;
            return `[Autonomous ambient work - ${count} iterations]:\n${result}`;
        }
        
        const result = this.ambientResult;
        this.ambientResult = null;
        return result;
    }
    
    /**
     * Check for completion signal
     */
    _checkCompletionSignal(text) {
        const lower = String(text).toLowerCase();
        return this.completionSignals.some(signal => lower.includes(signal.toLowerCase()));
    }
    
    /**
     * Build ambient prompt
     */
    _buildPrompt() {
        if (!this.lastQuery) return null;
        
        if (this.autonomous) {
            if (this.ambientIterations === 0) {
                return `You're in AUTONOMOUS mode. Work on this task until complete: '${this.lastQuery.slice(0, 300)}'

Take action, make progress, explore deeply. When you're truly done with nothing more to do, include '[AMBIENT_DONE]' in your response. Otherwise, keep working.`;
            } else {
                const historySummary = this.ambientResultsHistory.length > 0 
                    ? `\n\nPrevious iterations summary: ${this.ambientResultsHistory.length} completed.`
                    : '';
                
                return `Continue working on: '${this.lastQuery.slice(0, 200)}'${historySummary}

Iteration ${this.ambientIterations + 1}. What's the next step? Take action.
If truly complete, say '[AMBIENT_DONE]'. Otherwise, keep making progress.`;
            }
        } else {
            const prompts = [
                `Continue exploring the topic from the last interaction. Last query was: '${this.lastQuery.slice(0, 200)}'. Think deeper, find connections, validate assumptions, or explore related areas. Be proactive and useful.`,
                `Based on our recent work on '${this.lastQuery.slice(0, 100)}', what else should be considered? Are there edge cases, improvements, or related topics worth exploring?`,
                `Reflect on the last task: '${this.lastQuery.slice(0, 100)}'. What would make the solution better? Any risks or opportunities missed?`
            ];
            
            return prompts[this.ambientIterations % prompts.length];
        }
    }
    
    /**
     * Internal check and run logic
     */
    async _checkAndRun() {
        if (!this.running || !this.agent) return;
        
        const now = Date.now();
        const idleTime = now - this.lastInteraction;
        const cooldownElapsed = now - this.lastAmbientRun;
        
        const effectiveCooldown = this.autonomous ? this.autonomousCooldown : this.cooldown;
        const effectiveMaxIterations = this.autonomous ? this.autonomousMaxIterations : this.maxIterations;
        
        // Standard mode: must be idle first
        if (!this.autonomous && idleTime < this.idleThreshold) {
            return;
        }
        
        const shouldRun = (
            cooldownElapsed > effectiveCooldown &&
            this.ambientIterations < effectiveMaxIterations &&
            this.lastQuery !== null &&
            !this.interrupted
        );
        
        if (!shouldRun) return;
        
        const prompt = this._buildPrompt();
        if (!prompt) return;
        
        const modeLabel = this.autonomous ? 'AUTONOMOUS' : 'ambient';
        const iterDisplay = `${this.ambientIterations + 1}/${effectiveMaxIterations}`;
        
        console.log(`🌙 [${modeLabel}] Thinking... (iteration ${iterDisplay})`);
        
        if (this.onThinking) {
            this.onThinking(modeLabel, iterDisplay);
        }
        
        try {
            let resultText = '';
            
            for await (const event of this.agent.stream(prompt)) {
                if (this.interrupted) {
                    console.log('🌙 [ambient] Interrupted by user input');
                    return;
                }
                
                if (event?.type === 'modelContentBlockDeltaEvent' && 
                    event.delta?.type === 'textDelta') {
                    resultText += event.delta.text;
                }
            }
            
            if (!this.interrupted && resultText) {
                // Check for completion signal in autonomous mode
                if (this.autonomous && this._checkCompletionSignal(resultText)) {
                    console.log('🌙 [AUTONOMOUS] Agent signaled completion. Stopping.');
                    this.ambientResultsHistory.push(`[Final iteration ${this.ambientIterations + 1}]:\n${resultText}`);
                    this.autonomous = false;
                    this.running = false;
                    
                    if (this.onComplete) {
                        this.onComplete(this.ambientResultsHistory);
                    }
                    return;
                }
                
                // Store result
                if (this.autonomous) {
                    this.ambientResultsHistory.push(`[Iteration ${this.ambientIterations + 1}]:\n${resultText.slice(0, 2000)}`);
                    console.log(`🌙 [AUTONOMOUS] Iteration complete. Continuing... (${this.ambientResultsHistory.length} stored)`);
                } else {
                    this.ambientResult = `[Ambient thinking - iteration ${this.ambientIterations + 1}]:\n${resultText}`;
                    console.log('🌙 [ambient] Work stored. Will be injected into next query.');
                }
                
                if (this.onResult) {
                    this.onResult(resultText, this.ambientIterations + 1);
                }
                
                this.ambientIterations++;
                this.lastAmbientRun = Date.now();
            }
        } catch (err) {
            console.error('🌙 Ambient mode error:', err);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// VISION ENHANCED AGENT WRAPPER
// ═══════════════════════════════════════════════════════════════════════════

class VisionAgent {
    constructor(baseAgent) {
        this.agent = baseAgent;
        this.pendingImages = [];
        this.screenCapture = new ScreenCapture();
        this.ambientMode = null;
    }
    
    /**
     * Add images to the next message
     */
    addImages(files) {
        this.pendingImages.push(...files);
        return this;
    }
    
    /**
     * Clear pending images
     */
    clearImages() {
        this.pendingImages = [];
        return this;
    }
    
    /**
     * Send message with optional images
     */
    async *stream(text, options = {}) {
        const contentBlocks = [];
        
        // Add text block
        if (text) {
            contentBlocks.push({ text: text });
        }
        
        // Add pending images
        for (const file of this.pendingImages) {
            try {
                const resized = await resizeImageIfNeeded(file);
                const imageBlock = await createImageBlock(resized);
                contentBlocks.push(imageBlock);
            } catch (err) {
                console.error('Failed to process image:', err);
            }
        }
        
        // Add additional images from options
        if (options.images) {
            for (const file of options.images) {
                try {
                    const resized = await resizeImageIfNeeded(file);
                    const imageBlock = await createImageBlock(resized);
                    contentBlocks.push(imageBlock);
                } catch (err) {
                    console.error('Failed to process image:', err);
                }
            }
        }
        
        // Clear pending images after use
        this.pendingImages = [];
        
        // If only text, use simple string invocation
        if (contentBlocks.length === 1 && 'text' in contentBlocks[0]) {
            yield* this.agent.stream(text);
            return;
        }
        
        // Otherwise use content blocks
        yield* this.agent.stream(contentBlocks);
    }
    
    /**
     * Start screen watching at interval
     */
    async startScreenWatch(intervalMs = 5000, callback) {
        const success = await this.screenCapture.start();
        if (!success) return false;
        
        this.screenCapture.startInterval(intervalMs, callback);
        return true;
    }
    
    /**
     * Stop screen watching
     */
    stopScreenWatch() {
        this.screenCapture.stop();
    }
    
    /**
     * Capture current screen
     */
    async captureScreen() {
        if (!this.screenCapture.isCapturing) {
            const success = await this.screenCapture.start();
            if (!success) return null;
        }
        return await this.screenCapture.captureFrame();
    }
    
    /**
     * Enable ambient mode
     */
    enableAmbientMode(options = {}) {
        this.ambientMode = new AmbientMode(this.agent, options);
        return this.ambientMode;
    }
    
    /**
     * Get underlying agent
     */
    get baseAgent() {
        return this.agent;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create image upload button and preview
 */
function createImageUploadUI(container, onImagesSelected) {
    const wrapper = document.createElement('div');
    wrapper.className = 'image-upload-wrapper';
    wrapper.innerHTML = `
        <style>
            .image-upload-wrapper {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .image-upload-btn {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.6);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                font-size: 16px;
            }
            .image-upload-btn:hover {
                background: rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.9);
            }
            .image-upload-btn.has-images {
                background: rgba(100,150,255,0.2);
                border-color: rgba(100,150,255,0.4);
                color: rgba(100,150,255,0.9);
            }
            .image-preview-strip {
                display: flex;
                gap: 4px;
                max-width: 200px;
                overflow-x: auto;
            }
            .image-preview-item {
                width: 32px;
                height: 32px;
                border-radius: 6px;
                object-fit: cover;
                border: 1px solid rgba(255,255,255,0.1);
            }
            .image-upload-input {
                display: none;
            }
            .clear-images-btn {
                font-size: 12px;
                color: rgba(255,255,255,0.5);
                cursor: pointer;
                padding: 4px;
            }
            .clear-images-btn:hover {
                color: rgba(255,100,100,0.8);
            }
        </style>
        <input type="file" class="image-upload-input" accept="image/*" multiple>
        <button class="image-upload-btn" title="Add images">📷</button>
        <div class="image-preview-strip"></div>
        <span class="clear-images-btn" style="display:none">✕</span>
    `;
    
    const input = wrapper.querySelector('.image-upload-input');
    const btn = wrapper.querySelector('.image-upload-btn');
    const strip = wrapper.querySelector('.image-preview-strip');
    const clearBtn = wrapper.querySelector('.clear-images-btn');
    
    let selectedFiles = [];
    
    btn.addEventListener('click', () => input.click());
    
    input.addEventListener('change', (e) => {
        selectedFiles = [...e.target.files];
        updatePreview();
        if (onImagesSelected) onImagesSelected(selectedFiles);
    });
    
    clearBtn.addEventListener('click', () => {
        selectedFiles = [];
        input.value = '';
        updatePreview();
        if (onImagesSelected) onImagesSelected(selectedFiles);
    });
    
    function updatePreview() {
        strip.innerHTML = '';
        clearBtn.style.display = selectedFiles.length > 0 ? 'inline' : 'none';
        btn.classList.toggle('has-images', selectedFiles.length > 0);
        
        selectedFiles.forEach(file => {
            const img = document.createElement('img');
            img.className = 'image-preview-item';
            img.src = URL.createObjectURL(file);
            strip.appendChild(img);
        });
    }
    
    container.appendChild(wrapper);
    
    return {
        getFiles: () => selectedFiles,
        clear: () => {
            selectedFiles = [];
            input.value = '';
            updatePreview();
        }
    };
}

/**
 * Create screen capture controls
 */
function createScreenCaptureUI(container, visionAgent) {
    const wrapper = document.createElement('div');
    wrapper.className = 'screen-capture-wrapper';
    wrapper.innerHTML = `
        <style>
            .screen-capture-wrapper {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .screen-capture-btn {
                width: 36px;
                height: 36px;
                border-radius: 50%;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.6);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                font-size: 16px;
            }
            .screen-capture-btn:hover {
                background: rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.9);
            }
            .screen-capture-btn.active {
                background: rgba(255,100,100,0.2);
                border-color: rgba(255,100,100,0.4);
                color: rgba(255,100,100,0.9);
                animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            .screen-interval-select {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.8);
                border-radius: 6px;
                padding: 4px 8px;
                font-size: 12px;
                display: none;
            }
        </style>
        <button class="screen-capture-btn" title="Screen watch">🖥️</button>
        <select class="screen-interval-select">
            <option value="5000">5s</option>
            <option value="10000">10s</option>
            <option value="30000">30s</option>
            <option value="60000">1m</option>
        </select>
    `;
    
    const btn = wrapper.querySelector('.screen-capture-btn');
    const select = wrapper.querySelector('.screen-interval-select');
    let isWatching = false;
    
    btn.addEventListener('click', async () => {
        if (isWatching) {
            visionAgent.stopScreenWatch();
            btn.classList.remove('active');
            btn.textContent = '🖥️';
            select.style.display = 'none';
            isWatching = false;
        } else {
            select.style.display = 'inline';
            const interval = parseInt(select.value);
            
            const success = await visionAgent.startScreenWatch(interval, (frame) => {
                console.log('📸 Screen captured');
                // Emit custom event for handling
                window.dispatchEvent(new CustomEvent('screenCaptured', { detail: frame }));
            });
            
            if (success) {
                btn.classList.add('active');
                btn.textContent = '⏹️';
                isWatching = true;
            }
        }
    });
    
    select.addEventListener('change', () => {
        if (isWatching) {
            const interval = parseInt(select.value);
            visionAgent.screenCapture.stopInterval();
            visionAgent.screenCapture.startInterval(interval, (frame) => {
                window.dispatchEvent(new CustomEvent('screenCaptured', { detail: frame }));
            });
        }
    });
    
    container.appendChild(wrapper);
    
    return {
        isActive: () => isWatching
    };
}

/**
 * Create ambient mode controls
 */
function createAmbientModeUI(container, visionAgent) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ambient-mode-wrapper';
    wrapper.innerHTML = `
        <style>
            .ambient-mode-wrapper {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .ambient-mode-btn {
                padding: 6px 12px;
                border-radius: 16px;
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.6);
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s;
            }
            .ambient-mode-btn:hover {
                background: rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.9);
            }
            .ambient-mode-btn.active {
                background: rgba(147,112,219,0.2);
                border-color: rgba(147,112,219,0.4);
                color: rgba(147,112,219,0.9);
            }
            .ambient-mode-btn.autonomous {
                background: rgba(255,165,0,0.2);
                border-color: rgba(255,165,0,0.4);
                color: rgba(255,165,0,0.9);
            }
            .ambient-status {
                font-size: 11px;
                color: rgba(255,255,255,0.4);
            }
        </style>
        <button class="ambient-mode-btn" data-mode="standard" title="Background thinking">🌙 Ambient</button>
        <button class="ambient-mode-btn" data-mode="autonomous" title="Autonomous mode">🚀 Auto</button>
        <span class="ambient-status"></span>
    `;
    
    const ambientBtn = wrapper.querySelector('[data-mode="standard"]');
    const autoBtn = wrapper.querySelector('[data-mode="autonomous"]');
    const status = wrapper.querySelector('.ambient-status');
    
    ambientBtn.addEventListener('click', () => {
        if (!visionAgent.ambientMode) {
            visionAgent.enableAmbientMode({
                onThinking: (mode, iter) => {
                    status.textContent = `${mode} ${iter}...`;
                },
                onResult: (text, iter) => {
                    status.textContent = `Done (${iter})`;
                },
                onComplete: () => {
                    status.textContent = 'Complete';
                    ambientBtn.classList.remove('active');
                    autoBtn.classList.remove('autonomous');
                }
            });
        }
        
        const ambient = visionAgent.ambientMode;
        
        if (ambient.running && !ambient.autonomous) {
            ambient.stop();
            ambientBtn.classList.remove('active');
            status.textContent = '';
        } else {
            ambient.start(false);
            ambientBtn.classList.add('active');
            autoBtn.classList.remove('autonomous');
            status.textContent = 'Idle watch...';
        }
    });
    
    autoBtn.addEventListener('click', () => {
        if (!visionAgent.ambientMode) {
            visionAgent.enableAmbientMode({
                onThinking: (mode, iter) => {
                    status.textContent = `${mode} ${iter}...`;
                },
                onResult: (text, iter) => {
                    status.textContent = `Iter ${iter}`;
                },
                onComplete: () => {
                    status.textContent = 'Complete';
                    ambientBtn.classList.remove('active');
                    autoBtn.classList.remove('autonomous');
                }
            });
        }
        
        const ambient = visionAgent.ambientMode;
        
        if (ambient.autonomous) {
            ambient.stop();
            autoBtn.classList.remove('autonomous');
            ambientBtn.classList.remove('active');
            status.textContent = '';
        } else {
            ambient.start(true);
            autoBtn.classList.add('autonomous');
            ambientBtn.classList.remove('active');
            status.textContent = 'Auto running...';
        }
    });
    
    container.appendChild(wrapper);
    
    return {
        recordInteraction: (query, response) => {
            if (visionAgent.ambientMode) {
                visionAgent.ambientMode.recordInteraction(query, response);
            }
        },
        getResult: () => {
            if (visionAgent.ambientMode) {
                return visionAgent.ambientMode.getAndClearResult();
            }
            return null;
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

// ES Module exports
export {
    // Classes
    VisionAgent,
    ScreenCapture,
    AmbientMode,
    
    // Utilities
    fileToBytes,
    createImageBlock,
    resizeImageIfNeeded,
    getImageFormat
};

// Also expose on window for non-module use
if (typeof window !== 'undefined') {
    window.VisionModule = {
        VisionAgent,
        ScreenCapture,
        AmbientMode,
        fileToBytes,
        createImageBlock,
        resizeImageIfNeeded,
        getImageFormat
    };
}

console.log('🔮 Vision module loaded.');
