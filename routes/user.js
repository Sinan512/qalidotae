var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var geoip = require('geoip-lite');

var Product = require('../models/Product');
var User = require('../models/User');
var Order = require('../models/Order');

var {
  createUserSessionToken,
  getAuthenticatedUser,
  requireUserAuth,
  optionalUserAuth,
  SEVEN_DAYS_MS
} = require('../middleware/userAuth');

/* =========================================================================
   GEOIP & FRANKFURTER CURRENCY ENGINE
   ========================================================================= */

// Country to Currency Mapping
var COUNTRY_CURRENCY_MAP = {
  IN: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  AE: { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  SA: { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal' },
  QA: { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal' },
  KW: { code: 'KWD', symbol: 'KWD', name: 'Kuwaiti Dinar' },
  OM: { code: 'OMR', symbol: 'OMR', name: 'Omani Rial' },
  BH: { code: 'BHD', symbol: 'BHD', name: 'Bahraini Dinar' },
  US: { code: 'USD', symbol: '$', name: 'US Dollar' },
  GB: { code: 'GBP', symbol: '£', name: 'British Pound' },
  CA: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  AU: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  SG: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  MY: { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  // Eurozone countries
  FR: { code: 'EUR', symbol: '€', name: 'Euro' },
  DE: { code: 'EUR', symbol: '€', name: 'Euro' },
  IT: { code: 'EUR', symbol: '€', name: 'Euro' },
  ES: { code: 'EUR', symbol: '€', name: 'Euro' },
  NL: { code: 'EUR', symbol: '€', name: 'Euro' },
  BE: { code: 'EUR', symbol: '€', name: 'Euro' },
  AT: { code: 'EUR', symbol: '€', name: 'Euro' },
  CH: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  JP: { code: 'JPY', symbol: '¥', name: 'Japanese Yen' }
};

// Fallback rates from INR (approximate base rates when API is loading/offline)
var DEFAULT_INR_RATES = {
  INR: 1.0,
  AED: 0.044,     // 1 INR ≈ 0.044 AED (or 1 AED ≈ 22.7 INR)
  SAR: 0.045,     // 1 INR ≈ 0.045 SAR
  QAR: 0.044,     // 1 INR ≈ 0.044 QAR
  KWD: 0.0037,    // 1 INR ≈ 0.0037 KWD
  OMR: 0.0046,    // 1 INR ≈ 0.0046 OMR
  BHD: 0.0045,    // 1 INR ≈ 0.0045 BHD
  USD: 0.012,     // 1 INR ≈ 0.012 USD
  EUR: 0.011,     // 1 INR ≈ 0.011 EUR
  GBP: 0.0095,    // 1 INR ≈ 0.0095 GBP
  CAD: 0.016,     // 1 INR ≈ 0.016 CAD
  AUD: 0.018,     // 1 INR ≈ 0.018 AUD
  SGD: 0.016,     // 1 INR ≈ 0.016 SGD
  CHF: 0.011,     // 1 INR ≈ 0.011 CHF
  JPY: 1.8        // 1 INR ≈ 1.8 JPY
};

// Fixed USD peg multipliers for Middle East currencies
var USD_PEG = {
  AED: 3.6725,
  SAR: 3.75,
  QAR: 3.64,
  KWD: 0.307,
  OMR: 0.385,
  BHD: 0.376
};

// In-memory cache for Frankfurter API rates
var rateCache = {
  timestamp: 0,
  rates: { ...DEFAULT_INR_RATES }
};
var CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

async function getLiveRatesFromFrankfurter() {
  var now = Date.now();
  if (now - rateCache.timestamp < CACHE_DURATION_MS && Object.keys(rateCache.rates).length > 2) {
    return rateCache.rates;
  }

  try {
    // Frankfurter API: base INR
    var controller = new AbortController();
    var timeout = setTimeout(() => controller.abort(), 4000);
    var response = await fetch('https://api.frankfurter.dev/v1/latest?base=INR', {
      signal: controller.signal
    }).catch(async () => {
      // Fallback domain
      return await fetch('https://api.frankfurter.app/latest?from=INR', { signal: controller.signal });
    });
    clearTimeout(timeout);

    if (response && response.ok) {
      var data = await response.json();
      var frankfurterRates = data.rates || {};

      var newRates = {
        INR: 1.0,
        ...DEFAULT_INR_RATES
      };

      // Populate direct rates from Frankfurter
      for (var curr in frankfurterRates) {
        newRates[curr] = frankfurterRates[curr];
      }

      // Calculate GCC pegged currencies from USD rate
      if (newRates.USD) {
        for (var gccCurr in USD_PEG) {
          newRates[gccCurr] = Number((newRates.USD * USD_PEG[gccCurr]).toFixed(6));
        }
      }

      rateCache = {
        timestamp: now,
        rates: newRates
      };
      return newRates;
    }
  } catch (err) {
    console.warn('Frankfurter API fetch note:', err.message, '- using cached/default rates');
  }

  return rateCache.rates;
}

function getClientIp(req) {
  var forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    var ipList = forwarded.split(',');
    return ipList[0].trim();
  }
  return req.headers['cf-connecting-ip'] ||
         req.headers['x-real-ip'] ||
         req.ip ||
         req.socket.remoteAddress ||
         '127.0.0.1';
}

/* =========================================================================
   PAGE VIEW ROUTE
   ========================================================================= */
router.get('/', optionalUserAuth, function (req, res, next) {
  res.render('user', {
    layout: false,
    title: 'Qalidotae — Luxury Arabic Fashion & Atelier',
    isFullCatalog: false,
    user: req.user ? {
      id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      gender: req.user.gender,
      phoneNumber: req.user.phoneNumber,
      city: req.user.city,
      country: req.user.country
    } : null
  });
});

router.get(['/products', '/user-product-view'], optionalUserAuth, function (req, res, next) {
  res.render('user-product-view', {
    layout: false,
    title: 'Curated Atelier Garment Catalog — Qalidotae',
    isFullCatalog: true,
    initialType: req.query.type || 'all',
    initialColor: req.query.color || 'all',
    initialGender: req.query.gender || 'all',
    initialSearch: req.query.search || '',
    initialSort: req.query.sort || 'newest',
    user: req.user ? {
      id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      gender: req.user.gender,
      phoneNumber: req.user.phoneNumber,
      city: req.user.city,
      country: req.user.country
    } : null
  });
});

/* =========================================================================
   GEO-LOCATION & CURRENCY API
   ========================================================================= */
router.get('/api/geo-currency', async function (req, res) {
  try {
    var clientIp = getClientIp(req);
    var geo = geoip.lookup(clientIp);

    // Default to UAE or India if local/unknown
    var countryCode = (geo && geo.country) ? geo.country.toUpperCase() : 'AE';
    var countryName = (geo && geo.city) ? `${geo.city}, ${countryCode}` : (countryCode === 'AE' ? 'United Arab Emirates' : (countryCode === 'IN' ? 'India' : countryCode));

    var targetCurrency = COUNTRY_CURRENCY_MAP[countryCode] || { code: 'USD', symbol: '$', name: 'US Dollar' };

    var allRates = await getLiveRatesFromFrankfurter();
    var rateFromINR = allRates[targetCurrency.code] || DEFAULT_INR_RATES[targetCurrency.code] || 0.012;

    var supportedCurrenciesList = [
      { code: 'AED', symbol: 'AED', name: 'UAE Dirham', flag: '🇦🇪', rateFromINR: allRates.AED || DEFAULT_INR_RATES.AED },
      { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', flag: '🇸🇦', rateFromINR: allRates.SAR || DEFAULT_INR_RATES.SAR },
      { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal', flag: '🇶🇦', rateFromINR: allRates.QAR || DEFAULT_INR_RATES.QAR },
      { code: 'KWD', symbol: 'KWD', name: 'Kuwaiti Dinar', flag: '🇰🇼', rateFromINR: allRates.KWD || DEFAULT_INR_RATES.KWD },
      { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', flag: '🇴🇲', rateFromINR: allRates.OMR || DEFAULT_INR_RATES.OMR },
      { code: 'BHD', symbol: 'BHD', name: 'Bahraini Dinar', flag: '🇧🇭', rateFromINR: allRates.BHD || DEFAULT_INR_RATES.BHD },
      { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳', rateFromINR: 1.0 },
      { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸', rateFromINR: allRates.USD || DEFAULT_INR_RATES.USD },
      { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', rateFromINR: allRates.EUR || DEFAULT_INR_RATES.EUR },
      { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧', rateFromINR: allRates.GBP || DEFAULT_INR_RATES.GBP }
    ];

    return res.json({
      success: true,
      ip: clientIp,
      country: countryCode,
      countryName: countryName,
      currency: {
        code: targetCurrency.code,
        symbol: targetCurrency.symbol,
        name: targetCurrency.name,
        rateFromINR: rateFromINR
      },
      allRates: allRates,
      supportedCurrencies: supportedCurrenciesList
    });
  } catch (err) {
    console.error('Geo Currency API Error:', err);
    return res.json({
      success: true,
      country: 'AE',
      currency: { code: 'AED', symbol: 'AED', name: 'UAE Dirham', rateFromINR: 0.044 },
      allRates: DEFAULT_INR_RATES
    });
  }
});

/* =========================================================================
   AUTHENTICATION ENDPOINTS (Stored in USERSDETAILS, Direct Password, 7-Day Cookie)
   ========================================================================= */

// User Signup
router.post('/api/user/signup', async function (req, res) {
  try {
    var {
      fullName,
      email,
      password,
      gender,
      phoneNumber,
      whatsappNumber,
      housename,
      place,
      landmark,
      city,
      country,
      postalCode
    } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Email address, and Password are required.'
      });
    }

    var cleanEmail = email.trim().toLowerCase();
    var existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists. Please sign in.'
      });
    }

    // Direct password storage as requested
    var user = new User({
      fullName: fullName.trim(),
      email: cleanEmail,
      password: password.trim(),
      gender: gender || 'male',
      phoneNumber: (phoneNumber || '').trim(),
      whatsappNumber: (whatsappNumber || phoneNumber || '').trim(),
      housename: (housename || '').trim(),
      place: (place || '').trim(),
      landmark: (landmark || '').trim(),
      city: (city || '').trim(),
      country: (country || 'UAE').trim(),
      postalCode: (postalCode || '').trim()
    });

    await user.save();

    // Create 7-day session token & set cookie
    var token = createUserSessionToken({
      userId: user._id,
      email: user.email
    });

    res.cookie('qalid_user_session', token, {
      maxAge: SEVEN_DAYS_MS,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        whatsappNumber: user.whatsappNumber,
        housename: user.housename,
        place: user.place,
        landmark: user.landmark,
        city: user.city,
        country: user.country,
        postalCode: user.postalCode
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// User Login
router.post('/api/user/login', async function (req, res) {
  try {
    var { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.'
      });
    }

    var cleanEmail = email.trim().toLowerCase();
    var user = await User.findOne({ email: cleanEmail });

    if (!user || user.password !== password.trim()) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.'
      });
    }

    // Create 7-day session token & set cookie
    var token = createUserSessionToken({
      userId: user._id,
      email: user.email
    });

    res.cookie('qalid_user_session', token, {
      maxAge: SEVEN_DAYS_MS,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    return res.json({
      success: true,
      message: 'Logged in successfully.',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        whatsappNumber: user.whatsappNumber,
        housename: user.housename,
        place: user.place,
        landmark: user.landmark,
        city: user.city,
        country: user.country,
        postalCode: user.postalCode
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// User Logout
router.post('/api/user/logout', function (req, res) {
  res.clearCookie('qalid_user_session');
  return res.json({ success: true, message: 'Logged out successfully.' });
});

// Get Current User Profile
router.get('/api/user/me', async function (req, res) {
  try {
    var user = await getAuthenticatedUser(req);
    if (!user) {
      return res.json({ success: true, isAuthenticated: false, user: null });
    }
    return res.json({
      success: true,
      isAuthenticated: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        whatsappNumber: user.whatsappNumber,
        housename: user.housename,
        place: user.place,
        landmark: user.landmark,
        city: user.city,
        country: user.country,
        postalCode: user.postalCode
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Update Profile
router.put('/api/user/profile', requireUserAuth, async function (req, res) {
  try {
    var user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    var {
      fullName,
      gender,
      phoneNumber,
      whatsappNumber,
      housename,
      place,
      landmark,
      city,
      country,
      postalCode
    } = req.body;

    if (fullName) user.fullName = fullName.trim();
    if (gender) user.gender = gender;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber.trim();
    if (whatsappNumber !== undefined) user.whatsappNumber = whatsappNumber.trim();
    if (housename !== undefined) user.housename = housename.trim();
    if (place !== undefined) user.place = place.trim();
    if (landmark !== undefined) user.landmark = landmark.trim();
    if (city !== undefined) user.city = city.trim();
    if (country !== undefined) user.country = country.trim();
    if (postalCode !== undefined) user.postalCode = postalCode.trim();

    await user.save();
    return res.json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        gender: user.gender,
        phoneNumber: user.phoneNumber,
        whatsappNumber: user.whatsappNumber,
        housename: user.housename,
        place: user.place,
        landmark: user.landmark,
        city: user.city,
        country: user.country,
        postalCode: user.postalCode
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================================================
   PRODUCTS API (Collection: 'PRODUCTS')
   ========================================================================= */

// Get Products Catalog
router.get('/api/products', async function (req, res) {
  try {
    var { gender, type, search, sort } = req.query;
    var filter = { archive: false, isAvailable: true };

    if (gender && ['men', 'women', 'unisex'].includes(gender.toLowerCase())) {
      filter.gender = { $in: [gender.toLowerCase(), 'unisex'] };
    }

    if (type && type.trim() !== '' && type.toLowerCase() !== 'all') {
      filter.type = new RegExp('^' + type.trim() + '$', 'i');
    }

    if (search && search.trim() !== '') {
      var searchRegex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { name: searchRegex },
        { type: searchRegex },
        { description: searchRegex }
      ];
    }

    var query = Product.find(filter);

    if (sort === 'price_asc') {
      query.sort({ price: 1 });
    } else if (sort === 'price_desc') {
      query.sort({ price: -1 });
    } else {
      query.sort({ createdAt: -1 }); // Newest
    }

    var products = await query.exec();
    return res.json({ success: true, count: products.length, products: products });
  } catch (err) {
    console.error('Fetch products error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Get Single Product
router.get('/api/products/:id', async function (req, res) {
  try {
    var product = await Product.findById(req.params.id);
    if (!product || product.archive) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    return res.json({ success: true, product: product });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/* =========================================================================
   ORDERS & CHECKOUT API (Collection: 'ORDERS_DETAILS', COD Default, Multi-Item)
   ========================================================================= */

// Place Order (Guest signup is triggered before this, or direct for logged-in user)
router.post('/api/orders', requireUserAuth, async function (req, res) {
  try {
    var { items, shippingNotes, shippingAddress } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty. Please add products to checkout.'
      });
    }

    var validatedItems = [];
    var calculatedTotal = 0;

    // Validate each item and check stock
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (!item.productId) {
        return res.status(400).json({ success: false, message: 'Invalid product in order.' });
      }

      var product = await Product.findById(item.productId);
      if (!product || product.archive || !product.isAvailable) {
        return res.status(400).json({
          success: false,
          message: `Product "${product ? product.name : 'Unknown'}" is no longer available.`
        });
      }

      var qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      if (product.totalStock < qty) {
        return res.status(400).json({
          success: false,
          message: `Not enough stock for "${product.name}". Available: ${product.totalStock} units.`
        });
      }

      var itemPrice = product.price; // Actual price in INR base
      var itemSubtotal = itemPrice * qty;
      calculatedTotal += itemSubtotal;

      validatedItems.push({
        productId: product._id,
        selectedSize: item.selectedSize || 'M',
        quantity: qty,
        price: itemPrice,
        color: item.color || (product.availableColours && product.availableColours[0]) || ''
      });

      // Decrement product total stock
      product.totalStock = Math.max(0, product.totalStock - qty);
      if (product.totalStock === 0) {
        // Keep isAvailable as true or false depending on atelier policy
      }
      await product.save();
    }

    // If customer updated shipping address at checkout, update user model
    if (shippingAddress && typeof shippingAddress === 'object') {
      var user = await User.findById(req.user._id);
      if (user) {
        if (shippingAddress.phoneNumber) user.phoneNumber = shippingAddress.phoneNumber.trim();
        if (shippingAddress.whatsappNumber) user.whatsappNumber = shippingAddress.whatsappNumber.trim();
        if (shippingAddress.housename) user.housename = shippingAddress.housename.trim();
        if (shippingAddress.place) user.place = shippingAddress.place.trim();
        if (shippingAddress.landmark) user.landmark = shippingAddress.landmark.trim();
        if (shippingAddress.city) user.city = shippingAddress.city.trim();
        if (shippingAddress.country) user.country = shippingAddress.country.trim();
        if (shippingAddress.postalCode) user.postalCode = shippingAddress.postalCode.trim();
        await user.save();
      }
    }

    // Create single order document in ORDERS_DETAILS with array of items
    var order = new Order({
      userId: req.user._id,
      items: validatedItems,
      totalPrice: calculatedTotal,
      status: 'order pending',
      paymentMode: 'Cash On Delivery', // Default Cash on Delivery
      shippingNotes: (shippingNotes || '').trim()
    });

    await order.save();

    var populatedOrder = await Order.findById(order._id)
      .populate('userId', 'fullName email phoneNumber housename place city country postalCode')
      .populate('items.productId');

    return res.status(201).json({
      success: true,
      message: 'Your order has been placed successfully with Cash On Delivery!',
      order: populatedOrder
    });
  } catch (err) {
    console.error('Order placement error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Get User's Orders
router.get('/api/orders/my-orders', requireUserAuth, async function (req, res) {
  try {
    var orders = await Order.find({ userId: req.user._id })
      .populate('items.productId')
      .sort({ createdAt: -1 });

    return res.json({ success: true, orders: orders });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// Public / User Live Order Tracking by Order Number
router.get('/api/orders/track/:orderNumber', async function (req, res) {
  try {
    var orderNum = (req.params.orderNumber || '').trim();
    if (!orderNum) {
      return res.status(400).json({ success: false, message: 'Please provide an Order Number to track.' });
    }

    var filter = {
      $or: [
        { orderNumber: new RegExp('^' + orderNum + '$', 'i') }
      ]
    };

    if (mongoose.isValidObjectId(orderNum)) {
      filter.$or.push({ _id: orderNum });
    }

    var order = await Order.findOne(filter)
      .populate('userId', 'fullName email phoneNumber city country')
      .populate('items.productId');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'No order found with the provided Order Number. Please check and try again.'
      });
    }

    // Build timeline stages
    var stages = [
      { key: 'order pending', label: 'Order Placed & Pending', desc: 'Order received and being prepared at our atelier.', completed: false, current: false },
      { key: 'order confirmed', label: 'Order Confirmed', desc: 'Garments verified, packaged in luxury casing.', completed: false, current: false },
      { key: 'delivery ongoing', label: 'Delivery In Progress', desc: 'Dispatched with our courier partner.', completed: false, current: false },
      { key: 'delivery success', label: 'Delivered', desc: 'Successfully delivered to your destination.', completed: false, current: false }
    ];

    var statusOrder = ['order pending', 'order confirmed', 'delivery ongoing', 'delivery success'];
    var currentIdx = statusOrder.indexOf(order.status);

    if (order.status === 'order rejected' || order.status === 'order cancelled') {
      stages = [
        { key: 'order pending', label: 'Order Placed', completed: true, current: false },
        {
          key: order.status,
          label: order.status === 'order rejected' ? 'Order Rejected' : 'Order Cancelled',
          desc: order.rejectionReason || (order.status === 'order rejected' ? 'Order could not be fulfilled.' : 'Order cancelled by customer.'),
          completed: true,
          current: true,
          isError: true
        }
      ];
    } else {
      stages.forEach((stage, idx) => {
        if (idx < currentIdx) stage.completed = true;
        else if (idx === currentIdx) {
          stage.completed = true;
          stage.current = true;
        }
      });
    }

    return res.json({
      success: true,
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentMode: order.paymentMode,
        totalPrice: order.totalPrice,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        shippingNotes: order.shippingNotes,
        rejectionReason: order.rejectionReason,
        items: (order.items || []).map(item => ({
          productName: item.productId ? item.productId.name : 'Atelier Garment',
          productImage: item.productId ? item.productId.frontImage : '',
          productType: item.productId ? item.productId.type : '',
          selectedSize: item.selectedSize,
          quantity: item.quantity,
          price: item.price,
          color: item.color
        })),
        customer: {
          name: order.userId ? order.userId.fullName : 'Guest',
          city: order.userId ? order.userId.city : '',
          country: order.userId ? order.userId.country : ''
        },
        timeline: stages
      }
    });
  } catch (err) {
    console.error('Order tracking error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// User Cancel Order (Only if 'order pending')
router.post('/api/orders/:id/cancel', requireUserAuth, async function (req, res) {
  try {
    var order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (order.status !== 'order pending') {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled as it is already ' + order.status + '.'
      });
    }

    order.status = 'order cancelled';
    order.rejectionReason = 'Cancelled by customer.';
    await order.save();

    // Restore product stock
    if (Array.isArray(order.items)) {
      for (var item of order.items) {
        if (item.productId) {
          await Product.findByIdAndUpdate(item.productId, { $inc: { totalStock: item.quantity } });
        }
      }
    }

    return res.json({ success: true, message: 'Order cancelled successfully.', order: order });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

