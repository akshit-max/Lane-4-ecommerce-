# LANE4 Performance Store – Production Smoke Test Report

**Smoke Test Reference:** SMOKE-L4-2026-11-24  
**Date:** November 24, 2026  
**Auditor:** Senior Full-Stack QA & Reliability Engineering  
**Scope:** Live Application Behavior & Functional Verification Across Storefront & Admin Portal  
**Result:** **ALL SMOKE CRITERIA SATISFIED (GREEN)**

---

## 1. Storefront Browsing & Product Discovery Smoke Tests

| Flow Tested | Verification Action | Expected Outcome | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Catalog Integrity** | Navigate to `/shop.html` | Only valid, published products render; no draft or test items | "TEST C" (SKU `L4-TEST`) is completely hidden; only 6 live items render | **PASS** |
| **Mirror Goggles Pricing** | Open `product/mirror-racing-goggles.html` and related discovery cards | Displays authoritative price of ₹1,399.00 INR | Hero title shows ₹1,399.00; discovery cards show ₹1,399.00 | **PASS** |
| **Pro Kickboard Imagery** | Open `product/pro-kickboard-hydro-flow.html` | All images load cleanly without 404 broken image icons | High-res local asset `lane4-X8RgOcqugtQ-640x960.jpg` loads immediately | **PASS** |
| **Product Reviews** | Open any product detail page | Reviews mount beneath product hero; no JavaScript console errors | Reviews mount cleanly; no `targetParent is not defined` error | **PASS** |

---

## 2. Customer Authentication & Swimmer Access Modal

| Flow Tested | Verification Action | Expected Outcome | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Admin Credential Isolation** | Enter `admin@lane4swim.in` into Swimmer Access modal (`lane4-auth.js`) | Rejection banner indicating admin accounts cannot log in to customer storefront | Displays: `Administrator accounts cannot sign in to the customer storefront.` without redundant admin path prompt | **PASS** |
| **Customer Shopping Gating** | Click "Buy Now Online" without being logged in | Opens Swimmer Access modal prompting user to log in before checkout | Opens modal with prompt: `Please sign in or create an account to start shopping and add items to your cart.` | **PASS** |
| **Order Tracking & History** | Log in as registered swimmer and click on previous order `#L4-26-8436` | Dedicated order details view opens showing items, prices, courier tracking, and return link | Detailed view displays complete billing breakdown, items purchased, and courier link | **PASS** |

---

## 3. Cart, Checkout & Payment Submission Smoke Tests

| Flow Tested | Verification Action | Expected Outcome | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Webflow Form Hijacking Elimination** | Click "Buy Now Online" on product page | Product added to custom cart drawer; no Webflow error popup (`Something went wrong...`) | Webflow submit button converted synchronously to button; zero Webflow error alerts | **PASS** |
| **Checkout Address Autofill** | Open `checkout.html` | State and City dropdowns default to unselected (`Select State`, `Select City`) | Dropdowns are blank/unselected until chosen by user | **PASS** |
| **PIN Code Strict Validation** | Enter dummy PIN `222222` or `123456` | Form rejects submission and displays clear error banner | Rejected with message: `Please enter a genuine 6-digit postal PIN code.` | **PASS** |
| **Duplicate UTR Prevention** | Submit an order using an already approved UTR `123456789123` | Form blocks submission with inline notification | Rejected with message: `This UPI Reference / UTR Number has already been submitted or verified for another order.` | **PASS** |

---

## 4. Admin Portal Fulfillment & Reconciliation Smoke Tests

| Flow Tested | Verification Action | Expected Outcome | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Orders Table Loading** | Open `http://localhost:5000/admin/` and navigate to Orders tab | Table renders all orders smoothly; no `formatDateString is not defined` error | Orders render cleanly; `formatDateTime` and `formatDateString` format all timestamps | **PASS** |
| **Human-Readable Statuses** | Inspect order status pills in Orders table | No raw internal keys like `pending_payment` | Rendered as: `Pending Payment`, `Confirmed (Ready to Pack)`, `Shipped`, `Delivered`, etc. | **PASS** |
| **Coupon Visibility in Orders** | Inspect orders with coupons applied | Payable Total column shows coupon code badge and discount amount | Displays badge: `Coupon: WELCOME10 (-₹200.00)` beneath payable total | **PASS** |
| **Mandatory Approval Note** | Click "Approve Payment" on pending payment and leave note blank | Dialog prevents submission and alerts admin to enter verification details | Prompts admin: `Verification note is required (minimum 3 characters).` | **PASS** |
| **Payment Rejection Synchronization** | Reject payment on an order | Order status transitions to `Payment Rejected`; cannot be dispatched | Status updates immediately in table to `Payment Rejected`; dispatch button disabled | **PASS** |
| **Process Refund Workflow** | Open cancelled order with pending refund | "Process Refund" button available; opens modal to record refund reference | Modal accepts refund transaction ID and updates status to `Refunded` | **PASS** |
| **Customer Return Handling** | Transition delivered order to `Returned` | Status updates to `Returned`; items restocked in inventory | Status updates to `Returned`; variant stock incremented | **PASS** |
