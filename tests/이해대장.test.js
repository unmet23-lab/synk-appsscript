/**
 * 이해대장 회귀 — 「부록 A 를 그린 화면이 정본과 갈라지지 않는가」
 *
 * 왜 있나 (2026-08-12 · 유호님 「색상으로 한눈에 파악」 아이디어의 실물):
 *   이 화면의 값어치는 **「어디가 비었나」를 정확히 말하는 것** 하나뿐이다. 정본이 개정됐는데
 *   화면이 안 따라오면, 이미 채운 칸을 계속 「비었다」고 말하거나(가짜 빨강) 아직 빈 칸을
 *   「찼다」고 말한다(가짜 초록). 후자가 훨씬 비싸다 — 우리가 채워야 할 자리를 못 보게 한다.
 *
 * ⚠ 탐지력은 픽스처가 진다. 실저장소에는 거짓양성(=드리프트)만 검사하고,
 *   정본이 없는 환경(워크트리·부분 체크아웃)은 fail 이 아니라 skip(F207).
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TOOL = path.join(ROOT, 'tools', '이해대장.js');
const 정본 = path.join(ROOT, 'docs', 'SYNK_철학.md');
const 산출 = path.join(ROOT, 'docs', '이해대장.html');
const os = require('node:os');
const { 표뽑기, 비었나, 도달색, 도달실측, 엔진점수, 킷 } = require(TOOL);

/* ── ① 탐지력 = 픽스처 ─────────────────────────────────────────── */

const 픽스처 = [
  '### A-1. 이해 대장 — 설명 줄',
  '',
  '> 설명문은 표가 아니다 — 건너뛰어야 한다.',
  '',
  '| 이해 층 | **돈다** | **짓고 있다** | 🔴 **아직 없다** |',
  '|---|---|---|---|',
  '| **㉠ 실력** | 오류 태그 23종 | 도달 배선 | — |',
  '| **㉡ 사람** | 🔴 **없다.** 원시 신호뿐 | 미니게임 | 🔴 자동 수집 배선 |',
  '',
  '### A-2. 실물 대장',
  '',
  '| 층 | 돈다 | 짓는다 | 연다 |',
  '|---|---|---|---|',
  '| 학습·앱 | 게임화 | 학생 앱 | — |',
  '',
].join('\n');

test('픽스처 — 표를 뽑고, 앞의 설명문·구분선은 안 먹는다', () => {
  const t = 표뽑기(픽스처, /^###\s*A-1\./);
  assert.strictEqual(t.length, 3, '머리 1 + 몸 2 여야 한다');
  assert.strictEqual(t[0][0], '이해 층');
  assert.strictEqual(t[1][1], '오류 태그 23종', '굵게 표식이 안 걷혔거나 칸이 밀렸다');
  assert.ok(!JSON.stringify(t).includes('설명문은 표가 아니다'), '표 앞 설명문을 먹었다');
  assert.ok(!JSON.stringify(t).includes('---'), '구분선을 행으로 셌다');
});

test('픽스처 — A-2 를 A-1 과 섞지 않는다(표 두 벌이 붙어 있어도)', () => {
  const a1 = 표뽑기(픽스처, /^###\s*A-1\./);
  const a2 = 표뽑기(픽스처, /^###\s*A-2\./);
  assert.ok(!JSON.stringify(a1).includes('게임화'), 'A-1 이 A-2 까지 먹었다');
  assert.strictEqual(a2.length, 2);
});

test('픽스처 — 앵커가 낡으면 null(빈 화면을 조용히 내지 않는다)', () => {
  assert.strictEqual(표뽑기(픽스처, /^###\s*A-9\./), null);
});

test('빔 판정 — 「—」·「없다」는 내용이 아니라 «빈 것»이다', () => {
  assert.ok(비었나('—'), '대시는 빈 칸이다');
  assert.ok(비었나('🔴 **없다.** 원시 신호뿐'), '「없다」로 시작하면 표식·꼬리가 붙어도 빈 칸이다');
  assert.ok(비었나(''), '');
  assert.ok(!비었나('오류 태그 23종'), '내용이 있는데 빈 칸으로 셌다 — 가짜 빨강');
  assert.ok(!비었나('🔴 자동 수집 배선'), '「아직 없다」 칸의 내용은 «알고 있는 구멍»이라 내용이다');
});

/* ── ①-b 엔진 도달 축 — 「모았는가」가 아니라 «닿았는가»가 결론이다 (2026-08-12 유호님 지시) ──
 * 유호님 상시 지시: 수집은 «엔진 도달까지»가 한 벌이고, 「나중에 쓸 수 있는 모양」은 충족이 아니다.
 * 그래서 이 표에서 가장 위험한 칸은 빈 칸이 아니라 **「돈다」가 초록인데 도달이 빨간 칸**이다 —
 * 다 된 것처럼 보이는데 실은 미완성인 자리. 아래가 그 열이 사라지거나 조용해지는 것을 막는다. */

test('도달 실측 — 형제 저장소가 없으면 «0» 이 아니라 null 이다(「빚 0」과 「안 재봤다」를 안 섞는다)', () => {
  const 없는곳 = path.join(ROOT, 'tests', '__없는루트__');
  assert.strictEqual(도달실측(없는곳), null,
    '못 읽었는데 숫자를 지어냈다 — 미실행이 통과와 같은 모양이 된다(F207)');
});

test('도달 실측 — 있으면 래칫 두 개를 «숫자로» 준다', (t) => {
  const r = 도달실측(ROOT);
  if (!r) return t.skip('형제 저장소(SYNK-talk) 없음 — 이 환경에선 못 잰다');
  assert.ok(Number.isInteger(r.도달0), '`도달0상한` 을 못 읽었다 — 상수 이름이 바뀌었을 수 있다');
  assert.ok(Number.isInteger(r.생산자만), '`생산자섰는데도달0상한` 을 못 읽었다');
  assert.ok(r.도달0 >= 0 && r.생산자만 >= 0);
});

/* ── ①-b 엔진 점수 = «성능» 축 (v1.6 신설) ──────────────────────────────
 * 위 도달 실측이 «범위»(그 학생의 어떤 면을 볼 수 있나)를 잰다면 이건 «성능»(본 것을 얼마나
 * 정확히 처리하나)이다. 두 축을 섞으면 「넓어졌는데 못해졌다」가 어느 화면에도 안 보인다.
 * 가장 비싼 실패 둘을 픽스처가 문다 — ①안 쟀는데 0 으로 적기 ②판이 다른 회차를 대조군으로 집기. */

function 점수픽스처(내용) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-엔진점수-'));
  if (내용 !== null) {
    fs.mkdirSync(path.join(d, 'docs', '_ops'), { recursive: true });
    fs.writeFileSync(path.join(d, 'docs', '_ops', '엔진점수.jsonl'), 내용, 'utf8');
  }
  return d;
}

test('엔진 점수 — 파일이 없거나 비었으면 «0» 이 아니라 null(「0점」과 「안 재봤다」는 다르다)', () => {
  assert.strictEqual(엔진점수(점수픽스처(null)), null, '파일이 없는데 숫자를 지어냈다(F207)');
  assert.strictEqual(엔진점수(점수픽스처('')), null, '빈 파일을 0 점으로 읽었다');
  assert.strictEqual(엔진점수(점수픽스처('깨진 줄\n{또깨짐\n')), null, '깨진 줄만 있는데 결과를 냈다');
});

test('엔진 점수 — 판이 다르면 대조하지 않는다(조건을 둘 바꾸면 그건 대조가 아니다 · F045)', () => {
  const r = 엔진점수(점수픽스처(
    '{"날짜":"2026-08-01","판":"v1","전체":70,"분모":102}\n'
    + '{"날짜":"2026-08-12","판":"v2","전체":79,"분모":102}\n'));
  assert.strictEqual(r.현재.판, 'v2');
  assert.strictEqual(r.직전, null,
    '판이 다른 회차를 직전으로 집었다 — 그 ▲▼ 는 「나아졌다」가 아니라 「다른 실험」이다');
  assert.strictEqual(r.변화, null);
});

test('엔진 점수 — 같은 판의 직전과만 대조한다(바로 앞 줄이 아니라)', () => {
  const r = 엔진점수(점수픽스처(
    '{"날짜":"2026-08-01","판":"v1","전체":70,"분모":102}\n'
    + '{"날짜":"2026-08-05","판":"v2","전체":60,"분모":102}\n'
    + '{"날짜":"2026-08-12","판":"v1","전체":80,"분모":102}\n'));
  assert.strictEqual(r.직전.날짜, '2026-08-01', '같은 판을 건너뛰고 바로 앞 줄을 집었다');
  assert.strictEqual(r.변화, 10);
  assert.strictEqual(r.회차수, 3);
});

test('실저장소 — 엔진 점수가 색 화면에 «범위와 갈라서» 실린다', (t) => {
  const r = 엔진점수(ROOT);
  if (!r) return t.skip('docs/_ops/엔진점수.jsonl 없음 — 아직 한 회차도 안 쟀다');
  assert.ok(r.현재.분모 > 0, '분모 없는 점수는 읽을 수 없는 수다');
  assert.ok(r.현재.판, '판 이름이 없으면 다음 회차와 대조할 수 없다');
  assert.ok(fs.readFileSync(산출, 'utf8').includes('엔진 점수'),
    '색 화면에 성능 축이 없다 — 범위만 보고 「다 됐다」로 읽게 된다');
});

/* 🔴 이 열은 이름이 「엔진에 «닿는가»」라 **부정 판정도 「닿는다」를 품는다.** 긍정을 먼저 물으면
 *   「못 닿는다」가 초록이 되고, 그때 화면은 가장 비싼 거짓말을 한다 — 안 닿는 층을 닿는다고.
 *   탐지력은 아래 픽스처가 지고(실문구가 우연히 그 낱말을 피한 덕에 여태 맞고 있었다),
 *   실정본에는 거짓양성 0 만 본다. */
test('도달색 — 부정 판정이 초록으로 뒤집히지 않는다 (탐지력 픽스처)', () => {
  for (const 글 of ['🔴 못 닿는다', '스탬프까지만 닿는다', '아직 안 닿는다', '🔴 끊겼다 — 미뤄져 있다']) {
    assert.equal(도달색(글).표, '끊겼다', `"${글}" 이 초록으로 샜다`);
  }
  assert.equal(도달색('✅ **닿는다** — 읽어서 다음 첨삭을 바꾼다').표, '닿는다');
  assert.equal(도달색('— 물을 수조차 없다. 재료가 0이다').표, '물을 수 없다',
    '「끊겼다」와 「물을 수 없다」는 다음에 할 일이 다르다 — 한 색으로 뭉개지 않는다');
});

/* 🔴 같은 물음이 세 자리에 따로 적혀 있었다(색 · 요약 「N/3 층만 닿는다」 · 「먼저 볼 곳」).
 *   부정을 먼저 묻도록 색만 고쳤더니 나머지 둘이 옛 판정을 들고 갈라졌다 — 화면이 한 층을
 *   빨갛게 칠하면서 같은 화면 머리에서 「닿는다」로 셌다(실측 08-12). 사본 0 을 소스로 잰다. */
test('도달 판정 사본이 0 — 「닿는다」를 소스에서 직접 묻는 자리는 도달색 하나뿐', () => {
  const 소스 = fs.readFileSync(TOOL, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, ''); // 사유를 적은 주석은 대상 아님
  const 자리 = 소스.split('\n').filter((l) => /\/닿는다\//.test(l));
  assert.equal(자리.length, 1, `「닿는다」 정규식이 ${자리.length} 곳에 있다 — 갈라지는 순간 증상이 없다:\n${자리.join('\n')}`);
  assert.match(자리[0], /return \{ 면: 킷\.emerald/, '유일한 그 자리가 도달색이 아니다');

  /* 매 세션 실리는 카드도 같은 판정을 쓴다 — 넷째 사본이 거기 있었다. */
  const 훅 = path.join(ROOT, '.claude', 'hooks', 'philosophy-card.js');
  const 훅소스 = fs.readFileSync(훅, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/\/닿는다\//.test(훅소스), false, '철학카드가 도달 판정을 자기 손으로 다시 적는다 — 화면과 카드가 다른 말을 하게 된다');
  assert.match(훅소스, /도달판정\(r\) !== '닿는다'/, '카드가 도달판정을 안 쓴다');
});

test('실정본의 도달 칸 셋은 색 판정이 그 칸의 «글»과 어긋나지 않는다', (t) => {
  if (!fs.existsSync(정본)) return t.skip('정본 없음');
  const t1 = 표뽑기(fs.readFileSync(정본, 'utf8'), /^###\s*A-1\./);
  for (const 행 of t1.slice(1)) {
    const 칸 = 행[행.length - 1];
    const 표 = 도달색(칸).표;
    if (/못 닿|끊겼|미뤄|까지만/.test(칸)) {
      assert.equal(표, '끊겼다', `"${행[0]}" — 부정으로 적었는데 색은 "${표}" 다`);
    }
  }
});

test('실저장소 — A-1 에 「엔진에 닿는가」 열이 있고, 화면이 실측을 말한다', (t) => {
  if (!fs.existsSync(정본)) return t.skip('정본 없음');
  const t1 = 표뽑기(fs.readFileSync(정본, 'utf8'), /^###\s*A-1\./);
  assert.ok(/엔진에 닿는가/.test(t1[0].join(' ')),
    'A-1 에서 도달 열이 사라졌다 — 「모았는가」만 남으면 모으고 안 쓰는 설계를 못 잡는다');
  for (const 행 of t1.slice(1)) {
    assert.ok(행[행.length - 1].trim(), `"${행[0]}" 의 도달 칸이 비었다 — 판정을 안 한 것이다`);
  }
  const html = fs.readFileSync(산출, 'utf8');
  assert.ok(/엔진 도달 실측/.test(html), '화면에 실측 줄이 없다');
  if (도달실측(ROOT)) {
    assert.ok(!/못 쟀다/.test(html), '형제 저장소가 있는데 화면은 「못 쟀다」라고 한다 — 재생성이 안 됐다');
  }
});

/* ── ①-c 주소 — 유호님이 «가리킬» 수 있어야 한다 (2026-08-12 2차 지시) ─────────
 * 유호님: 「이 대장을 보고 검토·발전 지시를 자주 내릴 거다. 특정 칸을 말하면 그 부분만
 * 정본에 비추어 다시 검토할 수 있게 해달라.」 → 주소가 흔들리면 어제 적어 둔 「㉡2 보류」가
 * 오늘 딴 칸을 가리킨다. 주소는 편의가 아니라 **정확도 장치**라 회귀로 못박는다. */

const { 층기호, 지시문, 먼저볼곳 } = require(TOOL);

test('주소 — 층 기호는 이름이 길어져도 흔들리지 않는다', () => {
  assert.strictEqual(층기호('**㉡ 사람** — 성향·습관·언제 집중이 오르는가'), '㉡');
  assert.strictEqual(층기호('㉢ 삶'), '㉢');
  assert.strictEqual(층기호('학습·앱'), null, 'A-2 행에는 이해 층 기호가 없어야 한다');
});

test('주소 — 지시문에 «주소·층·열» 이 다 들어간다(코드만 붙여도 통하게)', () => {
  const s = 지시문('㉡2', '㉡ 사람', '짓고 있다');
  for (const 조각 of ['㉡2', '㉡ 사람', '짓고 있다', '철학 정본']) {
    assert.ok(s.includes(조각), `지시문에 "${조각}" 이 없다 — 붙여 넣어도 어느 칸인지 모른다`);
  }
});

test('실저장소 — 모든 칸에 주소 버튼이 붙고, 주소가 «유일»하다', (t) => {
  if (!fs.existsSync(산출)) return t.skip('산출물 없음');
  const html = fs.readFileSync(산출, 'utf8');
  // 🔑 칸 버튼(class="복사")과 「먼저 볼 곳」 버튼(class="복사 큰")을 «클래스로» 가른다.
  //    후자는 같은 주소를 일부러 다시 쓴다(바로가기라서) — 그걸 중복으로 세면 회귀가 거짓 적색이 되고,
  //    거짓 적색은 다음 사람이 회귀를 끄게 만든다. 가르는 축은 글자가 아니라 «자리»다.
  const 칸주소 = [...html.matchAll(/<button class="복사" data-말="[^"]*"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]);
  const 제안주소 = [...html.matchAll(/<button class="복사 큰"[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]);
  assert.ok(칸주소.length >= 12, `칸 주소가 ${칸주소.length}개뿐이다 — 못 가리키는 칸이 있다`);
  assert.strictEqual(new Set(칸주소).size, 칸주소.length,
    `주소가 겹친다 — 유호님이 «그 칸»을 말해도 두 곳을 가리킨다: ${칸주소.join(',')}`);
  assert.ok(칸주소.some((a) => /^㉡\d$/.test(a)), 'A-1 주소가 없다');
  assert.ok(칸주소.some((a) => /^수업\d$/.test(a)), 'A-2 「수업·현장」 주소가 없다');
  // 제안이 가리키는 주소는 «실재하는 칸»이어야 한다 — 안 그러면 누르는 순간 허공을 가리킨다.
  for (const a of 제안주소) {
    assert.ok(칸주소.includes(a), `「먼저 볼 곳」이 없는 칸을 가리킨다: ${a}`);
  }
});

test('실저장소 — 화면이 «다음 질문»을 제안한다(먼저 볼 곳)', (t) => {
  if (!fs.existsSync(정본)) return t.skip('정본 없음');
  const 이해 = 표뽑기(fs.readFileSync(정본, 'utf8'), /^###\s*A-1\./);
  const 제안 = 먼저볼곳(이해);
  assert.ok(제안.length > 0, '지금 빈 칸·끊긴 도달이 있는데 제안이 0건이다');
  assert.ok(제안.length <= 3, '제안이 너무 많다 — 셋을 넘으면 우선순위가 아니라 목록이다');
  assert.ok(제안.every((c) => c.주소 && c.왜), '제안에 주소나 이유가 빠졌다');
  assert.ok(/닿/.test(제안[0].왜), '엔진 도달이 최우선이 아니다 — 모으고 안 쓰는 게 가장 급한 결함이다');
});

test('스킬 — /대장검토 가 등록돼 있고 주소 규칙을 싣는다', () => {
  const p = path.join(ROOT, '.claude', 'skills', '대장검토', 'SKILL.md');
  assert.ok(fs.existsSync(p), '스킬 파일이 없다 — 유호님이 코드를 말해도 받을 통로가 없다');
  const s = fs.readFileSync(p, 'utf8');
  assert.match(s, /^---[\s\S]*?name:\s*대장검토[\s\S]*?description:[\s\S]*?---/, '프론트매터가 깨졌다');
  for (const 조각 of ['㉡2', '엔진 도달', '읽힌 것', '하지 않는 것 셋', 'node tools/이해대장.js']) {
    assert.ok(s.includes(조각), `스킬에 "${조각}" 이 없다 — 검토가 그 게이트를 건너뛴다`);
  }
});

/* ── ② 킷 — 색은 브랜드 킷에서만 (유호님 확정) ────────────────────── */

test('색은 브랜드 킷에서만 뽑는다 — 임의 색이 섞이면 대외에 못 쓴다', () => {
  const 허용 = new Set(Object.values(킷).map((v) => v.toLowerCase()));
  const src = fs.readFileSync(TOOL, 'utf8');
  // 킷 정의 블록을 뺀 나머지에 하드코딩된 hex 가 있으면 그건 킷 밖 색이다.
  const 나머지 = src.replace(/const 킷 = \{[\s\S]*?\};/, '');
  for (const hex of 나머지.match(/#[0-9A-Fa-f]{6}/g) || []) {
    assert.ok(허용.has(hex.toLowerCase()), `킷에 없는 색이 하드코딩됐다: ${hex}`);
  }
});

/* ── ③ 실저장소 — 드리프트만 검사(정본 없으면 skip) ─────────────────── */

test('실저장소 — 커밋된 화면이 지금 정본과 같다(안 갈라졌다)', (t) => {
  if (!fs.existsSync(정본) || !fs.existsSync(산출)) {
    return t.skip('정본 또는 산출물 없음 — 이 환경에선 못 잰다(미실행을 통과로 세지 않는다)');
  }
  const 커밋된 = fs.readFileSync(산출, 'utf8');
  execFileSync(process.execPath, [TOOL], { cwd: ROOT, stdio: 'pipe' });
  const 다시그린 = fs.readFileSync(산출, 'utf8');
  assert.strictEqual(다시그린, 커밋된,
    'docs/이해대장.html 이 정본보다 낡았다 — `node tools/이해대장.js` 를 돌려 다시 커밋하라');
});

test('실저장소 — 화면이 「몇 칸이 비었나」를 스스로 센다(분모 없는 초록 금지)', (t) => {
  if (!fs.existsSync(정본)) return t.skip('정본 없음');
  const out = execFileSync(process.execPath, [TOOL], { cwd: ROOT, encoding: 'utf8' });
  assert.match(out, /이해 \d+칸 중 \d+칸이 비었다/, '몇 칸 중 몇 칸인지 안 말한다');
  const html = fs.readFileSync(산출, 'utf8');
  assert.ok(html.includes('비었다'), '빈 칸 표시가 화면에 없다');
  assert.ok(/<title>[^<]*v\d+\.\d+/.test(html), '정본 판 번호가 화면에 없다 — 낡은 화면을 못 알아본다');
});
