/**
 * LANE4 Client API Utilities
 */

(function () {
  window.LANE4 = window.LANE4 || {};

  window.LANE4.formatINR = function (paise) {
    const rupees = (paise || 0) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(rupees);
  };

  window.LANE4.getGuestId = function () {
    let id = localStorage.getItem('lane4_guest_id');
    if (!id) {
      id = 'gst_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem('lane4_guest_id', id);
    }
    return id;
  };

  window.LANE4.getUser = function () {
    try {
      const u = localStorage.getItem('lane4_user');
      return u ? JSON.parse(u) : null;
    } catch (e) {
      return null;
    }
  };

  window.LANE4.resolveAssetUrl = function (url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const cleanUrl = url.replace(/^(\.\.\/|\.\/|\/)+/, '');
    const isFile = typeof window !== 'undefined' && window.location && window.location.protocol === 'file:';
    const path = (typeof window !== 'undefined' && window.location && window.location.pathname) || '';
    const isSubfolder = /\/(product|category|blog|authors|utility-pages|category-blog|admin)(\/|$)/i.test(path);

    if (isFile) {
      return isSubfolder ? `../${cleanUrl}` : cleanUrl;
    }
    return `/${cleanUrl}`;
  };

  window.LANE4.setUser = function (user, token) {
    if (user) {
      localStorage.setItem('lane4_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('lane4_user');
    }
    if (token) {
      localStorage.setItem('lane4_auth_token', token);
    } else if (token === null) {
      localStorage.removeItem('lane4_auth_token');
    }
    window.dispatchEvent(new CustomEvent('lane4:auth-changed', { detail: user }));
  };

  window.LANE4.logout = function () {
    window.LANE4.setUser(null, null);
    window.location.reload();
  };
})();

