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

/**
 * Universal API Request Function
 * Automatically attaches Firebase ID Token and Guest ID header.
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

  // Attach Authentication Token: Admin token prioritized on admin paths, customer auth token on store
  const isAdminRequest = endpoint.includes('/admin') || (typeof window !== 'undefined' && window.location && window.location.pathname.includes('/admin'));
  const adminToken = localStorage.getItem('lane4_admin_token');
  const userToken = localStorage.getItem('lane4_auth_token');
  const authToken = (isAdminRequest && adminToken) ? adminToken : (adminToken || userToken);

  if (authToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Handle FormData vs JSON
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

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

      const errorMsg = (data.error && data.error.message) || data.message || 'Network request failed';
      const error = new Error(errorMsg);
      error.code = (data.error && data.error.code) || 'API_ERROR';
      error.status = response.status;
      error.details = data.error ? data.error.details : null;
      throw error;
    }

    return data;
  } catch (err) {
    console.error(`[LANE4 API ERROR] ${options.method || 'GET'} ${url}:`, err);
    throw err;
  }
}

// Global exposure
window.lane4ApiRequest = lane4ApiRequest;

