import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Store, hash } from './store.mjs';

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-prepared-store-')),store=new Store(directory);
  t.after(async()=>{store.close();assert.ok(resolve(directory).startsWith(resolve(join(tmpdir(),'synk-prepared-store-'))));await rm(directory,{recursive:true,force:true});});return store;
}
test('repeated document operations compile each SQL statement once and never reuse returned data',async t=>{
  const store=await fixture(t),compiles=new Map(),prepare=store.db.prepare.bind(store.db);
  t.mock.method(store.db,'prepare',sql=>{compiles.set(sql,(compiles.get(sql)||0)+1);return prepare(sql);});
  for(let i=0;i<20;i++){
    store.put('fixture','one',{id:'one',sequence:i});
    const row=store.get('fixture','one');assert.equal(row.sequence,i);row.sequence='local-only';
    assert.equal(store.all('fixture')[0].sequence,i);assert.equal(store.get('fixture','one').sequence,i);
    store.remove('fixture','one');assert.equal(store.get('fixture','one'),null);
  }
  assert.ok(compiles.size>0);assert.ok([...compiles.values()].every(count=>count===1));
});
test('prepared document statements see committed changes and transaction rollback immediately',async t=>{
  const store=await fixture(t);store.put('fixture','one',{sequence:1});store.all('fixture');
  assert.throws(()=>store.transaction(()=>{store.put('fixture','one',{sequence:2});store.put('fixture','two',{sequence:3});assert.equal(store.get('fixture','one').sequence,2);throw new Error('rollback');}),/rollback/);
  assert.equal(store.get('fixture','one').sequence,1);assert.equal(store.get('fixture','two'),null);assert.equal(store.all('fixture').length,1);
  store.transaction(()=>store.put('fixture','one',{sequence:4}));assert.equal(store.get('fixture','one').sequence,4);
  store.db.prepare('UPDATE documents SET body=? WHERE kind=? AND id=?').run(JSON.stringify({sequence:5}),'fixture','one');assert.equal(store.get('fixture','one').sequence,5);
});
test('prepared session lookups still enforce expiry, revocation and single-use consumption',async t=>{
  const store=await fixture(t),session=store.mint('session','one',{csrfToken:'test-csrf'},30);assert.equal(store.readToken(session,'session').userId,'one');
  store.db.prepare('UPDATE tokens SET expiresAt=? WHERE hash=?').run('2020-01-01T00:00:00Z',hash(session));assert.equal(store.readToken(session,'session'),null);
  const renewed=store.mint('session','one',{},30);assert.ok(store.readToken(renewed,'session'));store.revokeUser('one');assert.equal(store.readToken(renewed,'session'),null);
  const once=store.mint('fixture-use','two',{},30);assert.ok(store.consume(once,'fixture-use'));assert.equal(store.consume(once,'fixture-use'),null);
  assert.equal(store.readToken('x'.repeat(201),'session'),null);assert.equal(store.readToken(null,'session'),null);
});
test('prepared credential statements retain encryption and fresh update/delete behavior',async t=>{
  const store=await fixture(t);store.setSecret('fixture',{value:'first-fixture-value'});assert.equal(store.secret('fixture').value,'first-fixture-value');
  store.setSecret('fixture',{value:'second-fixture-value'});assert.equal(store.secret('fixture').value,'second-fixture-value');
  const raw=store.db.prepare('SELECT ciphertext FROM credentials WHERE id=?').get('fixture').ciphertext;assert.ok(!raw.includes('second-fixture-value'));
  store.deleteSecret('fixture');assert.equal(store.secret('fixture'),null);
});
test('role changes and deactivation remain visible on every user read',async t=>{
  const store=await fixture(t),user=store.createUser({email:'fixture@example.test',name:'검사용 직원',role:'member'});assert.equal(store.get('users',user.id).role,'member');
  store.put('users',user.id,{...user,active:false,role:'viewer'});assert.equal(store.get('users',user.id).active,false);assert.equal(store.get('users',user.id).role,'viewer');
});
