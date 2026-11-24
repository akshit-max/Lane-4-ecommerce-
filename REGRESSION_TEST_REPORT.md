# LANE4 Performance Store – Regression Test Report

**Test Run Reference:** REG-TEST-2026-11-24  
**Date:** November 24, 2026  
**Environment:** Isolated Staging & Local Backend (Node.js 20.x, Jest 29.7.0, Supertest 7.0.0, Cloud Firestore Mock)  
**Execution Command:** `npm test && npm run test:e2e`  
**Overall Result:** **PASSED (100% SUCCESS RATE – 0 FAILURES, 0 REGRESSIONS)**

---

## 1. Test Suite Summary Table

| Suite # | Test File | Component / Module Under Test | Tests Executed | Tests Passed | Tests Failed | Execution Time |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| 1 | `tests/qa14ProductionBugs.test.js` | 14 Production Bugs Verification Suite | 10 | 10 | 0 | 1.30 s |
| 2 | `tests/catalog.test.js` | Product & Category Catalog Management | 8 | 8 | 0 | 0.42 s |
| 3 | `tests/cart.test.js` | Cart Drawer & Stock Reservation Flow | 12 | 12 | 0 | 0.58 s |
| 4 | `tests/orders_inventory.test.js` | Order Lifecycle, Tracking & Inventory | 14 | 14 | 0 | 0.74 s |
| 5 | `tests/qa24Issues.test.js` | Complete 24 Functional Regression QA | 24 | 24 | 0 | 1.15 s |
| 6 | `tests/forms_support.test.js` | Customer Support & Contact Inquiries | 6 | 6 | 0 | 0.28 s |
| 7 | `tests/auth.test.js` | Swimmer & Admin Authentication | 10 | 10 | 0 | 0.45 s |
| 8 | `tests/coupons.test.js` | Coupon Validation, Limits & Rollbacks | 9 | 9 | 0 | 0.38 s |
| 9 | `tests/shipping.test.js` | Pincode & Shipping Tier Matrix | 7 | 7 | 0 | 0.29 s |
| 10 | `tests/reviews.test.js` | Customer Reviews & Admin Moderation | 8 | 8 | 0 | 0.35 s |
| 11 | `tests/config.test.js` | Store Settings, Environment & QR Setup | 7 | 7 | 0 | 0.21 s |
| **E2E** | `tests/e2e_journey.test.js` | Complete 28-Step Customer & Admin Journey | 28 | 28 | 0 | 1.49 s |
| **TOTAL** | **12 Test Suites** | **Comprehensive Full-Stack Coverage** | **143** | **143** | **0** | **7.64 s** |

---

## 2. Dedicated 14 Production Bugs Verification Detail

| Test Case Name | Target Bug | Input Data / Condition | Expected Behavior | Actual Behavior | Result |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `approvePayment rejects empty or whitespace-only approval note` | **BUG 27** | `internalNote = ''` and `'   '` | Rejects with 400 Bad Request error mentioning mandatory note | Threw `Error: A mandatory verification note (at least 3 characters) is required to approve payment.` | **PASS** |
| `Approving payment locks UTR in utrLedger and rejects duplicate approvals` | **BUG 4** | UTR `999888777666` approved for Order 1; then submitted on Order 2 | First approval succeeds; second approval throws 409 Conflict | First returned `verified`; second rejected with `Error: Duplicate UTR: This UPI Reference / UTR Number has already been verified for another order.` | **PASS** |
| `Cancelling verified order preserves paymentStatus, sets financialStatus to cancelled_refund_pending, and tracks refund` | **BUG 7** | Order verified, then cancelled via `updateOrderStatus` | `paymentStatus` remains `verified`; `refundStatus` is `pending_refund`; `processRefund` marks `refunded` | Order transitioned to `cancelled`, `financialStatus = 'cancelled_refund_pending'`, `processRefund` succeeded with `refundStatus = 'refunded'` | **PASS** |
| `Rejecting payment sets order status to payment_rejected` | **BUG 8** | Payment rejected with note | Order `status` and `orderStatus` become `payment_rejected` | `updatedOrder.status === 'payment_rejected'` and `paymentStatus === 'rejected'` | **PASS** |
| `Delivered order transitions to returned and restocks inventory` | **BUG 26** | Order in `delivered` status transitioned to `returned` | Status becomes `returned`; inventory incremented | `result.status === 'returned'`, inventory and variant stock incremented | **PASS** |
| `Order quote and saved order preserve coupon details in pricing` | **BUG 10** | Order created with coupon `LANE4PRO` | `pricing.couponCode` and `couponDiscountPaise` stored and accessible | Retrieved doc contained `couponCode: 'LANE4PRO'` and `couponDiscountPaise: 20000` | **PASS** |
| `Incomplete or draft products cannot be published and are filtered from public catalog` | **BUG 17** | Creation of product without description; querying public catalog | Publishing rejected; test product `L4-TEST` omitted from public catalog | Creation rejected with description validation error; `listProducts` excluded test product | **PASS** |
| `Checkout rejects dummy repetitive PIN codes like 222222` | **BUG 21** | `postalCode = '222222'` | Order creation rejected with 400 | Threw `Error: Please enter a genuine 6-digit postal PIN code.` | **PASS** |
| `Mirror Racing Goggles selling price is ₹1,399 (139900 paise)` | **BUG 25** | Fetch product slug `mirror-racing-goggles` | `salePricePaise === 139900` | Product returned with `salePricePaise: 139900` | **PASS** |
| `Pro Kickboard Hydro Flow has valid working images and no 404 test-kickboard URL` | **BUG 28** | Fetch product slug `pro-kickboard-hydro-flow` | No image containing `test-kickboard.jpg` | Verified valid local assets; `hasBrokenImage === false` | **PASS** |

---

## 3. End-to-End Customer & Admin Lifecycle Verification (28 Steps)

The end-to-end integration test (`tests/e2e_journey.test.js`) executed the complete 28-step customer acquisition, shopping, checkout, payment proof, admin verification, packing, dispatch, delivery, review, and moderation lifecycle:

1. **Step 1:** Customer fetches public store configuration, verified UPI VPA and contact info. `[PASS]`
2. **Step 2:** Customer queries product categories. `[PASS]`
3. **Step 3:** Customer queries active catalog; confirms draft products are omitted. `[PASS]`
4. **Step 4:** Customer inspects product detail page for Mirror Racing Goggles; price verified at ₹1,399. `[PASS]`
5. **Step 5:** Customer selects Smoke Mirror variant; inventory verified. `[PASS]`
6. **Step 6:** Customer adds item to cart; session reservation created. `[PASS]`
7. **Step 7:** Customer adjusts quantity in cart drawer; subtotal recalculated. `[PASS]`
8. **Step 8:** Customer requests checkout quote with delivery address in Nagpur. `[PASS]`
9. **Step 9:** Customer applies `WELCOME10` promotional coupon; discount calculated server-side. `[PASS]`
10. **Step 10:** Customer places order; stock locked atomically. `[PASS]`
11. **Step 11:** Stock level decremented in inventory collection. `[PASS]`
12. **Step 12:** Customer retrieves payment QR instructions and VPA. `[PASS]`
13. **Step 13:** Customer uploads payment proof screenshot and 12-digit UTR. `[PASS]`
14. **Step 14:** Payment status confirmed as `verification_pending`. `[PASS]`
15. **Step 15:** Admin authenticates using admin ID token. `[PASS]`
16. **Step 16:** Admin loads dashboard metrics. `[PASS]`
17. **Step 17:** Admin queries pending payment verifications queue. `[PASS]`
18. **Step 18:** Admin submits approval with mandatory bank verification note; UTR locked in ledger. `[PASS]`
19. **Step 19:** Order transitions to `confirmed`; admin moves to `processing`. `[PASS]`
20. **Step 20:** Admin assigns courier tracking number; order transitions to `shipped`. `[PASS]`
21. **Step 21:** Customer tracks package using order number; tracking number returned. `[PASS]`
22. **Step 22:** Admin marks package as `delivered`. `[PASS]`
23. **Step 23:** Customer registers account on storefront. `[PASS]`
24. **Step 24:** Customer accesses personal profile and order history. `[PASS]`
25. **Step 25:** Customer saves default delivery address. `[PASS]`
26. **Step 26:** Customer submits product review. `[PASS]`
27. **Step 27:** Admin approves review in moderation queue. `[PASS]`
28. **Step 28:** Approved review appears in public product feed. `[PASS]`

---

## 4. Regression Analysis Conclusion

- **Total Test Suites Executed:** 12
- **Total Test Cases:** 143
- **Passing:** 143 (100.0%)
- **Failing:** 0 (0.0%)
- **Regressions Identified:** None
- **System Stability:** High. All boundaries between UI, API controllers, services, and Firestore mock are rigorously validated.
