/**
 * 로고 정본 전파 회귀 — 워드마크 사본이 정본과 갈라지지 않았는가.
 *
 * 왜 생겼나 (2026-08-18 실측):
 *   유호님 확정으로 로고 레터폼(600/−1 → 700/−4)과 꺾쇠 각도(80.5° → 60°)를 개정했다.
 *   그런데 워드마크를 담은 파일이 저장소에 **여덟 곳**이었고, 정본·주입기·조립기·후보시트
 *   넷을 고친 뒤에도 **`tools/인쇄본빌드.js` · `tools/교재읽기본.js` ·
 *   `docs/tools/OG카드_마스터.html` · 등록서 원고 넷이 낡은 채 남아 있었다.**
 *   아무 검사도 그걸 안 봤다 — `tools/로고주입.js --check` 는 `docs/발표물/` 직속만 훑고,
 *   `tests/로고정본색.test.js` 는 **색만** 본다(좌표·웨이트는 안 본다).
 *   즉 「초록인데 로고가 두 벌」인 상태가 성립했다.
 *
 * 무엇을 재나:
 *   ① 정본(_브랜드킷.md §3)에서 레터폼·꺾쇠를 **파생**한다 — 손 목록을 안 든다
 *      (`tests/로고정본색.test.js` 가 킷 색 목록을 손으로 들었다가 F520 으로 낡았다).
 *   ② 저장소를 훑어 워드마크 사본을 **찾아낸다** — 파일 목록도 손으로 안 든다.
 *      새 사본이 생기면 자동으로 검사 대상이 된다(등록을 잊어도 잡힌다).
 *   ③ 사본 개수를 **보고한다** — 스캔이 조용히 0건이 되면 이 가드는 죽은 채 초록이다.
 *
 * ⚠ 제외 대상은 「왜 빼는가」를 적는다 — 이유 없는 제외는 다음 사람이 늘린다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');
const 정본파일 = path.join(ROOT, 'docs', '발표물', '_브랜드킷.md');

/** 워드마크가 든 파일의 표식. 서체 조판이라 이 태그가 반드시 따라온다. */
const 표식 = 'syn</text>';

/** 스캔에서 빼는 자리 — 각 줄에 이유가 붙는다. */
const 제외 = [
  ['docs/_archive/', '동결 산출물 — 소급 개서 금지(DESIGN.md §5)'],
  ['docs/브랜드킷_검수_0814.html', '08-14 검수 시점의 기록물 — 그날의 값이 증거다'],
  ['docs/발표물/로고/트렌디_개선안_대조.html', '시안 시트 — 구판을 «대조 기준»으로 일부러 싣는다'],
  ['docs/발표물/로고/2차_k정제_AI추천_0818.html', '시안 시트 — 위와 같다'],
  ['tests/로고정본전파.test.js', '이 파일 — 아래 픽스처가 낡은 판을 «일부러» 담는다. 자기를 실사본으로 세면 영구 적색이다(초판이 실제로 그랬다)'],
  ['node_modules/', ''],
  ['.git/', ''],
];
const 제외인가 = (rel) => 제외.some(([p]) => rel.replace(/\\/g, '/').includes(p));

/** 스캔 — 표식이 든 파일을 찾는다(목록을 손으로 들지 않는다). */
function 사본들() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      const rel = path.relative(ROOT, full);
      if (제외인가(rel)) continue;
      if (e.isDirectory()) { walk(full); continue; }
      if (!/\.(js|py|md|html)$/.test(e.name)) continue;
      let src;
      try { src = fs.readFileSync(full, 'utf8'); } catch { continue; }
      if (src.includes(표식)) out.push({ rel: rel.replace(/\\/g, '/'), src });
    }
  })(ROOT);
  return out;
}

/** 정본에서 값을 «파생»한다. 여기가 못 읽히면 테스트는 통과가 아니라 실패다. */
function 정본값(src) {
  const letter = src.match(/font-weight="(\d{3})"\s+letter-spacing="(-?[\d.]+)"/);
  const chev = src.match(/<path d="(M[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+ Z)" fill="#FF6B5C"/);
  return {
    weight: letter && letter[1],
    tracking: letter && letter[2],
    chev: chev && chev[1],
  };
}

test('정본(_브랜드킷.md §3)에서 로고 값을 읽을 수 있다 — 여기가 죽으면 아래가 전부 무의미하다', () => {
  const v = 정본값(fs.readFileSync(정본파일, 'utf8'));
  assert.ok(v.weight, '정본에서 font-weight 를 못 읽었다 — 도형 정본 블록의 표기가 바뀌었나');
  assert.ok(v.tracking, '정본에서 letter-spacing 을 못 읽었다');
  assert.ok(v.chev, '정본에서 꺾쇠 path 를 못 읽었다');
});

test('워드마크 사본 전량이 정본과 같은 레터폼·꺾쇠를 쓴다', () => {
  const 정 = 정본값(fs.readFileSync(정본파일, 'utf8'));
  const 목록 = 사본들();

  // ③ 분모 — 스캔이 조용히 죽으면 「어긋남 0」이 통과처럼 보인다(F207).
  assert.ok(목록.length >= 6,
    `워드마크 사본이 ${목록.length}건뿐이다 — 스캔이 죽었거나 경로가 바뀌었다(정본·주입기·조립기 등 최소 6곳은 있어야 한다)`);

  const 어긋남 = [];
  for (const { rel, src } of 목록) {
    for (const m of src.matchAll(/font-weight="(\d{3})"\s+letter-spacing="(-?[\d.]+)"[^>]*>syn<\/text>/g)) {
      if (m[1] !== 정.weight || m[2] !== 정.tracking) {
        어긋남.push(`${rel}: 레터폼 ${m[1]}/${m[2]} ≠ 정본 ${정.weight}/${정.tracking}`);
      }
    }
    // 꺾쇠 — 구판 좌표가 남아 있는지 본다(정본 좌표는 「있어야 할 것」이 아니라 「달라선 안 될 것」이다)
    for (const m of src.matchAll(/<path d="(M[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+ L[\d.]+ [\d.]+ Z)" fill="#FF6B5C"/g)) {
      if (m[1] !== 정.chev) 어긋남.push(`${rel}: 꺾쇠 «${m[1]}» ≠ 정본`);
    }
  }
  assert.deepStrictEqual(어긋남, [],
    `사본 ${목록.length}건 중 어긋남:\n  · ${어긋남.join('\n  · ')}\n` +
    `  → 고치는 법: 정본 §3 의 값으로 맞추고 \`node tools/로고주입.js\` 를 돌린다`);
});

/**
 * ② 탐지력은 픽스처로 못박는다 — 실저장소가 초록이 되면 위 테스트만으론
 *    「가드가 도는지」를 알 수 없다(버그가 아직 있기를 요구하는 회귀는 금지다).
 */
test('탐지력 — 낡은 사본을 심으면 실제로 잡는다', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-logo-'));
  try {
    const 정 = 정본값(fs.readFileSync(정본파일, 'utf8'));
    const 낡은판 = `<text font-weight="600" letter-spacing="-1" fill="#F6F1E8">syn</text>`;
    const f = path.join(dir, '낡은사본.html');
    fs.writeFileSync(f, 낡은판);

    const src = fs.readFileSync(f, 'utf8');
    const hits = [...src.matchAll(/font-weight="(\d{3})"\s+letter-spacing="(-?[\d.]+)"[^>]*>syn<\/text>/g)];
    assert.strictEqual(hits.length, 1, '픽스처에서 워드마크를 못 찾았다 — 정규식이 실표기를 놓친다');
    assert.ok(hits[0][1] !== 정.weight || hits[0][2] !== 정.tracking,
      '낡은 레터폼(600/−1)을 정본과 같다고 판정했다 — 가드가 눈을 감았다');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/**
 * ③ 자기 처방 검사 — 실패문이 시키는 명령이 실제로 존재해야 한다.
 *    따를 수 없는 처방은 우회를 정상 통로로 만든다(F103).
 */
test('실패문이 가리키는 처방 통로가 실재한다', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'tools', '로고주입.js')),
    '실패문은 `node tools/로고주입.js` 를 시키는데 그 파일이 없다');
  const 주입기 = fs.readFileSync(path.join(ROOT, 'tools', '로고주입.js'), 'utf8');
  const 정 = 정본값(fs.readFileSync(정본파일, 'utf8'));
  const v = 정본값(주입기);
  assert.strictEqual(v.weight, 정.weight, '주입기의 레터폼이 정본과 다르다 — 주입 한 번에 낡은 값이 번진다');
  assert.strictEqual(v.chev, 정.chev, '주입기의 꺾쇠가 정본과 다르다');
});
