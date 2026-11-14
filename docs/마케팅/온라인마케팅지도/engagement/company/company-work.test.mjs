import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {createCompanyWork} from './company-work.mjs';

test('unknown and inherited company keys cannot read or create company work',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-company-work-keys-')),store=new Store(directory);
  t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});
  const user={id:'admin',name:'Admin',role:'admin',active:true};store.put('users',user.id,user);
  const service=createCompanyWork({store}),beforeWork=store.all('companyWork'),beforeAudit=store.all('audit');
  for(const company of ['constructor','toString','__proto__','unknown']){
    assert.throws(()=>service.workspace(user,company),{status:404},company);
    assert.throws(()=>service.save(user,company,null,{title:'Must not be saved'}),{status:404},company);
    assert.deepEqual(store.all('companyWork'),beforeWork);assert.deepEqual(store.all('audit'),beforeAudit);
  }
  assert.equal(service.workspace(user,'PATH').company,'PATH');
  assert.equal(service.workspace(user,'SHIFT').company,'SHIFT');
});

test('invalid company-work values never erase saved fields or advance revision/audit',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-company-work-validation-')),store=new Store(directory);
  t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});
  const user={id:'owner',name:'Owner',role:'member',active:true,workspaceProfile:{memberships:[{company:'SHIFT',role:'instructor'}],duties:[]}};
  store.put('users',user.id,user);
  const service=createCompanyWork({store});
  const original=service.save(user,'SHIFT',null,{title:'Class',note:'Keep memo',date:'2026-11-20',status:'done'}).item;
  const audit=store.all('audit');
  for(const patch of [{date:0},{date:false},{date:null},{status:false},{status:''},{status:null},{note:null},{note:0},{note:{}},{title:0}]){
    assert.throws(()=>service.save(user,'SHIFT',original.id,{...original,...patch}),{status:400});
    assert.deepEqual(store.get('companyWork',original.id),original);
    assert.deepEqual(store.all('audit'),audit);
  }
  for(const input of [null,[],false])assert.throws(()=>service.save(user,'SHIFT',original.id,input),{status:400});
  const preserved=service.save(user,'SHIFT',original.id,{revision:original.revision,title:'Renamed class'}).item;
  assert.deepEqual([preserved.note,preserved.date,preserved.status],['Keep memo','2026-11-20','done']);
  const cleared=service.save(user,'SHIFT',original.id,{revision:preserved.revision,title:'Renamed class',note:'',date:'',status:'open'}).item;
  assert.deepEqual([cleared.note,cleared.date,cleared.status],['','','open']);
  assert.equal(cleared.revision,original.revision+2);
});
