'use strict';
// 공모 지도(tools/공모지도.js)가 장부의 단계 칸을 빠짐없이 읽고, 빠진 칸을 알리고, 낼 수 있는 AI 영상 공모를 바르게 고르는지 본다(2026-11-18).
// 왜: 지도는 장부를 그대로 그리는 것이라, 단계가 비거나 마감이 빠진 건은 조용히 사라지기 쉽다. 이미 낸 공모가 「낼 수 있는 공모」에 다시 뜨면 헷갈린다.
// 실제 보관함은 읽지 않는다(임시 폴더에 만든 것만 읽는다).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const 지도 = require('../tools/공모지도.js');

const 도구 = path.join(__dirname, '..', 'tools', '공모지도.js');

function 장부() {
  return {
    items: [
      { id: 'a', name: '경산 AI 공모전(경산시 공고 제1호)', stage: '준비 중', kind: '공모전', ai_video: true, deadline: '2026-11-23T23:59', owner: '곁 세션' },
      { id: 'b', name: '화성 AI CF', stage: '결과 기다림', kind: '공모전', ai_video: true, result: { date: '2026-11-19' } },
      { id: 'c', name: '재도전 사업계획서', stage: '결과 기다림', kind: '지원사업', ai_video: false, result: { text: '발표일 모름' } },
      { id: 'd', name: '의왕 e-Room', stage: '선정', kind: '공모전', ai_video: false, next_event: { date: '2026-11-25', text: '발표 자료' } },
      { id: 'e', name: '서울로 네이처', stage: '안 됨', kind: '공모전', ai_video: true, result: { text: '미선정' } },
    ],
  };
}

function 목록() {
  return {
    meta: {},
    items: [
      { id: 'a', title: '경산 AI 공모전', calendar_20261110: { end: '2026-11-23' }, ai_video: { value: 'AI 영상', basis: 'AI 활용' } },
      { id: 'x', title: '문경시 관광 AI 영상 공모전', calendar_20261110: { end: '2026-11-30' }, ai_video: { value: 'AI 영상', basis: 'AI 생성 필수' }, latest_review: { url: 'https://example.org/mungyeong' } },
      { id: 'y', title: '실손24 영상 공모전', calendar_20261110: { end: '2026-11-30' }, ai_video: { value: '영상', basis: 'AI 확인 필요' } },
      { id: 'z', title: '지난 AI 영상 공모', calendar_20261110: { end: '2026-11-01' }, ai_video: { value: 'AI 영상' } },
      { id: 'w', title: '정책 아이디어 공모', calendar_20261110: { end: '2026-12-01' }, ai_video: { value: '아님' } },
      { id: 'g', title: 'Higgsfield Talent Contest', grok_20261117: { end: '2026-11-26', deadline_text: '2026-11-27 04:00 KST' }, ai_video: { value: 'AI 영상' } },
      { id: 'h', title: '화성 AI CF 숏폼 CM송 공모', calendar_20261110: { end: '2026-12-31' }, ai_video: { value: 'AI 영상' } },
    ],
  };
}

const 지금 = new Date('2026-11-17T16:00:00Z'); // 한국 시각 11-18 01:00

test('한국 시각으로 오늘을 센다', () => {
  assert.strictEqual(지도.오늘(지금), '2026-11-18');
});

test('끝의 괄호 설명을 걷어 짧은 이름을 만든다', () => {
  assert.strictEqual(지도.짧은이름('경산 AI 공모전(경산시 공고 제1호)'), '경산 AI 공모전');
  assert.strictEqual(지도.짧은이름('2026 진주시 영상 공모전 — 숏폼 분야(진주시 공고 제2026-1623호)'), '2026 진주시 영상 공모전 — 숏폼 분야');
  assert.strictEqual(지도.짧은이름('KCTI 연구아이디어 3건'), 'KCTI 연구아이디어 3건');
});

test('장부의 단계와 칸을 카드로 옮긴다', () => {
  const 자료 = 지도.자료만들기(장부(), 목록(), 지금);
  assert.strictEqual(자료.진행.length, 5);
  const a = 자료.진행.find((o) => o.id === 'a');
  assert.deepStrictEqual([a.단계, a.ai영상, a.마감, a.맡은곳, a.이름], ['준비 중', true, '2026-11-23T23:59', '곁 세션', '경산 AI 공모전']);
  assert.strictEqual(자료.진행.find((o) => o.id === 'c').갈래, '지원사업');
});

test('낼 수 있는 영상 공모는 마감이 안 지났고 장부에 없는 것만 고른다', () => {
  const 열린 = 지도.열린영상(목록(), 장부(), '2026-11-18');
  const ids = 열린.map((o) => o.id);
  assert.ok(!ids.includes('a'), '장부에 있는 공모(id가 같음)는 뺀다');
  assert.ok(!ids.includes('h'), '장부에 있는 공모(이름이 같음)는 뺀다');
  assert.ok(!ids.includes('z'), '마감이 지난 공모는 뺀다');
  assert.ok(!ids.includes('w'), '영상이 아닌 공모는 뺀다');
  assert.deepStrictEqual(ids, ['g', 'x', 'y'], '마감 순서로 늘어놓는다');
  const g = 열린.find((o) => o.id === 'g');
  assert.strictEqual(g.원문확인안함, true);
  assert.strictEqual(g.마감글, '2026-11-27 04:00 KST');
  assert.strictEqual(열린.find((o) => o.id === 'x').주소, 'https://example.org/mungyeong');
});

test('빠진 칸을 하나씩 알린다', () => {
  const s = 장부();
  s.items.push({ id: 'p', name: '마감 없는 준비', stage: '준비 중', ai_video: true });
  s.items.push({ id: 'q', name: '단계 없는 건', ai_video: false });
  s.items.push({ id: 'r', name: '결과 칸 없는 건', stage: '결과 기다림' });
  const 문제 = 지도.검사(s);
  assert.ok(문제.some((p) => p.includes('마감 없는 준비') && p.includes('deadline')));
  assert.ok(문제.some((p) => p.includes('마감 없는 준비') && p.includes('owner')));
  assert.ok(문제.some((p) => p.includes('단계 없는 건') && p.includes('stage')));
  assert.ok(문제.some((p) => p.includes('결과 칸 없는 건') && p.includes('result')));
  assert.ok(문제.some((p) => p.includes('결과 칸 없는 건') && p.includes('ai_video')));
  assert.deepStrictEqual(지도.검사(장부()), []);
});

test('페이지는 자료를 안전하게 싣고 제목과 테마 토큰을 갖춘다', () => {
  const s = 장부();
  s.items[0].name = '꺾쇠 </script><b>공모</b>';
  const html = 지도.페이지(지도.자료만들기(s, 목록(), 지금));
  assert.match(html, /^<title>공모 지도<\/title>/);
  assert.ok(!html.includes('</script><b>'), '자료 안의 꺾쇠가 스크립트를 닫지 않는다');
  assert.match(html, /@media \(prefers-color-scheme: light\)/);
  assert.match(html, /:root\[data-theme="light"\]/);
});

test('명령줄: --검사는 빠진 칸이 있으면 1로 끝나고, 만들기는 파일을 쓴다', (t) => {
  const 폴더 = fs.mkdtempSync(path.join(os.tmpdir(), '공모지도-'));
  t.after(() => fs.rmSync(폴더, { recursive: true, force: true }));
  const s = 장부();
  s.items.push({ id: 'p', name: '마감 없는 준비', stage: '준비 중', ai_video: true });
  fs.writeFileSync(path.join(폴더, '신청현황.json'), JSON.stringify(s));
  fs.writeFileSync(path.join(폴더, '통합목록.json'), JSON.stringify(목록()));
  const 검 = spawnSync(process.execPath, [도구, '--검사', '--보관함', 폴더], { encoding: 'utf8' });
  assert.strictEqual(검.status, 1, 검.stdout + 검.stderr);
  assert.match(검.stdout, /마감 없는 준비/);
});
