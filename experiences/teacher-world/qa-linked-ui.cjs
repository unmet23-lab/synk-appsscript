// Real, separate Electron renderers; ephemeral server and browser profiles only.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {pathToFileURL}=require('node:url');
const directory=path.join(__dirname,'qa');fs.mkdirSync(directory,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'synk-world-teacher-linked-')));
app.disableHardwareAcceleration();
const checks=[],errors=[],windows=[];let server;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const js=(window,source)=>window.webContents.executeJavaScript(source,true);
const check=(name,value)=>{checks.push({name,ok:!!value});if(!value)throw Error(name);};
async function until(predicate,label){for(let n=0;n<220;n++){if(await predicate())return;await delay(100);}throw Error('Timeout: '+label);}
const wait=(window,source)=>until(()=>js(window,source),source);
async function capture(window,name){await js(window,'document.fonts.ready');await delay(150);fs.writeFileSync(path.join(directory,name),(await window.webContents.capturePage()).toPNG());}
function windowFor(role){const win=new BrowserWindow({show:false,width:1280,height:1000,webPreferences:{partition:`qa-linked-${role}-${Date.now()}`,nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});windows.push(win);win.webContents.on('console-message',event=>{if(event.level==='error')errors.push(`${role}: ${event.message}`);});return win;}
async function answer(window,values){await js(window,`for(const [question,value]of ${JSON.stringify(values)}){const node=document.querySelector('[data-world-answer="'+question+'"][value="'+value+'"]');if(!node)throw Error('Missing answer '+question);node.click();}document.querySelector('[data-world-submit] button[type=submit]').click()`);await wait(window,`!!document.querySelector('.wc-result')`);}

app.whenReady().then(async()=>{try{
  const {createLinkedServer}=await import(pathToFileURL(path.join(__dirname,'linked-server.mjs')).href);server=await createLinkedServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`,teacher=windowFor('teacher'),world=windowFor('world');
  await teacher.loadURL(origin+'/#teacher-key='+server.ownerKey);await wait(teacher,`document.documentElement.dataset.ready==='true'`);
  check('teacher-key-removed-from-url',await js(teacher,`location.hash===''`));
  check('no-synthetic-learners-or-evidence',server.snapshot().learners.length===0);
  check('teacher-empty-class-is-actionable',await js(teacher,`!document.getElementById('world-connections').hidden&&document.getElementById('roster').textContent.includes('연결된 학생이 아직 없어요')`));
  await js(teacher,`document.getElementById('world-learner-name').value='연결 확인 학생';document.querySelector('#world-link-form button').click()`);await wait(teacher,`!!document.getElementById('world-join-code')`);
  const code=await js(teacher,`document.getElementById('world-join-code').value`);
  check('code-created-before-consent-no-evidence',server.snapshot().learners[0].evidence.length===0&&!server.snapshot().learners[0].sharing.enabled);
  await world.loadURL(origin+'/synk-account/local-world.html');await wait(world,`!!document.getElementById('local-join-form')`);
  check('world-is-separate-client-document',await js(world,`location.pathname==='/synk-account/local-world.html'&&!document.getElementById('local-join').hidden`));
  await js(world,`document.getElementById('connection-code').value=${JSON.stringify(code)};document.getElementById('connection-consent').click();document.getElementById('local-join-button').click()`);
  await wait(world,`document.documentElement.dataset.localWorld==='connected'`);
  check('world-account-has-six-real-game-entries',await js(world,`document.querySelectorAll('#world-games .game-links button').length===6&&typeof window.SYNKLearningHost?.createGame==='function'`));
  check('world-cannot-read-teacher-token',await js(world,`!sessionStorage.getItem('synk.teacher.local-linked.session')`));
  await js(teacher,`document.getElementById('refresh').click()`);await wait(teacher,`document.getElementById('student-detail').textContent.includes('WORLD 연결됨')`);
  check('teacher-removes-demo-impersonation-links',await js(teacher,`!document.querySelector('a[href^="/student"]')&&!document.getElementById('assign').disabled`));
  await js(world,`document.querySelector('[data-kind=practice][data-id=reading-detail]').click()`);
  check('world-actual-reading-questions-before-grading',await js(world,`document.querySelectorAll('[data-world-submit] fieldset').length===3&&!document.querySelector('.wc-result')`));
  await answer(world,[['detail-open','a'],['detail-books','a'],['detail-return','a']]);
  check('world-first-reading-zero-of-three',await js(world,`document.querySelector('.wc-result').textContent.includes('0 / 3문항')`));
  check('server-records-first-real-reading-response',server.snapshot().practices.length===1&&server.snapshot().learners[0].evidence.filter(row=>row.grading==='server-scored').length===3);
  await js(teacher,`document.getElementById('refresh').click()`);await wait(teacher,`document.getElementById('student-detail').textContent.includes('0 / 3')`);
  check('teacher-recommends-reading-from-reading-errors',await js(teacher,`document.getElementById('student-detail').textContent.includes('추가 연습')&&document.querySelector('.recommendation h3').textContent.includes('입장 검사')`));
  await js(teacher,`document.getElementById('assign').click();document.getElementById('content-select').value='reading-detail-transfer';document.getElementById('content-select').dispatchEvent(new Event('change'));document.querySelector('#assignment-form textarea').value='방금 틀린 안내문을 다시 읽고 근거를 확인해 주세요.';document.getElementById('assignment-title').value='WORLD 연결 과제';document.querySelector('#assignment-form button[type=submit]').click()`);
  await wait(teacher,`!document.getElementById('assignment-dialog').open&&document.getElementById('assignments').textContent.includes('WORLD 연결 과제')`);
  await js(world,`document.querySelector('[data-world-action=back]').click();document.querySelector('[data-world-action=refresh]').click()`);await wait(world,`!!document.querySelector('[data-kind=assignment]')`);
  check('teacher-assignment-reaches-real-world-inbox',await js(world,`document.getElementById('world-classroom').textContent.includes('WORLD 연결 과제')`));
  await js(world,`document.querySelector('[data-kind=assignment]').click()`);await answer(world,[['transfer-day','b'],['transfer-time','c'],['transfer-place','a'],['transfer-bring','b']]);
  check('world-assignment-server-graded-four-of-four',await js(world,`document.querySelector('.wc-result').textContent.includes('4 / 4문항')`));
  await js(teacher,`document.getElementById('refresh').click()`);await wait(teacher,`document.getElementById('assignments').textContent.includes('4 / 4문항')`);
  check('teacher-receives-world-submission',server.snapshot().submissions.length===1);
  check('new-transfer-adds-four-independent-items',server.snapshot().learners[0].evidence.filter(row=>row.independent).length===7);
  await world.reload();await wait(world,`document.documentElement.dataset.localWorld==='connected'`);check('world-reload-restores-completed-assignment',await js(world,`document.getElementById('world-classroom').textContent.includes('제출 완료')`));
  await teacher.reload();await wait(teacher,`document.documentElement.dataset.ready==='true'`);check('teacher-reload-restores-only-own-workspace',await js(teacher,`document.getElementById('student-detail').textContent.includes('4 / 7')`));
  await js(teacher,`document.querySelector('[data-view=assignments]').click()`);
  await capture(teacher,'linked-teacher-desktop.png');await capture(world,'linked-world-desktop.png');

  // Assign and complete a real game through controls, with no injected learning event.
  await js(teacher,`document.querySelector('[data-view=students]').click();document.getElementById('assign').click();document.getElementById('content-select').value='entry-reading';document.getElementById('content-select').dispatchEvent(new Event('change'));document.querySelector('#assignment-form textarea').value='안내문을 읽고 서로 다른 손님 3명에게 답해 주세요.';document.getElementById('assignment-title').value='게임 왕복 확인';document.querySelector('#assignment-form button[type=submit]').click()`);
  await until(()=>server.snapshot().assignments.some(a=>a.contentId==='entry-reading'),'game assignment issued');
  const gameAssignment=server.snapshot().assignments.find(a=>a.contentId==='entry-reading');
  await js(world,`document.querySelector('[data-world-action=refresh]').click()`);await wait(world,`!!document.querySelector('[data-kind=assignment][data-id="${gameAssignment.id}"]')`);
  await js(world,`document.querySelector('[data-kind=assignment][data-id="${gameAssignment.id}"]').click();document.querySelector('[data-world-action=start-game]').click()`);
  await until(()=>world.webContents.mainFrame.frames.some(frame=>frame.url.includes('/entry-check/')),'entry-check frame');
  const game=world.webContents.mainFrame.frames.find(frame=>frame.url.includes('/entry-check/'));
  const gameTarget=gameAssignment.targets[gameAssignment.learnerIds[0]];
  await until(()=>game.executeJavaScript(`!!document.getElementById('rec-start')?.onclick`),'entry-check start control');
  await game.executeJavaScript(`document.getElementById('rec-start').click();document.getElementById('btn-begin').click()`,true);
  for(let i=0;i<gameTarget.requiredAttempts;i++){
    // Targeted play omits the generic tutorial and can span more than one venue.
    await until(()=>game.executeJavaScript(`!document.getElementById('results').hidden||!document.getElementById('briefing').hidden||!document.getElementById('coach').hidden||(!document.getElementById('btn-pass').disabled&&document.getElementById('feedback').hidden)`),'entry-check next target control');
    if(await game.executeJavaScript(`!document.getElementById('results').hidden`))await game.executeJavaScript(`document.getElementById('r-next').click()`,true);
    if(await game.executeJavaScript(`!document.getElementById('briefing').hidden`))await game.executeJavaScript(`document.getElementById('btn-begin').click()`,true);
    if(await game.executeJavaScript(`!document.getElementById('coach').hidden`))await game.executeJavaScript(`document.getElementById('coach-skip').click()`,true);
    await until(()=>game.executeJavaScript(`!document.getElementById('btn-pass').disabled&&document.getElementById('feedback').hidden`),'target answer available');await delay(550);await game.executeJavaScript(`document.getElementById('btn-pass').click()`,true);
    await until(()=>game.executeJavaScript(`!document.getElementById('feedback').hidden`),'target answer feedback');
    await until(()=>server.snapshot().learningRuns.some(r=>r.assignmentId===gameAssignment.id&&r.progress.total>=i+1),'target answer synced');
    if(i===0)check('actual-game-button-response-syncs-through-world-host',server.snapshot().learners[0].evidence.some(row=>row.grading==='game-reported'));
    if(i<gameTarget.requiredAttempts-1){await until(()=>game.executeJavaScript(`!document.getElementById('btn-next').disabled`),'next guest');await game.executeJavaScript(`document.getElementById('btn-next').click()`,true);}
  }
  await until(()=>server.snapshot().submissions.some(s=>s.assignmentId===gameAssignment.id),'game completion from target responses');
  const gameResult=server.snapshot().submissions.find(s=>s.assignmentId===gameAssignment.id);
  check('real-game-assignment-completes-only-after-targeted-distinct-language-responses',gameResult.total===gameTarget.requiredAttempts&&gameResult.results.every(row=>gameTarget.itemKeys.includes(row.itemKey)));
  await js(world,`document.querySelector('[data-world-action=refresh]').click()`);await wait(world,`document.querySelector('.wc-activity')?.textContent.includes('학습 완료')`);
  await js(teacher,`document.getElementById('refresh').click();document.querySelector('[data-view=assignments]').click()`);await wait(teacher,`document.getElementById('assignments').textContent.includes('게임 응답 기록')`);
  check('teacher-renders-game-result-with-help-and-independent-counts',await js(teacher,`document.getElementById('assignments').textContent.includes('혼자 푼 새 문항')`));
  await capture(world,'linked-world-game-response.png');

  await js(teacher,`document.querySelector('[data-view=students]').click();document.getElementById('refresh').click()`);
  for(const width of [390,320]){teacher.setContentSize(width,950);world.setContentSize(width,950);await delay(150);check('teacher-no-overflow-'+width,await js(teacher,'document.documentElement.scrollWidth<=innerWidth'));check('world-no-overflow-'+width,await js(world,'document.documentElement.scrollWidth<=innerWidth'));await capture(teacher,`linked-teacher-${width}.png`);await capture(world,`linked-world-${width}.png`);}
  await js(teacher,`document.getElementById('assign').click()`);await wait(teacher,`document.getElementById('assignment-dialog').open`);
  await js(world,`document.querySelector('#account .toggle input').click()`);await until(()=>server.snapshot().learners[0].sharing.enabled===false,'sharing off');
  await wait(teacher,`document.getElementById('student-detail').textContent.includes('기록 공유 종료')`);
  check('sharing-withdrawal-closes-open-teacher-draft-without-manual-refresh',await js(teacher,`!document.getElementById('assignment-dialog').open`));
  check('withdrawing-sharing-hides-prior-evidence-and-work',await js(teacher,`[...document.querySelectorAll('.skill-number')].every(node=>node.textContent==='—')&&document.getElementById('assign').disabled&&!document.querySelector('.assignment-card')`));
  await js(world,`document.querySelector('#account .toggle input').click()`);await until(()=>server.snapshot().learners[0].sharing.enabled===true,'sharing on');await js(teacher,`document.getElementById('refresh').click()`);await wait(teacher,`!!document.querySelector('[data-revoke]')`);
  check('new-consent-does-not-restore-old-reading-evidence',await js(teacher,`[...document.querySelectorAll('.skill-number')].every(node=>node.textContent==='—')`));
  await js(teacher,`document.querySelector('[data-revoke]').click()`);await until(()=>server.snapshot().learners[0].revoked===true,'teacher revoke');
  await js(world,`document.querySelector('[data-world-action=refresh]')?.click()`);await wait(world,`document.documentElement.dataset.localWorld==='disconnected'`);
  check('teacher-revoke-clears-world-account-games-and-work',await js(world,`document.getElementById('account').hidden&&document.getElementById('world-games').hidden&&document.getElementById('world-classroom').hidden&&!window.SYNKLearningHost`));
  await js(teacher,`document.getElementById('teacher-logout').click()`);await wait(teacher,`document.documentElement.dataset.ready==='auth'`);
  check('teacher-logout-clears-sensitive-views',await js(teacher,`document.getElementById('student-detail').textContent===''&&!sessionStorage.getItem('synk.teacher.local-linked.session')`));
  check('no-runtime-or-resource-errors',errors.length===0);
}catch(error){errors.push(error.stack||String(error));}
finally{const result={ok:errors.length===0&&checks.every(row=>row.ok),checks,errors,mode:'local-linked',productionConnected:false,isolated:true};fs.writeFileSync(path.join(directory,'linked-ui-verification.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));for(const win of windows)win.destroy();server?.close();app.exit(result.ok?0:1);}});
