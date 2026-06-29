/**
 * Authentication Middleware — JWT Enhanced
 * Roles: teacher | student | cr | admin
 * Added: browser + system device fingerprint validation
 */
const jwt  = require('jsonwebtoken');
const User = require('../models/User');

/**
 * @desc  Verify JWT token and validate device fingerprint (browser + system)
 */
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ── Device fingerprint validation ─────────────────────────────────────────
    const incomingBrowser = req.headers['x-browser'];
    const incomingSystem  = req.headers['x-system'];

    if (decoded.browser && decoded.system) {
      if (!incomingBrowser || !incomingSystem) {
        return res.status(400).json({ success: false, message: 'Device information headers missing.' });
      }
      if (decoded.browser !== incomingBrowser || decoded.system !== incomingSystem) {
        return res.status(403).json({ success: false, message: 'Device mismatch. Session invalid.' });
      }
    }

    req.user = await User.findById(decoded.id).populate('assignedSubject');
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not found.' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

/**
 * @desc  Role-based authorization
 */

exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized for this action.`
      });
    }
    next();
  };
};
