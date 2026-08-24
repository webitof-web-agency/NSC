// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    const token = auth.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded.id || decoded._id || decoded.userId;
      req.userRole = decoded.role;
      return next();
    } catch {
      // In offline / desktop mode, allow tokens issued by cloud backend
      if (process.env.OFFLINE_MODE === 'true' || process.env.ELECTRON_APP === 'true') {
        try {
          const decoded = jwt.decode(token);
          if (decoded && (decoded.id || decoded._id || decoded.userId)) {
            req.user = decoded.id || decoded._id || decoded.userId;
            req.userRole = decoded.role;
            return next();
          }
        } catch {
          // Fall through to 401
        }
      }
      return res.status(401).json({ message: 'Invalid token' });
    }
  } else {
    return res.status(401).json({ message: 'Not authorized' });
  }
};

module.exports = protect;
