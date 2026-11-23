/**
 * LANE4 E-Commerce Shopping Cart Drawer Controller
 * Replaces Webflow's legacy unorganized cart with a high-performance slide-out athletic cart drawer.
 */

(function () {
  const FREE_SHIPPING_THRESHOLD_PAISE = 199900; // ₹1,999.00
  let activeCart = { items: [], subtotalPaise: 0, totalItemsCount: 0 };

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

      /* LANE4 Slide-out Cart Drawer Styles */
      #lane4-cart-drawer-root {
        position: fixed;
        inset: 0;
        z-index: 99999990;
        pointer-events: none;
        visibility: hidden;
        transition: visibility 0.3s ease;
        font-family: 'Generalsans', 'General Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      #lane4-cart-drawer-root.open {
        pointer-events: auto;
        visibility: visible;
      }
      #lane4-cart-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        opacity: 0;
        transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1);
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
        box-shadow: -10px 0 45px rgba(0, 0, 0, 0.28);
        display: flex;
        flex-direction: column;
        transform: translateX(100%);
        transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
        z-index: 2;
        box-sizing: border-box;
      }
      #lane4-cart-drawer-root.open #lane4-cart-panel {
        transform: translateX(0);
      }
      .lane4-cart-header {
        padding: 20px 24px;
        border-bottom: 1px solid #f1f5f9;
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
        font-size: 17px;
        font-weight: 900;
        letter-spacing: 1.5px;
        color: #0f172a;
        margin: 0;
        text-transform: uppercase;
      }
      .lane4-cart-badge-count {
        background: #0f172a;
        color: #ffffff;
        font-size: 11px;
        font-weight: 800;
        padding: 2px 8px;
        border-radius: 12px;
      }
      .lane4-cart-close-btn {
        background: #f1f5f9;
        border: none;
        color: #64748b;
        cursor: pointer;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
      }
      .lane4-cart-close-btn:hover {
        background: #e2e8f0;
        color: #0f172a;
      }
      .lane4-shipping-banner {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        padding: 12px 24px;
      }
      .lane4-shipping-bar-track {
        height: 6px;
        background: #e2e8f0;
        border-radius: 3px;
        overflow: hidden;
        margin-top: 6px;
      }
      .lane4-shipping-bar-fill {
        height: 100%;
        background: #16a34a;
        transition: width 0.3s ease;
        border-radius: 3px;
      }
      .lane4-cart-body {
        flex: 1;
        overflow-y: auto;
        padding: 16px 24px;
      }
      .lane4-cart-empty {
        text-align: center;
        padding: 60px 16px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .lane4-empty-icon-wrap {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        background: #f1f5f9;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 18px;
        color: #64748b;
      }
      .lane4-cart-item-row {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 16px 0;
        border-bottom: 1px solid #f1f5f9;
      }
      .lane4-cart-item-img {
        width: 74px;
        height: 74px;
        object-fit: cover;
        border-radius: 8px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        flex-shrink: 0;
      }
      .lane4-cart-item-details {
        flex: 1;
        min-width: 0;
      }
      .lane4-cart-item-title {
        font-weight: 800;
        font-size: 13.5px;
        color: #0f172a;
        text-decoration: none;
        line-height: 1.35;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }
      .lane4-cart-item-variant {
        font-size: 11.5px;
        color: #64748b;
        font-weight: 600;
        margin-top: 3px;
      }
      .lane4-cart-item-price {
        font-size: 14px;
        font-weight: 800;
        color: #000000;
        margin-top: 4px;
      }
      .lane4-cart-qty-ctrl {
        display: inline-flex;
        align-items: center;
        border: 1.5px solid #cbd5e1;
        border-radius: 6px;
        overflow: hidden;
        margin-top: 8px;
        background: #ffffff;
      }
      .lane4-qty-btn {
        background: #f8fafc;
        border: none;
        width: 26px;
        height: 26px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #334155;
        font-weight: 700;
        font-size: 14px;
        transition: background 0.15s;
      }
      .lane4-qty-btn:hover {
        background: #e2e8f0;
        color: #000000;
      }
      .lane4-qty-val {
        padding: 0 10px;
        font-size: 13px;
        font-weight: 700;
        color: #0f172a;
        min-width: 18px;
        text-align: center;
      }
      .lane4-item-del-btn {
        background: none;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.15s;
        margin-left: 6px;
      }
      .lane4-item-del-btn:hover {
        color: #ef4444;
      }
      .lane4-cart-footer {
        padding: 20px 24px;
        border-top: 1px solid #e2e8f0;
        background: #ffffff;
        box-shadow: 0 -4px 16px rgba(0,0,0,0.03);
      }
      .lane4-subtotal-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
      }
      .lane4-subtotal-label {
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #64748b;
      }
      .lane4-subtotal-val {
        font-size: 20px;
        font-weight: 900;
        color: #0f172a;
      }
      .lane4-cart-checkout-btn {
        width: 100%;
        background: #000000;
        color: #ffffff;
        padding: 15px;
        border: none;
        border-radius: 8px;
        font-size: 13.5px;
        font-weight: 800;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        cursor: pointer;
        margin-top: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        text-decoration: none;
        transition: all 0.15s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      }
      .lane4-cart-checkout-btn:hover {
        background: #1e293b;
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(0,0,0,0.2);
      }
      .lane4-continue-shopping-link {
        display: block;
        text-align: center;
        margin-top: 10px;
        font-size: 12.5px;
        font-weight: 700;
        color: #64748b;
        text-decoration: none;
        cursor: pointer;
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <!-- Free Shipping Progress Tracker -->
        <div id="lane4-free-shipping-section" class="lane4-shipping-banner">
          <div id="lane4-shipping-msg" style="font-size:12px;font-weight:700;color:#334155;"></div>
          <div class="lane4-shipping-bar-track">
            <div id="lane4-shipping-bar" class="lane4-shipping-bar-fill" style="width:0%;"></div>
          </div>
        </div>

        <!-- Cart Body (Scrollable items / Empty state) -->
        <div id="lane4-cart-body" class="lane4-cart-body"></div>

        <!-- Cart Footer -->
        <div id="lane4-cart-footer" class="lane4-cart-footer" style="display:none;">
          <div class="lane4-subtotal-row">
            <span class="lane4-subtotal-label">Subtotal</span>
            <span id="lane4-cart-subtotal-text" class="lane4-subtotal-val">₹0.00</span>
          </div>
          <div style="font-size:11.5px;color:#64748b;line-height:1.4;">
            PAN India Express delivery • Taxes calculated at checkout
          </div>
          <a id="lane4-go-checkout-btn" class="lane4-cart-checkout-btn" href="checkout.html">
            <span>PROCEED TO CHECKOUT</span>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
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
        alert('Your cart is empty! Please select swimming products before checking out.');
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
          alert('Please sign in or create an account to proceed to checkout.');
        }
        return;
      }
      const isInSubfolder = /\/(product|category|blog|authors|utility-pages|category-blog)\//i.test(window.location.pathname);
      window.location.href = isInSubfolder ? '../checkout.html' : 'checkout.html';
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
    const footerEl = document.getElementById('lane4-cart-footer');
    const shippingSec = document.getElementById('lane4-free-shipping-section');
    const shippingMsg = document.getElementById('lane4-shipping-msg');
    const shippingBar = document.getElementById('lane4-shipping-bar');
    const subtotalText = document.getElementById('lane4-cart-subtotal-text');

    if (!bodyEl) return;

    // Free shipping progress calculation
    const subtotal = activeCart.subtotalPaise || 0;
    if (subtotal >= FREE_SHIPPING_THRESHOLD_PAISE) {
      shippingMsg.innerHTML = '<span style="color:#16a34a;display:inline-flex;align-items:center;gap:5px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>You unlocked <strong>FREE PAN India Express Delivery!</strong></span>';
      shippingBar.style.width = '100%';
      shippingBar.style.background = '#16a34a';
    } else {
      const remainingPaise = FREE_SHIPPING_THRESHOLD_PAISE - subtotal;
      shippingMsg.innerHTML = `Add <strong>${window.LANE4.formatINR(remainingPaise)}</strong> more to get <strong style="color:#16a34a;">FREE Delivery</strong>`;
      const pct = Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD_PAISE) * 100));
      shippingBar.style.width = `${pct}%`;
      shippingBar.style.background = '#0f172a';
    }

    // EMPTY CART STATE
    if (!activeCart.items || activeCart.items.length === 0) {
      footerEl.style.display = 'none';
      shippingSec.style.display = 'none';
      const isInSubfolder = /\/(product|category|blog|authors|utility-pages|category-blog)\//i.test(window.location.pathname);
      const shopUrl = isInSubfolder ? '../shop.html' : 'shop.html';

      bodyEl.innerHTML = `
        <div class="lane4-cart-empty">
          <div class="lane4-empty-icon-wrap">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8" cy="21" r="1"></circle>
              <circle cx="19" cy="21" r="1"></circle>
              <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"></path>
            </svg>
          </div>
          <h4 style="font-size:18px;font-weight:900;color:#0f172a;margin:0 0 8px 0;">Your Cart is Empty</h4>
          <p style="font-size:13px;color:#64748b;line-height:1.5;margin:0 0 22px 0;max-width:260px;">
            Explore our competitive swim gear, racing caps, and goggles to gear up.
          </p>
          <a href="${shopUrl}" class="lane4-cart-checkout-btn" style="max-width:220px;text-decoration:none;margin-top:0;">
            <span>START SHOPPING</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
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

    bodyEl.innerHTML = activeCart.items.map(item => {
      const imgUrl = window.LANE4.resolveAssetUrl ? window.LANE4.resolveAssetUrl(item.imageUrl) : (item.imageUrl || '');
      const productLink = item.slug ? `${productBase}${item.slug}.html` : '#';

      return `
        <div class="lane4-cart-item-row" data-row-id="${item.itemId}">
          <a href="${productLink}">
            <img src="${imgUrl}" alt="${item.name}" class="lane4-cart-item-img" />
          </a>
          <div class="lane4-cart-item-details">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
              <a href="${productLink}" class="lane4-cart-item-title">${item.name}</a>
              <button type="button" class="lane4-item-del-btn" data-del-id="${item.itemId}" title="Remove item" aria-label="Remove item">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
            ${item.variantLabel ? `<div class="lane4-cart-item-variant">${item.variantLabel}</div>` : ''}
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
          alert(err.message || 'Error updating item quantity');
          refreshCart();
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
          alert(err.message || 'Error removing item from cart');
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
    // Intercept clicks on ALL cart buttons across the entire website
    document.addEventListener('click', (e) => {
      const openBtn = e.target.closest(
        '[data-node-type="commerce-cart-open-link"], .cart-button, .cart-inner, .cart-2, .w-commerce-commercecartopenlink, [aria-label="Open cart"], a[href="#cart"]'
      );
      if (openBtn) {
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
    const form = document.querySelector('form.w-commerce-commerceaddtocartform, [data-node-type="commerce-add-to-cart-form"]');
    if (!form) return;

    // Permanently disable Webflow legacy error banner
    if (!document.getElementById('lane4-cart-error-override')) {
      const s = document.createElement('style');
      s.id = 'lane4-cart-error-override';
      s.textContent = '.w-commerce-commerceaddtocarterror, [data-node-type="commerce-add-to-cart-error"] { display: none !important; }';
      document.head.appendChild(s);
    }
    document.querySelectorAll('.w-commerce-commerceaddtocarterror, [data-node-type="commerce-add-to-cart-error"]').forEach(el => el.remove());

    const path = window.location.pathname;
    const match = path.match(/\/product\/([a-zA-Z0-9-]+)(?:\.html)?/);
    const slug = match ? match[1] : null;
    const querySlug = new URLSearchParams(window.location.search).get('slug');
    const effectiveSlug = (slug && slug !== 'detail') ? slug : querySlug;

    if (!effectiveSlug) return;

    try {
      const res = await window.lane4ApiRequest(`/products/${encodeURIComponent(effectiveSlug)}`);
      const product = res.data;
      if (!product) return;

      // Real-time product details hydration
      const nameEl = document.querySelector('.pd-heading .title-h4');
      if (nameEl && product.name) nameEl.textContent = product.name;

      const shortDescEl = document.querySelector('.pd-heading .paragraph-18px');
      if (shortDescEl && product.shortDescription) shortDescEl.textContent = product.shortDescription;

      // Fix Price Inconsistency: Regular price by default, sale price + strikethrough if active discount
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

      // Update primary product images if available
      if (product.images && Array.isArray(product.images) && product.images.length > 0) {
        const galleryImgs = document.querySelectorAll('.image-gallery .product-img, .product-hero .product-img');
        product.images.forEach((imgObj, idx) => {
          if (galleryImgs[idx] && imgObj && imgObj.url) {
            let imgUrl = imgObj.url;
            if (window.LANE4 && window.LANE4.resolveAssetUrl) imgUrl = window.LANE4.resolveAssetUrl(imgUrl);
            if (!imgUrl.startsWith('http') && !imgUrl.startsWith('/') && !imgUrl.startsWith('../')) imgUrl = '../' + imgUrl;
            galleryImgs[idx].src = imgUrl;
            if (galleryImgs[idx].hasAttribute('srcset')) galleryImgs[idx].removeAttribute('srcset');
            galleryImgs[idx].style.opacity = '1';
          }
        });
      }

      // Ensure all gallery images have opacity: 1 and a fallback to restore original src on error
      document.querySelectorAll('.image-gallery img, .product-hero img, .product-img, .product-image').forEach(img => {
        img.style.opacity = '1';
        if (!img.dataset.origSrc) img.dataset.origSrc = img.getAttribute('src') || img.src;
        img.onerror = function () {
          if (this.dataset.origSrc && this.src !== this.dataset.origSrc) {
            this.src = this.dataset.origSrc;
          }
        };
      });

      // Dynamic variants dropdown
      if (product.variants && product.variants.length > 0) {
        let variantContainer = form.querySelector('#lane4-variant-selector-wrapper');
        if (!variantContainer) {
          variantContainer = document.createElement('div');
          variantContainer.id = 'lane4-variant-selector-wrapper';
          variantContainer.style.margin = '14px 0';

          const optionsHtml = product.variants.map((v, i) => `
            <option value="${v.variantId}" ${i === 0 ? 'selected' : ''}>
              ${v.size ? `Size: ${v.size}` : ''} ${v.color ? `· Color: ${v.color}` : ''} ${v.stockQuantity <= 3 ? `(Only ${v.stockQuantity} left!)` : ''}
            </option>
          `).join('');

          variantContainer.innerHTML = `
            <label style="display:block;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;color:#0f172a;">
              Select Option / Size / Color
            </label>
            <select id="lane4-variant-select" style="width:100%;max-width:320px;padding:10px 14px;border:1.5px solid #0f172a;border-radius:6px;font-size:14px;background:#fff;font-family:inherit;font-weight:700;">
              ${optionsHtml}
            </select>
          `;

          const btnWrapper = form.querySelector('.pd-buttons-wrapper, .buy-now-wrapper') || form.firstChild;
          form.insertBefore(variantContainer, btnWrapper);
        }
      }

      const handleAddToCart = async (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
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
            alert('Please sign in or create an account to start shopping and add items to your cart.');
          }
          return;
        }

        const submitBtn = form.querySelector('button, input[type="submit"], input[type="button"]');
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
              productId: product.id,
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
          alert(err.message || 'Unable to add product to cart.');
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

      // Convert submit button to type="button" to prevent Webflow submit hijacking
      const submitInput = form.querySelector('input[type="submit"]');
      let buyBtn;
      if (submitInput) {
        buyBtn = document.createElement('button');
        buyBtn.type = 'button';
        buyBtn.className = submitInput.className;
        buyBtn.id = 'lane4-buy-now-btn';
        const label = (submitInput.value || '').trim() || 'Add to Bag';
        buyBtn.textContent = label;
        buyBtn.setAttribute('aria-label', label);
        buyBtn.setAttribute('aria-busy', 'false');
        buyBtn.style.color = '#ffffff';
        buyBtn.style.backgroundColor = '#000000';
        buyBtn.style.fontWeight = '700';
        buyBtn.style.cursor = 'pointer';
        submitInput.parentNode.replaceChild(buyBtn, submitInput);
      } else {
        buyBtn = form.querySelector('button, [data-node-type="commerce-add-to-cart-button"]');
        if (buyBtn) {
          buyBtn.type = 'button';
          const label = (buyBtn.textContent || '').trim() || 'Add to Bag';
          buyBtn.textContent = label;
          buyBtn.setAttribute('aria-label', label);
          buyBtn.setAttribute('aria-busy', 'false');
          buyBtn.style.color = '#ffffff';
          buyBtn.style.backgroundColor = '#000000';
          buyBtn.style.fontWeight = '700';
        }
      }

      form.removeAttribute('data-node-type');
      form.onsubmit = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleAddToCart(e);
        return false;
      };

      if (buyBtn) {
        buyBtn.addEventListener('click', handleAddToCart);
      }
      form.addEventListener('click', (e) => {
        const clickedBuy = e.target.closest('.buy-now-wrapper, .w-commerce-commerceaddtocartbutton, #lane4-buy-now-btn');
        if (clickedBuy) {
          e.preventDefault();
          e.stopPropagation();
          handleAddToCart(e);
        }
      });

      // Hydrate & Mount Product Reviews & Ratings
      initProductReviews(product);
    } catch (err) {
      console.warn('Could not load dynamic product variants:', err);
    }
  }

  async function initProductReviews(product) {
    if (!product || document.getElementById('lane4-product-reviews-section')) return;

    // Look for mounting location: place directly below product-hero across full container width
    const hero = document.querySelector('.product-hero');
    const reviewSection = document.createElement('div');
    reviewSection.id = 'lane4-product-reviews-section';
    reviewSection.style.cssText = 'width:100%;margin:56px 0 40px;padding-top:40px;border-top:1.5px solid #e2e8f0;font-family:inherit;color:#0f172a;clear:both;';

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
      quickAnchor.style.cssText = 'display:inline-flex;align-items:center;gap:6px;margin-top:6px;cursor:pointer;font-size:13px;color:#0284c7;font-weight:600;';
      quickAnchor.innerHTML = `
        <span style="color:#f59e0b;font-size:14px;">★★★★★</span>
        <span id="lane4-quick-rating-text" style="color:#64748b;font-size:12.5px;">Customer Reviews</span>
        <span style="color:#cbd5e1;">·</span>
        <span style="text-decoration:underline;color:#0284c7;">Add a review</span>
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
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:16px;margin-bottom:24px;">
        <div>
          <div style="font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;margin-bottom:4px;">Swimmer Feedback</div>
          <h3 style="font-size:22px;font-weight:600;margin:0 0 6px;color:#0f172a;">Customer Reviews &amp; Ratings</h3>
          <div id="lane4-review-summary-stars" style="display:flex;align-items:center;gap:8px;font-size:14px;color:#f59e0b;">
            <span>★★★★★</span>
            <span style="font-size:13px;color:#64748b;font-weight:600;" id="lane4-review-count-label">Loading reviews...</span>
          </div>
        </div>
        <button type="button" id="lane4-write-review-toggle" style="background:#0f172a;color:#ffffff;border:none;padding:10px 18px;border-radius:6px;font-size:12.5px;font-weight:600;letter-spacing:0.8px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
          <span>Write a Review</span>
        </button>
      </div>

      <!-- Write Review Form Container (collapsible) -->
      <div id="lane4-write-review-container" style="display:none;background:#f8fafc;border:1.5px solid #cbd5e1;border-radius:10px;padding:24px;margin-bottom:28px;max-width:760px;box-shadow:0 4px 14px rgba(15,23,42,0.05);">
        <h4 style="font-size:16px;font-weight:600;margin:0 0 14px;color:#0f172a;">Share Your Review for ${product.name}</h4>
        <form id="lane4-write-review-form">
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#334155;margin-bottom:6px;">
              Overall Rating *
            </label>
            <div id="lane4-star-selector" style="display:flex;gap:6px;font-size:24px;cursor:pointer;color:#cbd5e1;">
              <span data-star="1">★</span>
              <span data-star="2">★</span>
              <span data-star="3">★</span>
              <span data-star="4">★</span>
              <span data-star="5">★</span>
            </div>
            <input type="hidden" id="lane4-selected-rating" value="5" />
          </div>

          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#334155;margin-bottom:6px;">
              Your Name *
            </label>
            <input type="text" id="lane4-review-author" required placeholder="e.g. Swimmer Rohan" style="width:100%;max-width:400px;padding:9px 12px;border:1.5px solid #cbd5e1;border-radius:6px;font-size:13.5px;font-family:inherit;" />
          </div>

          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#334155;margin-bottom:6px;">
              Headline / Summary
            </label>
            <input type="text" id="lane4-review-title" placeholder="e.g. Outstanding hydrodynamic fit in open water" style="width:100%;max-width:550px;padding:9px 12px;border:1.5px solid #cbd5e1;border-radius:6px;font-size:13.5px;font-family:inherit;" />
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;color:#334155;margin-bottom:6px;">
              Detailed Review *
            </label>
            <textarea id="lane4-review-comment" required rows="4" placeholder="How did this gear perform in practice or competition? Tell other swimmers about fit, feel, durability..." style="width:100%;padding:10px 12px;border:1.5px solid #cbd5e1;border-radius:6px;font-size:13.5px;font-family:inherit;"></textarea>
          </div>

          <div style="display:flex;gap:10px;">
            <button type="submit" id="lane4-submit-review-btn" style="background:#0f172a;color:#ffffff;border:none;padding:12px 22px;border-radius:6px;font-size:12.5px;font-weight:600;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">
              Submit Review
            </button>
            <button type="button" id="lane4-cancel-review-btn" style="background:#e2e8f0;color:#475569;border:none;padding:12px 18px;border-radius:6px;font-size:12.5px;font-weight:600;cursor:pointer;">
              Cancel
            </button>
          </div>
        </form>
        <div id="lane4-review-alert" style="display:none;margin-top:14px;padding:12px;border-radius:6px;font-size:13px;font-weight:600;"></div>
      </div>

      <!-- Approved Reviews List -->
      <div id="lane4-approved-reviews-list">Loading verified reviews...</div>
    `;

    targetParent.appendChild(reviewSection);

    // Star selection interactive hover/click
    let selectedRating = 5;
    const stars = reviewSection.querySelectorAll('#lane4-star-selector span');
    function updateStarUI(val) {
      stars.forEach((s, idx) => {
        s.style.color = idx < val ? '#f59e0b' : '#cbd5e1';
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
        authorInput.value = user.displayName || user.email.split('@')[0];
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
        alert('Please provide your name.');
        authorInput.focus();
        return;
      }
      if (!comment) {
        alert('Please write a review comment.');
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

        reviewAlert.style.display = 'block';
        reviewAlert.style.background = '#f0fdf4';
        reviewAlert.style.color = '#15803d';
        reviewAlert.style.border = '1px solid #bbf7d0';
        reviewAlert.textContent = 'Thank you! Your review has been submitted for moderation and will appear here shortly.';
        reviewForm.reset();
        setTimeout(() => {
          container.style.display = 'none';
        }, 3500);
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
        listContainer.innerHTML = `
          <div style="padding:24px;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;text-align:center;">
            <div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:4px;">Be the first swimmer to review!</div>
            <div style="font-size:12.5px;color:#64748b;">Share your training or race-day experience with fellow swimmers.</div>
          </div>
        `;
        return;
      }

      const avg = reviews.reduce((sum, r) => sum + (r.rating || 5), 0) / reviews.length;
      countLabel.textContent = `${avg.toFixed(1)} / 5.0 (${reviews.length} ${reviews.length === 1 ? 'review' : 'reviews'})`;
      const quickRatingText = document.getElementById('lane4-quick-rating-text');
      if (quickRatingText) {
        quickRatingText.textContent = `${avg.toFixed(1)} (${reviews.length})`;
      }

      listContainer.innerHTML = reviews.map(r => {
        const starStr = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));
        const dateStr = r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

        return `
          <div style="border-bottom:1px solid #f1f5f9;padding:16px 0;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="color:#f59e0b;font-size:15px;letter-spacing:1px;">${starStr}</span>
                <span style="font-size:13.5px;font-weight:600;color:#0f172a;">${r.authorName || 'Verified Swimmer'}</span>
                ${r.isVerifiedPurchase ? `<span style="font-size:10px;font-weight:600;background:#dcfce7;color:#166534;padding:2px 6px;border-radius:4px;text-transform:uppercase;">Verified Purchase</span>` : ''}
              </div>
              <div style="font-size:12px;color:#94a3b8;">${dateStr}</div>
            </div>
            ${r.title ? `<div style="font-size:14px;font-weight:600;color:#0f172a;margin-bottom:4px;">${r.title}</div>` : ''}
            <div style="font-size:13px;color:#475569;line-height:1.5;">${r.comment}</div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.warn('Could not load product reviews:', err);
    }
  }

  // Export public methods for cross-module usage
  window.LANE4_CART = {
    open: openCartDrawer,
    close: closeCartDrawer,
    refresh: refreshCart
  };

  document.addEventListener('DOMContentLoaded', () => {
    createCartDrawerDOM();
    setupCartTriggers();
    setupProductPageForm();
    refreshCart();
  });
})();
