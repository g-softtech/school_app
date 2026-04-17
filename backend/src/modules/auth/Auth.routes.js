// Lives at: backend/src/modules/auth/auth.routes.js

const express = require('express');
const router = express.Router();

const {
  register,
  login,
  logout,
  refreshToken,
  getMe,
  updatePassword,
} = require('./auth.controller');

// src/middleware/ — go up two levels (auth → modules → src) then into middleware/
const protect = require('../../middleware/authMiddleware');

// ─── Public routes ────────────────────────────────────────────────────────────
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);

// ─── Protected routes (require valid JWT) ─────────────────────────────────────
router.use(protect);

router.get('/me', getMe);
router.post('/logout', logout);
router.patch('/update-password', updatePassword);

module.exports = router;