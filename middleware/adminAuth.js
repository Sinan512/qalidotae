var crypto = require('crypto');
var Admin = require('../models/Admin');

var SECRET = process.env.ADMIN_SESSION_SECRET || 'qalidotae_luxury_atelier_admin_secret_key_2026';
var THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function createSessionToken(payload) {
  var data = JSON.stringify({
    ...payload,
    exp: Date.now() + THIRTY_DAYS_MS
  });
  var base64Data = Buffer.from(data).toString('base64url');
  var signature = crypto.createHmac('sha256', SECRET).update(base64Data).digest('base64url');
  return base64Data + '.' + signature;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  var parts = token.split('.');
  if (parts.length !== 2) return null;

  var base64Data = parts[0];
  var signature = parts[1];

  var expectedSignature = crypto.createHmac('sha256', SECRET).update(base64Data).digest('base64url');
  if (signature !== expectedSignature) return null;

  try {
    var payloadStr = Buffer.from(base64Data, 'base64url').toString('utf8');
    var payload = JSON.parse(payloadStr);
    if (!payload.exp || Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

async function getAuthenticatedAdmin(req) {
  var token = req.cookies && req.cookies.qalid_admin_session;
  if (!token) return null;

  var payload = verifySessionToken(token);
  if (!payload || !payload.adminId) return null;

  try {
    var admin = await Admin.findById(payload.adminId).select('-password');
    return admin;
  } catch (err) {
    return null;
  }
}

async function requireAdminAuth(req, res, next) {
  var admin = await getAuthenticatedAdmin(req);
  if (!admin) {
    if (req.xhr || req.path.startsWith('/api') || (req.headers.accept && req.headers.accept.includes('application/json'))) {
      return res.status(401).json({
        success: false,
        message: 'Admin session expired or unauthorized. Please sign in again.'
      });
    }
    // For normal page render, pass isAuthenticated: false so view can render login screen
    req.admin = null;
    return next();
  }
  req.admin = admin;
  next();
}

async function requireAdminApi(req, res, next) {
  var admin = await getAuthenticatedAdmin(req);
  if (!admin) {
    return res.status(401).json({
      success: false,
      message: 'Admin session expired or unauthorized. Please sign in again.'
    });
  }
  req.admin = admin;
  next();
}

module.exports = {
  createSessionToken: createSessionToken,
  verifySessionToken: verifySessionToken,
  getAuthenticatedAdmin: getAuthenticatedAdmin,
  requireAdminAuth: requireAdminAuth,
  requireAdminApi: requireAdminApi,
  THIRTY_DAYS_MS: THIRTY_DAYS_MS
};
