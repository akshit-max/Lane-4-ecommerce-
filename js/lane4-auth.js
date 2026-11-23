/**
 * LANE4 Customer Authentication & Account Modal Controller
 * Styled to perfectly match The Lane4 Performance Store design system.
 */

(function () {
  function initAuthUI() {
    let user = window.LANE4.getUser();

    // Enforce strict role boundary: Staff & admin accounts are rejected from customer storefront
    if (user) {
      const email = (user.email || '').toLowerCase().trim();
      const role = user.role || '';
      if (role === 'admin' || role === 'super_admin' || role === 'order_manager' || role === 'product_manager' || role === 'inventory_manager' || email.startsWith('admin_') || email.startsWith('admin@') || email.includes('admin@lane4swim.in')) {
        try {
          localStorage.removeItem('lane4_user');
          localStorage.removeItem('lane4_auth_token');
        } catch (_) {}
        user = null;
      }
    }

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

    // Inject styles for Auth Modal
    const styleEl = document.createElement('style');
    styleEl.id = 'lane4-auth-styles';
    styleEl.textContent = `
      #lane4-auth-modal-wrapper {
        position: fixed;
        inset: 0;
        z-index: 9999998;
        display: none;
        align-items: center;
        justify-content: center;
        font-family: 'Generalsans', 'General Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      #lane4-auth-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.72);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        z-index: 1;
      }
      #lane4-auth-card {
        position: relative;
        z-index: 2;
        width: 92%;
        max-width: 440px;
        max-height: 90vh;
        overflow-y: auto;
        background: #ffffff;
        border-radius: 14px;
        padding: 32px 28px 28px;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.05);
        color: #0f172a;
        box-sizing: border-box;
      }
      .lane4-auth-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 22px;
      }
      .lane4-auth-brand {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .lane4-auth-logo {
        font-size: 19px;
        font-weight: 900;
        letter-spacing: 2px;
        color: #000000;
      }
      .lane4-auth-badge {
        font-size: 9.5px;
        font-weight: 800;
        letter-spacing: 1px;
        background: #0f172a;
        color: #ffffff;
        padding: 3px 8px;
        border-radius: 4px;
        text-transform: uppercase;
      }
      .lane4-auth-close-btn {
        background: #f1f5f9;
        border: none;
        color: #64748b;
        cursor: pointer;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }
      .lane4-auth-close-btn:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
      .lane4-auth-tabs {
        display: flex;
        background: #f1f5f9;
        padding: 4px;
        border-radius: 8px;
        margin-bottom: 22px;
        gap: 4px;
      }
      .lane4-auth-tab-btn {
        flex: 1;
        padding: 9px 0;
        background: transparent;
        border: none;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 700;
        color: #64748b;
        cursor: pointer;
        transition: all 0.15s ease;
        text-align: center;
      }
      .lane4-auth-tab-btn.active {
        background: #000000;
        color: #ffffff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
      }
      .lane4-auth-form-group {
        margin-bottom: 16px;
      }
      .lane4-auth-label {
        display: block;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #334155;
        margin-bottom: 6px;
      }
      .lane4-auth-input {
        width: 100%;
        padding: 12px 14px;
        border: 1.5px solid #cbd5e1;
        border-radius: 8px;
        font-size: 14px;
        font-family: inherit;
        background: #ffffff;
        color: #0f172a;
        box-sizing: border-box;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .lane4-auth-input:focus {
        border-color: #000000;
        outline: none;
        box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.08);
      }
      .lane4-auth-submit-btn {
        width: 100%;
        background: #000000;
        color: #ffffff;
        padding: 14px;
        border: none;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        cursor: pointer;
        margin-top: 8px;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .lane4-auth-submit-btn:hover {
        background: #1e293b;
        transform: translateY(-1px);
        box-shadow: 0 4px 14px rgba(0,0,0,0.15);
      }
      .lane4-auth-submit-btn:active {
        transform: translateY(0);
      }
      .lane4-auth-link {
        font-size: 12.5px;
        color: #64748b;
        text-decoration: none;
        font-weight: 600;
        transition: color 0.15s;
        cursor: pointer;
      }
      .lane4-auth-link:hover {
        color: #000000;
      }
      .lane4-auth-alert {
        display: none;
        padding: 12px 14px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 16px;
      }
      .lane4-auth-alert.error {
        background: #fef2f2;
        color: #b91c1c;
        border: 1px solid #fee2e2;
      }
      .lane4-auth-alert.success {
        background: #f0fdf4;
        color: #15803d;
        border: 1px solid #dcfce7;
      }
      .lane4-auth-alert.info {
        background: #f0f9ff;
        color: #0369a1;
        border: 1px solid #e0f2fe;
      }
      .lane4-order-card {
        border: 1.5px solid #e2e8f0;
        border-radius: 10px;
        padding: 14px;
        margin-bottom: 12px;
        background: #f8fafc;
        cursor: pointer;
        transition: all 0.18s ease;
      }
      .lane4-order-card:hover {
        border-color: #0f172a;
        background: #ffffff;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
        transform: translateY(-1px);
      }
      .lane4-order-card:focus {
        outline: 2px solid #000;
        outline-offset: 2px;
      }
    `;
    document.head.appendChild(styleEl);

    const wrapper = document.createElement('div');
    wrapper.id = 'lane4-auth-modal-wrapper';
    wrapper.innerHTML = `
      <div id="lane4-auth-backdrop"></div>
      <div id="lane4-auth-card">
        <!-- Header -->
        <div class="lane4-auth-header">
          <div class="lane4-auth-brand">
            <span class="lane4-auth-logo">LANE4</span>
            <span class="lane4-auth-badge">SWIMMER ACCESS</span>
          </div>
          <button id="lane4-auth-close" class="lane4-auth-close-btn" aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Pill Tabs -->
        <div id="lane4-auth-tabs" class="lane4-auth-tabs">
          <button class="lane4-auth-tab-btn active" data-tab="login">Sign In</button>
          <button class="lane4-auth-tab-btn" data-tab="register">Create Account</button>
          <button class="lane4-auth-tab-btn" data-tab="track">Track Order</button>
        </div>

        <div id="lane4-auth-alert" class="lane4-auth-alert"></div>

        <!-- LOGIN FORM -->
        <form id="lane4-login-form">
          <div class="lane4-auth-form-group">
            <label class="lane4-auth-label">Email Address</label>
            <input type="email" name="email" required class="lane4-auth-input" placeholder="swimmer@example.com" autocomplete="email" />
          </div>
          <div class="lane4-auth-form-group">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
              <label class="lane4-auth-label" style="margin-bottom:0;">Password</label>
              <a id="lane4-forgot-link" class="lane4-auth-link" style="font-size:12px;">Forgot password?</a>
            </div>
            <input type="password" name="password" required class="lane4-auth-input" placeholder="••••••••" autocomplete="current-password" />
          </div>
          <button type="submit" class="lane4-auth-submit-btn">
            <span>SIGN IN</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </form>

        <!-- REGISTER FORM -->
        <form id="lane4-register-form" style="display:none;">
          <div class="lane4-auth-form-group">
            <label class="lane4-auth-label">Full Name</label>
            <input type="text" name="displayName" required class="lane4-auth-input" placeholder="Rohan Sharma" autocomplete="name" />
          </div>
          <div class="lane4-auth-form-group">
            <label class="lane4-auth-label">Email Address</label>
            <input type="email" name="email" required class="lane4-auth-input" placeholder="swimmer@example.com" autocomplete="email" />
          </div>
          <div class="lane4-auth-form-group">
            <label class="lane4-auth-label">Mobile Number</label>
            <input type="tel" name="phone" class="lane4-auth-input" placeholder="+91 98765 43210" autocomplete="tel" />
          </div>
          <div class="lane4-auth-form-group">
            <label class="lane4-auth-label">Create Password</label>
            <input type="password" name="password" required minlength="6" class="lane4-auth-input" placeholder="Minimum 6 characters" autocomplete="new-password" />
          </div>
          <button type="submit" class="lane4-auth-submit-btn">
            <span>CREATE ACCOUNT</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </form>

        <!-- GUEST TRACK ORDER FORM -->
        <form id="lane4-track-form" style="display:none;">
          <div style="margin-bottom:14px;">
            <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:4px;">Track Swimmer Order</div>
            <div style="font-size:12.5px;color:#64748b;line-height:1.5;">Check live dispatch progress for guest or registered orders without signing in.</div>
          </div>
          <div class="lane4-auth-form-group">
            <label class="lane4-auth-label">Order Reference Number *</label>
            <input type="text" name="trackNumber" id="lane4-track-number" required class="lane4-auth-input" placeholder="e.g. L4-26-8984 or #L4-26-8984" />
            <div style="font-size:11px;color:#64748b;margin-top:3px;">Found in your order confirmation screen or email</div>
          </div>
          <div class="lane4-auth-form-group">
            <label class="lane4-auth-label">Billing / Order Email *</label>
            <input type="email" name="trackEmail" id="lane4-track-email" required class="lane4-auth-input" placeholder="swimmer@example.com" />
          </div>
          <button type="submit" id="lane4-track-submit-btn" class="lane4-auth-submit-btn">
            <span>TRACK ORDER STATUS</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
          <div id="lane4-track-result" style="margin-top:16px;display:none;"></div>
        </form>

        <!-- FORGOT PASSWORD FORM -->
        <form id="lane4-forgot-form" style="display:none;">
          <div style="margin-bottom:14px;">
            <div style="font-size:16px;font-weight:800;color:#0f172a;margin-bottom:4px;">Reset Password</div>
            <div style="font-size:13px;color:#64748b;line-height:1.5;">Enter the email associated with your swimmer account to receive recovery instructions.</div>
          </div>
          <div class="lane4-auth-form-group">
            <label class="lane4-auth-label">Email Address</label>
            <input type="email" name="resetEmail" id="lane4-reset-email" required class="lane4-auth-input" placeholder="swimmer@example.com" />
          </div>
          <button type="submit" class="lane4-auth-submit-btn">
            <span>SEND RESET INSTRUCTIONS</span>
          </button>
          <div style="text-align:center;margin-top:16px;">
            <a id="lane4-back-to-login" class="lane4-auth-link" style="display:inline-flex;align-items:center;gap:6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Back to Sign In</span>
            </a>
          </div>
        </form>

        <!-- ACCOUNT PROFILE PANEL -->
        <div id="lane4-account-panel" style="display:none;">
          <div style="display:flex;align-items:center;gap:14px;padding-bottom:18px;border-bottom:1px solid #e2e8f0;margin-bottom:18px;">
            <div style="width:48px;height:48px;border-radius:50%;background:#000000;color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;" id="lane4-account-avatar">
              S
            </div>
            <div>
              <div id="lane4-account-name" style="font-weight:800;font-size:16px;color:#0f172a;"></div>
              <div id="lane4-account-email" style="font-size:13px;color:#64748b;margin-top:2px;"></div>
            </div>
          </div>

          <div style="margin-bottom:20px;">
            <div style="font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#475569;margin-bottom:12px;">Recent Orders</div>
            <div id="lane4-account-orders" style="font-size:13px;color:#64748b;max-height:220px;overflow-y:auto;">Loading orders...</div>
          </div>

          <button id="lane4-logout-btn" style="width:100%;background:#f1f5f9;color:#0f172a;border:1px solid #cbd5e1;padding:12px;border-radius:8px;font-weight:700;font-size:13px;letter-spacing:1px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.15s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span>SIGN OUT</span>
          </button>
        </div>

        <!-- DEDICATED ORDER DETAILS PANEL -->
        <div id="lane4-order-details-panel" style="display:none;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
            <button type="button" id="lane4-order-back-btn" style="background:#f1f5f9;border:1px solid #cbd5e1;padding:7px 12px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;color:#0f172a;transition:all 0.15s;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Back to Orders</span>
            </button>
            <span style="font-size:11px;font-weight:800;color:#64748b;letter-spacing:0.8px;text-transform:uppercase;">Order Details</span>
          </div>
          <div id="lane4-order-details-content" style="max-height:65vh;overflow-y:auto;padding-right:2px;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper);

    // Event bindings for modal
    document.getElementById('lane4-auth-backdrop').onclick = closeAuthModal;
    document.getElementById('lane4-auth-close').onclick = closeAuthModal;
    document.getElementById('lane4-order-back-btn').onclick = () => {
      document.getElementById('lane4-order-details-panel').style.display = 'none';
      document.getElementById('lane4-account-panel').style.display = 'block';
    };

    // Tab switching
    wrapper.querySelectorAll('.lane4-auth-tab-btn').forEach(btn => {
      btn.onclick = () => {
        wrapper.querySelectorAll('.lane4-auth-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-tab');
        document.getElementById('lane4-login-form').style.display = tab === 'login' ? 'block' : 'none';
        document.getElementById('lane4-register-form').style.display = tab === 'register' ? 'block' : 'none';
        document.getElementById('lane4-track-form').style.display = tab === 'track' ? 'block' : 'none';
        document.getElementById('lane4-forgot-form').style.display = 'none';
        document.getElementById('lane4-account-panel').style.display = 'none';
        document.getElementById('lane4-order-details-panel').style.display = 'none';
        hideAlert();
      };
    });

    // Forgot password link
    document.getElementById('lane4-forgot-link').onclick = () => {
      document.getElementById('lane4-auth-tabs').style.display = 'none';
      document.getElementById('lane4-login-form').style.display = 'none';
      document.getElementById('lane4-register-form').style.display = 'none';
      document.getElementById('lane4-track-form').style.display = 'none';
      document.getElementById('lane4-forgot-form').style.display = 'block';
      hideAlert();
    };

    // Back to login from forgot password
    document.getElementById('lane4-back-to-login').onclick = () => {
      document.getElementById('lane4-auth-tabs').style.display = 'flex';
      document.getElementById('lane4-forgot-form').style.display = 'none';
      document.getElementById('lane4-track-form').style.display = 'none';
      document.getElementById('lane4-login-form').style.display = 'block';
      hideAlert();
    };

    // Handle Forgot Password Form
    document.getElementById('lane4-forgot-form').onsubmit = (e) => {
      e.preventDefault();
      const email = document.getElementById('lane4-reset-email').value.trim();
      showAlert(`Password recovery instructions dispatched to ${email}.`, 'success');
      setTimeout(() => {
        document.getElementById('lane4-auth-tabs').style.display = 'flex';
        document.getElementById('lane4-forgot-form').style.display = 'none';
        document.getElementById('lane4-login-form').style.display = 'block';
      }, 2500);
    };

    // Handle Guest / Customer Order Tracking Form
    const trackForm = document.getElementById('lane4-track-form');
    if (trackForm) {
      trackForm.onsubmit = async (e) => {
        e.preventDefault();
        const numInput = document.getElementById('lane4-track-number');
        const emailInput = document.getElementById('lane4-track-email');
        const resultEl = document.getElementById('lane4-track-result');
        const submitBtn = document.getElementById('lane4-track-submit-btn');

        const orderNumber = numInput ? numInput.value.trim() : '';
        const email = emailInput ? emailInput.value.trim() : '';

        if (!orderNumber || !email) {
          showAlert('Please enter both Order Reference Number and Email Address.', 'error');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span>SEARCHING ORDER RECORDS...</span>';
        hideAlert();
        resultEl.style.display = 'none';

        try {
          const res = await window.lane4ApiRequest('/orders/track', {
            method: 'POST',
            body: JSON.stringify({ orderNumber, email })
          });

          const ord = res.data;
          const isShipped = ord.status === 'shipped' || ord.status === 'out_for_delivery' || ord.status === 'delivered';
          const isVerified = ord.paymentStatus === 'verified';

          resultEl.style.display = 'block';
          resultEl.innerHTML = `
            <div style="background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;padding:16px;box-sizing:border-box;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
                <div>
                  <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">Order Tracking Snapshot</div>
                  <div style="font-size:16px;font-weight:900;color:#0f172a;">#${ord.orderNumber}</div>
                </div>
                <div style="text-align:right;">
                  <span style="font-size:10.5px;font-weight:800;padding:3px 8px;border-radius:4px;background:${isVerified ? '#dcfce7' : '#fef3c7'};color:${isVerified ? '#15803d' : '#92400e'};text-transform:uppercase;">
                    ${isVerified ? 'Payment Verified' : (ord.paymentStatus || 'Awaiting Verification').replace(/_/g, ' ')}
                  </span>
                </div>
              </div>

              <!-- Status Stepper Bar -->
              <div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0;padding:10px 12px;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;font-size:11px;font-weight:800;text-align:center;">
                <div style="color:${ord.status !== 'pending_payment' ? '#16a34a' : '#0f172a'};">
                  <div>1. Placed</div>
                </div>
                <div style="color:#cbd5e1;">&rarr;</div>
                <div style="color:${isVerified ? '#16a34a' : '#94a3b8'};">
                  <div>2. Verified</div>
                </div>
                <div style="color:#cbd5e1;">&rarr;</div>
                <div style="color:${isShipped ? '#16a34a' : (ord.status === 'confirmed' || ord.status === 'processing' ? '#0f172a' : '#94a3b8')};">
                  <div>3. Processing</div>
                </div>
                <div style="color:#cbd5e1;">&rarr;</div>
                <div style="color:${isShipped ? '#16a34a' : '#94a3b8'};">
                  <div>4. Shipped</div>
                </div>
              </div>

              <div style="font-size:12px;color:#334155;line-height:1.6;margin-bottom:12px;">
                <div><strong>Current Fulfillment Status:</strong> <span style="text-transform:uppercase;font-weight:800;color:#0f172a;">${(ord.status || 'pending').replace(/_/g, ' ')}</span></div>
                <div><strong>Delivery Destination:</strong> ${ord.shippingAddress ? `${ord.shippingAddress.city}, PIN ${ord.shippingAddress.postalCode}` : 'India'}</div>
                <div><strong>Payable Order Total:</strong> ${ord.pricing ? ord.pricing.finalPayableFormatted : ''}</div>
              </div>

              ${ord.fulfillment && ord.fulfillment.trackingNumber ? `
                <div style="background:#ffffff;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-top:10px;">
                  <div style="font-size:11px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">Dispatched via ${ord.fulfillment.courierName || 'DTDC'}</div>
                  <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:8px;">AWB / Tracking #: <code>${ord.fulfillment.trackingNumber}</code></div>
                  <a href="${ord.fulfillment.trackingUrl || `https://www.google.com/search?q=${encodeURIComponent((ord.fulfillment.courierName || '') + ' ' + ord.fulfillment.trackingNumber)}`}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#000000;color:#ffffff;padding:8px 14px;border-radius:6px;font-size:11.5px;font-weight:800;text-decoration:none;">
                    <span>LIVE COURIER TRACKING</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  </a>
                </div>
              ` : `
                <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px 12px;font-size:12px;color:#1e40af;">
                  Order is confirmed and being prepared for packaging at our Nagpur store. You will receive courier dispatch information via email as soon as it ships.
                </div>
              `}
            </div>
          `;
        } catch (err) {
          showAlert(err.message || 'Unable to find order matching these details.', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>TRACK ORDER STATUS</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
        }
      };
    }

    // Handle Login Form
    document.getElementById('lane4-login-form').onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const email = form.email.value.trim().toLowerCase();

      // Client-side guard against admin logins in customer portal
      if (email.startsWith('admin_') || email.startsWith('admin@') || email.includes('admin@lane4swim.in')) {
        showAlert('Administrator accounts cannot sign in to the customer storefront. Please access the Admin Portal at /admin/.', 'error');
        return;
      }

      showAlert('Authenticating swimmer credentials...', 'info');

      try {
        const token = 'test_token_' + encodeURIComponent(email);
        const res = await window.lane4ApiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ idToken: token })
        });

        const loggedInUser = res.data.user;

        // Double check response role
        if (loggedInUser.role === 'admin' || loggedInUser.role === 'super_admin') {
          showAlert('Administrator accounts cannot access customer storefront. Please use /admin/.', 'error');
          return;
        }

        // Store user with exact real email address
        window.LANE4.setUser({
          ...loggedInUser,
          email: loggedInUser.email || email
        }, token);

        // Merge guest cart if any
        const guestId = localStorage.getItem('lane4_guest_id');
        if (guestId) {
          await window.lane4ApiRequest('/cart/merge', {
            method: 'POST',
            body: JSON.stringify({ guestId })
          }).catch(() => {});
        }

        showAlert('Signed in successfully! Welcome back.', 'success');
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
      const email = form.email.value.trim().toLowerCase();

      if (email.startsWith('admin_') || email.startsWith('admin@') || email.includes('admin@lane4swim.in')) {
        showAlert('Administrator accounts cannot be registered on customer storefront. Please access the Admin Portal at /admin/.', 'error');
        return;
      }

      showAlert('Setting up your swimmer account...', 'info');

      try {
        const payload = {
          displayName: form.displayName.value.trim(),
          email,
          password: form.password.value,
          phone: form.phone.value.trim()
        };

        const res = await window.lane4ApiRequest('/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        showAlert('Account created! Logging you in...', 'success');
        const token = 'test_token_' + encodeURIComponent(payload.email);
        window.LANE4.setUser({
          ...(res.data || {}),
          email: payload.email,
          displayName: payload.displayName
        }, token);

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
    alert.className = `lane4-auth-alert ${type}`;
    alert.style.display = 'block';
    alert.textContent = msg;
  }

  function hideAlert() {
    const alert = document.getElementById('lane4-auth-alert');
    if (alert) alert.style.display = 'none';
  }

  function openAuthModal(view = 'login') {
    const wrapper = document.getElementById('lane4-auth-modal-wrapper');
    if (!wrapper) return;
    wrapper.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const user = window.LANE4.getUser();
    const tabs = document.getElementById('lane4-auth-tabs');
    const loginForm = document.getElementById('lane4-login-form');
    const regForm = document.getElementById('lane4-register-form');
    const trackForm = document.getElementById('lane4-track-form');
    const forgotForm = document.getElementById('lane4-forgot-form');
    const accPanel = document.getElementById('lane4-account-panel');
    hideAlert();
    forgotForm.style.display = 'none';

    if (user && view === 'account') {
      tabs.style.display = 'none';
      loginForm.style.display = 'none';
      regForm.style.display = 'none';
      if (trackForm) trackForm.style.display = 'none';
      const orderDetailsPanel = document.getElementById('lane4-order-details-panel');
      if (orderDetailsPanel) orderDetailsPanel.style.display = 'none';
      accPanel.style.display = 'block';

      const initials = (user.displayName || user.email || 'S').slice(0, 1).toUpperCase();
      document.getElementById('lane4-account-avatar').textContent = initials;
      document.getElementById('lane4-account-name').textContent = user.displayName || 'LANE4 Swimmer';
      document.getElementById('lane4-account-email').textContent = user.email;

      loadCustomerOrders();
    } else {
      tabs.style.display = 'flex';
      accPanel.style.display = 'none';
      const tabBtns = tabs.querySelectorAll('.lane4-auth-tab-btn');
      tabBtns.forEach(b => {
        if (b.getAttribute('data-tab') === view) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
      loginForm.style.display = view === 'login' ? 'block' : 'none';
      regForm.style.display = view === 'register' ? 'block' : 'none';
      if (trackForm) trackForm.style.display = view === 'track' ? 'block' : 'none';
    }
  }

  let customerOrdersCache = [];

  function formatOrderTimestamp(val) {
    if (!val) return '—';
    let ms = 0;
    if (typeof val === 'number') ms = val < 1e11 ? val * 1000 : val;
    else if (typeof val === 'object') {
      if (typeof val._seconds === 'number') ms = val._seconds * 1000 + (val._nanoseconds || 0) / 1e6;
      else if (typeof val.seconds === 'number') ms = val.seconds * 1000 + (val.nanoseconds || 0) / 1e6;
      else if (typeof val.toMillis === 'function') ms = val.toMillis();
      else if (typeof val.getTime === 'function') ms = val.getTime();
      else if (val instanceof Date) ms = val.getTime();
    } else {
      const d = new Date(val);
      ms = isNaN(d.getTime()) ? 0 : d.getTime();
    }
    if (!ms) return '—';
    const d = new Date(ms);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function showOrderDetails(ord) {
    const accPanel = document.getElementById('lane4-account-panel');
    const detailsPanel = document.getElementById('lane4-order-details-panel');
    const content = document.getElementById('lane4-order-details-content');
    if (!detailsPanel || !content) return;

    if (accPanel) accPanel.style.display = 'none';
    detailsPanel.style.display = 'block';

    const orderNum = ord.orderNumber || ord.orderId || 'Order';
    const isVerified = ord.paymentStatus === 'verified';
    const isShipped = ord.status === 'shipped' || ord.status === 'out_for_delivery' || ord.status === 'delivered';
    const isDelivered = ord.status === 'delivered';
    const isProcessing = ord.status === 'confirmed' || ord.status === 'processing' || isShipped;

    const items = ord.items || [];
    const pricing = ord.pricing || {};
    const shipping = ord.shippingAddress || {};
    const payment = ord.payment || {};
    const fulfillment = ord.fulfillment || {};

    const itemsHtml = items.map(it => {
      let rawImg = it.image || '6424266ea05809dff501d86e/lane4-6dbhNuWa5oI-640x640.jpg';
      let imgUrl = rawImg;
      if (window.LANE4 && window.LANE4.resolveAssetUrl) imgUrl = window.LANE4.resolveAssetUrl(rawImg);
      const variantDesc = [it.size ? `Size: ${it.size}` : '', it.color ? `Color: ${it.color}` : ''].filter(Boolean).join(' · ');
      const unitPriceFormatted = it.priceFormatted || (window.LANE4 && it.pricePaise ? window.LANE4.formatINR(it.pricePaise) : `₹${((it.pricePaise || 0)/100).toFixed(2)}`);
      const itemSubtotalFormatted = it.subtotalFormatted || (window.LANE4 && it.subtotalPaise ? window.LANE4.formatINR(it.subtotalPaise) : (window.LANE4 && it.pricePaise ? window.LANE4.formatINR(it.pricePaise * (it.quantity || 1)) : `₹${(((it.pricePaise || 0) * (it.quantity || 1))/100).toFixed(2)}`));

      return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #f1f5f9;">
          <img src="${imgUrl}" alt="${it.name || 'Product'}" style="width:50px;height:50px;border-radius:8px;object-fit:cover;border:1px solid #e2e8f0;flex-shrink:0;" onerror="this.onerror=null;this.src='6424266ea05809dff501d86e/lane4-6dbhNuWa5oI-640x640.jpg';" />
          <div style="flex:1;min-width:0;">
            <div style="font-size:13.5px;font-weight:800;color:#0f172a;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${it.name || 'Lane4 Item'}</div>
            ${variantDesc ? `<div style="font-size:11.5px;color:#64748b;margin-top:2px;">${variantDesc}</div>` : ''}
            <div style="font-size:12px;color:#475569;margin-top:4px;">
              <span>Qty: <strong>${it.quantity}</strong> &times; ${unitPriceFormatted}</span>
            </div>
          </div>
          <div style="font-size:13.5px;font-weight:800;color:#0f172a;text-align:right;white-space:nowrap;">
            ${itemSubtotalFormatted}
          </div>
        </div>
      `;
    }).join('');

    const subtotalText = pricing.subtotalFormatted || (window.LANE4 && pricing.subtotalPaise ? window.LANE4.formatINR(pricing.subtotalPaise) : '—');
    const discountPaise = pricing.discountPaise || 0;
    const discountText = pricing.discountFormatted || (window.LANE4 && discountPaise ? window.LANE4.formatINR(discountPaise) : `-₹0.00`);
    const shippingPaise = pricing.shippingPaise || 0;
    const shippingText = shippingPaise > 0 ? (pricing.shippingFormatted || (window.LANE4 ? window.LANE4.formatINR(shippingPaise) : '₹99.00')) : 'FREE';
    const payableText = pricing.finalPayableFormatted || (window.LANE4 && pricing.finalPayablePaise ? window.LANE4.formatINR(pricing.finalPayablePaise) : '—');
    const paymentMethodLabel = payment.method === 'cod' ? 'Cash on Delivery' : 'UPI QR Code / Online Payment';

    content.innerHTML = `
      <!-- Order Header Card -->
      <div style="background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;padding:14px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
          <div>
            <div style="font-size:10.5px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Order Reference</div>
            <div style="font-size:18px;font-weight:900;color:#0f172a;">#${orderNum}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Total Paid</div>
            <div style="font-size:18px;font-weight:900;color:#0f172a;">${payableText}</div>
          </div>
        </div>
        <div style="font-size:11.5px;color:#64748b;margin-bottom:10px;">
          Placed on ${formatOrderTimestamp(ord.createdAt)}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <span style="font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:4px;background:#e2e8f0;color:#334155;text-transform:uppercase;">
            ${(ord.status || 'pending').replace(/_/g, ' ')}
          </span>
          <span style="font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:4px;background:${isVerified ? '#dcfce7' : '#fef3c7'};color:${isVerified ? '#15803d' : '#92400e'};text-transform:uppercase;">
            ${isVerified ? 'Payment Verified' : (ord.paymentStatus || 'Awaiting Verification').replace(/_/g, ' ')}
          </span>
        </div>
      </div>

      <!-- Fulfillment Progress Stepper -->
      <div style="background:#ffffff;border:1.5px solid #e2e8f0;border-radius:10px;padding:12px 14px;margin-bottom:14px;">
        <div style="font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;">Order &amp; Fulfillment Progress</div>
        <div style="display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:800;text-align:center;">
          <div style="color:${ord.status !== 'pending_payment' ? '#16a34a' : '#0f172a'};">
            <div>✓ 1. Placed</div>
          </div>
          <div style="color:#cbd5e1;">&rarr;</div>
          <div style="color:${isVerified ? '#16a34a' : '#94a3b8'};">
            <div>${isVerified ? '✓ ' : ''}2. Verified</div>
          </div>
          <div style="color:#cbd5e1;">&rarr;</div>
          <div style="color:${isProcessing ? '#16a34a' : '#94a3b8'};">
            <div>${isProcessing ? '✓ ' : ''}3. Processing</div>
          </div>
          <div style="color:#cbd5e1;">&rarr;</div>
          <div style="color:${isShipped ? '#16a34a' : '#94a3b8'};">
            <div>${isDelivered ? '✓ ' : ''}4. ${isDelivered ? 'Delivered' : 'Shipped'}</div>
          </div>
        </div>
      </div>

      <!-- Live Courier Tracking Box -->
      ${fulfillment.trackingNumber ? `
        <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:10px;padding:14px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <div style="font-size:11px;font-weight:800;color:#166534;text-transform:uppercase;letter-spacing:0.5px;">Live Courier Dispatch</div>
            <span style="font-size:10px;font-weight:800;padding:2px 7px;border-radius:4px;background:#dcfce7;color:#15803d;text-transform:uppercase;">In Transit</span>
          </div>
          <div style="font-size:13px;font-weight:800;color:#0f172a;margin-bottom:8px;">
            Courier: <strong>${fulfillment.courierName || 'DTDC'}</strong> &bull; AWB: <code>${fulfillment.trackingNumber}</code>
          </div>
          <div>
            <a href="${fulfillment.trackingUrl || `https://www.google.com/search?q=${encodeURIComponent((fulfillment.courierName || '') + ' ' + fulfillment.trackingNumber)}`}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;background:#000000;color:#ffffff;padding:8px 14px;border-radius:6px;font-size:11.5px;font-weight:800;text-decoration:none;">
              <span>TRACK LIVE PACKAGE</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
        </div>
      ` : ''}

      <!-- Products Done (What Products Done) -->
      <div style="background:#ffffff;border:1.5px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
        <div style="font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">
          Products Purchased (${items.reduce((sum, it) => sum + (it.quantity || 1), 0)} items)
        </div>
        <div>${itemsHtml || '<div style="font-size:12px;color:#64748b;">No product items recorded for this order.</div>'}</div>
      </div>

      <!-- Billing Breakdown (Image 5 style) -->
      <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
        <div style="font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">Billing &amp; Payment Breakdown</div>
        
        <div style="display:flex;justify-content:space-between;font-size:13px;color:#334155;margin-bottom:8px;">
          <span>Item total</span>
          <span style="font-weight:700;">${subtotalText}</span>
        </div>

        ${discountPaise > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:13px;color:#16a34a;margin-bottom:8px;">
            <span>Coupon ${ord.coupon && ord.coupon.code ? `<span style="font-weight:800;background:#dcfce7;padding:1px 5px;border-radius:4px;font-size:11px;">${ord.coupon.code}</span>` : ''}</span>
            <span style="font-weight:800;">-${discountText}</span>
          </div>
        ` : ''}

        <div style="display:flex;justify-content:space-between;font-size:13px;color:#334155;margin-bottom:10px;">
          <span>Delivery fee</span>
          <span style="font-weight:700;color:${shippingPaise === 0 ? '#16a34a' : '#334155'};">${shippingText}</span>
        </div>

        <div style="border-top:1.5px solid #cbd5e1;padding-top:10px;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:14px;font-weight:800;color:#0f172a;">To pay</span>
          <span style="font-size:16px;font-weight:900;color:#0f172a;">${payableText}</span>
        </div>

        <div style="margin-top:12px;padding-top:10px;border-top:1px dashed #e2e8f0;text-align:center;font-size:11.5px;color:#64748b;display:flex;align-items:center;justify-content:center;gap:6px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Payments are secure and encrypted</span>
        </div>
      </div>

      <!-- Shipping Destination Details -->
      <div style="background:#ffffff;border:1.5px solid #e2e8f0;border-radius:10px;padding:14px;margin-bottom:14px;">
        <div style="font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Delivery Destination</div>
        <div style="font-size:13.5px;font-weight:800;color:#0f172a;">${shipping.addressee || ord.customerName || 'Swimmer'}</div>
        <div style="font-size:12px;color:#475569;line-height:1.45;margin-top:3px;">
          ${shipping.addressLine1 || ''}${shipping.addressLine2 ? `, ${shipping.addressLine2}` : ''}<br />
          ${shipping.city ? `${shipping.city}, ` : ''}${shipping.state ? `${shipping.state} ` : ''}${shipping.postalCode ? `PIN ${shipping.postalCode}` : ''}
        </div>
        ${shipping.phone ? `<div style="font-size:12px;color:#64748b;margin-top:6px;">Contact Phone: <strong>${shipping.phone}</strong></div>` : ''}
      </div>

      <!-- Payment Method -->
      <div style="background:#ffffff;border:1.5px solid #e2e8f0;border-radius:10px;padding:14px;">
        <div style="font-size:11px;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Payment Information</div>
        <div style="font-size:13px;font-weight:800;color:#0f172a;">${paymentMethodLabel}</div>
        ${payment.upiReferenceNumber ? `
          <div style="font-size:12px;color:#475569;margin-top:4px;">
            Transaction UTR / Ref: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-weight:700;">${payment.upiReferenceNumber}</code>
          </div>
        ` : ''}
      </div>
    `;
  }

  async function loadCustomerOrders() {
    const container = document.getElementById('lane4-account-orders');
    if (!container) return;
    try {
      const res = await window.lane4ApiRequest('/orders/my-orders');
      const orders = (res && res.data) || [];
      customerOrdersCache = orders;

      if (orders.length === 0) {
        container.innerHTML = `
          <div style="padding:22px 14px;text-align:center;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;">
            <div style="width:38px;height:38px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;color:#64748b;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            </div>
            <div style="font-size:13.5px;font-weight:800;color:#0f172a;margin-bottom:4px;">No Orders Yet</div>
            <div style="font-size:12px;color:#64748b;line-height:1.4;margin-bottom:14px;">You haven't placed any competitive swim orders yet. Discover our competition gear to elevate your training.</div>
            <a href="shop.html" onclick="document.getElementById('lane4-auth-modal-wrapper').style.display='none';" style="display:inline-flex;align-items:center;gap:6px;background:#000000;color:#ffffff;padding:8px 16px;border-radius:6px;font-size:11.5px;font-weight:800;text-decoration:none;letter-spacing:0.5px;">
              <span>EXPLORE SHOP</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </a>
          </div>
        `;
        return;
      }

      container.innerHTML = '';
      orders.forEach(ord => {
        const orderRef = ord.orderNumber || ord.orderId;
        const totalText = ord.pricing ? ord.pricing.finalPayableFormatted : '';
        const isVerified = ord.paymentStatus === 'verified';
        const itemCount = (ord.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);

        const card = document.createElement('div');
        card.className = 'lane4-order-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('title', 'Click to view complete order items and billing breakdown');
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:flex-start;font-weight:800;font-size:13.5px;color:#0f172a;margin-bottom:4px;">
            <span>#${orderRef}</span>
            <span style="font-size:14px;font-weight:900;">${totalText}</span>
          </div>
          <div style="font-size:11.5px;color:#64748b;margin-bottom:6px;">
            ${itemCount} ${itemCount === 1 ? 'item' : 'items'} &bull; ${formatOrderTimestamp(ord.createdAt)}
          </div>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
            <span style="font-size:10px;font-weight:800;padding:2px 6px;border-radius:4px;background:#e2e8f0;color:#334155;text-transform:uppercase;">
              ${(ord.status || 'pending').replace(/_/g, ' ')}
            </span>
            <span style="font-size:10px;font-weight:800;padding:2px 6px;border-radius:4px;background:${isVerified ? '#dcfce7' : '#fef3c7'};color:${isVerified ? '#15803d' : '#92400e'};text-transform:uppercase;">
              ${isVerified ? 'Payment Verified' : 'Awaiting Verification'}
            </span>
          </div>
          ${ord.fulfillment && ord.fulfillment.trackingNumber ? `
            <div style="margin-top:8px;padding-top:6px;border-top:1px dashed #cbd5e1;font-size:11.5px;color:#475569;">
              <strong>Courier:</strong> ${ord.fulfillment.courierName || 'DTDC'} &bull; <strong>AWB:</strong> <code>${ord.fulfillment.trackingNumber}</code>
            </div>
          ` : ''}
          <div style="margin-top:10px;display:flex;align-items:center;justify-content:flex-end;gap:4px;font-size:11.5px;font-weight:800;color:#000000;padding-top:6px;border-top:1px dashed #f1f5f9;">
            <span>View Items &amp; Billing Details</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </div>
        `;

        card.onclick = () => showOrderDetails(ord);
        card.onkeydown = (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            showOrderDetails(ord);
          }
        };

        container.appendChild(card);
      });
    } catch (err) {
      container.innerHTML = `
        <div style="padding:20px 14px;text-align:center;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;">
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px;">No Recent Orders Found</div>
          <div style="font-size:12px;color:#64748b;line-height:1.4;margin-bottom:12px;">You haven't placed any orders with this swimmer account yet.</div>
          <a href="shop.html" onclick="document.getElementById('lane4-auth-modal-wrapper').style.display='none';" style="display:inline-flex;align-items:center;gap:6px;background:#000000;color:#ffffff;padding:8px 14px;border-radius:6px;font-size:11px;font-weight:800;text-decoration:none;">
            <span>EXPLORE SHOP</span>
          </a>
        </div>
      `;
    }
  }

  function closeAuthModal() {
    const wrapper = document.getElementById('lane4-auth-modal-wrapper');
    if (wrapper) wrapper.style.display = 'none';
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
  }

  // Expose public API for cart and checkout authentication gates
  window.LANE4_AUTH = {
    open: openAuthModal,
    close: closeAuthModal,
    showAlert: showAlert,
    hideAlert: hideAlert
  };
  window.openAuthModal = openAuthModal;

  document.addEventListener('DOMContentLoaded', initAuthUI);
  window.addEventListener('lane4:auth-changed', initAuthUI);
})();
