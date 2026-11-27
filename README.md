# LANE4 E-Commerce — Full-Stack Platform

> **High-Performance Swimwear & Competitive Aquatics E-Commerce Solution**  
> Built with vanilla HTML5, CSS3, and JavaScript on the frontend, powered by a modular **Node.js + Express** backend, **Firebase Admin SDK** (Authentication & Cloud Firestore), **Cloudinary** asset management, and an **Indian UPI QR manual payment verification engine**.

---

## 1. Architecture & Design Principles

1. **Pixel-Perfect Frontend Preservation**: The storefront visual design, layouts, typography, spacing, and animations remain 100% intact from the approved creative baseline.
2. **Modular Express Architecture**: Clean separation across routes, validators, controllers, services, middleware, utilities, and domain constants.
3. **Financial Precision (Paise Standard)**: All monetary calculations (catalog prices, cart totals, discounts, shipping fees, taxes) are processed internally as 64-bit integer paise (`₹1.00 = 100 paise`), preventing floating-point rounding errors.
4. **Offline & Test-Ready**: Includes a built-in memory adapter for Firebase Firestore and Authentication. The entire backend and all 52 unit/integration/E2E test suites run locally with zero external network or cloud account dependencies when `NODE_ENV=test` or `USE_MEMORY_FIRESTORE=true`.
5. **Role-Based Access Control (RBAC)**: Fine-grained permissions supporting `super_admin`, `admin`, `catalog_manager`, `order_manager`, and `support_agent` roles with custom Firebase claim enforcement.

---

## 2. Directory Structure

```text
lane/
├── README.md                      # Authoritative project documentation
│
└── lane4/
    ├── index.htm                  # Storefront homepage
    ├── shop.html                  # Product catalog & filter UI
    ├── checkout.html              # Customer checkout & UPI QR payment UI
    ├── contact-us.html            # Contact & customer enquiry form
    ├── about.html                 # Brand story
    ├── blog.html                  # Articles & training guides
    ├── faq.html                   # Frequently asked questions
    ├── gallery.html               # Swimmer community photo gallery
    │
    ├── product/                   # Static product pages (dynamically enhanced)
    ├── category/                  # Category-specific landing pages
    ├── blog/                      # Individual blog articles
    ├── authors/                   # Author profiles
    │
    ├── js/                        # Frontend client integration layer
    │   ├── lane4-api.js           # API client with automatic token attachment
    │   ├── lane4-auth.js          # Authentication modal & session manager
    │   ├── lane4-cart.js          # Persistent slide-out cart & drawer sync
    │   ├── lane4-checkout.js      # Multi-step checkout, coupon, & UPI proof upload
    │   └── lane4-forms.js         # Contact, newsletter, & product review handlers
    │
    ├── shared/
    │   └── frontend-api-config.js # Global configuration & API base URL
    │
    ├── admin/                     # Responsive administrative portal
    │   ├── index.html             # Admin dashboard, analytics, & management panels
    │   └── js/
    │       └── admin.js           # Catalog, order fulfillment, & payment verifications
    │
    ├── firebase.json              # Firebase project deployment settings
    ├── firestore.indexes.json     # Firestore composite index definitions
    ├── firestore.rules            # Production security rules for Cloud Firestore
    │
    └── backend/                   # Node.js + Express backend service
        ├── package.json
        ├── .env.example           # Documented configuration template
        ├── src/
        │   ├── app.js             # Express application & global middleware
        │   ├── server.js          # HTTP server bootstrap & lifecycle hooks
        │   │
        │   ├── config/            # Environment, Firebase, Cloudinary, Email
        │   │   ├── cloudinary.js
        │   │   ├── email.js
        │   │   ├── environment.js
        │   │   └── firebaseAdmin.js
        │   │
        │   ├── constants/         # Domain definitions & enum constants
        │   │   ├── index.js
        │   │   ├── orderStatus.js
        │   │   └── roles.js
        │   │
        │   ├── validators/        # Request validation middleware
        │   │   ├── index.js
        │   │   ├── authValidators.js
        │   │   ├── formValidators.js
        │   │   ├── orderValidators.js
        │   │   ├── paymentValidators.js
        │   │   └── productValidators.js
        │   │
        │   ├── controllers/       # HTTP request handlers
        │   │   ├── adminController.js
        │   │   ├── authController.js
        │   │   ├── cartController.js
        │   │   ├── categoryController.js
        │   │   ├── couponController.js
        │   │   ├── customerController.js
        │   │   ├── enquiryController.js
        │   │   ├── newsletterController.js
        │   │   ├── orderController.js
        │   │   ├── paymentController.js
        │   │   ├── productController.js
        │   │   ├── returnController.js
        │   │   ├── reviewController.js
        │   │   └── shippingController.js
        │   │
        │   ├── routes/            # Route declarations & modular aggregator
        │   │   ├── index.js       # Master API router (/api)
        │   │   ├── adminRoutes.js
        │   │   ├── authRoutes.js
        │   │   ├── cartRoutes.js
        │   │   ├── categoryRoutes.js
        │   │   ├── couponRoutes.js
        │   │   ├── customerRoutes.js
        │   │   ├── enquiryRoutes.js
        │   │   ├── newsletterRoutes.js
        │   │   ├── orderRoutes.js
        │   │   ├── paymentRoutes.js
        │   │   ├── productRoutes.js
        │   │   ├── publicConfigRoutes.js
        │   │   ├── returnRoutes.js
        │   │   ├── reviewRoutes.js
        │   │   └── shippingRoutes.js
        │   │
        │   ├── services/          # Core business logic & database interactions
        │   │   ├── adminDashboardService.js
        │   │   ├── authService.js
        │   │   ├── cartService.js
        │   │   ├── categoryService.js
        │   │   ├── couponService.js
        │   │   ├── enquiryService.js
        │   │   ├── inventoryService.js
        │   │   ├── newsletterService.js
        │   │   ├── orderService.js
        │   │   ├── paymentService.js
        │   │   ├── productService.js
        │   │   ├── returnService.js
        │   │   ├── reviewService.js
        │   │   ├── seedService.js
        │   │   ├── shippingService.js
        │   │   └── storeSettingsService.js
        │   │
        │   ├── middleware/        # Security, auth, uploads, error handling
        │   │   ├── authenticate.js
        │   │   ├── errorHandler.js
        │   │   ├── notFound.js
        │   │   ├── rateLimiter.js
        │   │   ├── requireAdmin.js
        │   │   ├── requirePermission.js
        │   │   ├── uploadMiddleware.js
        │   │   └── validateRequest.js
        │   │
        │   ├── utils/             # Helper utilities
        │   │   ├── currency.js    # Paise <-> Rupee conversions & rounding
        │   │   ├── logger.js      # Structured JSON/console logger with sanitization
        │   │   └── response.js    # Standardized API response formatters
        │   │
        │   └── scripts/
        │       └── createInitialAdmin.js
        │
        └── tests/                 # Automated test suite (52 tests across 9 suites)
            ├── admin_dashboard.test.js
            ├── auth.test.js
            ├── cart.test.js
            ├── config.test.js
            ├── e2e_journey.test.js
            ├── forms_support.test.js
            ├── orders.test.js
            ├── payment.test.js
            └── products.test.js
```

---

## 3. Quick Start Guide

### Prerequisites
- Node.js version 18.x or later
- npm version 9.x or later

### 1. Install Backend Dependencies
```bash
cd "lane4/backend"
npm install
```

### 2. Configure Environment
A default `.env` file is pre-configured. To customize production credentials:
```bash
cp .env.example .env
```

### 3. Start the Server
```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```

The Express server will automatically launch on port `5000`:
- **Storefront**: [http://localhost:5000/](http://localhost:5000/)
- **Shop Catalog**: [http://localhost:5000/shop.html](http://localhost:5000/shop.html)
- **Checkout**: [http://localhost:5000/checkout.html](http://localhost:5000/checkout.html)
- **Admin Management Portal**: [http://localhost:5000/admin/](http://localhost:5000/admin/)
- **REST API Base**: [http://localhost:5000/api](http://localhost:5000/api)

---

## 4. Default Seeded Credentials

When the backend starts up for the first time, it automatically executes `seedService` to ensure the catalog, categories, shipping rules, coupons, and a bootstrap administrator exist:

| Role | Email | Password | Permissions |
|---|---|---|---|
| **Super Admin** | `admin@lane4swim.in` | `AdminSecurePass2026!` | All permissions (`manage_products`, `manage_orders`, `verify_payments`, `manage_settings`, `manage_users`) |

---

## 5. Indian Manual UPI QR Workflow

LANE4 implements a compliant manual UPI payment verification workflow:
1. **Checkout Submission**: The customer enters shipping details and selects UPI payment. An order is created with status `pending_payment`.
2. **Dynamic UPI QR Code**: The frontend renders an NPCI-compliant UPI Intent string and QR code:
   `upi://pay?pa=lane4swim@icici&pn=LANE4%20Aquatics&am={amount}&cu=INR&tn=Order%20{orderNumber}`
3. **Payment Proof Submission**: The customer enters their 12-digit UPI UTR / Transaction Reference Number and uploads a screenshot of the payment receipt.
4. **Order Status**: Transitions to `payment_verification_pending`.
5. **Staff Review**: Admins review the UTR and proof image in the Admin Portal (`/admin/`) and click **Verify Payment**.
6. **Order Confirmation**: The status updates to `paid`, stock is decremented, and an automated order confirmation notification is triggered.

---

## 6. REST API Reference

All endpoints return standardized JSON structures: `{ success: true, data: ... }` or `{ success: false, error: { message: ... } }`.

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a customer account
- `POST /api/auth/login` — Sign in and obtain a JWT session token
- `GET /api/auth/profile` — Fetch authenticated user profile *(Requires Auth)*
- `PUT /api/auth/profile` — Update account profile details *(Requires Auth)*
- `POST /api/auth/forgot-password` — Dispatch password reset email

### Catalog & Categories (`/api/products`, `/api/categories`)
- `GET /api/products` — List catalog products with pagination, search, category, and sorting filters
- `GET /api/products/:slug` — Get comprehensive product details by slug or ID
- `GET /api/categories` — List active product categories with slug and counts
- `GET /api/categories/:slug` — Get single category details

### Cart & Pricing (`/api/cart`)
- `GET /api/cart` — Retrieve cart items, subtotal, discount, shipping, and tax
- `POST /api/cart/items` — Add an item/variant with stock verification
- `PUT /api/cart/items/:itemId` — Update item quantity (or remove if 0)
- `DELETE /api/cart/items/:itemId` — Remove item from cart
- `DELETE /api/cart` — Clear entire cart
- `POST /api/cart/coupon` — Apply promotional coupon code (`WELCOME10`, `LANE4PRO`)
- `DELETE /api/cart/coupon` — Remove applied coupon code

### Orders & Checkout (`/api/orders`)
- `POST /api/orders` — Create new order from cart or direct items
- `GET /api/orders` — List orders for authenticated customer *(Requires Auth)*
- `GET /api/orders/:id` — Get full order details and tracking status
- `POST /api/orders/:id/cancel` — Cancel an order (if prior to dispatch)

### Payments & UPI (`/api/payments`)
- `GET /api/payments/config` — Public UPI configuration (VPA `lane4swim@icici`, merchant name)
- `POST /api/payments/proof` — Submit 12-digit UTR and payment screenshot receipt

### Forms & Reviews (`/api`)
- `POST /api/enquiries` — Submit contact form enquiry
- `POST /api/newsletter` — Subscribe to newsletter
- `GET /api/products/:productId/reviews` — Fetch approved reviews for a product
- `POST /api/reviews` — Submit a product rating and review *(Requires Auth)*
- `POST /api/returns` — Submit return or exchange request

### Admin Management (`/api/admin`) *(Requires Super Admin or Staff Role)*
- `GET /api/admin/dashboard` — Analytics overview (revenue, pending orders, stock alerts)
- `GET /api/admin/products` — Full product inventory management
- `POST /api/admin/products` — Create new product with variants
- `PUT /api/admin/products/:id` — Update product details or stock
- `DELETE /api/admin/products/:id` — Soft-delete / deactivate product
- `GET /api/admin/orders` — List store orders with filter by status
- `PUT /api/admin/orders/:id/status` — Advance order status (`processing`, `shipped`, `delivered`)
- `POST /api/admin/payments/:orderId/verify` — Confirm manual UPI receipt and transition order to `paid`

---

### Test Coverage Summary
- `tests/e2e_journey.test.js` — Complete customer journey from registration to order placement and admin payment verification.
- `tests/auth.test.js` — User registration, validation, login, and profile management.
- `tests/products.test.js` — Product pagination, category filters, and detail lookups.
- `tests/cart.test.js` — Add, update, stock boundary checks, and coupon application.
- `tests/orders.test.js` — Order generation, stock deduction, and status transitions.
- `tests/payment.test.js` — UPI payment proof submission, UTR verification, and admin approval.
- `tests/admin_dashboard.test.js` — Admin analytics, metrics, and role-based access checks.
- `tests/forms_support.test.js` — Contact enquiry, newsletter, and product review submission.
- `tests/config.test.js` — Environment, Firebase fallback, and UPI configuration verification.

**Result**: 52 tests across 9 test suites passing with zero failures.

---

## 8. License & Operational Notice

Confidential and proprietary to **LANE4 Aquatics**. All rights reserved. Built for production deployment on Google Cloud / Firebase Spark with Cloudinary asset storage.

