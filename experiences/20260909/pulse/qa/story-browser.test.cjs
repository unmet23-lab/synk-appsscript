const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const canonical='C:/Users/q1212/Documents/SYNK-appsscript';
const {createExperienceServer}=require(path.join(canonical,'experiences/20260909/server.cjs'));
const staticRoot=path.resolve(__dirname,'../..');
const screenshots=path.join(os.tmpdir(),'pulse-story-20260910');fs.mkdirSync(screenshots,{recursive:true});
const checks=[];let app,browser;
const phase=(p,v)=>p.waitForFunction(v=>document.querySelector('#experience').dataset.phase===v,v);
const check=(name)=>{checks.push(name);console.log('PASS '+name);};
async function keyButton(p,locator){for(let i=0;i<100;i++){if(await locator.isDisabled()){await p.waitForTimeout(25);continue;}if(await locator.evaluate(el=>el===document.activeElement)){await p.keyboard.press('Enter');return;}await p.keyboard.press('Tab');}throw new Error('Keyboard could not reach a device control');}
async function rotate(p,index,times){for(let i=0;i<times;i++){const before=await p.locator('#circuit-'+index).getAttribute('aria-label');await p.locator('#circuit-'+index).click();await p.waitForFunction(([id,label])=>document.getElementById(id).getAttribute('aria-label')!==label,['circuit-'+index,before]);}}
async function audit(p,name){await p.addScriptTag({path:path.join(canonical,'tools/vendor/axe.min.js')});const issues=await p.evaluate(async()=>{const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));});if(issues.length)console.log(JSON.stringify({name,issues}));assert.equal(issues.length,0,name+' axe');check(name+' axe 0');}
(async()=>{
 app=createExperienceServer({root:staticRoot});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({channel:'chrome',headless:true});
 for(const width of [1440,390,320]){
   const c=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'}),p=await c.newPage(),errors=[];
   // The separately owned AI surface is integration-tested by the main agent.
   await p.route('**/ai-dialogue.js',route=>route.fulfill({status:200,contentType:'text/javascript',body:'/* external AI module excluded from story UI test */'}));
   await p.route('**/ai-dialogue.css',route=>route.fulfill({status:200,contentType:'text/css',body:''}));
   p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+app.server.address().port+'/pulse/');
   await p.locator('#loading').waitFor({state:'hidden',timeout:60000});
   await p.screenshot({path:path.join(screenshots,'entry-'+width+'.png')});
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await p.locator('#dual-start').click();await phase(p,'explore');
   await p.locator('#object-nav').getByRole('button',{name:/멈춘 전차/}).click();await p.locator('#power-workshop').waitFor({state:'visible'});
   await p.locator('#hint-button').click();assert((await p.locator('#hint-copy').innerText()).includes('전력은 줄지'));
   await p.screenshot({path:path.join(screenshots,'power-'+width+'.png')});await audit(p,'power '+width);
   await rotate(p,0,3);await rotate(p,1,1);await rotate(p,2,2);
   assert.equal(await p.locator('#power-outlet').getAttribute('data-live'),'true');
   await p.locator('#object-nav').getByRole('button',{name:/작은 방송국/}).click();
   await p.locator('#radio-dial').fill('96.3');await p.locator('#radio-check').click();await p.waitForFunction(()=>document.querySelector('#radio-signal-text').textContent==='96%');
   assert.equal(await p.locator('#restored-broadcast').isVisible(),false);
   await p.locator('#radio-plus').click();await p.locator('#radio-check').click();await phase(p,'vote');
   assert((await p.locator('#restored-broadcast').innerText()).includes('승객은 모두 안전'));assert.equal(await p.locator('#shared-count').textContent(),'0');
   await p.screenshot({path:path.join(screenshots,'radio-'+width+'.png')});await audit(p,'radio '+width);
   await p.reload();await phase(p,'vote');await p.locator('#open-vote').click();
   await p.locator('[data-choice="homes"]').click();await p.locator('#role-switch').getByRole('button',{name:/방송 기록원/}).click();
   await p.waitForFunction(()=>document.querySelector('#current-role').textContent==='방송 기록원'&&document.querySelector('#connection').dataset.status==='online'&&!document.querySelector('#objective').textContent.includes('펼치는 중'));
   await p.locator('[data-choice="homes"]').click();await p.locator('#role-switch').getByRole('button',{name:/전차 정비사/}).click();
   await p.waitForFunction(()=>document.querySelector('#current-role').textContent==='전차 정비사'&&document.querySelector('#connection').dataset.status==='online'&&!document.querySelector('#objective').textContent.includes('펼치는 중'));
   await p.locator('#finalize').click();await phase(p,'ended');
   await p.locator('#mark-input').fill('아침에는 아직 어두운 창을 찾아가자.');await p.locator('#mark-save').click();await p.locator('#shared-marks').getByText('아침에는 아직 어두운 창을 찾아가자.',{exact:true}).waitFor();
   const downloadPromise=p.waitForEvent('download');await p.locator('#night-download').click();const download=await downloadPromise,contents=fs.readFileSync(await download.path(),'utf8');assert(contents.includes('아침에는 아직 어두운 창'));assert(contents.includes('풀린 전선을 이어'));assert(!contents.includes('token'));
   await p.locator('#panel-body').evaluate(el=>el.scrollTop=0);await p.screenshot({path:path.join(screenshots,'ending-'+width+'.png')});await audit(p,'ending '+width);
   assert.deepEqual(errors,[]);check('solo restoration without shared-clue gate, reload, consensus, mark and download '+width);
   await c.close();
 }
 const ca=await browser.newContext({viewport:{width:1440,height:960}}),cb=await browser.newContext({viewport:{width:390,height:844}}),a=await ca.newPage(),b=await cb.newPage();
 for(const p of [a,b]){await p.route('**/ai-dialogue.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:''}));await p.route('**/ai-dialogue.css',r=>r.fulfill({status:200,contentType:'text/css',body:''}));}
 const base='http://127.0.0.1:'+app.server.address().port+'/pulse/';await a.goto(base);await a.locator('#create-open').click();await a.locator('#name-input').fill('정비사');await a.locator('#form-submit').click();await phase(a,'lobby');const code=await a.locator('#room-code').textContent();await b.goto(base+'?room='+code);await b.locator('#name-input').fill('기록원');await b.locator('#form-submit').click();await phase(b,'lobby');await a.locator('#start-story').click();await Promise.all([phase(a,'explore'),phase(b,'explore')]);
 await a.locator('#object-nav').getByRole('button',{name:/멈춘 전차/}).click();await b.locator('#object-nav').getByRole('button',{name:/작은 방송국/}).click();await b.locator('#radio-dial').fill('96.3');await b.locator('#radio-dial').focus();
 await rotate(a,0,3);assert.equal(await b.locator('#radio-dial').inputValue(),'96.3');assert.equal(await b.evaluate(()=>document.activeElement.id),'radio-dial');check('peer restoration updates preserve radio input and keyboard focus');
 for(const [index,times] of [[1,1],[2,2]])for(let i=0;i<times;i++){const before=await a.locator('#circuit-'+index).getAttribute('aria-label');await keyButton(a,a.locator('#circuit-'+index));await a.waitForFunction(([id,label])=>document.getElementById(id).getAttribute('aria-label')!==label,['circuit-'+index,before]);}
 await b.keyboard.press('ArrowRight');assert.equal(await b.locator('#radio-dial').inputValue(),'96.4');await keyButton(b,b.locator('#radio-check'));await Promise.all([phase(a,'vote'),phase(b,'vote')]);check('two browsers restore both devices with native keyboard controls and no clue collection');
 await ca.close();await cb.close();
})().catch(error=>{console.error(error.stack);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(app)app.close();console.log(JSON.stringify({checks,screenshots}));});
