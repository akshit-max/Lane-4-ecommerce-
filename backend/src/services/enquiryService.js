const { getDb } = require('../config/firebaseAdmin');
const { logger } = require('../utils/logger');

class EnquiryService {
  async submitEnquiry({ type = 'general', name, email, phone = '', message }) {
    const db = getDb();
    if (!db) throw new Error('Database unavailable');

    const cleanEmail = email ? email.toLowerCase().trim() : '';
    const cleanMsg = message ? message.trim() : '';
    const cleanName = (name && name.trim()) ? name.trim() : (cleanEmail ? cleanEmail.split('@')[0] : 'Swimmer');

    if (!cleanEmail || !cleanMsg) {
      throw new Error('Valid email and message are required.');
    }

    const docRef = db.collection('enquiries').doc();
    const newEnquiry = {
      enquiryId: docRef.id,
      type: type || 'general',
      name: cleanName,
      email: cleanEmail,
      phone: (phone || '').trim(),
      message: cleanMsg,
      status: 'new',
      createdAt: new Date()
    };

    await docRef.set(newEnquiry);

    // Notify admin
    await db.collection('notifications').add({
      type: 'new_enquiry',
      title: `New ${type.toUpperCase()} Enquiry Received`,
      message: `${name.trim()} (${email.trim()}): ${message.slice(0, 80)}...`,
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
    enquiries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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

