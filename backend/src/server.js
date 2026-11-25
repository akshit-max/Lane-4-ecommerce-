// Server version: 1.0.1 (Production: GST Invoicing, RBAC, Customer Portal, UPI verification)
const app = require('./app');
const { config } = require('./config/environment');
const { logger } = require('./utils/logger');
const seedService = require('./services/seedService');
const staffNotificationService = require('./services/staffNotificationService');

let serverInstance = null;

async function startServer() {
  try {
    // Run seed check (products, categories, coupons, shipping, bootstrap admin)
    await seedService.seedAll();

    const server = app.listen(config.port, () => {
      console.log(`Server is running on port ${config.port}`);
    });
    serverInstance = server;

    // Start internal background outbox drainer in long-running container / standalone Node environments
    // Disabled in test environments and serverless platforms (e.g. Vercel)
    if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL && process.env.ENABLE_OUTBOX_WORKER !== 'false') {
      const intervalMs = parseInt(process.env.OUTBOX_POLL_INTERVAL_MS, 10) || 60000;
      staffNotificationService.startWorker(intervalMs);
    }

    // Graceful shutdown
    const handleShutdown = (signal) => {
      logger.info(`${signal} received. Shutting down gracefully...`);
      staffNotificationService.stopWorker();
      server.close(() => {
        logger.info('Server process terminated.');
      });
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));

    return server;
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

function stopServer() {
  staffNotificationService.stopWorker();
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer, stopServer };

