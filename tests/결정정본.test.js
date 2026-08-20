/* 결정 정본 — 확정이 세션 경계를 넘고, 금지는 14일에 풀린다 (신설 2026-08-19 · 유호 확정)
 *
 * 무엇이 났나: 확정과 기각이 **정반대 자리**에 살았다 — 기각은 git 안 문서라 영구(🚫 1,289 ·
 *   재제안 금지 131 · 만료 장치 0), 확정은 git 밖 메모리라 휘발(클라우드 세션에서 0건).
 *   그래서 시스템이 「아니오」만 기억했다. `tools/결정.js` 가 그 비대칭을 뒤집는다.
 *
 * 🔑 **새는 방향은 「영원히 안 풀린다」다.** 성격을 못 알아본 줄을 「안전(영구)」으로 세면
 *   그게 정확히 이 도구가 고치려는 병이 되고, 게다가 **안 보인다**(맞는 얼굴로 틀린 값 · 맹점 ④).
 *   그래서 ③ 이 「모름 → 확정(만료됨)」을 못박는다. 반대로 틀리면 유호님이 다시 말하면 되는,
 *   보이는 사고다.
 *
 * ⚠ 탐지력은 **픽스처**가 진다(F296·맹점②) — 이 파일은 repo 밖(홈·메모리)도 시각도 안 읽는다.
 *   `읽기문(본문, 기준)` 이 순수 함수라 「오늘」을 얼려 14일 경계를 시각 의존 없이 못박는다.
 *   실저장소 갈래(⑧)는 **건수를 안 박는다** — 그 수는 그날 유호님이 정한 것에 달렸다.
 *   대신 불변식만 본다(정본이 파싱되고, 깨진 줄이 0이다).
 */
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const 결정 = require(path.join(REPO, 'tools', '결정.js'));
const { 읽기문, 구속일, 시작표식, 끝표식, 성격들, 기본성격, 아는플래그, 정본 } = 결정;

/** 픽스처 — 표식·머리줄·구분선을 갖춘 최소 정본 */
const 본문 = (...줄들) => [
  '# 아무 머리말',
  시작표식,
  '',
  '| 날짜 | 성격 | 결정 | 근거 |',
  '|---|---|---|---|',
  ...줄들,
  '',
  끝표식,
  '# 아무 꼬리말',
].join('\n');

const 줄 = (날짜, 성격, 결정문 = '어떤 결정', 근거 = '어떤 근거') => `| ${날짜} | ${성격} | ${결정문} | ${근거} |`;

/* ── ① 14일 경계 — 구속일째는 아직 구속, 그 다음날 풀린다 ──────────────────── */

test('① 구속일(14)째는 아직 구속 중이다', () => {
  const r = 읽기문(본문(줄('2026-08-01', '확정')), '2026-08-15');   // D+14
  assert.equal(r.목록.length, 1);
  assert.equal(r.목록[0].지난일, 구속일);
  assert.equal(r.목록[0].구속중, true, `D+${구속일} 는 아직 구속이어야 한다 — 경계를 하루 당기면 「방금 정한 걸 뒤집자」가 된다`);
});

test('① 구속일+1 부터 재제안이 열린다', () => {
  const r = 읽기문(본문(줄('2026-08-01', '확정')), '2026-08-16');   // D+15
  assert.equal(r.목록[0].지난일, 구속일 + 1);
  assert.equal(r.목록[0].구속중, false);
});

test('① 오늘 정한 것(D+0)은 구속 중이다', () => {
  const r = 읽기문(본문(줄('2026-08-19', '확정')), '2026-08-19');
  assert.equal(r.목록[0].지난일, 0);
  assert.equal(r.목록[0].구속중, true);
});

/* ── ② 안전은 영구 — 아무리 지나도 안 풀린다 ─────────────────────────────── */

test('② 성격 «안전» 은 10년이 지나도 구속 중이다', () => {
  const r = 읽기문(본문(줄('2016-01-01', '안전', '자격증명은 git 밖에')), '2026-08-19');
  assert.equal(r.목록[0].영구, true);
  assert.equal(r.목록[0].구속중, true, '안전 결정에 만료가 붙으면 되돌림 비용이 큰 자리가 조용히 열린다');
});

/* ── ③ 🔑 모름은 «확정»(만료됨)으로 센다 — 영구 구속으로 세지 않는다 ────────── */

test('③ 성격을 못 알아본 줄은 «확정»으로 세고, 그 사실을 드러낸다', () => {
  const r = 읽기문(본문(줄('2026-08-01', '취향', '옛 낱말로 적힌 줄')), '2026-08-19');   // D+18
  const d = r.목록[0];
  assert.equal(d.성격, 기본성격, '모름을 안전으로 승격하면 이 도구가 고치려는 병 그 자체가 된다');
  assert.equal(d.영구, false);
  assert.equal(d.구속중, false, 'D+18 이면 풀려 있어야 한다');
  assert.equal(d.미지성격, true, '모름은 조용히 삼키지 않고 표로 드러낸다 — 화면이 그 건수를 낸다');
});

test('③-b 빈 성격 칸도 같은 길로 간다 (영구가 아니다)', () => {
  const r = 읽기문(본문(줄('2020-01-01', '', '성격이 빈 줄')), '2026-08-19');
  assert.equal(r.목록[0].영구, false);
  assert.equal(r.목록[0].구속중, false);
});

/* ── ④ 못 읽은 줄을 조용히 버리지 않는다 (분모 · F207) ────────────────────── */

test('④ 날짜가 깨진 줄은 목록에서 빠지되 «깨짐»으로 셈에 남는다', () => {
  const r = 읽기문(본문(
    줄('2026-08-19', '확정', '멀쩡한 줄'),
    줄('08-19', '확정', '날짜가 깨진 줄'),
    줄('작년쯤', '안전', '날짜가 말로 적힌 줄'),
  ), '2026-08-19');
  assert.equal(r.목록.length, 1);
  assert.equal(r.깨짐.length, 2, '조용히 빠지면 「없다」와 「못 읽었다」가 같은 모양이 된다');
});

test('④-b 머리줄·구분선은 결정으로도 깨짐으로도 안 센다', () => {
  const r = 읽기문(본문(), '2026-08-19');
  assert.equal(r.목록.length, 0);
  assert.equal(r.깨짐.length, 0);
});

/* ── ⑤ 「파일 없음」·「표식 없음」·「0건」은 세 칸이다 (미실행 ≠ 통과) ────────── */

test('⑤ 본문이 없으면 «못읽음» 이다 — 0건이 아니다', () => {
  const r = 읽기문(null, '2026-08-19');
  assert.equal(r.못읽음, true);
  assert.equal(r.표없음, undefined);
  assert.equal(r.목록.length, 0);
});

test('⑤-b 표식이 지워졌으면 «표없음» 이다 — 0건이 아니다', () => {
  const r = 읽기문('# 표식을 손으로 지운 문서\n| 2026-08-19 | 확정 | 어떤 결정 | 근거 |\n', '2026-08-19');
  assert.equal(r.표없음, true);
  assert.equal(r.못읽음, undefined);
  assert.equal(r.목록.length, 0, '표식 밖의 표를 주워 담으면 문서 아무 표나 결정으로 읽힌다');
});

/* ── ⑥ --추가 가 표를 안 깨뜨린다 ────────────────────────────────────────── */

test('⑥ 추가한 줄은 구분선 «뒤»에 들어가고 그대로 다시 읽힌다', () => {
  const 임시 = fs.mkdtempSync(path.join(require('node:os').tmpdir(), '결정-'));
  const 파일 = path.join(임시, '결정.md');
  try {
    fs.writeFileSync(파일, 본문(줄('2026-08-01', '확정', '기존 줄')), 'utf8');
    /* 도구의 쓰기 경로를 그대로 태운다 — 정본 경로는 모듈 로드 때 굳으므로 자식 프로세스로 판을 갈아끼운다. */
    const r = require('node:child_process').spawnSync(
      process.execPath,
      [path.join(REPO, 'tools', '결정.js'), '--추가', '새 결정 | 파이프가 든 문구', '--근거', '두 줄\n짜리 근거'],
      { env: { ...process.env, CLAUDE_PROJECT_DIR: 임시 }, encoding: 'utf8' },
    );
    /* 정본 경로는 <루트>/docs/_ops/결정.md 라 임시 루트에도 그 자리를 만들어 준다 */
    assert.ok(r.status === 1, '아직 docs/_ops 가 없으니 실패를 «말하고» 죽어야 한다 (조용한 성공 금지)');

    fs.mkdirSync(path.join(임시, 'docs', '_ops'), { recursive: true });
    fs.writeFileSync(path.join(임시, 'docs', '_ops', '결정.md'), 본문(줄('2026-08-01', '확정', '기존 줄')), 'utf8');
    const r2 = require('node:child_process').spawnSync(
      process.execPath,
      [path.join(REPO, 'tools', '결정.js'), '--추가', '새 결정 | 파이프가 든 문구', '--근거', '두 줄\n짜리 근거'],
      { env: { ...process.env, CLAUDE_PROJECT_DIR: 임시 }, encoding: 'utf8' },
    );
    assert.equal(r2.status, 0, r2.stderr);

    const 새문 = fs.readFileSync(path.join(임시, 'docs', '_ops', '결정.md'), 'utf8');
    const 읽힘 = 읽기문(새문, '2026-08-19');
    assert.equal(읽힘.깨짐.length, 0, '추가가 표를 깨뜨리면 안 된다');
    assert.equal(읽힘.목록.length, 2);
    const 새것 = 읽힘.목록.find((d) => d.결정.includes('새 결정'));
    assert.ok(새것, '추가한 줄이 다시 읽혀야 한다');
    assert.ok(!새것.결정.includes('|'), '파이프는 칸을 깨뜨리므로 접어야 한다');
    assert.ok(!새것.근거.includes('\n'), '개행은 한 줄 = 한 결정 계약을 깨뜨리므로 접어야 한다');
    assert.equal(새것.성격, 기본성격, '성격을 안 주면 확정(=만료됨)이다');
  } finally {
    fs.rmSync(임시, { recursive: true, force: true });
  }
});

/* ── ⑦ 자기 처방을 막지 않는다 (F103) ────────────────────────────────────── */

test('⑦ 차단문이 「아는 것」이라 부른 낱말은 전부 실제로 통과한다', () => {
  const { 모름 } = require(path.join(REPO, 'tools', 'lib', '인자게이트.js'));
  assert.ok(아는플래그.length > 0, '아는 낱말 목록이 비면 게이트가 모든 것을 막는다');
  assert.deepEqual(모름(아는플래그, 아는플래그), [], '따를 수 없는 처방은 우회를 정상 통로로 만든다');
});

test('⑦-b 모르는 낱말은 거절한다 — 조용히 삼키지 않는다', () => {
  const r = require('node:child_process').spawnSync(
    process.execPath, [path.join(REPO, 'tools', '결정.js'), '--없는낱말'], { encoding: 'utf8' },
  );
  assert.equal(r.status, 1);
  assert.match(r.stderr, /모르는 플래그/);
});

/* ── ⑧ 실저장소 — 거짓양성만 본다. 건수는 안 박는다 ──────────────────────── */

test('⑧ 실제 정본이 깨진 줄 없이 읽힌다 (건수는 그날 유호님이 정한 것에 달렸다)', () => {
  if (!fs.existsSync(정본)) {
    /* 픽스처가 탐지를 지므로 여기서 fail 하지 않는다 — 다만 침묵도 아니다(F296: 실패가 아니라 skip). */
    console.log('    ↳ skip: 정본이 이 판에 없다 —', 정본);
    return;
  }
  const r = 읽기문(fs.readFileSync(정본, 'utf8'));
  assert.ok(!r.못읽음 && !r.표없음, '정본에 «결정표 시작/끝» 표식이 살아 있어야 한다');
  assert.equal(r.깨짐.length, 0, `정본에 못 읽는 줄이 있다 — 날짜는 YYYY-MM-DD 여야 한다:\n${r.깨짐.join('\n')}`);
  assert.ok(r.목록.length > 0, '정본이 통째로 비면 이 장치는 안 도는 것과 같다');
  for (const d of r.목록) {
    assert.ok(성격들.includes(d.성격원), `정본의 성격 칸은 «${성격들.join('·')}» 중 하나여야 한다: ${d.성격원} (${d.날짜})`);
    assert.ok(d.결정.trim().length > 0, `결정 칸이 빈 줄이 있다: ${d.날짜}`);
  }
});

/* ── ⑩ 백틱 «안»의 파이프는 칸막이가 아니다 ──────────────────────────────────
 * 🔴 실제로 밟았다 (2026-08-19): 이 도구의 첫 판이 `줄.split('|')` 로 갈랐고,
 *   `tests/표칸.test.js` 가 그 자리를 잡았다. 이 정본은 백틱 인용이 빽빽해서
 *   (`안전`·`node tools/결정.js --추가`·`clasp push`) 정확히 그 함정 위에 산다.
 *   새는 방향은 오류가 아니라 **한 칸 밀린 정상 얼굴**이다 — 성격 칸에 결정문이 들어와도
 *   「모름 → 확정」 갈래로 조용히 흡수돼 아무도 모른다. 그래서 값으로 못박는다.
 */

test('⑩ 백틱 안에 파이프가 있어도 칸이 안 밀린다', () => {
  const r = 읽기문(본문('| 2026-08-19 | 안전 | 배포는 `clasp push | clasp pull` 둘 다 차단 | 근거줄 |'), '2026-08-19');
  assert.equal(r.깨짐.length, 0);
  assert.equal(r.목록.length, 1);
  assert.equal(r.목록[0].성격, '안전', '칸이 밀리면 성격 자리에 결정문이 와서 «모름→확정»으로 조용히 흡수된다');
  assert.equal(r.목록[0].영구, true, '밀린 칸의 대가는 «안전 결정이 14일 뒤 풀린다» 다');
  assert.equal(r.목록[0].근거, '근거줄');
});

test('⑩-b 담는 쪽도 같은 통로다 — 날 파이프는 접히고 백틱 안은 남는다', () => {
  const { 칸안전 } = require(path.join(REPO, 'tools', 'lib', '표.js'));
  assert.ok(!칸안전('밖 | 파이프').includes('|'), '칸 밖의 날 파이프는 표를 깨뜨리므로 접어야 한다');
  assert.ok(칸안전('`안 | 파이프`').includes('|'), '백틱 안은 내용이라 그대로 둔다 — 가르는 쪽과 짝이 맞아야 한다');
});

/* ── ⑨ 상수는 한 곳에서만 파생한다 ───────────────────────────────────────── */

test('⑨ 구속 기간은 도구 하나에서만 나온다 — 정본 문서가 다른 수를 적으면 갈라진다', () => {
  if (!fs.existsSync(정본)) { console.log('    ↳ skip: 정본 없음'); return; }
  const 문 = fs.readFileSync(정본, 'utf8');
  const 머리 = 문.slice(0, 문.indexOf(시작표식));   // 표 «밖»의 산문만 본다
  const 다른수 = [...머리.matchAll(/(\d+)\s*일\s*(?:뒤|간|안|내)/g)].map((m) => +m[1]);
  for (const n of 다른수) {
    assert.equal(n, 구속일, `정본 산문이 ${n}일이라 적었는데 도구는 ${구속일}일이다 — 같은 판정을 두 곳에 적으면 갈라진다`);
  }
});
