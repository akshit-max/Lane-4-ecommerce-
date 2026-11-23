/**
 * LANE4 Forms Controller
 * Connects all frontend forms (Footer Newsletter, Contact / Complaint / Feedback Modals)
 * directly to the LANE4 backend APIs and prevents Webflow default submission errors.
 */

(function () {
  'use strict';

  // Common input validation helpers
  window.LANE4_VALIDATION = {
    isValidEmail: function (email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
    },
    isValidIndianPhone: function (phone) {
      const clean = String(phone).replace(/[\s\-\(\)\+]/g, '');
      return /^(?:91)?[6-9]\d{9}$/.test(clean);
    },
    cleanPhone: function (phone) {
      let clean = String(phone).replace(/[\s\-\(\)]/g, '');
      if (clean.startsWith('+91')) clean = clean.substring(3);
      else if (clean.startsWith('91') && clean.length === 12) clean = clean.substring(2);
      return clean.trim();
    }
  };

  function showFormToast(message, type = 'success') {
    if (window.LANE4 && typeof window.LANE4.showToast === 'function') {
      window.LANE4.showToast(message, type);
    } else {
      console.log(`[LANE4 Forms] ${type}: ${message}`);
    }
  }

  function neutralizeWebflowForm(form) {
    if (!form) return;
    try {
      form.removeAttribute('data-wf-page-id');
      form.removeAttribute('data-wf-element-id');
      form.setAttribute('action', 'javascript:void(0);');
      if (window.jQuery) {
        window.jQuery(form).off('submit');
      }
    } catch (_) {}
  }

  function initForms() {
    // -------------------------------------------------------------
    // 1. CONTACT & COMPLAINT MODAL FORMS (contact-us.html & modals)
    // -------------------------------------------------------------
    const contactModals = document.querySelectorAll('.contact-form-modal, .form-block:has(textarea)');
    contactModals.forEach(modal => {
      const form = modal.querySelector('form');
      if (!form || form.getAttribute('data-lane4-bound')) return;
      form.setAttribute('data-lane4-bound', 'contact-modal');
      neutralizeWebflowForm(form);

      // Determine modal enquiry type from surrounding titles or modal headings
      const modalText = (modal.closest('.contact-chanel')?.textContent || modal.textContent || '').toLowerCase();
      let enquiryType = 'general';
      if (modalText.includes('complaint')) enquiryType = 'complaint';
      else if (modalText.includes('feedback')) enquiryType = 'feedback';
      else if (modalText.includes('idea')) enquiryType = 'idea';
      else if (modalText.includes('press') || modalText.includes('media')) enquiryType = 'press';

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const wrapper = form.closest('.w-form') || form.parentElement;
        const successMsg = wrapper ? wrapper.querySelector('.w-form-done, .success-message') : null;
        const failMsg = wrapper ? wrapper.querySelector('.w-form-fail, .error-message') : null;

        if (failMsg) {
          failMsg.style.display = 'none';
          failMsg.setAttribute('style', 'display:none !important;');
        }

        // Extract form values flexibly across Webflow naming variations
        const nameInput = form.querySelector('input[name="name-4"], input[name^="name"], input[placeholder*="name" i], input[type="text"]');
        const emailInput = form.querySelector('input[name="Email-2"], input[name^="email" i], input[placeholder*="email" i], input[type="email"]');
        const phoneInput = form.querySelector('input[name="name-3"], input[name^="phone" i], input[placeholder*="phone" i], input[type="tel"]');
        const messageInput = form.querySelector('textarea, textarea[name="field-2"], input[name^="field"]');
        const submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');

        const name = (nameInput ? nameInput.value.trim() : '') || 'Swimmer';
        const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
        const phone = phoneInput ? phoneInput.value.trim() : '';
        const message = messageInput ? messageInput.value.trim() : '';

        if (!email || !window.LANE4_VALIDATION.isValidEmail(email)) {
          if (failMsg) {
            failMsg.style.display = 'block';
            failMsg.setAttribute('style', 'display:block !important;');
            const textEl = failMsg.querySelector('div') || failMsg;
            textEl.textContent = 'Please enter a valid email address.';
          }
          showFormToast('Please enter a valid contact email address.', 'error');
          if (emailInput) emailInput.focus();
          return;
        }

        if (!message) {
          if (failMsg) {
            failMsg.style.display = 'block';
            failMsg.setAttribute('style', 'display:block !important;');
            const textEl = failMsg.querySelector('div') || failMsg;
            textEl.textContent = 'Please enter a message or complaint details.';
          }
          showFormToast('Please write your message before submitting.', 'error');
          if (messageInput) messageInput.focus();
          return;
        }

        const payload = {
          type: enquiryType,
          name,
          email,
          phone,
          message
        };

        const originalBtnVal = submitBtn ? (submitBtn.value || submitBtn.textContent) : 'Submit';
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

          // Successful submission
          form.style.display = 'none';
          if (failMsg) {
            failMsg.style.display = 'none';
            failMsg.setAttribute('style', 'display:none !important;');
          }
          if (successMsg) {
            successMsg.style.display = 'block';
            successMsg.setAttribute('style', 'display:block !important;');
            const textEl = successMsg.querySelector('div') || successMsg;
            textEl.textContent = enquiryType === 'complaint'
              ? 'Thank you! Your complaint has been logged. Our store operations team will investigate and get back to you shortly.'
              : (res.message || 'Thank you! Your message has been received by our store team.');
          }

          showFormToast(
            enquiryType === 'complaint' ? 'Complaint logged successfully!' : 'Thank you! Your submission has been received.',
            'success'
          );
        } catch (err) {
          if (failMsg) {
            failMsg.style.display = 'block';
            failMsg.setAttribute('style', 'display:block !important;');
            const textEl = failMsg.querySelector('div') || failMsg;
            textEl.textContent = err.message || 'Unable to submit enquiry. Please try again.';
          }
          showFormToast(err.message || 'Failed to submit enquiry.', 'error');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            if (submitBtn.tagName === 'INPUT') submitBtn.value = originalBtnVal;
            else submitBtn.textContent = originalBtnVal;
          }
        }
      }, true);
    });

    // -------------------------------------------------------------
    // 2. FOOTER NEWSLETTER SUBSCRIPTION FORMS (all pages)
    // -------------------------------------------------------------
    const footerForms = document.querySelectorAll('.form-block-footer form, form.form-footer, form:has(.text-field-footer), .newsletter-input form');
    footerForms.forEach(form => {
      // Do not bind if it is a modal or already bound
      if (form.getAttribute('data-lane4-bound') || form.closest('.contact-form-modal')) return;
      form.setAttribute('data-lane4-bound', 'newsletter');
      neutralizeWebflowForm(form);

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const emailInput = form.querySelector('input.text-field-footer, input[type="email"], input[name="email"]');
        if (!emailInput) return;

        const email = emailInput.value.trim().toLowerCase();
        const submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');

        const wrapper = form.closest('.w-form') || form.closest('.form-block-footer') || form.parentElement;
        const successMsg = wrapper ? wrapper.querySelector('.w-form-done, .success-message') : null;
        const failMsg = wrapper ? wrapper.querySelector('.w-form-fail, .error-message') : null;

        if (failMsg) {
          failMsg.style.display = 'none';
          failMsg.setAttribute('style', 'display:none !important;');
        }

        if (!window.LANE4_VALIDATION.isValidEmail(email)) {
          if (failMsg) {
            failMsg.style.display = 'block';
            failMsg.setAttribute('style', 'display:block !important;');
            const textEl = failMsg.querySelector('div') || failMsg;
            textEl.textContent = 'Please enter a valid email address.';
          }
          showFormToast('Please enter a valid email address.', 'error');
          emailInput.focus();
          return;
        }

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
          if (failMsg) {
            failMsg.style.display = 'none';
            failMsg.setAttribute('style', 'display:none !important;');
          }
          if (successMsg) {
            successMsg.style.display = 'block';
            successMsg.setAttribute('style', 'display:block !important;');
            const textEl = successMsg.querySelector('div') || successMsg;
            textEl.textContent = res.message || 'Thank you! You are subscribed to LANE4 updates.';
          }

          showFormToast('Subscribed to LANE4 updates successfully!', 'success');
        } catch (err) {
          if (failMsg) {
            failMsg.style.display = 'block';
            failMsg.setAttribute('style', 'display:block !important;');
            const textEl = failMsg.querySelector('div') || failMsg;
            textEl.textContent = err.message || 'Something went wrong. Please try again.';
          }
          showFormToast(err.message || 'Subscription failed.', 'error');
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      }, true);
    });

    // -------------------------------------------------------------
    // 3. CATCH-ALL FOR ANY OTHER FORMS (prevent Webflow errors)
    // -------------------------------------------------------------
    const allRemainingForms = document.querySelectorAll('form:not([data-lane4-bound])');
    allRemainingForms.forEach(form => {
      // Ignore auth and search forms
      if (form.id && (form.id.includes('lane4') || form.id.includes('admin') || form.id.includes('search'))) return;

      neutralizeWebflowForm(form);
      form.setAttribute('data-lane4-bound', 'generic');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const wrapper = form.closest('.w-form') || form.parentElement;
        const successMsg = wrapper ? wrapper.querySelector('.w-form-done, .success-message') : null;
        const failMsg = wrapper ? wrapper.querySelector('.w-form-fail, .error-message') : null;

        const emailInput = form.querySelector('input[type="email"], input[name*="email" i]');
        const messageInput = form.querySelector('textarea, input[name*="message" i]');

        if (failMsg) failMsg.style.display = 'none';

        if (emailInput && !messageInput) {
          // Treat as newsletter
          const email = emailInput.value.trim().toLowerCase();
          try {
            await window.lane4ApiRequest('/newsletter/subscribe', {
              method: 'POST',
              body: JSON.stringify({ email, sourcePage: window.location.pathname })
            });
            form.style.display = 'none';
            if (successMsg) successMsg.style.display = 'block';
            showFormToast('Thank you for subscribing!', 'success');
          } catch (err) {
            if (failMsg) failMsg.style.display = 'block';
          }
        } else if (emailInput && messageInput) {
          // Treat as general enquiry
          const email = emailInput.value.trim().toLowerCase();
          const message = messageInput.value.trim();
          try {
            await window.lane4ApiRequest('/enquiries', {
              method: 'POST',
              body: JSON.stringify({ email, message, name: 'Visitor', type: 'general' })
            });
            form.style.display = 'none';
            if (successMsg) successMsg.style.display = 'block';
            showFormToast('Thank you! Your submission has been received.', 'success');
          } catch (err) {
            if (failMsg) failMsg.style.display = 'block';
          }
        }
      }, true);
    });
  }

  // Bind on DOM ready and after dynamic content changes
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initForms);
  } else {
    initForms();
  }
  window.addEventListener('load', initForms);
})();
