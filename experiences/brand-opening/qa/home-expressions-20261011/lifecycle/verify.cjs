const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const output=__dirname;
const checks=[];
const report={scope:'Isolated browser lifecycle checks of the served production createLifeTutor module used by home, not a full home-flow or visual test.',baseline:{capturedBeforeFix:true,method:'Three isolated components with reduced:true and practiceCompleted:true; setActive(false), setActive(true), advance 20000ms.',observed:{marin:'눈웃음',kkamong:'으쓱',mongle:'기쁨'},expected:'기본'},checks};
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const ctx=await browser.newContext({reducedMotion:'no-preference'});
 const networkWrites=[],externalRequests=[],errors=[];
 await ctx.route('**/*',route=>{const req=route.request(),url=new URL(req.url());if(!['GET','HEAD'].includes(req.method())){networkWrites.push(req.method());return route.abort();}if(url.hostname!=='127.0.0.1'){externalRequests.push(url.origin);return route.abort();}if(url.pathname==='/__home-expression-probe')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Isolated home lifecycle QA</title><main></main>'});return route.continue();});
 const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4314/__home-expression-probe');
 await page.clock.install({time:new Date('2026-10-11T00:00:00Z')});
 await page.clock.pauseAt(new Date('2026-10-11T00:00:01Z'));
 await page.evaluate(async()=>{
  Math.random=()=>0;
  const {createLifeTutor}=await import('/brand-opening/life-tutor.mjs');
  const originalAdd=EventTarget.prototype.addEventListener,originalRemove=EventTarget.prototype.removeEventListener;
  const listeners={motion:new Map(),visibility:new Set()};
  EventTarget.prototype.addEventListener=function(type,fn,options){if(this===document&&type==='visibilitychange')listeners.visibility.add(fn);if(this instanceof MediaQueryList&&type==='change'){if(!listeners.motion.has(this))listeners.motion.set(this,new Set());listeners.motion.get(this).add(fn);}return originalAdd.call(this,type,fn,options);};
  EventTarget.prototype.removeEventListener=function(type,fn,options){if(this===document&&type==='visibilitychange')listeners.visibility.delete(fn);if(this instanceof MediaQueryList&&type==='change')listeners.motion.get(this)?.delete(fn);return originalRemove.call(this,type,fn,options);};
  window.probe={spawn(id,{reduced=false,success=false}={}){this.tutor?.dispose();document.querySelector('main').replaceChildren();this.reduced=reduced;this.tutor=createLifeTutor({tutorId:id,container:document.querySelector('main'),state:{scope:'home',practiceCompleted:success},reduced:()=>this.reduced,getExercise:()=>({id:'probe-expression',prompt:'연습',context:'어울리는 표현을 골라요.',choices:[{id:'right',text:'정답'},{id:'wrong',text:'다시'}],answerId:'right',explanation:'새 상황에서 확인했어요.'})});},sample(){return {...this.tutor.metrics(),reduced:this.tutor.element.dataset.reduced,bodyReaction:this.tutor.element.querySelector('.game-tutor-portrait').dataset.reaction||null,connected:this.tutor.element.isConnected,listeners:{motion:[...listeners.motion.values()].reduce((n,s)=>n+s.size,0),visibility:listeners.visibility.size}};},idle(){this.tutor.setActive(false);this.tutor.setActive(true);},hidden(value){Object.defineProperty(document,'hidden',{configurable:true,value});document.dispatchEvent(new Event('visibilitychange'));}};
 });
 const sample=()=>page.evaluate(()=>probe.sample());
 const action=fn=>page.evaluate(fn);
 async function check(id,name,expected){const actual=await sample();for(const[key,value]of Object.entries(expected))assert.deepEqual(actual[key],value,`${id} ${name} ${key}`);checks.push({id,name,expected,actual,passed:true});}
 for(const id of ['marin','kkamong','mongle']){
  const success=id==='marin'?'눈웃음':id==='kkamong'?'으쓱':'기쁨',duration=id==='kkamong'?2800:2300;
  await page.evaluate(id=>probe.spawn(id,{success:true}),id);
  await check(id,'success face and one listener per lifecycle source',{face:success,listeners:{motion:1,visibility:1}});
  await page.clock.runFor(duration-1);await check(id,'success held for configured reaction time',{face:success});
  await page.clock.runFor(1);await check(id,'success returns to baseline without stale body animation',{face:'기본',bodyReaction:null});
  await page.clock.runFor(5600);await check(id,'idle closes approved eyes',{face:'잔잔감음'});
  await page.clock.runFor(130);await check(id,'blink opens after 130ms',{face:'기본'});

  await page.evaluate(id=>probe.spawn(id,{success:true,reduced:true}),id);
  await check(id,'reduced motion preserves authored success feedback',{face:success,reduced:'true'});
  await action(()=>probe.idle());await page.clock.runFor(20000);
  await check(id,'baseline regression fixed: deactivate/reactivate during reduced success',{face:'기본',bodyReaction:null,reduced:'true'});

  await page.evaluate(id=>probe.spawn(id),id);await action(()=>probe.idle());await page.clock.runFor(5600);
  await check(id,'blink before deactivate',{face:'잔잔감음'});
  await action(()=>probe.tutor.setActive(false));await check(id,'deactivation resets closed eyes immediately',{face:'기본'});
  await page.clock.runFor(20000);await check(id,'inactive remains at baseline',{face:'기본'});
  await action(()=>probe.tutor.setActive(true));await page.clock.runFor(5600);await check(id,'reactivation resumes exactly one blink cycle',{face:'잔잔감음'});await page.clock.runFor(130);await check(id,'reactivated blink restores',{face:'기본'});

  await action(()=>probe.idle());await page.clock.runFor(5600);
  await action(()=>{probe.reduced=true;probe.tutor.setActive(true);});await check(id,'manual reduced mode closes pending blink safely',{face:'기본',reduced:'true'});
  await page.clock.runFor(10000);await check(id,'manual reduced mode has no automatic blink',{face:'기본'});
  await action(()=>{probe.reduced=false;probe.tutor.setActive(true);});await page.clock.runFor(5600);await check(id,'manual motion restored resumes blink',{face:'잔잔감음'});
  await page.emulateMedia({reducedMotion:'reduce'});await new Promise(resolve=>setTimeout(resolve,50));await page.clock.runFor(50);await check(id,'OS reduced change clears current blink before normal 130ms reopening',{face:'기본',reduced:'true'});
  await page.clock.runFor(10000);await check(id,'OS reduced mode has no automatic blink',{face:'기본'});
  await page.emulateMedia({reducedMotion:'no-preference'});await new Promise(resolve=>setTimeout(resolve,50));await page.clock.runFor(50);await page.clock.runFor(5600);await check(id,'OS motion restored resumes blink',{face:'잔잔감음'});

  await action(()=>probe.hidden(true));await check(id,'hidden clears closed eyes',{face:'기본'});await page.clock.runFor(10000);await check(id,'hidden has no automatic blink',{face:'기본'});
  await action(()=>probe.hidden(false));await page.clock.runFor(5600);await check(id,'visible resumes blink',{face:'잔잔감음'});

  await action(()=>probe.tutor.openGuide());await check(id,'guide suspends background',{face:'기본',guideOpen:true});await page.clock.runFor(10000);await check(id,'guide keeps background resting',{face:'기본'});
  await page.locator('.life-tutor-resume').click();await check(id,'guide close resets background',{face:'기본',guideOpen:false});await page.clock.runFor(5600);await check(id,'guide close resumes blink',{face:'잔잔감음'});

  await action(()=>probe.tutor.openPractice('probe-expression'));await check(id,'practice suspends background blink',{face:'기본'});await page.clock.runFor(10000);await check(id,'practice keeps background resting',{face:'기본'});
  await page.locator('.life-expression-cancel').click();await check(id,'practice cancel restores base',{face:'기본',practice:null});await page.clock.runFor(5600);await check(id,'practice cancel resumes blink',{face:'잔잔감음'});

  await action(()=>probe.tutor.dispose());await check(id,'dispose removes document and media listeners',{connected:false,listeners:{motion:0,visibility:0},face:'기본'});
  await page.emulateMedia({reducedMotion:'reduce'});await page.clock.runFor(10000);await check(id,'disposed tutor unaffected by later motion event',{connected:false,listeners:{motion:0,visibility:0},face:'기본'});
  await page.emulateMedia({reducedMotion:'no-preference'});await page.clock.runFor(1);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(networkWrites,[]);assert.deepEqual(externalRequests,[]);
 report.final={passed:checks.length,failed:0,errors,networkWrites,externalRequests};
 await ctx.close();await browser.close();
}
main().then(()=>{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.final));}).catch(error=>{report.failure=error.stack;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.error(error);process.exit(1);});
