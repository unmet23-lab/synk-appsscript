/* 「유호님 화면에 닿았나」 — F440 이 낳은 축의 회귀.
 *
 * 🔴 F440 (2026-08-14 유호 신고 「자개 캐러셀이 아직 안온것같아」): 산출물 HTML 2벌이 커밋되고
 *   보드에 ✅ 로 적혔는데 반출도 직송도 0이라 유호님 화면엔 아무것도 안 갔다. 커밋·렌더린트
 *   초록·보드 ✅ 는 전부 «만들었다»만 증명한다 — «닿았다» 를 재는 자리가 0이었다.
 *
 * 🔑 탐지력은 **전부 픽스처**가 진다(CLAUDE.md 맹점 ②·F296). 실저장소=유호님 바탕화면이라
 *   CI 에 없고, 있어도 그날 폴더 상태에 따라 초록·적색이 갈린다. 아래 픽스처는 갈래 폴더를
 *   임시 디렉터리에 세우고 `.lnk` 는 **모사 셸**로 읽는다 — PowerShell 이 없는 판에서도 돈다.
 *
 * 🔑 실저장소에는 **거짓양성만** 묻는다(맨 아래 절) — 「버그가 아직 있을 것을 요구하는 회귀」 금지.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 운영자료 = require('../tools/운영자료.js');
const 보드 = require('../tools/lib/보드.js');

/** 모사 셸 — `.lnk` 옆에 둔 `<이름>.대상` 사이드카를 읽어 대상 경로를 돌려준다.
 *  실제 `.lnk` 바이너리를 만들 수 없는 판(리눅스 CI)에서도 「바로가기가 무엇을 가리키나」를
 *  그대로 흉내 낸다 — 이 시험이 재는 것은 lnk 포맷이 아니라 **도달 판정**이다. */
function 모사셸() {
  return (스크립트) => {
    const m = /CreateShortcut\("((?:[^"\\]|\\.)*)"\)/.exec(스크립트);
    if (!m) throw new Error('모사셸: CreateShortcut 인자를 못 읽었다');
    const lnk = JSON.parse(`"${m[1]}"`);
    try { return fs.readFileSync(lnk + '.대상', 'utf8').trim(); } catch { return ''; }
  };
}

/** 갈래 폴더를 세운다. `항목` = { 갈래, 이름, 대상? } — 대상이 있으면 바로가기, 없으면 사본. */
function 밭세우기(항목들) {
  const 밭 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-반출-'));
  // 2026-08-17 재편: 뿌리 = 바탕화면 그 자체다(갈래 값이 「SYNK 코어」·「SYNK LAB\운영」을 든다).
  const 폴더 = 밭;
  for (const g of Object.keys(운영자료.갈래들)) {
    fs.mkdirSync(운영자료.갈래폴더(폴더, g), { recursive: true });
  }
  for (const it of 항목들) {
    const p = path.join(운영자료.갈래폴더(폴더, it.갈래), it.이름);
    fs.writeFileSync(p, '');
    if (it.대상) fs.writeFileSync(p + '.대상', it.대상);
  }
  return { 밭, 폴더 };
}

/* ── ① 도달 판정 — 근거 셋과 「안 닿음」 ───────────────────────────── */

test('바로가기가 그 파일을 가리키면 닿았다 · 없으면 안 닿았다 (F440 의 그 자리)', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-repo-'));
  fs.mkdirSync(path.join(뿌리, 'docs/캐릭터'), { recursive: true });
  const 간것 = path.join(뿌리, 'docs/캐릭터/간것.html');
  fs.writeFileSync(간것, '');
  fs.writeFileSync(path.join(뿌리, 'docs/캐릭터/안간것.html'), '');

  const { 폴더 } = 밭세우기([{ 갈래: '운영', 이름: '01_보낸것.lnk', 대상: 간것 }]);
  const r = 운영자료.반출도달(폴더, ['docs/캐릭터/간것.html', 'docs/캐릭터/안간것.html'],
    { 뿌리, 셸: 모사셸() });

  assert.equal(r.모름, false);
  assert.equal(r.항목[0].닿음, true, '바로가기 대상은 닿은 것이다');
  assert.equal(r.항목[0].근거, '바로가기');
  assert.equal(r.항목[1].닿음, false, '어느 갈래에도 없으면 안 닿은 것이다');
});

test('조상 폴더를 가리키는 바로가기도 도달이다 — 그 폴더를 열면 안의 파일에 닿는다', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-repo-'));
  fs.mkdirSync(path.join(뿌리, 'docs/정본/SYNK LAB/자료'), { recursive: true });
  fs.writeFileSync(path.join(뿌리, 'docs/정본/SYNK LAB/자료/안쪽.pdf'), '');

  const { 폴더 } = 밭세우기([
    // 갈래는 재편(08-17) 뒤 셋뿐이다. 이 테스트가 재는 것은 갈래가 아니라 «조상 폴더» 판정이고,
    // 이름의 옛 번호 접두(`07_`)는 일부러 남겼다 — 읽는 쪽은 관대해야 한다(「보관」에 그런 게 산다).
    { 갈래: '운영', 이름: '07_정본 폴더.lnk', 대상: path.join(뿌리, 'docs/정본/SYNK LAB') },
  ]);
  const r = 운영자료.반출도달(폴더, ['docs/정본/SYNK LAB/자료/안쪽.pdf'], { 뿌리, 셸: 모사셸() });
  assert.equal(r.항목[0].근거, '상위폴더');
});

test('이웃 폴더를 조상으로 오인하지 않는다 (`…/SYNK LAB` 이 `…/SYNK LAB2` 를 삼키면 안 된다)', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-repo-'));
  fs.mkdirSync(path.join(뿌리, 'docs/정본/SYNK LAB'), { recursive: true });
  fs.mkdirSync(path.join(뿌리, 'docs/정본/SYNK LAB2'), { recursive: true });
  fs.writeFileSync(path.join(뿌리, 'docs/정본/SYNK LAB2/남.pdf'), '');

  const { 폴더 } = 밭세우기([
    // 갈래는 재편(08-17) 뒤 셋뿐이다. 이 테스트가 재는 것은 갈래가 아니라 «조상 폴더» 판정이고,
    // 이름의 옛 번호 접두(`07_`)는 일부러 남겼다 — 읽는 쪽은 관대해야 한다(「보관」에 그런 게 산다).
    { 갈래: '운영', 이름: '07_정본 폴더.lnk', 대상: path.join(뿌리, 'docs/정본/SYNK LAB') },
  ]);
  const r = 운영자료.반출도달(폴더, ['docs/정본/SYNK LAB2/남.pdf'], { 뿌리, 셸: 모사셸() });
  assert.equal(r.항목[0].닿음, false, '접두만 같은 이웃 폴더는 조상이 아니다');
});

test('폴더가 없으면 **모름**이지 「안 닿았다」가 아니다 (F103 — 따를 수 없는 경보를 안 만든다)', () => {
  const r = 운영자료.반출도달(path.join(os.tmpdir(), '없는폴더-synk-반출'), ['docs/x.html']);
  assert.equal(r.모름, true);
  assert.equal(r.항목.length, 0, '못 잰 판에서는 한 건도 판정하지 않는다');
});

/* ── ② 대상 종류 도출 — 손 목록이 아니다 ──────────────────────────── */

test('도달률이 바닥인 종류는 안 센다 — `.md` 는 이 저장소가 설계·장부를 적는 형식이다', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-repo-'));
  fs.mkdirSync(path.join(뿌리, 'docs'), { recursive: true });
  const 후보 = [];
  // .html 2개 중 1개가 나갔다(50%) · .md 20개 중 1개가 나갔다(5%)
  for (let i = 0; i < 2; i++) { const p = path.join(뿌리, `docs/h${i}.html`); fs.writeFileSync(p, ''); 후보.push(p); }
  for (let i = 0; i < 20; i++) { const p = path.join(뿌리, `docs/m${i}.md`); fs.writeFileSync(p, ''); 후보.push(p); }

  const { 폴더 } = 밭세우기([
    { 갈래: '운영', 이름: '01_h.lnk', 대상: path.join(뿌리, 'docs/h0.html') },
    { 갈래: '운영', 이름: '02_m.lnk', 대상: path.join(뿌리, 'docs/m0.md') },
  ]);
  const 확 = 운영자료.화면확장자(폴더, { 셸: 모사셸(), 후보 });
  assert.ok(확.has('.html'), '.html 은 반출 대상 종류다');
  assert.ok(!확.has('.md'), '.md 는 바닥이라 빠진다 — 넣으면 경보가 벽이 된다(실측 152줄 중 43~60줄)');
});

test('사본으로만 나간 종류는 도출에서 빠진다 — 이름이 바뀌어 repo 경로로 되짚을 수 없다', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-repo-'));
  fs.mkdirSync(path.join(뿌리, 'docs'), { recursive: true });
  const 후보 = [path.join(뿌리, 'docs/a.png'), path.join(뿌리, 'docs/b.html')];
  후보.forEach((p) => fs.writeFileSync(p, ''));

  const { 폴더 } = 밭세우기([
    { 갈래: '운영', 이름: '26_FB 인사카드 v2.png' },                       // 사본(이름이 다르다)
    { 갈래: '운영', 이름: '01_b.lnk', 대상: path.join(뿌리, 'docs/b.html') },
  ]);
  const 확 = 운영자료.화면확장자(폴더, { 셸: 모사셸(), 후보 });
  assert.ok(!확.has('.png'), '되짚을 수 없는 종류를 검사에 넣으면 그 종류는 전건이 거짓 적색이 된다');
  assert.ok(확.has('.html'));
});

test('이름 그대로 나간 사본은 **센다** — 되짚을 수 있으면 그건 도달이다', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-repo-'));
  fs.mkdirSync(path.join(뿌리, 'docs'), { recursive: true });
  const 후보 = [path.join(뿌리, 'docs/인사카드.png'), path.join(뿌리, 'docs/딴것.png')];
  후보.forEach((p) => fs.writeFileSync(p, ''));

  const { 폴더 } = 밭세우기([{ 갈래: '운영', 이름: '26_인사카드.png' }]);   // 사본 · 이름 그대로
  const 확 = 운영자료.화면확장자(폴더, { 셸: 모사셸(), 후보 });
  assert.ok(확 && 확.has('.png'), '이름이 살아 있으면 사본도 되짚힌다(2개 중 1개 = 50%)');
});

test('나간 것이 하나도 없으면 **null**(=모름) — 빈 집합은 「검사할 게 없다」로 조용히 통과한다', () => {
  const 뿌리 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-repo-'));
  fs.mkdirSync(path.join(뿌리, 'docs'), { recursive: true });
  const 후보 = [path.join(뿌리, 'docs/a.html'), path.join(뿌리, 'docs/b.pdf')];
  후보.forEach((p) => fs.writeFileSync(p, ''));
  const { 폴더 } = 밭세우기([]);
  assert.equal(운영자료.화면확장자(폴더, { 셸: 모사셸(), 후보 }), null,
    '후보는 있는데 나간 게 0이면 도출할 정본이 없다 — 빈 집합이 아니라 모름이다');
});

/* ── ③ 보드 칸 → 경로 (F440 의 실제 표기) ─────────────────────────── */

const 확HTML = new Set(['.html', '.pdf']);

test('중괄호 축약을 펼친다 — 안 펼치면 F440 을 낳은 그 두 파일이 경로 0개로 읽힌다', () => {
  const 실제칸 = 'docs/캐릭터/자개_0814/* · docs/캐릭터/자개_캐러셀_예시_0814{,_자립형}.html'
    + ' · docs/캐릭터/자개_0814_프롬프트.md (킷 hex 0 · 코드 0 · 배포 0)';
  const 뽑힘 = 보드.산출물경로들(실제칸, 확HTML);
  assert.ok(뽑힘.includes('docs/캐릭터/자개_캐러셀_예시_0814.html'), '첫 갈래');
  assert.ok(뽑힘.includes('docs/캐릭터/자개_캐러셀_예시_0814_자립형.html'), '둘째 갈래 — 유호님이 못 받은 그 파일');
});

test('비켜남 표기(🚫·무변경)는 산출물로 안 센다 — 거짓 경보 방향을 막는다', () => {
  const 칸 = 'docs/보고서.html · 🚫docs/남의것.html · docs/템플릿.pdf 무변경 · docs/진짜.pdf';
  const 뽑힘 = 보드.산출물경로들(칸, 확HTML);
  assert.deepEqual(뽑힘.sort(), ['docs/보고서.html', 'docs/진짜.pdf']);
});

test('확장자 집합을 안 주면 아무것도 안 뽑는다 — 손 목록을 이 파일에 박지 않는다', () => {
  assert.deepEqual(보드.산출물경로들('docs/x.html · docs/y.pdf', null), []);
  assert.deepEqual(보드.산출물경로들('docs/x.html', new Set()), []);
});

test('중괄호가 터무니없이 많으면 원문을 그대로 둔다 — 못 편 것을 「없다」로 만들지 않는다', () => {
  const 폭탄 = 'a{1,2}{1,2}{1,2}{1,2}{1,2}{1,2}{1,2}.html';
  const r = 보드.중괄호펼치기(폭탄, { 상한: 8 });
  assert.deepEqual(r, [폭탄], '상한을 넘으면 원문 한 벌');
});

/* ── ④ 배선 — 판정이 **실제로 불리는가** ──────────────────────────────
 *
 * 🔑 F481 의 교훈이 겨냥하는 자리다: 판정 로직만 회귀로 덮으면 **배선층이 샌다**(호출부가 값을
 *   죽이거나 아예 안 부르는 변이가 전건 초록을 통과한다). 그래서 `board-move` 를 **프로세스로**
 *   띄워 stdout 을 읽는다 — 「닿았나」가 트랙 종결 자리에서 실제로 우는지는 이 방법으로만 안다.
 * ⚠ `--dry` 는 아무것도 쓰지 않고 exit 0 이라(그 도구 467행) 픽스처 저장소가 더러워지지 않는다.
 * ⚠ 유호님 바탕화면 폴더를 **읽는다**(쓰지 않는다). 없는 판(CI·새 클론)에서는 판정 재료가 없어
 *   조용하므로 **skip 으로 드러낸다** — fail 로 두면 CI 가 환경에 기댄다(F296).
 */
test('[배선] board-move 가 트랙을 닫을 때 「안 닿은 산출물」을 실제로 운다', (t) => {
  const { spawnSync, execFileSync } = require('node:child_process');

  let 폴더;
  try {
    const { 찾기 } = require('../tools/lib/바탕화면.js');
    폴더 = 찾기().경로;
  } catch { return t.skip('바탕화면을 못 찾았다(F296)'); }
  /* 🔑 뿌리(=바탕화면)의 존재로 skip 을 가르면 **안 갈린다** — 바탕화면은 어느 판에나 있다.
   * 재는 것은 「유호님 자료 폴더가 섰나」이므로 갈래 폴더를 본다(재편 전엔 뿌리가 그 역할이었다). */
  if (!fs.existsSync(운영자료.갈래폴더(폴더, '운영'))) return t.skip('유호님 바탕화면 폴더가 없는 판이다');
  const 확 = 운영자료.화면확장자(폴더);
  if (!확 || !확.has('.html')) return t.skip('이 판에서는 `.html` 이 반출 대상 종류로 도출되지 않는다');

  // 픽스처 저장소 — 진짜 저장소를 안 건드린다
  const 밭 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-배선-'));
  try { execFileSync('git', ['init', '-q'], { cwd: 밭, stdio: 'ignore' }); }
  catch { return t.skip('git 을 못 불렀다'); }

  fs.mkdirSync(path.join(밭, 'docs/캐릭터'), { recursive: true });
  // 유호님 폴더에 있을 리 없는 이름 — 「안 닿음」이 나와야 정상이다
  const 산출물 = 'docs/캐릭터/배선시험_안보낸것_9f3a1c.html';
  fs.writeFileSync(path.join(밭, 산출물), '<html></html>');

  const 보드 = path.join(밭, '보드.md');
  const 아카 = path.join(밭, '아카이브.md');
  const 줄 = `| 2026-08-15 | **배선 시험 트랙 9f3a1c** | ${산출물} · 이 줄 | ✅종결 |`;
  fs.writeFileSync(보드, `| 날짜 | 트랙 | 만질 파일 | 상태 |\n|---|---|---|---|\n${줄}\n`);
  fs.writeFileSync(아카, `# 아카이브\n\n---\n\n| 날짜 | 트랙 | 만질 파일 | 상태 |\n|---|---|---|---|\n`);

  const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'tools', 'board-move.js'), '배선 시험 트랙 9f3a1c', '--dry'],
    { cwd: 밭, encoding: 'utf8', env: { ...process.env, SYNK_BOARD: 보드, SYNK_BOARD_ARCHIVE: 아카 } });

  const 말 = (r.stdout || '') + (r.stderr || '');
  assert.equal(r.status, 0, `board-move 가 0 으로 안 끝났다:\n${말}`);
  assert.ok(말.includes(산출물),
    `트랙을 닫는데 「안 닿은 산출물」을 한 줄도 안 울었다 — 판정은 살아 있는데 배선이 죽은 모양이다(F481):\n${말}`);
  assert.ok(/안 닿은 산출물/.test(말), `경보 문구가 안 실렸다:\n${말}`);
});

/* ── ⑤ 실저장소 — 거짓양성만 묻는다 ───────────────────────────────── */

test('[실저장소] 도출한 확장자 집합에 `.js`·`.json` 이 안 들어간다 (거짓양성 방향)', (t) => {
  let 폴더;
  try {
    const { 찾기 } = require('../tools/lib/바탕화면.js');
    폴더 = 찾기().경로;
  } catch { return t.skip('바탕화면을 못 찾았다 — 이 판에서는 잴 수 없다(F296)'); }
  // 위 테스트와 같은 이유로 뿌리가 아니라 갈래 폴더를 본다(뿌리는 어느 판에나 있어 skip 이 안 갈린다).
  if (!fs.existsSync(운영자료.갈래폴더(폴더, '운영'))) return t.skip('유호님 바탕화면 폴더가 없는 판이다(CI·새 클론)');

  const 확 = 운영자료.화면확장자(폴더);
  if (!확) return t.skip('폴더가 비어 도출할 정본이 없다');
  for (const 나쁜 of ['.js', '.json', '.ts', '.test.js']) {
    assert.ok(!확.has(나쁜), `${나쁜} 는 유호님께 보내는 종류가 아니다 — 들어가면 배관 트랙마다 운다`);
  }
});
