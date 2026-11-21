const dotenv = require('dotenv');
const path = require('path');

// Preserve original process.env.NODE_ENV (e.g., when running in test runners like Jest)
const originalNodeEnv = process.env.NODE_ENV;

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (originalNodeEnv === 'test') {
  process.env.NODE_ENV = 'test';
}

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5000',

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID_PUBLIC || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
    serviceAccountPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    emulatorHost: process.env.FIRESTORE_EMULATOR_HOST || '',
    authEmulatorHost: process.env.FIREBASE_AUTH_EMULATOR_HOST || '',
    // Public web SDK config
    webApiKey: process.env.FIREBASE_API_KEY || '',
    webAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    webStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    webMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    webAppId: process.env.FIREBASE_APP_ID || ''
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || '',
    folderPrefix: 'lane4'
  },

  email: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.EMAIL_FROM || '"The Lane4 Performance Store" <Lane4performancestore@gmail.com>',
    resendApiKey: process.env.RESEND_API_KEY || ''
  },

  adminBootstrap: {
    email: process.env.INITIAL_ADMIN_EMAIL || 'admin@lane4swim.in',
    password: process.env.INITIAL_ADMIN_PASSWORD || 'AdminSecurePass2026!'
  }
};

/**
 * Validate presence of credentials and return system status summary.
 */
function checkEnvironmentStatus() {
  const status = {
    firebaseConfigured: Boolean(
      (config.firebase.projectId && config.firebase.clientEmail && config.firebase.privateKey) ||
      config.firebase.serviceAccountPath ||
      config.firebase.emulatorHost
    ),
    cloudinaryConfigured: Boolean(
      config.cloudinary.cloudName && config.cloudinary.apiKey && config.cloudinary.apiSecret
    ),
    emailConfigured: Boolean(
      (config.email.host && config.email.user && config.email.password) ||
      config.email.resendApiKey
    )
  };

  return status;
}

module.exports = {
  config,
  checkEnvironmentStatus
};

