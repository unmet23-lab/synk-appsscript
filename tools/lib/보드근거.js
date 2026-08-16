'use strict';
/* 보드 근거 — 「이 죽은 줄, 정말 끝났나」의 **근거 후보**를 모아 내민다 (대기열 #Q93 ㉡).
 *
 * 왜 있나 (2026-08-16 · `local_86d6d162` · ㉠ 2차를 손으로 끝낸 직후):
 *   `board-move` 원칙⑦은 죽은 줄을 거절하며 「실측했으면 `--미완확인` 에 근거를 달아라」라고
 *   한다. 그 처방은 **옳은데 아무도 안 쓴다** — 근거를 캐는 값이 비싸서다(#Q93 1차가 실측으로
 *   그렇게 적었다: 「사람이 치우지 못한 이유는 판단력이 아니라 그 셋을 찾아 도는 비용」).
 *   ㉠ 2차에서 6줄을 손으로 처분하며 **무엇이 비쌌는지**를 셌다. 셋뿐이었고 셋 다 in-repo 다:
 *     ① 다른 보드 줄이 이 줄의 지문을 「승계」라고 적어 뒀다 (`ba06ef23·79dc9bfd 승계`)
 *     ② 이 줄의 「만질 파일」 경로에 **남의 세션**이 그 뒤로 커밋했다 (`tools/펠트문서.js` → v0.3)
 *     ③ 이 줄의 `#Qnn` 을 제목에 단 커밋이 자기·형제 저장소에 났다 (`[대기열 P1 #Q38]`)
 *   그래서 이 파일은 그 셋만 모은다.
 *
 * 🔑 **후보지 판정이 아니다.** 제목에 토큰이 우연히 겹칠 수 있고, 같은 경로를 만지는 다른
 *   트랙의 커밋도 걸린다. 그래서 `--미완확인` 사유는 **여전히 사람이 손으로 쓴다** — 이 목록은
 *   「어디를 열어라」까지고, 여는 것과 판정은 사람 몫이다(#Q93 이 ㉡ 범위를 그렇게 못박았다:
 *   「근거 후보를 붙여 내미는 데까지 · 이관 자체는 사람이 남긴다」 — 자동 이관은 F240 을 되살린다).
 *
 * 🔑 **틀릴 때의 모습**(새 장치의 대가 · CLAUDE.md 신뢰성 ④): 이 목록이 비면 「끝난 증거가
 *   없다」로 읽히기 쉬운데, 실제로는 **증거가 repo 밖에 있는 경우**가 흔하다(유호님 답은 메모리·
 *   대화에만 남는다 — ㉠ 2차의 `48a93cf9`·`8a244e32` 가 정확히 그랬다). 그래서 빈 목록에는
 *   「0건」이 아니라 **어디를 못 봤는지**를 함께 적는다. 반대 방향(후보가 있는데 실은 남의 트랙
 *   커밋)은 사람이 열면 즉시 갈리므로 미탐보다 싸다.
 *
 * 🔑 **못 잼과 0건을 가른다**(F207) — git 이 죽거나 시간초과면 `null` 이다. 빈 배열로 뭉개면
 *   「후속 커밋이 없다」로 읽혀 미완 줄이 완료의 얼굴로 나간다(원칙⑦이 막는 바로 그 사고).
 *
 * 🔑 **훅에는 안 건다.** `board-guard` 도 죽은 줄 목록을 내밀지만 그쪽은 보드를 쓸 때마다 돈다 —
 *   git 호출을 거기 얹으면 세션 시작·모든 보드 편집이 느려진다(세션 시작 벽시계 3~27초가 이미
 *   실측된 자리다). 이 수집은 **사람이 그 판단 앞에 실제로 서 있는 순간**(board-move 거절)에만 돈다.
 *   ⇒ 같은 판정을 두 곳에 안 적는다는 규칙과 충돌하지 않는다: 판정(누가 죽은 줄인가)은 여전히
 *   `보드lib` 하나에서 오고, 여기 있는 것은 **근거 수집**이라 층이 다르다.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const 표 = require('./표.js');
const 보드lib = require('./보드.js');

const 경로상한 = 4;      // git 호출 수 = 경로상한 + 번호상한(+형제) — 사람이 기다리는 자리라 묶어 둔다
const 번호상한 = 2;
const 커밋상한 = 3;

/** 기본 git 실행기 — 실패·시간초과는 `null`(못 쟀다)이고 빈 출력은 `''`(0건)이다. */
function 기본git(cwd) {
  return (args) => {
    try {
      return execFileSync('git', ['-c', 'core.quotepath=false', ...args], {
        cwd, encoding: 'utf8', timeout: 6000, stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch (_) { return null; }
  };
}

/* 커밋 한 줄 = `해시\t날짜\t제목\t세션지문` — 지문은 `prepare-commit-msg` 훅이 박는 트레일러라
 * **주인을 추정하지 않고 읽는다**(F041). 이게 이 수집의 급소다: 같은 경로에 난 커밋이라도
 * «남의 세션»이 낸 것만 「누가 이어서 했다」의 증거가 된다. */
const 서식 = '--format=%h\t%ad\t%s\t%(trailers:key=Session-Id,valueonly)';

function 커밋파싱(출력, 내지문) {
  if (출력 === null) return null;
  return 출력.split('\n').map((l) => l.trimEnd()).filter(Boolean).map((l) => {
    const [해시, 날짜, 제목, 지문raw] = l.split('\t');
    const 지문 = String(지문raw || '').trim().replace(/^local_/, '').slice(0, 8);
    return { 해시, 날짜, 제목: String(제목 || ''), 지문, 남의것: !!지문 && 지문 !== 내지문 };
  });
}

/** 「만질 파일」 칸에서 실제로 찾아볼 경로만 — 🚫비켜남 조각은 `만지는텍스트` 가 이미 뗀다. */
function 경로뽑기(파일칸) {
  const 산것 = 보드lib.만지는텍스트(파일칸);
  const 본것 = new Set();
  for (const raw of String(산것).split(/[\s·,()|]+/)) {
    /* ⚠ 백틱만 뗀다 — `*` 를 함께 떼면 `docs/엔진/*.html` 이 `docs/엔진/.html` 이 되어
     *   아래 글로브 절단이 **찾을 게 없어지고**, 있지도 않은 경로로 git 을 부른다(회귀가 잡았다). */
    let t = raw.replace(/`+/g, '').trim();
    if (!t.includes('/')) continue;
    /* 글로브·중괄호는 디렉터리까지만 — `docs/엔진/*.html` 은 `docs/엔진` 으로 본다. */
    const 별 = t.search(/[*{]/);
    if (별 >= 0) t = t.slice(0, 별);
    t = t.replace(/^\.\//, '').replace(/\/+$/, '').replace(/[.,·]+$/, '');
    if (!t || t.length < 3 || /^https?:/.test(t)) continue;
    본것.add(t);
    if (본것.size >= 경로상한) break;
  }
  return [...본것];
}

/** 열린 장부 번호들 — 못 부르면 `null`(「열린 게 없다」와 다르다). */
function 열림장부(root) {
  try {
    const out = execFileSync(process.execPath, [path.join(root, 'tools', 'friction.js'), '--open'],
      { cwd: root, encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] });
    return (out.match(/\bF\d{2,4}\b/g) || []);
  } catch (_) { return null; }
}

/** 상태 칸에 백틱으로 박힌 커밋 해시 — 사람이 「이건 `abc1234` 로 닫았다」라고 적어 둔 것. */
function 해시뽑기(상태칸) {
  const 본것 = [];
  const re = /`([0-9a-f]{7,40})`/g;
  let m;
  while ((m = re.exec(String(상태칸 || ''))) && 본것.length < 6) {
    if (!본것.includes(m[1])) 본것.push(m[1]);
  }
  return 본것;
}

/** 상태 칸의 장부 번호 `F123`. 열림 목록에 없으면 그 조각은 이미 처분된 것이다. */
function F번호뽑기(상태칸) {
  const 본것 = [];
  const re = /\bF(\d{2,4})\b/g;
  let m;
  while ((m = re.exec(String(상태칸 || ''))) && 본것.length < 6) {
    const n = 'F' + m[1];
    if (!본것.includes(n)) 본것.push(n);
  }
  return 본것;
}

/** 트랙 칸의 `#Qnn` — 대기열 번호는 이 저장소에서 유일한 **조인 키**다(#Q93 도전안이 짚은 그 키). */
function 번호뽑기(트랙칸) {
  const 본것 = [];
  const re = /#Q\d{1,4}/g;
  let m;
  while ((m = re.exec(String(트랙칸 || ''))) && 본것.length < 번호상한) {
    if (!본것.includes(m[0])) 본것.push(m[0]);
  }
  return 본것;
}

/**
 * @param {string} row  보드 표 한 줄
 * @param {{root?:string, 지문?:string, git?:Function, 형제?:string}} opts
 * @returns {{승계:Array, 경로:Array|null, 번호:Array|null, 못본곳:string[]}}
 */
function 근거후보(row, opts = {}) {
  const root = opts.root || path.resolve(__dirname, '..', '..');
  const 지문 = String(opts.지문 || '').slice(0, 8);
  const git = opts.git || 기본git(root);
  const 칸 = 표.칸나누기(row);
  const 날짜 = (칸[0] || '').trim();
  const 트랙칸 = 칸[1] || '';
  const 파일칸 = 칸[2] || '';
  const 상태칸 = 칸.slice(-1)[0] || '';
  const since = /^\d{4}-\d{2}-\d{2}$/.test(날짜) ? ['--since', 날짜] : [];

  /* ① 승계 — 다른 보드 줄이 이 줄의 지문을 인용했나. git 을 안 쓰므로 늘 돈다. */
  const 승계 = [];
  if (지문) {
    /* `줄들` 을 쓴다 — 유령(규격 밖) 줄은 칸을 못 가르므로 발췌가 통째로 어긋난다.
     * 폴더를 못 읽으면 `null` 이고 그건 「승계 0」과 다르다 → 못본곳에 적힌다. */
    const 전부 = 보드lib.줄들(root);
    if (전부 === null) 승계.못읽음 = true;
    for (const r of 전부 || []) {
      if (r.파일 === `${지문}.md`) continue;
      if (!r.줄.includes(지문)) continue;
      const 상태 = (표.칸나누기(r.줄).slice(-1)[0] || '').trim();
      승계.push({ 파일: r.파일, 발췌: 상태.slice(0, 110) });
      if (승계.length >= 3) break;
    }
  }

  /* ② 경로 — 이 줄이 만진다고 적은 자리에 그 뒤로 «남이» 커밋했나. */
  /* ⚠ 빈 배열은 **「찾을 게 없었다」**이고 `null` 은 **「못 쟀다」**다 — 첫 판이 둘을 뭉쳐
   * 경로 표기가 없는 줄에도 「git 실패」를 냈다(못본곳은 동시에 「경로 표기가 없다」라고 적어
   * 두 말이 정면으로 어긋났다). 실사용 첫 호출이 잡았다 — F207 이 말하는 그 자리다. */
  const 경로들 = 경로뽑기(파일칸);
  let 경로 = [];
  for (const p of 경로들) {
    const 줄들 = 커밋파싱(git(['log', 서식, '--date=short', `-${커밋상한}`, ...since, '--', p]), 지문);
    if (줄들 === null) { 경로 = null; break; }      // 하나라도 못 재면 통째로 「못 쟀다」
    if (줄들.length) 경로.push({ 경로: p, 커밋: 줄들 });
  }

  /* ③ 번호 — `#Qnn` 을 제목에 단 커밋(자기 + 형제 저장소). 형제가 없으면 그 갈래만 건너뛴다. */
  const 번호들 = 번호뽑기(트랙칸);
  let 번호 = [];
  const 형제 = opts.형제 === undefined ? path.resolve(root, '..', 'SYNK-talk') : opts.형제;
  const 형제있음 = !!형제 && (() => { try { return fs.existsSync(path.join(형제, '.git')); } catch (_) { return false; } })();
  for (const q of 번호들) {
    for (const [이름, cwd] of [['as', root], ['talk', 형제있음 ? 형제 : null]]) {
      if (!cwd) continue;
      const 실행 = cwd === root ? git : (opts.git || 기본git(cwd));
      const 줄들 = 커밋파싱(실행(['log', 서식, '--date=short', `-${커밋상한}`, ...since, '--grep', q]), 지문);
      if (줄들 === null) { 번호 = null; break; }
      if (줄들.length) 번호.push({ 번호: q, 저장소: 이름, 커밋: 줄들 });
    }
    if (번호 === null) break;
  }

  /* ④ 해시 — 상태 칸에 「이건 `abc1234` 로 닫았다」라고 적힌 것이 **정말 HEAD 조상인가**.
   * `a92e1e36` 이 ㉠ 2차에서 실제로 쓴 첫 재료다(대기열 #Q93). 조상이 아니면 그 조각은
   * 아직 이 가지에 안 왔다는 뜻이고, 그건 「끝났다」의 **반증**이라 후보보다 값이 크다. */
  const 해시들 = 해시뽑기(상태칸);
  let 해시 = [];
  for (const h of 해시들) {
    const 있나 = git(['cat-file', '-e', `${h}^{commit}`]);
    if (있나 === null) { 해시.push({ 해시: h, 판정: '없음', 말: '이 저장소에 없다(형제 저장소 커밋일 수 있다)' }); continue; }
    const 조상 = git(['merge-base', '--is-ancestor', h, 'HEAD']);
    해시.push(조상 === null
      ? { 해시: h, 판정: '아님', 말: '**HEAD 조상이 아니다** — 그 조각은 이 가지에 아직 안 왔다' }
      : { 해시: h, 판정: '조상', 말: 'HEAD 조상 — 그 조각은 착지했다' });
  }

  /* ⑤ 장부 — 상태 칸이 인 `F번호` 가 **열림 목록에 남아 있나**. 남아 있으면 미완의 증거다. */
  const F들 = F번호뽑기(상태칸);
  let 장부 = [];
  if (F들.length) {
    const 열림 = opts.열림 !== undefined ? opts.열림 : 열림장부(root);
    if (열림 === null) 장부 = null;
    else for (const f of F들) 장부.push({ 번호: f, 열림: 열림.includes(f) });
  }

  /* 빈 목록을 「끝난 증거 0」으로 읽지 않게 **못 본 곳**을 함께 낸다(위 머리말 세 번째 🔑). */
  const 못본곳 = ['유호님 답(메모리·대화 — repo 밖이라 여기선 원리상 안 보인다)'];
  if (승계.못읽음) 못본곳.push('보드 폴더를 못 읽었다 — 승계 갈래는 「0건」이 아니라 미측정이다');
  if (!경로들.length) 못본곳.push('만질 파일 칸에 경로 표기가 없다 — 그 트랙 파일을 직접 찾아야 한다');
  if (!번호들.length) 못본곳.push('트랙 칸에 `#Qnn` 이 없다 — 대기열과 이을 조인 키가 없다');
  if (!형제있음) 못본곳.push('형제 저장소(SYNK-talk)를 못 열었다');
  if (!해시들.length) 못본곳.push('상태 칸에 커밋 해시 표기가 없다 — 「무엇으로 닫았나」를 기계가 못 짚는다');
  if (장부 === null) 못본곳.push('장부 열림 목록을 못 읽었다 — F번호 갈래는 미측정이다');

  return { 승계, 경로, 번호, 해시, 장부, 못본곳 };
}

/** 사람이 그대로 읽을 블록. 후보가 하나도 없으면 **「없다」와 못 본 곳**을 낸다. */
function 근거글(결과, { 들여쓰기 = '  ' } = {}) {
  const L = [];
  const 줄 = (s) => L.push(들여쓰기 + s);
  const 커밋줄 = (c) => `${들여쓰기}      · ${c.해시} ${c.날짜} ${c.제목.slice(0, 84)}`
    + (c.남의것 ? `  ← 남의 세션 ${c.지문}` : c.지문 ? '  ← 이 줄 주인 자신' : '');

  줄('▣ 근거 **후보** — 판정이 아니다. 열어 보고 사유는 손으로 쓴다.');
  if (결과.승계.length) {
    줄('  ① 다른 보드 줄이 이 지문을 인용했다(승계 선언일 수 있다):');
    for (const s of 결과.승계) 줄(`      · ${s.파일} — ${s.발췌}`);
  }
  if (결과.경로 === null) 줄('  ② 경로 후속 커밋 — **못 쟀다**(git 실패·시간초과 · 0건이 아니다)');
  else if (결과.경로.length) {
    줄('  ② 이 줄이 만진다고 적은 경로에 난 그 뒤 커밋:');
    for (const g of 결과.경로) { 줄(`      ${g.경로}`); for (const c of g.커밋) L.push(커밋줄(c)); }
  }
  if (결과.번호 === null) 줄('  ③ 번호 커밋 — **못 쟀다**(git 실패·시간초과 · 0건이 아니다)');
  else if (결과.번호.length) {
    줄('  ③ 이 줄의 대기열 번호를 제목에 단 커밋:');
    for (const g of 결과.번호) { 줄(`      ${g.번호} (${g.저장소})`); for (const c of g.커밋) L.push(커밋줄(c)); }
  }
  if (결과.해시 && 결과.해시.length) {
    줄('  ④ 상태 칸이 「이걸로 닫았다」라고 적은 커밋 — 정말 HEAD 조상인가:');
    for (const h of 결과.해시) 줄(`      · ${h.해시} ${h.판정 === '조상' ? '✔' : '✖'} ${h.말}`);
  }
  if (결과.장부 === null) 줄('  ⑤ 장부 F번호 — **못 쟀다**(열림 목록을 못 읽었다 · 0건이 아니다)');
  else if (결과.장부 && 결과.장부.length) {
    줄('  ⑤ 상태 칸이 인 장부 번호 — 아직 열려 있나:');
    for (const f of 결과.장부) 줄(`      · ${f.번호} ${f.열림 ? '🔴 아직 열림 — 미완의 증거다' : '✔ 열림 목록에 없다'}`);
  }
  const 있나 = 결과.승계.length || (결과.경로 && 결과.경로.length) || (결과.번호 && 결과.번호.length)
    || (결과.해시 && 결과.해시.length) || (결과.장부 && 결과.장부.length);
  if (!있나) 줄('  후보 0건 — 「끝났다」가 아니라 **여기서는 안 보인다**이다.');
  for (const m of 결과.못본곳) 줄(`  ⌀ 못 본 곳: ${m}`);
  return L.join('\n');
}

module.exports = { 근거후보, 근거글, 경로뽑기, 번호뽑기, 해시뽑기, F번호뽑기, 열림장부, 기본git };
