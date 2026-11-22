/**
 * LANE4 E-Commerce Checkout & Manual QR Payment Controller
 * High-performance, production-ready checkout controller with state/city dropdowns,
 * real-time quote recalculation, UPI QR verification, and full-fidelity order receipt.
 */

(function () {
  const INDIAN_STATES_AND_CITIES = {
    "Maharashtra": ["Nagpur", "Mumbai", "Pune", "Thane", "Nashik", "Navi Mumbai", "Aurangabad (Chhatrapati Sambhajinagar)", "Solapur", "Kolhapur", "Amravati", "Nanded", "Jalgaon", "Akola", "Other"],
    "Delhi": ["New Delhi", "Central Delhi", "South Delhi", "North Delhi", "East Delhi", "West Delhi", "Dwarka", "Rohini", "Other"],
    "Karnataka": ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi-Dharwad", "Belagavi", "Davanagere", "Kalaburagi", "Ballari", "Other"],
    "Kerala": ["Thiruvananthapuram (Trivandrum)", "Kochi", "Kozhikode", "Thrissur", "Kollam", "Kannur", "Alappuzha", "Palakkad", "Kottayam", "Malappuram", "Other"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tiruppur", "Erode", "Vellore", "Thoothukudi", "Dindigul", "Other"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar", "Gandhinagar", "Junagadh", "Anand", "Other"],
    "Telangana": ["Hyderabad", "Warangal", "Nizamabad", "Karimnagar", "Khammam", "Ramagundam", "Secunderabad", "Other"],
    "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore", "Kurnool", "Tirupati", "Kakinada", "Rajahmundry", "Kadapa", "Other"],
    "Uttar Pradesh": ["Lucknow", "Noida", "Greater Noida", "Ghaziabad", "Kanpur", "Agra", "Varanasi", "Prayagraj", "Meerut", "Bareilly", "Aligarh", "Other"],
    "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri", "Bardhaman", "Malda", "Kharagpur", "Other"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Bikaner", "Ajmer", "Udaipur", "Bhilwara", "Alwar", "Other"],
    "Madhya Pradesh": ["Bhopal", "Indore", "Jabalpur", "Gwalior", "Ujjain", "Sagar", "Dewas", "Satna", "Other"],
    "Punjab": ["Ludhiana", "Amritsar", "Jalandhar", "Patiala", "Bathinda", "Mohali", "Pathankot", "Other"],
    "Haryana": ["Gurugram", "Faridabad", "Panipat", "Ambala", "Yamunanagar", "Rohtak", "Hisar", "Karnal", "Sonipat", "Panchkula", "Other"],
    "Bihar": ["Patna", "Gaya", "Bhagalpur", "Muzaffarpur", "Purnia", "Darbhanga", "Bihar Sharif", "Other"],
    "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela", "Berhampur", "Sambalpur", "Puri", "Balasore", "Other"],
    "Assam": ["Guwahati", "Silchar", "Dibrugarh", "Jorhat", "Nagaon", "Tinsukia", "Tezpur", "Other"],
    "Chhattisgarh": ["Raipur", "Bhilai", "Bilaspur", "Korba", "Rajnandgaon", "Durg", "Other"],
    "Jharkhand": ["Ranchi", "Jamshedpur", "Dhanbad", "Bokaro", "Deoghar", "Hazaribagh", "Other"],
    "Uttarakhand": ["Dehradun", "Haridwar", "Roorkee", "Haldwani", "Rudrapur", "Rishikesh", "Nainital", "Other"],
    "Himachal Pradesh": ["Shimla", "Dharamshala", "Solan", "Mandi", "Kullu", "Manali", "Baddi", "Other"],
    "Goa": ["Panaji", "Margao", "Vasco da Gama", "Mapusa", "Ponda", "Other"],
    "Chandigarh": ["Chandigarh", "Other"],
    "Jammu and Kashmir": ["Srinagar", "Jammu", "Anantnag", "Baramulla", "Other"],
    "Ladakh": ["Leh", "Kargil", "Other"],
    "Puducherry": ["Puducherry", "Karaikal", "Mahe", "Yanam", "Other"],
    "Andaman and Nicobar Islands": ["Port Blair", "Other"],
    "Dadra and Nagar Haveli and Daman and Diu": ["Daman", "Diu", "Silvassa", "Other"],
    "Lakshadweep": ["Kavaratti", "Other"],
    "Arunachal Pradesh": ["Itanagar", "Naharlagun", "Pasighat", "Tawang", "Other"],
    "Manipur": ["Imphal", "Churachandpur", "Thoubal", "Other"],
    "Meghalaya": ["Shillong", "Tura", "Jowai", "Other"],
    "Mizoram": ["Aizawl", "Lunglei", "Champhai", "Other"],
    "Nagaland": ["Kohima", "Dimapur", "Mokokchung", "Other"],
    "Sikkim": ["Gangtok", "Namchi", "Geyzing", "Other"],
    "Tripura": ["Agartala", "Dharmanagar", "Udaipur", "Other"]
  };

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
      const nameInput = document.querySelector('input[name="name"], .w-commerce-commercecheckoutshippingfullname');
      if (nameInput && user.displayName) nameInput.value = user.displayName;
    }

    // 4. Setup State & City Dropdowns
    setupStateAndCityDropdowns();

    // 5. Calculate initial quote & render items and summary
    await recalculateQuote();

    // 6. Inject QR Payment Box
    injectQRPaymentSection();

    // 7. Wire Coupon Actions
    setupCouponSection();

    // 8. Wire Place Order Action
    setupPlaceOrderButton();
  }

  function setupStateAndCityDropdowns() {
    const stateSelect = document.getElementById('lane4-checkout-state');
    const citySelect = document.getElementById('lane4-checkout-city-select');
    const customCityInput = document.getElementById('lane4-checkout-city-custom');

    if (!stateSelect || !citySelect) return;

    // Populate states
    const states = Object.keys(INDIAN_STATES_AND_CITIES).sort();
    stateSelect.innerHTML = '<option value="">Select State / UT *</option>' +
      states.map(st => `<option value="${st}" ${st === 'Maharashtra' ? 'selected' : ''}>${st}</option>`).join('');

    function updateCities(selectedState, preserveCity = null) {
      const cities = INDIAN_STATES_AND_CITIES[selectedState] || ["Other"];
      citySelect.innerHTML = '<option value="">Select City *</option>' +
        cities.map(ct => `<option value="${ct}">${ct}</option>`).join('');

      if (preserveCity && cities.includes(preserveCity)) {
        citySelect.value = preserveCity;
        if (customCityInput) customCityInput.style.display = 'none';
      } else if (cities.length > 0 && cities[0] !== 'Other') {
        citySelect.value = cities[0];
        if (customCityInput) customCityInput.style.display = 'none';
      } else {
        citySelect.value = 'Other';
        if (customCityInput) customCityInput.style.display = 'block';
      }
    }

    // Initial population for default state (Maharashtra)
    updateCities('Maharashtra', 'Nagpur');

    stateSelect.addEventListener('change', () => {
      const st = stateSelect.value;
      if (st) {
        updateCities(st);
      } else {
        citySelect.innerHTML = '<option value="">Select State First</option>';
        if (customCityInput) customCityInput.style.display = 'none';
      }
      recalculateQuote();
    });

    citySelect.addEventListener('change', () => {
      if (citySelect.value === 'Other') {
        if (customCityInput) {
          customCityInput.style.display = 'block';
          customCityInput.focus();
        }
      } else {
        if (customCityInput) customCityInput.style.display = 'none';
      }
    });
  }

  async function recalculateQuote(couponCode = null) {
    const guestId = window.LANE4.getGuestId();
    let cartRes;
    try {
      cartRes = await window.lane4ApiRequest(`/cart?guestId=${encodeURIComponent(guestId)}`);
    } catch (e) {
      return;
    }
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
      renderOrderItems();
      renderOrderSummary();
    } catch (err) {
      console.error('Quote calculation error:', err);
    }
  }

  function renderOrderItems() {
    const container = document.getElementById('lane4-checkout-items-list') || document.querySelector('.w-commerce-commercecheckoutorderitemslist');
    if (!container || !checkoutQuote || !checkoutQuote.items) return;

    if (checkoutQuote.items.length === 0) {
      container.innerHTML = '<div style="padding:16px;text-align:center;color:#64748b;">No items in cart.</div>';
      return;
    }

    container.innerHTML = checkoutQuote.items.map(it => {
      const imgUrl = window.LANE4.resolveAssetUrl ? window.LANE4.resolveAssetUrl(it.imageUrl) : it.imageUrl;
      const variantText = [it.size ? `Size: ${it.size}` : '', it.color ? `Color: ${it.color}` : ''].filter(Boolean).join(' · ');

      return `
        <div style="display:flex;align-items:center;padding:14px 0;border-bottom:1px solid #f1f5f9;gap:14px;">
          <img src="${imgUrl}" alt="${it.name}" style="width:58px;height:58px;object-fit:cover;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0;flex-shrink:0;" />
          <div style="flex:1;min-width:0;">
            <div style="font-weight:800;font-size:13.5px;color:#0f172a;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${it.name}</div>
            ${variantText ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${variantText}</div>` : ''}
            <div style="font-size:12px;color:#475569;margin-top:4px;">
              <span>Qty: <strong>${it.quantity}</strong></span>
              <span style="color:#94a3b8;margin:0 4px;">•</span>
              <span>${it.unitPriceFormatted} each</span>
            </div>
          </div>
          <div style="font-weight:900;font-size:14.5px;color:#0f172a;text-align:right;">
            ${it.totalPriceFormatted}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderOrderSummary() {
    if (!checkoutQuote) return;

    // Subtotal
    const subtotalEl = document.getElementById('lane4-summary-subtotal');
    if (subtotalEl) {
      subtotalEl.textContent = checkoutQuote.pricing.subtotalFormatted;
    }

    // Shipping Badge & Summary
    const shippingBadge = document.getElementById('lane4-shipping-price-badge');
    const shippingSummary = document.getElementById('lane4-summary-shipping');
    const isFree = checkoutQuote.pricing.isFreeShipping;
    const shippingText = isFree ? 'FREE' : checkoutQuote.pricing.shippingFormatted;

    if (shippingBadge) {
      shippingBadge.textContent = shippingText;
      shippingBadge.style.color = isFree ? '#16a34a' : '#0f172a';
    }
    if (shippingSummary) {
      shippingSummary.textContent = shippingText;
      shippingSummary.style.color = isFree ? '#16a34a' : '#0f172a';
    }

    // Coupon Discount Row
    const discountRow = document.getElementById('lane4-summary-discount-row');
    const discountCodeSpan = document.getElementById('lane4-summary-discount-code');
    const discountVal = document.getElementById('lane4-summary-discount');

    if (discountRow) {
      if (checkoutQuote.pricing.couponDiscountPaise > 0) {
        discountRow.style.display = 'flex';
        if (discountCodeSpan) discountCodeSpan.textContent = checkoutQuote.pricing.couponCode;
        if (discountVal) discountVal.textContent = `-${checkoutQuote.pricing.couponDiscountFormatted}`;
      } else {
        discountRow.style.display = 'none';
      }
    }

    // Total
    const totalEl = document.getElementById('lane4-summary-total');
    if (totalEl) {
      totalEl.textContent = checkoutQuote.pricing.finalPayableFormatted;
    }

    // QR Amount Display
    const qrAmountDisplay = document.getElementById('lane4-qr-amount-display');
    if (qrAmountDisplay) {
      qrAmountDisplay.textContent = checkoutQuote.pricing.finalPayableFormatted;
    }
  }

  function setupCouponSection() {
    const applyBtn = document.getElementById('lane4-apply-coupon-btn');
    const input = document.getElementById('lane4-coupon-input');
    const msg = document.getElementById('lane4-coupon-msg');

    if (!applyBtn || !input) return;

    applyBtn.onclick = async () => {
      const code = input.value.trim();
      if (!code) {
        if (msg) {
          msg.style.display = 'block';
          msg.style.color = '#ef4444';
          msg.textContent = 'Please enter a coupon code.';
        }
        return;
      }

      applyBtn.disabled = true;
      applyBtn.textContent = '...';

      try {
        await recalculateQuote(code);
        if (checkoutQuote && checkoutQuote.coupon && checkoutQuote.coupon.isValid) {
          if (msg) {
            msg.style.display = 'block';
            msg.style.color = '#16a34a';
            msg.textContent = `Applied! Saved ${checkoutQuote.pricing.couponDiscountFormatted}`;
          }
        } else {
          if (msg) {
            msg.style.display = 'block';
            msg.style.color = '#ef4444';
            msg.textContent = (checkoutQuote && checkoutQuote.coupon && checkoutQuote.coupon.error) || 'Invalid coupon code';
          }
        }
      } catch (e) {
        if (msg) {
          msg.style.display = 'block';
          msg.style.color = '#ef4444';
          msg.textContent = e.message || 'Error applying coupon';
        }
      } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'APPLY';
      }
    };
  }

  function injectQRPaymentSection() {
    const paymentContainer = document.querySelector('.w-commerce-commercecheckoutpaymentinfowrapper') || document.querySelector('[data-node-type="commerce-checkout-payment-info-wrapper"]');
    if (!paymentContainer) return;

    // Suppress default Stripe elements
    const defaultFields = paymentContainer.querySelectorAll('fieldset, input, .w-commerce-commercecheckoutrow');
    defaultFields.forEach(f => f.style.display = 'none');

    let qrWrapper = document.getElementById('lane4-qr-checkout-container');
    if (qrWrapper) qrWrapper.remove();

    qrWrapper = document.createElement('div');
    qrWrapper.id = 'lane4-qr-checkout-container';
    qrWrapper.style.padding = '22px';
    qrWrapper.style.border = '2px solid #0f172a';
    qrWrapper.style.borderRadius = '10px';
    qrWrapper.style.background = '#ffffff';
    qrWrapper.style.marginTop = '16px';
    qrWrapper.style.marginBottom = '24px';
    qrWrapper.style.boxShadow = '0 6px 20px rgba(0,0,0,0.04)';

    const upiId = paymentSettings.upiId || 'lane4swim@upi';
    const upiName = paymentSettings.upiAccountName || 'THE LANE4 PERFORMANCE STORE';
    const qrUrl = paymentSettings.qrCodeUrl || '6424266ea05809dff501d86e/lane4-share.png';
    const instructions = (paymentSettings.paymentInstructions || '').replace(/\n/g, '<br/>');

    qrWrapper.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
        <span style="display:inline-block;background:#0f172a;color:#fff;font-weight:900;font-size:11px;padding:3px 8px;border-radius:4px;letter-spacing:1px;">STEP 3</span>
        <h4 style="margin:0;font-size:18px;font-weight:900;color:#0f172a;">Scan &amp; Pay via UPI</h4>
      </div>

      <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:8px;padding:14px;margin-bottom:20px;text-align:center;">
        <div style="font-size:11px;color:#64748b;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:4px;">PAYABLE ORDER AMOUNT:</div>
        <div id="lane4-qr-amount-display" style="font-size:28px;font-weight:900;color:#0f172a;letter-spacing:0.5px;">
          ${checkoutQuote ? checkoutQuote.pricing.finalPayableFormatted : 'Calculating...'}
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:20px;align-items:center;margin-bottom:20px;">
        <!-- QR Code Card with Tap to Enlarge -->
        <div id="lane4-checkout-qr-card" style="text-align:center;flex:0 0 170px;margin:0 auto;cursor:pointer;position:relative;background:#ffffff;border:1.5px solid #cbd5e1;border-radius:10px;padding:10px;box-shadow:0 4px 12px rgba(15,23,42,0.06);transition:all 0.2s cubic-bezier(0.16, 1, 0.3, 1);" title="Click to enlarge QR code for easy scanning">
          <div style="position:relative;width:150px;height:150px;margin:0 auto;background:#ffffff;display:flex;align-items:center;justify-content:center;">
            <img id="lane4-qr-img-display" src="${qrUrl}" alt="LANE4 Store UPI QR Code" style="width:150px;height:150px;object-fit:contain;border-radius:6px;display:block;" />
            <div style="position:absolute;bottom:4px;background:rgba(15,23,42,0.92);color:#ffffff;font-size:9.5px;font-weight:800;letter-spacing:0.5px;padding:3px 8px;border-radius:20px;display:flex;align-items:center;gap:4px;box-shadow:0 2px 6px rgba(0,0,0,0.25);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              <span>TAP TO ENLARGE</span>
            </div>
          </div>
          <div style="font-size:11.5px;font-weight:800;color:#0f172a;margin-top:8px;line-height:1.2;">Official Store UPI QR</div>
          <div style="font-size:10px;color:#64748b;margin-top:2px;">Click to scan in full size</div>
        </div>

        <!-- Instructions & UPI VPA -->
        <div style="flex:1;min-width:240px;">
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:11px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Store UPI ID (VPA)</label>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
              <code style="background:#f1f5f9;padding:8px 12px;border-radius:6px;font-size:14px;font-weight:800;color:#0f172a;flex:1;">${upiId}</code>
              <button type="button" id="lane4-copy-upi-btn" style="background:#0f172a;color:#fff;border:none;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:800;cursor:pointer;">COPY</button>
            </div>
            <div style="font-size:12px;color:#475569;margin-top:4px;">Account Name: <strong>${upiName}</strong></div>
          </div>
          <div style="font-size:12.5px;color:#334155;line-height:1.5;background:#f8fafc;padding:12px;border-radius:6px;border-left:3px solid #0f172a;">
            ${instructions}
          </div>
        </div>
      </div>

      <hr style="border:none;border-top:1px solid #f1f5f9;margin:20px 0;" />

      <!-- Payment Proof Form Inputs -->
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;color:#0f172a;">
          12-Digit UPI Transaction / UTR Reference ID <span style="color:#ef4444;">*</span>
        </label>
        <input type="text" id="lane4-utr-input" placeholder="e.g. 432109876543" maxlength="24" required style="width:100%;padding:12px 14px;border:1.5px solid #0f172a;border-radius:6px;font-size:15px;font-weight:800;letter-spacing:1px;box-sizing:border-box;" />
        <div style="font-size:12px;color:#64748b;margin-top:4px;">Found in your GPay / PhonePe / Paytm payment receipt as UTR or UPI Ref No.</div>
      </div>

      <div>
        <label style="display:block;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;color:#0f172a;">
          Upload Payment Screenshot Proof <span style="color:#ef4444;">*</span>
        </label>
        <input type="file" id="lane4-screenshot-file" accept="image/jpeg,image/png,image/webp" required style="display:block;width:100%;padding:12px;border:1.5px dashed #94a3b8;border-radius:6px;background:#f8fafc;cursor:pointer;font-size:13px;box-sizing:border-box;" />
        <div id="lane4-screenshot-preview" style="display:none;margin-top:10px;text-align:center;">
          <img id="lane4-preview-img" src="" alt="Payment Proof Preview" style="max-height:160px;border:1px solid #cbd5e1;border-radius:6px;box-shadow:0 4px 8px rgba(0,0,0,0.08);" />
        </div>
      </div>
    `;

    paymentContainer.appendChild(qrWrapper);

    // Click & Hover interactions for enlarged QR Modal
    const qrCard = document.getElementById('lane4-checkout-qr-card');
    if (qrCard) {
      qrCard.onmouseenter = () => {
        qrCard.style.transform = 'translateY(-2px) scale(1.02)';
        qrCard.style.boxShadow = '0 10px 24px -4px rgba(15,23,42,0.15)';
        qrCard.style.borderColor = '#0f172a';
      };
      qrCard.onmouseleave = () => {
        qrCard.style.transform = 'translateY(0) scale(1)';
        qrCard.style.boxShadow = '0 4px 12px rgba(15,23,42,0.06)';
        qrCard.style.borderColor = '#cbd5e1';
      };
      qrCard.onclick = () => openEnlargedQrModal();
    }

    // Copy UPI ID button
    const copyBtn = document.getElementById('lane4-copy-upi-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(upiId);
        copyBtn.textContent = 'COPIED!';
        copyBtn.style.background = '#16a34a';
        setTimeout(() => {
          copyBtn.textContent = 'COPY';
          copyBtn.style.background = '#0f172a';
        }, 1500);
      };
    }

    // Screenshot file preview
    const fileInput = document.getElementById('lane4-screenshot-file');
    if (fileInput) {
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

    function openEnlargedQrModal() {
      const existing = document.getElementById('lane4-enlarged-qr-modal');
      if (existing) existing.remove();

      const currentAmount = (document.getElementById('lane4-qr-amount-display')?.textContent || (checkoutQuote && checkoutQuote.pricing && checkoutQuote.pricing.finalPayableFormatted) || '').trim();
      const currentQrSrc = document.getElementById('lane4-qr-img-display')?.src || qrUrl;

      const modal = document.createElement('div');
      modal.id = 'lane4-enlarged-qr-modal';
      modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.78);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999999;
        padding: 16px;
        box-sizing: border-box;
      `;

      modal.innerHTML = `
        <div style="background:#ffffff;border-radius:14px;max-width:440px;width:100%;box-shadow:0 25px 50px -12px rgba(15,23,42,0.35);overflow:hidden;position:relative;box-sizing:border-box;">
          <div style="padding:16px 20px 12px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;justify-content:space-between;background:#ffffff;">
            <div>
              <div style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:#64748b;line-height:1;">LANE4 INSTANT SETTLEMENT</div>
              <div style="font-size:17px;font-weight:900;color:#0f172a;margin-top:3px;">Scan &amp; Pay via UPI</div>
            </div>
            <button type="button" id="lane4-close-qr-modal" style="background:#f1f5f9;border:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#475569;font-size:20px;cursor:pointer;" title="Close">&times;</button>
          </div>
          <div style="padding:20px;text-align:center;">
            ${currentAmount ? `
              <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 16px;display:inline-block;margin-bottom:14px;">
                <span style="font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;margin-right:6px;">PAYABLE:</span>
                <span style="font-size:20px;font-weight:900;color:#0f172a;letter-spacing:0.5px;">${currentAmount}</span>
              </div>
            ` : ''}
            <div style="background:#ffffff;border:2px solid #0f172a;border-radius:12px;padding:16px;display:inline-block;box-shadow:0 8px 24px -4px rgba(15,23,42,0.12);margin-bottom:14px;">
              <img src="${currentQrSrc}" alt="Enlarged UPI QR Code" style="width:280px;height:280px;max-width:68vw;max-height:68vw;object-fit:contain;display:block;margin:0 auto;" />
            </div>
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;font-size:10.5px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;">
              <span>Google Pay</span> • <span>PhonePe</span> • <span>Paytm</span> • <span>BHIM</span> • <span>Cred</span>
            </div>
            <div style="background:#f1f5f9;border-radius:8px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;">
              <div style="min-width:0;">
                <div style="font-size:9.5px;font-weight:800;color:#64748b;text-transform:uppercase;">Store UPI ID (VPA)</div>
                <div style="font-size:13px;font-weight:800;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${upiId}</div>
              </div>
              <button type="button" id="lane4-modal-copy-btn" style="background:#0f172a;color:#ffffff;border:none;padding:6px 12px;border-radius:5px;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap;flex-shrink:0;">COPY</button>
            </div>
          </div>
          <div style="padding:12px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:11px;color:#64748b;">Hold camera close to scan code</span>
            <button type="button" id="lane4-done-qr-modal" style="background:#0f172a;color:#ffffff;border:none;padding:7px 18px;border-radius:6px;font-size:12px;font-weight:800;cursor:pointer;">Done</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const closeModal = () => modal.remove();
      modal.onclick = (e) => { if (e.target === modal) closeModal(); };
      document.getElementById('lane4-close-qr-modal').onclick = closeModal;
      document.getElementById('lane4-done-qr-modal').onclick = closeModal;

      const mCopy = document.getElementById('lane4-modal-copy-btn');
      if (mCopy) {
        mCopy.onclick = () => {
          navigator.clipboard.writeText(upiId);
          mCopy.textContent = 'COPIED!';
          mCopy.style.background = '#16a34a';
          setTimeout(() => {
            mCopy.textContent = 'COPY';
            mCopy.style.background = '#0f172a';
          }, 1500);
        };
      }
    }
  }

  function setupPlaceOrderButton() {
    const placeOrderBtn = document.getElementById('lane4-place-order-btn') || document.querySelector('.w-commerce-commercecheckoutplaceorderbutton, .submit-order');
    if (!placeOrderBtn) return;

    placeOrderBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // Gather form values
      const email = document.querySelector('input[name="email"], #wf-ecom-email')?.value.trim();
      const name = document.querySelector('input.w-commerce-commercecheckoutshippingfullname, input[name="name"]')?.value.trim();
      const line1 = document.querySelector('input.w-commerce-commercecheckoutshippingstreetaddress, input[name="address_line1"]')?.value.trim();
      const line2 = document.querySelector('input.w-commerce-commercecheckoutshippingstreetaddressoptional, input[name="address_line2"]')?.value.trim() || '';

      const stateSelect = document.getElementById('lane4-checkout-state');
      const state = stateSelect ? stateSelect.value.trim() : (document.querySelector('input[name="address_state"]')?.value.trim() || 'Maharashtra');

      const citySelect = document.getElementById('lane4-checkout-city-select');
      const customCityInput = document.getElementById('lane4-checkout-city-custom');
      let city = '';
      if (citySelect && citySelect.value === 'Other' && customCityInput) {
        city = customCityInput.value.trim();
      } else if (citySelect) {
        city = citySelect.value.trim();
      } else {
        city = document.querySelector('input[name="address_city"]')?.value.trim();
      }

      const postalCode = document.querySelector('input.w-commerce-commercecheckoutshippingzippostalcode, #lane4-checkout-zip, input[name="address_zip"]')?.value.trim();
      const utr = document.getElementById('lane4-utr-input')?.value.trim();
      const fileInput = document.getElementById('lane4-screenshot-file');
      const screenshot = fileInput?.files[0];

      // Client Validations
      if (!email || !email.includes('@')) {
        alert('Please enter a valid customer email address.');
        document.querySelector('input[name="email"], #wf-ecom-email')?.focus();
        return;
      }
      if (!name) {
        alert('Please enter your full name for delivery.');
        document.querySelector('input[name="name"], .w-commerce-commercecheckoutshippingfullname')?.focus();
        return;
      }
      if (!line1) {
        alert('Please enter your complete street address.');
        document.querySelector('input[name="address_line1"], .w-commerce-commercecheckoutshippingstreetaddress')?.focus();
        return;
      }
      if (!state) {
        alert('Please select your delivery state.');
        stateSelect?.focus();
        return;
      }
      if (!city) {
        alert('Please select or enter your delivery city.');
        (citySelect?.value === 'Other' ? customCityInput : citySelect)?.focus();
        return;
      }
      if (!postalCode || postalCode.length < 5) {
        alert('Please enter a valid 6-digit PIN / postal code.');
        document.querySelector('input[name="address_zip"], #lane4-checkout-zip')?.focus();
        return;
      }
      if (!utr || utr.length < 6) {
        alert('Please enter your 12-digit UPI Transaction / UTR Reference ID.');
        document.getElementById('lane4-utr-input')?.focus();
        return;
      }
      if (!screenshot) {
        alert('Please upload your payment confirmation screenshot before placing order.');
        fileInput?.focus();
        return;
      }

      placeOrderBtn.disabled = true;
      placeOrderBtn.innerHTML = `
        <svg class="lane4-btn-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:lane4Spin 0.8s linear infinite;">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
        </svg>
        <span>SUBMITTING ORDER &amp; PAYMENT...</span>
      `;
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

        // 3. Clear cart cache and render order success receipt
        if (window.LANE4_CART && window.LANE4_CART.refresh) {
          window.LANE4_CART.refresh();
        }
        renderOrderSuccess(createdOrder, utr);
      } catch (err) {
        alert(err.message || 'Error processing order. Please check inputs and try again.');
        placeOrderBtn.disabled = false;
        placeOrderBtn.style.pointerEvents = 'auto';
        placeOrderBtn.innerHTML = `
          <span>PLACE ORDER &amp; SUBMIT PAYMENT</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        `;
      }
    }, true);
  }

  function renderOrderSuccess(order, utrNumber = '') {
    // 1. Completely remove or hide the Order Summary sidebar box
    const sidebar = document.getElementById('lane4-checkout-sidebar') || document.querySelector('.w-commerce-commercelayoutsidebar');
    if (sidebar) {
      sidebar.style.display = 'none';
      sidebar.remove();
    }

    // 2. Hide quick checkout actions
    const quickActions = document.querySelector('[data-node-type="commerce-cart-quick-checkout-actions"]');
    if (quickActions) quickActions.style.display = 'none';

    // 3. Expand layout container to full width centered
    const layoutContainer = document.querySelector('.w-commerce-commercelayoutcontainer');
    if (layoutContainer) {
      layoutContainer.style.display = 'block';
      layoutContainer.style.maxWidth = '780px';
      layoutContainer.style.margin = '0 auto';
    }

    const mainContainer = document.querySelector('.w-commerce-commercelayoutmain') || document.body;

    const itemsPurchasedHtml = (order.items || []).map(it => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:13.5px;">
        <div>
          <span style="font-weight:700;color:#0f172a;">${it.name}</span>
          ${it.size || it.color ? `<span style="color:#64748b;font-size:12px;"> (${[it.size, it.color].filter(Boolean).join(', ')})</span>` : ''}
          <span style="color:#64748b;"> &times; ${it.quantity}</span>
        </div>
        <div style="font-weight:800;color:#0f172a;">${it.totalPriceFormatted || window.LANE4.formatINR(it.pricePaise * it.quantity)}</div>
      </div>
    `).join('');

    mainContainer.innerHTML = `
      <div style="margin:20px auto 40px;padding:36px 30px;background:#ffffff;border:2px solid #0f172a;border-radius:12px;box-shadow:0 25px 50px -12px rgba(15,23,42,0.15);text-align:center;font-family:'Generalsans','General Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <!-- Checkmark Icon -->
        <div style="width:68px;height:68px;background:#16a34a;color:#ffffff;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 18px auto;box-shadow:0 8px 20px rgba(22,163,74,0.3);">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        
        <h2 style="font-size:24px;font-weight:900;color:#0f172a;margin:0 0 8px 0;letter-spacing:0.5px;">ORDER PLACED &amp; PAYMENT SUBMITTED!</h2>
        
        <div style="display:inline-block;background:#fef3c7;color:#92400e;padding:5px 14px;border-radius:20px;font-weight:800;font-size:11.5px;letter-spacing:1px;text-transform:uppercase;margin-bottom:20px;border:1px solid #fde68a;">
          Status: Verification Pending
        </div>

        <p style="font-size:15px;color:#475569;line-height:1.6;margin:0 0 22px 0;">
          Thank you for ordering with <strong>The Lane4 Performance Store</strong>! Your order <strong>#${order.orderNumber || order.orderId}</strong> has been logged.
        </p>

        <!-- Order Details Card -->
        <div style="background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;padding:20px;text-align:left;margin-bottom:22px;font-size:13.5px;line-height:1.7;">
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin-bottom:12px;">
            <div><span style="color:#64748b;">Order Number:</span> <strong>#${order.orderNumber || order.orderId}</strong></div>
            <div><span style="color:#64748b;">Total Paid:</span> <strong style="font-size:16px;color:#0f172a;">${order.pricing ? order.pricing.finalPayableFormatted : ''}</strong></div>
          </div>
          
          <div style="margin-bottom:12px;">
            <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;color:#64748b;letter-spacing:0.5px;margin-bottom:4px;">Items in this Order</div>
            ${itemsPurchasedHtml}
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:12px;margin-top:14px;padding-top:12px;border-top:1px solid #e2e8f0;">
            <div>
              <span style="color:#64748b;font-size:12px;display:block;font-weight:700;text-transform:uppercase;">Shipping To</span>
              <strong>${order.shippingAddress ? `${order.shippingAddress.addressee}, ${order.shippingAddress.addressLine1}${order.shippingAddress.addressLine2 ? ', ' + order.shippingAddress.addressLine2 : ''}, ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.postalCode}` : ''}</strong>
            </div>
            <div>
              <span style="color:#64748b;font-size:12px;display:block;font-weight:700;text-transform:uppercase;">Payment Info</span>
              <span>Method: <strong>Manual UPI Instant Transfer</strong></span><br/>
              ${utrNumber ? `<span>12-Digit Ref (UTR): <code style="background:#e2e8f0;padding:2px 6px;border-radius:4px;font-weight:700;">${utrNumber}</code></span>` : ''}
            </div>
          </div>
        </div>

        <!-- Verification Notice & Tracking Instructions -->
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;font-size:13px;color:#1e40af;line-height:1.6;margin-bottom:28px;text-align:left;">
          <strong>How do I track my order?</strong><br />
          Please save your Order Reference Number: <strong>#${order.orderNumber || order.orderId}</strong>.<br />
          You can track the progress of this order at any time without signing in: click <strong>Account &rarr; Track Order</strong> in the top navigation or use the Track Order button below. Once verified, courier partner and AWB dispatch tracking will be visible.
        </div>

        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <button type="button" onclick="if(window.openAuthModal){window.openAuthModal('track');}else{window.location.href='index.htm';}" style="background:#0f172a;color:#ffffff;padding:14px 24px;border:none;border-radius:8px;font-weight:800;letter-spacing:1px;font-size:13.5px;text-transform:uppercase;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span>TRACK THIS ORDER</span>
          </button>
          <a href="shop.html" style="background:#ffffff;color:#0f172a;padding:14px 24px;text-decoration:none;border-radius:8px;font-weight:800;letter-spacing:1px;font-size:13.5px;border:1.5px solid #cbd5e1;text-transform:uppercase;">CONTINUE SHOPPING</a>
          <a href="index.htm" style="background:#f1f5f9;color:#0f172a;padding:14px 24px;text-decoration:none;border-radius:8px;font-weight:800;letter-spacing:1px;font-size:13.5px;border:1px solid #cbd5e1;text-transform:uppercase;">RETURN HOME</a>
        </div>
      </div>
    `;

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Inject spinner animation style
  try {
    const s = document.createElement('style');
    s.textContent = `@keyframes lane4Spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(s);
  } catch(e) {}

  document.addEventListener('DOMContentLoaded', initCheckout);
})();
