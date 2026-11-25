// Server-side Mercado Pago API adapter. Never expose the access token to clients.
export async function fetchPayment(paymentId, accessToken, fetcher = fetch) {
  if (typeof paymentId !== 'string' || !/^[0-9]{1,32}$/.test(paymentId))
    throw new Error('invalid_payment_id');
  if (typeof accessToken !== 'string' || !accessToken.trim() || accessToken.includes('REPLACE-'))
    throw new Error('payment_api_not_configured');
  const response = await fetcher('https://api.mercadopago.com/v1/payments/' + paymentId, {
    method: 'GET',
    headers: { authorization: 'Bearer ' + accessToken, accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('payment_api_unavailable');
  const payment = await response.json();
  if (!payment || String(payment.id) !== paymentId ||
      (typeof payment.id === 'number' && !Number.isSafeInteger(payment.id)))
    throw new Error('payment_id_mismatch');
  return payment;
}

export async function createPreference(preference, accessToken, fetcher = fetch) {
  if (typeof accessToken !== 'string' || !accessToken.trim() || accessToken.includes('REPLACE-'))
    throw new Error('payment_api_not_configured');
  if (!preference || !/^[a-zA-Z0-9_-]{1,128}$/.test(preference.external_reference || ''))
    throw new Error('invalid_preference');
  const response = await fetcher('https://api.mercadopago.com/checkout/preferences', {
    method:'POST', headers:{authorization:'Bearer '+accessToken,accept:'application/json',
      'content-type':'application/json'}, body:JSON.stringify(preference),
    redirect:'error',signal:AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error('checkout_api_unavailable');
  const result = await response.json();
  if (typeof result?.id !== 'string' || !result.id || typeof result.init_point !== 'string')
    throw new Error('invalid_checkout_response');
  const url = new URL(result.init_point);
  if (url.protocol !== 'https:' || url.username || url.password ||
      !['www.mercadopago.com.ar','mercadopago.com.ar','www.mercadopago.com','mercadopago.com'].includes(url.hostname))
    throw new Error('invalid_checkout_url');
  return { preferenceId:result.id, checkoutUrl:url.toString() };
}
