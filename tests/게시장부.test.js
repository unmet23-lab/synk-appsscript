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

test('닫힌 계정 · 닫힌 칸에는 걸지 않는다 — 안 연 계정(dailyFrom 미정 · 그 날짜 전)은 어느 판이든, 돌림 판은 그날 그 칸이 열려 있어야(11-11 P2-8)', (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const now = Date.parse('2026-11-15T14:00:00+09:00');
  const acc = m.accounts['lab-th-youtube'];
  const 걸기 = (dir) => 장부.claim({ dir, account: 'lab-th-youtube', root: m.root, accounts: m.accounts, now });
  const 손판 = (dir) => { const f = path.join(dir, '게시', '준비.json'); const p = JSON.parse(fs.readFileSync(f, 'utf8')); delete p.판[0].돌림; delete p.판[0].지문; fs.writeFileSync(f, JSON.stringify(p)); return dir; };
  // 아직 안 연 계정 — 돌림 판도 손으로 단 판도 못 건다
  acc.dailyFrom = '미정';
  const a = m.편('LAB_가', '2026-11-20T13:00:00+07:00');
  assert.match(걸기(a).why, /아직 안 연 계정이다\(원장 dailyFrom 「미정」\) — 닫힌 계정 · 칸에는 걸지 않는다/);
  assert.match(걸기(손판(m.편('LAB_손', '2026-11-20T13:00:00+07:00'))).why, /아직 안 연 계정/);
  assert.equal(fs.existsSync(path.join(a, '게시', '게시결과.json')), false, '거절된 걸기는 줄을 남기지 않는다');
  // 여는 날 전의 판
  acc.dailyFrom = '2026-11-21';
  assert.match(걸기(a).why, /이 계정은 현지 2026-11-21부터 연다\(이 판은 현지 2026-11-20\)/);
  // 열린 계정의 닫힌 칸(21:00 칸을 dailyFormatsFrom으로 닫아 둠) — 돌림 판은 못 걸고, 13:00 칸은 걸린다
  acc.dailyFrom = '2026-11-20';
  acc.dailyFormatsFrom = { 퀴즈: '미정' };
  const night = m.편('LAB_밤', '2026-11-20T21:00:00+07:00');
  assert.match(걸기(night).why, /현지 2026-11-20에 이 계정의 21:00 퀴즈 칸은 닫혀 있다/);
  assert.equal(걸기(a).ok, true);
  // 손으로 단 판은 닫힌 칸까지는 가리지 않는다(가장 가까운 칸으로 세는 판 — 칸 시각은 올리기 전 검사 ⑩-2가 본다)
  assert.equal(걸기(손판(m.편('LAB_손밤', '2026-11-21T21:00:00+07:00'))).ok, true);
  assert.equal(장부.closedCell({ platform: 'youtube' }, '2026-11-20T13:00:00+07:00', { rotation: true }), null, '칸이 없는 계정은 보지 않는다');
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
  // 걸린 줄 뒤의 보류 · 지움(거둠)은 그 예약을 덮는다 — 11-09 「11월 14일까지 전부 삭제」 때 예약됨 뒤에 보류를 덧붙였다(11-11 Fable 5.2 검수 P1-2)
  assert.equal(장부.rowOf([취소, 살아, { 계정: A, 상태: '보류', 보류: '예약을 거뒀다' }], A).상태, '보류');
  assert.equal(장부.rowOf([살아, { 계정: A, 상태: '지움' }], A).상태, '지움');
  assert.equal(장부.rowOf([살아, { ...취소, 작업: 'job-3' }], A).상태, '취소됨', '바로 앞 걸린 줄과 같은 작업의 취소는 그 예약이 취소된 것');
  assert.equal(장부.rowOf([{ 계정: A, 상태: '보류' }, 살아], A).작업, 'job-3', '보류 뒤에 다시 건 줄은 걸린 줄');
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
test('끝 --승인: 승인 근거를 그 줄에 남긴다(14시 회차가 게시결과를 손으로 고치지 않게)', async (t) => {
  const m = 마당();
  t.after(m.cleanup);
  const a = m.편('LAB_가', '2026-11-20T13:00:00+07:00');
  assert.equal((await 명령(m.root, '걸기', a, A, '--방법', 'ego')).code, 0);
  const done = await 명령(m.root, '끝', a, A, '--상태', '예약됨', '--확인', '스튜디오 예약 목록 11-20 13:00', '--승인', '유호님 11-02 묻지 말고 걸어(상시) · 자체검수 통과');
  assert.equal(done.code, 0, done.out);
  const row = 결과(a).판[0];
  assert.deepEqual([row.상태, row.방법, row.승인], ['예약됨', 'ego', '유호님 11-02 묻지 말고 걸어(상시) · 자체검수 통과']);
});

// ── 회차 사본(워크트리)에는 git 밖 영상이 없다 — 판 파일은 공용 작업본에서 찾고, 칸 장부는 공용 작업본의 .tmp/게시장부에 적는다(11-10 F) ──
function 사본마당() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), '게시장부-사본-'));
  const main = path.join(base, 'main');
  const wt = path.join(base, 'wt');
  // 공용 작업본(.git 폴더) + 워크트리(.git 파일 → gitdir, commondir)
  fs.mkdirSync(path.join(main, '.git', 'worktrees', 'wt'), { recursive: true });
  fs.writeFileSync(path.join(main, '.git', 'worktrees', 'wt', 'commondir'), '../..\n');
  fs.mkdirSync(wt, { recursive: true });
  fs.writeFileSync(path.join(wt, '.git'), `gitdir: ${path.join(main, '.git', 'worktrees', 'wt')}\n`);
  const accounts = { [A]: { brand: 'LAB', platform: 'youtube', timeZone: 'Asia/Bangkok', dailyTimes: ['13:00', '21:00'], dailyFormats: ['이야기', '퀴즈'] } };
  const rel = path.join('docs', '마케팅', 'LAB_가');
  const body = 'th-video';
  const sha = crypto.createHash('sha256').update(body).digest('hex');
  const prep = { 브랜드: 'LAB', 판: [{ 계정: A, 파일: '게시/판본/TH/video.mp4', 시각: '2026-11-20T13:00:00+07:00', 돌림: true, 지문: sha }] };
  for (const root of [main, wt]) {
    fs.mkdirSync(path.join(root, rel, '게시'), { recursive: true });
    fs.writeFileSync(path.join(root, rel, '게시', '준비.json'), JSON.stringify(prep));
  }
  // 영상은 공용 작업본에만 있다(git 밖)
  fs.mkdirSync(path.join(main, rel, '게시', '판본', 'TH'), { recursive: true });
  fs.writeFileSync(path.join(main, rel, '게시', '판본', 'TH', 'video.mp4'), body);
  return { main, wt, rel, accounts, cleanup: () => fs.rmSync(base, { recursive: true, force: true }) };
}

test('회차 사본에서 걸기: 판 영상은 공용 작업본에서 찾아 지문을 대고, 칸 장부는 공용 작업본에 적혀 다른 사본이 본다', (t) => {
  const m = 사본마당();
  t.after(m.cleanup);
  const dir = path.join(m.wt, m.rel);
  const root = path.join(m.wt, 'docs', '마케팅');
  const got = 장부.claim({ dir, account: A, method: 'ego', root, repo: m.wt, accounts: m.accounts, now: NOW });
  assert.equal(got.ok, true, got.why);
  assert.match(got.entry.지문, /^[0-9a-f]{64}$/);
  const registry = path.join(m.main, '.tmp', '게시장부', '칸.json');
  assert.deepEqual(Object.keys(JSON.parse(fs.readFileSync(registry, 'utf8')).칸), [`${A}|2026-11-20|13:00`]);
  // 공용 작업본에서 같은 판을 걸려 하면 표를 보고 막힌다
  const other = 장부.claim({ dir: path.join(m.main, m.rel), account: A, root: path.join(m.main, 'docs', '마케팅'), repo: m.main, accounts: m.accounts, now: NOW });
  assert.equal(other.ok, false);
  assert.match(other.why, /다른 작업본에서 거는 중/);
  // 공용 작업본의 영상이 검수 뒤 바뀌었으면 사본에서도 지문으로 막힌다
  assert.equal(장부.release({ dir, account: A, why: '시험', root }).ok, true);
  fs.writeFileSync(path.join(m.main, m.rel, '게시', '판본', 'TH', 'video.mp4'), '다시 구움');
  assert.match(장부.claim({ dir, account: A, root, repo: m.wt, accounts: m.accounts, now: NOW }).why, /지문과 다르다/);
});

// ── 걸린 줄 뒤에 거둔 줄(보류)이 붙은 판(11-11 Fable 5.2 다시 검수 P2-1 · P3-1 · P3-2) ──
// 11-09 「전부 삭제하고 다시 제작」 때 예약됨 뒤에 보류를 손으로 덧붙였다. rowOf는 그 계정을 「보류」로 읽는데 장부 안쪽 세 곳(같은 칸 · 첫 판 ·
// 표의 참)은 첫 걸린 줄을 읽어, 예약큐는 빈 칸으로 보이고 걸기는 막았다.
function 줄마당() {
  const m = 마당();
  m.accounts['lab-jp-youtube'] = { brand: 'LAB', platform: 'youtube', timeZone: 'Asia/Tokyo', dailyTimes: ['13:00', '21:00'], dailyFormats: ['이야기', '퀴즈'], postRouteVerified: '첫판', publicProfileComplete: true };
  fs.writeFileSync(path.join(m.root, 'sns-계정.json'), JSON.stringify({ accounts: m.accounts }));
  const 판바꿈 = (dir, account, time) => {
    const f = path.join(dir, '게시', '준비.json');
    const prep = JSON.parse(fs.readFileSync(f, 'utf8'));
    prep.판[0] = { ...prep.판[0], 계정: account, 시각: time };
    fs.writeFileSync(f, JSON.stringify(prep));
  };
  const 줄쓰기 = (dir, list) => fs.writeFileSync(path.join(dir, '게시', '게시결과.json'), JSON.stringify({ 판: list }, null, 2) + '\n');
  const 상태들 = (dir) => 결과(dir).판.map((r) => r.상태 || '(상태 없음)');
  return { ...m, 판바꿈, 줄쓰기, 상태들, reg: path.join(m.root, '.게시장부', '칸.json') };
}

test('거둔 예약([예약됨, 보류])은 그 칸 · 첫 판 한도 · 칸 장부를 잡고 있지 않다 — 같은 칸의 다른 편 · 첫 판 시험 계정의 다른 판이 걸린다', (t) => {
  const m = 줄마당();
  t.after(m.cleanup);
  const A = 'lab-th-youtube', J = 'lab-jp-youtube';
  const now = Date.parse('2026-11-15T14:00:00+09:00');
  // 가) 같은 칸
  const x = m.편('LAB_X', '2026-11-20T13:00:00+07:00');
  const y = m.편('LAB_Y', '2026-11-20T13:00:00+07:00', 'other');
  m.줄쓰기(x, [{ 계정: A, 상태: '예약됨', 시각: '2026-11-20T13:00:00+07:00' }]);
  assert.match(장부.claim({ dir: y, account: A, root: m.root, accounts: m.accounts, now, registry: m.reg }).why, /같은 칸에 이미 LAB_X\(예약됨\)/, '대조 — 걸려 있으면 막는다');
  m.줄쓰기(x, [{ 계정: A, 상태: '예약됨', 시각: '2026-11-20T13:00:00+07:00' }, { 계정: A, 상태: '보류', 보류: '예약을 거뒀다' }]);
  assert.equal(장부.rowOf(결과(x).판, A).상태, '보류');
  assert.equal(장부.sameCell(m.root, y, A, '2026-11-20T13:00:00+07:00', m.accounts), null);
  const c = 장부.claim({ dir: y, account: A, root: m.root, accounts: m.accounts, now, registry: m.reg });
  assert.equal(c.ok, true, c.why);
  // 나) 첫 판 한도 — 첫 판이 거둔 예약이면 다른 판으로 다시 시험할 수 있다
  const p = m.편('LAB_P', '2026-11-20T13:00:00+09:00');
  const q = m.편('LAB_Q', '2026-11-21T13:00:00+09:00', 'q');
  m.판바꿈(p, J, '2026-11-20T13:00:00+09:00');
  m.판바꿈(q, J, '2026-11-21T13:00:00+09:00');
  m.줄쓰기(p, [{ 계정: J, 상태: '예약됨', 시각: '2026-11-20T13:00:00+09:00' }]);
  assert.match(장부.claim({ dir: q, account: J, root: m.root, accounts: m.accounts, now, registry: m.reg }).why, /첫 판 확인 전 계정/, '대조 — 첫 판이 걸려 있으면 막는다');
  m.줄쓰기(p, [{ 계정: J, 상태: '예약됨', 시각: '2026-11-20T13:00:00+09:00' }, { 계정: J, 상태: '보류', 보류: '예약을 거뒀다' }]);
  const first = 장부.claim({ dir: q, account: J, root: m.root, accounts: m.accounts, now, registry: m.reg });
  assert.equal(first.ok, true, first.why);
});

test('도구로 건 판에 보류를 덧붙이면 칸 장부의 그 줄은 풀린 줄이다(표에 걸린 판 · 다른 작업본의 막음에서 빠진다)', (t) => {
  const m = 줄마당();
  t.after(m.cleanup);
  const A = 'lab-th-youtube';
  const now = Date.parse('2026-11-15T14:00:00+09:00');
  const x = m.편('LAB_X', '2026-11-20T13:00:00+07:00');
  assert.equal(장부.claim({ dir: x, account: A, root: m.root, accounts: m.accounts, now, registry: m.reg }).ok, true);
  assert.equal(장부.finish({ dir: x, account: A, state: '예약됨', seen: '목록에서 읽음', root: m.root, accounts: m.accounts, now, registry: m.reg }).ok, true);
  assert.deepEqual(장부.registryHolds(m.root, { registry: m.reg }).map((h) => [h.piece, h.state]), [['LAB_X', '예약됨']]);
  m.줄쓰기(x, [...결과(x).판, { 계정: A, 상태: '보류', 보류: '예약을 거뒀다' }]);
  assert.deepEqual(장부.registryHolds(m.root, { registry: m.reg }), []);
});

test('[거는 중, 보류] — 끊긴 걸기는 뒤에 보류가 붙어 있어도 끝 · 풀기로 닫힌다. 예약됨으로 닫으면 그 줄이 그 계정의 줄이 된다', (t) => {
  const A = 'lab-th-youtube';
  const now = Date.parse('2026-11-15T14:00:00+09:00');
  const 준비 = () => {
    const m = 줄마당();
    t.after(m.cleanup);
    const x = m.편('LAB_X', '2026-11-20T13:00:00+07:00');
    assert.equal(장부.claim({ dir: x, account: A, root: m.root, accounts: m.accounts, now, registry: m.reg }).ok, true);
    m.줄쓰기(x, [...결과(x).판, { 계정: A, 상태: '보류', 보류: '거둠' }]);
    assert.deepEqual(m.상태들(x), ['거는 중', '보류']);
    assert.equal(장부.pendingClaims(m.root, { registry: m.reg }).length, 1, '끊긴 걸기는 걸던것에 남는다 — 플랫폼 예약 목록부터 읽는다');
    return { m, x };
  };
  // 다시 걸기는 막힌다 — 끊긴 「거는 중」부터 닫는다(보류 줄을 덮어 두 번째 「거는 중」을 만들지 않는다)
  const a = 준비();
  const again = 장부.claim({ dir: a.x, account: A, root: a.m.root, accounts: a.m.accounts, now: now + 60000, registry: a.m.reg });
  assert.equal(again.ok, false);
  assert.match(again.why, /거는 중/);
  assert.deepEqual(a.m.상태들(a.x), ['거는 중', '보류']);
  // 풀기 — 플랫폼 예약 목록에 없었다
  const rl = 장부.release({ dir: a.x, account: A, why: '목록에 없음', root: a.m.root, now, registry: a.m.reg });
  assert.equal(rl.ok, true, rl.why);
  assert.equal(장부.rowOf(결과(a.x).판, A).상태, '보류');
  assert.equal(장부.pendingClaims(a.m.root, { registry: a.m.reg }).length, 0);
  // 끝 예약됨 — 플랫폼에 걸려 있었다: 그 줄이 맨 뒤로 가서 그 계정의 줄이 된다(보류로 읽히면 칸이 비어 보여 한 번 더 걸린다)
  const b = 준비();
  const fin = 장부.finish({ dir: b.x, account: A, state: '예약됨', seen: '스튜디오 예약 목록에서 읽음', root: b.m.root, accounts: b.m.accounts, now, registry: b.m.reg });
  assert.equal(fin.ok, true, fin.why);
  assert.deepEqual(b.m.상태들(b.x), ['보류', '예약됨']);
  assert.equal(장부.rowOf(결과(b.x).판, A).상태, '예약됨');
  assert.equal(장부.pendingClaims(b.m.root, { registry: b.m.reg }).length, 0);
  assert.deepEqual(장부.registryHolds(b.m.root, { registry: b.m.reg }).map((h) => h.state), ['예약됨']);
  // 끝 실패 — 그 줄만 실패로 닫히고 그 계정의 줄은 보류 그대로
  const c = 준비();
  assert.equal(장부.finish({ dir: c.x, account: A, state: '실패', root: c.m.root, accounts: c.m.accounts, now, registry: c.m.reg }).ok, true);
  assert.deepEqual(c.m.상태들(c.x), ['실패', '보류']);
});

test('[예약됨, 보류]인 판을 다시 걸면 거둔 줄을 덮지 않고 새 줄을 더한다 — 풀어도 거둔 예약이 되살아나지 않는다', (t) => {
  const m = 줄마당();
  t.after(m.cleanup);
  const A = 'lab-th-youtube';
  const now = Date.parse('2026-11-15T14:00:00+09:00');
  const x = m.편('LAB_X', '2026-11-20T13:00:00+07:00');
  m.줄쓰기(x, [{ 계정: A, 상태: '예약됨', 시각: '2026-11-20T13:00:00+07:00', 게시물ID: 'old' }, { 계정: A, 상태: '보류', 보류: '예약을 거뒀다' }]);
  const c = 장부.claim({ dir: x, account: A, root: m.root, accounts: m.accounts, now, registry: m.reg });
  assert.equal(c.ok, true, c.why);
  assert.deepEqual(m.상태들(x), ['예약됨', '보류', '거는 중']);
  assert.equal(c.entry.보류, undefined, '거둔 줄의 글 칸이 새 줄에 딸려 가지 않는다');
  assert.equal(결과(x).판[1].보류, '예약을 거뒀다', '거둔 줄은 기록으로 남는다');
  const rl = 장부.release({ dir: x, account: A, why: '걸다 실패', root: m.root, now, registry: m.reg });
  assert.equal(rl.ok, true, rl.why);
  const after = 결과(x).판;
  assert.equal(장부.held(장부.rowOf(after, A)), false, '앞의 예약됨이 그 계정의 줄로 되살아나지 않는다');
  assert.equal(장부.rowOf(after, A).상태, '보류');
  // 다시 걸어 예약됨으로 닫으면 새 줄이 그 계정의 줄
  assert.equal(장부.claim({ dir: x, account: A, root: m.root, accounts: m.accounts, now, registry: m.reg }).ok, true);
  assert.equal(장부.finish({ dir: x, account: A, state: '예약됨', id: 'new', root: m.root, accounts: m.accounts, now, registry: m.reg }).ok, true);
  assert.equal(장부.rowOf(결과(x).판, A).게시물ID, 'new');
  // 「지움」도 거둔 줄이다
  m.줄쓰기(x, [{ 계정: A, 상태: '게시됨', 시각: '2026-11-20T13:00:00+07:00' }, { 계정: A, 상태: '지움' }]);
  assert.equal(장부.claim({ dir: x, account: A, root: m.root, accounts: m.accounts, now, registry: m.reg }).ok, true);
  assert.deepEqual(m.상태들(x), ['게시됨', '지움', '거는 중']);
});

test('닫는 작업본이 건 작업본과 다를 때(11-11 내린 세 판 · P1-팔9) — 같은 예약이면 표의 줄도 거두고, 다른 예약 · 살아 있는 「거는 중」은 건드리지 않는다', (t) => {
  const w = 두마당();
  t.after(w.cleanup);
  const { registry } = w;
  const HOUR = 3600000;
  const one = (o) => ({ root: w.one.root, accounts: w.one.accounts, registry, account: A, ...o });
  const two = (o) => ({ root: w.two.root, accounts: w.two.accounts, registry, account: A, ...o });
  const 올라옴 = (from, to) => fs.copyFileSync(path.join(from, '게시', '게시결과.json'), path.join(to, '게시', '게시결과.json'));
  const 표 = () => JSON.parse(fs.readFileSync(registry, 'utf8')).칸;
  const 표줄 = (name) => Object.values(표()).filter((e) => e.편 === name);
  const 걸린 = (root) => 장부.registryHolds(root, { registry }).map((h) => `${h.piece}:${h.state}`);
  let day = 20;
  const 두편 = () => { day += 1; const K = `2026-11-${day}T13:00:00+07:00`; return [w.둘다(`LAB_${day}가`, K), w.둘다(`LAB_${day}나`, K, `b${day}`)]; };

  // ① 건 사본(one)이 예약됨으로 닫고 줄이 올라왔다 → 다른 작업본(two)에서 공개 전에 내려 「실패」로 닫는다: 표의 줄이 거둬지고 그 칸이 열린다
  {
    const [[a1, a2], [, b2]] = 두편();
    assert.equal(장부.claim(one({ dir: a1, now: NOW })).ok, true);
    assert.equal(장부.finish(one({ dir: a1, state: '예약됨', id: 'yt1', now: NOW + 60000 })).ok, true);
    올라옴(a1, a2);
    assert.deepEqual(걸린(w.two.root), [`${path.basename(a1)}:예약됨`]);
    assert.equal(장부.finish(two({ dir: a2, state: '실패', seen: '스튜디오에서 비공개로 내림 — 목록 「비공개」', now: NOW + 4 * HOUR })).ok, true);
    assert.deepEqual(표줄(path.basename(a1)), [], '건 사본(one)이 적은 줄이지만 같은 예약이라 거둔다');
    assert.equal(결과(a1).판[0].상태, '예약됨', '건 사본의 줄은 옛 「예약됨」 그대로다(끝난 회차 사본)');
    assert.deepEqual(걸린(w.two.root), []);
    assert.equal(장부.claim(two({ dir: b2, now: NOW + 5 * HOUR })).ok, true, '같은 칸의 다른 편이 걸린다');
    assert.equal(장부.release({ dir: b2, account: A, why: '시험', root: w.two.root, registry }).ok, true);
    assert.equal(장부.claim(two({ dir: a2, now: NOW + 5 * HOUR })).ok, true, '내린 판을 고쳐 다시 걸 수 있다');
    assert.equal(장부.release({ dir: a2, account: A, why: '시험', root: w.two.root, registry }).ok, true);
  }

  // ② 낡은 사본(two)이 옛 예약을 늦게 「실패」로 닫아도, 건 사본(one)이 그 뒤에 다시 건 새 예약의 줄은 남는다 — 같은 칸의 다른 편은 막힌다
  //    (「나중에 적힌 줄이 이긴다」로 고치면 여기서 같은 칸이 두 번 걸린다)
  {
    const [[c1, c2], [, d2]] = 두편();
    assert.equal(장부.claim(one({ dir: c1, now: NOW })).ok, true);
    assert.equal(장부.finish(one({ dir: c1, state: '예약됨', id: 'yt2', now: NOW + 60000 })).ok, true);
    올라옴(c1, c2); // two는 옛 예약(예약됨 @ NOW+1분)을 들고 있다
    assert.equal(장부.finish(one({ dir: c1, state: '실패', seen: '예약 목록에 없음', now: NOW + HOUR })).ok, true);
    assert.equal(장부.claim(one({ dir: c1, now: NOW + 2 * HOUR })).ok, true);
    assert.equal(장부.finish(one({ dir: c1, state: '예약됨', id: 'yt3', now: NOW + 2 * HOUR + 60000 })).ok, true);
    assert.equal(장부.finish(two({ dir: c2, state: '실패', seen: '옛 예약이 목록에 없음', now: NOW + 3 * HOUR })).ok, true);
    assert.equal(표줄(path.basename(c1)).length, 1, '새 예약의 줄은 남는다');
    const blocked = 장부.claim(two({ dir: d2, now: NOW + 3 * HOUR + 1000 }));
    assert.equal(blocked.ok, false);
    assert.match(blocked.why, /같은 칸의 LAB_\d+가/);
  }

  // ③ 건 사본(one)이 올리는 중(거는 중 30분째)인 줄이 올라와 있어도, 다른 작업본에서 「실패」로 닫거나 풀어서 표의 줄을 지우지 못한다
  {
    const [[e1, e2], [, f2]] = 두편();
    assert.equal(장부.claim(one({ dir: e1, now: NOW })).ok, true);
    올라옴(e1, e2);
    assert.equal(장부.finish(two({ dir: e2, state: '실패', now: NOW + HOUR / 2 })).ok, true);
    assert.equal(표줄(path.basename(e1)).length, 1, '살아 있는 「거는 중」은 남는다');
    assert.equal(장부.claim(two({ dir: f2, now: NOW + HOUR / 2 + 1000 })).ok, false);
    const [[g1, g2], [, h2]] = 두편();
    assert.equal(장부.claim(one({ dir: g1, now: NOW })).ok, true);
    올라옴(g1, g2);
    장부.release({ dir: g2, account: A, why: '시험', root: w.two.root, now: NOW + HOUR / 2, registry });
    assert.equal(표줄(path.basename(g1)).length, 1, '풀기도 살아 있는 「거는 중」은 못 거둔다');
    assert.equal(장부.claim(two({ dir: h2, now: NOW + HOUR / 2 + 1000 })).ok, false);
  }

  // ④ 2시간이 지난 끊긴 걸기는 다른 작업본에서 「실패」로 닫거나 풀면 표의 줄도 거둔다
  {
    const [[i1, i2], [, j2]] = 두편();
    assert.equal(장부.claim(one({ dir: i1, now: NOW })).ok, true);
    올라옴(i1, i2);
    assert.equal(장부.finish(two({ dir: i2, state: '실패', now: NOW + 3 * HOUR })).ok, true);
    assert.deepEqual(표줄(path.basename(i1)), []);
    assert.equal(장부.claim(two({ dir: j2, now: NOW + 3 * HOUR + 1000 })).ok, true);
    assert.equal(장부.release({ dir: j2, account: A, why: '시험', root: w.two.root, registry }).ok, true);
    const [[k1, k2], [, l2]] = 두편();
    assert.equal(장부.claim(one({ dir: k1, now: NOW })).ok, true);
    올라옴(k1, k2);
    assert.equal(장부.release({ dir: k2, account: A, why: '끊긴 걸기 — 예약 목록에 없음', root: w.two.root, now: NOW + 3 * HOUR, registry }).ok, true);
    assert.deepEqual(표줄(path.basename(k1)), []);
    assert.equal(장부.claim(two({ dir: l2, now: NOW + 3 * HOUR + 1000 })).ok, true);
    assert.equal(장부.release({ dir: l2, account: A, why: '시험', root: w.two.root, registry }).ok, true);
  }

  // ⑤ 같은 예약 줄 뒤에 거둔 줄(보류)을 붙인 작업본이 있으면 그 예약은 풀린 것으로 읽는다 — 표 줄의 때와 걸린 줄의 기록시각이 같을 때만
  {
    const [[m1, m2], [, n2]] = 두편();
    assert.equal(장부.claim(one({ dir: m1, now: NOW })).ok, true);
    assert.equal(장부.finish(one({ dir: m1, state: '예약됨', id: 'yt5', now: NOW + 60000 })).ok, true);
    올라옴(m1, m2);
    const rows = 결과(m2).판;
    const 줄쓰기 = (판) => fs.writeFileSync(path.join(m2, '게시', '게시결과.json'), JSON.stringify({ 판 }, null, 2));
    // 걸린 줄의 기록시각이 표 줄의 때와 다르면(다른 예약) 거둔 줄이 붙어 있어도 건 사본의 줄을 믿는다
    줄쓰기([{ ...rows[0], 기록시각: new Date(NOW - HOUR).toISOString() }, { 계정: A, 상태: '보류' }]);
    assert.deepEqual(걸린(w.two.root).filter((x) => x.startsWith(path.basename(m1))), [`${path.basename(m1)}:예약됨`]);
    assert.equal(장부.claim(two({ dir: n2, now: NOW + HOUR })).ok, false);
    줄쓰기([...rows, { 계정: A, 상태: '보류', 까닭: '손으로 거둠' }]);
    assert.deepEqual(걸린(w.two.root).filter((x) => x.startsWith(path.basename(m1))), []);
    assert.equal(장부.claim(two({ dir: n2, now: NOW + HOUR })).ok, true);
    assert.equal(장부.release({ dir: n2, account: A, why: '시험', root: w.two.root, registry }).ok, true);
  }

  // ⑥ 고치기 전에 이미 어긋난 줄(11-11 실물 — 공용 줄은 「실패」, 표에는 건 사본의 「예약됨」)은 읽는 쪽이 풀어 주지 않는다. 건 사본에서 「실패」로 닫아야 풀린다
  {
    const [[o1, o2], [, p2]] = 두편();
    assert.equal(장부.claim(one({ dir: o1, now: NOW })).ok, true);
    assert.equal(장부.finish(one({ dir: o1, state: '예약됨', id: 'yt6', now: NOW + 60000 })).ok, true);
    fs.writeFileSync(path.join(o2, '게시', '게시결과.json'), JSON.stringify({ 판: [{ ...결과(o1).판[0], 상태: '실패', 확인: '공개 전에 내림', 기록시각: new Date(NOW + 4 * HOUR).toISOString() }] }, null, 2));
    assert.deepEqual(걸린(w.two.root).filter((x) => x.startsWith(path.basename(o1))), [`${path.basename(o1)}:예약됨`], '나중에 적힌 실패 줄로 풀지 않는다');
    assert.equal(장부.finish(two({ dir: o2, state: '실패', seen: '다시 확인', now: NOW + 5 * HOUR })).ok, true);
    assert.equal(표줄(path.basename(o1)).length, 1, '공용에서 끝 실패를 다시 돌려도 남는다(닫기 직전 줄이 그 예약이 아니다)');
    assert.equal(장부.claim(two({ dir: p2, now: NOW + 5 * HOUR + 1000 })).ok, false);
    assert.equal(장부.finish(one({ dir: o1, state: '실패', seen: '스튜디오 목록 「비공개」', now: NOW + 6 * HOUR })).ok, true);
    assert.deepEqual(표줄(path.basename(o1)), []);
    assert.equal(장부.claim(two({ dir: p2, now: NOW + 6 * HOUR + 1000 })).ok, true);
  }
});

test('[거는 중, 보류] — 안 닫힌 걸기는 뒤에 보류가 붙어 있어도 그 칸을 잡고 있다: 같은 칸의 다른 편 · 다른 작업본에서 걸리지 않는다(P1-팔7)', (t) => {
  const w = 두마당();
  t.after(w.cleanup);
  const { registry } = w;
  const K = '2026-11-20T13:00:00+07:00';
  const [a1, a2] = w.둘다('LAB_가', K);
  const [b1, b2] = w.둘다('LAB_나', K, 'b');
  assert.equal(장부.claim({ dir: a1, account: A, root: w.one.root, accounts: w.one.accounts, now: NOW, registry }).ok, true);
  // 끊긴 걸기 뒤에 손으로 보류를 덧붙였다
  const rows = 결과(a1).판;
  fs.writeFileSync(path.join(a1, '게시', '게시결과.json'), JSON.stringify({ 판: [...rows, { 계정: A, 상태: '보류', 까닭: '손으로 덧붙임' }] }, null, 2));
  assert.equal(장부.rowOf(결과(a1).판, A).상태, '거는 중', '읽는 쪽도 안 닫힌 걸기를 먼저 본다');
  // 같은 작업본의 같은 칸 다른 편
  const same = 장부.claim({ dir: b1, account: A, root: w.one.root, accounts: w.one.accounts, now: NOW + 1000, registry });
  assert.equal(same.ok, false);
  assert.match(same.why, /같은 칸/);
  // 다른 작업본의 같은 칸 다른 편 · 같은 판
  assert.equal(장부.claim({ dir: b2, account: A, root: w.two.root, accounts: w.two.accounts, now: NOW + 1000, registry }).ok, false);
  assert.equal(장부.claim({ dir: a2, account: A, root: w.two.root, accounts: w.two.accounts, now: NOW + 1000, registry }).ok, false);
  assert.deepEqual(장부.registryHolds(w.two.root, { registry }).map((h) => `${h.piece}:${h.state}`), ['LAB_가:거는 중']);
  assert.deepEqual(장부.pendingClaims(w.one.root, { registry }).map((c) => c.piece), ['LAB_가'], '걸던 것에도 보인다');
  // 풀면 거둔 줄(보류)이 남아 그 칸이 열린다
  assert.equal(장부.release({ dir: a1, account: A, why: '예약 목록에 없음', root: w.one.root, registry }).ok, true);
  assert.equal(장부.rowOf(결과(a1).판, A).상태, '보류');
  assert.equal(장부.claim({ dir: b2, account: A, root: w.two.root, accounts: w.two.accounts, now: NOW + 2000, registry }).ok, true);
});
