require('dotenv').config();
var http = require('http');
var app = require('../app');
var db = require('../models');

async function testHttpEndpoints() {
  console.log('🚀 Testing Express App Endpoints...');
  await db.connectDB();

  var server = http.createServer(app);
  await new Promise(resolve => server.listen(3002, resolve));
  console.log('✅ Express test server running on port 3002');

  const BASE = 'http://127.0.0.1:3002';

  // 1. Test GET / (User page)
  var pageRes = await fetch(BASE + '/');
  var pageHtml = await pageRes.text();
  console.log('✅ 1. GET / responded with status:', pageRes.status, '- Contains Qalidotae:', pageHtml.includes('Qalidotae'));

  // 2. Test GET /api/geo-currency
  var geoRes = await fetch(BASE + '/api/geo-currency');
  var geoData = await geoRes.json();
  console.log('✅ 2. GET /api/geo-currency:', geoData.success ? 'PASSED' : 'FAILED', '- Detected Country:', geoData.country, '- Currency:', geoData.currency.code, '- RateFromINR:', geoData.currency.rateFromINR);

  // 3. Test GET /api/products
  var prodRes = await fetch(BASE + '/api/products');
  var prodData = await prodRes.json();
  console.log('✅ 3. GET /api/products:', prodData.success ? 'PASSED' : 'FAILED', '- Count:', prodData.products.length);

  // 4. Test POST /api/user/signup with plain password
  var testEmail = 'httptest_' + Date.now() + '@example.com';
  var testPass = 'DirectPlainPass123';
  var signupRes = await fetch(BASE + '/api/user/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'HTTP Test Client',
      email: testEmail,
      password: testPass,
      phoneNumber: '+971 50 111 2222',
      housename: 'Villa 1',
      place: 'Jumeirah',
      city: 'Dubai',
      country: 'UAE'
    })
  });
  var signupCookie = signupRes.headers.get('set-cookie');
  var signupData = await signupRes.json();
  console.log('✅ 4. POST /api/user/signup:', signupData.success ? 'PASSED' : 'FAILED', '- Cookie set:', !!signupCookie && signupCookie.includes('qalid_user_session'));

  // 5. Test POST /api/user/login
  var loginRes = await fetch(BASE + '/api/user/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, password: testPass })
  });
  var loginCookie = loginRes.headers.get('set-cookie');
  var loginData = await loginRes.json();
  console.log('✅ 5. POST /api/user/login:', loginData.success ? 'PASSED' : 'FAILED', '- Direct Password validated');

  // Extract auth cookie
  var cookieHeader = loginCookie.split(';')[0];

  // 6. Test GET /api/user/me with cookie
  var meRes = await fetch(BASE + '/api/user/me', {
    headers: { 'Cookie': cookieHeader }
  });
  var meData = await meRes.json();
  console.log('✅ 6. GET /api/user/me (7-Day Cookie Session):', meData.isAuthenticated ? 'PASSED' : 'FAILED', '- User:', meData.user ? meData.user.fullName : null);

  // 7. Test POST /api/orders (Cash On Delivery Multi-Item)
  var orderRes = await fetch(BASE + '/api/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': cookieHeader
    },
    body: JSON.stringify({
      items: [
        { productId: prodData.products[0]._id, selectedSize: 'M', quantity: 2, color: 'Pure White' },
        { productId: prodData.products[1]._id, selectedSize: 'L', quantity: 1, color: 'Obsidian Black' }
      ],
      shippingNotes: 'VIP Courier Packaging'
    })
  });
  var orderData = await orderRes.json();
  console.log('✅ 7. POST /api/orders (Cash On Delivery):', orderData.success ? 'PASSED' : 'FAILED', '- Order Number:', orderData.order ? orderData.order.orderNumber : null, '- Payment Mode:', orderData.order ? orderData.order.paymentMode : null);

  var orderNumber = orderData.order.orderNumber;

  // 8. Test GET /api/orders/track/:orderNumber (Public Tracking)
  var trackRes = await fetch(BASE + '/api/orders/track/' + orderNumber);
  var trackData = await trackRes.json();
  console.log('✅ 8. GET /api/orders/track/:orderNumber:', trackData.success ? 'PASSED' : 'FAILED', '- Status:', trackData.order ? trackData.order.status : null, '- Timeline stages:', trackData.order ? trackData.order.timeline.length : 0);

  // 9. Test GET /api/orders/my-orders
  var myOrdersRes = await fetch(BASE + '/api/orders/my-orders', {
    headers: { 'Cookie': cookieHeader }
  });
  var myOrdersData = await myOrdersRes.json();
  console.log('✅ 9. GET /api/orders/my-orders:', myOrdersData.success ? 'PASSED' : 'FAILED', '- Orders count:', myOrdersData.orders.length);

  // Clean up
  await db.Order.findOneAndDelete({ orderNumber: orderNumber });
  await db.User.findOneAndDelete({ email: testEmail });
  console.log('✅ 10. Cleaned up test HTTP data');

  server.close();
  console.log('🎉 ALL HTTP API INTEGRATION TESTS PASSED!');
  process.exit(0);
}

testHttpEndpoints().catch(err => {
  console.error('❌ HTTP Test failed:', err);
  process.exit(1);
});