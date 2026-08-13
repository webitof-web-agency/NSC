const User = require('../models/User');
const Permission = require("../models/Permission");
const Module = require("../models/Module");
const generateToken = require('../utils/generateToken');
const validationResult = require('express-validator').validationResult;
const LoginActivity = require('@models/LoginActivity');
const AdminPasswordResetOtp = require('@models/AdminPasswordResetOtp');
const { sendMail } = require('@utils/mailer');
const parser = require('ua-parser-js');
const geoip = require('geoip-lite');

exports.register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array().map((err) => err.msg),
    });
  }

  const { firstName, lastName, email, phone, password } = req.body;

  try {
    // Step 1: Check if any admin already exists
    const existingAdmin = await User.findOne({ user_type: 1 });
    if (existingAdmin) {
      return res.status(403).json({
        message: 'Admin account already exists. Only one admin is allowed.',
      });
    }

    // Step 2: Check for duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: 'Email already exists',
      });
    }

    // Step 3: Create Admin
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      user_type: 1, // Mark as admin
    });

    res.status(201).json({
      message: 'Admin account created successfully',
      token: generateToken(user._id),
      user: user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};


exports.login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      errors: errors.array().map(err => err.msg),
    });
  }
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });


    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'Unknown';

    const ua = parser(req.headers['user-agent']);
    const browser = ua.browser.name || 'Unknown';
    const device = ua.device.model
      ? `${ua.device.vendor || 'Unknown'} ${ua.device.model}`
      : 'Desktop';

    const geo = geoip.lookup(ipAddress);
    const location = geo
      ? `${geo.city || 'Unknown'}, ${geo.country || 'Unknown'}`
      : 'Unknown';

    await LoginActivity.create({
      user: user._id,
      ipAddress,
      browser,
      device,
      location
    });

    res.json({
      message: 'Login successful',
      token: generateToken(user._id),
      user
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.logout = (req, res) => {
  res.json({ message: 'Logout successful (handled client-side)' });
};

exports.requestAdminPasswordResetOtp = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    if (user.user_type !== 1) {
      return res.status(403).json({ message: 'This feature is only for Admin' });
    }

    if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
      return res.status(500).json({ message: 'SMTP is not configured' });
    }

    await AdminPasswordResetOtp.deleteMany({ email });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

    await AdminPasswordResetOtp.create({
      email,
      userId: user._id,
      otp,
      expiresAt,
    });

    const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin';

    await sendMail({
      from: `"${process.env.SMTP_FROM_NAME || 'NSC Admin'}" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: 'Admin Password Reset OTP',
      text: `Hello ${userName}, your OTP is ${otp}. It is valid for 2 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Admin Password Reset</h2>
          <p>Hello ${userName},</p>
          <p>Your OTP for password reset is:</p>
          <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0;">${otp}</div>
          <p>This OTP is valid for 2 minutes.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });

    return res.status(200).json({
      message: 'OTP sent successfully',
      expiresInSeconds: 120,
    });
  } catch (err) {
    console.error('Forgot password OTP request error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.verifyAdminPasswordResetOtp = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();

    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    if (user.user_type !== 1) {
      return res.status(403).json({ message: 'This feature is only for Admin' });
    }

    const otpRecord = await AdminPasswordResetOtp.findOne({
      email,
      userId: user._id,
      otp,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    return res.status(200).json({ message: 'OTP verified successfully' });
  } catch (err) {
    console.error('Forgot password OTP verify error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.resetAdminPasswordWithOtp = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || '');

    if (!email || !otp || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email' });
    }

    if (user.user_type !== 1) {
      return res.status(403).json({ message: 'This feature is only for Admin' });
    }

    const otpRecord = await AdminPasswordResetOtp.findOne({
      email,
      userId: user._id,
      otp,
      verified: true,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.password = password;
    await user.save();

    await AdminPasswordResetOtp.deleteMany({ email });

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Forgot password reset error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
