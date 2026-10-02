// Isolated teacher UI -> WORLD -> actual keyboard controls -> teacher result.
// QA reads authored answer keys; it does not inject learning events or advance game time.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{pathToFileURL}=require('node:url');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'synk-blank-targets-')));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const checks=[],results=[],errors=[],windows=[],out=__dirname;
let server;const delay=ms=>new Promise(r=>setTimeout(r,ms));
const js=async(w,code)=>{try{return await(w.webContents?w.webContents.executeJavaScript(code,true):w.executeJavaScript(code,true));}catch(e){throw Error(code.slice(0,160)+' / '+e.message);}};
async function until(fn,label,ms=45000){const end=Date.now()+ms;let last;while(Date.now()<end){try{if(await fn())return;}catch(e){last=e.message;}await delay(100);}throw Error('Timeout '+label+(last?' / '+last:''));}
const check=(name,ok)=>{checks.push({name,ok:!!ok});fs.writeFileSync(path.join(out,'linked-target-progress.json'),JSON.stringify({checks,results},null,2));if(!ok)throw Error(name);};
function windowFor(id){const w=new BrowserWindow({show:false,width:1280,height:1000,webPreferences:{partition:'blank-'+id+'-'+Date.now(),contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});windows.push(w);return w;}
const load=p=>import(pathToFileURL(path.resolve(__dirname,p)).href);
app.whenReady().then(async()=>{try{
 const {createLinkedServer}=await load('../../teacher-world/linked-server.mjs');
 const {ITEMS}=await load('../content.mjs'),{itemMetadata}=await load('../learning.mjs');
 server=await createLinkedServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const api=async(route,token,payload)=>{const r=await fetch(origin+route,{method:payload?'POST':'GET',headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});const body=await r.json();if(!r.ok)throw Error(route+': '+body.code);return body;};
 const token=(await api('/api/teacher/session',null,{key:server.ownerKey})).token;
 const teacher=windowFor('teacher');await teacher.loadURL(origin+'/#teacher-key='+server.ownerKey);await until(()=>js(teacher,"document.documentElement.dataset.ready==='true'"),'teacher ready');
 const link=await api('/api/links',token,{classId:'class-local',name:'빈칸 목표 검증 학생'}),world=windowFor('world');
 await world.loadURL(origin+'/synk-account/local-world.html');await js(world,`document.getElementById('connection-code').value=${JSON.stringify(link.code)};document.getElementById('connection-consent').click();document.getElementById('local-join-button').click()`);
 await until(()=>js(world,"document.documentElement.dataset.localWorld==='connected'"),'WORLD connected');
 check('WORLD menu includes blank slice',await js(world,"[...document.querySelectorAll('#world-games button')].some(b=>b.textContent==='빈칸 베기')"));
 // First assignment is authored through the teacher's visible form, including its preview.
 await js(teacher,"document.getElementById('refresh').click()");await until(()=>js(teacher,`!!document.querySelector('[data-student="${link.learnerId}"]')`),'student roster');
 await js(teacher,`document.querySelector('[data-student="${link.learnerId}"]').click();document.getElementById('assign').click();document.getElementById('content-select').value='blank-reading';document.getElementById('content-select').dispatchEvent(new Event('change'));document.querySelector('[name=instructions]').value='빈칸 목표 문항 확인';`);
 const preview=await js(teacher,"document.getElementById('content-description').textContent");check('teacher preview names target and question count',/난도 1/.test(preview)&&/3문항/.test(preview));
 await js(teacher,"document.querySelector('#assignment-form [type=submit]').click()");await until(()=>server.snapshot().assignments.some(a=>a.contentId==='blank-reading'),'teacher form assignment');
 for(let round=0;round<2;round++){
  const assignment=round===0?server.snapshot().assignments.find(a=>a.contentId==='blank-reading'):(await api('/api/assignments',token,{classId:'class-local',learnerIds:[link.learnerId],contentId:'blank-reading',target:{skillId:'ko.reading.grammar',difficulty:2,responseFormat:'single-choice'},title:'난도 2 조사·문형',reason:'다음 난도 목표의 실출제 확인',dueAt:new Date(Date.now()+86400000).toISOString(),idempotencyKey:'blank-level-2'})).assignment;
  const target=assignment.targets[link.learnerId];check(`round ${round}: target exact authored capacity`,target.requiredAttempts===3&&target.items.every(m=>ITEMS.some(x=>JSON.stringify(itemMetadata(x).itemKey)===JSON.stringify(m.itemKey))));
  await js(world,"document.querySelector('[data-world-action=back]')?.click();document.querySelector('[data-world-action=refresh]').click()");await until(()=>js(world,`!!document.querySelector('[data-kind=assignment][data-id="${assignment.id}"]')`),'WORLD assignment card');
  await js(world,`document.querySelector('[data-kind=assignment][data-id="${assignment.id}"]').click();document.querySelector('[data-world-action=start-game]').click()`);
  await until(()=>server.snapshot().learningRuns.some(r=>r.assignmentId===assignment.id),'new owned target run');
  const activeRun=server.snapshot().learningRuns.find(r=>r.assignmentId===assignment.id);
  await until(()=>js(world,`window.SYNKLearningHost?.status().runId===${JSON.stringify(activeRun.id)}&&document.querySelector('iframe')?.src.includes('/blank-slice/')`),'new game actually launched');
  await until(()=>world.webContents.mainFrame.frames.some(f=>f.url.includes('/blank-slice/')),'blank frame');
  await js(world,"(()=>{const f=document.querySelector('iframe'),u=new URL(f.src);u.searchParams.set('qa','1');f.src=u.href;})()");await until(()=>world.webContents.mainFrame.frames.some(f=>f.url.includes('/blank-slice/')&&f.url.includes('qa=1')),'blank diagnostics');
  const frame=world.webContents.mainFrame.frames.find(f=>f.url.includes('/blank-slice/'));
  await until(()=>js(frame,"!!window.__slice"),'blank ready');
  check(`round ${round}: lobby shows three actual target questions`,await js(frame,"document.getElementById('l-count').textContent==='3'"));
  check(`round ${round}: account record controls do not erase browser records`,await js(frame,"document.getElementById('reset-learning').hidden&&document.getElementById('learning-scope').textContent.includes('WORLD')"));
  world.setSize(390,850);await delay(400);await js(world,"window.scrollTo({top:document.querySelector('iframe').getBoundingClientRect().top+window.scrollY,behavior:'instant'})");await delay(900);
  check(`round ${round}: 390px target lobby fits`,await js(frame,"document.documentElement.scrollWidth<=innerWidth+1"));fs.writeFileSync(path.join(out,`linked-target-${round}-lobby-390.png`),(await world.webContents.capturePage()).toPNG());
  await js(frame,"document.getElementById('btn-start').click()");await until(()=>js(frame,"window.__slice.state().cur"),'target first question',60000);
  const queue=await js(frame,"window.__slice.state().queue");check(`round ${round}: real queue only has target items`,queue.length===3&&queue.every(id=>target.items.some(m=>m.itemKey===itemMetadata(ITEMS.find(x=>x.id===id)).itemKey)));
  check(`round ${round}: target skips unrelated tutorial`,await js(frame,"window.__slice.state().practice===null"));
  const trace=[],end=Date.now()+90000;
  while(!server.snapshot().submissions.some(s=>s.assignmentId===assignment.id)&&Date.now()<end){
   const s=await js(frame,"window.__slice.state()");
   if(s.cur&&!s.cur.done&&s.cur.tosses>0){
    const item=ITEMS.find(x=>x.id===s.cur.id),index=s.cur.options.indexOf(item.answer);
    // A real keyboard event follows the game's public key handler and stage availability.
    await js(frame,`document.dispatchEvent(new KeyboardEvent('keydown',{key:'${index+1}',code:'Digit${index+1}',bubbles:true}));`);
    if((await js(frame,"window.__slice.state().cur?.done"))&&!trace.includes(item.id))trace.push(item.id);
   }else if(await js(frame,"!document.getElementById('explain').hidden"))await js(frame,"document.getElementById('btn-next').click()");
   await delay(140);
  }
  const submission=server.snapshot().submissions.find(s=>s.assignmentId===assignment.id);check(`round ${round}: three actual target responses complete`,submission?.total===3&&submission.correct===3&&trace.length===3);
  check(`round ${round}: wrong level cannot enter result`,submission.results.every(r=>target.itemKeys.includes(r.itemKey)));
  await until(()=>js(frame,"!document.getElementById('results').hidden"),'result screen');check(`round ${round}: target run preserves free-play score`,await js(frame,"window.__slice.progress().plays===0&&window.__slice.progress().best===null"));
  world.setSize(390,850);await delay(300);await js(world,"document.querySelector('iframe').scrollIntoView({block:'start',behavior:'instant'})");await delay(300);
  check(`round ${round}: 390px target layout fits`,await js(frame,"document.documentElement.scrollWidth<=innerWidth+1"));fs.writeFileSync(path.join(out,`linked-target-${round}-390.png`),(await world.webContents.capturePage()).toPNG());
  await js(teacher,"document.getElementById('refresh').click()");await until(()=>js(teacher,`!!document.querySelector('[data-student="${link.learnerId}"]')`),'teacher refresh');await js(teacher,`document.querySelector('[data-student="${link.learnerId}"]').click();document.getElementById('view-student-assignments').click()`);
  await until(()=>js(teacher,"document.getElementById('assignments').textContent.includes('제출 결과')"),'teacher result');const workspace=await api('/api/workspace',token);check(`round ${round}: teacher receives identical goal result`,workspace.assignments.find(a=>a.id===assignment.id).submissions.some(s=>s.total===3&&s.target.skillId===target.skillId&&s.target.difficulty===target.difficulty));
  results.push({round,source:round===0?'teacher-form-and-real-keyboard-controls':'teacher-api-target-and-real-keyboard-controls',target:{skillId:target.skillId,difficulty:target.difficulty,itemKeys:target.itemKeys},trace,total:submission.total,correct:submission.correct});
  world.setSize(1280,1000);
 }
 await teacher.reload();await until(()=>js(teacher,"document.documentElement.dataset.ready==='true'"),'teacher reload');check('both completed results survive reload',server.snapshot().submissions.length===2);
}catch(e){errors.push(e.stack||String(e));}finally{const report={ok:errors.length===0,checks,results,errors,isolated:true,productionConnected:false};fs.writeFileSync(path.join(out,'linked-target-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:checks.length,results:results.length,errors}));for(const w of windows)if(!w.isDestroyed())w.destroy();server?.close();app.exit(report.ok?0:1);}});