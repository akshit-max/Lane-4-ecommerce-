/**
 * LANE4 Forms Controller
 * Connects all existing frontend forms (Newsletter, Contact Modals) to backend APIs.
 */

(function () {
  function initForms() {
    // 1. Newsletter Forms
    const newsletterForms = document.querySelectorAll('form.form-footer, form#email-form, form.newsletter-contact-cta, [data-name="Newsletter"]');
    newsletterForms.forEach(form => {
      // Avoid binding twice
      if (form.getAttribute('data-lane4-bound')) return;
      form.setAttribute('data-lane4-bound', 'true');

      form.addEventListener('submit', async (e) => {
        // Only intercept if it looks like a newsletter form (has email input)
        const emailInput = form.querySelector('input[type="email"], input[name="email"], input[name="newsletter"]');
        if (!emailInput) return;

        e.preventDefault();
        const email = emailInput.value.trim();
        const submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');

        const successMsg = form.parentElement?.querySelector('.w-form-done, .success-message');
        const failMsg = form.parentElement?.querySelector('.w-form-fail, .error-message');

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
          if (successMsg) {
            successMsg.style.display = 'block';
            successMsg.textContent = res.message || 'Thank you! You are subscribed to LANE4 updates.';
          }
          if (failMsg) failMsg.style.display = 'none';
        } catch (err) {
          if (failMsg) {
            failMsg.style.display = 'block';
            failMsg.textContent = err.message || 'Something went wrong. Please try again.';
          } else {
            alert(err.message || 'Subscription failed');
          }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
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
      if (!form || form.getAttribute('data-lane4-bound')) return;
      form.setAttribute('data-lane4-bound', 'true');

      const enquiryType = modalTypeMap[index] || 'general';

      form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Extract inputs
        const nameInput = form.querySelector('input[name^="name"], input[type="text"]');
        const emailInput = form.querySelector('input[type="email"], input[name^="Email"]');
        const phoneInput = form.querySelector('input[type="tel"], input[name="name-3"]');
        const messageInput = form.querySelector('textarea, input[name^="field"]');

        const submitBtn = form.querySelector('input[type="submit"], button[type="submit"]');
        const successMsg = form.parentElement?.querySelector('.w-form-done, .success-message');
        const failMsg = form.parentElement?.querySelector('.w-form-fail, .error-message');

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
      });
    });
  }

  document.addEventListener('DOMContentLoaded', initForms);
})();

