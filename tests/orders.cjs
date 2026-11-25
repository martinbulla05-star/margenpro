const assert = require('node:assert/strict');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');
(async () => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  const { createOrder } = await import('data:text/javascript;base64,' +
    fs.readFileSync('backend/orders.js').toString('base64'));
  const writes = [];
  const db = { prepare(sql) { return { bind(...args) { return {
    async first() { assert.deepEqual(args, ['margenpro']); return { id: 'margenpro-core' }; },
    async run() { writes.push({ sql, args }); return { success: true }; }
  }; } }; } };
  for (const amount of [0, -1, 1.5, NaN, Infinity, '100']) {
    await assert.rejects(createOrder(db, 'verified-user', amount), /invalid_server_price/);
  }
  await assert.rejects(createOrder(db, '', 100), /verified_user_required/);
  await assert.rejects(createOrder(db, 'verified-user', 100, 'USD'), /invalid_server_price/);
  assert.equal(writes.length, 0);
  const order = await createOrder(db, 'verified-user', 125000);
  assert.equal(order.status, 'created');
  assert.equal(order.amountMinor, 125000);
  assert.equal(order.currency, 'ARS');
  assert.deepEqual(writes[0].args, [order.id, 'verified-user', 'margenpro-core', 125000, 'ARS']);
  assert.match(writes[0].sql, /'mercadopago'/);
  console.log('Commercial order creation checks passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
