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
});

/* 🔴 이 검사는 **정확히 반대로** 적혀 있었다 — 「agent_profile 을 박으면 안 된다」.
 * 그 전제를 아무도 안 쟀고, 그것이 이 통로를 세운 날부터 죽여 온 원인이었다.
 * 실측 2026-08-16(조건 하나씩만 바꾼 대조 · 크레딧 0):
 *   없음 → 200+유령 · manus-1.6 → 200+유령 · manus-1.6-lite → 실재 ✅ · 오타 → 400.
 * 등급 밖 프로필은 **에러가 아니라 유령**이라, 이 한 칸이 빠지면 증상이 「404 가 계속 난다」뿐이다. */
test('①-b agent_profile 을 **반드시** 보낸다 — 빼면 마누스가 200+유령을 낸다 (F509 근본 원인)', () => {
  const b = 통로.생성몸통('질문 본문', '라벨');
  assert.ok('agent_profile' in b, 'agent_profile 이 없으면 작업이 안 만들어진다(200 은 나온다 — 그게 함정이다)');
  assert.strictEqual(b.agent_profile, 통로.기본프로필);
  /* 벤더가 400 으로 알려준 유효 목록 밖 값을 상수로 두면 전 호출이 400 이다. */
  assert.ok(['manus-1.6', 'manus-1.6-lite', 'manus-1.6-max'].includes(통로.기본프로필),
    `기본프로필 «${통로.기본프로필}» 이 벤더 유효 목록 밖이다 — 그러면 던지기가 전부 400 이다`);
});

test('①-c 프로필은 부를 때 갈아끼울 수 있다 — 등급이 오르면 상수를 안 고친다', () => {
  const b = 통로.생성몸통('질문', null, 'manus-1.6-max');
  assert.strictEqual(b.agent_profile, 'manus-1.6-max');
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

/* ⑫ 는 「성공인데 실패로 보인다」 자리다 — 던지기가 실제로 통했는데 종료코드가 0xC0000409 로
 * 나갔다(실측 2026-08-16 · Windows node v24.18 · libuv assert). 부르는 쪽이 그걸 읽으면
 * 재던지고, 재던지면 크레딧이 또 탄다 — 이 파일이 막으려는 사고 그 자체다. */
test('⑫ CLI 는 process.exit() 로 즉시 끊지 않는다 — 루프가 마르게 둔다', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'tools', '마누스.js'), 'utf8');
  const 코드줄 = src.split(/\r?\n/).filter((l) => !/^\s*[*/]/.test(l));   // 주석은 규칙 밖(자기 픽스처 신고 금지)
  assert.ok(!코드줄.some((l) => /process\.exit\s*\(/.test(l)),
    'fetch 를 탄 뒤 즉시 process.exit() 하면 libuv 가 abort 해 성공이 실패 코드로 나간다');
  assert.ok(/process\.exitCode\s*=/.test(src), '종료코드를 아예 안 적으면 실패가 0 으로 나간다(반대 방향 사고)');
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

/* ────────────────────────────────────────────────────────────────────────────
 * ⑬~⑱ 상태 판독 — **이 통로가 세워진 날부터 어떤 런도 «끝났다»고 말할 수 없었다.**
 *
 * 실측 2026-08-16(응답 원문 · 작업 6건 이력 전량 · 네트워크로 직접 확인):
 *   `task.listMessages` 최상위 키 = has_more · messages · next_cursor · ok · request_id · task_id
 *   → `task_status` 도 `status` 도 `data` 도 **없다.** 옛 판독은 그 셋만 봤으니 간헐이 아니라
 *     구조적으로 늘 빈값이었고(실측 154/154 회), 빈값은 조용히 다음 회차로 흘러
 *     `stopped`·`error`·`waiting` 어느 종료 분기에도 못 닿았다. 도달 가능한 출구는
 *     180분 상한 하나뿐 — 실제로 답이 **11분**에 끝난 작업 하나가 그 뒤 144분을 더 돌았다.
 * 아래 픽스처는 그 응답 모양을 그대로 못박는다(네트워크 0).
 * ──────────────────────────────────────────────────────────────────────────── */

/** 실측 응답 모양. ⚠ 최상위에 상태 필드가 **없다** — 그게 이 픽스처의 핵심이다. */
function 응답(메시지들) {
  return { has_more: false, messages: 메시지들, next_cursor: null, ok: true, request_id: 'req_x', task_id: 'T1' };
}
const 상태메시지 = (agent_status, timestamp) => ({ type: 'status_update', timestamp: String(timestamp), status_update: { agent_status, brief: `Manus is ${agent_status}` } });
const 말메시지 = (timestamp) => ({ type: 'assistant_message', timestamp: String(timestamp), assistant_message: { content: '답' } });

test('⑬ 끝난 작업을 «끝났다»고 읽는다 — 이 한 줄이 3시간을 태우던 자리다', () => {
  const j = 응답([상태메시지('stopped', 1786878493812), 말메시지(1786878493000), 상태메시지('running', 1786877836000)]);
  const { 상태, 출처 } = 통로.상태캐기(j);
  assert.strictEqual(상태, 'stopped');
  assert.strictEqual(출처, 'status_update');
  /* 픽스처가 실측 모양인지 스스로 확인한다 — 최상위 상태 필드가 생기면 이 검사의 전제가 낡는다. */
  assert.ok(!('task_status' in j) && !('status' in j) && !('data' in j),
    '실측 응답엔 최상위 상태 필드가 없다 — 있다면 벤더가 바꾼 것이고 그때 이 회귀를 다시 잰다');
});

test('⑭ 🔴 **최신 하나**만 본다 — 한 작업이 running→stopped→running 으로 다시 도는 것이 실재한다', () => {
  /* 실측 2건(뒤에 사람이 말을 더 건 대화형 작업). 옛 stopped 를 집으면 **도는 작업을 끝났다고
   * 적는다** — 그리고 그 오독은 언제나 「끝났다」 방향이라 조용히 통과한다. */
  const j = 응답([상태메시지('running', 3000), 상태메시지('stopped', 2000), 상태메시지('running', 1000)]);
  assert.strictEqual(통로.상태캐기(j).상태, 'running', '가장 최근 상태가 running 이면 아직 도는 중이다');
});

test('⑮ 배열 순서가 아니라 timestamp 로 고른다 — order 인자를 누가 바꿔도 안 흔들린다', () => {
  const 오름 = 응답([상태메시지('running', 1000), 상태메시지('stopped', 2000)]);   // asc 로 받은 모양
  const 내림 = 응답([상태메시지('stopped', 2000), 상태메시지('running', 1000)]);   // desc 로 받은 모양
  assert.strictEqual(통로.상태캐기(오름).상태, 'stopped');
  assert.strictEqual(통로.상태캐기(내림).상태, 'stopped');
});

test('⑯ 못 찾으면 «못찾음» 이라고 말한다 — 모름을 running 으로 접지 않는다', () => {
  const { 상태, 출처 } = 통로.상태캐기(응답([말메시지(1000)]));
  assert.strictEqual(상태, '', '모르는 것을 아는 척하면 폴러가 상한까지 헛돈다');
  assert.strictEqual(출처, '못찾음', '어디를 봤는지 안 적으면 로그만으로 원인을 못 가른다');
  assert.strictEqual(통로.상태캐기({}).상태, '');
  assert.strictEqual(통로.상태캐기(null).상태, '');
});

test('⑰ 벤더가 최상위 필드를 넣으면 그건 2차로 쓴다 — 다만 status_update 가 우선이다', () => {
  const j = 응답([상태메시지('running', 1000)]);
  j.task_status = 'stopped';
  assert.strictEqual(통로.상태캐기(j).상태, 'running', 'status_update 가 있으면 그게 참값이다');
  const 빈 = 응답([말메시지(1000)]);
  빈.task_status = 'STOPPED';
  const r = 통로.상태캐기(빈);
  assert.strictEqual(r.상태, 'stopped', '소문자로 눕혀야 아래 분기(=== "stopped")에 닿는다');
  assert.strictEqual(r.출처, '최상위필드');
});

test('⑱ 🔑 장치가 **실제로 발화한다** — 폴러가 상태캐기를 쓰고, 연속 빈값에 상한이 걸려 있다', () => {
  /* 스스로 발화하지 않는 장치는 안 돈다 — 함수만 있고 폴러가 옛 식을 그대로 쓰면 아무것도 안 바뀐다. */
  const src = fs.readFileSync(path.join(__dirname, '..', 'tools', '마누스.js'), 'utf8');
  const 줄들 = src.split(/\r?\n/).filter((l) => !/^\s*[*/]/.test(l));
  const 코드줄 = 줄들.join('\n');
  /* 🔴 처음엔 `/상태캐기\(j\)/` 로 훑었는데 그건 **함수 정의 줄**에도 맞는다 — 폴러를 옛 식으로
   * 되돌려 놔도 초록이었다(변이 ⑥ 이 잡아냈다). 정의는 「있다」의 증거지 「쓴다」의 증거가 아니다. */
  const 부름 = 줄들.filter((l) => /상태캐기\s*\(/.test(l) && !/function\s+상태캐기/.test(l));
  assert.ok(부름.length > 0, '폴러가 공용 판독을 실제로 불러야 한다(함수만 두고 안 쓰면 그대로다)');
  assert.ok(/연속빈값\s*\+=\s*1/.test(코드줄) && /연속빈값\s*>=\s*빈값상한/.test(코드줄),
    '빈값이 몇 회 연속인지 세고 상한에서 끊어야 한다 — 안 그러면 못 읽는 상태가 「도는 중」으로 흘러 상한까지 간다');
  assert.ok(Number.isInteger(통로.빈값상한) && 통로.빈값상한 > 0 && 통로.빈값상한 <= 30,
    `빈값상한 «${통로.빈값상한}» — 실측상 첫 status_update 는 생성 +1~2초에 뜬다(6/6). 30회를 넘기면 장치가 사실상 없는 것이다`);
});
