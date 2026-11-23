const assert = require('node:assert/strict');
const fs = require('node:fs');
const { generateKeyPairSync, sign, webcrypto } = require('node:crypto');
const dataUrl = file => 'data:text/javascript;base64,' + fs.readFileSync(file).toString('base64');
(async () => {
  const source = fs.readFileSync('backend/worker.js', 'utf8')
    .replace("'./auth.js'", JSON.stringify(dataUrl('backend/auth.js')))
    .replace("'./entitlements.js'", JSON.stringify(dataUrl('backend/entitlements.js')));
  const worker = (await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))).default;
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test', use: 'sig', alg: 'RS256' };
  const originalFetch = globalThis.fetch;
  const originalCrypto = globalThis.crypto;
  globalThis.fetch = async url => {
    assert.equal(url, 'https://identity.example/keys');
    return { ok: true, json: async () => ({ keys: [jwk] }) };
  };
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const token = (sub = 'subject-1') => {
    const h = encode({ alg: 'RS256', kid: 'test', typ: 'JWT' });
    const p = encode({ iss: 'https://identity.example/', aud: 'margenpro-api',
      sub, iat: Math.floor(Date.now() / 1000) - 30, exp: Math.floor(Date.now() / 1000) + 3600 });
    return h + '.' + p + '.' + sign('RSA-SHA256', Buffer.from(h + '.' + p), privateKey).toString('base64url');
  };
  const accounts = new Map();
  const queries = [];
  const env = {
    AUTH_ISSUER: 'https://identity.example/', AUTH_AUDIENCE: 'margenpro-api',
    AUTH_JWKS_URL: 'https://identity.example/keys',
    DB: { prepare(sql) {
      return { bind(...args) {
        queries.push({ sql, args });
        return {
          async run() {
            if (!sql.includes('INSERT OR IGNORE INTO users')) throw Error('Unexpected write');
            const key = args[1] + ':' + args[2];
            if (!accounts.has(key)) accounts.set(key, args[0]);
            return { success: true };
          },
          async first() {
            if (sql.includes('FROM users')) {
              const key = args[0] + ':' + args[1];
              if (accounts.has(key)) return { id: accounts.get(key) };
              return args[1] === 'subject-1' ? { id: 'internal-user-7' } : null;
            }
            if (sql.includes('FROM entitlements')) return { id: 'license-7', expires_at: null };
            throw Error('Unexpected query');
          }
        };
      } };
    } }
  };
  const check = (bearer, suffix = '') => worker.fetch(new Request('https://example.test/api/entitlement' + suffix,
    { headers: { authorization: 'Bearer ' + bearer, 'x-user-id': 'attacker' } }), env);
  try {
    const active = await check(token());
    assert.equal(active.status, 200);
    const body = await active.json();
    assert.equal(body.active, true);
    assert.equal(body.entitlementId, 'license-7');
    assert.deepEqual(queries[0].args, [env.AUTH_ISSUER, 'subject-1']);
    assert.equal(queries[1].args[0], 'internal-user-7');
    assert.equal(queries[1].args[1], 'margenpro');
    assert.equal((await (await check(token('unknown'))).json()).active, false);
    assert.equal((await check(token(), '?product=../admin')).status, 400);
    const bad = token().split('.');
    bad[1] = encode({ iss: env.AUTH_ISSUER, aud: env.AUTH_AUDIENCE, sub: 'subject-1',
      iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600, admin: true });
    assert.equal((await check(bad.join('.'))).status, 401);
    const registration = await worker.fetch(new Request('https://example.test/api/me',
      { headers: { authorization: 'Bearer ' + token('new-user') } }), env);
    assert.equal(registration.status, 200);
    assert.equal((await registration.json()).registered, true);
    assert.equal(accounts.size, 1);
    const again = await worker.fetch(new Request('https://example.test/api/me',
      { headers: { authorization: 'Bearer ' + token('new-user') } }), env);
    assert.equal(again.status, 200);
    assert.equal(accounts.size, 1, 'Repeat sign-in must not duplicate the account');
    const unsigned = await worker.fetch(new Request('https://example.test/api/me'), env);
    assert.equal(unsigned.status, 401, 'Account creation requires a signed token');
    console.log('Signed token to D1 entitlement integration checks passed.');
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'crypto', { value: originalCrypto, configurable: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
