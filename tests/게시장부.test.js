'use strict';
// 게시 장부 잠금(tools/게시장부.js — 2026-11-10 LAB 하루 두 편 설계 4). 임시 폴더의 가짜 편 · 원장만 쓴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const 장부 = require('../tools/게시장부.js');

function 마당() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), '게시장부-'));
  const accounts = { 'lab-th-youtube': { brand: 'LAB', platform: 'youtube', timeZone: 'Asia/Bangkok', dailyTimes: ['13:00', '21:00'], dailyFormats: ['이야기', '퀴즈'] } };
  fs.writeFileSync(path.join(root, 'sns-계정.json'), JSON.stringify({ accounts }));
  const 편 = (name, time, body = 'video') => {
    const dir = path.join(root, name);
    fs.mkdirSync(path.join(dir, '게시', '판본', 'TH'), { recursive: true });
    const file = path.join(dir, '게시', '판본', 'TH', 'video.mp4');
    fs.writeFileSync(file, body);
    const sha = crypto.createHash('sha256').update(body).digest('hex');
    fs.writeFileSync(path.join(dir, '게시', '준비.json'), JSON.stringify({ 브랜드: 'LAB', 판: [{ 계정: 'lab-th-youtube', 파일: '게시/판본/TH/video.mp4', 시각: time, 돌림: true, 지문: sha }] }));
    return dir;
  };
  return { root, accounts, 편, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}
const 결과 = (dir) => JSON.parse(fs.readFileSync(path.join(dir, '게시', '게시결과.json'), 'utf8'));

test('걸기 → 끝: 거는 중을 적고 지문을 남기고, 예약됨으로 닫는다 · 이미 건 판은 다시 못 건다', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const dir = m.편('LAB_가', '2026-11-20T13:00:00+07:00');
  const now = Date.parse('2026-11-15T14:00:00+09:00');
  const c = 장부.claim({ dir, account: 'lab-th-youtube', method: 'ego', root: m.root, accounts: m.accounts, now });
  assert.equal(c.ok, true, c.why);
  assert.equal(결과(dir).판[0].상태, '거는 중');
  assert.match(결과(dir).판[0].지문, /^[0-9a-f]{64}$/);
  // 다른 회차가 곧바로 다시 걸면 막힌다
  const again = 장부.claim({ dir, account: 'lab-th-youtube', root: m.root, accounts: m.accounts, now: now + 60000 });
  assert.equal(again.ok, false);
  assert.match(again.why, /거는 중/);
  assert.equal(장부.pendingClaims(m.root).length, 1);
  assert.equal(장부.finish({ dir, account: 'lab-th-youtube', state: '예약됨', id: 'yt123', url: 'https://youtu.be/yt123', seen: '스튜디오 예약 목록 11-20 13:00' }).ok, true);
  const done = 결과(dir).판[0];
  assert.equal(done.상태, '예약됨');
  assert.equal(done.게시물ID, 'yt123');
  assert.equal(done.거는중, undefined);
  assert.equal(장부.claim({ dir, account: 'lab-th-youtube', root: m.root, accounts: m.accounts, now }).ok, false, '이미 예약됨');
  assert.equal(장부.pendingClaims(m.root).length, 0);
});

test('같은 계정 · 같은 현지 날짜 · 같은 칸에 다른 편이 걸려 있으면 막고, 지문이 다르면 막는다 · 풀기', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const a = m.편('LAB_가', '2026-11-20T13:00:00+07:00');
  const b = m.편('LAB_나', '2026-11-20T13:00:00+07:00', 'other');
  const now = Date.parse('2026-11-15T14:00:00+09:00');
  assert.equal(장부.claim({ dir: a, account: 'lab-th-youtube', root: m.root, accounts: m.accounts, now }).ok, true);
  const clash = 장부.claim({ dir: b, account: 'lab-th-youtube', root: m.root, accounts: m.accounts, now });
  assert.equal(clash.ok, false);
  assert.match(clash.why, /같은 칸에 이미 LAB_가/);
  // 풀면 다른 편이 그 칸을 걸 수 있다
  assert.equal(장부.release({ dir: a, account: 'lab-th-youtube', why: '스튜디오 예약 목록에 없음' }).ok, true);
  assert.equal(장부.claim({ dir: b, account: 'lab-th-youtube', root: m.root, accounts: m.accounts, now }).ok, true);
  // 판 파일이 돌림표가 적은 지문과 다르면(검수 뒤 다시 렌더) 못 건다
  const c = m.편('LAB_다', '2026-11-21T13:00:00+07:00');
  fs.writeFileSync(path.join(c, '게시', '판본', 'TH', 'video.mp4'), 'rerendered');
  const changed = 장부.claim({ dir: c, account: 'lab-th-youtube', root: m.root, accounts: m.accounts, now });
  assert.equal(changed.ok, false);
  assert.match(changed.why, /지문과 다르다/);
});

// ── 11-10 Fable 검수 뒤 굳힌 것 ─────────────────────────────────────────────────────────────────────────
const A = 'lab-th-youtube';
const NOW = Date.parse('2026-11-15T14:00:00+09:00');
const 적기 = (dir, 줄) => fs.writeFileSync(path.join(dir, '게시', '게시결과.json'), JSON.stringify({ 판: [줄] }, null, 2) + '\n');

test('끊긴 회차의 「거는 중」은 몇 시간이 지나도 덮지 않는다 — 예약 목록을 읽고 끝이나 풀기로 닫는다', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const dir = m.편('LAB_가', '2026-11-20T13:00:00+07:00');
  assert.equal(장부.claim({ dir, account: A, method: 'ego', root: m.root, accounts: m.accounts, now: NOW }).ok, true);
  const first = 결과(dir).판[0].거는중;
  for (const 분 of [121, 60 * 24 * 3]) {
    const again = 장부.claim({ dir, account: A, method: 'ego', root: m.root, accounts: m.accounts, now: NOW + 분 * 60000 });
    assert.equal(again.ok, false, `${분}분 뒤에도 못 건다`);
    assert.match(again.why, /끊긴 회차의 「거는 중」/);
    assert.match(again.why, /예약 목록/);
  }
  assert.equal(결과(dir).판[0].거는중, first, '앞 회차가 적은 시각이 그대로다');
  // 예약 목록에서 걸린 것을 읽었으면 다시 올리지 않고 닫는다
  assert.equal(장부.finish({ dir, account: A, state: '예약됨', seen: '스튜디오 예약 목록 11-20 13:00' }).ok, true);
  assert.equal(결과(dir).판[0].상태, '예약됨');
  // 없었으면 풀고 다시 건다
  const b = m.편('LAB_나', '2026-11-21T13:00:00+07:00', 'b');
  assert.equal(장부.claim({ dir: b, account: A, root: m.root, accounts: m.accounts, now: NOW }).ok, true);
  assert.equal(장부.claim({ dir: b, account: A, root: m.root, accounts: m.accounts, now: NOW + 5 * 3600000 }).ok, false);
  assert.equal(장부.release({ dir: b, account: A, why: '예약 목록에 없음' }).ok, true);
  assert.equal(장부.claim({ dir: b, account: A, root: m.root, accounts: m.accounts, now: NOW + 5 * 3600000 }).ok, true);
});

test('끝: 앞선 걸기와 이번에 읽은 증거가 있어야 하고, 게시됨은 되돌리지 않고, 예약됨 → 실패는 확인이 있어야 한다', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const dir = m.편('LAB_가', '2026-11-20T13:00:00+07:00');
  const 끝 = (o) => 장부.finish({ dir, account: A, ...o });
  // 걸지 않은 판
  assert.match(끝({ state: '예약됨', id: 'x' }).why, /앞선 「걸기」가 없다/);
  assert.match(끝({ state: '실패' }).why, /걸지 않은 판은 실패로 적지 않는다/);
  assert.equal(fs.existsSync(path.join(dir, '게시', '게시결과.json')), false, '아무 줄도 안 생긴다');
  assert.equal(장부.claim({ dir, account: A, root: m.root, accounts: m.accounts, now: NOW }).ok, true);
  // 증거 없이는 못 닫는다
  assert.match(끝({ state: '예약됨' }).why, /게시물ID · --주소 · --확인/);
  assert.equal(결과(dir).판[0].상태, '거는 중');
  assert.equal(끝({ state: '예약됨', id: 'yt1' }).ok, true);
  // 예약됨 → 실패는 확인이 있어야
  assert.match(끝({ state: '실패' }).why, /--확인/);
  assert.equal(결과(dir).판[0].상태, '예약됨');
  // 예약됨 → 게시됨, 그 뒤로는 다른 상태로 못 바꾼다
  assert.equal(끝({ state: '게시됨', url: 'https://youtu.be/yt1' }).ok, true);
  assert.equal(결과(dir).판[0].게시물ID, 'yt1', '앞서 적은 것은 남는다');
  for (const state of ['예약됨', '실패']) assert.match(끝({ state, seen: '무엇이든' }).why, /이미 게시됨/);
  assert.equal(결과(dir).판[0].상태, '게시됨');
  assert.equal(끝({ state: '게시됨' }).ok, false, '더할 증거가 없으면 그대로');
  assert.equal(끝({ state: '게시됨', seen: '공개 화면에서 읽음' }).ok, true);
  // 예약됨 → 실패(확인 있음) 뒤에는 그 칸이 풀려 다시 걸 수 있다
  const b = m.편('LAB_나', '2026-11-21T13:00:00+07:00', 'b');
  assert.equal(장부.claim({ dir: b, account: A, root: m.root, accounts: m.accounts, now: NOW }).ok, true);
  assert.equal(장부.finish({ dir: b, account: A, state: '예약됨', id: 'yt2' }).ok, true);
  assert.equal(장부.finish({ dir: b, account: A, state: '실패', seen: '예약 목록에 없음 · 올리기 오류 화면' }).ok, true);
  const c = m.편('LAB_다', '2026-11-21T13:00:00+07:00', 'c');
  assert.equal(장부.claim({ dir: c, account: A, root: m.root, accounts: m.accounts, now: NOW }).ok, true, '실패한 판의 칸은 비어 있다');
});

test('작업실 길이 서버에 등록한 줄(승인 대기 · 확인 필요 + 작업 ID)은 그 칸과 그 판을 잡고 있다', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const a = m.편('LAB_가', '2026-11-20T21:00:00+07:00');
  const b = m.편('LAB_나', '2026-11-20T21:00:00+07:00', 'b');
  for (const 상태 of ['승인 대기', '확인 필요']) {
    적기(a, { 계정: A, 상태, 시각: '2026-11-20T21:00:00+07:00', 방법: '작업실', 작업: 'job-1' });
    const other = 장부.claim({ dir: b, account: A, root: m.root, accounts: m.accounts, now: NOW });
    assert.equal(other.ok, false, 상태);
    assert.match(other.why, /같은 칸에 이미 LAB_가/);
    const same = 장부.claim({ dir: a, account: A, root: m.root, accounts: m.accounts, now: NOW });
    assert.equal(same.ok, false);
    assert.match(same.why, /작업실에 이미 등록된 판/);
    assert.match(장부.finish({ dir: a, account: A, state: '예약됨', id: 'x' }).why, /작업실예약\.js 상태/);
    assert.equal(결과(a).판[0].상태, 상태, '작업실 줄은 건드리지 않는다');
  }
  // 작업 ID가 없는 줄(등록 전 실패) · 놓침 · 취소됨은 칸을 잡지 않는다
  for (const 줄 of [{ 계정: A, 상태: '승인 대기' }, { 계정: A, 상태: '놓침', 작업: 'job-1' }, { 계정: A, 상태: '취소됨', 작업: 'job-1' }]) {
    적기(a, 줄);
    assert.equal(장부.claim({ dir: b, account: A, root: m.root, accounts: m.accounts, now: NOW }).ok, true, JSON.stringify(줄));
    assert.equal(장부.release({ dir: b, account: A, why: '시험' }).ok, true);
  }
});

test('원장에 없는 계정은 칸을 셀 수 없어 걸지 않는다', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const dir = m.편('LAB_가', '2026-11-20T13:00:00+07:00');
  const r = 장부.claim({ dir, account: A, root: m.root, accounts: {}, now: NOW });
  assert.equal(r.ok, false);
  assert.match(r.why, /원장/);
});

// 작업본 둘(14시 회차의 워크트리와 다른 사본)이 같은 칸 장부를 본다
function 두마당() {
  const one = 마당();
  const two = 마당();
  const registry = path.join(path.dirname(one.root), `칸-${path.basename(one.root)}.json`);
  const 둘다 = (name, time, body) => [one.편(name, time, body), two.편(name, time, body)];
  return { one, two, registry, 둘다, cleanup: () => { one.cleanup(); two.cleanup(); for (const f of [registry, `${registry}.lock`]) fs.rmSync(f, { force: true }); } };
}

test('다른 작업본이 건 판 · 같은 칸의 다른 편은 올라오기 전에도 막힌다 · 그 작업본에서 풀리면 열린다', (t) => {
  const w = 두마당();
  t.after(w.cleanup);
  const { registry } = w;
  const [a1, a2] = w.둘다('LAB_가', '2026-11-20T13:00:00+07:00');
  const [, b2] = w.둘다('LAB_나', '2026-11-20T13:00:00+07:00', 'b');
  const [, c2] = w.둘다('LAB_다', '2026-11-21T13:00:00+07:00', 'c');
  assert.equal(장부.claim({ dir: a1, account: A, root: w.one.root, accounts: w.one.accounts, now: NOW, registry }).ok, true);
  // 두 번째 사본에는 게시결과가 없지만 같은 판 · 같은 칸의 다른 편 모두 막힌다
  const same = 장부.claim({ dir: a2, account: A, root: w.two.root, accounts: w.two.accounts, now: NOW, registry });
  assert.equal(same.ok, false);
  assert.match(same.why, /이 판이\(가\) 다른 작업본에서 거는 중/);
  const other = 장부.claim({ dir: b2, account: A, root: w.two.root, accounts: w.two.accounts, now: NOW, registry });
  assert.equal(other.ok, false);
  assert.match(other.why, /같은 칸의 LAB_가/);
  assert.equal(fs.existsSync(path.join(a2, '게시', '게시결과.json')), false);
  // 다른 칸은 걸린다
  assert.equal(장부.claim({ dir: c2, account: A, root: w.two.root, accounts: w.two.accounts, now: NOW, registry }).ok, true);
  // 걸던것은 다른 작업본의 것도 보인다
  const seen = 장부.pendingClaims(w.two.root, { registry });
  assert.deepEqual(seen.map((c) => c.piece).sort(), ['LAB_가', 'LAB_다']);
  assert.equal(seen.find((c) => c.piece === 'LAB_가').where, path.resolve(w.one.root));
  // 두 번째 사본에서 남의 걸린 줄은 못 푼다
  const no = 장부.release({ dir: a2, account: A, why: '시험', root: w.two.root, registry });
  assert.equal(no.ok, false);
  assert.match(no.why, /다른 작업본에서 거는 중/);
  // 첫 사본에서 예약됨으로 끝나면 계속 막히고, 상태가 따라온다
  assert.equal(장부.finish({ dir: a1, account: A, state: '예약됨', id: 'yt1', root: w.one.root, accounts: w.one.accounts, registry }).ok, true);
  assert.match(장부.claim({ dir: b2, account: A, root: w.two.root, accounts: w.two.accounts, now: NOW, registry }).why, /예약됨/);
  // 첫 사본에서 실패(확인)로 내리면 열린다
  assert.equal(장부.finish({ dir: a1, account: A, state: '실패', seen: '예약 목록에 없음', root: w.one.root, accounts: w.one.accounts, registry }).ok, true);
  assert.equal(장부.claim({ dir: b2, account: A, root: w.two.root, accounts: w.two.accounts, now: NOW, registry }).ok, true);
});

test('건 작업본이 사라졌으면 장부를 믿고 막는다 — 예약 목록을 읽고 풀기로 그 줄을 거둔 뒤에야 걸린다', (t) => {
  const w = 두마당();
  t.after(w.cleanup);
  const { registry } = w;
  const [a1, a2] = w.둘다('LAB_가', '2026-11-20T13:00:00+07:00');
  assert.equal(장부.claim({ dir: a1, account: A, root: w.one.root, accounts: w.one.accounts, now: NOW, registry }).ok, true);
  fs.rmSync(w.one.root, { recursive: true, force: true }); // 끊긴 회차의 워크트리가 치워졌다
  const blocked = 장부.claim({ dir: a2, account: A, root: w.two.root, accounts: w.two.accounts, now: NOW + 86400000, registry });
  assert.equal(blocked.ok, false);
  assert.match(blocked.why, /읽을 수 없다/);
  assert.match(blocked.why, /풀기 LAB_가 lab-th-youtube/);
  const freed = 장부.release({ dir: a2, account: A, why: '스튜디오 예약 목록에 없음', root: w.two.root, registry });
  assert.equal(freed.ok, true);
  assert.match(freed.note, /다른 작업본이 남긴 장부 줄/);
  const 표 = JSON.parse(fs.readFileSync(registry, 'utf8'));
  assert.deepEqual(Object.keys(표.칸), []);
  assert.equal(표.풀림.at(-1).까닭, '스튜디오 예약 목록에 없음');
  assert.equal(장부.claim({ dir: a2, account: A, root: w.two.root, accounts: w.two.accounts, now: NOW + 86400000, registry }).ok, true);
  // 풀 것이 없으면 풀기는 그대로 거절
  const [, b2] = w.둘다('LAB_나', '2026-11-22T13:00:00+07:00', 'b');
  assert.match(장부.release({ dir: b2, account: A, why: '시험', root: w.two.root, registry }).why, /「거는 중」이 아니다/);
});

test('걸기가 거절되면 칸 장부에 줄이 남지 않는다(지문 · 앞선 줄)', (t) => {
  const w = 두마당();
  t.after(w.cleanup);
  const { registry } = w;
  const 줄수 = () => (fs.existsSync(registry) ? Object.keys(JSON.parse(fs.readFileSync(registry, 'utf8')).칸).length : 0);
  const [a1] = w.둘다('LAB_가', '2026-11-20T13:00:00+07:00');
  fs.writeFileSync(path.join(a1, '게시', '판본', 'TH', 'video.mp4'), '다시 구움');
  assert.equal(장부.claim({ dir: a1, account: A, root: w.one.root, accounts: w.one.accounts, now: NOW, registry }).ok, false);
  assert.equal(줄수(), 0);
  const [b1] = w.둘다('LAB_나', '2026-11-21T13:00:00+07:00', 'b');
  적기(b1, { 계정: A, 상태: '승인 대기', 작업: 'job-9', 시각: '2026-11-21T13:00:00+07:00' });
  assert.equal(장부.claim({ dir: b1, account: A, root: w.one.root, accounts: w.one.accounts, now: NOW, registry }).ok, false);
  assert.equal(줄수(), 0);
});

const 명령 = (root, ...args) => new Promise((resolve) => {
  const p = spawn(process.execPath, [path.join(__dirname, '..', 'tools', '게시장부.js'), ...args, '--폴더', root]);
  let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.stderr.on('data', (d) => { out += d; });
  p.on('close', (code) => resolve({ code, out }));
});

test('한꺼번에 여럿이 걸어도 하나만 걸린다 — 같은 판 여덟, 같은 칸의 다른 편 둘', async (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const a = m.편('LAB_가', '2026-11-20T13:00:00+07:00');
  const rs = await Promise.all(Array.from({ length: 8 }, () => 명령(m.root, '걸기', a, A, '--방법', 'ego')));
  assert.equal(rs.filter((r) => r.code === 0).length, 1, rs.map((r) => `${r.code}: ${r.out.trim()}`).join(' | '));
  assert.equal(결과(a).판.length, 1);
  for (let i = 0; i < 4; i += 1) {
    const b = m.편(`LAB_나${i}`, `2026-11-2${i + 1}T21:00:00+07:00`, `b${i}`);
    const c = m.편(`LAB_다${i}`, `2026-11-2${i + 1}T21:00:00+07:00`, `c${i}`);
    const pair = await Promise.all([명령(m.root, '걸기', b, A), 명령(m.root, '걸기', c, A)]);
    assert.equal(pair.filter((r) => r.code === 0).length, 1, pair.map((r) => `${r.code}: ${r.out.trim()}`).join(' | '));
  }
});

// ── 11-10 Fable 5.2 계획 검수 뒤 더한 것 — 첫 판 시험 · 한 계정의 여러 줄 · 표에 걸린 판 읽기 ──
test('첫 판 시험(postRouteVerified 「첫판」): 판 하나만 걸리고, 확인해 true로 바꾸면 다음 판이 걸린다 — 다른 작업본이 잡은 첫 판도 센다', (t) => {
  const w = 두마당();
  t.after(w.cleanup);
  const { registry } = w;
  const trial = (m) => ({ [A]: { ...m.accounts[A], postRouteVerified: '첫판' } });
  const [a1] = w.둘다('LAB_가', '2026-11-20T13:00:00+07:00');
  const [b1, b2] = w.둘다('LAB_나', '2026-11-21T13:00:00+07:00', 'b');
  assert.equal(장부.claim({ dir: a1, account: A, root: w.one.root, accounts: trial(w.one), now: NOW, registry }).ok, true, '첫 판은 걸린다');
  const second = 장부.claim({ dir: b1, account: A, root: w.one.root, accounts: trial(w.one), now: NOW, registry });
  assert.equal(second.ok, false);
  assert.match(second.why, /첫 판 확인 전 계정/);
  assert.match(second.why, /LAB_가\(거는 중\)/);
  assert.equal(fs.existsSync(path.join(b1, '게시', '게시결과.json')), false, '거절된 판은 줄이 안 생긴다');
  assert.deepEqual(Object.values(JSON.parse(fs.readFileSync(registry, 'utf8')).칸).map((e) => e.편), ['LAB_가'], '표에도 첫 판만 남는다');
  // 다른 작업본에서 다른 날 판을 걸어도 막힌다(표의 줄로 안다)
  const other = 장부.claim({ dir: b2, account: A, root: w.two.root, accounts: trial(w.two), now: NOW, registry });
  assert.equal(other.ok, false);
  assert.match(other.why, /첫 판 확인 전 계정/);
  // 첫 판이 예약됨이어도 원장을 true로 바꾸기 전에는 그대로 막힌다
  assert.equal(장부.finish({ dir: a1, account: A, state: '예약됨', id: 'yt1', root: w.one.root, accounts: trial(w.one), registry }).ok, true);
  assert.match(장부.claim({ dir: b1, account: A, root: w.one.root, accounts: trial(w.one), now: NOW, registry }).why, /LAB_가\(예약됨\)/);
  // 예약 목록에서 확인하고 true로 바꾸면 걸린다
  const open = { [A]: { ...w.one.accounts[A], postRouteVerified: true } };
  assert.equal(장부.claim({ dir: b1, account: A, root: w.one.root, accounts: open, now: NOW, registry }).ok, true);
});

test('첫 판 시험: 첫 판이 실패로 닫히면 다른 판으로 다시 시험할 수 있다 · 씨앗 계정은 「첫판」 값이 있어도 막지 않는다', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const trial = { [A]: { ...m.accounts[A], postRouteVerified: '첫판' } };
  const a = m.편('LAB_가', '2026-11-20T13:00:00+07:00');
  const b = m.편('LAB_나', '2026-11-21T13:00:00+07:00', 'b');
  assert.equal(장부.claim({ dir: a, account: A, root: m.root, accounts: trial, now: NOW }).ok, true);
  assert.equal(장부.finish({ dir: a, account: A, state: '실패', seen: '올리기 오류 화면 · 예약 목록에 없음', root: m.root, accounts: trial }).ok, true);
  assert.equal(장부.claim({ dir: b, account: A, root: m.root, accounts: trial, now: NOW }).ok, true, '실패한 첫 판은 세지 않는다');
  const c = m.편('LAB_다', '2026-11-22T13:00:00+07:00', 'c');
  assert.equal(장부.claim({ dir: c, account: A, root: m.root, accounts: trial, now: NOW }).ok, false);
  const seed = { [A]: { ...m.accounts[A], postRouteVerified: '첫판', rotationSeed: true } };
  assert.equal(장부.claim({ dir: c, account: A, root: m.root, accounts: seed, now: NOW }).ok, true);
});

test('한 계정에 줄이 여럿이면 잡고 있는 줄을 읽는다 — 취소된 작업 줄은 덮지 않고 새 줄을 더한다', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const 취소 = { 계정: A, 상태: '취소됨', 방법: '작업실', 작업: 'job-1' };
  const 살아 = { 계정: A, 상태: '예약됨', 방법: '작업실', 작업: 'job-3' };
  // rowOf: 잡고 있는 마지막 줄 → 없으면 마지막 줄
  assert.equal(장부.rowOf([], A), null);
  assert.equal(장부.rowOf([{ 계정: '다른-계정', 상태: '예약됨' }], A), null);
  assert.equal(장부.rowOf([취소, { ...취소, 작업: 'job-2' }, 살아], A).작업, 'job-3');
  assert.equal(장부.rowOf([살아, { ...취소, 작업: 'job-4' }], A).작업, 'job-3', '뒤에 다른 작업의 취소 줄이 있어도 살아 있는 줄을 읽는다');
  assert.equal(장부.rowOf([취소, { 계정: A, 상태: '실패' }], A).상태, '실패');
  // 취소됨 줄만 있는 편: 걸기는 그 줄을 그대로 두고 새 줄을 더한다(작업 ID를 물려받지 않는다)
  const a = m.편('LAB_가', '2026-11-20T13:00:00+07:00');
  적기(a, 취소);
  assert.equal(장부.claim({ dir: a, account: A, method: 'ego', root: m.root, accounts: m.accounts, now: NOW }).ok, true);
  let 판 = 결과(a).판;
  assert.equal(판.length, 2);
  assert.deepEqual(판[0], 취소);
  assert.equal(판[1].상태, '거는 중');
  assert.equal(판[1].작업, undefined);
  assert.equal(장부.finish({ dir: a, account: A, state: '예약됨', id: 'yt1', root: m.root, accounts: m.accounts }).ok, true);
  판 = 결과(a).판;
  assert.deepEqual(판.map((p) => p.상태), ['취소됨', '예약됨']);
  assert.match(장부.claim({ dir: a, account: A, root: m.root, accounts: m.accounts, now: NOW }).why, /이미 예약됨/);
  // 같은 칸의 다른 편도 뒤 줄(예약됨)을 보고 막힌다
  const b = m.편('LAB_나', '2026-11-20T13:00:00+07:00', 'b');
  assert.match(장부.claim({ dir: b, account: A, root: m.root, accounts: m.accounts, now: NOW }).why, /같은 칸에 이미 LAB_가\(예약됨\)/);
  // [예약됨, 취소됨(다른 작업)] 꼴도 예약됨으로 읽는다
  const c = m.편('LAB_다', '2026-11-22T13:00:00+07:00', 'c');
  fs.mkdirSync(path.join(c, '게시'), { recursive: true });
  fs.writeFileSync(path.join(c, '게시', '게시결과.json'), JSON.stringify({ 판: [{ ...살아, 시각: '2026-11-22T13:00:00+07:00' }, { ...취소, 작업: 'job-4' }] }));
  assert.match(장부.claim({ dir: c, account: A, root: m.root, accounts: m.accounts, now: NOW }).why, /이미 예약됨/);
});

test('표에 걸린 판 읽기(registryHolds): 걸린 줄 · 읽을 수 없는 작업본의 줄은 나오고, 풀린 줄은 빠진다', (t) => {
  const w = 두마당();
  t.after(w.cleanup);
  const { registry } = w;
  const [a1] = w.둘다('LAB_가', '2026-11-20T13:00:00+07:00');
  const [b1] = w.둘다('LAB_나', '2026-11-21T21:00:00+07:00', 'b');
  assert.deepEqual(장부.registryHolds(w.two.root, { registry }), []);
  assert.equal(장부.claim({ dir: a1, account: A, root: w.one.root, accounts: w.one.accounts, now: NOW, registry }).ok, true);
  assert.equal(장부.claim({ dir: b1, account: A, root: w.one.root, accounts: w.one.accounts, now: NOW, registry }).ok, true);
  assert.equal(장부.finish({ dir: b1, account: A, state: '예약됨', id: 'yt2', root: w.one.root, accounts: w.one.accounts, registry }).ok, true);
  const seen = 장부.registryHolds(w.two.root, { registry }).sort((x, y) => x.key.localeCompare(y.key));
  assert.deepEqual(seen.map((h) => [h.key, h.account, h.day, h.slot, h.piece, h.state, h.lost]), [
    [`${A}|2026-11-20|13:00`, A, '2026-11-20', '13:00', 'LAB_가', '거는 중', false],
    [`${A}|2026-11-21|21:00`, A, '2026-11-21', '21:00', 'LAB_나', '예약됨', false],
  ]);
  assert.equal(path.resolve(seen[0].where), path.resolve(w.one.root));
  // 표에는 남았는데 그 작업본에서 줄이 사라졌으면(풀림) 빠진다 — 읽기만 하고 표는 고치지 않는다
  fs.rmSync(path.join(a1, '게시', '게시결과.json'));
  assert.deepEqual(장부.registryHolds(w.two.root, { registry }).map((h) => h.piece), ['LAB_나']);
  assert.equal(Object.keys(JSON.parse(fs.readFileSync(registry, 'utf8')).칸).length, 2);
  // 그 작업본이 통째로 없어졌으면 표를 믿고 「읽을 수 없음」으로 내놓는다
  fs.rmSync(w.one.root, { recursive: true, force: true });
  const lost = 장부.registryHolds(w.two.root, { registry }).sort((x, y) => x.key.localeCompare(y.key));
  assert.deepEqual(lost.map((h) => [h.piece, h.state, h.lost]), [['LAB_가', '거는 중', true], ['LAB_나', '예약됨', true]]);
});
