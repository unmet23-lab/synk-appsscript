'use strict';
// 컷 사이 순간이동(점검표 41 · 2026-11-18 7번 「사랑 한 칸」) — tools/컷연속성검사.py의 화면밖소품동작 · 관문결과검사가
//   ① 화면 밖에서 한 것으로 적은 소품 동작을 걸림으로(앞선 편은 주의) ② 광고 · 공모전 · 포트폴리오 편의 판 셋 이상 묶음을
//   굽기 전 검수가 「그대로」로 본 컷만 내게 하는지 본다. 옛 판(7번 컷표 1-4 · 검수 결과의 「그림 다시」)은 걸리고 새 판은 지나간다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const 도구폴더 = path.join(__dirname, '..', 'tools');
const 파이썬 = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'print(1)'], { encoding: 'utf8' }).status === 0;

function 부르기(스크립트, 입력) {
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', 'import sys, json\nsys.path.insert(0, sys.argv[1])\nimport 컷연속성검사 as k\n' + 스크립트, 도구폴더],
    { input: JSON.stringify(입력), encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

const 컷 = (cut, 소품행동, 시작그림) => ({ cut, 소품: { 도시락: '손에' }, ...(소품행동 ? { 소품행동: { 도시락: 소품행동 } } : {}), ...(시작그림 ? { 시작그림 } : {}) });

test('화면 밖 소품 동작 — 7번 1-4 꼴(「첫 장에 이미 들려 있어 컷 사이에 든 것으로 본다」)은 걸림, 판 안에서 보이는 동작은 지나간다, 앞선 편은 주의', { skip: !파이썬 && '파이썬 없음' }, () => {
  const 옛 = '이안의 왼손이 책상의 도시락을 다시 들어 낮게 받친다 — 첫 장에 이미 들려 있어 컷 사이에 든 것으로 본다';
  const 새 = '0.3~0.9s 이안의 왼손이 책상의 도시락을 집어 가슴 높이로 든다';
  const 표들 = [
    { 틀: 2, 편: { 이름: '새 편', 만든날: '2026-11-19' }, detail: [컷('1-3'), 컷('1-4', 옛)] },
    { 틀: 2, 편: { 이름: '새 편', 만든날: '2026-11-19' }, detail: [컷('1-3'), 컷('1-4', 새)] },
    { 틀: 2, 편: { 이름: '앞선 편', 만든날: '2026-11-10' }, detail: [컷('1-3'), 컷('1-4', 옛)] },
    { 틀: 2, 편: { 이름: '앞선 편 · 필수', 만든날: '2026-10-26', 경계확인: '필수' }, detail: [컷('1-3'), 컷('1-4', '화면 밖에서 내려놓는다')] },
  ];
  const 답 = 부르기('print(json.dumps([[g for g, c, _ in k.화면밖소품동작(s)] for s in json.load(sys.stdin)]))', 표들);
  assert.deepEqual(답, [['걸림'], [], ['주의'], ['걸림']]);
});

test('굽기 전 검수 관문 — 포트폴리오 편: 검수가 고치라고 한 컷 · 안 본 컷 · 검수 뒤에 바뀐 시작 그림은 판 셋부터 걸림, 둘 이하는 주의, 「그대로」만이면 지나간다, SNS 편은 보지 않는다', { skip: !파이썬 && '파이썬 없음' }, () => {
  const 편 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-gate-'));
  try {
    const 결과폴더 = path.join(편, '검수', '굽기전_20261118-0409');
    fs.mkdirSync(결과폴더, { recursive: true });
    const 그림 = path.join(편, '1-30.png'); fs.writeFileSync(그림, 'x');
    const 옛때 = new Date('2026-11-18T00:00:00Z'); fs.utimesSync(그림, 옛때, 옛때);
    fs.writeFileSync(path.join(결과폴더, '결과.json'), JSON.stringify({ 관문: '굽기전', 컷별: [
      { cut: '1-26', 판정: '그림 다시' }, { cut: '1-29', 판정: '그대로' }, { cut: '1-30', 판정: '그대로' }, { cut: '1-33', 판정: '그대로' },
    ] }), 'utf8');
    const 표경로 = path.join(편, '컷표.json');
    const 포트 = { 틀: 2, 편: { 이름: '시험', 만든날: '2026-11-19', 분야: '포트폴리오' }, detail: [{ cut: '1-29' }, { cut: '1-30', 시작그림: 그림 }, { cut: '1-33' }, { cut: '1-26' }, { cut: '1-40' }] };
    const 경우 = [
      [포트, ['1-29', '1-30', '1-33'], 3],          // 모두 「그대로」 → 지나감
      [포트, ['1-26', '1-29', '1-30'], 3],          // 그림 다시 → 걸림
      [포트, ['1-29', '1-40', '1-33'], 3],          // 검수가 안 본 컷 → 걸림
      [포트, ['1-26'], 1],                           // 첫 시험 한 판 → 주의
      [{ ...포트, 편: { ...포트.편, 분야: 'SNS' } }, ['1-26', '1-40', '1-29'], 3],   // SNS 편 → 보지 않음
    ];
    const 스크립트 = 'a = json.load(sys.stdin)\nprint(json.dumps([[g for g, _ in k.관문결과검사(s, a["표"], c, n)] for s, c, n in a["경우"]]))';
    assert.deepEqual(부르기(스크립트, { 표: 표경로, 경우 }), [[], ['걸림'], ['걸림'], ['주의'], []]);
    // 검수 뒤에 시작 그림을 다시 구웠으면 본 것이 아니다
    const 새때 = new Date(Date.now() + 60000); fs.utimesSync(그림, 새때, 새때);
    assert.deepEqual(부르기(스크립트, { 표: 표경로, 경우: [[포트, ['1-29', '1-30', '1-33'], 3]] }), [['걸림']]);
  } finally {
    fs.rmSync(편, { recursive: true, force: true });
  }
});
