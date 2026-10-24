import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createTeacherServer} from './server.mjs';
import {createLinkedServer} from './linked-server.mjs';
import {connectAccountHost,createLinkedHost,createDemoHost,detachedAccountHost} from './teacher-host.mjs';
import {createSelectionSession} from './selection-session.mjs';

const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
// 교사 앱이 브라우저에서 실제로 불러오는 모듈 전부. app.mjs의 정적 import를 끝까지 따라간다.
function closure(entry='app.mjs',seen=new Set()){
  if(seen.has(entry))return seen;seen.add(entry);
  for(const [,spec] of read(entry).matchAll(/^import\s[^;]*?from\s*'([^']+)'/gm)){assert.match(spec,/^\.\/[a-z-]+\.mjs$/,`${entry} → ${spec}: 교사 frame은 이 폴더의 모듈만 부른다`);closure(spec.slice(2),seen);}
  return seen;
}
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(`http://127.0.0.1:${server.address().port}`)));
const close=server=>new Promise(resolve=>server.close(resolve));

test('the demo and local-linked servers serve the whole browser import closure of the teacher app and nothing private',async()=>{
  const files=[...closure()].sort();
  for(const name of ['app.mjs','teacher-host.mjs','selection-session.mjs','sharing-fence.mjs','workspace-overview.mjs'])assert.ok(files.includes(name),name);
  const servers=[await createTeacherServer(),await createLinkedServer()];
  try{
    for(const server of servers){
      const base=await listen(server);
      for(const file of files){const response=await fetch(`${base}/${file}`);assert.equal(response.status,200,`${base} ${file}`);assert.match(response.headers.get('content-type'),/^text\/javascript/);assert.equal(await response.text(),read(file),file);}
      for(const file of ['model.mjs','account-service.mjs','learning-runs.mjs','fixtures.mjs','teacher-boundary.test.mjs','selection-session.test.mjs'])assert.equal((await fetch(`${base}/${file}`)).status,404,`${base} ${file}`);
    }
  }finally{for(const server of servers)if(server.listening)await close(server);}
});

// 교사 frame 한 장이 쓰는 파일: index.html, 그 문서가 거는 CSS, 부모 포털이 거는 workspace-overview.css, app.mjs의 import 범위.
// 이 frame을 내보내는 곳(데모 4290·로컬 연결 4295·개발 허브 4280·회사 서버·회사 이미지 COPY·빌드 문맥)은 모두 이 집합만 적는다 — 빠지면 frame이 안 뜨고, 늘면 공개 범위가 넓어진다.
function frameFiles(){const css=[...read('index.html').matchAll(/<link rel="stylesheet" href="\.\/([^"]+)"/g)].map(m=>m[1]);return new Set(['index.html',...css,'workspace-overview.css',...closure()]);}
const companyDir=new URL('../../docs/마케팅/온라인마케팅지도/engagement/company/',import.meta.url),companyText=name=>fs.readFileSync(new URL(name,companyDir),'utf8');
const quoted=list=>[...list.matchAll(/'([^']+)'/g)].map(m=>m[1]);
function consumerLists(){
  const only=(text,pattern,label)=>{const found=[...text.matchAll(pattern)];assert.equal(found.length,1,label+' 목록은 한 곳');return found[0][1];};
  const company=companyText('server.mjs'),docker=companyText('Dockerfile'),ignore=companyText('Dockerfile.dockerignore');
  assert.doesNotMatch(docker,/^COPY (?!\[).*teacher-world/m,'Dockerfile의 교사 화면 COPY는 JSON 꼴 목록만 쓴다');
  const copied=[...docker.matchAll(/^COPY (\[.*\])\r?$/gm)].flatMap(m=>JSON.parse(m[1]).slice(0,-1)).filter(source=>source.startsWith('experiences/teacher-world')&&!source.startsWith('experiences/teacher-world/assets/'));
  return {
    'linked-server teacherFiles':quoted(only(read('linked-server.mjs'),/const teacherFiles=new Set\(\[([^\]]*)\]\)/g,'linked-server')),
    'demo server publicFiles':quoted(only(read('server.mjs'),/const publicFiles = new Set\(\[([^\]]*)\]\)/g,'demo server')).filter(name=>!['student.html','student.mjs'].includes(name)),
    'learning-hub classroomPublic':quoted(only(fs.readFileSync(new URL('../learning-hub/server.mjs',import.meta.url),'utf8'),/'teacher-world':new Set\(\[([^\]]*)\]\)/g,'learning-hub')),
    'company server files':[...(company.includes("files['/teacher-world/']=['../../../../../experiences/teacher-world/index.html'")?['index.html']:[]),...quoted(only(company,/for\(const file of \[([^\]]*)\]\)files\['\/teacher-world\/'\+file\]/g,'company server'))],
    'company Dockerfile COPY':copied.map(source=>source.slice('experiences/teacher-world/'.length)),
    'company dockerignore':ignore.split(/\r?\n/).filter(line=>line.startsWith('!experiences/teacher-world/')&&!line.startsWith('!experiences/teacher-world/assets/')).map(line=>line.slice('!experiences/teacher-world/'.length)).filter(name=>name!==''),
  };
}

test('every server and image that hands out the teacher frame lists exactly the frame files, no more and no less',()=>{
  const expected=[...frameFiles()].sort();
  for(const name of ['index.html','app.mjs','teacher-host.mjs','selection-session.mjs','sharing-fence.mjs','homework-review.mjs','course-writing-ui.mjs','workspace-overview.css'])assert.ok(expected.includes(name),name);
  for(const [consumer,list] of Object.entries(consumerLists())){
    assert.equal(new Set(list).size,list.length,consumer+': 같은 파일을 두 번 적지 않는다');
    assert.deepEqual([...list].sort(),expected,consumer);
  }
});

// 기존 가짜 서버 경계 그대로: 개발 허브는 learning-hub createServer, 회사 서버는 teaching-service 시험처럼 임시 데이터 폴더의 createCompanyApp.
test('the dev hub and the company host serve the teacher import closure byte for byte as JavaScript and keep private teacher files closed',async t=>{
  const files=[...closure()].sort(),{createServer}=await import('../learning-hub/server.mjs'),{createCompanyApp}=await import(new URL('server.mjs',companyDir).href);
  const hub=createServer(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'synk-teacher-boundary-'));
  const company=createCompanyApp({dataDir:directory,port:0,allowTestHost:true,schedule:false,backgroundJobsEnabled:false,teachingConfig:null,synkIdentityConfig:null,customerIdentityConfig:null,messengerDriveStorage:{active:async()=>null,status:async()=>({provider:'local'})}});
  t.after(async()=>{await company.stop();if(hub.listening)await close(hub);assert.ok(path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(directory,{recursive:true,force:true});});
  const bases=[(await listen(hub))+'/teacher-world',`http://127.0.0.1:${(await company.start()).port}/teacher-world`];
  for(const base of bases){
    for(const file of files){const response=await fetch(`${base}/${file}`);assert.equal(response.status,200,`${base}/${file}`);assert.match(response.headers.get('content-type'),/^text\/javascript/,`${base}/${file}`);assert.equal(await response.text(),read(file),`${base}/${file}`);}
    for(const file of ['model.mjs','account-service.mjs','learning-runs.mjs','linked-server.mjs','server.mjs','fixtures.mjs','course-writing.mjs','topik4-course.json','teacher-boundary.test.mjs','selection-session.test.mjs','qa/homework-review-browser.test.mjs','.local/linked-state.json'])assert.equal((await fetch(`${base}/${file}`)).status,404,`${base}/${file}`);
  }
});

const reply=(body,status=200)=>({ok:status<400,status,json:async()=>body});
const lease=({ready=true,current=()=>true}={})=>({ready,current,sameAccess:()=>true});
const origin='http://127.0.0.1:44001';
function portal({classId='class-a',selection=null}={}){
  const calls=[],posted=[],parent={location:{origin},postMessage:(data,target)=>posted.push({data,target}),SYNKClassroomSelection:selection,SYNKClassroomHost:{mode:'account-linked',classId,request:(path,body)=>{calls.push({path,body});return Promise.resolve({ok:true,mode:'account-linked'});}}};
  return {parent,frame:{parent},calls,posted};
}

test('the account port opens only inside a same-origin classroom parent and listens only to that parent',()=>{
  const top={};top.parent=top;
  for(const frame of [top,{parent:{location:{origin:'https://other.invalid'},SYNKClassroomHost:{mode:'account-linked'}}},{parent:{location:{origin},SYNKClassroomHost:{mode:'local-linked'}}}])assert.throws(()=>connectAccountHost({frame,origin}),/「내 수업」 탭에서 열어 주세요/);
  const p=portal({selection:{classId:'class-a',learnerId:'b'}}),port=connectAccountHost({frame:p.frame,origin});
  const sharing={type:'synk-teacher-sharing',classId:'class-a',learners:[]},select=learnerId=>({type:'synk-teacher-select',classId:'class-a',learnerId});
  assert.equal(port.receive({source:{},origin,data:sharing}),null);assert.equal(port.receive({source:p.parent,origin:'http://127.0.0.1:9',data:sharing}),null);
  assert.deepEqual(port.receive({source:p.parent,origin,data:sharing}),sharing);
  assert.equal(port.receive({source:p.parent,origin,data:select('a')}),null,'부모의 지금 선택과 다르면 따르지 않는다');assert.deepEqual(port.receive({source:p.parent,origin,data:select('b')}),select('b'));
  const row={id:'a',revision:1,enabled:false,connected:true,revoked:false};
  assert.equal(port.sharingScope('class-b',[row]),null);assert.equal(port.sharingScope('class-a',[{id:'a',revision:1}]),null);assert.equal(port.sharingScope('class-a',null),null);
  assert.deepEqual(port.sharingScope('class-a',[row]),[row]);assert.deepEqual(port.sharingScope('class-a',[]),[],'빈 명부도 확인된 명부다');
  port.announce('class-a','b');assert.deepEqual(p.posted,[{data:{type:'synk-teacher-selected',classId:'class-a',learnerId:'b'},target:origin}]);
  p.parent.SYNKClassroomHost={...p.parent.SYNKClassroomHost};
  assert.equal(port.attached(),false);assert.equal(port.sharingScope('class-a',[row]),null);assert.equal(port.receive({source:p.parent,origin,data:select('b')}),null);
});

test('the account port drops an answer when the parent host or the access generation changed while it was in flight',{timeout:10000},async()=>{
  const p=portal();let release;p.parent.SYNKClassroomHost.request=(path,body)=>{p.calls.push({path,body});return new Promise(resolve=>{release=resolve;});};
  const port=connectAccountHost({frame:p.frame,origin});
  await assert.rejects(port.request('/api/observations',{note:'x'},lease({ready:false})),/연결을 다시 확인하는 중이에요/);assert.equal(p.calls.length,0);
  let current=true;const writing=port.request('/api/observations',{note:'x'},lease({current:({write})=>current||!write}));current=false;release({ok:true});
  await assert.rejects(writing,error=>error.code==='SESSION_CHANGED'&&/수업 연결이 바뀌었어요/.test(error.message));
  const reading=port.request('/api/workspace',undefined,lease({current:({write})=>current||!write}));release({ok:true,mode:'account-linked'});assert.deepEqual(await reading,{ok:true,mode:'account-linked'},'읽기는 학생 선택이 바뀌어도 받는다');
  const late=port.readWorkspace(lease());p.parent.SYNKClassroomHost={...p.parent.SYNKClassroomHost};release({ok:true,mode:'account-linked'});
  await assert.rejects(late,error=>error.code==='SESSION_CHANGED');
  await assert.rejects(port.request('/api/workspace',undefined,lease()),error=>error.code==='SESSION_CHANGED'&&/다시 열어 주세요/.test(error.message));
  await assert.rejects(detachedAccountHost().readWorkspace(lease()),error=>error.code==='SESSION_CHANGED');
});

test('the local-linked port keeps its bearer in its own tab key and signs out only on a current 401',{timeout:10000},async()=>{
  const sent=[],replies=[],store=new Map([['other.key','kept']]);let ended=null;
  const send=(path,options)=>{sent.push({path,options});return Promise.resolve(replies.shift());};
  const storage=()=>({getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)});
  const port=createLinkedHost({send,storage,onSignedOut:message=>{ended=message;}});
  await assert.rejects(port.request('/api/workspace',undefined,lease()),/교사 연결 키로 먼저 열어 주세요/);assert.equal(sent.length,0);
  replies.push(reply({token:''}));await assert.rejects(port.exchangeKey('key',lease()),/교사 연결 키를 확인하지 못했어요/);
  replies.push(reply({token:'t'.repeat(64)}));const token=await port.exchangeKey('key',lease());assert.deepEqual(JSON.parse(sent[1].options.body),{key:'key'});assert.equal(sent[1].options.headers.Authorization,undefined);
  port.adopt(token);assert.equal(store.get('synk.teacher.local-linked.session'),token);assert.equal(store.get('other.key'),'kept');
  await assert.rejects(port.request('/api/observations',{note:'x'},lease({ready:false})),/연결을 다시 확인하는 중이에요/);assert.equal(sent.length,2,'확인되지 않은 판 위에서는 쓰기를 보내지 않는다');
  replies.push(reply({ok:false,code:'AUTH_REQUIRED'},401));await assert.rejects(port.request('/api/workspace',undefined,lease({current:()=>false})),error=>error.code==='SESSION_CHANGED');assert.equal(ended,null,'앞선 연결의 401은 지금 연결을 끊지 않는다');
  replies.push(reply({ok:false,code:'AUTH_REQUIRED'},401));await assert.rejects(port.request('/api/workspace',undefined,lease()),/교사 연결 키를 확인하고 다시 열어 주세요/);
  assert.equal(ended,'연결이 끊겼어요. 교사 연결 키로 다시 열어 주세요.');assert.equal(sent.at(-1).options.headers.Authorization,'Bearer '+token);
  replies.push(reply({mode:'demo'}));await assert.rejects(port.readWorkspace(lease()),error=>error.code==='INVALID_CLASSROOM_RESPONSE'&&error.status===403);
  port.forget();assert.equal(port.signedIn,false);assert.equal(store.has('synk.teacher.local-linked.session'),false);assert.equal(store.get('other.key'),'kept');
  const blocked=createLinkedHost({send,storage:()=>{throw Error('storage blocked');}});blocked.restore();assert.equal(blocked.signedIn,false);blocked.adopt('x');assert.equal(blocked.signedIn,true);blocked.forget();
});

test('the demo port never sends a bearer and signs writes only with the preview token of its last workspace',{timeout:10000},async()=>{
  const sent=[];const send=(path,options)=>{sent.push({path,options});return Promise.resolve(reply(path==='/api/workspace'?{mode:'demo',_token:'p'.repeat(48)}:{ok:true}));};
  const port=createDemoHost({send});assert.equal(port.linked,false);
  await port.request('/api/assignments',{title:'x'},lease());assert.equal(sent[0].options.headers['X-SYNK-Preview-Token'],'','판을 읽기 전에는 토큰이 없다');
  await port.readWorkspace(lease());await port.request('/api/assignments',{title:'x'},lease({ready:false}));
  assert.deepEqual(sent.map(row=>row.options.headers),[{'Content-Type':'application/json','X-SYNK-Preview-Token':''},{},{'Content-Type':'application/json','X-SYNK-Preview-Token':'p'.repeat(48)}]);
  for(const port of [createDemoHost({send}),createLinkedHost({send,storage:()=>null})])for(const name of ['focus','announce'])assert.doesNotThrow(()=>port[name]('class-a','a'));
});

// 선택 세션의 명시 인터페이스: 어떤 전이가 세대를 올리고 작성 창을 어떤 까닭으로 내리는지.
const student=(id,revision=2,enabled=true)=>({id,name:id,accountConnected:true,connectedAt:'2026-10-01T00:00:00Z',sharing:{enabled,revision},skills:[]});
const snapshot=learners=>({mode:'account-linked',teacher:{id:'t'},classes:[{id:'class-a',name:'반',learners}],content:[],assignments:[]});
test('the selection session separates a plain selection change, a permission loss, a suspended workspace and sign-out',()=>{
  const reasons=[],session=createSelectionSession({onRelease:reason=>reasons.push(reason)});session.setLinked(true);
  session.accept(snapshot([student('a'),student('b')]));assert.equal(session.learnerId,'a');
  const before=session.lease();session.captureDraft('note');
  assert.equal(session.chooseLearner('nobody'),false);assert.deepEqual(reasons,[]);
  assert.equal(session.chooseLearner('b'),true);assert.deepEqual(reasons,['selection']);assert.equal(before.current({write:true}),false);assert.equal(before.current(),true,'읽기 세대는 그대로다');
  const draft=session.captureDraft('note');session.adoptSharing([{id:'a',revision:3,enabled:false,connected:true,revoked:false},{id:'b',revision:2,enabled:true,connected:true,revoked:false}]);
  assert.deepEqual(session.fence(),{changed:true});assert.equal(session.holds(draft),true,'다른 학생의 공유 변화로는 닫히지 않는다');assert.deepEqual(reasons,['selection']);
  session.adoptSharing([{id:'a',revision:3,enabled:false,connected:true,revoked:false},{id:'b',revision:3,enabled:false,connected:true,revoked:false}]);
  session.fence();assert.equal(session.holds(draft),false);assert.deepEqual(reasons,['selection','permission']);
  const read=session.beginRead();session.suspend();assert.deepEqual(reasons.at(-1),'suspend');assert.equal(session.ready,false);assert.equal(session.classId,'class-a');assert.equal(session.learnerId,'b');assert.equal(read(),true);
  session.signOut();assert.deepEqual(reasons.at(-1),'signout');assert.equal(session.classId,null);assert.equal(session.learnerId,null);assert.equal(read(),false,'연결이 끝나면 앞선 읽기의 답은 버린다');
});
