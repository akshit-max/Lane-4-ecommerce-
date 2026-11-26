/**
 * LANE4 Customer Authentication & Account Modal Controller
 * Styled to perfectly match The Lane4 Performance Store design system.
 */

window.LANE4_VALIDATION = {
  isValidEmail: function (email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return re.test(email.trim());
  },
  isValidIndianPhone: function (phone) {
    if (!phone || typeof phone !== 'string') return false;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      return /^[6-9]\d{9}$/.test(digits.slice(2));
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return /^[6-9]\d{9}$/.test(digits.slice(1));
    }
    return /^[6-9]\d{9}$/.test(digits);
  },
  normalizeIndianPhone: function (phone) {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    const clean10 = digits.slice(-10);
    return clean10.length === 10 ? `+91 ${clean10}` : phone;
  },
  isValidPostalCode: function (pin) {
    if (!pin) return false;
    return /^\d{6}$/.test(String(pin).trim());
  }
};

window.INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", 
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", 
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", 
  "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", 
  "Lakshadweep", "Puducherry"
];

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
    const candidateLinks = document.querySelectorAll('.cart-inner a, .info-bar-button-wrapper a, .info-bar-button, nav a, .nav-menu a, [data-lane4-auth], .lane4-account-trigger');
    candidateLinks.forEach(link => {
      const text = (link.textContent || '').trim().toUpperCase();
      if (text.includes('SIGN') || text.includes('ACCOUNT') || text.startsWith('HI,') || link.matches('.cart-inner a, .info-bar-button, .info-bar-button-wrapper a, [data-lane4-auth], .lane4-account-trigger')) {
        link.setAttribute('data-lane4-auth', 'true');
        link.classList.add('lane4-account-trigger');
        const textHolder = link.querySelector('.paragraph-13px') || link.querySelector('.paragraph-14px') || link;
        if (user) {
          textHolder.textContent = `HI, ${(user.displayName || user.email.split('@')[0]).toUpperCase()}`;
          link.classList.remove('opacity-50');
        } else {
          textHolder.textContent = link.classList.contains('paragraph-14px') ? 'SIGN IN' : 'Account';
          if (link.classList.contains('mb')) link.classList.add('opacity-50');
        }

        link.onclick = function (e) {
          e.preventDefault();
          e.stopPropagation();
          const curr = (window.LANE4 && window.LANE4.getUser) ? window.LANE4.getUser() : user;
          openAuthModal(curr ? 'account' : 'login');
        };
      }
    });

    createAuthModalDOM();
  }

  function createAuthModalDOM() {
    if (document.getElementById('lane4-auth-modal-wrapper')) return;

    const logoUrl = (window.location.protocol === 'file:' ? '' : '/') + '6424266ea05809dff501d86e/lane4-logo.png';

    // Inject styles for Auth Modal (OG LANE4 Architectural Enterprise Theme)
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
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      #lane4-auth-modal-wrapper,
      #lane4-auth-modal-wrapper *,
      #lane4-auth-modal-wrapper button,
      #lane4-auth-modal-wrapper input,
      #lane4-auth-modal-wrapper select,
      #lane4-auth-modal-wrapper textarea,
      #lane4-auth-modal-wrapper label,
      #lane4-auth-modal-wrapper a,
      #lane4-auth-modal-wrapper span,
      #lane4-auth-modal-wrapper div {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        box-sizing: border-box;
      }
      #lane4-auth-modal-wrapper code,
      #lane4-auth-modal-wrapper code * {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace !important;
      }
      #lane4-auth-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.5);
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
        border: 1px solid #e2e8f0;
        border-radius: 0px;
        padding: 34px 34px 32px;
        box-shadow: 0 24px 50px -10px rgba(0, 0, 0, 0.22), 0 1px 3px rgba(0, 0, 0, 0.06);
        color: #0f172a;
        transition: max-width 0.18s ease;
        animation: lane4AuthScaleIn 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      }
      #lane4-auth-card.lane4-auth-card--wide {
        max-width: 740px;
        padding: 28px 32px 30px;
      }
      #lane4-auth-card.lane4-auth-card--invoice {
        max-width: 840px;
        padding: 26px 32px 30px;
      }
      .lane4-details-two-col {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 14px;
        margin-bottom: 14px;
      }
      .lane4-stepper-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
      }
      .lane4-order-actions-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid #f1f5f9;
      }
      .lane4-order-card:hover {
        border-color: #0f172a !important;
        box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
      }
      @media (max-width: 680px) {
        #lane4-auth-card,
        #lane4-auth-card.lane4-auth-card--wide,
        #lane4-auth-card.lane4-auth-card--invoice {
          width: 95%;
          padding: 20px 18px 22px;
        }
        .lane4-details-two-col {
          grid-template-columns: 1fr !important;
        }
        .lane4-stepper-grid {
          grid-template-columns: repeat(2, 1fr) !important;
        }
        .lane4-order-actions-row {
          flex-direction: column;
          align-items: stretch;
        }
      }
      @keyframes lane4AuthScaleIn {
        from { opacity: 0; transform: scale(0.97) translateY(6px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      .lane4-auth-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 22px;
        border-bottom: 1px solid #f0f0f0;
        padding-bottom: 16px;
      }
      .lane4-auth-brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .lane4-auth-logo-img {
        height: 28px;
        width: auto;
        max-width: 130px;
        object-fit: contain;
        display: block;
      }
      .lane4-auth-brand-text {
        display: flex;
        flex-direction: column;
        border-left: 1px solid #e5e5e5;
        padding-left: 12px;
        line-height: 1.15;
      }
      .lane4-auth-brand-badge {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.8px;
        color: #222222;
        text-transform: uppercase;
      }
      .lane4-auth-brand-sub {
        font-size: 9px;
        font-weight: 400;
        letter-spacing: 0.5px;
        color: #888888;
        text-transform: uppercase;
        margin-top: 2px;
      }
      .lane4-auth-close-btn {
        width: 30px;
        height: 30px;
        background: #f7f7f7;
        border: 1px solid #ececec;
        color: #666666;
        cursor: pointer;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
      }
      .lane4-auth-close-btn:hover {
        background: #000000;
        border-color: #000000;
        color: #ffffff;
        transform: scale(1.05);
      }
      .lane4-auth-tabs {
        display: flex;
        border-bottom: 1px solid #eeeeee;
        margin-bottom: 24px;
        gap: 28px;
        padding: 0;
      }
      .lane4-auth-tab-btn {
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        padding: 6px 2px 12px;
        font-size: 13.5px;
        font-weight: 400;
        letter-spacing: 0.25px;
        color: #888888;
        cursor: pointer;
        transition: color 0.15s ease, border-color 0.15s ease;
        text-align: left;
        line-height: 20px;
        text-transform: none;
        margin-bottom: -1px;
      }
      .lane4-auth-tab-btn:hover:not(.active) {
        color: #111111;
      }
      .lane4-auth-tab-btn.active {
        color: #000000;
        font-weight: 500;
        border-bottom: 2px solid #000000;
      }
      .lane4-auth-form-group {
        margin-bottom: 18px;
      }
      #lane4-auth-modal-wrapper label,
      .lane4-auth-label {
        display: block;
        font-size: 11.5px !important;
        font-weight: 600 !important;
        letter-spacing: 0.7px !important;
        color: #333333 !important;
        margin-bottom: 6px !important;
        line-height: 16px !important;
        text-transform: uppercase !important;
      }
      .lane4-auth-input {
        width: 100%;
        height: 44px;
        padding: 10px 14px;
        border: 1px solid #dcdcdc;
        border-radius: 0px;
        font-size: 13.5px;
        font-weight: 400;
        letter-spacing: 0.2px;
        font-family: inherit;
        background: #ffffff;
        color: #111111;
        box-sizing: border-box;
        transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        line-height: 20px;
      }
      .lane4-auth-input::placeholder {
        color: #a0a0a0;
        font-size: 13px;
        font-weight: 300;
        letter-spacing: 0.2px;
        font-family: inherit;
      }
      .lane4-auth-input:focus {
        border-color: #000000;
        outline: none;
        box-shadow: 0 0 0 1px #000000;
        background: #ffffff;
      }
      .lane4-auth-password-wrap {
        position: relative;
        display: flex;
        align-items: center;
        width: 100%;
      }
      .lane4-auth-password-wrap .lane4-auth-input {
        padding-right: 44px;
      }
      .lane4-auth-pass-toggle {
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 2;
        background: transparent;
        border: none;
        padding: 6px;
        cursor: pointer;
        color: #777777;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 0px;
        transition: color 0.15s;
      }
      .lane4-auth-pass-toggle:hover {
        color: #000000;
      }
      .lane4-auth-pass-toggle:focus {
        outline: none;
      }
      .lane4-auth-submit-btn {
        width: 100%;
        height: 46px;
        background: #000000;
        color: #ffffff;
        padding: 0 22px;
        border: 1px solid #000000;
        border-radius: 0px;
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 1px;
        text-transform: uppercase;
        cursor: pointer;
        margin-top: 14px;
        transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        line-height: 20px;
      }
      .lane4-auth-submit-btn span {
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 1px;
        line-height: 20px;
        text-transform: uppercase;
      }
      .lane4-auth-submit-btn svg {
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .lane4-auth-submit-btn:hover {
        background: #222222;
        border-color: #222222;
      }
      .lane4-auth-submit-btn:hover svg {
        transform: translateX(3px);
      }
      .lane4-auth-submit-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }
      .lane4-auth-submit-btn:active {
        transform: scale(0.995);
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      .lane4-auth-link {
        font-size: 12px;
        color: #777777;
        text-decoration: none;
        font-weight: 400;
        letter-spacing: 0.2px;
        transition: color 0.15s ease;
        cursor: pointer;
      }
      .lane4-auth-link:hover {
        color: #000000;
        text-decoration: underline;
      }
      .lane4-auth-alert {
        display: none;
        padding: 12px 14px;
        border-radius: 0px;
        font-size: 13px;
        font-weight: 400;
        margin-bottom: 18px;
        border: 1px solid;
        line-height: 1.4;
      }
      .lane4-auth-alert.error {
        background: #fef2f2;
        color: #b91c1c;
        border-color: #fca5a5;
      }
      .lane4-auth-alert.success {
        background: #f0fdf4;
        color: #15803d;
        border-color: #86efac;
      }
      .lane4-auth-alert.info {
        background: #fafafa;
        color: #111111;
        border-color: #dcdcdc;
      }
      .lane4-order-card {
        border: 1px solid #e2e8f0;
        border-radius: 0px;
        padding: 16px 18px;
        margin-bottom: 12px;
        background: #ffffff;
        cursor: pointer;
        transition: border-color 0.18s ease, box-shadow 0.18s ease;
      }
      .lane4-order-card:focus {
        outline: 1px solid #0f172a;
        outline-offset: 1px;
      }
      .lane4-acc-subtabs {
        display: flex;
        border-bottom: 1px solid #e2e8f0;
        margin-bottom: 18px;
        gap: 24px;
        padding: 0;
      }
      .lane4-acc-subtab-btn {
        background: transparent !important;
        border: none !important;
        border-bottom: 2px solid transparent !important;
        padding: 6px 0 10px !important;
        font-size: 13px !important;
        font-weight: 500 !important;
        letter-spacing: 0.3px !important;
        color: #64748b !important;
        cursor: pointer;
        transition: color 0.15s ease, border-color 0.15s ease;
        margin-bottom: -1px;
        text-align: left;
      }
      .lane4-acc-subtab-btn:hover:not(.active) {
        color: #0f172a !important;
      }
      .lane4-acc-subtab-btn.active {
        color: #0f172a !important;
        font-weight: 600 !important;
        border-bottom: 2px solid #0f172a !important;
      }
      .lane4-account-avatar {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background: #0f172a;
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 15px;
        flex-shrink: 0;
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
            <img src="${logoUrl}" alt="The Lane4 Performance Store" class="lane4-auth-logo-img" onerror="this.style.display='none'; document.getElementById('lane4-auth-logo-fallback').style.display='block';" />
            <span id="lane4-auth-logo-fallback" style="display:none;font-size:15px;font-weight:600;letter-spacing:1px;color:#111;">THE LANE4</span>
            <div class="lane4-auth-brand-text">
              <span class="lane4-auth-brand-badge">Swimmer Access</span>
              <span class="lane4-auth-brand-sub">Performance Store</span>
            </div>
          </div>
          <button id="lane4-auth-close" class="lane4-auth-close-btn" aria-label="Close modal">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
            <div class="lane4-auth-password-wrap">
              <input type="password" name="password" required class="lane4-auth-input" placeholder="••••••••" autocomplete="current-password" />
              <button type="button" class="lane4-auth-pass-toggle" aria-label="Show password" title="Show password">
                <svg class="eye-show" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg class="eye-hide" style="display:none;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>
            </div>
          </div>
          <button type="submit" class="lane4-auth-submit-btn">
            <span>Sign In</span>
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
            <div class="lane4-auth-password-wrap">
              <input type="password" name="password" required minlength="6" class="lane4-auth-input" placeholder="Minimum 6 characters" autocomplete="new-password" />
              <button type="button" class="lane4-auth-pass-toggle" aria-label="Show password" title="Show password">
                <svg class="eye-show" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
                <svg class="eye-hide" style="display:none;" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              </button>
            </div>
          </div>
          <button type="submit" class="lane4-auth-submit-btn">
            <span>Create Account</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </button>
        </form>

        <!-- GUEST TRACK ORDER FORM -->
        <form id="lane4-track-form" style="display:none;">
          <div style="margin-bottom:20px;">
            <div style="font-size:16px;font-weight:400;color:#111111;letter-spacing:0.2px;margin-bottom:6px;">Track Swimmer Order</div>
            <div style="font-size:13px;font-weight:300;color:#666666;line-height:1.5;">Check live dispatch progress for guest or registered orders without signing in.</div>
          </div>
          <div class="lane4-auth-form-group">
            <label class="lane4-auth-label">Order Reference Number *</label>
            <input type="text" name="trackNumber" id="lane4-track-number" required class="lane4-auth-input" placeholder="e.g. L4-26-8984 or #L4-26-8984" />
            <div style="font-size:12px;font-weight:300;color:#777777;margin-top:5px;">Found in your order confirmation screen or email</div>
          </div>
          <div class="lane4-auth-form-group">
            <label class="lane4-auth-label">Billing / Order Email *</label>
            <input type="email" name="trackEmail" id="lane4-track-email" required class="lane4-auth-input" placeholder="swimmer@example.com" />
          </div>
          <button type="submit" id="lane4-track-submit-btn" class="lane4-auth-submit-btn">
            <span>Track Order Status</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </button>
          <div id="lane4-track-result" style="margin-top:16px;display:none;"></div>
        </form>

        <!-- FORGOT PASSWORD FORM -->
        <form id="lane4-forgot-form" style="display:none;">
          <div style="margin-bottom:20px;">
            <div style="font-size:16px;font-weight:400;color:#111111;letter-spacing:0.2px;margin-bottom:6px;">Reset Password</div>
            <div style="font-size:13px;font-weight:300;color:#666666;line-height:1.5;">Enter the email associated with your swimmer account to receive recovery instructions.</div>
          </div>
          <div class="lane4-auth-form-group">
            <label class="lane4-auth-label">Email Address</label>
            <input type="email" name="resetEmail" id="lane4-reset-email" required class="lane4-auth-input" placeholder="swimmer@example.com" />
          </div>
          <button type="submit" class="lane4-auth-submit-btn">
            <span>Send Reset Instructions</span>
          </button>
          <div style="text-align:center;margin-top:18px;">
            <a id="lane4-back-to-login" class="lane4-auth-link" style="display:inline-flex;align-items:center;gap:6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Back to Sign In</span>
            </a>
          </div>
        </form>

        <!-- RESET PASSWORD FORM -->
        <form id="lane4-reset-password-form" style="display:none;">
          <div style="margin-bottom:20px;">
            <div style="font-size:16px;font-weight:400;color:#111111;letter-spacing:0.2px;margin-bottom:6px;">Set New Password</div>
            <div style="font-size:13px;font-weight:300;color:#666666;line-height:1.5;">Choose a new password for your account (minimum 6 characters).</div>
          </div>
          <input type="hidden" id="lane4-reset-token-input" />
          <div class="lane4-auth-form-group">
            <label class="lane4-auth-label">New Password *</label>
            <div class="lane4-auth-password-wrap">
              <input type="password" id="lane4-new-password-input" required minlength="6" class="lane4-auth-input" placeholder="••••••••" />
              <button type="button" class="lane4-auth-pass-toggle" aria-label="Show password">
                <svg class="eye-show" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <svg class="eye-hide" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none;"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              </button>
            </div>
          </div>
          <button type="submit" id="lane4-reset-password-btn" class="lane4-auth-submit-btn">
            <span>Update Password</span>
          </button>
          <div style="text-align:center;margin-top:16px;">
            <a id="lane4-reset-back-to-login" class="lane4-auth-link" style="display:inline-flex;align-items:center;gap:6px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Back to Sign In</span>
            </a>
          </div>
        </form>

        <!-- ACCOUNT PROFILE PANEL -->
        <div id="lane4-account-panel" style="display:none;">
          <div style="display:flex;align-items:center;gap:14px;padding-bottom:16px;border-bottom:1px solid #f0f0f0;margin-bottom:16px;">
            <div class="lane4-account-avatar" id="lane4-account-avatar">
              S
            </div>
            <div style="flex:1;min-width:0;">
              <div id="lane4-account-name" style="font-weight:500;font-size:14.5px;color:#111111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:0.2px;"></div>
              <div id="lane4-account-email" style="font-size:12.5px;color:#777777;margin-top:2px;"></div>
            </div>
          </div>

          <!-- Subtabs for Account: Orders, Profile, Addresses -->
          <div class="lane4-acc-subtabs" id="lane4-acc-subtabs">
            <button type="button" class="lane4-acc-subtab-btn active" data-subtab="orders">My Orders</button>
            <button type="button" class="lane4-acc-subtab-btn" data-subtab="profile">Profile</button>
            <button type="button" class="lane4-acc-subtab-btn" data-subtab="addresses">Addresses</button>
          </div>

          <!-- Tab Content: Orders -->
          <div id="lane4-acc-tab-orders" style="display:block;">
            <div id="lane4-account-orders" style="font-size:13px;color:#475569;max-height:460px;overflow-y:auto;padding-right:4px;">Loading orders...</div>
          </div>

          <!-- Tab Content: Profile -->
          <div id="lane4-acc-tab-profile" style="display:none;">
            <form id="lane4-profile-form">
              <div class="lane4-auth-form-group">
                <label class="lane4-auth-label">Full Name</label>
                <input type="text" id="lane4-profile-name" class="lane4-auth-input" required />
              </div>
              <div class="lane4-auth-form-group">
                <label class="lane4-auth-label">Email Address (Read-only)</label>
                <input type="email" id="lane4-profile-email" class="lane4-auth-input" disabled style="background:#f5f5f5;color:#666666;cursor:not-allowed;" />
              </div>
              <div class="lane4-auth-form-group">
                <label class="lane4-auth-label">Mobile Number</label>
                <input type="tel" id="lane4-profile-phone" class="lane4-auth-input" placeholder="+91 98765 43210" />
                <div style="font-size:12px;color:#64748b;margin-top:3px;">10-digit Indian phone number</div>
              </div>
              <button type="submit" id="lane4-profile-save-btn" class="lane4-auth-submit-btn">
                <span>Save Profile Changes</span>
              </button>
            </form>
          </div>

          <!-- Tab Content: Addresses -->
          <div id="lane4-acc-tab-addresses" style="display:none;">
            <div id="lane4-addresses-list" style="max-height:220px;overflow-y:auto;margin-bottom:14px;">Loading addresses...</div>
            <button type="button" id="lane4-add-address-toggle" style="width:100%;background:#ffffff;color:#111111;border:1px dashed #cccccc;padding:12px;border-radius:0px;font-size:11.5px;font-weight:500;letter-spacing:0.5px;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.15s ease;">
              <span>+ Add New Delivery Address</span>
            </button>
            <form id="lane4-new-address-form" style="display:none;margin-top:14px;padding:16px;background:#fafafa;border:1px solid #e5e5e5;border-radius:0px;">
              <div class="lane4-auth-form-group" style="margin-bottom:10px;">
                <label class="lane4-auth-label">Recipient / Addressee Name *</label>
                <input type="text" id="lane4-addr-name" required class="lane4-auth-input" style="padding:10px 12px;font-size:13px;" />
              </div>
              <div class="lane4-auth-form-group" style="margin-bottom:10px;">
                <label class="lane4-auth-label">Phone Number *</label>
                <input type="tel" id="lane4-addr-phone" required class="lane4-auth-input" placeholder="+91 98765 43210" style="padding:10px 12px;font-size:13px;" />
              </div>
              <div class="lane4-auth-form-group" style="margin-bottom:10px;">
                <label class="lane4-auth-label">Street Address Line 1 *</label>
                <input type="text" id="lane4-addr-line1" required class="lane4-auth-input" placeholder="House/Flat No, Apartment, Street" style="padding:10px 12px;font-size:13px;" />
              </div>
              <div class="lane4-auth-form-group" style="margin-bottom:10px;">
                <label class="lane4-auth-label">Address Line 2 (Optional)</label>
                <input type="text" id="lane4-addr-line2" class="lane4-auth-input" placeholder="Landmark, Area" style="padding:10px 12px;font-size:13px;" />
              </div>
              <div style="display:flex;gap:8px;margin-bottom:10px;">
                <div style="flex:1;">
                  <label class="lane4-auth-label">State *</label>
                  <select id="lane4-addr-state" required class="lane4-auth-input" style="padding:10px 12px;font-size:13px;">
                    <option value="">Select State</option>
                  </select>
                </div>
                <div style="flex:1;">
                  <label class="lane4-auth-label">City *</label>
                  <input type="text" id="lane4-addr-city" required class="lane4-auth-input" placeholder="e.g. Nagpur" style="padding:10px 12px;font-size:13px;" />
                </div>
              </div>
              <div class="lane4-auth-form-group" style="margin-bottom:12px;">
                <label class="lane4-auth-label">PIN / Postal Code (6 Digits) *</label>
                <input type="text" id="lane4-addr-pin" maxlength="6" minlength="6" inputmode="numeric" pattern="[0-9]{6}" autocomplete="postal-code" required class="lane4-auth-input" placeholder="440010" style="padding:10px 12px;font-size:13px;" />
              </div>
              <div style="display:flex;gap:8px;">
                <button type="submit" class="lane4-auth-submit-btn" style="flex:1;padding:12px;font-size:12px;margin-top:0;">Save Address</button>
                <button type="button" id="lane4-cancel-addr-btn" style="padding:12px 16px;background:#ffffff;border:1px solid #dcdcdc;border-radius:0px;font-size:12px;font-weight:400;letter-spacing:0.3px;cursor:pointer;color:#333333;">Cancel</button>
              </div>
            </form>
          </div>

          <div style="margin-top:18px;border-top:1px solid #f0f0f0;padding-top:14px;">
            <button id="lane4-logout-btn" style="width:100%;background:#fafafa;color:#333333;border:1px solid #e0e0e0;padding:11px;border-radius:0px;font-weight:500;font-size:12px;letter-spacing:0.8px;text-transform:uppercase;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:all 0.15s;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <!-- DEDICATED ORDER DETAILS PANEL -->
        <div id="lane4-order-details-panel" style="display:none;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid #e2e8f0;">
            <button type="button" id="lane4-order-back-btn" style="background:#ffffff;border:1px solid #cbd5e1;padding:7px 14px;border-radius:0px;font-size:11.5px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;gap:6px;color:#0f172a;transition:all 0.15s;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Back to Orders</span>
            </button>
            <span style="font-size:11px;font-weight:700;color:#64748b;letter-spacing:0.8px;text-transform:uppercase;">Order Summary</span>
          </div>
          <div id="lane4-order-details-content"></div>
        </div>

        <!-- RETURN REQUEST PANEL -->
        <div id="lane4-return-panel" style="display:none;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #f0f0f0;">
            <button type="button" id="lane4-return-back-btn" style="background:#ffffff;border:1px solid #dcdcdc;padding:8px 14px;border-radius:0px;font-size:12px;font-weight:500;letter-spacing:0.3px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;color:#111111;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Back to Order</span>
            </button>
            <span style="font-size:12px;font-weight:500;color:#111111;letter-spacing:0.3px;">Return / Exchange</span>
          </div>
          <form id="lane4-return-form">
            <input type="hidden" id="lane4-return-order-id" />
            <div style="font-size:13px;color:#000000;margin-bottom:12px;font-weight:700;">
              Requesting return for Order <strong id="lane4-return-order-num"></strong>
            </div>
            <div class="lane4-auth-form-group">
              <label class="lane4-auth-label">Select Item *</label>
              <select id="lane4-return-item-select" required class="lane4-auth-input" style="font-size:13px;padding:10px 12px;"></select>
            </div>
            <div class="lane4-auth-form-group">
              <label class="lane4-auth-label">Reason for Return *</label>
              <select id="lane4-return-reason" required class="lane4-auth-input" style="font-size:13px;padding:10px 12px;">
                <option value="">Choose a reason...</option>
                <option value="Wrong Size / Fit Issue">Wrong Size / Fit Issue</option>
                <option value="Damaged / Defective Item">Damaged / Defective Item</option>
                <option value="Wrong Item Delivered">Wrong Item Delivered</option>
                <option value="Item Not as Described">Item Not as Described</option>
                <option value="Quality Not as Expected">Quality Not as Expected</option>
                <option value="Changed Mind / Other">Changed Mind / Other</option>
              </select>
            </div>
            <div class="lane4-auth-form-group">
              <label class="lane4-auth-label">Refund UPI ID *</label>
              <input type="text" id="lane4-return-upi" required class="lane4-auth-input" placeholder="e.g. name@okhdfcbank or 9876543210@upi" />
              <div style="font-size:11px;color:#64748b;margin-top:3px;">Your refund will be dispatched directly to this UPI ID upon inspection</div>
            </div>
            <div class="lane4-auth-form-group">
              <label class="lane4-auth-label">Additional Comments / Exchange Details</label>
              <textarea id="lane4-return-comments" class="lane4-auth-input" rows="3" placeholder="Please specify if you want an exchange for another size, or any defect details..."></textarea>
            </div>
            <button type="submit" id="lane4-return-submit-btn" class="lane4-auth-submit-btn">
              <span>SUBMIT RETURN REQUEST</span>
            </button>
          </form>
          <div id="lane4-return-success" style="display:none;padding:16px;background:#ffffff;border:1.5px solid #16a34a;border-radius:0px;text-align:center;">
            <div style="color:#16a34a;font-weight:600;font-size:15px;margin-bottom:6px;letter-spacing:0.5px;text-transform:uppercase;">Return Request Submitted!</div>
            <div style="font-size:12.5px;color:#000000;line-height:1.5;" id="lane4-return-success-msg"></div>
          </div>
        </div>

        <!-- DEDICATED TAX INVOICE PANEL -->
        <div id="lane4-invoice-panel" style="display:none;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;padding-bottom:12px;border-bottom:1.5px solid #000000;flex-wrap:wrap;gap:8px;">
            <button type="button" id="lane4-invoice-back-btn" style="background:#ffffff;border:1.5px solid #000000;padding:8px 14px;border-radius:0px;font-size:11.5px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;gap:6px;color:#000000;transition:all 0.15s;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
              <span>Back to Order</span>
            </button>
            <div style="display:flex;gap:8px;align-items:center;">
              <button type="button" id="lane4-invoice-print-btn" style="background:#000000;color:#ffffff;border:1.5px solid #000000;padding:8px 16px;border-radius:0px;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                <span>Print / Save PDF</span>
              </button>
            </div>
          </div>
          <div id="lane4-invoice-content"></div>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper);

    // Event bindings for modal
    document.getElementById('lane4-auth-backdrop').onclick = closeAuthModal;
    document.getElementById('lane4-auth-close').onclick = closeAuthModal;
    document.getElementById('lane4-order-back-btn').onclick = () => {
      activeViewingOrderId = null;
      activeViewingOrderData = null;
      document.getElementById('lane4-order-details-panel').style.display = 'none';
      document.getElementById('lane4-account-panel').style.display = 'block';
      setAuthModalSize('wide');
      loadCustomerOrders();
    };

    const invoiceBackBtn = document.getElementById('lane4-invoice-back-btn');
    if (invoiceBackBtn) {
      invoiceBackBtn.onclick = () => {
        const invPanel = document.getElementById('lane4-invoice-panel');
        if (invPanel) invPanel.style.display = 'none';
        const detailsPanel = document.getElementById('lane4-order-details-panel');
        setAuthModalSize('wide');
        if (detailsPanel && activeViewingOrderData) {
          detailsPanel.style.display = 'block';
        } else {
          const accPanel = document.getElementById('lane4-account-panel');
          if (accPanel) accPanel.style.display = 'block';
        }
      };
    }
    const invoicePrintBtn = document.getElementById('lane4-invoice-print-btn');
    if (invoicePrintBtn) {
      invoicePrintBtn.onclick = () => {
        const inv = window.currentCustomerInvoice;
        if (!inv) { window.print(); return; }
        const contentEl = document.getElementById('lane4-invoice-content');
        const old = document.getElementById('lane4-customer-print-iframe');
        if (old) old.remove();
        const iframe = document.createElement('iframe');
        iframe.id = 'lane4-customer-print-iframe';
        iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tax Invoice ${escapeHtml(inv.invoiceNumber || '')}</title><style>@page{size:A4 portrait;margin:12mm;}*{box-sizing:border-box;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}body{margin:0;padding:0;background:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#111827;}</style></head><body>${contentEl ? contentEl.innerHTML : ''}</body></html>`);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
          setTimeout(() => { try { iframe.remove(); } catch (_) {} }, 1500);
        }, 150);
      };
    }

    // Password visibility toggles
    function resetPasswordFields(scope = wrapper) {
      if (!scope) return;
      scope.querySelectorAll('.lane4-auth-password-wrap').forEach(wrap => {
        const input = wrap.querySelector('input');
        const showIcon = wrap.querySelector('.eye-show');
        const hideIcon = wrap.querySelector('.eye-hide');
        const btn = wrap.querySelector('.lane4-auth-pass-toggle');
        if (input) input.type = 'password';
        if (showIcon) showIcon.style.display = 'block';
        if (hideIcon) hideIcon.style.display = 'none';
        if (btn) {
          btn.setAttribute('aria-label', 'Show password');
          btn.setAttribute('title', 'Show password');
        }
      });
    }

    wrapper.querySelectorAll('.lane4-auth-pass-toggle').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const wrap = btn.closest('.lane4-auth-password-wrap');
        const input = wrap ? wrap.querySelector('input') : null;
        if (!input) return;

        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';

        const showIcon = btn.querySelector('.eye-show');
        const hideIcon = btn.querySelector('.eye-hide');
        if (showIcon && hideIcon) {
          showIcon.style.display = isPassword ? 'none' : 'block';
          hideIcon.style.display = isPassword ? 'block' : 'none';
        }
        const newLabel = isPassword ? 'Hide password' : 'Show password';
        btn.setAttribute('aria-label', newLabel);
        btn.setAttribute('title', newLabel);
      };
    });

    // Tab switching and alert isolation
    let currentAuthTab = 'login';

    function switchAuthTab(tab) {
      currentAuthTab = tab;
      resetPasswordFields(wrapper);
      wrapper.querySelectorAll('.lane4-auth-tab-btn').forEach(b => {
        if (b.getAttribute('data-tab') === tab) {
          b.classList.add('active');
        } else {
          b.classList.remove('active');
        }
      });
      const loginForm = document.getElementById('lane4-login-form');
      const regForm = document.getElementById('lane4-register-form');
      const trackForm = document.getElementById('lane4-track-form');
      const forgotForm = document.getElementById('lane4-forgot-form');
      const accPanel = document.getElementById('lane4-account-panel');
      const orderDetailsPanel = document.getElementById('lane4-order-details-panel');

      if (loginForm) loginForm.style.display = tab === 'login' ? 'block' : 'none';
      if (regForm) regForm.style.display = tab === 'register' ? 'block' : 'none';
      if (trackForm) trackForm.style.display = tab === 'track' ? 'block' : 'none';
      if (forgotForm) forgotForm.style.display = 'none';
      if (accPanel) accPanel.style.display = 'none';
      if (orderDetailsPanel) orderDetailsPanel.style.display = 'none';
      const invoicePanel = document.getElementById('lane4-invoice-panel');
      if (invoicePanel) invoicePanel.style.display = 'none';
      hideAlert();
    }

    // Tab switching
    wrapper.querySelectorAll('.lane4-auth-tab-btn').forEach(btn => {
      btn.onclick = () => {
        const tab = btn.getAttribute('data-tab');
        switchAuthTab(tab);
      };
    });

    // Forgot password link
    document.getElementById('lane4-forgot-link').onclick = () => {
      currentAuthTab = 'forgot';
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
      switchAuthTab('login');
    };

    const resetBackBtn = document.getElementById('lane4-reset-back-to-login');
    if (resetBackBtn) {
      resetBackBtn.onclick = () => {
        document.getElementById('lane4-reset-password-form').style.display = 'none';
        document.getElementById('lane4-auth-tabs').style.display = 'flex';
        switchAuthTab('login');
      };
    }

    // Handle Forgot Password Form (Real API integration with anti-enumeration)
    document.getElementById('lane4-forgot-form').onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('lane4-reset-email').value.trim();
      const submitBtn = e.target.querySelector('button[type="submit"]');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending instructions...';
      }
      try {
        const res = await window.lane4ApiRequest('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email })
        });
        showAlert(res.message || `Password recovery instructions dispatched to ${email}.`, 'success');
        setTimeout(() => {
          document.getElementById('lane4-auth-tabs').style.display = 'flex';
          document.getElementById('lane4-forgot-form').style.display = 'none';
          document.getElementById('lane4-login-form').style.display = 'block';
        }, 3000);
      } catch (err) {
        showAlert(err.message || 'Unable to process password reset request.', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Send Reset Instructions</span>';
        }
      }
    };

    // Handle Reset Password Form
    const resetFormEl = document.getElementById('lane4-reset-password-form');
    if (resetFormEl) {
      resetFormEl.onsubmit = async (e) => {
        e.preventDefault();
        const token = document.getElementById('lane4-reset-token-input').value.trim();
        const newPassword = document.getElementById('lane4-new-password-input').value;
        const submitBtn = document.getElementById('lane4-reset-password-btn');
        if (!token) {
          showAlert('Missing password reset token. Please use the link sent to your email.', 'error');
          return;
        }
        if (newPassword.length < 6) {
          showAlert('Password must be at least 6 characters long.', 'error');
          return;
        }
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Updating Password...';
        }
        try {
          const res = await window.lane4ApiRequest('/auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ token, newPassword })
          });
          showAlert(res.message || 'Password updated successfully! You can now sign in.', 'success');
          setTimeout(() => {
            resetFormEl.style.display = 'none';
            document.getElementById('lane4-auth-tabs').style.display = 'flex';
            switchAuthTab('login');
          }, 2000);
        } catch (err) {
          showAlert(err.message || 'Failed to reset password. Link may be invalid or expired.', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Update Password</span>';
          }
        }
      };
    }

    // Auto-detect password reset or email verification token in URL
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const resetTokenParam = urlParams.get('resetToken') || (urlParams.get('token') && window.location.pathname.includes('reset'));
      if (resetTokenParam) {
        openAuthModal();
        document.getElementById('lane4-auth-tabs').style.display = 'none';
        document.getElementById('lane4-login-form').style.display = 'none';
        document.getElementById('lane4-forgot-form').style.display = 'none';
        if (resetFormEl) {
          resetFormEl.style.display = 'block';
          document.getElementById('lane4-reset-token-input').value = resetTokenParam;
        }
      }
    } catch (_) {}

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
        submitBtn.innerHTML = '<span>Searching order records...</span>';
        hideAlert();
        resultEl.style.display = 'none';

        try {
          const res = await window.lane4ApiRequest('/orders/track', {
            method: 'POST',
            body: JSON.stringify({ orderNumber, email })
          });

          lastTrackedQuery = { orderNumber, email };
          renderTrackResult(res.data);
        } catch (err) {
          showAlert(err.message || 'Unable to find order matching these details.', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>Track Order Status</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
        }
      };
    }

    // Initialize subtabs & forms
    initSubtabs();
    initProfileForm();
    initAddressForm();

    // Handle Login Form
    const loginFormEl = document.getElementById('lane4-login-form');
    const loginSubmitBtn = loginFormEl.querySelector('.lane4-auth-submit-btn');
    loginFormEl.onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const email = form.email.value.trim().toLowerCase();
      const password = form.password.value;

      // Client-side guard against admin logins in customer portal
      if (email.startsWith('admin_') || email.startsWith('admin@') || email.includes('admin@lane4swim.in')) {
        showAlert('Administrator accounts cannot sign in to the customer storefront.', 'error');
        return;
      }

      if (!email || !window.LANE4_VALIDATION.isValidEmail(email)) {
        showAlert('Please enter a valid email address.', 'error');
        return;
      }
      if (!password || password.length < 6) {
        showAlert('Password must be at least 6 characters.', 'error');
        return;
      }

      const origLoginBtnHtml = loginSubmitBtn.innerHTML;
      loginSubmitBtn.disabled = true;
      loginSubmitBtn.innerHTML = `
        <span style="display:inline-block;width:12px;height:12px;border:2px solid #ffffff;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;margin-right:6px;"></span>
        <span>Signing in...</span>
      `;
      showAlert('Authenticating swimmer credentials...', 'info');

      try {
        const res = await window.lane4ApiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        const token = (res.data && res.data.token) || ('cust_token_' + btoa(JSON.stringify({ email, time: Date.now() })));
        const loggedInUser = res.data && res.data.user;

        if (!loggedInUser) throw new Error('Invalid login response from server.');

        // Double check response role
        if (loggedInUser.role === 'admin' || loggedInUser.role === 'super_admin') {
          showAlert('Administrator accounts cannot sign in to the customer storefront.', 'error');
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
        // Tab-isolated alert: only display on the login tab
        if (currentAuthTab === 'login') {
          const errMsg = err.message || 'Login failed. Please check credentials.';
          const isNotFound = errMsg.toLowerCase().includes('no customer account') || 
                             errMsg.toLowerCase().includes('not found') || 
                             (err.code === 'USER_NOT_FOUND');

          if (isNotFound) {
            const alertEl = document.getElementById('lane4-auth-alert');
            if (alertEl) {
              alertEl.className = 'lane4-auth-alert error';
              alertEl.innerHTML = `
                <div style="font-size:12.5px;line-height:1.4;margin-bottom:8px;">
                  No customer account found with <strong>${email}</strong>.
                </div>
                <button type="button" id="lane4-btn-quick-create" style="background:#000000;color:#ffffff;border:1px solid #000000;border-radius:0px;padding:9px 14px;font-size:13px;font-weight:400;cursor:pointer;display:inline-flex;align-items:center;gap:6px;letter-spacing:0.3px;">
                  <span>Create account with this email &rarr;</span>
                </button>
              `;
              alertEl.style.display = 'block';

              const quickBtn = document.getElementById('lane4-btn-quick-create');
              if (quickBtn) {
                quickBtn.onclick = () => {
                  switchAuthTab('register');
                  const regForm = document.getElementById('lane4-register-form');
                  if (regForm) {
                    if (regForm.email) regForm.email.value = email;
                    if (regForm.password) regForm.password.value = password;
                    if (regForm.displayName) regForm.displayName.focus();
                  }
                };
              }
            }
          } else {
            showAlert(errMsg, 'error');
          }
        }
      } finally {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.innerHTML = origLoginBtnHtml;
      }
    };

    // Handle Register Form
    const regFormEl = document.getElementById('lane4-register-form');
    const regSubmitBtn = regFormEl.querySelector('.lane4-auth-submit-btn');
    regFormEl.onsubmit = async (e) => {
      e.preventDefault();
      const form = e.target;
      const email = form.email.value.trim().toLowerCase();
      const displayName = form.displayName.value.trim();
      const password = form.password.value;
      const phone = form.phone.value.trim();

      if (email.startsWith('admin_') || email.startsWith('admin@') || email.includes('admin@lane4swim.in')) {
        showAlert('Administrator accounts cannot be registered on the customer storefront.', 'error');
        return;
      }

      if (!displayName || displayName.length < 2) {
        showAlert('Please enter your full name.', 'error');
        return;
      }
      if (!email || !window.LANE4_VALIDATION.isValidEmail(email)) {
        showAlert('Please enter a valid email address.', 'error');
        return;
      }
      if (phone && !window.LANE4_VALIDATION.isValidIndianPhone(phone)) {
        showAlert('Please enter a valid 10-digit Indian mobile number.', 'error');
        return;
      }
      if (!password || password.length < 6) {
        showAlert('Password must be at least 6 characters long.', 'error');
        return;
      }

      const origRegBtnHtml = regSubmitBtn.innerHTML;
      regSubmitBtn.disabled = true;
      regSubmitBtn.innerHTML = `
        <span style="display:inline-block;width:12px;height:12px;border:2px solid #ffffff;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;margin-right:6px;"></span>
        <span>Creating account...</span>
      `;
      showAlert('Setting up your swimmer account...', 'info');

      try {
        const payload = {
          displayName,
          email,
          password,
          phone
        };

        await window.lane4ApiRequest('/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

        // Immediately login to receive full token & session
        const loginRes = await window.lane4ApiRequest('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
        });

        const token = (loginRes.data && loginRes.data.token) || ('cust_token_' + btoa(JSON.stringify({ email, time: Date.now() })));
        const user = (loginRes.data && loginRes.data.user) || { email, displayName, role: 'customer' };

        showAlert('Account created! Logging you in...', 'success');
        window.LANE4.setUser({
          ...user,
          email,
          displayName,
          phoneNumber: phone
        }, token);

        // Merge guest cart if any
        const guestId = localStorage.getItem('lane4_guest_id');
        if (guestId) {
          await window.lane4ApiRequest('/cart/merge', {
            method: 'POST',
            body: JSON.stringify({ guestId })
          }).catch(() => {});
        }

        setTimeout(() => {
          closeAuthModal();
          window.location.reload();
        }, 700);
      } catch (err) {
        if (currentAuthTab === 'register') {
          showAlert(err.message || 'Registration failed.', 'error');
        }
      } finally {
        regSubmitBtn.disabled = false;
        regSubmitBtn.innerHTML = origRegBtnHtml;
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

  function setAuthModalSize(mode) {
    const card = document.getElementById('lane4-auth-card');
    if (!card) return;
    card.classList.remove('lane4-auth-card--wide', 'lane4-auth-card--invoice');
    if (mode === 'wide') card.classList.add('lane4-auth-card--wide');
    else if (mode === 'invoice') card.classList.add('lane4-auth-card--invoice');
  }

  function openAuthModal(view = 'login') {
    if (!document.getElementById('lane4-auth-modal-wrapper')) {
      createAuthModalDOM();
    }
    const wrapper = document.getElementById('lane4-auth-modal-wrapper');
    if (!wrapper) return;
    wrapper.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    startSwimmerRealtimePolling();

    // Ensure password inputs are securely masked when modal opens
    wrapper.querySelectorAll('.lane4-auth-password-wrap').forEach(wrap => {
      const input = wrap.querySelector('input');
      const showIcon = wrap.querySelector('.eye-show');
      const hideIcon = wrap.querySelector('.eye-hide');
      const btn = wrap.querySelector('.lane4-auth-pass-toggle');
      if (input) input.type = 'password';
      if (showIcon) showIcon.style.display = 'block';
      if (hideIcon) hideIcon.style.display = 'none';
      if (btn) {
        btn.setAttribute('aria-label', 'Show password');
        btn.setAttribute('title', 'Show password');
      }
    });

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
      setAuthModalSize('wide');
      tabs.style.display = 'none';
      loginForm.style.display = 'none';
      regForm.style.display = 'none';
      if (trackForm) trackForm.style.display = 'none';
      const orderDetailsPanel = document.getElementById('lane4-order-details-panel');
      if (orderDetailsPanel) orderDetailsPanel.style.display = 'none';
      const returnPanel = document.getElementById('lane4-return-panel');
      if (returnPanel) returnPanel.style.display = 'none';
      const invoicePanel = document.getElementById('lane4-invoice-panel');
      if (invoicePanel) invoicePanel.style.display = 'none';
      accPanel.style.display = 'block';

      const initials = (user.displayName || user.email || 'S').slice(0, 1).toUpperCase();
      document.getElementById('lane4-account-avatar').textContent = initials;
      document.getElementById('lane4-account-name').textContent = user.displayName || 'LANE4 Swimmer';
      document.getElementById('lane4-account-email').textContent = user.email;

      // Reset subtabs to orders
      const subtabs = document.getElementById('lane4-acc-subtabs');
      if (subtabs) {
        subtabs.querySelectorAll('.lane4-acc-subtab-btn').forEach((b, idx) => {
          if (idx === 0) b.classList.add('active');
          else b.classList.remove('active');
        });
        document.getElementById('lane4-acc-tab-orders').style.display = 'block';
        document.getElementById('lane4-acc-tab-profile').style.display = 'none';
        document.getElementById('lane4-acc-tab-addresses').style.display = 'none';
      }

      loadCustomerOrders();
    } else {
      setAuthModalSize('compact');
      currentAuthTab = view;
      tabs.style.display = 'flex';
      accPanel.style.display = 'none';
      const orderDetailsPanel = document.getElementById('lane4-order-details-panel');
      if (orderDetailsPanel) orderDetailsPanel.style.display = 'none';
      const returnPanel = document.getElementById('lane4-return-panel');
      if (returnPanel) returnPanel.style.display = 'none';
      const invoicePanel = document.getElementById('lane4-invoice-panel');
      if (invoicePanel) invoicePanel.style.display = 'none';
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
      hideAlert();
    }
  }

  let customerOrdersCache = [];
  let activeViewingOrderId = null;
  let activeViewingOrderData = null;
  let swimmerRealtimeTimer = null;
  let lastTrackedQuery = null;
  const orderSyncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lane4_orders_channel') : null;

  const statusDisplayMap = {
    'pending_payment': 'Pending Payment',
    'payment_verification': 'Payment Verification',
    'confirmed': 'Confirmed (Ready to Pack)',
    'processing': 'Processing',
    'shipped': 'Shipped',
    'out_for_delivery': 'Out For Delivery',
    'delivered': 'Delivered',
    'cancelled': 'Cancelled',
    'payment_rejected': 'Payment Rejected'
  };

  function getOrderStatusBadge(st) {
    if (!st) return 'Pending Payment';
    return statusDisplayMap[st] || st.replace(/_/g, ' ');
  }

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

  function getOrderStepperData(ord) {
    if (!ord) ord = {};
    const st = (ord.status || '').toLowerCase();
    const pst = (ord.paymentStatus || '').toLowerCase();

    const isCancelled = st === 'cancelled';
    const isDelivered = st === 'delivered';
    const isOutForDelivery = st === 'out_for_delivery';
    const isShipped = st === 'shipped' || isOutForDelivery || isDelivered;
    const isProcessing = st === 'processing';
    const isConfirmed = st === 'confirmed';

    // Step 1: Placed is always completed once order exists
    const isStep1Done = true;

    // Step 2: Payment / Verification
    // A past process is done if payment is verified OR order has advanced to confirmed, processing, shipped, out_for_delivery, delivered
    const isPaymentVerified = pst === 'verified';
    const isPaymentRejected = pst === 'payment_rejected' || pst === 'rejected' || st === 'payment_rejected';
    const isStep2Done = isPaymentVerified || ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'].includes(st);
    const isVerificationPending = st === 'payment_verification' || pst === 'verification_pending';
    const isAwaitingProof = !isStep2Done && !isPaymentRejected && !isVerificationPending;

    let step2Text = '● 2. Awaiting Payment Proof';
    let step2Color = '#d97706';
    let paymentBadgeText = 'Awaiting Payment Proof';
    let paymentBadgeBg = '#fef3c7';
    let paymentBadgeColor = '#92400e';

    if (isStep2Done) {
      step2Text = '✓ 2. Verified';
      step2Color = '#16a34a';
      paymentBadgeText = 'Payment Verified';
      paymentBadgeBg = '#dcfce7';
      paymentBadgeColor = '#15803d';
    } else if (isPaymentRejected) {
      step2Text = '✕ 2. Rejected';
      step2Color = '#dc2626';
      paymentBadgeText = 'Payment Rejected';
      paymentBadgeBg = '#fee2e2';
      paymentBadgeColor = '#b91c1c';
    } else if (isVerificationPending) {
      step2Text = '● 2. Awaiting Admin Verification';
      step2Color = '#0284c7';
      paymentBadgeText = 'Awaiting Admin Verification';
      paymentBadgeBg = '#e0f2fe';
      paymentBadgeColor = '#0369a1';
    } else {
      step2Text = '● 2. Awaiting Payment Proof';
      step2Color = '#d97706';
      paymentBadgeText = 'Awaiting Payment Proof';
      paymentBadgeBg = '#fef3c7';
      paymentBadgeColor = '#92400e';
    }

    // Step 3: Packing / Processing
    // Step 3 is a past process (done) if the order has been shipped, out for delivery, or delivered
    const isStep3Done = isShipped;
    let step3Html = '';
    if (isStep3Done) {
      step3Html = '<span style="color:#16a34a;">✓ 3. Packed</span>';
    } else if (isProcessing) {
      step3Html = '<span style="color:#0284c7;font-weight:600;">● 3. Processing</span>';
    } else if (isConfirmed) {
      step3Html = '<span style="color:#0284c7;font-weight:600;">● 3. Confirmed (Ready to Pack)</span>';
    } else if (isCancelled) {
      step3Html = '<span style="color:#dc2626;">✕ 3. Cancelled</span>';
    } else {
      step3Html = '<span style="color:#94a3b8;">3. Ready to Pack</span>';
    }

    // Step 4: Dispatch & Delivery
    // Step 4 is done (past process) if delivered!
    const isStep4Done = isDelivered;
    let step4Html = '';
    if (isStep4Done) {
      step4Html = '<span style="color:#16a34a;">✓ 4. Delivered</span>';
    } else if (isOutForDelivery) {
      step4Html = '<span style="color:#0284c7;font-weight:600;">● 4. Out For Delivery</span>';
    } else if (st === 'shipped') {
      step4Html = '<span style="color:#0284c7;font-weight:600;">● 4. Shipped</span>';
    } else {
      step4Html = '<span style="color:#94a3b8;">4. Shipped</span>';
    }

    const arrow1Color = isStep2Done ? '#16a34a' : '#cbd5e1';
    const arrow2Color = (isStep3Done || isConfirmed || isProcessing) && isStep2Done ? '#16a34a' : '#cbd5e1';
    const arrow3Color = (isStep4Done || isOutForDelivery || st === 'shipped') && isStep3Done ? '#16a34a' : '#cbd5e1';

    return {
      isStep1Done,
      isStep2Done,
      isPaymentRejected,
      isVerificationPending,
      isAwaitingProof,
      step2Text,
      step2Color,
      paymentBadgeText,
      paymentBadgeBg,
      paymentBadgeColor,
      isStep3Done,
      step3Html,
      isStep4Done,
      step4Html,
      arrow1Color,
      arrow2Color,
      arrow3Color
    };
  }

  function showOrderDetails(ord, isBackgroundRefresh = false) {
    const escapeHtml = window.escapeHtml || function(s) {
      if (s === null || s === undefined) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    };
    const accPanel = document.getElementById('lane4-account-panel');
    const detailsPanel = document.getElementById('lane4-order-details-panel');
    const content = document.getElementById('lane4-order-details-content');
    if (!detailsPanel || !content) return;

    activeViewingOrderId = ord.orderNumber || ord.orderId || ord.id;
    activeViewingOrderData = ord;

    let prevScrollTop = 0;
    if (isBackgroundRefresh) {
      prevScrollTop = content.scrollTop;
    } else {
      setAuthModalSize('wide');
      if (accPanel) accPanel.style.display = 'none';
      detailsPanel.style.display = 'block';
      const modalBody = document.getElementById('lane4-auth-card');
      if (modalBody) modalBody.scrollTop = 0;
      content.scrollTop = 0;
    }

    const orderNum = ord.orderNumber || ord.orderId || 'Order';
    const stepper = getOrderStepperData(ord);

    const items = ord.items || [];
    const pricing = ord.pricing || {};
    const shipping = ord.shippingAddress || {};
    const payment = ord.payment || {};
    const fulfillment = ord.fulfillment || {};

    const itemsHtml = items.map((it, idx) => {
      let rawImg = it.imageUrl || it.image || '6424266ea05809dff501d86e/lane4-6dbhNuWa5oI-640x640.jpg';
      let imgUrl = rawImg;
      if (window.LANE4 && window.LANE4.resolveAssetUrl) imgUrl = window.LANE4.resolveAssetUrl(rawImg);
      const variantDesc = [it.size ? `Size: ${it.size}` : '', it.color ? `Color: ${it.color}` : ''].filter(Boolean).join(' · ');

      // Robust unit and subtotal calculation matching backend quote
      let unitPaise = it.unitPricePaise !== undefined ? it.unitPricePaise : (it.pricePaise !== undefined ? it.pricePaise : (it.price ? Math.round(parseFloat(it.price) * 100) : 0));
      if (!unitPaise && pricing.subtotalPaise > 0 && items.length > 0) {
        unitPaise = Math.round(pricing.subtotalPaise / items.length);
      }
      const unitPriceFormatted = (it.unitPriceFormatted && it.unitPriceFormatted !== '₹0.00')
        ? it.unitPriceFormatted
        : ((it.priceFormatted && it.priceFormatted !== '₹0.00')
          ? it.priceFormatted
          : (window.LANE4 && unitPaise ? window.LANE4.formatINR(unitPaise) : `₹${((unitPaise || 0)/100).toFixed(2)}`));

      const qty = it.quantity || 1;
      let itemSubtotalPaise = it.totalPricePaise !== undefined ? it.totalPricePaise : (it.subtotalPaise !== undefined ? it.subtotalPaise : (unitPaise * qty));
      if (!itemSubtotalPaise && unitPaise) {
        itemSubtotalPaise = unitPaise * qty;
      }
      const itemSubtotalFormatted = (it.totalPriceFormatted && it.totalPriceFormatted !== '₹0.00')
        ? it.totalPriceFormatted
        : ((it.subtotalFormatted && it.subtotalFormatted !== '₹0.00')
          ? it.subtotalFormatted
          : (window.LANE4 && itemSubtotalPaise ? window.LANE4.formatINR(itemSubtotalPaise) : `₹${((itemSubtotalPaise || 0)/100).toFixed(2)}`));

      return `
        <div style="display:flex;align-items:center;gap:14px;padding:12px 0;${idx < items.length - 1 ? 'border-bottom:1px solid #f1f5f9;' : ''}">
          <img src="${imgUrl}" alt="${escapeHtml(it.name || 'Product')}" style="width:56px;height:56px;border-radius:0px;object-fit:cover;border:1px solid #e2e8f0;flex-shrink:0;background:#f8fafc;" onerror="this.onerror=null;this.src='6424266ea05809dff501d86e/lane4-6dbhNuWa5oI-640x640.jpg';" />
          <div style="flex:1;min-width:0;">
            <div style="font-size:13.5px;font-weight:600;color:#0f172a;line-height:1.35;">${escapeHtml(it.name || 'Lane4 Item')}</div>
            ${variantDesc ? `<div style="font-size:11.5px;color:#64748b;margin-top:2px;">${escapeHtml(variantDesc)}</div>` : ''}
            <div style="font-size:12px;color:#475569;margin-top:4px;font-variant-numeric:tabular-nums;">
              Qty: <strong style="color:#0f172a;">${qty}</strong> &times; ${unitPriceFormatted}
            </div>
          </div>
          <div style="font-size:14px;font-weight:700;color:#0f172a;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;">
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
    const formattedPhone = shipping.phone
      ? (() => {
          const digits = normalizeAuthPhone(shipping.phone);
          return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : escapeHtml(shipping.phone);
        })()
      : '';
    const totalItemQty = items.reduce((sum, it) => sum + (it.quantity || 1), 0);

    content.innerHTML = `
      <!-- Order Header Summary Card -->
      <div style="background:#f8fafc;border:1px solid #0f172a;border-top:3px solid #0f172a;border-radius:0px;padding:16px 18px;margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div>
            <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.9px;">Order Reference</div>
            <div style="font-size:19px;font-weight:700;color:#0f172a;margin-top:2px;letter-spacing:-0.2px;">#${escapeHtml(orderNum)}</div>
            <div style="font-size:12px;color:#475569;margin-top:4px;">Placed on ${formatOrderTimestamp(ord.createdAt)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.9px;">Total Paid</div>
            <div style="font-size:19px;font-weight:700;color:#0f172a;margin-top:2px;font-variant-numeric:tabular-nums;">${payableText}</div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end;margin-top:8px;">
              <span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:0px;border:1px solid #0f172a;background:#ffffff;color:#0f172a;text-transform:uppercase;letter-spacing:0.6px;">
                ${getOrderStatusBadge(ord.status)}
              </span>
              <span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:0px;border:1px solid transparent;background:${stepper.paymentBadgeBg};color:${stepper.paymentBadgeColor};text-transform:uppercase;letter-spacing:0.6px;">
                ${stepper.paymentBadgeText}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Fulfillment Progress Stepper -->
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:0px;padding:14px 16px;margin-bottom:14px;">
        <div style="font-size:10.5px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px;">Order &amp; Fulfillment Progress</div>
        <div class="lane4-stepper-grid">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px 10px;font-size:11px;font-weight:600;color:#16a34a;text-align:center;">&#10003; 1. Placed</div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px 10px;font-size:11px;font-weight:600;color:${stepper.step2Color};text-align:center;">${stepper.step2Text}</div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px 10px;font-size:11px;font-weight:600;text-align:center;">${stepper.step3Html}</div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px 10px;font-size:11px;font-weight:600;text-align:center;">${stepper.step4Html}</div>
        </div>
        ${fulfillment && fulfillment.trackingNumber ? `
          <div style="margin-top:10px;padding:8px 10px;background:#f8fafc;border-left:3px solid #0f172a;font-size:12px;color:#334155;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
            <span><strong>Courier:</strong> ${escapeHtml(fulfillment.courierName || 'DTDC')}</span>
            <span><strong>Tracking AWB:</strong> <code style="background:#ffffff;border:1px solid #cbd5e1;padding:1px 6px;font-weight:600;color:#0f172a;">${escapeHtml(fulfillment.trackingNumber)}</code></span>
          </div>
        ` : ''}
      </div>

      <!-- Products Purchased -->
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:0px;padding:15px 18px;margin-bottom:14px;">
        <div style="font-size:10.5px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.8px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">
          Products Purchased (${totalItemQty} ${totalItemQty === 1 ? 'Item' : 'Items'})
        </div>
        <div>${itemsHtml || '<div style="font-size:12px;color:#64748b;padding-top:10px;">No product items recorded for this order.</div>'}</div>
      </div>

      <!-- Billing + Delivery & Payment 2-Column Grid -->
      <div class="lane4-details-two-col">
        <!-- Billing Breakdown -->
        <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:0px;padding:15px 18px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:10.5px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #e2e8f0;">Billing Breakdown</div>
            <div style="display:flex;justify-content:space-between;font-size:12.5px;color:#334155;margin-bottom:8px;font-variant-numeric:tabular-nums;">
              <span>Item total</span>
              <span style="font-weight:600;color:#0f172a;">${subtotalText}</span>
            </div>
            ${discountPaise > 0 ? `
              <div style="display:flex;justify-content:space-between;font-size:12.5px;color:#15803d;margin-bottom:8px;font-variant-numeric:tabular-nums;">
                <span>Coupon ${ord.coupon && ord.coupon.code ? `<span style="font-weight:600;background:#dcfce7;padding:1px 6px;font-size:10.5px;">${escapeHtml(ord.coupon.code)}</span>` : ''}</span>
                <span style="font-weight:600;">-${discountText}</span>
              </div>
            ` : ''}
            <div style="display:flex;justify-content:space-between;font-size:12.5px;color:#334155;margin-bottom:12px;font-variant-numeric:tabular-nums;">
              <span>Delivery fee</span>
              <span style="font-weight:600;color:${shippingPaise === 0 ? '#15803d' : '#0f172a'};">${shippingText}</span>
            </div>
          </div>
          <div>
            <div style="border-top:1.5px solid #0f172a;padding-top:10px;display:flex;justify-content:space-between;align-items:center;font-variant-numeric:tabular-nums;">
              <span style="font-size:12px;font-weight:700;color:#0f172a;text-transform:uppercase;letter-spacing:0.8px;">Total Paid</span>
              <span style="font-size:16px;font-weight:700;color:#0f172a;">${payableText}</span>
            </div>
            <div style="margin-top:10px;padding-top:8px;border-top:1px dashed #e2e8f0;font-size:11px;color:#64748b;display:flex;align-items:center;gap:6px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              <span>Payments are secure and encrypted</span>
            </div>
          </div>
        </div>

        <!-- Delivery Destination + Payment Information -->
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:0px;padding:15px 18px;flex:1;">
            <div style="font-size:10.5px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;">Delivery Destination</div>
            <div style="font-size:13.5px;font-weight:700;color:#0f172a;">${escapeHtml(shipping.addressee || ord.customerName || 'Swimmer')}</div>
            <div style="font-size:12px;color:#475569;line-height:1.5;margin-top:4px;">
              ${escapeHtml(shipping.addressLine1 || '')}${shipping.addressLine2 ? `, ${escapeHtml(shipping.addressLine2)}` : ''}<br />
              ${shipping.city ? `${escapeHtml(shipping.city)}, ` : ''}${shipping.state ? `${escapeHtml(shipping.state)} ` : ''}${shipping.postalCode ? `PIN ${escapeHtml(shipping.postalCode)}` : ''}
            </div>
            ${formattedPhone ? `<div style="font-size:12px;color:#475569;margin-top:6px;">Phone: <strong style="color:#0f172a;">${formattedPhone}</strong></div>` : ''}
          </div>

          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:0px;padding:15px 18px;">
            <div style="font-size:10.5px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;">Payment Information</div>
            <div style="font-size:12.5px;font-weight:600;color:#0f172a;">${escapeHtml(paymentMethodLabel)}</div>
            ${payment.upiReferenceNumber ? `
              <div style="font-size:12px;color:#475569;margin-top:6px;">
                UTR / Ref: <code style="background:#f8fafc;border:1px solid #cbd5e1;padding:2px 6px;border-radius:0px;font-weight:600;color:#0f172a;">${escapeHtml(payment.upiReferenceNumber)}</code>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Payment Proof Upload (New Submission or Resubmission if Rejected) -->
      ${(ord.status === 'payment_rejected' || ord.paymentStatus === 'rejected' || stepper.isAwaitingProof) ? `
        <div id="lane4-proof-upload-container" style="background:#ffffff;border:1px solid ${stepper.isPaymentRejected ? '#dc2626' : '#0f172a'};border-left:4px solid ${stepper.isPaymentRejected ? '#dc2626' : '#0f172a'};border-radius:0px;padding:16px 18px;margin-bottom:14px;">
          <div style="display:flex;align-items:center;gap:8px;color:${stepper.isPaymentRejected ? '#991b1b' : '#0f172a'};font-weight:700;font-size:12.5px;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.6px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
            <span>${stepper.isPaymentRejected ? 'Payment Proof Action Required' : 'Upload Manual UPI Payment Proof'}</span>
          </div>
          <div style="font-size:12.5px;color:#334155;line-height:1.5;margin-bottom:12px;">
            ${stepper.isPaymentRejected
              ? `Your previous payment verification was not approved. Please ensure you have transferred <strong>${payableText}</strong> to UPI ID <code>lane4swim@upi</code>, then upload a new payment screenshot with your valid 12-digit UTR number.`
              : `Please transfer <strong>${payableText}</strong> to merchant UPI ID <code>lane4swim@upi</code>, then enter your 12-digit bank UTR reference and upload your payment screenshot below to confirm your order.`}
          </div>
          <form id="lane4-resubmit-payment-form">
            <div class="lane4-auth-form-group" style="margin-bottom:10px;">
              <label class="lane4-auth-label" style="color:${stepper.isPaymentRejected ? '#991b1b' : '#0f172a'};">12-Digit UPI Reference (UTR) *</label>
              <input type="text" id="lane4-resubmit-utr" required maxlength="12" minlength="12" pattern="[0-9]{12}" class="lane4-auth-input" placeholder="e.g. 402812345678" style="background:#ffffff;" />
            </div>
            <div class="lane4-auth-form-group" style="margin-bottom:12px;">
              <label class="lane4-auth-label" style="color:${stepper.isPaymentRejected ? '#991b1b' : '#0f172a'};">Upload Payment Screenshot *</label>
              <input type="file" id="lane4-resubmit-screenshot" accept="image/*" required style="font-size:12px;width:100%;background:#ffffff;padding:8px;border:1px solid #cbd5e1;border-radius:0px;" />
            </div>
            <button type="submit" id="lane4-resubmit-btn" class="lane4-auth-submit-btn" style="background:${stepper.isPaymentRejected ? '#dc2626' : '#0f172a'};color:#ffffff;margin-top:0;">
              <span>${stepper.isPaymentRejected ? 'Resubmit Payment Proof' : 'Submit Payment Proof'}</span>
            </button>
          </form>
        </div>
      ` : ''}

      <!-- Order Action Buttons Row -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px;">
        ${(['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'].includes(ord.status) || ord.paymentStatus === 'verified') ? `
          <button type="button" id="lane4-order-invoice-btn" style="flex:1;min-width:210px;background:#0f172a;color:#ffffff;border:1px solid #0f172a;padding:11px 16px;border-radius:0px;font-size:11.5px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:all 0.15s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span>View / Download Tax Invoice (GST)</span>
          </button>
        ` : ''}
        ${ord.status === 'delivered' ? `
          <button type="button" id="lane4-order-return-btn" style="flex:1;min-width:190px;background:#ffffff;color:#0f172a;border:1px solid #0f172a;padding:11px 16px;border-radius:0px;font-size:11.5px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:all 0.15s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><polyline points="23 20 23 14 17 14"></polyline><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path></svg>
            <span>Request Return / Exchange</span>
          </button>
        ` : ''}
        ${['pending_payment', 'payment_verification', 'payment_rejected', 'confirmed'].includes(ord.status) ? `
          <button type="button" id="lane4-order-cancel-btn" style="flex:1;min-width:170px;background:#ffffff;color:#dc2626;border:1px solid #dc2626;padding:11px 16px;border-radius:0px;font-size:11.5px;font-weight:600;letter-spacing:0.6px;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;transition:all 0.15s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
            <span>Cancel Order</span>
          </button>
        ` : ''}
      </div>
    `;

    const returnBtn = document.getElementById('lane4-order-return-btn');
    if (returnBtn) {
      returnBtn.onclick = () => openReturnForm(ord);
    }
    const invoiceBtn = document.getElementById('lane4-order-invoice-btn');
    if (invoiceBtn) {
      invoiceBtn.onclick = () => window.downloadCustomerInvoice(ord.orderId || ord.id || orderNum, ord.orderAccessToken);
    }

    // Bind Resubmit Payment Proof handler
    const resubmitForm = document.getElementById('lane4-resubmit-payment-form');
    if (resubmitForm) {
      resubmitForm.onsubmit = async (e) => {
        e.preventDefault();
        const utrInput = document.getElementById('lane4-resubmit-utr');
        const fileInput = document.getElementById('lane4-resubmit-screenshot');
        const resubmitBtn = document.getElementById('lane4-resubmit-btn');
        const cleanUtr = (utrInput.value || '').trim();
        if (!/^\d{12}$/.test(cleanUtr) || /^0{12}$/.test(cleanUtr)) {
          showAlert('Please enter a valid 12-digit numeric UPI Reference / UTR Number (000000000000 is not valid).', 'error');
          return;
        }
        if (!fileInput.files || fileInput.files.length === 0) {
          showAlert('Please select a payment confirmation screenshot.', 'error');
          return;
        }

        resubmitBtn.disabled = true;
        resubmitBtn.textContent = 'Uploading Proof...';

        try {
          const formData = new FormData();
          formData.append('orderId', ord.orderId || ord.id || orderNum);
          formData.append('upiReferenceNumber', cleanUtr);
          formData.append('screenshot', fileInput.files[0]);
          if (ord.orderAccessToken) {
            formData.append('orderAccessToken', ord.orderAccessToken);
          }

          const res = await window.lane4ApiRequest('/payments/proof', {
            method: 'POST',
            body: formData
          });

          showAlert('Payment proof resubmitted successfully! Our team is verifying your payment.', 'success');
          const orderIdToFetch = ord.orderId || ord.id || orderNum;
          try {
            const updated = await window.lane4ApiRequest(`/orders/${orderIdToFetch}`);
            if (updated && updated.data) {
              showOrderDetails(updated.data, true);
            }
          } catch (_) {
            loadCustomerOrders();
          }
        } catch (err) {
          showAlert(err.message || 'Failed to submit payment proof. Please try again.', 'error');
        } finally {
          resubmitBtn.disabled = false;
          resubmitBtn.innerHTML = '<span>RESUBMIT PAYMENT PROOF</span>';
        }
      };
    }

    // Bind Customer Self-Cancellation handler
    const cancelBtn = document.getElementById('lane4-order-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = async () => {
        const confirmed = confirm(`Are you sure you want to cancel Order #${orderNum}? This action cannot be undone.`);
        if (!confirmed) return;

        cancelBtn.disabled = true;
        cancelBtn.textContent = 'Cancelling Order...';

        try {
          const orderIdToCancel = ord.orderId || ord.id || orderNum;
          await window.lane4ApiRequest(`/orders/${orderIdToCancel}/cancel`, {
            method: 'POST',
            body: JSON.stringify({
              reason: 'Customer requested cancellation via account dashboard',
              orderAccessToken: ord.orderAccessToken || ''
            })
          });

          showAlert('Order successfully cancelled.', 'success');
          try {
            const updated = await window.lane4ApiRequest(`/orders/${orderIdToCancel}`);
            if (updated && updated.data) {
              showOrderDetails(updated.data, true);
            }
          } catch (_) {
            loadCustomerOrders();
          }
        } catch (err) {
          showAlert(err.message || 'Unable to cancel order. Please contact support.', 'error');
          cancelBtn.disabled = false;
          cancelBtn.textContent = 'Cancel Order';
        }
      };
    }

    if (isBackgroundRefresh) {
      content.scrollTop = prevScrollTop;
    }
  }

  function openReturnForm(ord) {
    const detailsPanel = document.getElementById('lane4-order-details-panel');
    const returnPanel = document.getElementById('lane4-return-panel');
    const returnForm = document.getElementById('lane4-return-form');
    const returnSuccess = document.getElementById('lane4-return-success');
    if (!returnPanel || !returnForm) return;

    setAuthModalSize('wide');
    if (detailsPanel) detailsPanel.style.display = 'none';
    returnPanel.style.display = 'block';
    if (returnSuccess) returnSuccess.style.display = 'none';
    returnForm.style.display = 'block';

    const orderRef = ord.orderNumber || ord.orderId;
    document.getElementById('lane4-return-order-id').value = ord.orderId || orderRef;
    document.getElementById('lane4-return-order-num').textContent = `#${orderRef}`;

    const itemSelect = document.getElementById('lane4-return-item-select');
    itemSelect.innerHTML = '<option value="ALL">Entire Order (All Items)</option>';
    (ord.items || []).forEach((it, idx) => {
      const opt = document.createElement('option');
      opt.value = it.productId || it.sku || `item_${idx}`;
      opt.textContent = `${it.quantity || 1}x ${it.name || 'Lane4 Item'} ${it.size ? `(${it.size})` : ''}`;
      itemSelect.appendChild(opt);
    });

    document.getElementById('lane4-return-reason').value = '';
    document.getElementById('lane4-return-upi').value = '';
    document.getElementById('lane4-return-comments').value = '';

    document.getElementById('lane4-return-back-btn').onclick = () => {
      returnPanel.style.display = 'none';
      if (detailsPanel) detailsPanel.style.display = 'block';
    };

    returnForm.onsubmit = async (e) => {
      e.preventDefault();
      const reason = document.getElementById('lane4-return-reason').value;
      const upiIdForRefund = document.getElementById('lane4-return-upi').value.trim();
      const comments = document.getElementById('lane4-return-comments').value.trim();
      const selectedItemVal = itemSelect.value;

      if (!reason) {
        showAlert('Please choose a reason for the return / exchange.', 'error');
        return;
      }
      if (!upiIdForRefund || !upiIdForRefund.includes('@')) {
        showAlert('Please enter a valid refund UPI ID (e.g. name@okhdfcbank).', 'error');
        return;
      }

      const submitBtn = document.getElementById('lane4-return-submit-btn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting Return Request...';

      let itemsToReturn = ord.items || [];
      if (selectedItemVal !== 'ALL') {
        const matched = (ord.items || []).filter(it => (it.productId === selectedItemVal || it.sku === selectedItemVal));
        if (matched.length > 0) itemsToReturn = matched;
      }

      try {
        const res = await window.lane4ApiRequest('/returns', {
          method: 'POST',
          body: JSON.stringify({
            orderId: ord.orderId || orderRef,
            reason,
            upiIdForRefund,
            comments,
            items: itemsToReturn,
            orderAccessToken: ord.orderAccessToken || ''
          })
        });

        const ret = res.data;

        // Broadcast real-time return submission to admin portal with zero latency
        if (orderSyncChannel) {
          orderSyncChannel.postMessage({ type: 'return_submitted', orderId: ord.orderId || orderRef, returnId: ret.returnId, timestamp: Date.now() });
        }
        try {
          localStorage.setItem('lane4_return_updated', JSON.stringify({ orderId: ord.orderId || orderRef, returnId: ret.returnId, timestamp: Date.now() }));
        } catch (_) {}

        returnForm.style.display = 'none';
        if (returnSuccess) {
          returnSuccess.style.display = 'block';
          document.getElementById('lane4-return-success-msg').innerHTML = `
            Reference ID: <strong style="color:#111111;">${ret.returnId || 'L4-RET'}</strong>.<br>
            Our operations team has been notified. We will inspect your request and dispatch DTDC pickup instructions to your email (<code>${ord.customerEmail || ''}</code>).
          `;
        }
      } catch (err) {
        showAlert(err.message || 'Unable to submit return request. Please contact support.', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'SUBMIT RETURN REQUEST';
      }
    };
  }

  function renderTrackResult(ord) {
    const resultEl = document.getElementById('lane4-order-track-result');
    if (!resultEl || !ord) return;

    const stepper = getOrderStepperData(ord);

    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <div style="background:#ffffff;border:1.5px solid #000000;border-radius:0px;padding:16px;box-sizing:border-box;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <div>
            <div style="font-size:10.5px;font-weight:600;color:#555555;text-transform:uppercase;letter-spacing: 0.3px;">Order Tracking Snapshot</div>
            <div style="font-size:16px;font-weight:600;color:#000000;">#${ord.orderNumber || ord.orderId}</div>
          </div>
          <div style="text-align:right;">
            <span style="font-size:10px;font-weight:600;padding:3px 8px;border-radius:0px;border:1px solid #000000;background:${stepper.paymentBadgeBg};color:${stepper.paymentBadgeColor};text-transform:uppercase;letter-spacing:0.5px;">
              ${stepper.paymentBadgeText}
            </span>
          </div>
        </div>

        <!-- Status Stepper Bar -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin:14px 0;padding:10px 12px;background:#ffffff;border:1.5px solid #000000;border-radius:0px;font-size:11px;font-weight:600;text-align:center;">
          <div style="color:#16a34a;">
            <div>✓ 1. Placed</div>
          </div>
          <div style="color:${stepper.arrow1Color};">&rarr;</div>
          <div style="color:${stepper.step2Color};">
            <div>${stepper.step2Text}</div>
          </div>
          <div style="color:${stepper.arrow2Color};">&rarr;</div>
          <div>
            ${stepper.step3Html}
          </div>
          <div style="color:${stepper.arrow3Color};">&rarr;</div>
          <div>
            ${stepper.step4Html}
          </div>
        </div>

        <div style="font-size:12px;color:#222222;line-height:1.6;margin-bottom:12px;">
          <div><strong>Current Fulfillment Status:</strong> <span style="text-transform:uppercase;font-weight:600;color:#000000;">${(ord.status || 'pending').replace(/_/g, ' ')}</span></div>
          <div><strong>Delivery Destination:</strong> ${ord.shippingAddress ? `${ord.shippingAddress.city}, PIN ${ord.shippingAddress.postalCode}` : 'India'}</div>
          <div><strong>Payable Order Total:</strong> ${ord.pricing ? ord.pricing.finalPayableFormatted : ''}</div>
        </div>

        ${ord.fulfillment && ord.fulfillment.trackingNumber ? `
          <div style="background:#ffffff;border:1.5px solid #000000;border-radius:0px;padding:12px;margin-top:10px;">
            <div style="font-size:10.5px;font-weight:600;color:#166534;text-transform:uppercase;letter-spacing: 0.3px;margin-bottom:4px;">Dispatched via ${ord.fulfillment.courierName || 'DTDC'}</div>
            <div style="font-size:13px;font-weight:600;color:#000000;margin-bottom:8px;">AWB / Tracking #: <code>${ord.fulfillment.trackingNumber}</code></div>
            <a href="${ord.fulfillment.trackingUrl || `https://www.google.com/search?q=${encodeURIComponent((ord.fulfillment.courierName || '') + ' ' + ord.fulfillment.trackingNumber)}`}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#000000;color:#ffffff;padding:8px 14px;border:1.5px solid #000000;border-radius:0px;font-size:11.5px;font-weight:600;text-decoration:none;letter-spacing: 0.3px;text-transform:uppercase;">
              <span>LIVE COURIER TRACKING</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
        ` : `
          <div style="background:#ffffff;border:1.5px solid #000000;border-radius:0px;padding:10px 12px;font-size:12px;color:#000000;">
            Order is confirmed and being prepared for packaging at our Nagpur store. You will receive courier dispatch information via email as soon as it ships.
          </div>
        `}
      </div>
    `;
  }

  function renderCustomerOrders(orders) {
    const container = document.getElementById('lane4-account-orders');
    if (!container) return;

    if (!orders || orders.length === 0) {
      container.innerHTML = `
        <div style="padding:22px 14px;text-align:center;background:#ffffff;border:1.5px dashed #000000;border-radius:0px;">
          <div style="width:38px;height:38px;border-radius:0px;background:#000000;border:1.5px solid #000000;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;color:#ffffff;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          </div>
          <div style="font-size:14px;font-weight:600;color:#000000;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">No Orders Yet</div>
          <div style="font-size:12px;color:#555555;line-height:1.4;margin-bottom:14px;">You haven't placed any competitive swim orders yet. Discover our competition gear to elevate your training.</div>
          <a href="shop.html" onclick="document.getElementById('lane4-auth-modal-wrapper').style.display='none';" style="display:inline-flex;align-items:center;gap:6px;background:#000000;color:#ffffff;padding:10px 18px;border:1.5px solid #000000;border-radius:0px;font-size:11.5px;font-weight:600;text-decoration:none;letter-spacing: 0.3px;text-transform:uppercase;">
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
      const stepper = getOrderStepperData(ord);
      const itemCount = (ord.items || []).reduce((sum, it) => sum + (it.quantity || 1), 0);

      const canDownloadInvoice = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'].includes(ord.status) || ord.paymentStatus === 'verified';
      const firstItem = (ord.items && ord.items[0]) ? ord.items[0] : null;
      const itemsPreview = firstItem
        ? `${escapeHtml(firstItem.name || 'Lane4 Gear')}${ord.items.length > 1 ? ` + ${ord.items.length - 1} more` : ''}`
        : `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;

      const card = document.createElement('div');
      card.className = 'lane4-order-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('title', 'Click to view complete order items and billing breakdown');
      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span style="font-weight:700;font-size:15px;color:#0f172a;letter-spacing:-0.1px;">#${escapeHtml(orderRef)}</span>
              <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:0px;border:1px solid #cbd5e1;background:#f8fafc;color:#0f172a;text-transform:uppercase;letter-spacing:0.6px;">
                ${getOrderStatusBadge(ord.status)}
              </span>
              <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:0px;background:${stepper.paymentBadgeBg};color:${stepper.paymentBadgeColor};text-transform:uppercase;letter-spacing:0.6px;">
                ${stepper.paymentBadgeText}
              </span>
            </div>
            <div style="font-size:12.5px;font-weight:500;color:#334155;margin-top:6px;">${itemsPreview}</div>
            <div style="font-size:11.5px;color:#64748b;margin-top:2px;">
              ${itemCount} ${itemCount === 1 ? 'item' : 'items'} &bull; ${formatOrderTimestamp(ord.createdAt)}
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-size:16px;font-weight:700;color:#0f172a;font-variant-numeric:tabular-nums;">${totalText}</div>
          </div>
        </div>
        ${(stepper.isAwaitingProof || stepper.isPaymentRejected) ? `
          <div style="margin-top:10px;">
            <button type="button" class="lane4-upload-proof-action" onclick="event.stopPropagation(); window.showOrderDetailsWithProof('${ord.orderId || ord.id || orderRef}');" style="display:inline-flex;align-items:center;gap:6px;background:#0f172a;color:#ffffff;padding:7px 14px;border:1px solid #0f172a;border-radius:0px;font-size:10.5px;font-weight:600;cursor:pointer;text-transform:uppercase;letter-spacing:0.7px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Upload Payment Proof</span>
            </button>
          </div>
        ` : ''}
        ${ord.fulfillment && ord.fulfillment.trackingNumber ? `
          <div style="margin-top:10px;padding:7px 10px;background:#f8fafc;border-left:3px solid #0f172a;font-size:11.5px;color:#334155;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;">
            <span><strong>Courier:</strong> ${escapeHtml(ord.fulfillment.courierName || 'DTDC')}</span>
            <span><strong>AWB:</strong> <code style="background:#ffffff;border:1px solid #cbd5e1;padding:1px 6px;color:#0f172a;font-weight:600;">${escapeHtml(ord.fulfillment.trackingNumber)}</code></span>
          </div>
        ` : ''}
        <div class="lane4-order-actions-row">
          ${canDownloadInvoice ? `
            <button type="button" class="lane4-invoice-btn" style="flex:1;background:#ffffff;border:1px solid #0f172a;color:#0f172a;padding:9px 12px;border-radius:0px;font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;letter-spacing:0.5px;text-transform:uppercase;transition:all 0.15s ease;" onclick="event.stopPropagation(); window.downloadCustomerInvoice('${ord.orderId || ord.id}', '${ord.orderAccessToken || ''}')">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              <span>Tax Invoice (GST)</span>
            </button>
          ` : ''}
          <button type="button" class="lane4-view-details-action" style="flex:1;display:inline-flex;align-items:center;justify-content:center;gap:6px;background:#0f172a;color:#ffffff;padding:9px 14px;border:1px solid #0f172a;border-radius:0px;font-size:11px;font-weight:600;cursor:pointer;letter-spacing:0.5px;text-transform:uppercase;transition:all 0.15s ease;">
            <span>View Order Details</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
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
  }

  async function syncSwimmerRealtime() {
    const wrapper = document.getElementById('lane4-auth-modal-wrapper');
    if (!wrapper || wrapper.style.display === 'none') return;

    const detailsPanel = document.getElementById('lane4-order-details-panel');
    const accountPanel = document.getElementById('lane4-account-panel');
    const trackPanel = document.getElementById('lane4-track-panel');
    const trackResult = document.getElementById('lane4-order-track-result');

    // 1. If viewing single order details
    if (detailsPanel && detailsPanel.style.display !== 'none' && activeViewingOrderId) {
      try {
        const res = await window.lane4ApiRequest(`/orders/${encodeURIComponent(activeViewingOrderId)}`);
        if (res && res.data) {
          const updated = res.data;
          const prev = activeViewingOrderData || {};
          const changed =
            updated.status !== prev.status ||
            updated.orderStatus !== prev.orderStatus ||
            updated.paymentStatus !== prev.paymentStatus ||
            JSON.stringify(updated.fulfillment || {}) !== JSON.stringify(prev.fulfillment || {}) ||
            JSON.stringify(updated.refundDetails || {}) !== JSON.stringify(prev.refundDetails || {});

          if (changed) {
            activeViewingOrderData = updated;
            if (customerOrdersCache && Array.isArray(customerOrdersCache)) {
              const idx = customerOrdersCache.findIndex(o =>
                (o.orderNumber && o.orderNumber === updated.orderNumber) ||
                (o.orderId && o.orderId === updated.orderId) ||
                (o.id && o.id === updated.id)
              );
              if (idx !== -1) customerOrdersCache[idx] = updated;
            }
            showOrderDetails(updated, true);
          }
        }
      } catch (_) {}
    }
    // 2. If viewing account orders list
    else if (accountPanel && accountPanel.style.display !== 'none') {
      try {
        const res = await window.lane4ApiRequest('/orders/my-orders');
        if (res && res.data) {
          const newOrders = res.data;
          const prevDigest = (customerOrdersCache || []).map(o => `${o.orderNumber || o.orderId}_${o.status}_${o.paymentStatus}_${o.fulfillment && o.fulfillment.trackingNumber}`).join('|');
          const newDigest = newOrders.map(o => `${o.orderNumber || o.orderId}_${o.status}_${o.paymentStatus}_${o.fulfillment && o.fulfillment.trackingNumber}`).join('|');
          if (prevDigest !== newDigest) {
            customerOrdersCache = newOrders;
            renderCustomerOrders(newOrders);
          }
        }
      } catch (_) {}
    }
    // 3. If viewing order track result
    else if (trackPanel && trackPanel.style.display !== 'none' && trackResult && trackResult.style.display !== 'none' && lastTrackedQuery) {
      try {
        const res = await window.lane4ApiRequest('/orders/track', {
          method: 'POST',
          body: JSON.stringify(lastTrackedQuery)
        });
        if (res && res.data) {
          renderTrackResult(res.data);
        }
      } catch (_) {}
    }
  }

  function startSwimmerRealtimePolling() {
    if (swimmerRealtimeTimer) clearInterval(swimmerRealtimeTimer);
    syncSwimmerRealtime();
    swimmerRealtimeTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      syncSwimmerRealtime();
    }, 10000);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && swimmerRealtimeTimer) {
        syncSwimmerRealtime();
      }
    });
  }

  function stopSwimmerRealtimePolling() {
    if (swimmerRealtimeTimer) {
      clearInterval(swimmerRealtimeTimer);
      swimmerRealtimeTimer = null;
    }
  }

  if (orderSyncChannel) {
    orderSyncChannel.onmessage = function (event) {
      if (event && event.data && event.data.type === 'order_updated') {
        syncSwimmerRealtime();
      }
    };
  }
  window.addEventListener('storage', function (e) {
    if (e.key === 'lane4_order_updated') {
      syncSwimmerRealtime();
    }
  });

  function initSubtabs() {
    const subtabs = document.getElementById('lane4-acc-subtabs');
    if (!subtabs) return;
    subtabs.querySelectorAll('.lane4-acc-subtab-btn').forEach(btn => {
      btn.onclick = () => {
        subtabs.querySelectorAll('.lane4-acc-subtab-btn').forEach(b => {
          b.classList.remove('active');
        });
        btn.classList.add('active');

        const subtab = btn.getAttribute('data-subtab');
        document.getElementById('lane4-acc-tab-orders').style.display = subtab === 'orders' ? 'block' : 'none';
        document.getElementById('lane4-acc-tab-profile').style.display = subtab === 'profile' ? 'block' : 'none';
        document.getElementById('lane4-acc-tab-addresses').style.display = subtab === 'addresses' ? 'block' : 'none';
        hideAlert();

        if (subtab === 'orders') loadCustomerOrders();
        else if (subtab === 'profile') loadCustomerProfile();
        else if (subtab === 'addresses') loadCustomerAddresses();
      };
    });
  }

  async function loadCustomerProfile() {
    const user = window.LANE4.getUser();
    if (!user) return;
    const nameInput = document.getElementById('lane4-profile-name');
    const emailInput = document.getElementById('lane4-profile-email');
    const phoneInput = document.getElementById('lane4-profile-phone');

    if (emailInput) emailInput.value = user.email || '';
    if (nameInput) nameInput.value = user.displayName || '';
    if (phoneInput) phoneInput.value = user.phoneNumber || '';

    try {
      const res = await window.lane4ApiRequest('/customers/profile');
      if (res && res.data) {
        const prof = res.data;
        if (nameInput && prof.displayName) nameInput.value = prof.displayName;
        if (phoneInput && prof.phoneNumber) phoneInput.value = prof.phoneNumber;
      }
    } catch (_) {}
  }

  function normalizeAuthPhone(raw) {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
    return digits.slice(0, 10);
  }

  function initProfileForm() {
    const form = document.getElementById('lane4-profile-form');
    if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const displayName = document.getElementById('lane4-profile-name').value.trim();
      const phoneNumber = normalizeAuthPhone(document.getElementById('lane4-profile-phone').value.trim());

      if (!displayName) {
        showAlert('Please enter your full name.', 'error');
        return;
      }
      if (phoneNumber && !window.LANE4_VALIDATION.isValidIndianPhone(phoneNumber)) {
        showAlert('Please enter a valid 10-digit Indian phone number.', 'error');
        return;
      }

      const saveBtn = document.getElementById('lane4-profile-save-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'SAVING...';

      try {
        const res = await window.lane4ApiRequest('/customers/profile', {
          method: 'PATCH',
          body: JSON.stringify({ displayName, phoneNumber })
        });
        const updated = res.data || {};
        const curr = window.LANE4.getUser() || {};
        window.LANE4.setUser({ ...curr, displayName: updated.displayName || displayName, phoneNumber: updated.phoneNumber || phoneNumber });
        showAlert('Profile updated successfully!', 'success');
        document.getElementById('lane4-account-name').textContent = displayName;
      } catch (err) {
        showAlert(err.message || 'Failed to update profile.', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'SAVE PROFILE CHANGES';
      }
    };
  }

  async function loadCustomerAddresses() {
    const listEl = document.getElementById('lane4-addresses-list');
    if (!listEl) return;
    listEl.innerHTML = '<div style="font-size:12px;color:#64748b;padding:8px 0;">Loading addresses...</div>';

    // Populate state dropdown if empty
    const stateSelect = document.getElementById('lane4-addr-state');
    if (stateSelect && stateSelect.options.length <= 1) {
      window.INDIAN_STATES.forEach(st => {
        const opt = document.createElement('option');
        opt.value = st;
        opt.textContent = st;
        stateSelect.appendChild(opt);
      });
    }

    try {
      const res = await window.lane4ApiRequest('/customers/addresses');
      const addrs = (res && res.data) || [];
      if (addrs.length === 0) {
        listEl.innerHTML = `
          <div style="padding:14px;background:#ffffff;border:1.5px dashed #000000;border-radius:0px;font-size:12.5px;color:#555555;text-align:center;">
            No saved addresses found. Add a delivery address below for one-click checkout.
          </div>
        `;
        return;
      }

      listEl.innerHTML = addrs.map(a => `
        <div style="background:#ffffff;border:1.5px solid #000000;border-radius:0px;padding:12px;margin-bottom:8px;position:relative;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div style="font-size:13px;font-weight:600;color:#000000;letter-spacing:0.5px;text-transform:uppercase;">${a.addressee || 'Delivery Address'}</div>
            <button type="button" class="lane4-delete-addr-btn" data-id="${a.addressId || a.id}" style="background:#ffffff;border:1px solid #dc2626;color:#dc2626;border-radius:0px;font-size:10.5px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;cursor:pointer;padding:3px 8px;">Delete</button>
          </div>
          <div style="font-size:12px;color:#333333;margin-top:4px;line-height:1.4;">
            ${a.addressLine1}${a.addressLine2 ? ', ' + a.addressLine2 : ''}<br>
            ${a.city}, ${a.state} - PIN ${a.postalCode}
          </div>
          ${a.phone ? `<div style="font-size:11.5px;color:#555555;margin-top:3px;">Phone: ${a.phone}</div>` : ''}
        </div>
      `).join('');

      listEl.querySelectorAll('.lane4-delete-addr-btn').forEach(btn => {
        btn.onclick = async () => {
          const id = btn.getAttribute('data-id');
          if (!confirm('Are you sure you want to remove this delivery address?')) return;
          try {
            await window.lane4ApiRequest(`/customers/addresses/${encodeURIComponent(id)}`, { method: 'DELETE' });
            loadCustomerAddresses();
          } catch (err) {
            showAlert(err.message || 'Unable to delete address.', 'error');
          }
        };
      });
    } catch (err) {
      listEl.innerHTML = '<div style="font-size:12px;color:#ef4444;">Unable to load saved addresses.</div>';
    }
  }

  function initAddressForm() {
    const toggleBtn = document.getElementById('lane4-add-address-toggle');
    const newForm = document.getElementById('lane4-new-address-form');
    const cancelBtn = document.getElementById('lane4-cancel-addr-btn');
    if (!toggleBtn || !newForm) return;

    const pinInput = document.getElementById('lane4-addr-pin');
    if (pinInput) {
      pinInput.setAttribute('inputmode', 'numeric');
      pinInput.setAttribute('pattern', '[0-9]{6}');
      pinInput.addEventListener('keydown', (e) => {
        if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
        if ((e.ctrlKey || e.metaKey) && ['a', 'c', 'v', 'x'].includes(e.key.toLowerCase())) return;
        if (!/^[0-9]$/.test(e.key)) e.preventDefault();
      });
      pinInput.addEventListener('input', () => {
        pinInput.value = pinInput.value.replace(/\D/g, '').slice(0, 6);
      });
      pinInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text') || '';
        pinInput.value = text.replace(/\D/g, '').slice(0, 6);
      });
    }

    const phoneInput = document.getElementById('lane4-addr-phone');
    if (phoneInput) {
      phoneInput.setAttribute('inputmode', 'tel');
      phoneInput.setAttribute('maxlength', '16');
      phoneInput.addEventListener('input', () => {
        const cleanRaw = phoneInput.value.replace(/[^0-9+\-\s()]/g, '');
        if (phoneInput.value !== cleanRaw) phoneInput.value = cleanRaw;
        if (cleanRaw.replace(/\D/g, '').length > 10) {
          phoneInput.value = normalizeAuthPhone(cleanRaw);
        }
      });
      phoneInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text') || '';
        phoneInput.value = normalizeAuthPhone(text);
      });
      phoneInput.addEventListener('blur', () => {
        if (phoneInput.value) phoneInput.value = normalizeAuthPhone(phoneInput.value);
      });
    }

    toggleBtn.onclick = () => {
      newForm.style.display = newForm.style.display === 'none' ? 'block' : 'none';
      if (newForm.style.display === 'block') {
        const user = window.LANE4.getUser();
        if (user) {
          if (!document.getElementById('lane4-addr-name').value) document.getElementById('lane4-addr-name').value = user.displayName || '';
          if (!document.getElementById('lane4-addr-phone').value) document.getElementById('lane4-addr-phone').value = normalizeAuthPhone(user.phoneNumber || '');
        }
      }
    };

    if (cancelBtn) {
      cancelBtn.onclick = () => {
        newForm.style.display = 'none';
      };
    }

    newForm.onsubmit = async (e) => {
      e.preventDefault();
      const addressee = document.getElementById('lane4-addr-name').value.trim();
      const rawAddrPhone = document.getElementById('lane4-addr-phone').value.trim();
      const phone = normalizeAuthPhone(rawAddrPhone);
      const addressLine1 = document.getElementById('lane4-addr-line1').value.trim();
      const addressLine2 = document.getElementById('lane4-addr-line2').value.trim();
      const state = document.getElementById('lane4-addr-state').value;
      const city = document.getElementById('lane4-addr-city').value.trim();
      const postalCode = document.getElementById('lane4-addr-pin').value.trim();

      if (!addressee) {
        showAlert('Please enter addressee full name.', 'error');
        return;
      }
      if (!phone || !window.LANE4_VALIDATION.isValidIndianPhone(phone)) {
        showAlert('Please enter a valid 10-digit Indian phone number.', 'error');
        return;
      }
      if (!addressLine1) {
        showAlert('Please enter street address line 1.', 'error');
        return;
      }
      if (!state) {
        showAlert('Please select delivery state.', 'error');
        return;
      }
      if (!city) {
        showAlert('Please enter delivery city.', 'error');
        return;
      }
      if (!postalCode || !window.LANE4_VALIDATION.isValidPostalCode(postalCode) || /^(.)\1{5}$/.test(postalCode) || postalCode === '123456') {
        showAlert('Please provide a correct postal code.', 'error');
        return;
      }

      try {
        await window.lane4ApiRequest('/customers/addresses', {
          method: 'POST',
          body: JSON.stringify({
            addressee,
            phone,
            addressLine1,
            addressLine2,
            state,
            city,
            postalCode
          })
        });

        showAlert('Address saved successfully!', 'success');
        newForm.reset();
        newForm.style.display = 'none';
        loadCustomerAddresses();
      } catch (err) {
        showAlert(err.message || 'Unable to save address.', 'error');
      }
    };
  }

  async function loadCustomerOrders() {
    const container = document.getElementById('lane4-account-orders');
    if (!container) return;
    try {
      const res = await window.lane4ApiRequest('/orders/my-orders');
      const orders = (res && res.data) || [];
      customerOrdersCache = orders;
      renderCustomerOrders(orders);
    } catch (err) {
      container.innerHTML = `
        <div style="padding:20px 14px;text-align:center;background:#ffffff;border:1.5px dashed #000000;border-radius:0px;">
          <div style="font-size:13.5px;font-weight:600;color:#000000;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;">No Recent Orders Found</div>
          <div style="font-size:12px;color:#555555;line-height:1.4;margin-bottom:12px;">You haven't placed any orders with this swimmer account yet.</div>
          <a href="shop.html" onclick="document.getElementById('lane4-auth-modal-wrapper').style.display='none';" style="display:inline-flex;align-items:center;gap:6px;background:#000000;color:#ffffff;padding:8px 14px;border:1.5px solid #000000;border-radius:0px;font-size:11px;font-weight:600;text-decoration:none;letter-spacing: 0.3px;text-transform:uppercase;">
            <span>EXPLORE SHOP</span>
          </a>
        </div>
      `;
    }
  }

  // --- CUSTOMER PAYMENT PROOF DIRECT SHORTCUT ---
  window.showOrderDetailsWithProof = function (orderRef) {
    if (!orderRef) return;
    const matched = (customerOrdersCache || []).find(o => (o.orderNumber === orderRef || o.orderId === orderRef || o.id === orderRef));
    if (matched) {
      showOrderDetails(matched);
      setTimeout(() => {
        const uploadBox = document.getElementById('lane4-proof-upload-container');
        if (uploadBox) {
          uploadBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const utrField = document.getElementById('lane4-resubmit-utr');
          if (utrField) utrField.focus();
        }
      }, 150);
    }
  };

  // --- CUSTOMER GST TAX INVOICE VIEWER ---
  window.downloadCustomerInvoice = async function (orderId, orderAccessToken) {
    if (!orderId) return;
    try {
      let url = `/orders/${encodeURIComponent(orderId)}/invoice`;
      if (orderAccessToken) {
        url += `?token=${encodeURIComponent(orderAccessToken)}`;
      }
      const token = localStorage.getItem('lane4_customer_token');
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (orderAccessToken) headers['x-order-token'] = orderAccessToken;

      const res = await window.lane4ApiRequest(url, { headers });
      if (!res || !res.data) {
        throw new Error((res && res.message) || 'Unable to retrieve tax invoice.');
      }
      renderCustomerInvoiceModal(res.data);
    } catch (err) {
      showAlert(`Could not load tax invoice: ${err.message || 'Invoice unavailable'}`, 'error');
    }
  };

  function renderCustomerInvoiceModal(inv) {
    window.currentCustomerInvoice = inv;
    const invoicePanel = document.getElementById('lane4-invoice-panel');
    const invoiceContent = document.getElementById('lane4-invoice-content');
    if (!invoicePanel || !invoiceContent) return;

    // Hide other panels
    const detailsPanel = document.getElementById('lane4-order-details-panel');
    if (detailsPanel) detailsPanel.style.display = 'none';
    const accPanel = document.getElementById('lane4-account-panel');
    if (accPanel) accPanel.style.display = 'none';
    const returnPanel = document.getElementById('lane4-return-panel');
    if (returnPanel) returnPanel.style.display = 'none';
    const tabs = document.getElementById('lane4-auth-tabs');
    if (tabs) tabs.style.display = 'none';

    setAuthModalSize('invoice');
    invoicePanel.style.display = 'block';

    const isInterState = inv.placeOfSupply && inv.placeOfSupply.taxType && inv.placeOfSupply.taxType.includes('INTER_STATE');
    const isProvisional = !inv.seller.isCertifiedGstin || inv.isProvisionalDraft || !inv.seller.gstin;
    const itemsHtml = (inv.items || []).map((it, idx) => {
      const hsnVal = it.hsn || it.hsnCode || '9506';
      const variantText = it.variantLabel || it.variantName || '';
      const lineTaxable = it.taxableAmountFormatted || '0.00';
      const cgstVal = it.cgstAmountFormatted || it.cgstFormatted || '0.00';
      const sgstVal = it.sgstAmountFormatted || it.sgstFormatted || '0.00';
      const igstVal = it.igstAmountFormatted || it.igstFormatted || '0.00';
      const lineTotal = it.effectiveLineTotalFormatted || it.lineTotalFormatted || it.totalFormatted || '0.00';
      return `
      <tr style="border-bottom:1px solid #e2e8f0;font-size:11.5px;">
        <td style="padding:7px 5px;text-align:center;">${idx + 1}</td>
        <td style="padding:7px 5px;">
          <strong>${escapeHtml(it.description || it.name || 'Item')}</strong>
          ${variantText ? `<div style="font-size:10px;color:#64748b;">${escapeHtml(variantText)}</div>` : ''}
        </td>
        <td style="padding:7px 5px;text-align:center;"><code>${escapeHtml(hsnVal)}</code></td>
        <td style="padding:7px 5px;text-align:center;">${it.quantity || 1}</td>
        <td style="padding:7px 5px;text-align:right;font-variant-numeric:tabular-nums;">₹${lineTaxable}</td>
        ${!isInterState ? `
          <td style="padding:7px 5px;text-align:right;font-variant-numeric:tabular-nums;">₹${cgstVal}</td>
          <td style="padding:7px 5px;text-align:right;font-variant-numeric:tabular-nums;">₹${sgstVal}</td>
        ` : `
          <td style="padding:7px 5px;text-align:right;font-variant-numeric:tabular-nums;" colspan="2">₹${igstVal}</td>
        `}
        <td style="padding:7px 5px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;">₹${lineTotal}</td>
      </tr>
    `;
    }).join('');

    const ship = inv.shipping || {};
    const shipGross = Number(ship.chargesPaise || ship.grossAmountPaise || ship.taxableAmountPaise || 0);
    const shippingRow = shipGross > 0 ? `
      <tr style="border-bottom:1px solid #e2e8f0;font-size:11.5px;background:#f8fafc;">
        <td style="padding:7px 5px;text-align:center;">—</td>
        <td style="padding:7px 5px;">
          <strong>Express Doorstep Delivery</strong>
          <div style="font-size:10px;color:#64748b;">SAC ${escapeHtml(ship.sacCode || '9968')}</div>
        </td>
        <td style="padding:7px 5px;text-align:center;"><code>${escapeHtml(ship.sacCode || '9968')}</code></td>
        <td style="padding:7px 5px;text-align:center;">1</td>
        <td style="padding:7px 5px;text-align:right;font-variant-numeric:tabular-nums;">₹${ship.taxableFormatted || ship.taxableAmountFormatted || '0.00'}</td>
        ${!isInterState ? `
          <td style="padding:7px 5px;text-align:right;font-variant-numeric:tabular-nums;">₹${ship.cgstFormatted || ((ship.cgstPaise || 0) / 100).toFixed(2)}</td>
          <td style="padding:7px 5px;text-align:right;font-variant-numeric:tabular-nums;">₹${ship.sgstFormatted || ((ship.sgstPaise || 0) / 100).toFixed(2)}</td>
        ` : `
          <td style="padding:7px 5px;text-align:right;font-variant-numeric:tabular-nums;" colspan="2">₹${ship.igstFormatted || ((ship.igstPaise || 0) / 100).toFixed(2)}</td>
        `}
        <td style="padding:7px 5px;text-align:right;font-weight:700;font-variant-numeric:tabular-nums;">₹${ship.chargesFormatted || ship.totalFormatted || (shipGross / 100).toFixed(2)}</td>
      </tr>
    ` : '';

    invoiceContent.innerHTML = `
      <div style="background:#ffffff;border:1.5px solid #000000;border-radius:0px;padding:18px;color:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;">
        ${isProvisional ? `
          <div style="background:#fffbeb;border:1.5px solid #000000;border-radius:0px;padding:8px 12px;margin-bottom:12px;display:flex;align-items:flex-start;gap:8px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5" style="flex-shrink:0;margin-top:1px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div>
              <div style="font-size:11.5px;font-weight:600;color:#92400e;letter-spacing:0.5px;">PROVISIONAL ORDER ESTIMATE — OFFICIAL TAX INVOICE PENDING GST REGISTRATION</div>
              <div style="font-size:10.5px;color:#b45309;margin-top:2px;">Store GSTIN registration is pending client confirmation. This document serves as an operational order receipt.</div>
            </div>
          </div>
        ` : ''}
        <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #000000;padding-bottom:12px;margin-bottom:12px;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:16px;font-weight:600;color:#000000;letter-spacing: 0.3px;text-transform:uppercase;">${escapeHtml(inv.seller.legalName || 'The Lane4 Performance Store')}</div>
            <div style="font-size:11px;color:#555555;margin-top:2px;">${escapeHtml(typeof inv.seller.address === 'string' ? inv.seller.address : ((inv.seller.address && inv.seller.address.street) || 'Nagpur, Maharashtra, India'))}</div>
            <div style="font-size:11px;color:#555555;">
              <strong>GSTIN:</strong> ${inv.seller.gstin && inv.seller.isCertifiedGstin ? `<code>${escapeHtml(inv.seller.gstin)}</code>` : `<span style="color:#b45309;font-weight:600;">Pending Registration</span>`}
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:13px;font-weight:600;color:${isProvisional ? '#d97706' : '#000000'};letter-spacing: 0.3px;text-transform:uppercase;">${isProvisional ? 'ORDER ESTIMATE' : 'TAX INVOICE'}</div>
            <div style="font-size:12px;font-weight:600;color:#000000;">${escapeHtml(inv.invoiceNumber)}</div>
            <div style="font-size:11px;color:#555555;">Date: ${escapeHtml(inv.invoiceDateFormatted || new Date(inv.invoiceDate).toLocaleDateString('en-IN'))}</div>
            <div style="font-size:11px;color:#555555;">Order Ref: <strong>#${escapeHtml(inv.orderNumber || inv.orderId)}</strong></div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;background:#ffffff;padding:10px;border-radius:0px;border:1.5px solid #000000;margin-bottom:12px;font-size:11.5px;flex-wrap:wrap;gap:10px;">
          <div>
            <div style="font-size:10px;font-weight:600;color:#555555;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:2px;">Billed &amp; Shipped To:</div>
            <div style="font-weight:600;color:#000000;">${escapeHtml(inv.buyer.name || 'Customer')}</div>
            <div>${escapeHtml(inv.buyer.addressLine1 || (inv.buyer.address ? inv.buyer.address.street : ''))}</div>
            <div>${escapeHtml(inv.buyer.city || '')}${inv.buyer.state ? `, ${escapeHtml(inv.buyer.state)}` : ''} ${inv.buyer.postalCode ? `PIN ${escapeHtml(inv.buyer.postalCode)}` : ''}</div>
            <div>Phone: ${escapeHtml(inv.buyer.phone || '—')}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;font-weight:600;color:#555555;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:2px;">Place of Supply:</div>
            <div style="font-weight:600;color:#000000;">${escapeHtml(inv.placeOfSupply.state)} (${escapeHtml(inv.placeOfSupply.stateCode)})</div>
            <div style="font-size:10.5px;color:#000000;font-weight:600;">${escapeHtml(inv.placeOfSupply.taxType)}</div>
            <div style="font-size:10.5px;color:#16a34a;font-weight:600;margin-top:2px;">Payment: ${(inv.paymentStatus || 'paid').toUpperCase()}</div>
          </div>
        </div>

        <div style="overflow-x:auto;margin-bottom:12px;">
          <table style="width:100%;border-collapse:collapse;border:1.5px solid #000000;">
            <thead>
              <tr style="background:#000000;color:#ffffff;font-size:10.5px;text-transform:uppercase;letter-spacing:0.8px;">
                <th style="padding:6px 4px;text-align:center;">#</th>
                <th style="padding:6px 4px;text-align:left;">Item Description</th>
                <th style="padding:6px 4px;text-align:center;">HSN</th>
                <th style="padding:6px 4px;text-align:center;">Qty</th>
                <th style="padding:6px 4px;text-align:right;">Taxable Val</th>
                ${!isInterState ? `
                  <th style="padding:6px 4px;text-align:right;">CGST</th>
                  <th style="padding:6px 4px;text-align:right;">SGST</th>
                ` : `
                  <th style="padding:6px 4px;text-align:right;" colspan="2">IGST</th>
                `}
                <th style="padding:6px 4px;text-align:right;">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
              ${shippingRow}
            </tbody>
          </table>
        </div>

        <div style="display:flex;justify-content:flex-end;margin-bottom:12px;">
          <div style="width:260px;background:#ffffff;border:1.5px solid #000000;border-radius:0px;padding:8px 12px;font-size:11.5px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
              <span>Total Taxable Amount:</span>
              <span style="font-weight:600;color:#000000;">₹${inv.summary.totalTaxableFormatted}</span>
            </div>
            ${!isInterState ? `
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;color:#555555;">
                <span>Total CGST:</span>
                <span>₹${inv.summary.totalCgstFormatted}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;color:#555555;">
                <span>Total SGST:</span>
                <span>₹${inv.summary.totalSgstFormatted}</span>
              </div>
            ` : `
              <div style="display:flex;justify-content:space-between;margin-bottom:3px;color:#555555;">
                <span>Total IGST:</span>
                <span>₹${inv.summary.totalIgstFormatted}</span>
              </div>
            `}
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;color:#000000;font-weight:600;">
              <span>Total Tax:</span>
              <span>₹${inv.summary.totalTaxFormatted}</span>
            </div>
            <div style="border-top:1.5px solid #000000;padding-top:4px;display:flex;justify-content:space-between;font-size:13px;font-weight:600;color:#000000;">
              <span>Grand Total:</span>
              <span>₹${inv.summary.grandTotalFormatted}</span>
            </div>
          </div>
        </div>

        <div style="background:#f1f5f9;border-left:3px solid ${isProvisional ? '#d97706' : '#0284c7'};padding:6px 8px;font-size:10px;color:#64748b;">
          <div><strong>Digital Integrity Seal:</strong> <code>${(inv.integrity && inv.integrity.fingerprint) ? inv.integrity.fingerprint.slice(0, 32) + '...' : (inv.sha256Fingerprint ? inv.sha256Fingerprint.slice(0, 32) + '...' : 'AUTHENTIC_VERIFIED')}</code></div>
          ${!isProvisional ? `
            <div>Computer-generated tax invoice issued in compliance with the Central Goods and Services Tax (CGST) Act, 2017.</div>
          ` : `
            <div style="color:#b45309;font-weight:600;margin-top:2px;">Provisional operational estimate. Official tax invoice issuance requires certified GST registration.</div>
          `}
        </div>
      </div>
    `;
  }

  function closeAuthModal() {
    stopSwimmerRealtimePolling();
    const wrapper = document.getElementById('lane4-auth-modal-wrapper');
    if (wrapper) {
      wrapper.style.display = 'none';
      // Reset password visibility on close
      wrapper.querySelectorAll('.lane4-auth-password-wrap').forEach(wrap => {
        const input = wrap.querySelector('input');
        const showIcon = wrap.querySelector('.eye-show');
        const hideIcon = wrap.querySelector('.eye-hide');
        const btn = wrap.querySelector('.lane4-auth-pass-toggle');
        if (input) input.type = 'password';
        if (showIcon) showIcon.style.display = 'block';
        if (hideIcon) hideIcon.style.display = 'none';
        if (btn) {
          btn.setAttribute('aria-label', 'Show password');
          btn.setAttribute('title', 'Show password');
        }
      });
    }
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

  // Global capturing listener to ensure clicking account/swimmer links always opens account profile or login
  document.addEventListener('click', function (e) {
    const authTarget = e.target.closest(
      '.cart-inner a, .info-bar-button, .info-bar-button-wrapper a, [data-lane4-auth], .lane4-account-trigger, a[href="#account"], a[href="#profile"], a[href="#login"]'
    );
    if (!authTarget) return;

    // Do not interfere if user is clicking inside the auth modal itself
    if (e.target.closest('#lane4-auth-modal-wrapper')) return;

    const text = (authTarget.textContent || '').trim().toUpperCase();
    const isExplicit = authTarget.matches('.cart-inner a, .info-bar-button, .info-bar-button-wrapper a, [data-lane4-auth], .lane4-account-trigger, a[href="#account"], a[href="#profile"], a[href="#login"]');
    if (isExplicit || text.includes('SIGN') || text.includes('ACCOUNT') || text.startsWith('HI,')) {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      const curr = (window.LANE4 && window.LANE4.getUser) ? window.LANE4.getUser() : null;
      openAuthModal(curr ? 'account' : 'login');
    }
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthUI);
  } else {
    initAuthUI();
  }
  window.addEventListener('lane4:auth-changed', initAuthUI);
})();
