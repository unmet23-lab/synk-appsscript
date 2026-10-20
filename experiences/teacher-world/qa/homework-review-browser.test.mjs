import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
// 내 수업 「과제 첨삭」(homework-review.mjs)을 실제 Chrome으로 연다.
// · 교사 화면은 계정 모드(/teacher-world/?account=1) iframe이고, 부모 쪽 수업 호스트는 실제 계정 포털 통로(synk-account/src/classroom-client.mjs)다.
// · 과제 서버는 SYNK-talk 가지 claude/class-homework-20261020의 실제 synk-classroom 서비스 + lib/synk-classroom-homework.js를
//   PGlite(메모리 PostgreSQL)에 실제 마이그레이션을 부어 돌린다. 운영 서버·DB·계정은 쓰지 않는다. 학생은 모두 합성(이름 끝 「(합성)」), 글도 합성이다.
// · 정적 파일은 회사 워크스페이스 server.mjs의 교사 화면 목록을 그대로 읽어 같은 주소·같은 CSP로 내보낸다(목록에 빠진 파일을 여기서 잡는다).
// · 시계는 Date만 옮긴다(2027-03-26 금요일 10시 = 3주차 첨삭 날, 마지막에 5주차). 캡처·result.json은 SYNK_HOMEWORK_REVIEW_QA_OUT(기본 qa/homework-review-20261020/), 캡처는 git 밖.
const root=fileURLToPath(new URL('../../../',import.meta.url)),require=createRequire(import.meta.url);
let playwright;try{playwright=require('playwright');}catch{try{playwright=require(path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));}catch{playwright=null;}}
const talkRoot=[process.env.SYNK_TALK_ROOT,path.resolve(root,'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-talk'),path.resolve(root.split(/[\\/]\.claude[\\/]worktrees[\\/]/)[0],'../SYNK-worktrees/talk-class-homework-20261020')]
 .filter(Boolean).map(p=>path.resolve(p)).find(p=>fs.existsSync(path.join(p,'lib/synk-classroom-homework.js'))&&fs.existsSync(path.join(p,'tools/qa-synk-classroom-fixture.cjs')));
const out=path.resolve(process.env.SYNK_HOMEWORK_REVIEW_QA_OUT||path.join(root,'experiences/teacher-world/qa/homework-review-20261020'));
const content=JSON.parse(fs.readFileSync(path.join(root,'experiences/synk-world-app/topik4-homework.json'),'utf8'));
const KST=text=>Date.parse(text+'+09:00'),START='2027-03-06',VERSION=content.version;
const VIEWPORTS=[{tag:'1280',viewport:{width:1280,height:800}},{tag:'390',viewport:{width:390,height:844}}];
const COMPANY='docs/마케팅/온라인마케팅지도/engagement/company/';

// ── 합성 글: 53번(3주차)에서 흔한 실수(문체 섞기 · %와 %포인트 · 자료에 없는 원인)를 일부러 넣었다. 실제 학생 글이 아니다. ──
const W3={
 l1:'한빛대학교 언어교육원에서 2022년과 2026년에 외국인 유학생 400명을 대상으로 아르바이트에 대해 조사했습니다. 조사 결과 아르바이트를 하는 유학생은 2022년 48%에서 2026년 63%로 15% 증가했다.\n\n아르바이트를 하는 이유는 생활비 마련이 52%로 가장 많았고 한국어 연습이 27%, 경력 쌓기가 15%였다. 요즘 물가가 많이 올랐기 때문이다. 이처럼 아르바이트를 하는 유학생이 늘고 있다.',
 l2:'한빛대학교 언어교육원이 외국인 유학생 400명에게 아르바이트에 대해 물었다. 아르바이트를 한다는 응답은 2022년 48%였지만 2026년에는 63%로 늘었다. 아르바이트를 하는 이유로는 생활비 마련이 52%로 1위였고 한국어 연습 27%, 경력 쌓기 15%가 뒤를 이었다. 유학생들은 아르바이트를 너무 많이 한다.',
 l3a:'조사 결과 아르바이트를 하는 유학생이 많아졌다. 2022년에는 48%, 2026년에는 63% 이었다. 이유는 생활비 마련 52%, 한국어 연습 27%, 경력 쌓기 15% 이었다. 그래서 유학생은 돈이 필요하다.',
 l3b:'한빛대학교 언어교육원에서 유학생 400명을 대상으로 조사한 결과 아르바이트를 하는 유학생이 2022년 48%에서 2026년 63%로 증가했다. 이유는 생활비 마련이 52%로 가장 높았고 한국어 연습 27%, 경력 쌓기 15% 순이었다.',
 l3c:'한빛대학교 언어교육원에서 유학생 400명을 대상으로 조사한 결과 아르바이트를 하는 유학생이 2022년 48%에서 2026년 63%로 15%포인트 증가했다. 이유는 생활비 마련이 52%로 가장 높았고 한국어 연습 27%, 경력 쌓기 15% 순이었다.',
 l4:'한빛대학교 언어교육원에서 2022년과 2026년에 유학생 각 400명을 대상으로 조사하였다. 아르바이트를 하는 유학생은 48%에서 63%로 증가 했다. 이유는 생활비 마련(52%), 한국어 연습(27%), 경력 쌓기(15%), 기타(6%) 순이었다. 앞으로 아르바이트를 하는 유학생은 더 많아질 것이다.',
 l5:'한빛대학교 언어교육원이 2022년과 2026년에 외국인 유학생 각 400명에게 아르바이트에 대해 조사하였다. 그 결과 아르바이트를 하는 유학생은 48%에서 63%로 15%포인트 증가하였다. 이유로는 생활비 마련이 52%로 가장 많았고, 한국어 연습이 27%, 경력 쌓기가 15%로 뒤를 이었다.',
};
const W2_ANSWERS={'W2-1.1':'공부한 만큼 기억하지 못할 수 있다.','W2-1.2':'시험 전날에도 잠을 충분히 자야 한다.','W2-2.1':'중간에 생길 문제는 생각하지 않기 때문이다.','W2-2.2':'시간을 넉넉하게 잡는 것이 좋다.',
 'W2-3.1':'요즘 혼자 사는 사람이 많다.','W2-3.2':'이 방법은 시간이 오래 걸리지 않다.','W2-3.3':'학생들은 시험 기간에 도서관을 자주 이용한다.','W2-3.4':'이것은 우리가 해결해야 할 문제이다.','W2-3.5':'그런데 운동을 하면 스트레스가 진짜 줄어든다.'};
const W5_ANSWERS={'W5-1.1':[['조별 과제가 흔하다 → 부담이 있지만 함께 일하는 법을 배운다','-지만, -다는 점에서'],['의견을 조정하는 힘','우선, -는 반면에'],['일이 몇 사람에게 몰린다','그러나'],['역할과 마감을 정한다','-(으)려면'],['함께 일하는 연습이다','이처럼']],
 'W5-1.2':'요즘 대학에서는 조별 과제가 많다. 조별 과제는 힘들지만 사회에 나가기 전에 다른 사람과 같이 일하는 방법을 배울수 있다. 그러면 조별 과제를 어떻게 해야 할까?'};

function companyTeacherFiles(){
 const source=fs.readFileSync(path.join(root,COMPANY+'server.mjs'),'utf8'),files=new Map(),names=list=>[...list.matchAll(/'([^']+)'/g)].map(m=>m[1]);
 const type=file=>({'.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.html':'text/html; charset=utf-8','.woff2':'font/woff2','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream';
 for(const m of source.matchAll(/for\(const file of \[([^\]]*)\]\)files\['\/teacher-world\/'\+file\]=\['\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/experiences\/([a-z-]+)\/'\+file/g))for(const file of names(m[1]))files.set('/teacher-world/'+file,{file:path.join(root,'experiences',m[2],file),type:type(file)});
 for(const file of names(/const teacherAssets=\[([^\]]*)\]/.exec(source)[1]))files.set('/teacher-world/assets/'+file,{file:path.join(root,'experiences/teacher-world/assets',file),type:type(file)});
 for(const file of names(/for\(const file of \[([^\]]*)\]\)files\['\/assets\/'\+file\]/.exec(source)[1]))files.set('/assets/'+file,{file:path.join(root,'experiences/teacher-world/assets',file),type:type(file)});
 files.set('/teacher-world/',{file:path.join(root,'experiences/teacher-world/index.html'),type:type('index.html')});
 return files;
}
// 회사 서버 responseHeaders()의 CSP(교사 화면은 같은 출처 iframe만 허용).
const CSP="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'";
const HOST_HTML=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>내 수업 QA</title><link rel="stylesheet" href="/qa/host.css"></head><body><iframe id="frame" title="합성 검증 수업 · 학생 상세와 수업 처리"></iframe><script type="module" src="/qa/host.mjs"></script></body></html>`;
const HOST_CSS='html,body{margin:0;background:#fff}iframe{display:block;width:100%;height:100vh;border:0}';
// 계정 포털 teacher-workspace.mjs의 host와 같은 모양: 이 반의 수업 통로 request만 넘긴다(토큰은 부모 쪽).
const HOST_MJS=`import {createClassroomTransport,createClassroomClient} from '/synk-account/src/classroom-client.mjs';
const classId=new URL(location.href).searchParams.get('class');
const transport=createClassroomTransport({url:location.origin,anonKey:'synthetic-public',getAccessToken:async()=>'synthetic-teacher',guard(){},product:'world'});
const client=createClassroomClient({transport,classId,guard(){}});
window.qaRequests=[];
window.SYNKClassroomHost=Object.freeze({mode:'account-linked',classId,focusWorkspace(){},request:(path,body)=>{window.qaRequests.push({path,post:body!==undefined});return client.request(path,body);}});
window.SYNKClassroomSelection={classId,learnerId:null};
document.getElementById('frame').src='/teacher-world/?account=1';`;

async function createWorld(){
 const {createFixture}=require(path.join(talkRoot,'tools/qa-synk-classroom-fixture.cjs'));
 const {createClassroomStore}=require(path.join(talkRoot,'lib/synk-classroom-store.js'));
 const {createClassroomService}=require(path.join(talkRoot,'lib/synk-classroom-server.js'));
 const {createClassroomHomework}=require(path.join(talkRoot,'lib/synk-classroom-homework.js'));
 const {createPgStore}=require(path.join(talkRoot,'lib/synk-store.js'));
 const {model}=require(path.join(talkRoot,'supabase/functions/_shared/synk-classroom-runtime.js'));
 const f=await createFixture();
 await f.db.exec(fs.readFileSync(path.join(talkRoot,'supabase/migrations/20261020150000_synk_classroom_homework_c18.sql'),'utf8'));
 let clock=KST('2027-03-01T09:00:00'),unavailable=false;
 const store=createClassroomStore(f.sql,model);store.homework=createClassroomHomework({sql:f.sql,now:()=>clock});
 const tokens=new Map([['synthetic-teacher',f.users.teacher.identity]]),learners={};
 const handler=createClassroomService({store,model,enabled:()=>true,verify:async request=>{const identity=tokens.get(String(request.headers.get('authorization')||'').replace(/^Bearer /,''));if(!identity)throw Object.assign(Error('AUTH_REQUIRED'),{status:401,code:'AUTH_REQUIRED'});return identity;}});
 async function addLearner(key,name,{account=true}={}){
  const identity={id:randomUUID(),sessionId:randomUUID(),issuedAt:Math.floor(Date.now()/1000)-1,providers:['synthetic']};
  await f.sql`insert into auth.users values(${identity.id}::uuid)`;
  const [row]=await f.sql`insert into engine.learners(auth_user_id,student_code,class_id) values(${identity.id}::uuid,${name},${f.cls.class_id}::uuid) returning learner_id`;
  if(account)await createPgStore(f.sql).withAccount(identity,'world',tx=>tx.setLearning(false));
  tokens.set('synthetic-'+key,identity);return learners[key]={identity,id:row.learner_id,name};
 }
 await f.sql`update engine.learners set student_code=${'나래 (합성)'} where learner_id=${f.users.learner.id}::uuid`;
 tokens.set('synthetic-l1',f.users.learner.identity);learners.l1={identity:f.users.learner.identity,id:f.users.learner.id,name:'나래 (합성)'};
 for(const [key,name,account] of [['l2','보라 (합성)',true],['l3','다미 (합성)',true],['l4','로안 (합성)',true],['l5','미르 (합성)',true],['l6','새봄 (합성)',true],['l7','온유 (합성)',false]])await addLearner(key,name,{account});
 async function api(who,route,body){
  const url=new URL('http://127.0.0.1/functions/v1/synk-classroom/api/'+route);url.searchParams.set('classId',f.cls.class_id);
  const response=await handler(new Request(url,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer synthetic-'+who,'X-SYNK-Product':'world','X-SYNK-Contract':'1','Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}));
  const json=await response.json();if(!response.ok)throw Object.assign(Error(json.code||response.status),{status:response.status,code:json.code});return json;
 }
 const studentList=async who=>{const url=new URL('http://127.0.0.1/functions/v1/synk-classroom/api/world/homework');const r=await handler(new Request(url,{headers:{Authorization:'Bearer synthetic-'+who,'X-SYNK-Product':'world','X-SYNK-Contract':'1'}}));return r.json();};
 const submit=(who,at,body)=>{clock=KST(at);return api(who,'world/homework',{requestId:randomUUID(),expectedRevision:0,contentVersion:VERSION,...body});};
 const files=companyTeacherFiles();
 const server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname.startsWith('/functions/v1/synk-classroom/')){
   if(unavailable&&u.pathname.endsWith('/api/teacher/homework')){res.writeHead(404,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,code:'HOMEWORK_UNAVAILABLE',message:'HOMEWORK_UNAVAILABLE',error:{code:'HOMEWORK_UNAVAILABLE',message:'HOMEWORK_UNAVAILABLE'}}));return;}
   const chunks=[];for await(const c of req)chunks.push(c);
   const headers=Object.fromEntries(Object.entries(req.headers).filter(([,v])=>typeof v==='string'));
   const r=await handler(new Request('http://127.0.0.1'+req.url,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})}));
   res.writeHead(r.status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(await r.text());return;
  }
  if(u.pathname==='/qa/host.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(HOST_HTML);return;}
  if(u.pathname==='/qa/host.css'){res.writeHead(200,{'Content-Type':'text/css'});res.end(HOST_CSS);return;}
  if(u.pathname==='/qa/host.mjs'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(HOST_MJS);return;}
  if(/^\/synk-account\/src\/[a-z-]+\.mjs$/.test(u.pathname)){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(fs.readFileSync(path.join(root,'experiences',u.pathname)));return;}
  const entry=files.get(u.pathname);
  if(entry&&fs.existsSync(entry.file)){res.writeHead(200,{'Content-Type':entry.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':CSP});res.end(fs.readFileSync(entry.file));return;}
  res.writeHead(404,{'Content-Type':'text/plain'});res.end('not served by the company workspace: '+u.pathname);
 }catch(e){res.writeHead(500);res.end(String(e.stack||e));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 // 명부 줄의 계정을 다른 합성 계정으로 바꾼다(관리자 정정·다시 연결). 앞 계정이 낸 글은 교사 목록에서 빠지고, 그 글에 첨삭하면 403이다.
 async function relink(key){
  const identity={id:randomUUID(),sessionId:randomUUID(),issuedAt:Math.floor(Date.now()/1000)-1,providers:['synthetic']};
  await f.sql`insert into auth.users values(${identity.id}::uuid)`;
  await f.sql`update engine.learners set auth_user_id=${identity.id}::uuid where learner_id=${learners[key].id}::uuid`;
  await createPgStore(f.sql).withAccount(identity,'world',tx=>tx.setLearning(false));
  tokens.set('synthetic-'+key,identity);learners[key].identity=identity;
 }
 return {f,learners,api,studentList,submit,relink,files,base:'http://127.0.0.1:'+server.address().port,setClock:at=>{clock=KST(at);},setUnavailable:v=>{unavailable=v;},
  close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await f.close();}};
}

// 1~3주차 합성 기록: 지난주 첨삭(돌려줌)과 「다시 써 볼 곳」, 3주차의 새로 냄·늦게 냄·고쳐 냄·첨삭 중·돌려줌·안 냄·계정 연결 전.
async function seed(w){
 const reading=(week,answers)=>({week,kind:'reading',answers});
 await w.submit('l1','2027-03-08T21:10:00',reading(1,{'R1-1':3,'R1-2':1,'R1-3':4,'R1-4':2,'R1-5':2}));
 await w.submit('l1','2027-03-17T22:55:00',{week:2,kind:'writing',answers:W2_ANSWERS});
 const t=await w.api('teacher','teacher/homework');const w2=t.submissions.find(s=>s.learnerId===w.learners.l1.id&&s.week===2);
 w.setClock('2027-03-19T17:30:00');
 await w.api('teacher','teacher/homework',{action:'feedback',submissionId:w2.submissionId,submissionRevision:1,revision:0,returned:true,parts:{
  'W2-1':{fields:{'W2-1.1':{verdict:'인정',reason:'뒤의 「-기 때문이다」와 이어지는 결과예요.'},'W2-1.2':{verdict:'인정'}}},
  'W2-2':{fields:{'W2-2.1':{verdict:'인정'},'W2-2.2':{verdict:'인정'}}},
  'W2-3':{fields:{'W2-3.1':{verdict:'인정'},'W2-3.2':{verdict:'다시',reason:'동사는 「-는다」예요: 걸리지 않는다.'},'W2-3.3':{verdict:'인정'},'W2-3.4':{verdict:'인정'},'W2-3.5':{verdict:'부분',reason:'「진짜」는 말하는 낱말이에요.'}},
   comment:{good:'명사 문장 「문제이다」를 정확히 바꿨어요.',fix:'동사 「-지 않다」는 글에서 「-지 않는다」예요.〔어〕',retry:'「그런데 운동을 하면 스트레스가 진짜 줄어든다」를 글의 낱말로 다시 써 보세요.'}}}});
 await w.submit('l2','2027-03-18T09:00:00',{week:2,kind:'writing',answers:{...W2_ANSWERS,'W2-1.1':'공부해도 기억이 잘 안 나요.','W2-3.5':'근데 운동을 하면 스트레스가 정말 줄어든다.'}});
 // 3주차(3/20 토 열림 · 3/24 수 23:00 마감)
 await w.submit('l1','2027-03-23T21:00:00',reading(3,{'R3-1':2,'R3-2':4,'R3-3':2,'R3-4':3,'R3-5':1}));
 await w.submit('l1','2027-03-24T22:30:00',{week:3,kind:'writing',answers:{'W3-1.1':W3.l1},retry:{'W2-3':'그런데 운동을 하면 스트레스가 크게 줄어든다.'}});
 await w.submit('l2','2027-03-25T08:40:00',{week:3,kind:'writing',answers:{'W3-1.1':W3.l2}});
 await w.submit('l2','2027-03-25T08:45:00',reading(3,{'R3-1':2,'R3-2':3,'R3-3':2,'R3-4':3,'R3-5':2}));
 await w.submit('l3','2027-03-22T20:00:00',{week:3,kind:'writing',answers:{'W3-1.1':W3.l3a}});
 w.setClock('2027-03-24T21:00:00');await w.api('l3','world/homework',{week:3,kind:'writing',requestId:randomUUID(),expectedRevision:1,contentVersion:VERSION,answers:{'W3-1.1':W3.l3b}});
 await w.submit('l4','2027-03-23T19:00:00',{week:3,kind:'writing',answers:{'W3-1.1':W3.l4}});
 await w.submit('l5','2027-03-21T16:00:00',{week:3,kind:'writing',answers:{'W3-1.1':W3.l5}});
 await w.submit('l5','2027-03-21T16:10:00',reading(3,{'R3-1':2,'R3-2':4,'R3-3':2,'R3-4':3,'R3-5':1}));
 await w.submit('l6','2027-03-24T10:00:00',reading(3,{'R3-1':1,'R3-2':4,'R3-3':2,'R3-4':3,'R3-5':1}));
 const list=await w.api('teacher','teacher/homework'),find=key=>list.submissions.find(s=>s.learnerId===w.learners[key].id&&s.week===3&&s.kind==='writing');
 w.setClock('2027-03-25T20:00:00');
 await w.api('teacher','teacher/homework',{action:'feedback',submissionId:find('l4').submissionId,submissionRevision:1,revision:0,returned:false,parts:{'W3-1':{marks:[{field:'W3-1.1',quote:'증가 했다',code:'띄'},{field:'W3-1.1',quote:'앞으로 아르바이트를 하는 유학생은 더 많아질 것이다',code:'자',note:'전망은 자료에 없어요.'}],comment:{good:'네 가지 이유를 모두 옮겼어요.'}}}});
 await w.api('teacher','teacher/homework',{action:'feedback',submissionId:find('l5').submissionId,submissionRevision:1,revision:0,returned:true,parts:{'W3-1':{marks:[{field:'W3-1.1',quote:'15%포인트 증가하였다',code:'+',note:'%포인트를 정확히 썼어요.'}],comment:{good:'두 해의 비율과 차이를 정확히 옮겼어요.',fix:'마지막에 정리 문장 하나가 있으면 좋아요.〔연〕',retry:'「이처럼 …이 늘고 있다」로 정리 문장을 써 보세요.'}}}});
 w.setClock('2027-03-26T10:00:00');
}

const measureScript=()=>{
 const view=document.getElementById('view-homework'),box=view.getBoundingClientRect(),shown=n=>n.getClientRects().length>0&&getComputedStyle(n).visibility!=='hidden';
 const overflowing=[...view.querySelectorAll('*')].filter(n=>shown(n)&&!n.closest('.hr-table')&&(n.getBoundingClientRect().right>box.right+.5||n.getBoundingClientRect().left<box.left-.5)).map(n=>String(n.className||n.tagName)).slice(0,12);
 const small=[],scan=area=>{if(!area)return;const w=document.createTreeWalker(area,NodeFilter.SHOW_TEXT);for(let n=w.nextNode();n;n=w.nextNode()){if(!/[가-힣]/.test(n.textContent)||!shown(n.parentElement))continue;const size=parseFloat(getComputedStyle(n.parentElement).fontSize);if(size<13)small.push({text:n.textContent.trim().slice(0,24),size});}};
 scan(view);scan(document.querySelector('.sidebar nav'));
 const targets=[...view.querySelectorAll('a,button,summary,input,select,textarea'),...document.querySelectorAll('.sidebar nav button')].filter(shown);
 const shortTargets=targets.map(n=>({key:n.dataset.hrKey||n.id||String(n.className)||n.tagName,height:Math.round(n.getBoundingClientRect().height)})).filter(t=>t.height<44);
 const clipped=[...view.querySelectorAll('button')].filter(shown).filter(b=>b.scrollWidth>b.clientWidth+1).map(b=>b.dataset.hrKey||b.textContent.trim().slice(0,20));
 return {innerWidth,visualWidth:Math.round(visualViewport.width),docOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,overflowing,small,shortTargets,clipped,targets:targets.length,
  primary:[...view.querySelectorAll('.felt-button.primary')].filter(shown).length,state:document.querySelector('.hr')?.dataset.state||null,height:Math.round(document.documentElement.scrollHeight)};
};
// 칸 글에서 글귀의 nth번째 자리를 사람이 끌어 고른 것처럼 고른다(문단 사이는 빈 줄 하나로 본다 — 합성 글이 그렇다).
const selectScript=({field,quote,nth=0})=>{
 const essay=document.querySelector(`.hr-essay[data-field="${field}"]`);if(!essay)return false;
 const nodes=[];let text='';
 [...essay.querySelectorAll('.hr-para')].forEach((p,i)=>{if(i)text+='\n\n';const w=document.createTreeWalker(p,NodeFilter.SHOW_TEXT);for(let n=w.nextNode();n;n=w.nextNode()){nodes.push({n,start:text.length});text+=n.textContent;}});
 let at=-1;for(let k=0,from=0;k<=nth;k++){at=text.indexOf(quote,from);if(at<0)return false;from=at+1;}
 const locate=pos=>{for(let i=nodes.length-1;i>=0;i--)if(nodes[i].start<=pos)return nodes[i];};
 const a=locate(at),b=locate(at+quote.length),range=document.createRange();
 range.setStart(a.n,at-a.start);range.setEnd(b.n,at+quote.length-b.start);
 a.n.parentElement.scrollIntoView({block:'center'});const s=getSelection();s.removeAllRanges();s.addRange(range);return true;
};

test('과제 첨삭: 계획 → 주별 목록 → 기호·판정·한마디 → 임시 저장·돌려주기 → 학생이 받는 첨삭, 판 겹침, 390·1280',{skip:!talkRoot&&'SYNK-talk 과제 가지(lib/synk-classroom-homework.js·tools/qa-synk-classroom-fixture.cjs)가 없다'||!playwright&&'playwright가 없다',timeout:600000},async t=>{
 fs.mkdirSync(out,{recursive:true});
 const w=await createWorld();t.after(()=>w.close());
 // 교사 화면은 서버 답의 serverTime으로 시계를 고친다(학생 화면과 같다). 서버 시계도 브라우저와 같은 3주차 금요일에서 시작한다.
 w.setClock('2027-03-26T10:00:00');
 const browser=await playwright.chromium.launch({channel:'chrome',headless:true});t.after(()=>browser.close());
 const result={startedAt:new Date().toISOString(),talk:path.basename(talkRoot),served:[...w.files.keys()].filter(k=>/homework|topik4/.test(k)),measures:{},checks:[],console:[]};
 t.after(()=>{if(!result.finishedAt){result.failedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,1)+'\n');}});
 const check=(name,ok,detail)=>{result.checks.push({name,ok:!!ok,...(detail===undefined?{}:{detail})});assert.ok(ok,name+(detail===undefined?'':' '+JSON.stringify(detail)));};
 async function open({viewport,tag},fixed){
  const context=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:false,hasTouch:viewport.width<600,locale:'ko-KR',timezoneId:'Asia/Seoul'});
  await context.addInitScript(fixed=>{const Native=Date,offset=fixed-Native.now();class Fixed extends Native{constructor(...args){if(args.length)super(...args);else super(Native.now()+offset);}static now(){return Native.now()+offset;}}window.Date=Fixed;},fixed);
  const page=await context.newPage();
  page.on('console',m=>{if(['error','warning'].includes(m.type()))result.console.push({tag,type:m.type(),text:m.text().slice(0,300)});});page.on('response',r=>{if(r.status()>=400)result.console.push({tag,type:'http',text:r.status()+' '+r.url().slice(0,200)});});page.on('pageerror',e=>result.console.push({tag,type:'pageerror',text:String(e).slice(0,300)}));
  await page.goto(`${w.base}/qa/host.html?class=${w.f.cls.class_id}`);
  return {context,page,frame:await teacherFrame(page),tag};
 }
 async function teacherFrame(page){
  for(let i=0;i<200;i++){const f=page.frames().find(f=>f.url().includes('/teacher-world/'));if(f){await f.waitForFunction(()=>document.documentElement.dataset.ready==='true',null,{timeout:20000});return f;}await page.waitForTimeout(50);}
  throw Error('교사 화면 iframe이 열리지 않았다: '+JSON.stringify({console:result.console.slice(-8),frames:page.frames().map(f=>f.url())}));
 }
 const reload=async s=>{await s.page.reload();s.frame=await teacherFrame(s.page);};
 const settle=(frame,expr,arg)=>frame.waitForFunction(expr,arg,{timeout:20000});
 async function shoot(s,name,{full=true}={}){
  const measure=await s.frame.evaluate(measureScript);result.measures[`${s.tag}-${name}`]=measure;
  if(full){await s.page.evaluate(h=>{document.getElementById('frame').style.height=h+'px';},measure.height);await s.page.waitForTimeout(150);await s.page.screenshot({path:path.join(out,`${s.tag}-${name}.png`),fullPage:true});await s.page.evaluate(()=>{document.getElementById('frame').style.height='';});await s.page.waitForTimeout(80);}
  else await s.page.screenshot({path:path.join(out,`${s.tag}-${name}.png`)});
  const key=`${s.tag}-${name}`;
  check(`${key} 가로 넘침 0`,measure.docOverflow<=0&&!measure.overflowing.length&&measure.innerWidth===measure.visualWidth,{doc:measure.docOverflow,overflowing:measure.overflowing});
  check(`${key} 13px 밑 한글 0`,!measure.small.length,measure.small.slice(0,5));
  check(`${key} 44px 밑 누르는 곳 0`,!measure.shortTargets.length,measure.shortTargets.slice(0,5));
  check(`${key} 단추 글 넘침 0`,!measure.clipped.length,measure.clipped);
  check(`${key} 검은 주 단추 1개 이하`,measure.primary<=1,measure.primary);
  return measure;
 }
 const openHomework=async s=>{await s.frame.click('#homework-nav');await settle(s.frame,()=>['ready','unavailable','unsupported','error'].includes(document.querySelector('.hr')?.dataset.state));};

 // ① 계획 없음 → 과제 열기(계정 모드에서만 메뉴가 보인다)
 const fixed=KST('2027-03-26T10:00:00'),pages={};
 for(const v of VIEWPORTS){pages[v.tag]=await open(v,fixed);t.after(()=>pages[v.tag].context.close());}
 for(const v of VIEWPORTS){const s=pages[v.tag];check(`${v.tag} 계정 모드 메뉴에 「과제 첨삭」`,await s.frame.isVisible('#homework-nav'));await openHomework(s);await settle(s.frame,()=>!!document.querySelector('.hr-plan.is-form'));await shoot(s,'01-plan-none');}
 const desk=pages['1280'],phone=pages['390'];
 await desk.frame.fill('[data-hr-key="plan:start"]',START);await desk.frame.selectOption('[data-hr-key="plan:weeks"]','8');
 check('시작일을 고르면 1주차 열림·첫 마감을 미리 보인다',/1주차 3월 6일 \(토\) 열림 · 첫 마감 3월 10일 \(수\) 오후 11:00/.test(await desk.frame.textContent('.hr-plan-preview')));
 await desk.frame.click('[data-hr-key="plan:submit"]');await settle(desk.frame,()=>!!document.querySelector('.hr-weeks'));
 const planned=await w.api('teacher','teacher/homework');check('계획이 서버에 들어갔다',planned.plan?.startsOn===START&&planned.plan.weeks===8&&planned.plan.revision===1,planned.plan);

 // ② 합성 기록을 넣고 새로고침 → 3주차(이번 주) 목록
 await seed(w);
 for(const s of [desk,phone]){if(s===phone){await reload(s);
   // 다시 열면 「학생과 학습」 메뉴다. 과제 판을 열기 전에도 메뉴 숫자(이번 주 첨삭할 글)가 뜬다.
   const count=await s.frame.waitForFunction(()=>{const c=document.getElementById('homework-count');return !c.hidden&&c.textContent;},null,{timeout:20000}).then(h=>h.jsonValue()).catch(()=>null);
   check('다른 메뉴에 있어도 「과제 첨삭」 메뉴 숫자(이번 주 첨삭할 글 4)',count==='4'&&await s.frame.isVisible('#view-students')&&!(await s.frame.isVisible('#view-homework')),count);
   await openHomework(s);}else await s.frame.click('[data-hr-key="refresh"]');
  await settle(s.frame,()=>document.querySelectorAll('.hr-row').length===7&&!!document.querySelector('.hr-week.is-selected[data-current]'));}
 const rows=await desk.frame.$$eval('.hr-row',list=>list.map(b=>({name:b.querySelector('.hr-row-name').textContent,status:b.dataset.status,text:b.textContent})));
 check('3주차 목록: 이름 차례와 상태',JSON.stringify(rows.map(r=>[r.name,r.status]))===JSON.stringify([['나래 (합성)','new'],['다미 (합성)','resubmitted'],['로안 (합성)','drafting'],['미르 (합성)','returned'],['보라 (합성)','new'],['새봄 (합성)','none'],['온유 (합성)','none']]),rows.map(r=>[r.name,r.status]));
 check('늦게 낸 글·계정 연결 전·읽기 맞힌 수를 보인다',rows[4].text.includes('늦게 냄')&&rows[6].text.includes('계정 연결 전')&&/읽기 \d\/5/.test(rows[0].text),rows.map(r=>r.text));
 check('숫자판: 첨삭할 글 4 · 쓰기 5/7(늦게 1) · 첨삭 중 1 · 돌려줌 1 · 읽기 4/7',(await desk.frame.$$eval('.hr-board-cell',c=>c.map(x=>x.textContent)).then(x=>x.join('|')))==='4첨삭할 글|5/7쓰기 낸 학생 · 늦게 1|1첨삭 중|1돌려줌|4/7읽기 낸 학생');
 check('주차 표시: 첨삭할 글이 있는 2주(1편)·3주(4편)',JSON.stringify(await desk.frame.$$eval('.hr-week',b=>b.map(x=>x.querySelector('.hr-week-badge')?.textContent||'')))===JSON.stringify(['','1','4','','','','','']));
 for(const s of [desk,phone])await shoot(s,'02-week3');

 // ③ 나래(새로 냄) 첨삭: 글귀를 골라 기호 → 판이 학생 화면 규칙대로 놓인다
 for(const s of [desk,phone]){if(s===phone)await s.frame.click('[data-hr-key="row:'+w.learners.l1.id+'"]');await settle(s.frame,()=>!!document.querySelector('.hr-essay .hr-para'));}
 check('지난주 다시 써 볼 곳과 다시 쓴 문장을 보인다',/W2-3 · 「그런데 운동을 하면 스트레스가 진짜 줄어든다」를 글의 낱말로 다시 써 보세요\./.test(await desk.frame.textContent('.hr-retry')));
 check('학생 글의 문단 사이가 떨어져 있다(학생 화면처럼 빈 줄로 나눈 문단)',await desk.frame.evaluate(()=>{const p=[...document.querySelectorAll('.hr-essay .hr-para')];return p.length===2&&p[1].getBoundingClientRect().top-p[0].getBoundingClientRect().bottom>=12;}));
 check('읽기 결과 줄',/읽기 R3 · 5문항 중 \d문항 맞힘/.test(await desk.frame.textContent('.hr-reading-line')));
 // 마지막 문단을 세 번 누르면 고르기 끝이 글 칸 밖(다음 칸의 처음)에 걸린다 — 글 칸 끝에서 잘라 받는다.
 await desk.frame.click('.hr-essay[data-field="W3-1.1"] .hr-para >> nth=-1',{clickCount:3});
 await settle(desk.frame,()=>!!document.querySelector('.hr-markbar:not([hidden])'));
 check('마지막 문단 세 번 누르기 → 그 문단 전체가 글귀(글 칸 끝에서 자름)',(await desk.frame.textContent('.hr-markbar .hr-quote').catch(()=>null))===W3.l1.split('\n\n')[1]&&!!(await desk.frame.$('.hr-markbar .hr-codes')),await desk.frame.textContent('.hr-markbar'));
 await desk.frame.click('[data-hr-key="markbar:cancel"]');
 async function mark(s,quote,code,{expectBar=true}={}){
  check(`${s.tag} 「${quote}」 고르기`,await s.frame.evaluate(selectScript,{field:'W3-1.1',quote}));
  await settle(s.frame,()=>!!document.querySelector('.hr-markbar:not([hidden])'));
  if(!expectBar)return;
  await s.frame.click(`[data-hr-key="markbar:${code}"]`);
  await settle(s.frame,({quote,code})=>[...document.querySelectorAll('.hr-mark')].some(li=>li.dataset.code===code&&li.querySelector('.hr-quote')?.textContent===quote),{quote,code});
 }
 await mark(desk,'조사했습니다','체');await mark(desk,'15% 증가했다','낱');
 await desk.frame.evaluate(selectScript,{field:'W3-1.1',quote:'요즘 물가가 많이 올랐기 때문이다'});await settle(desk.frame,()=>!!document.querySelector('.hr-markbar:not([hidden]) .hr-codes'));
 await desk.frame.evaluate(()=>document.querySelector('.hr-markbar')?.scrollIntoView({block:'end'}));
 await shoot(desk,'03-markbar',{full:false});
 await desk.frame.click('[data-hr-key="markbar:자"]');await settle(desk.frame,()=>document.querySelectorAll('.hr-mark').length===3);
 // 겹치는 글귀는 받지 않는다
 await desk.frame.evaluate(selectScript,{field:'W3-1.1',quote:'조사했습니다. 조사'});await settle(desk.frame,()=>/겹쳐요/.test(document.querySelector('.hr-markbar:not([hidden])')?.textContent||''));
 check('이미 표시한 글귀와 겹치면 기호 단추 대신 안내',!(await desk.frame.$('.hr-markbar:not([hidden]) .hr-codes')));
 await desk.frame.click('[data-hr-key="markbar:cancel"]');
 // 글귀를 직접 적어 붙이기도 같은 겹침을 막는다(키보드·화면 읽기 프로그램 길).
 await desk.frame.click('[data-hr-key="typed:W3-1.1"]');await desk.frame.fill('[data-hr-key="typed:quote:W3-1.1"]','조사했습니다. 조사');await desk.frame.click('[data-hr-key="typed:add:W3-1.1"]');
 check('직접 적은 글귀도 겹치면 붙이지 않는다',/겹쳐요/.test(await desk.frame.textContent('.hr-typed-form .hr-help'))&&(await desk.frame.$$eval('.hr-mark',m=>m.length))===3);
 // 같은 글귀가 글 앞쪽(다른 문단)에도 있으면 학생 화면처럼 앞 자리에 놓인다고 알린다(칸 글 전체에서 한 곳).
 await desk.frame.evaluate(selectScript,{field:'W3-1.1',quote:'아르바이트를 하는',nth:1});await settle(desk.frame,()=>/글 앞쪽에도/.test(document.querySelector('.hr-markbar:not([hidden])')?.textContent||''));
 check('뒤 문단에서 고른 글귀가 앞 문단에도 있으면 앞 자리 안내',!!(await desk.frame.$('.hr-markbar:not([hidden]) .hr-codes')));
 await desk.frame.click('[data-hr-key="markbar:cancel"]');
 // 문단을 넘는 글귀도 고를 수 있다(학생 화면은 마지막 조각에만 기호를 단다).
 await desk.frame.evaluate(selectScript,{field:'W3-1.1',quote:'63%로 15%'});await settle(desk.frame,()=>!!document.querySelector('.hr-markbar:not([hidden])'));
 check('겹치는 글귀(이미 표시한 「15% 증가했다」와 겹침)는 기호 대신 안내',/겹쳐요/.test(await desk.frame.textContent('.hr-markbar')));
 await desk.frame.click('[data-hr-key="markbar:cancel"]');
 await desk.frame.evaluate(selectScript,{field:'W3-1.1',quote:'.\n\n아르바이트를 하는 이유는'});await settle(desk.frame,()=>!!document.querySelector('.hr-markbar:not([hidden]) .hr-codes'));
 check('문단을 넘는 글귀도 한 칸의 글 안이면 기호 막대가 열린다',/아르바이트를 하는 이유는/.test(await desk.frame.textContent('.hr-markbar .hr-quote')));
 await desk.frame.click('[data-hr-key="markbar:cancel"]');
 const placed=await desk.frame.$$eval('.hr-essay mark',m=>m.map(x=>[x.dataset.code,x.textContent]));
 check('학생 글 위에 기호 세 곳(문단마다 처음 자리)',JSON.stringify(placed)===JSON.stringify([['체','조사했습니다'],['낱','15% 증가했다'],['자','요즘 물가가 많이 올랐기 때문이다']]),placed);
 await desk.frame.fill('[data-hr-key="mark:note:W3-1:1"]','48에서 63은 15%포인트예요.');
 await desk.frame.fill('[data-hr-key="comment:W3-1:good"]','두 해의 비율을 정확히 옮겼어요.');
 await desk.frame.fill('[data-hr-key="comment:W3-1:fix"]','물가 이야기는 자료에 없는 내용이에요.〔자〕');
 await desk.frame.fill('[data-hr-key="comment:W3-1:retry"]','두 문장을 「-에서 -로 증가했다」로 이어 보세요.');
 check('쓰는 중에는 「저장하지 않은 고침」',/저장하지 않은 고침이 있어요/.test(await desk.frame.textContent('.hr-save-state')));
 check('저장 안 한 첨삭이 있으면 부모 호스트가 떠나기 전에 묻는다',await desk.frame.evaluate(()=>window.SYNKTeacherView.hasDraft()));
 await desk.frame.click('[data-hr-key="save:draft"]');
 await settle(desk.frame,()=>document.querySelector('.hr-row.is-selected')?.dataset.status==='drafting'&&/임시 저장했어요/.test(document.querySelector('.hr-save-state')?.textContent||''));
 check('임시 저장 뒤 쓰던 것 없음',!(await desk.frame.evaluate(()=>window.SYNKTeacherView.hasDraft())));
 let l1=(await w.studentList('l1')).classes[0].submissions.find(s=>s.week===3&&s.kind==='writing');
 check('임시 저장은 학생에게 보이지 않는다',l1.feedback===null,l1.feedback);
 await shoot(desk,'04-draft');

 // ④ 〔+〕 없이 돌려주기 → 확인 → 계속 고치기 → 〔+〕 붙여 돌려주기
 await desk.frame.click('[data-hr-key="return:now"]');await settle(desk.frame,()=>!!document.querySelector('.hr-confirm'));
 check('〔+〕가 없으면 돌려주기 전에 묻는다',/〔\+〕 잘 쓴 곳을 한 곳 이상/.test(await desk.frame.textContent('.hr-check')));
 await shoot(desk,'05-confirm');
 await desk.frame.click('[data-hr-key="return:keep"]');
 await mark(desk,'이처럼 아르바이트를 하는 유학생이 늘고 있다','+');
 await desk.frame.click('[data-hr-key="return:now"]');
 await settle(desk.frame,()=>document.querySelector('.hr-row.is-selected')?.dataset.status==='returned');
 l1=(await w.studentList('l1')).classes[0].submissions.find(s=>s.week===3&&s.kind==='writing');
 const teacherSide=(await w.api('teacher','teacher/homework')).submissions.find(s=>s.learnerId===w.learners.l1.id&&s.week===3&&s.kind==='writing');
 check('학생이 받는 첨삭 = 교사가 돌려준 첨삭',!!l1.feedback?.returnedAt&&JSON.stringify(l1.feedback.parts)===JSON.stringify(teacherSide.feedback.parts),l1.feedback);
 check('돌려준 첨삭의 꼴',JSON.stringify(l1.feedback.parts['W3-1'].marks.map(m=>[m.code,m.quote,m.note||null]))===JSON.stringify([['체','조사했습니다',null],['낱','15% 증가했다','48에서 63은 15%포인트예요.'],['자','요즘 물가가 많이 올랐기 때문이다',null],['+','이처럼 아르바이트를 하는 유학생이 늘고 있다',null]])&&l1.feedback.parts['W3-1'].comment.retry==='두 문장을 「-에서 -로 증가했다」로 이어 보세요.',l1.feedback.parts);
 check('돌려준 뒤 다음 글로 가는 단추',/다음 글 · 다미 \(합성\)/.test(await desk.frame.textContent('.hr-actions')));
 await shoot(desk,'06-returned');

 // ⑤ 판 겹침: 다미가 고쳐 낸 글을 보는 동안 다시 고쳐 내면, 저장이 겹침으로 막히고 새 글을 다시 불러와 알린다(쓰던 첨삭은 남는다)
 await desk.frame.click('[data-hr-key="next"]');await settle(desk.frame,()=>/다미/.test(document.querySelector('.hr-editor-who')?.textContent||''));
 await mark(desk,'한빛대학교 언어교육원에서','+');
 w.setClock('2027-03-26T10:20:00');await w.api('l3','world/homework',{week:3,kind:'writing',requestId:randomUUID(),expectedRevision:2,contentVersion:VERSION,answers:{'W3-1.1':W3.l3c}});
 w.setClock('2027-03-26T10:25:00');
 await desk.frame.click('[data-hr-key="save:draft"]');
 await settle(desk.frame,()=>/학생이 글을 고쳐 다시 냈어요/.test(document.querySelector('.hr-editor-notice')?.textContent||''));
 check('겹친 뒤에도 쓰던 기호가 남는다',(await desk.frame.$$eval('.hr-mark',m=>m.length))===1);
 check('새 글(3번째 판)을 보인다',/15%포인트 증가했다/.test(await desk.frame.textContent('.hr-essay'))&&/고쳐 낸 판 3/.test(await desk.frame.textContent('.hr-editor-meta')));
 await shoot(desk,'07-conflict');
 await desk.frame.click('[data-hr-key="save:draft"]');await settle(desk.frame,()=>document.querySelector('.hr-row.is-selected')?.dataset.status==='drafting');
 const l3=(await w.api('teacher','teacher/homework')).submissions.find(s=>s.learnerId===w.learners.l3.id&&s.week===3&&s.kind==='writing');
 check('다시 저장하면 새 판에 맞춰 들어간다',l3.revision===3&&l3.feedback.submissionRevision===3&&l3.feedback.returnedAt===null,{revision:l3.revision,feedback:l3.feedback});
 // ⑤-2 다른 곳에서 바뀐 첨삭: 고치지 않은 채 돌려주는데 그사이 다른 창이 다른 첨삭을 저장했으면, 409 → 다시 읽기 → 말없이 돌려주지 않고 새로 불러온 첨삭을 보이며 알린다.
 await w.api('teacher','teacher/homework',{action:'feedback',submissionId:l3.submissionId,submissionRevision:l3.revision,revision:l3.feedback.revision,returned:false,parts:{'W3-1':{
  marks:[{field:'W3-1.1',quote:'한빛대학교 언어교육원에서',code:'+'},{field:'W3-1.1',quote:'15%포인트 증가했다',code:'낱',note:'다른 창에서 쓴 덧붙임'}],comment:{good:'조사 기관과 대상을 먼저 밝혔어요.'}}}});
 await desk.frame.click('[data-hr-key="return:now"]');await settle(desk.frame,()=>!!document.querySelector('[data-hr-key="return:anyway"]'));await desk.frame.click('[data-hr-key="return:anyway"]');
 await settle(desk.frame,()=>/다른 곳에서 바뀐 첨삭을 새로 불러왔어요/.test(document.querySelector('.hr-editor-notice')?.textContent||''));
 const l3other=(await w.api('teacher','teacher/homework')).submissions.find(s=>s.submissionId===l3.submissionId);
 check('다른 곳에서 바뀐 첨삭은 말없이 돌려주지 않는다(서버는 다른 창의 임시 저장 그대로)',l3other.feedback.returnedAt===null&&l3other.feedback.parts['W3-1'].marks.length===2&&l3other.feedback.parts['W3-1'].comment?.good==='조사 기관과 대상을 먼저 밝혔어요.',l3other.feedback);
 check('화면은 새로 불러온 첨삭(기호 둘·한마디)을 보인다',(await desk.frame.$$eval('.hr-mark',m=>m.length))===2&&(await desk.frame.inputValue('[data-hr-key="comment:W3-1:good"]'))==='조사 기관과 대상을 먼저 밝혔어요.');
 await shoot(desk,'12-reloaded-other');

 // ⑥ 2주차: 51·52 빈칸과 바꿔 쓰기 판정(인정·부분·다시 + 한 줄 이유)
 await desk.frame.click('[data-hr-key="week:2"]');await settle(desk.frame,()=>document.querySelector('.hr-week.is-selected')?.textContent.startsWith('2주'));
 await desk.frame.click('[data-hr-key="row:'+w.learners.l2.id+'"]');await settle(desk.frame,()=>!!document.querySelector('.hr-seg'));
 await desk.frame.click('[data-hr-key="problem:W2-1"]');
 for(const [id,verdict,reason] of [['W2-1.1','다시','「-아요」는 글의 문체와 섞여요. 「-ㄹ 수 있다」로 끝내요.'],['W2-1.2','인정',''],['W2-3.2','다시','동사는 「-는다」예요: 걸리지 않는다.'],['W2-3.5','부분','「근데」는 말하는 낱말이에요.']]){
  await desk.frame.click(`[data-hr-key="verdict:${id}:${verdict}"]`);if(reason)await desk.frame.fill(`[data-hr-key="reason:${id}"]`,reason);
 }
 check('판정을 고르면 그 칸이 눌린 상태',(await desk.frame.getAttribute('[data-hr-key="verdict:W2-1.1:다시"]','aria-pressed'))==='true');
 check('판정을 눌러 다시 그려도 펼친 「문제 보기」는 그대로',await desk.frame.evaluate(()=>!!document.querySelector('summary[data-hr-key="problem:W2-1"]')?.parentElement.open));
 await shoot(desk,'08-week2-verdict');
 // 응답을 잃은 저장: 같은 첨삭이 서버에 먼저 들어가 있는 채로 다시 보내면 409지만(교사 경로에는 멱등키가 없다), 겹침이 아니라 「저장됨」으로 맞춘다.
 const w2=(await w.api('teacher','teacher/homework')).submissions.find(s=>s.learnerId===w.learners.l2.id&&s.week===2&&s.kind==='writing');
 await w.api('teacher','teacher/homework',{action:'feedback',submissionId:w2.submissionId,submissionRevision:w2.revision,revision:0,returned:false,parts:{
  'W2-1':{fields:{'W2-1.1':{verdict:'다시',reason:'「-아요」는 글의 문체와 섞여요. 「-ㄹ 수 있다」로 끝내요.'},'W2-1.2':{verdict:'인정'}}},
  'W2-3':{fields:{'W2-3.2':{verdict:'다시',reason:'동사는 「-는다」예요: 걸리지 않는다.'},'W2-3.5':{verdict:'부분',reason:'「근데」는 말하는 낱말이에요.'}}}}});
 await desk.frame.click('[data-hr-key="save:draft"]');
 await settle(desk.frame,()=>document.querySelector('.hr-row.is-selected')?.dataset.status==='drafting'&&!document.querySelector('.hr-actions[data-dirty="true"]')&&!!document.querySelector('.hr-save-state'));
 check('응답을 잃은 같은 저장은 겹침 안내 없이 「임시 저장」',!(await desk.frame.$('.hr-editor-notice'))&&/임시 저장/.test(await desk.frame.textContent('.hr-save-state')),await desk.frame.textContent('.hr-save-state'));
 // 같은 임시 저장이 한 번 더(응답을 잃은 저장) 들어간 뒤 「돌려주기」: 409 → 다시 읽기 → 내 첨삭과 같으면 새 판으로 한 번 더 돌려준다(말없이 임시 저장에 머물지 않게).
 const w2b=(await w.api('teacher','teacher/homework')).submissions.find(s=>s.submissionId===w2.submissionId);
 await w.api('teacher','teacher/homework',{action:'feedback',submissionId:w2.submissionId,submissionRevision:w2b.revision,revision:w2b.feedback.revision,returned:false,parts:w2b.feedback.parts});
 await desk.frame.click('[data-hr-key="return:now"]');await settle(desk.frame,()=>!!document.querySelector('[data-hr-key="return:anyway"]'));
 await desk.frame.click('[data-hr-key="return:anyway"]');
 await settle(desk.frame,()=>document.querySelector('.hr-row.is-selected')?.dataset.status==='partly');
 const l2w2=(await w.studentList('l2')).classes[0].submissions.find(s=>s.week===2&&s.kind==='writing');
 check('응답을 잃은 저장 뒤의 돌려주기도 실제로 돌려준다(학생에게 보임, 일부 문항)',!!l2w2.feedback?.returnedAt&&Object.keys(l2w2.feedback.parts).join()==='W2-1,W2-3',l2w2.feedback);

 // ⑦ 휴대폰(390): 목록 → 글 → 기호 막대 → 저장
 await phone.frame.click('[data-hr-key="refresh"]');await settle(phone.frame,()=>document.querySelector('.hr-status')?.textContent.includes('불러온 때'));
 await phone.frame.click('[data-hr-key="row:'+w.learners.l2.id+'"]');await settle(phone.frame,()=>/보라/.test(document.querySelector('.hr-editor-who')?.textContent||''));
 await mark(phone,'유학생들은 아르바이트를 너무 많이 한다','낱');
 await phone.frame.evaluate(selectScript,{field:'W3-1.1',quote:'뒤를 이었다'});await settle(phone.frame,()=>!!document.querySelector('.hr-markbar:not([hidden]) .hr-codes'));
 await phone.frame.evaluate(()=>{const bar=document.querySelector('.hr-markbar');bar.scrollIntoView({block:'end'});});
 await shoot(phone,'03-markbar',{full:false});
 await phone.frame.click('[data-hr-key="markbar:+"]');await settle(phone.frame,()=>document.querySelectorAll('.hr-mark').length===2);
 await phone.frame.fill('[data-hr-key="comment:W3-1:fix"]','「너무」는 글에서 「지나치게」로, 자료에 없는 판단은 빼요.〔자〕');
 await shoot(phone,'04-editor');
 await phone.frame.click('[data-hr-key="save:draft"]');await settle(phone.frame,()=>document.querySelector('.hr-row.is-selected')?.dataset.status==='drafting');

 // ⑦-2 명부 계정이 바뀜: 로안의 첨삭을 쓰는 동안 명부 줄이 다른 계정으로 바뀌면, 저장이 403으로 막히고 다시 읽어 「글을 다시 찾지 못했어요」로 알린다.
 await desk.frame.click('[data-hr-key="week:3"]');await settle(desk.frame,()=>document.querySelector('.hr-week.is-selected')?.textContent.startsWith('3주'));
 await desk.frame.click('[data-hr-key="row:'+w.learners.l4.id+'"]');await settle(desk.frame,()=>/로안/.test(document.querySelector('.hr-editor-who')?.textContent||'')&&!!document.querySelector('.hr-essay'));
 await desk.frame.fill('[data-hr-key="comment:W3-1:fix"]','「증가 했다」는 붙여 써요.〔띄〕');
 await w.relink('l4');
 await desk.frame.click('[data-hr-key="save:draft"]');
 await settle(desk.frame,()=>/열어 둔 글을 다시 찾지 못했어요/.test(document.querySelector('.hr-status')?.textContent||''));
 check('명부 계정이 바뀐 글: 첨삭 칸을 닫고 그 학생은 「아직 안 냄」',!(await desk.frame.$('.hr-essay'))&&(await desk.frame.getAttribute('[data-hr-key="row:'+w.learners.l4.id+'"]','data-status'))==='none');
 check('명부 계정이 바뀐 글의 첨삭은 서버에 들어가지 않았다',!(await w.f.sql`select parts from engine.synk_class_homework_feedback`).some(r=>JSON.stringify(r.parts).includes('붙여 써요')));
 await shoot(desk,'11-relinked');

 // ⑧ 과제 표가 없는 서버(함수만 먼저 올라감): 오류가 아니라 「서버 준비가 끝나면」
 w.setUnavailable(true);
 for(const s of [desk,phone]){await reload(s);await openHomework(s);
  check(`${s.tag} 과제 표 없음 → 서버 준비 안내`,(await s.frame.getAttribute('.hr','data-state'))==='unavailable');await shoot(s,'09-unavailable');}
 w.setUnavailable(false);

 // ⑨ 5주차(개요 표 + 서론): 시계를 5주차 금요일로
 w.setClock('2027-04-08T22:00:00');await w.submit('l1','2027-04-08T22:00:00',{week:5,kind:'writing',answers:W5_ANSWERS});w.setClock('2027-04-09T10:00:00');
 for(const v of VIEWPORTS){const s=await open(v,KST('2027-04-09T10:00:00'));t.after(()=>s.context.close());await openHomework(s);
  await settle(s.frame,()=>document.querySelector('.hr-week.is-selected')?.textContent.startsWith('5주'));
  await s.frame.click('[data-hr-key="row:'+w.learners.l1.id+'"]').catch(()=>{});await settle(s.frame,()=>!!document.querySelector('.hr-field .hr-table'));
  check(`${v.tag} 5주차 개요 표와 서론`,/서론/.test(await s.frame.textContent('.hr-editor'))&&(await s.frame.$$eval('.hr-field .hr-table tbody tr',r=>r.length))===5);
  await shoot(s,'10-week5-grid');}

 // 일부러 만든 응답만 뺀다: 판 겹침 409 네 번(⑤ 학생이 고쳐 냄, ⑤-2 다른 창의 저장, ⑥ 응답을 잃은 같은 저장과 그 뒤 돌려주기),
 // 명부 계정이 바뀐 글 403 한 번(⑦-2), 과제 표 없는 서버 404 두 번(⑧ 1280·390). 그 밖의 오류·CSP 위반은 0이어야 한다.
 const homeworkHttp=c=>c.type==='http'&&c.text.includes('/api/teacher/homework?'),failedLoad=c=>c.type==='error'&&/^Failed to load resource: the server responded with a status of (409|404|403)/.test(c.text);
 const expected=result.console.filter(homeworkHttp).map(c=>c.text.slice(0,3)).sort().join(',');
 check('예상한 응답만: 409 네 번 · 403 한 번 · 404 두 번',expected==='403,404,404,409,409,409,409'&&result.console.filter(failedLoad).length===7,result.console.filter(c=>homeworkHttp(c)||failedLoad(c)));
 check('콘솔 오류·CSP 위반 0',!result.console.filter(c=>c.type!=='warning'&&!homeworkHttp(c)&&!failedLoad(c)).length,result.console);
 result.finishedAt=new Date().toISOString();
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,1)+'\n');
});
