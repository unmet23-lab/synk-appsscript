const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const directory=path.resolve(__dirname,'qa');fs.mkdirSync(directory,{recursive:true});
app.setPath('userData',path.join(app.getPath('temp'),'synk-teacher-ui-smoke'));
app.disableHardwareAcceleration();
let server,win;const checks=[],errors=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const js=script=>win.webContents.executeJavaScript(script);
async function waitFor(script){for(let i=0;i<150;i++){if(await js(script))return;await delay(100);}throw Error('UI timeout: '+script);}
async function capture(name){await js(`document.fonts.ready.then(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))))`);await delay(500);fs.writeFileSync(path.join(directory,name),(await win.webContents.capturePage()).toPNG());}
const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error('Failed: '+name);};
app.whenReady().then(async()=>{try{
  const {createTeacherServer}=await import(pathToFileURL(path.join(__dirname,'server.mjs')).href);server=await createTeacherServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  win=new BrowserWindow({show:false,width:1440,height:1050,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  win.webContents.on('console-message',(event,level,message)=>{if(event.level==='error'||level===3)errors.push(event.message||message);});
  await win.loadURL(origin);await waitFor(`document.documentElement.dataset.ready==='true'`);
  check('initial-three-students',await js(`document.querySelectorAll('[data-student]').length===3`));
  check('different-recommendations',await js(`document.getElementById('roster').textContent.includes('도서관')&&document.getElementById('roster').textContent.includes('레이싱')`));
  await capture('teacher-desktop.png');
  await js(`document.getElementById('assign').click()`);check('assignment-dialog',await js(`document.getElementById('assignment-dialog').open`));
  await js(`window.originalFetch=window.fetch;window.lostAssignment=false;window.fetch=async(...args)=>{const response=await window.originalFetch(...args);if(args[0]==='/api/assignments'&&!window.lostAssignment){window.lostAssignment=true;throw new TypeError('Synthetic lost response after server save');}return response;};document.querySelector('#assignment-form button[type=submit]').click()`);
  await waitFor(`!!document.getElementById('assignment-error').textContent`);await js(`document.querySelector('#assignment-form button[type=submit]').click()`);await waitFor(`!document.getElementById('assignment-dialog').open&&!document.getElementById('view-assignments').hidden&&document.querySelectorAll('.assignment-card').length===1`);check('assignment-retry-no-duplicate',true);
  await win.loadURL(origin+'/student?learner=demo-nara');await waitFor(`document.documentElement.dataset.ready==='true'`);
  await js(`document.querySelector('[data-start]').click()`);check('student-actual-questions',await js(`document.querySelectorAll('fieldset').length===3`));
  await capture('student-assignment-desktop.png');
  await js(`for(const [id,value]of [['detail-open','b'],['detail-books','b'],['detail-return','c']])document.querySelector('input[name="'+id+'"][value="'+value+'"]').click();document.querySelector('#answer-form button[type=submit]').click()`);
  await waitFor(`!!document.querySelector('.result')`);check('actual-submission-feedback',await js(`document.querySelector('.result').textContent.includes('3문항 중 3문항')`));
  await win.loadURL(origin);await waitFor(`document.documentElement.dataset.ready==='true'`);await js(`document.querySelector('[data-view=assignments]').click()`);check('teacher-sees-returned-result',await js(`document.getElementById('assignments').textContent.includes('제출 완료')&&document.getElementById('assignments').textContent.includes('3 / 3문항')`));
  await js(`document.querySelector('[data-view=students]').click();document.getElementById('add-note').click();document.getElementById('note-skill').value='ko.reading.condition';document.querySelector('#note-form textarea').value='안내문에서 시간 정보를 스스로 찾았어요.';window.originalFetch=window.fetch;window.lostNote=false;window.fetch=async(...args)=>{const response=await window.originalFetch(...args);if(args[0]==='/api/observations'&&!window.lostNote){window.lostNote=true;throw new TypeError('Synthetic lost note response');}return response;};document.querySelector('#note-form button[type=submit]').click()`);await waitFor(`!!document.getElementById('note-error').textContent`);await js(`document.querySelector('#note-form button[type=submit]').click()`);await waitFor(`!document.getElementById('note-dialog').open`);await js(`document.querySelector('[data-view=review]').click()`);await waitFor(`document.getElementById('observations').textContent.includes('시간 정보를 스스로')`);check('teacher-note-retry-no-duplicate',await js(`document.querySelectorAll('.observation-card').length===1`));check('teacher-chosen-note-skill',await js(`fetch('/api/workspace').then(r=>r.json()).then(w=>w.observations[0].skillId==='ko.reading.condition')`));
  await js(`document.querySelector('[data-view=students]').click();document.getElementById('assign').click();document.querySelector('#assignment-form button[type=submit]').click()`);await waitFor(`!document.getElementById('assignment-dialog').open&&document.querySelectorAll('.assignment-card').length===2`);
  await js(`document.querySelector('[data-edit]').click();document.getElementById('assignment-title').value='다음 수업 준비';document.querySelector('#assignment-form button[type=submit]').click()`);await waitFor(`!document.getElementById('assignment-dialog').open&&document.getElementById('assignments').textContent.includes('다음 수업 준비')`);check('assignment-edit',true);
  await js(`document.querySelector('[data-cancel]').click()`);await waitFor(`document.getElementById('assignments').textContent.includes('취소')`);check('assignment-cancel',true);
  await js(`document.querySelector('[data-view=students]').click();document.getElementById('class-select').value='class-evening';document.getElementById('class-select').dispatchEvent(new Event('change'))`);check('class-switch',await js(`document.querySelectorAll('[data-student]').length===1&&document.getElementById('roster').textContent.includes('로안')`));
  await js(`document.getElementById('class-select').value='class-morning';document.getElementById('class-select').dispatchEvent(new Event('change'));document.getElementById('student-search').value='보라';document.getElementById('student-search').dispatchEvent(new Event('input'))`);check('student-search',await js(`document.querySelectorAll('[data-student]').length===1`));
  await js(`document.getElementById('student-search').value='';document.getElementById('student-search').dispatchEvent(new Event('input'))`);
  await js(`document.getElementById('toast').hidden=true`);
  for(const width of [390,320]){win.setContentSize(width,900);await delay(200);check('teacher-no-overflow-'+width,await js(`document.documentElement.scrollWidth<=innerWidth`));await capture('teacher-mobile-'+width+'.png');await js(`document.getElementById('student-detail').scrollIntoView({block:'start'})`);await capture('teacher-detail-'+width+'.png');await js(`scrollTo(0,0)`);}
  await win.loadURL(origin+'/student?learner=demo-nara');await waitFor(`document.documentElement.dataset.ready==='true'`);await js(`document.querySelector('[data-start]').click()`);check('student-no-overflow-320',await js(`document.documentElement.scrollWidth<=innerWidth`));await capture('student-mobile-320.png');
  check('no-js-errors',errors.length===0);
}catch(error){errors.push(error.stack);}
finally{const result={ok:errors.length===0&&checks.every(c=>c.ok),checks,errors,synthetic:true,productionConnected:false};fs.writeFileSync(path.join(directory,'ui-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));win?.destroy();server?.close();app.exit(result.ok?0:1);}});
