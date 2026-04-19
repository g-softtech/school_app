const express = require('express');
const router = express.Router();
const { register, login, logout, refreshToken, getMe, updatePassword } = require('./auth.controller');
const protect = require('../../middleware/authMiddleware');

router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refreshToken);

router.use(protect);
router.get('/me', getMe);
router.post('/logout', logout);
router.patch('/update-password', updatePassword);

module.exports = router;