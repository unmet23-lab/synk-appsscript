'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createServer}=require('../tools/운영홈');
const ROOT=path.resolve(__dirname,'..');

test('업무 다음 일·백업 수리 근거·서로 다른 측정 기간을 PC와 휴대폰에서 구분해 읽는다',{timeout:90000},async t=>{
  const {chromium}=require(require.resolve('playwright',{paths:[ROOT,path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules')]}));
  const outputRoot=path.join(ROOT,'.tmp','business-automation-20261020');fs.mkdirSync(outputRoot,{recursive:true});
  const out=fs.mkdtempSync(path.join(outputRoot,'browser-')),at=new Date().toISOString(),backup=path.join(out,'vault'),cache=path.join(out,'sns-cache.json'),fixtureRoot=path.join(out,'repo'),hermesHome=path.join(out,'hermes');
  fs.mkdirSync(backup);fs.mkdirSync(hermesHome);
  fs.mkdirSync(path.join(fixtureRoot,'docs','_ops'),{recursive:true});
  const trackFile=path.join(fixtureRoot,'docs','_ops','트랙.md');
  fs.writeFileSync(trackFile,'# 검증용 트랙\n## 제작 업무\n- **합성 제작 확인:** 담당: 제작 담당. 남은 일: 검증용 시안을 확인한다. [결과](qa/fixture.json)\n');
  fs.writeFileSync(path.join(fixtureRoot,'docs','마케팅_정본.md'),'# 검증용 마케팅\n합성 성과 자료의 측정 기간을 확인합니다.\n');
  fs.mkdirSync(path.join(fixtureRoot,'docs','_ops','qa'));fs.writeFileSync(path.join(fixtureRoot,'docs','_ops','qa','fixture.json'),'{}');
  for(const file of ['docs/tools/synk-tokens.css','docs/브랜드_폰트/SUIT/SUIT-Variable.woff2','docs/브랜드_폰트/InterTight/InterTight-Regular.ttf','docs/브랜드_폰트/InterTight/InterTight-Bold.ttf','docs/브랜드_폰트/DM_Mono/DMMono-Regular.ttf']){
    const source=path.join(ROOT,file);if(!fs.existsSync(source))continue;
    fs.mkdirSync(path.dirname(path.join(fixtureRoot,file)),{recursive:true});fs.copyFileSync(source,path.join(fixtureRoot,file));
  }
  const write=(file,value)=>fs.writeFileSync(file,JSON.stringify(value));
  write(path.join(backup,'backup-health.json'),{schemaVersion:1,checkedAt:at,components:[{id:'server',status:'healthy',checkedAt:at,lastSuccessAt:at,repaired:true,repairedAt:at}]});
  write(path.join(backup,'backup-status.json'),{runId:'test-run',status:'partial_failure',steps:[{id:'argon',status:'failed'}]});
  write(path.join(backup,'backup-repair-status.json'),{schemaVersion:1,status:'success',repairOfRunId:'test-run',finishedAt:at,repairedStepIds:['argon'],steps:[{id:'argon',status:'success'}]});
  write(cache,{version:1,performance:{schemaVersion:1,checkedAt:at,appRunning:true,
    channels:[{id:'example',platform:'youtube',label:'검증용 공개 채널',url:'https://youtube.com/@example',snapshot:{checkedAt:at,views:9000,followers:0,postCount:12}}],
    entries:[{id:'example-post',channelId:'example',title:'측정 기간 검증용 게시물',url:'https://youtube.com/watch?v=example',publishedAt:'2026-10-15T08:30:00Z',
      checkpoints:[{hours:72,status:'recorded',observedAt:at,source:'api:youtube',metrics:{views:100,likes:0,averageWatchSeconds:12},
        metricProvenance:{averageWatchSeconds:{source:'api:youtube',observedAt:at,kind:'window',startDate:'2026-10-15',endDate:'2026-10-17',timeZone:'America/Los_Angeles',estimated:false}}}]}]}});
  const server=createServer({root:fixtureRoot,port:0,backupRoot:backup,hermesHome,snsCacheFile:cache});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const browser=await chromium.launch({channel:'chrome',headless:true});
  t.after(async()=>{await browser.close();await new Promise(resolve=>server.close(resolve));});
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],url='http://127.0.0.1:'+server.address().port;
  let resumeReads=0;page.on('request',r=>{if(r.url().startsWith(url+'/api/resume?'))resumeReads++;});
  page.on('pageerror',e=>errors.push(e.message));
  async function noOverflow(){const box=await page.evaluate(()=>({document:document.documentElement.scrollWidth,width:innerWidth,viewport:visualViewport.width}));assert.ok(box.document<=box.width+1&&box.width<=box.viewport+1,JSON.stringify(box));}
  try{
    await page.goto(url,{waitUntil:'domcontentloaded'});
    const state=await page.request.get(url+'/api/state');assert.equal((await state.json()).operations.runs.length,0,'empty injected Hermes fixture');
    await page.getByRole('heading',{name:'업무 단계와 근거',exact:true}).waitFor();
    await page.getByText('구성요소 1개 · 성공 시각과 근거',{exact:true}).click();
    await page.getByText(/실패 단계 보완 확인/).waitFor();
    assert.match(await page.locator('.backup-component').innerText(),/backup-repair-status\.json/);
    await page.locator('.maintenance').screenshot({path:path.join(out,'backup-work-desktop.png')});
    await page.goto(url+'/#activity');
    await page.getByRole('heading',{name:'업무 단계와 근거',exact:true}).waitFor();
    assert.ok(await page.locator('.work-meta').count()>0);
    await noOverflow();
    await page.goto(url+'/#marketing');
    await page.getByRole('heading',{name:'기존 수집 성과',exact:true}).waitFor();
    const section=page.locator('.performance-summary');
    await section.locator('.performance-observation > summary').first().click();
    assert.match(await section.innerText(),/9,000/);
    assert.match(await section.innerText(),/2026-10-15~2026-10-17.*America\/Los_Angeles/);
    assert.match(await section.innerText(),/게시 72시간 관측/);
    assert.match(await section.innerText(),/미확인/);
    await section.screenshot({path:path.join(out,'performance-desktop.png')});
    await page.setViewportSize({width:390,height:844});await noOverflow();
    await section.screenshot({path:path.join(out,'performance-mobile.png')});
    await page.goto(url+'/#activity');await page.locator('.work-meta').first().waitFor();await noOverflow();
    await page.locator('.pending-row').first().screenshot({path:path.join(out,'work-mobile.png')});
    await page.evaluate(()=>{window.qaNow=Date.now();Date.now=()=>window.qaNow;});
    async function openResume(){
      await page.evaluate(()=>{location.hash='#resume';});
      await page.locator('.resume-grid').waitFor({state:'detached'});
      await page.evaluate(()=>{location.hash='#resume/workflow';});
      await page.getByRole('heading',{name:'현재 작업본의 변경',exact:true}).waitFor();
    }
    await openResume();assert.equal(resumeReads,1);
    await page.evaluate(()=>{window.qaNow+=30_000;});await openResume();assert.equal(resumeReads,1,'30 second rerenders reuse the same checked snapshot');
    await page.evaluate(()=>{window.qaNow+=31_000;});await openResume();assert.equal(resumeReads,2,'uncommitted Git changes are rechecked after at most one minute');
    await Promise.all([page.waitForResponse(r=>r.url().startsWith(url+'/api/resume?')),page.locator('#refresh').click()]);assert.equal(resumeReads,3,'manual refresh bypasses the cache');
    fs.appendFileSync(trackFile,'- **추가 합성 작업:** 다음 단계: 바뀐 원문을 확인한다.\n');
    await Promise.all([page.waitForResponse(r=>r.url().startsWith(url+'/api/resume?')),page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')))]);
    assert.equal(resumeReads,4,'source revision changes invalidate the cache immediately');
    assert.deepEqual(errors,[]);
    write(path.join(out,'verification.json'),{ok:true,synthetic:true,at,desktop:true,mobile:true,repairProof:true,pointVsWindow:true,accountVsPost:true,isolatedHermes:true,syntheticTrack:true,resumeReads,pageErrors:errors});
    console.log('업무·백업·성과 화면 확인: '+path.relative(ROOT,path.join(out,'verification.json')));
  }catch(error){await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});write(path.join(out,'verification.json'),{ok:false,synthetic:true,at,error:error.message,pageErrors:errors});throw error;}
});
