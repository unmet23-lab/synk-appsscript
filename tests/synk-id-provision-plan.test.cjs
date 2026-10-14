'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {buildProvisionPlan,canonicalMap,digest}=require('../tools/synk-id/provision-plan.cjs');
const {CLIENTS}=require('../tools/synk-id/registry.cjs');
const legacy=CLIENTS.filter(c=>c.knownIds?.production).map(c=>({client_id:c.knownIds.production,client_type:'public',redirect_uris:c.redirectUris}));
const make=(extra={})=>{const mapping=canonicalMap('production');return buildProvisionPlan({environment:'production',clients:legacy,secretDigest:digest(mapping),...extra});};
test('read-only plan preserves verified legacy mapping and distinguishes unfinished adapters',()=>{const p=make();assert.equal(p.readOnly,true);assert.equal(p.mapping.preservedCount,2);assert.ok(p.actions.some(a=>a.registration==='care-native'));assert.ok(!p.actions.some(a=>a.registration==='teacher-browser'));assert.equal(p.registrations.find(x=>x.id==='world-legacy').status,'registered-and-mapped');});

test('all three personal apps include browser and native registration with public client_name contracts',()=>{const p=make();for(const service of ['path','rehearsal','family-album'])for(const runtime of ['browser','native']){const action=p.actions.find(item=>item.registration===`${service}-${runtime}`);assert.ok(action);assert.equal(action.body.client_name,`SYNK ${service}-${runtime} (production)`);assert.equal(action.body.name,undefined);assert.equal(action.body.client_type,'public');assert.equal(action.body.token_endpoint_auth_method,'none');}});
test('unknown product mappings survive only a matching full source digest',()=>{const existingMapping={...canonicalMap('production'),unknown:'platform'};assert.throws(()=>make({secretDigest:digest(existingMapping)}),/지문/);const p=make({existingMapping,secretDigest:digest(existingMapping)});assert.equal(p.mapping.preservedCount,3);});
test('registered new app requires explicit binding and merges without replacing older entries',()=>{const wanted=CLIENTS.find(c=>c.id==='care-native'),clients=[...legacy,{client_id:'new-public-client',client_type:'public',redirect_uris:wanted.redirectUris}];assert.equal(make({clients}).registrations.find(x=>x.id==='care-native').status,'binding-required');const p=make({clients,bindings:{'care-native':'new-public-client'}});const a=p.actions.find(x=>x.action==='merge-product-mapping');assert.deepEqual(a.value,{...canonicalMap('production'),'new-public-client':'platform'});assert.equal(a.expectedDigest,digest(canonicalMap('production')));});
test('redirect or product drift rejects before any mutation plan can be issued',()=>{const clients=structuredClone(legacy);clients[0].redirect_uris=['https://bad.invalid'];assert.throws(()=>make({clients}),/반환 주소/);const mapping=canonicalMap('production');mapping[legacy[0].client_id]='messenger';assert.throws(()=>make({existingMapping:mapping,secretDigest:digest(mapping)}),/덮어쓸/);});

test('safe additional HTTPS callbacks survive planning while required and native scope checks remain', () => {
  const clients = structuredClone(legacy); clients[0].redirect_uris.push('https://synk.im/new-world/');
  assert.equal(make({ clients }).registrations[0].status, 'registered-and-mapped');
  for (const callback of ['http://127.0.0.1:5555/', 'https://synk.im/?code=stale', 'https://user:pass@synk.im/', 'https://synk.im/?a=1&a=2']) {
    const invalid = structuredClone(clients); invalid[0].redirect_uris.push(callback); assert.throws(() => make({ clients: invalid }), /반환 주소/);
  }
});

test('Fortune native/browser role swaps are rejected independently of allowlist set order', () => {
  const clients = [...legacy, ...['fortune-native', 'fortune-browser'].map(id => ({ client_id: 'existing-' + id, client_type: 'public', redirect_uris: CLIENTS.find(row => row.id === id).redirectUris }))];
  assert.throws(() => make({ clients, bindings: { 'fortune-native': 'existing-fortune-browser', 'fortune-browser': 'existing-fortune-native' } }), /반환 주소/);
});

test('travel-only plans target one new browser and never merge an unrelated unmapped client', () => {
  const other = CLIENTS.find(row => row.id === 'care-browser');
  const clients = [...legacy, { client_id: 'existing-unmapped-care', client_type: 'public', redirect_uris: other.redirectUris }];
  const plan = make({ only: 'path-travel-browser', clients, bindings: { 'care-browser': 'existing-unmapped-care' } });
  assert.deepEqual(plan.actions.map(row => row.registration), ['path-travel-browser']);
  assert.deepEqual(plan.actions[0].body.redirect_uris, ['http://127.0.0.1:4303/']);
  assert.equal(plan.mapping.mergedCount, 2);
  assert.equal(plan.registrations.find(row => row.id === 'care-browser').status, 'mapping-needed');
  for (const only of ['', null, [], 'path-travel', 'PATH-TRAVEL-browser', 'teacher-browser']) assert.throws(() => make({ only }), /--only/);
  assert.deepEqual(make({ only: undefined }), make());
});
