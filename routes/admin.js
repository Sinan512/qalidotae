var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');

var Admin = require('../models/Admin');
var Product = require('../models/Product');
var User = require('../models/User');
var Order = require('../models/Order');
var PaymentSetup = require('../models/PaymentSetup');
var {connectDB} = require('../models');

var {
  createSessionToken,
  requireAdminAuth,
  requireAdminApi,
  THIRTY_DAYS_MS
} = require('../middleware/adminAuth');

// Helper to validate Base64 image size (< 2MB)
function validateImageSize(base64Str) {
  if (!base64Str || typeof base64Str !== 'string') return true;
  // If it's a data URI: data:image/png;base64,...
  var commaIdx = base64Str.indexOf(',');
  var dataOnly = commaIdx !== -1 ? base64Str.substring(commaIdx + 1) : base64Str;
  // Base64 size in bytes ≈ (length * 3) / 4
  var sizeInBytes = (dataOnly.length * 3) / 4;
  var maxBytes = 2 * 1024 * 1024; // 2MB
  return sizeInBytes <= maxBytes;
}

/* =========================================================================
   PAGE VIEW ROUTE
   ========================================================================= */
router.get('/', requireAdminAuth, function (req, res, next) {
  res.render('admin', {
    layout: false,
    title: 'Qalidotae — Admin Dashboard',
    isAuthenticated: !!req.admin,
    admin: req.admin ? {
      id: req.admin._id,
      email: req.admin.email,
      name: req.admin.name,
      role: req.admin.role
    } : null
  });
});

/* =========================================================================
   AUTHENTICATION ENDPOINTS
   ========================================================================= */
router.post('/login', async function (req, res) {
  try {
    await connectDB();
    var { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide both email and password.' });
    }

    var cleanEmail = email.trim().toLowerCase();
    var admin = await Admin.findOne({ email: cleanEmail });

    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    var isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    admin.lastLogin = new Date();
    await admin.save();

    var token = createSessionToken({
      adminId: admin._id,
      email: admin.email,
      role: admin.role
    });

    // Store in cookie with 30-day expiration
    res.cookie('qalid_admin_session', token, {
      maxAge: THIRTY_DAYS_MS,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    return res.json({
      success: true,
      message: 'Login successful',
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
});

router.post('/logout', function (req, res) {
  res.clearCookie('qalid_admin_session');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

router.get('/api/me', requireAdminApi, function (req, res) {
  return res.json({
    success: true,
    admin: {
      id: req.admin._id,
      email: req.admin.email,
      name: req.admin.name,
      role: req.admin.role
    }
  });
});

/* =========================================================================
   ADMIN CREDENTIALS MANAGEMENT
   ========================================================================= */
router.get('/api/credentials', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var admin = await Admin.findById(req.admin._id).select('-password');
    return res.json({ success: true, admin: admin });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/api/credentials', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var { name, email, currentPassword, newPassword } = req.body;
    var admin = await Admin.findById(req.admin._id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin account not found.' });
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to set a new password.' });
      }
      var isMatch = await admin.comparePassword(currentPassword);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password does not match.' });
      }
      admin.password = await Admin.hashPassword(newPassword);
    }

    if (name) admin.name = name.trim();
    if (email) admin.email = email.trim().toLowerCase();

    await admin.save();

    // Re-issue cookie session
    var token = createSessionToken({
      adminId: admin._id,
      email: admin.email,
      role: admin.role
    });
    res.cookie('qalid_admin_session', token, {
      maxAge: THIRTY_DAYS_MS,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    return res.json({
      success: true,
      message: 'Admin credentials updated successfully.',
      admin: {
        id: admin._id,
        email: admin.email,
        name: admin.name,
        role: admin.role
      }
    });
  } catch (err) {
    console.error('Update credentials error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================================================
   OVERVIEW STATS API
   ========================================================================= */
router.get('/api/overview', requireAdminApi, async function (req, res) {
  try {
    var [
      totalProducts,
      activeProducts,
      archivedProducts,
      totalUsers,
      totalOrders,
      pendingOrders,
      confirmedOrders,
      ongoingDeliveries,
      successfulDeliveries,
      cancelledOrders,
      rejectedOrders,
      recentOrders,
      lowStockProducts
    ] = await Promise.all([
      Product.countDocuments(),
      Product.countDocuments({ archive: false }),
      Product.countDocuments({ archive: true }),
      User.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ status: 'order pending' }),
      Order.countDocuments({ status: 'order confirmed' }),
      Order.countDocuments({ status: 'delivery ongoing' }),
      Order.countDocuments({ status: 'delivery success' }),
      Order.countDocuments({ status: 'order cancelled' }),
      Order.countDocuments({ status: 'order rejected' }),
      Order.find().sort({ createdAt: -1 }).limit(5).populate('userId').populate('items.productId'),
      Product.find({ totalStock: { $lte: 5 }, archive: false }).limit(6)
    ]);
    await connectDB();

    // Calculate total revenue from successful orders only.
    var revenueAgg = await Order.aggregate([
      { $match: { status: { $in: ['delivery success'] } } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]); //for add other { $in:['delivery sucess','order confirmed','delivery ongoing']}

    var totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].total : 0;

    return res.json({
      success: true,
      overview: {
        totalRevenue: totalRevenue,
        totalProducts: totalProducts,
        activeProducts: activeProducts,
        archivedProducts: archivedProducts,
        totalUsers: totalUsers,
        totalOrders: totalOrders,
        pendingOrders: pendingOrders,
        confirmedOrders: confirmedOrders,
        ongoingDeliveries: ongoingDeliveries,
        successfulDeliveries: successfulDeliveries,
        cancelledOrders: cancelledOrders,
        rejectedOrders: rejectedOrders,
        recentOrders: recentOrders,
        lowStockProducts: lowStockProducts
      }
    });
  } catch (err) {
    console.error('Overview error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================================================
   PRODUCTS API (Collection: 'PRODUCTS')
   ========================================================================= */
router.get('/api/products', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var products = await Product.find().sort({ createdAt: -1 });
    return res.json({ success: true, products: products });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/api/products/:id', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    return res.json({ success: true, product: product });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/api/products', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var {
      name,
      price,
      frontImage,
      backImage,
      type,
      gender,
      archive,
      isAvailable,
      availableColours,
      totalStock,
      availableSizes,
      description
    } = req.body;

    if (!name || price === undefined || !type) {
      return res.status(400).json({ success: false, message: 'Name, price, and type are required.' });
    }

    if (!validateImageSize(frontImage) || !validateImageSize(backImage)) {
      return res.status(400).json({ success: false, message: 'Each product image must be less than 2MB.' });
    }

    // Process sizes: if sizes contains 'ALL', set all standard sizes
    var parsedSizes = [];
    if (Array.isArray(availableSizes)) {
      if (availableSizes.includes('ALL')) {
        parsedSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
      } else {
        parsedSizes = availableSizes;
      }
    } else if (typeof availableSizes === 'string') {
      if (availableSizes.trim() === 'ALL') {
        parsedSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
      } else {
        parsedSizes = availableSizes.split(',').map(s => s.trim()).filter(Boolean);
      }
    } else {
      parsedSizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
    }

    // Process colours
    var parsedColours = [];
    if (Array.isArray(availableColours)) {
      parsedColours = availableColours;
    } else if (typeof availableColours === 'string') {
      parsedColours = availableColours.split(',').map(c => c.trim()).filter(Boolean);
    }

    var product = new Product({
      name: name.trim(),
      price: Number(price),
      frontImage: frontImage || '',
      backImage: backImage || '',
      type: type.trim(),
      gender: gender === 'women' ? 'women' : (gender === 'unisex' ? 'unisex' : 'men'),
      archive: !!archive,
      isAvailable: isAvailable !== undefined ? !!isAvailable : true,
      availableColours: parsedColours,
      totalStock: Number(totalStock) || 0,
      availableSizes: parsedSizes.length > 0 ? parsedSizes : ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      description: description ? description.trim() : ''
    });

    await product.save();
    return res.status(201).json({ success: true, message: 'Product created successfully.', product: product });
  } catch (err) {
    console.error('Create product error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/api/products/:id', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    var {
      name,
      price,
      frontImage,
      backImage,
      type,
      gender,
      archive,
      isAvailable,
      availableColours,
      totalStock,
      availableSizes,
      description
    } = req.body;

    if (frontImage && !validateImageSize(frontImage)) {
      return res.status(400).json({ success: false, message: 'Front image must be less than 2MB.' });
    }
    if (backImage && !validateImageSize(backImage)) {
      return res.status(400).json({ success: false, message: 'Back image must be less than 2MB.' });
    }

    if (name) product.name = name.trim();
    if (price !== undefined) product.price = Number(price);
    if (frontImage !== undefined) product.frontImage = frontImage;
    if (backImage !== undefined) product.backImage = backImage;
    if (type) product.type = type.trim();
    if (gender) product.gender = gender;
    if (archive !== undefined) product.archive = !!archive;
    if (isAvailable !== undefined) product.isAvailable = !!isAvailable;
    if (totalStock !== undefined) product.totalStock = Number(totalStock);
    if (description !== undefined) product.description = description.trim();

    if (availableSizes !== undefined) {
      if (Array.isArray(availableSizes)) {
        product.availableSizes = availableSizes.includes('ALL') ? ['XS', 'S', 'M', 'L', 'XL', 'XXL'] : availableSizes;
      } else if (typeof availableSizes === 'string') {
        product.availableSizes = availableSizes.trim() === 'ALL'
          ? ['XS', 'S', 'M', 'L', 'XL', 'XXL']
          : availableSizes.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    if (availableColours !== undefined) {
      if (Array.isArray(availableColours)) {
        product.availableColours = availableColours;
      } else if (typeof availableColours === 'string') {
        product.availableColours = availableColours.split(',').map(c => c.trim()).filter(Boolean);
      }
    }

    await product.save();
    return res.json({ success: true, message: 'Product updated successfully.', product: product });
  } catch (err) {
    console.error('Update product error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/api/products/:id/archive', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });

    product.archive = req.body.archive !== undefined ? !!req.body.archive : !product.archive;
    await product.save();
    return res.json({
      success: true,
      message: product.archive ? 'Product archived.' : 'Product unarchived.',
      product: product
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/api/products/:id', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found.' });
    return res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================================================
   USERS API (Collection: 'USERSDETALIS')
   ========================================================================= */
router.get('/api/users', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    // Admin is permitted to view password as per requirement 2
    var users = await User.find().sort({ createdAt: -1 });
    return res.json({ success: true, users: users });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/api/users/:id', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, user: user });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/api/users/:id', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    var {
      fullName,
      gender,
      email,
      phoneNumber,
      whatsappNumber,
      housename,
      place,
      landmark,
      city,
      country,
      postalCode
    } = req.body;

    // As per Requirement 2: Do NOT let admin edit user password.
    if (fullName) user.fullName = fullName.trim();
    if (gender) user.gender = gender;
    if (email) user.email = email.trim().toLowerCase();
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber.trim();
    if (whatsappNumber !== undefined) user.whatsappNumber = whatsappNumber.trim();
    if (housename !== undefined) user.housename = housename.trim();
    if (place !== undefined) user.place = place.trim();
    if (landmark !== undefined) user.landmark = landmark.trim();
    if (city !== undefined) user.city = city.trim();
    if (country !== undefined) user.country = country.trim();
    if (postalCode !== undefined) user.postalCode = postalCode.trim();

    await user.save();
    return res.json({ success: true, message: 'User details updated successfully.', user: user });
  } catch (err) {
    console.error('Update user error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/api/users/:id', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================================================
   ORDERS API (Collection: 'ORDERS_DETAILS')
   ========================================================================= */
router.get('/api/orders', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    // Populate normalized references to User and Product items
    var orders = await Order.find()
      .populate('userId')
      .populate('items.productId')
      .sort({ createdAt: -1 });

    return res.json({ success: true, orders: orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/api/orders/:id', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var order = await Order.findById(req.params.id)
      .populate('userId')
      .populate('items.productId');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    return res.json({ success: true, order: order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/api/orders/:id/status', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    var validStatuses = [
      'order rejected',
      'order pending',
      'order confirmed',
      'delivery ongoing',
      'delivery success',
      'order cancelled'
    ];

    var { status, rejectionReason } = req.body;
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    order.status = status;
    if (status === 'order rejected') {
      order.rejectionReason = rejectionReason || 'Order rejected by administration.';
    } else {
      if (rejectionReason !== undefined) order.rejectionReason = rejectionReason;
    }

    await order.save();
    var populatedOrder = await Order.findById(order._id).populate('userId').populate('items.productId');
    return res.json({ success: true, message: 'Order status updated.', order: populatedOrder });
  } catch (err) {
    console.error('Update order status error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/api/orders/:id', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var order = await Order.findByIdAndDelete(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    return res.json({ success: true, message: 'Order deleted successfully.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================================================
   PAYMENT SETUP API (Collection: 'PAYMENT_SETUP')
   ========================================================================= */
router.get('/api/payment-setup', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var setup = await PaymentSetup.findOne();
    if (!setup) {
      setup = await PaymentSetup.create({
        upiId: 'qalidotae@okaxis',
        gpayNumber: '+971 50 123 4567',
        accountHolderName: 'QALIDOTAE LUXURY ATELIER LLC'
      });
    }
    return res.json({ success: true, paymentSetup: setup });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/api/payment-setup', requireAdminApi, async function (req, res) {
  try {
    await connectDB();
    var {
      qrCodeImage,
      upiId,
      gpayNumber,
      accountHolderName,
      bankName,
      accountNumber,
      ifscCode,
      instructions,
      isActive
    } = req.body;

    if (qrCodeImage && !validateImageSize(qrCodeImage)) {
      return res.status(400).json({ success: false, message: 'QR Code image must be less than 2MB.' });
    }

    var setup = await PaymentSetup.findOne();
    if (!setup) {
      setup = new PaymentSetup();
    }

    if (qrCodeImage !== undefined) setup.qrCodeImage = qrCodeImage;
    if (upiId !== undefined) setup.upiId = upiId.trim();
    if (gpayNumber !== undefined) setup.gpayNumber = gpayNumber.trim();
    if (accountHolderName !== undefined) setup.accountHolderName = accountHolderName.trim();
    if (bankName !== undefined) setup.bankName = bankName.trim();
    if (accountNumber !== undefined) setup.accountNumber = accountNumber.trim();
    if (ifscCode !== undefined) setup.ifscCode = ifscCode.trim();
    if (instructions !== undefined) setup.instructions = instructions.trim();
    if (isActive !== undefined) setup.isActive = !!isActive;

    await setup.save();
    return res.json({ success: true, message: 'Payment setup updated successfully.', paymentSetup: setup });
  } catch (err) {
    console.error('Update payment setup error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
