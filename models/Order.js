var mongoose = require('mongoose');

var orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    default: function () {
      return 'QAL-' + Date.now().toString().slice(-6) + Math.floor(100 + Math.random() * 900);
    }
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  selectedSizes: {
    type: [String],
    default: ['M']
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: 1
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: [
      'order rejected',
      'order pending',
      'order confirmed',
      'delivery ongoing',
      'delivery success',
      'order cancelled'
    ],
    default: 'order pending'
  },
  rejectionReason: {
    type: String,
    default: ''
  },
  paymentMode: {
    type: String,
    default: 'UPI / GPay'
  },
  shippingNotes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'ORDERS_DETAILS'
});

var Order = mongoose.model('Order', orderSchema, 'ORDERS_DETAILS');

module.exports = Order;
