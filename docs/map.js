/**
 * 🗺️ Map Module for agi.diy
 * 
 * Full-screen Google Maps background with location tracking.
 * Clean, transparent, minimal - the map is just ambiance.
 */

// Dark mode map styles
const DARK_MAP_STYLES = [
    { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "saturation": 36 }, { "color": "#000000" }, { "lightness": 40 }] },
    { "featureType": "all", "elementType": "labels.text.stroke", "stylers": [{ "visibility": "on" }, { "color": "#000000" }, { "lightness": 16 }] },
    { "featureType": "all", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
    { "featureType": "administrative", "elementType": "geometry.fill", "stylers": [{ "color": "#000000" }, { "lightness": 20 }] },
    { "featureType": "administrative", "elementType": "geometry.stroke", "stylers": [{ "color": "#000000" }, { "lightness": 17 }, { "weight": 1.2 }] },
    { "featureType": "administrative.locality", "elementType": "all", "stylers": [{ "visibility": "on" }] },
    { "featureType": "administrative.neighborhood", "elementType": "all", "stylers": [{ "visibility": "off" }] },
    { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#000000" }, { "lightness": 20 }] },
    { "featureType": "poi", "elementType": "geometry", "stylers": [{ "color": "#000000" }, { "lightness": 21 }] },
    { "featureType": "road.highway", "elementType": "all", "stylers": [{ "visibility": "simplified" }] },
    { "featureType": "road.highway", "elementType": "geometry.fill", "stylers": [{ "color": "#000000" }, { "lightness": 17 }] },
    { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#000000" }, { "lightness": 29 }, { "weight": 0.2 }] },
    { "featureType": "road.highway", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
    { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#000000" }, { "lightness": 18 }] },
    { "featureType": "road.local", "elementType": "geometry", "stylers": [{ "color": "#000000" }, { "lightness": 16 }] },
    { "featureType": "transit", "elementType": "geometry", "stylers": [{ "color": "#000000" }, { "lightness": 19 }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }, { "lightness": 17 }] }
];

// Ultra minimal dark style (even more subtle)
const ULTRA_MINIMAL_STYLES = [
    { "featureType": "all", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
    { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "visibility": "off" }] },
    { "featureType": "landscape", "elementType": "geometry", "stylers": [{ "color": "#0a0a0a" }] },
    { "featureType": "poi", "elementType": "all", "stylers": [{ "visibility": "off" }] },
    { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#111111" }] },
    { "featureType": "road", "elementType": "geometry.stroke", "stylers": [{ "visibility": "off" }] },
    { "featureType": "transit", "elementType": "all", "stylers": [{ "visibility": "off" }] },
    { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#050505" }] }
];

class MapBackground {
    constructor(options = {}) {
        this.apiKey = options.apiKey || localStorage.getItem('google_maps_api_key') || '';
        this.mapId = options.mapId || localStorage.getItem('google_maps_map_id') || '';
        this.containerId = options.containerId || 'map-background';
        this.map = null;
        this.userMarker = null;
        this.watchId = null;
        this.ready = false;
        this.position = null;
        this.onLocationUpdate = options.onLocationUpdate || null;
        this.styleMode = options.styleMode || 'dark'; // 'dark' or 'ultra-minimal'
        this.markers = new Map();
        
        // Default center (will update with user location)
        this.center = options.center || { lat: 37.7749, lng: -122.4194 };
        this.zoom = options.zoom || 15;
        
        // Map opacity for background effect
        this.opacity = options.opacity || 0.6;
    }
    
    /**
     * Load Google Maps API dynamically
     */
    async loadAPI() {
        if (window.google?.maps?.Map && window.google?.maps?.marker?.AdvancedMarkerElement) {
            return true;
        }
        
        if (!this.apiKey) {
            console.warn('🗺️ No Google Maps API key configured');
            return false;
        }
        
        return new Promise((resolve) => {
            // Define callback for when API is ready
            const callbackName = 'initGoogleMaps_' + Date.now();
            window[callbackName] = () => {
                delete window[callbackName];
                console.log('🗺️ Google Maps API loaded');
                resolve(true);
            };
            
            const script = document.createElement('script');
            // Load marker library for AdvancedMarkerElement
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=marker&callback=${callbackName}`;
            script.async = true;
            script.defer = true;
            
            script.onerror = () => {
                delete window[callbackName];
                console.error('🗺️ Failed to load Google Maps API');
                resolve(false);
            };
            
            document.head.appendChild(script);
        });
    }
    
    /**
     * Create the map container element
     */
    createContainer() {
        let container = document.getElementById(this.containerId);
        
        if (!container) {
            container = document.createElement('div');
            container.id = this.containerId;
            // Insert as first child of body, before everything else
            document.body.insertBefore(container, document.body.firstChild);
        }
        
        // Map is always 100% visible - UI overlay transparency is controlled separately
        container.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            z-index: -1;
            opacity: 1;
            pointer-events: none;
        `;
        
        return container;
    }
    
    /**
     * Initialize the map
     */
    async init() {
        const apiLoaded = await this.loadAPI();
        if (!apiLoaded) {
            console.warn('🗺️ Map initialization skipped - no API key');
            return false;
        }
        
        const container = this.createContainer();
        
        const styles = this.styleMode === 'ultra-minimal' ? ULTRA_MINIMAL_STYLES : DARK_MAP_STYLES;
        
        try {
            const mapOptions = {
                center: this.center,
                zoom: this.zoom,
                disableDefaultUI: true,
                zoomControl: false,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
                gestureHandling: 'none', // Disable all gestures - it's just background
                styles: styles,
                backgroundColor: '#0a0a0a'
            };
            
            // Add mapId if available (required for AdvancedMarkerElement)
            if (this.mapId) {
                mapOptions.mapId = this.mapId;
                console.log('🗺️ Using Map ID for Advanced Markers');
            }
            
            this.map = new google.maps.Map(container, mapOptions);
            
            // Wait for map to be ready before adding marker
            google.maps.event.addListenerOnce(this.map, 'idle', () => {
                this.createUserMarker();
            });
            
            // Start watching location
            this.startLocationTracking();
            
            this.ready = true;
            console.log('🗺️ Map background initialized');
            
            return true;
        } catch (err) {
            console.error('🗺️ Map init error:', err);
            return false;
        }
    }
    
    /**
     * Create a custom pulsing marker for user location
     */
    createUserMarker() {
        if (!this.map) return;
        
        // Add marker styles for CSS-based pulse effect
        if (!document.getElementById('map-marker-styles')) {
            const style = document.createElement('style');
            style.id = 'map-marker-styles';
            style.textContent = `
                .user-location-marker {
                    position: relative;
                    width: 24px;
                    height: 24px;
                }
                .marker-dot {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 12px;
                    height: 12px;
                    background: rgba(100, 150, 255, 0.9);
                    border: 2px solid rgba(255, 255, 255, 0.8);
                    border-radius: 50%;
                    box-shadow: 0 0 10px rgba(100, 150, 255, 0.5);
                }
                .pulse-ring {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 24px;
                    height: 24px;
                    background: rgba(100, 150, 255, 0.3);
                    border-radius: 50%;
                    animation: pulse-ring 2s ease-out infinite;
                }
                @keyframes pulse-ring {
                    0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(3); opacity: 0; }
                }
                .custom-marker {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    cursor: pointer;
                }
                .custom-marker-pin {
                    width: 24px;
                    height: 24px;
                    border-radius: 50% 50% 50% 0;
                    transform: rotate(-45deg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                }
                .custom-marker-pin span {
                    transform: rotate(45deg);
                    font-size: 14px;
                }
                .custom-marker-label {
                    font-size: 10px;
                    font-weight: 600;
                    color: white;
                    text-shadow: 0 1px 3px rgba(0,0,0,0.8);
                    margin-top: 4px;
                    white-space: nowrap;
                }
            `;
            document.head.appendChild(style);
        }
        
        try {
            // Use AdvancedMarkerElement if Map ID is set, otherwise fall back to Marker
            if (this.mapId && window.google?.maps?.marker?.AdvancedMarkerElement) {
                const markerElement = document.createElement('div');
                markerElement.className = 'user-location-marker';
                markerElement.innerHTML = `
                    <div class="pulse-ring"></div>
                    <div class="marker-dot"></div>
                `;
                
                this.userMarker = new google.maps.marker.AdvancedMarkerElement({
                    map: this.map,
                    position: this.center,
                    content: markerElement,
                    title: 'Your location'
                });
                this.useAdvancedMarkers = true;
            } else {
                // Fallback to regular Marker (works without Map ID)
                this.userMarker = new google.maps.Marker({
                    map: this.map,
                    position: this.center,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: '#6496ff',
                        fillOpacity: 0.9,
                        strokeColor: '#ffffff',
                        strokeWeight: 2
                    },
                    title: 'Your location'
                });
                this.useAdvancedMarkers = false;
            }
        } catch (err) {
            console.warn('🗺️ Could not create marker:', err);
        }
    }
    
    /**
     * Start watching user location
     */
    startLocationTracking() {
        if (!navigator.geolocation) {
            console.warn('🗺️ Geolocation not supported');
            return;
        }
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                this.updateLocation(position);
            },
            (error) => {
                console.warn('🗺️ Geolocation error:', error.message);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            }
        );
    }
    
    /**
     * Update user location on map
     */
    updateLocation(position) {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const newPosition = { lat, lng };
        
        this.position = {
            lat,
            lng,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            speed: position.coords.speed,
            heading: position.coords.heading,
            timestamp: position.timestamp
        };
        
        if (this.map) {
            try {
                // Smoothly pan to new location
                this.map.panTo(newPosition);
                
                // Update marker position
                if (this.userMarker) {
                    if (this.useAdvancedMarkers) {
                        this.userMarker.position = newPosition;
                    } else if (this.userMarker.setPosition) {
                        this.userMarker.setPosition(newPosition);
                    }
                }
            } catch (err) {
                console.warn('🗺️ Map update error:', err);
            }
        }
        
        // Callback for external use
        if (this.onLocationUpdate) {
            this.onLocationUpdate(this.position);
        }
        
        console.log(`🗺️ Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
    }
    
    /**
     * Set map opacity
     */
    setOpacity(opacity) {
        this.opacity = opacity;
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.opacity = opacity;
        }
    }
    
    /**
     * Toggle map visibility
     */
    toggle(show = true) {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.display = show ? 'block' : 'none';
        }
    }
    
    /**
     * Enable/disable map interactions
     */
    setInteractive(interactive) {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.pointerEvents = interactive ? 'auto' : 'none';
        }
        if (this.map) {
            this.map.setOptions({
                gestureHandling: interactive ? 'auto' : 'none'
            });
        }
    }
    
    /**
     * Get current position
     */
    getPosition() {
        return this.position;
    }
    
    /**
     * Pan to specific location
     */
    panTo(lat, lng, zoom = null) {
        if (this.map) {
            this.map.panTo({ lat, lng });
            if (zoom !== null) {
                this.map.setZoom(zoom);
            }
        }
    }
    
    /**
     * Add custom marker (with fallback for no Map ID)
     */
    addMarker(lat, lng, options = {}) {
        if (!this.map) return null;
        
        const id = options.id || `marker-${Date.now()}`;
        const color = options.color || '#ff6b6b';
        const emoji = options.emoji || '📍';
        const label = options.label || '';
        
        try {
            let marker;
            
            if (this.useAdvancedMarkers && window.google?.maps?.marker?.AdvancedMarkerElement) {
                // Use AdvancedMarkerElement with custom HTML
                const markerElement = document.createElement('div');
                markerElement.className = 'custom-marker';
                markerElement.innerHTML = `
                    <div class="custom-marker-pin" style="background: ${color};">
                        <span>${emoji}</span>
                    </div>
                    ${label ? `<div class="custom-marker-label">${label}</div>` : ''}
                `;
                
                marker = new google.maps.marker.AdvancedMarkerElement({
                    map: this.map,
                    position: { lat, lng },
                    content: markerElement,
                    title: options.title || label || ''
                });
            } else {
                // Fallback to regular Marker
                marker = new google.maps.Marker({
                    map: this.map,
                    position: { lat, lng },
                    icon: {
                        path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                        scale: 6,
                        fillColor: color,
                        fillOpacity: 0.9,
                        strokeColor: '#ffffff',
                        strokeWeight: 2
                    },
                    label: label ? {
                        text: label,
                        color: '#ffffff',
                        fontSize: '10px',
                        fontWeight: 'bold'
                    } : undefined,
                    title: options.title || label || ''
                });
            }
            
            // Store marker for management
            this.markers.set(id, { marker, useAdvanced: this.useAdvancedMarkers });
            
            // Add click handler if provided
            if (options.onClick) {
                marker.addListener('click', () => options.onClick(id, { lat, lng, ...options }));
            }
            
            return { id, marker };
        } catch (err) {
            console.warn('🗺️ Could not add marker:', err);
            return null;
        }
    }
    
    /**
     * Remove a marker by ID
     */
    removeMarker(id) {
        const entry = this.markers.get(id);
        if (entry) {
            if (entry.useAdvanced) {
                entry.marker.map = null;
            } else {
                entry.marker.setMap(null);
            }
            this.markers.delete(id);
            return true;
        }
        return false;
    }
    
    /**
     * Clear all custom markers (not user location)
     */
    clearMarkers() {
        for (const [id, entry] of this.markers) {
            if (entry.useAdvanced) {
                entry.marker.map = null;
            } else {
                entry.marker.setMap(null);
            }
        }
        this.markers.clear();
    }
    
    /**
     * Get all marker IDs
     */
    getMarkerIds() {
        return Array.from(this.markers.keys());
    }
    
    /**
     * Update marker position
     */
    updateMarker(id, lat, lng) {
        const entry = this.markers.get(id);
        if (entry) {
            if (entry.useAdvanced) {
                entry.marker.position = { lat, lng };
            } else {
                entry.marker.setPosition({ lat, lng });
            }
            return true;
        }
        return false;
    }
    
    /**
     * Clean up
     */
    destroy() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        
        const container = document.getElementById(this.containerId);
        if (container) {
            container.remove();
        }
        
        this.map = null;
        this.userMarker = null;
        this.ready = false;
        
        console.log('🗺️ Map background destroyed');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAP UI CONTROLS
// ═══════════════════════════════════════════════════════════════════════════

function createMapControls(container, mapInstance) {
    const wrapper = document.createElement('div');
    wrapper.className = 'map-controls';
    wrapper.innerHTML = `
        <style>
            .map-controls {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            .map-btn {
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
            .map-btn:hover {
                background: rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.9);
            }
            .map-btn.active {
                background: rgba(100,150,255,0.2);
                border-color: rgba(100,150,255,0.4);
                color: rgba(100,150,255,0.9);
            }
            .map-opacity-slider {
                width: 80px;
                height: 4px;
                -webkit-appearance: none;
                background: rgba(255,255,255,0.1);
                border-radius: 2px;
                outline: none;
            }
            .map-opacity-slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: rgba(255,255,255,0.8);
                cursor: pointer;
            }
            .map-location-info {
                font-size: 11px;
                color: rgba(255,255,255,0.4);
                font-family: 'SF Mono', monospace;
            }
        </style>
        
        <button class="map-btn" id="mapToggleBtn" title="Toggle map">🗺️</button>
        <input type="range" class="map-opacity-slider" id="mapOpacity" min="0" max="100" value="60" title="Map opacity">
        <span class="map-location-info" id="mapLocationInfo"></span>
    `;
    
    const toggleBtn = wrapper.querySelector('#mapToggleBtn');
    const opacitySlider = wrapper.querySelector('#mapOpacity');
    const locationInfo = wrapper.querySelector('#mapLocationInfo');
    
    let isVisible = true;
    
    toggleBtn.addEventListener('click', () => {
        isVisible = !isVisible;
        mapInstance.toggle(isVisible);
        toggleBtn.classList.toggle('active', isVisible);
    });
    
    opacitySlider.addEventListener('input', (e) => {
        mapInstance.setOpacity(e.target.value / 100);
    });
    
    // Update location info
    if (mapInstance.onLocationUpdate) {
        const originalCallback = mapInstance.onLocationUpdate;
        mapInstance.onLocationUpdate = (pos) => {
            originalCallback(pos);
            locationInfo.textContent = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
        };
    } else {
        mapInstance.onLocationUpdate = (pos) => {
            locationInfo.textContent = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
        };
    }
    
    container.appendChild(wrapper);
    
    return {
        updateLocation: (pos) => {
            locationInfo.textContent = `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`;
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export {
    MapBackground,
    createMapControls,
    DARK_MAP_STYLES,
    ULTRA_MINIMAL_STYLES
};

// Also expose on window for non-module use
if (typeof window !== 'undefined') {
    window.MapModule = {
        MapBackground,
        createMapControls,
        DARK_MAP_STYLES,
        ULTRA_MINIMAL_STYLES
    };
}

console.log('🗺️ Map module loaded.');
