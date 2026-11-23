const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync('backend/worker.js','utf8');
const sandbox = { URL, Response, Request, JSON };
vm.runInNewContext(source.replace('export default','globalThis.worker ='), sandbox);
const worker = sandbox.worker;
(async () => {
  const health = await worker.fetch(new Request('https://example.test/api/health'), {});
  assert.equal(health.status,200);
  assert.equal((await health.json()).paymentsEnabled,false);
  const checkout = await worker.fetch(new Request('https://example.test/api/checkout',{method:'POST'}),{});
  assert.equal(checkout.status,503,'Checkout must fail closed without secure configuration');
  const access = await worker.fetch(new Request('https://example.test/api/entitlement'),{});
  assert.equal(access.status,503,'Licenses must not be granted by default');
  const headers = Object.fromEntries(checkout.headers);
  assert.equal(headers['cache-control'],'no-store');
  console.log('Commercial API safety checks passed.');
})().catch(e => { console.error(e); process.exitCode=1; });
