const fs = require('node:fs');
const assert = require('node:assert/strict');
const asUrl = path => 'data:text/javascript;base64,' + fs.readFileSync(path).toString('base64');
(async () => {
  let source = fs.readFileSync('backend/worker.js', 'utf8');
  source = source.replace("'./auth.js'", JSON.stringify(asUrl('backend/auth.js')))
    .replace("'./entitlements.js'", JSON.stringify(asUrl('backend/entitlements.js')));
  const worker = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).default;
  const health = await worker.fetch(new Request('https://example.test/api/health'), {});
  assert.equal(health.status, 200);
  assert.equal((await health.json()).paymentsEnabled, false);
  const checkout = await worker.fetch(new Request('https://example.test/api/checkout', { method: 'POST' }), {});
  assert.equal(checkout.status, 503, 'Checkout must fail closed without secure configuration');
  const access = await worker.fetch(new Request('https://example.test/api/entitlement'), {});
  assert.equal(access.status, 503, 'License lookup must fail closed without auth and DB configuration');
  const configured = { DB: { prepare() { throw Error('Database must not be queried without auth'); } },
    AUTH_ISSUER: 'https://identity.example/', AUTH_AUDIENCE: 'margenpro',
    AUTH_JWKS_URL: 'https://identity.example/keys' };
  const placeholder = await worker.fetch(new Request('https://example.test/api/entitlement',
    { headers: { authorization: 'Bearer fake.token' } }),
    { ...configured, AUTH_AUDIENCE: 'REPLACE-WITH-API-AUDIENCE' });
  assert.equal(placeholder.status, 503, 'Example configuration must not enable authenticated endpoints');
  const noAuth = await worker.fetch(new Request('https://example.test/api/entitlement'), configured);
  assert.equal(noAuth.status, 401);
  const forged = await worker.fetch(new Request('https://example.test/api/entitlement',
    { headers: { 'x-user-id': 'admin', 'x-license': 'active' } }), configured);
  assert.equal(forged.status, 401, 'Forged client headers must not grant access');
  const invalid = await worker.fetch(new Request('https://example.test/api/entitlement',
    { headers: { authorization: 'Bearer not.a.real.token' } }), configured);
  assert.equal(invalid.status, 401, 'Unsigned tokens must be rejected');
  assert.equal(Object.fromEntries(checkout.headers)['cache-control'], 'no-store');
  const corsEnv = { ...configured, FRONTEND_ORIGIN: 'https://martinbulla05-star.github.io' };
  const preflight = await worker.fetch(new Request('https://example.test/api/entitlement', {
    method: 'OPTIONS',
    headers: { origin: corsEnv.FRONTEND_ORIGIN, 'access-control-request-method': 'GET',
      'access-control-request-headers': 'authorization' }
  }), corsEnv);
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), corsEnv.FRONTEND_ORIGIN);
  const rejectedOrigin = await worker.fetch(new Request('https://example.test/api/entitlement', {
    method: 'OPTIONS',
    headers: { origin: 'https://untrusted.example', 'access-control-request-method': 'GET' }
  }), corsEnv);
  assert.equal(rejectedOrigin.status, 403);
  assert.equal(rejectedOrigin.headers.get('access-control-allow-origin'), null);
  const noWildcard = await worker.fetch(new Request('https://example.test/api/health', {
    headers: { origin: 'https://untrusted.example' }
  }), corsEnv);
  assert.equal(noWildcard.headers.get('access-control-allow-origin'), null);
  console.log('Commercial API safety checks passed.');
})().catch(e => { console.error(e); process.exitCode = 1; });
