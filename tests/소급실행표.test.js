'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { 현재마감, 선택, 마크다운 } = require('../tools/소급실행표');

const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/_ops/소급불가_울트라/전량.json'), 'utf8'));
const verdict = JSON.parse(fs.readFileSync(path.join(root, 'docs/_ops/소급불가_울트라/어느학생_판정_0909.json'), 'utf8'));

test('후속 판정으로 앞당긴 두 마감이 옛 파일럿 날짜를 대체한다', () => {
  for (const id of ['critic-8', 'gap-verdict-pages-12']) {
    const item = source.find((v) => v.id === id);
    const deadline = 현재마감(item, verdict);
    assert.equal(deadline.말, verdict._63건재판정[id].새마감);
    assert.equal(deadline.순, 0);
    assert.ok(선택(source, verdict, {}).some((v) => v.id === id));
  }
});

test('실학생 데이터는 현장 2월까지 미루지 않고 먼저 열릴 온라인 접점을 확인하게 한다', () => {
  const id = Object.keys(verdict.판정).find((key) => verdict.판정[key].마감 === '데이터');
  const item = source.find((v) => v.id === id);
  assert.match(현재마감(item, verdict).말, /첫 실제 수집 전.*온라인 1기 적용 여부 확인/);
  assert.ok(선택([item], verdict, {}).length);
  assert.deepEqual(선택([item], verdict, { 전량: true }), [item]);
  const result = 마크다운([item], verdict);
  assert.match(result, /2026-11-30 전/);
  assert.match(result, /무료 진단의 첫 실제 답을 공개 전부터 보존/);
});

test('새 항목·알 수 없는 판정 값은 날짜 미확인으로 남기며 늦춰도 된다고 표시하지 않는다', () => {
  const item = { id: 'new', title: '첫 응답', deadline_event: '첫 학생이 답하는 날', confidence: 'high' };
  assert.equal(현재마감(item, { 판정: {} }).순, 4);
  assert.equal(현재마감(item, { 판정: { new: { 마감: '새로운값' } } }).순, 4);
  assert.deepEqual(선택([item], { 판정: {} }, { 모르는것: true }), [item]);
});

test('짧은 색인은 모든 ID·수정 위치를 남기고 상세 조회는 원문 배경을 되돌려준다', () => {
  const all = 선택(source, verdict, { 전량: true });
  const compact = 마크다운(all, verdict);
  assert.equal(new Set(all.map((v) => v.id)).size, source.length);
  assert.equal((compact.match(/^- \*\*ID\*\*/gm) || []).length, source.length);
  for (const item of all) {
    assert.ok(compact.includes(`**ID** \`${item.id}\``));
    assert.ok(compact.includes(String(item.source || '').replace(/\r?\n/g, ' ')));
  }
  const item = source[0];
  const detailed = 마크다운(선택(source, verdict, { 항목: item.id }), verdict, { 상세: true });
  assert.ok(detailed.includes(item.what_is_lost.replace(/\r?\n/g, ' ')));
  assert.ok(detailed.includes(item.current_state.replace(/\r?\n/g, ' ')));
});

test('저장된 MD는 재생성 결과와 같고 반복 실행에서 날짜·환경 때문에 바뀌지 않는다', () => {
  const run = () => execFileSync(process.execPath, ['tools/소급실행표.js', '--전량', '--md'], { cwd: root });
  const text = (bytes) => bytes.toString('utf8').replace(/\r\n/g, '\n');
  const generated = run();
  assert.deepEqual(generated, run());
  assert.equal(text(generated), text(fs.readFileSync(path.join(root, 'docs/소급_실행표_0908.md'))),
    'Git/Windows 체크아웃의 CRLF 차이는 내용 변경이 아니다');
});

test('없는 ID의 상세 조회는 조용히 빈 성공을 내지 않는다', () => {
  assert.throws(() => execFileSync(process.execPath,
    ['tools/소급실행표.js', '--항목', 'definitely-missing-id', '--상세', '--md'],
    { cwd: root, stdio: 'pipe' }), (error) => error.status === 1);
});
