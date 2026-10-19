import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {CLASSROOM_CONTRACT_VER,classroomEndpoint,normalizeClassroomClasses,requestClassrooms} from '../classroom-client.mjs';
import {CLASSROOM_STATUS_LABELS,CLASSROOM_STATUS_HELP,CLASSROOM_TEXT,groupClassroomSessions,classroomDate,classroomTone,safeClassroomLink} from '../classroom-lessons.mjs';
import {createWorldAccount} from '../world-account.mjs';
const require=createRequire(import.meta.url);
const root=fileURLToPath(new URL('../../../',import.meta.url));
// 형제 저장소 SYNK-talk: 공용 작업본 옆, 또는 Claude 앱 워크트리(.claude/worktrees/<이름>)라면 본 작업본 옆.
const talkRoot=[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/수업영상.js')));
const A='11111111-1111-4111-8111-111111111111';
const URL_='https://project.example.test/functions/v1/classroom';
const reply=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>{if(body===undefined)throw new SyntaxError('not json');return body;}});
const envelope=(status,code)=>reply(status,{contract_ver:'c16',ok:false,error:{code,message:'합성 오류',retryable:status>=500}});
const listed=(classes,extra={})=>reply(200,{contract_ver:'c16',ok:true,classes,empty_reason:classes.length?null:'NO_ACTIVE_CLASS_ACCESS',server_time:'2027-03-09T10:31:00.000Z',...extra});
const watch=id=>`https://www.youtube.com/watch?v=${id}`;
const sample=()=>[{class_id:'c1',display_name:'합성 · TOPIK 4급 온라인 1기',video_privacy:'private',playlist_url:null,meeting_url:'https://meet.google.com/abc-defg-hij',
 sessions:[{session_key:'w3-tue',title:'3주차 화요일 · 읽기 — 글의 중심 생각 찾기',starts_at:'2027-03-23T10:30:00.000Z',ends_at:null,status:'live',watch_url:watch('AAAAAAAAAAA')}]}];
const ask=(fetch,extra={})=>requestClassrooms({url:URL_,publishableKey:'sb_publishable_fixture',token:()=>'token-a',fetch,...extra});

test('수업 요청은 학생 앱 통로와 같은 모양이다: GET · Bearer · apikey · 계약판 c16, 본문·쿼리·Content-Type 없음',async()=>{
 const calls=[];const result=await ask(async(url,init)=>{calls.push({url,init});return listed(sample());});
 assert.equal(calls.length,1);const [{url,init}]=calls;
 assert.equal(url,URL_);assert.equal(new URL(url).search,'');
 assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.credentials,'omit');assert.equal(init.cache,'no-store');assert.equal(init.redirect,'error');
 assert.deepEqual(init.headers,{apikey:'sb_publishable_fixture',Authorization:'Bearer token-a','X-Contract-Ver':'c16'});
 assert.equal(CLASSROOM_CONTRACT_VER,'c16');assert.equal(result.emptyReason,null);assert.equal(result.classes[0].sessions[0].status,'live');
});
test('계정 API 주소에서 같은 프로젝트의 classroom 주소를 만든다(쿼리·조각은 버린다)',()=>{
 for(const base of ['https://p.example.test','https://p.example.test/','https://p.example.test/functions/v1','https://p.example.test/functions/v1/','https://p.example.test/functions/v1/synk-account','https://p.example.test/functions/v1/synk-world-v1?x=1#y'])
  assert.equal(classroomEndpoint(base),'https://p.example.test/functions/v1/classroom',base);
});
test('함수가 낸 401 AUTH_REQUIRED는 학생 명부에 없는 계정이라 빈 목록이다 — 토큰 갱신도 로그아웃도 하지 않는다',async()=>{
 let renewed=0;const result=await ask(async()=>envelope(401,'AUTH_REQUIRED'),{renew:async()=>{renewed++;return 'token-b';}});
 assert.deepEqual(result,{classes:[],emptyReason:'NO_LEARNER'});assert.equal(renewed,0);
});
test('게이트웨이 401(봉투 없음)은 한 번만 갱신해 새 토큰으로 다시 묻는다',async()=>{
 let token='token-a',renewed=0;const seen=[];
 const result=await ask(async(url,init)=>{seen.push(init.headers.Authorization);return seen.length===1?reply(401,{code:'UNAUTHORIZED_INVALID_JWT_FORMAT',message:'Invalid JWT'}):listed(sample());},
  {token:()=>token,renew:async()=>{renewed++;token='token-b';return token;}});
 assert.equal(renewed,1);assert.deepEqual(seen,['Bearer token-a','Bearer token-b']);assert.equal(result.classes.length,1);
 let calls=0;await assert.rejects(ask(async()=>{calls++;return reply(401,{message:'Invalid JWT'});},{renew:async()=>'token-b'}),{code:'AUTH_EXPIRED',status:401});assert.equal(calls,2);
 calls=0;await assert.rejects(ask(async()=>{calls++;return reply(401,{message:'Invalid JWT'});},{renew:async()=>null}),{code:'AUTH_EXPIRED'});assert.equal(calls,1);
});
test('계약판·서버·응답 꼴 오류는 코드로 알린다',async()=>{
 await assert.rejects(ask(async()=>envelope(426,'CONTRACT_VER_UNSUPPORTED')),{code:'CONTRACT_VER_UNSUPPORTED',status:426});
 await assert.rejects(ask(async()=>envelope(500,'SERVER_ERROR')),{code:'SERVER_ERROR',status:500});
 await assert.rejects(ask(async()=>reply(502,undefined)),{code:'CLASSROOM_UNAVAILABLE',status:502});
 await assert.rejects(ask(async()=>reply(200,{ok:true,classes:{}})),{code:'CONTRACT_VIOLATION'});
 await assert.rejects(ask(async()=>reply(200,{ok:false})),{code:'CLASSROOM_UNAVAILABLE'});
 await assert.rejects(ask(async()=>{throw new TypeError('Failed to fetch');}),TypeError);
});
test('응답 뒤 계정이 바뀌면 그 답을 쓰지 않는다',async()=>{
 let changed=false;
 await assert.rejects(ask(async()=>{changed=true;return listed(sample());},{guard:()=>{if(changed)throw Object.assign(Error('바뀜'),{code:'ACCOUNT_CHANGED'});}}),{code:'ACCOUNT_CHANGED'});
});
test('서버가 보인 칸만 남기고 꼴이 틀린 반·수업은 뺀다',()=>{
 const classes=normalizeClassroomClasses([null,{display_name:'반 ID 없음'},{class_id:'c1',display_name:7,video_privacy:'unlisted',playlist_url:'https://www.youtube.com/playlist?list=PLaaaaaaaaaa',meeting_url:null,secret:'x',
  sessions:[{session_key:'a',title:'제목',starts_at:'2027-03-09T10:30:00.000Z',ends_at:null,status:'ready',watch_url:watch('BBBBBBBBBBB'),youtube_video_id:'BBBBBBBBBBB',private_access_confirmed_at:'x'},{session_key:'b'},{title:'키 없음'},'문자열',{session_key:'c',title:'상태 없음',status:5}]}]);
 assert.deepEqual(classes,[{class_id:'c1',display_name:'',video_privacy:'unlisted',playlist_url:'https://www.youtube.com/playlist?list=PLaaaaaaaaaa',meeting_url:null,
  sessions:[{session_key:'a',title:'제목',starts_at:'2027-03-09T10:30:00.000Z',ends_at:null,status:'ready',watch_url:watch('BBBBBBBBBBB')},{session_key:'c',title:'상태 없음',starts_at:null,ends_at:null,status:'',watch_url:null}]}]);
 assert.deepEqual(normalizeClassroomClasses([{class_id:'c2',sessions:'x'}])[0].sessions,[]);
});

// ── WORLD 계정 객체 ──
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/portal/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const storage=()=>{const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
function accountFixture({fetcher,requestToken=async()=>{throw Error('unexpected token refresh');}}){
 const tab=storage(),calls=[];let invalidations=0;
 tab.setItem('synk.oauth.session.world',JSON.stringify({access_token:'token-a',refresh_token:'refresh-a',expires_at:Date.now()+3600000}));
 const account=createWorldAccount({config,storage:tab,getUrl:()=>'https://world.example.test/world/',replaceUrl:()=>{},navigate:()=>{},bridge:null,requestToken,onInvalidate:()=>{invalidations++;},
  accountFactory:()=>({load:async()=>({ok:true,account:{synk_user_id:A,status:'active'},sessions:[{id:'session-a',current:true,revoked:false}]})}),
  fetcher:async(url,init)=>{calls.push({url,init});return fetcher(url,init);}});
 return {account,tab,calls,invalidations:()=>invalidations};
}
test('WORLD 계정은 자기 SYNK ID 토큰으로 수업을 읽고, 반이 없는 계정의 401에도 로그인을 지킨다',async()=>{
 const f=accountFixture({fetcher:async()=>envelope(401,'AUTH_REQUIRED')});
 assert.equal(await f.account.restore(),true);assert.equal(f.account.supportsClassroom,true);
 assert.deepEqual(await f.account.readClassrooms(),{classes:[],emptyReason:'NO_LEARNER'});
 assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'https://identity.example.test/functions/v1/classroom');
 assert.equal(f.calls[0].init.headers.Authorization,'Bearer token-a');assert.equal(f.calls[0].init.headers['X-Contract-Ver'],'c16');assert.ok(f.calls[0].init.signal instanceof AbortSignal);
 assert.equal(f.invalidations(),0);assert.ok(f.tab.getItem('synk.oauth.session.world'));assert.equal(f.account.identity().accountId,A);
 // 같은 401이라도 WORLD 계정 요청(bootstrap)은 지금처럼 세션을 끝낸다 — 수업 조회만 다르게 다룬다.
 const g=accountFixture({fetcher:async()=>reply(401,{ok:false,error:{code:'AUTH_REQUIRED'}}),requestToken:async()=>({access_token:'token-b',refresh_token:'refresh-b',expires_at:Date.now()+3600000})});await g.account.restore();
 await g.account.request('bootstrap');assert.equal(g.invalidations(),1);assert.equal(g.tab.getItem('synk.oauth.session.world'),null);
});
test('WORLD 계정은 게이트웨이 401에 세션을 한 번 갱신해 다시 묻고, 새 토큰을 저장한다',async()=>{
 const f=accountFixture({fetcher:async(url,init)=>init.headers.Authorization==='Bearer token-a'?reply(401,{code:'UNAUTHORIZED_INVALID_JWT_FORMAT',message:'Invalid JWT'}):listed(sample()),
  requestToken:async(cfg,body)=>{assert.equal(body.grant_type,'refresh_token');assert.equal(body.refresh_token,'refresh-a');return {access_token:'token-b',refresh_token:'refresh-b',expires_at:Date.now()+3600000};}});
 await f.account.restore();const result=await f.account.readClassrooms();
 assert.equal(result.classes.length,1);assert.deepEqual(f.calls.map(c=>c.init.headers.Authorization),['Bearer token-a','Bearer token-b']);
 assert.equal(JSON.parse(f.tab.getItem('synk.oauth.session.world')).access_token,'token-b');assert.equal(f.invalidations(),0);
});
test('로그인 전에는 묻지 않고, PC 앱(본체가 토큰을 가진 native)에서는 본체 경로가 없어 부르지 않는다',async()=>{
 const f=accountFixture({fetcher:async()=>listed(sample())});
 await assert.rejects(f.account.readClassrooms(),{code:'AUTH_REQUIRED'});assert.equal(f.calls.length,0);
 let bridgeCalls=0;const native=createWorldAccount({config,storage:storage(),getUrl:()=>'https://world.example.test/world/',bridge:{accountRequest:async()=>{bridgeCalls++;return {ok:true};},authStatus:async()=>({})}});
 assert.equal(native.supportsClassroom,false);await assert.rejects(native.readClassrooms(),{code:'CLASSROOM_UNSUPPORTED'});assert.equal(bridgeCalls,0);
});

// ── 화면 규칙(DOM 없이 보는 부분). 실제 그리기·30초·탭 복귀는 classroom-lessons-browser.test.mjs가 본다. ──
test('학생 앱 차례로 묶는다: 실시간 · 확인 필요 · 예정(빠른 순) · 복습(최근 순), 모르는 상태는 어느 묶음에도 넣지 않는다',()=>{
 const row=(key,status,at)=>({session_key:key,title:key,starts_at:at,status});
 const g=groupClassroomSessions([row('r1','ready','2027-03-02T10:30:00Z'),row('s2','scheduled','2027-03-30T10:30:00Z'),row('l','live','2027-03-23T10:30:00Z'),row('p','processing','2027-03-18T10:30:00Z'),
  row('s1','scheduled','2027-03-25T10:30:00Z'),row('i','interrupted','2027-03-23T10:30:00Z'),row('a','access_pending','2027-03-25T10:30:00Z'),row('u','unavailable','2027-03-04T10:30:00Z'),row('f','failed','2027-03-11T10:30:00Z'),row('r2','ready','2027-03-16T10:30:00Z'),row('x','mystery','2027-03-01T10:30:00Z')]);
 assert.deepEqual(Object.fromEntries(Object.entries(g).map(([k,v])=>[k,v.map(r=>r.session_key)])),{live:['l'],attention:['i','a','u','f'],scheduled:['s1','s2'],replay:['p','r2','r1']});
 assert.equal(classroomTone('live'),'live');assert.equal(classroomTone('ready'),'ok');assert.equal(classroomTone('access_pending'),'check');assert.equal(classroomTone('mystery'),'idle');
});
test('날짜는 학생 앱과 같은 ko-KR 표기이고, 빈 값·잘못된 값은 비운다',()=>{
 const at='2027-03-23T10:30:00.000Z';
 assert.equal(classroomDate(at),new Date(at).toLocaleString('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}));
 assert.match(classroomDate(at),/3월 23일/);for(const value of [null,undefined,'',7,'어제'])assert.equal(classroomDate(value),'');
});
test('여는 주소는 유튜브 영상·재생목록과 Meet·Zoom 회의만 받는다',()=>{
 for(const url of [watch('AAAAAAAAAAA'),'https://www.youtube.com/playlist?list=PLaaaaaaaaaa','https://meet.google.com/abc-defg-hij','https://zoom.us/j/123456789','https://us02web.zoom.us/j/987'])assert.equal(safeClassroomLink(url),true,url);
 for(const url of ['http://www.youtube.com/watch?v=AAAAAAAAAAA','https://youtube.com/watch?v=AAAAAAAAAAA','https://www.youtube.com/watch?v=short','https://www.youtube.com:8443/watch?v=AAAAAAAAAAA','https://u:p@www.youtube.com/watch?v=AAAAAAAAAAA',
  'https://www.youtube.com/embed/AAAAAAAAAAA','https://www.youtube.com.example.test/watch?v=AAAAAAAAAAA','https://meet.google.com/ABC-defg-hij','https://meet.google.com/abc-defg-hij/x','https://zoom.us/j/12a','https://evilzoom.us/j/1','javascript:alert(1)','',null,undefined])
  assert.equal(safeClassroomLink(url),false,String(url));
});

test('앱 셸이 같은 폴더에서 부르는 파일은 개발 서버와 공개 빌드 목록에 모두 있다(빠지면 앱 셸 import가 404로 멈춘다)',()=>{
 const shell=fs.readFileSync(path.join(root,'experiences/synk-world-app/app-shell.mjs'),'utf8');
 const local=[...shell.matchAll(/from\s*'\.\/([\w.-]+\.mjs)'/g)].map(m=>m[1]).filter(name=>name!=='enrollment.mjs');
 const server=fs.readFileSync(path.join(root,'experiences/synk-world-app/server.mjs'),'utf8'),build=fs.readFileSync(path.join(root,'tools/build-world-app-public.mjs'),'utf8');
 const served=server.match(/else if\(\[('\/world-bootstrap\.js'[^\]]*)\]\.includes\(pathname\)\)base=root;/),copied=build.match(/for\(const name of \[('world-bootstrap\.js'[^\]]*)\]\)copyFile\(path\.join\(root,'experiences\/synk-world-app',name\),name\);/);
 assert.ok(served&&copied,'목록 줄 모양이 바뀌었다');
 for(const name of ['classroom-lessons.mjs',...local]){assert.ok(served[1].includes(`'/${name}'`),'개발 서버 '+name);assert.ok(copied[1].includes(`'${name}'`),'공개 빌드 '+name);}
});

// ── 학생 앱과 같은 뜻인지: 형제 저장소의 원문과 직접 대조한다(없는 사본에서는 건너뛴다) ──
const studentScreen=talkRoot&&path.join(talkRoot,'src/수업영상화면.js');
const skipStudent=!studentScreen||!fs.existsSync(studentScreen)?'SYNK-talk 학생 앱 수업 화면(src/수업영상화면.js)이 이 PC에 없다':false;
test('상태 이름·안내·화면 문구가 학생 앱 원문과 같다',{skip:skipStudent},()=>{
 const source=fs.readFileSync(studentScreen,'utf8');
 const pairs=name=>{const block=source.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\};`));assert.ok(block,name);return Object.fromEntries([...block[1].matchAll(/(\w+):\s*'([^']*)'/g)].map(m=>[m[1],m[2]]));};
 assert.deepEqual(pairs('상태말'),{...CLASSROOM_STATUS_LABELS});assert.deepEqual(pairs('상태안내'),{...CLASSROOM_STATUS_HELP});
 for(const [key,value] of Object.entries(CLASSROOM_TEXT)){
  if(key==='loading'){assert.ok(source.includes('수업 불러오는 중'),key);continue;}
  for(const part of value.split('\n'))assert.ok(source.includes(part),`${key}: ${part}`);
 }
 assert.ok(source.includes("상태말[r.status] || '확인 중'"),'모르는 상태의 이름');
 assert.ok(source.includes('setInterval(refresh, 30000)'),'30초 자동 확인');
 assert.ok(source.includes("['interrupted', 'access_pending', 'unavailable', 'failed']"),'확인이 필요한 수업 묶음');
});
test('계약판과 회의 주소 규칙이 학생 앱·서버 원문과 같다',{skip:skipStudent},()=>{
 const contract=fs.readFileSync(path.join(talkRoot,'src/계약판.js'),'utf8').match(/export const 계약판 = '(c\d+)';/);assert.ok(contract);assert.equal(CLASSROOM_CONTRACT_VER,contract[1]);
 const media=require(path.join(talkRoot,'lib/수업영상.js'));
 for(const url of ['https://meet.google.com/abc-defg-hij','https://meet.google.com/abc-defg-hi','https://meet.google.com/abc-defg-hij?authuser=1','https://zoom.us/j/1','https://a-b.zoom.us/j/22','https://a.b.zoom.us/j/3','https://zoom.us/j/x','http://zoom.us/j/1','https://zoom.us:8443/j/1','https://u@zoom.us/j/1','https://example.test/j/1'])
  assert.equal(safeClassroomLink(url),media.validMeetingUrl(url),url);
});
test('서버 presentClass가 낼 수 있는 상태는 모두 이름이 있고, 안내가 필요한 상태는 학생 앱과 같은 안내를 단다',{skip:skipStudent},()=>{
 const media=require(path.join(talkRoot,'lib/수업영상.js')),now=Date.parse('2027-03-23T10:40:00.000Z');
 const rows=[];for(const status of media.STATES)for(const blocked of [false,true])for(const confirmed of [null,'2027-03-01T00:00:00Z'])for(const synced of ['2027-03-23T10:39:00.000Z','2027-03-23T10:00:00.000Z'])
  rows.push({session_key:`${status}-${blocked}-${!!confirmed}-${synced.slice(14,16)}`,title:'합성',starts_at:'2027-03-23T10:30:00.000Z',ends_at:status==='ready'?'2027-03-23T12:00:00.000Z':null,status,youtube_video_id:'AAAAAAAAAAA',synced_at:synced,private_access_confirmed_at:confirmed,playback_blocked:blocked});
 for(const privacy of ['private','unlisted']){
  const presented=media.presentClass({class_id:'c1',class_key:'TOPIK4',display_name:'합성 반',youtube_playlist_id:'PLaaaaaaaaaa',meeting_url:null,video_privacy:privacy,has_blocked_session:false},rows,now);
  const [normalized]=normalizeClassroomClasses([JSON.parse(JSON.stringify(presented))]);assert.equal(normalized.sessions.length,rows.length);
  for(const session of normalized.sessions){
   assert.ok(CLASSROOM_STATUS_LABELS[session.status],session.status);
   if(session.watch_url)assert.equal(safeClassroomLink(session.watch_url),true);
   const g=groupClassroomSessions([session]);assert.equal(Object.values(g).flat().length,1,`${session.status}는 한 묶음에 들어간다`);
  }
 }
});
