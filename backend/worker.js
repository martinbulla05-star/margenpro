import { createOrder } from './orders.js';
import { buildPreference } from './checkout.js';
import { createPreference } from './mercadopago.js';
import { handlePaymentNotification } from './payment-notification.js';
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
    // Browsers may call this API only from the explicitly configured frontend origin.
    // CORS is not authentication: all protected endpoints still validate the token.
    const origin = request.headers.get('origin');
    const allowedOrigin = typeof env?.FRONTEND_ORIGIN === 'string' &&
      /^https:\/\/[^/]+$/.test(env.FRONTEND_ORIGIN) &&
      !env.FRONTEND_ORIGIN.includes('REPLACE-') ? env.FRONTEND_ORIGIN : null;
    if (origin && origin === allowedOrigin) {
      headers['access-control-allow-origin'] = origin;
      headers['vary'] = 'Origin';
    }
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      const requestedMethod = request.headers.get('access-control-request-method');
      const requestedHeaders = request.headers.get('access-control-request-headers') || '';
      const safeHeaders = requestedHeaders.split(',').map(h => h.trim().toLowerCase())
        .filter(Boolean).every(h => h === 'authorization' || h === 'content-type');
      if (!origin || origin !== allowedOrigin ||
          !['GET', 'POST'].includes(requestedMethod) || !safeHeaders)
        return new Response(null, { status: 403, headers });
      return new Response(null, { status: 204, headers: {
        ...headers,
        'access-control-allow-methods': 'GET, POST',
        'access-control-allow-headers': 'Authorization, Content-Type',
        'access-control-max-age': '600'
      } });
    }
    const json = (status, payload) => new Response(JSON.stringify(payload), { status, headers });
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return json(200, { service: 'margenpro-api', status: 'setup-required', paymentsEnabled: false });
    }
    if (url.pathname === '/api/webhooks/mercadopago' && request.method === 'POST') {
      if (env?.PAYMENTS_ENABLED !== 'true') return json(503,{error:'payments_disabled'});
      const result = await handlePaymentNotification(request,env);
      return json(result.status,result.body);
    }
    if ((url.pathname === '/api/entitlement' || url.pathname === '/api/me') && request.method === 'GET' ||
        ['/api/register','/api/checkout'].includes(url.pathname) && request.method === 'POST') {
      // Configuration and database must be provided by the trusted server environment.
      if (!env?.DB || !env.AUTH_ISSUER || !env.AUTH_AUDIENCE || !env.AUTH_JWKS_URL ||
          [env.AUTH_ISSUER, env.AUTH_AUDIENCE, env.AUTH_JWKS_URL].some(value =>
            typeof value !== 'string' || value.includes('REPLACE-')))
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
      if (url.pathname === '/api/checkout') {
        if (env.PAYMENTS_ENABLED !== 'true' || !env.MP_ACCESS_TOKEN || !env.MP_WEBHOOK_SECRET ||
            !env.MP_COLLECTOR_ID || !env.CHECKOUT_RETURN_URL || !env.MP_NOTIFICATION_URL ||
            !/^[1-9][0-9]*$/.test(env.PRICE_MINOR || ''))
          return json(503,{error:'payments_disabled'});
        try {
          const user = await env.DB.prepare('SELECT id FROM users WHERE identity_provider = ?1 AND identity_subject = ?2 LIMIT 1')
            .bind(identity.issuer,identity.subject).first();
          if (!user) return json(403,{error:'registration_required'});
          const existing = await findActiveEntitlement(env.DB,user.id,'margenpro');
          if (existing.active) return json(409,{error:'already_licensed'});
          const order = await createOrder(env.DB,user.id,Number(env.PRICE_MINOR));
          const preference = buildPreference(order,env.CHECKOUT_RETURN_URL,env.MP_NOTIFICATION_URL);
          const checkout = await createPreference(preference,env.MP_ACCESS_TOKEN);
          return json(200,{orderId:order.id,checkoutUrl:checkout.checkoutUrl});
        } catch { return json(503,{error:'checkout_unavailable'}); }
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
