// Synthetic Atlas histories -> teacher UI assignment -> actual WORLD game controls -> teacher result.
// Seeded histories are test inputs; game completion records are never injected.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{pathToFileURL}=require('node:url');
const Game=require('../../atlas/game-learning.js'),Strata=require('../../strata'),map=Strata.createMap(require('../../strata/maps/topik-i.json'));
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'synk-targeted-personas-')));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');app.commandLine.appendSwitch('enable-unsafe-swiftshader');
const directory=path.join(__dirname,'qa'),checks=[],results=[],errors=[],windows=[];fs.mkdirSync(directory,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms)),js=(w,code)=>(w.webContents||w).executeJavaScript(code,true);
let server,api,origin,serial=0;
const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error(name);};
async function until(fn,label,timeout=45000){const end=Date.now()+timeout;let last;while(Date.now()<end){try{if(await fn())return;}catch(e){last=e.message;}await delay(80);}throw Error('Timeout: '+label+(last?' / '+last:''));}
const wait=(w,code,label,ms)=>until(()=>js(w,code),label||code,ms);
function windowFor(id){const win=new BrowserWindow({show:false,width:1280,height:1000,webPreferences:{partition:`targeted-${id}-${++serial}`,contextIsolation:true,sandbox:true,nodeIntegration:false,backgroundThrottling:false}});windows.push(win);return win;}
async function capture(win,name){await js(win,'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');win.webContents.invalidate();await delay(150);fs.writeFileSync(path.join(directory,name),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}
const personas=[
  {id:'listening-strong',name:'시험 듣기 충분 읽기 연습',contentId:'town-reading',gameId:'synk-town',skill:'ko.reading.detail',history:[['listening',true,4],['reading',false,3]]},
  {id:'reading-strong',name:'시험 읽기 충분 듣기 연습',contentId:'runner-listening',gameId:'korean-runner',skill:'ko.listening.detail',history:[['reading',true,4],['listening',false,3]]},
  {id:'unseen',name:'시험 첫 학습',contentId:'town-reading',gameId:'synk-town',skill:'ko.reading.detail',history:[]},
  {id:'assisted',name:'시험 도움과 함께',contentId:'town-reading',gameId:'synk-town',skill:'ko.reading.negation',history:[['reading',true,3,true,'negation']],help:true},
];
async function seed(token,learnerId,history){
  for(const [modality,correct,count,help=false,skill='detail']of history){const memory=new Map(),coach=Game.createGame({gameId:modality==='listening'?'korean-racing':'entry-check',map,storage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)},clock:()=>new Date().toISOString()});
    for(let i=0;i<count;i++){const id=`persona-${learnerId}-${modality}-${skill}-${i}`,p=coach.present({id,itemKey:id,familyKey:id,skillId:`ko.${modality}.${skill}`,difficulty:1,responseFormat:'single-choice',modality,audioRequired:modality==='listening',confounded:false});if(modality==='listening')coach.delivery(p,{audio:'completed'});if(help)coach.help(p,'hint');coach.answer(p,{correct,assessable:true});}
    await api('/api/world/learning',token,{revision:2,events:coach.events()});
  }
}
async function teacherAssign(teacher,teacherToken,person,learnerId){
  await js(teacher,"document.getElementById('refresh').click();document.querySelector('[data-view=students]').click()");await wait(teacher,`!!document.querySelector('[data-student="${learnerId}"]')`);
  await js(teacher,`document.querySelector('[data-student="${learnerId}"]').click()`);
  await wait(teacher,`!document.getElementById('assign').disabled&&document.getElementById('student-detail').textContent.includes(${JSON.stringify(person.name)})`,'selected student is ready for teacher action');
  await js(teacher,"document.getElementById('assign').click()");await wait(teacher,"document.getElementById('assignment-dialog').open");
  await js(teacher,`document.getElementById('content-select').value=${JSON.stringify(person.contentId)};document.getElementById('content-select').dispatchEvent(new Event('change'));document.getElementById('assignment-title').value=${JSON.stringify(person.name+' 목표 과제')};document.getElementById('assignment-form').elements.instructions.value='현재 확인한 목표에 맞춰 서로 다른 문항을 차분히 풀어 주세요.';document.querySelector('#assignment-form button[type=submit]').click()`);
  await until(()=>server.snapshot().assignments.some(a=>a.title===person.name+' 목표 과제'),'teacher UI creates '+person.id);
  await wait(teacher,"!document.getElementById('assignment-dialog').open");
  const assignment=server.snapshot().assignments.find(a=>a.title===person.name+' 목표 과제');check(person.id+'-teacher-freezes-right-skill',assignment.targets[learnerId].skillId===person.skill);
  const w=await api('/api/workspace',teacherToken);check(person.id+'-teacher-has-target-preview',w.classes.flatMap(c=>c.learners).find(l=>l.id===learnerId).gameTargets[person.contentId].skillId===person.skill);
  return assignment;
}
async function playTarget(person,world,frame,token,assignment,authored){
  const target=assignment.targets[assignment.learnerIds[0]],seen=[];
  if(person.gameId==='synk-town'){
    await wait(frame,"typeof document.getElementById('reading-open')?.onclick==='function'&&!document.getElementById('reading-open').disabled&&!!document.querySelector('[data-command=CHOOSE]')",'Town linked world ready',60000);
    await js(frame,"document.getElementById('reading-open').click()");await wait(frame,"document.getElementById('reading-dialog').open&&!!document.querySelector('#reading-choices [data-answer]')");
  }else{
    await wait(frame,"!!document.getElementById('listening-check')?.onclick",'runner real check ready',90000);await js(frame,"document.getElementById('listening-check').click()");
  }
  for(let i=0;i<target.requiredAttempts;i++){
    const town=person.gameId==='synk-town',dialog=town?'reading-dialog':'listening-check-dialog',buttons=town?'#reading-choices button[data-answer]':'#check-choices button[data-choice]',next=town?'reading-next':'check-next';
    await wait(frame,`!!document.querySelector(${JSON.stringify(buttons+':not(:disabled)')})`,'actual audio/content available',60000);
    const itemId=await js(frame,`document.getElementById(${JSON.stringify(dialog)}).dataset.item`),entry=authored.find(x=>x.item.id===itemId);if(!entry)throw Error('Unknown authored item '+itemId);
    const m=entry.metadata;check(person.id+'-item-'+i+'-matches-exact-teacher-goal',m.skillId===target.skillId&&m.difficulty===target.difficulty&&m.responseFormat===target.responseFormat&&m.modality===target.modality&&target.items.some(x=>x.familyKey===m.familyKey&&x.itemKey===m.itemKey));
    check(person.id+'-item-'+i+'-distinct-family',!seen.includes(m.familyKey));seen.push(m.familyKey);
    if(person.help)await js(frame,"document.getElementById('reading-hint').click()");
    const attribute=town?'data-answer':'data-choice';await js(frame,`document.querySelector(${JSON.stringify(buttons+`[${attribute}="${entry.item.correct}"]`)}).click()`);
    await wait(frame,`!document.getElementById(${JSON.stringify(next)}).hidden`,'answer feedback');
    await until(async()=>{const w=await api('/api/student',token);return w.assignments.find(a=>a.id===assignment.id)?.run?.progress.total>=i+1;},'WORLD sync item '+i,60000);
    if(i<target.requiredAttempts-1)await js(frame,`document.getElementById(${JSON.stringify(next)}).click()`);
  }
  await until(()=>server.snapshot().submissions.some(s=>s.assignmentId===assignment.id),'teacher receives completed target',60000);
  const w=await api('/api/student',token),own=w.assignments.find(a=>a.id===assignment.id),result=own.submission;
  check(person.id+'-only-target-items-complete',own.completed&&result.total===target.requiredAttempts&&result.results.every(r=>target.itemKeys.includes(r.itemKey)));
  check(person.id+'-help-accounted-separately',person.help?result.assisted===target.requiredAttempts&&result.independent===0:result.assisted===0);
  check(person.id+'-no-learning-effect-claim',result.learningEffectClaim===false&&result.grading==='game-reported');
  return {target,seen,submission:{total:result.total,correct:result.correct,assisted:result.assisted,independent:result.independent},runId:own.run.id};
}
app.whenReady().then(async()=>{try{
  const [{createLinkedServer},{LISTENING_CHECKS,checkMetadata},{READING_CHECKS,readingMetadata}]=await Promise.all(['linked-server.mjs','../korean-runner/listening-check.mjs','../synk-town/understanding.mjs'].map(file=>import(pathToFileURL(path.join(__dirname,file)).href)));
  server=await createLinkedServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;
  api=async(route,token,payload)=>{const r=await fetch(origin+route,{method:payload?'POST':'GET',headers:{...(token?{Authorization:`Bearer ${token}`}:{ }),...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:JSON.stringify(payload)}:{})});const body=await r.json();if(!r.ok)throw Error(route+': '+body.code);return body;};
  const teacherToken=(await api('/api/teacher/session',null,{key:server.ownerKey})).token,teacher=windowFor('teacher');await teacher.loadURL(origin+'/#teacher-key='+server.ownerKey);await wait(teacher,"document.documentElement.dataset.ready==='true'",'teacher ready');
  for(const person of personas){let world;try{
    const link=await api('/api/links',teacherToken,{classId:'class-local',name:person.name});world=windowFor(person.id);await world.loadURL(origin+'/synk-account/local-world.html');
    await js(world,`document.getElementById('connection-code').value=${JSON.stringify(link.code)};document.getElementById('connection-consent').click();document.getElementById('local-join-button').click()`);await wait(world,"document.documentElement.dataset.localWorld==='connected'",'WORLD joined');
    const token=await js(world,"JSON.parse(sessionStorage.getItem('synk.local-world.connection.v1')).token");await seed(token,link.learnerId,person.history);
    const before=(await api('/api/workspace',teacherToken)).classes.flatMap(c=>c.learners).find(l=>l.id===link.learnerId);
    check(person.id+'-synthetic-history-personalizes',person.id==='unseen'?before.skills.every(s=>s.n===0&&s.status==='unseen'):before.recommendation.skillId===person.skill);
    if(person.help)check(person.id+'-assisted-is-not-independent',before.skills.find(s=>s.id===person.skill).n===0&&before.skills.find(s=>s.id===person.skill).assisted===3);
    const assignment=await teacherAssign(teacher,teacherToken,person,link.learnerId);
    await js(world,"document.querySelector('[data-world-action=refresh]').click()");await wait(world,`!!document.querySelector('[data-kind=assignment][data-id="${assignment.id}"]')`);
    check(person.id+'-other-personas-not-in-inbox',(await api('/api/student',token)).assignments.every(a=>a.id===assignment.id));
    await js(world,`document.querySelector('[data-kind=assignment][data-id="${assignment.id}"]').click();document.querySelector('[data-world-action=start-game]').click()`);
    await until(()=>world.webContents.mainFrame.frames.some(f=>f.url.includes('/'+person.gameId+'/')),'game iframe',60000);const frame=world.webContents.mainFrame.frames.find(f=>f.url.includes('/'+person.gameId+'/'));
    await wait(world,"window.SYNKLearningHost.status().phase==='synced'",'account history downloaded',60000);
    const authored=person.gameId==='synk-town'?READING_CHECKS.map(item=>({item,metadata:readingMetadata(item)})):LISTENING_CHECKS.map(item=>({item,metadata:checkMetadata(item)}));
    const result=await playTarget(person,world,frame,token,assignment,authored);await capture(world,`targeted-${person.id}-world.png`);
    await js(teacher,"document.getElementById('refresh').click();document.querySelector('[data-view=assignments]').click()");await wait(teacher,`document.getElementById('assignments').textContent.includes(${JSON.stringify(person.name+' 목표 과제')})&&document.getElementById('assignments').textContent.includes('게임 응답 기록')`,'teacher result UI');
    check(person.id+'-teacher-ui-returns-result',await js(teacher,"document.getElementById('assignments').textContent.includes('혼자 푼 새 문항')"));
    const locateCard=`[...document.querySelectorAll('.assignment-card')].find(node=>node.textContent.includes(${JSON.stringify(person.name+' 목표 과제')}))`;
    await js(teacher,`${locateCard}.scrollIntoView({block:'start'})`);await capture(teacher,`targeted-${person.id}-teacher.png`);
    if(person.id==='assisted'){
      teacher.setContentSize(390,950);await delay(150);await js(teacher,`${locateCard}.scrollIntoView({block:'start'})`);
      check('assisted-teacher-target-readable-390',await js(teacher,`(()=>{const card=${locateCard},target=card.querySelector('.assignment-target');return document.documentElement.scrollWidth<=innerWidth&&target.textContent.includes(${JSON.stringify(result.target.label)})&&target.getBoundingClientRect().width<=innerWidth;})()`));
      await capture(teacher,'targeted-assisted-teacher-390.png');teacher.setContentSize(1280,1000);
    }
    await world.reload();await wait(world,"document.documentElement.dataset.localWorld==='connected'",'WORLD reload');check(person.id+'-completion-survives-reload',await js(world,"document.getElementById('world-classroom').textContent.includes('제출 완료')"));
    results.push({persona:person.id,contentId:person.contentId,source:'synthetic-history-real-game-controls',before:{skill:before.recommendation.skillId,state:before.recommendation.state},...result});
  }catch(e){let diagnostic;try{diagnostic={world:await js(world,"document.body.innerText.slice(-1700)"),host:await js(world,"window.SYNKLearningHost?.status()")};}catch{}errors.push({persona:person.id,error:e.stack||String(e),diagnostic});if(world)await capture(world,`targeted-${person.id}-failed.png`);}finally{world?.destroy();fs.writeFileSync(path.join(directory,'targeted-learning-progress.json'),JSON.stringify({checks,results,errors},null,2));}}
}catch(e){errors.push({error:e.stack||String(e)});}finally{const result={ok:errors.length===0,checks,results,errors,isolated:true,productionConnected:false,historySource:'synthetic Atlas event fixtures',completionSource:'actual teacher and game UI controls'};fs.writeFileSync(path.join(directory,'targeted-learning-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));for(const w of windows)if(!w.isDestroyed())w.destroy();server?.close();app.exit(result.ok?0:1);}});
