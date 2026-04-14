const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'animal_adoption_secret';

/**
 * Middleware: verify JWT and attach decoded payload to req.user
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

/**
 * Middleware: require admin role
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

/**
 * Middleware: require user role
 */
function requireUser(req, res, next) {
  if (!req.user || req.user.role !== 'user') {
    return res.status(403).json({ message: 'User access required' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, requireUser };
