// Read-only license lookup for a future authenticated Cloudflare Worker + D1 backend.
// The caller MUST validate the identity-provider token and derive userId server-side.
// Never pass a user ID obtained directly from a request header or body.
export async function findActiveEntitlement(db, verifiedUserId, productCode, now = new Date()) {
  if (!db || typeof db.prepare !== 'function') throw new TypeError('database_required');
  if (typeof verifiedUserId !== 'string' || !verifiedUserId.trim()) throw new TypeError('verified_identity_required');
  if (typeof productCode !== 'string' || !/^[a-z0-9_-]{1,64}$/.test(productCode)) throw new TypeError('invalid_product_code');
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError('invalid_time');
  const row = await db.prepare(`
    SELECT e.id, e.expires_at
    FROM entitlements e
    JOIN products p ON p.id = e.product_id
    JOIN orders o ON o.id = e.order_id
    WHERE e.user_id = ?1
      AND p.code = ?2
      AND e.status = 'active'
      AND o.user_id = e.user_id
      AND o.product_id = e.product_id
      AND o.status = 'approved'
      AND (e.expires_at IS NULL OR e.expires_at > ?3)
    ORDER BY e.granted_at DESC
    LIMIT 1
  `).bind(verifiedUserId, productCode, now.toISOString()).first();
  return row ? { active: true, entitlementId: row.id, expiresAt: row.expires_at } : { active: false };
}
