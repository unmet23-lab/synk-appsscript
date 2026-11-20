import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './store.mjs';
import {createCompanyWork} from './company-work.mjs';

test('강의·상담 목록은 담당자와 회사로 조회하고 관리자·겸임자의 열람 범위를 유지한다',async t=>{
  const directory=await mkdtemp(join(tmpdir(),'synk-company-work-index-')),store=new Store(directory);
  t.after(async()=>{store.close();await rm(directory,{recursive:true,force:true});});
  const memberships=[{company:'SHIFT',role:'instructor'},{company:'PATH',role:'counselor'}];
  const teacher={id:'teacher',name:'강사',role:'member',active:true,workspaceProfile:{memberships,duties:[]}};
  const admin={...teacher,id:'admin',name:'관리자',role:'admin'};
  for(const person of [teacher,admin])store.put('users',person.id,person);
  const work=createCompanyWork({store,clock:()=>'2026-11-20T16:00:00.000Z'});
  for(const person of [teacher,admin])for(const company of ['SHIFT','PATH']){
    work.save(person,company,null,{title:company+' '+person.name,status:'open'});
  }
  work.save(teacher,'SHIFT',null,{title:'완료한 강의',status:'done'});
  const all=store.all.bind(store);
  store.all=kind=>{assert.notEqual(kind,'companyWork','개인과 회사 목록은 전체 조회를 하지 않는다');return all(kind);};
  const board=work.mine(teacher);
  assert.equal(board.date,'2026-11-21');
  assert.deepEqual(board.items.map(row=>row.title).sort(),['PATH 강사','SHIFT 강사']);
  for(const row of board.items){
    assert.equal(Object.hasOwn(row,'note'),false);
    assert.equal(row.href,'/?tab='+({PATH:'path',SHIFT:'lectures'})[row.company]+'&workId='+encodeURIComponent(row.id));
  }
  assert.deepEqual(work.workspace(teacher,'SHIFT').items.map(row=>row.title),['SHIFT 강사','완료한 강의']);
  assert.deepEqual(work.workspace(admin,'PATH').items.map(row=>row.ownerName).sort(),['강사','관리자'].sort());
});

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
