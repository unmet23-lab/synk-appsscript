#!/usr/bin/env node
'use strict';

// MD 원고를 같은 폴더의 구조화 JSON으로 내보내는 로컬 생성기.
// 네트워크·계정·배포·원고 편집은 수행하지 않는다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const base = __dirname;
const repo = path.resolve(base, '../../../..');
const read = (file) => fs.readFileSync(path.join(base, file), 'utf8');
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');
const audience = '자기 전문성을 서비스·교육·콘텐츠로 소개하려는 초기 성인 1인 사업자';
const fictionNotice = '채운 사례·질문·대화는 가상 교육용 예시이며 실제 고객·판매 상품·계약·성과가 아닙니다.';
const catalog = [
  ['shift-intro', '01_소개문.md', '내 일을 설명하는 첫 문장', '대상·상황·결과를 나눠 소개문을 작성하고 읽는 자리별로 변형합니다.', '내 소개에서 직함보다 누구의 어떤 일을 돕는지 먼저 찾아보세요.', '대상이 둘일 때 첫 문장을 나눌지 판단하는 부분이 헷갈리나요?'],
  ['shift-offer', '02_상품한장.md', '첫 서비스를 설명하는 한 장', '고객·제공물·포함·제외·인수·미정 조건을 한 경험으로 정리합니다.', '고객이 원하는 결과와 내가 실제로 넘기는 결과물을 나눠 적어보세요.', '내가 제공하는 것과 제외하려는 것 중 어느 경계가 헷갈리나요?'],
  ['shift-content-map', '03_콘텐츠지도.md', '한 상품에서 꺼내는 고객 질문 지도', '가상 고객 질문 12개에 본문에서 먼저 줄 답과 적용 자료를 연결합니다.', '상품의 한 줄 옆에 알아보기 전·선택할 때·쓴 뒤의 질문을 하나씩 적어보세요.', '질문은 생겼지만 그 편에서 바로 줄 답이 아직 모호한가요?'],
  ['shift-inquiry', '04_문의답변.md', '맞는 일을 확인하는 문의 답변', '최소 확인 질문과 범위·가격 미정·일정·사후 막힘의 답변을 연습합니다.', '상대가 이미 말한 것은 다시 묻지 말고 답을 바꾸는 질문만 남겨보세요.', '지금 바로 답할 내용과 더 확인할 조건 중 어디가 섞였나요?'],
  ['shift-ai-workflow', '05_AI업무지도.md', '혼자 쓰는 AI 업무 지도', '가상 입력·요청문·기대 결과와 의도적 오류를 대조해 사람의 확인 지점을 정합니다.', 'AI 초안의 결과 동사마다 원본에 있던 약속인지 먼저 확인해보세요.', '가상 내용으로 기대 출력과 실제로 틀린 유형을 구분할 수 있나요?'],
  ['shift-lesson', '06_강의실습설계.md', '배우고 나서 혼자 다시 하는 실습 설계', '시작 파일·완성 예시·조건 변경·자기 점검으로 자율 실습을 설계합니다.', '설명을 이해한 뒤 예시를 보지 않고 조건 하나를 바꿔 다시 작성해보세요.', '설명은 이해했지만 혼자 해볼 때 어느 칸에서 막히나요?'],
];

function makeItem(row) {
  const [id, sourceFile, title, summary, immediateTip, followupQuestion] = row;
  const source = read(sourceFile);
  const chunks = source.split(/^## /m);
  const preface = chunks.shift().trim();
  const sections = chunks.map((chunk, index) => {
    const newline = chunk.indexOf('\n');
    return { id: `s${String(index + 1).padStart(2, '0')}`, title: chunk.slice(0, newline).trim(), markdown: chunk.slice(newline + 1).trim() };
  });
  return {
    id, brand: 'SHIFT', title, audience, summary, sourceFile,
    sourceSha256: sha(source), fictionNotice, preface, sections,
    ending: { immediateTip, resourceLabel: title, resourcePath: sourceFile, followupQuestion },
  };
}

function payload() {
  const sources = ['AGENTS.md', 'docs/AI_운영원칙.md', 'docs/마케팅_정본.md', 'docs/마케팅_확장안_20260909.md', 'docs/명품_기준_v1.md', 'DESIGN.md'];
  return {
    version: 1, date: '2026-09-09', status: 'local-prepared', language: 'ko',
    canonicalFormat: 'markdown',
    library: { title: 'SHIFT 제공자료 — 필요한 한 일부터', sourceFile: '읽어주세요.md', publicUrl: null, publicationStatus: 'not-published-by-this-task', requiresSignup: false },
    scope: { materials: 6, communicationGuides: 1, followupLetterDrafts: 3, inPersonTeaching: false, accountCreation: false, externalPosting: false, liveDeliveryVerified: false, nativeSpeakerReviewClaimed: false, performanceValidated: false },
    materials: catalog.map(makeItem),
    supportGuides: [makeItem(['shift-followup', '소통_후속도움.md', '자료를 쓰다가 막혔을 때', '비식별 질문·답변·모름 처리·개정·선택적 후속 편지 원고 3편입니다.', '목표·해본 것·막힌 칸·원하는 도움을 가상 내용으로 정리해보세요.', '바로 적용할 답과 확인이 필요한 조건 중 어느 도움이 필요한가요?'])],
    productionOnly: ['A_끝맺음.md', '원고묶기.cjs', '검증.json', '제작검증.md'],
    sourceReferences: sources.map((file) => ({ path: file, sha256: sha(fs.readFileSync(path.join(repo, file))) })),
    visualHandoff: { stylesheet: 'Loom existing tokens only', fonts: 'approved fonts only', logo: 'neutral ink SYNK stitch + SHIFT division-color stitch', renderStatus: 'integration-pending' },
  };
}

function check(data) {
  assert.equal(data.materials.length, 6);
  assert.equal(data.supportGuides.length, 1);
  assert.equal(data.library.publicUrl, null);
  const items = [...data.materials, ...data.supportGuides];
  assert.equal(new Set(items.map((x) => x.id)).size, items.length);
  const required = ['가상', '예시', '조건', '확인', '원본'];
  for (const item of items) {
    const source = read(item.sourceFile);
    assert.equal(item.sourceSha256, sha(source), `${item.id}: source hash`);
    assert.ok(item.sections.length >= 8, `${item.id}: section coverage`);
    assert.equal(new Set(item.sections.map((x) => x.id)).size, item.sections.length);
    for (const word of required) assert.ok(source.includes(word), `${item.id}: missing ${word}`);
    assert.ok(source.length >= 2400, `${item.id}: incomplete manuscript`);
    assert.ok(item.sections.every((s) => s.title && s.markdown.length > 60), `${item.id}: empty section`);
    assert.ok(source.includes('```text'), `${item.id}: editable example missing`);
    assert.ok(!/https?:\/\//i.test(source), `${item.id}: unexpected live URL`);
    assert.ok(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(source), `${item.id}: unexpected email`);
  }
  const sources = [...items.map((x) => x.sourceFile), '읽어주세요.md', 'A_끝맺음.md'];
  let checkedLinks = 0;
  for (const file of sources) {
    for (const match of read(file).matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1];
      assert.ok(!target.includes('://'), `${file}: external link ${target}`);
      const full = path.resolve(base, target);
      assert.ok(full.startsWith(base + path.sep), `${file}: outside link`);
      assert.ok(fs.existsSync(full), `${file}: missing link ${target}`);
      checkedLinks++;
    }
  }
  const contentMap = read('03_콘텐츠지도.md');
  assert.equal((contentMap.match(/^\| (알아보기|선택하기|사용한 뒤) \|/gm) || []).length, 12);
  const followup = read('소통_후속도움.md');
  assert.equal((followup.match(/^## \d+\. 후속 편지 원고 /gm) || []).length, 3);
  assert.deepEqual(JSON.parse(read('제공자료.json')), data, 'JSON differs from source export');
  return {
    status: 'passed', date: '2026-09-09', checks: { materialCount: 6, supportGuideCount: 1, completeSections: items.reduce((n, x) => n + x.sections.length, 0), editableExamples: 7, contentMapQuestions: 12, followupLetterDrafts: 3, localLinksResolved: checkedLinks, manuscriptHashAndJsonAgreement: true, inventedLiveUrls: 0, emailStrings: 0 },
    files: items.map((x) => ({ sourceFile: x.sourceFile, sha256: x.sourceSha256, sections: x.sections.length })),
    limits: ['구성·원고 일치·로컬 링크 검사이며 실제 독자 효용·매출을 검증한 결과가 아님', 'HTML/PDF/모바일 시각 QA는 통합 제작 단계에서 별도 수행', 'AI 실제 실행·외부 게시·구독·발송·계정 개설·현장 강의는 수행하지 않음', '독립 사실·약속 검토는 별도 담당 결과로 인수'],
  };
}

const data = payload();
const checking = process.argv.includes('--검사');
if (!checking) fs.writeFileSync(path.join(base, '제공자료.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');
const report = check(data);
if (!checking) fs.writeFileSync(path.join(base, '검증.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(report, null, 2));
