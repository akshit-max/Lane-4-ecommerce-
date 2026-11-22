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

    const path = window.location.pathname;
    const match = path.match(/\/product\/([a-zA-Z0-9-]+)(?:\.html)?/);
    const slug = match ? match[1] : null;

    if (!slug) return;

    try {
      const res = await window.lane4ApiRequest(`/products/${encodeURIComponent(slug)}`);
      const product = res.data;
      if (!product) return;

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

        const submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');
        const origVal = submitBtn ? submitBtn.value : 'Buy Now Online';
        if (submitBtn) {
          submitBtn.value = 'Adding to cart...';
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
        } catch (err) {
          alert(err.message || 'Unable to add product to cart.');
        } finally {
          if (submitBtn) {
            submitBtn.value = origVal;
            submitBtn.disabled = false;
          }
        }
      };

      form.addEventListener('submit', handleAddToCart, true);
      form.addEventListener('click', (e) => {
        const clickedBuy = e.target.closest('.buy-now-wrapper, .w-commerce-commerceaddtocartbutton, [data-node-type="commerce-add-to-cart-button"], input[type="submit"]');
        if (clickedBuy) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          handleAddToCart(e);
        }
      }, true);
    } catch (err) {
      console.warn('Could not load dynamic product variants:', err);
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
