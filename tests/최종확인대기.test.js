'use strict';
// 최종 확인 예약 작업이 쓰는 「대기 · 고칠편 · 맡기 · 놓기」(11-15 유호님 「예약으로 바꿔」).
// 11-14 최종 확인 세션의 감시가 꺼진 뒤 고친 판 여덟 편이 19시간 다시 보이지 않았다 — 예약 회차가 scan()으로 찾고,
// 제작 회차는 needsFix()로 미흡 편을 먼저 고친다. 두 회차가 같은 편을 보지 않게 맡음 표시를 둔다(11-15 Fable 검수 P1 · P2 반영).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const lockDir = fs.mkdtempSync(path.join(os.tmpdir(), '최종확인맡음-'));
process.env.SYNK_FINAL_LOCK_DIR = lockDir;
const 묶음 = require('../tools/lib/게시묶음.js');
const 확인 = require('../tools/lib/최종확인.js');
const CLI = path.join(__dirname, '..', 'tools', '최종확인.js');

function repo(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '최종확인대기-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'tools'));
  fs.mkdirSync(path.join(root, 'docs', '마케팅'), { recursive: true });
  return root;
}

// 편 하나 — 영상은 지문만 보므로 몇 바이트면 된다
function piece(root, name, { 브랜드 = 'synkbrief', 슬롯 = '2026-11-20', 상태 = '완성', 결과 = '확인할 것', 판시각, 게시결과 } = {}) {
  const dir = path.join(root, 'docs', '마케팅', name);
  fs.mkdirSync(path.join(dir, '게시'), { recursive: true });
  fs.writeFileSync(path.join(dir, '게시', 'final.mp4'), `영상 ${name}`);
  const 시각 = 판시각 || `${슬롯}T21:00:00+09:00`;
  fs.writeFileSync(path.join(dir, '게시', '준비.json'), JSON.stringify({ 브랜드, 슬롯, 상태, 최종본: '게시/final.mp4', 검사: { 결과 },
    판: [{ 계정: `${브랜드}-instagram`, 파일: '게시/final.mp4', 시각 }, { 계정: `${브랜드}-youtube`, 파일: '게시/final.mp4', 시각 }] }));
  if (게시결과) fs.writeFileSync(path.join(dir, '게시', '게시결과.json'), JSON.stringify({ 판: 게시결과 }));
  return dir;
}

const root마케팅 = (root) => path.join(root, 'docs', '마케팅');
const 차례 = (root) => Object.fromEntries(확인.scan(root마케팅(root)).map((x) => [x.편, x.차례]));

test('기록 없는 완성 편 · 영상이 바뀐 미흡 편은 「다시 볼 차례」, 그대로인 미흡 편은 「고칠 차례」, 통과 편은 「열림」', (t) => {
  const root = repo(t);
  piece(root, 'synkbrief_새편_20261115');
  const 고친 = piece(root, 'yuhobuilds_고친편_20261113', { 브랜드: 'yuhobuilds', 슬롯: '2026-11-16' });
  확인.write(묶음.load(고친), '미흡', '끝 3초가 약함', { 갈래: '끝약함' });
  fs.writeFileSync(path.join(고친, '게시', 'final.mp4'), '다시 렌더한 영상');
  const 그대로 = piece(root, 'synkbrief_그대로_20261113', { 슬롯: '2026-11-17' });
  확인.write(묶음.load(그대로), '미흡', '6초 멈춘 표', { 갈래: '멈춘화면' });
  const 통과 = piece(root, 'synkbrief_통과_20261113', { 슬롯: '2026-11-18' });
  확인.write(묶음.load(통과), '통과', '컷 전수', { 독립검수: '시험 — 그대로 내도 된다' });
  piece(root, 'synkbrief_만드는중_20261114', { 상태: '제작 중(미흡 — 고치는 중)' });
  piece(root, 'synkbrief_검사걸림_20261114', { 결과: '고칠 것' });
  piece(root, 'LAB_다른브랜드_20261114', { 브랜드: 'LAB' });
  piece(root, 'synkbrief_옛편_20261101', { 슬롯: '2026-11-02' });
  // 다 나간 뒤 영상 파일만 바뀐 편은 다시 볼 까닭이 없다(11-15 Fable 검수 P2)
  const 나감 = piece(root, 'synkbrief_나감_20261114', { 슬롯: '2026-11-14',
    게시결과: [{ 계정: 'synkbrief-instagram', 상태: '게시됨' }, { 계정: 'synkbrief-youtube', 상태: '게시됨' }] });
  확인.write(묶음.load(나감), '통과', '컷 전수', { 독립검수: '시험 — 그대로 내도 된다' });
  fs.writeFileSync(path.join(나감, '게시', 'final.mp4'), '나간 뒤 다시 렌더');
  assert.deepEqual(차례(root), {
    'synkbrief_새편_20261115': '다시 볼 차례',
    'yuhobuilds_고친편_20261113': '다시 볼 차례',
    'synkbrief_그대로_20261113': '고칠 차례',
    'synkbrief_통과_20261113': '열림',
    'synkbrief_만드는중_20261114': '제작 중',
    'synkbrief_검사걸림_20261114': '제작 중',
    'synkbrief_나감_20261114': '이미 나감',
  });
  const list = 확인.scan(root마케팅(root));
  assert.deepEqual(list.map((x) => x.슬롯), [...list.map((x) => x.슬롯)].sort(), '슬롯 순');
  assert.equal(path.basename(list.find((x) => x.편 === 'synkbrief_새편_20261115').볼영상), 'final.mp4');
  assert.match(list.find((x) => x.편 === 'yuhobuilds_고친편_20261113').까닭, /영상이 바뀌었다/);
});

test('기록 없이 판이 모두 게시됨 · 예약됨인 편(관문 앞에 나간 편)은 「이미 걸림」 — 하나라도 안 걸렸으면 다시 볼 차례', (t) => {
  const root = repo(t);
  piece(root, 'synkbrief_다걸림_20261110', { 슬롯: '2026-11-11', 판시각: '2026-11-14T21:00:00+09:00',
    게시결과: [{ 계정: 'synkbrief-instagram', 상태: '취소됨' }, { 계정: 'synkbrief-instagram', 상태: '게시됨' }, { 계정: 'synkbrief-youtube', 상태: '예약됨' }] });
  piece(root, 'synkbrief_반만_20261110', { 슬롯: '2026-11-11', 판시각: '2026-11-14T21:00:00+09:00',
    게시결과: [{ 계정: 'synkbrief-instagram', 상태: '게시됨' }, { 계정: 'synkbrief-youtube', 상태: '취소됨' }] });
  assert.deepEqual(차례(root), { 'synkbrief_다걸림_20261110': '이미 걸림', 'synkbrief_반만_20261110': '다시 볼 차례' });
});

test('고칠편은 브랜드 · 슬롯 3일 안 — 지난 슬롯은 「지남」으로 내고, 더 지난 편과 영상을 고친 편은 뺀다', (t) => {
  const root = repo(t);
  for (const [name, 슬롯, 브랜드] of [['synkbrief_내일_20261114', '2026-11-16', 'synkbrief'], ['synkbrief_어제_20261112', '2026-11-14', 'synkbrief'],
    ['synkbrief_오래됨_20261105', '2026-11-08', 'synkbrief'], ['yuhobuilds_남의것_20261114', '2026-11-16', 'yuhobuilds']]) {
    const dir = piece(root, name, { 슬롯, 브랜드 });
    확인.write(묶음.load(dir), '미흡', '사람이 굳음', { 갈래: '사람굳음' });
  }
  const 고친 = piece(root, 'synkbrief_고침_20261114', { 슬롯: '2026-11-17' });
  확인.write(묶음.load(고친), '미흡', '끝 약함', { 갈래: '끝약함' });
  fs.writeFileSync(path.join(고친, '게시', 'final.mp4'), '고친 판');
  const mine = 확인.needsFix(root마케팅(root), 'synkbrief', '2026-11-15');
  assert.deepEqual(mine.map((x) => [x.편, x.지남]), [['synkbrief_어제_20261112', true], ['synkbrief_내일_20261114', false]]);
  assert.deepEqual(확인.needsFix(root마케팅(root), '', '2026-11-15').map((x) => x.편), ['synkbrief_어제_20261112', 'synkbrief_내일_20261114', 'yuhobuilds_남의것_20261114']);
});

test('맡기: 다른 회차가 2시간 안에 맡은 편은 거절, 같은 회차는 시각을 잇고, 2시간이 지나면 낡는다', (t) => {
  const root = repo(t);
  const bundle = 묶음.load(piece(root, 'synkbrief_맡기_20261115'));
  const now = Date.parse('2026-11-15T03:00:00Z');
  assert.throws(() => 확인.take(bundle, ''), /--누가/);
  assert.equal(확인.take(bundle, '회차 A', now).ok, true);
  assert.equal(확인.take(bundle, '회차 A', now + 90 * 60e3).ok, true, '같은 회차는 시각을 새로 찍는다');
  const no = 확인.take(bundle, '회차 B', now + 3 * 3600e3);
  assert.equal(no.ok, false, '다시 찍은 시각에서 2시간이 안 됐다');
  assert.match(no.까닭, /회차 A/);
  assert.equal(확인.take(bundle, '회차 B', now + 4 * 3600e3).ok, true, '2시간 넘게 시각을 잇지 않으면 낡는다');
});

test('판정을 써도 맡음은 남고, 올린 뒤 놓기가 「판정 끝」을 남겨 따라오지 못한 작업본의 회차도 같은 영상을 다시 맡지 않는다(Fable 검수 P1)', (t) => {
  const root = repo(t);
  const dir = piece(root, 'synkbrief_겹침_20261115');
  const 다른작업본 = repo(t);
  const 옛사본 = piece(다른작업본, 'synkbrief_겹침_20261115');
  fs.copyFileSync(path.join(dir, '게시', 'final.mp4'), path.join(옛사본, '게시', 'final.mp4'));
  const a = 묶음.load(dir);
  assert.equal(확인.take(a, '회차 A').ok, true);
  확인.write(a, '작은 흠', '넥타이 매듭이 컷마다 조금 다름', { 갈래: '소품튐', 독립검수: '시험 — 그대로 내도 된다' });
  assert.equal(확인.lockOf(a)?.누가, '회차 A', '판정을 써도 올리기 전에는 맡음이 남는다');
  const 이음 = 확인.take(a, '회차 A');
  assert.equal(이음.ok, true, '판정 뒤(차례 「열림」)에도 같은 회차는 시각을 잇는다(Fable 재검수 P1)');
  assert.equal(이음.이음, true);
  const b = 묶음.load(옛사본);
  assert.equal(확인.take(b, '회차 B').ok, false);
  const mark = 확인.finish(a, '회차 A', { onOrigin: () => true });
  assert.equal(mark.끝남, '작은 흠');
  assert.equal(확인.lockOf(a), null, '판정 끝 표시는 진행 중 맡음이 아니다');
  const again = 확인.take(b, '회차 B', Date.now() + 10 * 3600e3);
  assert.equal(again.ok, false, '기록이 없는 옛 작업본에서도 같은 영상은 나이와 상관없이 다시 맡지 않는다');
  assert.match(again.까닭, /작은 흠/);
  assert.equal(확인.scan(root마케팅(다른작업본))[0].차례, '판정 끝');
  assert.equal(확인.take(a, '회차 C').ok, false, '판정이 있는 작업본에서는 차례가 「열림」이라 맡지 않는다');
  fs.writeFileSync(path.join(옛사본, '게시', 'final.mp4'), '새로 고친 판');
  assert.equal(확인.take(묶음.load(옛사본), '회차 B').ok, true, '영상이 바뀌면 다시 맡는다');
});

test('놓기: 판정을 origin에 못 올렸으면 「판정 끝」을 남기지 않고 맡음만 지운다 — 다음 회차가 다시 본다(Fable 재검수 P1)', (t) => {
  const root = repo(t);
  const a = 묶음.load(piece(root, 'synkbrief_못올림_20261115'));
  assert.equal(확인.take(a, '회차 A').ok, true);
  확인.write(a, '통과', '컷 전수', { 독립검수: '시험 — 그대로 내도 된다' });
  // 시험 저장소는 git이 아니라 origin/master에 기록이 없다 — 기본 originHas가 false를 낸다
  const m = 확인.finish(a, '회차 A');
  assert.equal(m.끝남, null);
  assert.match(m.까닭, /origin/);
  assert.equal(확인.readLock(a), null);
  const 다른작업본 = repo(t);
  const 옛사본 = piece(다른작업본, 'synkbrief_못올림_20261115');
  fs.copyFileSync(path.join(a.dir, '게시', 'final.mp4'), path.join(옛사본, '게시', 'final.mp4'));
  assert.equal(확인.take(묶음.load(옛사본), '회차 B').ok, true, '기록이 없는 작업본의 다음 회차가 다시 맡는다');
});

test('놓기: 판정 없이 손을 떼면 맡음을 지운다', (t) => {
  const root = repo(t);
  const bundle = 묶음.load(piece(root, 'synkbrief_놓기_20261115'));
  assert.equal(확인.take(bundle, '회차 A').ok, true);
  assert.equal(확인.finish(bundle, '회차 A').끝남, null);
  assert.equal(확인.readLock(bundle), null);
  assert.equal(확인.take(bundle, '회차 B').ok, true);
});

test('명령: 대기는 오늘과 뒤 슬롯 먼저 · 못 읽은 편은 따로, 고칠편 · 맡기 · 놓기', (t) => {
  const root = repo(t);
  const 새 = piece(root, 'synkbrief_새편_20261116', { 슬롯: '2026-11-19' });
  piece(root, 'yuhobuilds_먼저_20261115', { 브랜드: 'yuhobuilds', 슬롯: '2026-11-18' });
  piece(root, 'synkbrief_지난칸_20261112', { 슬롯: '2026-11-14' });
  const 깨짐 = path.join(root마케팅(root), 'synkbrief_깨짐_20261114', '게시');
  fs.mkdirSync(깨짐, { recursive: true });
  fs.writeFileSync(path.join(깨짐, '준비.json'), '{ 깨진 글');
  const 미흡 = piece(root, 'synkbrief_미흡_20261114', { 슬롯: '2099-01-01' });
  확인.write(묶음.load(미흡), '미흡', '숫자가 안 맞음', { 갈래: '숫자불일치' });
  const run = (...args) => spawnSync(process.execPath, [CLI, ...args, '--폴더', root마케팅(root), '--오늘', '2026-11-15'], { encoding: 'utf8', env: { ...process.env, SYNK_FINAL_LOCK_DIR: lockDir } });
  assert.equal(run(새, '맡기', '--누가', '회차 A').status, 0);
  assert.equal(run(새, '맡기', '--누가', '회차 B').status, 1);
  assert.equal(run(path.join(root마케팅(root), 'synkbrief_깨짐_20261114'), '맡기', '--누가', '회차 A').status, 2, '읽지 못한 편은 끝 코드 2');
  const wait = run('대기');
  assert.equal(wait.status, 0, wait.stderr);
  const [head, broken] = wait.stdout.split('못 읽은 편');
  const lines = head.split('\n').filter((l) => / \| /.test(l));
  assert.deepEqual(lines.map((l) => l.split(' | ')[1]), ['yuhobuilds_먼저_20261115', 'synkbrief_새편_20261116', 'synkbrief_지난칸_20261112']);
  assert.match(lines[1], /맡음: 회차 A/);
  assert.match(broken, /synkbrief_깨짐_20261114/);
  const json = JSON.parse(run('대기', '--json').stdout);
  assert.equal(json.다시볼편.length, 3);
  assert.equal(json.못읽은편.length, 1);
  const fix = run('고칠편', 'synkbrief');
  assert.match(fix.stdout, /synkbrief_미흡_20261114/);
  assert.match(fix.stdout, /숫자가 안 맞음/);
  assert.equal(run(새, '놓기').status, 0);
  assert.doesNotMatch(run('대기').stdout, /맡음/);
  const empty = repo(t);
  assert.equal(spawnSync(process.execPath, [CLI, '대기', '--폴더', root마케팅(empty)], { encoding: 'utf8' }).stdout.trim(), '다시 볼 편 없음');
});

test.after(() => fs.rmSync(lockDir, { recursive: true, force: true }));
