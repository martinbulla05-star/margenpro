// Verify Mercado Pago webhook signature before contacting the provider.
// Caller supplies data.id from the URL query, not the untrusted JSON body.
export async function verifyWebhookSignature(request, secret, now = Date.now()) {
  if (typeof secret !== 'string' || !secret.trim() || secret.includes('REPLACE-')) return false;
  const url = new URL(request.url);
  const id = url.searchParams.get('data.id');
  const requestId = request.headers.get('x-request-id');
  const signature = request.headers.get('x-signature') || '';
  if (!id || !/^\d{1,32}$/.test(id) || !requestId || !/^[a-zA-Z0-9_-]{1,128}$/.test(requestId)) return false;
  const fields = signature.split(',').map(x=>x.trim());
  const ts = fields.filter(x=>x.startsWith('ts='));
  const v1 = fields.filter(x=>x.startsWith('v1='));
  if (ts.length !== 1 || v1.length !== 1) return false;
  const timestamp = ts[0].slice(3);
  const hex = v1[0].slice(3);
  if (!/^\d{10,13}$/.test(timestamp) || !/^[a-fA-F0-9]{64}$/.test(hex)) return false;
  const time = Number(timestamp) * (timestamp.length === 10 ? 1000 : 1);
  if (Math.abs(now-time)>300000) return false;
  const manifest = 'id:'+id+';request-id:'+requestId+';ts:'+timestamp+';';
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const bytes = Uint8Array.from(hex.match(/../g), x=>parseInt(x,16));
  return crypto.subtle.verify('HMAC',key,bytes,enc.encode(manifest));
}
