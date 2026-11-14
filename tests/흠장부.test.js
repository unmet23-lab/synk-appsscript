'use strict';
/* 흠 장부(tools/흠장부.js) — 최종 확인 이력을 편들에 걸쳐 모아 되풀이된 갈래를 센다(2026-11-15) */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const 장부 = require('../tools/흠장부.js');

const 편 = (root, 이름, 줄들, 옛기록) => {
  const d = path.join(root, 이름, '게시');
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, '준비.json'), JSON.stringify({ 브랜드: 이름.split('_')[0] }));
  if (줄들) fs.writeFileSync(path.join(d, '최종확인_이력.jsonl'), 줄들.map((x) => JSON.stringify(x)).join('\n') + '\n');
  if (옛기록) fs.writeFileSync(path.join(d, '최종확인.json'), JSON.stringify(옛기록));
};

test('흠 장부: 이력을 모아 갈래마다 서로 다른 편 수를 세고, 세 편 이상이면 기계 검사로 올릴 차례로 띄운다', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'flaw-'));
  const 지금 = new Date().toISOString();
  편(root, 'synkbrief_가', [{ 결과: '미흡', 시각: 지금, 갈래: ['멈춘화면', '끝약함'], 메모: '6초 멈춘 표' }, { 결과: '미흡', 시각: 지금, 갈래: ['멈춘화면'], 메모: '또 멈춤' }, { 결과: '통과', 시각: 지금, 갈래: [], 메모: '봄' }]);
  편(root, 'synkbrief_나', [{ 결과: '작은 흠', 시각: 지금, 갈래: ['멈춘화면'], 메모: '1.5초 멈춤' }]);
  편(root, 'yuhobuilds_다', [{ 결과: '미흡', 시각: 지금, 갈래: ['멈춘화면'], 메모: '3.5초 멈춤' }]);
  편(root, 'yuhobuilds_옛', null, { 결과: '미흡', 시각: 지금, 메모: '안경이 클로즈업끼리 다름' });
  편(root, 'lab_라', [{ 결과: '미흡', 시각: 지금, 갈래: ['멈춘화면'], 메모: '다른 브랜드' }]);
  편(root, 'synkbrief_오래', [{ 결과: '미흡', 시각: '2026-01-01T00:00:00Z', 갈래: ['사실'], 메모: '오래된 것' }]);
  const 전체 = 장부.세기(장부.모으기(root, { 부터: Date.now() - 30 * 86400000 }));
  const 멈춤 = 전체.find((c) => c.갈래 === '멈춘화면');
  assert.equal(멈춤.편수, 3, '같은 편의 두 판정은 한 편으로 세고 다른 브랜드 편은 뺀다');
  assert.equal(멈춤.판정, 4);
  assert.equal(멈춤.작은흠, 1);
  assert.equal(멈춤.상태, '기계 검사로 올릴 차례');
  assert.equal(전체.find((c) => c.갈래 === '끝약함').상태, '');
  assert.ok(전체.find((c) => c.갈래 === '소품튐'), '갈래 없는 옛 기록은 메모에서 어림으로 고른다');
  assert.ok(!전체.find((c) => c.갈래 === '사실'), '기간 밖 판정은 뺀다');
  const 한쪽 = 장부.세기(장부.모으기(root, { 브랜드: 'yuhobuilds', 부터: 0 }));
  assert.equal(한쪽.find((c) => c.갈래 === '멈춘화면').편수, 1);
});

test('흠 장부: 어림은 메모에 맞는 갈래가 없으면 기타다', () => {
  assert.deepEqual(장부.어림('무엇인지 모를 흠'), ['기타']);
  assert.ok(장부.어림('33.5~39.9초 6.4초 멈춘 표 카드').includes('멈춘화면'));
});
