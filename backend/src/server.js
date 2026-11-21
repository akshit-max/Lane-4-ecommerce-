const app = require('./app');
const { config } = require('./config/environment');
const { logger } = require('./utils/logger');
const seedService = require('./services/seedService');

async function startServer() {
  try {
    // Run seed check (products, categories, coupons, shipping, bootstrap admin)
    await seedService.seedAll();

    const server = app.listen(config.port, () => {
      console.log(`Server is running on port ${config.port}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        logger.info('Server process terminated.');
      });
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer };

