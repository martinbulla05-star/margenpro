// Browser API client. Access tokens are supplied by a future OIDC session adapter.
// No credentials are persisted and no payment is inferred from a redirect.
export function commercialClient(apiBase, getAccessToken, fetcher = fetch) {
  const base = new URL(apiBase);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash ||
      base.pathname !== '/') throw Error('invalid_api_origin');
  async function call(path, method = 'GET') {
    const token = await getAccessToken();
    if (typeof token !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(token)) throw Error('sign_in_required');
    const response = await fetcher(new URL(path,base), {
      method, headers:{authorization:'Bearer '+token,accept:'application/json'},
      cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(15000)
    });
    if (!response.ok) throw Error('commercial_api_'+response.status);
    return response.json();
  }
  return {
    profile:()=>call('/api/me'),
    register:()=>call('/api/register','POST'),
    entitlement:()=>call('/api/entitlement'),
    async checkout() {
      const result = await call('/api/checkout','POST');
      const url = new URL(result.checkoutUrl);
      if (url.protocol !== 'https:' || url.username || url.password ||
          !['www.mercadopago.com.ar','mercadopago.com.ar','www.mercadopago.com','mercadopago.com'].includes(url.hostname))
        throw Error('invalid_checkout_url');
      return {orderId:result.orderId,checkoutUrl:url.href};
    }
  };
}
