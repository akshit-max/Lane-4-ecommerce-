# LANE4 Performance Store – Root Cause Analysis (RCA)

**Document Reference:** RCA-L4-2026-001  
**Author:** Senior Full-Stack & Systems Architecture Engineering  
**Scope:** Complete Architectural Root Cause Analysis for All 14 Production Incidents  
**Classification:** Internal Technical Audit & Systems Hardening  

---

## 1. Executive Summary

This Root Cause Analysis examines the structural, systemic, and concurrency-related vulnerabilities that allowed 14 distinct production defects to occur in the LANE4 e-commerce platform.

Rather than treating these defects as disconnected bugs, this RCA groups them into **6 systemic architectural patterns**:
1. Concurrency & Unique Constraint Deficits in NoSQL Transactions (Bug 4)
2. State Decoupling in Financial & Order Lifecycles (Bugs 7, 8, 26)
3. Pricing Derivation & Static Cache Desynchronization (Bugs 2, 25)
4. State Invalidation & Coupon Rollback Atomicity (Bug 9)
5. Content Gating & Catalog Publication Boundaries (Bugs 17, 28)
6. Data Sanitization & Input Validation Boundaries (Bugs 10, 11, 21, 24, 27)

---

## 2. In-Depth Systemic Root Cause Analyses

### Architectural Vulnerability 1: Concurrency & Unique Constraint Deficits in NoSQL Transactions
- **Affected Issue:** **BUG 4 (CRITICAL)** – Duplicate UTR Approved for Multiple Orders
- **Incident Description:** Order #L4-26-4959 and Order #L4-26-1001 were both marked approved using identical UTR `123456789123`.
- **Deep Root Cause:**
  - Google Cloud Firestore is a document store that does not natively enforce uniqueness constraints across arbitrary document fields unless the field value is used as the document key.
  - The payment verification code performed a read on the `payments` collection, checked if a payment document with that UTR was already marked `verified`, and then updated the document in a subsequent write.
  - This design created a classic **Check-Then-Act Race Condition (Time-of-Check to Time-of-Use / TOCTOU)**. If two administrators opened verification queues concurrently, or if an administrator double-clicked an approval button, both operations read the payment record before either write completed.
  - Furthermore, if two distinct orders submitted the same UTR, queries filtering by `orderId` never inspected payment records associated with other orders.
- **Architectural Solution:**
  - Introduced an atomic single-source-of-truth **UTR Ledger Pattern**.
  - A dedicated top-level collection `utrLedger` was created where the document key is the normalized 12-digit UTR (`db.collection('utrLedger').doc(cleanUtr)`).
  - Inside a Firestore atomic transaction (`db.runTransaction`), the ledger document is checked and locked. If the document already exists, the transaction aborts with HTTP 409 Conflict. If not, the transaction writes the ownership record atomically with the order and payment update.
  - This guarantees serializability and absolute uniqueness across the platform.

---

### Architectural Vulnerability 2: State Decoupling in Financial & Order Lifecycles
- **Affected Issues:**
  - **BUG 7 (CRITICAL)** – Cancelled Orders Still Show as Paid & Missing Refund Tracking (#L4-26-1006)
  - **BUG 8 (HIGH)** – Rejected Payments Still Show "Payment Verification" (#L4-26-4959, #L4-26-9084)
  - **BUG 26 (MEDIUM)** – Returned Order Status Is Missing
- **Incident Description:** Cancelled orders retained `paymentStatus: 'verified'` without tracking refunds; rejected payments left orders stuck in `payment_verification`; returned items had no workflow.
- **Deep Root Cause:**
  - In traditional e-commerce architectures, an order encompasses multiple orthogonal state machines:
    1. **Fulfillment State Machine:** `pending` -> `confirmed` -> `processing` -> `shipped` -> `delivered` -> `returned`
    2. **Payment State Machine:** `awaiting_payment` -> `verification_pending` -> `verified` | `rejected`
    3. **Financial / Refund State Machine:** `unpaid` -> `paid` -> `cancelled_refund_pending` -> `refunded`
  - Previously, `orderService` and `paymentService` conflated these distinct lifecycles into a single overloaded `status` field. When an order was cancelled, changing `status` to `'cancelled'` left `paymentStatus` orphaned as `'verified'`, giving the false impression that the money had been kept without issuing a refund.
  - Similarly, when `paymentService.rejectPayment` was called, it updated the payment record, but the order's primary status remained `payment_verification`. This created a dangerous failure mode where warehouse operators filtering orders by `status` could mistakenly process and dispatch an order whose payment had been rejected.
  - In the case of returns, the absence of a `returned` status prevented customer returns from being logged and caused permanent inventory shrinkage, as returned goods were never restocked.
- **Architectural Solution:**
  - Explicitly decoupled Order Fulfillment, Payment Authorization, and Financial Settlement into distinct, coordinated state machines.
  - `updateOrderStatus` now evaluates cross-lifecycle constraints: an order cannot be processed or shipped if `paymentStatus !== 'verified'`.
  - Rejection atomically transitions `orders.status` to `payment_rejected`.
  - Cancellation of a verified order transitions `financialStatus` to `cancelled_refund_pending` and creates a structured `refundDetails` audit object.
  - Added full `returned` lifecycle support that automatically restores inventory and variant stock levels upon return receipt.

---

### Architectural Vulnerability 3: Pricing Derivation & Static Cache Desynchronization
- **Affected Issues:**
  - **BUG 2 (CRITICAL)** – Historical Order Overcharged (#L4-26-1507)
  - **BUG 25 (MEDIUM)** – Incorrect Mirror Goggles Price on Product Pages (₹1,499 vs ₹1,399)
- **Incident Description:** Order #L4-26-1507 was charged ₹4,800 instead of ₹4,510 (₹290 overcharge); product pages and discovery cards showed ₹1,499 instead of ₹1,399.
- **Deep Root Cause:**
  - The architecture suffered from **Dual-Source-of-Truth Divergence**:
    1. Static HTML files generated from Webflow templates had hardcoded price elements (`₹ 1,499.00 INR`).
    2. Product models in the database had separate fields: `regularPricePaise` and `salePricePaise`.
    3. During the creation of Order #L4-26-1507, the order total calculation fell back to the regular price rather than inspecting whether an active promotional sale price was in effect.
    4. Client-side caching and static CDN pages served outdated discovery cards showing ₹1,499 while the backend checkout was configured to bill ₹1,399, causing customer confusion.
- **Architectural Solution:**
  - Established a strict hierarchy: **The database `salePricePaise` is the sole authoritative source of truth for pricing**.
  - All static HTML product pages and category cards were audited, corrected to ₹1,399, and stamped with cache-busting version query parameters (`?v=6.0`).
  - Historical order #L4-26-1507 was preserved to maintain ledger immutability and flagged with `financialAdjustmentAudit` indicating ₹290.00 is owed as a refund adjustment.

---

### Architectural Vulnerability 4: State Invalidation & Coupon Rollback Atomicity
- **Affected Issue:** **BUG 9 (MEDIUM)** – Coupon Usage Count Not Re-checked
- **Incident Description:** Customers attempting to pay with a coupon lost their coupon credit if their payment screenshot or UTR was rejected.
- **Deep Root Cause:**
  - Order checkout incremented coupon redemption counts upon order placement (`couponService.redeemCoupon`).
  - However, the payment verification workflow treated payment rejection as a terminal failure without dispatching compensating transactions (Saga Pattern).
  - Consequently, if a customer made a typo in their UTR number and the admin rejected the payment, the single-use coupon was permanently marked as "redeemed", preventing the customer from retrying.
- **Architectural Solution:**
  - Implemented compensating transaction rollback in `paymentService.rejectPayment`.
  - When payment is rejected, `couponService.revertCouponRedemption` is automatically invoked, restoring the coupon's available usage count and un-associating it from the customer's redemption ledger.

---

### Architectural Vulnerability 5: Content Gating & Catalog Publication Boundaries
- **Affected Issues:**
  - **BUG 17 (LOW)** – Test Product "TEST C" (SKU `L4-TEST`) Live on Storefront
  - **BUG 28 (LOW)** – Broken Product Image (Pro Kickboard `test-kickboard.jpg` 404s)
- **Incident Description:** Test product was publicly visible on the shop page; Pro Kickboard displayed broken image icons.
- **Deep Root Cause:**
  - The product catalog service lacked defensive validation on publication state. When creating or listing products, any document in the `products` collection with `isPublished !== false` was returned to the storefront, even if the description was "test", images were missing, or pricing was incomplete.
  - In addition, an orphaned external Cloudinary image URL had been deleted from Cloudinary storage but remained referenced in the product document, producing HTTP 404 image errors on the client.
- **Architectural Solution:**
  - Introduced strict Publication Contract: To transition to or be created with `isPublished: true`, a product must satisfy minimum quality invariants:
    - `name` >= 3 characters
    - `description` >= 10 characters
    - `price` > 0
    - Valid non-empty SKU
  - Public catalog queries now strictly exclude products with `status !== 'published'` or incomplete fields.
  - Reconciled "TEST C" to `draft`.
  - Added automatic URL sanitization in `productService.js` that maps obsolete/deleted Cloudinary test URLs to validated, local high-resolution assets.

---

### Architectural Vulnerability 6: Data Sanitization & Input Validation Boundaries
- **Affected Issues:**
  - **BUG 10 (MEDIUM)** – Order Does Not Show Which Coupon Was Used
  - **BUG 11 (MEDIUM)** – Old Orders with Tracking Numbers Not Marked Shipped (#L4-26-9784, #L4-26-7553)
  - **BUG 21 (LOW)** – Invalid Data Accepted Without Validation (repeated PIN `222222`, dummy courier AWB)
  - **BUG 24 (LOW)** – Status Messages Show Internal Names (`pending_payment`)
  - **BUG 27 (MEDIUM)** – Required Approval Note Is Not Enforced
- **Incident Description:** Missing coupon labels, stale fulfillment states, unvalidated postal PIN codes, raw database status strings, and blank admin verification notes.
- **Deep Root Cause:**
  - The system lacked unified schema validators at the boundary between HTTP requests, business logic, and presentation layers.
  - Frontend code assumed the backend would validate; backend code assumed the frontend sanitized.
  - Postal PIN codes were only checked for `\d{6}`, allowing invalid entries like `222222` and `123456`.
  - Verification notes had no minimum length requirements, allowing admins to bypass accountability by submitting empty notes.
  - Display layers rendered raw database enumeration keys (`pending_payment`) directly to end users.
- **Architectural Solution:**
  - Enforced strict express-validator schemas on all administrative and customer-facing endpoints.
  - Postal codes are validated against genuine Indian PIN formats, rejecting all 6-identical-digit and sequential combinations.
  - Approval notes are strictly validated (min 3 chars, max 500 chars) both at the HTTP route layer and inside `paymentService`.
  - Centralized UI label formatting in `formatStatusLabel` across admin and customer storefront interfaces.

---

## 3. Preventive Architectural Guidelines for Future Development

1. **Atomic Financial Concurrency:** Any financial identifier (UTR, payment intent, invoice ID, transaction ID) must use an explicit Firestore document key lock within a `db.runTransaction` block.
2. **State Machine Separation:** Never combine fulfillment status, payment authorization, and refund status into a single database field.
3. **Compensating Transactions (Sagas):** Any failed or rejected workflow that reserved resources (coupons, inventory, credits) must implement an explicit, automated compensation step.
4. **Authoritative Pricing:** Selling prices must be calculated dynamically on the server from authoritative product records; client prices and static HTML values must be treated as untrusted hints.
5. **Contract Enforcement:** All API inputs must be validated at the boundary before entering business service layers.
