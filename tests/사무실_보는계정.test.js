'use strict';
// 솔리오 「사무실」을 볼 계정 도구(tools/사무실/보는계정.js). 임시 폴더를 SYNK_OFFICE_VIEWERS로 넘겨 돌린다. node --test tests/사무실_보는계정.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { defaultViewersFile } = require('../desktop/src/office.cjs');

const 도구 = path.join(__dirname, '..', 'tools', '사무실', '보는계정.js');
const 유호 = { synk_user_id: 'owner-1234567890', display_name: '유호', asked_at: '2026-11-20T01:00:00.000Z' };
const 시연 = { synk_user_id: 'demo-12345678901', display_name: '유호(시연)', asked_at: '2026-11-20T01:05:00.000Z' };

function 자리() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), '사무실-보는계정-'));
  const 목록자리 = path.join(d, 'viewers.json'), 물음자리 = path.join(d, 'viewer-pending.json');
  return {
    목록자리, 물음자리,
    물음: (asked) => fs.writeFileSync(물음자리, JSON.stringify({ asked })),
    목록: () => JSON.parse(fs.readFileSync(목록자리, 'utf8')),
    부르기: (...args) => {
      const r = spawnSync(process.execPath, [도구, ...args], { encoding: 'utf8', env: { ...process.env, SYNK_OFFICE_VIEWERS: 목록자리 } });
      return { code: r.status, out: r.stdout, err: r.stderr };
    },
  };
}

test('보는계정 — PC 앱과 같은 자리를 쓴다(SYNK_OFFICE_VIEWERS가 이기고, 대기 파일은 같은 폴더)', () => {
  assert.equal(defaultViewersFile({ SYNK_OFFICE_VIEWERS: 'X:\\시험\\viewers.json', LOCALAPPDATA: 'C:\\L' }, 'win32'), 'X:\\시험\\viewers.json');
  const s = 자리();
  s.물음([유호]);
  const r = s.부르기();
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /사무실을 볼 수 있는 계정: 없음/);
  assert.match(r.out, /2026-11-20T01:00:00\.000Z · 이름 「유호」 · 번호 owner-1234567890/, '물은 줄의 번호 · 이름 · 시각을 보인다');
  assert.match(r.out, /유호님께 이름과 시각을 보여/, '주인에게 확인하라는 말이 있다');
  assert.ok(!fs.existsSync(s.목록자리), '번호 없이 부르면 보기만 한다');
  assert.ok(fs.existsSync(s.물음자리));
});

test('보는계정 --받기 — 본 줄의 번호로만 받고, 있던 계정은 그대로 두며, 대기 파일을 지운다', () => {
  const s = 자리();
  s.물음([유호, 시연]);
  assert.equal(s.부르기('--받기', 'someone-else-123').code, 1, '목록에 없는 번호는 받지 않는다');
  assert.equal(s.부르기('--받기', '../owner').code, 1, '번호 꼴이 아니면 받지 않는다');
  assert.equal(s.부르기('--받기').code, 1, '번호 없는 --받기');
  assert.ok(!fs.existsSync(s.목록자리));
  const r = s.부르기('--받기', 유호.synk_user_id);
  assert.equal(r.code, 0, r.err);
  assert.match(r.out, /옮겼다 — 「유호」\(owner-…\)/);
  assert.deepEqual(s.목록().synk_user_ids, [유호.synk_user_id], '본 줄의 계정만 들어간다');
  assert.ok(!fs.existsSync(s.물음자리), '받으면 남은 대기 줄(시연 계정)은 지운다');
  assert.deepEqual(fs.readdirSync(path.dirname(s.목록자리)).sort(), ['viewers.json'], '임시 파일이 남지 않는다');

  s.물음([시연]);
  assert.equal(s.부르기('--받기', 시연.synk_user_id).code, 0);
  assert.deepEqual(s.목록().synk_user_ids, [유호.synk_user_id, 시연.synk_user_id], '있던 계정은 그대로 두고 더한다');
  const 지금 = s.부르기();
  assert.equal(지금.code, 0);
  assert.match(지금.out, /사무실을 볼 수 있는 계정: owner-…, demo-1…/, '인자 없이 부르면 지금 볼 계정을 보인다');
  assert.match(지금.out, /물은 계정이 없다/);
  assert.equal(s.부르기('--받기', 유호.synk_user_id).code, 1, '대기 줄이 없으면 받을 것도 없다');
});

test('보는계정 — 깨진 viewers.json은 덮지 않고 멈추고, --버리기는 대기 파일만 지운다', () => {
  const s = 자리();
  fs.writeFileSync(s.목록자리, '{ broken');
  s.물음([시연]);
  const r = s.부르기('--받기', 시연.synk_user_id);
  assert.equal(r.code, 1);
  assert.match(r.err, /덮어쓰지 않고 멈춘다/);
  assert.equal(fs.readFileSync(s.목록자리, 'utf8'), '{ broken');
  assert.equal(s.부르기('--버리기').code, 1, '깨진 목록이면 버리기도 멈춘다');
  fs.writeFileSync(s.목록자리, JSON.stringify({ synk_user_ids: ['bad id!'] }));
  assert.equal(s.부르기().code, 1, '꼴이 다른 번호가 있어도 멈춘다');
  fs.rmSync(s.목록자리);
  assert.equal(s.부르기('--버리기').code, 0);
  assert.ok(!fs.existsSync(s.물음자리), '--버리기는 대기 파일을 지운다');
  assert.ok(!fs.existsSync(s.목록자리), '--버리기는 볼 계정을 만들지 않는다');
  assert.equal(s.부르기('--모르는값').code, 1, '모르는 인자는 쓰는 법을 보인다');
  assert.equal(s.부르기('--받기', 유호.synk_user_id, '--버리기').code, 1, '받기와 버리기를 함께 쓰지 않는다');
});
