// Validate a payment retrieved directly from the provider API, not webhook body.
// This function is pure: it cannot approve an order or grant a license.
export function validateApprovedPayment(payment, order, expectedCollectorId) {
  if (!order || !['created','pending','approved'].includes(order.status) ||
      typeof order.id !== 'string' || !Number.isSafeInteger(order.amountMinor) ||
      order.amountMinor <= 0 || order.currency !== 'ARS') throw new Error('invalid_order');
  if (typeof expectedCollectorId !== 'string' || !/^\d+$/.test(expectedCollectorId))
    throw new Error('collector_not_configured');
  if (!payment || payment.status !== 'approved' || payment.external_reference !== order.id ||
      payment.currency_id !== order.currency || String(payment.collector_id) !== expectedCollectorId)
    throw new Error('payment_mismatch');
  if (typeof payment.transaction_amount !== 'number' || !Number.isFinite(payment.transaction_amount) ||
      Math.abs(payment.transaction_amount * 100 - order.amountMinor) > 0.000001)
    throw new Error('payment_amount_mismatch');
  if (!/^\d+$/.test(String(payment.id)) ||
      (typeof payment.id === 'number' && !Number.isSafeInteger(payment.id)))
    throw new Error('invalid_payment_id');
  return { provider: 'mercadopago', providerPaymentId: String(payment.id),
    orderId: order.id, amountMinor: order.amountMinor, currency: order.currency, status: 'approved' };
}
