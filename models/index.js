var mongoose = require('mongoose');
var bcrypt = require('bcryptjs');

var Admin = require('./Admin');
var Product = require('./Product');
var User = require('./User');
var Order = require('./Order');
var PaymentSetup = require('./PaymentSetup');

async function seedAdminIfEmpty() {
  try {
    var adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      var defaultEmail = process.env.ADMIN_EMAIL ;
      var defaultPass = process.env.ADMIN_PASSWORD ;
      var hashedPassword = await Admin.hashPassword(defaultPass);

      await Admin.create({
        email: defaultEmail,
        password: hashedPassword,
        name: 'Admin',
        role: 'admin'
      });
      console.log('✅ Initialized default Admin credentials in ADMIN_CREDINTIALS for:', defaultEmail);
    }
  } catch (err) {
    console.error('⚠️ Error checking/initializing Admin credentials:', err.message);
  }
}

async function seedPaymentSetupIfEmpty() {
  try {
    var count = await PaymentSetup.countDocuments();
    if (count === 0) {
      await PaymentSetup.create({
        upiId: 'qalidotae@okaxis',
        gpayNumber: '+971 50 123 4567',
        accountHolderName: 'QALIDOTAE LUXURY ATELIER LLC',
        bankName: 'Emirates NBD',
        accountNumber: '1012345678901',
        ifscCode: 'EBILAEADXXX',
        instructions: 'Please pay the order amount using the QR code or UPI/GPay details and reference your Order ID.'
      });
      console.log('✅ Initialized default Payment Setup in PAYMENT_SETUP');
    }
  } catch (err) {
    console.error('⚠️ Error checking/initializing Payment Setup: ', err.message);
  }
}

async function connectDB() {
  var uri = process.env.MONGODB_URI;
  try {
    if (mongoose.connection.readyState === 0) {
      console.log('Connected to MongoDB at:', uri);
      await mongoose.connect(uri);
      await seedAdminIfEmpty();
      await seedPaymentSetupIfEmpty();
    }
    return mongoose.connection;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    throw err;
  }
}

module.exports = {
  connectDB: connectDB,
  Admin: Admin,
  Product: Product,
  User: User,
  Order: Order,
  PaymentSetup: PaymentSetup
};
