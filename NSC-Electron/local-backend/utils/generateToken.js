// utils/generateToken.js
const jwt = require('jsonwebtoken');

const generateToken = (id, extraPayload = {}) => {
  return jwt.sign({ id, ...extraPayload }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

module.exports = generateToken;
