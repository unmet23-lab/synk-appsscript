'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { 집계, 화면 } = require('../tools/워크플로성과.js');
const 빌드 = require('../tools/codex-build.js');
const row = (키, extra = {}) => ({ 시각: '2026-09-01', 지적: [{ 키, 발견벤더들: ['codex'], 비교벤더수: 2 }], ...extra });
const done = (키, 처분, extra = {}) => ({ 시각: '2026-09-02', 키, 처분, ...extra });
test('채택·기각·대상 제외·미처분의 분모를 분리한다', () => {
  const r = 집계(['a','b','c','d'].map((k) => row(k)), [done('a','채택수리'),done('b','기각'),done('c','대상아님')], []);
  assert.deepEqual(r.검수.벤더.codex, { 지적: 4, 채택수리: 1, 기각: 1, 대상제외: 1, 미처분: 1, 단독채택: 1, 교차채택: 1 });
});
test('같은 키라도 다른 저장소의 처분은 섞지 않는다', () => {
  const r = 집계([row('a'), row('a', { 저장소: 'SYNK-talk' })], [done('a', '채택수리')], []);
  assert.equal(r.검수.벤더.codex.채택수리, 1);
  assert.equal(r.검수.벤더.codex.미처분, 1);
});
test('재등장한 지적을 옛 처분으로 채택·기각하지 않는다', () => {
  const r = 집계([row('a'), row('a', { 시각: '2026-09-03' })], [done('a', '채택수리')], []);
  assert.equal(r.검수.고유지적, 1);
  assert.equal(r.검수.벤더.codex.미처분, 1);
});
test('무효 검수 행은 모델 성과가 아니다', () => {
  const r = 집계([row('a'), { 종류: '무효', 무효행: '2026-09-01' }], [done('a','채택수리')], []);
  assert.equal(r.검수.고유지적, 0);
});
test('옛 복수 벤더 결과를 임의로 어느 모델의 성과로 돌리지 않는다', () => {
  const r = 집계([{ 시각: '2026-09-01', 벤더들: ['codex','gemini'], 지적: [{ 키: 'a' }] }], [done('a','채택수리')], []);
  assert.equal(r.검수.벤더.미기록.채택수리, 1);
  assert.equal(r.검수.벤더.미기록.단독채택, 0);
});
test('한 벤더만 검사한 채택은 교차 비교의 단독 기여가 아니다', () => {
  const r = 집계([{ 시각: '2026-09-01', 지적: [{ 키: 'a' }] }], [done('a','채택수리')], []);
  assert.equal(r.검수.벤더.codex.교차채택, 0);
});
test('발주 최신 상태만 세고 소요 시간 없는 옛 기록을 0초로 만들지 않는다', () => {
  const r = 집계([], [], [
    { 시각:'2026-09-01', 발주:{ 지문:'a' }, 상태:'남음' },
    { 시각:'2026-09-02', 발주:{ 지문:'a' }, 상태:'완주', 소요ms:1000, 라운드들:[{},{}] },
    { 시각:'2026-09-02', 발주:{ 지문:'b' }, 상태:'남음' },
  ]);
  assert.equal(r.실행.발주, 2);
  assert.equal(r.실행.소요측정, 1);
  assert.equal(r.실행.마지막호출중앙ms, 1000);
  assert.equal(r.실행.완주, 1);
  const 글 = 화면({ ...r, 자료: [{ 못읽음: true }] });
  assert.match(글, /확인 불가/);
});
test('수용 재개는 같은 커밋·깨끗한 작업본·시험과 검수 완료일 때만 허용한다', () => {
  const sha = 'a'.repeat(40);
  const 검수 = { 벤더:'claude', 종료:0, 차단수:0 };
  const r = { 상태:'수용확인불가', 라운드들:[{ sha, 검수, 시험:[{ 통과:true }], 수용검사:{ 미충족:[] } }] };
  assert.equal(빌드.수용재개가능(r, sha, 0), true);
  assert.equal(빌드.수용재개가능({ ...r, 라운드들:[{ ...r.라운드들[0], sha:null, 검수대상:null, 대상커밋:sha }] }, sha, 0), true, '재개 뒤 재개도 같은 과녁을 유지한다');
  assert.equal(빌드.수용재개가능(r, 'b'.repeat(40), 0), false);
  assert.equal(빌드.수용재개가능(r, sha, 1), false);
  for (const patch of [
    { 검수:null }, { 검수:{ 종료:0, 차단수:0 } }, { 검수:{ ...검수, 벤더:'codex' } },
    { 검수:{ ...검수, 종료:2 } }, { 검수:{ ...검수, 차단수:1 } },
    { 시험:[] }, { 수용검사:{ 미충족:[{}] } },
  ]) {
    assert.equal(빌드.수용재개가능({ ...r, 라운드들:[{ ...r.라운드들[0], ...patch }] }, sha, 0), false);
  }
});
