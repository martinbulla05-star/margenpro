const assert = require('node:assert/strict');
(async()=>{
  const {commercialClient}=await import('../commercial-client.mjs');
  let calls=0;
  const client=commercialClient('https://api.example.test',async()=> 'signed.test.token',async(url,options)=>{
    calls++;
    assert.equal(options.headers.authorization,'Bearer signed.test.token');
    assert.equal(options.cache,'no-store');
    assert.equal(options.credentials,'omit');
    if(url.pathname==='/api/checkout'){
      assert.equal(options.method,'POST');
      return {ok:true,json:async()=>({orderId:'order-1',checkoutUrl:'https://www.mercadopago.com.ar/checkout/test'})};
    }
    return {ok:true,json:async()=>({active:true})};
  });
  assert.equal((await client.entitlement()).active,true);
  assert.equal((await client.checkout()).orderId,'order-1');
  assert.equal(calls,2);
  await assert.rejects(commercialClient('https://api.example.test',async()=>null).profile(),/sign_in_required/);
  assert.throws(()=>commercialClient('http://api.example.test',async()=>null),/invalid_api_origin/);
  const bad=commercialClient('https://api.example.test',async()=> 'token',async()=>({ok:true,json:async()=>({checkoutUrl:'https://evil.example/'})}));
  await assert.rejects(bad.checkout(),/invalid_checkout_url/);
  console.log('Commercial browser client checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
