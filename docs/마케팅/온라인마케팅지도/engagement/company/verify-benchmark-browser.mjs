// Disposable fixture database only. No live company data or external service calls.
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createCompanyApp} from './server.mjs';

if(!process.env.SYNK_PLAYWRIGHT_MODULE||!process.env.SYNK_BROWSER_EXE)throw new Error('SYNK_PLAYWRIGHT_MODULE과 SYNK_BROWSER_EXE를 지정하세요.');
const {chromium}=await import(pathToFileURL(process.env.SYNK_PLAYWRIGHT_MODULE));
const here=dirname(fileURLToPath(import.meta.url)),artifacts=join(here,'verification');
const directory=await mkdtemp(join(tmpdir(),'synk-benchmark-browser-'));
const checks=[],errors=[],expectedHttpErrors=[],externalAttempts=[],serverExternalAttempts=[];
const now=new Date(),at=minutes=>new Date(now.getTime()+minutes*60000).toISOString();
const kstDate=minutes=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(at(minutes)));
const malicious='<img src="https://benchmark-fixture.invalid/xss" onerror="window.__benchmarkXss=1">';
const report=(title,minutes)=>({version:1,title,scope:'임시 DB 검증용 합성 자료. 실제 조사·성과가 아닙니다.',periodStart:kstDate(-6*1440),periodEnd:kstDate(0),researchedAt:at(minutes),candidateCount:8,
  selectionBasis:'검증 시나리오에서 원문·기록의 연결을 확인하는 합성 자료입니다. 플랫폼 전체 순위가 아닙니다.',
  items:[
    {title:`검증용 ${malicious} 원문 제목 & 비교`,url:'https://www.instagram.com/reel/BM_FIXTURE_1/?utm_source=fixture',platform:'instagram',creator:'검증 전용 계정',publishedAt:kstDate(-2*1440),checkedAt:at(minutes-5),
      metrics:{views:12000,likes:234,comments:12,shares:null,saves:31,followers:3400},evidenceNote:'임시 데이터입니다. 실존 SNS 반응이 아니며 원문 연결과 미확인 표기만 검증합니다.',hook:'검증 도입: 같은 메모에서 빠진 담당자는 누구일까요?',structure:'문제 제시 → 누락 찾기 → 실제 원본과 대조 → 다음 행동',payoff:'담당자 확인 방법을 배우고 누락을 직접 발견하는 즐거움',brandFit:'SHIFT의 실제 업무 도움과 synkbrief 활용 구조에 맞는 검증 사례',adaptation:'직원이 가진 검증용 회의 메모에서 담당자와 기한을 비교하는 장면을 준비합니다.',seriesIds:['synkbrief-use']},
    {title:'검증용 한국어 카페 상황',url:'https://www.youtube.com/shorts/AbCdEfGhI12',platform:'youtube',creator:'검증 전용 학습 계정',publishedAt:kstDate(-3*1440),checkedAt:at(minutes-4),
      metrics:{views:5400,likes:98,comments:0,shares:null,saves:null,followers:null},evidenceNote:'임시 데이터입니다. 0과 미확인의 화면 구분을 확인합니다.',hook:'검증 도입: 다시 말해 달라고 부탁하려면?',structure:'짧은 상황 → 표현 설명 → 다시 말하기',payoff:'표현 하나를 익히고 직접 말하는 성취감',brandFit:'LAB 생활 상황극의 연습 구조 참고',adaptation:'AI 실사 인물의 카페 상황과 따라 말할 여백을 검토합니다.',seriesIds:['lab-situation']}
  ]});
const originalFetch=globalThis.fetch;
const rejectExternal=async input=>{serverExternalAttempts.push(String(input));throw new Error('External requests are disabled in benchmark browser fixtures.');};
globalThis.fetch=rejectExternal;
const app=createCompanyApp({dataDir:directory,port:4195,host:'127.0.0.1',origin:'http://127.0.0.1:4195',schedule:false,clock:()=>now.toISOString(),contentFetch:rejectExternal,collector:rejectExternal});
let browser,page;
const mark=name=>checks.push(name);
try{
  await mkdir(artifacts,{recursive:true});
  await app.start();
  const admin=app.store.createUser({name:'검증 관리자',email:'benchmark-admin@example.test',role:'admin',password:'benchmark-admin-password'});
  const member=app.store.createUser({name:'검증 기획 직원',email:'benchmark-member@example.test',role:'member',password:'benchmark-member-password'});
  const viewer=app.store.createUser({name:'검증 조회 직원',email:'benchmark-viewer@example.test',role:'viewer',password:'benchmark-viewer-password'});
  // Even a configured provider must stay unused throughout local research browsing/planning.
  app.store.setSecret('content-search:exa',{apiKey:'FIXTURE_NEVER_SEND',configuredBy:admin.id});
  browser=await chromium.launch({headless:true,executablePath:process.env.SYNK_BROWSER_EXE});
  const openUser=async(user,password)=>{
    const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
    await context.route('**/*',route=>{const url=route.request().url();if(new URL(url).origin===app.origin)return route.continue();externalAttempts.push(url);return route.abort();});
    const target=await context.newPage();
    target.on('pageerror',error=>errors.push(error.message));
    target.on('console',message=>{if(message.type()!=='error')return;const entry={text:message.text(),url:message.location().url};if(entry.url===app.origin+'/api/content-benchmarks/preview'&&/status of 400/.test(entry.text))expectedHttpErrors.push(entry);else errors.push(entry);});
    await target.goto(app.origin);
    await target.locator('[name="email"]').fill(user.email);
    await target.locator('[name="password"]').fill(password);
    await target.locator('[data-form="auth"] [type="submit"]').click();
    await target.locator('.sidebar').waitFor();
    await target.locator('.nav-item[data-tab="content"]').click();
    await target.locator('.bm-desk').waitFor();
    return {context,page:target};
  };
  const adminSession=await openUser(admin,'benchmark-admin-password');page=adminSession.page;
  assert.equal(await page.locator('.bm-card').count(),0);
  assert.match(await page.locator('.bm-empty').innerText(),/아직 등록된 조사 자료가 없습니다/);
  assert.equal(app.store.all('contentBenchmarkIssues').length,0);
  mark('empty-benchmarks-no-fabricated-records');
  const promptResponse=await adminSession.context.request.get(app.origin+'/api/content-benchmarks/research-prompt');
  assert.equal(promptResponse.status(),200);assert.match((await promptResponse.json()).prompt,/시청자 입장에서/);
  const templateResponse=await adminSession.context.request.get(app.origin+'/api/content-benchmarks/template');
  assert.equal(templateResponse.status(),200);assert.equal((await templateResponse.json()).template.candidateCount,0);
  mark('admin-research-prompt-and-unfinished-template');

  const openImport=async()=>{await page.locator('[data-action="cp-bm-import"]').first().click();await page.locator('[data-bm-form="preview"]').waitFor();};
  const upload=async(value,expectedStatus=200)=>{
    const raw=typeof value==='string'?value:JSON.stringify(value);
    await page.locator('[data-bm-file]').setInputFiles({name:'benchmark-fixture.json',mimeType:'application/json',buffer:Buffer.from(raw)});
    await page.waitForFunction(expected=>document.querySelector('[data-bm-form="preview"] [name="report"]')?.value===expected,raw);
    const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/content-benchmarks/preview'&&r.request().method()==='POST');
    await page.locator('[data-bm-form="preview"] [type="submit"]').click();
    assert.equal((await response).status(),expectedStatus);
  };
  const publish=async()=>{
    const consent=page.locator('[data-bm-form="publish"] [name="reviewConfirmed"]');
    await consent.check();
    const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/content-benchmarks'&&r.request().method()==='POST');
    await page.locator('[data-bm-form="publish"] [type="submit"]').click();
    const result=await response;assert.equal(result.status(),201);
    const issue=(await result.json()).issue;
    await page.locator('[data-bm-form="publish"]').waitFor({state:'hidden'});
    await page.locator('.bm-desk .bm-issue').waitFor();
    return issue;
  };
  const responsive=async(target,label)=>{
    for(const width of [1440,768,390,320]){
      await target.setViewportSize({width,height:1000});
      const dimensions=await target.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));
      assert.ok(dimensions.document<=width+1&&dimensions.body<=width+1,`${label} overflow ${width}: ${JSON.stringify(dimensions)}`);
    }
    mark(`${label}-responsive-1440-768-390-320`);
  };
  await openImport();
  await upload(await readFile(join(here,'benchmark-upload-template.json'),'utf8'),400);
  await page.locator('[data-bm-form="preview"] .form-error').filter({hasText:/날짜|조사 기간|실제/}).waitFor();
  assert.equal(app.store.all('contentBenchmarkIssues').length,0);
  mark('unfinished-template-rejected-with-actionable-error');
  const firstReport=report('검증 자료 1호',-30);
  await upload(firstReport);
  await page.locator('#bm-preview .bm-card').first().waitFor();
  assert.equal(app.store.all('contentBenchmarkIssues').length,0);
  assert.match(await page.locator('#bm-preview').innerText(),/형식 검사만 완료/);
  assert.equal(await page.locator('#bm-preview img').count(),0);
  assert.equal(await page.evaluate(()=>window.__benchmarkXss),undefined);
  assert.match(await page.locator('#bm-preview .bm-card h4').first().textContent(),/원문 제목 & 비교/);
  const consent=page.locator('[data-bm-form="publish"] [name="reviewConfirmed"]');
  assert.equal(await consent.isChecked(),false);assert.equal(await consent.getAttribute('required'),'');
  await page.locator('[data-bm-form="publish"] [type="submit"]').click();
  assert.equal(await consent.evaluate(node=>node.validity.valueMissing),true);
  assert.equal(app.store.all('contentBenchmarkIssues').length,0);
  mark('preview-does-not-save-and-sharing-requires-checkbox');
  await page.screenshot({path:join(artifacts,'benchmark-preview-fixture.png'),fullPage:false,animations:'disabled'});
  await responsive(page,'preview');await page.setViewportSize({width:1440,height:1000});
  const firstIssue=await publish();
  assert.equal(app.store.all('contentBenchmarkIssues').length,1);
  assert.equal(firstIssue.evidenceStatus,'admin-submitted');
  assert.equal(firstIssue.items[0].metrics.shares,null);
  assert.equal(firstIssue.items[1].metrics.comments,0);
  assert.match(await page.locator('.bm-desk .bm-issue').innerText(),/확인 가능한 2개 사례/);
  mark('checked-report-shared-with-unknown-and-zero-distinct');

  await openImport();await upload(report(`검증 자료 2호 ${malicious}`,-1));const secondIssue=await publish();
  assert.equal(app.store.all('contentBenchmarkIssues').length,2);
  let workspace=(await (await adminSession.context.request.get(app.origin+'/api/content-workspace')).json());
  assert.equal(workspace.benchmark.current.id,secondIssue.id);assert.equal(workspace.benchmark.history.length,2);
  assert.equal(await page.locator('[data-bm-history] option').count(),2);
  await page.locator('[data-bm-history]').selectOption(firstIssue.id);
  await page.locator('.bm-desk .bm-issue > h4').filter({hasText:'검증 자료 1호'}).waitFor();
  await page.locator('[data-bm-history]').selectOption(secondIssue.id);
  await page.locator('.bm-desk .bm-issue > h4').filter({hasText:'검증 자료 2호'}).waitFor();
  assert.equal(await page.locator('.bm-desk img').count(),0);
  assert.equal(await page.evaluate(()=>window.__benchmarkXss),undefined);
  const original=page.locator('.bm-card h4 a').first();
  assert.equal(await original.getAttribute('href'),'https://www.instagram.com/reel/BM_FIXTURE_1/');
  assert.equal(await original.getAttribute('target'),'_blank');assert.match(await original.getAttribute('rel'),/noopener noreferrer/);
  mark('latest-report-and-two-history-items-with-safe-original-links');
  await page.screenshot({path:join(artifacts,'benchmark-overview-fixture.png'),fullPage:false,animations:'disabled'});
  await responsive(page,'benchmark-overview');
  await page.setViewportSize({width:390,height:1000});
  await page.screenshot({path:join(artifacts,'benchmark-mobile-fixture.png'),fullPage:true,animations:'disabled'});

  const memberSession=await openUser(member,'benchmark-member-password');page=memberSession.page;
  assert.equal(await page.locator('[data-action="cp-bm-import"]').count(),0);
  assert.match(await page.locator('.bm-desk .bm-issue > h4').innerText(),/검증 자료 2호/);
  await page.locator('[data-action="cp-bm-use"]').first().click();
  await page.locator('[data-cp-form="generate"]').waitFor();
  assert.equal(await page.locator('[name="benchmarkId"]').inputValue(),secondIssue.id);
  assert.equal(await page.locator('[name="benchmarkItemId"]').inputValue(),secondIssue.items[0].id);
  assert.equal(await page.locator('[name^="person-"]').count(),3);
  const personalization={situation:'검증 상황: 긴 회의 메모를 처음 정리하는 신입 팀원',choice:'검증 선택: 시간이 짧으면 3줄 요약, 인계할 때는 담당자 표',nextStep:'검증 다음 행동: 메모 한 개에서 담당자와 기한을 원본과 대조'};
  for(const [name,value] of Object.entries({topic:'검증용 내 회의 메모 정리',audience:'처음 메모를 정리하는 직원',experience:'검증용 회의에서 담당자를 놓친 경험',proof:'합성 회의 원본과 담당자 표를 비교하는 검증 자료',takeaway:'담당자·기한을 빠짐없이 확인하는 방법',entertainment:'누락된 한 칸을 먼저 찾고 답을 공개하는 발견','auth-basis':'검증용 직접 경험과 합성 자료를 구분','auth-ownPerspective':'속도보다 인계할 사람이 이해하는지 확인','auth-limits':'실제 업무 효과는 아직 측정하지 않음','auth-disclosure':'검증용 합성 원문과 예시라고 표시',...Object.fromEntries(Object.entries(personalization).map(([key,value])=>['person-'+key,value]))}))await page.locator(`[data-cp-form="generate"] [name="${name}"]`).fill(value);
  await responsive(page,'personalized-composer');await page.setViewportSize({width:1440,height:1000});
  const generated=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/content-generate'&&r.request().method()==='POST');
  await page.locator('[data-cp-form="generate"] [type="submit"]').click();
  const generatedResponse=await generated;assert.ok(generatedResponse.ok());const draft=(await generatedResponse.json()).draft;
  await page.locator('.cp-result').waitFor();await page.locator('.bm-axis').first().waitFor();
  assert.deepEqual(draft.input.personalization,personalization);
  assert.equal(draft.benchmarkId,secondIssue.id);assert.equal(draft.input.reference.url,secondIssue.items[0].url);
  assert.equal(draft.input.reference.title,secondIssue.items[0].title);assert.equal(draft.input.reference.checkedAt,secondIssue.items[0].checkedAt);
  assert.deepEqual(draft.input.reference.reactions,secondIssue.items[0].metrics);
  assert.deepEqual(draft.plan.reviewAxes.map(axis=>axis.id),['fun','usefulness','authenticity','personalization']);
  assert.equal(await page.locator('.bm-axis').count(),4);
  for(const label of ['재미와 몰입','도움과 이해','진정성과 사실','SYNK다운 개인화'])assert.match(await page.locator('.bm-review').innerText(),new RegExp(label));
  assert.match(await page.locator('.cp-result').innerText(),/검증 상황|긴 회의 메모/);
  assert.equal(app.store.all('contentDrafts').length,1);
  mark('employee-planning-preserves-reference-personalization-and-four-review-axes');
  await page.locator('.cp-idea-option').nth(1).click();await page.locator('[data-action="cp-select-idea"]').click();
  await page.getByRole('button',{name:'이 구성으로 선택됨',exact:true}).waitFor();
  const exportResponse=await memberSession.context.request.get(app.origin+'/api/content-drafts/'+draft.id+'/export');
  assert.equal(exportResponse.status(),200);const markdown=await exportResponse.text();
  for(const text of ['개인화 방향 검토','회사 참고 선정 기록','BM\\_FIXTURE\\_1','검증 선택','검증 다음 행동'])assert.ok(markdown.includes(text),`export missing ${text}`);
  assert.ok(app.store.get('contentDrafts',draft.id).selectedIdeaId);
  mark('selected-idea-markdown-export-keeps-source-and-personalized-actions');
  await page.screenshot({path:join(artifacts,'benchmark-plan-fixture.png'),fullPage:false,animations:'disabled'});
  for(const [index,axis] of draft.plan.reviewAxes.entries()){
    const detail=page.locator('.bm-axis').nth(index);
    await detail.locator('summary').click();
    assert.equal(await detail.getAttribute('open'),'');
    const visibleText=await detail.innerText();
    for(const text of [axis.reason,axis.nextAction,...axis.questions,...axis.evidence])assert.ok(visibleText.includes(text),`review ${axis.id} missing visible content`);
  }
  mark('four-review-accordions-show-reasons-evidence-questions-and-next-actions');
  await page.locator('.bm-review').screenshot({path:join(artifacts,'benchmark-review-axes-fixture.png'),animations:'disabled'});
  await responsive(page,'benchmark-plan');
  await page.setViewportSize({width:390,height:1000});
  await page.screenshot({path:join(artifacts,'benchmark-plan-mobile-fixture.png'),fullPage:true,animations:'disabled'});
  await page.locator('.bm-review').screenshot({path:join(artifacts,'benchmark-review-axes-mobile-fixture.png'),animations:'disabled'});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('[data-action="cp-view"][data-view="discover"]').click();
  await page.locator('[data-cp-form="search"] [name="query"]').fill('검증');
  const searchResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/content-search'&&r.request().method()==='POST');
  await page.locator('[data-cp-form="search"] [type="submit"]').click();
  const search=await searchResponse;assert.equal(search.status(),200);assert.equal((await search.json()).mode,'local');
  assert.equal(serverExternalAttempts.length,0);
  mark('local-search-does-not-call-configured-exa-provider');

  const viewerSession=await openUser(viewer,'benchmark-viewer-password');page=viewerSession.page;
  assert.equal(await page.locator('.bm-card').count(),2);
  assert.equal(await page.locator('[data-action="cp-bm-import"]').count(),0);
  assert.equal(await page.locator('[data-action="cp-bm-use"]').count(),0);
  assert.match(await page.locator('.bm-desk .bm-issue > h4').innerText(),/검증 자료 2호/);
  const viewerWorkspace=await (await viewerSession.context.request.get(app.origin+'/api/content-workspace')).json();
  assert.equal(viewerWorkspace.benchmark.current.id,secondIssue.id);assert.equal(viewerWorkspace.benchmark.history.length,2);assert.equal(viewerWorkspace.drafts.length,0);
  assert.equal((await viewerSession.context.request.get(app.origin+'/api/content-benchmarks/template')).status(),403);
  assert.equal((await viewerSession.context.request.get(app.origin+'/api/content-drafts/'+draft.id)).status(),404);
  mark('viewer-reads-shared-research-without-admin-upload-or-private-draft-access');
  assert.deepEqual(errors,[]);assert.deepEqual(externalAttempts,[]);assert.deepEqual(serverExternalAttempts,[]);
  mark('zero-unexpected-console-errors-and-zero-external-requests');
  const results={passed:checks.length,checks,errors,expectedHttpErrors,externalAttempts,serverExternalAttempts,fixtureOnly:true,port:4195};
  await writeFile(join(artifacts,'benchmark-browser-results.json'),JSON.stringify(results,null,2));
  await rm(join(artifacts,'benchmark-browser-failure.json'),{force:true});
  await rm(join(artifacts,'benchmark-failure-fixture.png'),{force:true});
  console.log(JSON.stringify(results,null,2));
}catch(error){
  if(page)await page.screenshot({path:join(artifacts,'benchmark-failure-fixture.png'),fullPage:true,animations:'disabled'}).catch(()=>{});
  await writeFile(join(artifacts,'benchmark-browser-failure.json'),JSON.stringify({checks,errors,expectedHttpErrors,externalAttempts,serverExternalAttempts,error:String(error)},null,2)).catch(()=>{});
  throw error;
}finally{
  if(browser)await browser.close();await app.stop();globalThis.fetch=originalFetch;
  const cleanupTarget=resolve(directory),expectedParent=resolve(tmpdir());
  if(dirname(cleanupTarget)!==expectedParent||!cleanupTarget.startsWith(join(expectedParent,'synk-benchmark-browser-')))throw new Error('Unexpected cleanup target');
  await rm(cleanupTarget,{recursive:true,force:true});
}
