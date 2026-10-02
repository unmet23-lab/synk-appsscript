// Real WORLD game controls -> account host -> isolated server -> teacher view.
// No engine events or answer submissions are injected. All learners are synthetic.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{pathToFileURL}=require('node:url');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'synk-full-learning-')));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const directory=path.join(__dirname,'qa'),checks=[],results=[],errors=[],windows=[];fs.mkdirSync(directory,{recursive:true});
let server;
const delay=ms=>new Promise(r=>setTimeout(r,ms)),js=(target,code)=>target.webContents?target.webContents.executeJavaScript(code,true):target.executeJavaScript(code,true);
async function until(fn,label,ms=45000){const end=Date.now()+ms;let last;while(Date.now()<end){try{if(await fn())return;}catch(error){last=error.message;}await delay(90);}throw Error('Timeout: '+label+(last?' / '+last:''));}
const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
function createWindow(role){const win=new BrowserWindow({show:false,width:1280,height:1000,webPreferences:{partition:`full-${role}-${Date.now()}`,contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});windows.push(win);return win;}
const gameFilter=process.argv.find(arg=>arg.startsWith('--games='))?.slice(8).split(',');
const cases=[['entry-reading','entry-check'],['order-listening','order-rush'],['story-reading','story-classroom'],['rhythm-listening','korean-rhythm'],['racing-listening','korean-racing'],['runner-listening','korean-runner'],['town-reading','synk-town']].filter(([,id])=>!gameFilter||gameFilter.includes(id));
async function play(gameId,frame,world,learnerId){
  const wait=(code,ms)=>until(()=>js(frame,code),gameId+': '+code,ms);
  if(gameId==='entry-check'){
    await wait("!!document.getElementById('rec-start')?.onclick");await js(frame,"document.getElementById('rec-start').click();document.getElementById('btn-begin').click()");await wait("!document.getElementById('coach').hidden");await js(frame,"document.getElementById('coach-skip').click()");await delay(550);await wait("!document.getElementById('btn-pass').disabled");await js(frame,"document.getElementById('btn-pass').click()");
  }else if(gameId==='order-rush'){
    await wait("!!window.synkCafe");await js(frame,"document.getElementById('start').click()");await wait("window.synkCafe.current?.audioCompleted===true",60000);await js(frame,"document.querySelector('[data-ingredient=coffee]').click();document.getElementById('serve').click()");
  }else if(gameId==='story-classroom'){
    await wait("!!window.__storyState");await js(frame,"document.getElementById('reading-mode').click();document.getElementById('start').click()");await wait("window.__storyState.started");for(let i=0;i<25;i++){if(await js(frame,"window.__storyState.phase==='play'"))break;await js(frame,"document.getElementById('dialogue-next').click()");await delay(100);}await wait("window.__storyState.phase==='play'");await js(frame,"document.querySelector('[data-actor=kkamong]').click();document.querySelector('[data-object=paper]').click();document.querySelector('[data-destination=drawer]').click()");
  }else if(gameId==='korean-rhythm'){
    await wait("!!window.synkRhythm");await js(frame,"document.getElementById('start-button').click()");await wait("window.synkRhythm.snapshot().screen==='game'",90000);
    await js(frame,"window.__qaRhythmTaps=[];window.__qaRhythmTap=setInterval(()=>{const s=window.synkRhythm.snapshot(),q=s.questions?.find(q=>q.state==='pending'&&s.time>=q.answerOpen&&s.time<q.time+.5),b=document.querySelector('[data-lane=\"0\"]');if(q&&!b.disabled){window.__qaRhythmTaps.push({time:s.time,target:q.time});b.click();}},160)");
  }else if(gameId==='korean-racing'){
    await wait("window.__racing?.snapshot().ready",90000);await js(frame,"document.getElementById('start').click()");await until(async()=>{const s=await js(frame,"window.__racing.snapshot()");if(s.tutorial){await js(frame,"document.getElementById('tutorial-skip').click()");return true;}return s.running;},'racing started',60000);
    await until(()=>server.snapshot().learners.find(l=>l.id===learnerId).events.some(e=>e.payload.type==='practice.delivery'&&e.payload.audio==='completed'),'racing real narration completion',90000);await js(frame,"document.getElementById('go').click()");
  }else if(gameId==='korean-runner'){
    await wait("!!document.getElementById('listening-check')",90000);await js(frame,"document.getElementById('listening-check').click()");await wait("!!document.querySelector('#check-choices button:not(:disabled)')",60000);await js(frame,"document.querySelector('#check-choices button:not(:disabled)').click()");
  }else if(gameId==='synk-town'){
    await wait("typeof document.getElementById('reading-open')?.onclick==='function'&&!document.getElementById('reading-open').disabled&&!!document.querySelector('[data-command=CHOOSE]')",60000);await js(frame,"document.getElementById('reading-open').click()");await wait("!!document.querySelector('#reading-choices button[data-answer=\"1\"]')");await js(frame,"document.querySelector('#reading-choices button[data-answer=\"1\"]').click()");
  }
}
app.whenReady().then(async()=>{try{
  const {createLinkedServer}=await import(pathToFileURL(path.join(__dirname,'linked-server.mjs')).href);server=await createLinkedServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  const api=async(route,token,payload)=>{const r=await fetch(origin+route,{method:payload?'POST':'GET',headers:{...(token?{Authorization:`Bearer ${token}`} : {}),...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});const body=await r.json();if(!r.ok)throw Error(route+': '+body.code);return body;};
  const teacherToken=(await api('/api/teacher/session',null,{key:server.ownerKey})).token,teacher=createWindow('teacher');await teacher.loadURL(origin+'/#teacher-key='+server.ownerKey);await until(()=>js(teacher,"document.documentElement.dataset.ready==='true'"),'teacher ready');
  for(const [contentId,gameId]of cases){let world;try{
    const link=await api('/api/links',teacherToken,{classId:'class-local',name:`QA ${gameId}`});world=createWindow(gameId);await world.loadURL(origin+'/synk-account/local-world.html');await js(world,`document.getElementById('connection-code').value=${JSON.stringify(link.code)};document.getElementById('connection-consent').click();document.getElementById('local-join-button').click()`);await until(()=>js(world,"document.documentElement.dataset.localWorld==='connected'"),'WORLD connected');
    await js(world,`document.querySelector('[data-kind=practice][data-id="${contentId}"]').click();document.querySelector('[data-world-action=start-game]').click()`);await until(()=>world.webContents.mainFrame.frames.some(f=>f.url.includes('/'+gameId+'/')),'game iframe '+gameId,60000);const frame=world.webContents.mainFrame.frames.find(f=>f.url.includes('/'+gameId+'/'));
    if(gameId!=='synk-town')await until(()=>js(world,"window.SYNKLearningHost.status().phase==='synced'"),'account history ready');await play(gameId,frame,world,link.learnerId);
    await until(()=>server.snapshot().learners.find(l=>l.id===link.learnerId).evidence.some(e=>e.grading==='game-reported'&&['correct','incorrect'].includes(e.verdict)),gameId+' actual semantic response',120000);
    const snapshot=server.snapshot(),learner=snapshot.learners.find(l=>l.id===link.learnerId),evidence=learner.evidence.filter(e=>e.grading==='game-reported'),workspace=await api('/api/workspace',teacherToken),seen=workspace.classes.flatMap(c=>c.learners).find(l=>l.id===link.learnerId);check(gameId+'-teacher-receives-game-evidence',seen.evidence.some(e=>e.grading==='game-reported'));
    await js(teacher,"document.getElementById('refresh').click()");await until(()=>js(teacher,`!!document.querySelector('[data-student="${link.learnerId}"]')`),'teacher roster');await js(teacher,`document.querySelector('[data-student="${link.learnerId}"]').click()`);check(gameId+'-teacher-opens-current-student',await js(teacher,`document.getElementById('student-detail').textContent.includes(${JSON.stringify('QA '+gameId)})`));
    results.push({gameId,events:learner.events.length,languageAttempts:evidence.length,independent:evidence.filter(e=>e.independent).length,source:'actual-ui-controls'});fs.writeFileSync(path.join(directory,`full-${gameId}.png`),(await world.webContents.capturePage()).toPNG());
  }catch(error){let diagnostics;try{const frame=world?.webContents.mainFrame.frames.find(f=>f.url.includes('/'+gameId+'/'));diagnostics={host:await js(world,"window.SYNKLearningHost?.status()"),game:frame?await js(frame,"({rhythm:window.synkRhythm?.snapshot(),taps:window.__qaRhythmTaps,text:document.body.innerText.slice(-1500)})"):null};}catch{}errors.push({gameId,error:error.stack||String(error),diagnostics});if(world)fs.writeFileSync(path.join(directory,`full-${gameId}-failed.png`),(await world.webContents.capturePage()).toPNG());}finally{world?.destroy();fs.writeFileSync(path.join(directory,'full-learning-progress.json'),JSON.stringify({checks,results,errors},null,2));}}
}catch(error){errors.push({error:error.stack||String(error)});}finally{const result={ok:errors.length===0,checks,results,errors,isolated:true,productionConnected:false};fs.writeFileSync(path.join(directory,'full-learning-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));for(const w of windows)if(!w.isDestroyed())w.destroy();server?.close();app.exit(result.ok?0:1);}});
