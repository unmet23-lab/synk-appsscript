'use strict';
/**
 * 마누스 통로 회귀 — **네트워크 0**. 갈리는 판단만 픽스처로 못박는다.
 *
 * 왜 이 셋인가 (전부 실제로 샜거나 샐 자리다):
 *   ① 생성 몸통 — 벤더 문서(`prompt`)와 실물(`message.content`)이 **어긋난다**(2026-08-16 실측
 *      400 `message.content is required`). 문서를 보고 「고치는」 사람이 반드시 나온다.
 *   ② 작업id 캐기 — 못 찾을 때 **폴백으로 빈 값을 흘리면** 폴러가 영원히 헛돌고,
 *      그 모습이 「도는 중」과 똑같다(F207 계열 — 새는 방향은 언제나 통과다).
 *   ③ 키 읽기 — 안내 주석이 남은 파일을 키로 보내면 401 이 나고, 그 401 은 「키가 틀렸다」로
 *      읽혀 사람이 엉뚱한 곳을 고친다.
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const 통로 = require('../tools/마누스.js');

test('① 생성 몸통은 message.content 다 — 문서의 `prompt` 로 되돌리면 빨개진다', () => {
  const b = 통로.생성몸통('질문 본문', '라벨');
  assert.strictEqual(b.message.content, '질문 본문', 'content 가 message 안에 있어야 한다');
  assert.strictEqual(b.title, '라벨');
  assert.ok(!('prompt' in b), '`prompt` 를 보내면 실제 API 가 400 을 낸다');
  assert.ok(!('agent_profile' in b), 'agent_profile 을 박으면 등급이 바뀌는 날 조용히 깨진다');
});

test('② 라벨이 없으면 title 을 아예 안 보낸다 — 빈 문자열 title 은 목록을 더럽힌다', () => {
  const b = 통로.생성몸통('질문만', null);
  assert.ok(!('title' in b));
});

test('③ 빈 질문은 던지기 전에 막는다 — 빈 작업은 크레딧만 태운다', () => {
  for (const 나쁜 of ['', '   ', null, undefined]) {
    assert.throws(() => 통로.생성몸통(나쁜, '라벨'), /비어 있다/);
  }
});

test('④ 작업id 를 못 찾으면 던진다 — 빈 id 폴백은 「도는 중」과 같은 모양이다', () => {
  assert.throws(() => 통로.작업ID캐기({ ok: true }), /task_id/);
  assert.throws(() => 통로.작업ID캐기({ task_id: '' }), /task_id/);
  assert.throws(() => 통로.작업ID캐기({ task_id: 12345 }), /task_id/, '숫자 id 는 문자열이 아니다');
});

test('⑤ 작업id 는 응답 모양이 바뀌어도 캐낸다 (평면·data 중첩 둘 다)', () => {
  assert.strictEqual(통로.작업ID캐기({ task_id: 'aaa' }), 'aaa');
  assert.strictEqual(통로.작업ID캐기({ id: 'bbb' }), 'bbb');
  assert.strictEqual(통로.작업ID캐기({ data: { task_id: 'ccc' } }), 'ccc');
});

/* ⑨⑩ 은 F509 가 실제로 태운 자리다 — 없는 작업 id 에 대고 404 를 **167회 · 180분** 물었고,
 * 그동안 런은 「도는 중」이었다. 가르는 자는 이 순수 함수 하나뿐이라 여기서 못박는다. */
test('⑨ 회복 불가(4xx)는 재시도하지 않는다 — 167회·180분을 태운 자리다', () => {
  for (const 코드 of [400, 401, 403, 404, 409, 422]) {
    assert.strictEqual(통로.회복불가인가(`마누스 task.listMessages → HTTP ${코드}\n  {"error":{"code":"not_found"}}`), true,
      `HTTP ${코드} 는 다시 물어도 같은 답이다 — 재시도하면 상한까지 태운다`);
  }
});

test('⑩ 일시 오류는 계속 문다 — 모르면 「일시」로 접는다(새는 방향을 골랐다)', () => {
  for (const 일시 of [
    '마누스 task.listMessages → HTTP 500',
    '마누스 task.listMessages → HTTP 502',
    '마누스 task.listMessages → HTTP 503',
    '마누스 task.listMessages → HTTP 429',   // 혼잡 — 기다리면 풀린다
    '마누스 task.listMessages → HTTP 408',   // 시간
    'fetch failed',                          // 네트워크 — HTTP 코드 자체가 없다
    '마누스 task.listMessages → JSON 이 아니다',
    '', null, undefined,
  ]) {
    assert.strictEqual(통로.회복불가인가(일시), false,
      `«${일시}» 를 회복 불가로 접으면 도는 작업을 끊고 크레딧을 버린다(비가역)`);
  }
});

test('⑪ 상태 이름은 마누스가 손으로 안 적는다 — 검수런 한 곳에서 나온다 (F509 갈라짐)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'tools', '마누스.js'), 'utf8');
  assert.ok(!/상태:\s*'완주'/.test(src),
    "마누스가 '완주'를 리터럴로 적으면 종료코드 3(결과 0바이트)이 ✅ 로 앉는다 — 런.상태이름(코드) 를 쓴다");
  assert.ok(/런\.상태이름\(/.test(src), '공용 통로를 실제로 부르는지 본다(주석만 고치고 넘어간 판을 막는다)');
});

test('⑥ 키 파일의 주석·빈 줄을 걷어낸다 — 안내문을 키로 보내면 401 이 「키 오류」로 오독된다', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-마누스키-'));
  const p = path.join(d, '키.txt');
  fs.writeFileSync(p, '# 안내 줄\n#\n\n  sk-진짜키값  \n# 뒤 주석\n', 'utf8');
  const 옛 = process.env.MANUS_KEY_PATH;
  process.env.MANUS_KEY_PATH = p;
  try {
    assert.strictEqual(통로.키(), 'sk-진짜키값');
  } finally {
    if (옛 === undefined) delete process.env.MANUS_KEY_PATH; else process.env.MANUS_KEY_PATH = 옛;
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test('⑦ 키가 주석뿐이면 «없다»고 말한다 — 조용히 빈 키를 보내지 않는다', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-마누스키-'));
  const p = path.join(d, '키.txt');
  fs.writeFileSync(p, '# 여기에 키를 붙여넣으세요\n\n', 'utf8');
  const 옛 = process.env.MANUS_KEY_PATH;
  process.env.MANUS_KEY_PATH = p;
  try {
    assert.throws(() => 통로.키(), /비어 있다/);
  } finally {
    if (옛 === undefined) delete process.env.MANUS_KEY_PATH; else process.env.MANUS_KEY_PATH = 옛;
    fs.rmSync(d, { recursive: true, force: true });
  }
});

test('⑧ 키 파일이 없으면 발급 경로를 함께 말한다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다', () => {
  const 옛 = process.env.MANUS_KEY_PATH;
  process.env.MANUS_KEY_PATH = path.join(os.tmpdir(), '없는파일-마누스-' + Date.now() + '.txt');
  try {
    assert.throws(() => 통로.키(), /manus\.im/);
  } finally {
    if (옛 === undefined) delete process.env.MANUS_KEY_PATH; else process.env.MANUS_KEY_PATH = 옛;
  }
});
