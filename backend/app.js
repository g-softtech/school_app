require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const cookieParser = require('cookie-parser');
const path       = require('path');

const { CLIENT_URL, NODE_ENV } = require('./config/env');
const errorHandler = require('./src/middleware/errorHandler');
const ApiError     = require('./src/utils/ApiError');

const app = express();

app.use(helmet());
app.use(cors({ origin: CLIENT_URL, credentials: true }));
if (NODE_ENV === 'development') app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'src/uploads')));

app.get('/api/health', function(req, res) {
  res.status(200).json({
    success: true,
    message: 'SmartSchool API is running',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/auth',     require('./src/modules/auth/auth.routes'));
app.use('/api/students', require('./src/modules/students/students.routes'));
app.use('/api/classes',  require('./src/modules/classes/classes.routes'));
app.use('/api/subjects', require('./src/modules/subjects/subjects.routes'));
app.use('/api/results',  require('./src/modules/results/results.routes'));

// Stage 6:  app.use('/api/payments',  require('./src/modules/payments/payments.routes'));
// Stage 7:  app.use('/api/messages',  require('./src/modules/messages/messages.routes'));
// Stage 8:  app.use('/api/analytics', require('./src/modules/analytics/analytics.routes'));

app.all('/{*path}', function(req, res, next) {
  next(new ApiError(404, 'Route ' + req.method + ' ' + req.originalUrl + ' not found'));
});

app.use(errorHandler);

module.exports = app;