// MargenPro: smoke checks without third-party dependencies.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html','utf8');
const presentation = fs.readFileSync('presentacion.html','utf8');
const sw = fs.readFileSync('service-worker.js','utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert.equal(scripts.length,1,'App must have one inline script');
new vm.Script(scripts[0],{filename:'index.html:inline-script'});
new vm.Script(sw,{filename:'service-worker.js'});
assert.match(html,/id="productform"/);
assert.match(html,/id="backup"/);
assert.match(html,/id="restore"/);
assert.match(html,/id="csv"/);
assert.match(html,/id="target"/);
assert.match(html,/localStorage/);
assert.match(html,/BORRAR/);
assert.match(presentation,/beta gratuita/i);
assert.match(presentation,/index\.html/);
assert.match(html,/versi[oó]n beta p[uú]blica/i);
assert.ok(!/MP_ACCESS_TOKEN|TEST-\d+-\d+|APP_USR-\d+/.test(html),'Payment secrets must not appear in public HTML');
// Exercise the actual production calculation, not a duplicated test formula.
const calcSource = scripts[0].match(/function calc\(p\)\{[\s\S]*?return\{total,gain,margin,suggested\}\}/)?.[0];
assert.ok(calcSource, 'Production calc(p) must be discoverable');
const productionCalc = vm.runInNewContext(
  calcSource + '; calc',
  {num: Number, $: () => ({value: '20'}), Number, Math}
);
const cases=[
 {p:{price:15000,cost:8000,shipping:1000,other:0,fee:8,tax:3},expected:4350},
 {p:{price:10000,cost:9000,shipping:500,other:0,fee:10,tax:5},expected:-1000},
 {p:{price:20000,cost:10000,shipping:1000,other:500,fee:10,tax:5},expected:5500}
];
for(const {p,expected} of cases){
  const actual=productionCalc(p);
  assert.ok(Math.abs(actual.gain-expected)<1e-8, 'Production gain calculation mismatch');
  assert.ok(Math.abs(actual.margin-expected/p.price*100)<1e-8, 'Production margin calculation mismatch');
}
const result=productionCalc({price:2000,cost:1000,shipping:0,other:0,fee:10,tax:5});
assert.ok(Math.abs(result.suggested-1538.4615384615386)<1e-7,'Production target-price mismatch');
assert.equal(productionCalc({price:2000,cost:1000,shipping:0,other:0,fee:80,tax:5}).suggested,null,'Impossible target must be unavailable');
console.log('MargenPro smoke tests OK: syntax, essential UI, disclosures and finance scenarios.');
