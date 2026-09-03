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

/* ══ 게이트 축 (2026-08-17 · 유호 픽 ㉣ · F588) ═══════════════════════════════════════════
 *
 * 왜 이 절이 있나: 위 절들은 **필터 축**(`걸러지는키들`)만 단언했다. 그런데 같은 집합을
 * `게이트판정()` 이 「이 지적이 처분됐나」로도 써서, `걸러냄:false` 인 레버가 곧 «게이트를
 * 영구히 못 연다»가 됐다 — 사람이 사유까지 달아 처분해도 배포가 안 나갔다(F588 실측 4건).
 *
 * ⚠ 이 절은 **「대상아님 → block」 같은 값을 못 박지 않는다.** 그건 「버그가 아직 있을 것을
 *   요구하는 회귀」(가드 맹점 ②)라 픽을 막는 쪽으로 일한다. 못 박는 것은 **선언과 실제의 정합**이다 —
 *   `처분레버들[].게이트해소` 가 곧 계약이고, 검사는 구현이 그 계약대로 도는지만 본다.
 *   그래서 나중에 픽이 바뀌면 **선언 한 칸**을 고치면 되고, 구현이 몰래 갈리면 여기서 깨진다. */

const 게이트해소값들 = new Set(['항상', '없음', '지문']);

test('선언 — 레버마다 두 축이 «따로» 적혀 있다(게이트 축을 걸러냄에서 추론하지 않는다)', () => {
  for (const L of R.처분레버들) {
    assert.strictEqual(typeof L.걸러냄, 'boolean', `${L.처분}: 필터 축 선언이 없다`);
    assert.ok(게이트해소값들.has(L.게이트해소), `${L.처분}: 게이트 축 선언이 없거나 모르는 값이다 (${L.게이트해소})`);
  }
  /* 🔑 두 축이 **서로에게서 파생되지 않는다**는 증거는 「같은 `걸러냄` 인데 게이트 동작이 다른
   *   레버가 있다」다(지금은 채택수리 '없음' vs 대상아님 '지문' — 둘 다 걸러냄:false).
   *   ⚠ 이 단언의 첫 초안은 「두 축의 값이 서로 다르다」였고 **내 픽스처가 그걸 잡아냈다** —
   *   boolean 투영은 세 레버 전부 우연히 일치한다(걸러냄 === (게이트해소==='항상')). 즉 값이
   *   같은 것은 결함이 아니고, 결함은 «한 필드에서 다른 필드를 계산할 수 있게 되는 것»이다. */
  const 짝 = new Map();
  for (const L of R.처분레버들) {
    const k = String(L.걸러냄);
    if (!짝.has(k)) 짝.set(k, new Set());
    짝.get(k).add(L.게이트해소);
  }
  assert.ok([...짝.values()].some((s) => s.size > 1),
    '같은 걸러냄에서 게이트해소가 갈리는 레버가 하나도 없다 — 그러면 게이트 축을 필터 축에서 계산할 수 있고, 그게 F588 의 모양이다');
});

test('게이트해소키들 — 레버별 동작이 «선언»과 같다 (픽스처 장부)', () => {
  const 집합 = ['Code.js', '엔진_두뇌.js'];          // 배포집합 픽스처
  const 밖 = { 키: 'k', 파일: 'tools/보드.js', 제목: 'x' };  // 과녁이 배포집합 밖
  const fp = 'FP1';
  const 원본찾기 = () => 밖;

  const 판 = (행) => R.게이트해소키들([행], '(루트)', fp, 집합, 원본찾기).has(행.키);

  assert.ok(판({ 키: 'k', 처분: '기각' }), '기각(항상)은 해소여야 한다');
  assert.ok(!판({ 키: 'k', 처분: '채택수리' }), '채택수리(없음)는 해소가 아니다 — 고쳤으면 지문이 바뀌어 다시 묻는다');
  assert.ok(판({ 키: 'k', 처분: '대상아님', 지문: { '(루트)': fp } }), '대상아님 + 같은 지문 + 과녁 밖 = 해소');
  assert.ok(!판({ 키: 'k', 처분: '대상아님', 지문: { '(루트)': '다른fp' } }), '다른 지문의 판정으로 이 배포를 열면 안 된다');
  assert.ok(!판({ 키: 'k', 처분: '대상아님' }), '지문이 안 찍힌 대상아님은 «어느 배포에 대한 판정인지 모름»이라 안 연다');
  assert.ok(판({ 키: 'k' }), '처분 필드 없는 옛 행은 기각으로 읽어 해소여야 한다(하위호환)');
  /* 🔑 **모르는 처분은 안 연다** — 변이 검사가 이 자리를 구멍으로 잡아냈다(폴백을 바꿔도 전부 초록).
   *   옛 행은 `처분of` 가 '기각' 으로 번역해 위 줄이 지므로, 이 폴백이 타는 것은 미래 레버·손편집·
   *   깨진 행뿐이다. 그때 열어 주면 모름이 통과가 된다(F207). */
  assert.ok(!판({ 키: 'k', 처분: '아직없는레버' }), '레버 표에 없는 처분이 게이트를 열면 안 된다');
});

test('탐지력 픽스처 — 과녁이 배포집합 «안»이면 대상아님으로도 안 열린다', () => {
  const 집합 = ['Code.js', '엔진_두뇌.js'];
  const fp = 'FP1';
  const 안것 = { 키: 'k', 파일: 'Code.js', 제목: '나갈 바이트의 결함' };
  const 열림 = R.게이트해소키들(
    [{ 키: 'k', 처분: '대상아님', 지문: { '(루트)': fp } }], '(루트)', fp, 집합, () => 안것,
  ).has('k');
  assert.ok(!열림, '「범위 밖」이라고 라벨만 붙여도 과녁이 배포집합 안이면 열리면 안 된다 — 새는 방향이 「통과」다');
});

test('과녁이배포집합밖 — 코드 지적은 경로로, 기능체크는 산문으로 가른다', () => {
  const 집합 = ['Code.js', '엔진_셋업확장.js'];
  assert.ok(R.과녁이배포집합밖({ 파일: 'tools/board-move.js' }, 집합), 'tools/ 는 루트 배포집합에 못 든다');
  assert.ok(!R.과녁이배포집합밖({ 파일: 'Code.js' }, 집합), '배포집합 안 파일은 «밖»이 아니다');

  // 기능체크 — 파일 칸이 없으니 근거·수정방향 산문에서 찾는다 (실측 08-17: 64건 중 22건이 지목했다)
  assert.ok(R.과녁이배포집합밖(
    { 파일: '(기능체크)', 제목: '기능 깨짐: 인쇄본 경로', 근거: 'tools/인쇄본빌드.js:34 의 OUT_DIR' }, 집합,
  ), '배포집합 파일을 한 번도 안 짚은 기능체크는 «밖»이다');
  assert.ok(!R.과녁이배포집합밖(
    { 파일: '(기능체크)', 제목: '기능 깨짐: 자동 인쇄', 근거: '엔진_셋업확장.js:2681 이 링크를 안 보낸다' }, 집합,
  ), '기능체크가 배포집합 파일을 지목하면 «밖»이라 하면 안 된다 — ㉠ 이 죽이려던 22건이 이 갈래다');
});

test('보수성 — 모르면 «밖»이라고 하지 않는다(모름이 통과가 되면 안 된다 · F207)', () => {
  assert.ok(!R.과녁이배포집합밖(null, ['Code.js']), '원본을 못 찾으면 판정 불가 = 안 연다');
  assert.ok(!R.과녁이배포집합밖({ 파일: 'tools/x.js' }, []), '배포집합을 못 읽었으면 안 연다');
  assert.ok(!R.과녁이배포집합밖({ 파일: '(모름)' }, ['Code.js']), '파일이 (모름)이면 안 연다');
});

test('왕복 — 실저장소 지문으로 게이트가 실제로 열린다/안 열린다', () => {
  let 점검; let fp; let 집합;
  try {
    점검 = require('../tools/배포판점검.js');
    fp = 점검.지문(path.join(__dirname, '..'), path.join(__dirname, '..'));
    집합 = 점검.배포집합(path.join(__dirname, '..'), path.join(__dirname, '..')) || [];
  } catch (e) {
    /* 환경 의존이라 fail 이 아니라 skip 으로 드러낸다 — 실저장소 검사는 픽스처의 탐지력을
     * 대신하지 않는다(CLAUDE.md: 탐지는 픽스처가 지고 실저장소는 거짓양성만 본다). */
    return void console.log(`  ↷ skip: 배포판점검을 못 읽었다 (${e.message})`);
  }
  if (!fp || !집합.length) return void console.log('  ↷ skip: 지문·배포집합이 비었다');
  const 안파일 = 집합.find((f) => /\.js$/.test(f));
  if (!안파일) return void console.log('  ↷ skip: 배포집합에 .js 가 없다');

  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-게이트-'));
  const 기록p = path.join(방, '기록.jsonl');
  const 기각p = path.join(방, '기각.jsonl');
  const 지적 = (파일) => ({ 등급: 'P1', 키: 'KEY1', 파일, 제목: 'x', 근거: 'y', 수정방향: 'z' });
  const 판 = () => R.게이트판정(path.join(__dirname, '..'), path.join(__dirname, '..'),
    { 기록경로: 기록p, 기각경로: 기각p });

  // ① 배포집합 «밖» 지적 → block, 그리고 대상아님(같은 지문)으로 열린다
  fs.writeFileSync(기록p, JSON.stringify({ 시각: 'T', 범위: ['(루트)'], 지문: { '(루트)': fp }, 지적: [지적('tools/board-move.js')] }) + '\n');
  fs.writeFileSync(기각p, '');
  assert.strictEqual(판().level, 'block', '미처분 P1 이면 막혀야 한다');
  fs.writeFileSync(기각p, JSON.stringify({ 키: 'KEY1', 처분: '대상아님', 사유: '배포집합 밖', 지문: { '(루트)': fp } }) + '\n');
  assert.strictEqual(판().level, 'ok', '참인데 범위 밖인 지적은 그 지문에서 열려야 한다 — 이게 유호 픽 ㉣ 이다');

  // ② 같은 처분인데 과녁이 배포집합 «안»이면 안 열린다
  fs.writeFileSync(기록p, JSON.stringify({ 시각: 'T', 범위: ['(루트)'], 지문: { '(루트)': fp }, 지적: [지적(안파일)] }) + '\n');
  assert.strictEqual(판().level, 'block', `과녁이 배포집합(${안파일}) 안이면 대상아님으로도 안 열려야 한다`);

  // ③ 지문이 다르면 안 열린다
  fs.writeFileSync(기록p, JSON.stringify({ 시각: 'T', 범위: ['(루트)'], 지문: { '(루트)': fp }, 지적: [지적('tools/board-move.js')] }) + '\n');
  fs.writeFileSync(기각p, JSON.stringify({ 키: 'KEY1', 처분: '대상아님', 사유: 'x', 지문: { '(루트)': '옛지문' } }) + '\n');
  assert.strictEqual(판().level, 'block', '다른 배포 내용에 대한 판정이 이 배포를 열면 안 된다');
});

/* ══ 무효 표식 축 (2026-09-03 · 체크포인트 방 열쇠 충돌의 뒤처리) ══════════════════════════
 *
 * 실사고: 방 열쇠에 «내용» 축이 없던 동안 한 세션의 기록행에 **옆 세션의 지적**이 박혔다.
 *   그 행이 주장하는 것은 «이 배포내용을 검수했다»인데 codex 는 그 바이트를 한 번도 안 봤다 —
 *   즉 행 자체가 도장으로서 거짓이다. 장부는 append-only 라 지울 수 없고, 지적을 `--기각` 하면
 *   **남의 진짜 지적이 재발 필터에서 영구히 사라진다.** 그래서 무효로 만드는 것은 지적이 아니라
 *   «행과 지문의 짝»이다.
 * ⚠ 새는 방향을 못 박는다 — 표식이 안 먹히면 그 행은 계속 게이트를 막고(사람이 본다), 표식이
 *   너무 먹으면 검수 안 한 배포가 열린다(아무도 안 본다). 그래서 ③④가 이 파일의 급소다. */
test('무효 표식이 붙은 기록행은 **도장으로 안 센다** — 그리고 그 사실을 화면에 말한다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-무효-'));
  const 기록p = path.join(방, '기록.jsonl');
  const 기각p = path.join(방, '기각.jsonl');
  fs.writeFileSync(기각p, '');
  const 판 = () => R.게이트판정(path.join(__dirname, '..'), path.join(__dirname, '..'),
    { 기록경로: 기록p, 기각경로: 기각p });
  const fp = 판().fp;   // 지금 이 트리의 배포 지문 — 행을 그 지문에 맞춰 심어야 게이트가 집는다
  const 행 = { 시각: 'T-오염', 범위: ['(루트)'], 지문: { '(루트)': fp },
    지적: [{ 등급: 'P1', 키: 'K영상', 파일: '영상/씨앗.js', 제목: 'x', 근거: 'y', 수정방향: 'z' }] };

  // ① 표식이 없으면 그 행이 게이트를 막는다(2026-09-03 에 실제로 일어난 그 모양 — 남의 지적으로 막혔다)
  fs.writeFileSync(기록p, JSON.stringify(행) + '\n');
  assert.strictEqual(판().level, 'block', '전제가 깨졌다 — 막지도 않는 행이면 이 시험은 아무것도 안 잰다');

  // ② 표식을 붙이면 도장에서 빠진다 → 이 지문엔 «유효한 기록이 없다»
  fs.appendFileSync(기록p, JSON.stringify({ 종류: '무효', 시각: 'T-표식', 무효행: 'T-오염', 사유: '방 열쇠 충돌' }) + '\n');
  const 뒤 = 판();
  assert.strictEqual(뒤.level, 'none', '무효 표식이 붙은 행이 여전히 도장으로 세어졌다');
  assert.ok(뒤.lines.join('\n').includes('무효 표식 1'),
    '「기록이 없다」와 「기록은 있는데 무효다」가 같은 얼굴이면 다음 사람이 장부를 열고 헤맨다(0은 분모와 함께)');

  // ③ 🔴 표식 행 자체는 **절대** 도장이 아니다 — 지문 칸이 없으니 원리상 안 걸려야 한다
  fs.writeFileSync(기록p, JSON.stringify({ 종류: '무효', 시각: 'T-표식', 무효행: 'T-없는행', 사유: 'x' }) + '\n');
  assert.strictEqual(판().level, 'none', '표식 행이 검수 기록으로 읽혔다 — 그러면 표식을 적을수록 게이트가 열린다');

  // ④ 짝을 못 찾는 표식은 **아무것도 안 지운다**(그 행이 아직 다른 워크트리에 있는 경우)
  fs.writeFileSync(기록p, JSON.stringify(행) + '\n'
    + JSON.stringify({ 종류: '무효', 시각: 'T-표식', 무효행: 'T-오타', 사유: '시각을 잘못 쳤다' }) + '\n');
  assert.strictEqual(판().level, 'block', '오타 난 표식이 엉뚱한 행을 열었다 — 새는 방향이 「통과」다');

  // ⑤ 지적은 손대지 않는다 — 그 7건은 «남의 진짜 지적»이라 키로 계속 찾을 수 있어야 한다
  fs.writeFileSync(기록p, JSON.stringify(행) + '\n'
    + JSON.stringify({ 종류: '무효', 시각: 'T-표식', 무효행: 'T-오염', 사유: '방 열쇠 충돌' }) + '\n');
  const 남은지적 = R.장부읽기(기록p, '').flatMap((r) => r.지적 || []).find((f) => f.키 === 'K영상');
  assert.ok(남은지적, '무효 표식이 지적까지 지웠다 — 그러면 --기각 과 다를 게 없고, 남의 진짜 지적이 사라진다');
});

test('--기록무효 레버 — 사유 없이는 안 받고, 적으면 장부에 표식 한 줄이 남는다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-무효레버-'));
  const 기록p = path.join(방, '기록.jsonl');
  fs.writeFileSync(기록p, JSON.stringify({ 시각: 'T-오염', 범위: ['(루트)'], 지문: { '(루트)': 'ffff0000' }, 지적: [] }) + '\n');
  const 부른다 = (인자) => spawnSync(process.execPath, [도구, ...인자], {
    env: { ...process.env, SYNK_REVIEW_LEDGER: 기록p, SYNK_REVIEW_REJECTS: path.join(방, 'r.jsonl') },
    encoding: 'utf8',
  });

  assert.strictEqual(부른다(['--기록무효', 'T-오염']).status, 2,
    '사유 없는 표식은 받지 않는다 — 왜 도장이 아닌지 못 읽으면 다음 사람이 되살릴 수도 없다');
  assert.strictEqual(부른다(['--기록무효', '--사유', '왜']).status, 2, '시각 없이 부르면 거절해야 한다');

  const r = 부른다(['--기록무효', 'T-오염', '--사유', '방 열쇠 충돌 — 지적이 옆 세션 것이다']);
  assert.strictEqual(r.status, 0, `표식을 못 적었다: ${r.stderr}`);
  const 행들 = fs.readFileSync(기록p, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.strictEqual(행들.length, 2, '장부는 append-only 다 — 원래 행이 사라지면 안 된다');
  assert.ok(행들[0].시각 === 'T-오염' && (행들[0].지적 || []).length === 0, '원래 행이 고쳐졌다');
  assert.deepStrictEqual(
    { 종류: 행들[1].종류, 무효행: 행들[1].무효행 }, { 종류: '무효', 무효행: 'T-오염' },
    '표식 행의 모양이 읽는 쪽(무효행들)과 갈렸다 — 갈리면 표식이 조용히 아무 일도 안 한다');
  assert.ok(R.무효행들(행들).has('T-오염'), '쓰는 쪽과 읽는 쪽이 같은 장부로 왕복하지 못한다');

  // 🔑 짝이 없는 시각도 **적는다**(다른 워크트리의 행일 수 있다) — 대신 화면이 크게 말한다
  const r2 = 부른다(['--기록무효', 'T-어디에도없음', '--사유', '다른 트리의 행이다']);
  assert.strictEqual(r2.status, 0, '짝이 없다고 거절하면 다른 워크트리의 행에는 표식을 못 남긴다');
  assert.ok(/없다/.test(r2.stderr), '짝을 못 찾았는데 조용히 넘어갔다 — 오타를 사람이 못 본다');
});

