// Atomic D1 settlement. Call only after authenticated provider API verification.
// D1 batch executes statements transactionally; any failure rolls back the batch.
export async function settleApprovedPayment(db, verified) {
  if (!verified || verified.status !== 'approved' || verified.provider !== 'mercadopago' ||
      !/^\d+$/.test(verified.providerPaymentId) || !Number.isSafeInteger(verified.amountMinor) ||
      verified.amountMinor <= 0 || verified.currency !== 'ARS') throw Error('invalid_verified_payment');
  const id = verified.orderId;
  const paymentId = verified.providerPaymentId;
  const statements = [
    db.prepare(`INSERT INTO payments(id,order_id,provider,provider_payment_id,amount_minor,currency,status,verified_at)
      SELECT ?1,id,'mercadopago',?2,amount_minor,currency,'approved',datetime('now')
      FROM orders WHERE id=?3 AND amount_minor=?4 AND currency=?5 AND status IN ('created','pending','approved')
      ON CONFLICT(provider,provider_payment_id) DO NOTHING`)
      .bind(crypto.randomUUID(),paymentId,id,verified.amountMinor,verified.currency),
    db.prepare(`UPDATE orders SET status='approved',updated_at=datetime('now')
      WHERE id=?1 AND status IN ('created','pending') AND EXISTS (
        SELECT 1 FROM payments WHERE order_id=?1 AND provider='mercadopago'
        AND provider_payment_id=?2 AND status='approved')`).bind(id,paymentId),
    db.prepare(`INSERT INTO entitlements(id,user_id,product_id,order_id,status)
      SELECT ?1,user_id,product_id,id,'active' FROM orders
      WHERE id=?2 AND status='approved' AND EXISTS (
        SELECT 1 FROM payments WHERE order_id=?2 AND provider='mercadopago'
        AND provider_payment_id=?3 AND status='approved')
      ON CONFLICT(order_id) DO NOTHING`).bind(crypto.randomUUID(),id,paymentId)
  ];
  await db.batch(statements);
  const row = await db.prepare(`SELECT e.id FROM entitlements e JOIN orders o ON o.id=e.order_id
    JOIN payments p ON p.order_id=o.id WHERE o.id=?1 AND p.provider='mercadopago'
    AND p.provider_payment_id=?2 AND p.status='approved' AND o.status='approved' AND e.status='active'`)
    .bind(id,paymentId).first();
  if (!row) throw Error('settlement_not_confirmed');
  return { active:true, entitlementId:row.id };
}
