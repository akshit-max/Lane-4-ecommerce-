const { getDb } = require('../config/firebaseAdmin');

function normalizeDate(val) {
  if (!val) return new Date().toISOString();
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  if (val._seconds) return new Date(val._seconds * 1000).toISOString();
  if (val.seconds) return new Date(val.seconds * 1000).toISOString();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

class ReviewService {
  async getProductReviews(productId) {
    const db = getDb();
    if (!db) return [];

    let snap = await db.collection('reviews')
      .where('productId', '==', productId)
      .where('status', '==', 'approved')
      .get();

    let reviews = snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        createdAt: normalizeDate(data.createdAt)
      };
    });

    if (reviews.length === 0) {
      try {
        const prodDoc = await db.collection('products').doc(productId).get();
        if (prodDoc.exists && prodDoc.data().slug && prodDoc.data().slug !== productId) {
          const altSnap = await db.collection('reviews')
            .where('productId', '==', prodDoc.data().slug)
            .where('status', '==', 'approved')
            .get();
          reviews = altSnap.docs.map(d => {
            const data = d.data();
            return {
              ...data,
              createdAt: normalizeDate(data.createdAt)
            };
          });
        } else {
          const prodBySlug = await db.collection('products').where('slug', '==', productId).limit(1).get();
          if (!prodBySlug.empty && prodBySlug.docs[0].id !== productId) {
            const altSnap = await db.collection('reviews')
              .where('productId', '==', prodBySlug.docs[0].id)
              .where('status', '==', 'approved')
              .get();
            reviews = altSnap.docs.map(d => {
              const data = d.data();
              return {
                ...data,
                createdAt: normalizeDate(data.createdAt)
              };
            });
          }
        }
      } catch (_) {}
    }

    reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return reviews;
  }

  async submitReview({ productId, rating, title, comment, authorName, customerId = null }) {
    const db = getDb();
    if (!productId || !rating || !comment) {
      throw new Error('Product, rating (1-5), and review comment are required.');
    }

    const numRating = parseInt(rating, 10);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      throw new Error('Rating must be an integer between 1 and 5.');
    }

    let productName = '';
    let resolvedProductId = productId;
    let resolvedSlug = productId;
    try {
      let prodDoc = await db.collection('products').doc(productId).get();
      if (!prodDoc.exists) {
        const bySlug = await db.collection('products').where('slug', '==', productId).limit(1).get();
        if (!bySlug.empty) prodDoc = bySlug.docs[0];
      }
      if (prodDoc && prodDoc.exists) {
        const pd = prodDoc.data();
        productName = pd.name || '';
        resolvedProductId = prodDoc.id;
        resolvedSlug = pd.slug || prodDoc.id;
      }
    } catch (_) {}

    let isVerifiedPurchase = false;
    if (customerId) {
      try {
        const ordSnap = await db.collection('orders').where('customerId', '==', customerId).get();
        isVerifiedPurchase = ordSnap.docs.some(d => {
          const ord = d.data();
          const isPaidOrDelivered = ['verified', 'paid'].includes(ord.paymentStatus) || ord.status === 'delivered';
          if (!isPaidOrDelivered) return false;
          return (ord.items || []).some(it =>
            it.productId === resolvedProductId ||
            it.productId === productId ||
            it.slug === resolvedSlug ||
            it.slug === productId
          );
        });
      } catch (_) {}
    }

    const docRef = db.collection('reviews').doc();
    const newReview = {
      reviewId: docRef.id,
      productId,
      productName,
      customerId,
      authorName: (authorName || 'Verified Swimmer').trim(),
      rating: numRating,
      title: (title || '').trim(),
      comment: comment.trim(),
      status: 'pending', // Requires admin moderation
      isVerifiedPurchase,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await docRef.set(newReview);
    return newReview;
  }

  async listAdminReviews(filters = {}) {
    const db = getDb();
    let query = db.collection('reviews');
    if (filters.status) query = query.where('status', '==', filters.status);

    const snap = await query.get();
    return snap.docs.map(d => d.data());
  }

  async moderateReview(reviewId, status, adminUser) {
    const db = getDb();
    const docRef = db.collection('reviews').doc(reviewId);
    await docRef.update({
      status,
      moderatedBy: adminUser.uid,
      updatedAt: new Date()
    });
    return { reviewId, status };
  }

  async deleteReview(reviewId) {
    const db = getDb();
    await db.collection('reviews').doc(reviewId).delete();
    return { reviewId, deleted: true };
  }
}

module.exports = new ReviewService();

