require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const path         = require('path');

const CLIENT_URL = process.env.CLIENT_URL || (process.env.NODE_ENV === 'production' ? 'https://smartschool-app.onrender.com' : 'http://localhost:5173');
const NODE_ENV = process.env.NODE_ENV || 'development';
const errorHandler  = require('./src/middleware/errorHandler');
const ApiError      = require('./src/utils/ApiError');
const auditLogger   = require('./src/middleware/auditLogger');
const { apiLimiter, authLimiter, aiLimiter } = require('./src/middleware/rateLimiter');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  CLIENT_URL,
];
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.set('trust proxy', 1);

if (NODE_ENV === 'development') app.use(morgan('dev'));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'src/uploads')));

// ── Rate limiting ─────────────────────────────────────────────────────────────
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/ai',   aiLimiter);

// ── Audit logging ─────────────────────────────────────────────────────────────
app.use(auditLogger);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', function(req, res) {
  res.status(200).json({ success: true, message: 'SmartSchool API is running', environment: NODE_ENV, timestamp: new Date().toISOString() });
});

// ── Core routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',      require('./src/modules/auth/auth.routes'));
app.use('/api/students',  require('./src/modules/students/students.routes'));
app.use('/api/classes',   require('./src/modules/classes/classes.routes'));
app.use('/api/subjects',  require('./src/modules/subjects/subjects.routes'));
app.use('/api/results',   require('./src/modules/results/results.routes'));
app.use('/api/payments',  require('./src/modules/payments/payments.routes'));
app.use('/api/messages',  require('./src/modules/messages/messages.routes'));
app.use('/api/analytics', require('./src/modules/analytics/analytics.routes'));

// ── Teacher academic routes ───────────────────────────────────────────────────
app.use('/api/lesson-notes',   require('./src/modules/lessonNotes/lessonNotes.routes'));
app.use('/api/assignments',    require('./src/modules/assignments/assignments.routes'));
app.use('/api/submissions',    require('./src/modules/submissions/submissions.routes'));
app.use('/api/weekly-planner', require('./src/modules/weeklyPlanner/weeklyPlanner.routes'));
app.use('/api/attendance',     require('./src/modules/attendance/attendance.routes'));

// ── Extension routes ──────────────────────────────────────────────────────────
app.use('/api/notifications',  require('./src/modules/notifications/notifications.routes'));
app.use('/api/ai',             require('./src/modules/ai/ai.routes'));
app.use('/api/audit-logs',     require('./src/modules/auditLogs/auditLogs.routes'));

// ── User management (admin) ───────────────────────────────────────────────────
app.use('/api/users',          require('./src/modules/auth/users.routes'));

// ── Contact & Admissions (public website) ────────────────────────────────────
app.use('/api/contact',        require('./src/modules/contact/contact.routes'));

// ── Academic structure ────────────────────────────────────────────────────────
app.use('/api/academic-sessions', require('./src/modules/academicSession/academicSession.routes'));
app.use('/api/timetable',         require('./src/modules/timetable/timetable.routes'));

// ── Financial system ──────────────────────────────────────────────────────────
app.use('/api/fee-structures', require('./src/modules/feeStructure/feeStructure.routes'));
app.use('/api/bills',          require('./src/modules/studentBill/studentBill.routes'));

// ── ID card + shareable result ────────────────────────────────────────────────
var protect    = require('./src/middleware/authMiddleware');
var restrictTo = require('./src/middleware/roleMiddleware');
var { generateStudentIDCard } = require('./src/modules/students/idcard.controller');
var { generateShareToken, viewSharedResult, viewSharedResultData } = require('./src/modules/results/shareResult.controller');

app.get('/api/students/:id/idcard',      protect, restrictTo('admin'), generateStudentIDCard);
app.get('/api/results/share/:token',     viewSharedResult);
app.get('/api/results/share-data/:token', viewSharedResultData);
app.post('/api/results/share-token',     protect, generateShareToken);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.all('/{*path}', function(req, res, next) {
  next(new ApiError(404, 'Route ' + req.method + ' ' + req.originalUrl + ' not found'));
});

app.use(errorHandler);

module.exports = app;
