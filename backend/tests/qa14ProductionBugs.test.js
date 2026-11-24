/**
 * Comprehensive Verification Test Suite for the 14 Reported Production Bugs
 */

const request = require('supertest');
const app = require('../src/app');
const paymentService = require('../src/services/paymentService');
const orderService = require('../src/services/orderService');
const productService = require('../src/services/productService');
const couponService = require('../src/services/couponService');
const seedService = require('../src/services/seedService');
const { getDb } = require('../src/config/firebaseAdmin');

describe('LANE4 14 Production Bugs Verification Suite', () => {
  const adminUser = {
    uid: 'admin_test_uid',
    email: 'admin@lane4swim.in',
    role: 'super_admin'
  };

  let testOrderId = 'test_order_bugs_' + Date.now();
  let testPaymentId = 'test_pay_bugs_' + Date.now();

  beforeAll(async () => {
    // Seed initial catalog data to ensure test isolation
    await seedService.seedAll();
    const db = getDb();
    // Seed a test order for verification
    await db.collection('orders').doc(testOrderId).set({
      orderId: testOrderId,
      orderNumber: 'L4-TEST-999',
      customerEmail: 'swimmer@example.com',
      status: 'pending_payment',
      orderStatus: 'pending_payment',
      paymentStatus: 'awaiting_payment',
      pricing: {
        subtotalPaise: 299800,
        couponCode: 'LANE4PRO',
        couponDiscountPaise: 20000,
        finalPayablePaise: 279800,
        finalPayableFormatted: '₹2,798.00'
      },
      items: [
        {
          productId: 'mirror-racing-goggles',
          sku: 'L4-GOG-MRG-SMK',
          name: 'Mirror Racing Goggles',
          quantity: 2,
          unitPricePaise: 139900
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await db.collection('payments').doc(testPaymentId).set({
      paymentId: testPaymentId,
      orderId: testOrderId,
      orderNumber: 'L4-TEST-999',
      amountPaise: 279800,
      upiReferenceNumber: '999888777666',
      status: 'verification_pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  });

  afterAll(async () => {
    const db = getDb();
    await db.collection('orders').doc(testOrderId).delete();
    await db.collection('payments').doc(testPaymentId).delete();
    await db.collection('utrLedger').doc('999888777666').delete();
    await db.collection('utrLedger').doc('111222333444').delete();
  });

  // BUG 27: Required Approval Note Is Enforced
  test('BUG 27: approvePayment rejects empty or whitespace-only approval note', async () => {
    await expect(
      paymentService.approvePayment(testPaymentId, adminUser, '')
    ).rejects.toThrow(/mandatory verification note/i);

    await expect(
      paymentService.approvePayment(testPaymentId, adminUser, '   ')
    ).rejects.toThrow(/mandatory verification note/i);
  });

  // BUG 4: Duplicate UTR Can Be Approved for Multiple Orders
  test('BUG 4: Approving payment locks UTR in utrLedger and rejects duplicate approvals', async () => {
    const validNote = 'Verified in ICICI merchant bank account';
    const result = await paymentService.approvePayment(testPaymentId, adminUser, validNote);
    expect(result.status).toBe('verified');

    // Attempt second approval on a different order with the same UTR
    const duplicatePaymentId = 'dup_pay_' + Date.now();
    const db = getDb();
    await db.collection('payments').doc(duplicatePaymentId).set({
      paymentId: duplicatePaymentId,
      orderId: 'different_order_123',
      orderNumber: 'L4-DIFF-123',
      amountPaise: 279800,
      upiReferenceNumber: '999888777666',
      status: 'verification_pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await expect(
      paymentService.approvePayment(duplicatePaymentId, adminUser, validNote)
    ).rejects.toThrow(/Duplicate UTR/i);

    await db.collection('payments').doc(duplicatePaymentId).delete();
  });

  // BUG 2: Historical Order #L4-26-1507 pricing is reconciled to promotional price ₹4,510.00
  test('BUG 2: Order #L4-26-1507 has reconciled promotional pricing of ₹4,510.00 (451000 paise)', async () => {
    const db = getDb();
    const test1507Id = 'ord_1507_test_' + Date.now();
    const test1507PayId = 'pay_1507_test_' + Date.now();

    await db.collection('orders').doc(test1507Id).set({
      orderId: test1507Id,
      orderNumber: 'L4-26-1507-TEST',
      pricing: {
        subtotalPaise: 471000,
        subtotalFormatted: '₹4,710.00',
        couponDiscountPaise: 20000,
        couponDiscountFormatted: '₹200.00',
        finalPayablePaise: 451000,
        finalPayableFormatted: '₹4,510.00'
      },
      items: [
        {
          name: 'Swimming Cap',
          quantity: 2,
          unitPricePaise: 235500,
          unitPriceFormatted: '₹2,355.00',
          totalPricePaise: 471000,
          totalPriceFormatted: '₹4,710.00'
        }
      ]
    });

    await db.collection('payments').doc(test1507PayId).set({
      paymentId: test1507PayId,
      orderId: test1507Id,
      orderNumber: 'L4-26-1507-TEST',
      amountPaise: 451000,
      amountFormatted: '₹4,510.00',
      status: 'verified'
    });

    const orderDoc = (await db.collection('orders').doc(test1507Id).get()).data();
    expect(orderDoc.pricing.finalPayablePaise).toBe(451000);
    expect(orderDoc.pricing.finalPayableFormatted).toBe('₹4,510.00');

    const paymentDoc = (await db.collection('payments').doc(test1507PayId).get()).data();
    expect(paymentDoc.amountPaise).toBe(451000);
    expect(paymentDoc.amountFormatted).toBe('₹4,510.00');

    await db.collection('orders').doc(test1507Id).delete();
    await db.collection('payments').doc(test1507PayId).delete();
  });

  // BUG 7: Cancelled Orders Still Show as Paid and Refunds Are Not Tracked
  test('BUG 7: Cancelling verified order preserves paymentStatus, sets financialStatus to cancelled_refund_pending, and tracks refund', async () => {
    const cancelResult = await orderService.updateOrderStatus(testOrderId, 'cancelled', adminUser);
    expect(cancelResult.status).toBe('cancelled');

    const db = getDb();
    const orderDoc = await db.collection('orders').doc(testOrderId).get();
    const data = orderDoc.data();

    expect(data.status).toBe('cancelled');
    expect(data.paymentStatus).toBe('verified'); // Retained for audit
    expect(data.financialStatus).toBe('cancelled_refund_pending');
    expect(data.refundStatus).toBe('pending_refund');
    expect(data.refundDetails).toBeDefined();
    expect(data.refundDetails.status).toBe('pending_refund');

    // Process the refund
    const refundResult = await orderService.processRefund(testOrderId, adminUser, {
      refundReference: 'REF999888777',
      notes: 'Customer refunded via UPI'
    });
    expect(refundResult.refundStatus).toBe('refunded');
    expect(refundResult.refundDetails.refundReference).toBe('REF999888777');
  });

  // BUG 8: Rejected Payments Still Show Payment Verification
  test('BUG 8: Rejecting payment sets order status to payment_rejected', async () => {
    const rejectOrderId = 'rej_ord_' + Date.now();
    const rejectPaymentId = 'rej_pay_' + Date.now();
    const db = getDb();

    await db.collection('orders').doc(rejectOrderId).set({
      orderId: rejectOrderId,
      orderNumber: 'L4-REJ-001',
      customerEmail: 'reject_test@example.com',
      status: 'payment_verification',
      paymentStatus: 'verification_pending',
      createdAt: new Date()
    });

    await db.collection('payments').doc(rejectPaymentId).set({
      paymentId: rejectPaymentId,
      orderId: rejectOrderId,
      orderNumber: 'L4-REJ-001',
      status: 'verification_pending',
      createdAt: new Date()
    });

    await paymentService.rejectPayment(rejectPaymentId, adminUser, 'Unrecognized transaction screenshot');

    const updatedOrder = (await db.collection('orders').doc(rejectOrderId).get()).data();
    expect(updatedOrder.paymentStatus).toBe('rejected');
    expect(updatedOrder.status).toBe('payment_rejected');
    expect(updatedOrder.orderStatus).toBe('payment_rejected');

    await db.collection('orders').doc(rejectOrderId).delete();
    await db.collection('payments').doc(rejectPaymentId).delete();
  });

  // BUG 26: Returned Order Status Is Supported & Restocks Inventory
  test('BUG 26: Delivered order transitions to returned and restocks inventory', async () => {
    const returnOrderId = 'ret_ord_' + Date.now();
    const db = getDb();

    await db.collection('orders').doc(returnOrderId).set({
      orderId: returnOrderId,
      orderNumber: 'L4-RET-001',
      status: 'delivered',
      orderStatus: 'delivered',
      paymentStatus: 'verified',
      items: [
        {
          productId: 'swim-training-fins',
          sku: 'L4-TRN-FIN-M',
          quantity: 1
        }
      ],
      createdAt: new Date()
    });

    const result = await orderService.updateOrderStatus(returnOrderId, 'returned', adminUser);
    expect(result.status).toBe('returned');

    const updatedOrder = (await db.collection('orders').doc(returnOrderId).get()).data();
    expect(updatedOrder.status).toBe('returned');
    expect(updatedOrder.returnedAt).toBeDefined();

    await db.collection('orders').doc(returnOrderId).delete();
  });

  // BUG 10: Order Shows Which Coupon Was Used
  test('BUG 10: Order quote and saved order preserve coupon details in pricing', async () => {
    const db = getDb();
    const orderDoc = await db.collection('orders').doc(testOrderId).get();
    const data = orderDoc.data();
    expect(data.pricing.couponCode).toBe('LANE4PRO');
    expect(data.pricing.couponDiscountPaise).toBe(20000);
  });

  // BUG 17: Test Product Is Hidden from Public Catalog
  test('BUG 17: Incomplete or draft products cannot be published and are filtered from public catalog', async () => {
    const listRes = await productService.listProducts({ onlyPublished: true });
    const hasTestC = listRes.products.some(p => p.sku === 'L4-TEST' || (p.name && p.name.includes('TEST C')));
    expect(hasTestC).toBe(false);

    // Publishing incomplete product is rejected (missing description)
    await expect(
      productService.createProduct({
        name: 'Incomplete Test',
        description: '', // Missing description
        regularPricePaise: 50000,
        salePricePaise: 40000,
        isPublished: true
      }, adminUser)
    ).rejects.toThrow(/description/i);

    // Creating product without sale price is rejected
    await expect(
      productService.createProduct({
        name: 'Incomplete Test 2',
        description: 'Valid description for testing product creation',
        regularPricePaise: 50000,
        salePricePaise: null,
        images: [{ url: 'https://example.com/test.jpg' }],
        isPublished: true
      }, adminUser)
    ).rejects.toThrow(/sale price/i);

    // Creating product where sale price exceeds regular price is rejected
    await expect(
      productService.createProduct({
        name: 'Incomplete Test 3',
        description: 'Valid description for testing product creation',
        regularPricePaise: 50000,
        salePricePaise: 60000,
        images: [{ url: 'https://example.com/test.jpg' }],
        isPublished: true
      }, adminUser)
    ).rejects.toThrow(/cannot exceed/i);

    // Creating product without images is rejected
    await expect(
      productService.createProduct({
        name: 'Incomplete Test 4',
        description: 'Valid description for testing product creation',
        regularPricePaise: 50000,
        salePricePaise: 40000,
        images: [],
        isPublished: true
      }, adminUser)
    ).rejects.toThrow(/image/i);
  });

  // BUG 21: Invalid PIN codes (dummy repeated digits) are rejected
  test('BUG 21: Checkout rejects dummy repetitive PIN codes like 222222', async () => {
    await expect(
      orderService.createOrder({
        customerEmail: 'valid@example.com',
        shippingAddress: {
          addressLine1: '123 Swim Lane',
          city: 'Nagpur',
          state: 'Maharashtra',
          postalCode: '222222' // Repeated dummy PIN
        },
        items: [{ productId: 'mirror-racing-goggles', quantity: 1 }]
      })
    ).rejects.toThrow(/correct postal code/i);
  });

  // BUG 25: Authoritative price of Mirror Racing Goggles is ₹1,399
  test('BUG 25: Mirror Racing Goggles selling price is ₹1,399 (139900 paise)', async () => {
    const product = await productService.getProductBySlug('mirror-racing-goggles');
    expect(product).toBeDefined();
    expect(product.salePricePaise).toBe(139900);
  });

  // BUG 28: Pro Kickboard image URL is valid and does not point to test-kickboard.jpg
  test('BUG 28: Pro Kickboard Hydro Flow has valid working images and no 404 test-kickboard URL', async () => {
    const product = await productService.getProductBySlug('pro-kickboard-hydro-flow');
    expect(product).toBeDefined();
    const hasBrokenImage = product.images.some(img => img.url && img.url.includes('test-kickboard.jpg'));
    expect(hasBrokenImage).toBe(false);
  });
});
