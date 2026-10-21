// 기획 엔진 글 전후 캡처: node capture-engine.mjs <회사 폴더> <출력 폴더> [--only a,b]
// capture.mjs와 같은 합성 서버(qa/fixture.mjs)를 내 임시 폴더로 띄우고, 화면 안 api()로 기획 셋(개인화·개인 참고 · 회사 벤치마크 · 제작 여정)과
// 벤치마크 조사 자료 하나를 더 만든 뒤 1440·390px로 찍는다. 기획 쓰기·기획 결과 다섯·제작 기준·벤치마크로 기획하기·데스크 「유형별 기획 양식」(1440은 열 유형, 390은 셋).
// 화면마다 사진·보이는 글(texts.json)·콘솔 오류·실패 요청·가로 넘침과 내려받기 기획안 둘(export-*.md)을 남긴다. 끝나면 서버를 끄고 그 임시 폴더를 지운다.
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
let child,childClosed,browser,fixture,made;const texts={},errors=[],overflow=[];
const wait=(page,ms)=>page.waitForTimeout(ms);
async function tall(page,fn,height=3200){const size=page.viewportSize();await page.setViewportSize({width:size.width,height});await wait(page,400);try{await fn();}finally{await page.setViewportSize(size);await wait(page,250);}}
async function checkOverflow(page,name){const result=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,inner:innerWidth,visual:visualViewport?.width||innerWidth}));if(result.scroll>result.inner+1||result.inner>result.visual+1)overflow.push(`${name}: scroll ${result.scroll} inner ${result.inner} visual ${result.visual}`);}
async function full(page,name){await checkOverflow(page,name);const height=await page.evaluate(()=>{const main=document.getElementById('main');return Math.max(document.documentElement.scrollHeight,main?Math.ceil(main.scrollHeight+main.getBoundingClientRect().top+40):0);});const size=page.viewportSize();await page.setViewportSize({width:size.width,height:Math.min(16000,Math.max(size.height,height))});await wait(page,600);await page.screenshot({path:join(out,name+'.png'),fullPage:true});await page.setViewportSize(size);await wait(page,250);texts[name]=await page.evaluate(()=>(document.getElementById('main')||document.body).innerText);}
async function modalShot(page,name){await page.waitForSelector('.modal',{timeout:8000});await wait(page,500);await checkOverflow(page,name);await tall(page,async()=>{await page.locator('.modal').first().screenshot({path:join(out,name+'.png')});});texts[name]=await page.evaluate(()=>document.querySelector('.modal')?.innerText||'');}
async function elementShot(page,name,selector){const node=page.locator(selector).first();if(!await node.count()){errors.push(`${name}: 없음 ${selector}`);return;}await checkOverflow(page,name);await node.scrollIntoViewIfNeeded();await wait(page,250);await node.screenshot({path:join(out,name+'.png')});texts[name]=await node.innerText();}
async function closeModal(page){if(await page.locator('.modal').count()){await page.keyboard.press('Escape');await wait(page,300);if(await page.locator('.modal').count()){await page.locator('.modal [data-action="close-modal"]').first().click().catch(()=>{});await wait(page,300);}}}
async function openAll(page,selector){await page.evaluate(s=>{for(const node of document.querySelectorAll(s))node.open=true;},selector);await wait(page,250);}
async function go(page,path,selector){await page.goto(new URL(path,fixture.url).href,{waitUntil:'domcontentloaded'});await page.waitForSelector(selector,{timeout:20000});await wait(page,1500);}
async function step(prefix,name,fn){if(only&&!only.includes(name))return;try{await fn();}catch(error){errors.push(`${prefix}-${name}: ${error.message.split('\n')[0]}`);}}
async function openDraft(page,title){await go(page,'/?tab=content&section=library','.cp-draft-list');await page.locator('.cp-draft-row',{hasText:title}).first().click();await page.waitForSelector('.cp-result',{timeout:20000});await wait(page,800);await openAll(page,'.cp-result details');}

// 벤치마크 조사 자료: verify-benchmark-browser.mjs의 꼴을 따른 합성 자료(실제 조사·반응 아님). 첫 사례는 synkbrief 활용 지정이라 뉴스로 기획하면 「지정 시리즈」 질문이 나온다.
const kst=offsetDays=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+offsetDays*86400000));
const benchmarkReport=()=>({version:1,title:'회의 정리 콘텐츠 참고',scope:'합성 확인용 자료 · 업무 정리 릴스 8개 중 둘',periodStart:kst(-6),periodEnd:kst(0),researchedAt:new Date(Date.now()-3600000).toISOString(),candidateCount:8,
  selectionBasis:'업무를 처음 맡은 사람이 자기 메모로 따라 할 수 있는 구성을 골랐어요(합성 자료).',
  items:[
    {title:'빠진 담당자를 먼저 찾게 하는 릴스',url:'https://www.instagram.com/reel/EngineCopy01/',platform:'instagram',creator:'합성 확인 계정',publishedAt:kst(-2),checkedAt:new Date(Date.now()-7200000).toISOString(),metrics:{views:12000,likes:234,comments:12,shares:null,saves:31,followers:3400},evidenceNote:'합성 자료예요. 원문 연결과 빈 수치 표시만 봐요.',hook:'두 메모 중 담당자가 빠진 쪽을 먼저 고르게 한다',structure:'혼자 고르기 → 원문 단서 → 맞춰 보기',payoff:'처음엔 못 본 빈칸을 스스로 찾는다',brandFit:'업무 초보가 자기 메모 상태에 맞춰 판단하게 돕는다',adaptation:'원본의 음식 비교를 가상 회의 메모의 정보 비교로 바꾼다',seriesIds:['synkbrief-use']},
    {title:'카페에서 다시 말해 달라고 할 때',url:'https://www.youtube.com/shorts/EngCopy0002',platform:'youtube',creator:'합성 학습 계정',publishedAt:kst(-3),checkedAt:new Date(Date.now()-7000000).toISOString(),metrics:{views:5400,likes:98,comments:0,shares:null,saves:null,followers:null},evidenceNote:'합성 자료예요. 0과 빈 수치의 구분만 봐요.',hook:'다시 말해 달라고 부탁하려면?',structure:'짧은 상황 → 표현 → 다시 말하기',payoff:'표현 하나를 직접 말해 본다',brandFit:'LAB 생활 상황극의 연습 짜임',adaptation:'AI 실사 인물의 카페 상황과 따라 말할 여백을 둔다',seriesIds:['lab-situation']}
  ]});
const series=['synkbrief-news','synkbrief-use','synkbrief-basics','yuhobuilds','lab-situation','lab-expression','founder-clip','interview','company-work','writing-newsletter'];
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
    if(!made){
      await go(page,'/?tab=content&section=library','.cp-draft-list');
      made=await page.evaluate(async reportText=>{
        const workspace=await api('/api/content-workspace'),reference=workspace.references.find(row=>row.title.includes('회의 요약을 한 장'));
        const personalization={situation:'회의가 끝나고 10분 안에 할 일을 보내야 하는 신입',choice:'담당자가 적혀 있으면 원문과 맞춰 보고, 없으면 동료에게 물어보기',nextStep:'내 회의 메모에서 한 문장을 골라 담당자와 기한 표시하기'};
        const fullDraft=(await api('/api/content-generate',{seriesId:'synkbrief-use',topic:'회의 메모에서 담당자 찾기',audience:'첫 업무를 맡은 동료',takeaway:'담당자가 적힌 문장을 원문에서 찾아 맞춰 보기',experience:'지난주 회의 메모에서 담당자를 다시 찾느라 20분이 걸렸다',proof:'제작일의 원본 메모와 실제 정리 화면',entertainment:'같은 이름이 메모와 표에서 이어지는 순간',authenticity:{basis:'메모를 다시 읽은 것은 직접 겪은 일, 도구 결과는 새로 확인할 것',ownPerspective:'표 모양보다 담당자와 기한의 근거를 먼저 본다',limits:'메모에 없는 기한은 만들지 않는다',disclosure:'예시 메모는 가상 자료라고 표시'},personalization,referenceId:reference?.id||''})).draft;
        const preview=await api('/api/content-benchmarks/preview',{report:reportText});
        await api('/api/content-benchmarks',{report:preview.report,reviewConfirmed:true});
        const issue=(await api('/api/content-workspace')).benchmark.current,item=issue.items[0];
        const benchDraft=(await api('/api/content-generate',{seriesId:'synkbrief-news',topic:'새 요약 기능, 나도 쓸 수 있을까',benchmarkId:issue.id,benchmarkItemId:item.id,personalization:{situation:'무료 요금제로 AI를 처음 써 보는 팀원'}})).draft;
        const journeyDraft=(await api('/api/content-generate',{seriesId:'yuhobuilds',topic:'첫 자동화를 그만둘 뻔한 날'})).draft;
        const exportText=async id=>(await fetch('/api/content-drafts/'+encodeURIComponent(id)+'/export',{credentials:'same-origin'})).text();
        return {full:fullDraft.id,bench:benchDraft.id,journey:journeyDraft.id,exports:{full:await exportText(fullDraft.id),bench:await exportText(benchDraft.id)}};
      },JSON.stringify(benchmarkReport()));
      for(const [key,value] of Object.entries(made.exports))await writeFile(join(out,`export-${key}.md`),value);
    }
    // 기획 쓰기(개인화 입력 안내는 benchmark.js)
    await s('composer',async()=>{await go(page,'/?tab=content&section=library','.cp-draft-list');await page.click('[data-action="cp-new"]');await page.waitForSelector('.cp-composer');await openAll(page,'.cp-composer details');await full(page,n('composer'));});
    // 기획 결과: 합성 서버의 기획(경험·근거 일부), 주제만 쓴 기획, 개인화+개인 참고, 회사 벤치마크(지정 시리즈 다름), 제작 여정(경험 없음)
    await s('result',async()=>{await openDraft(page,'회의 메모를 팀의 할 일로');await full(page,n('result'));});
    await s('result-blank',async()=>{await openDraft(page,'처음 쓰는 사람을 위한 자동 요약 설정');await full(page,n('result-blank'));});
    await s('result-full',async()=>{await openDraft(page,'회의 메모에서 담당자 찾기');await full(page,n('result-full'));});
    await s('result-bench',async()=>{await openDraft(page,'새 요약 기능');await full(page,n('result-bench'));});
    await s('result-journey',async()=>{await openDraft(page,'첫 자동화를 그만둘');await full(page,n('result-journey'));});
    // 벤치마크로 기획하기(「SELECTED REFERENCE」 머리표)
    await s('bench-composer',async()=>{await go(page,'/?tab=content&section=examples','.cp-example-nav');await page.click('[data-action="cp-example-view"][data-view="benchmarks"]');await page.waitForSelector('[data-action="cp-bm-use"]',{timeout:20000});await page.locator('[data-action="cp-bm-use"]').first().click();await page.waitForSelector('.cp-composer .bm-selection',{timeout:20000});await wait(page,500);await elementShot(page,n('bench-composer'),'.cp-composer');});
    // 제작 기준(콘텐츠 기획 머리 단추)
    await s('guide',async()=>{await go(page,'/?tab=content&section=library','.cp-draft-list');await page.click('[data-action="cp-guide"]');await modalShot(page,n('guide'));await closeModal(page);});
    // 데스크 「제작 팁과 유형 안내」의 「유형별 기획 양식」
    await s('desk-guide',async()=>{for(const id of prefix==='d'?series:['synkbrief-news','yuhobuilds','lab-expression']){await go(page,'/?tab=workroom&section=desk','[data-workroom-desk]');await page.selectOption('[data-action="workroom-series"]',id);await wait(page,600);await openAll(page,'#wr-desk-guide,#wr-desk-guide details');await elementShot(page,n('desk-guide-'+id),'#wr-desk-guide .wr-template');}});
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
