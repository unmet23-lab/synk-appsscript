'use strict';
// All HTTP is intercepted; synthetic accounts only, no remote service or paid AI.
const {chromium}=require(process.argv[2]||'C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {summary,signedIn:syntheticAuth,activityStore,libraryStore,understandingStore}=require('../../../desktop/tools/member-insight-fixture.cjs');
const understandingScenarios=require('../../../desktop/tools/member-understanding-scenarios.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.SYNK_INSIGHT_QA_OUT||path.join(__dirname,'member-understanding-20261014'),bundleOverride=process.env.SYNK_INSIGHT_WEB_BUNDLE||null,cssOverride=process.env.SYNK_INSIGHT_WEB_CSS||null;
if(!path.isAbsolute(out)||[bundleOverride,cssOverride].some(file=>file&&!path.isAbsolute(file)))throw Error('QA output and asset override paths must be absolute');
const sourceFiles=['platform.html','platform.css','benefits.css','member-insight.css','dist/platform.js','qa/member-insight-smoke.cjs','../../desktop/tools/member-insight-fixture.cjs','../../desktop/tools/member-understanding-scenarios.cjs'];
const filePath=file=>file==='dist/platform.js'&&bundleOverride?bundleOverride:file==='member-insight.css'&&cssOverride?cssOverride:path.join(root,file);
const fingerprints=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,require('node:crypto').createHash('sha256').update(await fs.readFile(filePath(file))).digest('hex')])));
const origin='https://platform.example.invalid',accountOrigin='https://account.example.invalid',url=origin+'/platform.html#benefits/insight';
const config={version:1,supabaseUrl:accountOrigin,supabasePublishableKey:'sb_publishable_synthetic',portalUrl:'https://id.example.invalid/',clients:{platform:{clientId:'synthetic-platform',redirectUri:origin+'/client.html?product=platform'}}};
const report={checkedOn:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),scope:'Isolated browser, synthetic Atlas and member-insight consent HTTP only; 1440/390/320, night/day. Activity destinations are intercepted synthetic pages. No live account, AI, publication or installed profile.',checks:[],errors:[],unexpected:[],missing:[],screenshots:[],activityTargets:[]};
if(bundleOverride)report.bundleOverride=bundleOverride;
if(cssOverride)report.cssOverride=cssOverride;
let activePage;
const check=(name,ok,details={})=>{report.checks.push({name,ok:!!ok,...details});assert.ok(ok,name);};
async function fixture(browser,signedIn=true,{nativeHost=false}={}){
  const state={owner:'A',generation:1,mode:'enabled',configured:true,hold:false,held:[],calls:[],activity:activityStore(),library:libraryStore(),understanding:understandingStore(),heldLaunches:[]};
  const context=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});
  context.on('page',page=>page.on('pageerror',error=>report.errors.push(error.message)));
  await context.addInitScript(({signedIn,origin})=>{if(location.origin===origin&&signedIn)sessionStorage.setItem('synk.oauth.session.platform',JSON.stringify({access_token:'synthetic-A'}));},{signedIn,origin});
  if(nativeHost){
    await context.exposeBinding('__syntheticHost',async(_source,operation,arg,params)=>{
      if(operation==='authStatus')return syntheticAuth(state.owner,state.generation);
      if(operation==='getEnvironment')return {platform:'win32',mode:'development'};
      if(operation==='getClients')return [{id:'world',canLaunch:true,status:'installed'}];
      if(operation==='launch'){state.calls.push({operation,target:arg,owner:state.owner});return new Promise(resolve=>state.heldLaunches.push(()=>resolve({ok:true})));}
      if(operation==='accountRequest'){state.calls.push({operation:arg,owner:state.owner});if(arg==='atlasSummary')return summary(state.mode,state.owner);if(['insightLoad','insightSave'].includes(arg))return state.activity.request(state.owner,arg,params);if(['platformLoad','platformSave'].includes(arg))return state.library.request(state.owner,arg,params);if(['understandingLoad','understandingSave','understandingDelete'].includes(arg))return state.understanding.request(state.owner,arg,params);if(arg==='load')return {ok:true,account:syntheticAuth(state.owner,state.generation).account};}
      throw Error('Unexpected synthetic host call: '+operation+'/'+arg);
    });
    await context.addInitScript(()=>{const listeners=new Set();window.synkDesktop=Object.freeze({authStatus:()=>window.__syntheticHost('authStatus'),getEnvironment:()=>window.__syntheticHost('getEnvironment'),getClients:()=>window.__syntheticHost('getClients'),onAuthChanged:listener=>{listeners.add(listener);return ()=>listeners.delete(listener);},accountRequest:(operation,params)=>window.__syntheticHost('accountRequest',operation,params),launch:id=>window.__syntheticHost('launch',id)});window.__syntheticSwitchAuth=snapshot=>{for(const listener of listeners)listener(snapshot);};});
  }
  await context.route('**/*',async route=>{
    const request=route.request(),u=new URL(request.url());
    if(u.origin===accountOrigin){
      if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'authorization, apikey, content-type, x-synk-product, x-synk-contract, x-synk-app-version'}});
      state.calls.push({path:u.pathname,query:u.search,method:request.method(),owner:state.owner});
      if(u.pathname.endsWith('/synk-personal')){
        const body=request.method()==='POST'?request.postDataJSON():null;
        const resource=body?.resource||u.searchParams.get('resource');
        if(!['member-insight','platform-library','member-understanding'].includes(resource)||body&&!['save','delete'].includes(body.action)||body?.action==='delete'&&resource!=='member-understanding'){report.unexpected.push('unexpected synthetic write '+u.pathname);return route.abort();}
        const store=resource==='member-insight'?state.activity:resource==='member-understanding'?state.understanding:state.library,prefix=resource==='member-insight'?'insight':resource==='member-understanding'?'understanding':'platform';
        try{return route.fulfill({json:store.request(state.owner,prefix+(body?.action==='delete'?'Delete':body?'Save':'Load'),body||{})});}catch{return route.fulfill({status:503,json:{ok:false,error:{code:'SYNTHETIC_ACTIVITY_FAILURE'}}});}
      }
      if(request.method()!=='GET'){report.unexpected.push('unexpected write '+u.pathname);return route.abort();}
      if(u.searchParams.get('view')==='atlas'){
        if(state.mode==='error')return route.fulfill({status:503,json:{ok:false,error:{code:'SYNTHETIC_FAILURE',message:'Synthetic failure'}}});
        const result=summary(state.mode,state.owner);
        if(state.hold){state.hold=false;return new Promise(resolve=>state.held.push(async()=>{await route.fulfill({json:result}).catch(()=>{});resolve();}));}
        return route.fulfill({json:result});
      }
      return route.fulfill({json:{ok:true,account:{synk_user_id:'synthetic-insight-'+state.owner,profile:{display_name:'합성 '+state.owner}}}});
    }
    if(u.origin==='https://synk.im'&&u.pathname==='/account/client.html'&&u.searchParams.get('product')==='world'&&u.searchParams.get('play')==='learning-hub'){report.activityTargets.push({product:'world',path:u.pathname,play:u.searchParams.get('play')});return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Synthetic WORLD selector</h1>'});}
    if(u.origin!==origin){report.unexpected.push(u.origin+u.pathname);return route.abort();}
    // The release feed is a separate public service, not a member-view asset.
    // Exercise its existing unavailable fallback without any live request.
    if(u.pathname==='/desktop/releases/preview.json')return route.fulfill({status:503,json:{synthetic:true}});
    if(u.pathname==='/config.json')return route.fulfill({json:state.configured?config:{version:1}});
    if(u.pathname==='/client.html')return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><h1>합성 계정 관리</h1>'});
    if(u.pathname==='/dist/platform.js'&&bundleOverride)return route.fulfill({body:await fs.readFile(bundleOverride),contentType:'text/javascript'});
    if(u.pathname==='/member-insight.css'&&cssOverride)return route.fulfill({body:await fs.readFile(cssOverride),contentType:'text/css'});
    const target=path.resolve(root,'.'+decodeURIComponent(u.pathname));
    if(!target.startsWith(root+path.sep))return route.fulfill({status:404,body:''});
    try{return route.fulfill({body:await fs.readFile(target),contentType:({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf','.webmanifest':'application/manifest+json'})[path.extname(target)]||'application/octet-stream'});}catch{report.missing.push(u.pathname);return route.fulfill({status:404,body:''});}
  });
  activePage=await context.newPage();return {context,state,page:activePage};
}
async function ready(page,status='ready'){await page.locator('[data-insight-status="'+status+'"]').waitFor();}
async function waitState(predicate){for(let n=0;n<250;n++){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,20));}throw Error('Timed out waiting for synthetic state');}
async function capture(page,name,width,theme='night',scrollTarget=null){
  await page.setViewportSize({width,height:900});
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;window.scrollTo(0,0);},theme);
  await page.waitForFunction(()=>document.getElementById('platform-message')?.hidden!==false,{},{timeout:8000});
  await page.evaluate(()=>document.fonts.ready);
  if(scrollTarget)await page.locator(scrollTarget).evaluate(element=>{element.scrollIntoView({block:'start'});window.scrollBy(0,-80);});
  await page.screenshot({path:path.join(out,name+'.png'),fullPage:!scrollTarget});report.screenshots.push(name+'.png');
  check(name+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  check(name+' heading visible',await page.locator('h1#benefit-title').isVisible());
}
(async()=>{
  await fs.mkdir(out,{recursive:true});report.sourceHashes=await fingerprints();const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const first=await fixture(browser,false);await first.page.goto(url);await ready(first.page,'signed-out');
    check('signed-out never reads Atlas',!first.state.calls.some(call=>call.query.includes('view=atlas')));await capture(first.page,'web-signed-out-320',320);
    await first.page.locator('.mi-back').click();await first.page.waitForURL(/#benefits$/);await first.page.locator('a[href="#benefits/insight"]').first().click();await ready(first.page,'signed-out');check('signed-out re-entry stays signed-out without a stuck loading state',!first.state.calls.some(call=>call.query.includes('view=atlas')));
    await first.page.locator('[data-insight-action="account"]').click();await first.page.getByRole('heading',{name:'합성 계정 관리'}).waitFor();check('account action uses existing account route',first.page.url()===origin+'/client.html?product=platform');await first.context.close();
    const unconfigured=await fixture(browser,false);unconfigured.state.configured=false;await unconfigured.page.goto(url);await ready(unconfigured.page,'unconfigured');await unconfigured.page.locator('.mi-back').click();await unconfigured.page.waitForURL(/#benefits$/);await unconfigured.page.locator('a[href="#benefits/insight"]').first().click();await ready(unconfigured.page,'unconfigured');check('unconfigured re-entry remains readable without requests',unconfigured.state.calls.length===0);await unconfigured.context.close();
    const member=await fixture(browser);const {page,state}=member;await page.goto(url);await ready(page);
    check('both report areas visible',await page.getByRole('heading',{name:'나의 관심사·선호',exact:true}).isVisible()&&await page.getByRole('heading',{name:'학습 성향·성장',exact:true}).isVisible());
    check('synthetic account A learning appears',(await page.locator('.member-insight').innerText()).includes('합성 A 짧은 안내 듣기'));
    await page.locator('[data-insight-action="enable-activity"]:not([disabled])').waitFor();
    check('app observation defaults off without writing',!state.activity.inspect('A').consent&&!state.calls.some(call=>call.method==='POST'));
    await understandingScenarios.sparseSummaryScenario({run:script=>page.evaluate(script),until:expression=>page.waitForFunction(expression),inspect:async()=>state.understanding.inspect(state.owner),inspectActivity:async()=>state.activity.inspect(state.owner),
      writeCount:async()=>state.calls.filter(call=>call.method==='POST'||/Save$|Delete$/.test(call.operation||'')).length,setLearning:async mode=>{state.mode=mode;},refresh:async()=>{await page.locator('[data-insight-action="refresh"]').click();await ready(page);},capture:(name,width,theme,target)=>capture(page,name,width,theme,target),check,prefix:'web'});
    await page.locator('[data-insight-action="enable-activity"]').click();await page.locator('[data-insight-action="disable-activity"]:not([disabled])').waitFor();
    check('opt-in stores only explicit consent and begins empty',state.activity.inspect('A').consent&&state.activity.inspect('A').eventCount===0);
    await page.getByText('아직 앱 이용에서 확인할 관심 정보가 없어요.',{exact:true}).waitFor();
    await page.locator('[data-route="home"]').click();await page.locator('[data-connect-button]').click();await page.locator('[data-cloud="enable"]:not([disabled])').waitFor();await page.locator('[data-cloud="enable"]').click();await page.locator('[data-cloud="favorite"][data-id="world"]:not([disabled])').waitFor();await page.locator('[data-cloud="favorite"][data-id="world"]').click();
    await waitState(()=>state.activity.inspect('A').favorites.includes('world'));
    check('account-library star synchronizes declared favorite without counting a launch',state.library.inspect('A').favorites.includes('world')&&state.activity.inspect('A').eventCount===0);
    await page.locator('[data-panel-toggle][aria-expanded="true"]').click();await page.locator('[data-route="benefits"]').click();await page.locator('a[href="#benefits/insight"]').first().click();await ready(page);
    await page.evaluate(()=>{window.__qaOriginalOpen=window.open;window.open=()=>null;});await page.locator('[data-insight-action="activity"][data-insight-target="world"]').last().click();await page.waitForTimeout(80);
    check('blocked web popup never creates an observation',state.activity.inspect('A').eventCount===0);await page.evaluate(()=>{window.open=window.__qaOriginalOpen;delete window.__qaOriginalOpen;});
    const popupPromise=page.waitForEvent('popup');await page.locator('[data-insight-action="activity"][data-insight-target="world"]').last().click();const popup=await popupPromise;await popup.getByRole('heading',{name:'Synthetic WORLD selector'}).waitFor();await popup.close();await page.bringToFront();
    await waitState(()=>state.activity.inspect('A').eventCount===1);await page.waitForFunction(()=>document.querySelector('.mi-interest-list')?.innerText.includes('WORLD'));
    check('WORLD activity opens real selector route and records one synthetic opening',report.activityTargets.length===1&&state.activity.inspect('A').eventCount===1);
    await page.locator('[data-insight-action="disable-activity"]:not([disabled])').click();await page.locator('[data-insight-action="enable-activity"]:not([disabled])').waitFor();
    check('opt-out deletes observations and hides their UI',!state.activity.inspect('A').consent&&state.activity.inspect('A').eventCount===0&&await page.locator('.mi-interest-list').count()===0);
    state.activity.set('A','populated');await page.locator('[data-insight-action="refresh"]').click();await page.getByText('실제 앱 열기에서 관찰',{exact:true}).waitFor();
    check('declared favorites and observed launches stay distinct',await page.getByText('직접 고른 즐겨찾기',{exact:true}).count()===1&&await page.locator('.mi-period-table').count()===2);
    check('activity comparison uses observation counts, not favorite changes',(await page.locator('.mi-member-activity .mi-period-table').innerText()).includes('1회 더 많음'));
    await page.locator('.mi-member-activity .mi-period-dates summary').click();check('exact period bounds are available',await page.locator('.mi-member-activity .mi-period-dates time').count()===4);
    for(const theme of ['night','day'])for(const width of [1440,390,320])await capture(page,'web-enabled-'+theme+'-'+width,width,theme);
    await understandingScenarios({refreshResetsDraft:true,run:script=>page.evaluate(script),until:expression=>page.waitForFunction(expression),click:selector=>page.locator(selector).click(),
      inspect:async()=>state.understanding.inspect(state.owner),setMode:async mode=>state.understanding.set(state.owner,mode),replace:async value=>state.understanding.replace(state.owner,value),
      setLearning:async mode=>{state.mode=mode;},refresh:async()=>{await page.locator('[data-insight-action="refresh"]').click();await ready(page);},
      reenter:async()=>{await page.locator('.mi-back').click();await page.waitForURL(/#benefits$/);await page.locator('a[href="#benefits/insight"]').first().click();await ready(page);},
      capture:(name,width,theme,target)=>capture(page,name,width,theme,target),launch:async selector=>{const next=page.waitForEvent('popup');await page.locator(selector).click();const opened=await next;await opened.getByRole('heading',{name:'Synthetic WORLD selector'}).waitFor();check('confirmed topic WORLD button opens fixed selector route',new URL(opened.url()).searchParams.get('play')==='learning-hub');await opened.close();await page.bringToFront();},check,prefix:'web'});
    await page.locator('.mi-evidence summary').click();check('evidence distinguishes scope and limits',(await page.locator('.mi-evidence').innerText()).includes('독립 응답')&&(await page.locator('.mi-evidence').innerText()).includes('TOPIK'));await capture(page,'web-evidence-390',390);
    const before=state.calls.filter(call=>call.query==='?view=atlas').length;await page.locator('[data-insight-action="refresh"]').click();await ready(page);check('refresh reads original Atlas endpoint',state.calls.filter(call=>call.query==='?view=atlas').length>before);
    state.mode='empty';await page.locator('[data-insight-action="refresh"]').click();await page.getByText('첫 연습 기록을 기다리고 있어요.',{exact:true}).waitFor();check('empty clears previous account record',!(await page.locator('.member-insight').innerText()).includes('합성 A'));await capture(page,'web-empty-320',320);
    state.mode='disabled';await page.locator('[data-insight-action="refresh"]').click();await ready(page);await page.locator('.mi-consent').waitFor();
    const disabled=await page.locator('.member-insight').innerText();check('consent off hides practice and preference fields despite stale payload',!disabled.includes('합성 A')&&!disabled.includes('단계별로 도와줘요')&&disabled.includes('한국 여행'));await capture(page,'web-disabled-320',320);
    check('learning consent off leaves separately authorized app observations visible',await page.locator('.mi-interest-list').count()===1&&await page.locator('.mi-period-table').count()===1);
    state.mode='enabled';state.activity.set('A','partial');await page.locator('[data-insight-action="refresh"]').click();await page.getByText('아직 비교하기 어려워요',{exact:true}).waitFor();check('partial coverage has no activity delta',!(await page.locator('.mi-member-activity .mi-period-table').innerText()).includes('더 많음')&&(await page.locator('.mi-member-activity .mi-period-table').innerText()).includes('비교 보류'));await capture(page,'web-partial-320',320);
    for(const mode of ['malformed','error']){state.activity.set('A',mode);await page.locator('[data-insight-action="refresh"]').click();await page.getByText('앱 이용 기록을 불러오지 못했어요. 다시 연결을 확인해 주세요.',{exact:true}).waitFor();check(mode+' app data fails closed while learning remains',await page.locator('.mi-interest-list').count()===0&&(await page.locator('.member-insight').innerText()).includes('합성 A'));await capture(page,'web-activity-'+mode+'-320',320);}
    state.activity.set('A','populated');
    state.mode='error';await page.locator('[data-insight-action="refresh"]').click();await ready(page,'error');check('error clears all previous personal results',!(await page.locator('.member-insight').innerText()).includes('한국 여행'));await capture(page,'web-error-320',320);
    await page.locator('.mi-back').click();await page.waitForURL(/#benefits$/);await page.locator('a[href="#benefits/insight"]').first().click();await ready(page,'error');check('read failure re-entry remains actionable',await page.locator('[data-insight-action="refresh"]').isVisible());
    state.mode='enabled';await page.locator('[data-insight-action="refresh"]').click();await ready(page);check('retry recovers without navigation',page.url()===url);
    state.hold=true;await page.locator('[data-insight-action="refresh"]').click();await page.waitForFunction(()=>document.querySelector('[data-insight-status="loading"]'));for(let n=0;n<100&&!state.held.length;n++)await new Promise(resolve=>setTimeout(resolve,20));check('account A response held',state.held.length===1);
    state.owner='B';await page.evaluate(()=>{sessionStorage.setItem('synk.oauth.session.platform',JSON.stringify({access_token:'synthetic-B'}));window.dispatchEvent(new Event('online'));});await page.getByRole('heading',{name:'합성 B 짧은 안내 듣기',exact:true}).waitFor();
    for(const release of state.held.splice(0))await release();await page.waitForTimeout(80);check('late account A response cannot replace B',(await page.locator('.member-insight').innerText()).includes('합성 B')&&!(await page.locator('.member-insight').innerText()).includes('합성 A'));await capture(page,'web-account-B-390',390);
    check('account B does not inherit A observation consent',!state.activity.inspect('B').consent&&await page.locator('.mi-interest-list').count()===0);
    check('Atlas queries stay scoped to current account endpoint',state.calls.filter(call=>call.query.includes('view=atlas')).every(call=>call.path.endsWith('/synk-account')&&call.query==='?view=atlas'&&call.method==='GET'));
    await page.locator('.mi-back').click();await page.waitForURL(/#benefits$/);await page.locator('a[href="#benefits/insight"]').first().waitFor();check('back returns to member benefits',await page.locator('a[href="#benefits/insight"]').count()>0);await member.context.close();
    const hosted=await fixture(browser,true,{nativeHost:true});await hosted.page.goto(origin+'/platform.html#app/world');await hosted.page.locator('[data-action="launch"][data-id="world"]').first().waitFor();
    hosted.state.activity.set('A','populated');hosted.state.activity.set('B','populated');const beforeB=hosted.state.activity.inspect('B').eventCount;
    await hosted.page.locator('[data-action="launch"][data-id="world"]').first().click();await waitState(()=>hosted.state.heldLaunches.length===1);
    hosted.state.owner='B';hosted.state.generation=2;await hosted.page.evaluate(snapshot=>window.__syntheticSwitchAuth(snapshot),syntheticAuth('B',2));for(const release of hosted.state.heldLaunches.splice(0))release();await hosted.page.waitForTimeout(120);
    check('late native-host launch for A never becomes an observation for B',hosted.state.activity.inspect('B').eventCount===beforeB&&!hosted.state.calls.some(call=>call.operation==='insightSave'&&call.owner==='B'));
    await hosted.page.goto(url);await ready(hosted.page);await hosted.page.getByRole('heading',{name:'합성 B 짧은 안내 듣기',exact:true}).waitFor();check('native-host switch still exposes only B summary',!(await hosted.page.locator('.member-insight').innerText()).includes('합성 A'));await hosted.context.close();
    check('no missing static assets',report.missing.length===0);check('no unmocked remote requests',report.unexpected.length===0);check('no browser runtime errors',report.errors.length===0);check('tested source files did not change during execution',JSON.stringify(report.sourceHashes)===JSON.stringify(await fingerprints()));
  }catch(error){report.failure=error.stack;report.state=activePage&&!activePage.isClosed()?await activePage.evaluate(()=>({url:location.href,status:document.querySelector('[data-insight-status]')?.dataset.insightStatus,text:document.querySelector('.member-insight')?.innerText,rect:document.querySelector('.member-insight')?.getBoundingClientRect().toJSON(),display:getComputedStyle(document.querySelector('.member-insight')||document.body).display,visibility:getComputedStyle(document.querySelector('.member-insight')||document.body).visibility,hidden:document.hidden})).catch(()=>null):null;process.exitCode=1;}finally{await browser.close();report.ok=!report.failure&&report.checks.every(check=>check.ok);await fs.writeFile(path.join(out,'browser-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,failed:report.checks.filter(check=>!check.ok),failure:report.failure,state:report.state,unexpected:report.unexpected,errors:report.errors}));}
})();
