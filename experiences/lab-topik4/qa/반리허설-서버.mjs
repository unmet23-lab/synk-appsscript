// TOPIK 4급 온라인 반 리허설의 로컬 백엔드(반리허설.mjs가 띄운다).
// 운영과 같은 판의 SYNK-talk 코드를 PGlite(메모리 PostgreSQL)에 실제 마이그레이션을 부어 돌린다. 운영 서버·DB·계정은 쓰지 않는다.
// · synk-classroom(반 연결·과제·교사 첨삭): 운영 v15와 같은 talk `0ea47bf`(SYNK-worktrees/talk-classroom-release-20261020)의 lib.
// · classroom(학생 수업 목록)·classroom-sync(교실 PC 동기화): 운영 판은 talk master가 아니라 `codex/classroom-distribution-20261009` 가지다.
//   그 가지의 함수 본체와 lib/수업영상.js를 git에서 꺼내 talk 시험의 Deno 합성 실행(tests/lib/서버함수세우기)으로 돌린다.
// 사람·반은 모두 합성이고 이름에 「(시험)」을 붙인다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';

export const LESSON_REF='origin/codex/classroom-distribution-20261009';
export const CHANNEL='UC'+'R'.repeat(22),PLAYLIST='PLsynkRehearsalTopik4Online',SYNC_KEY='rehearsal-sync-key-'+'0'.repeat(32);
const MEDIA=['20260927090000_classroom_media_c16.sql','20261009120000_classroom_playback_guard_c16.sql','20261009210000_classroom_sync_order_c16.sql'];
const CLASSROOM=['20261002100000_synk_account_learning_c16.sql','20261002120000_synk_messenger_identity_c16.sql','20261002220000_synk_atlas_memory_c16.sql','20261003000000_synk_account_purge_c16.sql',
 '20261003100000_synk_classroom_c16.sql','20261009230000_synk_teaching_care_towns_c16.sql','20261009235000_synk_classroom_enrollment_c16.sql','20261020150000_synk_classroom_homework_c18.sql'];

// 운영 게이트웨이가 서명을 본 뒤의 JWT 꼴. 함수는 sub·iat만 읽는다.
export const tokenFor=identity=>'e30.'+Buffer.from(JSON.stringify({sub:identity.id,iat:identity.issuedAt,role:'authenticated'})).toString('base64url')+'.synthetic';
const subjectOf=header=>{try{return JSON.parse(Buffer.from(String(header||'').replace(/^Bearer /,'').split('.')[1]||'','base64url').toString()).sub||null;}catch{return null;}};

// postgres.js처럼 안쪽 조각(sql`...`)을 바깥 질의에 끼워 넣을 수 있는 PGlite 드라이버. 수업 함수가 명부 조건을 조각으로 넘긴다.
function fragmentDriver(connection){
 const FRAGMENT=Symbol('fragment');
 const value=v=>v instanceof Date?v.toISOString():v!==null&&typeof v==='object'&&!(v instanceof Uint8Array)?JSON.stringify(v):v;
 const compile=(parts,values,params)=>{let text=parts[0];values.forEach((v,i)=>{if(v&&v[FRAGMENT])text+=compile(v.parts,v.values,params);else{params.push(value(v));text+='$'+params.length;}text+=parts[i+1];});return text;};
 const sql=(parts,...values)=>({[FRAGMENT]:true,parts,values,then(resolve,reject){const params=[];return connection.query(compile(parts,values,params),params).then(r=>r.rows).then(resolve,reject);}});
 sql.begin=fn=>connection.transaction(tx=>fn(fragmentDriver(tx)));
 return sql;
}

export async function createRehearsalServer({talkRoot,appRoot,now=()=>Date.now()}){
 const require=createRequire(path.join(talkRoot,'package.json'));
 const {PGlite}=require('@electric-sql/pglite');
 const {createPostgresJsonDriver}=require('./tests/lib/postgres-json-fixture');
 const {createPgStore}=require('./lib/synk-store');
 const {createService}=require('./lib/synk-server');
 const Atlas=require('./lib/atlas/engine');
 const {createClassroomStore}=require('./lib/synk-classroom-store.js');
 const {createClassroomService}=require('./lib/synk-classroom-server.js');
 const {createClassroomHomework}=require('./lib/synk-classroom-homework.js');
 const {createClassroomEnrollment}=require('./lib/synk-classroom-enrollment.js');
 const {model}=require('./supabase/functions/_shared/synk-classroom-runtime.js');
 const {세우기}=require('./tests/lib/서버함수세우기');
 const 토큰=require('./lib/토큰'),계약판=require('./lib/계약판'),CORS=require('./lib/CORS');
 // 수업 함수는 운영 가지에서 꺼낸다(talk 공용 작업본의 미커밋 판과 같고, master와 다르다).
 const lessonDir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-rehearsal-lesson-'));
 const fromRef=file=>execFileSync('git',['-C',talkRoot,'show',`${LESSON_REF}:${file}`],{maxBuffer:32<<20});
 fs.writeFileSync(path.join(lessonDir,'수업영상.js'),fromRef('lib/수업영상.js'));
 const media=require(path.join(lessonDir,'수업영상.js'));
 const lessonSource={classroom:fromRef('supabase/functions/classroom/index.ts').toString('utf8'),sync:fromRef('supabase/functions/classroom-sync/index.ts').toString('utf8')};
 const migration=file=>fs.readFileSync(path.join(talkRoot,'supabase/migrations',file),'utf8');

 const db=new PGlite();
 await db.exec(`create schema auth;create schema engine;create role anon;create role authenticated;create role service_role;
  create table auth.users(id uuid primary key);
  create table engine.schema_migrations(version text primary key,name text,checksum text,applied_at timestamptz default now());
  insert into engine.schema_migrations(version,name,checksum) values('20260911070000','baseline_c16.sql','synthetic');
  create table engine.classes(class_id uuid primary key default gen_random_uuid(),class_key text,display_name text,active boolean default true);
  create table engine.learners(learner_id uuid primary key default gen_random_uuid(),auth_user_id uuid unique references auth.users,student_code text,active boolean default true,revoked_before timestamptz,class_id uuid references engine.classes,is_test boolean not null default false);
  create table engine.staff(staff_id uuid primary key default gen_random_uuid(),auth_user_id uuid unique references auth.users,role text,active boolean default true,revoked_before timestamptz);
  create table engine.staff_classes(staff_id uuid references engine.staff,class_id uuid references engine.classes,primary key(staff_id,class_id));`);
 for(const file of MEDIA)await db.exec(migration(file));
 await db.exec(`insert into engine.schema_migrations(version,name,checksum) values('20261002200000','baseline_c16.sql','synthetic'),('20261003030000','predecessor_c16.sql','synthetic');`);
 for(const file of CLASSROOM)await db.exec(migration(file));
 const sql=createPostgresJsonDriver(db);

 // ── 사람과 반 ──
 const identities=new Map();
 async function person(){const identity={id:randomUUID(),sessionId:randomUUID(),issuedAt:Math.floor(Date.now()/1000)-60,product:'world',providers:['synthetic']};
  await sql`insert into auth.users values(${identity.id}::uuid)`;let account;
  await createPgStore(sql).withAccount(identity,'world',async tx=>{account=tx.account.synk_user_id;});
  identities.set(identity.id,identity);return {identity,account,token:tokenFor(identity)};}
 const [cls]=await sql`insert into engine.classes(class_key,display_name) values('TOPIK4-ONLINE-REHEARSAL','TOPIK 4급 온라인 리허설반 (시험)') returning class_id`;
 const teacher=await person(),student=await person();
 const [staff]=await sql`insert into engine.staff(auth_user_id,role) values(${teacher.identity.id}::uuid,'teacher') returning staff_id`;
 await sql`insert into engine.staff_classes values(${staff.staff_id}::uuid,${cls.class_id}::uuid)`;
 // 명부 줄은 계정 없이 만든다. 학생은 교사가 낸 연결 코드로 WORLD에서 이 줄에 잇는다(운영과 같은 길).
 const [learner]=await sql`insert into engine.learners(student_code,class_id,is_test) values('시험 학생 하늘 (시험)',${cls.class_id}::uuid,true) returning learner_id`;
 // 수업 영상: 반 영상 설정과 이용권(「내 반 연결」로는 생기지 않는다 — 운영에서는 관리자가 따로 넣는다).
 async function openLessons({privacy='unlisted'}={}){
  await sql`insert into engine.classroom_channels(class_id,youtube_channel_id,youtube_playlist_id,video_privacy,enabled) values(${cls.class_id}::uuid,${CHANNEL},${PLAYLIST},${privacy},true)`;
  await sql`insert into engine.classroom_access(learner_id,class_id,starts_at,ends_at,granted_by) values(${learner.learner_id}::uuid,${cls.class_id}::uuid,clock_timestamp()-interval '1 day',clock_timestamp()+interval '120 days','리허설 (시험)')`;
 }

 // ── 함수 ──
 const verify=async request=>{const identity=identities.get(subjectOf(request.headers.get('authorization')));if(!identity)throw Object.assign(Error('AUTH_REQUIRED'),{status:401,code:'AUTH_REQUIRED'});return identity;};
 const store=createClassroomStore(sql,model);store.homework=createClassroomHomework({sql,now});store.enrollment=createClassroomEnrollment({sql,now});
 const classroomService=createClassroomService({store,model,verify,enabled:()=>true});
 const accountService=createService({store:createPgStore(sql),verify,learningAllowed:()=>true,validateEvents:(previous,fresh,scope)=>Atlas.createSession({events:[...previous,...fresh],scope})});
 const lessonModules={'npm:postgres@3.4.9':()=>fragmentDriver(db),'./수업영상.mjs':media,'./토큰.mjs':토큰,'./계약판.mjs':계약판,'./CORS.mjs':CORS};
 // Babel은 플러그인 이름을 지금 폴더에서 찾으므로 talk 폴더에서 세운다.
 const here=process.cwd();process.chdir(talkRoot);let lessonList,lessonSync;
 try{lessonList=세우기(lessonSource.classroom,{파일:'classroom.ts',모듈:lessonModules,환경:{}});
  lessonSync=세우기(lessonSource.sync,{파일:'classroom-sync.ts',모듈:lessonModules,환경:{CLASSROOM_SYNC_KEYS:JSON.stringify({[cls.class_id]:SYNC_KEY})}});}
 finally{process.chdir(here);}
 const calls=[];
 async function handle(request){
  const u=new URL(request.url),p=u.pathname;calls.push({method:request.method,path:p});
  if(p.startsWith('/functions/v1/synk-classroom/'))return classroomService(request);
  if(p==='/functions/v1/synk-account'||p==='/functions/v1/synk-learning')return accountService(request,p.endsWith('synk-account')?'account':'learning');
  if(p==='/functions/v1/classroom')return lessonList(request);
  if(p==='/functions/v1/classroom-sync')return lessonSync(request);
  return null;
 }
 return {db,sql,handle,calls,cls,teacher,student,learner,staff,openLessons,close:async()=>{await db.close();fs.rmSync(lessonDir,{recursive:true,force:true});}};
}

// 교사 화면은 회사 워크스페이스와 같은 정적 목록·CSP로 내보낸다(homework-review-browser.test.mjs와 같은 읽기).
const COMPANY='docs/마케팅/온라인마케팅지도/engagement/company/';
export const CSP="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https: data: blob:; media-src 'self' https: blob:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'";
export function companyTeacherFiles(appRoot){
 const source=fs.readFileSync(path.join(appRoot,COMPANY+'server.mjs'),'utf8'),files=new Map(),names=list=>[...list.matchAll(/'([^']+)'/g)].map(m=>m[1]);
 const type=file=>({'.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.html':'text/html; charset=utf-8','.woff2':'font/woff2','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'application/octet-stream';
 for(const m of source.matchAll(/for\(const file of \[([^\]]*)\]\)files\['\/teacher-world\/'\+file\]=\['\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/experiences\/([a-z-]+)\/'\+file/g))for(const file of names(m[1]))files.set('/teacher-world/'+file,{file:path.join(appRoot,'experiences',m[2],file),type:type(file)});
 for(const m of source.matchAll(/files\['(\/teacher-world\/[^']+)'\]=\['\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/(experiences\/[^']+)'/g))files.set(m[1],{file:path.join(appRoot,m[2]),type:type(m[2])});
 for(const file of names(/const teacherAssets=\[([^\]]*)\]/.exec(source)[1]))files.set('/teacher-world/assets/'+file,{file:path.join(appRoot,'experiences/teacher-world/assets',file),type:type(file)});
 for(const file of names(/for\(const file of \[([^\]]*)\]\)files\['\/assets\/'\+file\]/.exec(source)[1]))files.set('/assets/'+file,{file:path.join(appRoot,'experiences/teacher-world/assets',file),type:type(file)});
 files.set('/teacher-world/',{file:path.join(appRoot,'experiences/teacher-world/index.html'),type:type('index.html')});
 return files;
}

// 한 포트에서 함수(/functions/v1/*)와 교사 화면(/qa/teacher.html → iframe /teacher-world/?account=1)을 함께 낸다.
export async function listen({backend,appRoot}){
 const files=companyTeacherFiles(appRoot);
 const hostHtml=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" href="data:,"><title>내 수업 리허설</title><link rel="stylesheet" href="/qa/host.css"></head><body><iframe id="frame" title="TOPIK 4급 온라인 리허설반 · 학생별 기록과 과제"></iframe><script type="module" src="/qa/host.mjs"></script></body></html>`;
 // 계정 포털 teacher-workspace.mjs의 host와 같은 모양: 이 반의 수업 통로 request만 넘긴다(토큰은 부모 쪽).
 const hostMjs=`import {createClassroomTransport,createClassroomClient} from '/synk-account/src/classroom-client.mjs';
const classId=new URL(location.href).searchParams.get('class');
const transport=createClassroomTransport({url:location.origin,anonKey:'synthetic-public',getAccessToken:async()=>${JSON.stringify(backend.teacher.token)},guard(){},product:'world'});
const client=createClassroomClient({transport,classId,guard(){}});
window.qaRequests=[];
window.SYNKClassroomHost=Object.freeze({mode:'account-linked',classId,focusWorkspace(){},request:(path,body)=>{window.qaRequests.push({path,post:body!==undefined});return client.request(path,body);}});
window.SYNKClassroomSelection={classId,learnerId:null};
document.getElementById('frame').src='/teacher-world/?account=1';`;
 const server=http.createServer(async(req,res)=>{try{
  const u=new URL(req.url,'http://127.0.0.1');
  if(u.pathname.startsWith('/functions/v1/')){
   if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':req.headers['access-control-request-headers']||'*','Access-Control-Allow-Methods':'GET, POST, PUT'});res.end();return;}
   const chunks=[];for await(const c of req)chunks.push(c);
   const headers=Object.fromEntries(Object.entries(req.headers).filter(([,v])=>typeof v==='string'));
   const r=await backend.handle(new Request('http://127.0.0.1'+req.url,{method:req.method,headers,...(['POST','PUT'].includes(req.method)?{body:Buffer.concat(chunks)}:{})}));
   if(!r){res.writeHead(404,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify({ok:false,error:{code:'NOT_IN_REHEARSAL'}}));return;}
   res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')||'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(Buffer.from(await r.arrayBuffer()));return;
  }
  if(u.pathname==='/qa/teacher.html'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':CSP});res.end(hostHtml);return;}
  if(u.pathname==='/qa/host.css'){res.writeHead(200,{'Content-Type':'text/css'});res.end('html,body{margin:0;background:#fff}iframe{display:block;width:100%;height:100vh;border:0}');return;}
  if(u.pathname==='/qa/host.mjs'){res.writeHead(200,{'Content-Type':'text/javascript'});res.end(hostMjs);return;}
  if(/^\/synk-account\/src\/[a-z-]+\.mjs$/.test(u.pathname)){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(fs.readFileSync(path.join(appRoot,'experiences',u.pathname)));return;}
  const entry=files.get(u.pathname);
  if(entry&&fs.existsSync(entry.file)){res.writeHead(200,{'Content-Type':entry.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'SAMEORIGIN','Content-Security-Policy':CSP});res.end(fs.readFileSync(entry.file));return;}
  res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('not served by the company workspace: '+u.pathname);
 }catch(e){res.writeHead(500);res.end(String(e.stack||e));}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {server,origin:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise(r=>server.close(r))};
}
