/**
 * LANE4 Operations Portal Client Script
 * Complete management of Products Catalog, Categories, Coupons, Orders, Payments & Inventory.
 */

(function () {
  let activeAdmin = null;

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function toMillis(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val < 1e11 ? val * 1000 : val;
    if (typeof val === 'object') {
      if (typeof val._seconds === 'number') return val._seconds * 1000 + (val._nanoseconds || 0) / 1e6;
      if (typeof val.seconds === 'number') return val.seconds * 1000 + (val.nanoseconds || 0) / 1e6;
      if (typeof val.toMillis === 'function') return val.toMillis();
      if (typeof val.getTime === 'function') return val.getTime();
      if (val instanceof Date) return val.getTime();
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  }

  function resolveAdminAsset(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    const clean = url.replace(/^(\.\.\/|\.\/|\/)+/, '');
    if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
      return `../${clean}`;
    }
    return `/${clean}`;
  }

  // Universal timestamp formatting helper handling Firestore Timestamps, ISO strings & ms
  function formatDateTime(val, dateOnly) {
    if (!val) return '—';
    const ms = toMillis(val);
    if (!ms) return '—';
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '—';
    if (dateOnly) {
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function formatLogDate(val) {
    if (!val) return '—';
    const ms = toMillis(val);
    if (!ms) return '—';
    const d = new Date(ms);
    if (isNaN(d.getTime())) return '—';
    const dateStr = d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST';

    return `
      <div style="display:flex;flex-direction:column;gap:3px;">
        <div style="font-weight:700;font-size:13px;color:#0f172a;display:inline-flex;align-items:center;gap:6px;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <span>${escapeHtml(dateStr)}</span>
        </div>
        <div style="font-size:11.5px;color:#64748b;display:inline-flex;align-items:center;gap:6px;padding-left:1px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          <span>${escapeHtml(timeStr)}</span>
        </div>
      </div>
    `;
  }

  function formatActionBadge(action) {
    if (!action) return '<span class="badge">ACTION</span>';
    const cleanAction = action.replace(/_/g, ' ').toUpperCase();
    let badgeStyle = 'background:#f1f5f9;color:#334155;border:1px solid #cbd5e1;';
    let icon = '';

    if (/approved|verified|confirmed|success|created/i.test(action)) {
      badgeStyle = 'background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0;';
      icon = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (/rejected|deleted|cancelled|failed/i.test(action)) {
      badgeStyle = 'background:#fef2f2;color:#b91c1c;border:1px solid #fecaca;';
      icon = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="margin-right:4px;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    } else if (/tracking|shipped|dispatched|fulfillment/i.test(action)) {
      badgeStyle = 'background:#f0f9ff;color:#0369a1;border:1px solid #bae6fd;';
      icon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>';
    } else if (/status|updated|adjusted|modified/i.test(action)) {
      badgeStyle = 'background:#faf5ff;color:#7e22ce;border:1px solid #e9d5ff;';
      icon = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
    } else if (/login|auth/i.test(action)) {
      badgeStyle = 'background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;';
      icon = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right:4px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
    }

    return `<span class="badge" style="${badgeStyle}font-size:10.5px;padding:4px 9px;letter-spacing:0.5px;display:inline-flex;align-items:center;">${icon}${escapeHtml(cleanAction)}</span>`;
  }

  function formatResource(resType, resId) {
    if (!resType && !resId) return '<span style="color:#94a3b8;">—</span>';
    const type = (resType || '').toLowerCase();
    const id = (resId || '').trim();
    const shortId = id.length > 12 ? `${id.slice(0, 10)}…` : id;

    let icon = '';
    if (type.includes('order')) {
      icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px;"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>';
    } else if (type.includes('payment')) {
      icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px;"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
    } else if (type.includes('product')) {
      icon = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:middle;margin-right:4px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>';
    }

    return `<span style="display:inline-flex;align-items:center;background:#f8fafc;border:1px solid #e2e8f0;padding:3px 8px;border-radius:4px;font-family:monospace;font-size:11px;font-weight:600;color:#334155;" title="${escapeHtml(`${resType}/${resId}`)}">${icon}${escapeHtml(`${resType}/${shortId}`)}</span>`;
  }

  function formatLogDetails(action, details, resourceType, resourceId) {
    if (!details || typeof details !== 'object' || Object.keys(details).length === 0) {
      return '<span style="color:#94a3b8;font-style:italic;font-size:12px;">No additional parameters</span>';
    }

    const d = details;

    // 1. Shipment / Tracking Added
    if (action === 'tracking_added' || d.courierName || d.trackingNumber) {
      return `
        <div style="display:flex;flex-direction:column;gap:5px;max-width:520px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-weight:700;color:#0f172a;font-size:13px;display:inline-flex;align-items:center;gap:4px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
              ${escapeHtml(d.courierName || 'Courier')}
            </span>
            <span style="background:#f1f5f9;color:#0f172a;padding:2px 8px;border-radius:4px;font-family:monospace;font-size:12px;font-weight:700;border:1px solid #e2e8f0;">
              AWB: ${escapeHtml(d.trackingNumber || '—')}
            </span>
            ${d.trackingUrl ? `
              <a href="${escapeHtml(d.trackingUrl)}" target="_blank" rel="noopener noreferrer" style="color:#0284c7;font-weight:700;font-size:11px;text-decoration:none;display:inline-flex;align-items:center;gap:3px;background:#f0f9ff;border:1px solid #bae6fd;padding:2px 8px;border-radius:4px;">
                <span>Track Package</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            ` : ''}
          </div>
        </div>
      `;
    }

    // 1b. Admin Login Event
    if (action === 'admin_login') {
      return `
        <div style="display:inline-flex;align-items:center;gap:8px;font-size:12px;">
          <span style="display:inline-flex;align-items:center;gap:4px;color:#15803d;background:#f0fdf4;border:1px solid #bbf7d0;padding:2px 8px;border-radius:4px;font-weight:700;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Authenticated Session
          </span>
          <span style="font-family:monospace;font-size:11px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;">
            IP: ${escapeHtml(d.ip || '127.0.0.1')}
          </span>
        </div>
      `;
    }

    // 2. Order Status Update
    if (action === 'order_status_updated' || (d.previousStatus !== undefined && d.newStatus !== undefined)) {
      const prev = (d.previousStatus || '—').replace(/_/g, ' ').toUpperCase();
      const next = (d.newStatus || '—').replace(/_/g, ' ').toUpperCase();
      return `
        <div style="display:inline-flex;align-items:center;gap:8px;font-size:12px;">
          <span style="color:#64748b;background:#f1f5f9;padding:2px 8px;border-radius:4px;font-weight:600;text-decoration:line-through;">${escapeHtml(prev)}</span>
          <span style="color:#94a3b8;font-weight:800;">&rarr;</span>
          <span class="badge badge-${escapeHtml(d.newStatus || 'active')}" style="padding:3px 9px;">${escapeHtml(next)}</span>
        </div>
      `;
    }

    // 3. Payment Verified / Approved
    if (action === 'payment_approved' || action === 'payment_verified') {
      const amount = d.amountPaise ? (window.LANE4 && window.LANE4.formatINR ? window.LANE4.formatINR(d.amountPaise) : `₹${(d.amountPaise / 100).toFixed(2)}`) : '';
      return `
        <div style="display:flex;flex-direction:column;gap:4px;max-width:520px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="color:#16a34a;font-weight:700;font-size:12px;">Payment Approved</span>
            ${amount ? `<span style="font-weight:800;color:#0f172a;font-size:12px;">${amount}</span>` : ''}
            ${d.upiReferenceNumber ? `<span style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:11px;color:#334155;border:1px solid #e2e8f0;">UTR: ${escapeHtml(d.upiReferenceNumber)}</span>` : ''}
          </div>
          ${d.internalNote ? `<div style="font-size:11px;color:#64748b;font-style:italic;">Note: "${escapeHtml(d.internalNote)}"</div>` : ''}
        </div>
      `;
    }

    // 4. Payment Rejected
    if (action === 'payment_rejected') {
      return `
        <div style="display:flex;flex-direction:column;gap:4px;max-width:520px;">
          <span style="color:#dc2626;font-weight:700;font-size:12px;">Payment Rejected</span>
          ${d.reason ? `<div style="font-size:11px;color:#b91c1c;background:#fef2f2;border:1px solid #fecaca;padding:4px 8px;border-radius:4px;">Reason: ${escapeHtml(d.reason)}</div>` : ''}
        </div>
      `;
    }

    // 5. Inventory Stock Adjustment
    if (action === 'stock_adjusted' || (d.sku && d.newAvailable !== undefined)) {
      const diff = d.difference !== undefined ? d.difference : (d.newAvailable - d.previousAvailable);
      return `
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;">
          <code style="background:#f1f5f9;border:1px solid #e2e8f0;padding:2px 6px;border-radius:4px;font-weight:700;">${escapeHtml(d.sku || '')}</code>
          <span>Stock: ${d.previousAvailable ?? '—'} &rarr; <strong style="color:#0f172a;">${d.newAvailable ?? '—'}</strong></span>
          ${diff !== undefined && !isNaN(diff) ? `<span style="color:${diff >= 0 ? '#16a34a' : '#dc2626'};font-weight:700;">(${diff > 0 ? '+' : ''}${diff})</span>` : ''}
          ${d.reason ? `<span style="font-size:11px;color:#64748b;font-style:italic;">"${escapeHtml(d.reason)}"</span>` : ''}
        </div>
      `;
    }

    // 6. Generic/Fallback: Clean, formatted Key-Value Chips (filtering out internal Firestore objects)
    const items = Object.entries(d).filter(([k, v]) => {
      if (k === 'createdAt' || k === 'updatedAt' || k === 'timestamp') return false;
      if (v === null || v === undefined || v === '') return false;
      return true;
    });

    if (items.length === 0) {
      return '<span style="color:#94a3b8;font-size:12px;">Updated successfully</span>';
    }

    return `
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;max-width:540px;">
        ${items.map(([k, v]) => {
          const label = k.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
          let displayVal = typeof v === 'object' ? JSON.stringify(v) : String(v);
          if (displayVal.length > 50) displayVal = displayVal.slice(0, 47) + '...';
          return `
            <span style="display:inline-flex;align-items:center;gap:4px;background:#f8fafc;border:1px solid #e2e8f0;padding:3px 8px;border-radius:4px;font-size:11px;">
              <span style="color:#64748b;font-weight:500;">${escapeHtml(label)}:</span>
              <strong style="color:#0f172a;font-weight:700;">${escapeHtml(displayVal)}</strong>
            </span>
          `;
        }).join('')}
      </div>
    `;
  }

  // --- ACTIVE VIEW PERSISTENCE ---
  function getInitialView() {
    const hash = (window.location.hash || '').replace('#', '').trim();
    const validViews = ['dashboard', 'payments', 'orders', 'inventory', 'products', 'categories', 'coupons', 'customers', 'enquiries', 'settings', 'logs'];
    if (validViews.includes(hash)) return hash;
    const saved = localStorage.getItem('lane4_admin_active_view');
    if (validViews.includes(saved)) return saved;
    return 'dashboard';
  }

  // --- AUTHENTICATION & SESSION PERSISTENCE ---
  function parseJwt(token) {
    try {
      if (!token || typeof token !== 'string') return null;
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const base64Url = parts[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  function updateAdminUserDisplay(admin) {
    const userDisplay = document.getElementById('admin-user-display');
    if (!userDisplay) return;
    const email = (admin && admin.email) || 'admin@lane4swim.in';
    userDisplay.innerHTML = `
      <div style="font-weight:700;color:#f8fafc;font-size:12px;line-height:1.2;">Staff: Chief Admin</div>
      <div style="font-size:11px;color:#94a3b8;line-height:1.2;margin-top:2px;">${escapeHtml(email)}</div>
    `;
  }

  async function checkAdminAuth() {
    const adminToken = localStorage.getItem('lane4_admin_token');
    const loginScreen = document.getElementById('admin-login-screen');

    if (!adminToken) {
      if (loginScreen) loginScreen.style.display = 'flex';
      setupLoginForm();
      return;
    }

    // Client-side JWT inspection for instant, zero-delay rendering on page refresh
    const payload = parseJwt(adminToken);
    const now = Math.floor(Date.now() / 1000);

    if (!payload || (payload.exp && payload.exp < now)) {
      console.warn('Admin token has expired or is invalid.');
      localStorage.removeItem('lane4_admin_token');
      localStorage.removeItem('lane4_admin_user');
      if (loginScreen) {
        loginScreen.style.display = 'flex';
        const alertEl = document.getElementById('admin-login-alert');
        if (alertEl) {
          alertEl.style.display = 'block';
          alertEl.style.background = '#fef2f2';
          alertEl.style.color = '#b91c1c';
          alertEl.textContent = 'Administrator session has expired. Please sign in again.';
        }
      }
      setupLoginForm();
      return;
    }

    // Token is valid: immediately hide login screen and initialize console
    if (loginScreen) loginScreen.style.display = 'none';

    // Restore cached admin user profile
    const savedUser = localStorage.getItem('lane4_admin_user');
    let adminProfile = null;
    try { adminProfile = savedUser ? JSON.parse(savedUser) : null; } catch (_) {}
    activeAdmin = adminProfile || {
      email: payload.email || 'admin@lane4swim.in',
      role: payload.role || 'super_admin',
      uid: payload.uid
    };

    updateAdminUserDisplay(activeAdmin);
    initAdminPanel();

    // Verify token with backend asynchronously without blocking or flashing UI
    verifyAdminSessionWithServer(adminToken);
  }

  async function verifyAdminSessionWithServer(token) {
    try {
      const res = await window.lane4ApiRequest('/auth/admin/verify', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res && res.data && res.data.admin) {
        activeAdmin = res.data.admin;
        localStorage.setItem('lane4_admin_user', JSON.stringify(res.data.admin));
        updateAdminUserDisplay(activeAdmin);
      }
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        console.warn('Session verification rejected by server:', err);
        localStorage.removeItem('lane4_admin_token');
        localStorage.removeItem('lane4_admin_user');
        const loginScreen = document.getElementById('admin-login-screen');
        if (loginScreen) {
          loginScreen.style.display = 'flex';
          const alertEl = document.getElementById('admin-login-alert');
          if (alertEl) {
            alertEl.style.display = 'block';
            alertEl.style.background = '#fef2f2';
            alertEl.style.color = '#b91c1c';
            alertEl.textContent = 'Session invalid. Please sign in to continue.';
          }
        }
        setupLoginForm();
      }
    }
  }

  function setupLoginForm() {
    const form = document.getElementById('admin-login-form');
    const alertEl = document.getElementById('admin-login-alert');
    const submitBtn = document.getElementById('admin-login-btn') || (form && form.querySelector('button[type="submit"]'));
    const togglePassBtn = document.getElementById('toggle-admin-pass');
    const passInput = document.getElementById('admin-pass');
    if (!form) return;

    if (togglePassBtn && passInput) {
      togglePassBtn.onclick = () => {
        const isPass = passInput.type === 'password';
        passInput.type = isPass ? 'text' : 'password';
        togglePassBtn.textContent = isPass ? 'Hide' : 'Show';
      };
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('admin-email').value.trim();
      const password = document.getElementById('admin-pass').value;

      if (!email || !password) {
        if (alertEl) {
          alertEl.style.display = 'block';
          alertEl.style.background = '#fef2f2';
          alertEl.style.color = '#b91c1c';
          alertEl.textContent = 'Please enter both administrator email and password.';
        }
        return;
      }

      if (alertEl) {
        alertEl.style.display = 'block';
        alertEl.style.background = '#eff6ff';
        alertEl.style.color = '#1d4ed8';
        alertEl.textContent = 'Authenticating staff credentials...';
      }
      if (submitBtn) submitBtn.disabled = true;

      try {
        const res = await window.lane4ApiRequest('/auth/admin/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        if (!res || !res.data || !res.data.token) {
          throw new Error((res && res.message) || 'Failed to obtain administrator access token.');
        }

        const token = res.data.token;
        localStorage.setItem('lane4_admin_token', token);
        localStorage.setItem('lane4_auth_token', token);
        if (res.data.admin) {
          localStorage.setItem('lane4_admin_user', JSON.stringify(res.data.admin));
          activeAdmin = res.data.admin;
        }

        if (alertEl) {
          alertEl.style.background = '#f0fdf4';
          alertEl.style.color = '#15803d';
          alertEl.textContent = 'Authenticated. Loading Operations Console...';
        }

        setTimeout(() => {
          const loginScreen = document.getElementById('admin-login-screen');
          if (loginScreen) loginScreen.style.display = 'none';
          updateAdminUserDisplay(activeAdmin);
          initAdminPanel();
        }, 300);
      } catch (err) {
        if (alertEl) {
          alertEl.style.display = 'block';
          alertEl.style.background = '#fef2f2';
          alertEl.style.color = '#b91c1c';
          alertEl.textContent = err.message || 'Access denied. Invalid administrator credentials.';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    };
  }

  function setupLogout() {
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        localStorage.removeItem('lane4_admin_token');
        localStorage.removeItem('lane4_admin_user');
        localStorage.removeItem('lane4_auth_token');
        localStorage.removeItem('lane4_admin_active_view');
        window.location.hash = '';
        const loginScreen = document.getElementById('admin-login-screen');
        if (loginScreen) loginScreen.style.display = 'flex';
        setupLoginForm();
      };
    }
  }

  function initAdminPanel() {
    setupMobileDrawer();
    setupNavigation();
    setupLogout();
    setupModalEvents();

    // Listen to browser hash changes (back/forward history)
    window.onhashchange = () => {
      const h = (window.location.hash || '').replace('#', '').trim();
      if (h) switchView(h, true);
    };

    // Open directly to the active view from URL hash or previous tab
    const initialView = getInitialView();
    switchView(initialView, true);
  }

  // --- MOBILE DRAWER NAVIGATION ---
  function setupMobileDrawer() {
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('admin-sidebar-backdrop');
    const closeBtn = document.getElementById('admin-sidebar-close');

    function openDrawer() {
      if (sidebar) sidebar.classList.add('open');
      if (backdrop) backdrop.classList.add('active');
    }

    function closeDrawer() {
      if (sidebar) sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('active');
    }

    if (mobileToggle) mobileToggle.onclick = openDrawer;
    if (closeBtn) closeBtn.onclick = closeDrawer;
    if (backdrop) backdrop.onclick = closeDrawer;
  }

  window.addEventListener('lane4:admin-auth-expired', () => {
    localStorage.removeItem('lane4_admin_token');
    localStorage.removeItem('lane4_admin_user');
    const loginScreen = document.getElementById('admin-login-screen');
    if (loginScreen) {
      loginScreen.style.display = 'flex';
      const alertEl = document.getElementById('admin-login-alert');
      if (alertEl) {
        alertEl.style.display = 'block';
        alertEl.style.background = '#fef2f2';
        alertEl.style.color = '#b91c1c';
        alertEl.textContent = 'Administrator session expired. Please log in again.';
      }
    }
    setupLoginForm();
  });

  function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('admin-sidebar-backdrop');

    navItems.forEach(item => {
      item.onclick = () => {
        const view = item.getAttribute('data-view');
        switchView(view);

        // Auto close mobile drawer on navigation
        if (window.innerWidth <= 992) {
          if (sidebar) sidebar.classList.remove('open');
          if (backdrop) backdrop.classList.remove('active');
        }
      };
    });
  }

  function switchView(viewName, skipHash) {
    if (!viewName) viewName = 'dashboard';
    if (!skipHash) {
      window.location.hash = viewName;
      localStorage.setItem('lane4_admin_active_view', viewName);
    }

    document.querySelectorAll('.admin-view').forEach(v => v.style.display = 'none');
    const target = document.getElementById(`view-${viewName}`);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(i => {
      if (i.getAttribute('data-view') === viewName) {
        i.classList.add('active');
      } else {
        i.classList.remove('active');
      }
    });

    const headings = {
      dashboard: 'Dashboard Overview',
      payments: 'Manual UPI Payment Verification',
      orders: 'Order Processing & Fulfillment',
      inventory: 'Variant Stock & Inventory Control',
      products: 'Products Catalog Management',
      categories: 'Categories & Navigation',
      coupons: 'Promotional Coupons & Rules',
      customers: 'Customer Accounts & Profiles',
      enquiries: 'Customer Support & Contact Submissions',
      settings: 'Store Profile & UPI Payment Settings',
      logs: 'Administrative Activity Audit Logs'
    };

    const headingEl = document.getElementById('page-heading');
    if (headingEl) {
      headingEl.textContent = headings[viewName] || 'Admin Console';
    }

    if (viewName === 'dashboard') loadDashboard();
    else if (viewName === 'payments') loadPayments();
    else if (viewName === 'orders') loadOrders();
    else if (viewName === 'inventory') loadInventory();
    else if (viewName === 'products') loadProducts();
    else if (viewName === 'categories') loadCategories();
    else if (viewName === 'coupons') loadCoupons();
    else if (viewName === 'customers') loadCustomers();
    else if (viewName === 'enquiries') loadEnquiries();
    else if (viewName === 'settings') loadSettings();
    else if (viewName === 'logs') loadLogs();
  }

  // --- MODAL & TOAST HELPERS ---
  let activeModalResolver = null;

  function showModal(title, bodyHtml) {
    const modal = document.getElementById('admin-modal');
    const modalBody = document.getElementById('admin-modal-body');
    if (!modal || !modalBody) return;

    if (activeModalResolver) {
      const resolver = activeModalResolver;
      activeModalResolver = null;
      resolver(null);
    }

    modalBody.innerHTML = `
      <div style="font-size:18px;font-weight:900;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;letter-spacing:-0.2px;color:#0f172a;">
        <span>${title}</span>
      </div>
      <div>${bodyHtml}</div>
    `;
    modal.style.display = 'flex';
  }

  function hideModal(result = null) {
    const modal = document.getElementById('admin-modal');
    if (modal) modal.style.display = 'none';
    if (activeModalResolver) {
      const resolver = activeModalResolver;
      activeModalResolver = null;
      resolver(result);
    }
  }

  function setupModalEvents() {
    const closeBtn = document.getElementById('admin-modal-close-btn');
    if (closeBtn) closeBtn.onclick = () => hideModal(null);

    const modal = document.getElementById('admin-modal');
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) hideModal(null);
      };
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideModal(null);
    });
  }

  function showThemedConfirm({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDanger = true }) {
    return new Promise((resolve) => {
      const modal = document.getElementById('admin-modal');
      const modalBody = document.getElementById('admin-modal-body');
      if (!modal || !modalBody) return resolve(false);

      if (activeModalResolver) {
        const prev = activeModalResolver;
        activeModalResolver = null;
        prev(false);
      }
      activeModalResolver = (val) => resolve(!!val);

      modalBody.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:18px;">
          <div style="background:${isDanger ? '#fef2f2' : '#f8fafc'};border:1px solid ${isDanger ? '#fee2e2' : '#e2e8f0'};border-radius:10px;padding:16px;display:flex;align-items:flex-start;gap:14px;">
            <div style="width:36px;height:36px;border-radius:50%;background:${isDanger ? '#fee2e2' : '#e2e8f0'};display:flex;align-items:center;justify-content:center;color:${isDanger ? '#dc2626' : '#0f172a'};font-size:18px;font-weight:900;flex-shrink:0;">
              ${isDanger ? '⚠️' : 'ℹ️'}
            </div>
            <div>
              <div style="font-size:16px;font-weight:800;color:${isDanger ? '#991b1b' : '#0f172a'};margin-bottom:4px;">${title}</div>
              <div style="font-size:13.5px;color:${isDanger ? '#7f1d1d' : '#475569'};line-height:1.5;">${message}</div>
            </div>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:12px;border-top:1px solid #e2e8f0;">
            <button type="button" class="btn btn-outline" id="themed-confirm-cancel">${cancelText}</button>
            <button type="button" class="btn ${isDanger ? 'btn-danger' : 'btn-primary'}" id="themed-confirm-ok" style="padding:9px 20px;font-size:13px;font-weight:700;">
              ${confirmText}
            </button>
          </div>
        </div>
      `;

      const cancelBtn = document.getElementById('themed-confirm-cancel');
      const okBtn = document.getElementById('themed-confirm-ok');
      if (cancelBtn) cancelBtn.onclick = () => hideModal(false);
      if (okBtn) okBtn.onclick = () => hideModal(true);

      modal.style.display = 'flex';
    });
  }

  function hideToast() {
    const toast = document.getElementById('lane4-admin-toast');
    if (!toast) return;
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-16px) scale(0.96)';
    if (window._lane4ToastTimeout) {
      clearTimeout(window._lane4ToastTimeout);
      window._lane4ToastTimeout = null;
    }
  }

  function showToast(message, type = 'success', customTitle = null) {
    let toast = document.getElementById('lane4-admin-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lane4-admin-toast';
      document.body.appendChild(toast);
    }

    if (window._lane4ToastTimeout) clearTimeout(window._lane4ToastTimeout);

    const isError = type === 'error';
    const isWarning = type === 'warning' || type === 'warn';
    const isInfo = type === 'info';
    const isSuccess = !isError && !isWarning && !isInfo;

    // Theme Configurations
    let config = {
      bg: 'linear-gradient(135deg, #052e16 0%, #064e3b 60%, #047857 100%)',
      border: '1px solid rgba(52, 211, 153, 0.45)',
      shadow: '0 16px 36px -6px rgba(5, 150, 105, 0.45), 0 6px 14px -3px rgba(0, 0, 0, 0.25)',
      iconBg: 'rgba(16, 185, 129, 0.25)',
      iconBorder: '1.5px solid rgba(167, 243, 208, 0.5)',
      iconColor: '#34d399',
      svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`,
      title: customTitle || (message.toLowerCase().includes('payment') ? 'PAYMENT RECEIVED' : 'OPERATION SUCCESSFUL'),
      titleColor: '#a7f3d0',
      textColor: '#ffffff',
      barColor: '#34d399'
    };

    if (isError) {
      config = {
        bg: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 60%, #991b1b 100%)',
        border: '1px solid rgba(252, 165, 165, 0.45)',
        shadow: '0 16px 36px -6px rgba(185, 28, 28, 0.45), 0 6px 14px -3px rgba(0, 0, 0, 0.25)',
        iconBg: 'rgba(239, 68, 68, 0.25)',
        iconBorder: '1.5px solid rgba(254, 202, 202, 0.5)',
        iconColor: '#f87171',
        svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        title: customTitle || 'SYSTEM ERROR',
        titleColor: '#fecaca',
        textColor: '#ffffff',
        barColor: '#f87171'
      };
    } else if (isWarning) {
      config = {
        bg: 'linear-gradient(135deg, #451a03 0%, #78350f 60%, #92400e 100%)',
        border: '1px solid rgba(251, 191, 36, 0.45)',
        shadow: '0 16px 36px -6px rgba(180, 83, 9, 0.45), 0 6px 14px -3px rgba(0, 0, 0, 0.25)',
        iconBg: 'rgba(245, 158, 11, 0.25)',
        iconBorder: '1.5px solid rgba(253, 230, 138, 0.5)',
        iconColor: '#fbbf24',
        svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        title: customTitle || 'ATTENTION REQUIRED',
        titleColor: '#fef3c7',
        textColor: '#ffffff',
        barColor: '#fbbf24'
      };
    } else if (isInfo) {
      config = {
        bg: 'linear-gradient(135deg, #090d16 0%, #0f172a 60%, #1e293b 100%)',
        border: '1px solid rgba(148, 163, 184, 0.35)',
        shadow: '0 16px 36px -6px rgba(15, 23, 42, 0.6), 0 6px 14px -3px rgba(0, 0, 0, 0.3)',
        iconBg: 'rgba(56, 189, 248, 0.18)',
        iconBorder: '1.5px solid rgba(125, 211, 252, 0.4)',
        iconColor: '#38bdf8',
        svg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
        title: customTitle || 'STATUS UPDATED',
        titleColor: '#93c5fd',
        textColor: '#f8fafc',
        barColor: '#38bdf8'
      };
    }

    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999999;
      width: 400px;
      max-width: calc(100vw - 32px);
      border-radius: 12px;
      overflow: hidden;
      background: ${config.bg};
      border: ${config.border};
      box-shadow: ${config.shadow};
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.24s ease;
      display: flex;
      flex-direction: column;
      opacity: 0;
      transform: translateY(-20px) scale(0.96);
      pointer-events: auto;
      font-family: inherit;
    `;

    toast.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:12px;padding:14px 16px;">
        <div style="width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:${config.iconBg};border:${config.iconBorder};color:${config.iconColor};">
          ${config.svg}
        </div>
        <div style="flex:1;min-width:0;padding-top:1px;">
          <div style="font-size:10.5px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:${config.titleColor};margin-bottom:3px;">
            ${config.title}
          </div>
          <div style="font-size:13px;font-weight:600;line-height:1.45;color:${config.textColor};word-break:break-word;">
            ${message}
          </div>
        </div>
        <button type="button" onclick="hideToast()" style="background:none;border:none;color:#ffffff;opacity:0.65;font-size:18px;line-height:1;cursor:pointer;padding:2px 4px;margin-left:4px;border-radius:4px;transition:opacity 0.15s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.65'" title="Dismiss">&times;</button>
      </div>
      <div id="lane4-toast-progress" style="height:3px;background:${config.barColor};width:100%;transition:width 3.6s linear;"></div>
    `;

    void toast.offsetWidth;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0) scale(1)';

    setTimeout(() => {
      const progressBar = document.getElementById('lane4-toast-progress');
      if (progressBar) progressBar.style.width = '0%';
    }, 50);

    window._lane4ToastTimeout = setTimeout(() => {
      hideToast();
    }, 3800);
  }
  window.showToast = showToast;
  window.hideToast = hideToast;
  window.showToast = showToast;
  window.showThemedConfirm = showThemedConfirm;

  // --- DASHBOARD ---
  async function loadDashboard() {
    const container = document.getElementById('view-dashboard');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px;color:#64748b;">Loading metrics...</p>';

    try {
      const res = await window.lane4ApiRequest('/admin/dashboard');
      const m = res.data;

      const badge = document.getElementById('badge-pending-payments');
      if (badge) {
        if (m.pendingPaymentsCount > 0) {
          badge.style.display = 'inline-block';
          badge.textContent = m.pendingPaymentsCount;
        } else {
          badge.style.display = 'none';
        }
      }

      container.innerHTML = `
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Verified Revenue</div>
            <div class="stat-val" style="color:#16a34a;">${m.totalRevenueFormatted}</div>
            <div class="stat-sub">From approved payments</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Pending Payments</div>
            <div class="stat-val" style="color:${m.pendingPaymentsCount > 0 ? '#ea580c' : '#0f172a'};">${m.pendingPaymentsCount}</div>
            <div class="stat-sub">Requires staff verification</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Orders</div>
            <div class="stat-val">${m.totalOrders}</div>
            <div class="stat-sub">${m.processingOrdersCount} in fulfillment</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Active Products</div>
            <div class="stat-val">${m.totalProducts}</div>
            <div class="stat-sub">${m.lowStockCount} items low in stock</div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:24px;">
          <!-- Recent Pending Payments -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Pending Payment Verifications</div>
              <button class="btn btn-outline" style="padding:4px 10px;font-size:12px;" onclick="document.querySelector('[data-view=payments]').click()">View All &rarr;</button>
            </div>
            <div class="card-body" style="padding:0;">
              <div class="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Amount</th>
                      <th>UTR Reference</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${m.recentPayments.length === 0 ? '<tr><td colspan="4" style="text-align:center;padding:24px;color:#888;">No pending payments!</td></tr>' : 
                      m.recentPayments.map(p => `
                        <tr>
                          <td><strong>#${p.orderNumber}</strong></td>
                          <td>${window.LANE4.formatINR(p.amountPaise)}</td>
                          <td><code>${p.upiReferenceNumber}</code></td>
                          <td><button class="btn btn-outline" style="padding:4px 8px;font-size:11px;" onclick="viewPaymentDetail('${p.paymentId || p.orderId}')">Review Proof</button></td>
                        </tr>
                      `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Recent Orders -->
          <div class="card">
            <div class="card-header">
              <div class="card-title">Recent Store Orders</div>
              <button class="btn btn-outline" style="padding:4px 10px;font-size:12px;" onclick="document.querySelector('[data-view=orders]').click()">View All &rarr;</button>
            </div>
            <div class="card-body" style="padding:0;">
              <div class="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${m.recentOrders.length === 0 ? '<tr><td colspan="4" style="text-align:center;padding:24px;color:#888;">No orders placed yet.</td></tr>' :
                      m.recentOrders.map(o => `
                        <tr>
                          <td><strong>#${o.orderNumber || o.orderId}</strong></td>
                          <td>${o.customerEmail}</td>
                          <td><span class="badge badge-${o.status}">${o.status.replace(/_/g, ' ')}</span></td>
                          <td>${o.pricing ? o.pricing.finalPayableFormatted : ''}</td>
                        </tr>
                      `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color:#ef4444;padding:20px;">Error loading dashboard: ${err.message}</p>`;
    }
  }

  // --- PAYMENTS VERIFICATION ---
  function resolveProofUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const clean = url.replace(/^\/+/, '');
    const apiBase = (window.LANE4_CONFIG && window.LANE4_CONFIG.API_BASE_URL) || '/api';
    const backendOrigin = apiBase.startsWith('http') 
      ? apiBase.replace(/\/api\/?$/, '') 
      : (window.location.port === '5000' ? '' : 'http://localhost:5000');
    return backendOrigin ? `${backendOrigin}/${clean}` : `/${clean}`;
  }

  window.currentPayments = [];

  async function loadPayments() {
    const container = document.getElementById('view-payments');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px;color:#64748b;">Loading payment submissions...</p>';

    try {
      const res = await window.lane4ApiRequest('/admin/payments');
      const payments = res.data || [];
      window.currentPayments = payments;

      container.innerHTML = `
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
            <div>
              <div class="card-title">UPI Payment Submissions (${payments.length})</div>
              <p style="font-size:12px;color:#64748b;margin:4px 0 0 0;">Inspect actual user smartphone payment screenshots, match 12-digit UTR against bank records, and verify or reject orders.</p>
            </div>
            <button class="btn btn-outline" style="font-size:12px;padding:6px 12px;" onclick="loadPayments()">&#x21bb; Refresh Submissions</button>
          </div>
          <div class="card-body" style="padding:0;">
            <div class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Payable</th>
                    <th>12-Digit UTR Ref</th>
                    <th>Customer Screenshot Proof</th>
                    <th>Status</th>
                    <th>Submitted At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${payments.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:24px;color:#888;">No payment proofs submitted yet.</td></tr>' :
                    payments.map(p => {
                      const proofUrl = p.proofScreenshot && p.proofScreenshot.secureUrl ? resolveProofUrl(p.proofScreenshot.secureUrl) : '';
                      return `
                        <tr>
                          <td><strong>#${p.orderNumber || p.orderId}</strong></td>
                          <td><strong>${window.LANE4.formatINR(p.amountPaise)}</strong></td>
                          <td><code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;font-weight:700;letter-spacing:0.5px;">${p.upiReferenceNumber}</code></td>
                          <td style="vertical-align:middle;">
                            ${proofUrl ? `
                              <div style="display:inline-flex;align-items:center;gap:10px;">
                                <div style="position:relative;cursor:pointer;flex-shrink:0;" onclick="viewPaymentDetail('${p.paymentId}')" title="Click to inspect uploaded customer screenshot">
                                  <img src="${proofUrl}" 
                                       alt="Payment Screenshot" 
                                       style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #cbd5e1;background:#0f172a;box-shadow:0 1px 3px rgba(0,0,0,0.1);display:block;"
                                       onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'48\\' height=\\'48\\' fill=\\'%2394a3b8\\' viewBox=\\'0 0 24 24\\'><path d=\\'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z\\'/></svg>';" />
                                  <span style="position:absolute;bottom:-4px;right:-4px;background:#0f172a;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,0.4);border:1px solid #fff;">&#128269;</span>
                                </div>
                                <div>
                                  <button type="button" class="btn btn-outline" style="padding:4px 9px;font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;gap:4px;" onclick="viewPaymentDetail('${p.paymentId}')">
                                    <span>Inspect Proof</span>
                                  </button>
                                  <div style="margin-top:2px;">
                                    <a href="${proofUrl}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#0284c7;text-decoration:none;font-weight:600;" onclick="event.stopPropagation();">
                                      Open Original ↗
                                    </a>
                                  </div>
                                </div>
                              </div>
                            ` : `
                              <div style="display:inline-flex;align-items:center;gap:8px;">
                                <span style="display:inline-flex;align-items:center;gap:5px;background:#fef3c7;color:#92400e;padding:4px 8px;border-radius:12px;font-size:11px;font-weight:700;">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                  Awaiting Upload
                                </span>
                                <button type="button" class="btn btn-outline" style="padding:3px 8px;font-size:11px;font-weight:700;" onclick="viewPaymentDetail('${p.paymentId}')">
                                  + Upload
                                </button>
                              </div>
                            `}
                          </td>
                          <td><span class="badge badge-${p.status}">${p.status.replace(/_/g, ' ')}</span></td>
                          <td style="font-size:12px;color:#64748b;white-space:nowrap;">${formatDateTime(p.createdAt)}</td>
                          <td>
                            ${p.status === 'verification_pending' ? `
                              <div style="display:flex;gap:6px;">
                                <button class="btn btn-success" style="padding:6px 10px;font-size:12px;" onclick="approvePayment('${p.paymentId}')">&check; Approve</button>
                                <button class="btn btn-danger" style="padding:6px 10px;font-size:12px;" onclick="rejectPayment('${p.paymentId}')">&times; Reject</button>
                              </div>
                            ` : `<span style="font-size:12px;color:#666;">Verified by ${p.verification ? (p.verification.verifiedByName || 'Staff') : 'Staff'}</span>`}
                          </td>
                        </tr>
                      `;
                    }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color:#ef4444;padding:20px;">Error loading payments: ${err.message}</p>`;
    }
  }

  window.viewPaymentDetail = async function (paymentId) {
    let p = (window.currentPayments || []).find(item => item.paymentId === paymentId || item.orderId === paymentId);
    if (!p) {
      try {
        const res = await window.lane4ApiRequest(`/admin/payments/${paymentId}`);
        p = res.data;
      } catch (e) {
        showToast('Payment record not found', 'error');
        return;
      }
    }
    if (!p) return;

    const proofUrl = p.proofScreenshot && p.proofScreenshot.secureUrl ? resolveProofUrl(p.proofScreenshot.secureUrl) : '';

    showModal(`Payment Proof & Verification — #${p.orderNumber || p.orderId}`, `
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Order Information</div>
            <div style="font-size:18px;font-weight:900;color:#0f172a;">Order #${p.orderNumber || p.orderId}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Payable Amount</div>
            <div style="font-size:20px;font-weight:900;color:#0f172a;">${window.LANE4.formatINR(p.amountPaise)}</div>
          </div>
        </div>

        <div>
          <div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <span>Customer-Uploaded Payment Screenshot:</span>
            ${proofUrl ? `
              <a href="${proofUrl}" target="_blank" rel="noopener noreferrer" style="color:#0284c7;font-weight:700;text-decoration:none;font-size:12px;display:inline-flex;align-items:center;gap:4px;">
                <span>Open Full Size in New Tab</span> <span>↗</span>
              </a>
            ` : ''}
          </div>
          <div style="background:#090d16;border-radius:10px;padding:16px;display:flex;justify-content:center;align-items:center;min-height:360px;max-height:540px;overflow:auto;border:1px solid #1e293b;">
            ${proofUrl ? `
              <img id="detail-proof-img" src="${proofUrl}" 
                   alt="Customer Payment Screenshot for Order #${p.orderNumber || p.orderId}" 
                   style="max-width:100%;max-height:500px;object-fit:contain;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.5);display:block;margin:auto;" />
            ` : `
              <div style="padding:40px 20px;text-align:center;">
                <div style="width:50px;height:50px;border-radius:50%;background:#1e293b;display:flex;align-items:center;justify-content:center;margin:0 auto 12px auto;color:#94a3b8;">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                </div>
                <div style="color:#ffffff;font-size:15px;font-weight:800;margin-bottom:6px;">No Customer Screenshot Uploaded Yet</div>
                <p style="color:#94a3b8;font-size:12.5px;max-width:380px;line-height:1.5;margin:0 auto;">This order was placed with 12-digit UTR <strong style="color:#f8fafc;">${p.upiReferenceNumber}</strong>, but the customer has not uploaded their screenshot proof yet.</p>
              </div>
            `}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;background:#f8fafc;padding:14px;border-radius:8px;border:1px solid #e2e8f0;">
          <div>
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">12-Digit UPI / UTR Ref</div>
            <div style="margin-top:4px;display:flex;align-items:center;gap:8px;">
              <code style="font-size:15px;font-weight:800;background:#ffffff;border:1px solid #cbd5e1;padding:4px 8px;border-radius:4px;color:#0f172a;letter-spacing:1px;">${p.upiReferenceNumber || 'N/A'}</code>
              <button type="button" class="btn btn-outline" style="padding:3px 7px;font-size:11px;" onclick="navigator.clipboard.writeText('${p.upiReferenceNumber}');showToast('UTR copied to clipboard!');">Copy</button>
            </div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Verification Status</div>
            <div style="margin-top:4px;"><span class="badge badge-${p.status}">${(p.status || '').replace(/_/g, ' ')}</span></div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Submitted At</div>
            <div style="margin-top:4px;font-size:13px;font-weight:600;color:#1e293b;">${formatDateTime(p.createdAt)}</div>
          </div>
          ${p.verification && p.verification.verifiedByName ? `
            <div>
              <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Verified By</div>
              <div style="margin-top:4px;font-size:13px;font-weight:600;color:#1e293b;">${p.verification.verifiedByName} (${formatDateTime(p.verification.verifiedAt)})</div>
              <div style="font-size:11px;color:#64748b;font-style:italic;">"${p.verification.internalNotes || ''}"</div>
            </div>
          ` : ''}
        </div>

        ${p.status === 'verification_pending' ? `
          <div style="display:flex;gap:12px;justify-content:flex-end;padding-top:10px;border-top:1px solid #e2e8f0;flex-wrap:wrap;">
            <button type="button" class="btn btn-danger" style="padding:9px 18px;font-size:13px;font-weight:700;" onclick="rejectPayment('${p.paymentId}')">
              &times; Reject Proof
            </button>
            <button type="button" class="btn btn-success" style="padding:9px 20px;font-size:13px;font-weight:700;" onclick="approvePayment('${p.paymentId}')">
              &check; Approve Payment & Confirm Order
            </button>
          </div>
        ` : `
          <div style="padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;">
            <button type="button" class="btn btn-outline" onclick="hideModal()">Close</button>
          </div>
        `}

        <div style="margin-top:6px;padding:14px;background:#f1f5f9;border-radius:8px;border:1px dashed #cbd5e1;">
          <div style="font-size:12px;font-weight:800;color:#334155;margin-bottom:4px;">Upload Alternate / Updated Customer Screenshot:</div>
          <p style="font-size:11px;color:#64748b;margin:0 0 10px 0;">If customer provided a clearer payment screenshot via WhatsApp or support email, upload it here to attach directly to this payment record.</p>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <input type="file" id="staff-proof-file-${p.paymentId}" accept="image/jpeg,image/png,image/webp" style="font-size:12px;flex:1;min-width:200px;" />
            <button type="button" id="staff-proof-upload-btn-${p.paymentId}" class="btn btn-primary" style="padding:6px 14px;font-size:12px;font-weight:700;" onclick="uploadStaffProof('${p.paymentId}')">
              Upload Screenshot
            </button>
          </div>
        </div>
      </div>
    `);
  };

  window.uploadStaffProof = async function (paymentId) {
    const fileInput = document.getElementById(`staff-proof-file-${paymentId}`);
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      showToast('Please select a screenshot image file to upload.', 'error');
      return;
    }
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('screenshot', file);

    const btn = document.getElementById(`staff-proof-upload-btn-${paymentId}`);
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Uploading...';
    }

    try {
      await window.lane4ApiRequest(`/admin/payments/${paymentId}/upload-proof`, {
        method: 'POST',
        body: formData
      });
      showToast('Payment screenshot updated successfully!');
      await loadPayments();
      viewPaymentDetail(paymentId);
    } catch (err) {
      showToast(err.message || 'Failed to upload screenshot', 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Upload Screenshot';
      }
    }
  };

  window.approvePayment = function (paymentId) {
    const p = (window.currentPayments || []).find(item => item.paymentId === paymentId || item.orderId === paymentId);
    const orderNum = p ? (p.orderNumber || p.orderId) : paymentId;
    const amountStr = p ? window.LANE4.formatINR(p.amountPaise) : '';
    const utrStr = p ? (p.upiReferenceNumber || 'N/A') : '';

    showModal('Verify & Approve Payment', `
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div style="background:#f0fdf4;border:1px solid #dcfce7;border-radius:10px;padding:14px 16px;display:flex;align-items:flex-start;gap:12px;">
          <div style="width:32px;height:32px;border-radius:50%;background:#dcfce7;display:flex;align-items:center;justify-content:center;color:#16a34a;font-size:16px;font-weight:900;flex-shrink:0;">✓</div>
          <div>
            <div style="font-size:14px;font-weight:800;color:#166534;margin-bottom:2px;">Approve Payment for Order #${orderNum} ${amountStr ? `(${amountStr})` : ''}</div>
            <div style="font-size:12.5px;color:#15803d;line-height:1.4;">Approving will mark this payment as VERIFIED, confirm the order, transition status to PROCESSING, and send an email confirmation to the customer.</div>
          </div>
        </div>

        <div style="display:flex;gap:12px;background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;color:#475569;">
          <div><strong style="color:#0f172a;">12-digit UTR:</strong> <code>${utrStr}</code></div>
        </div>

        <div>
          <label for="approve-note-input" class="form-label" style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;color:#334155;margin-bottom:6px;">
            Internal Staff Verification Note (Optional)
          </label>
          <input type="text" id="approve-note-input" class="form-input" style="width:100%;font-size:13.5px;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:6px;" value="Confirmed against bank UPI records." placeholder="e.g. Confirmed in ICICI statement" />
          <div style="font-size:11.5px;color:#64748b;margin-top:4px;">Saved in the administrative audit trail for reconciliation.</div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:14px;border-top:1px solid #e2e8f0;">
          <button type="button" class="btn btn-outline" onclick="hideModal()">Cancel</button>
          <button type="button" id="submit-approve-btn" class="btn btn-success" style="padding:9px 20px;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:6px;">
            <span>✓ Verify & Approve Payment</span>
          </button>
        </div>
      </div>
    `);

    setTimeout(() => {
      const input = document.getElementById('approve-note-input');
      if (input) input.focus();
    }, 50);

    const submitBtn = document.getElementById('submit-approve-btn');
    if (submitBtn) {
      submitBtn.onclick = async () => {
        const note = (document.getElementById('approve-note-input')?.value || '').trim() || 'Confirmed against bank UPI records.';
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Approving...</span>';

        try {
          await window.lane4ApiRequest(`/admin/payments/${paymentId}/approve`, {
            method: 'POST',
            body: JSON.stringify({ internalNote: note })
          });
          hideModal();
          showToast('Payment verified and approved! Order is now confirmed.', 'success', 'PAYMENT RECEIVED');
          loadPayments();
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>✓ Verify & Approve Payment</span>';
          showToast(err.message || 'Failed to approve payment', 'error');
        }
      };
    }
  };

  window.rejectPayment = function (paymentId) {
    const p = (window.currentPayments || []).find(item => item.paymentId === paymentId || item.orderId === paymentId);
    const orderNum = p ? (p.orderNumber || p.orderId) : paymentId;
    const amountStr = p ? window.LANE4.formatINR(p.amountPaise) : '';
    const utrStr = p ? (p.upiReferenceNumber || 'N/A') : '';

    showModal('Reject Payment Submission', `
      <div style="display:flex;flex-direction:column;gap:18px;">
        <div style="background:#fef2f2;border:1px solid #fee2e2;border-radius:10px;padding:14px 16px;display:flex;align-items:flex-start;gap:12px;">
          <div style="width:32px;height:32px;border-radius:50%;background:#fee2e2;display:flex;align-items:center;justify-content:center;color:#dc2626;font-size:16px;font-weight:900;flex-shrink:0;">✕</div>
          <div>
            <div style="font-size:14px;font-weight:800;color:#991b1b;margin-bottom:2px;">Reject Proof for Order #${orderNum} ${amountStr ? `(${amountStr})` : ''}</div>
            <div style="font-size:12.5px;color:#7f1d1d;line-height:1.4;">Customer will receive an automated notification with this rejection reason and instructions to resubmit their valid payment proof.</div>
          </div>
        </div>

        <div style="display:flex;gap:12px;background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0;font-size:12px;color:#475569;">
          <div><strong style="color:#0f172a;">12-digit UTR:</strong> <code>${utrStr}</code></div>
        </div>

        <div>
          <label style="display:block;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:6px;">Quick Presets</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
            <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:11px;border-radius:20px;cursor:pointer;" onclick="document.getElementById('reject-reason-input').value='Transaction reference could not be matched with bank records.'">Bank Reference Missing</button>
            <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:11px;border-radius:20px;cursor:pointer;" onclick="document.getElementById('reject-reason-input').value='Amount received does not match order payable amount.'">Amount Mismatch</button>
            <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:11px;border-radius:20px;cursor:pointer;" onclick="document.getElementById('reject-reason-input').value='Payment screenshot is illegible, cropped, or missing transaction details.'">Illegible Screenshot</button>
            <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:11px;border-radius:20px;cursor:pointer;" onclick="document.getElementById('reject-reason-input').value='Transaction was cancelled or reversed by sending bank.'">Transaction Reversed</button>
          </div>

          <label for="reject-reason-input" class="form-label" style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;color:#334155;margin-bottom:6px;">
            Reason for Rejection <span style="color:#dc2626;">*</span>
          </label>
          <textarea id="reject-reason-input" class="form-textarea" rows="3" style="width:100%;font-size:13.5px;font-family:inherit;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:6px;resize:vertical;" placeholder="Enter specific reason why this payment cannot be approved...">Transaction reference could not be matched with bank records.</textarea>
          <div id="reject-error-msg" style="display:none;color:#dc2626;font-size:12px;font-weight:600;margin-top:4px;">Please enter a reason for rejection.</div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:14px;border-top:1px solid #e2e8f0;">
          <button type="button" class="btn btn-outline" onclick="hideModal()">Cancel</button>
          <button type="button" id="submit-reject-btn" class="btn btn-danger" style="padding:9px 20px;font-size:13px;font-weight:700;display:inline-flex;align-items:center;gap:6px;">
            <span>✕ Confirm Rejection</span>
          </button>
        </div>
      </div>
    `);

    setTimeout(() => {
      const textarea = document.getElementById('reject-reason-input');
      if (textarea) textarea.focus();
    }, 50);

    const submitBtn = document.getElementById('submit-reject-btn');
    if (submitBtn) {
      submitBtn.onclick = async () => {
        const reason = (document.getElementById('reject-reason-input')?.value || '').trim();
        const errEl = document.getElementById('reject-error-msg');
        if (!reason) {
          if (errEl) errEl.style.display = 'block';
          return;
        }
        if (errEl) errEl.style.display = 'none';

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>Rejecting...</span>';

        try {
          await window.lane4ApiRequest(`/admin/payments/${paymentId}/reject`, {
            method: 'POST',
            body: JSON.stringify({ reason })
          });
          hideModal();
          showToast('Payment submission marked as rejected. Customer notified to resubmit.', 'info', 'PAYMENT REJECTED');
          loadPayments();
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>✕ Confirm Rejection</span>';
          showToast(err.message || 'Failed to reject payment', 'error');
        }
      };
    }
  };

  // --- ORDERS ---
  async function loadOrders() {
    const container = document.getElementById('view-orders');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px;color:#64748b;">Loading orders...</p>';

    try {
      const res = await window.lane4ApiRequest('/admin/orders');
      const orders = res.data || [];

      container.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div class="card-title">Customer Orders (${orders.length})</div>
          </div>
          <div class="card-body" style="padding:0;">
            <div class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Order Status</th>
                    <th>Payment Status</th>
                    <th>Tracking</th>
                  </tr>
                </thead>
                <tbody>
                  ${orders.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:24px;color:#888;">No orders recorded.</td></tr>' :
                    orders.map(o => `
                      <tr>
                        <td><strong>#${o.orderNumber || o.orderId}</strong></td>
                        <td>
                          <div style="font-weight:700;">${o.shippingAddress ? o.shippingAddress.addressee : 'Customer'}</div>
                          <div style="font-size:12px;color:#666;">${o.customerEmail}</div>
                          <div style="font-size:11px;color:#888;">${o.shippingAddress ? `${o.shippingAddress.city}, PIN ${o.shippingAddress.postalCode}` : ''}</div>
                        </td>
                        <td>${(o.items || []).map(it => `<div>${it.quantity}&times; ${it.name} ${it.variantLabel ? `(${it.variantLabel})` : ''}</div>`).join('')}</td>
                        <td><strong>${o.pricing ? o.pricing.finalPayableFormatted : ''}</strong></td>
                        <td>
                          <select onchange="updateOrderStatus('${o.orderId}', this.value)" style="padding:5px 8px;border-radius:4px;border:1px solid #ccc;font-weight:700;font-size:12px;">
                            <option value="pending_payment" ${o.status === 'pending_payment' ? 'selected' : ''}>Pending Payment</option>
                            <option value="payment_verification" ${o.status === 'payment_verification' ? 'selected' : ''}>Payment Verification</option>
                            <option value="confirmed" ${o.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                            <option value="processing" ${o.status === 'processing' ? 'selected' : ''}>Processing</option>
                            <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                            <option value="out_for_delivery" ${o.status === 'out_for_delivery' ? 'selected' : ''}>Out For Delivery</option>
                            <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                          </select>
                        </td>
                        <td><span class="badge badge-${o.paymentStatus}">${o.paymentStatus.replace(/_/g, ' ')}</span></td>
                        <td>
                          ${o.fulfillment && o.fulfillment.trackingNumber ? `
                            <div style="font-size:12px;"><strong>${o.fulfillment.courierName}</strong><br /><code>${o.fulfillment.trackingNumber}</code></div>
                          ` : `<button class="btn btn-outline" style="padding:4px 8px;font-size:11px;" onclick="openTrackingModal('${o.orderId}')">+ Add Tracking</button>`}
                        </td>
                      </tr>
                    `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color:#ef4444;padding:20px;">Error loading orders: ${err.message}</p>`;
    }
  }

  window.updateOrderStatus = async function (orderId, newStatus) {
    try {
      await window.lane4ApiRequest(`/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      showToast(`Order status updated to ${newStatus}.`);
      loadOrders();
    } catch (err) {
      showToast(err.message || 'Error updating order status', 'error');
    }
  };

  window.openTrackingModal = function (orderId) {
    showModal('Add Shipment Tracking', `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;">
          <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Order Fulfillment</div>
          <div style="font-size:16px;font-weight:900;color:#0f172a;margin-top:2px;">Attach Courier Details for Order #${orderId}</div>
        </div>

        <div>
          <label style="display:block;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;margin-bottom:6px;">Common Courier Partners</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">
            <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:11px;border-radius:20px;cursor:pointer;" onclick="document.getElementById('tracking-courier-input').value='DTDC';document.getElementById('tracking-url-input').value='https://www.dtdc.in/tracking.asp';">DTDC</button>
            <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:11px;border-radius:20px;cursor:pointer;" onclick="document.getElementById('tracking-courier-input').value='Blue Dart';document.getElementById('tracking-url-input').value='https://www.bluedart.com/tracking';">Blue Dart</button>
            <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:11px;border-radius:20px;cursor:pointer;" onclick="document.getElementById('tracking-courier-input').value='Delhivery';document.getElementById('tracking-url-input').value='https://www.delhivery.com/tracking';">Delhivery</button>
            <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:11px;border-radius:20px;cursor:pointer;" onclick="document.getElementById('tracking-courier-input').value='India Post';document.getElementById('tracking-url-input').value='https://www.indiapost.gov.in';">India Post</button>
            <button type="button" class="btn btn-outline" style="padding:4px 10px;font-size:11px;border-radius:20px;cursor:pointer;" onclick="document.getElementById('tracking-courier-input').value='Shiprocket';document.getElementById('tracking-url-input').value='https://shiprocket.co/tracking';">Shiprocket</button>
          </div>

          <div class="form-group" style="margin-bottom:12px;">
            <label for="tracking-courier-input" class="form-label">Courier Name <span style="color:#dc2626;">*</span></label>
            <input type="text" id="tracking-courier-input" class="form-input" value="DTDC" placeholder="e.g. DTDC, Blue Dart, India Post" required />
          </div>

          <div class="form-group" style="margin-bottom:12px;">
            <label for="tracking-num-input" class="form-label">Tracking / AWB Number <span style="color:#dc2626;">*</span></label>
            <input type="text" id="tracking-num-input" class="form-input" placeholder="e.g. D68492041 or 1234567890" required />
            <div id="tracking-err-msg" style="display:none;color:#dc2626;font-size:12px;font-weight:600;margin-top:4px;">Please enter the tracking / AWB number.</div>
          </div>

          <div class="form-group" style="margin-bottom:0;">
            <label for="tracking-url-input" class="form-label">Tracking Web URL (Optional)</label>
            <input type="url" id="tracking-url-input" class="form-input" value="https://www.dtdc.in/tracking.asp" placeholder="https://..." />
            <div style="font-size:11.5px;color:#64748b;margin-top:4px;">Direct link customer can click in their email to track transit.</div>
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:14px;border-top:1px solid #e2e8f0;">
          <button type="button" class="btn btn-outline" onclick="hideModal()">Cancel</button>
          <button type="button" id="save-tracking-submit-btn" class="btn btn-primary" style="padding:9px 20px;font-size:13px;font-weight:700;">
            Save & Notify Customer
          </button>
        </div>
      </div>
    `);

    setTimeout(() => {
      const numInput = document.getElementById('tracking-num-input');
      if (numInput) numInput.focus();
    }, 50);

    const submitBtn = document.getElementById('save-tracking-submit-btn');
    if (submitBtn) {
      submitBtn.onclick = async () => {
        const courier = (document.getElementById('tracking-courier-input')?.value || '').trim();
        const tracking = (document.getElementById('tracking-num-input')?.value || '').trim();
        const trackingUrl = (document.getElementById('tracking-url-input')?.value || '').trim();
        const errEl = document.getElementById('tracking-err-msg');

        if (!tracking) {
          if (errEl) errEl.style.display = 'block';
          return;
        }
        if (errEl) errEl.style.display = 'none';

        submitBtn.disabled = true;
        submitBtn.textContent = 'Saving...';

        try {
          await window.lane4ApiRequest(`/admin/orders/${orderId}/tracking`, {
            method: 'POST',
            body: JSON.stringify({ courierName: courier || 'DTDC', trackingNumber: tracking, trackingUrl })
          });
          hideModal();
          showToast('Tracking recorded and customer notified!');
          loadOrders();
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Save & Notify Customer';
          showToast(err.message || 'Failed to add tracking', 'error');
        }
      };
    }
  };

  // --- INVENTORY ---
  async function loadInventory() {
    const container = document.getElementById('view-inventory');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px;color:#64748b;">Loading inventory balances...</p>';

    try {
      const res = await window.lane4ApiRequest('/admin/inventory');
      const items = res.data || [];

      container.innerHTML = `
        <div class="card">
          <div class="card-header">
            <div class="card-title">Variant Stock Levels (${items.length} SKUs)</div>
          </div>
          <div class="card-body" style="padding:0;">
            <div class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Variant / Option</th>
                    <th>Available Stock</th>
                    <th>Reserved</th>
                    <th>Status</th>
                    <th>Quick Adjust</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(it => `
                    <tr>
                      <td><code>${it.sku}</code></td>
                      <td style="font-weight:700;">${it.productName}</td>
                      <td>${it.variantLabel || 'Standard'}</td>
                      <td style="font-size:15px;font-weight:900;color:${it.availableQuantity <= (it.lowStockThreshold || 5) ? '#dc2626' : '#16a34a'};">${it.availableQuantity} units</td>
                      <td>${it.reservedQuantity || 0}</td>
                      <td>
                        ${it.availableQuantity <= 0 ? '<span class="badge badge-rejected">OUT OF STOCK</span>' : 
                          it.availableQuantity <= (it.lowStockThreshold || 5) ? '<span class="badge badge-pending">LOW STOCK</span>' : 
                          '<span class="badge badge-active">IN STOCK</span>'}
                      </td>
                      <td>
                        <div style="display:flex;gap:4px;">
                          <button class="btn btn-outline" style="padding:4px 8px;font-size:11px;" onclick="adjustStock('${it.sku}', 5)">+5</button>
                          <button class="btn btn-outline" style="padding:4px 8px;font-size:11px;" onclick="adjustStock('${it.sku}', 10)">+10</button>
                          <button class="btn btn-outline" style="padding:4px 8px;font-size:11px;" onclick="adjustStockPrompt('${it.sku}', ${it.availableQuantity || 0})">Custom...</button>
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color:#ef4444;padding:20px;">Error loading inventory: ${err.message}</p>`;
    }
  }

  window.adjustStock = async function (sku, qty) {
    try {
      await window.lane4ApiRequest(`/admin/inventory/${sku}`, {
        method: 'PATCH',
        body: JSON.stringify({ adjustmentQuantity: qty, type: 'restock', reason: 'Direct admin restock' })
      });
      showToast(`Stock updated (+${qty} units)`);
      loadInventory();
    } catch (err) {
      showToast(err.message || 'Error updating stock', 'error');
    }
  };

  window.adjustStockPrompt = function (sku, curStock = 0) {
    showModal(`Adjust Stock — ${sku}`, `
      <div style="display:flex;flex-direction:column;gap:16px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Inventory Balance</div>
            <div style="font-size:16px;font-weight:900;color:#0f172a;margin-top:2px;">SKU: <code>${sku}</code></div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;color:#64748b;font-weight:700;text-transform:uppercase;">Current Stock</div>
            <div style="font-size:18px;font-weight:900;color:#0f172a;">${curStock} units</div>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label class="form-label">Adjustment Direction</label>
          <div style="display:flex;gap:16px;margin-top:6px;">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13.5px;font-weight:700;">
              <input type="radio" name="adjust-type" value="add" checked />
              <span style="color:#16a34a;">+ Add Stock (Restock)</span>
            </label>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:13.5px;font-weight:700;">
              <input type="radio" name="adjust-type" value="reduce" />
              <span style="color:#dc2626;">− Deduct Stock (Correction)</span>
            </label>
          </div>
        </div>

        <div class="form-group" style="margin-bottom:12px;">
          <label for="adjust-qty-num" class="form-label">Quantity Units <span style="color:#dc2626;">*</span></label>
          <input type="number" id="adjust-qty-num" class="form-input" min="1" step="1" value="10" required />
          <div id="adjust-err-msg" style="display:none;color:#dc2626;font-size:12px;font-weight:600;margin-top:4px;">Please enter a valid positive number of units.</div>
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label for="adjust-reason-text" class="form-label">Reason for Adjustment</label>
          <input type="text" id="adjust-reason-text" class="form-input" value="Routine stock reconciliation" placeholder="e.g. Audit reconciliation, damaged goods write-off" />
        </div>

        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:14px;border-top:1px solid #e2e8f0;">
          <button type="button" class="btn btn-outline" onclick="hideModal()">Cancel</button>
          <button type="button" id="save-adjust-stock-btn" class="btn btn-primary" style="padding:9px 20px;font-size:13px;font-weight:700;">
            Apply Stock Adjustment
          </button>
        </div>
      </div>
    `);

    setTimeout(() => {
      const qtyInput = document.getElementById('adjust-qty-num');
      if (qtyInput) qtyInput.focus();
    }, 50);

    const submitBtn = document.getElementById('save-adjust-stock-btn');
    if (submitBtn) {
      submitBtn.onclick = async () => {
        const isAdd = document.querySelector('input[name="adjust-type"]:checked')?.value === 'add';
        const rawQty = parseInt(document.getElementById('adjust-qty-num')?.value, 10);
        const reason = (document.getElementById('adjust-reason-text')?.value || '').trim() || 'Routine stock reconciliation';
        const errEl = document.getElementById('adjust-err-msg');

        if (isNaN(rawQty) || rawQty <= 0) {
          if (errEl) errEl.style.display = 'block';
          return;
        }
        if (errEl) errEl.style.display = 'none';

        const qty = isAdd ? rawQty : -rawQty;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';

        try {
          await window.lane4ApiRequest(`/admin/inventory/${sku}`, {
            method: 'PATCH',
            body: JSON.stringify({ adjustmentQuantity: qty, type: 'manual_adjustment', reason })
          });
          hideModal();
          showToast(`Stock updated (${qty > 0 ? '+' : ''}${qty} units).`);
          loadInventory();
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Apply Stock Adjustment';
          showToast(err.message || 'Error adjusting stock', 'error');
        }
      };
    }
  };

  // --- PRODUCTS CATALOG MANAGEMENT ---
  async function loadProducts() {
    const container = document.getElementById('view-products');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px;color:#64748b;">Loading product catalog...</p>';

    try {
      const res = await window.lane4ApiRequest('/admin/products');
      const prods = (res && res.data && res.data.products) || (Array.isArray(res && res.data) ? res.data : []);

      // Sort newest created products strictly to the top
      prods.sort((a, b) => {
        const tB = toMillis(b.createdAt);
        const tA = toMillis(a.createdAt);
        if (tB !== tA) return tB - tA;
        return (toMillis(b.updatedAt) || 0) - (toMillis(a.updatedAt) || 0);
      });

      container.innerHTML = `
        <div class="card">
          <div class="card-header" style="flex-wrap:wrap;gap:12px;">
            <div class="card-title">Catalog Products (${prods.length})</div>
            <button class="btn" id="btn-add-product" style="background:#000;color:#fff;display:inline-flex;align-items:center;gap:6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Add New Product</span>
            </button>
          </div>
          <div class="card-body" style="padding:0;">
            <div class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>SKU</th>
                    <th>Regular Price</th>
                    <th>Sale Price</th>
                    <th>Stock</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${prods.length === 0 ? '<tr><td colspan="8" style="text-align:center;padding:24px;color:#888;">No products found in catalog.</td></tr>' :
                    prods.map(p => {
                      const img = (p.images && p.images[0] && p.images[0].url) || '6424266ea05809dff501d86e/lane4-6dbhNuWa5oI-640x640.jpg';
                      const resolvedImg = resolveAdminAsset(img);
                      const fallbackImg = resolveAdminAsset('6424266ea05809dff501d86e/lane4-6dbhNuWa5oI-640x640.jpg');
                      const totalStock = (p.variants && p.variants.length > 0)
                        ? p.variants.reduce((acc, v) => acc + (v.stockQuantity || 0), 0)
                        : (p.stockQuantity || 50);

                      return `
                        <tr>
                          <td>
                            <div style="display:flex;align-items:center;gap:12px;">
                              <img src="${resolvedImg}" alt="${escapeHtml(p.name)}" style="width:42px;height:42px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;background:#f8fafc;" onerror="this.onerror=null;this.src='${fallbackImg}';" />
                              <div>
                                <strong style="display:block;font-size:14px;color:#0f172a;">${escapeHtml(p.name)}</strong>
                                <span style="font-size:11px;color:#64748b;">${escapeHtml(p.slug || '')}</span>
                              </div>
                            </div>
                          </td>
                          <td><span class="badge" style="background:#f1f5f9;color:#334155;">${escapeHtml(p.category || p.categorySlug || 'gear')}</span></td>
                          <td><code>${escapeHtml(p.sku || '—')}</code></td>
                          <td style="font-weight:700;">${window.LANE4.formatINR(p.regularPricePaise || p.pricePaise)}</td>
                          <td style="color:${p.salePricePaise ? '#16a34a' : '#64748b'};font-weight:${p.salePricePaise ? '700' : '400'};">
                            ${p.salePricePaise ? window.LANE4.formatINR(p.salePricePaise) : '—'}
                          </td>
                          <td>
                            <span style="font-weight:700;color:${totalStock <= 5 ? '#dc2626' : '#0f172a'};">${totalStock} units</span>
                          </td>
                          <td>
                            <span class="badge ${p.isPublished ? 'badge-active' : 'badge-pending'}">${p.isPublished ? 'Published' : 'Draft'}</span>
                          </td>
                          <td>
                            <div style="display:flex;gap:6px;">
                              <a href="../product/${p.slug}.html" target="_blank" class="btn btn-outline" style="padding:5px 9px;font-size:11px;text-decoration:none;">View ↗</a>
                              <button class="btn btn-danger btn-del-prod" data-id="${p.id}" data-name="${p.name.replace(/"/g, '&quot;')}" style="padding:5px 9px;font-size:11px;">Delete</button>
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // Hook Add Product Button
      const addBtn = document.getElementById('btn-add-product');
      if (addBtn) addBtn.onclick = openAddProductModal;

      // Hook Delete buttons
      container.querySelectorAll('.btn-del-prod').forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name');
          deleteProduct(id, name);
        };
      });

    } catch (err) {
      container.innerHTML = `<p style="color:#ef4444;padding:20px;">Error loading products: ${err.message}</p>`;
    }
  }

  async function openAddProductModal() {
    let catOptions = '<option value="training-gear">Training Gear</option><option value="goggles">Goggles</option><option value="racing-caps">Racing Caps</option><option value="swimwear">Swimwear</option><option value="accessories">Accessories</option>';
    try {
      const res = await window.lane4ApiRequest('/admin/categories');
      if (res && res.data && res.data.length > 0) {
        catOptions = res.data.map(c => `<option value="${c.slug}">${c.name}</option>`).join('');
      }
    } catch (e) {}

    const formHtml = `
      <form id="form-create-product">
        <div class="form-row">
          <div class="form-group" style="flex:2;">
            <label class="form-label">Product Name *</label>
            <input type="text" id="new-prod-name" class="form-input" placeholder="e.g. Hydro-Dynamic Hand Paddles" required />
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">SKU</label>
            <input type="text" id="new-prod-sku" class="form-input" placeholder="e.g. L4-PAD-001" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Category *</label>
            <select id="new-prod-category" class="form-select" required>
              ${catOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Regular Price (₹ INR) *</label>
            <input type="number" id="new-prod-price" class="form-input" placeholder="1999" min="1" step="1" required />
          </div>
          <div class="form-group">
            <label class="form-label">Sale Price (₹ INR, optional)</label>
            <input type="number" id="new-prod-sale-price" class="form-input" placeholder="1799" min="0" step="1" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Short Tagline / Subtitle</label>
          <input type="text" id="new-prod-short-desc" class="form-input" placeholder="e.g. Pool-tested resistance paddles for upper-body stroke strength" />
        </div>

        <div class="form-group">
          <label class="form-label">Full Product Description</label>
          <textarea id="new-prod-desc" class="form-textarea" rows="3" placeholder="Detailed product specifications, materials, fit and technical benefits..."></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Key Features (One feature per line)</label>
          <textarea id="new-prod-features" class="form-textarea" rows="3" placeholder="Ergonomic contoured profile&#10;Chlorine-resistant durable silicone straps&#10;Hydrodynamic flow holes to maintain water feel"></textarea>
        </div>

        <!-- Image Upload Section -->
        <div class="form-group" style="background:#f8fafc;padding:16px;border-radius:6px;border:1.5px dashed #cbd5e1;">
          <label class="form-label" style="display:flex;align-items:center;gap:6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            Product Image (Upload to Cloudinary or Provide URL)
          </label>
          <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px;">
            <div>
              <input type="file" id="new-prod-image-file" accept="image/png,image/jpeg,image/webp" style="font-size:13px;" />
              <div id="new-prod-img-preview-container" style="display:none;margin-top:10px;align-items:center;gap:12px;">
                <img id="new-prod-img-preview" src="" alt="Preview" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid #cbd5e1;" />
                <span id="new-prod-img-name" style="font-size:12px;color:#64748b;">Selected image</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:12px;color:#94a3b8;text-transform:uppercase;font-weight:700;">OR</span>
              <input type="url" id="new-prod-image-url" class="form-input" placeholder="Direct Image URL (e.g. https://res.cloudinary.com/...)" style="font-size:12px;" />
            </div>
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Initial Stock Quantity *</label>
            <input type="number" id="new-prod-stock" class="form-input" value="50" min="0" required />
          </div>
          <div class="form-group" style="display:flex;align-items:center;gap:16px;padding-top:24px;">
            <label style="display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;cursor:pointer;">
              <input type="checkbox" id="new-prod-published" checked style="width:18px;height:18px;" />
              <span>Publish to Store Immediately</span>
            </label>
          </div>
        </div>

        <div id="modal-submit-alert" style="display:none;padding:10px 14px;border-radius:6px;font-size:13px;margin-bottom:14px;"></div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('admin-modal-close-btn').click()">Cancel</button>
          <button type="submit" id="btn-save-product-submit" class="btn" style="background:#000;color:#fff;min-width:140px;justify-content:center;">Save &amp; Publish</button>
        </div>
      </form>
    `;

    showModal('Add New Product to Catalog', formHtml);

    // Live preview for image file input
    const fileInput = document.getElementById('new-prod-image-file');
    const previewContainer = document.getElementById('new-prod-img-preview-container');
    const previewImg = document.getElementById('new-prod-img-preview');
    const previewName = document.getElementById('new-prod-img-name');

    if (fileInput) {
      fileInput.onchange = () => {
        if (fileInput.files && fileInput.files[0]) {
          const file = fileInput.files[0];
          previewName.textContent = `${file.name} (${Math.round(file.size / 1024)} KB)`;
          const reader = new FileReader();
          reader.onload = (e) => {
            previewImg.src = e.target.result;
            previewContainer.style.display = 'flex';
          };
          reader.readAsDataURL(file);
        }
      };
    }

    // Submit handler
    const form = document.getElementById('form-create-product');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-save-product-submit');
      const alertBox = document.getElementById('modal-submit-alert');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving Product...';
      alertBox.style.display = 'none';

      try {
        const name = document.getElementById('new-prod-name').value.trim();
        const sku = document.getElementById('new-prod-sku').value.trim();
        const category = document.getElementById('new-prod-category').value;
        const regPrice = parseFloat(document.getElementById('new-prod-price').value);
        const salePriceVal = document.getElementById('new-prod-sale-price').value;
        const salePrice = salePriceVal ? parseFloat(salePriceVal) : null;
        const shortDescription = document.getElementById('new-prod-short-desc').value.trim();
        const description = document.getElementById('new-prod-desc').value.trim();
        const featuresText = document.getElementById('new-prod-features').value;
        const stockQty = parseInt(document.getElementById('new-prod-stock').value, 10) || 50;
        const isPublished = document.getElementById('new-prod-published').checked;

        let finalImageUrl = document.getElementById('new-prod-image-url').value.trim();

        // If file selected, upload to backend Cloudinary endpoint first
        if (fileInput.files && fileInput.files[0]) {
          submitBtn.textContent = 'Uploading Image...';
          const formData = new FormData();
          formData.append('image', fileInput.files[0]);

          const adminToken = localStorage.getItem('lane4_admin_token');
          const apiUrl = (window.LANE4_CONFIG && window.LANE4_CONFIG.API_URL) || '/api';
          const uploadRes = await fetch(`${apiUrl}/admin/uploads/image`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${adminToken}`
            },
            body: formData
          });

          const uploadJson = await uploadRes.json();
          if (!uploadRes.ok || !uploadJson.success) {
            throw new Error((uploadJson && uploadJson.error && uploadJson.error.message) || 'Image upload to Cloudinary failed');
          }

          finalImageUrl = (uploadJson.data && uploadJson.data.secureUrl) || finalImageUrl;
        }

        if (!finalImageUrl) {
          finalImageUrl = '6424266ea05809dff501d86e/lane4-6dbhNuWa5oI-640x640.jpg';
        }

        const features = featuresText.split('\n').map(f => f.trim()).filter(Boolean);

        submitBtn.textContent = 'Saving to Database...';
        const productPayload = {
          name,
          sku: sku || undefined,
          category,
          categorySlug: category,
          regularPrice: regPrice,
          salePrice: salePrice,
          shortDescription,
          description,
          features,
          images: [{ url: finalImageUrl, alt: name, isPrimary: true }],
          stockQuantity: stockQty,
          isPublished
        };

        const createRes = await window.lane4ApiRequest('/admin/products', {
          method: 'POST',
          body: JSON.stringify(productPayload)
        });

        hideModal();
        showToast('Product created successfully & published to store!');
        loadProducts();

      } catch (err) {
        alertBox.style.display = 'block';
        alertBox.style.background = '#fef2f2';
        alertBox.style.color = '#dc2626';
        alertBox.textContent = err.message || 'Failed to create product.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save & Publish';
      }
    };
  }

  async function deleteProduct(id, name) {
    const confirmed = await showThemedConfirm({
      title: 'Archive Product',
      message: `Are you sure you want to archive product <strong>"${name}"</strong>? It will be removed from the public storefront catalog immediately.`,
      confirmText: 'Archive Product',
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await window.lane4ApiRequest(`/admin/products/${id}`, {
        method: 'DELETE'
      });
      showToast('Product archived successfully.');
      loadProducts();
    } catch (err) {
      showToast(err.message || 'Error deleting product', 'error');
    }
  }

  // --- CATEGORIES MANAGEMENT ---
  async function loadCategories() {
    const container = document.getElementById('view-categories');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px;color:#64748b;">Loading categories...</p>';

    try {
      const res = await window.lane4ApiRequest('/admin/categories');
      const cats = res.data || [];

      container.innerHTML = `
        <div class="card">
          <div class="card-header" style="flex-wrap:wrap;gap:12px;">
            <div class="card-title">Categories &amp; Navigation (${cats.length})</div>
            <button class="btn" id="btn-add-category" style="background:#000;color:#fff;display:inline-flex;align-items:center;gap:6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Add New Category</span>
            </button>
          </div>
          <div class="card-body" style="padding:0;">
            <div class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Category Name</th>
                    <th>Slug</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${cats.length === 0 ? '<tr><td colspan="6" style="text-align:center;padding:24px;color:#888;">No categories found.</td></tr>' :
                    cats.map(c => `
                      <tr>
                        <td><strong>#${c.displayOrder}</strong></td>
                        <td><strong style="color:#0f172a;">${c.name}</strong></td>
                        <td><code>${c.slug}</code></td>
                        <td style="color:#64748b;font-size:13px;max-width:300px;">${c.description || '—'}</td>
                        <td><span class="badge ${c.isPublished ? 'badge-active' : 'badge-pending'}">${c.isPublished ? 'Published' : 'Draft'}</span></td>
                        <td>
                          <div style="display:flex;gap:6px;">
                            <a href="../category/${c.slug}.html" target="_blank" class="btn btn-outline" style="padding:5px 9px;font-size:11px;text-decoration:none;">View ↗</a>
                            <button class="btn btn-danger btn-del-cat" data-id="${c.id}" data-name="${c.name.replace(/"/g, '&quot;')}" style="padding:5px 9px;font-size:11px;">Delete</button>
                          </div>
                        </td>
                      </tr>
                    `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // Hook Add Category Button
      const addBtn = document.getElementById('btn-add-category');
      if (addBtn) addBtn.onclick = openAddCategoryModal;

      // Hook Delete buttons
      container.querySelectorAll('.btn-del-cat').forEach(btn => {
        btn.onclick = () => {
          const id = btn.getAttribute('data-id');
          const name = btn.getAttribute('data-name');
          deleteCategory(id, name);
        };
      });

    } catch (err) {
      container.innerHTML = `<p style="color:#ef4444;padding:20px;">Error loading categories: ${err.message}</p>`;
    }
  }

  function openAddCategoryModal() {
    const formHtml = `
      <form id="form-create-category">
        <div class="form-row">
          <div class="form-group" style="flex:2;">
            <label class="form-label">Category Name *</label>
            <input type="text" id="new-cat-name" class="form-input" placeholder="e.g. Training Fins &amp; Paddles" required />
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Display Order</label>
            <input type="number" id="new-cat-order" class="form-input" value="6" min="1" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">URL Slug (Auto-generated)</label>
          <input type="text" id="new-cat-slug" class="form-input" placeholder="training-fins-paddles" />
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="new-cat-desc" class="form-textarea" rows="3" placeholder="Category overview shown in search and SEO meta tags..."></textarea>
        </div>

        <div class="form-group" style="margin-top:14px;">
          <label style="display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;cursor:pointer;">
            <input type="checkbox" id="new-cat-published" checked style="width:18px;height:18px;" />
            <span>Publish Category on Storefront</span>
          </label>
        </div>

        <div id="modal-cat-alert" style="display:none;padding:10px 14px;border-radius:6px;font-size:13px;margin-bottom:14px;"></div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('admin-modal-close-btn').click()">Cancel</button>
          <button type="submit" id="btn-save-cat-submit" class="btn" style="background:#000;color:#fff;min-width:140px;justify-content:center;">Create Category</button>
        </div>
      </form>
    `;

    showModal('Add New Category', formHtml);

    // Auto slug generation
    const nameInput = document.getElementById('new-cat-name');
    const slugInput = document.getElementById('new-cat-slug');
    if (nameInput && slugInput) {
      nameInput.oninput = () => {
        slugInput.value = nameInput.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      };
    }

    // Submit handler
    const form = document.getElementById('form-create-category');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-save-cat-submit');
      const alertBox = document.getElementById('modal-cat-alert');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';
      alertBox.style.display = 'none';

      try {
        const name = nameInput.value.trim();
        const slug = slugInput.value.trim();
        const displayOrder = parseInt(document.getElementById('new-cat-order').value, 10) || 6;
        const description = document.getElementById('new-cat-desc').value.trim();
        const isPublished = document.getElementById('new-cat-published').checked;

        await window.lane4ApiRequest('/admin/categories', {
          method: 'POST',
          body: JSON.stringify({ name, slug, displayOrder, description, isPublished })
        });

        hideModal();
        showToast('Category created & storefront page generated!');
        loadCategories();

      } catch (err) {
        alertBox.style.display = 'block';
        alertBox.style.background = '#fef2f2';
        alertBox.style.color = '#dc2626';
        alertBox.textContent = err.message || 'Failed to create category.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Category';
      }
    };
  }

  async function deleteCategory(id, name) {
    const confirmed = await showThemedConfirm({
      title: 'Delete Category',
      message: `Are you sure you want to delete category <strong>"${name}"</strong>? Products in this category may need reassigning.`,
      confirmText: 'Delete Category',
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await window.lane4ApiRequest(`/admin/categories/${id}`, {
        method: 'DELETE'
      });
      showToast('Category deleted successfully.');
      loadCategories();
    } catch (err) {
      showToast(err.message || 'Error deleting category', 'error');
    }
  }

  // --- COUPONS MANAGEMENT ---
  async function loadCoupons() {
    const container = document.getElementById('view-coupons');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px;color:#64748b;">Loading promotional coupons...</p>';

    try {
      const res = await window.lane4ApiRequest('/admin/coupons');
      const coupons = res.data || [];

      container.innerHTML = `
        <div class="card">
          <div class="card-header" style="flex-wrap:wrap;gap:12px;">
            <div class="card-title">Promotional Coupons (${coupons.length})</div>
            <button class="btn" id="btn-add-coupon" style="background:#000;color:#fff;display:inline-flex;align-items:center;gap:6px;">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Add New Coupon</span>
            </button>
          </div>
          <div class="card-body" style="padding:0;">
            <div class="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Discount</th>
                    <th>Min Order</th>
                    <th>Usage / Limit</th>
                    <th>Expiry Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${coupons.length === 0 ? '<tr><td colspan="7" style="text-align:center;padding:24px;color:#888;">No coupons created yet.</td></tr>' :
                    coupons.map(cp => {
                      const discountStr = cp.discountType === 'percentage' 
                        ? `${cp.discountValue}% OFF` 
                        : `${window.LANE4.formatINR(cp.discountValue)} OFF`;

                      const expiryStr = cp.expiryDate ? formatDateTime(cp.expiryDate, true) : 'No expiry';

                      return `
                        <tr>
                          <td><code style="background:#f1f5f9;padding:4px 8px;border-radius:4px;font-weight:900;letter-spacing:1px;color:#0f172a;">${cp.code}</code></td>
                          <td style="font-weight:700;color:#16a34a;">${discountStr}</td>
                          <td>${cp.minOrderFormatted || '₹ 0.00'}</td>
                          <td>${cp.usedCount || 0} / ${cp.totalUsageLimit || '∞'} redemptions</td>
                          <td style="font-size:12px;color:#64748b;">${expiryStr}</td>
                          <td><span class="badge ${cp.isActive ? 'badge-active' : 'badge-rejected'}">${cp.isActive ? 'Active' : 'Inactive'}</span></td>
                          <td>
                            <button class="btn btn-danger btn-del-coupon" data-code="${cp.code}" style="padding:5px 9px;font-size:11px;">Delete</button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // Hook Add Coupon Button
      const addBtn = document.getElementById('btn-add-coupon');
      if (addBtn) addBtn.onclick = openAddCouponModal;

      // Hook Delete buttons
      container.querySelectorAll('.btn-del-coupon').forEach(btn => {
        btn.onclick = () => {
          const code = btn.getAttribute('data-code');
          deleteCoupon(code);
        };
      });

    } catch (err) {
      container.innerHTML = `<p style="color:#ef4444;padding:20px;">Error loading coupons: ${err.message}</p>`;
    }
  }

  function openAddCouponModal() {
    const formHtml = `
      <form id="form-create-coupon">
        <div class="form-row">
          <div class="form-group" style="flex:1;">
            <label class="form-label">Coupon Promo Code *</label>
            <input type="text" id="new-cp-code" class="form-input" placeholder="e.g. SWIMCHAMP20" style="text-transform:uppercase;font-weight:700;letter-spacing:1px;" required />
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Discount Type *</label>
            <select id="new-cp-type" class="form-select" required>
              <option value="percentage">Percentage Discount (%)</option>
              <option value="fixed_amount">Fixed Amount Discount (₹ INR)</option>
            </select>
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Discount Value *</label>
            <input type="number" id="new-cp-value" class="form-input" placeholder="20" min="1" step="1" required />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Description / Offer Details</label>
          <input type="text" id="new-cp-desc" class="form-input" placeholder="e.g. 20% off for all state swim meet competitors" />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Minimum Order Value (₹ INR)</label>
            <input type="number" id="new-cp-min-order" class="form-input" value="999" min="0" step="1" />
          </div>
          <div class="form-group">
            <label class="form-label">Max Discount Cap (₹ INR, optional)</label>
            <input type="number" id="new-cp-max-discount" class="form-input" placeholder="500" min="0" step="1" />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Expiration Date</label>
            <input type="date" id="new-cp-expiry" class="form-input" value="2030-12-31" />
          </div>
          <div class="form-group">
            <label class="form-label">Total Usage Limit</label>
            <input type="number" id="new-cp-limit" class="form-input" value="1000" min="1" />
          </div>
        </div>

        <div class="form-group" style="margin-top:14px;">
          <label style="display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:700;cursor:pointer;">
            <input type="checkbox" id="new-cp-active" checked style="width:18px;height:18px;" />
            <span>Enable Coupon Code Immediately</span>
          </label>
        </div>

        <div id="modal-cp-alert" style="display:none;padding:10px 14px;border-radius:6px;font-size:13px;margin-bottom:14px;"></div>

        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:20px;">
          <button type="button" class="btn btn-outline" onclick="document.getElementById('admin-modal-close-btn').click()">Cancel</button>
          <button type="submit" id="btn-save-cp-submit" class="btn" style="background:#000;color:#fff;min-width:140px;justify-content:center;">Create Coupon</button>
        </div>
      </form>
    `;

    showModal('Add Promotional Coupon', formHtml);

    const form = document.getElementById('form-create-coupon');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-save-cp-submit');
      const alertBox = document.getElementById('modal-cp-alert');

      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving...';
      alertBox.style.display = 'none';

      try {
        const code = document.getElementById('new-cp-code').value.trim().toUpperCase();
        const discountType = document.getElementById('new-cp-type').value;
        const discountValue = parseFloat(document.getElementById('new-cp-value').value);
        const description = document.getElementById('new-cp-desc').value.trim();
        const minOrder = parseFloat(document.getElementById('new-cp-min-order').value) || 0;
        const maxDiscountVal = document.getElementById('new-cp-max-discount').value;
        const maxDiscount = maxDiscountVal ? parseFloat(maxDiscountVal) : null;
        const expiryDate = document.getElementById('new-cp-expiry').value;
        const totalUsageLimit = parseInt(document.getElementById('new-cp-limit').value, 10) || 1000;
        const isActive = document.getElementById('new-cp-active').checked;

        await window.lane4ApiRequest('/admin/coupons', {
          method: 'POST',
          body: JSON.stringify({
            code,
            description,
            discountType,
            discountValue,
            minOrderValue: minOrder,
            maxDiscount,
            expiryDate,
            totalUsageLimit,
            isActive
          })
        });

        hideModal();
        showToast(`Coupon ${code} created successfully!`);
        loadCoupons();

      } catch (err) {
        alertBox.style.display = 'block';
        alertBox.style.background = '#fef2f2';
        alertBox.style.color = '#dc2626';
        alertBox.textContent = err.message || 'Failed to create coupon.';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Coupon';
      }
    };
  }

  async function deleteCoupon(code) {
    const confirmed = await showThemedConfirm({
      title: 'Delete Coupon',
      message: `Are you sure you want to delete promotional coupon code <strong>"${code}"</strong>? Customers will no longer be able to use this discount.`,
      confirmText: 'Delete Coupon',
      isDanger: true
    });
    if (!confirmed) return;

    try {
      await window.lane4ApiRequest(`/admin/coupons/${encodeURIComponent(code)}`, {
        method: 'DELETE'
      });
      showToast(`Coupon ${code} removed.`);
      loadCoupons();
    } catch (err) {
      showToast(err.message || 'Error deleting coupon', 'error');
    }
  }

  // --- CUSTOMERS ---
  async function loadCustomers() {
    const c = document.getElementById('view-customers');
    if (!c) return;
    c.innerHTML = '<p style="padding:20px;color:#64748b;">Loading registered swimmers...</p>';

    try {
      const res = await window.lane4ApiRequest('/admin/customers');
      const custs = res.data || [];
      c.innerHTML = `
        <div class="card">
          <div class="card-header"><div class="card-title">Registered Swimmers (${custs.length})</div></div>
          <div class="card-body" style="padding:0;">
            <div class="table-responsive">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Status</th></tr></thead>
                <tbody>
                  ${custs.length === 0 ? '<tr><td colspan="4" style="text-align:center;padding:24px;color:#888;">No customers registered yet.</td></tr>' :
                    custs.map(cu => `<tr><td><strong>${cu.displayName || 'Swimmer'}</strong></td><td>${cu.email}</td><td>${cu.phoneNumber || '—'}</td><td><span class="badge badge-active">${cu.status || 'Active'}</span></td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      c.innerHTML = `<p style="color:#ef4444;padding:20px;">Error: ${err.message}</p>`;
    }
  }

  // --- ENQUIRIES ---
  async function loadEnquiries() {
    const c = document.getElementById('view-enquiries');
    if (!c) return;
    c.innerHTML = '<p style="padding:20px;color:#64748b;">Loading support enquiries...</p>';

    try {
      const res = await window.lane4ApiRequest('/admin/enquiries');
      const enqs = res.data || [];
      c.innerHTML = `
        <div class="card">
          <div class="card-header"><div class="card-title">Support &amp; Contact Enquiries (${enqs.length})</div></div>
          <div class="card-body" style="padding:0;">
            <div class="table-responsive">
              <table>
                <thead><tr><th>Type</th><th>Name</th><th>Email</th><th>Message</th><th>Date</th></tr></thead>
                <tbody>
                  ${enqs.length === 0 ? '<tr><td colspan="5" style="text-align:center;padding:24px;color:#888;">No support enquiries submitted.</td></tr>' :
                    enqs.map(eq => `<tr><td><span class="badge badge-pending">${eq.type || 'General'}</span></td><td><strong>${eq.name}</strong></td><td>${eq.email}</td><td>${eq.message}</td><td style="font-size:12px;color:#666;">${formatDateTime(eq.createdAt, true)}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      c.innerHTML = `<p style="color:#ef4444;padding:20px;">Error: ${err.message}</p>`;
    }
  }

  // --- AUDIT LOGS ---
  async function loadLogs() {
    const c = document.getElementById('view-logs');
    if (!c) return;
    c.innerHTML = '<p style="padding:20px;color:#64748b;">Loading audit logs...</p>';

    try {
      const res = await window.lane4ApiRequest('/admin/logs');
      const rawLogs = res.data || [];
      // Sort newest at the top
      rawLogs.sort((a, b) => (toMillis(b.timestamp) || 0) - (toMillis(a.timestamp) || 0));

      function renderLogRows(logsToRender) {
        if (!logsToRender || logsToRender.length === 0) {
          return '<tr><td colspan="5" style="text-align:center;padding:36px 20px;color:#64748b;font-size:13px;">No administrative events match your criteria.</td></tr>';
        }
        return logsToRender.map(l => `
          <tr>
            <td style="white-space:nowrap;width:170px;">
              ${formatLogDate(l.timestamp)}
            </td>
            <td style="white-space:nowrap;width:240px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:34px;height:34px;border-radius:50%;background:#0f172a;color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;flex-shrink:0;box-shadow:0 1px 2px rgba(0,0,0,0.1);">
                  ${((l.adminEmail || 'AD').replace(/[^a-zA-Z]/g, '')).slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style="font-weight:700;font-size:13px;color:#0f172a;line-height:1.2;">LANE4 Operations Staff</div>
                  <div style="font-size:11.5px;color:#64748b;line-height:1.2;margin-top:2px;">${escapeHtml(l.adminEmail || 'admin@lane4swim.in')}</div>
                </div>
              </div>
            </td>
            <td style="white-space:nowrap;width:170px;">
              ${formatActionBadge(l.action)}
            </td>
            <td style="white-space:nowrap;width:170px;">
              ${formatResource(l.resourceType, l.resourceId)}
            </td>
            <td style="vertical-align:middle;">
              ${formatLogDetails(l.action, l.details, l.resourceType, l.resourceId)}
            </td>
          </tr>
        `).join('');
      }

      c.innerHTML = `
        <div class="card">
          <div class="card-header" style="flex-wrap:wrap;gap:12px;padding:16px 20px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div class="card-title" style="margin:0;">Staff Activity Audit Trail</div>
              <span id="log-count-badge" style="background:#f1f5f9;color:#334155;font-weight:700;font-size:11px;padding:3px 9px;border-radius:12px;border:1px solid #e2e8f0;">
                ${rawLogs.length} logged ${rawLogs.length === 1 ? 'event' : 'events'}
              </span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;">
              <input type="text" id="log-search-filter" placeholder="Filter by staff, action or ID..." style="padding:7px 12px;font-size:12.5px;border:1.5px solid var(--border);border-radius:6px;width:240px;outline:none;" />
              <button class="btn btn-outline" id="btn-refresh-log-trail" style="padding:7px 12px;font-size:12px;display:inline-flex;align-items:center;gap:5px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                <span>Refresh</span>
              </button>
            </div>
          </div>
          <div class="card-body" style="padding:0;">
            <div class="table-responsive">
              <table style="width:100%;min-width:860px;">
                <thead>
                  <tr>
                    <th style="width:170px;">Timestamp</th>
                    <th style="width:240px;">Staff Member</th>
                    <th style="width:170px;">Action</th>
                    <th style="width:170px;">Target Resource</th>
                    <th>Activity Details</th>
                  </tr>
                </thead>
                <tbody id="log-table-body">
                  ${renderLogRows(rawLogs)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // Live search filter
      const searchInput = document.getElementById('log-search-filter');
      const tableBody = document.getElementById('log-table-body');
      const countBadge = document.getElementById('log-count-badge');
      if (searchInput && tableBody) {
        searchInput.oninput = () => {
          const q = searchInput.value.toLowerCase().trim();
          const filtered = rawLogs.filter(l =>
            (l.adminEmail && l.adminEmail.toLowerCase().includes(q)) ||
            (l.action && l.action.toLowerCase().includes(q)) ||
            (l.resourceType && l.resourceType.toLowerCase().includes(q)) ||
            (l.resourceId && l.resourceId.toLowerCase().includes(q)) ||
            (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
          );
          tableBody.innerHTML = renderLogRows(filtered);
          if (countBadge) countBadge.textContent = `${filtered.length} of ${rawLogs.length} events`;
        };
      }

      const refreshBtn = document.getElementById('btn-refresh-log-trail');
      if (refreshBtn) refreshBtn.onclick = () => loadLogs();
    } catch (err) {
      c.innerHTML = `<p style="color:#ef4444;padding:20px;">Error: ${err.message}</p>`;
    }
  }

  // --- SETTINGS ---
  async function loadSettings() {
    const container = document.getElementById('view-settings');
    if (!container) return;
    container.innerHTML = '<p style="padding:20px;color:#64748b;">Loading store settings...</p>';

    try {
      const payRes = await window.lane4ApiRequest('/store/payment-settings').catch(() => window.lane4ApiRequest('/admin/store/payment-settings'));
      const shipRes = await window.lane4ApiRequest('/shipping/settings');
      const p = (payRes && payRes.data) || {};
      const s = (shipRes && shipRes.data) || {};

      const freeThresh = Math.round((s.freeShippingThresholdPaise || 99900) / 100);
      const stdRate = Math.round((s.standardRatePaise || 9900) / 100);

      container.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:24px;">
          <!-- Payment QR Settings Card -->
          <div class="card" style="border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 4px 16px -2px rgba(15,23,42,0.06);background:#ffffff;">
            <div class="card-header" style="background:#ffffff;padding:18px 22px;border-bottom:1.5px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#0f172a;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="16" x2="6.01" y2="16"/><line x1="10" y1="16" x2="14" y2="16"/></svg>
                </div>
                <div>
                  <div class="card-title" style="font-size:16px;font-weight:900;color:#0f172a;">UPI &amp; QR Payment Settings</div>
                  <div style="font-size:12px;color:#64748b;">Instant settlement configuration</div>
                </div>
              </div>
              <span class="badge badge-verified" style="font-size:10px;font-weight:800;letter-spacing:0.5px;">LIVE IN CHECKOUT</span>
            </div>

            <div class="card-body" style="padding:22px;">
              <!-- Live Configuration Summary Table -->
              <div style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#ffffff;">
                <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
                  <thead>
                    <tr style="background:#f8fafc;border-bottom:1.5px solid #e2e8f0;">
                      <th style="padding:10px 14px;font-size:10.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;border-right:1px solid #e2e8f0;">Parameter</th>
                      <th style="padding:10px 14px;font-size:10.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;border-right:1px solid #e2e8f0;">Storefront Value</th>
                      <th style="padding:10px 14px;font-size:10.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">System State</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:10px 14px;font-weight:700;color:#334155;border-right:1px solid #f1f5f9;">Store UPI ID</td>
                      <td style="padding:10px 14px;border-right:1px solid #f1f5f9;"><code id="tbl-upi-id" style="background:#f1f5f9;color:#0f172a;padding:3px 7px;border-radius:4px;font-weight:800;">${p.upiId || 'lane4swim@upi'}</code></td>
                      <td style="padding:10px 14px;"><span class="badge badge-verified" style="font-size:10px;">Active &amp; Ready</span></td>
                    </tr>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:10px 14px;font-weight:700;color:#334155;border-right:1px solid #f1f5f9;">Merchant Name</td>
                      <td style="padding:10px 14px;font-weight:600;color:#0f172a;border-right:1px solid #f1f5f9;" id="tbl-merchant-name">${p.merchantName || 'The LANE4 Performance Store'}</td>
                      <td style="padding:10px 14px;"><span class="badge badge-verified" style="font-size:10px;">Verified Display</span></td>
                    </tr>
                    <tr>
                      <td style="padding:10px 14px;font-weight:700;color:#334155;border-right:1px solid #f1f5f9;">Expiry Window</td>
                      <td style="padding:10px 14px;font-weight:600;color:#0f172a;border-right:1px solid #f1f5f9;"><span id="tbl-window-mins">${p.verificationWindowMinutes || 30}</span> Minutes</td>
                      <td style="padding:10px 14px;"><span class="badge badge-processing" style="font-size:10px;">Timer Enforced</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Form -->
              <form id="lane4-settings-payment-form">
                <div style="margin-bottom:16px;">
                  <label style="display:block;font-size:11.5px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Store UPI ID (VPA)</label>
                  <input type="text" id="set-upi-id" value="${p.upiId || 'lane4swim@upi'}" style="width:100%;padding:11px 14px;border:1.5px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-family:inherit;font-size:14px;color:#0f172a;box-sizing:border-box;" required />
                  <span style="font-size:11px;color:#64748b;display:block;margin-top:4px;">Swimmers scan or transfer directly to this address.</span>
                </div>

                <div style="margin-bottom:16px;">
                  <label style="display:block;font-size:11.5px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Merchant Account Name</label>
                  <input type="text" id="set-merchant-name" value="${p.merchantName || 'The LANE4 Performance Store'}" style="width:100%;padding:11px 14px;border:1.5px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-family:inherit;font-size:14px;color:#0f172a;box-sizing:border-box;" required />
                  <span style="font-size:11px;color:#64748b;display:block;margin-top:4px;">Official beneficiary name shown inside Google Pay, PhonePe, and Paytm.</span>
                </div>

                <div style="margin-bottom:16px;">
                  <label style="display:block;font-size:11.5px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Verification Time Window (Minutes)</label>
                  <input type="number" id="set-window-mins" value="${p.verificationWindowMinutes || 30}" style="width:100%;padding:11px 14px;border:1.5px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-family:inherit;font-size:14px;color:#0f172a;box-sizing:border-box;" required />
                  <span style="font-size:11px;color:#64748b;display:block;margin-top:4px;">Pending payments expire after this duration if proof is not submitted.</span>
                </div>

                <div style="margin-bottom:20px;">
                  <label style="display:block;font-size:11.5px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Instructions for Swimmers</label>
                  <textarea id="set-instructions" rows="3" style="width:100%;padding:11px 14px;border:1.5px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-family:inherit;font-size:13.5px;color:#0f172a;line-height:1.5;box-sizing:border-box;">${p.instructions || 'Pay via any UPI app (GPay, PhonePe, Paytm). Enter the 12-digit UTR and upload a payment receipt screenshot.'}</textarea>
                </div>

                <button type="submit" id="btn-save-upi" class="btn" style="background:#0f172a;color:#ffffff;width:100%;justify-content:center;padding:12px;font-size:13.5px;font-weight:800;border-radius:8px;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(15,23,42,0.15);cursor:pointer;transition:all 0.2s;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                  <span>Update UPI Settings</span>
                </button>
              </form>
            </div>
          </div>

          <!-- Shipping Settings Card -->
          <div class="card" style="border:1px solid #cbd5e1;border-radius:12px;box-shadow:0 4px 16px -2px rgba(15,23,42,0.06);background:#ffffff;">
            <div class="card-header" style="background:#ffffff;padding:18px 22px;border-bottom:1.5px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:8px;background:#f1f5f9;display:flex;align-items:center;justify-content:center;color:#0f172a;">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                </div>
                <div>
                  <div class="card-title" style="font-size:16px;font-weight:900;color:#0f172a;">PAN India Delivery &amp; Shipping</div>
                  <div style="font-size:12px;color:#64748b;">Shipping rules &amp; threshold rates</div>
                </div>
              </div>
              <span class="badge badge-verified" style="font-size:10px;font-weight:800;letter-spacing:0.5px;">LIVE IN CHECKOUT</span>
            </div>

            <div class="card-body" style="padding:22px;">
              <!-- Live Shipping Tier Summary Table -->
              <div style="margin-bottom:20px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;background:#ffffff;">
                <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
                  <thead>
                    <tr style="background:#f8fafc;border-bottom:1.5px solid #e2e8f0;">
                      <th style="padding:10px 14px;font-size:10.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;border-right:1px solid #e2e8f0;">Order Tier</th>
                      <th style="padding:10px 14px;font-size:10.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;border-right:1px solid #e2e8f0;">Shipping Charge</th>
                      <th style="padding:10px 14px;font-size:10.5px;color:#475569;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Transit Guarantee</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="border-bottom:1px solid #f1f5f9;">
                      <td style="padding:10px 14px;font-weight:700;color:#334155;border-right:1px solid #f1f5f9;">Under ₹<span id="tbl-thresh-under">${freeThresh}</span></td>
                      <td style="padding:10px 14px;font-weight:800;color:#dc2626;border-right:1px solid #f1f5f9;" id="tbl-shipping-rate">₹${stdRate}.00</td>
                      <td style="padding:10px 14px;color:#475569;" id="tbl-transit-1">${s.estimatedTransitDays || '3–6 business days'}</td>
                    </tr>
                    <tr>
                      <td style="padding:10px 14px;font-weight:700;color:#334155;border-right:1px solid #f1f5f9;">₹<span id="tbl-thresh-over">${freeThresh}</span> and Above</td>
                      <td style="padding:10px 14px;border-right:1px solid #f1f5f9;"><span class="badge badge-verified" style="font-size:10px;font-weight:800;">FREE SHIPPING</span></td>
                      <td style="padding:10px 14px;color:#475569;" id="tbl-transit-2">${s.estimatedTransitDays || '3–6 business days'} (Priority)</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <!-- Form -->
              <form id="lane4-settings-shipping-form">
                <div style="margin-bottom:16px;">
                  <label style="display:block;font-size:11.5px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Free Shipping Threshold (₹ INR)</label>
                  <input type="number" id="set-free-threshold" value="${freeThresh}" style="width:100%;padding:11px 14px;border:1.5px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-family:inherit;font-size:14px;color:#0f172a;box-sizing:border-box;" required />
                  <span style="font-size:11px;color:#64748b;display:block;margin-top:4px;">Cart subtotals equal or higher than this value receive free delivery automatically.</span>
                </div>

                <div style="margin-bottom:16px;">
                  <label style="display:block;font-size:11.5px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Standard Delivery Fee (₹ INR)</label>
                  <input type="number" id="set-shipping-rate" value="${stdRate}" style="width:100%;padding:11px 14px;border:1.5px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-family:inherit;font-size:14px;color:#0f172a;box-sizing:border-box;" required />
                  <span style="font-size:11px;color:#64748b;display:block;margin-top:4px;">Flat standard shipping rate applied to orders below the free threshold.</span>
                </div>

                <div style="margin-bottom:20px;">
                  <label style="display:block;font-size:11.5px;font-weight:800;color:#334155;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Estimated Transit Window</label>
                  <input type="text" id="set-transit-days" value="${s.estimatedTransitDays || '3–6 business days'}" style="width:100%;padding:11px 14px;border:1.5px solid #cbd5e1;border-radius:8px;background:#f8fafc;font-family:inherit;font-size:14px;color:#0f172a;box-sizing:border-box;" required />
                  <span style="font-size:11px;color:#64748b;display:block;margin-top:4px;">Estimated delivery duration displayed to customers during checkout.</span>
                </div>

                <button type="submit" id="btn-save-shipping" class="btn" style="background:#0f172a;color:#ffffff;width:100%;justify-content:center;padding:12px;font-size:13.5px;font-weight:800;border-radius:8px;letter-spacing:0.3px;box-shadow:0 4px 12px rgba(15,23,42,0.15);cursor:pointer;transition:all 0.2s;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                  <span>Update Shipping Rates</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      `;

      // Payment settings submit
      document.getElementById('lane4-settings-payment-form').onsubmit = async (e) => {
        e.preventDefault();
        const upiId = document.getElementById('set-upi-id').value.trim();
        const merchantName = document.getElementById('set-merchant-name').value.trim();
        const windowMins = parseInt(document.getElementById('set-window-mins').value, 10);
        const instructions = document.getElementById('set-instructions').value.trim();

        const btn = document.getElementById('btn-save-upi');
        if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

        try {
          await window.lane4ApiRequest('/admin/store/payment-settings', {
            method: 'PATCH',
            body: JSON.stringify({
              upiId,
              merchantName,
              verificationWindowMinutes: windowMins,
              instructions
            })
          });

          // Instantly update live table
          const tblUpi = document.getElementById('tbl-upi-id');
          if (tblUpi) tblUpi.textContent = upiId;
          const tblMerch = document.getElementById('tbl-merchant-name');
          if (tblMerch) tblMerch.textContent = merchantName;
          const tblWin = document.getElementById('tbl-window-mins');
          if (tblWin) tblWin.textContent = windowMins;

          showToast('UPI Payment settings saved and live in storefront!');
        } catch (err) {
          showToast(err.message || 'Failed to update payment settings', 'error');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg><span>Update UPI Settings</span>`;
          }
        }
      };

      // Shipping settings submit
      document.getElementById('lane4-settings-shipping-form').onsubmit = async (e) => {
        e.preventDefault();
        const freeVal = parseInt(document.getElementById('set-free-threshold').value, 10);
        const rateVal = parseInt(document.getElementById('set-shipping-rate').value, 10);
        const transitVal = document.getElementById('set-transit-days').value.trim();

        const btn = document.getElementById('btn-save-shipping');
        if (btn) { btn.disabled = true; btn.innerText = 'Saving...'; }

        try {
          await window.lane4ApiRequest('/admin/store/shipping-settings', {
            method: 'PATCH',
            body: JSON.stringify({
              freeShippingThresholdPaise: freeVal * 100,
              standardRatePaise: rateVal * 100,
              estimatedTransitDays: transitVal
            })
          });

          // Instantly update live table
          const tblUnder = document.getElementById('tbl-thresh-under');
          if (tblUnder) tblUnder.textContent = freeVal;
          const tblOver = document.getElementById('tbl-thresh-over');
          if (tblOver) tblOver.textContent = freeVal;
          const tblRate = document.getElementById('tbl-shipping-rate');
          if (tblRate) tblRate.textContent = `₹${rateVal}.00`;
          const tblTr1 = document.getElementById('tbl-transit-1');
          if (tblTr1) tblTr1.textContent = transitVal;
          const tblTr2 = document.getElementById('tbl-transit-2');
          if (tblTr2) tblTr2.textContent = `${transitVal} (Priority)`;

          showToast('Shipping rates saved and active across India!');
        } catch (err) {
          showToast(err.message || 'Failed to update shipping rates', 'error');
        } finally {
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg><span>Update Shipping Rates</span>`;
          }
        }
      };

    } catch (err) {
      container.innerHTML = `<p style="color:#ef4444;padding:20px;">Error loading settings: ${err.message}</p>`;
    }
  }

  document.addEventListener('DOMContentLoaded', checkAdminAuth);
})();
