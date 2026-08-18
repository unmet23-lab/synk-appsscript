/* 표식 정본 회귀 — 트랙 번호를 읽는 곳이 **하나**인지, 그 하나가 F100 이후를 보는지 (F203)
 *
 * 실사고 2026-08-07: `board-guard`(④ 자리 겹침)와 `track-collision`(표식 겹침)이 같은 판정을
 *   각자 `F0`+두자리로 적고 있었다. 장부는 그때 이미 F203 이라 **104개 번호가 두 가드 모두에서
 *   통째로 안 보였다.** 두 세션이 같은 `F123` 을 나란히 선언했는데 가드는 내내 조용했고,
 *   한참 뒤 사람 눈에 띄어서야 한쪽이 비켜났다 — 새는 방향은 언제나 「통과」다.
 *
 * 🔴 회귀도 같이 눈이 멀어 있었다. 두 스위트의 픽스처가 전부 F050·F065·F070·F094 —
 *   **옛 정규식이 이미 아는 번호**만 골라 써서 초록이 구멍을 덮었다. 그래서 여기는 번호대를
 *   섞어 재고, 소비자 쪽(board-guard ④ · track-collision 표식)도 각자 번호대를 돈다.
 *
 * 여기서 보는 것 ①정본의 판정 ②`/g` lastIndex 함정 ③옛 통로 금지.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
/* 주석 제거는 통로가 하나다 — 지역 사본은 저마다 다르게 틀린다(F401·#Q114). */
const { 코드만 } = require('./lib/소스검사.js');

const 표식 = require(path.join(__dirname, '..', '.claude', 'hooks', 'lib', '표식.js'));

// ── ① 정본의 판정 ────────────────────────────────────────────────────
test('머리 — 장부 번호를 번호대와 무관하게 읽는다 (F0NN 에서 멈춰 있던 자리)', () => {
  for (const n of ['F001', 'F094', 'F100', 'F123', 'F203', 'F999']) {
    assert.strictEqual(표식.머리(`**${n} — 트랙 제목**(설명)`), n, `${n} 를 표식으로 못 읽었다`);
  }
});

test('머리 — 절단 항목·배포 버전도 같은 자리에서 읽는다', () => {
  assert.strictEqual(표식.머리('**②-20 `/tasks` 가 스냅샷을 돌려준다**'), '②-20');
  assert.strictEqual(표식.머리('**[v9.186] 동의문 마이그레이션**'), '[v9.186]');
});

test('머리 — 장식(굵게·상태 이모지·백틱)은 표식이 아니다', () => {
  for (const 앞 of ['**', '🔵**', '✅ ', '`', '> _', '⏸**']) {
    assert.strictEqual(표식.머리(`${앞}F203 — 트랙`), 'F203', `장식 「${앞}」 뒤의 표식을 놓쳤다`);
  }
});

test('🔴 머리 — 본문에서의 **인용**은 선점이 아니다 (남을 언급만 해도 막히면 가드가 곧 꺼진다)', () => {
  assert.strictEqual(표식.머리('**보드 선언 겹침을 아무도 안 막는다**(지금 `F203` 을 두 세션이 판다)'), null);
  assert.strictEqual(표식.머리(''), null);
  assert.strictEqual(표식.머리(null), null);
  assert.strictEqual(표식.머리('그냥 트랙 제목 — 번호 없음'), null);
});

test('훑기 — 문장 어디서나 표식을 모은다 (커밋 제목 대조)', () => {
  assert.deepStrictEqual(표식.훑기('feat: 두 자리 한 번에 (F094·F203) [v9.186]'), ['F094', 'F203', '[v9.186]']);
  assert.deepStrictEqual(표식.훑기('docs: 번호 없는 커밋'), []);
  assert.deepStrictEqual(표식.훑기(undefined), []);
});

test('🔴 훑기 — 경계를 지킨다 (`#F203AB` 같은 조각을 장부 번호로 세지 않는다)', () => {
  assert.deepStrictEqual(표식.훑기('색 #F203AB 와 SF203 과 F2034'), [],
    '경계를 안 보면 색 코드·긴 토큰이 트랙 표식이 돼 거짓 신호가 난다 — 거짓양성이 곧 무시로 이어진다');
});

test('🔴 정규식을 내보내지 않는다 — 공유된 `/g` 는 `lastIndex` 를 들고 다닌다', () => {
  /* 호출부가 `RE.test(a)` 를 두 번 부르면 두 번째가 조용히 false 다 — 새는 방향이 「통과」라
   * 값만 내보낸다. 이 검사는 **모양**을 못박는다(값은 잘못 쓸 수가 없다). */
  for (const [이름, 값] of Object.entries(표식)) {
    assert.ok(!(값 instanceof RegExp), `\`${이름}\` 가 정규식이다 — 호출부가 상태를 공유하게 된다`);
  }
  const 문장 = 'fix: 같은 자리 (F203)';
  assert.deepStrictEqual(표식.훑기(문장), 표식.훑기(문장), '두 번 불렀더니 답이 달라졌다');
});

// ── ③ 옛 통로 금지 ───────────────────────────────────────────────────
/** 주석·머리말의 인용은 뺀다 — 검사가 자기 설명을 신고하면 안 된다(표칸 회귀와 같은 규칙). */
const 코드줄 = (src) => 코드만(src).split('\n');
const 옛패턴 = /F0(\\d|\[0-9\])/; // 소스에 그대로 적힌 `F0\d{2}` · `F0[0-9]{2}`

function js파일들(dir, 모음 = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.git')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) js파일들(p, 모음);
    else if (e.name.endsWith('.js')) 모음.push(p);
  }
  return 모음;
}

test('🔴 옛 통로 금지 — 트랙 번호를 각자 적는 자리가 다시 생기지 않는다', () => {
  const ROOT = path.join(__dirname, '..');
  const 대상 = [...js파일들(path.join(ROOT, '.claude', 'hooks')), ...js파일들(path.join(ROOT, 'tools'))];
  assert.ok(대상.length > 20, `훑은 파일이 ${대상.length}개뿐이다 — 0건과 미실행이 같은 모양이면 안 된다`);
  const 위반 = 대상.filter((p) => 코드줄(fs.readFileSync(p, 'utf8')).some((l) => 옛패턴.test(l)))
    .map((p) => path.relative(ROOT, p));
  assert.deepStrictEqual(위반, [],
    '장부 번호를 `F0`+두자리로 다시 적었다 — 그러면 F100 이후가 통째로 안 보이고 증상은 조용한 통과다. 정본 = `.claude/hooks/lib/표식.js`');
});
