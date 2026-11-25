// Create a commercial order using server-controlled product and price.
// No payment is initiated by this module.
export async function createOrder(db, userId, priceMinor, currency = 'ARS') {
  if (!db || typeof db.prepare !== 'function') throw new Error('database_required');
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('verified_user_required');
  if (!Number.isSafeInteger(priceMinor) || priceMinor <= 0 || currency !== 'ARS')
    throw new Error('invalid_server_price');
  const product = await db.prepare('SELECT id FROM products WHERE code = ?1 LIMIT 1')
    .bind('margenpro').first();
  if (!product) throw new Error('product_not_configured');
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO orders(id,user_id,product_id,provider,provider_reference,amount_minor,currency)
    VALUES (?1,?2,?3,'mercadopago',?1,?4,?5)`)
    .bind(id,userId,product.id,priceMinor,currency).run();
  return { id, status: 'created', amountMinor: priceMinor, currency };
}
