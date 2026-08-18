#!/usr/bin/env node
'use strict';
/* 환경 대조 — 「이 검사의 답을 코드가 정하나, 기계가 정하나」를 **조건을 하나씩 바꿔** 잰다.
 *
 * ■ 왜 있나 (F617 · 대기열 #Q115)
 *   2026-08-18 실측: 같은 커밋의 같은 스위트를 유호님 노트북은 「4511 fail0」·「4515 fail1」로,
 *   ubuntu 컨테이너는 「4519 fail3」으로 쟀다. 셋 다 repo 밖 환경(플랫폼·홈·git ref 집합)에
 *   기댄 검사였고, 정본 F296 이 이미 금지한 형태였다. 그런데 **그런 검사가 몇 벌인지는 아무도
 *   안 세고 있었다** — 떨어진 셋은 「이 환경에서 떨어진 것」일 뿐 분모가 아니다.
 *
 * ■ 왜 「두 기계의 런을 diff」가 아니라 이 모양인가
 *   기계 대 기계 diff 는 축이 **한꺼번에** 바뀐다(윈도우 + KST + 로컬 ref + 형제 저장소 + 바탕화면).
 *   뒤집힌 검사가 나와도 «무엇 때문에» 뒤집혔는지 못 말한다 — 정본 「원인 판정은 조건을 하나씩
 *   바꿔 대조한다」를 정면으로 어기는 설계다. 여기서는 한 축만 흔들고 나머지는 얼린다.
 *
 * ■ 이 도구가 «못» 재는 축 — 억지로 넓히지 않고 이름을 댄다(F348)
 *   · **플랫폼**(`path.sep`·`process.platform`). 리눅스에서 윈도우 문법을 못 만든다.
 *     그 축은 유호님 기계에서 `--기준만` 한 번 돌려 파일로 주면 `--대조` 가 낸다.
 *   · **메모리 정본**·**형제 저장소**의 «내용». 있으면/없으면은 흔들 수 있어도, 진짜 내용을
 *     지어내면 그건 실측이 아니라 픽스처다.
 *
 * ■ 쓰는 법
 *   node tools/환경대조.js                     기준 + 모든 축
 *   node tools/환경대조.js --축 시간대,홈        고른 축만
 *   node tools/환경대조.js --기준만 내판.json     이 기계의 판을 파일로 (다른 기계에 넘길 때)
 *   node tools/환경대조.js --대조 내판.json       남이 준 판과 이 기계를 대조
 *   node tools/환경대조.js --목록                축 목록만 보고 끝낸다
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { 인자게이트 } = require('./lib/인자게이트.js');

const ROOT = path.resolve(__dirname, '..');

/* ── 순수 층 — 관측 → 판정. 픽스처가 탐지력을 진다(F543 계보) ───────────────── */

/**
 * TAP 본문 → `Map<검사이름, 상태[]>`.
 * 🔑 **키는 이름이다** — `node --test` 는 파일을 병렬로 돌려 번호가 회차마다 갈리고,
 *   출력에 파일 이름이 안 실린다. 같은 이름이 둘 이상이면 배열로 **모아** 둔다(접지 않는다):
 *   접으면 「한쪽만 뒤집힌 판」이 조용히 사라진다.
 */
function 읽기(tap) {
  const out = new Map();
  for (const 줄 of String(tap || '').split(/\r?\n/)) {
    const m = /^(not ok|ok) \d+ - (.*)$/.exec(줄.trim());
    if (!m) continue;
    let 이름 = m[2];
    let 상태 = m[1] === 'ok' ? '통과' : '실패';
    const skip = /\s+#\s+SKIP\b/i.exec(이름);
    if (skip) { 상태 = '건너뜀'; 이름 = 이름.slice(0, skip.index); }
    이름 = 이름.trim();
    if (!이름) continue;
    if (!out.has(이름)) out.set(이름, []);
    out.get(이름).push(상태);
  }
  return out;
}

/** 상태 배열을 견줄 수 있는 한 낱말로 (순서는 회차마다 갈리므로 정렬한다). */
const 묶음 = (arr) => [...arr].sort().join('+');

/**
 * 뒤집힘 한 건의 **성격**. 🔑 이 갈래가 없으면 이 도구가 늑대를 부른다 — 실측 2026-08-18:
 *   메모리 축 5건·refs 축 1건이 전부 「건너뜀 ↔ 통과」였고, 그건 결함이 아니라 정본 F296 규율이
 *   («실저장소 검사는 fail 아닌 skip 으로 드러낸다») **제대로 도는 모습**이다. 같은 줄에 섞어 내면
 *   진짜 하나(통과↔실패)가 여섯 속에 묻힌다.
 *   · `판정뒤집힘` — 통과 ↔ 실패. **답을 기계가 정했다.** 이것만이 고칠 것이다.
 *   · `실행바뀜`   — 건너뜀이 끼었다. 이 기계에선 그 검사가 돌고 저 기계에선 안 돈다(커버리지 차이).
 */
function 성격(기준, 변형) {
  return (기준.includes('건너뜀') || 변형.includes('건너뜀')) ? '실행바뀜' : '판정뒤집힘';
}

/**
 * 두 판을 견준다. **순수 함수**다.
 * @returns {{판정뒤집힘:object[], 실행바뀜:object[], 한쪽에만:{이름,어디}[], 기준분모:number, 변형분모:number}}
 *   · `한쪽에만` — 한 판에만 있는 검사(파일이 안 돌았거나 이름이 바뀌었다). 「같다」로 접지 않는다(F207)
 */
function 대조(기준, 변형) {
  const 판정뒤집힘 = []; const 실행바뀜 = []; const 한쪽에만 = [];
  for (const [이름, a] of 기준) {
    const b = 변형.get(이름);
    if (b === undefined) { 한쪽에만.push({ 이름, 어디: '기준에만' }); continue; }
    const ka = 묶음(a); const kb = 묶음(b);
    if (ka === kb) continue;
    (성격(ka, kb) === '판정뒤집힘' ? 판정뒤집힘 : 실행바뀜).push({ 이름, 기준: ka, 변형: kb });
  }
  for (const 이름 of 변형.keys()) if (!기준.has(이름)) 한쪽에만.push({ 이름, 어디: '변형에만' });
  return { 판정뒤집힘, 실행바뀜, 한쪽에만, 기준분모: 기준.size, 변형분모: 변형.size };
}

/* ── 축 — 무엇을 하나씩 흔드나 ─────────────────────────────────────────────── */

/** 임시 홈 하나. `유호님 기계 모양`(바탕화면 둘)을 세운다 — 내용은 안 지어낸다. */
function 홈세우기() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-축-홈-'));
  fs.mkdirSync(path.join(d, 'Desktop'), { recursive: true });
  fs.mkdirSync(path.join(d, 'OneDrive', 'Desktop'), { recursive: true });
  return d;
}

const 축들 = [
  {
    이름: '시간대',
    설명: 'TZ=UTC(CI) → Asia/Seoul(유호님 기계). 날짜·월 계산이 갈리는 자리를 낸다.',
    환경: () => ({ TZ: 'Asia/Seoul' }),
  },
  {
    이름: '홈',
    설명: '빈 홈(CI) → 바탕화면이 있는 홈. 「폴더가 없으면 skip」 절이 실제로 갈리는지 본다.',
    환경: () => { const d = 홈세우기(); return { HOME: d, USERPROFILE: d, __치울것: d }; },
  },
  {
    이름: '메모리',
    설명: 'SYNK_MEMORY_DIR 없음(CI) → 빈 디렉터리로 지정. 「메모리층이 있나」만 흔든다(내용은 안 지어낸다).',
    환경: () => {
      const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-축-메모리-'));
      return { SYNK_MEMORY_DIR: d, __치울것: d };
    },
  },
  {
    이름: 'refs',
    설명: '이 체크아웃의 ref 전부 → master 한 벌만(단일 가지 클론). F617 이 정확히 이 축이었다.',
    클론: true,
  },
];

/* ── 실행 층 ───────────────────────────────────────────────────────────────── */

/** 그 뿌리의 시험 파일 목록(상대 경로). */
function 시험파일들(뿌리) {
  const d = path.join(뿌리, 'tests');
  return fs.readdirSync(d).filter((f) => f.endsWith('.test.js')).map((f) => path.join('tests', f));
}

/**
 * 한 판 돌리기. 기준 환경은 `lib/ci모사환경.js` **한 벌**에서 온다(F389 — 조리법을 두 곳에 안 적는다).
 * @param {object} 덮개 이 축이 바꿀 환경 변수만. 나머지는 얼린다.
 */
function 돌리기(뿌리, 덮개 = {}) {
  const 모사 = require('./lib/ci모사환경.js').만들기();
  const env = { ...모사.env };
  const 치울것 = [];
  for (const [k, v] of Object.entries(덮개)) {
    if (k === '__치울것') { 치울것.push(v); continue; }
    env[k] = v;
  }
  const files = 시험파일들(뿌리);
  const r = spawnSync(process.execPath, ['--test', ...files], {
    cwd: 뿌리, env, encoding: 'utf8', maxBuffer: 1 << 28,
  });
  모사.치우기();
  for (const d of 치울것) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* 임시라 OS 가 마저 치운다 */ } }
  /* 🔑 종료코드가 아니라 **본문**을 판정 재료로 쓴다 — 스폰 자체가 실패하면 본문이 비고,
   *   빈 본문을 「검사 0건」으로 접으면 그게 곧 「뒤집힘 0」이 되어 통과와 같은 모양이 된다(F207). */
  const 판 = 읽기(r.stdout || '');
  if (!판.size) {
    죽기(`판이 비었다(${뿌리}) — 스위트가 안 돌았다. 「뒤집힘 0」과 같은 모양이라 여기서 멈춘다.`,
      (r.stderr || '').split('\n').slice(0, 6).join('\n'));
  }
  return 판;
}

/** `refs` 축 — 단일 가지 클론. **한 축만 바꾸려면 내용이 같아야 한다**(F045). */
function 클론뿌리() {
  const 더러움 = spawnSync('git', ['-C', ROOT, 'status', '--porcelain'], { encoding: 'utf8' });
  if ((더러움.stdout || '').trim()) {
    죽기('작업본이 더럽다 — 클론은 커밋된 것만 담으므로 «ref 집합»과 «내용» 두 축이 같이 바뀐다.',
      '먼저 커밋하고 다시 부른다(조건은 하나씩 바꾼다).');
  }
  const 가지 = spawnSync('git', ['-C', ROOT, 'rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' });
  const 이름 = (가지.stdout || '').trim();
  if (!이름 || 이름 === 'HEAD') 죽기('detached HEAD 다 — 클론할 가지 이름이 없다.');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-축-refs-'));
  const 뿌리 = path.join(d, 'clone');
  const r = spawnSync('git', ['clone', '--quiet', '--single-branch', '--branch', 이름, '--no-hardlinks', ROOT, 뿌리], { encoding: 'utf8' });
  if (r.status !== 0) 죽기('클론 실패', (r.stderr || '').slice(0, 400));
  /* 내용이 같은지 확인한다 — 안 하면 「ref 만 바꿨다」가 선언일 뿐 실측이 아니다. */
  const 여기 = spawnSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const 저기 = spawnSync('git', ['-C', 뿌리, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  if (여기 !== 저기) 죽기(`클론 HEAD 가 다르다(${여기.slice(0, 8)} ≠ ${저기.slice(0, 8)}) — 두 축이 같이 바뀐다.`);
  return { 뿌리, 치울것: d };
}

/**
 * 기준을 **여러 번** 떠서 «회차 내내 같은 답을 낸 검사»만 남긴다 → `{기준, 흔들린}`.
 *
 * 🔴 왜 있나 (실측 2026-08-18 · `local_3dd52c55`)
 *   기준을 한 번만 뜨면 **기준의 flaky 한 판정이 «모든 축»의 뒤집힘으로 나온다.** 실측:
 *   `tests/보드주인.test.js` 의 한 검사가 기준 1회차에서만 빨갰고, 그 결과 재던 **네 축 전부**가
 *   「실패 → 통과 1건」을 보고했다 — 축이 하나도 안 갈렸는데 갈렸다고 말한 것이다. 그 검사는
 *   홀로 돌리면 8/8 초록이고 전량 실행 중 «가끔» 빨개진다(세션 박동 신선도 · F315 계열).
 *   👉 이 도구가 내는 값은 `판정뒤집힘` 이고 그게 곧 「고칠 것」이라, 거짓 뒤집힘 하나가
 *      사람을 없는 축으로 보낸다. 새는 방향이 여기서는 「고쳐라」다.
 *
 * 🔑 흔들린 것은 **빼되 조용히 빼지 않는다** — 안 세고 넘어가면 분모가 몰래 준다(F207).
 *   그리고 그것은 «축»이 아니라 «flaky» 라, 고칠 자리도 다르다.
 *
 * 🔑 `돌림` 은 회귀용 이음매다 — 실동작 한 판이 스위트 전량이라 픽스처로는 못 돌린다.
 * ⚠ 대가: 기준을 N 번 도니 그만큼 느리다(스위트 한 판 ≈ 2분). `--기준회차 1` 로 끌 수 있고,
 *   껐을 때는 위 실측이 그대로 돌아온다 — 그래서 기본값은 2다.
 */
function 안정기준(뿌리, 회차, 돌림 = 돌리기, 알림 = console.log) {
  const 기준 = 돌림(뿌리);
  const 흔들린 = [];
  for (let i = 1; i < 회차; i += 1) {
    알림(`[환경대조] 기준 안정성 확인 ${i}/${회차 - 1} — 기준의 flaky 는 «모든 축»의 뒤집힘으로 새어 나온다`);
    const 또 = 돌림(뿌리);
    for (const [이름, v] of [...기준]) {
      const b = 또.get(이름);
      if (!b || 묶음(v) !== 묶음(b)) {
        흔들린.push({ 이름, 답들: [묶음(v), b ? 묶음(b) : '없음'] });
        기준.delete(이름);
      }
    }
  }
  return { 기준, 흔들린: 흔들린.filter((x, i, a) => a.findIndex((y) => y.이름 === x.이름) === i) };
}

function 죽기(말, 덧 = '') {
  console.error(`\n🔴 ${말}`);
  if (덧) console.error(덧.split('\n').map((l) => `   ${l}`).join('\n'));
  process.exit(1);
}

/* ── 화면 ──────────────────────────────────────────────────────────────────── */

function 찍기(제목, r) {
  console.log(`\n── ${제목}`);
  console.log(`   분모: 기준 ${r.기준분모}검사 · 변형 ${r.변형분모}검사`);
  if (r.한쪽에만.length) {
    console.log(`   ⚠ 한쪽에만 있는 검사 ${r.한쪽에만.length}건 — 파일이 안 돌았거나 이름이 바뀌었다(「같다」로 안 접는다):`);
    for (const x of r.한쪽에만.slice(0, 5)) console.log(`      · [${x.어디}] ${x.이름}`);
    if (r.한쪽에만.length > 5) console.log(`      · … 외 ${r.한쪽에만.length - 5}건`);
  }
  /* 실행바뀜을 «먼저» 낸다 — 개수가 보통 더 많은데, 아래 판정뒤집힘이 화면 끝에 남아야 눈에 든다. */
  if (r.실행바뀜.length) {
    console.log(`   ℹ 실행 여부만 바뀐 검사 ${r.실행바뀜.length}건 — **결함이 아니다**(F296 규율이 도는 모습):`);
    for (const x of r.실행바뀜) console.log(`      · ${x.기준} → ${x.변형}   ${x.이름}`);
  }
  if (!r.판정뒤집힘.length) { console.log('   ✅ 판정이 뒤집힌 검사 0 — 이 축은 «답»을 안 바꾼다'); return; }
  console.log(`   🔴 **판정이 뒤집힌 검사 ${r.판정뒤집힘.length}건** — 이 축이 답을 정한다(고칠 것은 여기다):`);
  for (const x of r.판정뒤집힘) console.log(`      · ${x.기준} → ${x.변형}   ${x.이름}`);
}

/* 이 도구가 아는 낱말 — **한 곳**에 둔다(차단문과 갈라지면 처방이 거절되고, 거절된 처방은
 * 우회를 정상 통로로 만든다 · F103). 늘릴 때 여기만 고친다. */
const 아는플래그 = ['--목록', '--축', '--기준만', '--대조', '--기준회차'];

function 주() {
  const argv = process.argv.slice(2);
  const 값 = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };

  /* 모르는 낱말을 조용히 삼키지 않는다 — 삼키면 「딴 과녁을 재고 초록」이 된다(F400·F435 계열).
   * 이 도구는 특히 위험하다: 오타 하나로 «축을 하나도 안 흔든 판»이 「뒤집힘 0」으로 나간다. */
  const 플래그오류 = 인자게이트('환경대조', argv, 아는플래그);
  if (플래그오류) 죽기(플래그오류);

  if (argv.includes('--목록')) {
    console.log('축 목록:');
    for (const a of 축들) console.log(`  · ${a.이름.padEnd(6)} ${a.설명}`);
    console.log('  · 플랫폼  ⚠ 이 도구가 «못» 잰다 — 유호님 기계에서 `--기준만 내판.json` 한 번.');
    return;
  }

  const 기준만 = 값('--기준만');
  if (기준만) {
    const 판 = 돌리기(ROOT);
    fs.writeFileSync(기준만, JSON.stringify({
      플랫폼: process.platform, 노드: process.version, 검사수: 판.size,
      판: Object.fromEntries([...판].map(([k, v]) => [k, 묶음(v)])),
    }, null, 1) + '\n', 'utf8');
    console.log(`✅ 이 기계의 판을 적었다 — ${기준만} (플랫폼 ${process.platform} · 검사 ${판.size}건)`);
    console.log('   다른 기계에서: node tools/환경대조.js --대조 ' + path.basename(기준만));
    return;
  }

  const 대조파일 = 값('--대조');
  if (대조파일) {
    let 남 ;
    try { 남 = JSON.parse(fs.readFileSync(대조파일, 'utf8')); } catch (e) { 죽기(`판 파일을 못 읽었다: ${대조파일}`, e.message); }
    const 남판 = new Map(Object.entries(남.판 || {}).map(([k, v]) => [k, String(v).split('+')]));
    if (!남판.size) 죽기('그 파일의 판이 비었다 — 「뒤집힘 0」과 같은 모양이라 여기서 멈춘다(F207).');
    const 내판 = 돌리기(ROOT);
    찍기(`기계 대조 — ${남.플랫폼}(준 판) vs ${process.platform}(여기)`, 대조(남판, 내판));
    console.log('\n⚠ 이 대조는 **축이 한꺼번에** 바뀐 것이다(플랫폼·시간대·홈·ref 집합이 동시에 다르다).');
    console.log('   무엇 때문에 뒤집혔는지는 `node tools/환경대조.js --축 …` 가 하나씩 갈라 낸다.');
    return;
  }

  const 고른것 = (값('--축') || 축들.map((a) => a.이름).join(',')).split(',').map((s) => s.trim()).filter(Boolean);
  const 모르는것 = 고른것.filter((n) => !축들.some((a) => a.이름 === n));
  if (모르는것.length) 죽기(`모르는 축: ${모르는것.join(', ')}`, `아는 것: ${축들.map((a) => a.이름).join(', ')} (--목록)`);

  const 기준회차 = 값('--기준회차') === undefined ? 2 : Number(값('--기준회차'));
  if (!Number.isInteger(기준회차) || 기준회차 < 1) 죽기('`--기준회차` 는 1 이상 정수다(기본 2).');

  console.log(`[환경대조] 기준판을 먼저 뜬다 (CI 모사 환경 · 축 ${고른것.length}개 예정 · 기준 ${기준회차}회)`);
  const { 기준, 흔들린 } = 안정기준(ROOT, 기준회차);
  console.log(`[환경대조] 기준 ${기준.size}검사`);
  if (기준회차 === 1) {
    console.log('   ⚠ 기준을 1회만 떴다 — 기준의 flaky 한 판정이 **모든 축의 뒤집힘**으로 나올 수 있다(실측 있음).');
  }
  if (흔들린.length) {
    console.log(`   🔎 기준에서 «흔들린» 검사 ${흔들린.length}건 — **축이 아니라 flaky** 다(아래 대조에서 뺐다):`);
    for (const x of 흔들린) console.log(`      ~ ${x.답들.join(' / ')}   ${x.이름}`);
  }
  const 흔들린이름 = new Set(흔들린.map((x) => x.이름));

  let 고칠것 = 0;
  for (const 이름 of 고른것) {
    const a = 축들.find((x) => x.이름 === 이름);
    console.log(`\n[환경대조] 축 «${이름}» — ${a.설명}`);
    let 판; let 치울것 = null;
    if (a.클론) { const c = 클론뿌리(); 치울것 = c.치울것; 판 = 돌리기(c.뿌리); }
    else 판 = 돌리기(ROOT, a.환경());
    if (치울것) { try { fs.rmSync(치울것, { recursive: true, force: true }); } catch (_) { /* 임시 */ } }
    /* 기준에서 흔들려 뺀 이름은 변형에서도 뺀다 — 안 그러면 `한쪽에만`(변형에만)으로 되살아나
     * 「파일이 안 돌았다」로 읽힌다. 뺀 사실은 위에서 이미 수와 이름으로 밝혔다. */
    for (const 이름 of 흔들린이름) 판.delete(이름);
    const r = 대조(기준, 판);
    고칠것 += r.판정뒤집힘.length;
    찍기(`축 «${이름}»`, r);
  }

  console.log('\n⚠ 안 잰 축: **플랫폼**(윈도우 경로 문법) — 리눅스에서 만들 수 없다.');
  console.log('   유호님 기계에서 한 번: node tools/환경대조.js --기준만 내판.json');
  /* 종료코드로도 낸다 — 사람이 화면을 안 읽어도 게이트가 걸 수 있게(스스로 발화하지 않는 장치는 안 돈다).
   * ⚠ «실행바뀜»으로는 안 막는다: 그건 결함이 아니라 규율이 도는 모습이고, 막으면 곧 꺼진다. */
  if (고칠것) {
    console.error(`\n🔴 판정이 뒤집힌 검사 총 ${고칠것}건 — 답을 기계가 정하는 자리다(F296).`);
    process.exit(1);
  }
}

module.exports = { 읽기, 대조, 묶음, 축들, 안정기준 };

if (require.main === module) 주();
