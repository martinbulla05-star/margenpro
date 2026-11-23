const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('backend/entitlements.js','utf8');
const sandbox={Date,TypeError};
vm.runInNewContext(source.replace('export async function findActiveEntitlement','async function findActiveEntitlement')+'; globalThis.lookup=findActiveEntitlement;',sandbox);
const lookup=sandbox.lookup;
function mockDb(result){
  const calls=[];
  return {calls,prepare(sql){
    assert.match(sql,/o\.status = 'approved'/);
    assert.match(sql,/e\.expires_at > \?3/);
    return {bind(...args){calls.push(args);return {async first(){return result}}}};
  }};
}
(async()=>{
  const db=mockDb({id:'lic-1',expires_at:null});
  const active=await lookup(db,'verified-user','margenpro',new Date('2026-11-23T00:00:00.000Z'));
  assert.equal(active.active,true);
  assert.equal(active.entitlementId,'lic-1');
  assert.equal(db.calls[0][0],'verified-user');
  assert.equal(db.calls[0][1],'margenpro');
  assert.equal(db.calls[0][2],'2026-11-23T00:00:00.000Z');
  const missing=await lookup(mockDb(null),'verified-user','margenpro');
  assert.equal(missing.active,false);
  await assert.rejects(lookup(mockDb(null),'','margenpro'),/verified_identity_required/);
  await assert.rejects(lookup(mockDb(null),'verified-user','../admin'),/invalid_product_code/);
  console.log('Read-only entitlement lookup checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
