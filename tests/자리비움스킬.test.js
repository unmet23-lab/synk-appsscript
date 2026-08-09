/**
 * /afk · /missed 결속 회귀 — 스킬이 **시키는 것이 실재하는가**.
 *
 * 왜 있나 (2026-08-09):
 *   ① `/missed` 는 실행 규약(정지선·벽 기록·커밋)을 **`/afk` 절 번호로 가리킨다.** 규약을 복사하면
 *      두 벌이 갈라지므로 참조가 옳은 설계지만, 참조는 **끊겨도 소리를 안 낸다** — 절 제목이 바뀌면
 *      `/missed` 는 정지선이 통째로 없는 스킬이 되고, 그 상태로 자리 비운 창에서 돈다.
 *   ② 유호님이 실제로 「`/afk 2시간` 하면 2시간 도는 거야?」라고 물었다. **안 돈다** — 턴은 도구 호출을
 *      멈추면 끝나고 반복은 `/loop` 이 만든다. 그 한 줄이 빠지면 두 스킬 다 「0분 도는 스킬」이 된다.
 *   ③ 스킬이 시키는 명령이 실재하지 않으면 그 자리에서 죽는다(CLAUDE.md 처방-실행층 결속 ·
 *      「따를 수 없는 처방은 우회를 정상 통로로 만든다」 F103).
 *
 * 탐지는 스킬 원문이 진다 — 픽스처를 따로 두지 않는다(검사 대상이 문서 그 자체다).
 */

const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const 스킬 = (name) =>
  fs.readFileSync(path.join(ROOT, '.claude', 'skills', name, 'SKILL.md'), 'utf8');

test('/missed 가 가리키는 /afk 절이 실재한다 (끊긴 참조 = 정지선 없는 스킬)', () => {
  const afk = 스킬('afk');
  const missed = 스킬('missed');

  /* 🔴 「참조가 하나라도 있으면 통과」로 재면 안 된다 — 변이 1차가 그렇게 샜다.
   *    /missed 안에는 §0(반복)·§3 같은 곁가지 참조가 여럿이라, **규약을 담은 주 참조**를 통째로
   *    지워도 곁가지가 남아 초록이 된다. 그 상태의 /missed 는 정지선·커밋·인계가 없는 채로
   *    자리 비운 창에서 돈다. 그래서 **상속해야 할 절을 이름으로 못박고 전부 덮였는지** 본다. */
  const 필수 = { 1: '비켜서기(🎫 는 남의 줄이라 겹침 확률이 더 높다)', 3: '정지선·벽 기록', 4: '커밋', 5: '인계' };
  const 절번호 = new Set([...missed.matchAll(/§(\d)/g)].map((m) => Number(m[1])));

  for (const [n, 뜻] of Object.entries(필수)) {
    assert.ok(절번호.has(Number(n)),
      `🔴 /missed 가 /afk §${n}(${뜻})을 더 이상 상속하지 않는다 — 규약이 통째로 빠진 채 자리 비운 창에서 돈다`);
  }

  for (const n of 절번호) {
    assert.match(afk, new RegExp(`^##\\s*(🔴\\s*)?${n}\\.`, 'm'),
      `🔴 /missed 가 /afk §${n} 을 가리키는데 그 절이 없다 — 참조가 끊겨도 소리를 안 내므로, /missed 는 그 규약이 통째로 빠진 채 자리 비운 창에서 돈다`);
  }
});

test('/missed 는 정지선을 **재서술하지 않는다** (두 벌이 되면 갈라진다)', () => {
  const missed = 스킬('missed');
  // ⛔ 는 /afk 정지선 목록의 표기다. /missed 에 그게 나타나면 목록을 복사해 온 것이다.
  assert.doesNotMatch(missed, /^⛔/m,
    '🔴 /missed 가 정지선 목록을 복사해 왔다 — 한쪽만 고쳐지면 자리 비운 창에서 도는 규약이 두 벌로 갈라진다(CLAUDE.md 신뢰성 ④)');
});

test('🔴 두 스킬 다 「스스로 반복하지 않는다」를 밝힌다 (없으면 0분 도는 스킬이다)', () => {
  for (const name of ['afk', 'missed']) {
    const s = 스킬(name);
    assert.match(s, /\/loop/,
      `🔴 ${name}: 반복 장치(/loop) 안내가 없다 — 턴은 도구 호출을 멈추면 끝나므로 예산만 받고 0분 돈다. 유호님이 실제로 이 오해를 했다(08-09)`);
    assert.match(s, new RegExp(`/loop\\s+/${name}`),
      `🔴 ${name}: 실제로 도는 형태(\`/loop /${name} <예산>\`)를 안 보여줬다 — 「/loop 을 쓰라」만으로는 유호님이 못 친다(비개발자 기준 클릭 단위)`);
  }
});

test('🔴 처방-실행층 결속 — /missed 가 시키는 도구가 전부 실재한다 (F103)', () => {
  const missed = 스킬('missed');
  const 명령 = [...missed.matchAll(/node\s+(tools\/[^\s`]+\.js)/g)].map((m) => m[1]);
  assert.ok(명령.length >= 5,
    `「놓친 것」의 출처가 ${명령.length}개뿐이다 — 정의가 좁아지면 회수 못 한 갈래가 조용히 남는다`);

  for (const rel of new Set(명령)) {
    assert.ok(fs.existsSync(path.join(ROOT, rel)),
      `🔴 /missed 가 없는 도구를 시킨다: ${rel} — 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103)`);
  }
});
