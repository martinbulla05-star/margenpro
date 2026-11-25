const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const { fetchPayment } = await import('data:text/javascript;base64,' +
    fs.readFileSync('backend/mercadopago.js').toString('base64'));
  let calls = 0;
  const mock = async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.mercadopago.com/v1/payments/12345');
    assert.equal(options.headers.authorization, 'Bearer test-secret');
    assert.equal(options.redirect, 'error');
    assert.equal(options.method, 'GET');
    return { ok:true, json:async()=>({id:12345,status:'approved'}) };
  };
  await assert.rejects(fetchPayment('../bad','test-secret',mock), /invalid_payment_id/);
  await assert.rejects(fetchPayment('12345','REPLACE-TOKEN',mock), /payment_api_not_configured/);
  assert.equal(calls,0);
  assert.equal((await fetchPayment('12345','test-secret',mock)).status,'approved');
  await assert.rejects(fetchPayment('12345','test-secret',async()=>({ok:false})), /payment_api_unavailable/);
  await assert.rejects(fetchPayment('12345','test-secret',async()=>({ok:true,json:async()=>({id:999})})), /payment_id_mismatch/);
  console.log('Mercado Pago API adapter checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
