/**
 * LANE4 Forms Controller
 * Connects all existing frontend forms (Newsletter, Contact Modals) to backend APIs
 * with strict validation consistency (No numbers in name, No text in phone, strict email, message).
 */

(function () {
  // Common input validation helpers
  window.LANE4_VALIDATION = window.LANE4_VALIDATION || {};

  window.LANE4_VALIDATION.isValidEmail = function (email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
  };

  window.LANE4_VALIDATION.cleanPhone = function (phone) {
    let clean = String(phone || '').replace(/[\s\-\(\)\+]/g, '').replace(/\D/g, '');
    if (clean.length > 10 && clean.startsWith('91')) clean = clean.slice(2);
    else if (clean.length > 10 && clean.startsWith('0')) clean = clean.slice(1);
    return clean;
  };

  window.LANE4_VALIDATION.isValidIndianPhone = function (phone) {
    if (!phone) return false;
    const str = String(phone).trim();
    if (/[a-zA-Z]/.test(str)) return false; // STRICT: NO TEXT ALLOWED
    const clean = window.LANE4_VALIDATION.cleanPhone(str);
    return /^[6-9]\d{9}$/.test(clean);
  };

  window.LANE4_VALIDATION.isValidName = function (name) {
    const str = String(name || '').trim();
    if (!str || str.length < 2) return false;
    if (/\d/.test(str)) return false; // STRICT: NO NUMBERS ALLOWED
    return /^[a-zA-Z\s\.\'\-]+$/.test(str);
  };

  window.LANE4_VALIDATION.isValidPincode = function (pin) {
    return /^[1-9][0-9]{5}$/.test(String(pin).trim());
  };

  window.LANE4_VALIDATION.isValidPostalCode = function (pin) {
    return /^[1-9][0-9]{5}$/.test(String(pin).trim());
  };

  function getOrCreateErrorElement(inputEl) {
    if (!inputEl) return null;
    const parent = inputEl.closest('.cf-input') || inputEl.closest('.newsletter-input') || inputEl.parentElement;
    if (!parent) return null;
    let errEl = parent.querySelector('.lane4-input-error');
    if (!errEl) {
      errEl = document.createElement('div');
      errEl.className = 'lane4-input-error';
      errEl.style.cssText = 'width:100%;color:#b91c1c;font-size:11.5px;font-weight:500;margin-top:5px;line-height:1.35;display:none;text-align:left;';
      parent.appendChild(errEl);
    }
    return errEl;
  }

  function showFieldError(inputEl, message) {
    if (!inputEl) return;
    inputEl.style.borderColor = '#b91c1c';
    inputEl.style.backgroundColor = '#fef2f2';
    const errEl = getOrCreateErrorElement(inputEl);
    if (errEl) {
      errEl.textContent = message;
      errEl.style.display = 'block';
    }
  }

  function clearFieldError(inputEl) {
    if (!inputEl) return;
    inputEl.style.borderColor = '';
    inputEl.style.backgroundColor = '';
    const errEl = getOrCreateErrorElement(inputEl);
    if (errEl) {
      errEl.textContent = '';
      errEl.style.display = 'none';
    }
  }

  function clearAllFormErrors(form) {
    if (!form) return;
    form.querySelectorAll('input, textarea').forEach(clearFieldError);
    const wrapper = form.closest('.w-form') || form.parentElement;
    const failMsg = wrapper ? wrapper.querySelector('.w-form-fail, .error-message') : null;
    if (failMsg) failMsg.style.display = 'none';
  }

  function initForms() {
    // 1. Newsletter Forms (Footer & CTA)
    const newsletterForms = document.querySelectorAll('form.form-footer, form#email-form, form#wf-form-Newsletter, form.newsletter-contact-cta, [data-name="Newsletter"]');
    newsletterForms.forEach(form => {
      // Do not process contact modal forms here
      if (form.closest('.contact-form-modal')) return;

      form.setAttribute('onsubmit', 'return false;');
      if (window.jQuery) {
        try {
          window.jQuery(form).off('submit');
          window.jQuery(document).off('submit', form);
        } catch (_) {}
      }

      if (form.getAttribute('data-lane4-bound')) return;
      form.setAttribute('data-lane4-bound', 'true');

      const emailInput = form.querySelector('input[type="email"], input[name="email"], input[name="newsletter"]');
      if (emailInput) {
        emailInput.addEventListener('input', () => {
          if (window.LANE4_VALIDATION.isValidEmail(emailInput.value)) {
            clearFieldError(emailInput);
          }
        });
      }

      form.addEventListener('submit', async (e) => {
        if (!emailInput) return;

        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();

        const wrapper = form.closest('.w-form') || form.parentElement;
        const successMsg = wrapper ? wrapper.querySelector('.w-form-done, .success-message, .success-message-2') : null;
        const failMsg = wrapper ? wrapper.querySelector('.w-form-fail, .error-message') : null;
        if (failMsg) failMsg.style.display = 'none';

        const email = emailInput.value.trim();
        const submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');

        if (!email) {
          showFieldError(emailInput, 'Please enter your email address.');
          emailInput.focus();
          return;
        }

        if (!window.LANE4_VALIDATION.isValidEmail(email)) {
          showFieldError(emailInput, 'Please enter a valid email address.');
          emailInput.focus();
          return;
        }

        clearFieldError(emailInput);

        try {
          if (submitBtn) submitBtn.disabled = true;

          const res = await window.lane4ApiRequest('/newsletter/subscribe', {
            method: 'POST',
            body: JSON.stringify({
              email,
              sourcePage: window.location.pathname
            })
          });

          form.style.display = 'none';
          if (failMsg) failMsg.style.display = 'none';
          if (successMsg) {
            successMsg.style.display = 'block';
            const textEl = successMsg.querySelector('div') || successMsg;
            textEl.textContent = res.message || 'Thank you! You are subscribed to LANE4 updates.';
          }
        } catch (err) {
          if (failMsg) {
            failMsg.style.display = 'block';
            const textEl = failMsg.querySelector('div') || failMsg;
            textEl.textContent = err.message || 'Something went wrong. Please try again.';
          } else {
            showFieldError(emailInput, err.message || 'Subscription failed');
          }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      }, true);
    });

    // 2. Contact Modals on contact-us.html
    const contactModals = document.querySelectorAll('.contact-form-modal');
    const modalTypeMap = {
      0: 'press',
      1: 'complaint',
      2: 'feedback',
      3: 'ideas',
      4: 'general'
    };

    contactModals.forEach((modal, index) => {
      const form = modal.querySelector('form');
      if (!form) return;
      form.setAttribute('onsubmit', 'return false;');
      if (window.jQuery) {
        try { window.jQuery(form).off('submit'); } catch (_) {}
      }
      if (form.getAttribute('data-lane4-bound')) return;
      form.setAttribute('data-lane4-bound', 'true');

      const enquiryType = modalTypeMap[index] || 'general';

      // Robust field extractors
      const nameInput = form.querySelector('input[type="text"], input[name^="name"]');
      const emailInput = form.querySelector('input[type="email"], input[name^="Email"]');
      const phoneInput = form.querySelector('input[type="tel"], input[name="name-3"]');
      const messageInput = form.querySelector('textarea, input[name^="field"]');
      const submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');
      const origSubmitText = submitBtn ? (submitBtn.value || submitBtn.textContent || 'Submit') : 'Submit';

      const wrapper = form.closest('.w-form') || form.parentElement;
      const successMsg = wrapper ? wrapper.querySelector('.w-form-done, .success-message') : null;
      const failMsg = wrapper ? wrapper.querySelector('.w-form-fail, .error-message') : null;

      // Close button handling: reset form and errors on close
      const closeButtons = modal.querySelectorAll('.close-button');
      closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          clearAllFormErrors(form);
          if (successMsg) successMsg.style.display = 'none';
          if (failMsg) failMsg.style.display = 'none';
          form.style.display = 'block';
        });
      });

      // --- REAL-TIME INPUT VALIDATION & SANITIZATION ---

      // 1. Name Input: STRICTLY NO NUMBERS
      if (nameInput) {
        nameInput.addEventListener('input', function () {
          // Instantly block and strip any numeric digits entered or pasted
          if (/\d/.test(this.value)) {
            this.value = this.value.replace(/\d/g, '');
            showFieldError(this, 'Numbers are not allowed in the name field.');
            setTimeout(() => {
              if (!/\d/.test(this.value) && (!this.value.trim() || window.LANE4_VALIDATION.isValidName(this.value))) {
                clearFieldError(this);
              }
            }, 1800);
          } else if (this.value.trim().length >= 2 && !window.LANE4_VALIDATION.isValidName(this.value)) {
            showFieldError(this, 'Name can only contain letters and spaces.');
          } else {
            clearFieldError(this);
          }
        });

        nameInput.addEventListener('blur', function () {
          const val = this.value.trim();
          if (!val) {
            showFieldError(this, 'Full name is required.');
          } else if (/\d/.test(val)) {
            showFieldError(this, 'Name must not contain any numbers.');
          } else if (val.length < 2) {
            showFieldError(this, 'Name must be at least 2 characters.');
          } else if (!window.LANE4_VALIDATION.isValidName(val)) {
            showFieldError(this, 'Name can only contain letters and spaces.');
          } else {
            clearFieldError(this);
          }
        });
      }

      // 2. Phone Input: STRICTLY NO TEXT / LETTERS
      if (phoneInput) {
        phoneInput.addEventListener('input', function () {
          // Instantly block and strip any letters/alphabet text entered or pasted
          if (/[a-zA-Z]/.test(this.value)) {
            this.value = this.value.replace(/[a-zA-Z]/g, '');
            showFieldError(this, 'Letters and text are not allowed in phone number.');
            setTimeout(() => {
              if (!/[a-zA-Z]/.test(this.value) && (!this.value.trim() || window.LANE4_VALIDATION.isValidIndianPhone(this.value))) {
                clearFieldError(this);
              }
            }, 1800);
          } else {
            clearFieldError(this);
          }
        });

        phoneInput.addEventListener('blur', function () {
          const val = this.value.trim();
          if (!val) {
            showFieldError(this, 'Phone number is required.');
          } else if (/[a-zA-Z]/.test(val)) {
            showFieldError(this, 'Phone number must contain only numbers.');
          } else if (!window.LANE4_VALIDATION.isValidIndianPhone(val)) {
            showFieldError(this, 'Please enter a valid 10-digit mobile number (e.g. 9876543210).');
          } else {
            clearFieldError(this);
          }
        });
      }

      // 3. Email Input: Strict RFC format validation
      if (emailInput) {
        emailInput.addEventListener('input', function () {
          if (window.LANE4_VALIDATION.isValidEmail(this.value)) {
            clearFieldError(this);
          }
        });

        emailInput.addEventListener('blur', function () {
          const val = this.value.trim();
          if (!val) {
            showFieldError(this, 'Email address is required.');
          } else if (!window.LANE4_VALIDATION.isValidEmail(val)) {
            showFieldError(this, 'Please enter a valid email address (e.g. swimmer@example.com).');
          } else {
            clearFieldError(this);
          }
        });
      }

      // 4. Message Textarea: Minimum length validation
      if (messageInput) {
        messageInput.addEventListener('input', function () {
          if (this.value.trim().length >= 5) {
            clearFieldError(this);
          }
        });

        messageInput.addEventListener('blur', function () {
          const val = this.value.trim();
          if (!val || val.length < 5) {
            showFieldError(this, 'Please enter your message (at least 5 characters).');
          } else {
            clearFieldError(this);
          }
        });
      }

      // --- SUBMIT HANDLER ---
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();

        clearAllFormErrors(form);

        const nameVal = nameInput ? nameInput.value.trim() : '';
        const emailVal = emailInput ? emailInput.value.trim() : '';
        const phoneVal = phoneInput ? phoneInput.value.trim() : '';
        const msgVal = messageInput ? messageInput.value.trim() : '';

        let hasError = false;
        let firstInvalid = null;

        // 1. Validate Name (No numbers, min 2 chars)
        if (!nameVal) {
          showFieldError(nameInput, 'Full name is required.');
          hasError = true;
          firstInvalid = firstInvalid || nameInput;
        } else if (/\d/.test(nameVal)) {
          showFieldError(nameInput, 'Name must not contain any numbers.');
          hasError = true;
          firstInvalid = firstInvalid || nameInput;
        } else if (!window.LANE4_VALIDATION.isValidName(nameVal)) {
          showFieldError(nameInput, 'Name can only contain letters and spaces.');
          hasError = true;
          firstInvalid = firstInvalid || nameInput;
        } else if (nameVal.length < 2) {
          showFieldError(nameInput, 'Name must be at least 2 characters.');
          hasError = true;
          firstInvalid = firstInvalid || nameInput;
        }

        // 2. Validate Email
        if (!emailVal) {
          showFieldError(emailInput, 'Email address is required.');
          hasError = true;
          firstInvalid = firstInvalid || emailInput;
        } else if (!window.LANE4_VALIDATION.isValidEmail(emailVal)) {
          showFieldError(emailInput, 'Please enter a valid email address (e.g. swimmer@example.com).');
          hasError = true;
          firstInvalid = firstInvalid || emailInput;
        }

        // 3. Validate Phone (No text, valid 10 digits)
        if (!phoneVal) {
          showFieldError(phoneInput, 'Phone number is required.');
          hasError = true;
          firstInvalid = firstInvalid || phoneInput;
        } else if (/[a-zA-Z]/.test(phoneVal)) {
          showFieldError(phoneInput, 'Phone number must contain only numbers.');
          hasError = true;
          firstInvalid = firstInvalid || phoneInput;
        } else if (!window.LANE4_VALIDATION.isValidIndianPhone(phoneVal)) {
          showFieldError(phoneInput, 'Please enter a valid 10-digit mobile number (e.g. 9876543210).');
          hasError = true;
          firstInvalid = firstInvalid || phoneInput;
        }

        // 4. Validate Message (min 5 chars)
        if (!msgVal || msgVal.length < 5) {
          showFieldError(messageInput, 'Please enter your message (at least 5 characters).');
          hasError = true;
          firstInvalid = firstInvalid || messageInput;
        }

        if (hasError) {
          if (firstInvalid) firstInvalid.focus();
          if (failMsg) {
            failMsg.style.display = 'block';
            failMsg.innerHTML = '<div style="font-weight:500;">Please correct the highlighted fields above before submitting.</div>';
          }
          return;
        }

        const payload = {
          type: enquiryType,
          name: nameVal,
          email: emailVal,
          phone: phoneVal,
          message: msgVal
        };

        try {
          if (submitBtn) {
            submitBtn.disabled = true;
            if (submitBtn.tagName === 'INPUT') submitBtn.value = 'Submitting...';
            else submitBtn.textContent = 'Submitting...';
          }

          const res = await window.lane4ApiRequest('/enquiries', {
            method: 'POST',
            body: JSON.stringify(payload)
          });

          form.style.display = 'none';
          if (failMsg) failMsg.style.display = 'none';
          if (successMsg) {
            const safeName = String(nameVal || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            successMsg.style.display = 'block';
            successMsg.innerHTML = `
              <div style="position:relative;background:#ffffff;padding:34px 28px 28px;border-radius:0px;text-align:center;width:100%;box-sizing:border-box;font-family:'Generalsans','General Sans',sans-serif;">
                <button type="button" class="lane4-modal-close-cross" aria-label="Close modal" style="position:absolute;top:14px;right:14px;width:30px;height:30px;background:#ffffff;border:1px solid #e5e5e5;border-radius:0px;font-size:18px;line-height:1;color:#111111;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background-color 0.15s,border-color 0.15s;">&times;</button>
                <div style="width:40px;height:40px;background:#000000;color:#ffffff;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;border-radius:0px;">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div style="font-size:18px;font-weight:500;color:#000000;margin-bottom:8px;">
                  Message Received
                </div>
                <div style="font-size:13.5px;color:#555555;line-height:1.55;margin-bottom:22px;">
                  Thank you, <strong style="color:#111111;font-weight:500;">${safeName}</strong>. Your enquiry has been sent to the LANE4 Nagpur team. We will get back to you shortly.
                </div>
                <button type="button" class="lane4-modal-close-btn" style="width:100%;height:44px;background:#000000;color:#ffffff;border:1px solid #000000;border-radius:0px;padding:0 24px;font-size:12px;font-weight:500;letter-spacing:1px;text-transform:uppercase;cursor:pointer;transition:background-color 0.15s;">
                  Close
                </button>
              </div>
            `;

            const handleClose = () => {
              modal.style.display = 'none';
              modal.style.opacity = '0';
              document.querySelectorAll('.mask-modal').forEach(m => {
                m.style.display = 'none';
                m.style.opacity = '0';
              });
              try {
                const origClose = modal.querySelector('.close-button');
                if (origClose && typeof origClose.click === 'function') origClose.click();
              } catch (_) {}
              clearAllFormErrors(form);
              form.reset();
              form.style.display = 'block';
              successMsg.style.display = 'none';
            };

            const crossBtn = successMsg.querySelector('.lane4-modal-close-cross');
            const closeBtn = successMsg.querySelector('.lane4-modal-close-btn');
            if (crossBtn) {
              crossBtn.onmouseenter = () => { crossBtn.style.borderColor = '#000000'; crossBtn.style.backgroundColor = '#f5f5f5'; };
              crossBtn.onmouseleave = () => { crossBtn.style.borderColor = '#e5e5e5'; crossBtn.style.backgroundColor = '#ffffff'; };
              crossBtn.onclick = handleClose;
            }
            if (closeBtn) {
              closeBtn.onmouseenter = () => { closeBtn.style.backgroundColor = '#222222'; };
              closeBtn.onmouseleave = () => { closeBtn.style.backgroundColor = '#000000'; };
              closeBtn.onclick = handleClose;
            }
          }
        } catch (err) {
          if (failMsg) {
            failMsg.style.display = 'block';
            failMsg.innerHTML = `<div style="font-weight:700;">${err.message || 'Something went wrong submitting your enquiry.'}</div>`;
          } else {
            if (window.showStorefrontToast) {
              window.showStorefrontToast(err.message || 'Submission failed', 'error');
            } else {
              alert(err.message || 'Submission failed');
            }
          }
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            if (submitBtn.tagName === 'INPUT') submitBtn.value = origSubmitText;
            else submitBtn.textContent = origSubmitText;
          }
        }
      }, true);
    });

    // Global listener for mask click and Escape key on contact modals
    document.querySelectorAll('.mask-modal').forEach(mask => {
      mask.addEventListener('click', () => {
        contactModals.forEach(modal => {
          modal.style.display = 'none';
          modal.style.opacity = '0';
          const form = modal.querySelector('form');
          if (form) {
            clearAllFormErrors(form);
            form.style.display = 'block';
          }
          const success = modal.querySelector('.w-form-done, .success-message');
          if (success) success.style.display = 'none';
        });
        mask.style.display = 'none';
        mask.style.opacity = '0';
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        contactModals.forEach(modal => {
          if (modal.style.display !== 'none') {
            modal.style.display = 'none';
            modal.style.opacity = '0';
            const form = modal.querySelector('form');
            if (form) {
              clearAllFormErrors(form);
              form.style.display = 'block';
            }
            const success = modal.querySelector('.w-form-done, .success-message');
            if (success) success.style.display = 'none';
          }
        });
        document.querySelectorAll('.mask-modal').forEach(mask => {
          mask.style.display = 'none';
          mask.style.opacity = '0';
        });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForms);
  } else {
    initForms();
  }
})();
