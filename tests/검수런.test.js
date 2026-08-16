// 검수런 회귀 — 「30분짜리 판단 패스가 세션과 함께 죽고, 죽으면 0에서 다시」를 막은 장치를 지킨다.
//
// 왜 이 자리인가 (2026-08-12 · 유호님 「너무 오래 걸려서 중간에 끊긴다」):
//   실측한 끊김의 층이 셋이었고(① 셸 10분 상한 ② 세션 종료 ③ 중간 결과 전량 손실),
//   ②③ 이 안 막혀 있었다. 처방은 전부 **실패가 통과와 같은 모양**이 되는 자리에 있다:
//     · 이어받기가 느슨하면 빈 파일·거부 응답을 「이미 돌았다」로 읽는다 → 검수를 건너뛴 채 초록
//     · 방 지문이 좁으면 luna 로 시작한 판을 sol 결과로 채운다 → 섞였는데 조용하다
//     · 던지기가 자기 플래그를 안 빼면 자식이 또 던지고 손자가 또 던진다 → 프로세스 폭발
//     · 훅이 안 울리면 던진 런을 영영 안 줍는다 → 유호님이 정확히 우려한 그것
//   전부 「통과 방향」으로 새므로 프로즈로는 못 막는다.
//
// 탐지력은 **픽스처가 진다** — 실저장소엔 대개 던진 런이 0건이라, 거기서의 초록은
// 「던진 게 없다」와 「장치가 죽었다」를 못 가른다(초록은 분모와 함께 읽는다).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

/* 픽스처 방 — env 로 갈아끼워 실저장소 tmpdir 을 안 건드린다. 모듈이 경로를 **부를 때마다**
 * env 를 읽으므로(상수로 굳히지 않았다) 테스트마다 다른 방을 줄 수 있다. */
function 새방() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-검수런-test-'));
  process.env.SYNK_REVIEW_CKPT = path.join(d, 'ckpt');
  process.env.SYNK_REVIEW_RUNS = path.join(d, 'runs');
  return d;
}

function 런모듈() {
  delete require.cache[require.resolve('../tools/lib/검수런.js')];
  return require('../tools/lib/검수런.js');
}

// ───────────────────────────────────────────────── ① 무한 재귀 차단 (급소)

test('던지기 인자에서 --던지기 가 빠진다 — 안 빼면 자식이 또 던지고 손자가 또 던진다', () => {
  const 런 = 런모듈();
  const 나온 = 런.자식인자(['--commit', 'abc', 런.던지기플래그, '--회차', '2']);
  assert.ok(!나온.includes(런.던지기플래그), '자식 인자에 던지기 플래그가 남았다 — 프로세스 폭발이다');
  assert.deepStrictEqual(나온, ['--commit', 'abc', '--회차', '2'], '나머지 인자는 그대로 넘어가야 한다');
});

test('던지기 플래그가 여러 번 실려도 전부 빠진다', () => {
  const 런 = 런모듈();
  assert.deepStrictEqual(런.자식인자([런.던지기플래그, '--제안', 런.던지기플래그]), ['--제안']);
});

// ───────────────────────────────────────────────── ①-b 런ID ↔ 파일명 (실측으로 잡은 버그)

test('런ID 의 한글 종류가 파일명에서 안 뭉개진다 — 「검수」·「심문」이 둘 다 __ 면 서로 덮는다', () => {
  새방();
  const 런 = 런모듈();
  const a = 런.런경로('검수-2026-08-12T0214-abc123');
  const b = 런.런경로('심문-2026-08-12T0214-abc123');
  assert.notStrictEqual(a, b, '종류만 다른 두 런이 같은 파일을 쓴다 — 같은 초에 던지면 하나가 조용히 사라진다');
  assert.strictEqual(path.basename(a), '검수-2026-08-12T0214-abc123.json',
    '런ID 와 파일명이 갈렸다 — 훅이 준 런ID 로 사람이 로그를 못 찾는다');
  assert.strictEqual(런.파일명('a/b\\c:d*e?f"g<h>i|j'), 'a_b_c_d_e_f_g_h_i_j', '경로 위험 문자는 막아야 한다');
  assert.strictEqual(런.파일명('..'), '런', '전부 걸러지면 빈 이름 대신 폴백을 쓴다');
});

test('소스에 raw 제어 바이트가 없다 — 있으면 도구가 바이너리로 읽어 편집 자체가 막힌다', () => {
  for (const f of ['tools/lib/검수런.js', 'tools/codex-review.js', '.claude/hooks/review-runs.js']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const 나쁜 = [...s].filter((c) => { const n = c.codePointAt(0); return n < 32 && n !== 10 && n !== 13 && n !== 9; });
    assert.strictEqual(나쁜.length, 0, `${f} 에 raw 제어 바이트 ${나쁜.length}개 — 정규식에 제어문자를 리터럴로 넣지 않는다`);
  }
});

// ───────────────────────────────────────────────── ② 방 지문이 갈리는 축

test('방 지문은 대상·모델·효력·버그만·회차가 하나라도 다르면 갈린다 — 섞이면 조용히 통과한다', () => {
  const 런 = 런모듈();
  const 바탕 = { 종류: 'commit', 값: 'abc123', 모델: 'gpt-5.6-luna', 효력: 'max', 버그만: false, 총회차: 2 };
  const 기준 = 런.방지문(바탕);
  assert.strictEqual(런.방지문({ ...바탕 }), 기준, '같은 축이면 같은 방이어야 이어받기가 된다');
  for (const [k, v] of [['값', 'def456'], ['모델', 'gpt-5.6-sol'], ['효력', 'high'], ['버그만', true], ['총회차', 3], ['종류', 'base']]) {
    assert.notStrictEqual(런.방지문({ ...바탕, [k]: v }), 기준, `${k} 가 달라졌는데 같은 방을 쓴다 — 다른 검수의 결과를 이어받는다`);
  }
});

// ───────────────────────────────────────────────── ③ 이어받기 — 빈 것을 「돌았다」로 안 읽는다

test('빈 조각은 null 이다 — 빈 파일을 「이미 돌았다」로 읽으면 검수를 통째로 건너뛴다', () => {
  새방();
  const 런 = 런모듈();
  const 방 = 런.방({ 종류: 'commit', 값: 'x', 모델: 'm', 효력: 'max', 버그만: false, 총회차: 1 });
  런.조각쓰기(방, '산문', 1, '   \n  ');
  assert.strictEqual(런.조각읽기(방, '산문', 1), null, '공백뿐인 조각이 「내용 있음」으로 읽혔다');
  런.조각쓰기(방, '산문', 1, '실제 분석 결과');
  assert.strictEqual(런.조각읽기(방, '산문', 1), '실제 분석 결과');
});

test('깨진 JSON 조각은 없는 것으로 본다 — 깨진 걸 이어받으면 그게 더 나쁘다', () => {
  새방();
  const 런 = 런모듈();
  const 방 = 런.방({ 종류: 'commit', 값: 'y', 모델: 'm', 효력: 'max', 버그만: false, 총회차: 1 });
  런.조각쓰기(방, '구조', 1, '{"지적": [ 깨짐');
  assert.strictEqual(런.json읽기(방, '구조', 1), null);
  런.json쓰기(방, '구조', 1, { 지적: [] });
  assert.deepStrictEqual(런.json읽기(방, '구조', 1), { 지적: [] });
});

test('방비우기 뒤에는 이어받을 것이 없다 — 장부에 든 결과를 다음 판이 재활용하면 안 된다', () => {
  새방();
  const 런 = 런모듈();
  const 방 = 런.방({ 종류: 'commit', 값: 'z', 모델: 'm', 효력: 'max', 버그만: false, 총회차: 1 });
  런.json쓰기(방, '구조', 1, { 지적: [1] });
  런.방비우기(방);
  assert.strictEqual(런.json읽기(방, '구조', 1), null);
});

// ───────────────────────────────────────────────── ④ 런 판정 네 갈래

test('상태가 진행인데 프로세스가 없으면 멈춤이다 — 「모름」을 통과로 접지 않는다', () => {
  새방();
  const 런 = 런모듈();
  // 존재할 수 없는 pid. 0 은 특수값이라 쓰지 않는다(플랫폼마다 뜻이 다르다).
  const r = { 런ID: 'a', 종류: '검수', 상태: '진행', pid: 2147483646, 시작: new Date().toISOString() };
  assert.strictEqual(런.판정(r).갈래, '멈춤');
});

test('살아 있어도 상한을 넘으면 멈춤이다 — pid 재사용을 「살아 있다」로 읽으면 영원히 안 알린다', () => {
  새방();
  const 런 = 런모듈();
  const 오래전 = new Date(Date.now() - (런.멈춤분 + 10) * 60000).toISOString();
  const r = { 런ID: 'b', 종류: '검수', 상태: '진행', pid: process.pid, 시작: 오래전 };
  const 판 = 런.판정(r);
  assert.strictEqual(판.갈래, '멈춤', '상한을 넘겼는데 진행으로 읽었다');
  assert.match(String(판.사유 || ''), /경과/);
});

test('완주는 도장을 찍기 전까지 「완주미처분」이다 — 찍은 뒤에만 조용해진다', () => {
  새방();
  const 런 = 런모듈();
  런.런쓰기({ 런ID: 'c', 종류: '검수', 상태: '완주', pid: 1, 시작: new Date().toISOString(), 대상: 't', 인자: [] });
  assert.strictEqual(런.판정(런.런읽기('c')).갈래, '완주미처분');
  assert.ok(런.처분('c', '읽고 반영함'));
  assert.strictEqual(런.판정(런.런읽기('c')).갈래, '처분됨');
});

test('실패로 끝난 런도 주울 대상이다 — 실패를 조용히 삼키면 「안 돌았다」가 「통과」가 된다', () => {
  새방();
  const 런 = 런모듈();
  런.런쓰기({ 런ID: 'd', 종류: '심문', 상태: '실패', pid: 1, 시작: new Date().toISOString(), 대상: 't', 인자: [] });
  const 판 = 런.판정(런.런읽기('d'));
  assert.strictEqual(판.갈래, '실패미처분', '실패가 목록에서 사라지면 「안 돌았다」가 「통과」가 된다');
  /* 🔑 그런데 «완주»와 같은 칸이어도 안 된다 — 부르는 쪽이 이 한 칸만 보고 말을 짓기 때문에
   * 뭉치면 실패가 「✅ 결과가 이미 나와 있다」로 나간다(실측 F509). 두 조건이 한 벌이다. */
  assert.notStrictEqual(판.갈래, '완주미처분', '실패를 완주 칸에 넣으면 ✅ 의 얼굴로 나간다');
  const s = 런.요약();
  assert.strictEqual(s.실패미처분.length, 1, '요약이 실패 칸을 안 내면 훅·조회가 원리상 못 본다');
  assert.strictEqual(s.완주미처분.length, 0);
  assert.ok(런.처분('d', '원인 고치고 다시 던짐'), '실패에도 도장을 찍을 수 있어야 한다 — 아니면 세션마다 영영 뜬다');
  assert.strictEqual(런.판정(런.런읽기('d')).갈래, '처분됨');
});

test('상태와 종료코드가 어긋나면 비관 쪽을 읽는다 — 쓰는 쪽을 믿지 않는다 (F509 실물)', () => {
  새방();
  const 런 = 런모듈();
  /* F509 의 실물 그대로: 폴러 상한 초과라 결과가 0바이트인데 상태 칸엔 '완주'가 적혔다. */
  런.런쓰기({ 런ID: 'e', 종류: '사실심문', 상태: '완주', 종료코드: 3, pid: 1, 시작: new Date().toISOString(), 대상: 't', 인자: [] });
  assert.strictEqual(런.판정(런.런읽기('e')).갈래, '실패미처분',
    '상태만 읽으면 결과 0바이트가 ✅ 로 나간다 — 이미 장부에 앉은 옛 기록도 고쳐 읽혀야 한다');

  // 진짜 완주는 그대로 완주다 — 비관 판독이 거짓 적색을 만들면 안 된다.
  런.런쓰기({ 런ID: 'f', 종류: '검수', 상태: '완주', 종료코드: 0, pid: 1, 시작: new Date().toISOString(), 대상: 't', 인자: [] });
  assert.strictEqual(런.판정(런.런읽기('f')).갈래, '완주미처분');

  // 종료코드 칸이 아예 없는 옛 런은 건드리지 않는다(없음을 실패로 접으면 거짓 적색이다).
  런.런쓰기({ 런ID: 'g', 종류: '검수', 상태: '완주', pid: 1, 시작: new Date().toISOString(), 대상: 't', 인자: [] });
  assert.strictEqual(런.판정(런.런읽기('g')).갈래, '완주미처분');
});

test('종료코드 → 상태 이름은 한 곳에서만 나온다 (F509: 두 곳에 적어 갈라졌다)', () => {
  const 런 = 런모듈();
  assert.strictEqual(런.상태이름(0), '완주');
  for (const 코드 of [1, 2, 3, 4, 127, -1]) {
    assert.strictEqual(런.상태이름(코드), '실패', `종료코드 ${코드} 를 완주로 적으면 결과 0바이트가 ✅ 로 앉는다`);
  }
  /* 문자열 '0' 도 완주다 — JSON 왕복에서 숫자가 문자열로 돌아오는 자리가 실재한다. */
  assert.strictEqual(런.상태이름('0'), '완주');
});

test('파일명 규칙이 바뀐 유물 런도 도장을 받는다 — 못 받으면 세션마다 영영 뜬다 (F103)', () => {
  const d = 새방();
  const 런 = 런모듈();
  // 옛 규칙(한글이 __ 로 뭉개진 판)으로 저장된 파일을 손으로 만든다.
  const 뿌리 = path.join(d, 'runs');
  fs.mkdirSync(뿌리, { recursive: true });
  fs.writeFileSync(path.join(뿌리, '__-2026-08-12T0214-old.json'), JSON.stringify({
    런ID: '검수-2026-08-12T0214-old', 종류: '검수', 상태: '완주', pid: 1,
    시작: new Date().toISOString(), 대상: 't', 인자: [],
  }), 'utf8');
  assert.strictEqual(런.판정(런.런목록()[0]).갈래, '완주미처분', '유물이 목록에 안 잡혔다');
  assert.ok(런.처분('검수-2026-08-12T0214-old', '읽음'), '이름으로 못 찾는 런에 도장을 못 찍었다');
  assert.strictEqual(런.판정(런.런목록()[0]).갈래, '처분됨', '도장이 안 박혔다');
});

test('없는 런에 도장을 찍으면 실패한다 — 오타로 허공에 찍으면 진짜 런이 미처분으로 남는다', () => {
  새방();
  const 런 = 런모듈();
  assert.strictEqual(런.처분('없는런', '아무거나'), null);
});

// ───────────────────────────────────────────────── ④-b F334 — 낡은 대상을 끄는 손잡이

test('HEAD 를 모르면 대조하지 않는다 — 지어낸 「낡음」은 멀쩡한 런을 끄게 만든다', () => {
  새방();
  const 런 = 런모듈();
  assert.strictEqual(런.HEAD움직였나({ HEAD: '' }, 'abc'), false, '런의 HEAD 를 모르는데 낡았다고 했다');
  assert.strictEqual(런.HEAD움직였나({ HEAD: 'abc' }, ''), false, '현재 HEAD 를 모르는데 낡았다고 했다');
  assert.strictEqual(런.HEAD움직였나({ HEAD: 'abc' }, 'abc'), false);
  assert.strictEqual(런.HEAD움직였나({ HEAD: 'abc' }, 'def'), true);
});

test('도는 중이 아닌 런은 안 끈다 — 끝난 런의 pid 는 남이 재사용했을 수 있다', () => {
  새방();
  const 런 = 런모듈();
  런.런쓰기({ 런ID: 'e', 종류: '검수', 상태: '완주', pid: process.pid, 시작: new Date().toISOString(), 대상: 't', 인자: [] });
  const r = 런.중단('e', '아무거나');
  assert.strictEqual(r.ok, false, '완주한 런을 껐다 — 무관한 프로세스를 죽일 수 있다');
  assert.match(String(r.왜), /완주/);
});

test('끄기 전 이미 죽어 있으면 상태만 적는다 — 없는 pid 에 시그널을 쏘지 않는다', () => {
  새방();
  const 런 = 런모듈();
  런.런쓰기({ 런ID: 'f', 종류: '검수', 상태: '진행', pid: 2147483646, 시작: new Date().toISOString(), 대상: 't', 인자: [] });
  const r = 런.중단('f', '대상이 낡음');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.이미죽음, true);
  assert.strictEqual(런.런읽기('f').상태, '중단');
});

test('중단한 런은 훅에서 조용해진다 — 껐는데도 뜨면 사람이 알림을 통째로 무시한다', () => {
  const d = 새방();
  const 런 = 런모듈();
  런.런쓰기({ 런ID: 'g', 종류: '검수', 상태: '진행', pid: 2147483646, 시작: new Date().toISOString(), 대상: 't', 인자: [] });
  런.중단('g', '대상이 낡음');
  const r = 훅돌리기({ SYNK_REVIEW_RUNS: path.join(d, 'runs') });
  assert.strictEqual(r.out.trim(), '', `중단한 런이 아직 뜬다: ${r.out}`);
});

test('던진 뒤 HEAD 가 움직였으면 훅이 **끄는 명령**을 준다 (F334)', (t) => {
  const d = 새방();
  const 런 = 런모듈();
  런.런쓰기({
    런ID: '검수-낡음-1', 종류: '검수', 상태: '진행', pid: process.pid,
    시작: new Date().toISOString(), 대상: '--uncommitted', 인자: ['--uncommitted'],
    HEAD: '0000000000000000000000000000000000000000', 로그: 'C:/tmp/z.log',
  });
  const r = 훅돌리기({ SYNK_REVIEW_RUNS: path.join(d, 'runs') });
  if (!/HEAD 가 움직였다/.test(r.out)) {
    // git 을 못 돌리는 환경이면 대조를 안 한다 — 통과가 아니라 **미실행**으로 드러낸다.
    return t.skip('현재 HEAD 를 못 읽었다 — 대조를 안 돌렸다(통과 아님)');
  }
  assert.match(r.out, /--런중단 검수-낡음-1/, '끄는 명령이 그대로 안 나왔다 — 「낡았다」만으로는 처방이 아니다');
  assert.match(r.out, /--commit <sha>/, '「commit 으로 던진 건 유효하다」 단서가 빠지면 멀쩡한 런을 끄게 된다');
});

// ───────────────────────────────────────────────── ⑤ 심문 형식 = 거부 탐지

test('등급도 「지적 0건」도 없는 응답은 통과가 아니다 — 08-06 의 241바이트 거부가 그 모양이었다', () => {
  const cr = require('../tools/codex-review.js');
  assert.ok(!cr.심문형식통과(''), '빈 응답');
  assert.ok(!cr.심문형식통과('죄송하지만 이 요청은 수행할 수 없습니다.'), '거부 응답이 통과로 읽혔다');
  assert.ok(cr.심문형식통과('[P0] 소급 불가 구멍…'), '정상 등급 응답이 막혔다');
  assert.ok(cr.심문형식통과('검토 결과 지적 0건.'), '명시적 0건이 막혔다');
});

// ───────────────────────────────────────────────── ⑥ 플래그 등록 (F135 — 등록층이 실질 정책이다)

test('새 플래그가 아는플래그에 등록돼 있다 — 빠지면 「모르는 인자」로 즉시 거절된다', () => {
  const cr = require('../tools/codex-review.js');
  for (const f of [cr.던지기플래그, cr.직렬플래그, '--런목록']) {
    assert.ok(cr.아는플래그.has(f), `${f} 가 아는플래그에 없다`);
  }
  assert.ok(cr.값플래그.includes('--런처분'), '--런처분 이 값플래그가 아니면 뒤의 런ID 를 인자로 오인한다');
});

test('모르는 단계는 자식 진입점이 거절한다 — 조용히 기본값으로 접으면 딴 단계를 돈다', () => {
  const cr = require('../tools/codex-review.js');
  assert.ok(cr.아는단계.has('검수') && cr.아는단계.has('기능') && cr.아는단계.has('심문'));
  assert.ok(!cr.아는단계.has('없는단계'));
});

// ───────────────────────────────────────────────── ⑦ 훅 — 침묵과 발화

function 훅돌리기(env) {
  try {
    return {
      코드: 0,
      out: execFileSync(process.execPath, [path.join(ROOT, '.claude', 'hooks', 'review-runs.js')],
        { encoding: 'utf8', env: { ...process.env, ...env } }),
    };
  } catch (e) {
    return { 코드: e.status, out: String(e.stdout || '') + String(e.stderr || '') };
  }
}

test('던진 런이 0건이면 훅은 한 글자도 안 쓴다 — 상시 소음은 알림을 죽인다', () => {
  const d = 새방();
  const r = 훅돌리기({ SYNK_REVIEW_RUNS: path.join(d, 'runs-없음') });
  assert.strictEqual(r.코드, 0);
  assert.strictEqual(r.out.trim(), '', `0건인데 출력이 있다: ${r.out}`);
});

test('완주 미처분이 있으면 훅이 런ID 와 **실행 가능한 처분 명령**을 낸다 (F103)', () => {
  const d = 새방();
  const 런 = 런모듈();
  런.런쓰기({ 런ID: '검수-테스트-1', 종류: '검수', 상태: '완주', 종료코드: 0, pid: 1, 시작: new Date().toISOString(), 대상: '--commit abc', 인자: ['--commit', 'abc'], 로그: 'C:/tmp/x.log' });
  const r = 훅돌리기({ SYNK_REVIEW_RUNS: path.join(d, 'runs') });
  assert.strictEqual(r.코드, 0);
  assert.match(r.out, /검수-테스트-1/, '런ID 가 안 나왔다');
  assert.match(r.out, /--런처분/, '처분 명령이 안 나왔다 — 따를 수 없는 처방은 우회를 정상 통로로 만든다');
});

test('멈춘 런에는 **이어받기 명령 그 자체**가 나온다 — 「다시 돌려라」만으로는 처방이 아니다', () => {
  const d = 새방();
  const 런 = 런모듈();
  런.런쓰기({ 런ID: '심문-테스트-2', 종류: '심문', 상태: '진행', pid: 2147483646, 시작: new Date().toISOString(), 대상: '--심문 docs/x.md', 인자: ['--심문', 'docs/x.md'], 로그: 'C:/tmp/y.log' });
  const r = 훅돌리기({ SYNK_REVIEW_RUNS: path.join(d, 'runs') });
  assert.match(r.out, /멈춘 것 1건/);
  assert.match(r.out, /codex-review\.js --심문 docs\/x\.md/, '이어받기 명령이 그대로 안 나왔다');
  assert.match(r.out, /처음부터 다시가 아니다/, '이어받기가 싸다는 사실이 안 적혔다 — 사람이 겁먹고 안 돌린다');
});

test('처분 도장이 찍힌 런은 훅에서 사라진다 — 찍었는데 계속 뜨면 사람이 훅을 무시하게 된다', () => {
  const d = 새방();
  const 런 = 런모듈();
  런.런쓰기({ 런ID: '검수-테스트-3', 종류: '검수', 상태: '완주', pid: 1, 시작: new Date().toISOString(), 대상: 't', 인자: [] });
  런.처분('검수-테스트-3', '반영 완료');
  const r = 훅돌리기({ SYNK_REVIEW_RUNS: path.join(d, 'runs') });
  assert.strictEqual(r.out.trim(), '', `처분한 런이 아직 뜬다: ${r.out}`);
});

// ───────────────────────────────────────────────── ⑧ 단계 병렬 (2026-08-12 · 벽시계의 나머지 절반)
//
// 회차는 병렬인데 **단계가 순차**였다 — 검수가 통째로 끝나야 기능체크가 시작해서 벽시계가
// `검수 + 기능` 이었다. 여기서 새는 방향은 조용하다: 계획이 비어도 부모가 순차로 완주하므로
// **결과는 똑같고 시간만 두 배**다. 그래서 「돌았다」로는 절대 안 잡히고, 계획을 직접 재야 한다.

test('기본 조합은 검수와 기능체크를 한꺼번에 띄운다 — 순차면 벽시계가 두 배인데 결과가 같아 조용하다', () => {
  const cr = require('../tools/codex-review.js');
  assert.deepStrictEqual(cr.병렬계획([], 2), [{ 단계: '검수', 회차: 2 }, { 단계: '기능', 회차: 2 }]);
});

test('--회차 1 도 두 단계를 띄운다 — 옛 잣대(회차>1)가 통째로 놓치던 자리다', () => {
  const cr = require('../tools/codex-review.js');
  assert.deepStrictEqual(cr.병렬계획([], 1), [{ 단계: '검수', 회차: 1 }, { 단계: '기능', 회차: 1 }],
    '자식이 2개라 벽시계가 절반이 되는데 옛 판은 회차만 보고 안 띄웠다');
});

test('--버그만 은 기능 자식을 안 띄우고, 자식 총합이 1이면 아예 안 띄운다', () => {
  const cr = require('../tools/codex-review.js');
  assert.deepStrictEqual(cr.병렬계획(['--버그만'], 2), [{ 단계: '검수', 회차: 2 }],
    '기능체크를 생략한 모드인데 기능 자식을 띄우면 시키지도 않은 패스를 태운다');
  assert.deepStrictEqual(cr.병렬계획(['--버그만'], 1), [],
    '자식 1개는 프로세스 값만 치르고 이득이 0 이다');
});

test('--직렬 은 계획을 통째로 비운다 — rate limit 에 걸렸을 때 끄는 유일한 손잡이다', () => {
  const cr = require('../tools/codex-review.js');
  assert.deepStrictEqual(cr.병렬계획(['--직렬'], 2), []);
  assert.deepStrictEqual(cr.병렬계획(['--직렬', '--버그만'], 3), []);
});

test('입력 조각은 겹쳐 쓴다 — 덮으면 먼저 적힌 기능프롬프트가 사라져 기능 자식이 통째로 죽는다', () => {
  새방();
  const cr = require('../tools/codex-review.js');
  const 런 = 런모듈();
  const 방 = 런.방({ 종류: '커밋', 값: 'abc', 모델: 'm', 효력: 'x', 버그만: false, 총회차: 2 });
  cr.입력쓰기(방, { 기능프롬프트: '기능 질문' });
  cr.입력쓰기(방, { 대상: { 종류: '커밋', 값: 'abc' }, 회차: 2 });
  const 입력 = 런.json읽기(방, '입력', 0);
  assert.strictEqual(입력.기능프롬프트, '기능 질문', '뒤 쓰기가 앞 칸을 덮었다 — 기능 자식이 「프롬프트가 방에 없다」로 죽는다');
  assert.strictEqual(입력.회차, 2, '뒤 쓰기가 안 들어갔다');
});

// ───────────────────────────────────────────────── ⑨ 「그 회차가 값했나」 = 단독 기여
//
// 유호님 질문(2026-08-12): 「2번이·sol 이 값어치를 충분히 할까?」
// 장부엔 회차별 **건수**만 있었는데 그건 이 질문에 원리상 답을 못 한다 — 두 회차가 각 20건인데
// 완전히 겹치면 2회차는 한 건도 안 보탠 것인데도 「20 · 20」으로 보인다. 값한 것은 단독뿐이다.

test('완전히 겹치는 2회차는 단독 0 으로 드러난다 — 건수만 보면 「20·20」이라 값한 것처럼 읽힌다', () => {
  const cr = require('../tools/codex-review.js');
  const f = (제목) => ({ 등급: 'P1', 파일: 'a.js', 라인: 1, 제목 });
  const r = cr.회차병합([{ 지적: [f('X'), f('Y')] }, { 지적: [f('X'), f('Y')] }]);
  assert.strictEqual(r.지적.length, 2, '합집합이 틀렸다');
  assert.deepStrictEqual(r.회차별.map((x) => x.단독), [0, 0], '겹치기만 한 회차가 단독을 가졌다');
  assert.deepStrictEqual(r.회차별.map((x) => x.지적수), [2, 2], '건수는 그대로여야 한다 — 이게 착시의 근원이다');
});

test('단독은 등급까지 센다 — 단독 3건이 P3 셋인 것과 P0 셋인 것은 다른 판정이다', () => {
  const cr = require('../tools/codex-review.js');
  const r = cr.회차병합([
    { 지적: [{ 등급: 'P1', 파일: 'a.js', 제목: '공통' }, { 등급: 'P3', 파일: 'a.js', 제목: '1회만' }] },
    { 지적: [{ 등급: 'P1', 파일: 'a.js', 제목: '공통' }, { 등급: 'P0', 파일: 'b.js', 제목: '2회만' }] },
  ]);
  assert.deepStrictEqual(r.회차별[0].단독등급, { P3: 1 });
  assert.deepStrictEqual(r.회차별[1].단독등급, { P0: 1 }, '2회차 단독이 P0 인데 건수로만 세면 1회차 단독과 같아 보인다');
  assert.match(cr.회차별줄(r.회차별), /단독 1\(P0 1\)/, '사람이 읽을 줄에 등급이 안 실렸다 — 장부에만 적으면 아무도 안 본다');
});

test('셋 중 둘이 본 지적은 누구의 단독도 아니다 — 「나만 봤다」가 아니면 그 회차의 값이 아니다', () => {
  const cr = require('../tools/codex-review.js');
  const g = (제목) => ({ 등급: 'P2', 파일: 'c.js', 제목 });
  const r = cr.회차병합([{ 지적: [g('A'), g('B')] }, { 지적: [g('B')] }, { 지적: [g('C')] }]);
  assert.deepStrictEqual(r.회차별.map((x) => x.단독), [1, 0, 1], 'B 를 둘이 봤는데 단독으로 셌다');
});

test('회차 1 이면 줄을 안 낸다 — 비교 대상이 없는 자리에 분모처럼 생긴 숫자를 내지 않는다', () => {
  const cr = require('../tools/codex-review.js');
  assert.strictEqual(cr.회차별줄([{ 회차: 1, 지적수: 5, 단독: 0, 단독등급: {} }]), '');
  assert.strictEqual(cr.회차별줄(null), '');
});

test('입력이 덜 적힌 방으로 검수 자식을 띄우면 **이름 붙은 실패**로 남는다 — 조용히 죽으면 「가끔 안 빨라짐」이 전부다', () => {
  const d = 새방();
  const 런 = 런모듈();
  const 방 = 런.방({ 종류: '커밋', 값: 'zzz', 모델: 'm', 효력: 'x', 버그만: false, 총회차: 1 });
  런.json쓰기(방, '입력', 0, { 회차: 1, timeoutMs: 1000 });   // 대상 없음 = 띄우는 순서가 틀린 판
  let 코드 = 0; let out = '';
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'tools', 'codex-review.js'), '--회차실행', 방, '1', '검수'],
      { encoding: 'utf8', env: { ...process.env, SYNK_REVIEW_CKPT: path.join(d, 'ckpt') } });
  } catch (e) { 코드 = e.status; out = String(e.stdout || '') + String(e.stderr || ''); }
  assert.strictEqual(코드, 2, '대상 없는 방인데 자식이 성공으로 끝났다');
  assert.match(out, /검수 대상이 방에 없다/, '실패 이유가 이름 없이 죽었다 — codex 안쪽 TypeError 로 묻힌다');
  assert.ok(런.조각읽기(방, '실패-검수', 1), '실패 마커가 안 남았다 — 부모 폴링이 상한까지 헛돌고 그 시간은 사람이 기다린 시간이다');
});

// ───────────────────────────────────────────────── ⑩ 손자가 부모의 「완주」를 훔치지 않는다 (F352)
//
// 🔴 실사고 2026-08-12 (`local_ed8b5124` · 런 `검수-…0514-5def98` · 파일 104개 · 18분):
//   훅이 「✅ 완주했는데 아직 안 주운 런」으로 알렸는데 `검수기록.jsonl` 은 **33줄 그대로**였고
//   배포 게이트는 닫힌 채였다. 원인은 `병렬실행` 이 `env: { ...process.env, … }` 로 자식을 띄워
//   **던진 런의 `SYNK_REVIEW_RUN_ID` 가 손자에게 상속**된 것 — 손자가 먼저 끝나며 부모 런에
//   도장을 찍었다. 부모는 그때 회차 1 폴백을 태우는 중이었고 결국 장부에 아무것도 못 실었다.
//   새는 방향이 「완주」라 **18분과 벤더 비용이 통과의 모양을 하고 증발했다**(F207 계열).
//
// 벽이 둘인 이유: ①`자식환경()` 이 키를 지운다(깨끗함) ②`마감()` 이 자식 표식을 보고 건너뛴다(벽).
//   ①만 있으면 새 spawn 자리가 생기는 날 그대로 재발한다 — 등록층은 언제나 「통과」로 샌다.
//   그래서 아래 두 테스트는 **각각 한 층씩** 잰다(한 테스트로 묶으면 서로를 가려 둘 다 못 잡는다).

test('자식환경() 은 부모의 런ID 를 **지운다** — 물려주면 손자가 부모 대신 완주 도장을 찍는다', () => {
  const 런 = 런모듈();
  const 원본 = { SYNK_REVIEW_RUN_ID: '검수-2026-0812-abc123', PATH: '/x', 그외: '보존' };
  const e = 런.자식환경(원본);
  assert.strictEqual(e[런.런ID키], undefined, '런ID 가 자식에게 샜다 — 손자가 부모 런 상태를 덮는다(F352)');
  assert.strictEqual(e[런.자식표식키], '1', '자식 표식이 없다 — 두 번째 벽(마감 건너뛰기)이 안 선다');
  assert.strictEqual(e.그외, '보존', '나머지 환경까지 날렸다 — 자식이 PATH 를 잃고 딴 이유로 죽는다');
  assert.strictEqual(원본[런.런ID키], '검수-2026-0812-abc123', '원본 env 를 파괴했다 — 부모가 제 런ID 를 잃는다');
});

test('런ID 를 물려받은 자식이 끝나도 부모 런 상태는 **안 바뀐다** — 두 번째 벽(F352 사고 재현)', () => {
  새방();
  const 런 = 런모듈();
  const 런ID = '검수-F352픽스처-aaaaaa';
  런.런쓰기({ 런ID, 종류: '검수', 상태: '진행', 시작: new Date().toISOString(), pid: process.pid, 대상: '픽스처' });

  /* 사고를 그대로 재현한다 — env 에 런ID 를 **강제로 넣고** 자식 표식과 함께 띄운다.
   * 인자를 일부러 덜 줘 codex 에 닿기 전에 2 로 끝나게 한다(벤더 호출 0 · 몇 ms). */
  try {
    execFileSync(process.execPath, [path.join(ROOT, 'tools', 'codex-review.js'), '--회차실행'], {
      encoding: 'utf8',
      env: { ...process.env, SYNK_REVIEW_RUN_ID: 런ID, SYNK_REVIEW_CHILD: '1' },
    });
  } catch (_) { /* 종료코드 2 가 정상 — 이 픽스처가 재는 건 「그 2 가 부모 런에 박히나」다 */ }

  const 후 = 런.런읽기(런ID);
  assert.strictEqual(후.상태, '진행',
    `손자가 부모 런을 「${후.상태}」로 덮었다 — 부모는 아직 도는데 훅은 주우라고 알린다(F352)`);
  assert.strictEqual(후.종료코드, undefined, '손자의 종료코드가 부모 런에 박혔다 — 「완주」의 근거가 남의 것이다');
});
