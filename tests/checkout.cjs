const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const { buildPreference } = await import('data:text/javascript;base64,' + fs.readFileSync('backend/checkout.js').toString('base64'));
  const order = { id: 'order-123', status: 'created', currency: 'ARS', amountMinor: 125050 };
  const base = 'https://example.test/app';
  const webhook = 'https://api.example.test/api/webhooks/mercadopago';
  const result = buildPreference(order, base, webhook);
  assert.equal(result.external_reference, order.id);
  assert.equal(result.items[0].unit_price, 1250.5);
  assert.equal(result.items[0].currency_id, 'ARS');
  assert.equal(result.notification_url, webhook);
  for (const status of ['success', 'pending', 'failure']) {
    assert.equal(new URL(result.back_urls[status]).searchParams.get('checkout'), status);
  }
  for (const invalid of [{status:'approved'}, {amountMinor:0}, {currency:'USD'}, {id:'../bad'}]) {
    assert.throws(() => buildPreference({...order,...invalid},base,webhook), /invalid_order/);
  }
  assert.throws(() => buildPreference(order,'http://example.test',webhook), /invalid_https_url/);
  console.log('Checkout preference checks passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
