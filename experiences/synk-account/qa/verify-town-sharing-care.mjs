// Actual student controls + current classroom/play services with synthetic identities.
// All PostgreSQL data is in memory. No operating account or external service is used.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,join} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),talk=resolve(root,'../SYNK-talk');
const require=createRequire(import.meta.url);
const {createFixture,chromium}=require(join(talk,'tools/qa-synk-classroom-fixture.cjs'));
const play=require(join(talk,'supabase/functions/_shared/synk-play-runtime.js'));
const out=join(root,'docs/_ops/qa/workspace-care-20261009/student');
const report={synthetic:true,production:false,startedAt:new Date().toISOString(),checks:[],errors:[],unexpectedRequests:[],screenshots:[]};
const check=(name,value,detail)=>{report.checks.push({name,ok:!!value,...(detail===undefined?{}:{detail})});assert.ok(value,name);};
let fixture,browser,page;
try{
  await mkdir(out,{recursive:true});fixture=await createFixture();
  await fixture.db.exec(await readFile(join(talk,'supabase/migrations/20261009230000_synk_teaching_care_towns_c16.sql'),'utf8'));
  // The existing isolated fixture builds the account schema directly. This marker
  // represents that fixture bootstrap; this does not test the predecessor migration.
  await fixture.db.exec("insert into engine.schema_migrations values('20261003006000','synthetic fixture account bootstrap','fixture') on conflict do nothing");
  await fixture.db.exec(await readFile(join(talk,'supabase/migrations/20261009170000_synk_play_c16.sql'),'utf8'));
  const playHandler=play.createPlayService({store:play.createPlayStore(fixture.sql,{model:play.model,economy:play.economy}),model:play.model,economy:play.economy,awardAccountRace:play.awardAccountRace,enabled:()=>true,verify:async request=>{
    assert.equal(request.headers.get('authorization'),'Bearer synthetic-learner');return fixture.users.learner.identity;
  }});
  browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({viewport:{width:1280,height:960}});page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',error=>report.errors.push(error.message));
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==fixture.base&&!['data:','blob:'].includes(url.protocol)){report.unexpectedRequests.push(url.href);return route.abort();}
    if(url.pathname==='/functions/v1/synk-play'){
      const response=await playHandler(new Request(req.url(),{method:req.method(),headers:req.headers(),...(req.method()==='POST'?{body:req.postData()}:{})}));
      return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
    }
    return route.continue();
  });
  const membership=()=>fixture.api('learner','/api/world/town/membership');
  const townStatus=()=>page.locator('[data-town-sharing-status]');
  const toggle=()=>page.locator('[data-town-sharing]');
  await page.goto(fixture.base+'/synk-account/qa.html?role=learner');await page.waitForFunction(()=>document.documentElement.dataset.qa==='ready');
  await townStatus().filter({hasText:'수업 기록 공유를 먼저'}).waitFor();
  check('Town summary begins disabled while classroom learning sharing is off',!await toggle().isChecked()&&await toggle().isDisabled()&&!(await membership()).townSharing.enabled);
  await page.locator('[data-sharing-toggle] input').check();await townStatus().filter({hasText:'활동 요약 공유 꺼짐'}).waitFor();
  check('enabling language sharing does not grant Town summary sharing',!await toggle().isChecked()&&!(await membership()).townSharing.enabled);
  for(const width of [1280,390,320]){
    await page.setViewportSize({width,height:960});await toggle().scrollIntoViewIfNeeded();
    const size=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));check('student sharing fits '+width,size.scroll<=size.width,size);
    const file=join(out,'student-sharing-'+width+'.png');await page.screenshot({path:file,fullPage:false});report.screenshots.push(file);
  }
  await toggle().check();await townStatus().filter({hasText:'활동 요약 공유 켜짐'}).waitFor();
  const enabled=await membership();check('student explicitly enables a separate persisted Town sharing revision',enabled.townSharing.enabled&&enabled.townSharing.revision>1&&enabled.membership.learnerId===fixture.users.learner.id);
  await page.locator('[data-world-action=open][data-kind=practice][data-id=town-reading]').click();await page.locator('[data-world-action=start-game]').click();
  await page.locator('#world-games iframe').waitFor({state:'visible'});
  const frame=await page.locator('#world-games iframe').elementHandle().then(handle=>handle.contentFrame());
  await frame.locator('[data-command=CHOOSE]').first().waitFor();
  const w1=await fixture.api('teacher','/api/workspace'),l1=w1.classes.flatMap(c=>c.learners).find(l=>l.id===fixture.users.learner.id);
  check('opening the real Town frame creates one client-reported visit under its academy membership',l1.activity.town.activityCount===1&&l1.activity.town.recent[0].activity==='town-opened'&&l1.activity.town.recent[0].source==='client-reported');
  const beforeWorld=l1.activity.world.eventCount;
  await frame.locator('[data-command=CHOOSE]').first().click();
  await page.waitForFunction(async()=>{const r=await window.SYNKTownHost.read();return r.state.revision>0;});
  const w2=await fixture.api('teacher','/api/workspace'),l2=w2.classes.flatMap(c=>c.learners).find(l=>l.id===fixture.users.learner.id);
  check('actual Town controls persist a server-command activity summary',l2.activity.town.recent.some(row=>row.source==='server-command'&&row.activity==='CHOOSE'));
  check('life activity does not manufacture language evidence',l2.activity.world.eventCount===beforeWorld&&l2.activity.town.learningEvidence===false);
  await page.evaluate(()=>window.SYNKTownHost.read());
  const w3=await fixture.api('teacher','/api/workspace'),l3=w3.classes.flatMap(c=>c.learners).find(l=>l.id===fixture.users.learner.id);
  check('refreshing Town state does not duplicate the visit',l3.activity.town.recent.filter(row=>row.activity==='town-opened').length===1);
  await page.evaluate(()=>window.__oldTownHost=window.SYNKTownHost);await toggle().uncheck();await townStatus().filter({hasText:'활동 요약 공유 꺼짐'}).waitFor();
  check('student revocation closes the current Town frame immediately',await page.locator('#world-games iframe').isHidden());
  check('a captured old Town host cannot read after student revocation',await page.evaluate(async()=>{try{await window.__oldTownHost.read();return false;}catch{return true;}}));
  const revoked=await fixture.api('teacher','/api/workspace'),learner=revoked.classes.flatMap(c=>c.learners).find(l=>l.id===fixture.users.learner.id);
  check('teacher loses previously shared Town summaries on revocation',learner.activity.town.status==='sharing-disabled'&&learner.activity.town.recent.length===0&&learner.activity.town.activityCount===0);
  await toggle().check();await townStatus().filter({hasText:'활동 요약 공유 켜짐'}).waitFor();
  const again=await fixture.api('teacher','/api/workspace'),reconsent=again.classes.flatMap(c=>c.learners).find(l=>l.id===fixture.users.learner.id);
  check('new Town consent does not republish old activity',reconsent.activity.town.status==='no-record'&&reconsent.activity.town.activityCount===0);
  await page.locator('[data-sharing-toggle] input').uncheck();await townStatus().filter({hasText:'수업 기록 공유를 먼저'}).waitFor();
  check('turning off the parent learning grant also revokes Town sharing',(await membership()).townSharing.enabled===false&&await toggle().isDisabled());
  await page.reload();await page.waitForFunction(()=>document.documentElement.dataset.qa==='ready');await townStatus().filter({hasText:'수업 기록 공유를 먼저'}).waitFor();
  check('the revoked state survives a new student page',!await toggle().isChecked());
  check('browser runtime and isolated HTTP service have no errors',report.errors.length===0&&fixture.errors.length===0,{browser:report.errors,service:fixture.errors});
  check('the complete flow sends no request to an external service',report.unexpectedRequests.length===0);
  report.ok=true;
}catch(error){report.ok=false;report.errors.push(error.stack||String(error));if(page)await page.screenshot({path:join(out,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1;}
finally{report.finishedAt=new Date().toISOString();await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await fixture?.close();console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,errors:report.errors,report:join(out,'report.json')}));}
