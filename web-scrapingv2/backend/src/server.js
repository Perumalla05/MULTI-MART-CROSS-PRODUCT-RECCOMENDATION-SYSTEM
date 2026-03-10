import express from 'express';
import config from './config/index.js';
import logger from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import searchRouter from './routes/search.js';
import cache from './services/cache.js';
import database from './services/database.js';
import orchestrator from './scrapers/orchestrator.js';

const app = express();

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api', searchRouter);

// Error handler
app.use(errorHandler);

// Initialize services
async function initialize() {
  console.log('Initializing services...');
  try {
    console.log('Connecting to cache...');
    await cache.connect();
    console.log('Connecting to database...');
    await database.connect();
    console.log('Services initialized');
    logger.info('Services initialized');
  } catch (error) {
    console.error('Service initialization error:', error);
    logger.error('Service initialization failed', { error: error.message });
  }
}

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down...');
  await orchestrator.shutdown();
  await cache.disconnect();
  await database.disconnect();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
console.log('Starting server...');

initialize()
  .then(() => {
    console.log('Initialization complete, starting Express...');
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
      console.log(`🚀 Server ready at http://localhost:${config.port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
