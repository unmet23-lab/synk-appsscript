#!/usr/bin/env node
// 드라마 시범판 학습 기록 왕복 리허설(2026-11-02): 화면 → 이PC 시범 서버 → 학습 기록 서버(talk synk-learning과 같은 서비스 · 같은 배포 묶음)
// → 저장(PGlite, 메모리) → 화면으로 다시 읽기를 **합성 계정** 하나로 본다. 운영 · 리허설 DB와 실제 계정을 건드리지 않는다.
// 준비: talk origin/master를 git 밖에 풀어 둔다(README의 명령). 받아 적기는 시범판과 같은 기존 키 통로(한 테이크 몇 원)다.
// 실행: NODE_PATH=<SYNK-talk>/node_modules node experiences/drama/qa/학습기록-20261102/리허설.mjs --talk <풀어 둔 talk> [--port 8796] [--동의 끔] [--받아쓰기 흉내]
//  --받아쓰기 흉내: 받아 적기를 부르지 않고 .tmp/drama-learning-20261102/next-transcript.txt의 글을 받아 적은 글로 쓴다(테이크마다 미리 고쳐 둔다).
//    판정 · trail · 기록 길은 그대로 돌고, 외부 호출 · 비용이 없다.
// 끝내면(Ctrl+C) 저장된 사건의 꼴 · 능력 · 판정만(받아 적은 글 · 소리 없음) .tmp/drama-learning-20261102/summary-<시각>.json에 적는다.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const args=process.argv.slice(2),opt=name=>{const i=args.indexOf(name);return i>=0?args[i+1]:null;};
const talk=path.resolve(opt('--talk')||path.join(REPO,'.tmp/drama-learning-20261102/talk'));
const port=Number(opt('--port')||8796),consent=opt('--동의')!=='끔',mimic=opt('--받아쓰기')==='흉내';
const NEXT=path.join(REPO,'.tmp/drama-learning-20261102/next-transcript.txt');
const require=createRequire(path.join(talk,'package.json'));
const {PGlite}=require('@electric-sql/pglite');
const {createPostgresJsonDriver}=require('./tests/lib/postgres-json-fixture');
const {createPgStore}=require('./lib/synk-store');
const {createService}=require('./lib/synk-server');
const Bundle=require('./supabase/functions/_shared/synk-atlas.js');
const {createPilotServer}=await import(pathToFileURL(path.join(REPO,'tools/drama-pilot.mjs')).href);
const {PILOT}=await import(pathToFileURL(path.join(REPO,'experiences/drama/pilot/content.mjs')).href);

// talk tests/atlas-spoken-server.test.js와 같은 바탕 표 + 학습 기록 마이그레이션 둘.
const db=new PGlite();
await db.exec(`create schema auth;create schema engine;create role anon;create role authenticated;create role service_role;
  create table auth.users(id uuid primary key);
  create table engine.schema_migrations(version text primary key,name text not null,checksum text not null,applied_at timestamptz default now());
  insert into engine.schema_migrations(version,name,checksum) values('20260927090000','base','synthetic');
  create table engine.learners(learner_id uuid primary key default gen_random_uuid(),auth_user_id uuid unique references auth.users,student_code text not null,active boolean default true,revoked_before timestamptz);
  create table engine.staff(staff_id uuid primary key default gen_random_uuid(),auth_user_id uuid unique references auth.users,role text,active boolean default true,revoked_before timestamptz);`);
for(const name of ['20261002100000_synk_account_learning_c16.sql','20261002120000_synk_messenger_identity_c16.sql'])await db.exec(fs.readFileSync(path.join(talk,'supabase/migrations',name),'utf8'));
const sql=createPostgresJsonDriver(db);
const identity={id:randomUUID(),sessionId:randomUUID(),issuedAt:Math.floor(Date.now()/1000)-10,providers:['email']};
await sql`insert into auth.users(id) values(${identity.id}::uuid)`;
// synk-learning(증분 검증)과 같은 꼴. 계정 · 동의는 같은 저장소의 account 길로.
const service=createService({store:createPgStore(sql),verify:async()=>identity,learningAllowed:()=>true,incrementalValidation:Bundle});
const call=async(route,{method='GET',query='',body}={})=>{
  const r=await service(new Request(`https://synthetic.invalid/${route}${query}`,{method,headers:{'x-synk-product':'world','x-synk-contract':'1',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),route);
  return {status:r.status,body:await r.json()};
};
const account=(await call('account')).body;
let revision=account.learning.revision,enabled=account.learning.enabled;
if(enabled!==consent){const r=await call('account',{method:'POST',body:{action:'learning-consent',enabled:consent,expected_revision:revision}});if(r.status!==200)throw Error(JSON.stringify(r.body));revision=r.body.revision;enabled=consent;}
const accountKey=account.account.synk_user_id;
let gets=0,posts=0,refused=0;
const learning={
  describe:()=>({accountKey,revision,connected:enabled}),
  async request(session,{op,after,revision:rev,events,runId}){
    const r=op==='get'?await call('learning',{query:`?after=${encodeURIComponent(after)}&revision=${encodeURIComponent(rev)}`})
      :await call('learning',{method:'POST',body:{revision:rev,events,...(runId?{runId}:{})}});
    if(op==='get')gets++;else if(r.status===200)posts++;else refused++;
    console.log(`학습 기록 ${op} → ${r.status}${r.body?.error?.code?' '+r.body.error.code:''}${op==='post'?` (사건 ${events?.length||0})`:''}`);
    if(op==='post'&&!closing)write('latest.json').catch(e=>console.error('요약 쓰기 실패',e.message));
    return r;
  }};
const outcomes=[];
const app=createPilotServer({lesson:PILOT,port,learning,ledger:e=>{if(e.event==='transcription')outcomes.push(e.outcome);},
  ...(mimic?{analysis:true,transcribe:async()=>({text:fs.readFileSync(NEXT,'utf8').trim(),languages:[{code:'ko'}]})}:{})});
await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port,'127.0.0.1',resolve);});
console.log(`리허설 시범판: ${app.origin}/ · 합성 계정 학습 기록 동의 ${enabled?'켬':'끔'} · revision ${revision}`);

async function summary(){
  const rows=await sql`select event_id,payload from engine.synk_learning_events where synk_user_id=${accountKey}::uuid order by server_seq`;
  const ev=rows.map(r=>r.payload),byPid=new Map(ev.filter(e=>e.type==='practice.presented').map(e=>[e.id,e]));
  const text=JSON.stringify(ev);
  return {at:new Date().toISOString(),talk:'origin/master 6f18ed32(풀어 둔 사본)',consent:enabled,revision,transcription:mimic?'흉내':'기존 키 통로',outcomes,requests:{gets,posts,refused},stored:ev.length,
    types:Object.fromEntries([...new Set(ev.map(e=>e.type))].map(t=>[t,ev.filter(e=>e.type===t).length])),
    presented:[...byPid.values()].map(e=>({item:e.itemKey,skill:e.measure.skillId,format:e.measure.responseFormat,difficulty:e.measure.difficulty,firstExposure:e.firstExposure??null})),
    attempts:ev.filter(e=>e.type==='practice.attempted').map(e=>({attemptNo:e.attemptNo,verdict:e.verdict,reason:e.reason??null,skill:byPid.get(e.presentationId)?.measure.skillId??null})),
    helps:ev.filter(e=>e.type==='practice.helped').map(e=>e.level),excluded:ev.filter(e=>e.type==='record.excluded').length,
    // 받아 적은 글 · 대사 글이 저장소에 없는지(한글 음절이 사건 어디에도 없어야 한다).
    hangulInStore:/[가-힣]/.test(text)};
}
// 서버가 사건을 받을 때마다 latest.json을 새로 쓴다(브라우저 시험 도중에 읽는다). 끝낼 때는 시각을 붙여 한 번 더.
async function write(name){
  const s=await summary(),dir=path.join(REPO,'.tmp/drama-learning-20261102');fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,name||`summary-${s.at.replace(/[:.]/g,'-')}.json`);fs.writeFileSync(file,JSON.stringify(s,null,2));return {s,file};
}
let closing=false;
process.on('SIGINT',async()=>{
  if(closing)return;closing=true;
  const {s,file}=await write();console.log(JSON.stringify(s,null,2));console.log(`→ ${file}`);
  app.server.close();await sql.end?.();await db.close();process.exit(0);
});
