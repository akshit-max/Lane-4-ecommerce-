/**
 * LANE4 E-Commerce Checkout & Manual QR Payment Controller
 * Connects checkout.html with real server-side quoting, coupon calculations,
 * dynamic store UPI QR code, UTR input, and Cloudinary screenshot upload.
 */

(function () {
  let checkoutQuote = null;
  let paymentSettings = null;
  let activeCoupon = null;

  async function initCheckout() {
    if (!window.location.pathname.includes('checkout')) return;

    // 1. Fetch Cart
    const guestId = window.LANE4.getGuestId();
    let cartRes;
    try {
      cartRes = await window.lane4ApiRequest(`/cart?guestId=${encodeURIComponent(guestId)}`);
    } catch (e) {
      alert('Unable to load your cart. Please return to the shop.');
      window.location.href = 'shop.html';
      return;
    }

    const cart = cartRes.data || { items: [] };
    if (!cart.items || cart.items.length === 0) {
      alert('Your cart is empty! Please add products before checking out.');
      window.location.href = 'shop.html';
      return;
    }

    // 2. Fetch Store Payment Settings
    try {
      const payRes = await window.lane4ApiRequest('/store/payment-settings');
      paymentSettings = payRes.data;
    } catch (e) {
      console.warn('Payment settings fallback');
      paymentSettings = {
        upiId: 'lane4swim@upi',
        upiAccountName: 'THE LANE4 PERFORMANCE STORE',
        paymentInstructions: '1. Scan the store QR code using any UPI app.\n2. Pay the exact order amount.\n3. Enter the 12-digit UPI Reference Number.\n4. Upload your payment screenshot and click Place Order.',
        qrCodeUrl: '6424266ea05809dff501d86e/lane4-share.png'
      };
    }

    // 3. Pre-fill customer information if signed in
    const user = window.LANE4.getUser();
    if (user) {
      const emailInput = document.querySelector('input[name="email"], #wf-ecom-email');
      if (emailInput) emailInput.value = user.email;
      const nameInput = document.querySelector('input[name="name"]');
      if (nameInput && user.displayName) nameInput.value = user.displayName;
    }

    // 4. Calculate initial quote
    await recalculateQuote();

    // 5. Inject QR Payment Box
    injectQRPaymentSection();

    // 6. Inject Coupon Code Box in Order Summary
    injectCouponSection();

    // 7. Wire Place Order Action
    setupPlaceOrderButton();
  }

  async function recalculateQuote(couponCode = null) {
    const guestId = window.LANE4.getGuestId();
    const cartRes = await window.lane4ApiRequest(`/cart?guestId=${encodeURIComponent(guestId)}`);
    const cart = cartRes.data || { items: [] };

    try {
      const quoteRes = await window.lane4ApiRequest('/checkout/quote', {
        method: 'POST',
        body: JSON.stringify({
          items: cart.items,
          couponCode: couponCode || activeCoupon,
          guestId
        })
      });

      checkoutQuote = quoteRes.data;
      if (checkoutQuote.coupon && checkoutQuote.coupon.isValid) {
        activeCoupon = checkoutQuote.coupon.code;
      }
      renderOrderSummary();
    } catch (err) {
      console.error('Quote calculation error:', err);
    }
  }

  function renderOrderSummary() {
    if (!checkoutQuote) return;

    // Render Items List
    const itemsListContainer = document.querySelector('.w-commerce-commercecheckoutorderitemslist');
    if (itemsListContainer) {
      itemsListContainer.innerHTML = checkoutQuote.items.map(it => `
        <div class="w-commerce-commercecheckoutorderitem" style="display:flex;align-items:center;padding:12px 0;border-bottom:1px solid #eee;gap:12px;">
          <img src="${window.LANE4.resolveAssetUrl ? window.LANE4.resolveAssetUrl(it.imageUrl) : it.imageUrl}" alt="${it.name}" style="width:54px;height:54px;object-fit:cover;border-radius:4px;background:#f5f5f5;" />
          <div style="flex:1;">
            <div style="font-weight:700;font-size:14px;color:#1a1a1a;">${it.name}</div>
            ${it.size || it.color ? `<div style="font-size:12px;color:#666;">${it.size ? `Size: ${it.size}` : ''} ${it.color ? `· Color: ${it.color}` : ''}</div>` : ''}
            <div style="font-size:12px;color:#777;">Qty: ${it.quantity} &times; ${it.unitPriceFormatted}</div>
          </div>
          <div style="font-weight:700;font-size:14px;color:#000;">${it.totalPriceFormatted}</div>
        </div>
      `).join('');
    }

    // Render Subtotal
    const subtotalEl = document.querySelector('[data-wf-bindings*="commerceOrder.subtotal"]');
    if (subtotalEl) {
      subtotalEl.textContent = checkoutQuote.pricing.subtotalFormatted;
    }

    // Render Shipping
    const extraItemsContainer = document.querySelector('.w-commerce-commercecheckoutordersummaryextraitemslist');
    if (extraItemsContainer) {
      extraItemsContainer.innerHTML = `
        <div class="w-commerce-commercecheckoutordersummaryextraitemslistitem" style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;">
          <div>Shipping Charges (${checkoutQuote.pricing.isFreeShipping ? 'Free Delivery' : 'Standard'})</div>
          <div style="font-weight:600;">${checkoutQuote.pricing.shippingFormatted}</div>
        </div>
        ${checkoutQuote.pricing.couponDiscountPaise > 0 ? `
          <div class="w-commerce-commercecheckoutordersummaryextraitemslistitem" style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#16a34a;">
            <div>Coupon Discount (${checkoutQuote.pricing.couponCode})</div>
            <div style="font-weight:700;">-${checkoutQuote.pricing.couponDiscountFormatted}</div>
          </div>
        ` : ''}
      `;
    }

    // Render Total
    const totalEl = document.querySelector('[data-wf-bindings*="commerceOrder.total"], .w-commerce-commercecheckoutsummarytotal');
    if (totalEl) {
      totalEl.textContent = checkoutQuote.pricing.finalPayableFormatted;
    }

    // Update amount in QR box if visible
    const qrAmountDisplay = document.getElementById('lane4-qr-amount-display');
    if (qrAmountDisplay) {
      qrAmountDisplay.textContent = checkoutQuote.pricing.finalPayableFormatted;
    }
  }

  function injectCouponSection() {
    const summaryBlock = document.querySelector('.w-commerce-commercecheckoutordersummarywrapper');
    if (!summaryBlock || document.getElementById('lane4-coupon-wrapper')) return;

    const couponDiv = document.createElement('div');
    couponDiv.id = 'lane4-coupon-wrapper';
    couponDiv.style.margin = '16px 0';
    couponDiv.style.padding = '14px';
    couponDiv.style.background = '#f8fafc';
    couponDiv.style.border = '1px solid #e2e8f0';
    couponDiv.style.borderRadius = '6px';

    couponDiv.innerHTML = `
      <label style="display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;color:#334155;">Promotional Coupon</label>
      <div style="display:flex;gap:8px;">
        <input type="text" id="lane4-coupon-input" placeholder="e.g. WELCOME10" style="flex:1;padding:8px 12px;border:1px solid #cbd5e1;border-radius:4px;font-size:14px;text-transform:uppercase;font-weight:600;" value="${activeCoupon || ''}" />
        <button type="button" id="lane4-apply-coupon-btn" style="background:#000;color:#fff;border:none;padding:8px 16px;border-radius:4px;font-weight:700;font-size:13px;cursor:pointer;">APPLY</button>
      </div>
      <div id="lane4-coupon-msg" style="font-size:12px;margin-top:6px;display:none;"></div>
    `;

    const summaryContent = summaryBlock.querySelector('fieldset');
    if (summaryContent) {
      summaryContent.appendChild(couponDiv);
    }

    // Button event
    document.getElementById('lane4-apply-coupon-btn').onclick = async () => {
      const input = document.getElementById('lane4-coupon-input');
      const msg = document.getElementById('lane4-coupon-msg');
      const code = input.value.trim();
      if (!code) {
        msg.style.display = 'block';
        msg.style.color = '#ef4444';
        msg.textContent = 'Please enter a coupon code.';
        return;
      }

      try {
        await recalculateQuote(code);
        if (checkoutQuote.coupon && checkoutQuote.coupon.isValid) {
          msg.style.display = 'block';
          msg.style.color = '#16a34a';
          msg.textContent = `Applied! You saved ${checkoutQuote.pricing.couponDiscountFormatted}`;
        } else {
          msg.style.display = 'block';
          msg.style.color = '#ef4444';
          msg.textContent = (checkoutQuote.coupon && checkoutQuote.coupon.error) || 'Invalid coupon code';
        }
      } catch (e) {
        msg.style.display = 'block';
        msg.style.color = '#ef4444';
        msg.textContent = e.message || 'Error applying coupon';
      }
    };
  }

  function injectQRPaymentSection() {
    // Find payment info block on checkout page
    const paymentContainer = document.querySelector('.w-commerce-commercecheckoutpaymentinfowrapper') || document.querySelector('[data-node-type="commerce-checkout-payment-info-wrapper"]');
    if (!paymentContainer) return;

    // Hide default Webflow credit card inputs
    const defaultFields = paymentContainer.querySelectorAll('fieldset, input, .w-commerce-commercecheckoutrow');
    defaultFields.forEach(f => f.style.display = 'none');

    const qrWrapper = document.createElement('div');
    qrWrapper.id = 'lane4-qr-checkout-container';
    qrWrapper.style.padding = '20px';
    qrWrapper.style.border = '2px solid #000000';
    qrWrapper.style.borderRadius = '8px';
    qrWrapper.style.background = '#ffffff';
    qrWrapper.style.marginTop = '16px';
    qrWrapper.style.marginBottom = '24px';

    const upiId = paymentSettings.upiId || 'lane4swim@upi';
    const upiName = paymentSettings.upiAccountName || 'THE LANE4 PERFORMANCE STORE';
    const qrUrl = paymentSettings.qrCodeUrl || '6424266ea05809dff501d86e/lane4-share.png';
    const instructions = (paymentSettings.paymentInstructions || '').replace(/\n/g, '<br/>');

    qrWrapper.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
        <span style="display:inline-block;background:#000;color:#fff;font-weight:800;font-size:12px;padding:4px 8px;border-radius:4px;letter-spacing:1px;">STEP 3</span>
        <h4 style="margin:0;font-size:18px;font-weight:800;color:#000;">Scan & Pay via UPI</h4>
      </div>

      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:16px;margin-bottom:20px;text-align:center;">
        <div style="font-size:13px;color:#64748b;font-weight:600;margin-bottom:6px;">PAYABLE AMOUNT:</div>
        <div id="lane4-qr-amount-display" style="font-size:28px;font-weight:900;color:#000;letter-spacing:0.5px;">
          ${checkoutQuote ? checkoutQuote.pricing.finalPayableFormatted : 'Calculating...'}
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:24px;align-items:center;margin-bottom:20px;">
        <!-- QR Code -->
        <div style="text-align:center;flex:0 0 160px;margin:0 auto;">
          <img src="${qrUrl}" alt="LANE4 Store UPI QR Code" style="width:160px;height:160px;object-fit:contain;border:1px solid #ddd;border-radius:6px;padding:4px;background:#fff;" />
          <div style="font-size:11px;color:#888;margin-top:4px;">Official Lane4 UPI QR</div>
        </div>

        <!-- Instructions & UPI VPA -->
        <div style="flex:1;min-width:240px;">
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;">Store UPI ID</label>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
              <code style="background:#f1f5f9;padding:8px 12px;border-radius:4px;font-size:15px;font-weight:700;color:#0f172a;flex:1;">${upiId}</code>
              <button type="button" id="lane4-copy-upi-btn" style="background:#000;color:#fff;border:none;padding:8px 14px;border-radius:4px;font-size:12px;font-weight:700;cursor:pointer;">COPY</button>
            </div>
            <div style="font-size:12px;color:#475569;margin-top:4px;">Account Name: <strong>${upiName}</strong></div>
          </div>
          <div style="font-size:13px;color:#334155;line-height:1.6;background:#f8fafc;padding:10px;border-radius:4px;border-left:3px solid #000;">
            ${instructions}
          </div>
        </div>
      </div>

      <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />

      <!-- Payment Proof Form Inputs -->
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;color:#0f172a;">
          12-Digit UPI Transaction / UTR Reference ID <span style="color:#ef4444;">*</span>
        </label>
        <input type="text" id="lane4-utr-input" placeholder="e.g. 432109876543" maxlength="24" required style="width:100%;padding:12px 14px;border:1.5px solid #000;border-radius:4px;font-size:15px;font-weight:700;letter-spacing:1px;box-sizing:border-box;" />
        <div style="font-size:12px;color:#64748b;margin-top:4px;">Found in your GPay / PhonePe / Paytm payment receipt as UTR or UPI Ref No.</div>
      </div>

      <div>
        <label style="display:block;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;color:#0f172a;">
          Upload Payment Screenshot Proof <span style="color:#ef4444;">*</span>
        </label>
        <input type="file" id="lane4-screenshot-file" accept="image/jpeg,image/png,image/webp" required style="display:block;width:100%;padding:10px;border:1px dashed #94a3b8;border-radius:4px;background:#f8fafc;cursor:pointer;font-size:13px;box-sizing:border-box;" />
        <div id="lane4-screenshot-preview" style="display:none;margin-top:10px;text-align:center;">
          <img id="lane4-preview-img" src="" style="max-height:160px;border:1px solid #ccc;border-radius:4px;box-shadow:0 4px 6px rgba(0,0,0,0.1);" />
        </div>
      </div>
    `;

    paymentContainer.appendChild(qrWrapper);

    // Copy UPI ID button
    document.getElementById('lane4-copy-upi-btn').onclick = () => {
      navigator.clipboard.writeText(upiId);
      const btn = document.getElementById('lane4-copy-upi-btn');
      btn.textContent = 'COPIED!';
      btn.style.background = '#16a34a';
      setTimeout(() => {
        btn.textContent = 'COPY';
        btn.style.background = '#000';
      }, 1500);
    };

    // Screenshot file preview
    const fileInput = document.getElementById('lane4-screenshot-file');
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const preview = document.getElementById('lane4-screenshot-preview');
        const img = document.getElementById('lane4-preview-img');
        const reader = new FileReader();
        reader.onload = (evt) => {
          img.src = evt.target.result;
          preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    };
  }

  function setupPlaceOrderButton() {
    const placeOrderBtn = document.querySelector('.w-commerce-commercecheckoutplaceorderbutton, .submit-order');
    if (!placeOrderBtn) return;

    placeOrderBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      // Gather form values
      const email = document.querySelector('input[name="email"], #wf-ecom-email')?.value.trim();
      const name = document.querySelector('input.w-commerce-commercecheckoutshippingfullname, input[name="name"]')?.value.trim();
      const line1 = document.querySelector('input.w-commerce-commercecheckoutshippingstreetaddress, input[name="address_line1"]')?.value.trim();
      const line2 = document.querySelector('input.w-commerce-commercecheckoutshippingstreetaddressoptional, input[name="address_line2"]')?.value.trim() || '';
      const city = document.querySelector('input.w-commerce-commercecheckoutshippingcity, input[name="address_city"]')?.value.trim();
      const state = document.querySelector('input.w-commerce-commercecheckoutshippingstateprovince, input[name="address_state"]')?.value.trim() || 'Maharashtra';
      const postalCode = document.querySelector('input.w-commerce-commercecheckoutshippingzippostalcode, input[name="address_zip"]')?.value.trim();

      const utr = document.getElementById('lane4-utr-input')?.value.trim();
      const fileInput = document.getElementById('lane4-screenshot-file');
      const screenshot = fileInput?.files[0];

      // Client Validations
      if (!email || !email.includes('@')) {
        alert('Please enter a valid customer email address.');
        return;
      }
      if (!name || !line1 || !city || !postalCode) {
        alert('Please complete all required shipping address fields.');
        return;
      }
      if (!utr || utr.length < 6) {
        alert('Please enter your 12-digit UPI / UTR Transaction Reference ID.');
        document.getElementById('lane4-utr-input')?.focus();
        return;
      }
      if (!screenshot) {
        alert('Please upload your payment confirmation screenshot before placing order.');
        fileInput?.focus();
        return;
      }

      placeOrderBtn.textContent = 'Processing & Verifying Order...';
      placeOrderBtn.style.pointerEvents = 'none';

      try {
        const guestId = window.LANE4.getGuestId();
        const cartRes = await window.lane4ApiRequest(`/cart?guestId=${encodeURIComponent(guestId)}`);
        const cart = cartRes.data || { items: [] };

        // 1. Create order on backend
        const orderPayload = {
          customerEmail: email,
          customerPhone: '',
          shippingAddress: {
            addressee: name,
            addressLine1: line1,
            addressLine2: line2,
            city,
            state,
            postalCode
          },
          items: cart.items,
          couponCode: activeCoupon,
          guestId
        };

        const orderRes = await window.lane4ApiRequest('/orders', {
          method: 'POST',
          body: JSON.stringify(orderPayload)
        });

        const createdOrder = orderRes.data;

        // 2. Upload Payment Proof
        const formData = new FormData();
        formData.append('orderId', createdOrder.orderId);
        formData.append('upiReferenceNumber', utr);
        formData.append('screenshot', screenshot);

        await window.lane4ApiRequest('/payments/proof', {
          method: 'POST',
          body: formData
        });

        // 3. Render Success / Awaiting Verification Screen
        renderOrderSuccess(createdOrder);
      } catch (err) {
        alert(err.message || 'Error processing order. Please check inputs and try again.');
        placeOrderBtn.textContent = 'Place Order';
        placeOrderBtn.style.pointerEvents = 'auto';
      }
    });
  }

  function renderOrderSuccess(order) {
    const mainContainer = document.querySelector('.w-commerce-commercelayoutmain') || document.querySelector('body');

    mainContainer.innerHTML = `
      <div style="max-width:680px;margin:40px auto;padding:40px;background:#ffffff;border:2px solid #000;border-radius:8px;box-shadow:0 20px 40px rgba(0,0,0,0.08);text-align:center;font-family:inherit;">
        <div style="width:72px;height:72px;line-height:72px;background:#16a34a;color:#fff;border-radius:50%;font-size:36px;margin:0 auto 20px auto;">&check;</div>
        
        <h2 style="font-size:26px;font-weight:900;color:#000;margin-bottom:8px;">ORDER PLACED & PAYMENT SUBMITTED!</h2>
        <div style="display:inline-block;background:#fef3c7;color:#92400e;padding:6px 14px;border-radius:20px;font-weight:700;font-size:13px;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px;">
          Status: Verification Pending
        </div>

        <p style="font-size:16px;color:#334155;line-height:1.6;margin-bottom:24px;">
          Thank you for ordering with <strong>The Lane4 Performance Store</strong>! Your order <strong>#${order.orderNumber || order.orderId}</strong> has been logged.
        </p>

        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:20px;text-align:left;margin-bottom:24px;font-size:14px;line-height:1.8;">
          <div><strong>Order Number:</strong> #${order.orderNumber || order.orderId}</div>
          <div><strong>Total Payable:</strong> ${order.pricing ? order.pricing.finalPayableFormatted : ''}</div>
          <div><strong>Shipping To:</strong> ${order.shippingAddress ? `${order.shippingAddress.addressee}, ${order.shippingAddress.addressLine1}, ${order.shippingAddress.city}` : ''}</div>
          <div><strong>Payment Method:</strong> Manual UPI Transfer</div>
        </div>

        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:16px;font-size:13px;color:#1e40af;line-height:1.6;margin-bottom:30px;">
          <strong>What happens next?</strong><br />
          Our staff at our Nagpur specialty store is verifying your transaction against our bank account records. Once approved, your order status will update to <strong>Confirmed &amp; Processing</strong>, and we will email you tracking details as soon as it ships!
        </div>

        <div style="display:flex;gap:12px;justify-content:center;">
          <a href="shop.html" style="background:#000;color:#fff;padding:14px 28px;text-decoration:none;border-radius:4px;font-weight:700;letter-spacing:1px;font-size:14px;">CONTINUE SHOPPING</a>
          <a href="index.htm" style="background:#f1f5f9;color:#0f172a;padding:14px 28px;text-decoration:none;border-radius:4px;font-weight:700;letter-spacing:1px;font-size:14px;border:1px solid #cbd5e1;">RETURN HOME</a>
        </div>
      </div>
    `;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.addEventListener('DOMContentLoaded', initCheckout);
})();

