/**
 * Currency utilities for The Lane4 Performance Store.
 * All pricing on backend is computed in integer Paise (1 INR = 100 Paise)
 * to prevent floating point inaccuracies.
 */

function rupeesToPaise(rupees) {
  if (typeof rupees === 'string') {
    rupees = parseFloat(rupees.replace(/[^\d.]/g, ''));
  }
  if (isNaN(rupees) || rupees < 0) {
    return 0;
  }
  return Math.round(rupees * 100);
}

function paiseToRupees(paise) {
  if (typeof paise !== 'number' || isNaN(paise)) {
    return 0;
  }
  return Number((paise / 100).toFixed(2));
}

function formatINR(paise) {
  const rupees = paiseToRupees(paise);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rupees);
}

module.exports = {
  rupeesToPaise,
  paiseToRupees,
  formatINR
};

