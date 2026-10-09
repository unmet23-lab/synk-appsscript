/* Two isolated browsers, actual approved Typecast files, actual AudioContext playback.
   No fixture voices, no skipped tutorials, no server-only completion shortcuts. */
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const NM=process.env.SYNK_QA_NODE_MODULES||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const {chromium}=require(require.resolve('playwright',{paths:[NM]}));
const OUT=require('node:path').join(process.cwd(),'experiences/spaceship-coop/qa/return-recall-20261009/full-coop'),checks=[],errors=[];let browser,server;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const check=(name,value)=>{assert.ok(value,name);checks.push({name,passed:true});};
async function shot(page,name){await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:path.join(OUT,name+'.png'),fullPage:true});const expected=page.viewportSize().width;check(name+' fits horizontally',await page.evaluate(w=>document.documentElement.scrollWidth<=w&&innerWidth<=w,expected));}
async function snapshot(page){return page.evaluate(async()=>{const s=JSON.parse(sessionStorage.getItem('synk-spaceship-session'));return(await fetch('/api/spaceship/rooms/'+s.code+'/state',{headers:{Authorization:'Bearer '+s.token}})).json();});}
async function waitAudio(page,before){await page.waitForFunction(n=>window.__audio.ends>n,before,{timeout:9000});}
async function voiceEnds(page){return page.evaluate(()=>window.__audio.ends);}
async function teach(page){
  const words=await page.locator('[data-action="study"]').evaluateAll(nodes=>nodes.map(n=>n.dataset.word));
  for(const [index,word] of words.entries()){const before=await voiceEnds(page);await page.locator(`[data-action="study"][data-word="${word}"]`).focus();await page.keyboard.press(index%2?'Space':'Enter');await waitAudio(page,before);await page.locator(`[data-action="study"][data-word="${word}"].learned:not(:disabled)`).waitFor();}
  check('word practice restores keyboard focus',await page.evaluate(()=>document.activeElement?.dataset.action==='study'));
  await page.locator('[data-action="ready"]:not(:disabled)').click();
}
(async()=>{
  try{
    const {createServer}=await import(pathToFileURL(path.join(process.cwd(),'experiences/spaceship-coop/server.mjs')).href);server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/experiences/spaceship-coop/`;
    browser=await chromium.launch({headless:true,channel:'chrome'});
    const failureContext=await browser.newContext();const failure=await failureContext.newPage();let createdBeforeApproval=0;
    failure.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/spaceship/rooms'))createdBeforeApproval++;});
    await failure.route('**/assets/audio/manifest.json',async route=>{const response=await route.fetch(),data=await response.json();data.approved=false;await route.fulfill({json:data});});
    await failure.goto(base);await failure.locator('[data-action="create"]').click();await failure.locator('.error').waitFor();check('unapproved audio blocks room creation',createdBeforeApproval===0);await failure.unroute('**/assets/audio/manifest.json');
    await failure.route('**/assets/audio/red.mp3',route=>route.fulfill({status:200,contentType:'audio/mpeg',body:Buffer.from('corrupted')}));
    await failure.reload();await failure.locator('[data-action="create"]').click();await failure.locator('.error').waitFor();check('corrupt voice cannot silently start',createdBeforeApproval===0);await failureContext.close();
    const desktop=await browser.newContext({viewport:{width:1440,height:1000}}),mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
    for(const context of[desktop,mobile])await context.addInitScript(()=>{
      window.__audio={starts:0,ends:0,durations:[],states:[]};window.__restoredFromCache=false;addEventListener('pageshow',e=>{window.__restoredFromCache=e.persisted;});const Native=window.AudioContext;
      window.AudioContext=class extends Native{createBufferSource(){const source=super.createBufferSource(),original=source.start;source.start=function(...args){if(this.buffer){window.__audio.starts++;window.__audio.durations.push(this.buffer.duration);window.__audio.states.push(this.context.state);this.addEventListener('ended',()=>{window.__audio.ends++;});}return original.apply(this,args);};return source;}};
    });
    const a=await desktop.newPage(),b=await mobile.newPage();for(const p of[a,b]){p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});}
    await a.goto(base);await shot(a,'lobby-desktop');await b.goto(base);await shot(b,'lobby-phone');
    await a.locator('[data-action="create"]').click();await a.locator('.room-code').waitFor();const code=(await a.locator('.room-code').textContent()).trim();
    await a.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('Clipboard blocked for QA'))}}));
    await a.locator('[data-action="copy-code"]').click();await a.locator('#copy-dialog[open]').waitFor();check('blocked clipboard selects the code, not the link',await a.locator('#copy-value').inputValue()===code);await a.keyboard.press('Escape');
    await a.locator('[data-action="copy-link"]').click();await a.locator('#copy-dialog[open]').waitFor();check('blocked clipboard offers the invite URL',(await a.locator('#copy-value').inputValue()).endsWith('?room='+code));await a.keyboard.press('Escape');
    await a.locator('#world-link').click();await a.locator('#leave-dialog[open]').waitFor();await a.locator('[data-dialog="cancel"]').click();check('hub navigation can be cancelled without ending the expedition',(await snapshot(a)).phase==='lobby');
    await b.locator('#room-input').fill(code);await b.locator('#join-form button').click();await b.locator('.room-code').waitFor();
    await a.locator('[data-action="ready"]:not(:disabled)').click();await b.locator('[data-action="ready"]:not(:disabled)').click();
    await a.locator('[data-action="study"]').first().waitFor();check('shop stays out of cooperative listening turns',await a.locator('#ship-shop-open').isHidden());await shot(b,'tutorial-phone');
    for(let round=0;round<18;round++){
      const s=await snapshot(a);
      if(s.phase==='tutorial'){await teach(a);await teach(b);}
      const nav=round%2===0?a:b,pilot=round%2===0?b:a;
      await nav.locator('[data-action="signal"]').first().waitFor();await pilot.locator('.waiting-signal').waitFor();
      const n=await snapshot(nav),p=await snapshot(pilot);check('round '+round+' isolated target',!!n.target&&!('target'in p));
      if(round===0){await shot(a,'manual-desktop');await shot(b,'controls-phone-waiting');}
      if(round===1){
        await pilot.reload({waitUntil:'domcontentloaded'});await nav.locator('.paused').waitFor();await shot(nav,'partner-disconnected');
        await pilot.locator('[data-action="resume"]').click();await pilot.locator('.waiting-signal').waitFor();check('refresh resumes own slot',(await snapshot(pilot)).slot===p.slot);
        await pilot.goto('about:blank');await nav.locator('.paused').waitFor();await pilot.goBack({waitUntil:'domcontentloaded'});
        const cached=await pilot.evaluate(()=>window.__restoredFromCache===true);if(!cached)await pilot.locator('[data-action="resume"]').click();
        await pilot.locator('.waiting-signal').waitFor();await nav.waitForFunction(()=>!document.querySelector('.paused'));
        check('back navigation reconnects the same expedition',(await snapshot(pilot)).slot===p.slot);checks.push({name:'back navigation restoration mode',persisted:cached,passed:true});
        await pilot.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await nav.locator('.paused').waitFor();
        await pilot.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await nav.waitForFunction(()=>!document.querySelector('.paused'));
        check('persisted page lifecycle events reconnect the live stream',(await snapshot(pilot)).slot===p.slot);
      }
      if(round===0){
        const wrong=n.stage.words.find(x=>x!==n.target),before=await voiceEnds(pilot);await nav.locator(`[data-action="signal"][data-word="${wrong}"]`).click();await waitAudio(pilot,before);
        await pilot.locator(`[data-action="act"][data-word="${wrong}"]`).click();await pilot.locator('.feedback:not(.good)').waitFor();
        check('matching wrong instruction is distinguished',(await pilot.locator('.feedback').textContent()).includes('들은 소리대로'));
        await pilot.locator('[data-action="help"]').click();await pilot.locator('.help-sheet').waitFor();await shot(pilot,'help-phone');await pilot.locator('[data-action="close-help"]').focus();await pilot.keyboard.press('Enter');check('closing the sound guide returns keyboard focus',await pilot.evaluate(()=>document.activeElement?.dataset.action==='help'));
      }
      const before=await voiceEnds(pilot),starts=await pilot.evaluate(()=>window.__audio.starts);if(round===0)await nav.keyboard.press(String(n.stage.words.indexOf(n.target)+1));else await nav.locator(`[data-action="signal"][data-word="${n.target}"]`).click();
      if(round===0){
        await pilot.waitForFunction(n=>window.__audio.starts>n,starts);await pilot.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});await waitAudio(pilot,before);
        check('visibility event interrupts audio and keeps answers locked',await pilot.locator('[data-action="act"]').evaluateAll(nodes=>nodes.every(x=>x.disabled)));
        await pilot.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});check('returning requires hearing the whole sound again',await pilot.locator('[data-action="act"]').evaluateAll(nodes=>nodes.every(x=>x.disabled)));
        const interruptedEnd=await voiceEnds(pilot);await pilot.locator('[data-action="replay"]').click();await waitAudio(pilot,interruptedEnd);
      }
      if(round===1){await pilot.locator('[data-action="replay"]').waitFor();check('answers locked during actual voice',await pilot.locator('[data-action="act"]').evaluateAll(nodes=>nodes.every(x=>x.disabled)));}
      await waitAudio(pilot,before);
      if(round===0){const beforeReplay=await voiceEnds(pilot);await pilot.locator('[data-action="replay"]').click();await waitAudio(pilot,beforeReplay);}
      if(n.stage.id==='count'){
        const number={one:1,two:2,three:3}[n.target];for(let j=0;j<number;j++)await pilot.locator('[data-action="pump"]').click();
        if(round===12)await shot(pilot,'fuel-phone');await pilot.locator('[data-action="submit-count"]').click();
      }else if(round===0){await pilot.keyboard.press(String(n.stage.words.indexOf(n.target)+1));}else{await pilot.locator(`[data-action="act"][data-word="${n.target}"]`).click();}
      await pilot.locator('.feedback.good').waitFor();if(round===0)await shot(pilot,'repair-phone');if(round===6)await shot(pilot,'antenna-phone');
      if(round===0)check('successful repair moves keyboard focus to the next action',await pilot.evaluate(()=>document.activeElement?.dataset.action==='next'));
      if(round===0)await pilot.keyboard.press('Enter');else await pilot.locator('[data-action="next"]').click();
    }
    await a.locator('[data-action="launch"]').waitFor();await b.locator('[data-action="launch"]').waitFor();await shot(b,'launch-phone');
    await b.evaluate(()=>{window.__starbookSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='SYNK_SHIP_STARBOOK_V1')throw new Error('quota');return window.__starbookSet.call(this,k,v);};});
    await a.locator('[data-action="launch"]').click();check('one launch click does not finish',(await snapshot(a)).phase==='launch');await b.locator('[data-action="launch"]').click();
    await a.locator('[data-action="review"]').waitFor();await b.locator('[data-action="review"]').waitFor();await pause(1900);await shot(a,'complete-desktop');await shot(b,'complete-phone');
    check('shared launch awards exactly 15 finish coins on each browser',await a.evaluate(async()=>(await SynkPlayCollection.load()).coins===15)&&await b.evaluate(async()=>(await SynkPlayCollection.load()).coins===15));
    check('record storage failure offers retry without blocking launch',await b.locator('[data-book-save-retry]').count()===1);await b.evaluate(()=>Storage.prototype.setItem=window.__starbookSet);await b.locator('[data-book-save-retry]').click();await b.waitForFunction(()=>JSON.parse(localStorage.getItem('SYNK_SHIP_STARBOOK_V1')||'[]').length===1);check('record retry saves the actual expedition',await b.evaluate(()=>JSON.parse(localStorage.getItem('SYNK_SHIP_STARBOOK_V1')).length===1));
    check('completed record is saved without tokens or invite codes',await a.evaluate(()=>{const rows=JSON.parse(localStorage.getItem('SYNK_SHIP_STARBOOK_V1'));return rows.length===1&&rows[0].records.length===18&&Object.keys(rows[0]).join(',')==='expeditionId,completedAt,records';}));
    const result=await snapshot(b);check('all eighteen repaired',result.summary.repaired===18);check('replay and help tracked separately',result.summary.teamReplays===2&&result.summary.teamHelp===1);
    await a.locator('[data-book-open]').first().click();await a.locator('#starbook[open]').waitFor();check('non-owner can read the expedition and all seven sounds',await a.locator('.starbook-basic').count()===1&&await a.locator('[data-book-action="listen"]').count()===7&&await a.locator('.starbook-map').count()===0);const freeBefore=await voiceEnds(a);await a.locator('[data-book-action="listen"][data-word="red"]').click();await waitAudio(a,freeBefore);await a.keyboard.press('Escape');
    await a.locator('#ship-shop-open').click();await a.locator('[data-shop-item="ship-keepsake-starbook"]').click();check('starbook preview explicitly marks its example',(await a.locator('.starbook-preview').textContent()).includes('예시 / Example'));await a.locator('[data-shop-action="goal"]').click();await a.waitForFunction(()=>document.querySelector('#ship-shop .shop-goal')?.textContent.includes('15 more'));check('actual finish leaves the goal 15 coins away',true);await a.keyboard.press('Escape');check('result shows the selected collection goal',(await a.locator('#main .shop-goal').textContent()).includes('15 more'));
    // QA adds a clearly seeded 15-coin earlier balance; this run itself earned exactly 15.
    await a.evaluate(async()=>{const w=await SynkPlayCollection.load();w.coins+=15;w.totalEarned+=15;await SynkPlayCollection.save(w);});await a.locator('#ship-shop-open').click();await a.locator('[data-shop-item="ship-keepsake-starbook"]').click();await a.locator('[data-shop-action="buy"]').click();await a.locator('#starbook[open]').waitFor();await a.locator('#starbook .constellation').first().waitFor();check('purchase immediately opens three actual six-star constellations',await a.locator('.starbook-map .constellation').count()===3&&await a.locator('.starbook-map svg image').count()===18);check('30 coins buys ownership without changing ship equipment',await a.evaluate(async()=>{const w=await SynkPlayCollection.load();return w.coins===0&&w.owned.includes('ship-keepsake-starbook')&&w.equipped['ship-sky']==='default'&&w.equipped['ship-badge']==='sparkle';}));const downloadEvent=a.waitForEvent('download');await a.locator('[data-book-action="download"]').click();await a.locator('[data-book-action="save-png"]').click();const keepsake=await downloadEvent;await keepsake.saveAs(path.join(OUT,'starbook-actual.png'));const png=fs.readFileSync(path.join(OUT,'starbook-actual.png'));check('actual keepsake PNG is 1200 by 1050',png.readUInt32BE(16)===1200&&png.readUInt32BE(20)===1050);await a.evaluate(()=>{window.__realBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(cb){cb(null);};});await a.locator('[data-book-action="download"]').click();await a.waitForFunction(()=>document.querySelector('#starbook-note')?.textContent.includes('Could not create'));check('PNG failure preserves the actual collection and offers retry',await a.evaluate(()=>JSON.parse(localStorage.getItem('SYNK_SHIP_STARBOOK_V1')).length===1));await a.evaluate(()=>HTMLCanvasElement.prototype.toBlob=window.__realBlob);await a.locator('[data-book-index="0"]').click();await a.screenshot({path:path.join(OUT,'starbook-desktop.png'),fullPage:true});await a.setViewportSize({width:320,height:740});await a.locator('#starbook').evaluate(n=>n.scrollTop=0);await a.screenshot({path:path.join(OUT,'starbook-320.png')});check('starbook at 320 has no horizontal overflow',await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('#starbook').scrollWidth<=document.querySelector('#starbook').clientWidth));await a.keyboard.press('Escape');await a.setViewportSize({width:1440,height:1000});check('the non-owning friend remains on the same completed expedition',(await snapshot(b)).phase==='complete'&&await b.evaluate(async()=>!(await SynkPlayCollection.load()).owned.includes('ship-keepsake-starbook')));check('collected goal remains and offers immediate use',(await a.locator('#main .shop-goal').textContent()).includes('Collected'));
    await b.locator('[data-action="review"]').click();await b.locator('[data-action="recall-answer"]').first().waitFor();await shot(b,'recall-phone');
    for(let i=0;i<3;i++){
      await b.locator('[data-action="recall-answer"]:not(:disabled)').first().waitFor();check('solo recall '+i+' keeps listening focus after audio',await b.evaluate(()=>document.activeElement?.dataset.action==='recall-listen'));
      if(i===0){const before=await voiceEnds(b);await b.keyboard.press('Enter');await waitAudio(b,before);check('solo replay keeps keyboard focus',await b.evaluate(()=>document.activeElement?.dataset.action==='recall-listen'));}
      await b.keyboard.press('Tab');check('solo recall '+i+' reaches an answer by Tab',await b.evaluate(()=>document.activeElement?.dataset.action==='recall-answer'));await b.keyboard.press('Space');
      check('solo recall '+i+' focuses the next action',await b.evaluate(()=>document.activeElement?.dataset.action==='recall-next'));await b.keyboard.press('Enter');
    }
    await b.locator('[data-action="back-result"]').waitFor();check('three solo recall prompts complete',true);
    check('completed recall focuses the return action',await b.evaluate(()=>document.activeElement?.dataset.action==='back-result'));await b.keyboard.press('Enter');check('returning to the result focuses solo recall',await b.evaluate(()=>document.activeElement?.dataset.action==='review'));await b.emulateMedia({reducedMotion:'reduce'});await b.setViewportSize({width:320,height:640});await shot(b,'complete-320-reduced');
    check('completed and solo recall screens link to beginner games',await b.locator('a.more-games[href="/learning-hub/#beginner-title"]').count()===1);
    await a.locator('[data-action="new"]').click();await a.locator('[data-action="create"]').waitFor();check('new expedition focuses the creation action',await a.evaluate(()=>document.activeElement?.dataset.action==='create'));await b.locator('[data-action="review"]').waitFor();check('a new expedition preserves the friend’s completed result',(await snapshot(b)).phase==='complete');
    const audioA=await a.evaluate(()=>window.__audio),audioB=await b.evaluate(()=>window.__audio);check('approved Korean audio actually played',audioA.ends>=18&&audioB.ends>=18);check('all audio contexts were running',[...audioA.states,...audioB.states].every(x=>x==='running'));
    await a.reload({waitUntil:'domcontentloaded'});await a.locator('[data-book-open]').first().click();await a.locator('#starbook[open] .starbook-map').waitFor();check('owned starbook and the completed expedition survive reload',await a.evaluate(()=>JSON.parse(localStorage.getItem('SYNK_SHIP_STARBOOK_V1')).length===1));await a.keyboard.press('Escape');
    await b.reload({waitUntil:'domcontentloaded'});await b.locator('[data-action="resume"]').click();await b.locator('[data-action="review"]').waitFor();await b.waitForFunction(()=>document.querySelector('#ship-reward-text')?.textContent.includes('already collected'));check('resuming the same completed expedition does not duplicate the starbook',await b.evaluate(()=>JSON.parse(localStorage.getItem('SYNK_SHIP_STARBOOK_V1')).length===1));check('completed expedition reload cannot award coins again',await b.evaluate(async()=>(await SynkPlayCollection.load()).coins===15));
    check('no browser errors',errors.length===0);fs.writeFileSync(path.join(OUT,'ui-results.json'),JSON.stringify({at:new Date().toISOString(),checks,errors,audio:{desktop:audioA,mobileSinceResume:audioB},result},null,2));console.log(JSON.stringify({passed:checks.length,errors,repairCount:result.summary.repaired,audioEnds:[audioA.ends,audioB.ends]}));
  }catch(e){fs.writeFileSync(path.join(OUT,'ui-failure.json'),JSON.stringify({at:new Date().toISOString(),checks,errors,error:e.stack},null,2));console.error(e);process.exitCode=1;}
  finally{await browser?.close();server?.closeGame();if(server)await new Promise(r=>server.close(r));}
})();
