import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=fileURLToPath(new URL('.',import.meta.url));
const output=path.join(root,'qa/interview-flow');
const base=process.env.PATH_INTERVIEW_QA_URL||'http://127.0.0.1:4293';
await mkdir(output,{recursive:true});
const checks=[],errors=[],consoleErrors=[],external=[],failures=[],failedRequests=[];
const check=(name,ok,detail)=>{const item={name,ok:!!ok,...(detail===undefined?{}:{detail})};checks.push(item);console.log(JSON.stringify(item));};
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>{
  const observed=[];window.__pathQaAudio=observed;
  const original=AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start=function(...args){
    const record={duration:this.buffer?.duration||0,loop:this.loop,contextState:this.context.state,startedAt:performance.now(),endedAt:null};
    observed.push(record);this.addEventListener('ended',()=>{record.endedAt=performance.now();},{once:true});
    return Reflect.apply(original,this,args);
  };
});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'){consoleErrors.push(m.text());console.log('BROWSER ERROR: '+m.text());}});
page.on('response',r=>{if(r.status()>=400){const item={url:r.url(),status:r.status()};failedRequests.push(item);console.log('HTTP ERROR: '+JSON.stringify(item));}});
page.on('requestfailed',r=>{const item={url:r.url(),error:r.failure()?.errorText};failedRequests.push(item);console.log('REQUEST ERROR: '+JSON.stringify(item));});
page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
const state=()=>page.evaluate(()=>window.pathInterviewDiagnostics?.());
const phase=(wanted,turn)=>page.waitForFunction(({wanted,turn})=>{const s=window.pathInterviewDiagnostics?.();return s?.phase===wanted&&(turn===undefined||s.turn===turn);},{wanted,turn},{timeout:35000});
const shot=name=>page.screenshot({path:path.join(output,`${name}.png`),fullPage:true});
async function start({double=false}={}){
  if(double){const r=await page.locator('#text-preview').boundingBox();await page.mouse.dblclick(r.x+r.width/2,r.y+r.height/2);}
  else await page.click('#text-preview');
  await phase('listening',1);
}
async function submit(text,{double=false}={}){
  await page.fill('#text-answer',text);
  if(double){const r=await page.locator('#text-answer-form button').boundingBox();await page.mouse.dblclick(r.x+r.width/2,r.y+r.height/2);}
  else await page.click('#text-answer-form button');
}
async function reset(){
  const s=await state();
  if(s?.paused)await page.click('#quit');
  else if(s?.phase==='reflection')await page.click('#restart');
  else if(s?.phase!=='idle')await page.click('#end');
  await phase('idle');
}
async function run(name,fn){
  try{await fn();}
  catch(error){failures.push({name,error:error.message,state:await state()});check(name,false,error.message);await shot(`failure-${name}`);try{await reset();}catch{}}
}

try{
  await page.goto(`${base}/interview/`);
  await page.waitForFunction(()=>['true','error'].includes(document.documentElement.dataset.ready),null,{timeout:120000});
  check('scene and all dialogue audio prepared',(await state())?.ready===true,await state());
  check('one actual WebGL canvas',await page.locator('#room canvas').count()===1);
  await shot('desktop-welcome');

  await run('experience-complete',async()=>{
    await start({double:true});
    check('double start reaches the first listening turn',(await state()).turn===1);
    const audio=await page.evaluate(()=>window.__pathQaAudio.filter(s=>!s.loop&&s.duration>5&&s.endedAt));
    check('intro and first question actually played to ended events',audio.length>=2,audio);
    await page.fill('#text-answer','할머니를 돌봤어요. 식사 준비를 도와드렸습니다.');
    await page.click('#pause');check('pause opens a real pause dialog',await page.locator('#pause-dialog').isVisible()&&(await state()).paused);
    const clock=await page.locator('#clock').innerText();await page.waitForTimeout(1100);
    check('pause freezes elapsed time',await page.locator('#clock').innerText()===clock);
    await page.click('#resume');
    check('typed answer survives pause and resume',(await page.inputValue('#text-answer')).includes('할머니'));
    await submit('할머니를 돌봤어요. 식사 준비를 도와드렸습니다.',{double:true});
    check('experience evidence selects experience follow-up',(await state()).branch==='experience',await state());
    await phase('listening',2);await shot('desktop-listening');
    await submit('식사 전에 필요한 물건을 준비하고 어르신께 필요한 도움을 물어봤습니다.');
    await phase('reflection');
    check('exactly two submitted answers appear in reflection',await page.locator('#reflection-body article').count()===3);
    check('reflection preserves first answer',(await page.locator('#reflection-body').innerText()).includes('할머니를 돌봤어요'));
    await shot('desktop-reflection');await reset();
  });

  await run('preparation-negative',async()=>{
    await start();await submit('봉사 경험 이 없 습니다 배우고 싶습니다');
    check('spaced negative experience routes to preparation',(await state()).branch==='preparation',await state());
    await phase('listening',2);await submit('입사 전에 교육을 받고 담당 선생님께 절차를 확인하고 싶습니다.');
    await phase('reflection');
    check('negative experience remains visible as entered',(await page.locator('#reflection-body').innerText()).includes('경험 이 없 습니다'));
    await reset();
  });

  await run('repair-continue',async()=>{
    await start();await submit('잘 모르겠 습니다');
    check('uncertainty asks a repair without classifying',(await state()).phase==='repair'&&(await state()).branch===null);
    await phase('listening',1);await submit('사람을 돕고 싶어서 지원했습니다.');
    check('valid answer after repair uses motivation',(await state()).branch==='motivation');
    await phase('listening',2);await submit('어르신의 이야기를 듣고 필요한 도움이 무엇인지 먼저 물어보고 싶습니다.');
    await phase('reflection');
    const result=await page.locator('#reflection-body').innerText();
    check('repair utterance does not appear as an evaluated answer',!result.includes('모르겠')&&result.includes('사람을 돕고'));
    await reset();
  });

  await run('pause-reset-lifecycle',async()=>{
    await page.click('#text-preview');await phase('intro');await page.click('#pause');
    check('pause during spoken intro enters paused state',(await state()).paused===true);
    await page.waitForTimeout(700);await page.click('#resume');
    check('resume restarts current spoken intro',(await state()).phase==='intro'&&(await state()).paused===false);
    await page.click('#end');await phase('idle');await page.waitForTimeout(8000);
    check('reset cannot be revived by an old speech completion',(await state()).phase==='idle');
  });

  for(const height of [844,640])await run(`mobile-390-${height}`,async()=>{
    await page.setViewportSize({width:390,height});await page.waitForTimeout(400);await shot(`mobile-390-${height}`);
    check(`no horizontal document overflow 390x${height}`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const bounds=await page.locator('#prepare').boundingBox();
    check(`primary action remains inside viewport 390x${height}`,bounds.y>=0&&bounds.y+bounds.height<=height,bounds);
    const card=await page.locator('#welcome').boundingBox();
    check(`entire welcome card is reachable 390x${height}`,card.y>=0&&card.y+card.height<=height,card);
  });
  check('raw answers were not written to browser storage',await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0));
  check('no uncaught page errors',errors.length===0,errors);
  check('no external network requests in the text rehearsal',external.length===0,external);
}catch(error){failures.push({name:'setup',error:error.message});}
finally{
  const audioEvents=await page.evaluate(()=>window.__pathQaAudio||[]).catch(()=>[]);
  await writeFile(path.join(output,'report.json'),JSON.stringify({at:new Date().toISOString(),base,checks,failures,errors,consoleErrors,failedRequests,external,audioEvents,
    hardwareVR:'not-tested',humanListening:'not-performed',scope:'Real headless Chrome WebGL and WebAudio, text entry; no synthetic headset or microphone claims.'},null,2));
  await browser.close();
}
console.log(JSON.stringify({passed:checks.filter(c=>c.ok).length,failed:checks.filter(c=>!c.ok),failures}));
if(failures.length||checks.some(c=>!c.ok))process.exitCode=1;
