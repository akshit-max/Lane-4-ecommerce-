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

  function normalizeIndianPhoneInput(raw) {
    let digits = String(raw || '').replace(/\D/g, '');
    if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
    else if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
    return digits.slice(0, 10);
  }

  function formatIndianPhoneDisplay(raw) {
    return normalizeIndianPhoneInput(raw);
  }

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
      console.warn('Unable to load cart:', e);
      window.location.replace('index.htm');
      return;
    }

    const cart = cartRes.data || { items: [] };
    if (!cart.items || cart.items.length === 0) {
      // Cart is empty (or on refresh after placing order) -> redirect smoothly to home page
      window.location.replace('index.htm');
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

    // 3. Pre-fill customer information if signed in or prompt login
    const user = window.LANE4.getUser();
    if (user) {
      const emailInput = document.querySelector('input[name="email"], #wf-ecom-email');
      if (emailInput && !emailInput.value) emailInput.value = user.email || '';
      const nameInput = document.querySelector('input[name="name"], .w-commerce-commercecheckoutshippingfullname');
      const candidateName = user.displayName || user.name || user.fullName || (user.email ? user.email.split('@')[0].charAt(0).toUpperCase() + user.email.split('@')[0].slice(1) : '');
      if (nameInput && !nameInput.value && candidateName) nameInput.value = candidateName;
      const phoneInput = document.querySelector('#lane4-checkout-phone, input[type="tel"]');
      if (phoneInput && !phoneInput.value && user.phoneNumber) phoneInput.value = normalizeIndianPhoneInput(user.phoneNumber);
    } else {
      setTimeout(() => {
        if (window.LANE4_AUTH && window.LANE4_AUTH.open) {
          window.LANE4_AUTH.open('login');
          if (window.LANE4_AUTH.showAlert) {
            window.LANE4_AUTH.showAlert('Please sign in or create an account to complete checkout and place your order.', 'info');
          }
        }
      }, 300);

      const mainContainer = document.querySelector('.w-commerce-commercelayoutmain') || document.querySelector('form');
      if (mainContainer && !document.getElementById('lane4-checkout-auth-banner')) {
        const banner = document.createElement('div');
        banner.id = 'lane4-checkout-auth-banner';
        banner.style.cssText = 'margin-bottom:24px;background:#ffffff;border:1px solid #111111;border-left:3px solid #b91c1c;border-radius:0px;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-family:\'Generalsans\',\'General Sans\',sans-serif;';
        banner.innerHTML = `
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:36px;height:36px;border-radius:0px;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="0" ry="0"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            </div>
            <div>
              <div style="font-size:14px;font-weight:500;color:#111111;">Sign In Required to Complete Checkout</div>
              <div style="font-size:12.5px;color:#666666;line-height:1.4;">Please sign in or create a swimmer account to complete your order and submit payment.</div>
            </div>
          </div>
          <button type="button" id="lane4-checkout-login-trigger" style="background:#000000;color:#ffffff;border:1px solid #000000;padding:10px 18px;border-radius:0px;font-size:11.5px;font-weight:500;letter-spacing:0.8px;text-transform:uppercase;cursor:pointer;">
            SIGN IN / REGISTER &rarr;
          </button>
        `;
        mainContainer.insertBefore(banner, mainContainer.firstChild);
        const trig = banner.querySelector('#lane4-checkout-login-trigger');
        if (trig) {
          trig.onclick = () => {
            if (window.LANE4_AUTH && window.LANE4_AUTH.open) {
              window.LANE4_AUTH.open('login');
            }
          };
        }
      }
    }

    // 4. Setup State & City Dropdowns, Saved Addresses and strict input restrictions
    setupStateAndCityDropdowns();
    setupSavedAddressesDropdown();
    setupInputRestrictions();

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

    // Populate states without pre-selecting any default
    const states = Object.keys(INDIAN_STATES_AND_CITIES).sort();
    stateSelect.innerHTML = '<option value="" disabled selected>Select State / UT</option>' +
      states.map(st => `<option value="${st}">${st}</option>`).join('');

    // City starts disabled with placeholder until state is chosen
    citySelect.innerHTML = '<option value="" disabled selected>Select State first</option>';
    citySelect.disabled = true;

    function updateCities(selectedState, preserveCity = null) {
      if (!selectedState) {
        citySelect.innerHTML = '<option value="" disabled selected>Select State first</option>';
        citySelect.disabled = true;
        if (customCityInput) customCityInput.style.display = 'none';
        return;
      }
      citySelect.disabled = false;
      const cities = INDIAN_STATES_AND_CITIES[selectedState] || ["Other"];
      citySelect.innerHTML = '<option value="" disabled selected>Select City</option>' +
        cities.map(ct => `<option value="${ct}">${ct}</option>`).join('');

      if (preserveCity && cities.includes(preserveCity)) {
        citySelect.value = preserveCity;
        if (customCityInput) customCityInput.style.display = 'none';
      } else {
        citySelect.value = '';
        if (customCityInput) customCityInput.style.display = 'none';
      }
    }

    stateSelect.addEventListener('change', () => {
      const st = stateSelect.value;
      if (st) {
        updateCities(st);
        recalculateQuote();
      } else {
        citySelect.innerHTML = '<option value="" disabled selected>Select State first</option>';
        citySelect.disabled = true;
        if (customCityInput) customCityInput.style.display = 'none';
      }
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

  async function setupSavedAddressesDropdown() {
    const user = window.LANE4.getUser();
    if (!user) return;

    // Look for shipping info container
    const shippingSection = document.querySelector('.w-commerce-commercecheckoutshippingaddresswrapper') || document.querySelector('.w-commerce-commercecheckoutcustomerinfosummarywrapper') || document.querySelector('form');
    if (!shippingSection) return;

    // Check if phone field exists in shipping section, otherwise inject it
    let phoneInput = document.getElementById('lane4-checkout-phone');
    if (!phoneInput) {
      const phoneWrapper = document.createElement('div');
      phoneWrapper.id = 'lane4-checkout-phone-wrapper';
      phoneWrapper.style.cssText = 'margin-bottom:14px;';
      phoneWrapper.innerHTML = `
        <label class="w-commerce-commercecheckoutlabel" style="font-size:11px;font-weight: 500;text-transform:uppercase;letter-spacing:0.8px;color:#333333;margin-bottom:6px;display:block;">
          Mobile Phone Number (for shipment updates) *
        </label>
        <input type="tel" id="lane4-checkout-phone" class="w-input lane4-phone-input lane4-checkout-input" placeholder="10-digit mobile number" value="${normalizeIndianPhoneInput(user.phoneNumber || '')}" />
      `;
      const nameInput = document.querySelector('input.w-commerce-commercecheckoutshippingfullname, input[name="name"]');
      if (nameInput && nameInput.parentElement) {
        nameInput.parentElement.parentElement.insertBefore(phoneWrapper, nameInput.parentElement.nextSibling);
      } else {
        shippingSection.insertBefore(phoneWrapper, shippingSection.firstChild);
      }
    }

    try {
      const res = await window.lane4ApiRequest('/customers/addresses');
      const addresses = (res && res.data) || [];
      if (addresses.length === 0) return;

      let savedAddrWrapper = document.getElementById('lane4-saved-addresses-selector-wrapper');
      if (!savedAddrWrapper) {
        savedAddrWrapper = document.createElement('div');
        savedAddrWrapper.id = 'lane4-saved-addresses-selector-wrapper';
        savedAddrWrapper.style.cssText = 'margin-bottom:18px;background:#fafafa;border:1px solid #dcdcdc;border-radius:0px;padding:14px 16px;';
        savedAddrWrapper.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#111111" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span style="font-size:11px;font-weight: 500;color:#111111;text-transform:uppercase;letter-spacing:0.8px;">Deliver to Saved Address</span>
          </div>
          <select id="lane4-saved-addr-select" class="lane4-checkout-select" style="margin-top:6px;">
            <option value="">Choose a Saved Delivery Address (or fill below)</option>
            ${addresses.map((a, i) => `<option value="${i}">${a.addressee} — ${a.addressLine1}, ${a.city} (${a.postalCode})</option>`).join('')}
          </select>
        `;

        const nameInput = document.querySelector('input.w-commerce-commercecheckoutshippingfullname, input[name="name"]');
        if (nameInput && nameInput.closest('.w-commerce-commercecheckoutblockheader, .w-commerce-commercecheckoutshippingaddresswrapper')) {
          const block = nameInput.closest('.w-commerce-commercecheckoutshippingaddresswrapper') || shippingSection;
          block.insertBefore(savedAddrWrapper, block.firstChild);
        } else {
          shippingSection.insertBefore(savedAddrWrapper, shippingSection.firstChild);
        }

        const selectEl = document.getElementById('lane4-saved-addr-select');
        selectEl.onchange = () => {
          const idx = selectEl.value;
          if (idx === '' || !addresses[idx]) return;
          const a = addresses[idx];

          const nameEl = document.querySelector('input.w-commerce-commercecheckoutshippingfullname, input[name="name"]');
          if (nameEl) nameEl.value = a.addressee || '';

          const phoneEl = document.getElementById('lane4-checkout-phone');
          if (phoneEl) phoneEl.value = normalizeIndianPhoneInput(a.phone || '');

          const line1El = document.querySelector('input[name="address_line1"], input.w-commerce-commercecheckoutshippingstreetaddress:not(#lane4-checkout-phone)');
          if (line1El) line1El.value = a.addressLine1 || '';

          const line2El = document.querySelector('input.w-commerce-commercecheckoutshippingstreetaddressoptional, input[name="address_line2"]');
          if (line2El) line2El.value = a.addressLine2 || '';

          const stateSelect = document.getElementById('lane4-checkout-state');
          if (stateSelect && a.state) {
            stateSelect.value = a.state;
            stateSelect.dispatchEvent(new Event('change'));
          }

          setTimeout(() => {
            const citySelect = document.getElementById('lane4-checkout-city-select');
            if (citySelect && a.city) {
              const hasCity = Array.from(citySelect.options).some(o => o.value.toLowerCase() === a.city.toLowerCase());
              if (hasCity) {
                citySelect.value = a.city;
              } else {
                citySelect.value = 'Other';
                const customCityInput = document.getElementById('lane4-checkout-city-custom');
                if (customCityInput) {
                  customCityInput.style.display = 'block';
                  customCityInput.value = a.city;
                }
              }
              citySelect.dispatchEvent(new Event('change'));
            }
          }, 50);

          const pinEl = document.querySelector('input.w-commerce-commercecheckoutshippingzippostalcode, #lane4-checkout-zip, input[name="address_zip"]');
          if (pinEl) pinEl.value = a.postalCode || '';
        };
      }
    } catch (_) {}
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
        <div style="display:flex;align-items:center;padding:14px 0;border-bottom:1px solid #eeeeee;gap:14px;">
          <img src="${imgUrl}" alt="${it.name}" style="width:58px;height:58px;object-fit:cover;border-radius:0px;background:#ffffff;border:1px solid #e5e5e5;flex-shrink:0;" />
          <div style="flex:1;min-width:0;">
            <div style="font-weight:500;font-size:13.5px;color:#111111;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${it.name}</div>
            ${variantText ? `<div style="font-size:12px;color:#737373;margin-top:2px;">${variantText}</div>` : ''}
            <div style="font-size:12px;color:#555555;margin-top:4px;">
              <span>Qty: <strong style="font-weight:500;color:#111111;">${it.quantity}</strong></span>
              <span style="color:#cccccc;margin:0 5px;">·</span>
              <span>${it.unitPriceFormatted} each</span>
            </div>
          </div>
          <div style="font-weight:500;font-size:14px;color:#111111;text-align:right;">
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
      shippingBadge.style.color = isFree ? '#16a34a' : '#111111';
    }
    if (shippingSummary) {
      shippingSummary.textContent = shippingText;
      shippingSummary.style.color = isFree ? '#16a34a' : '#111111';
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
    qrWrapper.style.cssText = 'padding:24px;border:1px solid #dcdcdc;border-radius:0px;background:#ffffff;margin-top:16px;margin-bottom:28px;font-family:\'Generalsans\',\'General Sans\',sans-serif;';

    const upiId = paymentSettings.upiId || 'lane4swim@upi';
    const upiName = paymentSettings.upiAccountName || 'THE LANE4 PERFORMANCE STORE';
    const qrUrl = paymentSettings.qrCodeUrl || '6424266ea05809dff501d86e/lane4-share.png';
    const instructions = (paymentSettings.paymentInstructions || '').replace(/\n/g, '<br/>');

    qrWrapper.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid #eeeeee;">
        <span style="display:inline-block;background:#000000;color:#ffffff;font-weight:500;font-size:10.5px;padding:3px 9px;border-radius:0px;letter-spacing:0.8px;">STEP 3</span>
        <h4 style="margin:0;font-size:18px;font-weight:500;color:#000000;">Scan &amp; Pay via UPI</h4>
      </div>

      <div style="background:#fafafa;border:1px solid #eeeeee;border-radius:0px;padding:16px;margin-bottom:20px;text-align:center;">
        <div style="font-size:10.5px;color:#737373;font-weight: 500;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:4px;">Payable Order Amount</div>
        <div id="lane4-qr-amount-display" style="font-size:26px;font-weight:500;color:#000000;letter-spacing:0.3px;">
          ${checkoutQuote ? checkoutQuote.pricing.finalPayableFormatted : 'Calculating...'}
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:22px;align-items:center;margin-bottom:20px;">
        <!-- QR Code Card with Tap to Enlarge -->
        <div id="lane4-checkout-qr-card" style="text-align:center;flex:0 0 170px;margin:0 auto;cursor:pointer;position:relative;background:#ffffff;border:1px solid #000000;border-radius:0px;padding:10px;transition:all 0.2s cubic-bezier(0.16, 1, 0.3, 1);" title="Click to enlarge QR code for easy scanning">
          <div style="position:relative;width:150px;height:150px;margin:0 auto;background:#ffffff;display:flex;align-items:center;justify-content:center;">
            <img id="lane4-qr-img-display" src="${qrUrl}" alt="LANE4 Store UPI QR Code" style="width:150px;height:150px;object-fit:contain;border-radius:0px;display:block;" />
            <div style="position:absolute;bottom:4px;background:rgba(0,0,0,0.88);color:#ffffff;font-size:9px;font-weight:500;letter-spacing:0.8px;padding:3px 8px;border-radius:0px;display:flex;align-items:center;gap:4px;">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              <span>TAP TO ENLARGE</span>
            </div>
          </div>
          <div style="font-size:11.5px;font-weight:500;color:#111111;margin-top:8px;line-height:1.2;">Official Store UPI QR</div>
          <div style="font-size:10px;color:#737373;margin-top:2px;">Click to scan in full size</div>
        </div>

        <!-- Instructions & UPI VPA -->
        <div style="flex:1;min-width:240px;">
          <div style="margin-bottom:14px;">
            <label style="display:block;font-size:11px;font-weight: 500;color:#555555;text-transform:uppercase;letter-spacing:0.8px;">Store UPI ID (VPA)</label>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;">
              <code style="background:#fafafa;border:1px solid #e5e5e5;padding:9px 12px;border-radius:0px;font-size:13.5px;font-weight:500;color:#111111;flex:1;">${upiId}</code>
              <button type="button" id="lane4-copy-upi-btn" style="background:#000000;color:#ffffff;border:1px solid #000000;padding:9px 16px;border-radius:0px;font-size:11px;font-weight:500;letter-spacing:0.8px;text-transform:uppercase;cursor:pointer;">COPY</button>
            </div>
            <div style="font-size:12px;color:#666666;margin-top:5px;">Account Name: <strong style="color:#111111;font-weight:500;">${upiName}</strong></div>
          </div>
          <div style="font-size:12.5px;color:#444444;line-height:1.55;background:#fafafa;padding:12px 14px;border-radius:0px;border:1px solid #eeeeee;border-left:2px solid #000000;">
            ${instructions}
          </div>
        </div>
      </div>

      <hr style="border:none;border-top:1px solid #eeeeee;margin:20px 0;" />

      <!-- Payment Proof Form Inputs -->
      <div style="margin-bottom:16px;">
        <label style="display:block;font-size:11px;font-weight: 500;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;color:#333333;">
          12-Digit UPI Transaction / UTR Reference ID <span style="color:#b91c1c;">*</span>
        </label>
        <input type="text" id="lane4-utr-input" class="lane4-checkout-input" placeholder="e.g. 432109876543" maxlength="12" pattern="[0-9]{12}" inputmode="numeric" required style="letter-spacing:0.5px;font-weight:500;" />
        <div style="font-size:12px;color:#737373;margin-top:5px;">Found in your GPay / PhonePe / Paytm payment receipt as UTR or UPI Ref No.</div>
      </div>

      <div>
        <label style="display:block;font-size:11px;font-weight: 500;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;color:#333333;">
          Upload Payment Screenshot Proof <span style="color:#b91c1c;">*</span>
        </label>
        <input type="file" id="lane4-screenshot-file" accept="image/jpeg,image/png,image/webp" required style="display:block;width:100%;padding:12px;border:1px solid #dcdcdc;border-radius:0px;background:#fafafa;cursor:pointer;font-size:13px;color:#111111;box-sizing:border-box;" />
        <div id="lane4-screenshot-preview" style="display:none;margin-top:10px;text-align:center;">
          <img id="lane4-preview-img" src="" alt="Payment Proof Preview" style="max-height:160px;border:1px solid #dcdcdc;border-radius:0px;" />
        </div>
      </div>
    `;

    paymentContainer.appendChild(qrWrapper);

    // Click & Hover interactions for enlarged QR Modal
    const qrCard = document.getElementById('lane4-checkout-qr-card');
    if (qrCard) {
      qrCard.onmouseenter = () => {
        qrCard.style.transform = 'translateY(-2px)';
        qrCard.style.boxShadow = '0 10px 24px -4px rgba(0,0,0,0.12)';
        qrCard.style.borderColor = '#000000';
      };
      qrCard.onmouseleave = () => {
        qrCard.style.transform = 'translateY(0)';
        qrCard.style.boxShadow = 'none';
        qrCard.style.borderColor = '#000000';
      };
      qrCard.onclick = () => openEnlargedQrModal();
    }

    // Copy UPI ID button
    const copyBtn = document.getElementById('lane4-copy-upi-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(upiId);
        copyBtn.textContent = 'COPIED';
        copyBtn.style.background = '#16a34a';
        copyBtn.style.borderColor = '#16a34a';
        setTimeout(() => {
          copyBtn.textContent = 'COPY';
          copyBtn.style.background = '#000000';
          copyBtn.style.borderColor = '#000000';
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
        <div style="background:#ffffff;border-radius:0px;max-width:440px;width:100%;box-shadow:0 25px 60px -15px rgba(0,0,0,0.4);border:1px solid rgba(0,0,0,0.08);overflow:hidden;position:relative;box-sizing:border-box;font-family:'Generalsans','General Sans',sans-serif;">
          <div style="padding:20px 24px 16px;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;justify-content:space-between;background:#ffffff;">
            <div style="display:flex;align-items:center;gap:12px;">
              <img src="6424266ea05809dff501d86e/lane4-logo.png" alt="LANE4" style="height:24px;width:auto;" />
              <div style="display:flex;flex-direction:column;border-left:1px solid #e5e5e5;padding-left:12px;line-height:1.2;">
                <span style="font-size:10px;font-weight: 500;letter-spacing:0.8px;color:#222;text-transform:uppercase;">INSTANT SETTLEMENT</span>
                <span style="font-size:9px;font-weight:400;letter-spacing:0.5px;color:#888;text-transform:uppercase;">SCAN &amp; PAY VIA UPI</span>
              </div>
            </div>
            <button type="button" id="lane4-close-qr-modal" style="background:#f7f7f7;border:1px solid #ececec;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#666666;cursor:pointer;padding:0;transition:all 0.15s ease;" title="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div style="padding:24px 24px 20px;text-align:center;">
            ${currentAmount ? `
              <div style="background:#fafafa;border:1px solid #eeeeee;border-radius:0px;padding:8px 18px;display:inline-block;margin-bottom:16px;">
                <span style="font-size:10.5px;font-weight: 500;color:#777777;letter-spacing:0.8px;text-transform:uppercase;margin-right:6px;">PAYABLE:</span>
                <span style="font-size:18px;font-weight: 500;color:#111111;letter-spacing:0.2px;">${currentAmount}</span>
              </div>
            ` : ''}
            <div style="background:#ffffff;border:1px solid #000000;border-radius:0px;padding:16px;display:inline-block;box-shadow:0 8px 24px -4px rgba(0,0,0,0.08);margin-bottom:16px;">
              <img src="${currentQrSrc}" alt="Enlarged UPI QR Code" style="width:280px;height:280px;max-width:68vw;max-height:68vw;object-fit:contain;display:block;margin:0 auto;" />
            </div>
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:16px;font-size:11px;font-weight:500;color:#777777;letter-spacing:0.6px;text-transform:uppercase;">
              <span>Google Pay</span> • <span>PhonePe</span> • <span>Paytm</span> • <span>BHIM</span> • <span>Cred</span>
            </div>
            <div style="background:#fafafa;border:1px solid #eeeeee;border-radius:0px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;gap:10px;text-align:left;">
              <div style="min-width:0;">
                <div style="font-size:9.5px;font-weight: 500;color:#888888;letter-spacing:0.7px;text-transform:uppercase;">Store UPI ID (VPA)</div>
                <div style="font-size:13px;font-weight:500;color:#111111;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;">${upiId}</div>
              </div>
              <button type="button" id="lane4-modal-copy-btn" style="background:#000000;color:#ffffff;border:1px solid #000000;padding:6px 14px;border-radius:0px;font-size:11px;font-weight:500;letter-spacing:0.8px;text-transform:uppercase;cursor:pointer;white-space:nowrap;flex-shrink:0;">COPY</button>
            </div>
          </div>
          <div style="padding:14px 24px;background:#ffffff;border-top:1px solid #eeeeee;display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:11.5px;color:#888888;font-weight:400;">Hold camera close to scan code</span>
            <button type="button" id="lane4-done-qr-modal" style="background:#000000;color:#ffffff;border:1px solid #000000;padding:8px 20px;border-radius:0px;font-size:11.5px;font-weight:500;letter-spacing:0.8px;text-transform:uppercase;cursor:pointer;">DONE</button>
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
            mCopy.style.background = '#000000';
          }, 1500);
        };
      }
    }
  }

  function clearFieldError(inputEl) {
    if (!inputEl) return;
    inputEl.classList.remove('lane4-input-has-error');
    inputEl.style.borderColor = '#dcdcdc';
    inputEl.style.backgroundColor = '';
    const parent = inputEl.parentElement;
    if (parent) {
      const errEl = parent.querySelector('.lane4-field-inline-error');
      if (errEl) errEl.remove();
    }
  }

  function clearAllFieldErrors() {
    document.querySelectorAll('.lane4-field-inline-error').forEach(e => e.remove());
    document.querySelectorAll('#lane4-checkout-form-alert').forEach(e => e.remove());
    document.querySelectorAll('.lane4-input-has-error').forEach(el => {
      el.classList.remove('lane4-input-has-error');
      el.style.borderColor = '#dcdcdc';
      el.style.backgroundColor = '';
    });
  }

  function setFieldError(inputEl, message) {
    if (!inputEl) return;
    inputEl.classList.add('lane4-input-has-error');
    inputEl.style.borderColor = '#b91c1c';
    inputEl.style.backgroundColor = '#fef2f2';

    const parent = inputEl.parentElement;
    if (parent) {
      let errEl = parent.querySelector('.lane4-field-inline-error');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.className = 'lane4-field-inline-error';
        errEl.style.cssText = 'color:#b91c1c;font-size:11.5px;font-weight:500;margin-top:5px;line-height:1.35;';
        parent.appendChild(errEl);
      }
      errEl.innerHTML = `<span>${message}</span>`;
    }

    inputEl.addEventListener('input', () => clearFieldError(inputEl), { once: true });
    inputEl.addEventListener('change', () => clearFieldError(inputEl), { once: true });
  }

  function showCheckoutErrorBanner(title, messages, focusEl = null) {
    // User requested: No message box above 'Place Order & Submit Payment' button.
    // Inline field validation errors within the form are sufficient.
    const alertBox = document.getElementById('lane4-checkout-form-alert');
    if (alertBox) alertBox.remove();

    if (focusEl) {
      try {
        focusEl.focus();
        focusEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } catch (_) {}
    }
  }

  function setupInputRestrictions() {
    const pinInputs = document.querySelectorAll('input.w-commerce-commercecheckoutshippingzippostalcode, #lane4-checkout-zip, input[name="address_zip"]');
    pinInputs.forEach(pinEl => {
      pinEl.setAttribute('maxlength', '6');
      pinEl.setAttribute('minlength', '6');
      pinEl.setAttribute('inputmode', 'numeric');
      pinEl.setAttribute('pattern', '[0-9]{6}');
      pinEl.setAttribute('autocomplete', 'postal-code');

      pinEl.addEventListener('input', (e) => {
        const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
        if (e.target.value !== cleaned) e.target.value = cleaned;
        clearFieldError(pinEl);
      });
      pinEl.addEventListener('keydown', (e) => {
        if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter', 'Home', 'End'].includes(e.key) ||
            e.ctrlKey || e.metaKey) return;
        if (!/^[0-9]$/.test(e.key)) {
          e.preventDefault();
        }
      });
      pinEl.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        pinEl.value = text.replace(/\D/g, '').slice(0, 6);
        clearFieldError(pinEl);
      });
    });

    const utrEl = document.getElementById('lane4-utr-input');
    if (utrEl) {
      utrEl.setAttribute('maxlength', '12');
      utrEl.setAttribute('inputmode', 'numeric');
      utrEl.addEventListener('input', (e) => {
        const cleaned = e.target.value.replace(/\D/g, '').slice(0, 12);
        if (e.target.value !== cleaned) e.target.value = cleaned;
        clearFieldError(utrEl);
      });
      utrEl.addEventListener('keydown', (e) => {
        if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter'].includes(e.key) || e.ctrlKey || e.metaKey) return;
        if (!/^[0-9]$/.test(e.key)) e.preventDefault();
      });
      utrEl.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        utrEl.value = text.replace(/\D/g, '').slice(0, 12);
        clearFieldError(utrEl);
      });
    }

    const phoneEl = document.getElementById('lane4-checkout-phone');
    if (phoneEl) {
      phoneEl.setAttribute('maxlength', '16');
      phoneEl.setAttribute('inputmode', 'tel');
      if (phoneEl.value) phoneEl.value = normalizeIndianPhoneInput(phoneEl.value);
      phoneEl.addEventListener('input', (e) => {
        const raw = e.target.value;
        const hasLetters = /[a-zA-Z]/.test(raw);
        if (hasLetters) {
          e.target.value = raw.replace(/[^0-9+\-\s()]/g, '');
        }
        const rawDigits = e.target.value.replace(/\D/g, '');
        if (rawDigits.length > 10) {
          e.target.value = normalizeIndianPhoneInput(e.target.value);
        }
        clearFieldError(phoneEl);
      });
      phoneEl.addEventListener('paste', () => {
        setTimeout(() => {
          phoneEl.value = normalizeIndianPhoneInput(phoneEl.value);
        }, 0);
      });
      phoneEl.addEventListener('blur', () => {
        if (phoneEl.value) phoneEl.value = normalizeIndianPhoneInput(phoneEl.value);
      });
    }
  }

  function setupPlaceOrderButton() {
    const placeOrderBtn = document.getElementById('lane4-place-order-btn') || document.querySelector('.w-commerce-commercecheckoutplaceorderbutton, .submit-order');
    if (!placeOrderBtn) return;

    placeOrderBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      clearAllFieldErrors();

      // Enforce customer authentication before placing order
      const user = window.LANE4.getUser();
      if (!user || !user.uid) {
        if (window.LANE4_AUTH && window.LANE4_AUTH.open) {
          window.LANE4_AUTH.open('login');
          if (window.LANE4_AUTH.showAlert) {
            window.LANE4_AUTH.showAlert('Please sign in or create an account to complete checkout and place your order.', 'error');
          }
        }
        return;
      }

      // Gather form inputs & elements
      const emailEl = document.querySelector('input[name="email"], #wf-ecom-email');
      const nameEl = document.querySelector('input.w-commerce-commercecheckoutshippingfullname, input[name="name"]');
      const line1El = document.querySelector('input[name="address_line1"], input.w-commerce-commercecheckoutshippingstreetaddress:not(#lane4-checkout-phone)');
      const line2El = document.querySelector('input.w-commerce-commercecheckoutshippingstreetaddressoptional, input[name="address_line2"]');
      const stateSelect = document.getElementById('lane4-checkout-state');
      const citySelect = document.getElementById('lane4-checkout-city-select');
      const customCityInput = document.getElementById('lane4-checkout-city-custom');
      const pinEl = document.querySelector('input.w-commerce-commercecheckoutshippingzippostalcode, #lane4-checkout-zip, input[name="address_zip"]');
      const phoneEl = document.getElementById('lane4-checkout-phone');
      const utrEl = document.getElementById('lane4-utr-input');
      const fileInput = document.getElementById('lane4-screenshot-file');

      const email = emailEl?.value.trim() || '';
      const name = nameEl?.value.trim() || '';
      const line1 = line1El?.value.trim() || '';
      const line2 = line2El?.value.trim() || '';
      const state = stateSelect ? stateSelect.value.trim() : (document.querySelector('input[name="address_state"]')?.value.trim() || '');
      let city = '';
      if (citySelect && citySelect.value === 'Other' && customCityInput) {
        city = customCityInput.value.trim();
      } else if (citySelect) {
        city = citySelect.value.trim();
      } else {
        city = document.querySelector('input[name="address_city"]')?.value.trim() || '';
      }
      const postalCode = pinEl?.value.trim() || '';
      const rawPhone = phoneEl?.value.trim() || '';
      const phone = normalizeIndianPhoneInput(rawPhone);
      if (phoneEl && phone) phoneEl.value = phone;
      const utr = utrEl?.value.trim() || '';
      const screenshot = fileInput?.files ? fileInput.files[0] : null;

      // In-form Client Validations
      const errors = [];
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!email || !emailRegex.test(email)) {
        errors.push({ el: emailEl, name: 'Email Address', msg: 'Please enter a valid customer email address.' });
      }
      if (!name || name.length < 2) {
        errors.push({ el: nameEl, name: 'Full Name', msg: 'Please enter your full delivery name.' });
      }
      if (!rawPhone || /[a-zA-Z]/.test(rawPhone) || !/^[6-9]\d{9}$/.test(phone) || rawPhone.replace(/\D/g, '').length < 10) {
        errors.push({ el: phoneEl, name: 'Mobile Phone', msg: 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).' });
      }
      if (!line1) {
        errors.push({ el: line1El, name: 'Street Address', msg: 'Please enter your complete street address.' });
      }
      if (!state) {
        errors.push({ el: stateSelect, name: 'State / UT', msg: 'Please select your delivery state.' });
      }
      if (!city) {
        errors.push({ el: citySelect?.value === 'Other' ? customCityInput : citySelect, name: 'City', msg: 'Please select or enter your delivery city.' });
      }
      if (!postalCode || !/^[1-9][0-9]{5}$/.test(postalCode) || /^(.)\1{5}$/.test(postalCode) || postalCode === '123456') {
        errors.push({ el: pinEl, name: 'PIN / Postal Code', msg: 'Please provide a correct postal code.' });
      }
      const utrClean = (utr || '').replace(/\s+/g, '');
      if (!utrClean || !/^\d{12}$/.test(utrClean)) {
        errors.push({ el: utrEl, name: '12-Digit UTR Number', msg: 'Please enter a valid 12-digit numeric UPI Reference / UTR Number.' });
      }
      if (!screenshot) {
        errors.push({ el: fileInput, name: 'Payment Screenshot', msg: 'Please upload your payment confirmation screenshot before placing order.' });
      }

      if (errors.length > 0) {
        errors.forEach(err => {
          if (err.el) setFieldError(err.el, err.msg);
        });
        if (errors[0] && errors[0].el) {
          try {
            errors[0].el.focus();
            errors[0].el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch (_) {}
        }
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
          customerPhone: phone,
          shippingAddress: {
            addressee: name,
            phone: phone,
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

        const createdOrder = Object.assign({}, orderRes.data || {}, {
          shippingAddress: (orderRes.data && orderRes.data.shippingAddress) || orderPayload.shippingAddress
        });

        // Immediately clear cart upon order placement
        try {
          if (window.LANE4_CART && typeof window.LANE4_CART.clear === 'function') {
            await window.LANE4_CART.clear();
          } else {
            await window.lane4ApiRequest(`/cart?guestId=${encodeURIComponent(guestId)}`, {
              method: 'DELETE'
            });
          }
          window.dispatchEvent(new CustomEvent('lane4:cart-cleared'));
        } catch (_) {}

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
        if (window.LANE4_CART && typeof window.LANE4_CART.clear === 'function') {
          await window.LANE4_CART.clear();
        } else if (window.LANE4_CART && window.LANE4_CART.refresh) {
          window.LANE4_CART.refresh();
        }
        window.dispatchEvent(new CustomEvent('lane4:cart-cleared'));
        const badges = document.querySelectorAll('.cart-quantity, .w-commerce-commercecartopenlinkcount, #lane4-cart-badge');
        badges.forEach(b => { b.textContent = '0'; });

        renderOrderSuccess(createdOrder, utr);
      } catch (err) {
        placeOrderBtn.disabled = false;
        placeOrderBtn.style.pointerEvents = 'auto';
        placeOrderBtn.innerHTML = `
          <span>PLACE ORDER &amp; SUBMIT PAYMENT</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        `;

        clearAllFieldErrors();

        // Check for duplicate UTR error specifically
        const errMsg = err.message || '';
        if (errMsg.toLowerCase().includes('already been submitted') || errMsg.toLowerCase().includes('duplicate') || errMsg.toLowerCase().includes('utr')) {
          setFieldError(utrEl, 'This UTR Number has already been submitted or verified for another order.');
          if (utrEl) {
            try {
              utrEl.focus();
              utrEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (_) {}
          }
          return;
        }

        // Check for specific backend validation details
        if (err.details && Array.isArray(err.details) && err.details.length > 0) {
          const fieldMap = {
            'shippingAddress.postalCode': { el: pinEl, label: 'PIN / Postal Code' },
            'shippingAddress.phone': { el: phoneEl, label: 'Mobile Phone' },
            'customerPhone': { el: phoneEl, label: 'Mobile Phone' },
            'shippingAddress.addressee': { el: nameEl, label: 'Full Name' },
            'shippingAddress.addressLine1': { el: line1El, label: 'Street Address' },
            'shippingAddress.city': { el: citySelect, label: 'City' },
            'shippingAddress.state': { el: stateSelect, label: 'State' },
            'customerEmail': { el: emailEl, label: 'Email Address' },
            'upiReferenceNumber': { el: utrEl, label: 'UPI Reference / UTR' },
            'screenshot': { el: fileInput, label: 'Payment Screenshot' }
          };

          let firstFocus = null;

          err.details.forEach(d => {
            const mapping = fieldMap[d.field];
            if (mapping && mapping.el) {
              setFieldError(mapping.el, d.message);
              if (!firstFocus) firstFocus = mapping.el;
            }
          });

          if (firstFocus) {
            try {
              firstFocus.focus();
              firstFocus.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch (_) {}
          }
          return;
        }

        // Generic fallback error message
        if (errMsg) {
          if (window.showStorefrontToast) {
            window.showStorefrontToast(errMsg, 'error');
          } else {
            alert(errMsg);
          }
        }
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
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #eeeeee;font-size:13.5px;">
        <div>
          <span style="font-weight:500;color:#111111;">${it.name}</span>
          ${it.size || it.color ? `<span style="color:#777777;font-size:12px;"> (${[it.size, it.color].filter(Boolean).join(', ')})</span>` : ''}
          <span style="color:#777777;"> &times; ${it.quantity}</span>
        </div>
        <div style="font-weight: 500;color:#111111;">${it.totalPriceFormatted || window.LANE4.formatINR(it.pricePaise * it.quantity)}</div>
      </div>
    `).join('');

    mainContainer.innerHTML = `
      <div style="margin:20px auto 40px;padding:40px 32px;background:#ffffff;border:1px solid rgba(0,0,0,0.08);border-radius:0px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.08);text-align:center;font-family:'Generalsans','General Sans',sans-serif;">
        <!-- Checkmark Icon -->
        <div style="width:56px;height:56px;background:#f0fdf4;border:1px solid #bbf7d0;color:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 18px auto;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        
        <h2 style="font-size:20px;font-weight:500;color:#111111;margin:0 0 8px 0;letter-spacing:0.8px;text-transform:uppercase;">ORDER PLACED &amp; PAYMENT SUBMITTED</h2>
        
        <div style="display:inline-flex;align-items:center;gap:6px;background:#fefce8;color:#854d0e;padding:4px 12px;border-radius:0px;font-weight: 500;font-size:10.5px;letter-spacing:0.6px;text-transform:uppercase;margin-bottom:20px;border:1px solid #fef08a;">
          <span style="width:6px;height:6px;border-radius:50%;background:#ca8a04;display:inline-block;"></span>
          Status: Verification Pending
        </div>

        <p style="font-size:14px;color:#555555;line-height:1.6;margin:0 0 22px 0;">
          Thank you for ordering with <strong>The Lane4 Performance Store</strong>. Your order <strong>#${order.orderNumber || order.orderId}</strong> has been logged.
        </p>

        <!-- Order Details Card -->
        <div style="background:#ffffff;border:1px solid #eeeeee;border-radius:0px;padding:22px;text-align:left;margin-bottom:22px;font-size:13.5px;line-height:1.7;">
          <div style="display:flex;justify-content:space-between;border-bottom:1px solid #eeeeee;padding-bottom:10px;margin-bottom:12px;">
            <div><span style="color:#777777;">Order Number:</span> <strong style="color:#111111;">#${order.orderNumber || order.orderId}</strong></div>
            <div><span style="color:#777777;">Total Paid:</span> <strong style="font-size:15px;color:#111111;">${order.pricing ? order.pricing.finalPayableFormatted : ''}</strong></div>
          </div>
          
          <div style="margin-bottom:12px;">
            <div style="font-size:11.5px;font-weight: 500;text-transform:uppercase;color:#333333;letter-spacing:0.7px;margin-bottom:4px;">Items in this Order</div>
            ${itemsPurchasedHtml}
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:12px;margin-top:14px;padding-top:12px;border-top:1px solid #eeeeee;">
            <div>
              <span style="color:#777777;font-size:11.5px;display:block;font-weight: 500;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:3px;">Shipping To</span>
              <strong style="font-weight:500;color:#111111;">${order.shippingAddress ? `${order.shippingAddress.addressee}, ${order.shippingAddress.addressLine1}${order.shippingAddress.addressLine2 ? ', ' + order.shippingAddress.addressLine2 : ''}, ${order.shippingAddress.city}, ${order.shippingAddress.state} - ${order.shippingAddress.postalCode}` : ''}</strong>
            </div>
            <div>
              <span style="color:#777777;font-size:11.5px;display:block;font-weight: 500;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:3px;">Payment Info</span>
              <span style="color:#333333;">Method: <strong>Manual UPI Instant Transfer</strong></span><br/>
              ${utrNumber ? `<span style="color:#333333;">12-Digit Ref (UTR): <code style="background:#f5f5f5;border:1px solid #e5e5e5;padding:2px 6px;border-radius:0px;font-weight: 500;color:#111111;">${utrNumber}</code></span>` : ''}
            </div>
          </div>
        </div>

        <!-- Verification Notice -->
        <div style="background:#fafafa;border:1px solid #e5e5e5;border-left:3px solid #111111;border-radius:0px;padding:16px 20px;font-size:12.5px;color:#444444;line-height:1.6;margin-bottom:28px;text-align:left;">
          <strong style="color:#111111;">Order Reference:</strong> #${order.orderNumber || order.orderId}<br />
          Our team verifies payment transfers promptly during business hours. Once verified, order status updates in your Swimmer Account and delivery dispatch details will be sent directly to your email.
        </div>

        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
          <a href="shop.html" style="background:#000000;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:0px;font-weight:500;letter-spacing:1px;font-size:12px;text-transform:uppercase;border:1px solid #000000;">CONTINUE SHOPPING</a>
          <a href="index.htm" style="background:#ffffff;color:#111111;padding:14px 28px;text-decoration:none;border-radius:0px;font-weight:500;letter-spacing:1px;font-size:12px;border:1px solid #dcdcdc;text-transform:uppercase;">RETURN HOME</a>
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
