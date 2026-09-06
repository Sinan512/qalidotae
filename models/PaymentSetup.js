var mongoose = require('mongoose');

var paymentSetupSchema = new mongoose.Schema({
  qrCodeImage: {
    type: String, // Stored as Base64 Data URL in MongoDB
    default: ''
  },
  upiId: {
    type: String,
    default: ''
  },
  gpayNumber: {
    type: String,
    default: ''
  },
  accountHolderName: {
    type: String,
    default: 'Qalidotae Atelier'
  },
  bankName: {
    type: String,
    default: ''
  },
  accountNumber: {
    type: String,
    default: ''
  },
  ifscCode: {
    type: String,
    default: ''
  },
  instructions: {
    type: String,
    default: 'Please complete payment via UPI / GPay and share screenshot with order ID.'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  collection: 'PAYMENT_SETUP'
});

var PaymentSetup = mongoose.model('PaymentSetup', paymentSetupSchema, 'PAYMENT_SETUP');

module.exports = PaymentSetup;
