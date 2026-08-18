#!/usr/bin/env node
/* 기계갈림 — 「기계에 따라 답이 갈리는 검사」를 **축을 하나씩 바꿔** 실측한다 (대기열 #Q115 · F617).
 *
 * ■ 왜 생겼나
 *   F617 이 잡은 CI 적색 3건은 전부 「검사가 저장소 밖 환경에 기댄다」였다(F296 이 이미 조항으로
 *   들고 있던 병). 셋을 고쳤지만 **분모가 없었다** — 스위트 4,550건 중 그런 검사가 몇이고 어디인지
 *   아무도 안 쟀다. 9/1 에 원격 Actions 가 살아나는 순간 남은 갈래가 한꺼번에 적색으로 뜨고,
 *   주인 없는 적색은 남의 배포를 막는다.
 *
 * ■ 🔑 왜 「두 기계를 대조」가 아니라 「축을 하나씩 토글」인가 (#Q115 의 방법을 한 칸 바꿨다)
 *   큐 줄은 「클라우드 판과 노트북 판의 fail·skip 집합을 diff 하라」고 적었다. 그러면 **갈렸다는
 *   사실**은 알지만 **어느 축 때문인지**는 여전히 사람이 추측한다 — 두 기계가 TZ·홈·이력·경로
 *   문법·형제 저장소·node 판까지 한꺼번에 다르기 때문이다(CLAUDE.md 「둘을 동시에 바꾸면 모르는
 *   채 알아냈다고 쓰게 된다」). 여기서는 **한 기계에서 축을 하나씩만** 바꿔 돌린다. 그러면
 *   갈린 줄마다 「환경 어느 축인가」가 추측이 아니라 **구성으로** 나온다.
 *   ⚠ 대신 **이 기계에서 못 바꾸는 축은 원리상 못 잰다** — 플랫폼(win32)·node 판·형제 저장소
 *     존재가 그것이다. 그 셋은 아래 `못재는축` 에 이름을 대고 뺀다(안 잰 것을 안 잰 채 두지 않는다).
 *
 * ■ 🔑 이 컨테이너가 왜 재는 자리인가 — 그리고 큐 줄의 전제 하나가 틀렸다
 *   워크플로는 `runs-on: ubuntu-latest`, 이 컨테이너는 **Ubuntu 24.04**다(실측). 거기까진 맞다.
 *   그런데 큐 줄은 「같은 `fetch-depth: 0`」이라고 적었는데 **이 클론은 얕다**(`--is-shallow-
 *   repository` = true · 실측 232 커밋). 워크플로는 전체 이력을 받는다. 그래서 이력 깊이는
 *   「같아서 안 봐도 되는 것」이 아니라 **재야 하는 축**이고, 아래 변이에 넣었다.
 *   node 판도 다르다(워크플로 20 · 여기 22) — 그건 못 바꾸므로 `못재는축` 이다.
 *
 * ■ ⚠ 이 도구가 틀릴 때의 «모습»
 *   ㉠ **이름이 겹치면 한 칸으로 접힌다** — `node --test` 의 TAP 은 파일을 안 밝힌다. 그래서
 *      같은 이름이 두 파일에 있으면 두 번째부터 `이름 #2` 로 센다. 접히면 증상은 「안 갈렸다」다.
 *   ㉡ **파일 이름은 사후에 «검사 이름으로» 찾는다** — 이름이 템플릿 리터럴이면 못 찾고 `(파일 ?)`
 *      로 남는다. 갈린 줄만 찾으므로 비용은 작지만, 못 찾은 자리는 사람이 grep 해야 한다.
 *   ㉢ **한 번 돌린 것은 한 번 돈 것이다** — 진짜 불안정(flaky) 검사는 축과 구별이 안 된다.
 *      그래서 갈린 줄은 기본 2회 돌려 **재현되는 것만** 축으로 센다(`--회차`).
 *   👉 닫는 것 = **없다.** 이 도구는 분모를 내는 자리고, 고치는 것은 별건이다(#Q115 가 그렇게 갈랐다).
 *
 * 사용:
 *   node tools/기계갈림.js                 전 변이 실행 → 표
 *   node tools/기계갈림.js --변이 ci모사,KST      (변이: ci모사 · 실홈 · KST · 전체이력)
 *   node tools/기계갈림.js --회차 2         갈린 줄 재현 확인 횟수(기본 2)
 *   node tools/기계갈림.js --json
 */
'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const TESTS = path.join(ROOT, 'tests');
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));
/* CI 모사 환경은 **한 벌**에서 온다(F389) — 여기서 다시 조립하면 「CI 초록」의 눈금이 갈라진다. */
const ci모사환경 = require(path.join(__dirname, 'lib', 'ci모사환경.js'));

/** 이 기계에서 **못 바꾸는** 축 — 이름을 대고 뺀다(F207: 안 잰 것을 안 잰 채 두지 않는다). */
const 못재는축 = Object.freeze([
  { 축: '플랫폼', 왜: '윈도우에서만 갈리는 경로 문법·잠금은 리눅스에서 원리상 못 잰다(유호님 기계 몫)' },
  { 축: 'node 판', 왜: '워크플로는 20, 이 컨테이너는 22 — 컨테이너가 주는 것이라 못 바꾼다' },
  { 축: '형제 저장소', 왜: '`../SYNK-talk` 이 없다 — 「있을 때」 갈리는 검사는 여기서 못 본다(F622)' },
]);

/** 변이 — **축 하나씩만** 다르다. `기준` 에서 무엇이 바뀌는지가 곧 그 변이의 뜻이다. */
const 변이표 = Object.freeze({
  ci모사: {
    뜻: '이 저장소가 「CI 초록」이라 부르는 게이트 그대로 (TZ=UTC · HOME=빈 폴더)',
    축: '기준',
    env: () => ci모사환경.만들기(),
  },
  실홈: {
    뜻: 'ci모사에서 **홈만** 되돌린다 — repo 밖(메모리·자격증명)에 닿는 검사가 드러난다',
    축: '홈 디렉터리',
    env: () => ({ env: { ...process.env, TZ: 'UTC' }, 치우기() {} }),
  },
  KST: {
    뜻: 'ci모사에서 **시간대만** 유호님 기계로 (Asia/Seoul)',
    축: '시간대',
    env: () => { const m = ci모사환경.만들기(); m.env.TZ = 'Asia/Seoul'; return m; },
  },
  전체이력: {
    뜻: 'ci모사에서 **git 이력만** 워크플로와 같게 (fetch-depth: 0)',
    축: 'git 이력 깊이',
    준비: 깊게하기,
    env: () => ci모사환경.만들기(),
  },
});

/** 얕은 클론을 전체 이력으로 — 워크플로의 `fetch-depth: 0` 축을 이 기계에서 켠다.
 *  🔑 되돌릴 수 없는 방향이라(다시 얕게는 못 만든다) **맨 마지막 변이**로만 돌린다. */
function 깊게하기() {
  const 얕나 = spawnSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: ROOT, encoding: 'utf8' });
  if (String(얕나.stdout).trim() !== 'true') return { 했나: false, 왜: '이미 전체 이력이다' };
  const r = spawnSync('git', ['fetch', '--unshallow', 'origin'], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) return { 했나: false, 왜: `unshallow 실패: ${String(r.stderr).slice(0, 200)}` };
  return { 했나: true, 왜: '얕은 클론 → 전체 이력' };
}

/* ── TAP 파싱 ────────────────────────────────────────────────────────────────
 * `ok N - 이름` · `ok N - 이름 # SKIP 사유` · `not ok N - 이름` · `# TODO`.
 * 🔑 이름이 겹치면 `이름 #2` 로 센다(위 대가 ㉠) — 접으면 증상이 「안 갈렸다」라서 조용하다. */
function TAP파싱(글) {
  const 판정 = new Map();
  const 본이름 = new Map();
  for (const 줄 of String(글).split('\n')) {
    const m = /^(not ok|ok) \d+ - (.*)$/.exec(줄);
    if (!m) continue;
    let 이름 = m[2];
    let 결과 = m[1] === 'ok' ? 'pass' : 'fail';
    let 사유 = '';
    const s = /^(.*?) # (SKIP|TODO)\b ?(.*)$/.exec(이름);
    if (s) { 이름 = s[1]; 결과 = s[2] === 'SKIP' ? 'skip' : 'todo'; 사유 = s[3] || ''; }
    const n = (본이름.get(이름) || 0) + 1;
    본이름.set(이름, n);
    판정.set(n === 1 ? 이름 : `${이름} #${n}`, { 결과, 사유 });
  }
  return 판정;
}

function 스위트돌리기(env) {
  const files = fs.readdirSync(TESTS).filter((f) => f.endsWith('.test.js')).sort()
    .map((f) => path.join('tests', f));
  if (!files.length) throw new Error('tests/*.test.js 가 0건 — 스위트가 비었다');
  const r = spawnSync(process.execPath, ['--test', ...files], {
    cwd: ROOT, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) throw new Error(`스위트 실행 실패: ${r.error.message}`);
  return { 판정: TAP파싱(r.stdout), 원문: r.stdout };
}

/** 검사 이름이 어느 파일에 있나 — 사후 조회다(위 대가 ㉡). 못 찾으면 `null`. */
function 파일찾기(이름) {
  const 바늘 = 이름.replace(/ #\d+$/, '');
  for (const f of fs.readdirSync(TESTS).filter((n) => n.endsWith('.test.js')).sort()) {
    try { if (fs.readFileSync(path.join(TESTS, f), 'utf8').includes(바늘)) return `tests/${f}`; } catch (_) { /* 사라진 파일 */ }
  }
  return null;
}

function 표세기(판정) {
  const c = { pass: 0, fail: 0, skip: 0, todo: 0 };
  for (const v of 판정.values()) c[v.결과] += 1;
  return c;
}

/** 두 판정의 «집합 차» — 결과가 바뀐 검사만. */
function 대조(기준, 다른) {
  const 갈림 = [];
  const 모든이름 = new Set([...기준.keys(), ...다른.keys()]);
  for (const 이름 of 모든이름) {
    const a = 기준.get(이름);
    const b = 다른.get(이름);
    const 왼 = a ? a.결과 : '없음';
    const 오 = b ? b.결과 : '없음';
    if (왼 !== 오) 갈림.push({ 이름, 기준: 왼, 변이: 오, 사유: (b && b.사유) || (a && a.사유) || '' });
  }
  return 갈림.sort((x, y) => x.이름.localeCompare(y.이름));
}

/** 변이 하나를 돌린다 → 판정. */
function 한번(이름) {
  const m = 변이표[이름].env();
  try { return 스위트돌리기(m.env).판정; } finally { m.치우기(); }
}

function 재기(고른변이, 회차) {
  const 결과 = {};
  /* 🔴 `전체이력` 은 **맨 끝**이다 — `git fetch --unshallow` 가 되돌릴 수 없는 방향이라,
   *   그 뒤에 도는 변이는 「축 하나만 다르다」가 깨진다(이력이 함께 바뀌어 버린다). */
  const 순서 = 고른변이.slice().sort((a, b) => (a === '전체이력' ? 1 : 0) - (b === '전체이력' ? 1 : 0));
  let 기준판정 = null;

  for (const 이름 of 순서) {
    const v = 변이표[이름];
    let 준비말 = '';
    if (v.준비) { const p = v.준비(); 준비말 = p.왜; if (!p.했나 && !/이미/.test(p.왜)) { 결과[이름] = { 오류: p.왜 }; continue; } }
    process.stderr.write(`[기계갈림] ${이름} 돌리는 중 … (${v.축}${준비말 ? ' · ' + 준비말 : ''})\n`);
    const 판정 = 한번(이름);
    결과[이름] = { 축: v.축, 뜻: v.뜻, 준비말, 판정, 셈: 표세기(판정) };
    if (이름 === 'ci모사') { 기준판정 = 판정; continue; }
    if (!기준판정) continue;

    /* 갈린 줄은 **그 자리에서** 다시 돌려 재현되는 것만 축으로 센다 (대가 ㉢).
     * 🔑 재실행을 나중으로 미루면 안 된다 — 그 사이 `전체이력` 이 저장소 상태를 바꾼다.
     *   (첫 판이 정확히 그 버그였다: 재실행 패스를 전 변이 뒤에 몰아 뒀었다.) */
    const 첫 = 대조(기준판정, 판정);
    if (!첫.length || 회차 < 2) { 결과[이름].갈림 = 첫; 결과[이름].안재현 = []; continue; }
    process.stderr.write(`[기계갈림]   ↳ 갈림 ${첫.length}건 — 재현 확인 ${회차 - 1}회\n`);
    let 남은 = 첫;
    for (let i = 1; i < 회차 && 남은.length; i += 1) {
      const 다시 = new Set(대조(기준판정, 한번(이름)).map((g) => `${g.이름}|${g.변이}`));
      남은 = 남은.filter((g) => 다시.has(`${g.이름}|${g.변이}`));
    }
    const 남은키 = new Set(남은.map((g) => `${g.이름}|${g.변이}`));
    결과[이름].갈림 = 남은;
    결과[이름].안재현 = 첫.filter((g) => !남은키.has(`${g.이름}|${g.변이}`));
  }
  return 결과;
}

module.exports = { TAP파싱, 대조, 파일찾기, 변이표, 못재는축, 재기 };

/* ── CLI ───────────────────────────────────────────────────────────────────── */
if (require.main === module) {
  const 아는플래그 = ['--변이', '--회차', '--json'];
  const 인자 = process.argv.slice(2);
  const 오류 = 인자게이트('기계갈림', 인자, 아는플래그);
  if (오류) { console.error(오류); process.exit(2); }

  const 값 = (f, 기본) => { const i = 인자.indexOf(f); return i === -1 ? 기본 : 인자[i + 1]; };
  const 고른 = String(값('--변이', Object.keys(변이표).join(','))).split(',').map((s) => s.trim()).filter(Boolean);
  const 모름 = 고른.filter((n) => !변이표[n]);
  if (모름.length) { console.error(`[기계갈림] 모르는 변이: ${모름.join(' ')} — 아는 것은 ${Object.keys(변이표).join(' · ')}`); process.exit(2); }
  const 회차 = Number(값('--회차', '2'));
  if (!Number.isFinite(회차) || 회차 < 1) { console.error('[기계갈림] --회차 는 1 이상 정수'); process.exit(2); }

  const 결과 = 재기(고른, 회차);

  if (인자.includes('--json')) {
    const 낼것 = {};
    for (const [k, v] of Object.entries(결과)) 낼것[k] = { ...v, 판정: undefined };
    console.log(JSON.stringify({ 변이: 낼것, 못재는축 }, null, 2));
    process.exit(0);
  }

  console.log(`\n[기계갈림] 이 기계 = ${os.type()} ${os.release()} · node ${process.version}`);
  console.log('  ⚠ 못 재는 축 — ' + 못재는축.map((x) => x.축).join(' · ') + ' (아래 표에 사유)');
  for (const [이름, v] of Object.entries(결과)) {
    if (v.오류) { console.log(`\n■ ${이름} — ❌ ${v.오류}`); continue; }
    const c = v.셈;
    console.log(`\n■ ${이름}  [축: ${v.축}]  pass ${c.pass} · fail ${c.fail} · skip ${c.skip} · todo ${c.todo}`);
    console.log(`   ${v.뜻}${v.준비말 ? ' · ' + v.준비말 : ''}`);
    if (!v.갈림) continue;
    if (!v.갈림.length) { console.log('   → 기준과 갈린 검사 **0건**'); continue; }
    console.log(`   → 기준과 갈린 검사 **${v.갈림.length}건**${v.안재현 && v.안재현.length ? ` (+ 재현 안 된 것 ${v.안재현.length}건 = flaky 후보)` : ''}`);
    for (const g of v.갈림) {
      console.log(`      · ${파일찾기(g.이름) || '(파일 ?)'}  ${g.기준} → ${g.변이}   ${g.이름.slice(0, 70)}`);
      if (g.사유) console.log(`        사유: ${g.사유.slice(0, 120)}`);
    }
    for (const g of (v.안재현 || [])) console.log(`      ~ [flaky?] ${g.기준} → ${g.변이}   ${g.이름.slice(0, 70)}`);
  }
  console.log('');
}
