import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createDemoState, DEMO_TEACHER, demoLearnerActor } from './fixtures.mjs';
import { getWorkspace, getStudentWorkspace, createAssignment, updateAssignment, cancelAssignment, submitAssignment, addObservation, migrateTeacherState, getPersonalization, updatePersonalization, completePersonalization, feedbackPersonalization } from './model.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicFiles = new Set(['index.html', 'student.html', 'style.css', 'app.mjs', 'student.mjs', 'personalization-ui.mjs', 'personalization.css','signal.css','workspace-overview.mjs','workspace-overview.css','sharing-fence.mjs','homework-review.mjs','homework-review.css']);
const publicAssets = new Set(['synk-logo.svg', 'SUIT-Variable.woff2', 'InterTight-700.woff2', 'DMMono-Medium.ttf', 'slab-coral-long.webp', 'slab-cream-long.webp', 'chip-blush-long.webp', 'badge-cream.webp', 'badge-check.webp', 'sticker-book.webp', 'sticker-person.webp', 'thread-shift.webp', 'app-world.png', 'wide-coral.webp', 'wide-lapis.webp', 'wide-butter.webp']);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.ttf':'font/ttf', '.webp':'image/webp', '.png':'image/png' };
const csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
const error = (code, status=400) => Object.assign(new Error(code), {code,status});
async function readBody(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw error('JSON_REQUIRED',415);
  const chunks=[]; let size=0;
  for await (const chunk of req) { size+=chunk.length; if(size>32768) throw error('BODY_TOO_LARGE',413); chunks.push(chunk); }
  try { const value=JSON.parse(Buffer.concat(chunks).toString('utf8')); if(!value||Array.isArray(value)||typeof value!=='object') throw Error(); return value; } catch { throw error('INVALID_JSON'); }
}
export async function createTeacherServer({state=createDemoState(), persistPath=null, now=()=>Date.now()}={}) {
  let current=migrateTeacherState(state), queue=Promise.resolve();
  const csrf=randomBytes(24).toString('hex');
  getWorkspace(current,DEMO_TEACHER,{now:now()});
  const write = operation => {
    const pending=queue.then(async()=>{
      const next=structuredClone(current); const result=operation(next);
      if(persistPath){await fs.mkdir(path.dirname(persistPath),{recursive:true});const temp=persistPath+'.tmp';await fs.writeFile(temp,JSON.stringify(next,null,2));await fs.rename(temp,persistPath);}
      current=next;return result;
    });queue=pending.catch(()=>{});return pending;
  };
  const server=http.createServer(async(req,res)=>{
    const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
    for(const [key,value] of Object.entries({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':csp}))res.setHeader(key,value);
    try{
      const expectedHost=`127.0.0.1:${server.address().port}`;
      if(req.headers.host!==expectedHost)throw error('LOCAL_HOST_REQUIRED',403);
      if(req.headers.origin && req.headers.origin!==`http://${expectedHost}`)throw error('ORIGIN_REJECTED',403);
      if(req.headers['sec-fetch-site']==='cross-site')throw error('ORIGIN_REJECTED',403);
      const url=new URL(req.url,`http://${expectedHost}`);
      if(url.pathname==='/api/health'&&req.method==='GET')return json(200,{ok:true,mode:'demo',service:'synk-world-teacher',productionConnected:false});
      if(url.pathname.startsWith('/api/')){
        if(req.method==='GET'){
          await queue;
          if(url.pathname==='/api/workspace')return json(200,{...getWorkspace(current,DEMO_TEACHER,{now:now()}),_token:csrf});
          if(url.pathname==='/api/student')return json(200,{...getStudentWorkspace(current,demoLearnerActor(url.searchParams.get('learnerId')),{now:now()}),_token:csrf});
          if(url.pathname==='/api/personalization')return json(200,{...getPersonalization(current,DEMO_TEACHER,{now:now()}),_token:csrf});
          if(url.pathname==='/api/student/personalization')return json(200,{...getPersonalization(current,demoLearnerActor(url.searchParams.get('learnerId')),{now:now()}),_token:csrf});
          throw error('NOT_FOUND',404);
        }
        if(req.method!=='POST')throw error('METHOD_NOT_ALLOWED',405);
        const supplied=String(req.headers['x-synk-preview-token']||'');
        if(!/^[a-f0-9]{48}$/.test(supplied)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(csrf)))throw error('PREVIEW_TOKEN_REQUIRED',403);
        const payload=await readBody(req);
        const operations={
          '/api/assignments':s=>createAssignment(s,DEMO_TEACHER,payload,{now:now()}),
          '/api/assignments/update':s=>updateAssignment(s,DEMO_TEACHER,payload,{now:now()}),
          '/api/assignments/cancel':s=>cancelAssignment(s,DEMO_TEACHER,payload,{now:now()}),
          '/api/observations':s=>addObservation(s,DEMO_TEACHER,payload,{now:now()}),
          '/api/submissions':s=>submitAssignment(s,demoLearnerActor(payload.learnerId),payload,{now:now()}),
          '/api/personalization':s=>updatePersonalization(s,DEMO_TEACHER,payload,{now:now()}),
          '/api/personalization/complete':s=>completePersonalization(s,DEMO_TEACHER,payload,{now:now()}),
          '/api/personalization/feedback':s=>feedbackPersonalization(s,DEMO_TEACHER,payload,{now:now()}),
          '/api/student/personalization':s=>updatePersonalization(s,demoLearnerActor(url.searchParams.get('learnerId')),payload,{now:now()}),
          '/api/student/personalization/complete':s=>completePersonalization(s,demoLearnerActor(url.searchParams.get('learnerId')),payload,{now:now()}),
          '/api/student/personalization/feedback':s=>feedbackPersonalization(s,demoLearnerActor(url.searchParams.get('learnerId')),payload,{now:now()}),
        };
        if(!Object.hasOwn(operations,url.pathname))throw error('NOT_FOUND',404);
        return json(200,await write(operations[url.pathname]));
      }
      if(!['GET','HEAD'].includes(req.method))throw error('METHOD_NOT_ALLOWED',405);
      const file=url.pathname==='/'?'index.html':url.pathname==='/student'?'student.html':decodeURIComponent(url.pathname).slice(1);
      if(!publicFiles.has(file)&&!(file.startsWith('assets/')&&publicAssets.has(file.slice(7))))throw error('NOT_FOUND',404);
      const data=await fs.readFile(path.join(root,file));
      res.writeHead(200,{'Content-Type':types[path.extname(file)],'Content-Length':data.length});res.end(req.method==='HEAD'?undefined:data);
    }catch(e){json(Number.isInteger(e.status)?e.status:500,{ok:false,code:e.code||'SERVER_ERROR'});}
  });
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.env.SYNK_TEACHER_MODE&&process.env.SYNK_TEACHER_MODE!=='demo')throw Error('Only the synthetic local MVP is configured. Production authentication is deferred.');
  const persistPath=path.join(root,'.local','demo-state.json');let state;
  try{state=JSON.parse(await fs.readFile(persistPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state=createDemoState();}
  const server=await createTeacherServer({state,persistPath});server.listen(Number(process.env.SYNK_TEACHER_PORT||4290),'127.0.0.1',()=>console.log(`SYNK WORLD 교사 · 예시 데이터: http://127.0.0.1:${server.address().port}/`));
}
