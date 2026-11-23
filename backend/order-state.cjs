// Pure commercial order state machine. This module does not process payments.
// Only a trusted backend may call applyVerifiedPayment after verifying the payment
// against the payment provider's API and matching order, amount and currency.
const STATES = Object.freeze({
  CREATED: 'created', PENDING: 'pending', APPROVED: 'approved',
  REJECTED: 'rejected', REFUNDED: 'refunded', CANCELLED: 'cancelled'
});
const transitions = Object.freeze({
  created: ['pending','approved','rejected','cancelled'],
  pending: ['approved','rejected','cancelled'],
  approved: ['refunded'],
  rejected: [], refunded: [], cancelled: []
});
function applyVerifiedPayment(order, payment) {
  if (!order || !payment || typeof order !== 'object') throw new Error('invalid_input');
  if (payment.verifiedByServer !== true) throw new Error('unverified_payment');
  if (typeof order.id !== 'string' || typeof order.userId !== 'string' ||
      typeof order.providerReference !== 'string' || !order.id || !order.userId || !order.providerReference)
    throw new Error('invalid_order');
  if (!Number.isSafeInteger(order.amountMinor) || order.amountMinor <= 0 ||
      typeof order.currency !== 'string' || !/^[A-Z]{3}$/.test(order.currency))
    throw new Error('invalid_order_amount');
  if (payment.providerReference !== order.providerReference ||
      payment.amountMinor !== order.amountMinor || payment.currency !== order.currency)
    throw new Error('payment_mismatch');
  if (!Object.values(STATES).includes(order.status) || !Object.values(STATES).includes(payment.status))
    throw new Error('invalid_status');
  if (order.status === payment.status) return { ...order, changed: false };
  if (!transitions[order.status].includes(payment.status)) throw new Error('invalid_transition');
  return { ...order, status: payment.status, changed: true };
}
function hasActiveLicense(order) {
  return Boolean(order && order.status === STATES.APPROVED && order.userId);
}
module.exports = { STATES, applyVerifiedPayment, hasActiveLicense };
