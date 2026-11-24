/**
 * LANE4 Forms Controller
 * Connects all existing frontend forms (Newsletter, Contact Modals) to backend APIs.
 */

(function () {
  // Common input validation helpers
  window.LANE4_VALIDATION = {
    isValidEmail: function (email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email).trim());
    },
    isValidIndianPhone: function (phone) {
      const clean = String(phone).replace(/[\s\-\(\)\+]/g, '');
      return /^(?:91)?[6-9]\d{9}$/.test(clean);
    },
    isValidPincode: function (pin) {
      return /^[1-9][0-9]{5}$/.test(String(pin).trim());
    },
    isValidPostalCode: function (pin) {
      return /^[1-9][0-9]{5}$/.test(String(pin).trim());
    },
    cleanPhone: function (phone) {
      let clean = String(phone).replace(/[\s\-\(\)]/g, '');
      if (clean.startsWith('+91')) clean = clean.substring(3);
      else if (clean.startsWith('91') && clean.length === 12) clean = clean.substring(2);
      return clean.trim();
    }
  };

  function initForms() {
    // 1. Newsletter Forms
    const newsletterForms = document.querySelectorAll('form.form-footer, form#email-form, form#wf-form-Newsletter, form.newsletter-contact-cta, [data-name="Newsletter"]');
    newsletterForms.forEach(form => {
      // Unbind Webflow's legacy form submit handlers so Webflow doesn't trigger "Oops!"
      form.setAttribute('onsubmit', 'return false;');
      if (window.jQuery) {
        try {
          window.jQuery(form).off('submit');
          window.jQuery(document).off('submit', form);
        } catch (_) {}
      }

      // Avoid binding twice
      if (form.getAttribute('data-lane4-bound')) return;
      form.setAttribute('data-lane4-bound', 'true');

      // Intercept on capturing phase to completely halt Webflow legacy form submission
      form.addEventListener('submit', async (e) => {
        const emailInput = form.querySelector('input[type="email"], input[name="email"], input[name="newsletter"]');
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

        if (!window.LANE4_VALIDATION.isValidEmail(email)) {
          if (failMsg) {
            failMsg.style.display = 'block';
            failMsg.innerHTML = '<div>Please enter a valid email address.</div>';
          } else {
            alert('Please enter a valid email address.');
          }
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
            alert(err.message || 'Subscription failed');
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

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();

        // Extract inputs
        const nameInput = form.querySelector('input[name^="name"], input[type="text"]');
        const emailInput = form.querySelector('input[type="email"], input[name^="Email"]');
        const phoneInput = form.querySelector('input[type="tel"], input[name="name-3"]');
        const messageInput = form.querySelector('textarea, input[name^="field"]');

        const submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');
        const successMsg = form.parentElement?.querySelector('.w-form-done, .success-message');
        const failMsg = form.parentElement?.querySelector('.w-form-fail, .error-message');
        if (failMsg) failMsg.style.display = 'none';

        const payload = {
          type: enquiryType,
          name: nameInput ? nameInput.value.trim() : 'Website Visitor',
          email: emailInput ? emailInput.value.trim() : '',
          phone: phoneInput ? phoneInput.value.trim() : '',
          message: messageInput ? messageInput.value.trim() : ''
        };

        if (!payload.email || !payload.message) {
          alert('Please enter your email and message.');
          return;
        }

        try {
          if (submitBtn) submitBtn.disabled = true;

          const res = await window.lane4ApiRequest('/enquiries', {
            method: 'POST',
            body: JSON.stringify(payload)
          });

          form.style.display = 'none';
          if (successMsg) {
            successMsg.style.display = 'block';
            successMsg.textContent = 'Thank you! Your message has been received by our store team.';
          }
          if (failMsg) failMsg.style.display = 'none';
        } catch (err) {
          if (failMsg) {
            failMsg.style.display = 'block';
            failMsg.textContent = err.message || 'Something went wrong submitting your enquiry.';
          } else {
            alert(err.message || 'Submission failed');
          }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      }, true);
    });
  }

  document.addEventListener('DOMContentLoaded', initForms);
})();

