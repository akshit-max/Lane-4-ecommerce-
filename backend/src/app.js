const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const { config } = require('./config/environment');
const { generalLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');
const apiRouter = require('./routes');

const app = express();

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
          availableShippingMethods: [],
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

  return res.json({
    ...buildItem(body),
    token: 'mock-csrf-token'
  });
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
  const staticOpts = {
    extensions: ['html', 'htm'],
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // Static assets (CSS, JS, images, fonts) get browser caching for instant zero-wait navigation
      if (/\.(css|js|png|jpg|jpeg|gif|svg|webp|woff2?|ico|ttf|eot)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=7200, stale-while-revalidate=86400');
      } else if (/\.(html|htm)$/i.test(filePath)) {
        // HTML pages validate quickly for instant fresh responses
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  };
  app.use('/uploads', express.static(path.join(frontendRoot, 'uploads'), staticOpts));
  app.use(express.static(frontendRoot, staticOpts));
  app.use(['/product', '/category', '/blog', '/authors', '/utility-pages', '/category-blog', '/admin'], express.static(frontendRoot, staticOpts));

  app.get('/', (req, res) => {
    res.sendFile(path.join(frontendRoot, 'index.htm'));
  });

  app.get(['/admin', '/admin/'], (req, res) => {
    res.sendFile(path.join(frontendRoot, 'admin/index.html'));
  });
}

// 404 for API requests
app.use('/api', notFound);

// Global Error Handler
app.use(errorHandler);

module.exports = app;

