'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createServer } = require('./serve.cjs');
const at = process.argv.indexOf('--playwright');
const { chromium } = require(at >= 0 ? process.argv[at + 1] : 'playwright');
const out = path.join(__dirname,'evidence');
fs.mkdirSync(out,{recursive:true});
const tests = []; const problems = [];
const expected = {
  askGoal: '처음인 손님이 어떤 행동을 하면 이번 홍보가 도움이 됐다고 느끼실까요?',
  askScope: '네 장의 게시물 가운데 예약 안내보다 먼저 필요한 내용이 있을까요?',
  askTiming: '사진과 문구는 언제 확인할 수 있고, 최종 확인은 누가 하나요?',
  initialProposal: '초보자를 위한 수업 소개 2장과 기존 신청 폼 안내를 먼저 만들겠습니다.\n7일 안에 문구 확인 1회와 최종 파일을 전달하겠습니다.',
  revisedProposal: '12만 원에서는 소개 2장과 기존 신청 폼 안내를 유지하고, 영상은 다음 회차로 제안합니다.',
  changeReason: '예약을 받는 목적을 지키고 영상 제작은 다음 범위로 분리했습니다.',
  transferQuestion: '어떤 독자가 누구와 어떤 이야기를 나누는 모임이면 좋을까요?',
  transferProposal: '가정: 첫 모임 대상이 정해지지 않았습니다. 대상과 모임 경험부터 확인하고, 그 답을 바탕으로 한 장의 모집 소개를 만들겠습니다.',
  takeaway: '요청한 제작물보다 먼저 원하는 변화를 묻는다.',
};
async function fill(page, keys) { for (const key of keys) await page.locator(`[name="${key}"]`).fill(expected[key]); }
async function checkOverflow(page, label) {
  const overflow = await page.evaluate(()=>document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(overflow,false,label); tests.push(`${label}: 가로 넘침 없음`);
}
(async()=>{
  const server = createServer(); await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url = `http://127.0.0.1:${server.address().port}/rehearsal/`;
  let browser;
  try {
    browser = await chromium.launch({headless:true,channel:'chrome'});
    const context = await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
    const page = await context.newPage();
    page.on('pageerror',error=>problems.push(error.message));
    page.on('response',response=>{if(response.status()>=400) problems.push(`${response.status()} ${new URL(response.url()).pathname}`);});
    page.on('request',request=>{if(!request.url().startsWith(url.replace('/rehearsal/','')) && !request.url().startsWith('data:')) problems.push('외부 요청: '+request.url());});
    await page.goto(url); await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:path.join(out,'desktop-intro.png'),fullPage:true});
    await checkOverflow(page,'1440px 시작');
    await page.getByRole('button',{name:'고객 의뢰 열기'}).click();
    await page.getByRole('button',{name:'질문 남기고 답장 읽기'}).click();
    assert.equal(await page.locator('[aria-invalid=true]').count(),3);
    assert.equal(await page.evaluate(()=>document.activeElement.name),'askGoal'); tests.push('빈 값 이동 차단과 첫 오류 포커스');
    await fill(page,['askGoal','askScope','askTiming']); await page.reload();
    assert.equal(await page.locator('[name=askGoal]').inputValue(),expected.askGoal); tests.push('새로고침 후 현재 단계와 입력 복구');
    await page.getByRole('button',{name:'질문 남기고 답장 읽기'}).click();
    await fill(page,['initialProposal']); await page.getByRole('button',{name:'첫 제안 남기기',exact:true}).click();
    await page.setViewportSize({width:390,height:844}); await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:path.join(out,'mobile-change.png'),fullPage:true}); await checkOverflow(page,'390px 변경 요청');
    await fill(page,['revisedProposal','changeReason']); await page.getByRole('button',{name:'수정한 제안 남기기'}).click();
    await fill(page,['transferQuestion','transferProposal','takeaway']); await page.getByRole('button',{name:'내 리허설 모아 보기'}).click();
    await page.locator('[name=mentorEvidence]').fill('수정 제안에서 기존 목적을 유지한 문장을 확인했습니다.');
    await page.locator('[name=mentorNext]').fill('다음에는 고객의 확인 일정도 선택지에 담아 보세요.');
    await checkOverflow(page,'390px 검토');
    await page.screenshot({path:path.join(out,'mobile-review.png'),fullPage:true});
    const [download] = await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'검토용 JSON 저장'}).first().click()]);
    const buffer = fs.readFileSync(await download.path(),'utf8'); const exported = JSON.parse(buffer);
    assert.equal(exported.record.history.length,4); assert.equal(exported.record.fields.initialProposal,expected.initialProposal);
    assert.match(exported.record.fields.mentorEvidence,/확인했습니다/); tests.push('전 단계 원문·제출 이력·강사 메모 JSON 내보내기');
    const teacherContext = await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
    const teacher = await teacherContext.newPage(); await teacher.goto(url);
    await teacher.getByRole('button',{name:'기록 관리'}).click();
    await teacher.locator('#import-file').setInputFiles({name:'learner.json',mimeType:'application/json',buffer:Buffer.from(buffer)});
    await teacher.getByRole('button',{name:'선택한 기록 열기'}).click();
    assert.equal(await teacher.locator('[name=mentorNext]').inputValue(),'다음에는 고객의 확인 일정도 선택지에 담아 보세요.');
    await teacher.screenshot({path:path.join(out,'desktop-review.png'),fullPage:true}); tests.push('별도 브라우저에서 강사 검토용 기록 열기');
    await teacher.getByRole('button',{name:'2단계 첫 제안'}).click();
    await teacher.locator('[name=initialProposal]').fill('<img src=x onerror="window.__injected=true"> 수정한 원문');
    await teacher.getByRole('button',{name:'첫 제안 남기기',exact:true}).click();
    await teacher.getByRole('button',{name:'5단계 함께 검토'}).click();
    assert.equal(await teacher.evaluate(()=>window.__injected),undefined);
    const saved = await teacher.evaluate(()=>JSON.parse(localStorage.getItem('synk.rehearsal.v1')));
    assert.equal(saved.history.filter(x=>x.step===2).length,2);
    assert.equal(saved.history.find(x=>x.step===2).fields.initialProposal,expected.initialProposal); tests.push('재작성 시 최초 제출 보존 · 입력을 HTML로 실행하지 않음');
    await teacher.evaluate(()=>localStorage.setItem('synk.unrelated','keep'));
    await teacher.getByRole('button',{name:'기록 관리'}).click();
    await teacher.getByRole('button',{name:'새 연습 시작'}).click(); await teacher.getByRole('button',{name:'취소',exact:true}).click();
    assert.match(await teacher.locator('#scene-title').textContent(),/처음의 질문/);
    await teacher.getByRole('button',{name:'새 연습 시작'}).click(); await teacher.getByRole('button',{name:'기록 비우고 시작'}).click();
    assert.equal(await teacher.evaluate(()=>localStorage.getItem('synk.unrelated')),'keep'); tests.push('초기화 취소·실행 및 다른 저장 키 보존');
    await teacher.setViewportSize({width:320,height:740}); await checkOverflow(teacher,'320px 시작');
    await teacher.keyboard.press('Tab');
    assert.equal(await teacher.evaluate(()=>document.activeElement.textContent),'고객 의뢰 열기');
    await teacher.keyboard.press('Enter');
    assert.match(await teacher.locator('#scene-title').textContent(),/바로 만들기 전에/); tests.push('키보드 Tab과 Enter로 연습 시작');
    const corruptContext = await browser.newContext();
    await corruptContext.addInitScript(()=>localStorage.setItem('synk.rehearsal.v1','{broken'));
    const corrupt = await corruptContext.newPage(); await corrupt.goto(url);
    assert.equal(await corrupt.locator('#recovery').isVisible(),true);
    await corrupt.getByRole('button',{name:'고객 의뢰 열기'}).click(); await corrupt.locator('[name=askGoal]').fill('원문을 바꾸면 안 됩니다.');
    assert.equal(await corrupt.evaluate(()=>localStorage.getItem('synk.rehearsal.v1')),'{broken'); tests.push('손상 저장본 원문 보존');
    const privateContext = await browser.newContext();
    await privateContext.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('Full','QuotaExceededError');};});
    const privatePage = await privateContext.newPage(); await privatePage.goto(url);
    await privatePage.getByRole('button',{name:'고객 의뢰 열기'}).click();
    assert.match(await privatePage.locator('#save-status').textContent(),/저장 공간이 부족/);
    await privatePage.locator('[name=askGoal]').fill('자동 저장 실패 중에도 파일에 남길 질문');
    await privatePage.getByRole('button',{name:'기록 관리'}).click();
    const [failedSaveExport] = await Promise.all([privatePage.waitForEvent('download'),privatePage.getByRole('button',{name:'JSON 저장',exact:true}).click()]);
    assert.equal(JSON.parse(fs.readFileSync(await failedSaveExport.path(),'utf8')).record.fields.askGoal,'자동 저장 실패 중에도 파일에 남길 질문');
    tests.push('저장 실패 경고와 메모리 안 입력의 파일 내보내기');
    const otherTab = await teacherContext.newPage(); await otherTab.goto(url);
    await otherTab.locator('[name=askGoal]').fill('다른 탭에서 바꾼 답');
    await teacher.waitForFunction(()=>document.querySelector('#recovery').textContent.includes('다른 탭'));
    await teacher.locator('[name=askGoal]').fill('원래 탭의 저장을 멈춘 답');
    assert.equal(await otherTab.evaluate(()=>JSON.parse(localStorage.getItem('synk.rehearsal.v1')).fields.askGoal),'다른 탭에서 바꾼 답');
    tests.push('다른 탭의 새 기록을 자동으로 덮어쓰지 않음');
    assert.deepEqual(problems,[]);
    tests.push('브라우저 실행 오류·자산 실패·외부 네트워크 요청 0');
    const report = {checkedAt:new Date().toISOString(),browser:'installed Chrome / Playwright',tests,problems,
      boundary:'합성 입력의 로컬 작동 검사. 실제 수강생·강사 학습효과, 외부 고객 영업, 앱 통합, 원격 게시·배포는 검사하지 않음.'};
    fs.writeFileSync(path.join(out,'browser-check.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  } finally { if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
