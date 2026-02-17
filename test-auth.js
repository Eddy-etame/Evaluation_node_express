/**
 * Test des routes auth.
 * Lancer : node test-auth.js
 * Prérequis : auth-service et data-service doivent tourner.
 */

const crypto = require('crypto');

const BASE = 'http://localhost:3000';

async function run() {
  console.log('1. Login...');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  const { token } = await loginRes.json();
  if (!token) {
    console.error('Login failed');
    return;
  }
  console.log('   Token:', token.slice(0, 50) + '...');

  console.log('2. Calcul nonce (PoW)...');
  let nonce = 0;
  while (true) {
    const hash = crypto.createHash('sha256').update(token + nonce).digest('hex');
    if (hash.startsWith('0000')) break;
    nonce++;
  }
  console.log('   Nonce:', nonce);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'X-POW-Nonce': String(nonce)
  };

  console.log('3. GET /protected...');
  const protRes = await fetch(`${BASE}/protected`, { headers });
  console.log('   Status:', protRes.status, await protRes.json());

  console.log('4. GET /secure-data...');
  const secRes = await fetch(`${BASE}/secure-data`, { headers });
  console.log('   Status:', secRes.status, await secRes.json());

  console.log('5. POST /auth/rotate...');
  const rotRes = await fetch(`${BASE}/auth/rotate`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' }
  });
  const rotData = await rotRes.json();
  console.log('   Status:', rotRes.status, rotData);

  if (rotRes.ok && rotData.token) {
    console.log('6. Ancien token révoqué ? (doit être 401)...');
    const revokeRes = await fetch(`${BASE}/protected`, { headers });
    console.log('   Status:', revokeRes.status, await revokeRes.json());
  }

  console.log('\nDone.');
}

run().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
