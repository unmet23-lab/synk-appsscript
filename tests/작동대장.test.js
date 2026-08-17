const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const 대장 = require(path.join(ROOT, 'tools', '작동대장.js'));

/* 작동 대장 (2026-08-17 유호님 「주마다 전체 시스템을 점검·재설계하려면 작동 원리를 완벽히 파악한
 * 장부가 필요하다」) — 이 테스트가 지키는 것 넷:
 *
 * ① **경로 이스케이프** — 실제로 잡은 버그다. `git log --name-only` 는 비ASCII 경로를
 *    `"tools/lib/\353\263\264\353\223\234.js"` 로 낸다(`core.quotepath` 기본값). 안 풀면
 *    **이 저장소의 거의 모든 파일**(한글 이름)이 조용히 「모름」이 되고, 그 위에 세워진 통이
 *    **거짓 초록**을 낸다. 실제로 v0 첫 판이 「⚪ 오래 안 봤다 = 0」을 그렇게 냈다.
 *    ⚠ 탐지력은 **픽스처**가 진다 — 실저장소는 `-c core.quotepath=false` 로 이미 안 깨지므로,
 *    실저장소만 검사하면 이 눈이 멀어도 초록이다(CLAUDE.md 가드 맹점 ②).
 *
 * ② **분류 경계** — 네 통이 겹치지도 새지도 않는가. 임계값(`깨짐기준`)이 바뀌면 여기서 걸린다.
 *
 * ③ **수렴** — F537 의 직접적인 기계 답. 이해대장은 두 번 돌리면 값이 달라져
 *    「다시 그려 담아라」가 **따를 수 없는 처방**이 됐다(F103 의 모양). 이 화면은 그러면 안 된다.
 *
 * ④ **조용한 0 금지** — 입력을 못 읽으면 「비었다」가 아니라 「모른다」로 쌓여야 한다(F207).
 */

/* ── ① 경로 이스케이프 — 픽스처가 탐지력을 진다 ────────────────────────── */

test('경로풀기 — git 이 8진 이스케이프한 한글 경로를 되돌린다', () => {
  assert.equal(대장.경로풀기('"tools/lib/\\353\\263\\264\\353\\223\\234.js"'), 'tools/lib/보드.js');
  assert.equal(대장.경로풀기('"docs/_ops/\\353\\263\\264\\353\\223\\234/7cdbd486.md"'), 'docs/_ops/보드/7cdbd486.md');
  assert.equal(대장.경로풀기('"tools/\\354\\236\\221\\353\\217\\231\\353\\214\\200\\354\\236\\245.js"'), 'tools/작동대장.js');
});

test('경로풀기 — 따옴표가 없는 ASCII 경로는 그대로 통과한다', () => {
  assert.equal(대장.경로풀기('tools/board.js'), 'tools/board.js');
  assert.equal(대장.경로풀기('.claude/hooks/board-guard.js'), '.claude/hooks/board-guard.js');
  assert.equal(대장.경로풀기(''), '');
});

test('경로풀기 — 8진이 아닌 이스케이프(\\n·\\"·\\\\)도 안 깨진다', () => {
  assert.equal(대장.경로풀기('"a\\"b.js"'), 'a"b.js');
  assert.equal(대장.경로풀기('"a\\\\b.js"'), 'a\\b.js');
});

test('🔴 이스케이프를 안 풀면 한글 파일이 통째로 사라진다 — 이 회귀가 지키는 것', () => {
  // 「안 푼 상태」를 재현해 **탐지력 자체**를 못박는다. 실저장소는 이미 안 깨지므로
  // 이 검사가 없으면 경로풀기를 통째로 지워도 초록이 뜬다.
  const 날것 = '"tools/lib/\\353\\263\\264\\353\\223\\234.js"';
  assert.notEqual(날것, 'tools/lib/보드.js', '전제: 날것은 참경로와 다르다');
  assert.equal(대장.경로풀기(날것), 'tools/lib/보드.js', '풀면 참경로가 된다');
});

/* ── ② 분류 경계 — 픽스처 ───────────────────────────────────────────────── */

const 오늘 = Date.parse('2026-08-17T00:00:00Z');

function 분류하기(장치들, { 회귀합본 = '', 참조 = {}, 마찰 = {} } = {}) {
  const 말 = { 회귀합본, 회귀개수: 1, 조각: [] };
  const 참조맵 = new Map(장치들.map((p) => [p, 참조[p] ?? 1]));
  const 언급 = new Map(Object.entries(마찰).map(([k, v]) => [k, new Set(v)]));
  const 손댐 = new Map(장치들.map((p) => [p, '2026-08-16']));
  return 대장.분류(장치들, 말, 참조맵, { 언급 }, 손댐, 오늘);
}

test('분류 — 아무도 안 부르면 ⚫ (다른 축보다 먼저 걸린다)', () => {
  const { 통 } = 분류하기(['tools/고아.js'], { 참조: { 'tools/고아.js': 0 } });
  assert.deepEqual(통.안불림.map((r) => r.경로), ['tools/고아.js']);
  assert.equal(통.깨짐.length + 통.맨몸.length + 통.괜찮음.length, 0);
});

test('분류 — 깨짐 임계값이 5 에 못박혀 있다 (판정이지 구현 세부가 아니다)', () => {
  // 🔴 아래 경계 시험은 `대장.깨짐기준` 을 **자기참조**해서, 상수가 바뀌면 시험도 같이 움직인다
  //    (변이 실측 08-17: 5→2 로 밀었는데 13건이 전부 초록이었다 — 구멍).
  //    임계값은 「어느 길이가 주간에 읽히나」라는 **판정**이라 사람이 다시 정해야 바뀐다.
  //    바꿀 때는 이 줄과 화면의 분포 근거를 같이 고친다.
  assert.equal(대장.깨짐기준, 5,
    '임계값을 바꿨으면 이 줄과 tools/작동대장.js 의 분포 근거 주석을 함께 고친다');
});

test(`분류 — 마찰 ${대장.깨짐기준}건이면 🟠, 하나 모자라면 아니다 (경계)`, () => {
  const F많음 = Array.from({ length: 대장.깨짐기준 }, (_, i) => `F${100 + i}`);
  const F적음 = F많음.slice(0, -1);
  const a = 분류하기(['tools/아픔.js'], { 회귀합본: '아픔', 마찰: { 'tools/아픔.js': F많음 } });
  assert.deepEqual(a.통.깨짐.map((r) => r.경로), ['tools/아픔.js'], `${대장.깨짐기준}건 = 🟠`);
  const b = 분류하기(['tools/아픔.js'], { 회귀합본: '아픔', 마찰: { 'tools/아픔.js': F적음 } });
  assert.equal(b.통.깨짐.length, 0, `${대장.깨짐기준 - 1}건 = 🟠 아님`);
  assert.deepEqual(b.통.괜찮음.map((r) => r.경로), ['tools/아픔.js']);
});

test('분류 — 부르는 데는 있는데 회귀가 없으면 🔴 맨몸', () => {
  const { 통 } = 분류하기(['tools/맨몸.js'], { 회귀합본: '', 참조: { 'tools/맨몸.js': 3 } });
  assert.deepEqual(통.맨몸.map((r) => r.경로), ['tools/맨몸.js']);
  assert.equal(통.맨몸[0].참조수, 3);
});

test('분류 — 네 통은 겹치지도 새지도 않는다 (합 = 전체)', () => {
  const 장치들 = ['tools/a.js', 'tools/b.js', 'tools/c.js', 'tools/d.js'];
  const { 통 } = 분류하기(장치들, {
    회귀합본: 'a b',
    참조: { 'tools/a.js': 2, 'tools/b.js': 0, 'tools/c.js': 4, 'tools/d.js': 1 },
    마찰: { 'tools/a.js': Array.from({ length: 대장.깨짐기준 + 3 }, (_, i) => `F${i}`) },
  });
  const 합 = 통.깨짐.length + 통.맨몸.length + 통.안불림.length + 통.괜찮음.length;
  assert.equal(합, 장치들.length, '합이 전체와 같다');
  const 모두 = [...통.깨짐, ...통.맨몸, ...통.안불림, ...통.괜찮음].map((r) => r.경로);
  assert.equal(new Set(모두).size, 장치들.length, '같은 장치가 두 통에 안 든다');
});

test('분류 — 마찰 건수 분포를 통째로 낸다 (임계값을 숨기지 않는다)', () => {
  const { 분포 } = 분류하기(['tools/a.js', 'tools/b.js'], { 회귀합본: 'a b', 마찰: { 'tools/a.js': ['F1', 'F2'] } });
  assert.equal(분포.get(2), 1);
  assert.equal(분포.get(0), 1);
});

/* ── ⑤ 기록 장부 — 그 주의 사진 (유호 지시 08-17 「기록용으로 쓰면 너무 좋겠다」) ──
 * 이 장부가 지는 것은 「지금」이 아니라 **「무엇이 어떻게 움직였나」**다. 그래서 지키는 것 셋:
 *   ㉠ **append-only** — 앞줄을 지우면 그 주의 사진이 영영 사라진다(다시 계산할 방법이 없다).
 *   ㉡ **못 읽은 판은 안 박는다** — 그걸 박으면 다음 주 「움직임」이 통째로 거짓이 된다.
 *   ㉢ **첫 기록 전과 「움직임 없음」을 가른다** — 둘이 같은 모양이면 0 이 거짓말한다(F207). */

function 사진(날짜, 통, { 깨짐 = [], 맨몸 = [], 안불림 = [], 장치 = 100, 마찰 = 200 } = {}) {
  return { 날짜, 장치, 회귀: 50, 마찰, 통, 깨짐, 맨몸, 안불림, 못읽음: 0 };
}

test('움직임 — 통을 «드나든» 파일을 가린다(개수만으로는 못 본다)', () => {
  const 지난 = 사진('2026-08-10', { 깨짐: 2, 맨몸: 1, 안불림: 1, 괜찮음: 96 },
    { 깨짐: [['a.js', 5], ['b.js', 7]], 맨몸: ['c.js'], 안불림: ['d.js'] });
  const 지금 = 사진('(지금)', { 깨짐: 2, 맨몸: 1, 안불림: 1, 괜찮음: 96 },
    { 깨짐: [['a.js', 5], ['e.js', 6]], 맨몸: ['f.js'], 안불림: ['d.js'] });
  const m = 대장.움직임(지금, 지난);
  assert.deepEqual(m.델타, { 깨짐: 0, 맨몸: 0, 안불림: 0, 괜찮음: 0, 장치: 0, 마찰: 0 },
    '개수는 그대로다 — 그래서 개수만 보면 「아무 일 없음」으로 읽힌다');
  assert.deepEqual(m.깨짐.들어옴, ['e.js']);
  assert.deepEqual(m.깨짐.빠짐, ['b.js']);
  assert.deepEqual(m.맨몸.들어옴, ['f.js']);
  assert.deepEqual(m.맨몸.빠짐, ['c.js']);
  assert.deepEqual(m.안불림.들어옴, []);
});

test('움직임 — 「또 아팠다」는 마찰 건수가 «오른» 것만 센다', () => {
  const 지난 = 사진('2026-08-10', { 깨짐: 2, 맨몸: 0, 안불림: 0, 괜찮음: 98 },
    { 깨짐: [['a.js', 5], ['b.js', 9]] });
  const 지금 = 사진('(지금)', { 깨짐: 2, 맨몸: 0, 안불림: 0, 괜찮음: 98 },
    { 깨짐: [['a.js', 7], ['b.js', 9]] });
  const m = 대장.움직임(지금, 지난);
  assert.deepEqual(m.마찰오름, [{ 경로: 'a.js', 전: 5, 후: 7 }], '안 오른 b.js 는 안 센다');
});

test('움직임 — 지난 사진이 없으면 «0» 이 아니라 null (첫 기록 전과 무변화를 가른다 · F207)', () => {
  assert.equal(대장.움직임(사진('(지금)', { 깨짐: 1, 맨몸: 0, 안불림: 0, 괜찮음: 9 }), null), null);
});

test('스냅샷 — 다시 계산할 필요 없는 모양으로 접힌다(목록까지 든다)', () => {
  const d = 대장.재기(오늘);
  const s = 대장.스냅샷(d, '2026-08-17');
  assert.equal(s.날짜, '2026-08-17');
  assert.equal(s.통.깨짐, d.통.깨짐.length);
  assert.equal(s.깨짐.length, d.통.깨짐.length);
  // 🔴 `typeof === 'number'` 만으로는 못 본다 — 건수를 통째로 0 으로 만들어도 통과한다
  //    (변이 실측 08-17: 구멍). **실제 값과 대조**해야 「또 아팠다」가 다음 주에 산다.
  assert.deepEqual(s.깨짐, d.통.깨짐.map((r) => [r.경로, r.마찰수]),
    '깨짐은 [경로, 실제 마찰수] 짝이어야 «또 아팠다»(17→19)를 다음 주에 잴 수 있다');
  assert.ok(s.깨짐.every(([, n]) => n >= 대장.깨짐기준),
    '🟠 통에 든 것은 정의상 임계값 이상이다 — 0 이 섞였으면 건수를 안 담은 것이다');
  assert.equal(JSON.parse(JSON.stringify(s)).통.깨짐, s.통.깨짐, 'JSON 왕복이 값을 안 깨뜨린다');
});

/** 임시 장부로 CLI 를 돌린다 — 실저장소 장부를 건드리지 않는다. */
function 기록돌리기(장부경로, 더 = []) {
  return spawnSync(process.execPath, [path.join(ROOT, 'tools', '작동대장.js'), '--기록', ...더], {
    env: { ...process.env, SYNK_작동대장_기록: 장부경로, SYNK_작동대장_산출: `${장부경로}.html` },
    cwd: ROOT, encoding: 'utf8',
  });
}

test('🔴 기록은 append-only — 앞줄을 지우지 않는다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-기록-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    const 앞줄 = JSON.stringify(사진('2000-01-01', { 깨짐: 1, 맨몸: 1, 안불림: 1, 괜찮음: 1 }));
    fs.writeFileSync(장부, `${앞줄}\n`, 'utf8');
    const r = 기록돌리기(장부);
    assert.equal(r.status, 0, `기록이 실패했다: ${r.stderr}`);
    const 줄들 = fs.readFileSync(장부, 'utf8').split('\n').filter((l) => l.trim());
    assert.equal(줄들.length, 2, '덧붙이기가 아니라 덮어썼다');
    assert.equal(줄들[0], 앞줄, '앞줄이 바뀌었다 — 그 주의 사진은 다시 만들 수 없다');
    assert.equal(JSON.parse(줄들[1]).날짜.slice(0, 2), '20');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('기록 — 같은 날 두 번째는 건너뛴다(추세가 흐려진다) · 기존 줄은 그대로', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-기록2-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    assert.equal(기록돌리기(장부).status, 0);
    const 한번 = fs.readFileSync(장부, 'utf8');
    const r2 = 기록돌리기(장부);
    assert.equal(r2.status, 0);
    assert.match(r2.stdout, /건너뛴다/);
    assert.equal(fs.readFileSync(장부, 'utf8'), 한번, '건너뛰었는데 파일이 바뀌었다');
    assert.equal(기록돌리기(장부, ['--강제']).status, 0);
    assert.equal(fs.readFileSync(장부, 'utf8').split('\n').filter((l) => l.trim()).length, 2,
      '--강제 는 덧붙여야 한다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('🔴 못 읽은 입력이 있으면 기록하지 않는다 — 거짓 사진은 다음 주를 통째로 속인다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-기록3-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', '작동대장.js'), '--기록'], {
      env: {
        ...process.env, CLAUDE_PROJECT_DIR: 방,      // 정본이 하나도 없는 방
        SYNK_작동대장_기록: 장부, SYNK_작동대장_산출: `${장부}.html`,
      },
      cwd: 방, encoding: 'utf8',
    });
    assert.notEqual(r.status, 0, '못 읽은 판인데 기록이 통과했다');
    assert.match(r.stderr, /기록하지 않는다/);
    assert.ok(!fs.existsSync(장부), '거부했는데 장부가 생겼다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('기록읽기 — 깨진 줄은 조용히 버리지 않고 못읽음에 쌓인다 (F207)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-기록4-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    fs.writeFileSync(장부, '{"날짜":"2026-08-10","통":{}}\n이건 JSON 이 아니다\n', 'utf8');
    const r = spawnSync(process.execPath, ['-e', `
      const d = require(${JSON.stringify(path.join(ROOT, 'tools', '작동대장.js'))})
        .재기(Date.parse('2026-08-17T00:00:00Z'));
      process.stdout.write(JSON.stringify({ 줄: d.기록.줄들.length, 못: d.못읽음 }));
    `], { env: { ...process.env, SYNK_작동대장_기록: 장부 }, cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    assert.equal(out.줄, 1, '읽히는 줄은 1건');
    assert.ok(out.못.some((s) => s.includes('파싱 안 되는 줄')),
      `깨진 줄을 조용히 삼켰다:\n${out.못.join('\n')}`);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

/* ── ③④ 실저장소 — 거짓양성만 본다 ─────────────────────────────────────── */

test('실저장소 — 두 번 재도 같은 값이 나온다 (F537 의 기계 답)', () => {
  const a = 대장.재기(오늘);
  const b = 대장.재기(오늘);
  const 요약 = (d) => JSON.stringify({
    깨짐: d.통.깨짐.map((r) => [r.경로, r.마찰수]),
    맨몸: d.통.맨몸.map((r) => r.경로),
    안불림: d.통.안불림.map((r) => r.경로),
    괜찮음: d.통.괜찮음.length,
    못읽음: d.못읽음,
  });
  assert.equal(요약(a), 요약(b), '두 회차가 다르면 이 화면은 판정을 못 낸다(F537)');
});

test('실저장소 — 못 읽은 입력이 0 이다 (조용한 0 금지 · F207)', () => {
  const d = 대장.재기(오늘);
  assert.deepEqual(d.못읽음, [], `못 읽은 입력이 있으면 위 숫자는 판정이 아니다:\n${d.못읽음.join('\n')}`);
});

test('🔴 입력을 못 읽으면 실제로 «쌓인다» — 탐지력은 픽스처가 진다 (F207)', () => {
  // 위 시험은 실저장소가 깨끗해서 **탐지기를 통째로 지워도 초록**이다(변이 실측 08-17: 구멍).
  // 그래서 정본이 하나도 없는 빈 ROOT 를 만들어, 못읽음이 «이름을 대고» 차는지 본다.
  const 빈방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-작동대장-'));
  try {
    const r = spawnSync(process.execPath, ['-e', `
      const d = require(${JSON.stringify(path.join(ROOT, 'tools', '작동대장.js'))})
        .재기(Date.parse('2026-08-17T00:00:00Z'));
      process.stdout.write(JSON.stringify(d.못읽음));
    `], { env: { ...process.env, CLAUDE_PROJECT_DIR: 빈방 }, cwd: 빈방, encoding: 'utf8' });
    assert.equal(r.status, 0, `자식 프로세스가 죽었다: ${r.stderr}`);
    const 못읽음 = JSON.parse(r.stdout);
    assert.ok(못읽음.some((s) => s.includes('시스템 대장')),
      `정본이 없는데 「시스템 대장」이 못읽음에 안 떴다 — 조용히 삼킨다:\n${못읽음.join('\n')}`);
    assert.ok(못읽음.some((s) => s.includes('철학 정본')),
      `정본이 없는데 「철학 정본」이 못읽음에 안 떴다 — 조용히 삼킨다:\n${못읽음.join('\n')}`);
  } finally {
    fs.rmSync(빈방, { recursive: true, force: true });
  }
});

test('실저장소 — 정본을 실제로 파싱했다 (0 이 아니라 값이 든다)', () => {
  const d = 대장.재기(오늘);
  assert.ok(d.장치들.length > 50, `장치를 못 셌다 (${d.장치들.length})`);
  assert.ok(d.말.회귀개수 > 50, `회귀를 못 셌다 (${d.말.회귀개수})`);
  // 🔴 `읽은수 === 전체` 만으로는 **조용한 절단**을 못 본다 — 목록을 잘라내면 둘이 같이 줄어
  //    분수는 계속 「306/306」 모양이다(변이 실측 08-17: 40건만 읽게 밀었는데 초록 — 구멍).
  //    그래서 «바닥»을 함께 못박는다: 이 저장소의 마찰 장부는 08-17 에 306건이었고 늘기만 한다.
  assert.ok(d.마찰.읽은수 === d.마찰.전체, `마찰 장부 ${d.마찰.읽은수}/${d.마찰.전체} — 읽다 실패한 것이 있다`);
  assert.ok(d.마찰.전체 >= 250,
    `마찰 장부가 ${d.마찰.전체}건뿐이다 — 08-17 실측 306건에서 줄었다면 목록이 잘리고 있다`);
  assert.ok(d.부품 && d.부품.length >= 4, '시스템 대장 구역을 못 읽었다');
  assert.ok(d.사슬 && d.사슬.length === 3, `철학 A-1 의 ㉠㉡㉢ 세 층을 못 읽었다 (${d.사슬 ? d.사슬.length : 'null'})`);
});

test('실저장소 — git 손댐 지도가 한글 경로를 실제로 담는다 (①의 실판 확인)', () => {
  const d = 대장.재기(오늘);
  assert.ok(d.손댐 && d.손댐.size > 100, `손댐 지도가 비었다 (${d.손댐 ? d.손댐.size : 'null'})`);
  const 한글경로 = [...d.손댐.keys()].filter((p) => /[가-힣]/.test(p));
  assert.ok(한글경로.length > 20,
    `한글 경로가 ${한글경로.length}건뿐이다 — git 이스케이프를 다시 안 풀고 있다(①)`);
});
