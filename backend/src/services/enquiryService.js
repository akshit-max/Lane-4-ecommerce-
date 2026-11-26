const { getDb } = require('../config/firebaseAdmin');
const { logger } = require('../utils/logger');

function toEnquiryMillis(val) {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val._seconds === 'number') return val._seconds * 1000 + (val._nanoseconds || 0) / 1e6;
  if (typeof val.seconds === 'number') return val.seconds * 1000 + (val.nanoseconds || 0) / 1e6;
  const t = new Date(val).getTime();
  return Number.isFinite(t) ? t : 0;
}

class EnquiryService {
  async submitEnquiry({ type = 'general', name, email, phone = '', message }) {
    const db = getDb();
    if (!db) throw new Error('Database unavailable');

    const cleanEmail = email ? email.toLowerCase().trim() : '';
    const cleanMsg = message ? message.trim() : '';
    const cleanName = (name && name.trim()) ? name.trim() : '';
    const cleanPhone = (phone || '').trim();

    if (!cleanName || cleanName.length < 2) {
      throw new Error('Full name is required (at least 2 characters).');
    }
    if (/\d/.test(cleanName)) {
      throw new Error('Name must not contain any numbers.');
    }
    if (!/^[a-zA-Z\s\.\'\-]+$/.test(cleanName)) {
      throw new Error('Name must contain only alphabets and spaces.');
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      throw new Error('Please enter a valid email address.');
    }
    if (!cleanPhone) {
      throw new Error('Phone number is required.');
    }
    if (/[a-zA-Z]/.test(cleanPhone)) {
      throw new Error('Phone number must not contain any text.');
    }
    const rawDigits = cleanPhone.replace(/[\s\-\(\)\+]/g, '');
    if (!/^(?:91)?[6-9]\d{9}$/.test(rawDigits)) {
      throw new Error('Please enter a valid 10-digit Indian mobile number.');
    }
    if (!cleanMsg || cleanMsg.length < 5) {
      throw new Error('Message must be at least 5 characters long.');
    }

    const docRef = db.collection('enquiries').doc();
    const newEnquiry = {
      enquiryId: docRef.id,
      type: type || 'general',
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      message: cleanMsg,
      status: 'new',
      createdAt: new Date()
    };

    await docRef.set(newEnquiry);

    // Notify admin
    await db.collection('notifications').add({
      type: 'new_enquiry',
      title: `New ${type.toUpperCase()} Enquiry Received`,
      message: `${cleanName} (${cleanEmail}): ${cleanMsg.slice(0, 80)}...`,
      referenceId: docRef.id,
      isRead: false,
      createdAt: new Date()
    });

    return newEnquiry;
  }

  async listEnquiries(filters = {}) {
    const db = getDb();
    if (!db) return [];

    let query = db.collection('enquiries');
    if (filters.status) query = query.where('status', '==', filters.status);
    if (filters.type) query = query.where('type', '==', filters.type);

    const snap = await query.get();
    let enquiries = snap.docs.map(d => d.data());
    enquiries.sort((a, b) => toEnquiryMillis(b.createdAt) - toEnquiryMillis(a.createdAt));
    return enquiries;
  }

  async updateEnquiryStatus(id, { status, adminNotes }, adminUser) {
    const db = getDb();
    const docRef = db.collection('enquiries').doc(id);
    const updates = {
      status,
      adminNotes: adminNotes || '',
      resolvedAt: status === 'resolved' ? new Date() : null,
      updatedAt: new Date()
    };
    await docRef.update(updates);
    return { id, ...updates };
  }
}

module.exports = new EnquiryService();

