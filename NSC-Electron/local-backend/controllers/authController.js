const User = require('../models/User');
const Permission = require("../models/Permission");
const Module = require("../models/Module");
const generateToken = require('../utils/generateToken');
const validationResult = require('express-validator').validationResult;
const LoginActivity = require('@models/LoginActivity');
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
    let user = await User.findOne({ email });
    let isMatch = user ? await user.matchPassword(password) : false;

    // Phase 16: Cloud Fallback for empty database (first-time login)
    if (!user || !isMatch) {
      const isOfflineMode = process.env.OFFLINE_MODE === 'true';
      if (isOfflineMode) {
        console.log(`[Auth] Local login failed for ${email}. Attempting Cloud Fallback...`);
        try {
          const axios = require('axios');
          const REMOTE_URL = process.env.REMOTE_BACKEND_URL || process.env.REMOTE_URL || 'https://server.nareshsareecollection.com';
          
          const cloudRes = await axios.post(`${REMOTE_URL}/api/auth/login`, { email, password }, { timeout: 10000 });
          
          if (cloudRes.data && cloudRes.data.token) {
            console.log(`[Auth] Cloud Fallback successful! User is valid. Triggering Bootstrap...`);
            
            // 1. Cache the cloud token for SyncManager
            const axiosLocal = axios.create({ baseURL: process.env.BASE_URL || 'http://localhost:3002' });
            await axiosLocal.post('/api/local/sync-token', { token: cloudRes.data.token });

            // 2. We can trigger Bootstrap immediately to pull down the DB (including this user)
            // But since SyncManager relies on the Electron Main Process loop, we can just let it handle the heavy lifting.
            // However, we need the User document LOCALLY *right now* to issue a local JWT for the frontend!
            
            const cloudUser = cloudRes.data.user;
            
            // We just upsert the user locally so we can log them in. 
            // When Bootstrap runs in the background, it will gracefully upsert over this.
            user = await User.findOneAndUpdate(
              { email: cloudUser.email },
              { $set: cloudUser }, // Remove $ignoreOutbox from here
              { upsert: true, new: true, setDefaultsOnInsert: true, $ignoreOutbox: true } // Pass to hook options
            );
            
            // Re-fetch to ensure Mongoose hooks (if any) didn't mangle it, or just use the upserted one
            isMatch = true; 
            
          } else {
            return res.status(401).json({ message: 'Invalid credentials on both Local and Cloud.' });
          }
        } catch (cloudErr) {
          console.error(`[Auth] Cloud Fallback failed:`, cloudErr.message);
          return res.status(401).json({ message: 'Invalid credentials or Cloud unreachable for first-time login.' });
        }
      } else {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
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

    // Disable CDC outbox for login activity locally
    const loginActivity = new LoginActivity({
      user: user._id,
      ipAddress,
      browser,
      device,
      location,
      $ignoreOutbox: true 
    });
    await loginActivity.save();

    res.json({
      message: 'Login successful',
      token: generateToken(user._id),
      user
    });
  } catch (err) {
    console.error('[Auth Error]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.logout = (req, res) => {
  res.json({ message: 'Logout successful (handled client-side)' });
};
