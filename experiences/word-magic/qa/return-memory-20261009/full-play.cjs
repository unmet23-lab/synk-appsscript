'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const runtime=process.env.SYNK_QA_NODE_MODULES||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=require(require.resolve('playwright',{paths:[runtime]}));
const URL=process.env.MAGIC_URL||'http://127.0.0.1:4316/';
const OUT=path.join(__dirname,'shots');fs.mkdirSync(OUT,{recursive:true});
const views={desktop:{viewport:{width:1440,height:1100}},phone:{viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2},small:{viewport:{width:320,height:568},isMobile:true,hasTouch:true},reduced:{viewport:{width:1280,height:900},reducedMotion:'reduce'}};
async function run(browser,name,view){
 const ctx=await browser.newContext(view),page=await ctx.newPage(),errors=[],shots=[],findings=[],neutralByChapter=new Map();
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 const S=()=>page.evaluate(()=>window.__wordMagic.state());
 async function ready(){await page.waitForFunction(()=>window.__wordMagic&&!window.__wordMagic.state().busy);}
 async function screenshot(label){await page.waitForTimeout(600);const file=`${name}-${label}.png`;await page.screenshot({path:path.join(OUT,file),fullPage:true});shots.push(file);}
 async function fit(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');const controls=await page.locator('#spells button:visible').evaluateAll(nodes=>nodes.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})));assert.ok(controls.every(r=>r.w>=44&&r.h>=44),'touch target');}
 try{
  await page.goto(URL+'?qa');await ready();await screenshot('home');await fit();
  await page.click('#start');await page.waitForFunction(()=>window.__wordMagic.state().screen==='tutorial');
  while((await S()).screen!=='lab'){
   await ready();let s=await S();
   if(s.screen==='tutorial'){
    const ids=await page.locator('#spells button').evaluateAll(ns=>ns.map(n=>n.dataset.spell));for(const id of ids){await page.click(`[data-spell="${id}"]`);await ready();}await screenshot(`teach-${Math.floor(s.sceneIndex/6)}`);await fit();await page.click('#next');
   }else if(s.screen==='puzzle'){
    const moves=await page.evaluate(()=>window.__wordMagic.solution());
    // Wrong explorations change the scene; they must not create listening records.
    if(s.sceneIndex===0){await page.click('[data-spell="grow"]');await ready();await page.click('[data-object="chair"]');assert.equal((await S()).progress.checks.length,0);}
    for(const move of moves){await page.click(`[data-spell="${move.spell}"]`);await ready();await page.click(`[data-object="${move.objectId}"]`);}
    assert.equal((await S()).solved,true,`scene ${s.sceneIndex}`);if([0,3,6,9,12,15,17].includes(s.sceneIndex)){await screenshot(`scene-${s.sceneIndex+1}`);await fit();}await page.click('#next');
   }else if(s.screen==='checkpoint'){
    await page.waitForFunction(()=>window.__wordMagic.state().heard&&!window.__wordMagic.state().busy);s=await S();
    await page.waitForTimeout(900);
    const before=await page.evaluate(()=>({canvas:document.querySelector('#stage').toDataURL(),objects:document.querySelectorAll('#objects button').length,goalHidden:document.querySelector('#goal-view').hidden,choices:[...document.querySelectorAll('#spells button')].map(n=>({id:n.dataset.spell,text:n.textContent,aria:n.getAttribute('aria-label')}))}));
    assert.equal(before.objects,0,'No initial state is visible before answering');assert.equal(before.goalHidden,true);assert.doesNotMatch(JSON.stringify(before.choices),/[가-힣]/,'No Korean spelling in visual or screen-reader choice labels');assert.deepEqual(before.choices.map(x=>x.id),s.check.choices,'Round-fixed shuffled positions');
    if(neutralByChapter.has(s.check.chapter))assert.equal(before.canvas,neutralByChapter.get(s.check.chapter),'Opposite requests must have pixel-identical pre-answer scenes');else neutralByChapter.set(s.check.chapter,before.canvas);
    await page.click('#language');const koreanUI=await page.locator('#spells button').evaluateAll(ns=>ns.map(n=>({id:n.dataset.spell,text:n.textContent,aria:n.getAttribute('aria-label')})));assert.deepEqual(koreanUI,before.choices,'Rerender and Korean UI must not reveal Korean words or reshuffle choices');await page.click('#language');await screenshot(`before-check-${s.check.id}`);
    if(s.check.id==='size-0'){
     const wrong=await page.locator('#spells button').evaluateAll((ns,right)=>ns.map(n=>n.dataset.spell).find(x=>x!==right),s.check.spell);await page.click(`[data-spell="${wrong}"]`);assert.equal((await S()).solved,false);assert.equal((await S()).progress.checks.at(-1).correct,false);await page.click('#replay');await ready();
    }else if(s.check.id==='doors-1'){await page.click('#replay');await ready();}
    await page.click(`[data-spell="${s.check.spell}"]`);assert.equal((await S()).solved,true);assert.equal(await page.locator('#spells .word').count(),2,'Korean words are revealed only after answering');await screenshot(`check-${s.check.id}`);await page.click('#next');
   }else if(s.screen==='ending'){const completedChapter=Math.floor(s.sceneIndex/6)+1;await page.waitForFunction(async expected=>(await SynkPlayCollection.load()).coins===expected,completedChapter*15);if(completedChapter===1){await page.reload();await ready();await page.click('#start');await page.waitForFunction(()=>window.__wordMagic.state().screen==='ending');await page.waitForFunction(()=>document.querySelector('#chapter-coins').textContent.includes('already collected'));assert.equal(await page.evaluate(async()=>(await SynkPlayCollection.load()).coins),15,'Reopening an ending must not pay twice');}await screenshot(`ending-${Math.floor(s.sceneIndex/6)}`);await page.click('#next');}
   else throw Error('Unexpected screen '+s.screen);
  }
  await ready();let s=await S();assert.equal(s.progress.completed.length,18);assert.equal(s.progress.checks.length,6);assert.equal(s.progress.checks.filter(x=>x.correct).length,5);assert.equal(s.progress.checks.find(x=>x.id==='doors-1').assessable,false);findings.push('18 scenes + 6 genuine MP3 checkpoints, one wrong first choice and one assisted answer separated');
  const evidence=await page.evaluate(()=>{const coach=SynkLearning.createGame({gameId:'word-magic',storage:localStorage});return {events:coach.events(),summary:coach.summary()};});const presentations=evidence.events.filter(e=>e.type==='practice.presented'),attempts=evidence.events.filter(e=>e.type==='practice.attempted');assert.equal(presentations.length,6);assert.equal(attempts.length,6);assert.ok(presentations.every(e=>e.measure.skillId==='ko.listening.word'&&e.measure.responseFormat==='action'&&e.itemKey.endsWith('.v2')&&e.measure.familyKey===e.itemKey));const word=evidence.summary.skills.find(s=>s.id==='ko.listening.word').levels[1].formats.action;assert.deepEqual({n:word.n,correct:word.correct,incorrect:word.incorrect,assisted:word.assisted},{n:5,correct:4,incorrect:1,assisted:1});fs.writeFileSync(path.join(__dirname,`atlas-${name}.json`),JSON.stringify(evidence,null,2));findings.push('Six v2 meaning-based Atlas items: 4 independent correct, 1 independent incorrect, 1 assisted; no repeated correction');findings.push('Each opposite pair has pixel-identical neutral pre-answer stage; no Korean choice spelling in either UI language; shuffled positions remain stable on rerender');
  await page.click('[data-spell="grow"]');await ready();await page.click('[data-object="rabbit"]');await page.click('[data-spell="open"]');await ready();await page.click('[data-object="chest"]');await page.click('[data-spell="up"]');await ready();await page.click('[data-object="umbrella"]');await screenshot('lab');await fit();
  await page.click('#photo');const dl=page.waitForEvent('download');await page.click('#photo-download');const download=await dl;const target=path.join(OUT,`${name}-saved-photo.png`);await download.saveAs(target);const bytes=fs.readFileSync(target);assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.equal(bytes.readUInt32BE(16),960);assert.equal(bytes.readUInt32BE(20),612);findings.push('PNG download 960 × 612, actual transformed scene');await page.click('#close-photo');
  await page.click('#home');await page.reload();await ready();assert.equal((await S()).progress.completed.length,18);await page.click('#open-lab');await page.waitForFunction(()=>window.__wordMagic.state().screen==='lab');s=await S();assert.equal(s.objects.find(o=>o.id==='rabbit').size,1.55);assert.equal(s.objects.find(o=>o.id==='chest').open,true);assert.equal(s.objects.find(o=>o.id==='umbrella').level,1);findings.push('Reload restores 18/18 and free-play state');
  await page.click('#home');await page.click('#pause-home');await page.click('#reset');await page.click('#cancel-reset');assert.equal((await S()).progress.completed.length,18);
  await page.click('#preview');await page.waitForFunction(()=>window.__wordMagic.state().screen==='tutorial');assert.equal((await S()).preview,true);await page.click('#home');await page.click('#pause-home');assert.equal((await S()).progress.completed.length,18);findings.push('Picture preview has separate unsaved progress; reset cancellation preserves progress');
  assert.equal(await page.evaluate(async()=>(await SynkPlayCollection.load()).coins),50,'Three unique adventure rewards and one genuine free-play practice reward; no preview reward');findings.push('Actual play earns 15 completion coins per chapter once; reload of ending and picture preview never duplicate the shared reward');
  assert.equal(errors.length,0,errors.join('\n'));
  return {name,pass:true,errors,findings,shots};
 }catch(e){await screenshot('failure');return {name,pass:false,error:String(e.stack||e),errors,findings,shots};}finally{await ctx.close();}
}
(async()=>{const browser=await chromium.launch({channel:'chrome',headless:true});const pick=process.argv[2],results=[];for(const [name,view]of Object.entries(views)){if(pick&&name!==pick)continue;const r=await run(browser,name,view);results.push(r);console.log(`${name}: ${r.pass?'PASS':'FAIL'} ${r.error||''}`);}await browser.close();fs.writeFileSync(path.join(__dirname,`play-${pick||'all'}.json`),JSON.stringify({at:new Date().toISOString(),url:URL,results},null,2));process.exitCode=results.some(x=>!x.pass)?1:0;})().catch(e=>{console.error(e);process.exitCode=1;});
