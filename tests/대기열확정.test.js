/* 확정 대조 — 「여쭙기 전에 그 판정이 이미 났나」 회귀 (F376).
 *
 * 이 검사가 지키는 것: **낡은 `〖⏳유호〗` 를 그대로 믿고 유호님께 두 번 여쭙지 않는다.**
 * 2026-08-12 실측(`local_52e7be3a`) — 한 세션에 2건. 유호님이 같은 답을 두 번 주셨고,
 * 그중 하나는 메모리에 「⚠유호님이 이 답을 «한 번 더» 주셨다」로 박혀 있다
 * (`season-review-vessel.md` · 🚫세 번째 질의 금지).
 *
 * 왜 픽스처인가: 재료가 **저장소 밖 메모리**(`~/.claude/projects/<슬러그>/memory`)다. CI 체크아웃엔
 * 없고 기계마다 다르다. 그래서 탐지력은 전부 여기 임시 디렉터리가 지고, 실저장소에는 **거짓양성만**
 * 검사하되 못 읽으면 fail 이 아니라 **skip 으로 드러낸다**(CLAUDE.md 신뢰성 · F296·F207).
 */
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const 확정 = require(path.join(ROOT, 'tools', 'lib', '확정대조.js'));
const 큐 = require(path.join(ROOT, 'tools', '대기열.js'));

/** 임시 메모리 디렉터리 하나. `{파일명: 본문}` 을 그대로 깐다. */
function 메모리(파일들) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'confirm-'));
  for (const [이름, 본문] of Object.entries(파일들)) fs.writeFileSync(path.join(dir, 이름), 본문, 'utf8');
  return dir;
}
function 치움(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 윈도우 잠금 */ }
}

// ───────────────────────────────── 탐지력 (픽스처)

test('🔑 F376 ① — 「재질의 불필요」로 적힌 확정을 잡는다 (표기가 🚫재질의 하나가 아니다)', () => {
  /* 실제 문장이다 — `vendor-api-billing.md:15`. `🚫` 없이 「재질의 불필요」로만 적혀 있어서
   * 🚫 한 글자만 보는 검사는 이 건을 통째로 놓친다(F384 와 같은 뿌리 — 어휘가 하나가 아니다). */
  const dir = 메모리({
    'vendor-api-billing.md': '- **Claude Code 구독료 ≠ API 키 요금**(사실 · 재질의 불필요). 지금 안 넣어도 된다.\n',
  });
  try {
    const r = 확정.대조({
      대상: [{ 층: 'P2', 씨앗: 'API 키', 본문: '〖⏳유호〗 **API 키 결재** — 유호님 몫(돈). 근거=[[vendor-api-billing]]' }],
      메모리뿌리: dir,
    });
    assert.strictEqual(r.측정, true);
    assert.strictEqual(r.걸림.length, 1, '「재질의 불필요」를 못 잡으면 F376 ①이 그대로 재발한다');
    assert.match(r.걸림[0].조각[0].글, /재질의 불필요/);
  } finally { 치움(dir); }
});

test('🔑 F376 ② — 「🚫재질의」가 붙은 확정을 잡고, 조각의 날짜까지 든다', () => {
  const dir = 메모리({
    'season-review-vessel.md': '## ✅ 유호님 확정 (2026-08-12 · 3건 — 🚫재질의)\n- 나침반 = 입학 3 + 시즌 1.\n',
  });
  try {
    const r = 확정.대조({
      대상: [{ 층: 'P1', 씨앗: '시즌 회고', 본문: '〖⏳유호〗 **시즌 회고 그릇** — ⏳유호 3. 근거=[[season-review-vessel]]' }],
      메모리뿌리: dir,
    });
    assert.strictEqual(r.걸림.length, 1);
    assert.strictEqual(r.걸림[0].조각[0].날짜, '08-12', '날짜를 못 들면 읽는 사람이 「언제 난 판정인가」로 파일을 또 연다');
  } finally { 치움(dir); }
});

test('☠️ 맨 「재질의」 서술은 안 잡는다 — 넓히면 F376 을 «기록한 문장»이 스스로 경보가 된다', () => {
  /* `season-review-vessel.md:114` 의 실제 문장이다. 이 줄엔 금지가 아니라 **사고 기록**이 적혀 있다.
   * 낱말 하나로 넓히면 장부를 성실히 쓴 토픽일수록 시끄러워지고, 시끄러운 경보는 꺼진다. */
  const 서술 = '⚠유호님이 08-12 이 답을 «한 번 더» 주셨다 — `local_52e7be3a` 가 재질의한 탓이다.';
  assert.strictEqual(확정.재질의패턴.test(서술), false, `서술문이 금지로 읽혔다: ${서술}`);
  assert.strictEqual(확정.확정조각들(서술).length, 0);
});

test('🔑 그 «같은 줄»에 금지가 함께 있으면 잡는다 — 서술을 뺀다고 금지까지 빠지면 안 된다', () => {
  const 둘다 = '재질의한 탓이다. 답은 같다. 🚫**세 번째 질의 금지.**';
  assert.strictEqual(확정.확정조각들(둘다).length, 1, '서술 배제가 넓어져 금지까지 먹었다 — 새는 방향이 「조용함」이다');
});

test('☠️ 근거 링크가 없는 줄은 「깨끗함」이 아니라 «못 잼»으로 센다 (F207)', () => {
  const dir = 메모리({ 'aaa.md': '🚫재질의\n' });
  try {
    const r = 확정.대조({
      대상: [{ 층: 'P1', 씨앗: '라디오24', 본문: '〖⏳유호〗 **라디오24 P0 ④** — 링크가 없다' }],
      메모리뿌리: dir,
    });
    assert.strictEqual(r.걸림.length, 0);
    assert.strictEqual(r.링크없음.length, 1, '링크 0 을 조용히 통과시키면 「전건 대조했다」는 거짓 초록이 된다');
  } finally { 치움(dir); }
});

test('☠️ 메모리를 못 읽으면 «측정 실패»다 — 0건과 같은 모양으로 내지 않는다 (F296)', () => {
  const r = 확정.대조({
    대상: [{ 층: 'P0', 씨앗: '무엇', 본문: '〖⏳유호〗 **무엇** 근거=[[있는토픽]]' }],
    메모리뿌리: path.join(os.tmpdir(), '없는-디렉터리-' + process.pid),
  });
  assert.strictEqual(r.측정, false, '없는 디렉터리에서 측정 성공이 나오면 CI 가 매번 조용한 초록을 낸다');
  assert.strictEqual(r.걸림.length, 0);
  assert.ok(r.사유 && r.사유.length > 0, '미측정은 사유와 함께 나와야 읽는 사람이 「0건」과 가른다');
  assert.strictEqual(r.대상수, 1, '미측정이어도 분모는 말해야 한다');
});

test('🔑 대상은 〖⏳유호〗 뿐이다 — 다른 차단자까지 세면 경보가 분모에 묻힌다', () => {
  assert.strictEqual(확정.유호대기(큐.차단('〖⏳유호〗 **가**')), true);
  assert.strictEqual(확정.유호대기(큐.차단('〖⛔선행〗 **나**')), false);
  assert.strictEqual(확정.유호대기(큐.차단('〖지금〗 **다**')), false, '「지금 집을 수 있음」은 빈 문자열이라 참으로 새기 쉽다');
  assert.strictEqual(확정.유호대기(큐.차단('**표식 없음**')), false, '미표기(null)를 대상으로 세면 안 된다');
});

test('🔑 처방을 따르면 실제로 재진다 (가드 3맹점 ③ — 자기 처방을 막지 않는가)', () => {
  /* 도구가 내는 처방은 「줄 끝에 `근거=[[토픽]]` 을 달면 다음 세션부터 재진다」다.
   * 그대로 달았을 때 «못 잼»에서 «잰 것»으로 옮겨가는지 본다 — 안 옮겨가면 따를 수 없는 처방이다(F103). */
  const dir = 메모리({ '토픽.md': '✅ 유호 확정 08-09 — 🚫재질의\n' });
  try {
    const 전 = 확정.대조({ 대상: [{ 씨앗: 'x', 본문: '〖⏳유호〗 **x**' }], 메모리뿌리: dir });
    const 후 = 확정.대조({ 대상: [{ 씨앗: 'x', 본문: '〖⏳유호〗 **x** 근거=[[토픽]]' }], 메모리뿌리: dir });
    assert.strictEqual(전.링크없음.length, 1);
    assert.strictEqual(후.링크없음.length, 0);
    assert.strictEqual(후.걸림.length, 1, '처방대로 링크를 달았는데도 안 재지면 그 처방은 우회를 정상 통로로 만든다');
  } finally { 치움(dir); }
});

test('☠️ 토픽 파일이 없으면 «못 잼»이지 «확정 없음»이 아니다', () => {
  const dir = 메모리({ '있는것.md': '내용\n' });
  try {
    const r = 확정.대조({ 대상: [{ 씨앗: 'y', 본문: '〖⏳유호〗 **y** 근거=[[아직안쓴토픽]]' }], 메모리뿌리: dir });
    assert.strictEqual(r.못잼.length, 1);
    assert.strictEqual(r.걸림.length, 0);
  } finally { 치움(dir); }
});

// ───────────────────────────────── 실저장소 (거짓양성만 · 못 읽으면 skip)

test('실저장소 — 대조기가 실제 대기열·메모리에서 터지지 않는다', (t) => {
  const 전체 = 큐.항목들();
  if (전체 === null) return t.skip('대기열 파일을 못 읽었다');
  const r = 큐.확정재료(전체);
  if (!r.측정) return t.skip(`메모리를 못 읽었다 — ${r.사유} (⏳유호 ${r.대상수}건 미측정)`);
  assert.ok(r.대상수 >= 0);
  for (const g of r.걸림) {
    assert.ok(g.토픽 && g.조각.length, '걸림에 토픽·조각이 없으면 읽는 사람이 판정할 재료가 없다');
    for (const 조각 of g.조각) assert.ok(조각.글.trim().length > 0, '빈 조각을 인용하면 경보가 뜻을 잃는다');
  }
});

test('실저장소 — 「재질의 금지」가 대기열 전건에 걸리지는 않는다 (걸리면 그건 필터가 아니라 상수다)', (t) => {
  const 전체 = 큐.항목들();
  if (전체 === null) return t.skip('대기열 파일을 못 읽었다');
  const r = 큐.확정재료(전체);
  if (!r.측정) return t.skip(`메모리를 못 읽었다 — ${r.사유}`);
  if (r.대상수 < 3) return t.skip(`⏳유호 ${r.대상수}건 — 분모가 얕아 이 대조는 뜻이 없다`);
  const 걸린줄 = new Set(r.걸림.map((g) => g.씨앗));
  assert.notStrictEqual(걸린줄.size, r.대상수,
    `⏳유호 전건(${r.대상수})이 걸렸다 — 「재질의 금지」가 신호가 아니라 배경이 됐다는 뜻이다`);
});
