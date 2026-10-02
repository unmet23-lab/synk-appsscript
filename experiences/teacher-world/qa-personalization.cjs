const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const directory=path.resolve(__dirname,'qa');fs.mkdirSync(directory,{recursive:true});
app.setPath('userData',path.join(app.getPath('temp'),'synk-teacher-personalization-qa'));
app.disableHardwareAcceleration();
let server,win;const checks=[],errors=[];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const js=script=>win.webContents.executeJavaScript(script);
async function waitFor(script){for(let i=0;i<120;i++){if(await js(script))return;await delay(100);}throw Error('UI timeout: '+script);}
async function capture(name){await js(`document.fonts.ready.then(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))))`);win.webContents.invalidate();await js(`Promise.race([new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))),new Promise(resolve=>setTimeout(resolve,600))])`);await delay(350);fs.writeFileSync(path.join(directory,name),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}
const check=(name,ok)=>{checks.push({name,ok:!!ok});if(!ok)throw Error('Failed: '+name);};
async function choices(values){await js(`for(const [key,value] of Object.entries(${JSON.stringify(values)})){const input=document.querySelector('[data-pref="'+key+'"]');if(!input)throw Error('Missing field '+key);input.value=value;}`);}
async function save(){await js(`document.querySelector('#personalization-form [name=consent]').checked=true;document.querySelector('#personalization-form [type=submit]').click()`);await waitFor(`!document.getElementById('personalization-dialog').open`);}
app.whenReady().then(async()=>{try{
  const {createTeacherServer}=await import(pathToFileURL(path.join(__dirname,'server.mjs')).href);server=await createTeacherServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
  win=new BrowserWindow({show:false,width:1440,height:1100,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
  win.webContents.on('console-message',(event,level,message)=>{if(event.level==='error'||level===3)errors.push(event.message||message);});
  await win.loadURL(origin);await waitFor(`document.documentElement.dataset.ready==='true'`);
  check('first-use-is-optional',await js(`!document.getElementById('personalization-panel').hidden&&!!document.querySelector('[data-personal=skip]')&&!document.getElementById('personalization-dialog').open`));
  await js(`document.getElementById('personalization-button').click()`);
  check('unanswered-fields-stay-empty',await js(`[...document.querySelectorAll('[data-pref]')].every(n=>n.value==='')`));
  await choices({support:'individual'});
  await js(`document.querySelector('#personalization-form [type=submit]').click()`);
  check('no-consent-no-write',await js(`document.getElementById('personalization-error').textContent.includes('동의')&&document.getElementById('personalization-dialog').open`));
  await save();await waitFor(`!!document.querySelector('[data-personal=complete]')`);
  await js(`document.getElementById('personalization-button').click()`);
  check('defaults-not-presented-as-declarations',await js(`document.querySelector('[data-pref=support]').value==='individual'&&[...document.querySelectorAll('[data-pref]')].filter(n=>n.dataset.pref!=='support').every(n=>n.value==='')`));
  await choices({goal:'topik',classFormat:'individual',sessionMinutes:'20',preparationMinutes:'5',experience:'new',support:'individual',textSize:'large',detail:'detailed',motion:'reduced'});
  await capture('teacher-personalization-dialog.png');await save();
  await waitFor(`document.documentElement.dataset.textSize==='large'`);
  check('teacher-plan-consumes-context',await js(`document.querySelector('.personal-reason').textContent.includes('20분 수업 · 5분 준비 · 개별')&&document.querySelector('.personal-steps').textContent.includes('준비된 읽기 활동')&&document.querySelector('.personal-steps').textContent.includes('진행 순서 안내')`));
  check('presentation-applied',await js(`document.documentElement.dataset.motion==='reduced'&&document.documentElement.dataset.explanation==='detailed'&&parseFloat(getComputedStyle(document.querySelector('.personal-reason')).fontSize)>=17`));
  await capture('teacher-personalized-desktop.png');
  await js(`document.querySelector('[data-personal=use-template]').click()`);
  check('teacher-template-applied-to-real-form',await js(`document.getElementById('assignment-dialog').open&&document.querySelector('#assignment-form textarea').value.includes('질문의 핵심 낱말')&&Math.round((new Date(document.getElementById('assignment-due').value).getTime()-new Date(new Date().toISOString().slice(0,10)).getTime())/86400000)===1`));
  await js(`window.savedGuide=document.querySelector('#assignment-form textarea').value;document.getElementById('content-select').value='reading-condition';document.getElementById('content-select').dispatchEvent(new Event('change'))`);
  check('changing-activity-clears-stale-recommendation',await js(`document.querySelector('#assignment-form textarea').value===''`));
  await js(`document.querySelector('#assignment-form textarea').value='선생님이 직접 쓴 안내';document.getElementById('content-select').value='reading-detail';document.getElementById('content-select').dispatchEvent(new Event('change'))`);
  check('changing-activity-preserves-teacher-draft',await js(`document.querySelector('#assignment-form textarea').value==='선생님이 직접 쓴 안내'`));
  await js(`document.querySelector('#assignment-form textarea').value=window.savedGuide`);
  await js(`document.querySelector('#assignment-form [type=submit]').click()`);await waitFor(`!document.getElementById('assignment-dialog').open&&document.querySelectorAll('.assignment-card').length===1`);
  const titleBefore=await js(`document.querySelector('.personal-head h2').textContent`);
  await js(`document.querySelector('[data-personal=complete]').click()`);await waitFor(`!!document.querySelector('[data-personal=not_fit]')`);
  await js(`document.querySelector('[data-personal=not_fit]').click()`);await waitFor(`!!document.querySelector('[data-personal=complete]')&&document.querySelector('.personal-head h2').textContent!==${JSON.stringify(titleBefore)}`);
  check('used-feedback-changes-next-plan',true);
  await win.reload();await waitFor(`document.documentElement.dataset.ready==='true'&&document.documentElement.dataset.textSize==='large'`);
  check('teacher-settings-survive-reload',await js(`document.querySelector('.personal-reason').textContent.includes('20분 수업 · 5분 준비')`));
  for(const width of [390,320]){win.setContentSize(width,1000);await delay(150);check('teacher-large-no-overflow-'+width,await js(`document.documentElement.scrollWidth<=innerWidth`));await capture('teacher-personalized-'+width+'.png');await js(`document.getElementById('personalization-button').click()`);check('settings-dialog-no-overflow-'+width,await js(`document.querySelector('dialog[open]').scrollWidth<=document.querySelector('dialog[open]').clientWidth+1`));await capture('teacher-settings-'+width+'.png');await js(`document.querySelector('[data-personal=close]').click()`);}
  win.setContentSize(1200,1000);await win.loadURL(origin+'/student?learner=demo-nara');await waitFor(`document.documentElement.dataset.ready==='true'`);
  check('teacher-preferences-do-not-leak-to-student',await js(`document.documentElement.dataset.textSize==='standard'&&document.querySelector('.personal-state').textContent.includes('첫 맞춤')`));
  await js(`document.getElementById('personalization-button').click()`);await choices({goal:'topik',availableMinutes:'10',audio:'off',preference:'independent',textSize:'large',detail:'brief',motion:'reduced'});await save();
  await waitFor(`document.documentElement.dataset.textSize==='large'`);
  check('student-context-and-method-applied',await js(`document.querySelector('.personal-reason').textContent.includes('소리가 필요 없는')&&document.querySelector('.personal-head h2').textContent.includes('먼저 풀고')&&document.querySelector('.personal-steps').textContent.includes('먼저 혼자')`));
  await js(`document.querySelector('[data-start]').click();for(const input of document.querySelectorAll('fieldset input:first-of-type')){if(!document.querySelector('input[name="'+input.name+'"]:checked'))input.click();}document.getElementById('personalization-button').click()`);
  await choices({detail:'detailed'});await save();await waitFor(`document.documentElement.dataset.explanation==='detailed'`);
  check('personal-settings-preserve-selected-answers',await js(`document.querySelectorAll('#answer-form input:checked').length===3`));
  check('student-explanation-length-changes-actual-text',await js(`document.querySelector('.personal-guidance').textContent.includes('질문의 핵심 낱말')`));
  await js(`document.getElementById('learner-select').value='demo-bora';document.getElementById('learner-select').dispatchEvent(new Event('change'))`);await waitFor(`document.documentElement.dataset.ready==='true'&&document.getElementById('student-content').textContent.includes('보라')`);
  check('student-switch-clears-previous-preferences',await js(`document.documentElement.dataset.textSize==='standard'&&document.querySelector('.personal-state').textContent.includes('첫 맞춤')`));
  await js(`document.getElementById('learner-select').value='demo-nara';document.getElementById('learner-select').dispatchEvent(new Event('change'))`);await waitFor(`document.documentElement.dataset.textSize==='large'`);
  check('student-own-preferences-restored',await js(`document.querySelector('.personal-head h2').textContent.includes('먼저 풀고')`));
  win.setContentSize(320,1000);await delay(150);check('student-large-no-overflow-320',await js(`document.documentElement.scrollWidth<=innerWidth`));await capture('student-personalized-320.png');
  await js(`window.originalFetch=window.fetch;window.failRefresh=true;window.fetch=(url,options)=>url.startsWith('/api/student?')&&window.failRefresh?Promise.reject(new TypeError('Synthetic refresh failure')):window.originalFetch(url,options);document.getElementById('personalization-button').click();document.querySelector('[data-personal=disable]').click()`);await waitFor(`document.querySelector('.personal-state').textContent.includes('꺼짐')`);
  await waitFor(`document.getElementById('student-content').textContent.includes('Synthetic refresh failure')`);
  check('successful-disable-survives-refresh-failure',await js(`document.documentElement.dataset.textSize==='standard'&&!document.querySelector('[data-personal=complete]')`));
  await win.loadURL(origin);await waitFor(`document.documentElement.dataset.ready==='true'`);
  check('student-disable-does-not-disable-teacher',await js(`document.documentElement.dataset.textSize==='large'`));
  await js(`document.getElementById('personalization-button').click();document.querySelector('[data-personal=confirm-clear]').click();document.querySelector('[data-personal=clear]').click()`);await waitFor(`document.documentElement.dataset.textSize==='standard'&&!document.getElementById('personalization-dialog').open`);
  check('clear-only-personalization',await js(`fetch('/api/workspace').then(r=>r.json()).then(w=>w.assignments.length===1&&w.personalization.status==='new'&&Object.keys(w.personalization.answers).length===0)`));
  await js(`document.querySelector('[data-personal=skip]').click()`);await waitFor(`document.querySelector('.personal-state').textContent.includes('기본 설정')`);
  check('skip-still-allows-teaching',await js(`document.querySelectorAll('[data-student]').length===3&&document.getElementById('assign')!==null`));
  check('no-js-errors',errors.length===0);
}catch(error){errors.push(error.stack);}
finally{const result={ok:errors.length===0&&checks.every(c=>c.ok),checks,errors,synthetic:true,productionConnected:false};fs.writeFileSync(path.join(directory,'personalization-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));win?.destroy();server?.close();app.exit(result.ok?0:1);}});
