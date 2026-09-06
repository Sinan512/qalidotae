var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');

var adminSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    default: 'Administrator'
  },
  role: {
    type: String,
    default: 'admin'
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true,
  collection: 'ADMIN_CREDINTIALS'
});

// Method to compare password
adminSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Static helper to hash password
adminSchema.statics.hashPassword = async function (plainPassword) {
  var salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
};

var Admin = mongoose.model('Admin', adminSchema, 'ADMIN_CREDINTIALS');

module.exports = Admin;
