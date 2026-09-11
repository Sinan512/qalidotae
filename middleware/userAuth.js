var crypto = require('crypto');
var User = require('../models/User');
var {connectDB} = ('../models');
var SECRET = process.env.USER_SESSION_SECRET || 'qalidotae_users_secret_key';
var SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000; // 7 days session expiry

function createUserSessionToken(payload) {
  var data = JSON.stringify({
    ...payload,
    exp: Date.now() + SEVEN_DAYS_MS
  });
  var base64Data = Buffer.from(data).toString('base64url');
  var signature = crypto.createHmac("sha256", SECRET).update(base64Data).digest('base64url');
  return base64Data + '.' + signature;
}

function verifyUserSessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  var parts = token.split('.');
  if (parts.length !== 2) return null;

  var base64Data = parts[0];
  var signature = parts[1];

  var expectedSignature = crypto.createHmac("sha256", SECRET).update(base64Data).digest('base64url');
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
	async function getAuthenticatedUser(req) {
  var token = req.cookies && req.cookies.qalid_user_session;
  if (!token) return null;

  var payload = verifyUserSessionToken(token);
  if (!payload || !payload.userId) return null;

  try {
    await connectDB();
    var user = await User.findById(payload.userId);
    return user;
  } catch (err) {
    return null;
  }
}

async function requireUserAuth(req, res, next) {
  var user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Please sign in or create an account to proceed.'
    });
  }
  req.user = user;
  next();
}

async function optionalUserAuth(req, res, next) {
  var user = await getAuthenticatedUser(req);
  req.user = user || null;
  next();
}

module.exports = {
  createUserSessionToken: createUserSessionToken,
  verifyUserSessionToken: verifyUserSessionToken,
  getAuthenticatedUser: getAuthenticatedUser,
  requireUserAuth: requireUserAuth,
  optionalUserAuth: optionalUserAuth,
  SEVEN_DAYS_MS: SEVEN_DAYS_MS
};
