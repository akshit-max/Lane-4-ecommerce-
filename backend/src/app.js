const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const { config, checkEnvironmentStatus } = require('./config/environment');
const { sendSuccess } = require('./utils/response');
const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');
const apiRouter = require('./routes');

const app = express();

// Trust reverse proxy (Render, Vercel, Cloudflare) so Express and express-rate-limit
// identify the real client IP via X-Forwarded-For instead of bundling all users into Render's internal router IP
app.set('trust proxy', 1);

// Disable ETag header generation across the entire app to prevent 304 Not Modified responses
app.set('etag', false);

// Security Headers with relaxed CSP to support Webflow assets, fonts and Cloudinary
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// CORS configuration
const allowedOrigins = [
  config.frontendUrl,
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:3000'
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.includes(origin) || config.env === 'development') {
        return callback(null, true);
      }
      try {
        const url = new URL(origin);
        if (url.hostname.endsWith('.in') || url.hostname.endsWith('.vercel.app')) {
          return callback(null, true);
        }
      } catch (e) {}
      return callback(null, true); // Permissive for storefront clients
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-guest-id']
  })
);

// Logging - only log API requests so static assets do not flood terminal
if (config.env !== 'test') {
  app.use(morgan('dev', {
    skip: (req) => !req.url.startsWith('/api')
  }));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Disable caching and strip conditional headers on /api to guarantee 200 OK responses instead of 304
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  next();
});

// Root health check endpoint (supports uptime bots pinging /health or /ping directly)
app.get(['/health', '/ping'], (req, res) => {
  const envStatus = checkEnvironmentStatus();
  return sendSuccess(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    integrations: envStatus
  });
});

// Apply rate limiting to all /api routes
app.use('/api', generalLimiter);

// API Endpoints
app.use('/api', apiRouter);

// Mock Webflow GraphQL / CSRF endpoints to prevent 404/405 errors and Apollo batch length mismatch
const handleWfGraphql = (req, res) => {
  res.cookie('wf-csrf', 'mock-csrf-token', { path: '/' });
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) {}
  }

  const buildItem = (op) => ({
    data: {
      database: {
        commerceOrder: {
          id: 'lane4_order',
          userItems: [],
          userItemsCount: 0,
          subtotal: { value: 0 },
          availableShippingMethods: [
            {
              id: 'pan_india_express',
              name: 'PAN India Express Delivery',
              description: 'Tracked PAN India express courier (3–5 business days)',
              price: {
                value: 0,
                unit: 'INR',
                decimalValue: '0.00',
                string: 'FREE'
              }
            }
          ],
          statusFlags: { requiresShipping: false, shouldRecalc: false }
        },
        userSubscriptions: []
      },
      site: {
        commerce: {
          id: 'lane4_site',
          quickCheckoutEnabled: false
        }
      },
      ecommerceAddToCart: {
        itemPrice: { value: 0 }
      }
    }
  });

  if (Array.isArray(body)) {
    const responses = body.map(buildItem);
    return res.json(responses);
  }

  // If single operation or unparsed batch, provide an array matching Apollo batch expectations
  return res.json([
    buildItem(body),
    buildItem(body)
  ]);
};

app.use(['/.wf_graphql', '/lane4/.wf_graphql'], handleWfGraphql);
app.all(['/graphql', '/api/v1/sites/*/apollo'], handleWfGraphql);

// In production, backend strictly operates as a dedicated API server
if (config.env === 'production' && process.env.SERVE_FRONTEND !== 'true') {
  app.get('/', (req, res) => {
    res.json({
      name: 'The LANE4 Performance Store — API Backend',
      status: 'online',
      version: '1.0.0',
      environment: config.env,
      healthCheck: '/api/health',
      frontendUrl: config.frontendUrl || 'https://lane4-phi.vercel.app'
    });
  });
} else {
  // Static file serving for local development only with optimal caching for instant page loads
  const frontendRoot = path.resolve(__dirname, '../../');
  // Block accidental exposure of backend source, tests, and config files when serving from repo root
  app.use((req, res, next) => {
    const reqPath = (req.path || '').toLowerCase();
    const blockedPrefixes = ['/backend', '/tests', '/scripts', '/coverage', '/.git', '/.firebase', '/node_modules'];
    const blockedExact = new Set([
      '/vercel.json',
      '/firestore.rules',
      '/firestore.indexes.json',
      '/firebase.json',
      '/.firebaserc',
      '/readme.md',
      '/jest.config.js',
      '/package.json',
      '/package-lock.json'
    ]);
    if (
      blockedPrefixes.some(p => reqPath === p || reqPath.startsWith(p + '/')) ||
      blockedExact.has(reqPath) ||
      /^\/\.env/i.test(reqPath)
    ) {
      return res.status(404).sendFile(path.join(frontendRoot, '404.html'));
    }
    return next();
  });
  const staticOpts = {
    extensions: ['html', 'htm'],
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // In local development, avoid aggressive caching for JS/CSS so changes reflect instantly
      if (/\.(css|js)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      } else if (/\.(png|jpg|jpeg|gif|svg|webp|woff2?|ico|ttf|eot)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      } else if (/\.(html|htm)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  };
  app.use('/uploads', express.static(path.join(frontendRoot, 'uploads'), staticOpts));
  app.use(express.static(frontendRoot, staticOpts));

  // Route dynamic categories, subcategories & products cleanly to detail templates in local dev, or 404 when missing
  app.get(['/category/:cat/:subcat', '/category/:cat/:subcat.html'], async (req, res) => {
    const catSlug = (req.params.cat || '').replace(/\.html$/i, '').toLowerCase().trim();
    const subSlug = (req.params.subcat || '').replace(/\.html$/i, '').toLowerCase().trim();
    try {
      const { getDb } = require('./config/firebaseAdmin');
      const db = getDb();
      if (db) {
        const snap = await db.collection('categories')
          .where('slug', '==', catSlug)
          .where('isDeleted', '==', false)
          .limit(1)
          .get();
        if (!snap.empty) {
          const catData = snap.docs[0].data();
          if (catData.isPublished !== false) {
            const subs = Array.isArray(catData.subcategories) ? catData.subcategories : [];
            const hasMatchingSub = subs.some(s => String(s.slug || '').toLowerCase().trim() === subSlug);
            if (hasMatchingSub) {
              return res.sendFile(path.join(frontendRoot, 'category', 'detail.html'));
            }
            const prodSnap = await db.collection('products')
              .where('categorySlug', '==', catSlug)
              .where('subcategorySlug', '==', subSlug)
              .where('isPublished', '==', true)
              .where('isDeleted', '==', false)
              .limit(1)
              .get();
            if (!prodSnap.empty) {
              return res.sendFile(path.join(frontendRoot, 'category', 'detail.html'));
            }
          }
        }
      }
    } catch (_) {}
    return res.status(404).sendFile(path.join(frontendRoot, '404.html'));
  });

  app.get(['/category/:slug', '/category/:slug.html'], async (req, res, next) => {
    const slug = (req.params.slug || '').replace(/\.html$/i, '');
    const candidate = path.join(frontendRoot, 'category', `${slug}.html`);
    if (fs.existsSync(candidate)) return res.sendFile(candidate);
    if (['index.htm', 'about', 'shop', 'gallery', 'contact-us', 'faq', 'checkout', 'blog'].includes(slug)) {
      return res.redirect(slug === 'index.htm' ? '/' : `/${slug}.html`);
    }
    try {
      const { getDb } = require('./config/firebaseAdmin');
      const db = getDb();
      if (db) {
        const snap = await db.collection('categories')
          .where('slug', '==', slug)
          .where('isDeleted', '==', false)
          .limit(1)
          .get();
        if (!snap.empty && snap.docs[0].data().isPublished !== false) {
          return res.sendFile(path.join(frontendRoot, 'category', 'detail.html'));
        }
      }
    } catch (_) {}
    return res.status(404).sendFile(path.join(frontendRoot, '404.html'));
  });

  app.get(['/product/:slug', '/product/:slug.html'], async (req, res, next) => {
    const slug = (req.params.slug || '').replace(/\.html$/i, '');
    const candidate = path.join(frontendRoot, 'product', `${slug}.html`);
    if (fs.existsSync(candidate)) return res.sendFile(candidate);
    if (['index.htm', 'about', 'shop', 'gallery', 'contact-us', 'faq', 'checkout', 'blog'].includes(slug)) {
      return res.redirect(slug === 'index.htm' ? '/' : `/${slug}.html`);
    }
    try {
      const productService = require('./services/productService');
      const prod = await productService.getProductBySlug(slug, false);
      if (prod) {
        return res.sendFile(path.join(frontendRoot, 'product', 'detail.html'));
      }
    } catch (_) {}
    return res.status(404).sendFile(path.join(frontendRoot, '404.html'));
  });

  app.use(['/product', '/category', '/blog', '/authors', '/utility-pages', '/category-blog', '/admin'], express.static(frontendRoot, staticOpts));

  app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(frontendRoot, 'index.htm'));
  });

  app.get(['/admin', '/admin/'], (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(frontendRoot, 'admin/index.html'));
  });

  // Catch-all 404 page for unknown non-API storefront routes
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') return next();
    return res.status(404).sendFile(path.join(frontendRoot, '404.html'));
  });
}

// 404 for API requests
app.use('/api', notFound);

// Global Error Handler
app.use(errorHandler);

module.exports = app;

