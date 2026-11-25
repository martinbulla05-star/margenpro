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
