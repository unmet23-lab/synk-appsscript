// 계정 이름(handle)을 바꾼 채널의 외부 관측 계정 확인 시험(2026-11-26). 합성 저장소와 서버만 쓴다. 운영 데이터와 외부 주소는 열지 않는다.
// 운영 X 채널은 원장 등록 전에 x.com/yuhobuilds 주소로 만들어져 채널 문서의 handle이 yuhobuilds로 남았다. 원장은 11-17에 바꾼 @synk_pulse다.
// 원장에 handle이 있으면 그것만 지금 이름이다. 옛 이름을 다른 사람이 가져가도 그 사람의 화면과 게시물이 이 채널 값으로 들어오지 않는다(GPT GA4).
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {accountCatalog} from './account-catalog.mjs';
import {createExternalObservations} from './external-observations.mjs';

const sha=text=>createHash('sha256').update(text).digest('hex');

async function fixture(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-external-renamed-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();await rm(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({name:'Synthetic admin',email:'admin@example.test',role:'admin',teamId:null});
  const cookie=`synk_company_session=${app.store.mint('session',admin.id,{csrfToken:'fixture'},30)}`;
  const request=async(path,body)=>{
    const response=await fetch(base+path,{method:'POST',headers:{Cookie:cookie,Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'fixture'},body:JSON.stringify(body)});
    return {status:response.status,body:await response.json()};
  };
  // 운영 X 채널과 같은 꼴: 주소 등록으로 만든 채널이라 catalogAccountId가 없고 legacyId로 원장에 묶인다.
  app.store.put('channels','x-old',{id:'x-old',platform:'x',canonicalUrl:'https://x.com/yuhobuilds',handle:'yuhobuilds',externalId:null,legacyId:'yuhobuilds-x',label:'yuhobuilds',displayName:'X yuhobuilds',ownerIds:[admin.id],teamId:null,active:true,status:'not-connected',createdAt:new Date().toISOString()});
  let count=0;
  const input=(handle,sourceUrl,observations=[{kind:'account-lifetime',metrics:{followers:3}}])=>({sourceType:'public-page',sourceUrl,observedAt:new Date(Date.now()-30*60000).toISOString(),evidenceSha256:sha('renamed '+(count++)),identity:{accountId:'yuhobuilds-x',handle},observations});
  const send=(...args)=>request('/api/channels/x-old/external-observations',input(...args));
  return {app,admin,send,input};
}

test('a renamed account takes only its ledger handle, not the old name left on the channel',async t=>{
  const f=await fixture(t);
  assert.equal(accountCatalog.accounts.find(row=>row.id==='yuhobuilds-x').handle,'@synk_pulse');
  // 지금 이름(@synk_pulse)의 공개 프로필과 게시물은 받는다.
  assert.equal((await f.send('@synk_pulse','https://x.com/synk_pulse')).status,201);
  const post=[{kind:'post-lifetime',post:{externalId:'1888000000000000001',url:'https://x.com/synk_pulse/status/1888000000000000001',publishedAt:new Date(Date.now()-86400000).toISOString()},metrics:{views:5}}];
  assert.equal((await f.send('@synk_pulse','https://x.com/synk_pulse',post)).status,201);
  // 채널 문서에 남은 옛 이름(yuhobuilds)의 공개 프로필 · 게시물 · 계정 확인은 받지 않는다.
  assert.equal((await f.send('@yuhobuilds','https://x.com/yuhobuilds')).body.code,'SYNK_EXTERNAL_SOURCE');
  assert.equal((await f.send('@synk_pulse','https://x.com/yuhobuilds')).body.code,'SYNK_EXTERNAL_SOURCE');
  assert.equal((await f.send('@yuhobuilds','https://x.com/synk_pulse')).body.code,'SYNK_EXTERNAL_IDENTITY');
  const oldPost=[{kind:'post-lifetime',post:{externalId:'1888000000000000002',url:'https://x.com/yuhobuilds/status/1888000000000000002',publishedAt:new Date(Date.now()-86400000).toISOString()},metrics:{views:9}}];
  assert.equal((await f.send('@synk_pulse','https://x.com/synk_pulse',oldPost)).body.code,'SYNK_EXTERNAL_POST');
});

test('a channel whose ledger row has no handle still uses the channel handle',async t=>{
  const f=await fixture(t);
  const catalog={...accountCatalog,accounts:accountCatalog.accounts.map(row=>row.id==='yuhobuilds-x'?{...row,handle:null,publicUrl:null}:row)};
  const external=createExternalObservations({store:f.app.store,catalog});
  assert.equal(external.record(f.admin,{id:'x-old'},f.input('@yuhobuilds','https://x.com/yuhobuilds')).created.length,1);
  assert.throws(()=>external.record(f.admin,{id:'x-old'},f.input('@synk_pulse','https://x.com/synk_pulse')),error=>error.code==='SYNK_EXTERNAL_SOURCE');
});
