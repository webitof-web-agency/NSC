// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const {
  register,
  login,
  logout,
  requestAdminPasswordResetOtp,
  verifyAdminPasswordResetOtp,
  resetAdminPasswordWithOtp
} = require('../controllers/authController');
const customerPortalController = require('../controllers/customerPortalController');
const { registerValidator, loginValidator } = require('../validators/authValidator');
const { dashboard } = require('../controllers/adminController');
const protect = require('../middleware/authMiddleware');

router.post('/register', registerValidator, register);
router.post('/login', loginValidator, login);
router.post('/customer/login', customerPortalController.loginCustomer);
router.post('/forgot-password/request-otp', requestAdminPasswordResetOtp);
router.post('/forgot-password/verify-otp', verifyAdminPasswordResetOtp);
router.post('/forgot-password/reset', resetAdminPasswordWithOtp);
router.post('/logout', logout);

module.exports = router;
