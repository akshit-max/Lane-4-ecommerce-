const { getDb } = require('../config/firebaseAdmin');

class NewsletterService {
  async subscribe(email, sourcePage = 'footer') {
    const db = getDb();
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    const cleanEmail = email.toLowerCase().trim();
    // Unique ID from sanitized email
    const docId = cleanEmail.replace(/[^a-z0-9]/g, '_');
    const docRef = db.collection('newsletterSubscribers').doc(docId);
    const existing = await docRef.get();

    if (existing.exists && existing.data().status === 'subscribed') {
      return { email: cleanEmail, status: 'already_subscribed', message: 'You are already subscribed to our newsletter.' };
    }

    const subscriberData = {
      email: cleanEmail,
      sourcePage,
      status: 'subscribed',
      subscribedAt: new Date()
    };

    await docRef.set(subscriberData);
    return { email: cleanEmail, status: 'subscribed', message: 'Thank you for subscribing to LANE4 updates!' };
  }

  async listSubscribers() {
    const db = getDb();
    const snap = await db.collection('newsletterSubscribers').where('status', '==', 'subscribed').get();
    return snap.docs.map(d => d.data());
  }
}

module.exports = new NewsletterService();

