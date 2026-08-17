/**
 * 검수 «처분» 회귀 — 종결 레버가 셋으로 갈린 뒤의 불변식 (2026-08-17 · 유호 픽 「1,2,3 한벌로」)
 *
 * 왜 있나:
 *   옛 판은 종결 레버가 `--기각` 하나뿐이라 「지적이 옳았고 고쳤다」도 그 통에 들어갔다. 장부에
 *   실제로 그렇게 적혀 있다 — *"지적이 옳았다 — 그리고 고쳤다(기각은 이 도구의 유일한 종결 레버라
 *   여기 적는다)"*. 그래서 두 가지가 함께 샜다:
 *     ① 계측이 거짓말한다 — 기각률을 오판율로 읽으면 실제보다 나쁘다.
 *     ② 수리 불완전이 조용해진다 — 기각은 **영구 필터**라, 고쳤다고 적는 순간 다시는 안 올라온다.
 *   이 파일이 못 박는 것은 「`기각`만 걸러진다」와 「옛 행은 기각으로 읽는다」 둘이다.
 *
 * 그리고 플래그 충돌 — **짓다가 실제로 밟은 자리다.**
 *   처음에 `--범위밖` 으로 지었는데 그건 이미 `범위밖탈출` 이었다. 값플래그는 뒤 토큰을 «값»으로
 *   건너뛰므로, 겹치면 `--범위밖 --버그만` 의 `--버그만` 이 **조용히 삼켜진다**. 안 도는 게 아니라
 *   「맞는 얼굴로 틀린 값」이라 더 위험하다(신뢰성 ④).
 *
 * ⚠ 탐지력은 **픽스처가 진다** — 실제 상수로 「충돌 0」만 단언하면 검사기가 죽어도 초록이다.
 *   그래서 같은 충돌 검출기에 일부러 겹친 목록을 먹여 ≥1 건을 잡는지도 함께 단언한다.
 */

const test = require('node:test');
const assert = require('node:assert');
const os = require('node:os');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const R = require('../tools/codex-review.js');
const 도구 = path.join(__dirname, '..', 'tools', 'codex-review.js');

/* ── 충돌 검출기 — 실제 상수와 픽스처 둘 다 이 하나를 탄다(두 곳에 적으면 갈라진다) */
function 충돌찾기(값플래그, 나머지목록들) {
  const 충돌 = [];
  for (const f of 값플래그) {
    for (const { 이름, 목록 } of 나머지목록들) {
      if (목록.includes(f)) 충돌.push(`${f} ← 값플래그 ∩ ${이름}`);
    }
  }
  const 본것 = new Set();
  for (const f of 값플래그) { if (본것.has(f)) 충돌.push(`${f} ← 값플래그 자체 중복`); 본것.add(f); }
  return 충돌;
}

test('플래그 충돌 — 값플래그가 홑플래그·단독 상수와 겹치지 않는다', () => {
  const 충돌 = 충돌찾기(R.값플래그, [
    { 이름: '홑플래그', 목록: R.홑플래그 },
    { 이름: '범위밖탈출', 목록: [R.범위밖탈출] },
  ]);
  assert.deepStrictEqual(충돌, [], `플래그가 겹치면 뒤 토큰이 조용히 삼켜진다:\n${충돌.join('\n')}`);
});

test('충돌 검출기 자신의 탐지력 — 일부러 겹치면 잡는다(픽스처)', () => {
  const 충돌 = 충돌찾기(['--사유', '--범위밖'], [{ 이름: '홑플래그(가짜)', 목록: ['--범위밖', '--버그만'] }]);
  assert.ok(충돌.length >= 1, '겹친 목록을 먹였는데 0건이면 검출기가 죽은 것이다');
  assert.ok(충돌.some((c) => c.includes('--범위밖')), '겹친 그 플래그를 이름으로 대야 한다');
});

test('처분 레버 셋이 모두 값플래그에 등록돼 있다', () => {
  for (const L of R.처분레버들) {
    assert.ok(R.값플래그.includes(L.플래그), `${L.플래그} 가 값플래그에 없다 — 키를 인자로 못 읽는다`);
  }
});

test('걸러지는키들 — «기각»만 거른다', () => {
  const 장부 = [
    { 키: 'aaa', 처분: '기각' },
    { 키: 'bbb', 처분: '채택수리' },
    { 키: 'ccc', 처분: '대상아님' },
    { 키: 'ddd' },                       // 옛 행 — 필드 없음
  ];
  const 걸림 = R.걸러지는키들(장부);
  assert.ok(걸림.has('aaa'), '기각은 걸러져야 한다');
  assert.ok(!걸림.has('bbb'), '채택수리를 거르면 «수리가 덜 됐다»는 신호가 죽는다');
  assert.ok(!걸림.has('ccc'), '대상아님을 거르면 범위가 바뀌어도 다시 안 올라온다');
  assert.ok(걸림.has('ddd'), '처분 필드가 없는 옛 행은 기각으로 읽어야 한다(하위호환)');
  assert.strictEqual(걸림.size, 2);
});

test('처분of — 옛 행은 기각, 새 행은 적힌 그대로', () => {
  assert.strictEqual(R.처분of({ 키: 'x' }), '기각');
  assert.strictEqual(R.처분of({ 키: 'x', 처분: '채택수리' }), '채택수리');
  assert.strictEqual(R.처분of(null), '기각');
});

test('이전처분줄들 — 안 걸러지는 처분이 재등장하면 보여준다', () => {
  const 지적 = [{ 키: 'bbb', 등급: 'P1', 제목: '무언가 깨짐' }, { 키: 'zzz', 등급: 'P3', 제목: '새 지적' }];
  const 장부 = [
    { 키: 'bbb', 처분: '채택수리', 사유: '고쳤다', 시각: '2026-08-17T00:00:00.000Z' },
    { 키: 'aaa', 처분: '기각', 사유: '오판' },
  ];
  const 줄 = R.이전처분줄들(지적, 장부);
  assert.strictEqual(줄.length, 1, '재등장한 채택수리 하나만 나와야 한다');
  assert.ok(줄[0].includes('채택수리'), '어떤 처분이었는지 말해야 한다');
  assert.ok(줄[0].includes('고쳤다'), '그때의 사유를 나란히 보여야 판단이 선다');
  assert.ok(!줄[0].includes('새 지적'), '처음 보는 지적은 이 목록이 아니다');
});

test('CLI 왕복 — 세 레버가 장부에 «처분»을 박는다(픽스처 장부)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-처분-'));
  const 기각p = path.join(방, '기각.jsonl');
  const 기록p = path.join(방, '기록.jsonl');
  fs.writeFileSync(기록p, '', 'utf8');

  for (const L of R.처분레버들) {
    const r = spawnSync(process.execPath, [도구, L.플래그, `키-${L.처분}`, '--사유', `${L.처분} 사유`], {
      env: { ...process.env, SYNK_REVIEW_REJECTS: 기각p, SYNK_REVIEW_LEDGER: 기록p },
      encoding: 'utf8',
    });
    assert.strictEqual(r.status, 0, `${L.플래그} 가 실패했다: ${r.stderr}`);
  }

  const 행들 = fs.readFileSync(기각p, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.strictEqual(행들.length, R.처분레버들.length, '레버마다 한 행씩 남아야 한다');
  for (const L of R.처분레버들) {
    const 행 = 행들.find((x) => x.키 === `키-${L.처분}`);
    assert.ok(행, `${L.처분} 행이 없다`);
    assert.strictEqual(행.처분, L.처분, '처분 필드가 레버와 같아야 한다');
  }
  // 그리고 그 장부를 필터에 먹이면 «기각»만 걸린다 — 왕복이 실제로 이어지는지가 이 줄의 값이다
  const 걸림 = R.걸러지는키들(행들);
  assert.deepStrictEqual([...걸림], ['키-기각']);
});

test('사유 없는 처분은 받지 않는다 — 세 레버 모두', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-처분2-'));
  for (const L of R.처분레버들) {
    const r = spawnSync(process.execPath, [도구, L.플래그, '어떤키'], {
      env: { ...process.env, SYNK_REVIEW_REJECTS: path.join(방, 'r.jsonl'), SYNK_REVIEW_LEDGER: path.join(방, 'l.jsonl') },
      encoding: 'utf8',
    });
    assert.strictEqual(r.status, 2, `${L.플래그}: 사유 없이 통과하면 왜 그렇게 처분했는지 다음 회차가 못 읽는다`);
  }
});
