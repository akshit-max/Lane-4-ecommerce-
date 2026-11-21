/**
 * LANE4 E-Commerce Shopping Cart Controller
 * Connects the existing Webflow right-sidebar cart drawer and product add-to-cart buttons.
 */

(function () {
  // Ensure legacy Webflow cart error container never flashes or blocks checkout
  try {
    const styleEl = document.createElement('style');
    styleEl.textContent = `
      .w-commerce-commercecarterrorstate,
      [data-node-type="commerce-cart-error"] {
        display: none !important;
      }
    `;
    document.head.appendChild(styleEl);
  } catch (e) {}

  // Suppress legacy Webflow Apollo ecommerce background errors from console
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

  let activeCart = { items: [], subtotalPaise: 0, totalItemsCount: 0 };

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
    const badges = document.querySelectorAll('.cart-quantity, .w-commerce-commercecartopenlinkcount');
    badges.forEach(badge => {
      badge.textContent = activeCart.totalItemsCount || 0;
    });
  }

  function renderCartDrawer() {
    const cartWrapper = document.querySelector('.w-commerce-commercecartcontainerwrapper');
    if (!cartWrapper) return;

    const cartForm = cartWrapper.querySelector('.w-commerce-commercecartform');
    const emptyState = cartWrapper.querySelector('.w-commerce-commercecartemptystate');
    const itemsList = cartWrapper.querySelector('.w-commerce-commercecartitemlist, [data-wf-collection*="commerceOrder.userItems"]') || cartForm;

    if (!activeCart.items || activeCart.items.length === 0) {
      if (cartForm) cartForm.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    if (emptyState) emptyState.style.display = 'none';
    if (cartForm) cartForm.style.display = 'block';

    // Hide any legacy Webflow cart error messages
    const errorState = cartWrapper.querySelector('.w-commerce-commercecarterrorstate, [data-node-type="commerce-cart-error"]');
    if (errorState) {
      errorState.style.display = 'none';
    }

    // Build or populate items container
    let container = cartWrapper.querySelector('#lane4-cart-items-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'lane4-cart-items-container';
      container.style.maxHeight = '55vh';
      container.style.overflowY = 'auto';
      container.style.padding = '8px 0';
      if (cartForm.firstChild) {
        cartForm.insertBefore(container, cartForm.firstChild);
      } else {
        cartForm.appendChild(container);
      }
    }

    container.innerHTML = activeCart.items.map(item => `
      <div class="w-commerce-commercecartitem" style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #eee;gap:12px;">
        <img src="${window.LANE4.resolveAssetUrl ? window.LANE4.resolveAssetUrl(item.imageUrl) : (item.imageUrl || '')}" alt="${item.name}" style="width:64px;height:64px;object-fit:cover;border-radius:4px;background:#f5f5f5;" />
        <div style="flex:1;">
          <div style="font-weight:700;font-size:14px;color:#1a1a1a;">${item.name}</div>
          ${item.variantLabel ? `<div style="font-size:12px;color:#666;">${item.variantLabel}</div>` : ''}
          <div style="font-size:13px;font-weight:600;margin-top:2px;">${window.LANE4.formatINR(item.pricePaise)}</div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
            <label style="font-size:11px;text-transform:uppercase;color:#888;">Qty</label>
            <input type="number" min="1" max="99" value="${item.quantity}" data-item-id="${item.itemId}" class="lane4-qty-input" style="width:48px;padding:3px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;" />
            <button type="button" data-remove-id="${item.itemId}" class="lane4-remove-btn" style="background:none;border:none;color:#ef4444;font-size:11px;text-transform:uppercase;cursor:pointer;margin-left:auto;">Remove</button>
          </div>
        </div>
      </div>
    `).join('');

    // Update Subtotal Display
    const subtotalEls = cartWrapper.querySelectorAll('[data-wf-bindings*="commerceOrder.subtotal"], .w-commerce-commercecartsubtotal');
    subtotalEls.forEach(el => {
      el.textContent = window.LANE4.formatINR(activeCart.subtotalPaise);
    });

    // Wire Quantity Change Listeners
    container.querySelectorAll('.lane4-qty-input').forEach(input => {
      input.onchange = async () => {
        const itemId = input.getAttribute('data-item-id');
        const qty = parseInt(input.value, 10);
        try {
          const guestId = window.LANE4.getGuestId();
          const res = await window.lane4ApiRequest(`/cart/items/${encodeURIComponent(itemId)}`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity: qty, guestId })
          });
          activeCart = res.data;
          updateCartBadge();
          renderCartDrawer();
        } catch (err) {
          alert(err.message || 'Error updating cart');
          refreshCart();
        }
      };
    });

    // Wire Remove Button Listeners
    container.querySelectorAll('.lane4-remove-btn').forEach(btn => {
      btn.onclick = async () => {
        const itemId = btn.getAttribute('data-remove-id');
        try {
          const guestId = window.LANE4.getGuestId();
          const res = await window.lane4ApiRequest(`/cart/items/${encodeURIComponent(itemId)}?guestId=${encodeURIComponent(guestId)}`, {
            method: 'DELETE'
          });
          activeCart = res.data;
          updateCartBadge();
          renderCartDrawer();
        } catch (err) {
          alert(err.message || 'Error removing item');
        }
      };
    });
  }

  function openCartDrawer() {
    const wrapper = document.querySelector('.w-commerce-commercecartcontainerwrapper');
    if (wrapper) {
      wrapper.style.display = 'block';
    }
  }

  function closeCartDrawer() {
    const wrapper = document.querySelector('.w-commerce-commercecartcontainerwrapper');
    if (wrapper) {
      wrapper.style.display = 'none';
    }
  }

  function setupCartTriggers() {
    // Open links
    document.querySelectorAll('[data-node-type="commerce-cart-open-link"], .cart-button').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openCartDrawer();
        refreshCart();
      });
    });

    // Close links
    document.querySelectorAll('[data-node-type="commerce-cart-close-link"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        closeCartDrawer();
      });
    });

    // Checkout button link inside cart
    document.querySelectorAll('.w-commerce-commercecartcheckoutbutton, a[href*="checkout"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (!activeCart || !activeCart.totalItemsCount || activeCart.totalItemsCount === 0) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          alert('Your cart is empty! Please select swimming products before checking out.');
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const isInSubfolder = /\/(product|category|blog|authors|utility-pages|category-blog)\//i.test(window.location.pathname);
        window.location.href = isInSubfolder ? '../checkout.html' : 'checkout.html';
      }, true);
    });

    // Delegated checkout click interceptor to guarantee navigation across dynamic re-renders
    document.addEventListener('click', (e) => {
      const checkoutBtn = e.target && e.target.closest && e.target.closest('.w-commerce-commercecartcheckoutbutton, a[href*="checkout"]');
      if (checkoutBtn && checkoutBtn.closest('.w-commerce-commercecartcontainerwrapper')) {
        if (!activeCart || !activeCart.totalItemsCount || activeCart.totalItemsCount === 0) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          alert('Your cart is empty! Please select swimming products before checking out.');
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const isInSubfolder = /\/(product|category|blog|authors|utility-pages|category-blog)\//i.test(window.location.pathname);
        window.location.href = isInSubfolder ? '../checkout.html' : 'checkout.html';
      }
    }, true);
  }

  /**
   * Hook "Buy Now Online" form on product pages
   */
  async function setupProductPageForm() {
    const form = document.querySelector('form.w-commerce-commerceaddtocartform, [data-node-type="commerce-add-to-cart-form"]');
    if (!form) return;

    // Detect current product slug
    const path = window.location.pathname;
    const match = path.match(/\/product\/([a-zA-Z0-9-]+)(?:\.html)?/);
    const slug = match ? match[1] : null;

    if (!slug) return;

    try {
      const res = await window.lane4ApiRequest(`/products/${encodeURIComponent(slug)}`);
      const product = res.data;
      if (!product) return;

      // Check if product has variants to select
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
            <label style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;color:#1a1a1a;">
              Select Option / Size / Color
            </label>
            <select id="lane4-variant-select" style="width:100%;max-width:320px;padding:10px 14px;border:1px solid #1a1a1a;border-radius:4px;font-size:14px;background:#fff;font-family:inherit;font-weight:600;">
              ${optionsHtml}
            </select>
          `;

          // Insert before the buy now button
          const btnWrapper = form.querySelector('.pd-buttons-wrapper, .buy-now-wrapper') || form.firstChild;
          form.insertBefore(variantContainer, btnWrapper);
        }
      }

      // Handle submit in capturing phase to intercept before Webflow
      const handleAddToCart = async (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
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

      // Also intercept direct button click and button wrapper clicks in capture phase
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

  document.addEventListener('DOMContentLoaded', () => {
    setupCartTriggers();
    setupProductPageForm();
    refreshCart();
  });
})();

