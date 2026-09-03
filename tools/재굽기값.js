/*
 * 재굽기 값 — 「이걸 다시 구우면 그림이 달라지나」를 굽기 «전»에 잰다 (2026-09-03).
 *
 * ■ 왜 생겼나
 *   09-03 밤에 트랙이 「② 화면 열넷 재굽기」를 남은 일감으로 들고 있어 클라우드 잡 14개를 띄웠다.
 *   띄우고 나서 재보니 **화면이 닿는 코드는 08-26 굽기 뒤 한 줄도 안 바뀌어 있었다**(0/14).
 *   같은 그림을 다시 낼 참이었다. 8분 만에 걷었지만, 그 8분은 «재보지 않아서» 태운 것이다.
 *   트랙 §0 은 여태 「🔴 안 굽는 것(≈1.5h 낭비)」을 **손으로 적은 목록**으로 들고 있었다 —
 *   손 목록은 코드가 바뀌어도 스스로 낡지 않는다. 그 자리를 기계로 바꾼다.
 *
 * ■ 재는 법
 *   기준 = 그 산출물이 «구워질 때»의 `요소굽기.py`(파일 mtime 직전 커밋 · `--기준` 으로 덮는다).
 *   그 판과 지금 판에서, 형태 함수가 **전이적으로 닿는 함수 집합**의 코드 줄(주석·docstring 제외)을
 *   맞대 본다. 속은 `tools/lib/파이썬닿기.py` 가 진다.
 *
 * ■ 이 자가 «못» 재는 것 — 초록을 믿기 전에 읽는다
 *   ① 모듈 최상위(무대·조명·렌더 설정)는 함수가 아니라 폐포에 안 잡힌다. 여기서는 그 구간이
 *      바뀌었으면 **줄 수만 세어 알린다** — 판정은 눈이 한다. 통째로 「다르다」로 접으면
 *      형태 하나 추가한 날 전량 재굽기가 뜨고, 그런 빨간불은 아무도 안 믿게 된다(늑대 소년).
 *   ② 인자로 갈리는 손잡이(`받침=`·`조명배=`·`샘플=`)는 코드가 같아도 그림이 갈린다.
 *      「같은 인자로 다시 구우면」이 이 자의 전제다.
 *   ③ 재료(`디자인_토큰.json`)가 바뀌면 색이 갈린다 — 그것도 같이 잰다.
 *   ④ mtime 은 «구운 시각»이지 «코드 시각»이 아니다. 굽는 중에 코드를 고치면 어긋난다
 *      (그래서 트랙 §0 이 「도는 중 요소굽기.py 안 고친다」를 든다).
 *
 * 쓰기:
 *   node tools/재굽기값.js --화면
 *   node tools/재굽기값.js --형태 폼폼,매듭 --산출 docs/캐릭터/요소공방_0822/부품/폼폼.png
 *   node tools/재굽기값.js --화면 --기준 2026-08-26T09:00
 */
'use strict';
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const 루트 = path.resolve(__dirname, '..');
const 굽기소스 = 'tools/요소굽기.py';
const 토큰소스 = 'docs/디자인_토큰.json';

const 인자 = {};
const 깃발 = new Set();
for (let i = 2; i < process.argv.length; i += 1) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const 이름 = a.slice(2);
  if (process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) { 인자[이름] = process.argv[i + 1]; i += 1; }
  else 깃발.add(이름);
}

/* ── 무엇을 잴 것인가 ─────────────────────────────────────────────────────── */
function 볼것들() {
  if (깃발.has('화면')) {
    const { 화면들 } = require('./lib/화면표.js');
    return 화면들.map((s) => ({
      형태: s.형태,
      산출: path.join('docs', '캐릭터', s.공방, `${s.그릇}.png`),
    }));
  }
  if (인자['형태']) {
    return 인자['형태'].split(',').map((f) => ({ 형태: f.trim(), 산출: 인자['산출'] || null }));
  }
  console.error('무엇을 잴지 준다 — `--화면` 이나 `--형태 이름[,이름]`');
  process.exit(1);
  return [];
}

/* ── 기준 커밋 — 「그 그림이 구워질 때의 코드」 ────────────────────────────────
 * 🔑 산출물마다 다르다(같은 배치라도 장마다 몇 분씩 벌어진다). 그래서 형태별로 따로 잡는다. */
function 기준커밋(산출) {
  if (인자['기준']) {
    // 커밋 지문이면 그대로, 시각이면 그 시각 직전 커밋
    if (/^[0-9a-f]{7,40}$/i.test(인자['기준'])) return 인자['기준'];
    return 직전커밋(인자['기준']);
  }
  if (!산출) return null;
  const p = path.join(루트, 산출);
  if (!fs.existsSync(p)) return null;
  return 직전커밋(new Date(fs.statSync(p).mtimeMs).toISOString());
}

function 직전커밋(iso, 경로 = 굽기소스) {
  const r = spawnSync('git', ['log', `--before=${iso}`, '-1', '--format=%H', '--', 경로],
    { cwd: 루트, encoding: 'utf8' });
  return (r.stdout || '').trim() || null;
}

function 옛소스(커밋, 경로) {
  const r = spawnSync('git', ['show', `${커밋}:${경로}`], { cwd: 루트, encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return null;
  return r.stdout.toString('utf8');
}

/* ── 재료의 «색값»만 견준다 — 이름 → hex 지도가 갈렸나 ────────────────────────── */
function 색지도(글) {
  const 지도 = new Map();
  const 훑 = (o) => {
    if (Array.isArray(o)) { o.forEach(훑); return; }
    if (o && typeof o === 'object') {
      if (typeof o.이름 === 'string' && typeof o.hex === 'string') 지도.set(o.이름, o.hex.toUpperCase());
      Object.values(o).forEach(훑);
    }
  };
  try { 훑(JSON.parse(글)); } catch (_) { return null; }
  return 지도;
}
function 색값다름(옛글, 새글) {
  if (옛글 === null) return false;              // 그 시점에 파일이 없었다 — 모르는 것은 경고하지 않는다
  const a = 색지도(옛글); const b = 색지도(새글);
  if (!a || !b) return 옛글 !== 새글;           // 못 파싱하면 보수적으로 글자 비교
  if (a.size !== b.size) return true;
  for (const [k, v] of a) if (b.get(k) !== v) return true;
  return false;
}

/* ── 최상위 코드 — 폐포가 못 보는 자리. 세기만 하고 판정은 눈에 넘긴다 ─────────── */
function 최상위줄(src) {
  const 줄 = src.split('\n');
  const 안쪽 = new Set();
  /* 🔴 `\w` 를 쓰면 안 된다 — JS 의 `\w` 는 [A-Za-z0-9_] 라 **한글 함수 이름을 못 잡는다**.
   *   이 파일의 함수는 전부 한글이라 그 정규식은 「최상위 def 0개」를 내고, 그러면 파일 전체가
   *   최상위로 세어져 「4,078줄이 바뀌었다」 같은 헛경보가 나온다(09-03 실측). 파이썬 쪽 `\w` 는
   *   유니코드를 받으므로 같은 무늬가 아니다 — 언어마다 다른 자를 쓴다는 것을 여기 적어 둔다.
   * 🔴 함수의 끝을 «다음 def» 로 잡으면 안 된다 — **마지막 def 가 파일 꼬리를 통째로 삼킨다**.
   *   이 파일의 꼬리는 형태들 딕셔너리·「받침=」·무대·조명·렌더 ≈200줄이고, 그게 함수 안으로
   *   접히면 최상위 비교가 «2줄»만 보게 된다(09-03 실측 — 안전망이 죽어 있었다).
   *   ⇒ 끝은 «들여쓰기가 0 으로 돌아오는 줄». 다음 def 도 그 규칙에 자동으로 걸린다. */
  for (let i = 0; i < 줄.length; i += 1) {
    if (!/^def [^\s(]+\s*\(/.test(줄[i])) continue;
    안쪽.add(i);
    for (let j = i + 1; j < 줄.length; j += 1) {
      if (줄[j].trim() && /^\S/.test(줄[j])) break;
      안쪽.add(j);
    }
  }
  return 줄.filter((l, i) => !안쪽.has(i) && l.trim() && !l.trim().startsWith('#'));
}

/* ── 잰다 ────────────────────────────────────────────────────────────────── */
const 볼것 = 볼것들();
const 지금소스 = fs.readFileSync(path.join(루트, 굽기소스), 'utf8');

/* 기준이 형태마다 갈리므로 커밋별로 묶어 파이썬을 한 번씩만 부른다. */
const 묶음 = new Map();
for (const it of 볼것) {
  const c = 기준커밋(it.산출);
  if (!묶음.has(c)) 묶음.set(c, []);
  묶음.get(c).push(it);
}

const 판정 = [];
for (const [커밋, 것들] of 묶음) {
  if (!커밋) {
    것들.forEach((it) => 판정.push({ ...it, 기준: null, 답: { reached: 0, changed: [], 기준없음: true } }));
    continue;
  }
  const 옛 = 옛소스(커밋, 굽기소스);
  if (옛 === null) {
    것들.forEach((it) => 판정.push({ ...it, 기준: 커밋, 답: { reached: 0, changed: [], 기준없음: true } }));
    continue;
  }
  /* 🔴 `PYTHONIOENCODING` 을 안 주면 파이썬이 stdin·stdout 을 이 기계 기본 코드페이지(CP949)로
   *   읽고 쓴다 ⇒ 넘긴 «한글 형태 이름»이 깨져 표에서 안 찾히고, 자는 「닿는 함수 0개 · 안 바뀜」을
   *   낸다. **그것이 곧 「굽지 마라」는 초록불**이라 조용히 틀린 쪽으로 넘어간다(09-03 실측). */
  const r = spawnSync('python', [path.join(루트, 'tools', 'lib', '파이썬닿기.py')], {
    cwd: 루트,
    input: JSON.stringify({ old: 옛, new: 지금소스, names: 것들.map((x) => x.형태) }),
    encoding: 'utf8',
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    maxBuffer: 64 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error('🔴 닿기 자가 죽었다 —', String(r.stderr || '').trim().split('\n').slice(-3).join(' | '));
    process.exit(1);
  }
  const 답들 = JSON.parse(r.stdout);
  것들.forEach((it) => 판정.push({ ...it, 기준: 커밋, 답: 답들[it.형태] }));

  /* 같은 기준에서 최상위·재료도 한 번씩 본다 */
  const 옛최 = 최상위줄(옛).join('\n');
  const 새최 = 최상위줄(지금소스).join('\n');
  묶음.get(커밋).최상위다름 = 옛최 !== 새최;
  묶음.get(커밋).최상위줄수 = [최상위줄(옛).length, 최상위줄(지금소스).length];
  /* 🔑 재료는 «글자»가 아니라 «값»으로 잰다 — 09-03 에 디자인_토큰.json 이 들여쓰기만 바뀌어
   *   (2칸→1칸) 3,689줄 diff 가 났다. 텍스트로 대면 「색이 갈렸다」가 뜨지만 hex 변경은 0건이었다.
   *   그런 경고가 한 번 뜨면 다음부터 아무도 이 줄을 안 읽는다. 굽기가 읽는 것은 hex 다. */
  묶음.get(커밋).재료다름 = 색값다름(옛소스(커밋, 토큰소스), fs.readFileSync(path.join(루트, 토큰소스), 'utf8'));
}

/* ── 낸다 ────────────────────────────────────────────────────────────────── */
const 짧 = (c) => (c ? c.slice(0, 9) : '없음');
console.log(`\n■ 재굽기 값 — ${볼것.length}개 형태`);
let 값있음 = 0;
for (const p of 판정) {
  const 바뀜 = p.답.changed || [];
  /* 🔑 「닿음 0」은 «안 바뀜»이 아니라 «못 쟀음»이다 — 형태 함수는 적어도 자기 자신에 닿으므로
   *   1 미만이면 이름을 못 찾은 것이다. 그걸 「같다」로 접으면 자가 굽기를 거짓으로 막는다. */
  const 못쟀나 = p.답.기준없음 || p.답.missing || !p.답.reached;
  const 판 = 못쟀나 ? '❔ 못 쟀다 — 굽기를 막지 않는다' : (바뀜.length ? `🔁 달라진다 (${바뀜.slice(0, 4).join(', ')}${바뀜.length > 4 ? ` 외 ${바뀜.length - 4}` : ''})` : '⏸ 같다');
  if (바뀜.length || 못쟀나) 값있음 += 1;
  console.log(`  ${p.형태.padEnd(14)} 닿음 ${String(p.답.reached).padStart(3)}  기준 ${짧(p.기준)}  ${판}`);
}
for (const [커밋, 것들] of 묶음) {
  if (것들.최상위다름) {
    const [a, b] = 것들.최상위줄수;
    console.log(`  ⚠ 기준 ${짧(커밋)} — 모듈 최상위 코드가 바뀌었다(${a} → ${b}줄). 폐포가 못 보는 자리다 —`);
    console.log('     새 형태 등록·새 인자 블록이면 이 형태들과 무관하다. 눈으로 한 번 본다:');
    console.log(`     git diff ${짧(커밋)} HEAD -- ${굽기소스} | grep -E "^[+-][^+ -]"`);
  }
  if (것들.재료다름) console.log(`  ⚠ 기준 ${짧(커밋)} — ${토큰소스} 가 그 뒤 바뀌었다(색이 갈릴 수 있다).`);
}
console.log(`\n  → 다시 구울 값이 있는 것: ${값있음}/${볼것.length}`);
process.exit(값있음 ? 0 : 0);
