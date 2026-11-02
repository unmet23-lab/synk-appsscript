// 드라마 말하기 시범판의 학습 기록(Atlas Trail, 응답 꼴 spoken, 2026-11-02): 테이크 → 시도 하나, 「혼자 해 봄」은 서버가 정함,
// 호스트(계정 · 학습 기록 동의)가 없으면 아무것도 남기지 않음, 사건에 받아 적은 글이 없음. 실제 서버 왕복은 experiences/drama/qa/학습기록-20261102.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {trailOf,publicLesson} from '../tools/lib/drama-pilot-service.mjs';
import {createPilotServer} from '../tools/drama-pilot.mjs';
import PILOT from '../experiences/drama/pilot/content.mjs';

const require=createRequire(import.meta.url);
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const Drama=require('../experiences/drama/pilot/learning-entry.cjs');
const Atlas=require('../atlas/engine.js');
const TRANSCRIPT='선배님 도서관이 어디예요';

function memoryStorage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),dump:()=>[...m.values()].join('\n')};}
// 합성 계정의 리허설 호스트. posts에 서버로 간 사건이 쌓인다.
function rehearsal({connected=true}={}){
  const posts=[],storage=memoryStorage();
  const transport={get:async({revision})=>({ok:true,events:[],cursor:0,hasMore:false,revision}),
    post:async({revision,events})=>{posts.push(...events);return {ok:true,revision,accepted:events.map(e=>e.id)};}};
  const win={};
  const host=Drama.createRehearsalHost({accountKey:randomUUID(),revision:1,connected,transport,storage,win});
  return {host,posts,storage,recorder:Drama.createRecorder({win})};
}
const settle=async()=>{for(let i=0;i<20;i++)await new Promise(r=>setTimeout(r,5));};

test('trailOf: 「혼자 해 봄」은 검수 통과 새 상황에서 모범을 보기 전 첫 판정이 확신한 것뿐이다',()=>{
  const pass={kind:'pass',note:null,sure:true},note={kind:'note',note:{kind:'ending'},sure:false},pending={kind:'pending',note:null,sure:false};
  const B={phase:'transfer',status:'ok',independentEligible:true,reviewed:true};
  assert.deepEqual(trailOf({...B,observation:pass}),{correct:true,assessable:true});
  assert.deepEqual(trailOf({...B,observation:note}),{correct:false,assessable:true});
  assert.deepEqual(trailOf({...B,observation:pending}),{correct:null,assessable:false});
  assert.deepEqual(trailOf({...B,observation:{...pass,sure:false}}),{correct:true,assessable:false},'확신 없는 통과');
  assert.deepEqual(trailOf({...B,reviewed:false,observation:pass}),{correct:true,assessable:false},'검수 전 명세');
  assert.deepEqual(trailOf({...B,independentEligible:false,observation:pass}),{correct:true,assessable:false},'모범을 봤거나 두 번째 판정');
  for(const phase of ['scene','retake'])assert.deepEqual(trailOf({...B,phase,observation:pass}),{correct:true,assessable:false},phase);
  assert.deepEqual(trailOf({phase:'scene',status:'no_speech'}),{correct:null,assessable:false,reason:'unanswered'});
  assert.deepEqual(trailOf({phase:'scene',status:'unclear',transcript:'',observation:pending}),{correct:null,assessable:false,reason:'unanswered'});
  assert.deepEqual(trailOf({phase:'scene',status:'unclear',transcript:'뭐라고',observation:pending}),{correct:null,assessable:false},'글은 받아 적음 = 판정 보류');
});

test('시범 대사에는 말하기 지도의 능력 이름이 있고, 새 상황은 능력 이름만 화면에 간다(답 · 명세는 아님)',()=>{
  const map=require('../strata').createMap(require('../strata/maps/ko-speaking.json'));
  for(const line of [...PILOT.scene.filter(x=>x.type==='student'),PILOT.transfer])assert.equal(map.getNode(line.skill)?.kind,'skill',line.id);
  const pub=publicLesson(PILOT);
  // 한국어 상황 글(promptKo)은 답 낱말을 쓰지 않고, reviewed는 칸 명세 검수 여부뿐이다(11-02).
  assert.deepEqual(Object.keys(pub.transfer).sort(),['id','prompt','promptKo','reviewed','skill']);
  for(const key of PILOT.transfer.spec.keys)assert.ok(!pub.transfer.promptKo.includes(key.word),key.word);
  assert.ok(pub.scene.filter(x=>x.type==='student').every(x=>x.skill&&!x.spec));
});

test('호스트가 없으면(로그인 · 동의 전) 기록기를 만들지 않는다',()=>{
  assert.equal(Drama.createRecorder({win:null}),null);
  assert.equal(Drama.createRecorder({win:{}}),null);
});

test('차례 하나 = 보임 하나, 테이크 = 시도(spoken). 서버 trail · 도움 · 「제가 한 말과 달라요」가 그대로 남고 받아 적은 글은 없다',async()=>{
  const {posts,storage,recorder}=rehearsal();
  const scene=recorder.open({lineId:'s1e01-7',skillId:'ko.speaking.ask',phase:'scene'});
  scene.help('text');scene.help('text');
  scene.take({kind:'result',data:{status:'no_speech',transcript:'',trail:{correct:null,assessable:false,reason:'unanswered'}}});
  scene.take({kind:'result',data:{status:'ok',transcript:TRANSCRIPT,observation:{kind:'note'},trail:{correct:false,assessable:false}}});
  scene.help('answer');
  scene.take({kind:'off'});
  const retake=recorder.open({lineId:'s1e01-7',skillId:'ko.speaking.ask',phase:'retake'});
  retake.take({kind:'result',data:{status:'ok',transcript:TRANSCRIPT,trail:{correct:true,assessable:false}}});
  retake.excludeLast();retake.excludeLast();
  const transfer=recorder.open({lineId:'s1e01-t4',skillId:'ko.speaking.ask',phase:'transfer'});
  transfer.take({kind:'result',data:{status:'ok',transcript:TRANSCRIPT,trail:{correct:true,assessable:true}}});
  transfer.help('answer');
  transfer.take({kind:'down'});
  await settle();
  const presented=posts.filter(e=>e.type==='practice.presented');
  assert.deepEqual(presented.map(e=>[e.measure.responseFormat,e.measure.skillId,e.measure.modality,e.measure.difficulty]),
    [['spoken','ko.speaking.ask','speaking',1],['spoken','ko.speaking.ask','speaking',1],['spoken','ko.speaking.ask','speaking',2]]);
  const attempts=posts.filter(e=>e.type==='practice.attempted');
  assert.deepEqual(attempts.map(e=>[e.attemptNo,e.verdict,e.reason??null]),
    [[1,'unassessed','unanswered'],[2,'unassessed',null],[3,'unassessed',null],[1,'unassessed',null],[1,'correct',null],[2,'unassessed',null]]);
  assert.deepEqual(posts.filter(e=>e.type==='practice.helped').map(e=>e.level),['cue','answer','answer'],'같은 도움은 한 번만');
  const excluded=posts.filter(e=>e.type==='record.excluded');
  assert.equal(excluded.length,1);assert.equal(excluded[0].targetId,attempts[3].id);
  // 서버가 받는 Trail 계약(검증기)을 그대로 통과한다.
  {const scope={domain:'LAB',workspace:'learning',subject:'device'};assert.deepEqual(Atlas.validateIncrement({scope,events:posts}).map(e=>e.id),posts.map(e=>e.id));assert.doesNotThrow(()=>Atlas.createSession({scope,events:posts}));}
  const sent=JSON.stringify(posts);
  assert.ok(!sent.includes(TRANSCRIPT)&&!sent.includes('도서관'),'받아 적은 글 · 대사 글은 사건에 없다');
  assert.ok(!storage.dump().includes(TRANSCRIPT),'기기 저장에도 없다');
});

test('학습 기록 동의가 꺼진 계정은 서버로 보내지 않는다',async()=>{
  const {posts,recorder}=rehearsal({connected:false});
  const p=recorder.open({lineId:'s1e01-6',skillId:'ko.speaking.explain',phase:'scene'});
  p.take({kind:'result',data:{status:'ok',trail:{correct:true,assessable:false}}});
  await settle();
  assert.equal(posts.length,0);
});

test('모르는 능력 · 차례 이름은 기록하지 않고, 기록 실패가 장면을 멈추지 않는다',()=>{
  const {recorder}=rehearsal();
  assert.equal(recorder.open({lineId:'s1e01-6',skillId:'ko.reading.x',phase:'scene'}),null);
  assert.equal(recorder.open({lineId:'s1e01-6',skillId:'ko.speaking.explain',phase:'audition'}),null);
  const errors=[];
  const broken=Drama.createRecorder({owner:{createGame:()=>{throw new Error('storage');}},onError:e=>errors.push(e.message)});
  assert.equal(broken.open({lineId:'s1e01-6',skillId:'ko.speaking.explain',phase:'scene'}),null);
  assert.deepEqual(errors,['storage']);
});

async function serve(t,overrides={}){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'synk-pilot-learning-'));
  await fs.writeFile(path.join(root,'index.html'),'<!doctype html><title>fixture</title>');
  await fs.writeFile(path.join(root,'atlas-learning.js'),'var DramaLearning={};');
  const probe=await import('node:net');const socket=probe.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));
  const port=socket.address().port;await new Promise(r=>socket.close(r));
  const app=createPilotServer({lesson:PILOT,root,port,analysis:true,
    decode:async()=>({wav:Buffer.from('x'),seconds:4,speechSeconds:3,silent:false}),
    transcribe:async()=>({text:'선생님, 혹시 복사실이 어디에 있는지 아세요?',languages:[{code:'ko'}]}),...overrides});
  await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
  t.after(async()=>{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));await fs.rm(root,{recursive:true,force:true});});
  const init=await fetch(`${app.origin}/api/bootstrap`);const cookie=init.headers.get('set-cookie').split(';')[0];
  const bootstrap=await init.json();
  const headers={cookie,'x-pilot-csrf':bootstrap.csrfToken,origin:app.origin};
  const take=async(lineId,phase)=>{const form=new FormData();form.set('audio',new Blob(['r'],{type:'audio/webm'}),'c.webm');
    for(const [k,v] of Object.entries({lineId,phase,requestId:randomUUID(),consent:'yes'}))form.set(k,v);
    return (await fetch(`${app.origin}/api/take`,{method:'POST',headers,body:form})).json();};
  const learn=(body,h=headers)=>fetch(`${app.origin}/api/learning`,{method:'POST',headers:{...h,'content-type':'application/json'},body:JSON.stringify(body)});
  return {app,bootstrap,take,learn};
}

test('서버: 테이크 응답의 trail이 판정 · 검수 · 첫 노출을 따르고, 학습 기록 길은 리허설 계정이 있을 때만 열린다',async t=>{
  const {bootstrap,take,learn}=await serve(t);
  assert.equal(bootstrap.learning,null);
  assert.deepEqual((await take('s1e01-7','scene')).trail,{correct:false,assessable:false});
  // 새 상황은 검수를 통과한 처음 보는 대사 s1e01-t4(11-02, 운영 talk 대사 은행에 있는 줄 — WORLD 공개판과 같다). t9(편의점)는 talk 은행 재배포 뒤 다음 판.
  assert.equal(PILOT.transfer.id,'s1e01-t4');assert.equal(PILOT.transfer.spec.reviewed,true);assert.equal(PILOT.transfer.spec.free,true);
  const first=await take(PILOT.transfer.id,'transfer');
  assert.equal(first.observation.kind,'pass');assert.deepEqual(first.trail,{correct:true,assessable:true});
  assert.deepEqual((await take(PILOT.transfer.id,'transfer')).trail,{correct:true,assessable:false},'두 번째는 첫 응답이 아니다');
  assert.equal((await learn({op:'get',after:0,revision:1})).status,404);
});

test('서버: 리허설 계정의 학습 기록 길은 CSRF를 지키고 몸통을 그대로 넘긴다',async t=>{
  const seen=[];
  const learning={describe:()=>({accountKey:'synthetic-1',revision:3,connected:true}),
    request:async(session,body)=>{seen.push(body);return {status:200,body:{ok:true,revision:3,events:[],cursor:0,hasMore:false}};}};
  const {bootstrap,learn}=await serve(t,{learning});
  assert.deepEqual(bootstrap.learning,{accountKey:'synthetic-1',revision:3,connected:true});
  assert.equal((await learn({op:'get',after:0,revision:3},{})).status,401,'세션 없음');
  assert.equal((await learn({op:'drop'})).status,400);
  const ok=await learn({op:'post',revision:3,events:[]});
  assert.equal(ok.status,200);assert.deepEqual(seen,[{op:'post',revision:3,events:[]}]);
});

test('묶음(atlas-learning.js)이 원천과 같고, 화면이 그것을 싣는다',async()=>{
  const r=spawnSync(process.execPath,['tools/build-drama-learning.js','--check'],{cwd:REPO,encoding:'utf8'});
  assert.equal(r.status,0,r.stderr||r.stdout);
  const html=await fs.readFile(path.join(REPO,'experiences/drama/pilot/index.html'),'utf8');
  // 주소는 문서 기준 상대 주소(시범 서버 / · WORLD /world/drama/ 둘 다에서 풀린다, 11-02).
  assert.ok(html.indexOf('src="atlas-learning.js"')>0&&html.indexOf('src="atlas-learning.js"')<html.indexOf('src="pilot.mjs"'));
  const pilot=await fs.readFile(path.join(REPO,'experiences/drama/pilot/pilot.mjs'),'utf8');
  assert.match(pilot,/S\.trail\?\.open\(\{ lineId: item\.id, skillId: item\.skill, phase: ctx\.phase \}\)/);
  // 테이크 2 「다시 녹음」은 같은 차례 — 보임을 다시 열지 않는다(아르곤 A2).
  assert.match(pilot,/ctx\.phase === 'retake' && S\.retake && S\.retake\.trail !== undefined\) P = S\.retake\.trail/);
  assert.doesNotMatch(pilot,/\.take\([^)]*transcript/,'화면은 받아 적은 글을 기록기에 넘기지 않는다');
});
