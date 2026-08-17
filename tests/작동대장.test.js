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

/* ── ⑤ 자동 기록 · 재심 분모 보강 — 유호 픽 ㉱ 08-17 ───────────────────────
 * 「자동이 기본, 재심이 분모를 덮는다」. 여기서 지키는 급소는 둘이고 **둘 다 조용히 샌다**
 * (맞는 얼굴로 틀린 값 — CLAUDE.md 신뢰성 ④가 가장 자주 새는 자리라고 못박은 방향):
 *   ① 보강 줄이 사진으로 오인되면 `줄들.at(-1)` 이 그걸 「지난 사진」으로 집는다.
 *      보강 줄엔 `통` 이 없어 델타가 죄다 NaN 이 되는데 화면은 멀쩡한 얼굴로 뜬다.
 *   ② 이 저장소엔 「오늘」이 **둘**이다 — 작동대장은 UTC, `lib/재심신호.js` 는 로컬(KST).
 *      한국 09시 이전엔 두 통로의 날짜가 하루 갈려서, 날짜로 이으면 그 시간대에 돌린 재심이
 *      조용히 안 붙는다. 그래서 잇는 것은 «마지막 사진 줄»이다.
 * ⚠ 탐지력은 **픽스처**가 진다 — 실저장소 장부는 아직 사진 1건이라 이 경계가 아예 안 나온다. */

/** 임시 장부에서 모듈 함수를 돌린다 — `기록경로` 가 모듈 로드 시점에 고정되므로 자식이 필요하다. */
function 장부에서(장부, 코드) {
  const r = spawnSync(process.execPath, ['-e', `
    const 대장 = require(${JSON.stringify(path.join(ROOT, 'tools', '작동대장.js'))});
    ${코드}
  `], { env: { ...process.env, SYNK_작동대장_기록: 장부 }, cwd: ROOT, encoding: 'utf8' });
  assert.equal(r.status, 0, `자식이 죽었다: ${r.stderr}`);
  return JSON.parse(r.stdout);
}

/** 사진 2건 + (선택) 보강 1건을 깐다. */
function 장부깔기(장부, { 보강 = null } = {}) {
  const 줄들 = [
    JSON.stringify(사진('2026-08-10', { 깨짐: 2, 맨몸: 1, 안불림: 0, 괜찮음: 97 })),
    JSON.stringify(사진('2026-08-17', { 깨짐: 5, 맨몸: 1, 안불림: 0, 괜찮음: 94 })),
  ];
  if (보강) 줄들.push(JSON.stringify(보강));
  fs.writeFileSync(장부, `${줄들.join('\n')}\n`, 'utf8');
  return 줄들;
}

test('🔴 보강 줄을 「지난 사진」으로 오인하지 않는다 — 오인하면 움직임이 통째로 거짓이 된다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-보강1-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    장부깔기(장부, { 보강: { 날짜: '2026-08-17', 사건: '재심', 대상: '2026-08-17', 본것: 12, 뒤집음: 2 } });
    const out = 장부에서(장부, `
      const k = 대장.기록읽기();
      process.stdout.write(JSON.stringify({ 사진수: k.줄들.length, 보강수: k.보강.length, 끝: k.줄들.at(-1) }));
    `);
    assert.equal(out.사진수, 2, '보강 줄이 사진에 섞였다 — at(-1) 이 그것을 「지난 사진」으로 집는다');
    assert.equal(out.보강수, 1, '보강 줄을 못 가렸다');
    assert.ok(out.끝 && out.끝.통, '마지막 사진에 통이 없다 = 보강 줄을 집었다(델타가 NaN 으로 샌다)');
    assert.equal(out.끝.통.깨짐, 5, '집은 사진이 틀렸다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('보강 가르기 — 옛 줄엔 「사건」이 없다 → 사진으로 분류된다 (하위호환 · 08-17 첫 기록이 그 모양)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-보강2-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    장부깔기(장부);
    const out = 장부에서(장부, `
      const k = 대장.기록읽기();
      process.stdout.write(JSON.stringify({ 사진수: k.줄들.length, 보강수: k.보강.length }));
    `);
    assert.equal(out.사진수, 2, '「사건」 없는 옛 줄이 사진에서 빠졌다 — 기존 장부가 통째로 사라진다');
    assert.equal(out.보강수, 0);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('🔴 재심 분모는 날짜가 아니라 «마지막 사진»에 붙는다 — 두 통로의 「오늘」이 갈려도', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-보강3-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    장부깔기(장부);
    /* 재심을 «다음 날»에 닫는 상황 = 한국 09시 이전의 UTC/KST 갈림과 같은 모양이다.
     *  날짜로 이으면 여기서 '사진없음' 이 나거나 엉뚱한 줄에 붙는다. */
    const out = 장부에서(장부, `
      const r = 대장.재심보강({ 본것: 9, 뒤집음: 0, 지금: new Date('2026-08-18T00:30:00Z') });
      process.stdout.write(JSON.stringify(r));
    `);
    assert.equal(out.상태, 'ok', '날짜가 갈리자 분모를 못 붙였다 — 그게 UTC/KST 급소다');
    assert.equal(out.대상, '2026-08-17', '분모가 마지막 사진이 아니라 「오늘 날짜」를 찾았다');
    const 줄들 = fs.readFileSync(장부, 'utf8').split('\n').filter((l) => l.trim());
    assert.equal(줄들.length, 3, '덧붙이기가 아니다');
    assert.equal(JSON.parse(줄들[2]).날짜, '2026-08-18', '적힌 날짜는 재심을 «닫은» 날이다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('🔴 재심 보강은 덧붙이기다 — 앞줄 불변 · 같은 사진에 두 번 안 붙는다(append-only)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-보강4-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    const 깐줄 = 장부깔기(장부);
    const 첫 = 장부에서(장부, `
      process.stdout.write(JSON.stringify(대장.재심보강({ 본것: 12, 뒤집음: 2 })));
    `);
    assert.equal(첫.상태, 'ok');
    const 한번 = fs.readFileSync(장부, 'utf8');
    const 줄들 = 한번.split('\n').filter((l) => l.trim());
    assert.equal(줄들[0], 깐줄[0], '앞줄이 바뀌었다 — 그 주의 사진은 다시 만들 수 없다');
    assert.equal(줄들[1], 깐줄[1], '사진 줄을 덮어썼다');
    const 둘 = 장부에서(장부, `
      process.stdout.write(JSON.stringify(대장.재심보강({ 본것: 99, 뒤집음: 9 })));
    `);
    assert.equal(둘.상태, '이미있음', '같은 사진에 분모가 두 번 붙었다 — 어느 쪽이 참인지 못 가른다');
    assert.equal(fs.readFileSync(장부, 'utf8'), 한번, '「이미있음」인데 파일이 바뀌었다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('재심 보강 — 사진이 없으면 조용히 성공하지 않는다 (붙일 데가 없는 것과 붙였다를 가른다)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-보강5-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    const out = 장부에서(장부, `
      process.stdout.write(JSON.stringify(대장.재심보강({ 본것: 3, 뒤집음: 0 })));
    `);
    assert.equal(out.상태, '사진없음');
    assert.ok(!fs.existsSync(장부), '붙일 사진이 없는데 장부를 만들었다 — 고아 분모가 생긴다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('화면 — 그 주 재심 분모가 사진 옆에 뜬다(없으면 「—」) · 다시 그려서 잰다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-보강6-'));
  const 장부 = path.join(방, '기록.jsonl');
  const 산출 = path.join(방, '화면.html');
  try {
    /* 분모는 **첫 사진에만** 붙인다 — 붙은 줄과 안 붙은 줄이 한 표에 같이 나와야
     *  「—」가 「0건 봤다」와 안 헷갈린다는 것을 잴 수 있다. */
    장부깔기(장부, { 보강: { 날짜: '2026-08-10', 사건: '재심', 대상: '2026-08-10', 본것: 12, 뒤집음: 2 } });
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', '작동대장.js')], {
      env: { ...process.env, SYNK_작동대장_기록: 장부, SYNK_작동대장_산출: 산출 },
      cwd: ROOT, encoding: 'utf8',
    });
    assert.equal(r.status, 0, `화면 생성이 죽었다: ${r.stderr}`);
    const html = fs.readFileSync(산출, 'utf8');
    assert.match(html, /그 주 재심/, '재심 열이 표에 없다');
    assert.match(html, /12건 보고/, '붙은 분모가 화면에 안 실렸다');
    assert.match(html, /<td class="c dim">—<\/td>/, '분모 없는 주가 「—」로 안 나온다(0 과 안 갈린다)');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

/** 훅이 부르는 자동 기록을 그 자리에서 돌린다 — 임시 장부라 실저장소 장부는 안 건드린다. */
function 자동기록돌리기(장부) {
  return spawnSync(process.execPath, ['-e', `
    require(${JSON.stringify(path.join(ROOT, 'tools', '대기열.js'))}).자동기록();
  `], { env: { ...process.env, SYNK_작동대장_기록: 장부 }, cwd: ROOT, encoding: 'utf8' });
}

test('🔴 자동 기록 — 훅이 부르는 통로가 실제로 장부에 박는다(손 발동으로 되돌아가지 않는다)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-자동1-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    const r = 자동기록돌리기(장부);
    assert.equal(r.status, 0, `자동 기록이 세션을 죽였다 — 훅은 계기판이지 가드가 아니다: ${r.stderr}`);
    assert.match(r.stdout, /📸 그 주의 사진을 장부에 박았다/, '주기 도래 자리에서 자동 기록이 안 돌았다');
    assert.match(r.stdout, /미커밋/, '자동으로 박은 줄이 미커밋이라는 사실을 안 밝혔다');
    const 줄들 = fs.readFileSync(장부, 'utf8').split('\n').filter((l) => l.trim());
    assert.equal(줄들.length, 1, '「박았다」고 말했는데 장부에 안 들어갔다 — 말과 파일이 갈렸다');
    assert.ok(JSON.parse(줄들[0]).통, '박힌 줄이 사진 모양이 아니다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('🔴 자동 기록 — 못 읽은 판이면 빨간 줄로 «드러낸다» (조용한 거부가 이 배선의 급소다)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-자동2-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    /* 깨진 줄 하나면 「못 읽은 입력」이 선다 — 실저장소 정본은 멀쩡하므로 이것만이 거부 사유다.
     *  손으로 칠 땐 exit 1 을 사람이 보지만 훅에선 아무도 안 본다: 그래서 화면에 나와야 한다. */
    fs.writeFileSync(장부, '이건 JSON 이 아니다\n', 'utf8');
    const r = 자동기록돌리기(장부);
    assert.equal(r.status, 0, '거부가 세션을 죽였다');
    assert.match(r.stdout, /🔴 \*\*그 주의 사진을 못 박았다\*\*/, '거부가 조용했다 — 그 주가 빈 것과 같은 모양이 된다');
    assert.match(r.stdout, /파싱 안 되는 줄/, '무엇 때문에 거부했는지를 안 밝혔다');
    assert.equal(fs.readFileSync(장부, 'utf8'), '이건 JSON 이 아니다\n', '거부했는데 장부에 뭔가 박았다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

/* 🔴 아래 두 건은 **변이가 뚫어서 생겼다**(08-17 실측 · 계획 ⑧).
 *   `자동기록()` 호출 한 줄을 지웠는데 회귀 32건이 전부 초록이었다 — 함수는 검사했지만
 *   «그 함수가 실제로 불리는지»는 아무도 안 봤다. 이 트랙이 고치려던 병이 정확히 그것이라
 *   (「스스로 발화하지 않는 장치는 안 돈다」) 회귀 자신이 그 병에 걸려 있었다. */

test('🔴 주기 도래 자리가 자동 기록을 «실제로 부른다» — 배선이 끊기면 손 발동으로 되돌아간다', () => {
  const 재심알림 = require(path.join(ROOT, 'tools', '대기열.js')).재심알림.toString();
  assert.match(재심알림, /자동기록\(\)/,
    '주기 도래 자리에서 자동기록 호출이 사라졌다 — 알림만 뜨고 사진은 안 박힌다(그 주가 영구 결번)');
});

test('주기 도래 알림과 자동 기록은 «한 벌»이다 — 실판으로 확인(도래 안 했으면 skip)', (t) => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-자동3-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    const r = spawnSync(process.execPath, ['-e', `
      require(${JSON.stringify(path.join(ROOT, 'tools', '대기열.js'))}).재심알림([]);
    `], { env: { ...process.env, SYNK_작동대장_기록: 장부 }, cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, `재심알림이 세션을 죽였다: ${r.stderr}`);
    /* 도래 여부는 실저장소 `모델관측.jsonl` 이 정한다 — repo 상태에 물린 축이라 **skip 으로 드러낸다**
     *  (F296: 못 잰 것을 통과로 접지 않는다). 위 배선 검사가 그동안의 분모를 진다. */
    if (!/📅 \*\*수요일 재심이 도래했다\*\*/.test(r.stdout)) {
      t.skip('지금은 주기 도래 상태가 아니다 — 안 잰 것이지 통과가 아니다');
      return;
    }
    assert.match(r.stdout, /📸 그 주의 사진|🔴 \*\*그 주의 사진/,
      '도래 알림은 떴는데 사진 줄이 아예 없다 — 알림과 기록이 갈라졌다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('기록하기 — CLI 와 훅이 쓰는 통로가 하나다(같은 입력에 같은 판정)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-보강7-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    const 첫 = 장부에서(장부, `
      const r = 대장.기록하기({ 오늘: Date.parse('2026-08-17T00:00:00Z') });
      process.stdout.write(JSON.stringify({ 상태: r.상태, 날짜: r.날짜, 번째: r.번째 }));
    `);
    assert.equal(첫.상태, 'ok');
    assert.equal(첫.날짜, '2026-08-17', '`오늘` 을 넘겼는데 실제 오늘로 박았다 — 테스트가 시각에 물린다');
    assert.equal(첫.번째, 1);
    /* 같은 날 두 번째는 CLI 든 훅이든 **'중복'** 이어야 한다 — 판정이 한 곳에서 나오는지의 증거. */
    const 둘 = 장부에서(장부, `
      const r = 대장.기록하기({ 오늘: Date.parse('2026-08-17T00:00:00Z') });
      process.stdout.write(JSON.stringify({ 상태: r.상태 }));
    `);
    assert.equal(둘.상태, '중복');
    const 셋 = 장부에서(장부, `
      const r = 대장.기록하기({ 오늘: Date.parse('2026-08-17T00:00:00Z'), 강제: true });
      process.stdout.write(JSON.stringify({ 상태: r.상태, 번째: r.번째 }));
    `);
    assert.equal(셋.상태, 'ok', '--강제 통로가 모듈 쪽에서 안 열린다');
    assert.equal(fs.readFileSync(장부, 'utf8').split('\n').filter((l) => l.trim()).length, 2);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

/* ── ㉡ 「도는데 아픈 것」 = 재심의 둘째 과녁 (#Q102 유호 픽 ㉰ · 2026-08-17) ─────────
 *
 * 이 절이 지키는 것은 **정본이 하나라는 사실**이다. 재심 알림은 작동 대장의 «파생»이라
 * 목록·정본·훅을 새로 만들지 않는다 — 만들면 갈라지고(F554 가 그 계보), 갈라진 쪽 증상은 「통과」다.
 *
 * 🔑 그리고 이 축이 생긴 이유가 첫째 축의 **0** 이다: 설계상 분모인 〖모델상한〗 표식이 0건인데
 *    그 0 은 「풀린 게 없다」가 아니라 「막힌 11건이 전부 저장소 밖 재료」였다(08-17 전수 실측).
 *    그래서 여기서 가장 중요한 검사는 **0 과 「못 쟀다」를 가르는 것**이다(F207).
 */

/** ㉡ 렌더러를 실판으로 돌린다 — 장부만 픽스처로 갈아 끼운다(실저장소 장부는 안 건드린다). */
function 아픈축돌리기(장부값) {
  const env = { ...process.env };
  if (장부값 !== undefined) env.SYNK_작동대장_기록 = 장부값;
  const r = spawnSync(process.execPath, ['-e', `
    require(${JSON.stringify(path.join(ROOT, 'tools', '대기열.js'))}).아픈것내기();
  `], { env, cwd: ROOT, encoding: 'utf8' });
  /* 계기판이지 가드가 아니다 — 어떤 장부 상태에서도 세션을 죽이면 안 된다. */
  assert.equal(r.status, 0, `㉡ 렌더러가 세션을 죽였다: ${r.stderr}`);
  return r.stdout;
}

/** 사진 두 장을 깐다 — 통 개수는 그대로 두고 **드나듦만** 일으킨다(개수만 보면 「아무 일 없음」). */
function 아픈장부깔기(장부) {
  fs.writeFileSync(장부, `${[
    JSON.stringify(사진('2026-08-10', { 깨짐: 2, 맨몸: 1, 안불림: 0, 괜찮음: 97 },
      { 깨짐: [['tools/lib/보드.js', 17], ['tools/codex-review.js', 15]], 맨몸: ['tools/재질굽기.js'] })),
    JSON.stringify(사진('2026-08-17', { 깨짐: 2, 맨몸: 1, 안불림: 0, 괜찮음: 97 },
      { 깨짐: [['tools/lib/보드.js', 19], ['tools/board.js', 11]], 맨몸: ['tools/룸굽기.js'] })),
  ].join('\n')}\n`, 'utf8');
}

test('🔴 배선 — 재심 목록이 ㉡ 을 «실제로 부른다»(호출이 빠지면 과녁이 조용히 하나로 돌아간다)', () => {
  /* 08-17 실측: `자동기록()` 호출 한 줄을 지웠는데 회귀 32건이 전부 초록이었다. 같은 구멍을
   * 이 축에도 뚫지 않으려고 **불리는지**를 못박는다 — 함수만 검사하면 배선이 끊겨도 초록이다. */
  const 대기열 = require(path.join(ROOT, 'tools', '대기열.js'));
  assert.match(대기열.재심알림.toString(), /아픈것내기\(\)/,
    '재심 알림이 ㉡ 을 안 부른다 — 과녁이 〖모델상한〗 하나로 되돌아갔고 그 축은 영구 0 이다');
  assert.match(대기열.재심알림.toString(), /막힌것내기\(/,
    '재심 알림이 ㉠ 을 안 부른다 — 둘로 넓힌 과녁이 한 축만 남았다');
});

test('🔴 순서 — 그 주 사진을 «목록보다 먼저» 박는다(뒤에 박으면 갓 도래한 회차가 지난 주를 본다)', () => {
  const src = require(path.join(ROOT, 'tools', '대기열.js')).재심알림.toString();
  const 사진자리 = src.indexOf('자동기록()');
  const 목록자리 = src.indexOf('목록내기(r.모델바뀜');
  assert.ok(사진자리 > 0 && 목록자리 > 0, '두 호출 중 하나가 사라졌다');
  assert.ok(사진자리 < 목록자리,
    '목록이 사진보다 먼저 나간다 — ㉡ 은 사진의 파생이라 이 순서가 곧 신선도다(오늘 것을 「낡았다」로 낸다)');
});

test('🔑 재계산 0 — ㉡ 은 장부를 읽기만 한다(다시 재면 화면과 장부가 갈라진다)', () => {
  const src = require(path.join(ROOT, 'tools', '대기열.js')).아픈재료.toString();
  assert.match(src, /기록읽기\(\)/, '장부를 안 읽는다 — 파생이 아니라 사본이 된다');
  assert.doesNotMatch(src, /재기\(/,
    '㉡ 이 스스로 다시 잰다 — 그 주 사진은 「다시 계산하지 않으니 안 낡는다」가 근거였고 그것이 깨진다');
});

test('🔴 움직임이 «앞에» 선다 — 매주 같은 15건을 같은 순서로 내면 셋째 주에 배경이 된다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-아픈1-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    아픈장부깔기(장부);
    const out = 아픈축돌리기(장부);
    const 움자리 = out.indexOf('지난 사진(2026-08-10)');
    const 목록자리 = out.indexOf('🟠 자꾸 깨진다');
    assert.ok(움자리 > 0, '지난 사진과 견주지 않았다 — 사진이 두 장인데 움직임 절이 없다');
    assert.ok(목록자리 > 0, '아픈 목록 자체가 안 나왔다');
    assert.ok(움자리 < 목록자리, '전체 목록이 움직임보다 앞이다 — 읽는 사람은 앞줄만 본다');
    /* 개수는 그대로다(깨짐 2→2) — 그래서 **드나듦과 마찰 오름**이 이 축의 알맹이다. */
    assert.match(out, /새로 들어옴: tools\/board\.js/, '통에 새로 들어온 파일을 안 짚었다');
    assert.match(out, /tools\/lib\/보드\.js 17→19/, '마찰이 오른 파일을 안 짚었다 — 개수가 같으면 이것만이 신호다');
    assert.match(out, /회귀 0 으로 새로 들어옴: tools\/룸굽기\.js/, '맨몸으로 새로 들어온 파일을 안 짚었다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('🔴 같은 날 두 번째 세션에도 목록이 안 사라진다 — 기록하기가 「중복」이면 `통` 을 안 준다', () => {
  /* 이 배선의 급소다: 사진을 «박은 결과»에서 목록을 읽으면 수요일에 세션을 두 번 연 날
   * 둘째 세션부터 목록이 조용히 빈다(중복은 일부러 조용한 상태다). 그래서 장부에서 읽는다. */
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-아픈2-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    아픈장부깔기(장부);
    const 첫 = 아픈축돌리기(장부);
    const r = spawnSync(process.execPath, ['-e', `
      const q = require(${JSON.stringify(path.join(ROOT, 'tools', '대기열.js'))});
      q.자동기록();          // 오늘 날짜로 한 번 더 → '중복'(조용하다)
      q.아픈것내기();
    `], { env: { ...process.env, SYNK_작동대장_기록: 장부 }, cwd: ROOT, encoding: 'utf8' });
    assert.equal(r.status, 0, `둘째 호출이 세션을 죽였다: ${r.stderr}`);
    assert.match(r.stdout, /🟠 자꾸 깨진다/,
      '같은 날 두 번째에 목록이 사라졌다 — 「중복」의 빈 `통` 을 읽었다(수요일에 두 번 열면 눈이 먼다)');
    assert.match(첫, /🟠 자꾸 깨진다/, '첫 호출부터 목록이 없다');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('🔴 사진 없음·빈 장부·깨진 장부·낡음을 **0 과 안 접는다**(F207 — 넷이 다 다른 말이어야 한다)', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-아픈3-'));
  try {
    /* ㉠ 파일 자체가 없다 — 「아픈 게 0」이 아니라 「아직 안 박았다」 */
    const 없음 = 아픈축돌리기(path.join(방, '없다.jsonl'));
    assert.match(없음, /사진이 아직 없다/, '사진 0 장을 「아픈 것 0」으로 읽었다');
    assert.match(없음, /0건이 아니다/, '0 과 갈리는 말을 안 붙였다');

    /* ㉡ 장부는 있는데 다 깨졌다 — 몇 줄이 깨졌는지까지 */
    const 깨진 = path.join(방, '깨진.jsonl');
    fs.writeFileSync(깨진, 'JSON 아님\n또 아님\n', 'utf8');
    const 깨진출 = 아픈축돌리기(깨진);
    assert.match(깨진출, /못 읽은 줄 2건/, '깨진 줄 수를 안 밝혔다 — 분모 없는 0 이 된다');
    assert.match(깨진출, /장부가 깨졌다/, '깨진 장부를 「아픈 게 없다」쪽으로 읽었다');

    /* ㉢ 빈 장부 — 깨진 줄이 0 이라 「못 읽은 줄 0건」이라고 말해선 안 된다(아무 말도 아닌 문장) */
    const 빈 = path.join(방, '빈.jsonl');
    fs.writeFileSync(빈, '', 'utf8');
    const 빈출 = 아픈축돌리기(빈);
    assert.match(빈출, /빈 장부이거나 읽다 실패했다/, '빈 장부와 깨진 장부가 같은 말을 낸다');
    assert.doesNotMatch(빈출, /못 읽은 줄 0건/, '「못 읽은 줄 0건」은 맞는 얼굴로 아무 말도 안 하는 문장이다');

    /* ㉣ 낡은 사진 — 「지금」이라고 말하면 그 주가 빈 사실이 사라진다 */
    const 낡음 = path.join(방, '낡음.jsonl');
    const 옛날 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    fs.writeFileSync(낡음, `${JSON.stringify(사진(옛날, { 깨짐: 1, 맨몸: 0, 안불림: 0, 괜찮음: 99 },
      { 깨짐: [['tools/lib/보드.js', 19]] }))}\n`, 'utf8');
    assert.match(아픈축돌리기(낡음), /일 낡았다/, '30일 전 사진을 「지금」처럼 냈다 — 그 뒤 주가 빈 사실이 사라진다');

    /* ㉤ 사진 한 장 — 견줄 지난 주가 «없다»고 말한다(움직임 0 과 다르다) */
    const 한장 = path.join(방, '한장.jsonl');
    fs.writeFileSync(한장, `${JSON.stringify(사진(new Date().toISOString().slice(0, 10),
      { 깨짐: 1, 맨몸: 0, 안불림: 0, 괜찮음: 99 }, { 깨짐: [['tools/lib/보드.js', 19]] }))}\n`, 'utf8');
    const 한장출 = 아픈축돌리기(한장);
    assert.match(한장출, /견줄 지난 주가 없다/, '첫 회차를 「움직임 0」으로 냈다 — 안 잰 것이지 안 움직인 게 아니다');
    assert.doesNotMatch(한장출, /일 낡았다/, '오늘 박은 사진을 낡았다고 했다 — 날짜 축이 갈렸다(UTC/로컬)');
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

test('🔑 임계값을 여기 다시 안 적는다 — 같은 판정이 두 곳에 살면 그날 갈라진다', () => {
  const 방 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-아픈4-'));
  const 장부 = path.join(방, '기록.jsonl');
  try {
    아픈장부깔기(장부);
    const out = 아픈축돌리기(장부);
    assert.match(out, new RegExp(`마찰 ≥${대장.깨짐기준}`),
      `화면의 임계값이 작동대장의 ${대장.깨짐기준} 과 다르다 — 목록은 한 곳에서 파생돼야 한다`);
  } finally { fs.rmSync(방, { recursive: true, force: true }); }
});

/* ── ㉢ 시계가 둘이다 — 「마지막 손댐」 나이 축 (F600 · 2026-08-18) ────────────
 *
 * 🔴 **실제로 잡은 버그다.** `--date=short` 는 **작성자 타임존**으로 날짜를 렌더하는데
 *    `오늘` 은 **UTC 날짜**라, 한국(UTC+9)에서는 **매일 00:00~09:00 KST** 동안 두 축이
 *    하루 갈렸다 — 그 창에 손댄 파일이 전부 `-1일`로 인쇄됐다(실측 2026-08-18:
 *    `tools/codex-review.js`·`tools/대기열.js` 가 `2026-08-18 · -1일`).
 *
 * ⚠ **이 검사를 실저장소로 지면 안 된다** — 「음수 0건」은 하루 중 15시간은 고치기 «전»에도
 *    참이다. 시간대에 기대는 검사는 CI 에서 갈린다(F296). 그래서 탐지력은 전부 **픽스처**가 지고,
 *    실저장소는 거짓양성만 본다(맹점 ②).
 *
 * ⚠ 그리고 **음수를 0 으로 접지 않는다**(F480·F207) — 축을 맞춘 뒤에도 시계 어긋남·리베이스로
 *    「미래 날짜」 커밋은 실재한다. 접으면 그때 아무 말도 안 하는 «맞는 얼굴»이 된다. */

test('🔴 UTC날짜 — epoch 를 «UTC» 로 접는다(KST 로 접으면 그날 하루가 밀린다)', () => {
  // 2026-08-17T21:11:16Z = 2026-08-18 06:11 KST — 바로 그 갈리는 창의 실측 순간이다.
  const 초 = Math.floor(Date.parse('2026-08-17T21:11:16Z') / 1000);
  assert.equal(대장.UTC날짜(초), '2026-08-17',
    'KST 로 접으면 2026-08-18 이 된다 — 그게 F600 이 만든 -1일이다');
  // 경계: UTC 자정 직전/직후가 서로 다른 날이어야 한다.
  assert.equal(대장.UTC날짜(Date.parse('2026-08-17T23:59:59Z') / 1000), '2026-08-17');
  assert.equal(대장.UTC날짜(Date.parse('2026-08-18T00:00:00Z') / 1000), '2026-08-18');
});

test('🔴 UTC날짜 — 숫자가 아니면 «조용히 0 으로» 안 접고 null 을 낸다 (F207)', () => {
  assert.equal(대장.UTC날짜('2026-08-18'), null, '옛 --date=short 꼴이 흘러들면 모름이어야 한다');
  assert.equal(대장.UTC날짜(''), null);
  assert.equal(대장.UTC날짜('nope'), null);
});

test('🔴 손댐파싱 — git 도장이 epoch 라 타임존이 «출력에 없다» (축이 하나가 된 자리)', () => {
  const 초 = Math.floor(Date.parse('2026-08-17T21:11:16Z') / 1000);
  const out = [`@${초}`, 'tools/codex-review.js', 'tools/대기열.js'].join('\n');
  const { 지도 } = 대장.손댐파싱(out);
  assert.equal(지도.get('tools/codex-review.js'), '2026-08-17');
  assert.equal(지도.get('tools/대기열.js'), '2026-08-17');
});

test('🔴 손댐파싱 — 옛 `--date=short` 로 되돌리면 «틀린 날짜»가 아니라 «빈 지도»가 된다', () => {
  // 포맷 되돌리기(=버그 복구)가 조용히 통과하지 못하게 못박는다.
  // 빈 지도는 손댐지도() 의 `size === 0` 못이 못읽음으로 소리내어 잡는다(이미 :260·:265 가 지킨다).
  const out = ['@2026-08-18', 'tools/codex-review.js'].join('\n');
  const { 지도 } = 대장.손댐파싱(out);
  assert.equal(지도.size, 0, '옛 꼴 도장 아래 파일이 «어떤» 날짜도 얻으면 안 된다');
});

test('🔴 손댐파싱 — 빈 도장 `@` 이 1970-01-01 로 조용히 앉지 않는다', () => {
  // Number('') === 0 이라 자릿수를 안 못박으면 epoch 0 = 1970-01-01 이 «맞는 얼굴»로 들어온다.
  const { 지도 } = 대장.손댐파싱(['@', 'tools/board.js'].join('\n'));
  assert.equal(지도.get('tools/board.js'), undefined, '빈 도장은 날짜를 못 준다');
});

test('🔴 손댐파싱 — `@` 로 시작하는 «파일명»을 날짜 도장으로 안 읽는다', () => {
  const 초 = Math.floor(Date.parse('2026-08-10T00:00:00Z') / 1000);
  const out = [`@${초}`, '@types/index.js', 'tools/board.js'].join('\n');
  const { 지도 } = 대장.손댐파싱(out);
  assert.equal(지도.get('@types/index.js'), '2026-08-10', '파일로 읽혀야 한다');
  assert.equal(지도.get('tools/board.js'), '2026-08-10', '뒤 파일이 도장을 잃으면 안 된다');
});

test('손댐파싱 — 한글 경로 이스케이프는 그대로 풀린다(못 ①②가 안 죽었다)', () => {
  const 초 = Math.floor(Date.parse('2026-08-12T00:00:00Z') / 1000);
  const out = [`@${초}`, '"tools/lib/\\353\\263\\264\\353\\223\\234.js"'].join('\n');
  const { 지도 } = 대장.손댐파싱(out);
  assert.equal(지도.get('tools/lib/보드.js'), '2026-08-12');
});

test('🔴 분류 — 「미래 날짜」를 0 으로 접지 않는다(음수 그대로 든다 · F480)', () => {
  const 장치들 = ['tools/앞선.js'];
  const 말 = { 회귀합본: '앞선', 회귀개수: 1, 조각: [] };
  const 참조맵 = new Map([['tools/앞선.js', 3]]);
  const 손댐 = new Map([['tools/앞선.js', '2026-08-18']]);   // 오늘(2026-08-17)보다 앞선다
  const { 통 } = 대장.분류(장치들, 말, 참조맵, { 언급: new Map() }, 손댐, 오늘);
  const 줄 = [...통.깨짐, ...통.맨몸, ...통.괜찮음, ...통.안불림][0];
  assert.equal(줄.지난날, -1, '접거나 버리면 시계 어긋남이 영영 안 보인다');
});

test('🔴 나이꼬리 — 음수는 「-N일」이 아니라 «다른 이름»으로 드러난다', () => {
  const 음 = 대장.나이꼬리(-1);
  assert.match(음, /앞선 날짜/, '음수는 별도 상태로 이름이 붙어야 한다');
  assert.doesNotMatch(음, /-1일/, '「-1일」은 유호님이 읽는 화면에 그대로 나가면 안 된다');
  assert.match(대장.나이꼬리(0), /0일/);
  assert.match(대장.나이꼬리(12), /12일/);
  assert.equal(대장.나이꼬리(null), '', '모름은 꼬리가 없다');
});

test('실저장소 — 손댐 지도의 날짜가 전부 `YYYY-MM-DD` 꼴이다 (거짓양성만 본다)', () => {
  const 오늘UTC = Date.parse(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
  const d = 대장.재기(오늘UTC);
  assert.ok(d.손댐 && d.손댐.size > 100, `손댐 지도가 비었다 (${d.손댐 ? d.손댐.size : 'null'})`);
  const 이상 = [...d.손댐.values()].filter((v) => !/^\d{4}-\d{2}-\d{2}$/.test(v));
  assert.equal(이상.length, 0, `날짜 꼴이 아닌 값 ${이상.length}건: ${이상.slice(0, 3).join(' ')}`);
});
