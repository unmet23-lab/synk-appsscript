'use strict';
// ⑳ 최종본 관문(tools/lib/최종본관문.js) — 최종본검사.py가 낸 걸림을 고칠 것 · 확인할 것으로 매기는지, 「최종본판단」 까닭이 고칠 것을 내리는지,
// 같은 영상이면 다시 재지 않는지, 관문 밖 편(LAB · 슬롯이 11-14 전)은 묻지 않는지. 파이썬 도구는 가짜로 바꿔 끼운다(실제 잼은 tests/최종본검사.test.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { finalCutFindings, applies, FINAL_FROM } = require('../tools/lib/최종본관문.js');
const { FIX, LOOK } = require('../tools/lib/게시글규칙.js');

const 걸림 = [
  { 항목: '굳음', 초: 21.42, 끝초: 23.42, 글: '21.42~23.42초 컷의 사람이 굳어 있다' },
  { 항목: '같은판', 초: 5.5, 글: '5.5초 컷 경계가 앞 컷과 같은 그림이다' },
  { 항목: '되풀이', 초: 21.42, 앞초: 4.42, 글: '같은 그림의 컷이 3번 나온다' },
  { 항목: '끝소리', 초: 57.2, 글: '끝 2.5초가 방 소리뿐이다' },
];

function fixture(t, prep) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), '최종본관문-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, '게시'));
  const video = path.join(dir, '게시', 'a_master.mp4');
  fs.writeFileSync(video, 'video');
  return { bundle: { dir, name: 'synkbrief_시험_20261113', repo: dir, prep: { 브랜드: 'synkbrief', 슬롯: FINAL_FROM, ...prep } }, video };
}

test('굳음 · 같은판은 고칠 것, 나머지는 확인할 것 — 「최종본판단」 까닭이 있으면 고칠 것이 확인할 것으로', (t) => {
  const { bundle, video } = fixture(t);
  let runs = 0;
  const run = () => { runs++; return { 걸림 }; };
  const out = finalCutFindings(bundle, [video], { run });
  assert.deepEqual(out.map((f) => [f.code, f.level]), [
    ['final-cut-굳음', FIX], ['final-cut-같은판', FIX], ['final-cut-되풀이', LOOK], ['final-cut-끝소리', LOOK]]);
  assert.match(out[1].message, /「최종본판단」 \{"같은판@5\.5": "까닭"\}/);
  // 같은 영상이면 기록(게시/최종본검사.json)에서 읽고 다시 재지 않는다
  finalCutFindings(bundle, [video], { run });
  assert.equal(runs, 1);
  // 까닭: 자리 하나(항목@초) · 항목 전체
  bundle.prep.최종본판단 = { '같은판@5.5': '말 박자에 맞춘 펀치인 — 진행자 편', 굳음: '숨 고르는 멈춤' };
  const eased = finalCutFindings(bundle, [video], { run });
  assert.deepEqual(eased.map((f) => f.level), [LOOK, LOOK, LOOK, LOOK]);
  assert.match(eased[1].message, /「최종본판단」: 말 박자에 맞춘 펀치인/);
  // 영상이 바뀌면 다시 잰다
  fs.appendFileSync(video, 'x');
  finalCutFindings(bundle, [video], { run });
  assert.equal(runs, 2);
});

test('yuhobuilds는 캡처 · 캐릭터를 일부러 멈추는 편이 많아 모두 확인할 것 — 「사람편」: true면 실사로 보고 고칠 것', (t) => {
  const { bundle, video } = fixture(t, { 브랜드: 'yuhobuilds' });
  const run = () => ({ 걸림 });
  assert.deepEqual(finalCutFindings(bundle, [video], { run, save: false }).map((f) => f.level), [LOOK, LOOK, LOOK, LOOK]);
  bundle.prep.사람편 = true;
  assert.deepEqual(finalCutFindings(bundle, [video], { run, save: false }).map((f) => f.level), [FIX, FIX, LOOK, LOOK]);
});

test('「최종본」 영상과, 판이 쓰는 다른 렌더를 잰다 — 올리기판(같은 그림을 다시 누른 것) · 그림 파일은 재지 않는다', (t) => {
  const { bundle, video } = fixture(t, {});
  const upload = path.join(bundle.dir, '게시', 'a_upload.mp4');
  const tiktok = path.join(bundle.dir, '게시', 'a_tiktok_끝말.mp4');
  fs.writeFileSync(upload, 'small');
  fs.writeFileSync(tiktok, 'other render');
  fs.writeFileSync(path.join(bundle.dir, '게시', '표지.jpg'), 'jpg');
  bundle.prep.최종본 = ['게시/a_master.mp4', '게시/표지.jpg'];
  const seen = [];
  finalCutFindings(bundle, [video, upload, tiktok], { run: (f) => { seen.push(path.basename(f)); return { 걸림: [] }; }, save: false });
  assert.deepEqual(seen, ['a_master.mp4', 'a_tiktok_끝말.mp4']);
});

test('못 잰 항목은 확인할 것 줄로 보이고 기록하지 않아 다음에 다시 잰다 · 기록에는 이 PC 경로 없이 도구 판과 함께 · --저장안함은 기록하지 않는다', (t) => {
  const { bundle, video } = fixture(t);
  let runs = 0;
  const partial = () => { runs++; return { 파일: video, 걸림: [걸림[1]], 못잼: [{ 항목: '굳음', 오류: 'FileNotFoundError: 사람움직임.py' }] }; };
  const out = finalCutFindings(bundle, [video], { run: partial });
  assert.deepEqual(out.map((f) => [f.code, f.level]), [['final-cut-같은판', FIX], ['final-cut-unmeasured', LOOK]]);
  assert.match(out[1].message, /굳음을 못 쟀다.*실사 재연의 고칠 것 항목/);
  finalCutFindings(bundle, [video], { run: partial });
  assert.equal(runs, 2, '못 잰 결과는 기록하지 않는다');
  const cacheFile = path.join(bundle.dir, '게시', '최종본검사.json');
  assert.equal(fs.existsSync(cacheFile), false);
  finalCutFindings(bundle, [video], { run: () => ({ 파일: video, 걸림: [] }), save: false });
  assert.equal(fs.existsSync(cacheFile), false, '--저장안함');
  finalCutFindings(bundle, [video], { run: () => ({ 파일: video, 걸림: [] }) });
  const saved = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
  const row = Object.values(saved)[0];
  assert.equal(Object.keys(saved)[0], '게시/a_master.mp4', '열쇠는 저장소 기준 경로');
  assert.equal(row.결과.파일, undefined, '절대 경로는 남기지 않는다');
  assert.match(row.도구, /^[0-9a-f]{12}$/);
});

test('도구가 실패하면 막지 않고 확인할 것 한 줄', (t) => {
  const { bundle, video } = fixture(t);
  const out = finalCutFindings(bundle, [video], { run: () => { throw new Error('ffprobe 실패'); }, save: false });
  assert.equal(out.length, 1);
  assert.equal(out[0].level, LOOK);
  assert.match(out[0].message, /ffprobe 실패/);
});

test('관문 밖 편은 재지 않는다 — LAB · 「사람편」 아닌 브랜드 · 슬롯이 11-14 전', () => {
  assert.equal(applies({ 브랜드: 'synkbrief', 슬롯: '2026-11-14' }), true);
  assert.equal(applies({ 브랜드: 'yuhobuilds', 슬롯: '2026-11-20' }), true);
  assert.equal(applies({ 브랜드: 'LAB', 슬롯: '2026-11-20' }), false);
  assert.equal(applies({ 브랜드: 'shift', 슬롯: '2026-11-20', 사람편: true }), true);
  assert.equal(applies({ 브랜드: 'synkbrief', 슬롯: '2026-11-13' }), false);
  assert.equal(applies({ 브랜드: 'synkbrief' }), false);
  // 슬롯은 그대로 두고 판 시각만 뒤로 옮긴 편도 관문에 든다
  assert.equal(applies({ 브랜드: 'synkbrief', 슬롯: '2026-11-13', 판: [{ 시각: '2026-11-15T21:00:00+09:00' }] }), true);
});
