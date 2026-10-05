/* Scripted local UI verification, not learner outcomes or a production experiment. */
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const out=path.join(__dirname,'qa','20261005-domain'),results=[];
let win;
const check=(name,ok,detail)=>{results.push({name,ok:!!ok,detail});if(!ok)throw Error(name);};
async function run(){
  app.setPath('userData',await fs.mkdtemp(path.join(os.tmpdir(),'synk-shift-domain-qa-')));
  await app.whenReady();await fs.mkdir(out,{recursive:true});
  win=new BrowserWindow({show:false,width:1280,height:950,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  const js=code=>win.webContents.executeJavaScript(code,true);
  const ready=async()=>{for(let i=0;i<60;i++){if(await js("document.documentElement.dataset.ready==='true'"))return;await new Promise(r=>setTimeout(r,100));}throw Error('ready timeout');};
  const shot=async name=>{win.webContents.invalidate();await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await new Promise(r=>setTimeout(r,200));await fs.writeFile(path.join(out,name),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());};
  const saved=()=>js("JSON.parse(localStorage.getItem('synk.shift.workbench.v1'))");
  async function finish(task,wrongId){
    await js(`(()=>{document.getElementById('template').click();const checks=({meeting:[['deadline','wrong','M1'],['approval','unsupported','M2'],['missing','missing','M3']],research:[['ratio','wrong','R1'],['scope','unsupported','R2'],['effect','unsupported','R3']]})[${JSON.stringify(task)}];for(const [id,kind,source]of checks){for(const [field,value]of [['kind',id===${JSON.stringify(wrongId)}?'match':kind],['source',source]]){const e=document.querySelector('[data-check='+id+'][data-field='+field+']');e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}}document.getElementById('check').click();const draft=document.getElementById('draft');draft.value='제공된 가상 자료의 수치와 범위를 직접 대조했습니다. 승인되지 않은 내용과 추가 확인할 항목은 명확하게 구분해 작성합니다.';draft.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('reviewed').click();document.getElementById('complete').click();})()`);
    check(task+' actual form completed',await js("!document.getElementById('result').hidden"));
  }
  await win.loadURL('http://127.0.0.1:4293/');await ready();
  await js("document.getElementById('goal').value='work';document.getElementById('minutes').value='10';document.getElementById('save-choice').click();document.getElementById('setup-form').requestSubmit()");
  let snapshot=await saved();check('decision and actual DOM exposure have separate records',snapshot.evaluation.decisions.length===1&&snapshot.evaluation.exposures.length===1&&snapshot.evaluation.outcomes.length===0);
  await finish('meeting','missing');
  await js("document.getElementById('next').click()");
  check('next button offers a task containing the missed check',await js("document.querySelector('input[name=task]:checked').value==='planning'"));
  await js("document.querySelector('input[name=task][value=research]').click();document.getElementById('setup-form').requestSubmit()");
  await finish('research',null);
  await js("document.getElementById('next').click();document.querySelector('input[name=task][value=planning]').click();document.getElementById('goal').value='clarity';document.getElementById('minutes').value='5';document.getElementById('setup-form').requestSubmit();document.querySelector('.practice-basis').open=true");
  snapshot=await saved();
  check('unobserved completeness need changes the actual first question',snapshot.run.checkIds[0]==='criteria'&&await js("document.querySelector('.review-item legend').textContent.includes('성공 기준')||document.querySelector('.review-item legend').textContent.includes('업무 완료 기준')"));
  check('displayed explanation and Core decision cite the same original evidence',snapshot.run.focusDecision.selected.id==='criteria'&&await js("document.querySelector('.practice-basis').textContent.includes('회의를 실행으로')&&document.querySelector('.recommendation').textContent.includes('누락·성공 기준')"));
  check('only actually displayed sessions receive outcomes',snapshot.evaluation.decisions.length===3&&snapshot.evaluation.exposures.length===3&&snapshot.evaluation.outcomes.length===2);
  const report=await js("import('/model.mjs').then(m=>{const s=JSON.parse(localStorage.getItem('synk.shift.workbench.v1'));return m.practiceEvaluation(s,SynkTemperOutcomes,new Date(Date.now()+86400001).toISOString())})");
  check('scripted local history cannot claim a measured policy improvement',report.comparison.direction==='unknown'&&report.causalClaim===false&&report.policyPromotion===false);
  await shot('personalized-desktop.png');
  for(const width of [320,390]){win.setContentSize(width,950);await new Promise(r=>setTimeout(r,150));const size=await js('({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})');check('no horizontal overflow '+width,size.scroll<=size.client,size);await shot('personalized-'+width+'.png');}
  await win.reload();await new Promise(r=>win.webContents.once('did-finish-load',r));await ready();snapshot=await saved();
  check('saved evidence and display record restore without duplicating exposure',snapshot.run.checkIds[0]==='criteria'&&snapshot.evaluation.exposures.length===3&&await js("document.querySelector('.practice-basis').textContent.includes('회의를 실행으로')"));
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({at:new Date().toISOString(),kind:'scripted-local-ui-verification',productionEffectMeasured:false,results,decision:snapshot.run.focusDecision,evaluation:report},null,2));
  console.log(JSON.stringify({ok:true,passed:results.length,out}));win.destroy();app.exit(0);
}
run().catch(async e=>{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify({error:e.stack,results},null,2));console.error(e);if(win&&!win.isDestroyed())win.destroy();app.exit(1);});
