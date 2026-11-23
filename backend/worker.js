import { verifyAccessToken } from './auth.js';
import { findActiveEntitlement } from './entitlements.js';
// MargenPro commercial API starter — NOT deployed.
// Cloudflare Worker-style fetch handler; no payment processing or entitlement granting yet.
// Environment: AUTH_ISSUER, AUTH_AUDIENCE and a verified identity provider integration are required
// before exposing authenticated routes. Never trust a user ID supplied by a browser.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    };
    const json = (status, payload) => new Response(JSON.stringify(payload), { status, headers });
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json(200, { service: 'margenpro-api', status: 'setup-required', paymentsEnabled: false });
    }
    if ((url.pathname === '/api/entitlement' || url.pathname === '/api/me') && request.method === 'GET' ||
        url.pathname === '/api/register' && request.method === 'POST') {
      // Configuration and database must be provided by the trusted server environment.
      if (!env?.DB || !env.AUTH_ISSUER || !env.AUTH_AUDIENCE || !env.AUTH_JWKS_URL)
        return json(503, { error: 'authentication_not_configured' });
      const authorization = request.headers.get('authorization') || '';
      if (!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization))
        return json(401, { error: 'authentication_required' });
      let identity;
      try {
        identity = await verifyAccessToken(authorization.slice(7), {
          issuer: env.AUTH_ISSUER,
          audience: env.AUTH_AUDIENCE,
          jwksUrl: env.AUTH_JWKS_URL
        });
      } catch {
        return json(401, { error: 'invalid_credentials' });
      }
      if (url.pathname === '/api/register') {
        try {
          // Register only identities verified cryptographically by the trusted issuer.
          // INSERT OR IGNORE handles concurrent first sign-ins without duplicate accounts.
          await env.DB.prepare(
            'INSERT OR IGNORE INTO users(id,identity_provider,identity_subject) VALUES (?1,?2,?3)'
          ).bind(crypto.randomUUID(), identity.issuer, identity.subject).run();
          const user = await env.DB.prepare(
            'SELECT id FROM users WHERE identity_provider = ?1 AND identity_subject = ?2 LIMIT 1'
          ).bind(identity.issuer, identity.subject).first();
          if (!user) throw new Error('account_not_found');
          return json(200, { authenticated: true, registered: true });
        } catch {
          return json(503, { error: 'account_registration_unavailable' });
        }
      }
      if (url.pathname === '/api/me') {
        try {
          const user = await env.DB.prepare(
            'SELECT id FROM users WHERE identity_provider = ?1 AND identity_subject = ?2 LIMIT 1'
          ).bind(identity.issuer, identity.subject).first();
          return json(200, { authenticated: true, registered: Boolean(user) });
        } catch {
          return json(503, { error: 'account_lookup_unavailable' });
        }
      }
      const product = url.searchParams.get('product') || 'margenpro';
      if (!/^[a-z0-9_-]{1,64}$/.test(product))
        return json(400, { error: 'invalid_product' });
      try {
        // A subject is unique only within its issuer; match the stored identity pair.
        const user = await env.DB.prepare(
          'SELECT id FROM users WHERE identity_provider = ?1 AND identity_subject = ?2 LIMIT 1'
        ).bind(identity.issuer, identity.subject).first();
        if (!user) return json(200, { active: false });
        const entitlement = await findActiveEntitlement(env.DB, user.id, product);
        return json(200, entitlement);
      } catch {
        return json(503, { error: 'license_lookup_unavailable' });
      }
    }
    if (!url.pathname.startsWith('/api/')) return json(404, { error: 'not_found' });
    if (!['GET', 'POST'].includes(request.method)) return json(405, { error: 'method_not_allowed' });
    // Fail closed: do not implement pseudo-authentication using a client-controlled header.
    // Auth and payment handlers must be added only with validated sessions and provider credentials.
    return json(503, {
      error: 'not_configured',
      message: 'Acceso comercial no disponible. Autenticación y cobros pendientes de configuración.'
    });
  }
};
