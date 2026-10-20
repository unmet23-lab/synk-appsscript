import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {homeworkWindow,homeworkWeek,homeworkDate,homeworkLength,markSegments,readingOutcome,missingFields,homeworkDraftKey,HOMEWORK_TEXT} from '../classroom-homework.mjs';
import {normalizeHomeworkClasses,homeworkReply,homeworkUnavailable,homeworkSubmission,HOMEWORK_CODES,HOMEWORK_VERDICTS,HOMEWORK_COURSE} from '../homework-client.mjs';
import {createWorldAccount} from '../world-account.mjs';
import {homeworkLength as converterLength} from '../../../tools/build-topik4-homework.mjs';
// 「이번 주 과제」(내 계정 시트): 주차·마감 규칙, 서버 답 거르기, 내기 본문, WORLD 계정 통로(웹·PC 앱)를 DOM 없이 본다.
// 실제 그리기·내기·첨삭 보기·390/1280 측정은 classroom-homework-browser.test.mjs가 본다. 학생 글·이름은 모두 합성이다.
const require=createRequire(import.meta.url);
const root=fileURLToPath(new URL('../../../',import.meta.url));
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const content=JSON.parse(read('experiences/synk-world-app/topik4-homework.json'));
const key=JSON.parse(read('experiences/synk-world-app/topik4-homework-key.json'));
const A='11111111-1111-4111-8111-111111111111',C='33333333-3333-4333-8333-333333333333',REQ='44444444-4444-4444-8444-444444444444';
const START='2027-03-06';
// SYNK-talk 과제 서버(lib/synk-classroom-homework.js)가 있는 사본이면 같은 주차·마감인지 직접 대조한다(지금은 claude/class-homework-20261020 가지).
const talkRoot=[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-worktrees/talk-class-homework-20261020')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/synk-classroom-homework.js')));

test('주차·마감: 반 시작일 0시(한국)부터 7일씩, 그 주 첫 수요일 23:00 — 기기 시간대와 상관없이',()=>{
 const w1=homeworkWindow(START,1),w3=homeworkWindow(START,3),w8=homeworkWindow(START,8);
 assert.equal(new Date(w1.start).toISOString(),'2027-03-05T15:00:00.000Z');assert.equal(new Date(w1.due).toISOString(),'2027-03-10T14:00:00.000Z');
 assert.equal(new Date(w3.due).toISOString(),'2027-03-24T14:00:00.000Z');assert.equal(new Date(w8.end).toISOString(),'2027-04-30T15:00:00.000Z');
 assert.equal(new Date(homeworkWindow('2027-03-10',1).due).toISOString(),'2027-03-17T14:00:00.000Z','수요일에 시작하면 다음 주 수요일');
 assert.equal(homeworkWindow('2027-3-6',1),null);assert.equal(homeworkWindow(null,1),null);
 const at=text=>Date.parse(text);
 assert.deepEqual(homeworkWeek({startsOn:null,now:at('2027-03-08T00:00:00Z')}),{phase:'unset',week:0,opened:0});
 assert.equal(homeworkWeek({startsOn:START,now:at('2027-03-05T14:59:59Z')}).phase,'before');
 assert.deepEqual(homeworkWeek({startsOn:START,now:at('2027-03-05T15:00:00Z')}),{phase:'active',week:1,opened:1,start:at('2027-03-05T15:00:00Z')});
 assert.equal(homeworkWeek({startsOn:START,now:at('2027-03-29T01:00:00Z')}).week,4);
 assert.deepEqual({...homeworkWeek({startsOn:START,weeks:8,now:at('2027-04-30T15:00:00Z')}),start:0},{phase:'done',week:8,opened:8,start:0});
 assert.equal(homeworkDate(w1.due),new Date(w1.due).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',month:'long',day:'numeric',weekday:'short',hour:'numeric',minute:'2-digit'}));
 assert.match(homeworkDate(w1.due),/3월 10일 \(수\) 오후 11:00/);
});
test('주차·마감이 SYNK-talk 과제 서버와 같다',{skip:!talkRoot&&'과제 서버(lib/synk-classroom-homework.js)가 있는 SYNK-talk 사본이 없다'},()=>{
 const server=require(path.join(talkRoot,'lib/synk-classroom-homework.js'));
 for(const startsOn of ['2027-03-06','2027-03-10','2026-12-05','2027-01-02'])for(let week=1;week<=8;week++)assert.deepEqual(homeworkWindow(startsOn,week),server.homeworkWindow(startsOn,week),`${startsOn} ${week}주`);
 assert.deepEqual([...HOMEWORK_CODES],[...server.CODES]);assert.deepEqual([...HOMEWORK_VERDICTS],[...server.VERDICTS]);assert.deepEqual(Object.keys(server.COURSES),[HOMEWORK_COURSE]);
});
test('글자 수는 수업 자료 검산·변환기와 같은 규칙이고, 기호·판정 이름은 첨삭 기준에서 옮긴 것과 같다',()=>{
 for(const sample of ['','가나다\n\n라마','é x',' ,. \r\n'])assert.equal(homeworkLength(sample),converterLength(sample));
 assert.deepEqual([...HOMEWORK_CODES].sort(),Object.keys(content.feedback.codes).sort());assert.deepEqual([...HOMEWORK_VERDICTS],content.feedback.verdicts);
 assert.deepEqual(content.feedback.comment,['잘된 점','고칠 핵심','다시 써 볼 곳']);
 assert.equal(content.version,key.version);assert.deepEqual(content.schedule,{weeks:8,dueWeekday:3,dueTime:'23:00',timeZone:'Asia/Seoul',utcOffset:'+09:00'});
});
test('첨삭 표시는 그 칸 글에서 처음 나오는 겹치지 않는 자리에만, 못 찾은 표시는 목록에만 남는다',()=>{
 const text='한빛대학교 언어교육원에서 유학생 400명을 조사했습니다. 2026년 63%이 되었다.';
 const segs=markSegments(text,[{quote:'조사했습니다',code:'체'},{quote:'63%이',code:'조'},{quote:'없는 말',code:'자'},{quote:'조사했',code:'맞'}]);
 assert.equal(segs.map(s=>s.text).join(''),text);
 assert.deepEqual(segs.filter(s=>s.mark!==undefined).map(s=>[s.text,s.mark]),[['조사했습니다',0],['63%이',1]]);
 assert.deepEqual(markSegments('',[{quote:'x',code:'체'}]),[]);
 assert.deepEqual(markSegments('가가',[{quote:'가',code:'체'},{quote:'가',code:'조'}]).map(s=>s.mark),[0,1],'같은 글귀를 두 번 표시하면 다음 자리로');
});
test('읽기 결과와 빈 칸: 정답 자료가 없으면 맞음을 정하지 않고, 표는 모든 칸이 차야 낸다',()=>{
 const items=content.weeks[0].reading.items;
 const outcome=readingOutcome(items,{'R1-1':3,'R1-2':2},key);
 assert.deepEqual(outcome.slice(0,3).map(o=>[o.id,o.chosen,o.answer,o.correct]),[['R1-1',3,3,true],['R1-2',2,1,false],['R1-3',null,4,false]]);
 assert.ok(readingOutcome(items,{'R1-1':3},null).every(o=>o.answer===null&&o.correct===false));
 const fields=content.weeks[4].writing.parts[0].fields;
 const answers={'W5-1.1':[['조별 과제','-지만'],['책임감','우선'],['','그러나'],['역할','-려면'],['성장','이처럼']],'W5-1.2':'서론'};
 assert.deepEqual(missingFields(fields,answers).map(m=>m.label),['개요 본론 2(질문 2) · 쓸 내용']);
 assert.deepEqual(missingFields(fields,{}).length,11);
 assert.equal(homeworkDraftKey(A,C,'W3'),`synk.world.homework.v1:${A}:${C}:W3`);
 assert.equal(HOMEWORK_TEXT.title,'이번 주 과제');
});

// ── 서버 답 거르기(synk-classroom GET/POST /api/world/homework의 camelCase 봉투) ──
const feedback={returnedAt:'2027-03-25T09:00:00.000Z',parts:{'W3-1':{marks:[{field:'W3-1.1',quote:'조사했습니다',code:'체'},{field:'W3-1.1',quote:'x',code:'뭐'},{field:'W2-1.1',quote:'x',code:'체'}],
 comment:{good:'두 해의 비율을 정확히 옮겼어요.',fix:'자료에 없는 내용이에요.〔자〕',retry:'한 문장으로 다시 써 보세요.',extra:'x'},fields:{'W3-1.1':{verdict:'좋음'}}},'W4-1':{comment:{good:'다른 주'}}}};
const klass=(extra={})=>({classId:C,name:'합성 · TOPIK 4급 온라인 1기',course:'topik4-online',startsOn:START,weeks:8,planRevision:1,submissions:[
 {week:3,kind:'reading',answers:{'R3-1':2,'R3-2':4},retry:{},revision:1,submittedAt:'2027-03-21T01:00:00.000Z',late:false,contentVersion:content.version,feedback:null},
 {week:3,kind:'writing',answers:{'W3-1.1':'합성 글'},retry:{'W2-1':'다시 쓴 문장','W3-1':'같은 주'},revision:2,submittedAt:'2027-03-22T01:00:00.000Z',late:true,contentVersion:content.version,feedback},
 {week:9,kind:'reading',answers:{},revision:1},{week:2,kind:'reading',answers:{'R3-1':1},revision:1},{week:2,kind:'writing',answers:{'W2-1.1':7},revision:1},'문자열'],...extra});
test('서버 답은 화면이 쓰는 꼴만 남긴다: 반·제출·첨삭의 꼴이 틀린 것은 빼고, 첨삭은 그 주 칸·11개 기호·판정 셋·한마디 세 줄만',()=>{
 const [c]=normalizeHomeworkClasses([klass(),{...klass(),classId:'not-uuid'},{...klass(),course:'topik3'},null]);
 assert.deepEqual({...c,submissions:undefined},{classId:C,name:'합성 · TOPIK 4급 온라인 1기',course:'topik4-online',startsOn:START,weeks:8,submissions:undefined});
 assert.deepEqual(c.submissions.map(s=>`${s.week}:${s.kind}`),['3:reading','3:writing']);
 const w=c.submissions[1];assert.deepEqual(w.retry,{'W2-1':'다시 쓴 문장'});assert.equal(w.late,true);
 assert.deepEqual(w.feedback,{returnedAt:'2027-03-25T09:00:00.000Z',parts:{'W3-1':{fields:{},marks:[{field:'W3-1.1',quote:'조사했습니다',code:'체'}],comment:{good:'두 해의 비율을 정확히 옮겼어요.',fix:'자료에 없는 내용이에요.〔자〕',retry:'한 문장으로 다시 써 보세요.'}}}});
 assert.equal(c.submissions[0].feedback,null,'읽기에는 첨삭이 없다');
 assert.equal(normalizeHomeworkClasses([{...klass(),startsOn:'2027-3-6'}])[0].startsOn,null);
 // 겹친 제출은 판이 높은 것 하나
 const [dup]=normalizeHomeworkClasses([klass({submissions:[{week:1,kind:'writing',answers:{'W1-1.1':'첫 판'},revision:1},{week:1,kind:'writing',answers:{'W1-1.1':'둘째 판'},revision:2}]})]);
 assert.deepEqual(dup.submissions.map(s=>s.answers['W1-1.1']),['둘째 판']);
});
test('봉투: 성공은 반 목록, 실패는 코드·상태, 과제 경로가 없는 옛 서버와 꺼진 반 기능은 「칸 없음」',()=>{
 assert.deepEqual(homeworkReply({ok:true,accountId:A,classes:[klass()],emptyReason:null}).classes.length,1);
 assert.deepEqual(homeworkReply({ok:true,classes:[],emptyReason:'NO_CLASS'}),{classes:[],emptyReason:'NO_CLASS'});
 assert.throws(()=>homeworkReply({ok:true,classes:{}},200),{code:'CONTRACT_VIOLATION'});
 assert.throws(()=>homeworkReply({ok:false,code:'REVISION_CONFLICT',error:{code:'REVISION_CONFLICT'},revision:2},409),{code:'REVISION_CONFLICT',status:409});
 assert.throws(()=>homeworkReply(null,502),{code:'HOMEWORK_UNAVAILABLE',status:502});
 for(const [code,status] of [['CLASS_REQUIRED',400],['NOT_FOUND',404],['HOMEWORK_UNAVAILABLE',404],['CLASSROOM_UNAVAILABLE',403],['HOMEWORK_UNSUPPORTED',undefined]])assert.equal(homeworkUnavailable({code,status}),true,code);
 for(const [code,status] of [['HOMEWORK_UNAVAILABLE',502],['SERVER_UNAVAILABLE',500],['FORBIDDEN',403],['AUTH_REQUIRED',401],[undefined,undefined]])assert.equal(homeworkUnavailable({code,status}),false,String(code));
});
test('내기 본문: 서버가 받는 꼴 그대로 — 그 주 문항·칸만, 쓰기에만 지난주 「다시 써 볼 곳」',()=>{
 const base={classId:C,week:3,kind:'writing',requestId:REQ,expectedRevision:0,contentVersion:content.version};
 assert.deepEqual(homeworkSubmission({...base,answers:{'W3-1.1':'글'},retry:{'W2-1':'  다시 쓴 문장 ','W3-1':'같은 주','W2-2':'   '}}),
  {...base,answers:{'W3-1.1':'글'},retry:{'W2-1':'다시 쓴 문장'}});
 assert.deepEqual(homeworkSubmission({...base,kind:'reading',answers:{'R3-1':2},retry:{'W2-1':'x'}}),{...base,kind:'reading',answers:{'R3-1':2}});
 for(const bad of [{classId:'x'},{week:0},{kind:'speaking'},{requestId:'x'},{expectedRevision:-1},{contentVersion:'v2'},{answers:{}},{answers:{'W2-1.1':'다른 주'}},{answers:{'W3-1.1':'가'.repeat(4001)}}])
  assert.throws(()=>homeworkSubmission({...base,answers:{'W3-1.1':'글'},...bad}),TypeError,JSON.stringify(bad));
});

// ── WORLD 계정 통로: 반 연결과 같은 synk-classroom(웹은 이 탭의 SYNK ID 토큰) ──
const config={version:1,supabaseUrl:'https://identity.example.test',supabasePublishableKey:'sb_publishable_fixture',accountApiUrl:'https://identity.example.test',portalUrl:'https://identity.example.test/portal/',clients:{world:{clientId:'world-browser',redirectUri:'https://world.example.test/world/'}}};
const storage=()=>{const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
const reply=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>{if(body===undefined)throw new SyntaxError('not json');return body;}});
function accountFixture(fetcher){
 const tab=storage(),calls=[];let invalidations=0;
 tab.setItem('synk.oauth.session.world',JSON.stringify({access_token:'token-a',refresh_token:'refresh-a',expires_at:Date.now()+3600000}));
 const account=createWorldAccount({config,storage:tab,getUrl:()=>'https://world.example.test/world/',replaceUrl:()=>{},navigate:()=>{},bridge:null,onInvalidate:()=>{invalidations++;},
  requestToken:async()=>({access_token:'token-b',refresh_token:'refresh-b',expires_at:Date.now()+3600000}),
  accountFactory:()=>({load:async()=>({ok:true,account:{synk_user_id:A,status:'active'},sessions:[{id:'session-a',current:true,revoked:false}]})}),
  fetcher:async(url,init)=>{calls.push({url,init});return fetcher(url,init,calls.length);}});
 return {account,tab,calls,invalidations:()=>invalidations};
}
test('웹: 과제 읽기는 synk-classroom /api/world/homework(쿼리 없음), 내기는 classId 쿼리와 같은 본문이고 이 계정의 답만 쓴다',async()=>{
 const listed={ok:true,mode:'account-linked',accountId:A,classes:[klass()],emptyReason:null};
 const f=accountFixture(async(url,init)=>reply(200,init.method==='POST'?{...listed,duplicate:false,submission:{week:3,kind:'writing',revision:1,late:false}}:listed));
 assert.equal(await f.account.restore(),true);assert.equal(f.account.supportsHomework,true);
 const read=await f.account.readHomework();assert.equal(read.classes.length,1);
 const get=f.calls[0];assert.equal(get.url,'https://identity.example.test/functions/v1/synk-classroom/api/world/homework');assert.equal(get.init.method,'GET');assert.equal(get.init.body,undefined);
 assert.deepEqual({apikey:get.init.headers.apikey,auth:get.init.headers.Authorization,product:get.init.headers['X-SYNK-Product'],contract:get.init.headers['X-SYNK-Contract']},{apikey:'sb_publishable_fixture',auth:'Bearer token-a',product:'world',contract:'1'});
 const input={classId:C,week:3,kind:'writing',requestId:REQ,expectedRevision:0,contentVersion:content.version,answers:{'W3-1.1':'합성 글'},retry:{'W2-1':'다시'}};
 await f.account.submitHomework(input);
 const post=f.calls[1];assert.equal(post.url,`https://identity.example.test/functions/v1/synk-classroom/api/world/homework?classId=${C}`);assert.equal(post.init.method,'POST');
 assert.deepEqual(JSON.parse(post.init.body),homeworkSubmission(input));assert.equal(post.init.headers['Content-Type'],'application/json');
 assert.equal(f.invalidations(),0);
 // 다른 계정의 답은 쓰지 않는다(다른 계정 요청과 같은 울타리).
 const g=accountFixture(async()=>reply(200,{...listed,accountId:'55555555-5555-4555-8555-555555555555'}));await g.account.restore();
 await assert.rejects(g.account.readHomework(),{code:'ACCOUNT_MISMATCH'});
});
test('웹: 과제 경로가 아직 없는 서버·꺼진 반 기능은 빈 목록(칸 숨김)이고, 서버 오류는 알리며, 어느 쪽도 로그인을 끊지 않는다',async()=>{
 for(const [status,body] of [[400,{ok:false,code:'CLASS_REQUIRED',error:{code:'CLASS_REQUIRED'}}],[404,{ok:false,code:'HOMEWORK_UNAVAILABLE',error:{code:'HOMEWORK_UNAVAILABLE'}}],[403,{ok:false,code:'CLASSROOM_UNAVAILABLE',error:{code:'CLASSROOM_UNAVAILABLE'}}]]){
  const f=accountFixture(async()=>reply(status,body));await f.account.restore();
  assert.deepEqual(await f.account.readHomework(),{classes:[],emptyReason:'UNAVAILABLE'},String(status));assert.equal(f.invalidations(),0);
 }
 const e=accountFixture(async()=>reply(500,{ok:false,code:'SERVER_UNAVAILABLE',error:{code:'SERVER_UNAVAILABLE'}}));await e.account.restore();
 await assert.rejects(e.account.readHomework(),{code:'SERVER_UNAVAILABLE',status:500});assert.equal(e.invalidations(),0);
 const conflict=accountFixture(async(url,init)=>init.method==='POST'?reply(409,{ok:false,code:'REVISION_CONFLICT',error:{code:'REVISION_CONFLICT'},revision:2}):reply(200,{ok:true,accountId:A,classes:[]}));await conflict.account.restore();
 await assert.rejects(conflict.account.submitHomework({classId:C,week:3,kind:'reading',requestId:REQ,expectedRevision:0,contentVersion:content.version,answers:{'R3-1':2}}),{code:'REVISION_CONFLICT',status:409});
 const f=accountFixture(async()=>reply(200,{ok:true,accountId:A,classes:[]}));
 await assert.rejects(f.account.readHomework(),{code:'AUTH_REQUIRED'},'로그인 전에는 묻지 않는다');assert.equal(f.calls.length,0);
});

// ── PC 앱(native): 토큰은 본체에만. 본체가 환경에 homework·homework/submit을 알릴 때만 칸을 연다(desktop/src/world-requests.cjs). ──
function nativeFixture({routes,answer=async()=>{throw Error('과제를 묻지 않아야 한다');}}={}){
 const calls=[];let invalidations=0;
 const bridge={getEnvironment:async()=>({clientId:'world',...(routes===undefined?{}:{worldRoutes:routes})}),
  authStatus:async()=>({configured:true,signedIn:true,status:'signed-in',sessionGeneration:1,account:{synk_user_id:A}}),
  onAuthChanged:()=>()=>{},authSignIn:async()=>({ok:true}),authSignOut:async()=>({ok:true,serverRevoked:true}),
  accountRequest:async(operation,params={})=>{calls.push({operation,params});
   if(operation==='load')return {ok:true,account:{synk_user_id:A,status:'active'},sessions:[]};
   if(operation==='worldRequest'&&String(params.route).startsWith('homework'))return answer(params);
   throw Error('본체에 뜻밖의 요청: '+operation);}};
 const account=createWorldAccount({config,bridge,storage:storage(),getUrl:()=>'https://world.example.test/world/',onInvalidate:()=>{invalidations++;},
  fetcher:()=>{throw Error('PC 앱은 토큰으로 직접 묻지 않는다');},navigate:()=>{throw Error('PC 앱은 브라우저 로그인을 쓰지 않는다');}});
 return {account,calls:()=>calls.filter(c=>c.operation==='worldRequest'),invalidations:()=>invalidations};
}
test('옛 PC 앱(과제 경로를 알리지 않음)에서는 칸을 숨기고 본체에 묻지 않는다',async()=>{
 for(const routes of [undefined,['bootstrap','classroom'],['homework'],'homework']){
  const f=nativeFixture({routes});assert.equal(await f.account.restore(),true);assert.equal(f.account.supportsHomework,false,JSON.stringify(routes));
  await assert.rejects(f.account.readHomework(),{code:'HOMEWORK_UNSUPPORTED'});await assert.rejects(f.account.submitHomework({}),{code:'HOMEWORK_UNSUPPORTED'});assert.equal(f.calls().length,0);f.account.stop();
 }
});
test('새 PC 앱은 본체의 homework 경로로 읽고, 내기에는 반 번호를 붙이며, 본체가 넘긴 실패는 그 요청만 실패한다',async()=>{
 const listed={ok:true,mode:'account-linked',accountId:A,classes:[klass()],emptyReason:null};let answer=async()=>listed;
 const f=nativeFixture({routes:['bootstrap','classroom','homework','homework/submit'],answer:params=>answer(params)});
 assert.equal(await f.account.restore(),true);assert.equal(f.account.supportsHomework,true);
 assert.equal((await f.account.readHomework()).classes.length,1);assert.deepEqual(f.calls()[0].params,{route:'homework'});
 const input={classId:C,week:3,kind:'reading',requestId:REQ,expectedRevision:0,contentVersion:content.version,answers:{'R3-1':2}};
 await f.account.submitHomework(input);assert.deepEqual(f.calls()[1].params,{route:'homework/submit',body:homeworkSubmission(input),classId:C});
 answer=async()=>({ok:false,error:{code:'CLASS_REQUIRED',status:400}});assert.deepEqual(await f.account.readHomework(),{classes:[],emptyReason:'UNAVAILABLE'});
 answer=async()=>({ok:false,error:{code:'WEEK_NOT_OPEN',status:409}});await assert.rejects(f.account.submitHomework(input),{code:'WEEK_NOT_OPEN'});
 assert.equal(f.invalidations(),1,'처음 연결 한 번뿐 — 과제 실패는 계정을 끊지 않는다');
 // 본체 답을 기다리는 사이 로그아웃하면 그 답을 쓰지 않는다.
 let release;answer=()=>new Promise(resolve=>{release=()=>resolve(listed);});
 const pending=f.account.readHomework();await new Promise(resolve=>setTimeout(resolve,0));await f.account.logout();release();
 await assert.rejects(pending,{code:'ACCOUNT_CHANGED'});f.account.stop();
});

test('앱 셸이 부르는 과제 파일·자료는 개발 서버와 공개 빌드 목록에 모두 있다(빠지면 공개본에서 칸이 404로 멈춘다)',()=>{
 const server=read('experiences/synk-world-app/server.mjs'),build=read('tools/build-world-app-public.mjs'),shell=read('experiences/synk-world-app/app-shell.mjs');
 const served=server.match(/else if\(\[('\/world-bootstrap\.js'[^\]]*)\]\.includes\(pathname\)\)base=root;/),copied=build.match(/for\(const name of \[('world-bootstrap\.js'[^\]]*)\]\)copyFile\(path\.join\(root,'experiences\/synk-world-app',name\),name\);/);
 assert.ok(served&&copied,'목록 줄 모양이 바뀌었다');
 for(const name of ['classroom-homework.mjs','topik4-homework.json','topik4-homework-key.json']){assert.ok(served[1].includes(`'/${name}'`),'개발 서버 '+name);assert.ok(copied[1].includes(`'${name}'`),'공개 빌드 '+name);}
 for(const name of ['topik4-homework.json','topik4-homework-key.json'])assert.ok(shell.includes(`homeworkJson('${name}')`),'앱 셸이 '+name+'을 읽는다');
 assert.match(shell,/<div id="world-classroom-lessons"><\/div><div id="world-classroom-homework"><\/div><div id="world-classroom-entry"><\/div>/,'우리 반 수업 바로 아래, 반 연결 위');
 // 계정 묶음은 새 통로를 담고 있다(node tools/build-world-account.mjs --check가 원천과 같은지 본다).
 const bundle=read('experiences/synk-world-app/world-account.bundle.mjs');for(const name of ['readHomework','submitHomework','supportsHomework','homeworkSubmission'])assert.ok(bundle.includes(name),name);
});
