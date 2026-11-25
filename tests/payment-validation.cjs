const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const { validateApprovedPayment } = await import('data:text/javascript;base64,' +
    fs.readFileSync('backend/payment-validation.js').toString('base64'));
  const order = { id:'order-123', status:'pending', amountMinor:125050, currency:'ARS' };
  const payment = { id:12345, status:'approved', external_reference:order.id,
    transaction_amount:1250.5, currency_id:'ARS', collector_id:98765 };
  const verified = validateApprovedPayment(payment,order,'98765');
  assert.deepEqual(verified,{provider:'mercadopago',providerPaymentId:'12345',orderId:'order-123',
    amountMinor:125050,currency:'ARS',status:'approved'});
  for (const change of [{status:'pending'},{status:'refunded'},{external_reference:'another-order'},
    {currency_id:'USD'},{collector_id:1},{transaction_amount:1250.49},{transaction_amount:1250.501},
    {id:'invalid'},{id:9007199254740992}]) {
    assert.throws(() => validateApprovedPayment({...payment,...change},order,'98765'));
  }
  assert.throws(() => validateApprovedPayment(payment,{...order,status:'refunded'},'98765'),/invalid_order/);
  assert.throws(() => validateApprovedPayment(payment,order,''),/collector_not_configured/);
  console.log('Provider payment validation checks passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
