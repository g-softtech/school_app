// Load environment variables FIRST — before any other module reads process.env

require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/db');
const { startMetricsAggregator } = require('./src/workers/metricsAggregator');
const sreEvaluatorWorker = require('./src/workers/sreEvaluatorWorker');

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

if (!process.env.JWT_SECRET) {
  console.error("⚠️ WARNING: Missing JWT_SECRET in environment variables.");
}
// ─── Handle uncaught synchronous exceptions ──────────────────────────────────
process.on('uncaughtException', (err) => {
  console.error('💥  UNCAUGHT EXCEPTION — shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// ─── Connect to MongoDB, then start the HTTP server ──────────────────────────
const startServer = async () => {
  await connectDB();
  
  startMetricsAggregator();
  sreEvaluatorWorker.start();

  const server = app.listen(PORT, () => {
    console.log(`\n🚀  SmartSchool API running`);
    console.log(`   Mode:    ${NODE_ENV}`);
    console.log(`   Port:    ${PORT}`);
    console.log(`   Health:  http://localhost:${PORT}/api/health\n`);
  });

  process.on('unhandledRejection', (err) => {
    console.error('💥  UNHANDLED REJECTION — shutting down...');
    console.error(err.name, err.message);
    server.close(() => process.exit(1));
  });

  process.on('SIGTERM', () => {
    console.log('👋  SIGTERM received — shutting down gracefully');
    server.close(() => console.log('💤  HTTP server closed'));
  });
};

startServer();