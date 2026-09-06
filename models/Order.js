var mongoose = require('mongoose');

var orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  selectedSize: {
    type: String,
    default: 'M'
  },
  quantity: {
    type: Number,
    required: true,
    default: 1,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  color: {
    type: String,
    default: ''
  }
}, { _id: false });

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
  items: {
    type: [orderItemSchema],
    required: true,
    validate: [
      function (val) {
        return Array.isArray(val) && val.length > 0;
      },
      'Order must contain at least one item.'
    ]
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
    default: 'Cash On Delivery'
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
