var mongoose = require('mongoose');

var productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  frontImage: {
    type: String, // Stored as Base64 Data URL or image string in MongoDB
    default: ''
  },
  backImage: {
    type: String, // Stored as Base64 Data URL or image string in MongoDB
    default: ''
  },
  type: {
    type: String,
    required: true,
    trim: true
  },
  gender: {
    type: String,
    enum: ['men', 'women', 'unisex'],
    default: 'men'
  },
  archive: {
    type: Boolean,
    default: false
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  availableColours: {
    type: [String],
    default: []
  },
  totalStock: {
    type: Number,
    default: 0,
    min: 0
  },
  availableSizes: {
    type: [String],
    default: ['XS', 'S', 'M', 'L', 'XL', 'XXL']
  },
  description: {
    type: String,
    default: ''
  }
}, {
  timestamps: true,
  collection: 'PRODUCTS'
});

var Product = mongoose.model('Product', productSchema, 'PRODUCTS');

module.exports = Product;
