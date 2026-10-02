// Local development connection between the real WORLD host and the teacher client.
// It starts with NO learning fixtures. Hosted SSO and production storage remain separate.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import Atlas from '../../atlas/engine.js';
import Trail from '../../atlas/trail.js';
import Sync from '../../atlas/learning-sync.js';
import Game from '../../atlas/game-learning.js';
import Strata from '../../strata/index.js';
import mapData from '../../strata/maps/topik-i.json' with {type:'json'};
import {startRun,stopRun,bindRunEvents,updateRuns,runsFor} from './learning-runs.mjs';
import {townWorkspace,townCommand} from './town-bridge.mjs';
import * as Model from './model.mjs';
import {createServer as staticServer} from '../learning-hub/server.mjs';

const root=fileURLToPath(new URL('.',import.meta.url)),worldRoot=fileURLToPath(new URL('../synk-account/',import.meta.url));
const scope={domain:'LAB',workspace:'learning',subject:'device'};
const learningMap=Strata.createMap(mapData);
const clone=value=>structuredClone(value),hash=value=>createHash('sha256').update(value).digest('hex');
const secret=()=>randomBytes(32).toString('hex');
const fail=(code,status=400,message=code)=>{throw Object.assign(new Error(message),{code,status});};
const clean=(value,max=80)=>typeof value==='string'&&value.trim()&&value.trim().length<=max?value.trim():fail('INVALID_INPUT');
const sameSecret=(a,b)=>typeof a==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const teacherFiles=new Set(['index.html','style.css','app.mjs','personalization-ui.mjs','personalization.css']);
const localWorldFiles=new Set(['local-world.html','world-classroom.css','dist/local-world.js']);
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf'};
export function createLinkedState(){return {schemaVersion:1,mode:'local-linked',synthetic:false,nextId:1,
  teachers:[{id:'teacher-local',name:'선생님'}],classes:[{id:'class-local',name:'WORLD 연결 수업',teacherIds:['teacher-local'],learnerIds:[]}],
  learners:[],assignments:[],submissions:[],observations:[],audit:[],practices:[],sessions:[],links:[],personalization:{version:1,records:{}}};}
async function body(req){
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))fail('JSON_REQUIRED',415);
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>524288)fail('BODY_TOO_LARGE',413);chunks.push(chunk);}
  try{const parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error();return parsed;}catch{fail('INVALID_JSON');}
}
export async function createLinkedServer({state,persistPath=null,ownerKey=secret(),now=()=>Date.now(),sessionMs=12*3600000}={}){
  if(!/^[a-f0-9]{64}$/.test(ownerKey))throw Error('A random local owner key is required');
  if(!state&&persistPath){try{state=JSON.parse(await fs.readFile(persistPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}}
  let current=clone(state||createLinkedState()),queue=Promise.resolve();
  if(current.mode!=='local-linked'||current.synthetic!==false||current.schemaVersion!==1)throw Error('Refusing to mix demo or production data with local linked state');
  const files=staticServer(),attempts=new Map();
  const issue=(s,actor)=>{const token=secret();s.sessions.push({hash:hash(token),...actor,expiresAt:now()+sessionMs});return token;};
  const actorFor=(s,req,role)=>{
    const match=/^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization||'');
    const session=match&&s.sessions.find(row=>row.hash===hash(match[1])&&row.expiresAt>now()&&!row.revoked);
    if(!session)fail('AUTH_REQUIRED',401,'앱 연결을 다시 확인해 주세요.');
    if(role&&session.role!==role)fail('FORBIDDEN',403);
    if(session.role==='learner'&&s.learners.find(l=>l.id===session.id)?.revoked)fail('SESSION_REVOKED',401);
    return {id:session.id,role:session.role,mode:'local-linked',sessionHash:session.hash};
  };
  const learnerFor=(s,actor,active=true)=>{const l=s.learners.find(row=>row.id===actor.id);if(!l||l.revoked||!s.classes.some(c=>c.id===l.classId&&c.learnerIds.includes(l.id)))fail('FORBIDDEN',403);if(active&&!l.sharing.enabled)fail('LEARNING_DISABLED',403);return l;};
  const revision=(l,value)=>{if(value!==l.sharing.revision)fail('REVISION_CONFLICT',409,'연결 상태가 바뀌었어요. 다시 불러와 주세요.');};
  const owned=(s,actor,id)=>{const l=s.learners.find(row=>row.id===id);if(!l||!s.classes.some(c=>c.id===l.classId&&c.learnerIds.includes(id)&&c.teacherIds.includes(actor.id)))fail('FORBIDDEN',403);return l;};
  const visible=s=>{
    const v=clone(s),allowed=new Map();
    for(const l of v.learners){allowed.set(l.id,!l.revoked&&l.sharing.enabled?l.sharing.revision:null);l.evidence=l.evidence.filter(e=>allowed.get(l.id)!==null&&e.sharingRevision===allowed.get(l.id));}
    v.assignments=v.assignments.map(a=>({...a,learnerIds:a.learnerIds.filter(id=>allowed.get(id)!==null&&a.deliveryRevisions?.[id]===allowed.get(id))})).filter(a=>a.learnerIds.length);
    const activeIds=new Set(v.assignments.map(a=>a.id));v.submissions=v.submissions.filter(s=>activeIds.has(s.assignmentId)&&s.sharingRevision===allowed.get(s.learnerId));
    v.observations=v.observations.filter(o=>allowed.get(o.learnerId)!==null&&o.sharingRevision===allowed.get(o.learnerId));return v;
  };
  const workspace=(s,actor)=>{
    const w=Model.getWorkspace(visible(s),actor,{now:now()});
    for(const c of w.classes)for(const l of c.learners){const source=s.learners.find(row=>row.id===l.id);Object.assign(l,{sharing:clone(source.sharing),connectedAt:source.connectedAt||null,lastEventAt:source.lastEventAt||null,revoked:!!source.revoked});}
    for(const a of w.assignments)a.runs=a.learnerIds.flatMap(id=>{const l=s.learners.find(l=>l.id===id);return runsFor(s,l).runs.filter(r=>r.assignmentId===a.id&&r.assignmentRevision===a.revision).map(r=>({...r,learnerId:id}));});
    w.integration={...w.integration,worldConnected:true,productionConnected:false,live:false,note:'WORLD에서 수행한 기록과 교사 과제를 연결한 로컬 개발 환경입니다. 정식 SYNK ID 및 운영 학생 자료는 연결하지 않습니다.'};return w;
  };
  const student=(s,actor)=>{
    const l=learnerFor(s,actor,false),w=Model.getStudentWorkspace(visible(s),actor,{now:now()}),profile=workspace(s,{id:'teacher-local',role:'teacher',mode:'local-linked'}).classes.flatMap(c=>c.learners).find(x=>x.id===l.id);
    const recommendations=l.sharing.enabled?profile?.recommendations||[]:[],runs=l.sharing.enabled?runsFor(s,l):{activeRun:null,runs:[]};
    const evidence=profile?.skills.filter(k=>k.n>0)||[],summary=!l.sharing.enabled?'공유를 켜면 기록에 맞는 안내를 받을 수 있어요.':evidence.length?'실제로 답한 문항을 바탕으로 다음 연습을 골랐어요. 도움받은 답과 처음 혼자 푼 답은 구분해요.':'아직 실력을 판단할 답이 부족해요. 짧은 확인부터 시작해요.';
    return {...w,sharing:clone(l.sharing),recommendations,gameTargets:l.sharing.enabled?profile?.gameTargets||{}:{},content:Model.contentCatalog(s),activeRun:runs.activeRun,runs:runs.runs,coaching:{kind:'evidence-guidance',summary,next:recommendations,basedOn:[...new Set(recommendations.flatMap(r=>r.evidence||[]))],note:'Atlas 학습 기록 기반 안내입니다. 자유 대화나 미연결 AI 평가를 만들어내지 않아요.'},assignments:w.assignments.map(a=>({...a,run:runs.runs.filter(r=>r.assignmentId===a.id&&r.assignmentRevision===a.revision).at(-1)||null}))};
  };
  const publishReading=(l,result)=>{
    if(result.duplicate)return;
    const submission=result.submission,rows=l.evidence.filter(e=>e.submissionId===submission.id),values=new Map(),storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
    const coach=Game.createGame({gameId:'world-reading',map:learningMap,storage,clock:()=>new Date(now()).toISOString()});
    coach.syncPort.importEvents(l.events.filter(e=>e.revision===l.sharing.revision).map(e=>e.payload));const known=new Set(coach.events().map(e=>e.id));
    for(const e of rows){const pid=coach.present({id:e.taskId,itemKey:e.familyKey,familyKey:e.familyKey,skillId:e.skillId,difficulty:e.difficulty,modality:'reading',responseFormat:e.responseFormat,audioRequired:false});coach.answer(pid,{correct:e.verdict==='correct',assessable:true});}
    for(const e of coach.events())if(!known.has(e.id))l.events.push({revision:l.sharing.revision,payload:e,runId:null,serverScored:true});
  };
  const stamp=(s,l,before)=>{for(const e of l.evidence)if(!before.has(e.id)){e.sharingRevision=l.sharing.revision;e.grading='server-scored';}l.lastEventAt=new Date(now()).toISOString();};
  const write=operation=>{const pending=queue.then(async()=>{const next=clone(current),result=operation(next);if(persistPath){await fs.mkdir(path.dirname(persistPath),{recursive:true});const temp=persistPath+'.tmp';await fs.writeFile(temp,JSON.stringify(next),{mode:0o600});await fs.rename(temp,persistPath);}current=next;return result;});queue=pending.catch(()=>{});return pending;};
  const throttle=key=>{const window=attempts.get(key)||{at:now(),n:0};if(now()-window.at>60000){window.at=now();window.n=0;}window.n++;attempts.set(key,window);if(window.n>30)fail('RATE_LIMITED',429);};
  const server=http.createServer(async(req,res)=>{
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    try{
      const host=`127.0.0.1:${server.address().port}`;
      if(req.headers.host!==host)fail('LOCAL_HOST_REQUIRED',403);
      if(req.headers.origin&&req.headers.origin!==`http://${host}`||req.headers['sec-fetch-site']==='cross-site')fail('ORIGIN_REJECTED',403);
      const url=new URL(req.url,`http://${host}`),route=url.pathname;
      if(route==='/api/health'&&req.method==='GET')return json(200,{ok:true,mode:'local-linked',worldConnected:true,productionConnected:false});
      if(route.startsWith('/api/')){
        if(!['GET','POST'].includes(req.method))fail('METHOD_NOT_ALLOWED',405);
        if(req.method==='GET'){
          await queue;const actor=actorFor(current,req);
          if(route==='/api/workspace'){if(actor.role!=='teacher')fail('FORBIDDEN',403);return json(200,workspace(current,actor));}
          if(actor.role!=='learner')fail('FORBIDDEN',403);
          const l=learnerFor(current,actor,false);
          if(route==='/api/world/account')return json(200,{account:{synk_user_id:l.accountId,status:'active',profile:{display_name:l.name},providers:['local-development']},memberships:[{role:'student',kind:'learner',active:true}],learning:clone(l.sharing),sharing:clone(l.sharing),capabilities:{learningSync:true},entitlements:[],sessions:[],localLinked:true});
          if(route==='/api/student')return json(200,student(current,actor));
          if(route==='/api/world/town')return json(200,townWorkspace(current,actor));
          if(route==='/api/world/practice')return json(200,{content:Model.readingContent(),sharing:clone(l.sharing)});
          if(route==='/api/world/learning'){
            learnerFor(current,actor);revision(l,Number(url.searchParams.get('revision')));const after=Number(url.searchParams.get('after')||0),events=l.events.filter(e=>e.revision===l.sharing.revision);
            if(!Number.isSafeInteger(after)||after<0||after>events.length)fail('INVALID_CURSOR');
            const page=events.slice(after,after+100);return json(200,{ok:true,revision:l.sharing.revision,events:page.map(e=>e.payload),cursor:after+page.length,hasMore:after+page.length<events.length});
          }
          fail('NOT_FOUND',404);
        }
        const payload=await body(req);
        return json(200,await write(s=>{
          if(route==='/api/teacher/session'){throttle('teacher');if(!sameSecret(payload.key,ownerKey))fail('AUTH_REQUIRED',401);return {token:issue(s,{id:'teacher-local',role:'teacher'})};}
          if(route==='/api/join'){
            throttle('join');if(payload.consent!==true)fail('CONSENT_REQUIRED');const code=clean(payload.code,20).toUpperCase(),link=s.links.find(row=>row.hash===hash(code)&&!row.used&&row.expiresAt>now());
            if(!link)fail('LINK_EXPIRED',410,'연결 코드가 만료되었거나 이미 사용됐어요.');
            const l=s.learners.find(row=>row.id===link.learnerId);if(!l||l.revoked)fail('LINK_EXPIRED',410);
            link.used=true;l.connectedAt=new Date(now()).toISOString();l.sharing={enabled:true,revision:l.sharing.revision+1,since:l.connectedAt};
            return {token:issue(s,{id:l.id,role:'learner'}),learner:{id:l.id,name:l.name},sharing:clone(l.sharing)};
          }
          const actor=actorFor(s,req);
          if(route==='/api/logout'){s.sessions.find(x=>x.hash===actor.sessionHash).revoked=true;return {ok:true};}
          if(actor.role==='teacher'){
            if(route==='/api/links'){
              const c=s.classes.find(row=>row.id===payload.classId&&row.teacherIds.includes(actor.id));if(!c)fail('FORBIDDEN',403);
              const name=clean(payload.name),id=`learner-${s.nextId++}`,code=randomBytes(6).toString('hex').toUpperCase(),expiresAt=now()+600000;
              s.learners.push({id,name,classId:c.id,accountId:`local-world-${id}`,evidence:[],events:[],sharing:{enabled:false,revision:1,since:null}});c.learnerIds.push(id);
              s.links.push({hash:hash(code),learnerId:id,expiresAt});return {ok:true,code,expiresAt:new Date(expiresAt).toISOString(),learnerId:id,worldPath:'/synk-account/local-world.html'};
            }
            if(route==='/api/links/revoke'){
              const l=owned(s,actor,payload.learnerId);revision(l,payload.revision);l.revoked=true;l.sharing={enabled:false,revision:l.sharing.revision+1,since:null};s.sessions.filter(x=>x.id===l.id).forEach(x=>x.revoked=true);s.links.filter(x=>x.learnerId===l.id).forEach(x=>x.used=true);return {ok:true};
            }
            if(route==='/api/assignments'){
              if(!Array.isArray(payload.learnerIds))fail('INVALID_RECIPIENTS');for(const id of payload.learnerIds){const l=owned(s,actor,id);if(l.revoked||!l.connectedAt||!l.sharing.enabled)fail('LEARNING_DISABLED',409);}
              const allEvidence=s.learners.map(l=>l.evidence),filtered=visible(s);let result;
              try{s.learners.forEach((l,i)=>l.evidence=filtered.learners[i].evidence);result=Model.createAssignment(s,actor,payload,{now:now()});}finally{s.learners.forEach((l,i)=>l.evidence=allEvidence[i]);}
              const a=s.assignments.find(x=>x.id===result.assignment.id);
              if(a.deliveryRevisions&&a.learnerIds.some(id=>a.deliveryRevisions[id]!==s.learners.find(l=>l.id===id).sharing.revision))fail('REVISION_CONFLICT',409);
              a.deliveryRevisions??=Object.fromEntries(a.learnerIds.map(id=>[id,s.learners.find(l=>l.id===id).sharing.revision]));return result;
            }
            if(['/api/assignments/update','/api/assignments/cancel'].includes(route)){
              const a=s.assignments.find(row=>row.id===payload.assignmentId);if(!a||!s.classes.some(c=>c.id===a.classId&&c.teacherIds.includes(actor.id)))fail('FORBIDDEN',403);
              if(payload.revision!==a.revision)fail('REVISION_CONFLICT',409);
              return (route.endsWith('cancel')?Model.cancelAssignment:Model.updateAssignment)(s,actor,payload,{now:now()});
            }
            if(route==='/api/observations'){
              const l=owned(s,actor,payload.learnerId);if(!l.sharing.enabled||l.revoked)fail('LEARNING_DISABLED',403);
              const prior=s.observations.find(o=>o.teacherId===actor.id&&o.idempotencyKey===payload.idempotencyKey);
              if(prior&&prior.sharingRevision!==l.sharing.revision)fail('REVISION_CONFLICT',409);
              const r=Model.addObservation(s,actor,payload,{now:now()});if(!r.duplicate)s.observations.find(o=>o.id===r.observation.id).sharingRevision=l.sharing.revision;return r;
            }
            fail('FORBIDDEN',403);
          }
          const l=learnerFor(s,actor,false);
          if(payload.learnerId!=null&&payload.learnerId!==l.id)fail('FORBIDDEN',403);
          if(route==='/api/world/sharing'){
            revision(l,payload.revision);if(typeof payload.enabled!=='boolean')fail('INVALID_INPUT');
            if(payload.enabled!==l.sharing.enabled)l.sharing={enabled:payload.enabled,revision:l.sharing.revision+1,since:payload.enabled?new Date(now()).toISOString():null};
            return {ok:true,...clone(l.sharing)};
          }
          learnerFor(s,actor);
          if(route==='/api/world/town/command')return townCommand(s,actor,payload);
          if(route==='/api/world/runs/start')return startRun(s,l,payload,now());
          if(route==='/api/world/runs/stop')return stopRun(s,l,payload.runId);
          if(route==='/api/submissions'){
            const a=s.assignments.find(row=>row.id===payload.assignmentId);if(!a||a.deliveryRevisions?.[l.id]!==l.sharing.revision)fail('FORBIDDEN',403);
            const before=new Set(l.evidence.map(e=>e.id)),r=Model.submitAssignment(s,actor,payload,{now:now()});stamp(s,l,before);s.submissions.find(x=>x.id===r.submission.id).sharingRevision=l.sharing.revision;publishReading(l,r);return r;
          }
          if(route==='/api/world/practice'){
            revision(l,payload.revision);const prior=s.practices.find(p=>p.learnerId===l.id&&p.idempotencyKey===payload.idempotencyKey);if(prior&&prior.sharingRevision!==l.sharing.revision)fail('REVISION_CONFLICT',409);
            const before=new Set(l.evidence.map(e=>e.id)),r=Model.submitPractice(s,actor,payload,{now:now()});stamp(s,l,before);s.practices.find(p=>p.id===r.submission.id).sharingRevision=l.sharing.revision;publishReading(l,r);return r;
          }
          if(route==='/api/world/learning'){
            revision(l,payload.revision);if(!Array.isArray(payload.events)||!payload.events.length||payload.events.length>500)fail('INVALID_EVENTS');
            const rows=l.events.filter(e=>e.revision===l.sharing.revision),known=new Map(rows.map(e=>[e.payload.id,e.payload])),incoming=[];
            for(const e of payload.events){
              if(!e||e.scope?.subject!=='device'||e.scope?.domain!=='LAB'||e.scope?.workspace!=='learning'||!Number.isFinite(Date.parse(e.at))||Date.parse(e.at)<Date.parse(l.sharing.since)||Date.parse(e.at)>now()+300000||Date.parse(e.recordedAt)>now()+300000)fail('INVALID_EVENTS');
              if(known.has(e.id)){if(!Sync.sameEvent(known.get(e.id),e))fail('EVENT_CONFLICT',409);}else{if(e.type==='decision.made'&&e.experienceId==='world-reading'||l.events.some(row=>row.serverScored&&[e.decisionId,e.presentationId,e.targetId].includes(row.payload.id)))fail('SERVER_EVIDENCE_REQUIRED',403);known.set(e.id,e);incoming.push(e);}
            }
            if(known.size>20000)fail('HISTORY_CAPACITY',409);
            let summary;try{const session=Atlas.createSession({scope,events:[...known.values()]});summary=Trail.summarize(session.events(),{scope,asOf:new Date(now()).toISOString()});}catch{fail('INVALID_EVENTS');}
            bindRunEvents(s,l,payload.runId??null,payload.events);
            for(const e of incoming)l.events.push({revision:l.sharing.revision,payload:clone(e),runId:payload.runId??null});
            // Rebuild this epoch's derived rows so a late delivery/help event cannot leave a stale inference.
            l.evidence=l.evidence.filter(e=>!(e.grading==='game-reported'&&e.sharingRevision===l.sharing.revision));
            const serverEvents=new Set(l.events.filter(e=>e.serverScored).map(e=>e.payload.id));
            for(const a of summary.attempts){const m=a.measure;if(!m||serverEvents.has(a.eventId))continue;l.evidence.push({id:`world-${a.eventId}`,source:'language-item',skillId:m.skillId,at:a.at,verdict:a.exclusionReason?'unassessed':a.verdict,independent:a.independent,assisted:a.assisted,taskId:a.taskId,itemKey:a.itemKey,familyKey:m.familyKey,difficulty:m.difficulty,responseFormat:m.responseFormat,reason:a.exclusionReason||'WORLD 게임이 보고한 언어 응답 · 서버 독립 채점 아님',grading:'game-reported',sourceEventId:a.eventId,sharingRevision:l.sharing.revision});}
            updateRuns(s,l,summary,now());
            l.lastEventAt=new Date(now()).toISOString();return {ok:true,revision:l.sharing.revision,accepted:[...new Set(payload.events.map(e=>e.id))]};
          }
          fail('NOT_FOUND',404);
        }));
      }
      if(!['GET','HEAD'].includes(req.method))fail('METHOD_NOT_ALLOWED',405);
      // Only the published Town scene assets; never its preview server, state, or sources.
      const townName=route.startsWith('/synk-town/')?decodeURIComponent(route.slice('/synk-town/'.length)):'';
      const townEngines={'engine/loom-motion.js':'../../tools/lib/loom-motion.js','engine/loom-life.js':'../../tools/lib/loom-life.js'};
      if(townName&&(['linked.html','app.mjs','style.css','linked-client.mjs','understanding.mjs','understanding-ui.mjs'].includes(townName)||/^assets\/[a-zA-Z0-9_./-]+$/.test(townName)&&!townName.split('/').includes('..')&&mime[path.extname(townName)]||townEngines[townName])){
        const target=path.resolve(root,'../synk-town',townEngines[townName]||townName),data=await fs.readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)],'Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);return;
      }
      const name=route==='/'?'index.html':decodeURIComponent(route).slice(1);
      if(teacherFiles.has(name)||/^assets\/[a-zA-Z0-9_.-]+$/.test(name)&&mime[path.extname(name)]||route.startsWith('/synk-account/')&&localWorldFiles.has(route.slice('/synk-account/'.length))){
        const target=route.startsWith('/synk-account/')?path.join(worldRoot,route.slice('/synk-account/'.length)):path.join(root,name);
        res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; frame-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'");
        const data=await fs.readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)],'Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);return;
      }
      if(/^\/(synk-account|learning-hub|korean-racing|korean-runner|korean-rhythm|order-rush|entry-check|story-classroom|blank-slice)\//.test(route)){files.emit('request',req,res);return;}
      fail('NOT_FOUND',404);
    }catch(e){json(e.code==='ENOENT'?404:Number.isInteger(e.status)?e.status:500,{ok:false,code:e.code||'SERVER_ERROR',message:Number.isInteger(e.status)?e.message:'요청을 처리하지 못했어요.'});}
  });
  server.ownerKey=ownerKey;server.snapshot=()=>clone(current);return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const persistPath=path.join(root,'.local','linked-state.json'),keyPath=path.join(root,'.local','linked-owner.key');await fs.mkdir(path.dirname(keyPath),{recursive:true});
  let ownerKey;try{ownerKey=(await fs.readFile(keyPath,'utf8')).trim();}catch(e){if(e.code!=='ENOENT')throw e;ownerKey=secret();await fs.writeFile(keyPath,ownerKey,{mode:0o600,flag:'wx'});}
  const server=await createLinkedServer({persistPath,ownerKey});server.listen(Number(process.env.SYNK_LINKED_PORT||4295),'127.0.0.1',()=>console.log(`SYNK WORLD ↔ 교사 로컬 연결: http://127.0.0.1:${server.address().port}/ · 교사 키는 .local/linked-owner.key`));
}
