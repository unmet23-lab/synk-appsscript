// Real Chromium, disposable SQLite, synthetic local staff; nothing is sent externally.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,mkdir,writeFile,rm,realpath,lstat} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {createServer} from 'node:net';
import {createCompanyApp} from '../server.mjs';
import {크롬환경} from '../../../../../../tools/lib/크롬조종.js';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.MESSENGER_PLAYWRIGHT||join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const {화면시험,닫기}=require('../../../../../../tools/lib/화면시험.cjs');
await 화면시험({분:8},async()=>{
const tempRoot=await realpath(tmpdir()),directory=await mkdtemp(join(tempRoot,'synk-workspace-layout-'));
const output=resolve(process.env.WORKSPACE_LAYOUT_QA_OUT||'.tmp/workspace-layout-browser');
const probe=createServer();await new Promise(done=>probe.listen(0,'127.0.0.1',done));
const port=probe.address().port;await new Promise(done=>probe.close(done));
const app=createCompanyApp({dataDir:directory,port,allowTestHost:true,schedule:false,webPushEnabled:false});
const report={synthetic:true,production:false,checks:[],measurements:[],errors:[],assets:[]};
let browser,originalFailure;
function check(name,ok){report.checks.push({name,ok:Boolean(ok)});}
try{
  await mkdir(output,{recursive:true});
  const user=app.store.createUser({email:'layout@example.test',name:'합성 화면 관리자',role:'admin',password:'workspace-layout-only'});
  const people=[];
  for(let index=0;index<30;index++)people.push(app.store.createUser({email:'person-'+index+'@example.test',name:'합성 직원 '+String(index).padStart(2,'0'),role:'member',password:'workspace-layout-only'}));
  const address=await app.start(),base=`http://127.0.0.1:${address.port}`;
  browser=await chromium.launch({headless:true,executablePath:process.env.MESSENGER_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe',env:크롬환경()});
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addCookies([{name:'synk_company_session',value:app.store.mint('session',user.id,{csrfToken:'synthetic-layout-csrf'},30),url:base}]);
  const page=await context.newPage();page.setDefaultTimeout(15000);
  page.on('pageerror',error=>report.errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  page.on('response',response=>{if(response.status()>=400&&['image','font','script','stylesheet'].includes(response.request().resourceType()))report.assets.push({path:new URL(response.url()).pathname,status:response.status()});});
  await page.goto(base+'/?tab=messenger');
  const messenger=page.frameLocator('#messenger-frame');await messenger.locator('#composer-input').waitFor({state:'visible'});
  for(const [width,height] of [[1440,900],[390,844],[844,390],[1440,900]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    const measurement=await page.evaluate(()=>{
      const frame=document.querySelector('#messenger-frame'),host=frame.getBoundingClientRect(),doc=frame.contentDocument;
      const rectangle=element=>{const rect=element.getBoundingClientRect();return {top:host.top+rect.top,bottom:host.top+rect.bottom,left:host.left+rect.left,right:host.left+rect.right,width:rect.width,height:rect.height};};
      const slot=document.querySelector('#messenger-module-slot').getBoundingClientRect();
      return {viewport:{width:innerWidth,height:innerHeight},document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},slot:{top:slot.top,left:slot.left,width:slot.width,height:slot.height},frame:{top:host.top,bottom:host.bottom,left:host.left,right:host.right,width:host.width,height:host.height},input:rectangle(doc.querySelector('#composer-input')),send:rectangle(doc.querySelector('#send-message')),brokenImages:[...document.images,...doc.images].filter(image=>image.getClientRects().length&&image.complete&&!image.naturalWidth).map(image=>image.getAttribute('src'))};
    });report.measurements.push(measurement);
    check(width+' no outer horizontal overflow',measurement.document.width<=width+1);
    check(width+' no outer messenger scroll',measurement.document.height<=height+1);
    check(width+' messenger slot has actual available space',measurement.slot.width>1&&measurement.slot.height>height/2);
    check(width+' persistent iframe exactly follows the slot',Object.keys(measurement.slot).every(key=>Math.abs(measurement.frame[key]-measurement.slot[key])<=1));
    for(const [label,rect] of [['composer',measurement.input],['send',measurement.send]])check(width+' '+label+' fits the visible viewport',rect.top>=0&&rect.left>=0&&rect.right<=width+1&&rect.bottom<=height+1&&rect.width>0&&rect.height>0);
    check(width+' no broken image',measurement.brokenImages.length===0);
    await page.screenshot({path:join(output,'messenger-'+width+'.png')});
  }
  // Actual iframe lifetime and an unsent draft survive a company navigation round-trip.
  await page.setViewportSize({width:1440,height:900});
  await messenger.locator('#composer-input').fill('합성 미전송 초안');
  await page.locator('#messenger-frame').evaluate(frame=>{frame.dataset.qaIdentity='retained-frame';frame.contentWindow.__layoutQaLifetime='retained-document';});
  const openTools=async()=>{await page.locator('#ws-tools-toggle').click();await page.locator('#ws-tools-drawer').waitFor({state:'visible'});};
  const navigate=async tab=>{await openTools();await page.locator('#ws-tools-drawer [data-tab="'+tab+'"]').first().click();};
  await navigate('home');await page.locator('#next-heading').waitFor();
  await navigate('messenger');await messenger.locator('#composer-input').waitFor({state:'visible'});
  check('same iframe survives navigation',await page.locator('#messenger-frame').getAttribute('data-qa-identity')==='retained-frame');
  check('messenger document is not reloaded during navigation',await page.locator('#messenger-frame').evaluate(frame=>frame.contentWindow.__layoutQaLifetime==='retained-document'));
  check('unsent messenger draft survives navigation',await messenger.locator('#composer-input').inputValue()==='합성 미전송 초안');
  await page.goto(base+'/?tab=workroom&section=tools&tool=productions');
  await page.locator('.maker-tools[data-mt="productions"] h1').waitFor();
  for(const [width,height] of [[390,844],[844,390]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    check(width+' production desk fits the viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.screenshot({path:join(output,'productions-'+width+'.png')});
  }
  const contextToggle=page.locator('#ws-tools-toggle'),contextMenu=page.locator('#ws-tools-drawer');
  for(const [width,height] of [[1440,900],[390,844],[844,390],[1024,560],[320,568]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    check(width+' tools starts closed',!await contextMenu.isVisible());
    await openTools();
    check(width+' tools blocks background interaction',await page.locator('#main').evaluate(main=>main.inert));
    check(width+' tools stays inside the viewport',await contextMenu.evaluate(menu=>{const r=menu.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}));
    for(const edge of ['last','first']){
      await contextMenu.evaluate((menu,edge)=>{const items=[...menu.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0&&el.getClientRects().length&&!el.closest('[hidden],[inert]'));(edge==='last'?items.at(-1):items[0]).focus();},edge);
      await page.keyboard.press(edge==='last'?'Tab':'Shift+Tab');
      check(width+' '+edge+' keyboard focus wraps within tools',await contextMenu.evaluate(menu=>menu.contains(document.activeElement)));
    }
    await page.keyboard.press('Escape');
    check(width+' Escape closes tools and restores focus',!await contextMenu.isVisible()&&await contextToggle.evaluate(button=>button===document.activeElement));
    check(width+' closing tools restores background interaction',await page.locator('#main').evaluate(main=>!main.inert));
    await openTools();await contextMenu.locator('[data-action="workspace-tools-close"]').first().click();
    check(width+' visible internal close button works',!await contextMenu.isVisible()&&await contextToggle.evaluate(button=>button===document.activeElement));
    await openTools();
    const scrim=page.locator('#ws-tools-scrim');
    const point=await scrim.evaluate(el=>{for(const [x,y] of [[8,innerHeight-8],[innerWidth-8,innerHeight-8],[8,80],[innerWidth/2,innerHeight-8]])if(document.elementFromPoint(x,y)===el)return{x,y};return null;});
    check(width+' scrim has a reachable hit target',Boolean(point));
    if(point)await page.mouse.click(point.x,point.y);else await page.keyboard.press('Escape');
    check(width+' scrim closes tools and restores focus',Boolean(point)&&!await contextMenu.isVisible()&&await contextToggle.evaluate(button=>button===document.activeElement));
  }
  // A real changing state response must retain the current scroll and an active search draft.
  await page.setViewportSize({width:1440,height:900});
  await page.goto(base+'/?tab=members');await page.locator('.org-table tbody tr').first().waitFor();
  const scrollBefore=await page.evaluate(()=>{const main=document.querySelector('main'),scroll=main.scrollHeight>main.clientHeight+2?main:document.scrollingElement;scroll.scrollTop=Math.min(600,scroll.scrollHeight-scroll.clientHeight);return {kind:scroll===main?'main':'document',top:scroll.scrollTop};});
  check('people list has a meaningful scroll position',scrollBefore.top>200);
  const changed=people.at(-1);app.store.put('users',changed.id,{...app.store.get('users',changed.id),name:'합성 직원 29 갱신'});
  await page.evaluate(()=>loadState({quiet:true}));
  await page.waitForFunction(()=>document.querySelector('main').textContent.includes('합성 직원 29 갱신'));
  const scrollAfter=await page.evaluate(kind=>(kind==='main'?document.querySelector('main'):document.scrollingElement).scrollTop,scrollBefore.kind);
  check('changed state preserves the real scroll container',Math.abs(scrollAfter-scrollBefore.top)<=1);
  const query=page.locator('[data-org-filter="query"]');await query.fill('합성 직원');await query.focus();
  await query.evaluate(input=>input.setSelectionRange(1,3));
  const changedAgain=people.at(-2);app.store.put('users',changedAgain.id,{...app.store.get('users',changedAgain.id),name:'합성 직원 28 갱신'});
  await page.evaluate(()=>loadState({quiet:true}));
  check('refresh retains the typed search',await query.inputValue()==='합성 직원');
  check('refresh retains search focus and selection',await query.evaluate(input=>input===document.activeElement&&input.selectionStart===1&&input.selectionEnd===3));
  check('no runtime or asset error',report.errors.length===0&&report.assets.length===0);
  assert.ok(report.checks.every(row=>row.ok),JSON.stringify(report.checks.filter(row=>!row.ok)));
}catch(error){originalFailure=error;report.failure={message:error.message};throw error;}
finally{
  const errors=[];
  try{await writeFile(join(output,'report.json'),JSON.stringify(report,null,2));}catch(error){errors.push(error);}
  try{if(browser&&!await 닫기(browser,{초:45}))throw new Error('Browser close timed out');}catch(error){errors.push(error);}
  try{await app.stop();}catch(error){errors.push(error);}
  try{const target=await realpath(directory),info=await lstat(directory);assert.ok(info.isDirectory()&&!info.isSymbolicLink()&&dirname(target)===tempRoot&&target.startsWith(join(tempRoot,'synk-workspace-layout-')));await rm(target,{recursive:true,force:true});}catch(error){errors.push(error);}
  if(errors.length){if(!originalFailure)throw new AggregateError(errors,'Workspace layout cleanup failed');console.error(JSON.stringify({cleanupErrors:errors.map(error=>error.message)}));}
}
console.log(JSON.stringify({checks:report.checks.length,output}));
});
