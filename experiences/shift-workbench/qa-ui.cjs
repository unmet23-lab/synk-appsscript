/* Local UI smoke. Uses an isolated temporary Electron profile, never a user's storage. */
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const out=path.join(__dirname,'qa','20261002');
let win;const results=[];
const check=(name,ok,detail)=>{results.push({name,ok:!!ok,detail});if(!ok)throw new Error(name+': '+JSON.stringify(detail));};
async function run(){
  app.setPath('userData',await fs.mkdtemp(path.join(os.tmpdir(),'synk-shift-qa-')));
  await app.whenReady();await fs.mkdir(out,{recursive:true});
  win=new BrowserWindow({show:false,width:1280,height:850,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  const js=code=>win.webContents.executeJavaScript(code,true);
  const ready=async()=>{for(let i=0;i<60;i++){if(await js("document.documentElement.dataset.ready==='true'"))return;await new Promise(r=>setTimeout(r,100));}throw new Error('ready timeout');};
  const shot=async(name)=>{win.webContents.invalidate();await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');await new Promise(r=>setTimeout(r,350));await fs.writeFile(path.join(out,name),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());};
  const fit=async(label)=>{const v=await js('({width:innerWidth,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})');check(label,v.scroll<=v.client,v);};
  await win.loadURL('http://127.0.0.1:4293/');await ready();
  for(const width of [320,390,1280]){win.setContentSize(width,850);await new Promise(r=>setTimeout(r,100));await fit('setup no horizontal overflow '+width);if(width===320)await shot('setup-320.png');}
  const fonts=await js("document.fonts.ready.then(()=>({suit:document.fonts.check('500 16px SUIT'),latin:document.fonts.check('500 16px InterTight'),mono:document.fonts.check('500 12px DMMono')}))");check('actual brand fonts load',Object.values(fonts).every(Boolean),fonts);
  await js("document.getElementById('save-choice').click();document.getElementById('setup-form').requestSubmit()");
  check('first recommendation does not claim prior evidence',await js("document.querySelector('.recommendation').textContent.includes('아직 이전 검토 기록은 없어요.')"));
  await js("document.getElementById('template').click();const p=document.getElementById('prompt');p.value+=' <img data-injected=1 src=x onerror=alert(1)>';p.dispatchEvent(new Event('input',{bubbles:true}));for(const [id,kind,source]of [['deadline','wrong','M1'],['approval','unsupported','M2']]){for(const [field,value]of [['kind',kind],['source',source]]){const e=document.querySelector('[data-check='+id+'][data-field='+field+']');e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}}document.getElementById('check').click()");
  check('review displays source explanation',await js("document.querySelectorAll('.review-answer').length===2"));
  win.setContentSize(320,850);await fit('practice no horizontal overflow 320');
  await js("const d=document.getElementById('draft');d.value='지안은 10월 8일까지 안내 초안을 작성합니다. 80만 원 예산은 승인 대기입니다. 도윤은 10월 6일까지 접근성 검토 항목을 전달합니다. <img data-injected=1 src=x>';d.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('reviewed').click();document.getElementById('complete').click()");
  check('real form completes at 2/2',await js("!document.getElementById('result').hidden&&document.querySelector('.score strong').textContent==='2 / 2'"));
  check('user HTML stays text',await js("document.querySelector('[data-injected]')===null&&document.getElementById('finished-draft').value.includes('<img')"));
  await fit('result no horizontal overflow 320');await shot('result-320.png');
  win.setContentSize(1280,850);await new Promise(r=>setTimeout(r,100));await shot('result-xss-test.png');
  await win.reload();await new Promise(r=>win.webContents.once('did-finish-load',r));await ready();
  check('reload restores completed run and edited draft',await js("!document.getElementById('result').hidden&&document.getElementById('finished-draft').value.includes('10월 8일')&&document.getElementById('history-count').textContent==='1'"));
  await js("document.getElementById('history-open').click()");check('history does not execute stored HTML',await js("!document.getElementById('history').hidden&&document.querySelector('[data-injected]')===null&&document.querySelector('.history-row').textContent.includes('<img')"));
  await js("document.getElementById('reset').click();document.getElementById('reset-confirm').click()");check('reset removes saved data and UI history',await js("localStorage.getItem('synk.shift.workbench.v1')===null&&!document.getElementById('setup').hidden&&document.getElementById('history-count').textContent==='0'"));
  await js("document.getElementById('setup-form').requestSubmit()");check('without opt in no persistent storage is created',await js("localStorage.getItem('synk.shift.workbench.v1')===null"));
  await js("window.qaErrors=[];window.addEventListener('error',e=>qaErrors.push(e.message));Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Denied','SecurityError')}});document.getElementById('template').click();for(const [id,kind,source]of [['deadline','wrong','M1'],['approval','unsupported','M2']]){for(const [field,value]of [['kind',kind],['source',source]]){const e=document.querySelector('[data-check='+id+'][data-field='+field+']');e.value=value;e.dispatchEvent(new Event('change',{bubbles:true}));}}document.getElementById('check').click();const d=document.getElementById('draft');d.value='지안은 10월 8일까지 안내 초안을 작성합니다. 80만 원 예산은 승인 대기입니다. 도윤은 10월 6일까지 접근성 검토 항목을 전달합니다.';d.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('reviewed').click();document.getElementById('complete').click()");
  check('blocked storage getter still permits a complete unsaved practice',await js("!document.getElementById('result').hidden&&qaErrors.length===0"));await shot('result.png');await fs.copyFile(path.join(out,'result.png'),path.join(out,'result-clean.png'));
  await js("document.getElementById('next').click();document.getElementById('save-choice').click();document.getElementById('setup-form').requestSubmit()");check('storage getter failure is visible while practice remains usable',await js("document.getElementById('save-status').textContent.includes('저장하지 못했어요')&&!document.getElementById('practice').hidden&&qaErrors.length===0"));
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify({at:new Date().toISOString(),results},null,2));console.log(JSON.stringify({ok:true,passed:results.length,out}));win.destroy();app.exit(0);
}
run().catch(async e=>{await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'report.json'),JSON.stringify({error:e.stack,results},null,2));console.error(e);if(win&&!win.isDestroyed())win.destroy();app.exit(1);});
