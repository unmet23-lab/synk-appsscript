// Isolated teacher assignment -> real WORLD/game controls -> exact target result.
// Answer keys are read from authored content; no evidence or game state is injected.
// On Windows run with --show: hidden native windows throttle racing to 1 fps
// even with backgroundThrottling:false. The live report exposes this explicitly.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{pathToFileURL}=require('node:url');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'synk-targeted-games-')));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
// Hidden QA windows must still paint real animation frames. Without these
// browser flags Windows occlusion throttles a visible iframe to one frame/sec.
// This changes browser scheduling only, never the game's clock or answers.
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-features','CalculateNativeWinOcclusion');
const directory=path.join(__dirname,'qa'),checks=[],results=[],errors=[],windows=[];fs.mkdirSync(directory,{recursive:true});
const outputPrefix=process.argv.find(a=>a.startsWith('--report='))?.slice(9)||'targeted-games';if(!/^[a-z0-9-]+$/.test(outputPrefix))throw Error('Invalid report name');
let server;const delay=ms=>new Promise(r=>setTimeout(r,ms)),js=(w,s)=>w.webContents?w.webContents.executeJavaScript(s,true):w.executeJavaScript(s,true);
async function until(fn,label,ms=45000){const end=Date.now()+ms;let last;while(Date.now()<end){try{if(await fn())return;}catch(e){last=e.message;}await delay(100);}throw Error('Timeout '+label+(last?' / '+last:''));}
const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
function createWindow(role){const w=new BrowserWindow({show:process.argv.includes('--show')&&role!=='teacher',width:1280,height:1000,webPreferences:{partition:`target-${role}-${Date.now()}`,contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});w.qaErrors=[];w.webContents.on('console-message',(_e,level,message)=>{if(level>=2)w.qaErrors.push(String(message).replace(/#teacher-key=[^\s]+/g,'#teacher-key=[redacted]'));});windows.push(w);return w;}
const load=relative=>import(pathToFileURL(path.resolve(__dirname,relative)).href);
const filter=process.argv.find(a=>a.startsWith('--games='))?.slice(8).split(',');
async function captureLayout(world,frame,contentId){
 const layouts=[];
 for(const width of [320,390,1280]){
  world.setContentSize(width,850);await delay(350);
  await js(world,"document.querySelector('iframe').scrollIntoView({block:'start',behavior:'instant'})");await delay(700);
  const layout=await js(frame,"(()=>{const d=document.documentElement;return {viewport:innerWidth,clientWidth:d.clientWidth,scrollWidth:d.scrollWidth,overflow:[...document.querySelectorAll('body *')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,id:e.id,className:typeof e.className==='string'?e.className.slice(0,100):'',left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,display:s.display,visibility:s.visibility};}).filter(r=>r.width>0&&r.bottom>0&&r.top<innerHeight&&r.display!=='none'&&r.visibility!=='hidden'&&(r.left < -1||r.right>d.clientWidth+1)).slice(0,30)};})()");
  layouts.push({hostWidth:width,...layout});
  check(`layout-${contentId}-${width}-fits-frame`,layout.scrollWidth===layout.clientWidth&&layout.overflow.length===0);
  fs.writeFileSync(path.join(directory,`target-${contentId}-${width}.png`),(await world.webContents.capturePage()).toPNG());
 }
 fs.writeFileSync(path.join(directory,`${outputPrefix}-${contentId}-layout.json`),JSON.stringify(layouts,null,2));return layouts;
}
const cases=[
 ['entry-reading','entry-check','ko.reading.condition',2,'single-choice'],
 ['order-listening','order-rush','ko.listening.negation',2,'cup-compose'],
 ['story-reading','story-classroom','ko.reading.sequence',2,'action'],
 ['rhythm-listening','korean-rhythm','ko.listening.condition',3,'binary-choice'],
 ['racing-reading','korean-racing','ko.reading.grammar',1,'single-choice'],
 ['racing-listening','korean-racing','ko.listening.detail',1,'single-choice'],
].filter(([,id])=>!filter||filter.includes(id));
async function play(gameId,frame,complete,target,trace,world){
 const wait=(code,ms)=>until(()=>js(frame,code),gameId+': '+code,ms);
 if(gameId==='entry-check'){
  const {VENUES}=await load('../entry-check/content.mjs'),all=VENUES.flatMap(v=>v.cases);
  await wait("!!window.__entry&&!!document.getElementById('rec-start').onclick");
  await js(frame,"document.getElementById('rec-start').click()");
  const end=Date.now()+110000;
  while(!complete()&&Date.now()<end){
   const s=await js(frame,"({state:window.__entry.state(),brief:!document.getElementById('briefing').hidden,memo:!document.getElementById('memo-alert').hidden,result:!document.getElementById('results').hidden,feedback:!document.getElementById('feedback').hidden})");
   if(s.brief){await js(frame,"document.getElementById('btn-begin').click()");await delay(600);}
   else if(s.memo){await js(frame,"document.getElementById('btn-alert').click()");await delay(600);}
   else if(s.result){await js(frame,"document.getElementById('r-next').click()");await delay(180);}
   else if(s.state.cur&&!s.state.cur.done){
    const guest=all.find(c=>c.id===s.state.cur.id);if(!guest)throw Error('Unknown actual guest');
    await wait("!document.getElementById('btn-pass').disabled");await delay(550);
    if(guest.answer==='pass')await js(frame,"document.getElementById('btn-pass').click()");
    else{await js(frame,"document.getElementById('btn-reject').click()");await delay(100);await js(frame,`document.querySelector('[data-rule="${guest.answer}"]').click()`);}
    trace.push({caseId:guest.id,venue:s.state.venue});await delay(600);
   }else if(s.feedback){await js(frame,"document.getElementById('btn-next').click()");await delay(200);}
   else await delay(150);
  }
  check('entry-target-spans-more-than-one-real-venue',new Set(trace.map(t=>t.venue)).size>1);
 }else if(gameId==='order-rush'){
  const {ORDERS,REVIEW}=await load('../order-rush/core.mjs'),orders=[...ORDERS,...REVIEW];
  await wait("!!window.synkCafe");check('order-rush-cannot-switch-to-timed-mode',await js(frame,"document.querySelector('[data-mode=rush]').disabled"));
  await js(frame,"document.getElementById('start').click()");let last=null;
  for(let i=0;i<8&&!complete();i++){
   await until(async()=>{const s=await js(frame,"window.synkCafe.current");return s?.audioCompleted&&s.id!==last;},'actual order narration',60000);
   const cur=await js(frame,"window.synkCafe.current"),order=orders.find(o=>o.id===cur.id);last=cur.id;
   for(let c=0;c<order.cups.length;c++){
    if(c)await js(frame,"document.getElementById('add-cup').click()");
    const cup=order.cups[c],actions=[cup.base,...(cup.milk?['milk']:[]),...(cup.temp==='cold'?['cold']:[]),...(cup.ice?['ice']:[]),...(cup.sugar?['sugar']:[])];
    for(const action of actions)await js(frame,`document.querySelector('[data-ingredient="${action}"]').click()`);
   }
   await js(frame,"document.getElementById('serve').click()");trace.push({orderId:cur.id});await delay(1400);
  }
 }else if(gameId==='story-classroom'){
  const {EPISODE}=await load('../story-classroom/story.mjs');
  await wait("!!window.__storyState");await js(frame,"if(!window.__storyVoice.readingOnly)document.getElementById('reading-mode').click();document.getElementById('start').click()");
  await wait("window.__storyState.started");check('story-target-enters-first-relevant-scene',await js(frame,"window.__storyState.actIndex===1"));
  const end=Date.now()+120000;
  while(!complete()&&Date.now()<end){
   const s=await js(frame,"window.__storyState");if(s.busy){await delay(120);continue;}
   if(['play','review'].includes(s.phase)){
    const pool=s.phase==='review'?EPISODE.review:EPISODE.acts[s.actIndex].missions;
    const mission=pool.find(m=>!s.completedIds.includes(m.id)&&(m.requires||[]).every(id=>s.completedIds.includes(id)));
    if(!mission)throw Error('No reachable story action');
    await js(frame,`document.querySelector('[data-actor="${mission.actor}"]').click();document.querySelector('[data-object="${mission.object}"]').click();document.querySelector('[data-destination="${mission.destination}"]').click()`);
    trace.push({missionId:mission.id,prerequisites:[...(mission.requires||[])]});await delay(200);
   }else if(s.phase==='complete')break;
   else{await js(frame,"document.getElementById('dialogue-next').click()");await delay(120);}
  }
  check('story-prerequisites-were-real-actions',trace.some(t=>t.prerequisites.length)&&trace.every((t,i)=>t.prerequisites.every(id=>trace.slice(0,i).some(p=>p.missionId===id))));
 }else if(gameId==='korean-rhythm'){
  await wait("!!window.synkRhythm");
  check('rhythm-assignment-selects-difficulty-three-track',await js(frame,"window.synkRhythm.snapshot().track===2"));
  check('rhythm-other-track-disabled',await js(frame,"document.querySelector('[data-track=\"0\"]').disabled"));
  await js(frame,"document.querySelector('[data-track=\"0\"]').click()");check('rhythm-other-track-cannot-replace-target',await js(frame,"window.synkRhythm.snapshot().track===2"));
  await js(frame,"document.getElementById('start-button').click()");await wait("window.synkRhythm.snapshot().screen==='game'",90000);
  await js(frame,"window.__targetTaps=[];window.__targetTapTimer=setInterval(()=>{const s=window.synkRhythm.snapshot(),q=s.questions?.find(q=>q.state==='pending'&&s.time>=q.answerOpen&&s.time<q.time+.5);if(q){const b=document.querySelector('[data-lane=\"'+q.options.indexOf(q.answer)+'\"]');if(b&&!b.disabled){b.click();window.__targetTaps.push(q.prompt);}}},120)");
  await until(complete,'rhythm target condition response',110000);trace.push({track:2,taps:await js(frame,"window.__targetTaps.length")});
 }else if(gameId==='korean-racing'){
  const {CAMPAIGN}=await load('../korean-racing/campaign.js'),questions=CAMPAIGN.flatMap(s=>s.items);
  await wait("window.__racing?.snapshot().ready",90000);
  // The native headless renderer uses software graphics. Select the actual
  // mobile/lightweight controls; never speed up simulation time or award logic.
  world.setSize(390,850);await delay(300);
  await js(world,"document.querySelector('iframe').scrollIntoView({block:'start',behavior:'instant'})");
  await until(()=>js(world,"(()=>{const r=document.querySelector('iframe').getBoundingClientRect();return r.top<80&&r.bottom>400;})()"),'racing iframe in real viewport');
  check('racing-frame-is-visible-in-parent',await js(world,"(()=>{const r=document.querySelector('iframe').getBoundingClientRect();return r.top<80&&r.bottom>400&&r.width>250;})()"));
  await js(frame,"document.getElementById('quality').value='low';document.getElementById('quality').dispatchEvent(new Event('change'));document.getElementById('start').click()");
  await until(async()=>{const s=await js(frame,"window.__racing.snapshot()");if(s.tutorial){await js(frame,"document.getElementById('tutorial-skip').click()");return true;}return s.running;},'racing start',60000);
  await wait("window.__racing.snapshot().running&&window.__racing.snapshot().stage.id==='personalized'",60000);
  check('racing-starts-exact-target-course',await js(frame,"window.__racing.snapshot().stage.id==='personalized'"));
  let answered=new Set(),lastDiagnostic=0;const startedAt=Date.now(),end=startedAt+240000;
  while(!complete()&&Date.now()<end){
   const s=await js(frame,"window.__racing.snapshot()");
   if(Date.now()-lastDiagnostic>=15000){
    lastDiagnostic=Date.now();const wallSeconds=(Date.now()-startedAt)/1000;
    const viewport=await js(world,"(()=>{const r=document.querySelector('iframe').getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height,visibility:document.visibilityState};})()");
    fs.writeFileSync(path.join(directory,`${outputPrefix}-live.json`),JSON.stringify({gameId,skillId:target.skillId,wallSeconds,elapsed:s.elapsed,course:s.stage?.id,viewport,answers:s.answers?.length,trace},null,2));
    if(wallSeconds>=15&&s.elapsed<wallSeconds*.1)throw Error('Racing browser rendering is throttled: '+s.elapsed+' simulation seconds / '+wallSeconds+' wall seconds');
   }
   if(s.gate?.announced&&!answered.has(s.gate.questionId)){
    const q=questions.find(q=>q.id===s.gate.questionId);if(!q)throw Error('Unexpected question');
    if(q.mode!=='reading'&&(s.narration.playing||!s.narration.played.some(p=>q.audio.includes(p.id)&&p.completed))){await delay(120);continue;}
    check('racing-presented-family-is-target-'+q.id,target.familyKeys.includes('korean-racing:'+q.id+':v1'));
    await js(frame,`document.querySelector('[data-word="${q.answer}"]').click()`);answered.add(q.id);trace.push({questionId:q.id});
   }
   await delay(120);
  }
 }
 await until(complete,gameId+' completed target assignment',15000);
}
app.whenReady().then(async()=>{try{
 const {createLinkedServer}=await load('./linked-server.mjs');server=await createLinkedServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const api=async(route,token,payload)=>{const r=await fetch(origin+route,{method:payload?'POST':'GET',headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});const body=await r.json();if(!r.ok)throw Error(route+': '+body.code);return body;};
 const teacherToken=(await api('/api/teacher/session',null,{key:server.ownerKey})).token,teacher=createWindow('teacher');await teacher.loadURL(origin+'/#teacher-key='+server.ownerKey);await until(()=>js(teacher,"document.documentElement.dataset.ready==='true'"),'teacher ready');
 for(const [contentId,gameId,skillId,difficulty,responseFormat] of cases){let world;const trace=[];try{
  const link=await api('/api/links',teacherToken,{classId:'class-local',name:`Target QA ${gameId}`});world=createWindow(gameId);await world.loadURL(origin+'/synk-account/local-world.html');await js(world,`document.getElementById('connection-code').value=${JSON.stringify(link.code)};document.getElementById('connection-consent').click();document.getElementById('local-join-button').click()`);await until(()=>js(world,"document.documentElement.dataset.localWorld==='connected'"),'WORLD connected');
  const assignment=(await api('/api/assignments',teacherToken,{classId:'class-local',learnerIds:[link.learnerId],contentId,target:{skillId,difficulty,responseFormat},reason:'실제 목표 문항 완료 검증',title:`목표 확인 ${gameId}`,dueAt:new Date(Date.now()+86400000).toISOString(),idempotencyKey:'target-'+contentId})).assignment;
  await js(world,"document.querySelector('[data-world-action=refresh]').click()");await until(()=>js(world,`!!document.querySelector('[data-kind=assignment][data-id="${assignment.id}"]')`),'WORLD assignment');
  await js(world,`document.querySelector('[data-kind=assignment][data-id="${assignment.id}"]').click();document.querySelector('[data-world-action=start-game]').click()`);await until(()=>world.webContents.mainFrame.frames.some(f=>f.url.includes('/'+gameId+'/')),'target iframe '+gameId,60000);
  if(gameId==='entry-check'){await js(world,"const f=document.querySelector('iframe'),u=new URL(f.src);u.searchParams.set('qa','1');f.src=u.href;");await until(()=>world.webContents.mainFrame.frames.some(f=>f.url.includes('/entry-check/')&&f.url.includes('qa=1')),'read-only entry diagnostics');}
  const frame=world.webContents.mainFrame.frames.find(f=>f.url.includes('/'+gameId+'/'));
  const run=server.snapshot().learningRuns.find(r=>r.assignmentId===assignment.id),target=run.target;
  check(gameId+'-server-target-is-requested-goal',target.skillId===skillId&&target.difficulty===difficulty&&target.responseFormat===responseFormat);
  const complete=()=>server.snapshot().submissions.some(s=>s.assignmentId===assignment.id);
  await play(gameId,frame,complete,target,trace,world);
  const submission=server.snapshot().submissions.find(s=>s.assignmentId===assignment.id);
  check(gameId+'-only-target-items-complete',submission.total===target.requiredAttempts&&submission.results.every(r=>target.items.some(i=>i.itemKey===r.itemKey)));
  const workspace=await api('/api/workspace',teacherToken),row=workspace.assignments.find(a=>a.id===assignment.id);
  check(gameId+'-teacher-receives-target-result',row.submissions.some(s=>s.id===submission.id&&s.total===target.requiredAttempts));
  await js(teacher,"document.getElementById('refresh').click()");await until(()=>js(teacher,`!!document.querySelector('[data-student="${link.learnerId}"]')`),'teacher roster');await js(teacher,`document.querySelector('[data-student="${link.learnerId}"]').click()`);
  check(gameId+'-teacher-renders-same-student',await js(teacher,`document.getElementById('student-detail').textContent.includes(${JSON.stringify('Target QA '+gameId)})`));
  results.push({contentId,gameId,target:{skillId,difficulty,responseFormat,familyKeys:target.familyKeys,requiredAttempts:target.requiredAttempts},total:submission.total,correct:submission.correct,trace,source:'actual-ui-controls'});
  world.setSize(390,850);await delay(500);await js(world,"document.querySelector('iframe')?.scrollIntoView({block:'start',behavior:'instant'})");
  await until(()=>js(world,"(()=>{const r=document.querySelector('iframe').getBoundingClientRect();return r.top<80&&r.bottom>400;})()"),'captured iframe in real viewport');
  await delay(1250);fs.writeFileSync(path.join(directory,`target-${contentId}-mobile.png`),(await world.webContents.capturePage()).toPNG());
  if(process.argv.includes('--layout')&&['entry-check','story-classroom'].includes(gameId))await captureLayout(world,frame,contentId);
 }catch(error){let diagnostics;try{const frame=world?.webContents.mainFrame.frames.find(f=>f.url.includes('/'+gameId+'/'));diagnostics={trace,browserErrors:world?.qaErrors,host:await js(world,"window.SYNKLearningHost?.status()"),runs:server.snapshot().learningRuns?.map(r=>({gameId:r.gameId,target:r.target,progress:r.progress})),game:frame?await js(frame,"({entry:window.__entry?.state(),story:window.__storyState,racing:window.__racing?.snapshot(),racingError:window.__racingError,rhythm:window.synkRhythm?.snapshot(),text:document.body.innerText.slice(-1300)})"):null};}catch{}errors.push({gameId,error:error.stack||String(error),diagnostics});}finally{world?.destroy();fs.writeFileSync(path.join(directory,`${outputPrefix}-progress.json`),JSON.stringify({checks,results,errors},null,2));}}
 }catch(error){errors.push({error:error.stack||String(error)});}finally{const result={ok:errors.length===0,checks,results,errors,isolated:true,productionConnected:false};fs.writeFileSync(path.join(directory,`${outputPrefix}-verification.json`),JSON.stringify(result,null,2));console.log(JSON.stringify({ok:result.ok,checks:checks.length,games:results.map(r=>r.gameId),errors:errors.map(e=>({gameId:e.gameId,error:e.error}))}));for(const w of windows)if(!w.isDestroyed())w.destroy();server?.close();app.exit(result.ok?0:1);}});
