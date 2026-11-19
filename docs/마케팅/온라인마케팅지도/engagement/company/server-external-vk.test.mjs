// VK 클립의 게시물 누적값(post-lifetime) 기록 시험(2026-11-19). 합성 저장소와 서버만 쓴다. 운영 데이터와 외부 주소는 열지 않는다.
// VK 클립은 커뮤니티 공개 클립 목록(vk.ru/clips/<커뮤니티>)을 출처로, clip-<소유자>_<번호> 하나의 번호로 받는다. 같은 숫자의 벽 글과 섞이지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createCompanyApp} from './server.mjs';

const DAY_MS=86400000;
const sha=text=>createHash('sha256').update(text).digest('hex');

async function fixture(t,options={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-external-vk-'));
  const app=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,...options});
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  t.after(async()=>{await app.stop();await rm(directory,{recursive:true,force:true});});
  const admin=app.store.createUser({name:'Synthetic admin',email:'admin@example.test',role:'admin',teamId:null});
  const cookie=`synk_company_session=${app.store.mint('session',admin.id,{csrfToken:'fixture'},30)}`;
  const request=async(path,body)=>{
    const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie,Origin:app.origin,'Content-Type':'application/json','X-CSRF-Token':'fixture'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    return {status:response.status,body:await response.json()};
  };
  const register=async accountIds=>{
    const result=await request('/api/channels/from-catalog',{accountIds});
    assert.ok([200,201].includes(result.status),JSON.stringify(result.body));
    return Object.fromEntries([...result.body.added,...result.body.existing].map(row=>[row.accountId,row.channel.id]));
  };
  return {app,request,register};
}

test('VK clips come from the community public clip list under one clip-prefixed id that never merges with a wall post of the same number',async t=>{
  const f=await fixture(t),vk=(await f.register(['lab-ru-vk']))['lab-ru-vk'];
  const observedAt=new Date(Date.now()-20*60000).toISOString(),publishedAt=new Date(Date.now()-2*DAY_MS).toISOString();let count=0;
  const send=(sourceUrl,externalId,url)=>f.request(`/api/channels/${vk}/external-observations`,{sourceType:'public-page',sourceUrl,observedAt,evidenceSha256:sha('vk clip '+(count++)),identity:{accountId:'lab-ru-vk',handle:'synklab_ru'},
    observations:[{kind:'post-lifetime',post:{externalId,url,publishedAt},metrics:{views:21,likes:0,comments:0,shares:0}}]});
  const list='https://vk.ru/clips/synklab_ru',clip='https://vk.ru/clip-243082040_456239018';
  for(const [externalId,url] of [['-243082040_456239018',clip],['wall-243082040_456239018',clip],['456239018',clip],['clip-243082040_456239018',clip+'/extra'],['clip-243082040_456239018','https://vk.ru/clips-243082040_456239018']])
    assert.equal((await send(list,externalId,url)).body.code,'SYNK_EXTERNAL_POST',externalId+' '+url);
  // 다른 커뮤니티(-1)나 개인 벽(소유자 번호가 양수)의 클립 · 글은 이 채널의 커뮤니티 번호와 달라 받지 않는다(GPT GA1).
  for(const [externalId,url] of [['clip-1_456239018','https://vk.ru/clip-1_456239018'],['clip243082040_456239018','https://vk.ru/clip243082040_456239018'],['wall-1_45','https://vk.ru/wall-1_45']])
    assert.equal((await send(list,externalId,url)).body.code,'SYNK_EXTERNAL_POST',url);
  for(const source of ['https://vk.ru/clips/someone_else','https://vk.ru/clips','https://vk.ru/clips/synklab_ru/extra',clip])
    assert.equal((await send(source,'clip-243082040_456239018',clip)).body.code,'SYNK_EXTERNAL_SOURCE',source);
  const saved=await send(list+'?z=clip-243082040_456239018&feedType=ownerFeed&owner=-243082040','clip-243082040_456239018',clip);
  assert.equal(saved.status,201,JSON.stringify(saved.body));
  assert.equal(saved.body.records[0].sourceUrl,list);
  assert.deepEqual(saved.body.records[0].post,{externalId:'clip-243082040_456239018',url:clip,publishedAt,title:null});
  assert.equal(saved.body.records[0].projection.state,'projected');
  assert.equal((await send(list,'clip-243082040_456239018','https://vk.com/CLIP-243082040_456239018')).status,201);
  assert.equal((await send('https://vk.ru/synklab_ru','wall-243082040_456239018','https://vk.ru/wall-243082040_456239018')).status,201);
  // 커뮤니티 첫 화면의 벽 글은 운영판처럼 wall을 뺀 API 표기(-<소유자>_<번호>)로도 받는다(카본 끝 판 A1 · A2의 A2).
  assert.equal((await send('https://vk.ru/synklab_ru','-243082040_456239019','https://vk.ru/wall-243082040_456239019')).status,201);
  // 공개 클립 목록에서는 클립만, 커뮤니티 첫 화면에서는 벽 글만 받는다. 클립 값이 같은 숫자의 벽 글에 붙지 않는다(GPT 끝 판 GA2).
  assert.equal((await send(list,'wall-243082040_456239018','https://vk.ru/wall-243082040_456239018')).body.code,'SYNK_EXTERNAL_POST');
  assert.equal((await send('https://vk.ru/synklab_ru','clip-243082040_456239018',clip)).body.code,'SYNK_EXTERNAL_POST');
  // 공개 클립 목록은 게시물 목록이라 계정 누적값으로 적지 못한다.
  const listAsAccount=await f.request(`/api/channels/${vk}/external-observations`,{sourceType:'public-page',sourceUrl:list,observedAt,evidenceSha256:sha('vk list as account'),identity:{accountId:'lab-ru-vk',handle:'synklab_ru'},observations:[{kind:'account-lifetime',metrics:{followers:1}}]});
  assert.equal(listAsAccount.body.code,'SYNK_EXTERNAL_METRIC_GRAIN');
  assert.deepEqual(f.app.store.all('posts').filter(row=>row.channelId===vk).map(row=>row.id).sort(),[`${vk}:clip-243082040_456239018`,`${vk}:wall-243082040_456239018`,`${vk}:wall-243082040_456239019`]);
  const snapshot=f.app.store.all('snapshots').find(row=>row.postId===`${vk}:clip-243082040_456239018`);
  assert.deepEqual([snapshot.views,snapshot.likes,snapshot.comments,snapshot.shares,snapshot.saves],[21,0,0,0,null]);
});
