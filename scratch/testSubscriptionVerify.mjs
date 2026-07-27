import '../config/env.mjs';
import mongoose from 'mongoose';
import User from '../models/User.mjs';
import Organization from '../models/Organization.mjs';
import jwt from 'jsonwebtoken';
import http from 'http';

async function testSubVerify() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const user = await User.findOne({ email: 'velmurugan61682@gmail.com' }).lean();
  const token = jwt.sign(
    { id: user._id.toString(), email: user.email, role: 'client', organizationId: user.organizationId ? user.organizationId.toString() : null },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const req = http.request(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/subscription/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    },
    (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log('Verify API Status:', res.statusCode);
        console.log('Verify API Response:', body);
      });
    }
  );

  req.write(JSON.stringify({
    planType: 'three_months_999',
    razorpay_payment_id: 'pay_test_simulated_' + Date.now(),
    razorpay_order_id: 'order_test_simulated_' + Date.now()
  }));
  req.end();
}

testSubVerify().catch(console.error);
