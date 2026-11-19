'use strict';
// 공모 응모 자격 거르기 시험(2026-11-20, 유호님 「그런것들은 아예 리스트업에서 뺴줘」).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 자격 = require('../tools/lib/contest-eligibility.cjs');
const 지도 = require('../tools/공모지도.js');

// 시험용 가상의 신청자다(실제 신청자 조건은 비공개 보관함에만 있다).
const 조건 = { schema: 'synk-applicant-v1', 만나이: 40, 사는곳: ['강원', '강원특별자치도', '춘천', '춘천시'], 학생: false, 직장인: false, 사업자: false, 법인: false, 가지않는곳: ['대전'] };
const 빈제한 = { 누구나: false, 지역: [], 학생만: false, 직장인만: false, 단체만: false, 최소나이: null, 최대나이: null, 현장지역: [] };

test('다른 시 거주자만 내는 공모는 안 됨, 사는 도 · 시와 전국은 됨', () => {
  assert.strictEqual(자격.판정하기({ ...빈제한, 지역: ['제천시'], 최소나이: 14 }, 조건).status, '안 됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 지역: ['강원특별자치도'] }, 조건).status, '됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 지역: ['춘천시'] }, 조건).status, '됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 지역: ['전국'] }, 조건).status, '됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 누구나: true }, 조건).status, '됨');
});

test('학생만 · 단체만 · 나이 · 대전 현장은 안 됨', () => {
  assert.strictEqual(자격.판정하기({ ...빈제한, 학생만: true, 최소나이: 19 }, 조건).status, '안 됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 단체만: true }, 조건).status, '안 됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 최대나이: 39 }, 조건).status, '안 됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 최소나이: 19, 최대나이: 49 }, 조건).status, '됨');
  assert.strictEqual(자격.판정하기({ ...빈제한, 현장지역: ['대전 유성구'] }, 조건).status, '안 됨');
});

test('카본 인용이 원문에 없으면 버린다', () => {
  const 원문 = '응모자격: 만 14세 이상 제천시민(제천 소재 학생 및 직장인 포함)';
  assert.ok(자격.답읽기({ quote: '만 14세 이상 제천시민', 누구나: false, 지역: ['제천'], 최소나이: 14, 최대나이: -1 }, 원문));
  assert.strictEqual(자격.답읽기({ quote: '전국 누구나', 누구나: true }, 원문), null);
  assert.strictEqual(자격.답읽기({ quote: '만 14세 이상 제천시민', 최대나이: -1 }, 원문).제한.최대나이, null);
});

test('자격 문장만 뽑는다', () => {
  const t = '공모명: 응답하라 제천 공모기간: 9월 28일 ~ 11월 20일 응모자격: 만 14세 이상 제천시민 공모분야: AI영상';
  assert.match(자격.자격문장(t), /응모자격: 만 14세 이상 제천시민/);
  assert.strictEqual(자격.자격문장('공모명과 상금만 있는 글'), '');
});

function 폴더() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-elig-'));
  fs.writeFileSync(path.join(dir, '신청자조건.json'), JSON.stringify(조건));
  return dir;
}

test('자격확인은 원문을 읽고 카본 판정을 쌓는다(개인 조건은 카본에 보내지 않는다)', async () => {
  const dir = 폴더();
  const 보낸글 = [];
  const fetchPage = async url => ({ 됨: true, 글: url.includes('jecheon') ? '<p>응모자격: 만 14세 이상 제천시민(제천 소재 학생 및 직장인 포함)</p>' : '<p>상금 안내</p>' });
  const carbon = async ({ prompt }) => {
    보낸글.push(prompt);
    const id = 자격.열쇠('응답하라 제천 AI영상 공모전');
    return { selectedModel: 'gemini-4-carbon-high', text: JSON.stringify({ cases: [{ id, quote: '만 14세 이상 제천시민(제천 소재 학생 및 직장인 포함)', 누구나: false, 지역: ['제천'], 학생만: false, 직장인만: false, 단체만: false, 최소나이: 14, 최대나이: -1, 현장지역: [] }] }) };
  };
  const r = await 자격.자격확인(dir, [
    { 제목: '응답하라 제천 AI영상 공모전', 주소: 'https://jecheon.example.kr/notice (접수 메일)' },
    { 제목: '그림만 있는 공모', 주소: 'https://image-only.example.kr/n' },
    { 제목: '주소 없는 공모', 주소: '' },
  ], { fetchPage, carbon, budgetMs: 600000 });
  assert.strictEqual(r.checked, 3);
  const 판정 = 자격.판정읽기(dir);
  assert.strictEqual(자격.판정찾기(판정, '응답하라 제천 AI영상 공모전').status, '안 됨');
  assert.strictEqual(자격.판정찾기(판정, '그림만 있는 공모').status, '확인 필요');
  assert.strictEqual(자격.판정찾기(판정, '주소 없는 공모').status, '확인 필요');
  assert.ok(보낸글.length === 1 && !/춘천|강원|40/.test(보낸글[0]), '카본에는 공고 글만 간다');
  // 이미 판정한 공고는 다시 묻지 않는다.
  const r2 = await 자격.자격확인(dir, [{ 제목: '응답하라 제천 AI영상 공모전', 주소: 'https://jecheon.example.kr/notice' }], { fetchPage, carbon, budgetMs: 600000 });
  assert.strictEqual(r2.checked, 0);
});

test('수동 제외는 제목 조각으로 맞고, 지도의 열린 공모에서 빠진다', () => {
  const dir = 폴더();
  자격.수동제외(dir, '응답하라, 제천', '만 14세 이상 제천시민만 응모(공고 원문)');
  const 판정 = 자격.판정읽기(dir);
  const 통합 = { items: [
    { id: 'a', title: '2026 시민 AI영상 공모전 <응답하라, 제천>', ai_video: { value: 'AI 영상' }, calendar_20261110: { end: '2026-11-20' } },
    { id: 'b', title: '부산 동구 AI 숏폼 영상 공모전', ai_video: { value: 'AI 영상' }, calendar_20261110: { end: '2026-11-22' } },
  ] };
  const 열린 = 지도.열린영상(통합, { items: [] }, '2026-11-20', new Date('2026-11-20T03:00:00Z'), 판정);
  assert.deepStrictEqual(열린.map(o => o.id), ['b']);
  assert.strictEqual(열린[0].자격, '확인 전');
  assert.throws(() => 자격.수동제외(dir, '제천', '짧음'), /네 글자/);
});
