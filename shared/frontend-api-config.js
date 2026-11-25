/**
 * LANE4 E-Commerce Frontend Configuration & Shared API Client
 * Centralized API configuration and request wrapper with Firebase Token integration.
 */

window.LANE4_CONFIG = window.LANE4_CONFIG || {
  API_BASE_URL: (function() {
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.port === '5000') {
        return '/api';
      }
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:5000/api';
      }
      if (window.location.protocol === 'file:') {
        return 'http://localhost:5000/api';
      }
    }
    return '/api';
  })(),
  ADMIN_URL: (function() {
    if (typeof window !== 'undefined' && window.location) {
      // If browsing as static files locally or through live-server on other ports
      if (window.location.protocol === 'file:') {
        return 'http://localhost:5000/admin/';
      }
      if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port && window.location.port !== '5000') {
        return 'http://localhost:5000/admin/';
      }
    }
    // In production (.in domain, vercel.app) or standard node server on port 5000
    return '/admin/';
  })(),
  CURRENCY_SYMBOL: '₹',
  STORE_NAME: 'The Lane4 Performance Store'
};

// Universal Admin Link Synchronizer
(function initAdminLinks() {
  function applyAdminLinks() {
    if (typeof window === 'undefined' || !window.location) return;
    const adminUrl = (window.LANE4_CONFIG && window.LANE4_CONFIG.ADMIN_URL) || '/admin/';
    const targets = document.querySelectorAll('.lane4-admin-link, [data-admin-link]');
    targets.forEach(function(el) {
      el.href = adminUrl;
      el.addEventListener('click', function(e) {
        if (window.location.protocol === 'file:') {
          e.preventDefault();
          window.location.href = 'http://localhost:5000/admin/';
        }
      });
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', applyAdminLinks);
    } else {
      applyAdminLinks();
    }
  }
})();

// Universal Background Pre-Warming: Keeps backend active & prewarms immediately on page load
(function prewarmBackend() {
  if (typeof window === 'undefined' || !window.location) return;
  try {
    const baseUrl = (window.LANE4_CONFIG && window.LANE4_CONFIG.API_BASE_URL) || '/api';
    fetch(`${baseUrl}/health`, { method: 'GET', keepalive: true, cache: 'no-store' }).catch(() => {});
    if (window.location.hostname && !window.location.hostname.includes('localhost') && window.location.hostname !== '127.0.0.1') {
      fetch('https://lane-4-ecommerce.onrender.com/api/health', { method: 'GET', mode: 'cors', keepalive: true, cache: 'no-store' }).catch(() => {});
    }
  } catch (_) {}
})();

/**
 * Universal API Request Function
 * Automatically attaches Firebase ID Token and Guest ID header.
 * Features automated retry with progressive backoff for seamless server connectivity.
 */
async function lane4ApiRequest(endpoint, options = {}) {
  const baseUrl = window.LANE4_CONFIG.API_BASE_URL;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers = { ...(options.headers || {}) };

  // Attach Guest Session ID
  let guestId = localStorage.getItem('lane4_guest_id');
  if (!guestId) {
    guestId = 'gst_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem('lane4_guest_id', guestId);
  }
  headers['x-guest-id'] = guestId;

  // Attach Authentication Token: Admin token ONLY on /admin paths, customer auth token ONLY on storefront
  const isAdminRequest = endpoint.includes('/admin') || (typeof window !== 'undefined' && window.location && window.location.pathname.includes('/admin'));
  const isAuthAction = endpoint.includes('/auth/login') || endpoint.includes('/auth/admin/login') || endpoint.includes('/auth/register');
  const adminToken = localStorage.getItem('lane4_admin_token');
  const userToken = localStorage.getItem('lane4_auth_token');
  const authToken = isAdminRequest ? adminToken : userToken;

  if (!isAuthAction && authToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Handle FormData vs JSON
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const MAX_RETRIES = 7;
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      // Handle 502 Bad Gateway, 503 Service Unavailable, 504 Gateway Timeout during spinup
      if ((response.status === 502 || response.status === 503 || response.status === 504) && attempt < MAX_RETRIES) {
        const waitSec = Math.min(3 + attempt * 2, 8);
        console.warn(`[LANE4 API] Gateway status ${response.status}. Retrying connection in ${waitSec}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        window.dispatchEvent(new CustomEvent('lane4:server-waking-up', {
          detail: { attempt: attempt + 1, maxRetries: MAX_RETRIES, waitSec }
        }));
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // Handle session expiration cleanly without clobbering other sessions
        if (response.status === 401) {
          if (isAdminRequest) {
            localStorage.removeItem('lane4_admin_token');
            window.dispatchEvent(new CustomEvent('lane4:admin-auth-expired'));
          } else if (userToken) {
            localStorage.removeItem('lane4_auth_token');
            localStorage.removeItem('lane4_user');
            window.dispatchEvent(new CustomEvent('lane4:auth-expired'));
          }
        }

        let errorMsg = (data.error && data.error.message) || data.message;
        if (!errorMsg) {
          if (response.status === 502 || response.status === 503 || response.status === 504) {
            errorMsg = 'Service is temporarily unavailable. Please try again shortly.';
          } else {
            errorMsg = 'Network request failed';
          }
        }

        const error = new Error(errorMsg);
        error.code = (data.error && data.error.code) || `HTTP_${response.status}`;
        error.status = response.status;
        error.details = data.error ? data.error.details : null;
        throw error;
      }

      return data;
    } catch (err) {
      lastError = err;
      // Do not retry standard 4xx client errors (400, 401, 403, 404, etc.)
      if (err.status && err.status < 500) {
        throw err;
      }
      // If network fetch failed before receiving response headers
      if (attempt < MAX_RETRIES && (!err.status || err.status >= 500)) {
        const waitSec = Math.min(3 + attempt * 2, 8);
        console.warn(`[LANE4 API] Connection pending (${err.message}). Retrying in ${waitSec}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
        window.dispatchEvent(new CustomEvent('lane4:server-waking-up', {
          detail: { attempt: attempt + 1, maxRetries: MAX_RETRIES, waitSec }
        }));
        await new Promise(r => setTimeout(r, waitSec * 1000));
        continue;
      }
      console.error(`[LANE4 API ERROR] ${options.method || 'GET'} ${url}:`, err);
      throw err;
    }
  }

  throw lastError || new Error('Network request failed');
}

// Global exposure
window.lane4ApiRequest = lane4ApiRequest;

// Universal HTML entity sanitizer to protect against stored DOM XSS
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;
if (window.LANE4) {
  window.LANE4.escapeHtml = escapeHtml;
}

