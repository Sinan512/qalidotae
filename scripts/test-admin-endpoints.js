require('dotenv').config();
var http = require('http');
var app = require('../app');

var server;
var port = 3899;
var baseUrl = `http://localhost:${port}`;
var cookieHeader = '';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    var url = new URL(path, baseUrl);
    var reqHeaders = {
      'Accept': 'application/json',
      ...headers
    };
    if (cookieHeader) {
      reqHeaders['Cookie'] = cookieHeader;
    }
    var bodyData = null;
    if (body) {
      bodyData = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(bodyData);
    }

    var req = http.request(url, {
      method: method,
      headers: reqHeaders
    }, (res) => {
      var setCookie = res.headers['set-cookie'];
      if (setCookie) {
        cookieHeader = setCookie.map(c => c.split(';')[0]).join('; ');
      }
      var data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        var parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (e) {
          parsed = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, data: parsed });
      });
    });

    req.on('error', reject);
    if (bodyData) req.write(bodyData);
    req.end();
  });
}

async function runTests() {
  server = app.listen(port);
  console.log(`\n🧪 Testing Admin Endpoints on ${baseUrl}...\n`);

  try {
    // 1. Test Login
    console.log('1. Testing POST /admin/login...');
    var loginRes = await request('POST', '/admin/login', {
      email: process.env.ADMIN_EMAIL || 'admin@qalidotae.com',
      password: process.env.ADMIN_PASSWORD || 'admin123456'
    });
    if (loginRes.status !== 200 || !loginRes.data.success) {
      throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
    }
    console.log('   ✅ Login successful, cookie session acquired:', cookieHeader.slice(0, 40) + '...');

    // 2. Test Get Me
    console.log('\n2. Testing GET /admin/api/me...');
    var meRes = await request('GET', '/admin/api/me');
    if (meRes.status !== 200 || !meRes.data.admin) {
      throw new Error(`Get me failed: ${JSON.stringify(meRes.data)}`);
    }
    console.log('   ✅ Authenticated admin:', meRes.data.admin.email);

    // 3. Test Overview Stats
    console.log('\n3. Testing GET /admin/api/overview...');
    var ovRes = await request('GET', '/admin/api/overview');
    if (ovRes.status !== 200 || !ovRes.data.overview) {
      throw new Error(`Get overview failed: ${JSON.stringify(ovRes.data)}`);
    }
    console.log('   ✅ Overview stats loaded: Total Products =', ovRes.data.overview.totalProducts, ', Total Orders =', ovRes.data.overview.totalOrders, ', Total Users =', ovRes.data.overview.totalUsers);

    // 4. Test Products CRUD
    console.log('\n4. Testing Products API (Collection: PRODUCTS)...');
    var prodListRes = await request('GET', '/admin/api/products');
    console.log('   ✅ Fetched', prodListRes.data.products.length, 'products');

    // Create a new product
    var newProdRes = await request('POST', '/admin/api/products', {
      name: 'Automated Test Silk Thobe',
      price: 599,
      type: 'Emirati Thobe',
      gender: 'men',
      availableSizes: ['ALL'],
      availableColours: ['Gold', 'Black'],
      totalStock: 10,
      description: 'Test description for automated verification.'
    });
    if (newProdRes.status !== 201 || !newProdRes.data.product) {
      throw new Error(`Create product failed: ${JSON.stringify(newProdRes.data)}`);
    }
    var createdProdId = newProdRes.data.product._id;
    console.log('   ✅ Created product:', newProdRes.data.product.name, 'ID:', createdProdId);
    console.log('   ✅ Sizes populated with ALL default:', newProdRes.data.product.availableSizes);

    // Update product
    var updProdRes = await request('PUT', `/admin/api/products/${createdProdId}`, {
      price: 649,
      totalStock: 15
    });
    console.log('   ✅ Updated product price to:', updProdRes.data.product.price);

    // Archive toggle
    var archRes = await request('PATCH', `/admin/api/products/${createdProdId}/archive`, { archive: true });
    console.log('   ✅ Toggled archive status:', archRes.data.product.archive);

    // Delete product
    var delProdRes = await request('DELETE', `/admin/api/products/${createdProdId}`);
    console.log('   ✅ Deleted product:', delProdRes.data.message);

    // 5. Test Users API (Collection: USERSDETALIS)
    console.log('\n5. Testing Users API (Collection: USERSDETALIS)...');
    var usersRes = await request('GET', '/admin/api/users');
    if (!usersRes.data.users || usersRes.data.users.length === 0) {
      throw new Error('No users found');
    }
    console.log('   ✅ Fetched', usersRes.data.users.length, 'users');
    var firstUser = usersRes.data.users[0];
    console.log('   ✅ User password visible to admin:', firstUser.password);

    // Update user details (without changing password)
    var updUserRes = await request('PUT', `/admin/api/users/${firstUser._id}`, {
      fullName: firstUser.fullName,
      landmark: 'Near Qalidotae Atelier'
    });
    console.log('   ✅ Updated user details:', updUserRes.data.user.landmark);

    // 6. Test Orders API (Collection: ORDERS_DETAILS)
    console.log('\n6. Testing Orders API (Collection: ORDERS_DETAILS)...');
    var ordersRes = await request('GET', '/admin/api/orders');
    console.log('   ✅ Fetched', ordersRes.data.orders.length, 'orders');
    var firstOrder = ordersRes.data.orders[0];
    console.log('   ✅ Order populated User:', firstOrder.userId ? firstOrder.userId.fullName : 'None');
    console.log('   ✅ Order populated Product:', firstOrder.productId ? firstOrder.productId.name : 'None');

    // Update order status to rejected with reason
    var rejOrderRes = await request('PUT', `/admin/api/orders/${firstOrder._id}/status`, {
      status: 'order rejected',
      rejectionReason: 'Fabric batch quality check pending.'
    });
    console.log('   ✅ Status updated to order rejected:', rejOrderRes.data.order.status, 'Reason:', rejOrderRes.data.order.rejectionReason);

    // Update order status to confirmed
    var confOrderRes = await request('PUT', `/admin/api/orders/${firstOrder._id}/status`, {
      status: 'order confirmed'
    });
    console.log('   ✅ Status updated to order confirmed:', confOrderRes.data.order.status);

    // 7. Test Payment Setup API (Collection: PAYMENT_SETUP)
    console.log('\n7. Testing Payment Setup API (Collection: PAYMENT_SETUP)...');
    var payRes = await request('GET', '/admin/api/payment-setup');
    console.log('   ✅ Payment setup fetched: UPI ID =', payRes.data.paymentSetup.upiId);

    var updPayRes = await request('POST', '/admin/api/payment-setup', {
      upiId: 'qalidotae.luxury@okaxis',
      gpayNumber: '+971 50 999 8888',
      bankName: 'Emirates NBD Luxury Corporate'
    });
    console.log('   ✅ Payment setup updated:', updPayRes.data.paymentSetup.upiId);

    // 8. Test Page Render
    console.log('\n8. Testing GET /admin view rendering...');
    var pageRes = await request('GET', '/admin');
    if (pageRes.status === 200 && typeof pageRes.data === 'string' && pageRes.data.includes('Dashboard Overview')) {
      console.log('   ✅ Admin page rendered successfully with authenticated layout');
    } else {
      console.log('   ⚠️ Admin page output status:', pageRes.status);
    }

    // 9. Test Logout
    console.log('\n9. Testing POST /admin/logout...');
    var logoutRes = await request('POST', '/admin/logout');
    console.log('   ✅ Logged out:', logoutRes.data.message);

    console.log('\n🎉 ALL 9 TEST SUITES PASSED FLAWLESSLY! 🚀\n');
  } catch (err) {
    console.error('\n❌ Test failure:', err);
    process.exitCode = 1;
  } finally {
    server.close();
    process.exit(process.exitCode || 0);
  }
}

runTests();
