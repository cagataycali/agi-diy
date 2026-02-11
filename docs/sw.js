/**
 * agi.diy Service Worker
 * Enables PWA functionality, offline support, and background notifications
 */

const CACHE_NAME = 'agi-diy-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/agi.html',
  '/mesh.html',
  '/strands.js',
  '/webllm.js',
  '/agent-mesh.js',
  '/manifest.json',
  'https://cdn.jsdelivr.net/npm/marked/marked.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap'
];

// Install - cache assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  const url = new URL(event.request.url);
  
  // Skip unsupported schemes (chrome-extension, etc)
  if (!url.protocol.startsWith('http')) return;
  
  // Skip API requests (Anthropic, OpenAI, WebLLM CDN)
  if (url.hostname.includes('anthropic.com') || 
      url.hostname.includes('openai.com') ||
      url.hostname.includes('esm.run') ||
      url.hostname.includes('huggingface.co') ||
      url.hostname.includes('cdn.jsdelivr.net')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request).then((response) => {
          // Don't cache non-successful responses or non-basic types
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          // Clone and cache
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          return response;
        });
      })
      .catch(() => {
        // Return offline fallback if available
        return caches.match('/');
      })
  );
});

// Push notification received
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = { title: 'agi.diy', body: 'New message', icon: '/icon-192.svg' };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/icon-192.svg',
    badge: '/icon-192.svg',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      timestamp: Date.now()
    },
    actions: data.actions || [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    tag: data.tag || 'agi-notification',
    renotify: true,
    requireInteraction: data.requireInteraction || false
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || '/');
        }
      })
  );
});

// Message from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag, actions, url, requireInteraction } = event.data;
    
    self.registration.showNotification(title || 'agi.diy', {
      body: body || '',
      icon: icon || '/icon-192.svg',
      badge: '/icon-192.svg',
      vibrate: [100, 50, 100],
      tag: tag || 'agi-notification-' + Date.now(),
      renotify: true,
      requireInteraction: requireInteraction || false,
      data: { url: url || '/' },
      actions: actions || []
    });
  }
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync (for queued messages)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'send-message') {
    event.waitUntil(
      // Process queued messages from IndexedDB
      processQueuedMessages()
    );
  }
});

async function processQueuedMessages() {
  // This would read from IndexedDB and process queued messages
  // For now, just log
  console.log('[SW] Processing queued messages...');
}

console.log('[SW] Service Worker loaded');
