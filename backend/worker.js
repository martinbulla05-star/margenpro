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
