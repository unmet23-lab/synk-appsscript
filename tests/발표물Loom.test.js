/* 발표물 × Loom 회귀 — 「훅이 없으면 안 얹는다」 (F517②).
 *
 * 무엇을 막나 — **마커만 켜진 초록**:
 *   `지면방` 의 전파 술어는 CSS 주석 하나(`/*loom부품:`)다. 그래서 CSS 를 얹기만 하면
 *   부품이 한 개도 없어도 전파가 켜진다. 착수 시점 실측: 발표물 6벌의 부품 클래스는
 *   **6벌 전부 0개**였다 — 그대로 얹었으면 「전파 13/21 초록 · 부품 0」이 됐다.
 *   ⇒ 원고가 부품을 실제로 부를 때만 얹는다. 그래야 «마커» = «부품» 이 된다.
 *
 * 🔑 어긋남은 **양쪽 다** 잡아야 한다. 훅을 달고 안 구우면 CSS 가 없고(조용),
 *   훅을 떼고 안 구우면 **CSS 만 남는다** — 뒤쪽이 위험하다. 마커가 켜져 있어서 「입었다」로 읽힌다.
 *
 * 탐지력은 픽스처가 진다(`SYNK_PRESENT_ROOT` 이음매 — 실저장소를 안 건드린다).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'tools', '발표물빌드.js');
const 빌드 = require(BUILD);
const loom = require(path.join(ROOT, 'tools', 'lib', 'loom.js'));
/* 마커는 **베끼지 않는다** — 뿌리는 쪽과 시험하는 쪽이 갈리면 조용히 통과한다.
 * (첫 판에서 `/*__FONT__*​/` 라고 지어 썼다가 왕복이 안 맞았다 — 참값은 `활자주입.마커`.) */
const MARKER = require(path.join(ROOT, 'tools', 'lib', '활자주입.js')).마커;

/** `--check` 를 픽스처 방에 대고 돌린다(파이썬이 없어도 답한다 — 굽지 않으므로). */
function check(dir) {
  const r = spawnSync(process.execPath, [BUILD, '--check'], {
    encoding: 'utf8', timeout: 20000,
    env: { ...process.env, SYNK_PRESENT_ROOT: dir },
  });
  return { code: r.status, out: (r.stdout || '') + (r.stderr || '') };
}

const 원고 = (본문) => `<!doctype html><html><head><style>@page{size:A4;margin:0}
${MARKER}
.tag{color:#0f1730}
</style></head><body>${본문}</body></html>`;

/** 산출물 = 원고에 폰트를 심은 것(+ 필요하면 Loom). 마커 치환은 실제 빌드와 같은 모양으로. */
function 산출(본문, { loom얹기: 얹나 = false } = {}) {
  const FACE = "@font-face{font-family:'SUIT';font-weight:400;src:url(data:font/woff2;base64,AAAA) format('woff2')}";
  let h = 원고(본문).replace(MARKER, FACE);
  if (얹나) h = 빌드.loom얹기(h, loom.css({ 지면: 빌드.LOOM_지면 }));
  return h;
}

function 방짓기(본문, 옵션) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-발표물loom-'));
  fs.writeFileSync(path.join(dir, '_src_01_시험.html'), 원고(본문), 'utf8');
  fs.writeFileSync(path.join(dir, '01_시험.html'), 산출(본문, 옵션), 'utf8');
  return dir;
}

/* ══ 훅 판정 — 무엇을 훅으로 세나 ═════════════════════════════════════════ */

test('훅들 — 마크업에 «닿는» 선택자만 센다 (판정은 `loom훅.js` 한 곳)', () => {
  /* 2026-08-17: 클래스 교집합에서 «닿나»로 옮겼다. 옛 판은 `지면방` 과 **다른 답을 낼 수 있었다** —
   * `.번호` 처럼 `h2>span:not(.번호)` 안에만 사는 클래스는 「부품 클래스」엔 잡히지만
   * 아무 데도 안 닿는다. 그런 원고면 빌드는 얹고 등록층은 빨개진다. */
  const 칩 = 빌드.훅들('<style></style><div class="tag 칩">x</div>');
  assert.ok(칩.includes('.칩'), '부품 클래스를 달면 그 부품 선택자가 닿는다: ' + JSON.stringify(칩));
  assert.ok(칩.every((s) => s.startsWith('.칩')),
    '`.칩` 만 달았는데 다른 부품까지 닿으면 훅 판정이 헐거운 것이다: ' + JSON.stringify(칩));

  const 룸 = 빌드.훅들('<style></style><div class="룸"><h2>x</h2></div>');
  assert.ok(룸.includes('.룸'), '범위 클래스 자체도 훅이다: ' + JSON.stringify(룸));
  assert.ok(룸.some((s) => s.startsWith('.룸 h2')),
    '범위 안에 갇힌 맨요소 규칙이 `.룸` 을 씌우면 살아난다: ' + JSON.stringify(룸));

  assert.deepEqual(빌드.훅들('<style></style><div class="tag">x</div>'), [],
    '부품도 범위도 없으면 닿는 것이 0 — 여기서 얹으면 부품 0인 채 마커만 켜진다');
});

test('훅들 — 원고 «CSS» 안의 같은 이름은 훅이 아니다(마크업만 본다)', () => {
  /* CSS 에 `.칩{}` 이 적혀 있다고 그 지면이 칩을 «쓰는» 것은 아니다.
   * 이걸 안 가르면 스타일만 베낀 지면이 「입었다」로 켜진다.
   * ⚠픽스처는 **속성 선택자**라야 한다 — `.칩{}` 만 두면 `class="…"` 문자열이 CSS 에 없어서
   *   「CSS 까지 본다」로 망가뜨려도 결과가 같다(첫 판이 그래서 변이 구멍으로 나왔다). */
  assert.deepEqual(빌드.훅들('<style>[class="칩"]{color:red}</style><div class="tag">x</div>'), []);
  assert.ok(빌드.훅들('<style>[class="칩"]{color:red}</style><div class="tag 칩">x</div>').includes('.칩'));
});

test('얹을까 — 훅 0 이면 안 얹는다 (게이트 그 자체)', () => {
  assert.equal(빌드.얹을까([]), false, '훅 0 인데 얹으면 부품 0인 채 마커만 켜진다');
  assert.equal(빌드.얹을까(['.칩']), true);
});

/* ══ 왕복 — 얹은 것을 되뜯을 수 있나(`--check` 가 원고와 1:1 로 대조하려면 필수) ══ */

test('왕복 — 얹은 Loom 을 뜯으면 원고로 돌아온다', () => {
  const 본문 = '<div class="tag 칩">x</div>';
  const 산 = 산출(본문, { loom얹기: true });
  assert.ok(/\/\*loom부품:/.test(산), '얹었는데 마커가 없다');
  assert.equal(빌드.unembed(산).replace(/\r\n/g, '\n'), 원고(본문).replace(/\r\n/g, '\n'));
});

test('얹는 자리 — 원고 CSS «전부» 뒤다 (앞에 두면 훅을 달아도 아무 일이 안 난다)', () => {
  /* 🔑 부품 클래스와 원고 클래스는 특정도가 같다(`.칩` vs `.tag` = 0,1,0). 앞에 두면
   *   동점에서 원고가 이겨 훅이 «조용히» 아무것도 안 한다 — 훅은 늘고 화면은 그대로다.
   * ⚠style 블록이 **둘 이상**인 픽스처라야 한다 — 하나뿐이면 앞/뒤가 같은 자리라 못 가른다. */
  const 두벌 = '<style>.첫{a:1}</style><style>.tag{color:#0f1730}</style><body><div class="tag 칩">x</div>';
  const 얹힌 = 빌드.loom얹기(두벌, loom.css({ 지면: 빌드.LOOM_지면 }));
  assert.ok(얹힌.indexOf('data-loom') > 얹힌.lastIndexOf('.tag{color:#0f1730}'),
    'Loom 이 원고 CSS 보다 앞에 앉았다 — 동점에서 져서 부품이 안 보인다');
  assert.equal((얹힌.match(/data-loom/g) || []).length, 1, '두 번 얹혔다');
});

/* ══ 게이트 — 어긋남을 «양쪽 다» 잡나 ═══════════════════════════════════ */

test('거짓양성 0 — 훅 0 + 안 얹힘 = 최신이다', () => {
  const dir = 방짓기('<div class="tag">x</div>');
  const r = check(dir);
  assert.equal(r.code, 0, r.out);
});

test('거짓양성 0 — 훅 있음 + 얹힘 = 최신이다', () => {
  const dir = 방짓기('<div class="tag 칩">x</div>', { loom얹기: true });
  const r = check(dir);
  assert.equal(r.code, 0, r.out);
});

test('탐지력 — 훅을 달고 «안 구우면» 낡음으로 잡는다', () => {
  const dir = 방짓기('<div class="tag 칩">x</div>');       // 훅은 있는데 산출물엔 Loom 없음
  const r = check(dir);
  assert.equal(r.code, 1, '훅이 있는데 안 얹힌 것을 통과시켰다\n' + r.out);
  assert.match(r.out, /Loom 이 안 얹혔다/);
});

test('탐지력 — 훅을 떼고 «안 구우면» 잡는다 (마커만 켜진 초록 · 위험한 쪽)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-발표물loom-'));
  fs.writeFileSync(path.join(dir, '_src_01_시험.html'), 원고('<div class="tag">x</div>'), 'utf8');
  fs.writeFileSync(path.join(dir, '01_시험.html'), 산출('<div class="tag">x</div>', { loom얹기: true }), 'utf8');
  const r = check(dir);
  assert.equal(r.code, 1, '훅 0 인데 Loom 이 얹힌 것을 통과시켰다 — 부품 0인 채 마커만 켜진다\n' + r.out);
  assert.match(r.out, /훅 0개인데 Loom 이 얹혔다/);
});


test('탐지력 — loom 이 바뀐 뒤 «안 구우면» 잡는다 (블록 내용 대조 · 반박 H-2)', () => {
  const dir = 방짓기('<div class="tag 칩">x</div>', { loom얹기: true });
  /* 구세대 흉내 — 얹힌 블록 «안»의 마커 철자 하나를 비튼다. 지금 세대의 강제얹기 산출과
   * 문자가 달라지므로 내용 대조만이 잡을 수 있다(훅↔얹힘 불리언은 여전히 정합). */
  const p = path.join(dir, '01_시험.html');
  fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace('/*loom부품:', '/*loom부품구세대:'), 'utf8');
  const r = check(dir);
  assert.equal(r.code, 1, '구세대 Loom 블록을 「최신」으로 통과시켰다\n' + r.out);
  assert.match(r.out, /지금 세대와 다르다/);
});

/* ══ 실저장소 — 거짓양성 0 (탐지력의 근거로는 안 쓴다) ═══════════════════ */

test('실저장소 — 발표물 6벌의 훅과 얹힘이 어긋나지 않는다', () => {
  const r = check(path.join(ROOT, 'docs', '발표물'));
  assert.equal(r.code, 0, r.out);
});

test('실저장소 — 얹는 프리셋은 «인쇄» 판이다(종이에서 부품이 사라지지 않게)', () => {
  /* 🔴 `부품만` 으로 얹으면 부품 색이 Cream 계열로 남는다. 크롬 인쇄는 「배경 그래픽」이
   *   기본 꺼짐이라 흰 종이 위 Cream = 1.13:1 — 화면에선 멀쩡하고 종이에서만 사라진다. */
  assert.equal(빌드.LOOM_지면, '인쇄부품');
  assert.ok(/@media print\{/.test(loom.css({ 지면: 빌드.LOOM_지면 })), '낮 층이 안 실렸다');
});
