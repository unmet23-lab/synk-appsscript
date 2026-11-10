/* 바로올리기 — 공용 작업본: 겹친 경로만 남기고 옮기기(2026-11-03) · 따라가기 회차 잇기 · 따라가기 잠금.
 * 도구: tools/바로올리기.js. 임시 bare 원격(origin) · 공용 작업본(메인) · 세션 워크트리(연결 작업본) · 남의 클론으로 잰다.
 * 실제 저장소·원격·전역 git 설정은 건드리지 않는다. 판 · 환경 정리 · 시험 전용 전역 git 설정은 tests/lib/바로올리기판.js.
 * 한 파일이던 tests/바로올리기.test.js(시험 136개, 단독 47분)를 11-11에 다섯으로 나눴다 — 파일 안 시험은 동기 git 호출로 차례로 돌아
 *   나눠야 node --test가 나란히 돌린다(docs/현장노트/시험_화면확인.md 「바로올리기 시험 한 파일이 test-ci 전체 런의 긴 막대다」).
 *   이름으로 다시 돌릴 때: node --test --test-name-pattern="…" "tests/바로올리기*.test.js" */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync, spawn } = require('node:child_process');

const {
  도구경로, 도구, 깃, 남겼다, 새판, rename막기, 한줄씩,
} = require('./lib/바로올리기판.js');

// ── 공용 작업본: 겹친 경로만 남기고 옮기기(2026-11-03) ───────────────────────

const 남김기록 = (판) => { try { return JSON.parse(fs.readFileSync(path.join(판.공용.gitdir(), '바로올리기-남김.json'), 'utf8')).경로; } catch (e) { if (e.code === 'ENOENT') return {}; throw e; } };
const 따라감기록 = (판) => fs.readFileSync(path.join(판.공용.gitdir(), '바로올리기-따라가기.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

test('남김: 겹친 파일 하나가 있어도 나머지는 따라가고, 그 파일 바이트는 그대로 · 바탕을 기억한다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', '겹침.txt': 'x1\nx2\n', '새로.txt': 'n1\n' } });
  const B = 판.공용.머리();
  const Bblob = 판.공용.g('rev-parse', 'HEAD:겹침.txt').trim();
  판.공용.쓰기('겹침.txt', 'x1 작업본\r\nx2\r\n');
  const O = 판.남push({ 'a.txt': '2\n', '겹침.txt': 'x1 원격\nx2\n', '새로.txt': 'n2\n', 'b/더함.txt': '더함\n' });
  const 전바이트 = 판.공용.바이트('겹침.txt');
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  남겼다(r);
  assert.deepEqual(r.남김.map((x) => x.경로), ['겹침.txt']);
  assert.equal(판.공용.머리(), O);
  assert.equal(판.공용.읽기('a.txt'), '2\n');
  assert.equal(판.공용.읽기('새로.txt'), 'n2\n');
  assert.equal(판.공용.읽기('b/더함.txt'), '더함\n');
  assert.ok(판.공용.바이트('겹침.txt').equals(전바이트), '작업본 바이트가 줄끝까지 그대로');
  assert.deepEqual(판.공용.상태(), [' M 겹침.txt'], '스테이징으로 보이지 않는다');
  const 기록 = 남김기록(판)['겹침.txt'];
  assert.equal(기록.바탕, Bblob);
  assert.equal(기록.커밋, B);
  const 끝 = 따라감기록(판).at(-1);
  assert.equal(끝.결과, '따라감');
  assert.deepEqual(끝.남김, ['겹침.txt']);
});

test('남김: 그 세션이 origin 판으로 맞추면 기록에서 빠진다 · 이미 최신이어도 남긴 경로를 다시 본다', async (t) => {
  const 판 = 새판(t, { 파일: { '겹침.txt': 'x1\n' } });
  판.공용.쓰기('겹침.txt', 'x1 작업본\n');
  const O = 판.남push({ '겹침.txt': 'x1 원격\n' });
  남겼다(await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true }));
  판.공용.쓰기('겹침.txt', 'x1 원격\n');
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  assert.equal(r.결과, '이미 최신', JSON.stringify(r));
  assert.equal(r.남김, undefined);
  assert.deepEqual(남김기록(판), {});
  assert.equal(판.공용.머리(), O);
  assert.deepEqual(판.공용.상태(), []);
});

test('남김: origin이 다른 줄을 더 고치고 작업본의 겹침이 풀리면 기억한 바탕으로 합쳐 세션 줄과 origin 줄을 모두 남긴다', async (t) => {
  const 판 = 새판(t, { 파일: { 'c.txt': 'c1\nc2\nc3\nc4\nc5\nc6\n' } });
  판.공용.쓰기('c.txt', 'c1 겹침\nc2\nc3\nc4\nc5\nc6 작업본\n');
  판.남push({ 'c.txt': 'c1 원격\nc2\nc3\nc4\nc5\nc6\n' });
  남겼다(await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true }));
  // 세션이 겹친 줄을 origin 판으로 맞추고 제 줄만 남겼다 — 그사이 origin은 가운데 줄을 또 고쳤다
  const O = 판.남push({ 'c.txt': 'c1 원격\nc2\nc3 원격\nc4\nc5\nc6\n' });
  판.공용.쓰기('c.txt', 'c1 원격\nc2\nc3\nc4\nc5\nc6 작업본\n');
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(r.남김, undefined, JSON.stringify(r));
  assert.equal(판.공용.머리(), O);
  assert.equal(판.공용.읽기('c.txt'), 'c1 원격\nc2\nc3 원격\nc4\nc5\nc6 작업본\n');
  assert.deepEqual(남김기록(판), {});
});

test('남김: 남긴 파일을 공용 작업본에서 올려도 origin의 새 줄을 지우지 않는다(10-21 사고) — 조각은 세션 줄만 보인다', async (t) => {
  const 판 = 새판(t, { 파일: { 'docs/_ops/트랙.md': 한줄씩('# 트랙', '- 첫 줄', '- 둘째 줄', '- 셋째 줄', '- 넷째 줄', '- 다섯째 줄', '- 끝 줄') } });
  판.공용.쓰기('docs/_ops/트랙.md', 한줄씩('# 트랙', '- 첫 줄 세션 고침', '- 둘째 줄', '- 셋째 줄', '- 넷째 줄', '- 다섯째 줄', '- 끝 줄 세션 고침'));
  const O = 판.남push({ 'docs/_ops/트랙.md': 한줄씩('# 트랙', '- 첫 줄 원격 고침', '- 둘째 줄', '- 셋째 줄 원격 고침', '- 넷째 줄', '- 다섯째 줄', '- 원격이 더한 줄', '- 끝 줄') });
  남겼다(await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true }));
  assert.equal(판.공용.머리(), O);
  const 미리 = await 도구.올리기({ 저장소: 판.공용.폴더, 경로들: ['docs/_ops/트랙.md'], 메시지: '트랙' });
  assert.equal(미리.결과, '멈춤', JSON.stringify(미리));
  const 보기 = JSON.stringify(미리.조각보기);
  assert.ok(!보기.includes('원격'), `조각에 origin 줄이 「지운 줄」로 섞이면 안 된다: ${보기}`);
  const 묶음 = 미리.조각보기[0].조각;
  const 끝조각 = 묶음[묶음.length - 1].id;
  // 끝 줄 고침만 올린다 — 첫 줄은 origin과 겹치는 채 남는다
  const r = await 도구.올리기({ 저장소: 판.공용.폴더, 조각: [['docs/_ops/트랙.md', String(끝조각)]], 메시지: '끝 줄', 실행: true, 시험건너뜀: '시험 안' });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  const 원격글 = 깃(판.원격)('show', 'master:docs/_ops/트랙.md');
  assert.equal(원격글, 한줄씩('# 트랙', '- 첫 줄 원격 고침', '- 둘째 줄', '- 셋째 줄 원격 고침', '- 넷째 줄', '- 다섯째 줄', '- 원격이 더한 줄', '- 끝 줄 세션 고침'));
  assert.equal(판.공용.머리(), r.머리);
  assert.match(판.공용.읽기('docs/_ops/트랙.md'), /첫 줄 세션 고침/, '안 올린 세션 줄은 작업본에 그대로');
});

test('남김: 남긴 코드 파일을 통째로 올리면 겹침은 올리기가 멈추고, 겹치지 않으면 origin 줄과 합쳐 올린다', async (t) => {
  const 판 = 새판(t, { 파일: { 'c.js': 'a\nb\nc\nd\ne\n', '겹침.js': 'p\nq\n' } });
  판.공용.쓰기('겹침.js', 'p 세션\nq\n');
  판.공용.쓰기('c.js', 'a 세션\nb\nc\nd\ne\n');
  판.남push({ '겹침.js': 'p 원격\nq\n', 'c.js': 'a\nb\nc\nd\ne 원격\n' });
  // 저장 중으로 잡아 c.js도 일부러 남긴다
  process.env.SYNK_따라가기_저장중초 = '3600';
  try { 남겼다(await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true })); } finally { process.env.SYNK_따라가기_저장중초 = '0'; }
  assert.deepEqual(Object.keys(남김기록(판)).sort(), ['c.js', '겹침.js']);
  const 막힘 = await 도구.올리기({ 저장소: 판.공용.폴더, 경로들: ['겹침.js'], 메시지: '겹침', 실행: true, 시험건너뜀: '시험 안' });
  assert.equal(막힘.결과, '멈춤', JSON.stringify(막힘));
  assert.equal(깃(판.원격)('show', 'master:겹침.js'), 'p 원격\nq\n');
  const r = await 도구.올리기({ 저장소: 판.공용.폴더, 경로들: ['c.js'], 메시지: 'c', 실행: true, 시험건너뜀: '시험 안' });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(깃(판.원격)('show', 'master:c.js'), 'a 세션\nb\nc\nd\ne 원격\n', 'origin 줄을 지우지 않는다');
  assert.equal(판.공용.읽기('c.js'), 'a 세션\nb\nc\nd\ne 원격\n');
  assert.deepEqual(Object.keys(남김기록(판)), ['겹침.js']);
  assert.equal(판.공용.머리(), r.머리);
});

test('남김: 방금 저장된 파일은 합치지도 쓰지도 않고 남겼다가 시간이 지나면 합친다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 'c.txt': 'c1\nc2\nc3\nc4\n' } });
  판.공용.쓰기('c.txt', 'c1 세션\nc2\nc3\nc4\n');
  const O = 판.남push({ 'a.txt': '2\n', 'c.txt': 'c1\nc2\nc3\nc4 원격\n' });
  process.env.SYNK_따라가기_저장중초 = '3600';
  let r;
  try { r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true }); } finally { process.env.SYNK_따라가기_저장중초 = '0'; }
  남겼다(r);
  assert.match(r.남김[0].이유, /방금 저장/);
  assert.equal(판.공용.머리(), O);
  assert.equal(판.공용.읽기('c.txt'), 'c1 세션\nc2\nc3\nc4\n');
  assert.equal(판.공용.읽기('a.txt'), '2\n');
  const r2 = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  assert.equal(r2.결과, '따라감', JSON.stringify(r2));
  assert.equal(r2.남김, undefined);
  assert.equal(판.공용.읽기('c.txt'), 'c1 세션\nc2\nc3\nc4 원격\n');
  assert.deepEqual(판.공용.상태(), [' M c.txt']);
});

test('남김: 계획 뒤 · read-tree 직전에 세션이 저장한 파일을 덮지 않고 그 파일만 남긴다(깨끗했던 파일 · 합치려던 파일 · 새 파일)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', '깨끗.txt': 'k1\n', 'm.txt': 'm1\nm2\nm3\nm4\n' } });
  판.공용.쓰기('m.txt', 'm1 세션\nm2\nm3\nm4\n');
  const O = 판.남push({ 'a.txt': '2\n', '깨끗.txt': 'k1 원격\n', 'm.txt': 'm1\nm2\nm3\nm4 원격\n', '새.txt': '원격 새 파일\n' });
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true, 시험고리: { 읽은나무직전: () => {
    판.공용.쓰기('깨끗.txt', 'k1 세션이 막 저장\n');
    판.공용.쓰기('m.txt', 'm1 세션\nm2 세션이 막 저장\nm3\nm4\n');
    판.공용.쓰기('새.txt', '세션의 새 파일\n');
  } } });
  남겼다(r);
  assert.deepEqual(r.남김.map((x) => x.경로).sort(), ['m.txt', '깨끗.txt', '새.txt'].sort(), JSON.stringify(r));
  assert.equal(판.공용.머리(), O);
  assert.equal(판.공용.읽기('a.txt'), '2\n');
  assert.equal(판.공용.읽기('깨끗.txt'), 'k1 세션이 막 저장\n');
  assert.equal(판.공용.읽기('m.txt'), 'm1 세션\nm2 세션이 막 저장\nm3\nm4\n');
  assert.equal(판.공용.읽기('새.txt'), '세션의 새 파일\n');
  assert.equal(판.공용.g('diff', '--cached', '--name-only').trim(), '');
  assert.equal(남김기록(판)['새.txt'].바탕, null);
  assert.equal(따라감기록(판).at(-1).결과, '따라감');
});

test('남김: 계획 뒤 실행 전에 저장한 파일도 그 파일만 남긴다(전체를 멈추지 않는다)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 'm.txt': 'm1\nm2\nm3\nm4\n', '깨끗.txt': 'k1\n' } });
  판.공용.쓰기('m.txt', 'm1 세션\nm2\nm3\nm4\n');
  const O = 판.남push({ 'a.txt': '2\n', 'm.txt': 'm1\nm2\nm3\nm4 원격\n', '깨끗.txt': 'k1 원격\n' });
  판.공용.g('fetch', '-q', 'origin');
  const { 따라가기계획, 따라가기실행, 맥락 } = 도구._시험;
  const c = 맥락({ 저장소: 판.공용.폴더 });
  c.저장 = new Map();
  const 계획 = 따라가기계획(c, 판.공용.머리(), O);
  assert.equal(계획.결과, '계획');
  판.공용.쓰기('m.txt', 'm1 세션 다시\nm2\nm3\nm4\n');
  판.공용.쓰기('깨끗.txt', 'k1 세션\n');
  const r = 따라가기실행(c, 계획);
  남겼다(r);
  assert.equal(판.공용.머리(), O);
  assert.equal(판.공용.읽기('m.txt'), 'm1 세션 다시\nm2\nm3\nm4\n');
  assert.equal(판.공용.읽기('깨끗.txt'), 'k1 세션\n');
  assert.equal(판.공용.읽기('a.txt'), '2\n');
});

test('남김: 줄끝만 다른 고친 파일 · 미추적 파일은 겹침이 아니다', async (t) => {
  const 판 = 새판(t, { 파일: { '줄끝.txt': 'e1\ne2\n' }, autocrlf: 'true' });
  판.공용.쓰기('줄끝.txt', 'e1 원격\r\ne2\r\n');
  판.공용.쓰기('새.txt', 'n1\nn2\n');
  const O = 판.남push({ '줄끝.txt': 'e1 원격\ne2\n', '새.txt': 'n1\nn2\n' });
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(r.남김, undefined, JSON.stringify(r));
  assert.equal(판.공용.머리(), O);
  assert.deepEqual(판.공용.상태(), []);
});

test('남김: 미추적 새 파일이 origin 새 파일과 다르면 바이트를 지키고, 올리면 멈추고, 치우면 origin 판을 받는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  판.공용.쓰기('docs/초안.md', '세션 초안\n');
  const O = 판.남push({ 'a.txt': '2\n', 'docs/초안.md': '원격 판\n' });
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  남겼다(r);
  assert.match(r.남김[0].이유, /origin이 새로 넣는 파일과 다른/);
  assert.equal(판.공용.머리(), O);
  assert.equal(판.공용.읽기('a.txt'), '2\n');
  assert.equal(판.공용.읽기('docs/초안.md'), '세션 초안\n');
  assert.deepEqual(판.공용.상태(), [' M docs/초안.md']);
  assert.equal(남김기록(판)['docs/초안.md'].바탕, null);
  const 막힘 = await 도구.올리기({ 저장소: 판.공용.폴더, 경로들: ['docs/초안.md'], 메시지: '초안', 실행: true, 시험건너뜀: '시험 안' });
  assert.equal(막힘.결과, '멈춤', JSON.stringify(막힘));
  assert.equal(깃(판.원격)('show', 'master:docs/초안.md'), '원격 판\n');
  fs.rmSync(path.join(판.공용.폴더, 'docs/초안.md'));
  const r2 = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  assert.equal(r2.결과, '따라감', JSON.stringify(r2));
  assert.equal(판.공용.읽기('docs/초안.md'), '원격 판\n');
  assert.deepEqual(남김기록(판), {});
  assert.deepEqual(판.공용.상태(), []);
});

test('남김: 시각만 바뀐 깨끗한 파일로 read-tree가 멈추지 않는다(not uptodate)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 'b.txt': 'b1\n' } });
  // 내용은 같고 시각만 달라 status는 깨끗하지만, 인덱스의 시각은 낡았다
  const 옛날 = new Date(Date.now() - 3600000);
  fs.utimesSync(path.join(판.공용.폴더, 'b.txt'), 옛날, 옛날);
  const O = 판.남push({ 'b.txt': 'b2\n', 'a.txt': '2\n' });
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(r.남김, undefined, JSON.stringify(r));
  assert.equal(판.공용.머리(), O);
  assert.equal(판.공용.읽기('b.txt'), 'b2\n');
});

test('남김: 합쳐 볼 시간을 넘긴 파일 · 8000줄 넘는 파일은 그 파일만 남긴다', async (t) => {
  const 큰 = (머리) => `${머리}\n${Array.from({ length: 9000 }, (_, i) => `줄 ${i}`).join('\n')}\n`;
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', '묶음.js': 큰('처음'), 'c.txt': 'c1\nc2\nc3\nc4\n' } });
  판.공용.쓰기('묶음.js', 큰('세션'));
  판.공용.쓰기('c.txt', 'c1 세션\nc2\nc3\nc4\n');
  const O = 판.남push({ 'a.txt': '2\n', '묶음.js': 큰('원격'), 'c.txt': 'c1\nc2\nc3\nc4 원격\n' });
  process.env.SYNK_따라가기_계획한도초 = '-1';
  let r;
  try { r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true }); } finally { delete process.env.SYNK_따라가기_계획한도초; }
  남겼다(r);
  assert.equal(r.남김.length, 2);
  assert.match(JSON.stringify(r.남김), /시간을 넘겼다/);
  assert.equal(판.공용.머리(), O);
  assert.equal(판.공용.읽기('a.txt'), '2\n');
  const r2 = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  assert.deepEqual(r2.남김.map((x) => x.경로), ['묶음.js'], JSON.stringify(r2));
  assert.match(r2.남김[0].이유, /8000줄/);
  assert.equal(판.공용.읽기('c.txt'), 'c1 세션\nc2\nc3\nc4 원격\n');
});

test('남김: 기록이 깨졌으면 옮기지도 올리지도 않는다(바탕을 모르면 origin 줄을 지운다)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', '겹침.txt': 'x\n' } });
  판.공용.쓰기('겹침.txt', 'x 세션\n');
  const O = 판.남push({ '겹침.txt': 'x 원격\n' });
  남겼다(await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true }));
  fs.writeFileSync(path.join(판.공용.gitdir(), '바로올리기-남김.json'), '{깨짐');
  판.남push({ 'a.txt': '2\n' });
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.match(r.이유, /깨졌다/);
  assert.equal(판.공용.머리(), O);
  const 올림 = await 도구.올리기({ 저장소: 판.공용.폴더, 경로들: ['겹침.txt'], 메시지: 'x', 실행: true, 시험건너뜀: '시험 안' });
  assert.equal(올림.결과, '멈춤', JSON.stringify(올림));
  assert.equal(깃(판.원격)('show', 'master:겹침.txt'), 'x 원격\n');
});

test('남김: 가지를 옮기지 못해 되돌리면 남김 기록도 처음으로 돌아간다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', '겹침.txt': 'x\n' } });
  판.공용.쓰기('겹침.txt', 'x 세션\n');
  판.남push({ 'a.txt': '2\n', '겹침.txt': 'x 원격\n' });
  const B = 판.공용.머리();
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true, 시험고리: { 가지옮기기직전: () => { 판.공용.g('commit', '-q', '--allow-empty', '-m', '끼어듦'); } } });
  assert.equal(r.결과, '실패', JSON.stringify(r));
  assert.notEqual(판.공용.머리(), B);
  assert.deepEqual(남김기록(판), {});
  assert.equal(판.공용.읽기('겹침.txt'), 'x 세션\n');
  assert.equal(판.공용.읽기('a.txt'), '1\n');
});

test('남김: 워크트리는 전처럼 하나라도 겹치면 옮기지 않는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', '겹침.txt': 'x\n' } });
  const 워 = 판.워크트리('wt');
  워.쓰기('겹침.txt', 'x 세션\n');
  const 전 = 워.머리();
  판.남push({ 'a.txt': '2\n', '겹침.txt': 'x 원격\n' });
  const r = await 도구.따라가기({ 저장소: 워.폴더, 실행: true });
  assert.equal(r.결과, '멈춤', JSON.stringify(r));
  assert.equal(워.머리(), 전);
  assert.equal(워.읽기('a.txt'), '1\n');
});

test('남김: 남긴 파일을 조각으로 올리고도 겹치면 처음 바탕 커밋을 잃지 않는다(아르곤 A1)', async (t) => {
  const 판 = 새판(t, { 파일: { 'docs/_ops/트랙.md': 한줄씩('# 트랙', '- 첫 줄', '- 둘째 줄', '- 셋째 줄', '- 넷째 줄', '- 끝 줄') } });
  const B = 판.공용.머리();
  판.공용.쓰기('docs/_ops/트랙.md', 한줄씩('# 트랙', '- 첫 줄 세션 고침', '- 둘째 줄', '- 셋째 줄', '- 넷째 줄', '- 끝 줄 세션 고침'));
  판.남push({ 'docs/_ops/트랙.md': 한줄씩('# 트랙', '- 첫 줄 원격 고침', '- 둘째 줄', '- 셋째 줄', '- 넷째 줄', '- 끝 줄') });
  남겼다(await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true }));
  const 미리 = await 도구.올리기({ 저장소: 판.공용.폴더, 경로들: ['docs/_ops/트랙.md'], 메시지: '트랙' });
  const 묶음 = 미리.조각보기[0].조각;
  const r = await 도구.올리기({ 저장소: 판.공용.폴더, 조각: [['docs/_ops/트랙.md', String(묶음[묶음.length - 1].id)]], 메시지: '끝 줄', 실행: true, 시험건너뜀: '시험 안' });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.ok(r.따라가기.남김, JSON.stringify(r.따라가기));
  assert.equal(남김기록(판)['docs/_ops/트랙.md'].커밋, B, '이력은 처음 바탕부터 본다');
  assert.match(판.공용.읽기('docs/_ops/트랙.md'), /첫 줄 세션 고침/);
});

test('남김: 합친 결과를 쓰기 직전에 세션이 저장하면 덮지 않고 바탕을 기억해, 올려도 origin 줄을 지우지 않는다(아르곤 A2)', async (t) => {
  const 판 = 새판(t, { 파일: { 'm.js': 'm1\nm2\nm3\nm4\nm5\n' } });
  const Bblob = 판.공용.g('rev-parse', 'HEAD:m.js').trim();
  판.공용.쓰기('m.js', 'm1 세션\nm2\nm3\nm4\nm5\n');
  const O = 판.남push({ 'm.js': 'm1\nm2\nm3\nm4\nm5 원격\n' });
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true, 시험고리: { 따라가기쓰기직전: () => 판.공용.쓰기('m.js', 'm1 세션 막 저장\nm2\nm3\nm4\nm5\n') } });
  남겼다(r);
  assert.equal(판.공용.머리(), O);
  assert.equal(판.공용.읽기('m.js'), 'm1 세션 막 저장\nm2\nm3\nm4\nm5\n');
  assert.equal(남김기록(판)['m.js'].바탕, Bblob);
  const 올림 = await 도구.올리기({ 저장소: 판.공용.폴더, 경로들: ['m.js'], 메시지: 'm', 실행: true, 시험건너뜀: '시험 안' });
  assert.equal(올림.결과, '올림', JSON.stringify(올림));
  assert.equal(깃(판.원격)('show', 'master:m.js'), 'm1 세션 막 저장\nm2\nm3\nm4\nm5 원격\n');
});

test('남김: 옮기는 동안 작업본에서 세션 줄이 떨어지지 않아, 그때 읽어-고쳐-쓴 세션도 제 줄을 잃지 않는다(Fable 설계 검토 P1)', async (t) => {
  const 판 = 새판(t, { 파일: { 'm.js': 'm1\nm2\nm3\nm4\nm5\n', 'a.txt': '1\n' } });
  판.공용.쓰기('m.js', 'm1 세션\nm2\nm3\nm4\nm5\n');
  const O = 판.남push({ 'm.js': 'm1\nm2\nm3 원격\nm4\nm5\n', 'a.txt': '2\n' });
  const 본 = [];
  const 고리 = () => { const 글 = 판.공용.읽기('m.js'); 본.push(글); 판.공용.쓰기('m.js', `${글}세션이 붙인 줄\n`); };
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true, 시험고리: { 가지옮기기직전: () => { 본.push(판.공용.읽기('m.js')); }, 따라가기쓰기직전: 고리 } });
  남겼다(r);
  assert.equal(판.공용.머리(), O);
  for (const 글 of 본) assert.match(글, /m1 세션/, '어느 순간에도 세션 줄이 작업본에 있다');
  assert.equal(판.공용.읽기('m.js'), 'm1 세션\nm2\nm3\nm4\nm5\n세션이 붙인 줄\n');
  const r2 = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  assert.equal(r2.결과, '따라감', JSON.stringify(r2));
  assert.equal(r2.남김, undefined, JSON.stringify(r2));
  assert.equal(판.공용.읽기('m.js'), 'm1 세션\nm2\nm3 원격\nm4\nm5\n세션이 붙인 줄\n');
});

test('남김: 가지를 옮기기 전에 던져도 세션 파일은 그대로고 깨끗한 경로는 되돌아간다(Fable 설계 검토 P1)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 'm.txt': 'm1\nm2\nm3\nm4\n', '겹침.txt': 'x\n' } });
  판.공용.쓰기('m.txt', 'm1 세션\nm2\nm3\nm4\n');
  판.공용.쓰기('겹침.txt', 'x 세션\n');
  판.남push({ 'a.txt': '2\n', 'm.txt': 'm1\nm2\nm3\nm4 원격\n', '겹침.txt': 'x 원격\n' });
  const B = 판.공용.머리();
  const 기록 = path.join(판.공용.gitdir(), '바로올리기-남김.json');
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true, 시험고리: { 읽은나무직전: () => { fs.rmSync(기록, { force: true }); fs.mkdirSync(기록); } } });
  fs.rmSync(기록, { recursive: true, force: true });
  assert.equal(r.결과, '실패', JSON.stringify(r));
  assert.equal(판.공용.머리(), B);
  assert.equal(판.공용.읽기('m.txt'), 'm1 세션\nm2\nm3\nm4\n');
  assert.equal(판.공용.읽기('겹침.txt'), 'x 세션\n');
  assert.equal(판.공용.읽기('a.txt'), '1\n', '깨끗한 경로도 바탕 판으로');
  assert.equal(판.공용.g('diff', '--cached', '--name-only').trim(), '');
});

test('남김: 합친 결과를 끝내 못 쓰면 작업본 그대로 남기고 다음 번에 잇는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'b.txt': 'b1\nb2\nb3\n' } });
  판.공용.쓰기('b.txt', 'b1 내 것\nb2\nb3\n');
  const O = 판.남push({ 'b.txt': 'b1\nb2\nb3 원격\n' });
  const 막음 = rename막기(t, 'b.txt', Infinity);
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true, 시험고리: { 따라가기쓰기직전: 막음.걸기 } });
  막음.풀기();
  남겼다(r);
  assert.match(r.주의, /작업본 그대로 남겼다/);
  assert.equal(판.공용.머리(), O);
  assert.equal(판.공용.읽기('b.txt'), 'b1 내 것\nb2\nb3\n');
  const r2 = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  assert.equal(r2.결과, '따라감', JSON.stringify(r2));
  assert.equal(판.공용.읽기('b.txt'), 'b1 내 것\nb2\nb3 원격\n');
});

test('남김: 계획 뒤에 올린 스테이징을 덮지 않는다(GPT GA1)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 's.txt': 's1\n' } });
  판.공용.쓰기('s.txt', 's1 세션\n');
  const O = 판.남push({ 'a.txt': '2\n', 's.txt': 's1 원격\n' });
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true, 시험고리: { 가지옮기기직전: () => {
    판.공용.쓰기('s.txt', 's1 세션 스테이징\n');
    판.공용.g('add', 's.txt');
    판.공용.쓰기('s.txt', 's1 세션 더 고침\n');
  } } });
  남겼다(r);
  assert.equal(판.공용.머리(), O);
  assert.equal(판.공용.g('show', ':s.txt'), 's1 세션 스테이징\n', '스테이징이 그대로');
  assert.equal(판.공용.읽기('s.txt'), 's1 세션 더 고침\n');
  assert.equal(판.공용.읽기('a.txt'), '2\n');
});

test('남김: 남긴 파일 자리가 origin에서 폴더가 되어도 그 아래 경로가 지움으로 스테이징되지 않고, 파일을 치우면 받는다(GPT GA2)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', p: 'p1\n' } });
  판.공용.쓰기('p', 'p1 세션\n');
  const O = 판.남push({ 'a.txt': '2\n', p: null, 'p/child.txt': '자식\n' });
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  남겼다(r);
  assert.deepEqual(r.남김.map((x) => x.경로).sort(), ['p', 'p/child.txt']);
  assert.equal(판.공용.머리(), O);
  assert.equal(판.공용.읽기('p'), 'p1 세션\n');
  assert.equal(판.공용.읽기('a.txt'), '2\n');
  assert.equal(판.공용.g('diff', '--cached', '--name-only').trim(), '', '스테이징이 생기지 않는다');
  fs.rmSync(path.join(판.공용.폴더, 'p'));
  const r2 = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true });
  assert.equal(r2.결과, '따라감', JSON.stringify(r2));
  assert.equal(판.공용.읽기('p/child.txt'), '자식\n');
  assert.deepEqual(판.공용.상태(), []);
  assert.deepEqual(남김기록(판), {});
});

test('따라가기 회차 잇기: 첫 회차가 남긴 경로만 다시 본 「이미 최신」이어도 다음 회차 결과를 그대로 낸다(아르곤 A3)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', '겹침.txt': 'x\n' } });
  판.공용.쓰기('겹침.txt', 'x 세션\n');
  const O = 판.남push({ '겹침.txt': 'x 원격\n' });
  남겼다(await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true }));
  const 다음 = 판.남push({ 'a.txt': '2\n' });
  판.공용.g('fetch', '-q', 'origin');
  const 워 = 판.워크트리('wt', 'master');
  const { 공용따라가기, 맥락 } = 도구._시험;
  const c = 맥락({ 저장소: 워.폴더 });
  c.저장 = new Map();
  const r = 공용따라가기(c, O);
  assert.equal(r.결과, '따라감', JSON.stringify(r));
  assert.equal(판.공용.머리(), 다음);
  assert.equal(r.경로 > 0, true, JSON.stringify(r));
  assert.deepEqual(r.남김.map((x) => x.경로), ['겹침.txt']);
});

test('남김: 모드만 올린 스테이징도 덮지 않고, 인덱스를 맞추는 동안은 git add가 끼어들지 못한다(GPT 다시 검수 GA1 · GA3)', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 's.txt': 's1\n', 'm.txt': 'm1\n' } });
  판.공용.쓰기('s.txt', 's1 세션\n');
  판.공용.쓰기('m.txt', 'm1 세션\n');
  const O = 판.남push({ 'a.txt': '2\n', 's.txt': 's1 원격\n', 'm.txt': 'm1 원격\n' });
  let 끼어듦 = null;
  const r = await 도구.따라가기({ 저장소: 판.공용.폴더, 실행: true, 시험고리: {
    가지옮기기직전: () => 판.공용.g('update-index', '--chmod=+x', 's.txt'),
    색인재검사뒤: () => { 끼어듦 = spawnSync('git', ['add', 'm.txt'], { cwd: 판.공용.폴더, encoding: 'utf8' }); },
  } });
  남겼다(r);
  assert.equal(r.주의, undefined, JSON.stringify(r));
  assert.equal(판.공용.머리(), O);
  assert.match(판.공용.g('ls-files', '-s', 's.txt'), /^100755 /, '모드 스테이징이 그대로');
  assert.notEqual(끼어듦.status, 0, 'index.lock을 쥔 동안 git add는 들어오지 못한다');
  assert.equal(판.공용.g('show', ':m.txt'), 'm1 원격\n');
  assert.ok(!fs.existsSync(path.join(판.공용.gitdir(), 'index.lock')), '잠금을 풀었다');
});

const 잠금걸기 = (판, 글) => { const 값 = execFileSync('git', ['hash-object', '-w', '--stdin'], { cwd: 판.공용.폴더, input: 글, encoding: 'utf8' }).trim(); 판.공용.g('update-ref', 'refs/synk/따라가기잠금', 값); return 값; };
const 잠금값 = (판) => { const r = spawnSync('git', ['rev-parse', '-q', '--verify', 'refs/synk/따라가기잠금'], { cwd: 판.공용.폴더, encoding: 'utf8' }); return r.stdout.trim(); };
/** 끝난 프로세스의 번호 */
const 죽은번호 = () => spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' }).stdout;

test('따라가기 잠금: 다른 세션이 공용 작업본을 따라가는 중이면 건너뛰고, 죽은 잠금은 회수한다 · 끝나면서 그사이 올라온 커밋까지 받는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n', 'b.txt': 'b\n' } });
  const 워 = 판.워크트리('wt');
  잠금걸기(판, `${process.pid} ${Date.now()} 산 주인\n`);
  워.쓰기('a.txt', '2\n');
  const r = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 2', 실행: true });
  assert.equal(r.결과, '올림', JSON.stringify(r));
  assert.equal(r.공용따라가기.결과, '건너뜀', JSON.stringify(r.공용따라가기));
  assert.match(r.공용따라가기.이유, /따라가는 중/);
  assert.equal(판.공용.읽기('a.txt'), '1\n');
  잠금걸기(판, `${죽은번호()} ${Date.now()} 죽은 주인\n`);
  워.쓰기('a.txt', '3\n');
  const r2 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 3', 실행: true });
  assert.equal(r2.공용따라가기.결과, '따라감', JSON.stringify(r2.공용따라가기));
  assert.equal(판.공용.머리(), r2.머리);
  assert.equal(잠금값(판), '', '끝나면 잠금을 푼다');
  // 따라가는 사이 올라온 커밋까지
  워.쓰기('a.txt', '4\n');
  const r3 = await 도구.올리기({ 저장소: 워.폴더, 경로들: ['a.txt'], 메시지: 'a 4', 실행: true, 공용안따라감: true });
  assert.equal(r3.결과, '올림');
  const 다음 = 판.남push({ 'b.txt': 'b 원격\n' });
  판.공용.g('fetch', '-q', 'origin');
  const { 공용따라가기, 맥락 } = 도구._시험;
  const c = 맥락({ 저장소: 워.폴더 });
  c.저장 = new Map();
  const r4 = 공용따라가기(c, r3.머리);
  assert.equal(r4.결과, '따라감', JSON.stringify(r4));
  assert.equal(판.공용.머리(), 다음, '목표 뒤에 올라온 커밋까지 받는다');
  assert.equal(판.공용.읽기('b.txt'), 'b 원격\n');
});

test('따라가기 잠금: 끊긴 잠금을 동시에 회수해도 한 프로세스만 잡고, 회수된 뒤의 옛 주인 풀기는 새 주인 잠금을 지우지 않는다', async (t) => {
  const 판 = 새판(t, { 파일: { 'a.txt': '1\n' } });
  const { 따라가기잠금, 맥락 } = 도구._시험;
  const c = 맥락({ 저장소: 판.공용.폴더 });
  // 옛 주인이 잡은 뒤 30분이 지나 끊긴 것으로 회수되었다
  const 옛주인 = 따라가기잠금(c);
  assert.ok(옛주인);
  잠금걸기(판, `${죽은번호()} ${Date.now()} 끊긴 주인\n`);
  const 끊긴값 = 잠금값(판);
  옛주인.풀기();
  assert.equal(잠금값(판), 끊긴값, '내 값이 아니면 풀지 않는다');
  const 도구줄 = JSON.stringify(도구경로), 폴더줄 = JSON.stringify(판.공용.폴더);
  const 글 = `const d=require(${도구줄})._시험;const c=d.맥락({저장소:${폴더줄}});const l=d.따라가기잠금(c);process.stdout.write(l?'잡음':'못 잡음');setTimeout(()=>{if(l)l.풀기();},4000);`;
  const { spawn } = require('node:child_process');
  const 결과 = await Promise.all(Array.from({ length: 6 }, () => new Promise((풀림) => {
    const p = spawn(process.execPath, ['-e', 글], { stdio: ['ignore', 'pipe', 'pipe'] });
    let 나옴 = '';
    p.stdout.on('data', (d) => { 나옴 += d; });
    p.on('close', () => 풀림(나옴));
  })));
  assert.equal(결과.filter((x) => x === '잡음').length, 1, JSON.stringify(결과));
  assert.equal(잠금값(판), '', '주인이 끝나며 풀었다');
});
