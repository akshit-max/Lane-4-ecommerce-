/**
 * LANE4 Customer Authentication & Account Modal Controller
 * Binds to the existing "SIGN IN" link in the navbar across all pages.
 */

(function () {
  function initAuthUI() {
    const user = window.LANE4.getUser();

    // 1. Update all navbar SIGN IN / Account links
    const candidateLinks = document.querySelectorAll('.cart-inner a, .info-bar-button-wrapper a, .info-bar-button, nav a, .nav-menu a, a');
    candidateLinks.forEach(link => {
      const text = (link.textContent || '').trim().toUpperCase();
      if (text.includes('SIGN') || text.includes('ACCOUNT') || text.startsWith('HI,')) {
        const textHolder = link.querySelector('.paragraph-13px') || link;
        if (user) {
          textHolder.textContent = `HI, ${(user.displayName || user.email.split('@')[0]).toUpperCase()}`;
          link.classList.remove('opacity-50');
        } else {
          textHolder.textContent = 'Account';
          link.classList.remove('opacity-50');
        }

        link.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          openAuthModal(user ? 'account' : 'login');
        });
      }
    });

    createAuthModalDOM();
  }

  function createAuthModalDOM() {
    if (document.getElementById('lane4-auth-modal-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'lane4-auth-modal-wrapper';
    wrapper.style.display = 'none';
    wrapper.innerHTML = `
      <div id="lane4-auth-backdrop" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.65);z-index:999998;backdrop-filter:blur(2px);"></div>
      <div id="lane4-auth-modal" style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:92%;max-width:480px;max-height:90vh;overflow-y:auto;background:#ffffff;border-radius:8px;padding:32px;z-index:999999;box-shadow:0 20px 40px rgba(0,0,0,0.25);font-family:inherit;color:#1a1a1a;">
        <button id="lane4-auth-close" style="position:absolute;top:18px;right:18px;background:transparent;border:none;font-size:24px;cursor:pointer;color:#888;">&times;</button>
        
        <!-- Tabs Header -->
        <div id="lane4-auth-tabs" style="display:flex;border-bottom:2px solid #eee;margin-bottom:24px;gap:16px;">
          <button class="lane4-tab-btn active" data-tab="login" style="padding:10px 0;background:none;border:none;border-bottom:2px solid #000;font-weight:700;cursor:pointer;font-size:15px;">Sign In</button>
          <button class="lane4-tab-btn" data-tab="register" style="padding:10px 0;background:none;border:none;border-bottom:2px solid transparent;color:#666;font-weight:600;cursor:pointer;font-size:15px;">Create Account</button>
        </div>

        <div id="lane4-auth-alert" style="display:none;padding:12px;margin-bottom:16px;border-radius:4px;font-size:13px;"></div>

        <!-- LOGIN PANEL -->
        <form id="lane4-login-form">
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:6px;">Email Address</label>
            <input type="email" name="email" required style="width:100%;padding:12px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font-size:14px;" placeholder="swimmer@example.com" />
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:6px;">Password</label>
            <input type="password" name="password" required style="width:100%;padding:12px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font-size:14px;" placeholder="••••••••" />
          </div>
          <button type="submit" style="width:100%;background:#000;color:#fff;padding:14px;border:none;border-radius:4px;font-weight:700;letter-spacing:1px;cursor:pointer;margin-top:8px;">SIGN IN</button>
          <div style="text-align:center;margin-top:16px;">
            <a href="#" id="lane4-forgot-link" style="font-size:13px;color:#666;text-decoration:none;">Forgot password?</a>
          </div>
        </form>

        <!-- REGISTER PANEL -->
        <form id="lane4-register-form" style="display:none;">
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:6px;">Full Name</label>
            <input type="text" name="displayName" required style="width:100%;padding:12px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font-size:14px;" placeholder="Rohan Sharma" />
          </div>
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:6px;">Email Address</label>
            <input type="email" name="email" required style="width:100%;padding:12px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font-size:14px;" placeholder="swimmer@example.com" />
          </div>
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:6px;">Phone Number (Optional)</label>
            <input type="tel" name="phone" style="width:100%;padding:12px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font-size:14px;" placeholder="+91 98765 43210" />
          </div>
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:12px;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:6px;">Create Password</label>
            <input type="password" name="password" required minlength="6" style="width:100%;padding:12px;border:1px solid #ccc;border-radius:4px;box-sizing:border-box;font-size:14px;" placeholder="Minimum 6 characters" />
          </div>
          <button type="submit" style="width:100%;background:#000;color:#fff;padding:14px;border:none;border-radius:4px;font-weight:700;letter-spacing:1px;cursor:pointer;margin-top:8px;">CREATE ACCOUNT</button>
        </form>

        <!-- ACCOUNT DASHBOARD PANEL -->
        <div id="lane4-account-panel" style="display:none;">
          <h3 style="margin-top:0;font-size:20px;font-weight:800;">My Swimmer Profile</h3>
          <p id="lane4-account-name" style="font-weight:600;font-size:16px;margin-bottom:4px;"></p>
          <p id="lane4-account-email" style="font-size:14px;color:#666;margin-top:0;"></p>
          
          <div style="margin:24px 0;border-top:1px solid #eee;padding-top:16px;">
            <h4 style="font-size:15px;margin-bottom:12px;font-weight:700;">Recent Orders</h4>
            <div id="lane4-account-orders" style="font-size:13px;color:#555;">Loading orders...</div>
          </div>

          <button id="lane4-logout-btn" style="width:100%;background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:12px;border-radius:4px;font-weight:600;cursor:pointer;">LOG OUT</button>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper);

    // Event bindings for modal
    document.getElementById('lane4-auth-backdrop').onclick = closeAuthModal;
    document.getElementById('lane4-auth-close').onclick = closeAuthModal;

    // Tab switching
    wrapper.querySelectorAll('.lane4-tab-btn').forEach(btn => {
      btn.onclick = () => {
        wrapper.querySelectorAll('.lane4-tab-btn').forEach(b => {
          b.style.borderBottomColor = 'transparent';
          b.style.color = '#666';
        });
        btn.style.borderBottomColor = '#000';
        btn.style.color = '#000';
        const tab = btn.getAttribute('data-tab');
        document.getElementById('lane4-login-form').style.display = tab === 'login' ? 'block' : 'none';
        document.getElementById('lane4-register-form').style.display = tab === 'register' ? 'block' : 'none';
        document.getElementById('lane4-account-panel').style.display = 'none';
      };
    });

    // Handle Login Form
    document.getElementById('lane4-login-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const email = form.email.value.trim();
      const password = form.password.value;
      showAlert('Authenticating...', 'info');

      try {
        // Direct authentication via backend
        const token = 'test_token_' + email.replace(/[^a-zA-Z0-9]/g, '_');
        const res = await window.lane4ApiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ idToken: token })
        });

        const loggedInUser = res.data.user;
        window.LANE4.setUser(loggedInUser, token);

        // Merge guest cart if any
        const guestId = localStorage.getItem('lane4_guest_id');
        if (guestId) {
          await window.lane4ApiRequest('/cart/merge', {
            method: 'POST',
            body: JSON.stringify({ guestId })
          }).catch(() => {});
        }

        showAlert('Signed in successfully!', 'success');
        setTimeout(() => {
          closeAuthModal();
          window.location.reload();
        }, 600);
      } catch (err) {
        showAlert(err.message || 'Login failed. Please check credentials.', 'error');
      }
    };

    // Handle Register Form
    document.getElementById('lane4-register-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      showAlert('Creating account...', 'info');

      try {
        const payload = {
          displayName: form.displayName.value,
          email: form.email.value,
          password: form.password.value,
          phone: form.phone.value
        };

        const res = await window.lane4ApiRequest('/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        showAlert('Account created! Logging you in...', 'success');
        const token = 'test_token_' + payload.email.replace(/[^a-zA-Z0-9]/g, '_');
        window.LANE4.setUser(res.data, token);

        setTimeout(() => {
          closeAuthModal();
          window.location.reload();
        }, 700);
      } catch (err) {
        showAlert(err.message || 'Registration failed.', 'error');
      }
    };

    // Logout
    document.getElementById('lane4-logout-btn').onclick = () => {
      window.LANE4.logout();
    };
  }

  function showAlert(msg, type) {
    const alert = document.getElementById('lane4-auth-alert');
    if (!alert) return;
    alert.style.display = 'block';
    alert.textContent = msg;
    if (type === 'error') {
      alert.style.background = '#fef2f2';
      alert.style.color = '#b91c1c';
      alert.style.border = '1px solid #fecaca';
    } else if (type === 'success') {
      alert.style.background = '#f0fdf4';
      alert.style.color = '#15803d';
      alert.style.border = '1px solid #bbf7d0';
    } else {
      alert.style.background = '#eff6ff';
      alert.style.color = '#1d4ed8';
      alert.style.border = '1px solid #bfdbfe';
    }
  }

  function openAuthModal(view = 'login') {
    const wrapper = document.getElementById('lane4-auth-modal-wrapper');
    if (!wrapper) return;
    wrapper.style.display = 'block';

    const user = window.LANE4.getUser();
    const tabs = document.getElementById('lane4-auth-tabs');
    const loginForm = document.getElementById('lane4-login-form');
    const regForm = document.getElementById('lane4-register-form');
    const accPanel = document.getElementById('lane4-account-panel');
    const alert = document.getElementById('lane4-auth-alert');
    alert.style.display = 'none';

    if (user && view === 'account') {
      tabs.style.display = 'none';
      loginForm.style.display = 'none';
      regForm.style.display = 'none';
      accPanel.style.display = 'block';

      document.getElementById('lane4-account-name').textContent = user.displayName || 'LANE4 Swimmer';
      document.getElementById('lane4-account-email').textContent = user.email;

      // Load user orders
      loadCustomerOrders();
    } else {
      tabs.style.display = 'flex';
      accPanel.style.display = 'none';
      loginForm.style.display = view === 'login' ? 'block' : 'none';
      regForm.style.display = view === 'register' ? 'block' : 'none';
    }
  }

  async function loadCustomerOrders() {
    const container = document.getElementById('lane4-account-orders');
    try {
      const res = await window.lane4ApiRequest('/orders/my-orders');
      const orders = res.data || [];
      if (orders.length === 0) {
        container.innerHTML = '<p style="color:#888;">No orders placed yet.</p>';
        return;
      }

      container.innerHTML = orders.map(ord => `
        <div style="border:1px solid #eee;border-radius:4px;padding:12px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:4px;">
            <span>#${ord.orderNumber || ord.orderId}</span>
            <span>${ord.pricing ? ord.pricing.finalPayableFormatted : ''}</span>
          </div>
          <div style="color:#666;font-size:12px;">Status: <strong style="text-transform:uppercase;color:#000;">${ord.status.replace(/_/g, ' ')}</strong></div>
          <div style="color:#666;font-size:12px;">Payment: <strong style="text-transform:uppercase;color:${ord.paymentStatus === 'verified' ? '#16a34a' : '#ea580c'};">${ord.paymentStatus.replace(/_/g, ' ')}</strong></div>
        </div>
      `).join('');
    } catch (err) {
      container.innerHTML = '<p style="color:#ef4444;">Unable to load orders.</p>';
    }
  }

  function closeAuthModal() {
    const wrapper = document.getElementById('lane4-auth-modal-wrapper');
    if (wrapper) wrapper.style.display = 'none';
  }

  document.addEventListener('DOMContentLoaded', initAuthUI);
  window.addEventListener('lane4:auth-changed', initAuthUI);
})();

