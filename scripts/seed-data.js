require('dotenv').config();
var mongoose = require('mongoose');
var db = require('../models');

// Helper to generate elegant placeholder SVG Base64 image
function createSampleImage(title, bg, textCol) {
  var svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
    <rect width="100%" height="100%" fill="${bg || '#1a1a1a'}"/>
    <rect x="20" y="20" width="560" height="760" fill="none" stroke="#d4af37" stroke-width="2" stroke-opacity="0.4"/>
    <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" font-family="serif" font-size="28" fill="${textCol || '#e2d9c8'}" letter-spacing="4">QALIDOTAE</text>
    <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="${textCol || '#c5c1b9'}" letter-spacing="2">${title}</text>
  </svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

async function seed() {
  await db.connectDB();
  console.log('Seeding Qalidotae database...');

  // 1. Seed Products if empty or < 5
  var productCount = await db.Product.countDocuments();
  if (productCount === 0) {
    console.log('Seeding products...');
    var sampleProducts = [
      {
        name: 'The Royal Emirati Thobe',
        price: 520,
        frontImage: createSampleImage('Royal Emirati - Front', '#151515', '#e2d9c8'),
        backImage: createSampleImage('Royal Emirati - Back', '#181818', '#e2d9c8'),
        type: 'Emirati Thobe',
        gender: 'men',
        archive: false,
        isAvailable: true,
        availableColours: ['Ivory', 'Pure White', 'Charcoal', 'Sand'],
        totalStock: 35,
        availableSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        description: 'Impeccable drape, hand-knotted tarboosh tassel and breathable Japanese spun fabric.'
      },
      {
        name: 'Al Bahr Hooded Thobe',
        price: 620,
        frontImage: createSampleImage('Al Bahr Hooded - Front', '#101720', '#d4af37'),
        backImage: createSampleImage('Al Bahr Hooded - Back', '#131b26', '#d4af37'),
        type: 'Moroccan Hooded Thobe',
        gender: 'men',
        archive: false,
        isAvailable: true,
        availableColours: ['Deep Navy', 'Obsidian Black', 'Desert Taupe'],
        totalStock: 18,
        availableSizes: ['S', 'M', 'L', 'XL'],
        description: 'Piped lining, hidden side pockets and tailored hood for distinguished presence.'
      },
      {
        name: 'Saudi Classic Cut Thobe',
        price: 480,
        frontImage: createSampleImage('Saudi Classic - Front', '#1e1e1e', '#e2d9c8'),
        backImage: createSampleImage('Saudi Classic - Back', '#222222', '#e2d9c8'),
        type: 'Saudi Thobe',
        gender: 'men',
        archive: false,
        isAvailable: true,
        availableColours: ['Crisp White', 'Cream', 'Slate Grey'],
        totalStock: 42,
        availableSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        description: 'Structured high mandarin collar with bespoke resin buttons.'
      },
      {
        name: 'Noor Silk Velvet Abaya',
        price: 780,
        frontImage: createSampleImage('Noor Silk Abaya - Front', '#0d0d0d', '#d4af37'),
        backImage: createSampleImage('Noor Silk Abaya - Back', '#111111', '#d4af37'),
        type: 'Abaya',
        gender: 'women',
        archive: false,
        isAvailable: true,
        availableColours: ['Onyx Black', 'Emerald Green', 'Royal Plum'],
        totalStock: 22,
        availableSizes: ['S', 'M', 'L', 'XL'],
        description: 'Fluid Italian silk-velvet blend with discreet tonal embroidery.'
      },
      {
        name: 'Sultana Embroidered Jalabiya',
        price: 650,
        frontImage: createSampleImage('Sultana Jalabiya - Front', '#211812', '#e8d8b8'),
        backImage: createSampleImage('Sultana Jalabiya - Back', '#271c15', '#e8d8b8'),
        type: 'Jalabiya',
        gender: 'women',
        archive: false,
        isAvailable: true,
        availableColours: ['Dusty Rose', 'Sand Dune', 'Gold Ochre'],
        totalStock: 15,
        availableSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        description: 'Artisanal neckline threading inspired by traditional Levantine craftsmanship.'
      },
      {
        name: 'The Linen Evening Thobe',
        price: 560,
        frontImage: createSampleImage('Linen Evening - Front', '#181b1f', '#dcdad5'),
        backImage: createSampleImage('Linen Evening - Back', '#1c2025', '#dcdad5'),
        type: 'Emirati Thobe',
        gender: 'men',
        archive: false,
        isAvailable: true,
        availableColours: ['Midnight Blue', 'Olive Ash', 'Stone Grey'],
        totalStock: 12,
        availableSizes: ['S', 'M', 'L', 'XL'],
        description: '100% Normandy linen tailored for breathability and effortless grace.'
      },
      {
        name: 'Layla French Silk Kaftan',
        price: 890,
        frontImage: createSampleImage('Layla Kaftan - Front', '#1a1410', '#d4af37'),
        backImage: createSampleImage('Layla Kaftan - Back', '#201814', '#d4af37'),
        type: 'Kaftan',
        gender: 'women',
        archive: false,
        isAvailable: true,
        availableColours: ['Pearl White', 'Champagne Gold', 'Sapphire'],
        totalStock: 8,
        availableSizes: ['S', 'M', 'L', 'XL'],
        description: 'Flowing silhouette with gold metallic thread accents and silk lining.'
      },
      {
        name: 'Monogram Heritage Nightwear',
        price: 340,
        frontImage: createSampleImage('Heritage Nightwear - Front', '#171717', '#e2d9c8'),
        backImage: createSampleImage('Heritage Nightwear - Back', '#1b1b1b', '#e2d9c8'),
        type: 'Arabic Nightwear',
        gender: 'men',
        archive: false,
        isAvailable: true,
        availableColours: ['Ice Blue', 'Warm Sand', 'Slate'],
        totalStock: 25,
        availableSizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
        description: 'Ultra-soft pima cotton lounging set designed for total relaxation.'
      },
      {
        name: 'Vintage Omani Tasseled Thobe (Archived Edition)',
        price: 610,
        frontImage: createSampleImage('Omani Vintage - Front', '#221919', '#baa'),
        backImage: createSampleImage('Omani Vintage - Back', '#261c1c', '#baa'),
        type: 'Omani Thobe',
        gender: 'men',
        archive: true,
        isAvailable: false,
        availableColours: ['Warm Taupe', 'Charcoal'],
        totalStock: 0,
        availableSizes: ['M', 'L', 'XL'],
        description: 'Archived limited edition seasonal run.'
      },
      {
        name: 'Zahra Floral Embroidered Abaya',
        price: 720,
        frontImage: createSampleImage('Zahra Abaya - Front', '#121216', '#d4af37'),
        backImage: createSampleImage('Zahra Abaya - Back', '#17171d', '#d4af37'),
        type: 'Abaya',
        gender: 'women',
        archive: false,
        isAvailable: true,
        availableColours: ['Onyx', 'Dark Maroon'],
        totalStock: 14,
        availableSizes: ['S', 'M', 'L', 'XL', 'XXL'],
        description: 'Hand-sewn micro-sequin florals along sleeve cuffs and hemline.'
      }
    ];

    await db.Product.insertMany(sampleProducts);
    console.log('✅ Seeded 10 Products in PRODUCTS');
  }

  // 2. Seed Users in USERSDETALIS
  var userCount = await db.User.countDocuments();
  if (userCount === 0) {
    console.log('Seeding users in USERSDETALIS...');
    var sampleUsers = [
      {
        fullName: 'Sheikh Tariq Al Nuaimi',
        password: 'UserPass@2026',
        gender: 'male',
        email: 'tariq.nuaimi@example.ae',
        phoneNumber: '+971 50 882 1934',
        whatsappNumber: '+971 50 882 1934',
        housename: 'Villa 14, Palm Views',
        place: 'Palm Jumeirah',
        landmark: 'Near Nakheel Mall',
        city: 'Dubai',
        country: 'UAE',
        postalCode: '11223'
      },
      {
        fullName: 'Fatima Zahra Al Mansoori',
        password: 'FatimaSecure#99',
        gender: 'female',
        email: 'fatima.mansoori@example.com',
        phoneNumber: '+971 52 443 8812',
        whatsappNumber: '+971 52 443 8812',
        housename: 'Penthouse 4B, Al Bateen Tower',
        place: 'Al Bateen Marina',
        landmark: 'Behind InterContinental',
        city: 'Abu Dhabi',
        country: 'UAE',
        postalCode: '33441'
      },
      {
        fullName: 'Mohammed Rashid Al Maktoum',
        password: 'RashidSecret@2026',
        gender: 'male',
        email: 'mohammed.rashid@example.ae',
        phoneNumber: '+971 55 991 3320',
        whatsappNumber: '+971 55 991 3320',
        housename: 'Al Wasl Residence #12',
        place: 'Jumeirah 1',
        landmark: 'Opposite City Walk',
        city: 'Dubai',
        country: 'UAE',
        postalCode: '22110'
      },
      {
        fullName: 'Maryam Sultan Al Qasimi',
        password: 'MaryamPass$44',
        gender: 'female',
        email: 'maryam.qasimi@example.com',
        phoneNumber: '+971 56 123 9988',
        whatsappNumber: '+971 56 123 9988',
        housename: 'Villa 8, Cultural Square',
        place: 'Al Majaz',
        landmark: 'Near Al Noor Mosque',
        city: 'Sharjah',
        country: 'UAE',
        postalCode: '44550'
      },
      {
        fullName: 'Hamad Bin Khalid Al Thani',
        password: 'HamadQatar#2026',
        gender: 'male',
        email: 'hamad.thani@example.qa',
        phoneNumber: '+974 33 892 111',
        whatsappNumber: '+974 33 892 111',
        housename: 'Tower 3, The Pearl',
        place: 'Porto Arabia',
        landmark: 'Marina Gate 5',
        city: 'Doha',
        country: 'Qatar',
        postalCode: '99001'
      },
      {
        fullName: 'Aisha Omar Al Ghamdi',
        password: 'AishaSaudi$88',
        gender: 'female',
        email: 'aisha.ghamdi@example.sa',
        phoneNumber: '+966 50 112 4455',
        whatsappNumber: '+966 50 112 4455',
        housename: 'Al Andalus Villa 22',
        place: 'Al Andalus District',
        landmark: 'Near Tahlia St',
        city: 'Jeddah',
        country: 'Saudi Arabia',
        postalCode: '21432'
      },
      {
        fullName: 'Abdullah Fahad Al Sabah',
        password: 'AbdullahKuwait@12',
        gender: 'male',
        email: 'abdullah.sabah@example.kw',
        phoneNumber: '+965 99 881 223',
        whatsappNumber: '+965 99 881 223',
        housename: 'Seafront Villa 5',
        place: 'Salmiya',
        landmark: 'Near Marina Mall',
        city: 'Kuwait City',
        country: 'Kuwait',
        postalCode: '22001'
      },
      {
        fullName: 'Noura Salem Al Habtoor',
        password: 'NouraHabtoor!77',
        gender: 'female',
        email: 'noura.habtoor@example.com',
        phoneNumber: '+971 50 771 5566',
        whatsappNumber: '+971 50 771 5566',
        housename: 'Emirates Hills Sector E',
        place: 'Emirates Hills',
        landmark: 'Montgomerie Golf Club',
        city: 'Dubai',
        country: 'UAE',
        postalCode: '11990'
      },
      {
        fullName: 'Zayd Ibrahim Al Balushi',
        password: 'ZaydOman#2026',
        gender: 'male',
        email: 'zayd.balushi@example.om',
        phoneNumber: '+968 91 223 445',
        whatsappNumber: '+968 91 223 445',
        housename: 'Villa 101, Beach Road',
        place: 'Shatti Al Qurum',
        landmark: 'Near Grand Hyatt',
        city: 'Muscat',
        country: 'Oman',
        postalCode: '114'
      },
      {
        fullName: 'Reem Khalid Al Khalifa',
        password: 'ReemBahrain#55',
        gender: 'female',
        email: 'reem.khalifa@example.bh',
        phoneNumber: '+973 39 882 114',
        whatsappNumber: '+973 39 882 114',
        housename: 'Amwaj Lagoon Residence 7',
        place: 'Amwaj Islands',
        landmark: 'Lagoon Gate 2',
        city: 'Manama',
        country: 'Bahrain',
        postalCode: '5561'
      },
      {
        fullName: 'Yousef Adel Al Otaiba',
        password: 'YousefPass@2026',
        gender: 'male',
        email: 'yousef.otaiba@example.ae',
        phoneNumber: '+971 50 334 5511',
        whatsappNumber: '+971 50 334 5511',
        housename: 'Saadiyat Beach Villa 19',
        place: 'Saadiyat Island',
        landmark: 'Near Louvre Abu Dhabi',
        city: 'Abu Dhabi',
        country: 'UAE',
        postalCode: '33201'
      },
      {
        fullName: 'Hessa Mohammed Al Marzouqi',
        password: 'HessaSecret$33',
        gender: 'female',
        email: 'hessa.marzouqi@example.com',
        phoneNumber: '+971 55 667 8899',
        whatsappNumber: '+971 55 667 8899',
        housename: 'Mirdif Hills Villa 4',
        place: 'Mirdif',
        landmark: 'Opposite Mushrif Park',
        city: 'Dubai',
        country: 'UAE',
        postalCode: '12450'
      }
    ];

    await db.User.insertMany(sampleUsers);
    console.log('✅ Seeded 12 Users in USERSDETALIS');
  }

  // 3. Seed Orders in ORDERS_DETAILS referencing USERSDETALIS and PRODUCTS
  var orderCount = await db.Order.countDocuments();
  if (orderCount === 0) {
    console.log('Seeding orders in ORDERS_DETAILS...');
    var allUsers = await db.User.find();
    var allProducts = await db.Product.find();

    if (allUsers.length > 0 && allProducts.length > 0) {
      var sampleOrders = [
        {
          orderNumber: 'QAL-2026-1001',
          userId: allUsers[0]._id,
          items: [
            { productId: allProducts[0]._id, selectedSize: 'L', quantity: 2, price: allProducts[0].price, color: 'Pure White' },
            { productId: allProducts[1]._id, selectedSize: 'XL', quantity: 1, price: allProducts[1].price, color: 'Obsidian Black' }
          ],
          totalPrice: (allProducts[0].price * 2) + allProducts[1].price,
          status: 'order pending',
          paymentMode: 'Cash On Delivery',
          shippingNotes: 'Deliver to front gate, call on arrival'
        },
        {
          orderNumber: 'QAL-2026-1002',
          userId: allUsers[1]._id,
          items: [
            { productId: allProducts[3]._id, selectedSize: 'M', quantity: 1, price: allProducts[3].price, color: 'Onyx Black' }
          ],
          totalPrice: allProducts[3].price,
          status: 'order confirmed',
          paymentMode: 'Cash On Delivery',
          shippingNotes: 'Gift packaging requested with golden ribbon'
        },
        {
          orderNumber: 'QAL-2026-1003',
          userId: allUsers[2]._id,
          items: [
            { productId: allProducts[1]._id, selectedSize: 'XL', quantity: 1, price: allProducts[1].price, color: 'Deep Navy' }
          ],
          totalPrice: allProducts[1].price,
          status: 'delivery ongoing',
          paymentMode: 'Cash On Delivery',
          shippingNotes: 'Express delivery before 6 PM'
        },
        {
          orderNumber: 'QAL-2026-1004',
          userId: allUsers[3]._id,
          items: [
            { productId: allProducts[4]._id, selectedSize: 'S', quantity: 1, price: allProducts[4].price, color: 'Dusty Rose' },
            { productId: allProducts[4]._id, selectedSize: 'M', quantity: 1, price: allProducts[4].price, color: 'Sand Dune' }
          ],
          totalPrice: allProducts[4].price * 2,
          status: 'delivery success',
          paymentMode: 'Cash On Delivery',
          shippingNotes: 'Delivered to reception'
        },
        {
          orderNumber: 'QAL-2026-1005',
          userId: allUsers[4]._id,
          items: [
            { productId: allProducts[2]._id, selectedSize: 'XXL', quantity: 1, price: allProducts[2].price, color: 'Crisp White' }
          ],
          totalPrice: allProducts[2].price,
          status: 'order rejected',
          rejectionReason: 'Fabric batch temporarily out of stock. Client notified for alternative colorway.',
          paymentMode: 'Cash On Delivery',
          shippingNotes: ''
        },
        {
          orderNumber: 'QAL-2026-1006',
          userId: allUsers[5]._id,
          items: [
            { productId: allProducts[6]._id, selectedSize: 'M', quantity: 1, price: allProducts[6].price, color: 'Pearl White' }
          ],
          totalPrice: allProducts[6].price,
          status: 'order cancelled',
          rejectionReason: 'Cancelled by customer before dispatch.',
          paymentMode: 'Cash On Delivery',
          shippingNotes: ''
        },
        {
          orderNumber: 'QAL-2026-1007',
          userId: allUsers[6]._id,
          items: [
            { productId: allProducts[5]._id, selectedSize: 'L', quantity: 3, price: allProducts[5].price, color: 'Midnight Blue' }
          ],
          totalPrice: allProducts[5].price * 3,
          status: 'order confirmed',
          paymentMode: 'Cash On Delivery',
          shippingNotes: 'Deliver to Kuwait diplomatic bag'
        },
        {
          orderNumber: 'QAL-2026-1008',
          userId: allUsers[7]._id,
          items: [
            { productId: allProducts[7]._id, selectedSize: 'S', quantity: 2, price: allProducts[7].price, color: 'Ice Blue' }
          ],
          totalPrice: allProducts[7].price * 2,
          status: 'delivery ongoing',
          paymentMode: 'Cash On Delivery',
          shippingNotes: 'Leave at security booth'
        },
        {
          orderNumber: 'QAL-2026-1009',
          userId: allUsers[8]._id,
          items: [
            { productId: allProducts[0]._id, selectedSize: 'M', quantity: 1, price: allProducts[0].price, color: 'Charcoal' }
          ],
          totalPrice: allProducts[0].price,
          status: 'delivery success',
          paymentMode: 'Cash On Delivery',
          shippingNotes: ''
        },
        {
          orderNumber: 'QAL-2026-1010',
          userId: allUsers[9]._id,
          items: [
            { productId: allProducts[3]._id, selectedSize: 'L', quantity: 1, price: allProducts[3].price, color: 'Emerald Green' }
          ],
          totalPrice: allProducts[3].price,
          status: 'order pending',
          paymentMode: 'Cash On Delivery',
          shippingNotes: 'Contact via WhatsApp before delivery'
        },
        {
          orderNumber: 'QAL-2026-1011',
          userId: allUsers[10]._id,
          items: [
            { productId: allProducts[1]._id, selectedSize: 'XL', quantity: 1, price: allProducts[1].price, color: 'Desert Taupe' }
          ],
          totalPrice: allProducts[1].price,
          status: 'order pending',
          paymentMode: 'Cash On Delivery',
          shippingNotes: 'Deliver to Saadiyat Villa'
        },
        {
          orderNumber: 'QAL-2026-1012',
          userId: allUsers[11]._id,
          items: [
            { productId: allProducts[4]._id, selectedSize: 'M', quantity: 1, price: allProducts[4].price, color: 'Gold Ochre' }
          ],
          totalPrice: allProducts[4].price,
          status: 'delivery success',
          paymentMode: 'Cash On Delivery',
          shippingNotes: 'VIP packaging'
        }
      ];

      await db.Order.insertMany(sampleOrders);
      console.log('✅ Seeded 12 Orders in ORDERS_DETAILS');
    }
  }

  // 4. Seed QR Code in PAYMENT_SETUP if empty
  var paymentSetup = await db.PaymentSetup.findOne();
  if (paymentSetup && !paymentSetup.qrCodeImage) {
    paymentSetup.qrCodeImage = createSampleImage('PAYMENT QR CODE', '#000000', '#d4af37');
    await paymentSetup.save();
    console.log('✅ Updated QR code image in PAYMENT_SETUP');
  }

  console.log('🎉 Database seeding complete!');
  process.exit(0);
}

seed().catch(function (err) {
  console.error('❌ Seeding error:', err);
  process.exit(1);
});
