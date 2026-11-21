// PULSE 「인플루언서 광고」 창의 채널 명단(조각 ①, 2026-11-21). 설계 docs/디자인/PULSE고객경험_20261120/인플루언서_의뢰창_설계.md 9절.
// 이 시험의 사람 · 채널은 모두 합성이다.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {createCompanyApp} from './server.mjs';
import {createPulsePeople,PEOPLE_SEED,PULSE_PEOPLE_KIND,castingImage,CASTING_IMAGES} from './pulse-people.mjs';
import {createPulsePeopleRoutes} from './pulse-people-routes.mjs';
import {readPulseFeatures,PULSE_FEATURE_DEFAULTS,createPulseFeatures} from './pulse-features.mjs';

const memoryStore=(users={u1:{id:'u1',active:true,role:'admin'},u2:{id:'u2',active:true,role:'member'}})=>{const map=new Map();return {map,get:(kind,id)=>kind==='users'?users[id]??null:map.get(kind+'/'+id)??null,put:(kind,id,value)=>map.set(kind+'/'+id,value)};};
const realChannel=(extra={})=>({id:'',name:'합성 카페 채널',platform:'instagram',handle:'@synthetic.cafe',url:'https://www.instagram.com/synthetic.cafe/',topics:['food'],audience:'합성 시청자',followers:12000,avgViews:3400,prices:{post:300000,review:null},image:'',samples:[],virtual:false,example:false,active:true,...extra});
function service({people=true,users}={}){
  const store=memoryStore(users),flags={people};
  return {store,flags,svc:createPulsePeople({store,clientProjects:{session:token=>{if(token!=='ok')throw Object.assign(new Error('세션'),{status:401});return {row:{id:'p1'}};}},features:{read:()=>({people:flags.people})},clock:()=>'2026-11-21T12:00:00.000Z',randomId:()=>'abc12345'})};
}
const refuses=(fn,pattern,status=400)=>assert.throws(fn,error=>error.status===status&&pattern.test(error.message),String(pattern));

test('처음 명단은 캐스팅북 가상 인물 여섯이고 예시라 손님에게 보이지 않는다(스위치를 켜도)',()=>{
  assert.deepEqual(PEOPLE_SEED.map(item=>item.name),['하린','유나','채원','소연','민재','준호']);
  for(const item of PEOPLE_SEED){
    assert.equal(item.example,true);assert.equal(item.virtual,true);assert.equal(item.followers,null);assert.deepEqual(item.prices,{post:null,review:null});
    assert.ok(castingImage(item.image),item.image);assert.ok(item.samples.length&&item.samples.every(castingImage));
  }
  assert.equal(CASTING_IMAGES.some(item=>item.model==='M03'&&PEOPLE_SEED.some(seed=>seed.image===item.images[0])),false,'창업자 기반 모델은 넣지 않는다');
  const {svc,flags}=service();
  assert.equal(svc.visible(),false,'예시 칸뿐이면 창이 없다');
  refuses(()=>svc.customerList('ok'),/고객 요청을 찾을 수 없습니다/,404);
  const view=svc.adminView({id:'u1'});assert.equal(view.version,0);assert.equal(view.seed,true);assert.equal(view.entries.length,6);assert.equal(view.enabled,true);assert.equal(view.visible,false);
  flags.people=false;assert.equal(svc.adminView({id:'u1'}).enabled,false);
});

test('관리자만 읽고 쓴다',()=>{
  const {svc}=service();
  refuses(()=>svc.adminView({id:'u2'}),/관리자만/,403);refuses(()=>svc.adminView({id:'nobody'}),/로그인/,401);
  refuses(()=>svc.save({id:'u2'},{version:0,entries:[]}),/관리자만/,403);
});

test('저장: 실제 채널은 주소가 있어야 하고 캐스팅북 얼굴을 쓸 수 없다. 모르는 칸 · 꼴이 틀린 값은 400, 판 번호가 다르면 409',()=>{
  const {svc,store}=service(),admin={id:'u1'};
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({url:''})]}),/채널 주소\(https\)가 있어야/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({image:PEOPLE_SEED[0].image})]}),/캐스팅북 그림을 쓸 수 없어요/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({samples:[PEOPLE_SEED[0].samples[0]]})]}),/캐스팅북 그림을 쓸 수 없어요/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({url:'http://www.instagram.com/x'})]}),/채널 주소를 확인/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({url:'https://user:pw@example.com/'})]}),/채널 주소를 확인/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({virtual:true,image:'https://example.com/a.png'})]}),/대표 그림을 확인/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({secret:1})]}),/꼴을 확인/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({topics:[]})]}),/주제를 확인/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({topics:['food','food']})]}),/주제를 확인/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({topics:['food','beauty','daily','home']})]}),/주제를 확인/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({platform:'facebook'})]}),/플랫폼을 확인/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({prices:{post:-1}})]}),/게시 값을 확인/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({followers:1.5})]}),/팔로워 수를 확인/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({name:'  '})]}),/이름을 확인/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({name:'줄\n바꿈'})]}),/이름을 확인/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({id:'BAD'})]}),/id를 확인/);
  refuses(()=>svc.save(admin,{version:0,entries:[realChannel({id:'ch_same1'}),realChannel({id:'ch_same1'})]}),/같은 id/);
  refuses(()=>svc.save(admin,{version:0,entries:Array.from({length:61},()=>realChannel())}),/60개까지/);
  refuses(()=>svc.save(admin,{version:0,entries:[],extra:1}),/저장할 명단을 확인/);
  refuses(()=>svc.save(admin,{version:3,entries:[]}),/다른 화면에서 명단이 바뀌었어요/,409);
  // 예시 칸 다섯 + 실제 채널 하나를 저장한다. 새 칸의 id는 서버가 만든다.
  const saved=svc.save(admin,{version:0,entries:[...PEOPLE_SEED.slice(0,5).map(item=>structuredClone(item)),realChannel()]});
  assert.equal(saved.version,1);assert.equal(saved.seed,false);assert.equal(saved.entries[5].id,'ch_abc12345');
  assert.equal(store.map.get(PULSE_PEOPLE_KIND+'/main').updatedBy,'u1');
  refuses(()=>svc.save(admin,{version:0,entries:[]}),/다른 화면에서/,409);
  assert.equal(svc.visible(),true);
  const list=svc.customerList('ok');
  assert.deepEqual(list.entries.map(item=>item.name),['합성 카페 채널'],'손님에게는 켜짐이고 예시가 아닌 칸만');
  assert.deepEqual(Object.keys(list.entries[0]).sort(),['audience','avgViews','followers','handle','id','image','name','platform','prices','samples','topics','url','virtual'],'예시 · 켜짐 · 고친 사람은 싣지 않는다');
  refuses(()=>svc.customerList('ok','?x=1'),/주소를 확인/);refuses(()=>svc.customerList('bad'),/세션/,401);
  // 그 칸을 끄면 다시 창이 없다.
  svc.save(admin,{version:1,entries:svc.adminView(admin).entries.map(item=>({...item,active:item.example?item.active:false}))});
  assert.equal(svc.visible(),false);
});

test('한글 주소는 저장할 꼴(인코딩)로 길이를 재고, 저장한 뒤 다시 읽어도 명단이 깨지지 않는다(카본 A1 · GPT GA1)',()=>{
  const {svc}=service(),admin={id:'u1'};
  const korean='https://blog.example.com/category/집에서-즐기는-계절별-디저트와-홈카페-음료-레시피/간단한-아침식사와-주말-브런치';
  const saved=svc.save(admin,{version:0,entries:[realChannel({url:korean})]});
  assert.ok(saved.entries[0].url.length>300,String(saved.entries[0].url.length));assert.equal(saved.broken,false);
  assert.equal(svc.visible(),true);assert.equal(svc.adminView(admin).entries[0].url,saved.entries[0].url);assert.equal(svc.customerList('ok').entries.length,1);
  refuses(()=>svc.save(admin,{version:1,entries:[realChannel({url:'https://example.com/'+'가'.repeat(120)})]}),/채널 주소를 확인/);
  assert.equal(svc.adminView(admin).version,1,'거절한 저장은 남기지 않는다');
});

test('깨진 명단 문서는 손님에게 빈 명단(창 없음)이고 그 위에 덮어쓰지 않는다',()=>{
  const {svc,store}=service();
  store.put(PULSE_PEOPLE_KIND,'main',{version:2,entries:[{name:'꼴이 틀림'}]});
  assert.equal(svc.visible(),false);const view=svc.adminView({id:'u1'});assert.equal(view.broken,true);assert.deepEqual(view.entries,[]);
  refuses(()=>svc.save({id:'u1'},{version:2,entries:[]}),/읽지 못해 저장을 멈췄어요/,409);
});

test('캐스팅북에서 빠진 그림은 그 칸의 그림만 비우고 명단은 살린다(Fable F5)',()=>{
  const {svc,store}=service();
  const kept={...structuredClone(PEOPLE_SEED[0]),image:'./assets/casting/gone-v1.webp',samples:[PEOPLE_SEED[0].samples[0],'./assets/casting/gone-v2.webp']};
  store.put(PULSE_PEOPLE_KIND,'main',{version:4,entries:[kept]});
  const view=svc.adminView({id:'u1'});assert.equal(view.broken,false);assert.equal(view.entries[0].image,'');assert.deepEqual(view.entries[0].samples,[PEOPLE_SEED[0].samples[0]]);
  assert.equal(svc.save({id:'u1'},{version:4,entries:view.entries}).version,5,'고쳐 저장할 수 있다');
  // 캐스팅북 그림 꼴이 아닌 값(객체 · 다른 주소)은 고쳐 읽지 않는다 — 깨진 문서로 보고 덮어쓰지 않는다(GPT 다시 검수 GA1).
  // 개수 · 겹침은 빠진 그림을 비우기 전의 원래 배열로 잰다(GPT 다시 검수 GA1 — 둘째 회차).
  const keepOne=PEOPLE_SEED[0].samples[0];
  for(const bad of [{samples:[keepOne,{src:keepOne}]},{samples:['https://example.com/a.webp']},{image:{src:PEOPLE_SEED[0].image}},{image:'https://example.com/a.webp'},
    {samples:[keepOne,'./assets/casting/gone-1.webp','./assets/casting/gone-2.webp','./assets/casting/gone-3.webp']},{samples:[keepOne,'./assets/casting/gone-1.webp','./assets/casting/gone-1.webp']}]){
    store.put(PULSE_PEOPLE_KIND,'main',{version:6,entries:[{...structuredClone(PEOPLE_SEED[0]),...bad}]});
    assert.equal(svc.adminView({id:'u1'}).broken,true,JSON.stringify(bad));refuses(()=>svc.save({id:'u1'},{version:6,entries:[]}),/읽지 못해 저장을 멈췄어요/,409);
  }
});

test('스위치 people은 기본 끔이고 공개 · 프로젝트 보기에는 싣지 않는다',()=>{
  assert.equal(PULSE_FEATURE_DEFAULTS.people,false);
  assert.equal(readPulseFeatures({people:true}).people,true);assert.equal(readPulseFeatures({people:'yes'}).people,false);
  // 켠 뒤에도 공개 의뢰서와 프로젝트 보기에는 없다 — 손님 방의 people은 server.mjs가 고를 칸까지 보고 정한다(GPT GA3).
  const store=memoryStore(),features=createPulseFeatures({store,clock:()=>'2026-11-21T12:00:00.000Z'});
  assert.equal(features.configure({id:'u1'},{people:true}).people,true);assert.equal(features.read().people,true);
  assert.equal('people' in features.publicView(),false);assert.equal('people' in features.projectView({contactLocale:'ko'}),false);assert.equal('people' in features.projectView(null),false);
  refuses(()=>features.configure({id:'u2'},{people:false}),/관리자만/,403);
});

async function server(t){
  const directory=await mkdtemp(join(tmpdir(),'synk-pulse-people-app-'));
  const options={dataDir:join(directory,'server'),clientIntakeDir:join(directory,'inbox'),host:'127.0.0.1',port:0,origin:'http://127.0.0.1:0',allowTestHost:true,schedule:false,workNotificationsEnabled:false,webPushEnabled:false,synkIdentityConfig:null,synkCustomerIdentityConfig:null,pulseRequestFreeBytes:async()=>100*1024**3};
  const app=createCompanyApp(options),address=await app.start(),base='http://127.0.0.1:'+address.port;
  t.after(async()=>{await app.stop();assert.equal(dirname(resolve(directory)),resolve(tmpdir()));await rm(directory,{recursive:true,force:true});});
  const person=(name,email,role,csrf)=>{const row=app.store.createUser({name,email,role,teamId:'team-a'});return {row,id:row.id,csrf,token:app.store.mint('session',row.id,{csrfToken:csrf},120)};};
  const admin=person('관리자','admin@people-synthetic.test','admin','csrf-admin'),member=person('담당자','member@people-synthetic.test','member','csrf-member');
  const parse=async response=>{const text=await response.text();let data=null;try{data=JSON.parse(text);}catch{}return {status:response.status,data,text};};
  const staff=(who,path,{body,method=body===undefined?'GET':'POST',origin=app.origin,csrf=who?.csrf,headers={}}={})=>fetch(base+path,{method,headers:{...(who?{Cookie:'synk_company_session='+who.token}:{}),...(csrf?{'X-CSRF-Token':csrf}:{}),...(origin?{Origin:origin}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)}).then(parse);
  function customer(){
    const jar=new Map();
    return async function call(path,{body}={}){
      const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(jar.size?{Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; ')}:{}),Origin:app.origin,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
      for(const line of response.headers.getSetCookie?.()||[]){const [pair,...rest]=line.split(';'),[name,value]=pair.split('=');if(value&&!/max-age=0/i.test(rest.join(';')))jar.set(name,value);else jar.delete(name);}
      return parse(response);
    };
  }
  const project=app.clientProjects.save(admin.row,{title:'합성 프로젝트',customerName:'합성 고객',ownerId:member.id,dueDate:'2026-12-01'}).project;
  async function open(){const row=app.store.get('clientProjects',project.id),invite=app.clientProjects.invite(admin.row,project.id,{revision:row.revision}).invite,call=customer(),opened=await call('/pulse/api/open',{body:{invite}});assert.equal(opened.status,200,opened.text);return {call,opened};}
  const audits=action=>app.store.all('audit').filter(row=>row.action===action);
  return {app,admin,member,staff,customer,open,audits};
}

test('관리자 경로: 로그인 · 권한 · 출처 · CSRF · 시범 · 질의 · 방법을 보고, 저장하면 감사 기록이 남는다',async t=>{
  const f=await server(t);
  assert.equal((await f.staff(null,'/api/pulse-people')).status,401);
  assert.equal((await f.staff(f.member,'/api/pulse-people')).status,403);
  const view=await f.staff(f.admin,'/api/pulse-people');assert.equal(view.status,200,view.text);assert.equal(view.data.entries.length,6);assert.equal(view.data.version,0);
  assert.ok(view.data.casting.length>=20&&view.data.topics.includes('food'));
  assert.equal((await f.staff(f.admin,'/api/pulse-people?x=1')).status,400);
  assert.equal((await f.staff(f.admin,'/api/pulse-people',{headers:{'X-Synk-Demo':'1'}})).status,403);
  const body={version:0,entries:[...view.data.entries,realChannel()]};
  assert.equal((await f.staff(f.admin,'/api/pulse-people/roster',{body,origin:'https://evil.example'})).status,403);
  assert.equal((await f.staff(f.admin,'/api/pulse-people/roster',{body,csrf:'wrong'})).status,403);
  assert.equal((await f.staff(f.admin,'/api/pulse-people/roster',{body,csrf:null})).status,403);
  assert.equal((await f.staff(f.member,'/api/pulse-people/roster',{body})).status,403);
  assert.equal((await f.staff(f.admin,'/api/pulse-people/roster',{method:'GET'})).status,405);
  assert.equal((await f.staff(f.admin,'/api/pulse-people',{body:{}})).status,405);
  const saved=await f.staff(f.admin,'/api/pulse-people/roster',{body});assert.equal(saved.status,200,saved.text);assert.equal(saved.data.version,1);
  assert.equal((await f.staff(f.admin,'/api/pulse-people/roster',{body})).status,409,'같은 판 번호로 두 번 저장하면 409');
  const audit=f.audits('pulse-people-roster-saved');assert.equal(audit.length,1);
  // 스위치가 꺼진 채 고를 칸을 저장했으면 고를 칸은 1, 손님에게는 아직 안 보인다(GPT GA2).
  assert.equal(audit[0].selectable,1);assert.equal(audit[0].visible,false);
  assert.equal((await f.staff(f.admin,'/api/pulse-people/other')).status,404);
});

test('손님: 스위치가 꺼졌거나 고를 채널이 없으면 features.people이 거짓이고 /pulse/api/people은 404. 켜고 실제 채널이 있으면 그 칸만 보인다',async t=>{
  const f=await server(t);
  const g=await f.open();
  assert.equal(g.opened.data.features.people,false);
  assert.equal((await g.call('/pulse/api/people')).status,404);
  assert.equal((await f.staff(f.admin,'/api/settings/pulse-features',{body:{people:true}})).status,200);
  assert.equal(f.audits('pulse-features-settings').at(-1).people,true,'스위치 감사 기록에 people 값');
  assert.equal((await g.call('/pulse/api/project')).data.features.people,false,'예시 칸뿐이면 여전히 거짓');
  assert.equal((await g.call('/pulse/api/people')).status,404);
  const view=await f.staff(f.admin,'/api/pulse-people');
  assert.equal((await f.staff(f.admin,'/api/pulse-people/roster',{body:{version:0,entries:[...view.data.entries,realChannel()]}})).status,200);
  assert.equal((await g.call('/pulse/api/project')).data.features.people,true);
  const list=await g.call('/pulse/api/people');assert.equal(list.status,200,list.text);assert.deepEqual(list.data.entries.map(item=>item.name),['합성 카페 채널']);
  assert.equal(list.text.includes('updatedBy')||list.text.includes('"example"'),false);
  assert.equal((await g.call('/pulse/api/people?x=1')).status,400);
  assert.equal((await f.customer()('/pulse/api/people')).status,401,'손님 세션이 없으면 401');
  assert.equal((await f.staff(f.admin,'/api/settings/pulse-features',{body:{people:false}})).status,200);
  assert.equal((await g.call('/pulse/api/project')).data.features.people,false);assert.equal((await g.call('/pulse/api/people')).status,404);
});

test('경로 모듈: 다른 주소는 넘기고, 멈추는 중이면 503, 몸통을 읽는 사이 세션이 바뀌면 저장하지 않는다',async()=>{
  let sessionNow={user:{id:'u1'},hash:'h1',body:{csrfToken:'c1'}},saved=0;
  const routes=createPulsePeopleRoutes({service:{adminView:()=>({}),save:()=>{saved++;return {version:1,entries:[]};}},body:async()=>{sessionNow={user:{id:'u1'},hash:'h2',body:{csrfToken:'c1'}};return {};},send:()=>{},session:()=>sessionNow,origin:'http://o',audit:()=>{}});
  assert.equal(await routes({method:'GET',headers:{}},{}, {url:new URL('http://o/api/other')}),false);
  await assert.rejects(routes({method:'POST',headers:{origin:'http://o','x-csrf-token':'c1'}},{}, {url:new URL('http://o/api/pulse-people/roster')}),error=>error.status===401);
  assert.equal(saved,0);
  const stopped=createPulsePeopleRoutes({service:{},body:async()=>({}),send:()=>{},session:()=>sessionNow,origin:'http://o',audit:()=>{},isStopped:()=>true});
  await assert.rejects(stopped({method:'GET',headers:{}},{}, {url:new URL('http://o/api/pulse-people')}),error=>error.status===503);
});
