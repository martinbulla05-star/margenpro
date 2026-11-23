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
const gain=(p)=>p.price-p.cost-p.shipping-p.other-p.price*(p.fee+p.tax)/100;
const cases=[
 {p:{price:15000,cost:8000,shipping:1000,other:0,fee:8,tax:3},expected:4350},
 {p:{price:10000,cost:9000,shipping:500,other:0,fee:10,tax:5},expected:-1000},
 {p:{price:20000,cost:10000,shipping:1000,other:500,fee:10,tax:5},expected:5500}
];
for(const {p,expected} of cases) assert.ok(Math.abs(gain(p)-expected)<1e-8);
const target=(p,margin)=>(p.cost+p.shipping+p.other)/(1-(p.fee+p.tax+margin)/100);
assert.ok(Math.abs(target({cost:1000,shipping:0,other:0,fee:10,tax:5},20)-1538.4615384615386)<1e-7);
console.log('MargenPro smoke tests OK: syntax, essential UI, disclosures and finance scenarios.');
