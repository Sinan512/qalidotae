var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    default: 'male'
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  whatsappNumber: {
    type: String,
    default: ''
  },
  housename: {
    type: String,
    default: ''
  },
  place: {
    type: String,
    default: ''
  },
  landmark: {
    type: String,
    default: ''
  },
  city: {
    type: String,
    default: ''
  },
  country: {
    type: String,
    default: 'UAE'
  },
  postalCode: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'USERSDETAILS'
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return this.password === candidatePassword;
};

var User = mongoose.model('User', userSchema, 'USERSDETAILS');

module.exports = User;
