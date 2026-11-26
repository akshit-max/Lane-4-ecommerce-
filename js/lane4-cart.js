/**
 * LANE4 E-Commerce Shopping Cart Drawer Controller
 * Replaces Webflow's legacy unorganized cart with a high-performance slide-out athletic cart drawer.
 */

(function () {
  const FREE_SHIPPING_THRESHOLD_PAISE = 199900; // ₹1,999.00
  let activeCart = { items: [], subtotalPaise: 0, totalItemsCount: 0 };

  function showStorefrontToast(message, type = 'error') {
    if (!message) return;
    let toast = document.getElementById('lane4-store-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lane4-store-toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 2147483647;
        max-width: 380px;
        padding: 13px 18px;
        border-radius: 0px;
        font-family: 'Generalsans', 'General Sans', sans-serif;
        font-size: 13px;
        font-weight: 400;
        letter-spacing: 0.2px;
        box-shadow: 0 12px 30px rgba(0,0,0,0.18);
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        transform: translateY(30px);
        opacity: 0;
        pointer-events: none;
        -webkit-font-smoothing: antialiased;
      `;
      document.body.appendChild(toast);
    }

    const isErr = type === 'error';
    toast.style.background = '#000000';
    toast.style.color = '#ffffff';
    toast.style.border = isErr ? '1px solid #dc2626' : '1px solid #000000';
    toast.innerHTML = `
      <span style="display:inline-block;width:6px;height:6px;border-radius:0px;background:${isErr ? '#ef4444' : '#22c55e'};flex-shrink:0;"></span>
      <span style="flex:1;line-height:1.4;">${message}</span>
    `;

    toast.style.pointerEvents = 'auto';
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      toast.style.pointerEvents = 'none';
    }, 4500);
  }
  window.showStorefrontToast = showStorefrontToast;

  // Ensure legacy Webflow cart elements never display or break layout
  try {
    const styleEl = document.createElement('style');
    styleEl.id = 'lane4-cart-system-styles';
    styleEl.textContent = `
      /* Completely suppress Webflow default buggy cart wrappers */
      .w-commerce-commercecartcontainerwrapper,
      [data-node-type="commerce-cart-container-wrapper"],
      .w-commerce-commercecarterrorstate,
      [data-node-type="commerce-cart-error"] {
        display: none !important;
      }

      /* LANE4 Slide-out Cart Drawer Styles (Swiss Architectural Theme) */
      #lane4-cart-drawer-root {
        position: fixed;
        inset: 0;
        z-index: 99999990;
        pointer-events: none;
        visibility: hidden;
        transition: visibility 0.25s ease;
        font-family: 'Generalsans', 'General Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      #lane4-cart-drawer-root,
      #lane4-cart-drawer-root * {
        font-family: 'Generalsans', 'General Sans', sans-serif !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        box-sizing: border-box;
      }
      #lane4-cart-drawer-root.open {
        pointer-events: auto;
        visibility: visible;
      }
      #lane4-cart-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.42);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        opacity: 0;
        transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      }
      #lane4-cart-drawer-root.open #lane4-cart-backdrop {
        opacity: 1;
      }
      #lane4-cart-panel {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        width: 440px;
        max-width: 92vw;
        background: #ffffff;
        border-left: 1px solid rgba(0, 0, 0, 0.08);
        box-shadow: -15px 0 45px rgba(0, 0, 0, 0.16);
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 2;
        box-sizing: border-box;
      }
      #lane4-cart-drawer-root.open #lane4-cart-panel {
        transform: translateX(0);
      }
      .lane4-cart-header {
        padding: 22px 28px;
        border-bottom: 1px solid #f0f0f0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #ffffff;
      }
      .lane4-cart-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .lane4-cart-heading {
        font-size: 14px;
        font-weight: 500;
        letter-spacing: 1.5px;
        color: #111111;
        margin: 0;
        text-transform: uppercase;
      }
      .lane4-cart-badge-count {
        background: #111111;
        color: #ffffff;
        font-size: 11px;
        font-weight: 500;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        border-radius: 0px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .lane4-cart-close-btn {
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
      .lane4-cart-close-btn:hover {
        background: #000000;
        border-color: #000000;
        color: #ffffff;
        transform: scale(1.05);
      }
      .lane4-shipping-banner {
        background: #fafafa;
        border-bottom: 1px solid #eeeeee;
        padding: 12px 28px;
      }
      .lane4-shipping-bar-track {
        height: 2px;
        background: #e5e5e5;
        border-radius: 0px;
        overflow: hidden;
        margin-top: 8px;
      }
      .lane4-shipping-bar-fill {
        height: 100%;
        background: #111111;
        transition: width 0.3s ease;
        border-radius: 0px;
      }
      .lane4-cart-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 28px;
      }
      .lane4-cart-empty {
        text-align: center;
        padding: 70px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .lane4-empty-icon-wrap {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: #fafafa;
        border: 1px solid #eeeeee;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 20px;
        color: #777777;
      }
      .lane4-cart-item-row {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 18px 0;
        border-bottom: 1px solid #eeeeee;
      }
      .lane4-cart-item-img {
        width: 72px;
        height: 72px;
        object-fit: cover;
        border-radius: 0px;
        background: #fafafa;
        border: 1px solid #eeeeee;
        flex-shrink: 0;
      }
      .lane4-cart-item-details {
        flex: 1;
        min-width: 0;
      }
      .lane4-cart-item-title {
        font-weight: 500;
        font-size: 13.5px;
        color: #111111;
        text-decoration: none;
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
        transition: color 0.15s ease;
      }
      .lane4-cart-item-title:hover {
        color: #444444;
      }
      .lane4-cart-item-variant {
        font-size: 12px;
        color: #777777;
        font-weight: 400;
        margin-top: 3px;
      }
      .lane4-cart-item-price {
        font-size: 13.5px;
        font-weight: 600;
        color: #111111;
        margin-top: 4px;
      }
      .lane4-cart-qty-ctrl {
        display: inline-flex;
        align-items: center;
        border: 1px solid #dcdcdc;
        border-radius: 0px;
        overflow: hidden;
        margin-top: 8px;
        background: #ffffff;
      }
      .lane4-qty-btn {
        background: #ffffff;
        border: none;
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #444444;
        font-weight: 400;
        font-size: 13px;
        transition: background 0.15s, color 0.15s;
      }
      .lane4-qty-btn:hover {
        background: #f5f5f5;
        color: #000000;
      }
      .lane4-qty-val {
        padding: 0 10px;
        font-size: 12.5px;
        font-weight: 500;
        color: #111111;
        min-width: 18px;
        text-align: center;
      }
      .lane4-item-del-btn {
        background: none;
        border: none;
        color: #888888;
        cursor: pointer;
        padding: 4px;
        border-radius: 0px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s;
        margin-left: 6px;
      }
      .lane4-item-del-btn:hover {
        color: #000000;
      }
      .lane4-cart-footer {
        padding: 22px 28px;
        border-top: 1px solid #eeeeee;
        background: #ffffff;
      }
      .lane4-subtotal-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .lane4-subtotal-label {
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #777777;
      }
      .lane4-subtotal-val {
        font-size: 18px;
        font-weight: 600;
        color: #111111;
        letter-spacing: -0.2px;
      }
      .lane4-cart-checkout-btn {
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
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-decoration: none;
        transition: background 0.18s ease;
      }
      .lane4-cart-checkout-btn:hover {
        background: #222222;
      }
      .lane4-cart-checkout-btn span {
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 1px;
        line-height: 20px;
        text-transform: uppercase;
      }
      .lane4-cart-checkout-btn svg {
        transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      }
      .lane4-cart-checkout-btn:hover svg {
        transform: translateX(3px);
      }
      .lane4-continue-shopping-link {
        display: block;
        text-align: center;
        margin-top: 12px;
        font-size: 12px;
        font-weight: 400;
        color: #777777;
        text-decoration: underline;
        cursor: pointer;
        transition: color 0.15s;
      }
      .lane4-continue-shopping-link:hover {
        color: #000000;
      }
    `;
    document.head.appendChild(styleEl);
  } catch (e) {}

  // Suppress legacy Apollo ecommerce background errors from console
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason) {
      const msg = (event.reason.message || String(event.reason)).toLowerCase();
      if (
        msg.includes('server returned results with length') ||
        msg.includes('network error') ||
        event.reason.name === 'ApolloError' ||
        event.reason.graphQLErrors
      ) {
        event.preventDefault();
      }
    }
  });

  window.addEventListener('error', (event) => {
    if (event && event.message) {
      const msg = String(event.message).toLowerCase();
      if (
        msg.includes('server returned results with length') ||
        msg.includes('network error')
      ) {
        event.preventDefault();
      }
    }
  });

  function createCartDrawerDOM() {
    if (document.getElementById('lane4-cart-drawer-root')) return;

    const drawer = document.createElement('div');
    drawer.id = 'lane4-cart-drawer-root';
    drawer.innerHTML = `
      <div id="lane4-cart-backdrop"></div>
      <aside id="lane4-cart-panel" aria-label="Shopping Cart">
        <!-- Header -->
        <div class="lane4-cart-header">
          <div class="lane4-cart-title-row">
            <h3 class="lane4-cart-heading">Your Cart</h3>
            <span id="lane4-cart-badge" class="lane4-cart-badge-count">0</span>
          </div>
          <button id="lane4-cart-close" class="lane4-cart-close-btn" aria-label="Close cart">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Free Shipping Progress Tracker -->
        <div id="lane4-free-shipping-section" class="lane4-shipping-banner">
          <div id="lane4-shipping-msg" style="font-size:12px;font-weight:400;color:#555555;"></div>
          <div class="lane4-shipping-bar-track">
            <div id="lane4-shipping-bar" class="lane4-shipping-bar-fill" style="width:0%;"></div>
          </div>
        </div>

        <!-- Inline Cart Alert -->
        <div id="lane4-cart-inline-err" role="alert" style="display:none;background:#fef2f2;color:#991b1b;border-bottom:1px solid #fecaca;padding:10px 24px;font-size:12.5px;font-weight:500;line-height:1.45;"></div>

        <!-- Cart Body (Scrollable items / Empty state) -->
        <div id="lane4-cart-body" class="lane4-cart-body"></div>

        <!-- Cart Footer -->
        <div id="lane4-cart-footer" class="lane4-cart-footer" style="display:none;">
          <div class="lane4-subtotal-row">
            <span class="lane4-subtotal-label">Subtotal</span>
            <span id="lane4-cart-subtotal-text" class="lane4-subtotal-val">₹0.00</span>
          </div>
          <div style="font-size:11.5px;color:#888888;line-height:1.4;margin-top:4px;">
            PAN India Express delivery • Taxes calculated at checkout
          </div>
          <a id="lane4-go-checkout-btn" class="lane4-cart-checkout-btn" href="checkout.html">
            <span>PROCEED TO CHECKOUT</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </a>
          <a id="lane4-keep-shopping-link" class="lane4-continue-shopping-link">Continue Shopping</a>
        </div>
      </aside>
    `;
    document.body.appendChild(drawer);

    // Event listeners
    document.getElementById('lane4-cart-backdrop').onclick = closeCartDrawer;
    document.getElementById('lane4-cart-close').onclick = closeCartDrawer;
    document.getElementById('lane4-keep-shopping-link').onclick = closeCartDrawer;

    // Checkout button link router
    document.getElementById('lane4-go-checkout-btn').onclick = (e) => {
      e.preventDefault();
      if (!activeCart || !activeCart.totalItemsCount || activeCart.totalItemsCount === 0) {
        showStorefrontToast('Your cart is empty! Please select swimming products before checking out.', 'info');
        return;
      }
      const user = window.LANE4.getUser();
      if (!user || !user.uid) {
        closeCartDrawer();
        if (window.LANE4_AUTH && window.LANE4_AUTH.open) {
          window.LANE4_AUTH.open('login');
          if (window.LANE4_AUTH.showAlert) {
            window.LANE4_AUTH.showAlert('Please sign in or create an account to proceed to checkout.', 'info');
          }
        } else {
          showStorefrontToast('Please sign in or create an account to proceed to checkout.', 'info');
        }
        return;
      }
      const isInSubfolder = /\/(product|category|blog|authors|utility-pages|category-blog)\//i.test(window.location.pathname);
      window.location.href = window.location.protocol !== 'file:' ? '/checkout.html' : (isInSubfolder ? '../checkout.html' : 'checkout.html');
    };

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeCartDrawer();
    });
  }

  async function refreshCart() {
    try {
      const guestId = window.LANE4.getGuestId();
      const res = await window.lane4ApiRequest(`/cart?guestId=${encodeURIComponent(guestId)}`);
      activeCart = res.data || { items: [], subtotalPaise: 0, totalItemsCount: 0 };
      updateCartBadge();
      renderCartDrawer();
    } catch (err) {
      console.warn('Could not refresh cart:', err);
    }
  }

  function updateCartBadge() {
    const totalCount = activeCart.totalItemsCount || 0;
    const badgeEl = document.getElementById('lane4-cart-badge');
    if (badgeEl) badgeEl.textContent = totalCount;

    // Update all navbar cart counters
    const badges = document.querySelectorAll('.cart-quantity, .w-commerce-commercecartopenlinkcount');
    badges.forEach(b => {
      b.textContent = totalCount;
    });
  }

  function renderCartDrawer() {
    createCartDrawerDOM();

    const bodyEl = document.getElementById('lane4-cart-body');
    const inlineErrEl = document.getElementById('lane4-cart-inline-err');
    function showCartDrawerError(msg) {
      if (inlineErrEl) {
        if (msg) {
          inlineErrEl.textContent = msg;
          inlineErrEl.style.display = 'block';
          clearTimeout(inlineErrEl._timer);
          inlineErrEl._timer = setTimeout(() => { inlineErrEl.style.display = 'none'; }, 5000);
        } else {
          inlineErrEl.style.display = 'none';
        }
      }
      if (msg) showStorefrontToast(msg, 'error');
    }
    if (inlineErrEl) inlineErrEl.style.display = 'none';
    const footerEl = document.getElementById('lane4-cart-footer');
    const shippingSec = document.getElementById('lane4-free-shipping-section');
    const shippingMsg = document.getElementById('lane4-shipping-msg');
    const shippingBar = document.getElementById('lane4-shipping-bar');
    const subtotalText = document.getElementById('lane4-cart-subtotal-text');

    if (!bodyEl) return;

    // Free shipping progress calculation
    const subtotal = activeCart.subtotalPaise || 0;
    if (subtotal >= FREE_SHIPPING_THRESHOLD_PAISE) {
      shippingMsg.innerHTML = '<span style="color:#111111;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>You unlocked <strong>FREE PAN India Express Delivery!</strong></span>';
      shippingBar.style.width = '100%';
      shippingBar.style.background = '#111111';
    } else {
      const remainingPaise = FREE_SHIPPING_THRESHOLD_PAISE - subtotal;
      shippingMsg.innerHTML = `<span style="font-size:12px;font-weight:400;color:#555555;">Add <strong>${window.LANE4.formatINR(remainingPaise)}</strong> more to get <strong>FREE Delivery</strong></span>`;
      const pct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD_PAISE) * 100));
      shippingBar.style.width = `${pct}%`;
      shippingBar.style.background = '#111111';
    }

    // EMPTY CART STATE
    if (!activeCart.items || activeCart.items.length === 0) {
      footerEl.style.display = 'none';
      shippingSec.style.display = 'none';
      const isInSubfolder = /\/(product|category|blog|authors|utility-pages|category-blog)\//i.test(window.location.pathname);
      const shopUrl = window.location.protocol !== 'file:' ? '/shop.html' : (isInSubfolder ? '../shop.html' : 'shop.html');

      bodyEl.innerHTML = `
        <div class="lane4-cart-empty">
          <div class="lane4-empty-icon-wrap">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="21" r="1"></circle>
              <circle cx="19" cy="21" r="1"></circle>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
            </svg>
          </div>
          <h4 style="font-size:16px;font-weight:500;color:#111111;letter-spacing:0.2px;margin:0 0 8px 0;">Your Cart is Empty</h4>
          <p style="font-size:13px;font-weight:400;color:#777777;line-height:1.5;margin:0 0 24px 0;max-width:260px;">
            Explore our competitive swim gear, racing caps, and goggles to gear up.
          </p>
          <a href="${shopUrl}" class="lane4-cart-checkout-btn" style="max-width:220px;text-decoration:none;margin-top:0;">
            <span>START SHOPPING</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
          </a>
        </div>
      `;
      return;
    }

    // CART WITH ITEMS
    shippingSec.style.display = 'block';
    footerEl.style.display = 'block';
    subtotalText.textContent = window.LANE4.formatINR(activeCart.subtotalPaise);

    const isInSubfolder = /\/(product|category|blog|authors|utility-pages|category-blog)\//i.test(window.location.pathname);
    const productBase = isInSubfolder ? '../product/' : 'product/';

    const escapeHtml = window.escapeHtml || function(s) {
      if (s === null || s === undefined) return '';
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    };

    bodyEl.innerHTML = activeCart.items.map(item => {
      const imgUrl = window.LANE4.resolveAssetUrl ? window.LANE4.resolveAssetUrl(item.imageUrl) : (item.imageUrl || '');
      const productLink = item.slug ? `${productBase}${item.slug}.html` : '#';

      return `
        <div class="lane4-cart-item-row" data-row-id="${item.itemId}">
          <a href="${productLink}">
            <img src="${imgUrl}" alt="${escapeHtml(item.name)}" class="lane4-cart-item-img" />
          </a>
          <div class="lane4-cart-item-details">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <a href="${productLink}" class="lane4-cart-item-title">${escapeHtml(item.name)}</a>
              <button type="button" class="lane4-item-del-btn" data-del-id="${item.itemId}" title="Remove item" aria-label="Remove item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
            ${item.variantLabel ? `<div class="lane4-cart-item-variant">${escapeHtml(item.variantLabel)}</div>` : ''}
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
              <div class="lane4-cart-qty-ctrl">
                <button type="button" class="lane4-qty-btn lane4-qty-minus" data-qty-item="${item.itemId}" data-target-qty="${item.quantity - 1}">-</button>
                <span class="lane4-qty-val">${item.quantity}</span>
                <button type="button" class="lane4-qty-btn lane4-qty-plus" data-qty-item="${item.itemId}" data-target-qty="${item.quantity + 1}">+</button>
              </div>
              <div class="lane4-cart-item-price">${window.LANE4.formatINR(item.pricePaise * item.quantity)}</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Wire Quantity Minus / Plus Listeners
    bodyEl.querySelectorAll('.lane4-qty-btn').forEach(btn => {
      btn.onclick = async () => {
        const itemId = btn.getAttribute('data-qty-item');
        const targetQty = parseInt(btn.getAttribute('data-target-qty'), 10);
        const guestId = window.LANE4.getGuestId();

        try {
          if (targetQty <= 0) {
            // Delete item
            const res = await window.lane4ApiRequest(`/cart/items/${encodeURIComponent(itemId)}?guestId=${encodeURIComponent(guestId)}`, {
              method: 'DELETE'
            });
            activeCart = res.data;
          } else {
            // Update quantity
            const res = await window.lane4ApiRequest(`/cart/items/${encodeURIComponent(itemId)}`, {
              method: 'PATCH',
              body: JSON.stringify({ quantity: targetQty, guestId })
            });
            activeCart = res.data;
          }
          updateCartBadge();
          renderCartDrawer();
        } catch (err) {
          const msg = (err && err.message) || 'Error updating item quantity';
          await refreshCart();
          showCartDrawerError(msg);
        }
      };
    });

    // Wire Remove Button Listeners
    bodyEl.querySelectorAll('.lane4-item-del-btn').forEach(btn => {
      btn.onclick = async () => {
        const itemId = btn.getAttribute('data-del-id');
        const guestId = window.LANE4.getGuestId();
        try {
          const res = await window.lane4ApiRequest(`/cart/items/${encodeURIComponent(itemId)}?guestId=${encodeURIComponent(guestId)}`, {
            method: 'DELETE'
          });
          activeCart = res.data;
          updateCartBadge();
          renderCartDrawer();
        } catch (err) {
          showStorefrontToast(err.message || 'Error removing item from cart', 'error');
        }
      };
    });
  }

  function openCartDrawer() {
    createCartDrawerDOM();
    const root = document.getElementById('lane4-cart-drawer-root');
    if (root) {
      root.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeCartDrawer() {
    const root = document.getElementById('lane4-cart-drawer-root');
    if (root) {
      root.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  function setupCartTriggers() {
    // Intercept and prevent legacy Webflow commerce form submission at root capture phase
    document.addEventListener('submit', (e) => {
      const targetForm = e.target;
      if (targetForm && (
        targetForm.matches('form.w-commerce-commerceaddtocartform, [data-node-type="commerce-add-to-cart-form"], form.lane4-add-to-cart-form') ||
        targetForm.querySelector('[data-node-type="commerce-add-to-cart-button"], #lane4-buy-now-btn, .buy-now-wrapper')
      )) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      }
    }, true);

    // Intercept clicks on ALL cart buttons across the entire website
    document.addEventListener('click', (e) => {
      // 1. Never intercept clicks on auth / account / profile links or inside auth modal
      if (e.target.closest(
        '.cart-inner a, .info-bar-button, .info-bar-button-wrapper a, [data-lane4-auth], .lane4-account-trigger, a[href="#account"], a[href="#profile"], a[href="#login"], #lane4-auth-modal-wrapper'
      )) {
        return;
      }

      // 2. If click happened inside .cart-inner, ensure it was NOT on an anchor or auth trigger
      const cartInner = e.target.closest('.cart-inner');
      if (cartInner && e.target.closest('a')) {
        return;
      }

      const openBtn = e.target.closest(
        '[data-node-type="commerce-cart-open-link"], .cart-button, .cart-inner p, .cart-2, .w-commerce-commercecartopenlink, [aria-label="Open cart"], a[href="#cart"]'
      );
      if (openBtn && !e.target.closest('.cart-inner a')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openCartDrawer();
        refreshCart();
      }
    }, true);
  }

  /**
   * Hook "Buy Now Online" form on product pages
   */
  async function setupProductPageForm() {
    const form = document.querySelector('form.w-commerce-commerceaddtocartform, [data-node-type="commerce-add-to-cart-form"], form.lane4-add-to-cart-form');
    if (!form) return;

    // Permanently disable Webflow legacy error banner
    if (!document.getElementById('lane4-cart-error-override')) {
      const s = document.createElement('style');
      s.id = 'lane4-cart-error-override';
      s.textContent = '.w-commerce-commerceaddtocarterror, [data-node-type="commerce-add-to-cart-error"], [data-node-type="commerce-cart-error"] { display: none !important; visibility: hidden !important; height: 0 !important; overflow: hidden !important; }';
      document.head.appendChild(s);
    }
    document.querySelectorAll('.w-commerce-commerceaddtocarterror, [data-node-type="commerce-add-to-cart-error"], [data-node-type="commerce-cart-error"]').forEach(el => el.remove());

    // Neutralize Webflow attributes immediately
    form.removeAttribute('data-node-type');
    form.classList.remove('w-commerce-commerceaddtocartform');

    // Convert submit input to type="button" immediately before any async call
    const submitInput = form.querySelector('input[type="submit"]');
    let buyBtn;
    if (submitInput) {
      buyBtn = document.createElement('button');
      buyBtn.type = 'button';
      buyBtn.className = submitInput.className;
      buyBtn.id = 'lane4-buy-now-btn';
      const label = (submitInput.value || '').trim() || 'Buy Now Online';
      buyBtn.textContent = label;
      buyBtn.setAttribute('aria-label', label);
      buyBtn.setAttribute('aria-busy', 'false');
      buyBtn.style.color = '#ffffff';
      buyBtn.style.backgroundColor = '#000000';
      buyBtn.style.fontWeight = '700';
      buyBtn.style.cursor = 'pointer';
      submitInput.parentNode.replaceChild(buyBtn, submitInput);
    } else {
      buyBtn = form.querySelector('button, [data-node-type="commerce-add-to-cart-button"], #lane4-buy-now-btn');
      if (buyBtn) {
        buyBtn.type = 'button';
        const label = (buyBtn.textContent || '').trim() || 'Buy Now Online';
        buyBtn.textContent = label;
        buyBtn.setAttribute('aria-label', label);
        buyBtn.setAttribute('aria-busy', 'false');
        buyBtn.style.color = '#ffffff';
        buyBtn.style.backgroundColor = '#000000';
        buyBtn.style.fontWeight = '700';
      }
    }

    let loadedProduct = null;
    let productPromise = null;

    const docSlug = document.documentElement.getAttribute('data-wf-item-slug') || (document.body && document.body.getAttribute('data-wf-item-slug'));
    const path = window.location.pathname;
    const match = path.match(/\/product\/([a-zA-Z0-9-]+)(?:\.html)?/) || path.match(/([a-zA-Z0-9-]+)\.html$/);
    const slug = match ? match[1] : null;
    const querySlug = new URLSearchParams(window.location.search).get('slug');
    const effectiveSlug = (slug && slug !== 'detail' && slug !== 'index' && slug !== 'shop') ? slug : (querySlug || docSlug);

    const handleAddToCart = async (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      }

      // Login required to shop and add products to cart
      const user = window.LANE4.getUser();
      if (!user || !user.uid) {
        if (window.LANE4_AUTH && window.LANE4_AUTH.open) {
          window.LANE4_AUTH.open('login');
          if (window.LANE4_AUTH.showAlert) {
            window.LANE4_AUTH.showAlert('Please sign in or create an account to start shopping and add items to your cart.', 'info');
          }
        } else {
          showStorefrontToast('Please sign in or create an account to start shopping and add items to your cart.', 'info');
        }
        return;
      }

      if (!loadedProduct && productPromise) {
        try {
          await productPromise;
        } catch (_) {}
      }

      let product = loadedProduct;
      if (!product && effectiveSlug) {
        try {
          const res = await window.lane4ApiRequest(`/products/${encodeURIComponent(effectiveSlug)}`);
          if (res && res.data) {
            loadedProduct = res.data;
            product = loadedProduct;
          }
        } catch (_) {}
      }

      if (!product) {
        const titleEl = document.querySelector('.pd-heading .title-h4, .pd-heading h4, h1, h4');
        const fallbackName = titleEl ? titleEl.textContent.trim() : 'Product';
        product = {
          id: effectiveSlug || 'item',
          name: fallbackName,
          slug: effectiveSlug || 'item',
          variants: [{ variantId: 'default' }]
        };
      }

      const submitBtn = form.querySelector('button, input[type="submit"], input[type="button"], #lane4-buy-now-btn');
      const origVal = submitBtn ? ((submitBtn.textContent || submitBtn.value || '').trim() || 'Add to Bag') : 'Add to Bag';
      if (submitBtn) {
        if (submitBtn.tagName === 'INPUT') submitBtn.value = 'Adding to Bag...';
        else submitBtn.textContent = 'Adding to Bag...';
        submitBtn.setAttribute('aria-busy', 'true');
        submitBtn.disabled = true;
      }

      try {
        const select = form.querySelector('#lane4-variant-select');
        const selectedVariantId = select ? select.value : (product.variants && product.variants[0] ? product.variants[0].variantId : 'default');
        const guestId = window.LANE4.getGuestId();

        const addRes = await window.lane4ApiRequest('/cart/items', {
          method: 'POST',
          body: JSON.stringify({
            productId: product.id || product.slug || effectiveSlug,
            variantId: selectedVariantId,
            quantity: 1,
            guestId
          })
        });

        activeCart = addRes.data;
        updateCartBadge();
        renderCartDrawer();
        openCartDrawer();

        if (submitBtn) {
          if (submitBtn.tagName === 'INPUT') submitBtn.value = 'Added to Bag ✓';
          else submitBtn.textContent = 'Added to Bag ✓';
        }
      } catch (err) {
        showStorefrontToast(err.message || 'Unable to add product to cart.', 'error');
      } finally {
        setTimeout(() => {
          if (submitBtn) {
            if (submitBtn.tagName === 'INPUT') submitBtn.value = origVal;
            else submitBtn.textContent = origVal;
            submitBtn.setAttribute('aria-busy', 'false');
            submitBtn.disabled = false;
          }
        }, 1200);
      }
    };

    form.onsubmit = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.stopImmediatePropagation) e.stopImmediatePropagation();
      handleAddToCart(e);
      return false;
    };

    if (buyBtn) {
      buyBtn.addEventListener('click', handleAddToCart, true);
    }
    form.addEventListener('click', (e) => {
      const clickedBuy = e.target.closest('.buy-now-wrapper, .w-commerce-commerceaddtocartbutton, #lane4-buy-now-btn');
      if (clickedBuy) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        handleAddToCart(e);
      }
    }, true);

    if (!effectiveSlug) return;

    productPromise = (async () => {
      try {
        const res = await window.lane4ApiRequest(`/products/${encodeURIComponent(effectiveSlug)}`);
        const product = res.data;
        if (!product) return;
        loadedProduct = product;

        // Real-time product details hydration
        const nameEl = document.querySelector('.pd-heading .title-h4');
        if (nameEl && product.name) nameEl.textContent = product.name;

        const shortDescEl = document.querySelector('.pd-heading .paragraph-18px');
        if (shortDescEl && product.shortDescription) shortDescEl.textContent = product.shortDescription;

        // Authoritative Selling Price Display
        const regPaise = product.regularPricePaise || 0;
        const hasSale = product.salePricePaise && product.salePricePaise > 0 && product.salePricePaise < regPaise;
        let priceHtml = '';
        if (hasSale) {
          const saleFormatted = window.LANE4 ? `${window.LANE4.formatINR(product.salePricePaise)} INR` : `₹ ${(product.salePricePaise/100).toFixed(2)} INR`;
          const regFormatted = window.LANE4 ? `${window.LANE4.formatINR(regPaise)} INR` : `₹ ${(regPaise/100).toFixed(2)} INR`;
          priceHtml = `${saleFormatted} <span style="font-size:14px;text-decoration:line-through;color:#94a3b8;font-weight:normal;margin-left:8px;">${regFormatted}</span>`;
        } else {
          const primaryPaise = regPaise > 0 ? regPaise : (product.salePricePaise || 0);
          priceHtml = window.LANE4 ? `${window.LANE4.formatINR(primaryPaise)} INR` : `₹ ${(primaryPaise/100).toFixed(2)} INR`;
        }
        const priceEl = document.querySelector('.pd-heading .title-h6, .pd-heading h6, h6[data-wf-sku-bindings]');
        if (priceEl) priceEl.innerHTML = priceHtml;

        const descEl = document.querySelector('.pd-description .paragraph-20px');
        if (descEl && product.description) descEl.textContent = product.description;

        const breadcrumbEl = document.querySelector('.product-breadcrumbs a[aria-current] .paragraph-14px');
        if (breadcrumbEl && product.name) breadcrumbEl.textContent = product.name;
        if (product.name) document.title = `${product.name} | The Lane4 Performance Store`;

        // Update gallery product images strictly following admin order without disorganizing UI
        const galleryContainer = document.querySelector('.image-gallery');
        const rawImages = (product.images && Array.isArray(product.images) && product.images.length > 0)
          ? product.images
          : (product.imageUrl ? [{ url: product.imageUrl, alt: product.name, order: 0, isPrimary: true }] : []);

        if (galleryContainer && rawImages.length > 0) {
          const sortedImages = [...rawImages].sort((a, b) => (a.order || 0) - (b.order || 0));

          let galleryRowsHtml = '';
          if (sortedImages.length === 1) {
            let imgUrl = sortedImages[0].url || '';
            if (window.LANE4 && window.LANE4.resolveAssetUrl) imgUrl = window.LANE4.resolveAssetUrl(imgUrl);
            if (!imgUrl.startsWith('http') && !imgUrl.startsWith('/') && !imgUrl.startsWith('../')) imgUrl = '../' + imgUrl;
            const altText = sortedImages[0].alt || product.name || 'Product Image';

            galleryRowsHtml = `
              <div class="image-gallery-row single-image">
                <a href="${imgUrl}" class="lightbox-link w-inline-block w-lightbox" data-lane4-zoom="${imgUrl}">
                  <img class="product-img" src="${imgUrl}" alt="${altText}" loading="lazy" />
                  <script type="application/json" class="w-json">{"items":[{"url":"${imgUrl}","type":"image"}],"group":"product-gallery"}</script>
                </a>
              </div>
            `;
          } else {
            for (let i = 0; i < sortedImages.length; i += 2) {
              const it1 = sortedImages[i];
              const it2 = sortedImages[i + 1];

              let url1 = it1.url || '';
              if (window.LANE4 && window.LANE4.resolveAssetUrl) url1 = window.LANE4.resolveAssetUrl(url1);
              if (!url1.startsWith('http') && !url1.startsWith('/') && !url1.startsWith('../')) url1 = '../' + url1;
              const alt1 = it1.alt || product.name || 'Product Image';

              let col2Html = '';
              if (it2) {
                let url2 = it2.url || '';
                if (window.LANE4 && window.LANE4.resolveAssetUrl) url2 = window.LANE4.resolveAssetUrl(url2);
                if (!url2.startsWith('http') && !url2.startsWith('/') && !url2.startsWith('../')) url2 = '../' + url2;
                const alt2 = it2.alt || product.name || 'Product Image';
                col2Html = `
                  <a href="${url2}" class="lightbox-link w-inline-block w-lightbox" data-lane4-zoom="${url2}">
                    <img class="product-img" src="${url2}" alt="${alt2}" loading="lazy" />
                    <script type="application/json" class="w-json">{"items":[{"url":"${url2}","type":"image"}],"group":"product-gallery"}</script>
                  </a>
                `;
              }

              galleryRowsHtml += `
                <div class="image-gallery-row">
                  <a href="${url1}" class="lightbox-link w-inline-block w-lightbox" data-lane4-zoom="${url1}">
                    <img class="product-img" src="${url1}" alt="${alt1}" loading="lazy" />
                    <script type="application/json" class="w-json">{"items":[{"url":"${url1}","type":"image"}],"group":"product-gallery"}</script>
                  </a>
                  ${col2Html}
                </div>
              `;
            }
          }

          galleryContainer.innerHTML = galleryRowsHtml;

          // Reliable image click preview / zoom modal
          galleryContainer.querySelectorAll('.lightbox-link').forEach(link => {
            link.addEventListener('click', (ev) => {
              const zoomUrl = link.getAttribute('data-lane4-zoom') || link.getAttribute('href');
              if (zoomUrl && !link.classList.contains('w--lightbox-active')) {
                ev.preventDefault();
                showStorefrontImageModal(zoomUrl, link.querySelector('img')?.alt || product.name);
              }
            });
          });
        }

        // Ensure all gallery images have opacity: 1 and a fallback to restore original src on error
        document.querySelectorAll('.image-gallery img, .product-hero img, .product-img, .product-image').forEach(img => {
          img.style.opacity = '1';
          if (!img.dataset.origSrc) img.dataset.origSrc = img.getAttribute('src') || img.src;
          img.onerror = function () {
            if (this.dataset.origSrc && this.src !== this.dataset.origSrc) {
              this.src = this.dataset.origSrc;
            } else {
              this.src = '../6424266ea05809dff501d86e/lane4-share.png';
            }
          };
        });

        // Dynamic variants dropdown (Swiss Architectural Monochrome Theme)
        if (product.variants && product.variants.length > 0) {
          let variantContainer = form.querySelector('#lane4-variant-selector-wrapper');
          if (!variantContainer) {
            variantContainer = document.createElement('div');
            variantContainer.id = 'lane4-variant-selector-wrapper';
            variantContainer.style.cssText = 'margin:20px 0 6px;width:100%;';

            const optionsHtml = product.variants.map((v, i) => `
              <option value="${v.variantId}" ${i === 0 ? 'selected' : ''}>
                ${v.size ? `Size: ${v.size}` : ''}${v.size && v.color ? '  |  ' : ''}${v.color ? `Color: ${v.color}` : ''}${v.stockQuantity <= 3 ? ` (Only ${v.stockQuantity} left)` : ''}
              </option>
            `).join('');

            const chevronSvg = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23111111' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")";

            variantContainer.innerHTML = `
              <label for="lane4-variant-select" style="display:block;font-family:'Generalsans','General Sans',sans-serif;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:1.1px;margin-bottom:8px;color:#555555;-webkit-font-smoothing:antialiased;">
                Select Option / Size / Color
              </label>
              <select id="lane4-variant-select" style="width:100%;max-width:440px;height:48px;padding:0 40px 0 14px;border:1px solid #000000;border-radius:0px;font-size:14px;font-weight:400;letter-spacing:0.2px;color:#111111;background-color:#ffffff;background-image:${chevronSvg};background-repeat:no-repeat;background-position:right 14px center;font-family:'Generalsans','General Sans',sans-serif;appearance:none;-webkit-appearance:none;cursor:pointer;box-sizing:border-box;-webkit-font-smoothing:antialiased;">
                ${optionsHtml}
              </select>
            `;

            const btnWrapper = form.querySelector('.pd-buttons-wrapper, .buy-now-wrapper') || form.firstChild;
            form.insertBefore(variantContainer, btnWrapper);
          }
        }

        // Hydrate & Mount Product Reviews & Ratings
        initProductReviews(product);
      } catch (err) {
        console.warn('Could not load dynamic product variants:', err);
        const isGenericDetail = /\/product\/detail/i.test(window.location.pathname) ||
          document.documentElement.getAttribute('data-wf-item-slug') === 'detail';
        if (isGenericDetail && err && /not found|404/i.test(String(err.message || ''))) {
          document.title = '404 — Product Not Found | The Lane4 Performance Store';
          const metaRobots = document.createElement('meta');
          metaRobots.name = 'robots';
          metaRobots.content = 'noindex';
          document.head.appendChild(metaRobots);
          const hero = document.querySelector('.product-hero') || document.querySelector('.section');
          if (hero) {
            hero.innerHTML = `
              <div style="max-width:540px;margin:48px auto;padding:44px 28px;border:1px solid #dcdcdc;background:#fafafa;text-align:center;font-family:'Generalsans','General Sans',sans-serif;">
                <div style="font-size:11px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#64748b;margin-bottom:10px;">Error 404</div>
                <h1 class="title-h1" style="margin:0 0 12px;font-size:32px;line-height:1.15;font-weight:500;color:#111111;">Product Not Found</h1>
                <p style="font-size:14.5px;line-height:1.6;color:#555555;margin:0 0 24px;">This product is unavailable or has been removed from our catalog.</p>
                <a href="/shop.html" style="display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:12px 24px;background:#000000;color:#ffffff;text-decoration:none;font-size:12px;font-weight:500;letter-spacing:0.8px;text-transform:uppercase;">Browse Shop</a>
              </div>
            `;
          }
        }
      }
    })();
  }

  async function initProductReviews(product) {
    if (!product || document.getElementById('lane4-product-reviews-section')) return;

    function escRev(str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function renderEmptyReviewsHtml() {
      return `
        <div style="padding:36px 24px;background:#fafafa;border:1px solid #e5e5e5;border-radius:0px;text-align:center;">
          <div style="font-size:15px;font-weight:500;color:#111111;margin-bottom:6px;letter-spacing:0.1px;">Be the first swimmer to review!</div>
          <div style="font-size:13px;color:#737373;line-height:1.5;">Share your training or race-day experience with fellow swimmers.</div>
        </div>
      `;
    }

    if (!document.getElementById('lane4-review-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'lane4-review-styles';
      styleEl.textContent = `
        #lane4-product-reviews-section,
        #lane4-product-reviews-section * {
          font-family: 'Generalsans', 'General Sans', sans-serif !important;
          box-sizing: border-box;
        }
        .lane4-rev-btn-primary {
          background: #000000;
          color: #ffffff;
          border: 1px solid #000000;
          border-radius: 0px;
          padding: 12px 24px;
          font-size: 11.5px;
          font-weight: 500;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease, opacity 0.18s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          line-height: 18px;
        }
        .lane4-rev-btn-primary:hover {
          background: #222222;
          border-color: #222222;
        }
        .lane4-rev-btn-secondary {
          background: #ffffff;
          color: #111111;
          border: 1px solid #dcdcdc;
          border-radius: 0px;
          padding: 12px 20px;
          font-size: 11.5px;
          font-weight: 500;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
          transition: border-color 0.18s ease, background 0.18s ease;
          line-height: 18px;
        }
        .lane4-rev-btn-secondary:hover {
          border-color: #000000;
          background: #fafafa;
        }
        .lane4-rev-input {
          width: 100%;
          padding: 11px 14px;
          border: 1px solid #dcdcdc;
          border-radius: 0px;
          background: #ffffff;
          color: #111111;
          font-size: 13.5px;
          font-weight: 400;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .lane4-rev-input:focus {
          outline: none;
          border-color: #000000;
          box-shadow: 0 0 0 1px #000000;
        }
      `;
      document.head.appendChild(styleEl);
    }

    // Look for mounting location: place directly below product-hero across full container width
    const hero = document.querySelector('.product-hero');
    const reviewSection = document.createElement('div');
    reviewSection.id = 'lane4-product-reviews-section';
    reviewSection.style.cssText = 'width:100%;margin:56px 0 40px;padding-top:40px;border-top:1px solid #e5e5e5;color:#111111;clear:both;';

    if (hero && hero.parentNode) {
      hero.parentNode.insertBefore(reviewSection, hero.nextSibling);
    } else {
      const targetParent = document.querySelector('.product-details') || document.querySelector('.pd-description') || document.querySelector('.section.product-detail') || document.querySelector('.w-layout-grid') || document.querySelector('main') || document.body;
      if (!targetParent) return;
      targetParent.appendChild(reviewSection);
    }

    // Add quick review anchor in product heading under price
    const heading = document.querySelector('.pd-heading');
    if (heading && !document.getElementById('lane4-quick-review-anchor')) {
      const quickAnchor = document.createElement('div');
      quickAnchor.id = 'lane4-quick-review-anchor';
      quickAnchor.style.cssText = 'display:inline-flex;align-items:center;gap:8px;margin-top:8px;cursor:pointer;font-size:12.5px;color:#111111;font-weight:500;';
      quickAnchor.innerHTML = `
        <span style="color:#111111;font-size:13px;letter-spacing:1px;">★★★★★</span>
        <span id="lane4-quick-rating-text" style="color:#666666;font-size:12.5px;font-weight:400;">Customer Reviews</span>
        <span style="color:#cccccc;">·</span>
        <span style="text-decoration:underline;text-underline-offset:3px;color:#111111;">Add a review</span>
      `;
      quickAnchor.onclick = () => {
        reviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const formContainer = reviewSection.querySelector('#lane4-write-review-container');
        if (formContainer) {
          formContainer.style.display = 'block';
          reviewSection.querySelector('#lane4-review-author')?.focus();
        }
      };
      heading.appendChild(quickAnchor);
    }

    reviewSection.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px;margin-bottom:28px;">
        <div>
          <div style="font-size:10.5px;font-weight: 500;letter-spacing:1.6px;text-transform:uppercase;color:#737373;margin-bottom:6px;">Swimmer Feedback</div>
          <h3 style="font-size:24px;font-weight:500;letter-spacing:-0.3px;margin:0 0 8px;color:#000000;line-height:1.25;">Customer Reviews &amp; Ratings</h3>
          <div id="lane4-review-summary-stars" style="display:flex;align-items:center;gap:10px;font-size:14px;color:#111111;">
            <span style="letter-spacing:1.5px;">★★★★★</span>
            <span style="font-size:13px;color:#666666;font-weight:400;" id="lane4-review-count-label">Loading reviews...</span>
          </div>
        </div>
        <button type="button" id="lane4-write-review-toggle" class="lane4-rev-btn-primary">
          <span>Write a Review</span>
        </button>
      </div>

      <!-- Write Review Form Container (collapsible) -->
      <div id="lane4-write-review-container" style="display:none;background:#ffffff;border:1px solid #dcdcdc;border-radius:0px;padding:28px;margin-bottom:28px;max-width:760px;box-shadow:0 12px 32px rgba(0,0,0,0.06);">
        <h4 style="font-size:16px;font-weight:500;margin:0 0 18px;color:#000000;padding-bottom:14px;border-bottom:1px solid #eeeeee;">Share Your Review for ${escRev(product.name)}</h4>
        <form id="lane4-write-review-form">
          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:11px;font-weight: 500;text-transform:uppercase;letter-spacing:0.8px;color:#333333;margin-bottom:8px;">
              Overall Rating *
            </label>
            <div id="lane4-star-selector" style="display:flex;gap:6px;font-size:22px;cursor:pointer;color:#d4d4d4;">
              <span data-star="1">★</span>
              <span data-star="2">★</span>
              <span data-star="3">★</span>
              <span data-star="4">★</span>
              <span data-star="5">★</span>
            </div>
            <input type="hidden" id="lane4-selected-rating" value="5" />
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:11px;font-weight: 500;text-transform:uppercase;letter-spacing:0.8px;color:#333333;margin-bottom:6px;">
              Your Name *
            </label>
            <input type="text" id="lane4-review-author" required placeholder="e.g. Swimmer Rohan" class="lane4-rev-input" style="max-width:420px;" />
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:11px;font-weight: 500;text-transform:uppercase;letter-spacing:0.8px;color:#333333;margin-bottom:6px;">
              Headline / Summary
            </label>
            <input type="text" id="lane4-review-title" placeholder="e.g. Outstanding hydrodynamic fit in open water" class="lane4-rev-input" style="max-width:560px;" />
          </div>

          <div style="margin-bottom:20px;">
            <label style="display:block;font-size:11px;font-weight: 500;text-transform:uppercase;letter-spacing:0.8px;color:#333333;margin-bottom:6px;">
              Detailed Review *
            </label>
            <textarea id="lane4-review-comment" required rows="4" placeholder="How did this gear perform in practice or competition? Tell other swimmers about fit, feel, durability..." class="lane4-rev-input"></textarea>
          </div>

          <div style="display:flex;gap:12px;flex-wrap:wrap;">
            <button type="submit" id="lane4-submit-review-btn" class="lane4-rev-btn-primary">
              Submit Review
            </button>
            <button type="button" id="lane4-cancel-review-btn" class="lane4-rev-btn-secondary">
              Cancel
            </button>
          </div>
        </form>
        <div id="lane4-review-alert" style="display:none;margin-top:16px;padding:12px 14px;border-radius:0px;font-size:13px;font-weight:500;"></div>
      </div>

      <!-- Approved Reviews List -->
      <div id="lane4-approved-reviews-list">Loading verified reviews...</div>
    `;

    // Star selection interactive hover/click
    let selectedRating = 5;
    const stars = reviewSection.querySelectorAll('#lane4-star-selector span');
    function updateStarUI(val) {
      stars.forEach((s, idx) => {
        s.style.color = idx < val ? '#111111' : '#d4d4d4';
      });
    }
    updateStarUI(5);
    stars.forEach(s => {
      s.onclick = () => {
        selectedRating = parseInt(s.getAttribute('data-star'), 10) || 5;
        document.getElementById('lane4-selected-rating').value = selectedRating;
        updateStarUI(selectedRating);
      };
    });

    // Write review toggle & pre-fill
    const toggleBtn = reviewSection.querySelector('#lane4-write-review-toggle');
    const container = reviewSection.querySelector('#lane4-write-review-container');
    const cancelBtn = reviewSection.querySelector('#lane4-cancel-review-btn');
    const authorInput = reviewSection.querySelector('#lane4-review-author');

    toggleBtn.onclick = () => {
      const user = window.LANE4 ? window.LANE4.getUser() : null;
      if (user && authorInput && !authorInput.value) {
        authorInput.value = user.displayName || user.name || user.fullName || (user.email ? user.email.split('@')[0] : '');
      }
      container.style.display = container.style.display === 'none' ? 'block' : 'none';
      if (container.style.display === 'block') authorInput?.focus();
    };
    cancelBtn.onclick = () => {
      container.style.display = 'none';
    };

    // Review form submit
    const reviewForm = reviewSection.querySelector('#lane4-write-review-form');
    const reviewAlert = reviewSection.querySelector('#lane4-review-alert');
    const submitBtn = reviewSection.querySelector('#lane4-submit-review-btn');

    reviewForm.onsubmit = async (e) => {
      e.preventDefault();
      const rating = parseInt(document.getElementById('lane4-selected-rating').value, 10) || 5;
      const authorName = authorInput.value.trim();
      const title = document.getElementById('lane4-review-title').value.trim();
      const comment = document.getElementById('lane4-review-comment').value.trim();

      if (!authorName) {
        reviewAlert.style.display = 'block';
        reviewAlert.style.background = '#fef2f2';
        reviewAlert.style.color = '#b91c1c';
        reviewAlert.style.border = '1px solid #fecaca';
        reviewAlert.textContent = 'Please provide your full name or nickname.';
        authorInput.focus();
        return;
      }
      if (!comment) {
        reviewAlert.style.display = 'block';
        reviewAlert.style.background = '#fef2f2';
        reviewAlert.style.color = '#b91c1c';
        reviewAlert.style.border = '1px solid #fecaca';
        reviewAlert.textContent = 'Please write a brief comment describing your experience.';
        document.getElementById('lane4-review-comment').focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';

      try {
        await window.lane4ApiRequest(`/products/${encodeURIComponent(product.id || product.slug)}/reviews`, {
          method: 'POST',
          body: JSON.stringify({ rating, authorName, title, comment })
        });

        // Hide form container immediately and show prominent persistent confirmation banner
        container.style.display = 'none';
        reviewForm.reset();

        let successBanner = reviewSection.querySelector('#lane4-review-submitted-success');
        if (!successBanner) {
          successBanner = document.createElement('div');
          successBanner.id = 'lane4-review-submitted-success';
          const listContainer = reviewSection.querySelector('#lane4-approved-reviews-list');
          listContainer.parentNode.insertBefore(successBanner, listContainer);
        }
        successBanner.style.cssText = 'background:#ffffff;border:1px solid #111111;border-radius:0px;padding:22px 24px;margin-bottom:28px;';
        successBanner.innerHTML = `
          <div style="display:flex;align-items:flex-start;gap:14px;">
            <div style="width:32px;height:32px;border-radius:0px;background:#111111;color:#ffffff;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <div style="flex:1;">
              <div style="font-size:14.5px;font-weight:500;color:#111111;margin-bottom:4px;">Review Submitted Successfully</div>
              <div style="font-size:13px;color:#555555;line-height:1.5;">
                Thank you, <strong style="color:#111111;">${escRev(authorName)}</strong>. Your review (${'★'.repeat(rating)}) has been recorded and submitted for store verification.
              </div>
              <div style="margin-top:10px;display:inline-flex;align-items:center;gap:6px;border:1px solid #dcdcdc;background:#fafafa;color:#111111;padding:4px 10px;border-radius:0px;font-size:10.5px;font-weight:500;letter-spacing:0.8px;text-transform:uppercase;">
                <span>Pending Verification</span>
              </div>
            </div>
          </div>
        `;
        successBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        toggleBtn.textContent = 'Write Another Review';
      } catch (err) {
        reviewAlert.style.display = 'block';
        reviewAlert.style.background = '#fef2f2';
        reviewAlert.style.color = '#b91c1c';
        reviewAlert.style.border = '1px solid #fecaca';
        reviewAlert.textContent = err.message || 'Unable to submit review. Please try again.';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Review';
      }
    };

    // Fetch and render approved reviews
    try {
      const revRes = await window.lane4ApiRequest(`/products/${encodeURIComponent(product.id || product.slug)}/reviews`);
      const reviews = (revRes && revRes.data) || [];
      const listContainer = reviewSection.querySelector('#lane4-approved-reviews-list');
      const countLabel = reviewSection.querySelector('#lane4-review-count-label');

      if (reviews.length === 0) {
        countLabel.textContent = 'No reviews yet';
        const quickRatingText = document.getElementById('lane4-quick-rating-text');
        if (quickRatingText) quickRatingText.textContent = 'No reviews yet';
        listContainer.innerHTML = renderEmptyReviewsHtml();
        return;
      }

      const avg = reviews.reduce((sum, r) => sum + (r.rating || 5), 0) / reviews.length;
      countLabel.textContent = `${avg.toFixed(1)} / 5.0 (${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'})`;
      const quickRatingText = document.getElementById('lane4-quick-rating-text');
      if (quickRatingText) {
        quickRatingText.textContent = `${avg.toFixed(1)} (${reviews.length})`;
      }

      function formatReviewDate(val) {
        if (!val) return '';
        let d = null;
        if (typeof val === 'object') {
          if (val._seconds) d = new Date(val._seconds * 1000);
          else if (val.seconds) d = new Date(val.seconds * 1000);
          else if (val instanceof Date) d = val;
        } else if (typeof val === 'number') {
          d = new Date(val);
        } else if (typeof val === 'string') {
          d = new Date(val);
        }
        if (!d || isNaN(d.getTime())) return '';
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
      }

      listContainer.innerHTML = reviews.map(r => {
        const starStr = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
        const dateStr = formatReviewDate(r.createdAt);

        return `
          <div style="border-bottom:1px solid #eeeeee;padding:20px 0;">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <span style="color:#111111;font-size:14px;letter-spacing:1.5px;">${starStr}</span>
                <span style="font-size:13.5px;font-weight:500;color:#111111;">${escRev(r.authorName || 'Verified Swimmer')}</span>
                ${r.isVerifiedPurchase ? `<span style="font-size:10px;font-weight:500;border:1px solid #111111;background:#ffffff;color:#111111;padding:2px 7px;border-radius:0px;letter-spacing:0.6px;text-transform:uppercase;">Verified Purchase</span>` : ''}
              </div>
              <div style="font-size:12px;color:#888888;">${escRev(dateStr)}</div>
            </div>
            ${r.title ? `<div style="font-size:14px;font-weight:500;color:#111111;margin-bottom:4px;">${escRev(r.title)}</div>` : ''}
            <div style="font-size:13.5px;color:#555555;line-height:1.55;">${escRev(r.comment)}</div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.warn('Could not load product reviews:', err);
      const listContainer = reviewSection.querySelector('#lane4-approved-reviews-list');
      const countLabel = reviewSection.querySelector('#lane4-review-count-label');
      if (countLabel) countLabel.textContent = 'No reviews yet';
      const quickRatingText = document.getElementById('lane4-quick-rating-text');
      if (quickRatingText) quickRatingText.textContent = 'No reviews yet';
      if (listContainer) {
        listContainer.innerHTML = renderEmptyReviewsHtml();
      }
    }
  }

  function showStorefrontImageModal(src, alt) {
    let modal = document.getElementById('lane4-image-lightbox-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'lane4-image-lightbox-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.88);z-index:999999;display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);';
      modal.innerHTML = `
        <div style="position:relative;max-width:92vw;max-height:92vh;display:flex;align-items:center;justify-content:center;" onclick="event.stopPropagation()">
          <img id="lane4-lightbox-img" src="" alt="" style="max-width:100%;max-height:90vh;object-fit:contain;border-radius:0px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);" />
          <button id="lane4-lightbox-close" style="position:absolute;top:-38px;right:-4px;background:none;border:none;color:#fff;font-size:32px;cursor:pointer;line-height:1;padding:4px 8px;" aria-label="Close">&times;</button>
        </div>
      `;
      modal.onclick = () => { modal.style.display = 'none'; };
      modal.querySelector('#lane4-lightbox-close').onclick = () => { modal.style.display = 'none'; };
      document.body.appendChild(modal);
    }
    const imgEl = modal.querySelector('#lane4-lightbox-img');
    if (imgEl) {
      imgEl.src = src;
      imgEl.alt = alt || 'Product Image Preview';
    }
    modal.style.display = 'flex';
  }

  async function clearCart() {
    activeCart = { items: [], subtotalPaise: 0, totalItemsCount: 0, subtotalFormatted: '₹0.00' };
    updateCartBadge();
    renderCartDrawer();
    try {
      const guestId = window.LANE4 ? window.LANE4.getGuestId() : null;
      if (guestId) {
        await window.lane4ApiRequest(`/cart?guestId=${encodeURIComponent(guestId)}`, {
          method: 'DELETE'
        });
      }
    } catch (e) {
      console.warn('Could not clear cart on server:', e);
    }
    try {
      const newGuestId = 'gst_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem('lane4_guest_id', newGuestId);
    } catch (_) {}
  }

  // Export public methods for cross-module usage
  window.LANE4_CART = {
    open: openCartDrawer,
    close: closeCartDrawer,
    refresh: refreshCart,
    clear: clearCart
  };

  window.addEventListener('lane4:cart-cleared', () => {
    clearCart();
  });

  function initCart() {
    createCartDrawerDOM();
    setupCartTriggers();
    setupProductPageForm();
    refreshCart();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCart);
  } else {
    initCart();
  }
})();
