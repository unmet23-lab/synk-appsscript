#!/usr/bin/env node
// 실행: node tools/drama-pilot.mjs [--port 8794]. 운영 계정/DB를 건드리지 않는 이PC 시범 서버.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {AUDIO_LIMIT,PilotError,decodeAudio,existingTranscriptionAvailable,transcribeWithExistingCredits} from './lib/drama-pilot-audio.mjs';
import {ProcessBudget,publicLesson,observeTranscript,newAttemptState,resetAttempts,beginTake} from './lib/drama-pilot-service.mjs';

export const VERSION='drama-pilot-1';
const REPO=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const EXTENSIONS=new Map([['.html','text/html; charset=utf-8'],['.mjs','text/javascript; charset=utf-8'],['.css','text/css; charset=utf-8'],
  ['.mp3','audio/mpeg'],['.mp4','video/mp4'],['.webm','video/webm'],['.wav','audio/wav'],['.webp','image/webp'],['.png','image/png'],['.jpg','image/jpeg'],['.woff2','font/woff2']]);
const token=()=>randomBytes(24).toString('base64url');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&/^[A-Za-z0-9_-]{32}$/.test(a)&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));

function reply(res,status,value) {
  const body=Buffer.from(JSON.stringify(value));
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':body.length});res.end(body);
}
async function bodyOf(req,max) {
  if(Number(req.headers['content-length'])>max)throw new PilotError('request_size',413);
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>max)throw new PilotError('request_size',413);chunks.push(chunk);}
  return Buffer.concat(chunks);
}
function cookie(req) {
  const part=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('pilot='));
  return part?.slice(6);
}
function defaultLedger(repo) {
  const dir=path.join(repo,'.tmp','drama-pilot-runtime');fs.mkdirSync(dir,{recursive:true});
  const filename=path.join(dir,`${new Date().toISOString().replace(/[:.]/g,'-')}-${process.pid}.jsonl`);
  // 자체 관찰 집계만 쓴다. 외부 응답/음성/받아쓴 글/쿠키/키는 저장하지 않는다.
  return event=>fs.appendFileSync(filename,`${JSON.stringify({at:new Date().toISOString(),...event})}\n`,{mode:0o600});
}

export function createPilotServer({lesson,root=path.join(REPO,'experiences','drama','pilot'),port=8794,
  analysis=existingTranscriptionAvailable(),decode=decodeAudio,transcribe=transcribeWithExistingCredits,
  budget=new ProcessBudget(),ledger=()=>{},sessionTtlMs=45*60_000}={}) {
  if(!lesson?.scene?.some(x=>x.type==='student')||!lesson.transfer?.spec)throw new PilotError('lesson_missing',500);
  const origin=`http://127.0.0.1:${port}`,sessions=new Map();let busy=false;
  const studentLines=new Map(lesson.scene.filter(x=>x.type==='student').map(x=>[x.id,x]));
  studentLines.set(lesson.transfer.id,lesson.transfer);
  const staticPaths=new Map([['/','index.html'],['/index.html','index.html'],['/pilot.css','pilot.css'],['/pilot.mjs','pilot.mjs']]);

  const server=http.createServer(async(req,res)=>{
    res.setHeader('cache-control','no-store');res.setHeader('x-content-type-options','nosniff');
    res.setHeader('referrer-policy','no-referrer');res.setHeader('x-frame-options','DENY');
    res.setHeader('permissions-policy','microphone=(self), camera=(), geolocation=()');
    res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    try {
      if(req.headers.host!==`127.0.0.1:${port}`)throw new PilotError('host_denied',403);
      if(req.headers.origin&&req.headers.origin!==origin)throw new PilotError('origin_denied',403);
      if(req.headers['sec-fetch-site']==='cross-site')throw new PilotError('origin_denied',403);
      const url=new URL(req.url,origin);
      if(url.search)throw new PilotError('route_missing',404);
      const route=url.pathname;
      if(req.method==='GET'&&route==='/health')return reply(res,200,{ok:true,version:VERSION,loopback:true});
      if(!route.startsWith('/api/')) {
        if(!['GET','HEAD'].includes(req.method))throw new PilotError('method_denied',405);
        let relative=staticPaths.get(route);
        if(!relative&&/^\/media\/[A-Za-z0-9_.-]+$/.test(route))relative=route.slice(1);
        if(!relative&&/^\/[A-Za-z0-9_-]+\.mjs$/.test(route)&&!['/content.mjs'].includes(route)){
          // 번역/문구를 별도 모듈로 나눴을 때만 제공한다. 서버용 콘텐츠 모듈은 항상 제외한다.
          if(['strings.mjs','copy.mjs'].includes(route.slice(1)))relative=route.slice(1);
        }
        if(!relative)throw new PilotError('route_missing',404);
        const filename=path.join(root,relative),extension=path.extname(filename);
        if(!EXTENSIONS.has(extension)||!fs.existsSync(filename))throw new PilotError('route_missing',404);
        const resolved=fs.realpathSync(filename),base=fs.realpathSync(root);
        if(!resolved.startsWith(base+path.sep)||!fs.statSync(resolved).isFile())throw new PilotError('route_missing',404);
        const size=fs.statSync(resolved).size,range=req.headers.range;
        let start=0,end=size-1,status=200;
        if(range){
          const m=/^bytes=(\d+)-(\d*)$/.exec(range);
          if(!m)throw new PilotError('invalid_range',416);
          start=Number(m[1]);end=m[2]?Math.min(size-1,Number(m[2])):size-1;
          if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size)throw new PilotError('invalid_range',416);
          status=206;res.setHeader('content-range',`bytes ${start}-${end}/${size}`);
        }
        res.writeHead(status,{'content-type':EXTENSIONS.get(extension),'content-length':Math.max(0,end-start+1),'accept-ranges':'bytes'});
        if(req.method==='HEAD')return res.end();
        const stream=fs.createReadStream(resolved,{start,end});
        res.on('close',()=>stream.destroy());stream.on('error',()=>res.destroy());stream.pipe(res);return;
      }

      const now=Date.now();for(const [id,s] of sessions)if(now-s.at>sessionTtlMs)sessions.delete(id);
      let sessionId=cookie(req),session=sessions.get(sessionId);
      if(req.method==='GET'&&route==='/api/bootstrap') {
        if(!session){
          if(sessions.size>=16)throw new PilotError('session_limit',429);
          sessionId=token();session={...newAttemptState(),csrf:token(),at:now};sessions.set(sessionId,session);
        }
        session.at=now;
        res.setHeader('set-cookie',`pilot=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.ceil(sessionTtlMs/1000)}`);
        return reply(res,200,{version:VERSION,csrfToken:session.csrf,lesson:publicLesson(lesson),
          capabilities:{analysis:Boolean(analysis),microphone:true},limits:{maxSeconds:AUDIO_LIMIT.seconds},
          privacy:{audioStored:false},firstExposure:!session.transferSubmitted&&!session.transferRevealed});
      }
      if(!session)throw new PilotError('session_expired',401);
      session.at=now;
      res.setHeader('set-cookie',`pilot=${sessionId}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.ceil(sessionTtlMs/1000)}`);
      if(req.method==='GET'&&route==='/api/usage')return reply(res,200,budget.snapshot());
      if(req.method!=='POST')throw new PilotError('method_denied',405);
      if(!equal(req.headers['x-pilot-csrf'],session.csrf))throw new PilotError('csrf_denied',403);
      if(route==='/api/reset') {
        await bodyOf(req,2048);return reply(res,200,resetAttempts(session));
      }
      if(route==='/api/reveal') {
        if(!(req.headers['content-type']||'').startsWith('application/json'))throw new PilotError('invalid_content_type',415);
        let body;try{body=JSON.parse((await bodyOf(req,2048)).toString('utf8'));}catch{throw new PilotError('invalid_json');}
        if(body.lineId!==lesson.transfer.id)throw new PilotError('invalid_line');
        session.transferRevealed=true;
        return reply(res,200,{text:lesson.transfer.text,modelAudio:lesson.transfer.modelAudio,hinted:true});
      }
      if(route!=='/api/take')throw new PilotError('route_missing',404);
      if(!analysis)throw new PilotError('analysis_unavailable',503);
      if(busy)throw new PilotError('analysis_busy',429);
      busy=true;
      try {
        const type=req.headers['content-type']||'';
        if(!type.startsWith('multipart/form-data;'))throw new PilotError('invalid_content_type',415);
        const bytes=await bodyOf(req,AUDIO_LIMIT.bytes+8192);
        let form;try{form=await new Response(bytes,{headers:{'content-type':type}}).formData();}catch{throw new PilotError('invalid_form');}
        const lineId=form.get('lineId'),phase=form.get('phase'),requestId=form.get('requestId');
        if(form.get('consent')!=='yes')throw new PilotError('consent_required',403);
        if(!studentLines.has(lineId)||!['scene','retake','transfer'].includes(phase)||
          ((phase==='transfer')!==(lineId===lesson.transfer.id)))throw new PilotError('invalid_line');
        if(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))throw new PilotError('invalid_request_id');
        // 완료된 같은 업로드의 재전송은 다시 과금하지 않는다. 녹음은 보관하지 않는다.
        if(session.requests.has(requestId)){
          const previous=session.requests.get(requestId);
          if(previous.lineId!==lineId||previous.phase!==phase)throw new PilotError('request_reused',409);
          return reply(res,200,previous.output);
        }
        // reset은 글이 든 응답을 지우지만, 과금된 요청의 UUID 표식은 남겨 늦은 재전송을 차단한다.
        if(session.usedRequests.has(requestId))throw new PilotError('stale_take',409);
        if(session.usedRequests.size>=30)throw new PilotError('take_limit',429);
        const audio=form.get('audio');
        if(!audio||typeof audio.arrayBuffer!=='function'||!/^audio\/(webm|mp4|mpeg|wav|x-wav|ogg)(;|$)/.test(audio.type))throw new PilotError('invalid_audio');
        const epochBeforeDecode=session.epoch;
        const decoded=await decode(Buffer.from(await audio.arrayBuffer()));
        if(session.epoch!==epochBeforeDecode)throw new PilotError('stale_take',409);
        if(decoded.silent)return reply(res,200,{status:'no_speech',transcript:'',observation:{kind:'pending',note:null,sure:false},
          usage:{audioSeconds:decoded.seconds,estimatedUSD:0,invoiceVerified:false},take:{attempt:0,hinted:phase==='transfer'?session.transferRevealed:true,independentEligible:false}});
        budget.ensure(decoded.seconds);
        const take=beginTake(session,{lineId,phase,requestId,transferId:lesson.transfer.id});
        const usage=budget.reserve(decoded.seconds);
        let result;
        try {
          const raw=await transcribe(decoded.wav);
          const line=studentLines.get(lineId),spec={...line.spec,id:lineId,line:line.text};
          result=observeTranscript(spec,raw,decoded);
          ledger({event:'transcription',outcome:result.status,audioSeconds:usage.audioSeconds,estimatedUSD:usage.estimatedUSD,invoiceVerified:false});
        }catch(error){
          budget.failure();ledger({event:'transcription',outcome:'upstream_unavailable',audioSeconds:usage.audioSeconds,estimatedUSD:usage.estimatedUSD,invoiceVerified:false});
          result={status:'unavailable',transcript:'',observation:{kind:'pending',note:null,sure:false}};
        }
        if(session.epoch!==take.epoch)throw new PilotError('stale_take',409);
        const observed=result.status==='ok'&&result.observation.kind!=='pending';
        if(phase==='transfer'&&observed)session.transferSubmitted=true;
        const output={...result,usage,take:{attempt:take.attempt,hinted:take.hinted,
          firstUnhintedAttempt:take.independentEligible,
          independentEligible:take.independentEligible&&!session.transferRevealed&&observed}};
        session.requests.set(requestId,{lineId,phase,output});return reply(res,200,output);
      }finally{busy=false;}
    }catch(error){
      if(!res.headersSent&&!res.destroyed)reply(res,error instanceof PilotError?error.status:500,{error:{code:error instanceof PilotError?error.code:'internal_error'}});
      else if(!res.destroyed)res.destroy();
    }
  });
  server.requestTimeout=15_000;server.headersTimeout=10_000;server.keepAliveTimeout=3000;
  return {server,budget,origin,sessions};
}

export async function main(args=process.argv.slice(2)) {
  let port=8794;
  if(args.length){if(args.length!==2||args[0]!=='--port'||!/^\d{4,5}$/.test(args[1]))throw new PilotError('usage: node tools/drama-pilot.mjs [--port 8794]');port=Number(args[1]);}
  if(port<1024||port>65535)throw new PilotError('invalid_port');
  const {PILOT}=await import(pathToFileURL(path.join(REPO,'experiences','drama','pilot','content.mjs')).href);
  const log=defaultLedger(REPO),app=createPilotServer({lesson:PILOT,port,ledger:log});
  await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(port,'127.0.0.1',resolve);});
  log({event:'start',version:VERSION,analysisConfigured:existingTranscriptionAvailable(),limits:app.budget.snapshot()});
  console.log(`드라마 1화 시범판: ${app.origin}/\n음성 원본·받아쓴 글은 디스크에 저장하지 않습니다. 종료: Ctrl+C`);
  return app;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e instanceof PilotError?e.code:'시범판을 시작하지 못했습니다. 콘텐츠/미디어 준비와 포트 사용 여부를 확인하세요.');process.exitCode=1;});
