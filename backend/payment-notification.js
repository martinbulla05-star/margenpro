// Payment notification orchestration; not exposed until provider configuration is verified.
import { verifyWebhookSignature } from './webhook-signature.js';
import { fetchPayment } from './mercadopago.js';
import { validateApprovedPayment } from './payment-validation.js';
import { settleApprovedPayment } from './settlement.js';
export async function handlePaymentNotification(request, env) {
  if (!env?.DB || !env.MP_WEBHOOK_SECRET || !env.MP_ACCESS_TOKEN || !env.MP_COLLECTOR_ID)
    return { status:503, body:{error:'payment_not_configured'} };
  if (!await verifyWebhookSignature(request,env.MP_WEBHOOK_SECRET))
    return {status:401,body:{error:'invalid_signature'}};
  try {
    const id = new URL(request.url).searchParams.get('data.id');
    const payment = await fetchPayment(id,env.MP_ACCESS_TOKEN);
    // Non-approved events must not grant access. Refund processing is not yet implemented.
    if (payment.status !== 'approved') return {status:503,body:{error:'payment_status_requires_reconciliation'}};
    const order = await env.DB.prepare('SELECT id,status,amount_minor AS amountMinor,currency FROM orders WHERE id=?1')
      .bind(payment.external_reference).first();
    const verified = validateApprovedPayment(payment,order,env.MP_COLLECTOR_ID);
    await settleApprovedPayment(env.DB,verified);
    return {status:200,body:{received:true}};
  } catch {
    return {status:503,body:{error:'payment_reconciliation_failed'}};
  }
}
