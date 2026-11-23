// OIDC access-token verification for Cloudflare Workers (RS256 only).
// Configure a trusted issuer, audience and HTTPS JWKS endpoint server-side.
// No identity is accepted from user-controlled headers other than a signed Bearer token.
function decodePart(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw new Error('invalid_token_encoding');
  const binary = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function parsePart(part) {
  const value = JSON.parse(new TextDecoder().decode(decodePart(part)));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_token_json');
  return value;
}
export async function verifyAccessToken(token, config, options = {}) {
  if (typeof token !== 'string' || token.length > 12000) throw new Error('invalid_token');
  if (!config || typeof config.issuer !== 'string' || typeof config.audience !== 'string' ||
      !config.issuer || !config.audience || typeof config.jwksUrl !== 'string') throw new Error('auth_not_configured');
  const jwksUrl = new URL(config.jwksUrl);
  if (jwksUrl.protocol !== 'https:' || jwksUrl.username || jwksUrl.password || jwksUrl.hash) throw new Error('invalid_jwks_url');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid_token');
  const header = parsePart(parts[0]);
  const claims = parsePart(parts[1]);
  if (header.alg !== 'RS256' || header.typ && header.typ !== 'JWT' ||
      typeof header.kid !== 'string' || !header.kid || header.kid.length > 256) throw new Error('unsupported_token_header');
  const now = options.now ?? Math.floor(Date.now() / 1000);
  const skew = 60;
  if (!Number.isFinite(now) || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) ||
      claims.exp <= now - skew || typeof claims.iat !== 'number' || claims.iat > now + skew ||
      (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf > now + skew)) ||
      claims.iss !== config.issuer ||
      !(claims.aud === config.audience || Array.isArray(claims.aud) && claims.aud.includes(config.audience)) ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 256) throw new Error('invalid_token_claims');
  const fetcher = options.fetcher ?? fetch;
  const response = await fetcher(jwksUrl.toString(), { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error('jwks_unavailable');
  const jwks = await response.json();
  if (!jwks || !Array.isArray(jwks.keys) || jwks.keys.length > 100) throw new Error('invalid_jwks');
  const key = jwks.keys.find(k => k.kid === header.kid && k.kty === 'RSA' &&
    (!k.alg || k.alg === 'RS256') && (!k.use || k.use === 'sig') && k.n && k.e);
  if (!key) throw new Error('signing_key_not_found');
  const cryptoApi = options.crypto ?? crypto;
  const publicKey = await cryptoApi.subtle.importKey('jwk', key,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const verified = await cryptoApi.subtle.verify('RSASSA-PKCS1-v1_5', publicKey,
    decodePart(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!verified) throw new Error('invalid_signature');
  return { subject: claims.sub, issuer: claims.iss };
}
