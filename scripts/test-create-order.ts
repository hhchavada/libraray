/**
 * Test POST /subscription/create-order
 * Usage: npx ts-node scripts/test-create-order.ts [email] [password] [planId]
 */
import 'dotenv/config';

const BASE = process.env.APP_BASE_URL?.replace(/\/$/, '') || 'http://localhost:5000';
const API = `${BASE}/api/v1`;

const email = process.argv[2] || 'admin@library.com';
const password = process.argv[3] || 'Admin@12345';
const planId = process.argv[4] || '6a329c44effd09b4a72cf638'; // ₹1 test plan

async function main() {
  console.log('API:', API);
  console.log('Login:', email);

  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const loginJson = (await loginRes.json()) as { data?: { accessToken?: string }; message?: string };
  if (!loginRes.ok) {
    console.error('Login failed:', loginRes.status, loginJson);
    process.exit(1);
  }
  const token = loginJson.data?.accessToken;
  console.log('Login OK');

  const orderRes = await fetch(`${API}/subscription/create-order`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ planId, confirmReplace: true }),
  });
  const orderJson = await orderRes.json();
  console.log('create-order status:', orderRes.status);
  console.log(JSON.stringify(orderJson, null, 2));
  process.exit(orderRes.ok ? 0 : 1);
}

main().catch((err) => {
  console.error('Unhandled:', err);
  process.exit(1);
});
