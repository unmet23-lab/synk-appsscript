import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import path from 'node:path';

const require=createRequire(import.meta.url);
const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(fileURLToPath(new URL('../../../',import.meta.url)));
let server,browser,base;
const fixture=`<!doctype html><div id="world-panel"><div id="panel-content"></div></div><script type="module">
import {createTutorOnboarding} from '/experiences/brand-opening/tutor-onboarding.mjs';
window.setup=(options={})=>{
 let resource;window.choices=[];window.toasts=[];window.continued=0;window.choiceState={};window.calls=[];window.pending=[];
 const home={state:{reduced:true},showPanel(title,html){resource?.dispose();resource=null;document.querySelector('#panel-content').innerHTML=html;},attachPanelResource(value){resource=value;},closePanel(){resource?.dispose();resource=null;document.querySelector('#panel-content').replaceChildren();},toast(text){window.toasts.push(text);}};
 window.closePanel=()=>home.closePanel();
 const commitChoice=options.remote?(id,owner)=>new Promise((resolve,reject)=>{window.calls.push({id,owner});window.pending.push({resolve,reject});}):options.fallback?()=>null:null;
 window.ui=createTutorOnboarding({home,asset:()=> 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',commitChoice,getChoiceStatus:()=>window.choiceState,onChoice:(tutor,meta)=>window.choices.push({id:tutor?.id||null,...meta})});
 if(options.owner)window.ui.setOwner(options.owner);window.ui.open({force:true,then:()=>window.continued++});
};window.ready=true;
</script>`;
before(async()=>{
 server=createServer(async(req,res)=>{try{
  if(req.url==='/fixture'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture);return;}
  const name=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://fixture.invalid').pathname));
  if(!name.startsWith(root+path.sep))throw Error('outside fixture');
  res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(await readFile(name));
 }catch{res.statusCode=404;res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({channel:'msedge',headless:true});
});
after(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
async function pageFor(t,options={}){
 const context=await browser.newContext();t.after(()=>context.close());const page=await context.newPage();
 await page.goto(base+'/fixture');await page.waitForFunction(()=>window.ready);await page.evaluate(options=>window.setup(options),options);return page;
}
async function preview(page,id='kkamong'){
 await page.locator(`[data-tutor-id="${id}"]`).click();await page.locator('[data-tutor-action="confirm"]').click();
}
test('remote restoration uses the same owner, preserves an open draft and never commits back',async t=>{
 const page=await pageFor(t,{remote:true,owner:'account-a'});await preview(page,'mongle');
 assert.equal(await page.evaluate(()=>window.ui.applyChoice('marin','account-b')),false);
 assert.equal(await page.evaluate(()=>window.ui.applyChoice('kkamong','account-a')),true);
 const restored=await page.evaluate(()=>({metrics:window.ui.metrics(),calls:window.calls,choice:window.choices.at(-1),raw:localStorage.getItem('synk.world.tutor.v1:account-a')}));
 assert.equal(restored.metrics.tutor,'kkamong');assert.equal(restored.metrics.draft,'mongle');assert.equal(restored.metrics.step,'welcome');
 assert.deepEqual(restored.calls,[]);assert.equal(restored.choice.source,'remote');assert.equal(JSON.parse(restored.raw).tutor,'kkamong');
 await page.locator('[data-tutor-action="finish"]').click();await page.evaluate(()=>window.pending[0].resolve({saved:true,mode:'account'}));
 await page.waitForFunction(()=>window.continued===1);assert.equal(await page.evaluate(()=>window.ui.metrics().tutor),'mongle');
});
test('commit failure preserves the draft and continuation, then retry commits once',async t=>{
 const page=await pageFor(t,{remote:true,owner:'account-a'});await preview(page);
 await page.locator('[data-tutor-action="finish"]').click();
 assert.equal(await page.locator('[data-tutor-action="finish"]').isDisabled(),true);
 assert.equal(await page.locator('[data-tutor-action="back"]').isDisabled(),true);
 await page.evaluate(()=>window.pending[0].reject(Error('연결을 확인한 뒤 다시 시도해 주세요.')));
 await page.waitForFunction(()=>!window.ui.metrics().committing);
 assert.equal(await page.evaluate(()=>window.ui.metrics().draft),'kkamong');assert.equal(await page.evaluate(()=>window.continued),0);
 assert.match(await page.locator('.tutor-footer>p').textContent(),/다시 시도/);
 await page.locator('[data-tutor-action="finish"]').click();
 await page.evaluate(()=>window.pending[1].resolve({saved:true,mode:'account',message:'연결되면 튜터 선택을 계정에 저장해요.'}));
 await page.waitForFunction(()=>window.continued===1);
 assert.equal(await page.evaluate(()=>window.choices.filter(x=>x.source==='user').length),1);
 assert.match(await page.evaluate(()=>window.toasts.at(-1)),/연결되면/);
});
test('a late old-account commit cannot replace the new account or continue its game',async t=>{
 const page=await pageFor(t,{remote:true,owner:'account-a'});await preview(page);await page.locator('[data-tutor-action="finish"]').click();
 await page.evaluate(()=>{window.ui.setOwner('account-b');window.ui.applyChoice('marin','account-b');window.pending[0].resolve({saved:true,mode:'account'});});
 await page.waitForTimeout(20);
 const result=await page.evaluate(()=>({metrics:window.ui.metrics(),continued:window.continued,users:window.choices.filter(x=>x.source==='user'),raw:localStorage.getItem('synk.world.tutor.v1:account-b')}));
 assert.equal(result.metrics.owner,'account-b');assert.equal(result.metrics.tutor,'marin');assert.equal(result.continued,0);assert.deepEqual(result.users,[]);assert.equal(JSON.parse(result.raw).tutor,'marin');
});
test('closing and reopening fences an earlier save from a newer save for the same account',async t=>{
 const page=await pageFor(t,{remote:true,owner:'account-a'});await preview(page);await page.locator('[data-tutor-action="finish"]').click();
 await page.evaluate(()=>{window.closePanel();window.ui.open({force:true,then:()=>window.continued++});});
 await preview(page,'mongle');await page.locator('[data-tutor-action="finish"]').click();
 await page.evaluate(()=>window.pending[0].resolve({saved:true,mode:'account'}));await page.waitForTimeout(20);
 assert.equal(await page.evaluate(()=>window.ui.metrics().committing),true);assert.equal(await page.evaluate(()=>window.continued),0);
 await page.evaluate(()=>window.pending[1].resolve({saved:true,mode:'account'}));await page.waitForFunction(()=>window.continued===1);
 assert.equal(await page.evaluate(()=>window.ui.metrics().tutor),'mongle');
});
test('loading gates confirmation without losing the draft and refreshes a truthful account footer',async t=>{
 const page=await pageFor(t,{remote:true,owner:'account-a'});await preview(page);
 await page.evaluate(()=>{window.choiceState={phase:'loading',mode:'account',message:'계정의 튜터를 불러오고 있어요.'};window.ui.refreshStatus();});
 assert.equal(await page.locator('[data-tutor-action="finish"]').isDisabled(),true);assert.match(await page.locator('.tutor-footer>p').textContent(),/불러오고/);
 await page.evaluate(()=>{window.choiceState={phase:'synced',mode:'account',message:'선택한 튜터가 SYNK 계정에 저장돼요.'};window.ui.refreshStatus();});
 assert.equal(await page.locator('[data-tutor-action="finish"]').isDisabled(),false);assert.equal(await page.evaluate(()=>window.ui.metrics().draft),'kkamong');
 assert.match(await page.locator('.tutor-footer>p').textContent(),/SYNK 계정/);
});
test('remote null clears only the current owner and a null commit handler keeps local completion working',async t=>{
 const page=await pageFor(t,{fallback:true});
 await page.evaluate(()=>{localStorage.setItem('synk.world.tutor.v1:other','keep');window.ui.applyChoice('marin','guest');window.ui.applyChoice(null,'guest');});
 assert.equal(await page.evaluate(()=>window.ui.metrics().tutor),null);assert.equal(await page.evaluate(()=>localStorage.getItem('synk.world.tutor.v1:other')),'keep');
 assert.equal(await page.evaluate(()=>localStorage.getItem('synk.world.tutor.v1:guest')),null);
 await preview(page);await page.locator('[data-tutor-action="finish"]').click();await page.waitForFunction(()=>window.continued===1);
 assert.equal(await page.evaluate(()=>window.choices.at(-1).source),'user');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('synk.world.tutor.v1:guest')).tutor),'kkamong');
});
test('remote selection still renders when the local mirror cannot be written',async t=>{
 const page=await pageFor(t,{remote:true,owner:'account-a'});
 const result=await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw Error('quota');};return {applied:window.ui.applyChoice('mongle','account-a'),metrics:window.ui.metrics(),choice:window.choices.at(-1)};});
 assert.equal(result.applied,true);assert.equal(result.metrics.tutor,'mongle');assert.equal(result.choice.source,'remote');assert.equal(result.choice.saved,false);
});
test('a commit without a durable save leaves the old choice and the retry draft intact',async t=>{
 const page=await pageFor(t,{remote:true,owner:'account-a'});await page.evaluate(()=>window.ui.applyChoice('marin','account-a'));await preview(page);
 await page.locator('[data-tutor-action="finish"]').click();await page.evaluate(()=>window.pending[0].resolve({saved:false,mode:'account',message:'저장 공간을 확인해 주세요.'}));
 await page.waitForFunction(()=>!window.ui.metrics().committing);
 const result=await page.evaluate(()=>({metrics:window.ui.metrics(),continued:window.continued,raw:localStorage.getItem('synk.world.tutor.v1:account-a')}));
 assert.equal(result.metrics.tutor,'marin');assert.equal(result.metrics.draft,'kkamong');assert.equal(result.continued,0);assert.equal(JSON.parse(result.raw).tutor,'marin');
 assert.match(await page.locator('.tutor-footer>p').textContent(),/저장 공간/);
});
