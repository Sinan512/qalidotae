var mongoose = require('mongoose');
var db = require('../models/store');
var uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/qalid';
var images = ['IMG-20260802-WA0002.jpg','IMG-20260802-WA0001.jpg','IMG-20260731-WA0040.jpg','IMG-20260731-WA0028.jpg','IMG-20260731-WA0027(2).jpg','IMG-20260731-WA0022.jpg','IMG-20260731-WA0021.jpg','IMG-20260731-WA0020.jpg'];
(async function () {
  await mongoose.connect(uri);
  if (await db.Product.countDocuments()) { console.log('Products already exist; nothing seeded.'); return mongoose.disconnect(); }
  await db.Product.insertMany(images.map(function (file, i) { return { name: ['The Signature Thobe','The Sand Thobe','The Midnight Thobe','The Linen Thobe','The Modern Emirati','The Classic White','The Evening Thobe','The Essential'][i], slug: 'qalid-' + (i + 1), description: 'A refined Qalid thobe cut for effortless movement and everyday distinction.', price: 420 + i * 35, image: '/images/' + encodeURIComponent(file), category: i < 2 ? 'New arrivals' : 'Thobes', sizes: ['S','M','L','XL'], stock: 8 + i * 3, featured: i < 3, active: true }; }));
  console.log('Seeded Qalid collection.');
  await mongoose.disconnect();
}()).catch(function (err) { console.error(err); process.exitCode = 1; });
