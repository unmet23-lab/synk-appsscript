// Real Chromium history navigation on Windows; this is not a phone/device check.
// Supply an installed Playwright module path. Uses ephemeral classroom and browser state.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createLinkedServer} from './linked-server.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.argv[2]||'playwright');
const fixtureBFCache=!process.argv.includes('--no-store');
const output=new URL(`./qa/world-history-${fixtureBFCache?'resume':'no-store'}-20261003.json`,import.meta.url),checks=[],errors=[];
const check=(name,value)=>{checks.push({name,ok:!!value});assert.ok(value,name);};
let browser,server,state;
try{
  server=await createLinkedServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  // The production/local API keeps no-store. Its current Chrome document takes
  // a fresh-load history path. Permit caching of only this fixture HTML response
  // to exercise a real persisted pageshow with exactly the same client bundle.
  if(fixtureBFCache){const request=server.listeners('request')[0];server.removeListener('request',request);
    server.on('request',(req,res)=>{const set=res.setHeader.bind(res);res.setHeader=(name,value)=>set(name,req.url==='/synk-account/local-world.html'&&name.toLowerCase()==='cache-control'?'private, max-age=0':value);void request(req,res);});}
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({channel:'chrome',headless:true,ignoreDefaultArgs:['--disable-back-forward-cache']});
  const teacherContext=await browser.newContext(),worldContext=await browser.newContext({viewport:{width:390,height:844}});
  const teacher=await teacherContext.newPage(),world=await worldContext.newPage();
  world.on('pageerror',error=>errors.push(error.message));
  await teacher.goto(origin+'/#teacher-key='+server.ownerKey);
  await teacher.waitForFunction(()=>document.documentElement.dataset.ready==='true');
  await teacher.locator('#world-learner-name').fill('브라우저 복귀 확인');
  await teacher.locator('#world-link-form button').click();
  const code=await teacher.locator('#world-join-code').inputValue();
  await world.goto(origin+'/synk-account/local-world.html');
  await world.locator('#connection-code').fill(code);await world.locator('#connection-consent').check();
  await world.locator('#local-join-button').click();
  await world.waitForFunction(()=>document.documentElement.dataset.localWorld==='connected'&&typeof window.SYNKLearningHost?.createGame==='function');
  check('world-connected-before-history-navigation',true);
  const before=await world.evaluate(()=>{
    window.__historyResumeMarker=crypto.randomUUID();
    window.addEventListener('pageshow',event=>sessionStorage.setItem('synk.qa.persisted',String(event.persisted)));
    return window.__historyResumeMarker;
  });
  await world.goto(origin+'/api/health');await world.goBack({waitUntil:'commit'});
  await world.waitForTimeout(700);
  state=await world.evaluate(()=>({persisted:sessionStorage.getItem('synk.qa.persisted'),marker:window.__historyResumeMarker,phase:document.documentElement.dataset.localWorld,hasHost:typeof window.SYNKLearningHost?.createGame==='function',classroomVisible:!!document.getElementById('world-classroom')&&!document.getElementById('world-classroom').hidden,overflow:document.documentElement.scrollWidth>innerWidth,notRestoredReasons:performance.getEntriesByType('navigation')[0]?.notRestoredReasons?.toJSON()}));
  check(fixtureBFCache?'actual-back-forward-cache-restoration':'no-store-fresh-history-navigation',fixtureBFCache?state.persisted==='true'&&state.marker===before:state.marker!==before);
  check('restored-world-learning-host-and-classroom',state.phase==='connected'&&state.hasHost&&state.classroomVisible);
  check('390px-restored-document-without-horizontal-overflow',!state.overflow);
  await world.locator('[data-kind="practice"][data-id="reading-detail"]').click();
  for(const [question,value]of [['detail-open','a'],['detail-books','a'],['detail-return','a']])await world.locator(`[data-world-answer="${question}"][value="${value}"]`).check();
  await world.locator('[data-world-submit] button[type="submit"]').click();await world.locator('.wc-result').waitFor();
  check('actual-reading-submit-after-history-return',server.snapshot().practices.length===1&&server.snapshot().learners[0].evidence.filter(row=>row.grading==='server-scored').length===3);
  await teacher.locator('#refresh').click();await teacher.waitForFunction(()=>document.getElementById('student-detail').textContent.includes('0 / 3'));
  check('teacher-receives-history-return-learning',true);
  await world.goto(origin+'/api/health');await teacher.locator('[data-revoke]').click();
  await teacher.waitForFunction(()=>document.getElementById('student-detail').textContent.includes('WORLD 연결 해제'));
  await world.goBack({waitUntil:'commit'});await world.waitForFunction(()=>document.documentElement.dataset.localWorld==='disconnected');
  check('revoked-session-not-resurrected-on-history-return',await world.evaluate(()=>!window.SYNKLearningHost&&document.getElementById('world-classroom').hidden&&!sessionStorage.getItem('synk.local-world.connection.v1')));
  check('no-browser-script-errors',errors.length===0);
  await fs.writeFile(output,JSON.stringify({checkedAt:new Date().toISOString(),ok:true,runtime:`${process.platform}/${process.arch} Chrome ${browser.version()}`,scope:fixtureBFCache?'Actual desktop Chromium BFCache with fixture-only HTML cache header; production/API cache headers unchanged; no Android/iOS device or installed package':'Actual desktop Chromium history return with unmodified no-store server; no Android/iOS device or installed package',checks,errors,state},null,2)+'\n');
  console.log(JSON.stringify({ok:true,checks:checks.length,result:output.pathname}));
}catch(error){
  await fs.writeFile(output,JSON.stringify({checkedAt:new Date().toISOString(),ok:false,checks,errors,state,failure:error.message},null,2)+'\n');
  console.error(error);process.exitCode=1;
}finally{await browser?.close();server?.closeAllConnections();if(server)await new Promise(resolve=>server.close(resolve));}
