'use strict';
// 게시 장부 잠금(tools/게시장부.js — 2026-11-10 LAB 하루 두 편 설계 4). 임시 폴더의 가짜 편 · 원장만 쓴다.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
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
