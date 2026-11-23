// 네이버 블로그 글의 누적 조회수(post-lifetime) 기록 시험(2026-11-23). 합성 저장소와 서버만 쓴다. 운영 데이터와 외부 주소는 열지 않는다.
// 글 숫자는 블로그 주인이 로그인해 연 글 목록(blog.naver.com/<아이디>, creator-screen)에서만 받는다. 공개 화면(public-page)의 글 관측은 받지 않는다.
// 같은 파일에 VK 벽 글 소유자 대조 시험 한 건을 둔다(11-19 Fable 설계 검토 P2): 커뮤니티 번호가 없는 VK 계정은 벽 글도 받지 않는다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createCompanyApp} from './server.mjs';
import {accountCatalog} from './account-catalog.mjs';
import {createExternalObservations} from './external-observations.mjs';

const DAY_MS=86400000;
const sha=text=>createHash('sha256').update(text).digest('hex');

async function fixture(t,options={}){
  const directory=await mkdtemp(join(tmpdir(),'synk-external-naver-'));
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
  return {app,admin,request,register};
}

test('Naver blog post views come only from the owner post list on the registered blog, never from a public page',async t=>{
  const f=await fixture(t),blog=(await f.register(['shift-naverblog']))['shift-naverblog'];
  const observedAt=new Date(Date.now()-20*60000).toISOString(),publishedAt=new Date(Date.now()-2*DAY_MS).toISOString();let count=0;
  const list='https://blog.naver.com/synkshift',postUrl='https://blog.naver.com/synkshift/224478068429';
  const post=(metrics,url=postUrl,externalId='224478068429')=>[{kind:'post-lifetime',post:{externalId,url,publishedAt},metrics}];
  const send=(sourceType,sourceUrl,observations)=>f.request(`/api/channels/${blog}/external-observations`,{sourceType,sourceUrl,observedAt,evidenceSha256:sha('naver '+(count++)),identity:{accountId:'shift-naverblog',handle:'synkshift'},observations});
  // 다른 블로그의 목록, 글 하나의 주소, 모바일 주소, 내보내기로 적은 목록은 주인 글 목록이 아니다.
  // 글 번호를 쿼리에 단 옛 글 링크(?Redirect=Log&logNo=…)도 글 하나의 주소다(GPT GA2).
  for(const [sourceType,url] of [['creator-screen','https://blog.naver.com/someone'],['creator-screen',postUrl],['creator-screen','https://m.blog.naver.com/synkshift'],['official-export',list],
    ['creator-screen',list+'?Redirect=Log&logNo=224478068429'],['creator-screen',list+'?logno=224478068429']])
    assert.equal((await send(sourceType,url,post({views:5}))).body.code,'SYNK_EXTERNAL_SOURCE',sourceType+' '+url);
  // 공개 화면에서 읽은 글 관측은 조회수가 없어도 받지 않는다. 공개 화면의 계정 값은 그대로 받는다.
  for(const url of [list,postUrl,'https://blog.naver.com/PostView.naver?blogId=synkshift&logNo=224478068429'])
    assert.equal((await send('public-page',url,post({comments:1}))).body.code,'SYNK_EXTERNAL_SOURCE',url);
  assert.equal((await send('public-page',list,[{kind:'account-lifetime',metrics:{followers:3}}])).status,201);
  // 다른 통계 화면과 공식 내보내기의 글 관측도 받지 않는다. 같은 날 목록의 조회수를 빈칸으로 덮지 못한다(GPT GA1). 그 화면의 계정 값은 그대로 받는다.
  for(const [sourceType,url] of [['official-export','https://admin.blog.naver.com/synkshift/stat/download'],['creator-screen','https://admin.blog.naver.com/synkshift/stat/today'],['creator-screen','https://creator-advisor.naver.com/naver_blog/synkshift/stat']])
    assert.equal((await send(sourceType,url,post({views:5,comments:1}))).body.code,'SYNK_EXTERNAL_SOURCE',sourceType+' '+url);
  const day=new Date(Date.parse(observedAt)+9*3600000).toISOString().slice(0,10);
  assert.equal((await send('official-export','https://admin.blog.naver.com/synkshift/stat/download',[{kind:'account-period',period:{start:day,end:day},metrics:{views:9}}])).status,201);
  // 주인 글 목록은 글 누적값만, 글마다 숫자 조회수와 함께 받는다. 다른 블로그의 글은 받지 않는다.
  assert.equal((await send('creator-screen',list,[{kind:'account-lifetime',metrics:{followers:3}}])).body.code,'SYNK_EXTERNAL_METRIC_GRAIN');
  for(const metrics of [{comments:1},{views:null,comments:1}])
    assert.equal((await send('creator-screen',list,post(metrics))).body.code,'SYNK_EXTERNAL_SOURCE',JSON.stringify(metrics));
  assert.equal((await send('creator-screen',list,post({views:5},'https://blog.naver.com/someone/224478068429'))).body.code,'SYNK_EXTERNAL_POST');
  assert.deepEqual(f.app.store.all('posts').filter(row=>row.channelId===blog),[]);
  const saved=await send('creator-screen',list+'?categoryNo=0',post({views:41,comments:2}));
  assert.equal(saved.status,201,JSON.stringify(saved.body));
  assert.equal(saved.body.records[0].sourceUrl,list);
  assert.equal(saved.body.records[0].projection.state,'projected');
  const stored=f.app.store.all('posts').filter(row=>row.channelId===blog);
  assert.deepEqual(stored.map(row=>[row.id,row.source]),[[`${blog}:224478068429`,'external:creator-screen']]);
  const snapshot=f.app.store.all('snapshots').find(row=>row.postId===`${blog}:224478068429`);
  assert.deepEqual([snapshot.views,snapshot.comments,snapshot.source],[41,2,'external:creator-screen']);
});

test('a VK account without a known community number cannot record wall posts, while the registered community still can',async t=>{
  const f=await fixture(t),observedAt=new Date(Date.now()-20*60000).toISOString(),publishedAt=new Date(Date.now()-2*DAY_MS).toISOString();let count=0;
  // 원장에 커뮤니티 번호가 없는 합성 VK 계정 하나를 더한다. VK_COMMUNITY_IDS에도 없다.
  const extra={...accountCatalog.accounts.find(row=>row.id==='lab-ru-vk'),id:'lab-xx-vk',handle:'synklab_xx',publicUrl:'https://vk.ru/synklab_xx',externalId:null};
  const service=createExternalObservations({store:f.app.store,catalog:{...accountCatalog,accounts:[...accountCatalog.accounts,extra]}});
  for(const [id,accountId,publicUrl] of [['vk-known','lab-ru-vk','https://vk.ru/synklab_ru'],['vk-unknown','lab-xx-vk','https://vk.ru/synklab_xx']])
    f.app.store.put('channels',id,{id,platform:'vk',publicUrl,canonicalUrl:null,handle:null,catalogAccountId:accountId,ownerIds:[f.admin.id],teamId:null,active:true,status:'not-connected'});
  const record=(id,accountId,handle,externalId)=>service.record(f.admin,{id},{sourceType:'public-page',sourceUrl:`https://vk.ru/${handle}`,observedAt,evidenceSha256:sha('vk owner '+(count++)),identity:{accountId,handle},
    observations:[{kind:'post-lifetime',post:{externalId,url:`https://vk.ru/${externalId}`,publishedAt},metrics:{views:9}}]});
  assert.equal(record('vk-known','lab-ru-vk','synklab_ru','wall-243082040_45').created.length,1);
  for(const externalId of ['wall-243082040_45','wall-1_45','wall123_45'])
    assert.throws(()=>record('vk-unknown','lab-xx-vk','synklab_xx',externalId),{code:'SYNK_EXTERNAL_POST'},externalId);
  assert.deepEqual(f.app.store.all('posts').filter(row=>row.channelId==='vk-unknown'),[]);
});
