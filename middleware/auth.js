const User = require('../models/User');

const requireAuth = async (req, res, next) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const user = await User.findById(req.session.userId);
    if (!user || !user.isActive) {
      req.session.destroy();
      return res.status(401).json({ message: 'User not found or inactive' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Authentication error' });
  }
};

const requirePermanentAccount = (req, res, next) => {
  if (!req.user || (req.user.accountType !== 'permanent' && req.user.accountType !== 'admin')) {
    return res.status(403).json({ message: 'Permanent account required' });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.accountType !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

const redirectIfAuthenticated = async (req, res, next) => {
  if (req.session.userId) {
    try {
      const user = await User.findById(req.session.userId);
      if (user && user.isActive) {
        return res.redirect('/dashboard.html');
      }
    } catch (error) {
      // Continue to login page
    }
  }
  next();
};

module.exports = {
  requireAuth,
  requirePermanentAccount,
  requireAdmin,
  redirectIfAuthenticated
};
