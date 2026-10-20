// 트렌드·레퍼런스·제작 데스크 전후 캡처: node capture.mjs <회사 폴더> <출력 폴더>
// qa/fixture.mjs를 내 임시 폴더(TEMP·TMP)로 띄우고 합성 관리자 계정으로 화면을 1440·390px로 찍는다.
// 화면마다 사진·보이는 글(texts.json)·콘솔 오류·실패 요청·가로 넘침을 남긴다. 끝나면 서버를 끄고 그 임시 폴더를 지운다.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {lstat,mkdir,mkdtemp,realpath,rm,writeFile} from 'node:fs/promises';
import {homedir,tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const {chromium}=require(join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const [companyArg,outArg]=process.argv.slice(2);const company=resolve(companyArg),out=resolve(outArg);
const only=process.argv.includes('--only')?process.argv[process.argv.indexOf('--only')+1].split(','):null;
await mkdir(out,{recursive:true});
const temporaryRoot=await realpath(tmpdir()),runDirectory=await mkdtemp(join(temporaryRoot,'wrc-'));
let child,childClosed,browser,fixture;const texts={},errors=[],overflow=[];
const wait=(page,ms)=>page.waitForTimeout(ms);
async function tall(page,fn,height=3200){const size=page.viewportSize();await page.setViewportSize({width:size.width,height});await wait(page,400);try{await fn();}finally{await page.setViewportSize(size);await wait(page,250);}}
async function checkOverflow(page,name){const result=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth,visual:visualViewport?.width||innerWidth}));if(result.scroll>result.inner+1||result.inner>result.visual+1)overflow.push(`${name}: scroll ${result.scroll} inner ${result.inner} visual ${result.visual}`);}
async function full(page,name){await checkOverflow(page,name);const height=await page.evaluate(()=>{const main=document.getElementById('main');return Math.max(document.documentElement.scrollHeight,main?Math.ceil(main.scrollHeight+main.getBoundingClientRect().top+40):0);});const size=page.viewportSize();await page.setViewportSize({width:size.width,height:Math.min(16000,Math.max(size.height,height))});await wait(page,600);await page.screenshot({path:join(out,name+'.png'),fullPage:true});await page.setViewportSize(size);await wait(page,250);texts[name]=await page.evaluate(()=>(document.getElementById('main')||document.body).innerText);}
async function modalShot(page,name){await page.waitForSelector('.modal',{timeout:8000});await wait(page,500);await checkOverflow(page,name);await tall(page,async()=>{await page.locator('.modal').first().screenshot({path:join(out,name+'.png')});});texts[name]=await page.evaluate(()=>document.querySelector('.modal')?.innerText||'');}
async function elementShot(page,name,selector){const node=page.locator(selector).first();if(!await node.count()){errors.push(`${name}: 없음 ${selector}`);return;}await node.scrollIntoViewIfNeeded();await wait(page,250);await node.screenshot({path:join(out,name+'.png')});texts[name]=await node.innerText();}
async function closeModal(page){if(await page.locator('.modal').count()){await page.keyboard.press('Escape');await wait(page,300);if(await page.locator('.modal').count()){await page.locator('.modal [data-action="close-modal"]').first().click().catch(()=>{});await wait(page,300);}}}
async function openAll(page,selector){await page.evaluate(s=>{for(const node of document.querySelectorAll(s))node.open=true;},selector);await wait(page,250);}
async function go(page,path,selector){await page.goto(new URL(path,fixture.url).href,{waitUntil:'domcontentloaded'});await page.waitForSelector(selector,{timeout:20000});await wait(page,1500);}
async function step(prefix,name,fn){if(only&&!only.includes(name))return;try{await fn();}catch(error){errors.push(`${prefix}-${name}: ${error.message.split('\n')[0]}`);}}
try{
  child=spawn(process.execPath,[fileURLToPath(new URL('./fixture.mjs',import.meta.url)),company],{env:{...process.env,TEMP:runDirectory,TMP:runDirectory,TMPDIR:runDirectory},stdio:['ignore','pipe','inherit']});
  childClosed=new Promise(done=>child.once('close',done));
  fixture=await new Promise((done,fail)=>{let text='';const timer=setTimeout(()=>fail(new Error('fixture startup timed out')),120000),finish=(callback,value)=>{clearTimeout(timer);callback(value);};child.stdout.setEncoding('utf8').on('data',chunk=>{text+=chunk;const line=text.split(/\r?\n/).find(row=>row.trim().startsWith('{'));if(line)try{finish(done,JSON.parse(line));}catch{}});child.once('error',error=>finish(fail,error));child.once('exit',code=>finish(fail,new Error('fixture exited '+code)));});
  assert.notEqual(new URL(fixture.url).port,'4191');
  browser=await chromium.launch({channel:'chrome',headless:true});
  for(const [prefix,viewport] of [['d',{width:1440,height:900}],['m',{width:390,height:844}]]){
    const context=await browser.newContext({viewport,locale:'ko-KR',timezoneId:'Asia/Seoul',reducedMotion:'reduce'});
    const login=await context.newPage();await login.goto(fixture.url,{waitUntil:'domcontentloaded'});
    await login.fill('input[placeholder="이메일 또는 기존 아이디"]',fixture.email);await login.fill('input[type="password"]',fixture.password);await login.press('input[type="password"]','Enter');
    await login.waitForURL(/tab=home/,{timeout:30000});await login.close();
    const page=await context.newPage();
    page.on('console',msg=>{if(msg.type()==='error')errors.push(`${prefix} console: ${msg.text()}`);});
    page.on('pageerror',error=>errors.push(`${prefix} pageerror: ${error.message}`));
    page.on('requestfailed',req=>{if(!/\/events$/.test(new URL(req.url()).pathname))errors.push(`${prefix} failed: ${req.url()} ${req.failure()?.errorText}`);});
    const s=(name,fn)=>step(prefix,name,fn),n=name=>`${prefix}-${name}`;
    // 제작 데스크
    await s('desk',async()=>{await go(page,'/?tab=workroom&section=desk','[data-workroom-desk]');await full(page,n('desk'));});
    await s('desk-guide',async()=>{await go(page,'/?tab=workroom&section=desk','[data-workroom-desk]');await openAll(page,'#wr-desk-guide,#wr-desk-guide details');await elementShot(page,n('desk-guide'),'#wr-desk-guide');});
    // 트렌드·레퍼런스
    await s('trends',async()=>{await go(page,'/?tab=workroom&section=trends','.cr-panel .cr-grid');await page.waitForSelector('.wr-daily-feed .wr-daily-group',{timeout:20000});await full(page,n('trends'));});
    await s('trends-open',async()=>{await go(page,'/?tab=workroom&section=trends','.cr-panel .cr-grid');await openAll(page,'[data-cr-sync-sources],.cr-source-help,.wr-daily-source-status,.wr-daily-related,.wr-trend-library,.wr-daily-reports');await full(page,n('trends-open'));});
    await s('guide-detail',async()=>{await go(page,'/?tab=workroom&section=trends','.cr-panel .cr-grid');await page.locator('.cr-guide-card [data-action="creative-detail"]').first().click();await modalShot(page,n('guide-detail'));await closeModal(page);});
    await s('references',async()=>{await go(page,'/?tab=workroom&section=trends','.cr-panel .cr-grid');await page.click('[data-action="creative-view"][data-id="references"]');await wait(page,800);await elementShot(page,n('references'),'.cr-panel');});
    await s('reference-detail',async()=>{await go(page,'/?tab=workroom&section=trends','.cr-panel .cr-grid');await page.click('[data-action="creative-view"][data-id="references"]');await wait(page,800);await page.locator('article.cr-card',{hasText:'질문 댓글에 영상으로 답하기'}).locator('[data-action="creative-detail"]').click();await modalShot(page,n('reference-detail'));await closeModal(page);});
    await s('tiktok-detail',async()=>{await go(page,'/?tab=workroom&section=trends','.cr-panel .cr-grid');await page.click('[data-action="creative-view"][data-id="references"]');await wait(page,800);await page.locator('article.cr-card',{hasText:'앱 설치 전후'}).locator('[data-action="creative-detail"]').click();await modalShot(page,n('tiktok-detail'));await closeModal(page);});
    await s('archived',async()=>{await go(page,'/?tab=workroom&section=trends','.cr-panel .cr-grid');await page.click('[data-action="creative-view"][data-id="references"]');await wait(page,600);await page.check('[data-cr-archived]');await wait(page,800);await elementShot(page,n('archived'),'.cr-panel');});
    await s('add-form',async()=>{await go(page,'/?tab=workroom&section=trends','.cr-panel .cr-grid');await page.click('[data-action="creative-add"]');await modalShot(page,n('add-choose'));await page.selectOption('.modal select[name="source"]','youtube-trends');await page.click('.modal button[type="submit"]');await wait(page,500);await openAll(page,'.modal details');await modalShot(page,n('add-youtube'));await closeModal(page);
      await page.click('[data-action="creative-add"]');await page.selectOption('.modal select[name="source"]','tiktok-top-ads');await page.click('.modal button[type="submit"]');await modalShot(page,n('add-tiktok'));await page.click('.modal [data-action="creative-manual"]');await openAll(page,'.modal details');await modalShot(page,n('add-tiktok-manual'));await closeModal(page);});
    await s('import-report',async()=>{await go(page,'/?tab=workroom&section=trends','.cr-panel .cr-grid');await page.click('[data-action="creative-import-report"]');await modalShot(page,n('import-report'));await closeModal(page);});
    await s('sync-settings',async()=>{await go(page,'/?tab=workroom&section=trends','.cr-panel .cr-grid');await page.click('[data-action="creative-sync-settings"]');await modalShot(page,n('sync-settings'));await closeModal(page);});
    await s('daily-settings',async()=>{await go(page,'/?tab=workroom&section=trends','.wr-daily-feed');await page.click('[data-action="workroom-daily-settings"]');await modalShot(page,n('daily-settings'));await closeModal(page);});
    // 내 관리 페이지
    await s('pages',async()=>{await go(page,'/?tab=workroom&section=pages','.wr-page-grid');await openAll(page,'.wr-pages-help');await full(page,n('pages'));await page.click('[data-action="workroom-register"]');await modalShot(page,n('register'));await closeModal(page);});
    // 콘텐츠 기획
    await s('content-library',async()=>{await go(page,'/?tab=content&section=library','.cp-draft-list');await full(page,n('content-library'));});
    await s('content-composer',async()=>{await go(page,'/?tab=content&section=library','.cp-draft-list');await page.click('[data-action="cp-new"]');await page.waitForSelector('.cp-composer');await openAll(page,'.cp-composer details');await full(page,n('content-composer'));});
    await s('content-result',async()=>{await go(page,'/?tab=content&section=library','.cp-draft-list');await page.locator('.cp-draft-row',{hasText:'회의 메모를 팀의 할 일로'}).first().click();await page.waitForSelector('.cp-result',{timeout:20000});await wait(page,800);await openAll(page,'.cp-result details');await full(page,n('content-result'));
      await page.click('[data-action="cp-request-review"]');await wait(page,1500);await modalShot(page,n('review-request'));await closeModal(page);});
    await s('content-guide',async()=>{await go(page,'/?tab=content&section=library','.cp-draft-list');await page.click('[data-action="cp-guide"]');await modalShot(page,n('content-guide'));await closeModal(page);});
    await s('examples',async()=>{await go(page,'/?tab=content&section=examples','.cp-example-nav');await page.waitForSelector('.cp-example-list',{timeout:20000});await full(page,n('examples-team'));
      await page.locator('[data-action="sw-example-open"]').first().click();await modalShot(page,n('example-detail'));await closeModal(page);
      await page.click('[data-action="cp-example-new"]');await modalShot(page,n('example-new'));await closeModal(page);
      await page.click('[data-action="cp-example-view"][data-view="benchmarks"]');await wait(page,1200);await full(page,n('examples-benchmarks'));
      await page.click('[data-action="cp-example-view"][data-view="discover"]');await wait(page,1200);await openAll(page,'.cp-find-reference');await full(page,n('examples-discover'));
      await page.click('[data-action="cp-reference"]');await modalShot(page,n('reference-new'));await closeModal(page);});
    // 제작 스튜디오(상황판·소재·예시·검토실)
    // 제작 스튜디오: master의 render()는 studio 탭을 콘텐츠 예시로 돌려보내므로 studioPage()를 본문에 직접 넣어 찍는다(CSP라 문자열 코드는 못 쓴다).
    const prep=()=>page.evaluate(async()=>{state.tab='studio';await swReload({renderPage:false});});
    const paint=async()=>{await page.evaluate(()=>{document.getElementById('main').innerHTML=studioPage();});await wait(page,700);};
    const view=async(name,filters={})=>{await prep();await page.evaluate(([name,filters])=>{sw.view=name;Object.assign(sw.filters,filters);},[name,filters]);await paint();};
    await s('studio',async()=>{await go(page,'/?tab=workroom&section=desk','[data-workroom-desk]');await view('board');await page.waitForSelector('.swb-production-list');await full(page,n('studio-board'));
      await view('board',{boardAssignee:'unassigned'});await elementShot(page,n('studio-board-empty'),'#swb-board-results');
      await view('materials',{boardAssignee:''});await page.waitForSelector('.swb-material-grid');await openAll(page,'.swb-material-full');await full(page,n('studio-materials'));
      await page.click('[data-action="sw-new-material"]');await openAll(page,'.modal details');await modalShot(page,n('material-new'));await closeModal(page);
      await page.locator('[data-action="sw-edit-material"]').first().click();await modalShot(page,n('material-edit'));await closeModal(page);
      await view('materials',{materialSearch:'없는검색어'});await elementShot(page,n('studio-materials-empty'),'#swb-material-results');
      await view('examples',{materialSearch:''});await full(page,n('studio-examples'));});
    const openReview=async(id,compare=false)=>{await prep();await page.evaluate(async([id,compare])=>{const r=await api('/api/studio-productions/'+encodeURIComponent(id));sw.productionId=id;swAcceptProduction(r.production);sw.view='review';swr.productionId=id;swr.versionId='';swr.compareId='';swr.noteScope='current';swr.showResolved=true;if(compare){const versions=swrVersions(swDetail());swr.versionId=versions[0].id;swr.compareId=versions[1]?.id||'';swr.noteScope='all';}},[id,compare]);await paint();};
    await s('review',async()=>{await go(page,'/?tab=workroom&section=desk','[data-workroom-desk]');await openReview(fixture.reviewProductionId);await page.waitForSelector('.swr-review');await full(page,n('review'));
      await openReview(fixture.reviewProductionId,true);await full(page,n('review-compare'));
      await page.click('[data-action="sw-review-version"]');await modalShot(page,n('version-new'));await closeModal(page);
      await prep();await page.evaluate(()=>{sw.view='review';sw.productionId='';sw.detail=null;document.getElementById('main').innerHTML=swReviewPage();});await wait(page,500);await elementShot(page,n('review-none'),'#main');});
    await s('review-ready',async()=>{await go(page,'/?tab=workroom&section=desk','[data-workroom-desk]');await openReview(fixture.readyProductionId);await page.waitForSelector('.swr-review');await full(page,n('review-ready'));
      await page.click('[data-action="sw-review-example"]');await modalShot(page,n('review-example'));await closeModal(page);});
    await context.close();
  }
}finally{
  try{await browser?.close();}finally{
    if(child){if(child.exitCode===null&&child.signalCode===null)child.kill();await childClosed;}
    const target=resolve(runDirectory),info=await lstat(target),actual=await realpath(target);
    assert.ok(info.isDirectory()&&!info.isSymbolicLink()&&actual===target&&dirname(actual)===temporaryRoot,'Unexpected QA temporary directory');
    await rm(target,{recursive:true,force:true});
  }
}
await writeFile(join(out,'texts.json'),JSON.stringify(texts,null,1));
await writeFile(join(out,'errors.txt'),[...errors,...overflow.map(row=>'넘침 '+row)].join('\n'));
console.log('찍음',out,'오류',errors.length,'넘침',overflow.length);
