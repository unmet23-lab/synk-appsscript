#!/usr/bin/env node
'use strict';
/* 짝검사 — 원천만 고치고 짝 파일(생성물·사본)을 같이 안 올린 push를 push 전에 막는다 (2026-10-22). 바로올리기가 부른다.
 *
 *   node tools/짝검사.js <경로…>             걸리는 검사와 까닭만 보인다
 *   node tools/짝검사.js <경로…> --돌리기    걸리는 검사를 이 작업본에서 돌린다(하나라도 막히면 종료 1)
 *   node tools/짝검사.js 표                  표 전체 — 검사 · 원천 · 결과물 · 고치는 명령
 *
 * 왜 있나: 10-20 20:26~10-22 11:36(KST) master syntax-check 빨강 144회 가운데 104회가 「원천과 짝 파일이 어긋난 push」였다.
 *   WORLD 묶음 낡음 47회 — CI 「verify all local Atlas consumer copies」 단계라 tests/*.test.js만 고르는 관련시험이 못 본다.
 *   지면폰트 ⑦ 57회 — 두 번 다 «새» HTML이었다. ⑦은 git ls-files로 지면을 훑어서 push 전 작업본(아직 추적 밖)에서는 그 파일을
 *   못 본다 — 그래서 이 줄은 이번 push로 처음 들어가는 파일을 SYNK_새파일로 넘겨 돌린다(tests/_git밖.js).
 *
 * 표의 줄(기본표) — CI가 같은 단계에서 도는 결정적 검사 하나:
 *   { 이름, 단계(CI 단계·시험 파일), 명령(node 인자) | 시험[파일, 이름무늬] | 함수(root)→{통과, 글}, 고침(보일 명령),
 *     결과물[], 원천[], 주석원천[], 있어야[], 환경[], 낡음(무늬), 작업본대조(기본 true) }
 *   원천·결과물은 저장소 기준 파일이나 무늬(`*` 한 칸 · `**` 여러 칸)다. 주석원천은 esbuild 묶음 파일이고, 그 안의 `// <경로>` 줄이
 *   묶인 모듈이다(묶음을 다시 만들 때마다 저절로 따라온다). 명령 스크립트가 상대 경로로 부르는 파일(import·require)도 원천이다.
 *   명령 스크립트·시험 파일·있어야 파일이 이 저장소에 없으면 그 줄은 없는 셈이다(시험용 임시 저장소).
 * 고르기: 이번 push의 경로가 그 줄의 원천·결과물에 걸릴 때만 고른다. 상관없는 push(문서·장부)는 아무것도 안 돈다.
 * 돌리기: 작업본에서 돈다(줄끼리 함께). 그래서 작업본이 올릴 판과 같아야 뜻이 있다 — 그 줄이 보는 파일이 작업본에서 바뀌었는데
 *   이번 push에 없으면(생성기를 돌리고 결과물을 경로에 안 넣은 꼴) 워크트리에서는 막고, 공용 작업본에서는 남의 미커밋일 수 있어
 *   주의만 남긴다. 무늬로 고른 원천은 추적 파일의 수정만 센다(미추적 쪽지가 막지 않게).
 *   판정 — 통과 · 낡음(고침 명령을 보인다) · 깨짐(시험 줄 — 시험이 찍은 → 안내를 보인다) · 오류(CI에서도 그대로 깨진다) ·
 *   못 돌림(이 작업본에 의존성이 없다 — 주의만, CI가 본다).
 * 표에 없는 것: Atlas 사본 표식 훑기(unknownCopies, 저장소 전체를 10초 남짓 읽는다)와 Talk·웹사이트 형제 대조는 CI만 본다.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const 뿌리 = path.resolve(__dirname, '..');
const ATLAS단계 = 'verify all local Atlas consumer copies';
const 계정단계 = 'verify account library and portal bundles';
const 기본한도ms = 3 * 60e3;
const 함께 = 4;
const 못돌림식 = /Cannot find (?:module|package) ['"](?:esbuild|@supabase\/supabase-js)['"]|의존성이 없다/;
/** 묶음 안 `// <경로>` 줄로 읽을 확장자 — 이 확장자의 파일을 바꾼 push에서만 묶음을 읽는다. */
const 모듈확장자 = /\.(?:[cm]?js|jsx|tsx?|json|css)$/i;

const 슬래시 = (p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '');

/** `*`(한 칸)·`**`(여러 칸) 무늬 → 식. 무늬 문자가 없으면 그 경로 하나다. */
function 무늬식(무늬) {
  let 식 = '';
  for (let i = 0; i < 무늬.length; i++) {
    const ch = 무늬[i];
    if (ch !== '*') { 식 += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&'); continue; }
    if (무늬[i + 1] !== '*') { 식 += '[^/]*'; continue; }
    i++;
    if (무늬[i + 1] === '/') { i++; 식 += '(?:.*/)?'; } else 식 += '.*';
  }
  return new RegExp(`^${식}$`);
}
const 무늬인가 = (p) => p.includes('*');

/** esbuild 묶음의 `// <경로>` 줄 = 묶인 모듈(absWorkingDir가 저장소 뿌리라 저장소 기준 경로다). 지운 모듈도 남긴다(지움도 걸리게). */
function 묶인모듈(root, 묶음) {
  let 글;
  try { 글 = fs.readFileSync(path.join(root, 묶음), 'utf8'); } catch { return []; }
  const 결과 = new Set();
  for (const m of 글.matchAll(/^[ \t]*\/\/ ((?:[^\s/:]+\/)*[^\s/:]+\.(?:[cm]?js|jsx|tsx?|json|css))[ \t]*$/gm)) {
    if (!m[1].startsWith('..')) 결과.add(m[1]);
  }
  return [...결과];
}

/** 명령 스크립트가 상대 경로로 부르는 저장소 안 파일(import·require 한 겹). 확장자 없는 것은 .js·.mjs·/index.js 순으로 찾는다. */
function 스크립트가부르는(root, 스크립트) {
  let 글;
  try { 글 = fs.readFileSync(path.join(root, 스크립트), 'utf8'); } catch { return []; }
  const 폴더 = path.posix.dirname(슬래시(스크립트));
  const 결과 = new Set();
  for (const m of 글.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const 붙인 = path.posix.normalize(path.posix.join(폴더, m[1]));
    if (붙인.startsWith('..')) continue;
    const 후보 = /\.[a-z0-9]+$/i.test(붙인) ? [붙인] : [`${붙인}.js`, `${붙인}.mjs`, `${붙인}/index.js`];
    const 있는 = 후보.find((p) => fs.existsSync(path.join(root, p)));
    if (있는) 결과.add(있는);
  }
  return [...결과];
}

/** 원본 사본(atlas → 소비자 사본·실행기 메타데이터)을 고치지 않고 대조한다 — sync-atlas.js --all --check --local의 그 부분. */
function 원본사본검사(root) {
  const { rawCopies, syncRaw } = require(path.join(root, 'tools/lib/atlas-copies.js'));
  const r = syncRaw(root, rawCopies(root, null), { check: true });
  return { 통과: r.problems.length === 0, 글: r.problems.length ? r.problems.join('\n') : `raw consumers ${r.copies} copies current` };
}

/** 지금 저장소의 짝 검사 표. CI(syntax-check.yml)의 「Atlas 사본」·「계정 묶음」 단계와 지면폰트 ⑦이 같은 명령을 돈다. */
function 기본표(root = 뿌리) {
  const 표 = [];
  let atlas = null;
  try { atlas = require(path.join(root, 'tools/lib/atlas-copies.js')); } catch { atlas = null; }
  for (const b of atlas ? atlas.WORLD_BUNDLES : []) {
    // 생활 묶음만 옆에 CSS 한 벌을 같이 옮긴다(tools/build-world-life.mjs).
    const 생활 = /life-standalone/.test(b.output);
    표.push({
      이름: b.label, 단계: ATLAS단계, 명령: [b.build, '--check'], 고침: `node ${b.build}`,
      결과물: [b.output, ...(생활 ? ['experiences/brand-opening/content/life-ui.css'] : [])],
      원천: 생활 ? ['experiences/synk-world-app/life-ui.css'] : [], 주석원천: [b.output], 낡음: /is stale/,
    });
  }
  if (atlas) {
    표.push({
      이름: 'learning: 9 games', 단계: ATLAS단계, 명령: ['tools/build-game-learning.js', '--check'], 고침: 'node tools/build-game-learning.js',
      결과물: ['strata/maps/topik-i.json', 'strata/maps/topik-ii.json', ...atlas.GAMES.map((g) => `experiences/${g}/atlas-learning.js`)],
      원천: ['strata/*.json', 'strata/*.js'], 주석원천: ['experiences/korean-racing/atlas-learning.js'], 낡음: /Learning source differs/,
    });
    표.push({
      이름: 'learning: Hangul', 단계: ATLAS단계, 명령: ['tools/build-hangul-stage.js', '--check'], 고침: 'node tools/build-hangul-stage.js',
      결과물: ['strata/maps/hangul.json', 'experiences/hangul-stage/atlas-learning.js'],
      원천: ['strata/hangul.json', 'strata/hangul.js'], 주석원천: ['experiences/hangul-stage/atlas-learning.js'], 낡음: /Hangul stage source differs/,
    });
    let 사본 = [];
    try { 사본 = atlas.rawCopies(root, null); } catch { 사본 = []; }
    const 상대 = (p) => 슬래시(path.relative(root, p));
    표.push({
      이름: 'raw consumers and engine metadata', 단계: ATLAS단계, 함수: 원본사본검사, 고침: 'node tools/sync-atlas.js --all --local',
      있어야: ['tools/lib/atlas-copies.js'],
      결과물: [...new Set(사본.map((x) => 상대(x.destination))), 'desktop/assets/launcher/sources.json', 'docs/마케팅/맞춤도구/dist/*.manifest.json'],
      원천: [...new Set(사본.map((x) => 상대(x.source))), 'tools/lib/atlas-copies.js'],
    });
  }
  표.push({
    // 고침은 이 생성기 하나로 — check-account-bundles.js --build는 포털까지 다시 만들려다 의존성 없는 워크트리에서 FAIL로 끝난다.
    이름: 'PC 계정 라이브러리 묶음', 단계: 계정단계, 명령: ['desktop/tools/build-platform-continuity.cjs', '--check'],
    고침: 'node desktop/tools/build-platform-continuity.cjs',
    결과물: ['desktop/renderer/platform-continuity.mjs', 'desktop/renderer/platform-continuity.css'],
    원천: ['experiences/synk-account/src/platform-library.css'], 주석원천: ['desktop/renderer/platform-continuity.mjs'],
    낡음: /Stale platform continuity bundle/,
  });
  표.push({
    // 포털은 experiences/synk-account의 의존성(@supabase)이 있어야 돈다 — 앱 워크트리에는 보통 없어 「못 돌림」(CI가 본다).
    이름: '계정 포털·교사 연결 묶음', 단계: 계정단계, 명령: ['tools/check-account-bundles.js'], 고침: 'node tools/check-account-bundles.js --build',
    환경: ['experiences/synk-account/node_modules/@supabase/supabase-js'],
    결과물: ['experiences/synk-account/dist/**', 'experiences/synk-account/src/generated/**', 'experiences/synk-account/assets/**',
      'experiences/synk-account/preview.html', 'experiences/synk-account/build-manifest.json', 'experiences/synk-account/member-insight.css',
      'docs/마케팅/온라인마케팅지도/engagement/company/public/teaching-host.js'],
    원천: ['experiences/synk-account/src/**', 'experiences/synk-account/index.html', 'experiences/synk-account/package.json',
      'experiences/mascot-render-lab/three/**', 'account/world-learning-host.js', 'desktop/renderer/member-insight.css',
      'tools/build-synk-account.js', 'tools/build-member-activity.js', 'tools/build-messenger-teaching.cjs'],
    낡음: /^FAIL /m,
  });
  표.push({
    이름: 'TOPIK4 수업 문항', 단계: 계정단계, 명령: ['tools/build-topik4-course.mjs', '--check'], 고침: 'node tools/build-topik4-course.mjs',
    결과물: ['experiences/teacher-world/topik4-course.json'],
    원천: ['docs/온라인반_TOPIK4급/쓰기과제.md', 'docs/온라인반_TOPIK4급/읽기연습.md'], 낡음: /Stale TOPIK4 course/,
  });
  표.push({
    // 원고(data/lines)와 허용 목록은 생성물에 들지 않는다 — 검사기(tests/town-content.test.js)만 읽는다.
    이름: '싱크타운 데이터 생성물', 단계: 'tests/town-places.test.js', 시험: ['tests/town-places.test.js', '^생성물이 원천과 같다'],
    고침: 'node tools/town-data-build.mjs', 결과물: ['experiences/synk-town/town/data.gen.mjs'],
    원천: ['experiences/synk-town/town/data/*.json', 'tools/town-data-build.mjs'],
  });
  표.push({
    // 지면 하나하나의 판정이라 작업본 대조는 하지 않는다 — 안 올리는 다른 지면은 CI에 안 간다.
    이름: '지면 SUIT 싣기(지면폰트 ⑦)', 단계: 'tests/지면폰트.test.js', 시험: ['tests/지면폰트.test.js', '^⑦'],
    고침: 'node tools/lib/브랜드폰트.js --심기 "<지면>"', 결과물: [], 원천: ['**/*.html'], 작업본대조: false,
  });
  return 표;
}

/** 줄의 스크립트·시험 파일이 이 저장소에 있나(없으면 그 줄은 없는 셈). */
function 있는줄(root, 줄) {
  const 파일들 = [...(줄.명령 ? [줄.명령[0]] : []), ...(줄.시험 ? [줄.시험[0]] : []), ...(줄.있어야 || [])];
  return 파일들.every((p) => fs.existsSync(path.join(root, p)));
}

/** 줄이 보는 파일 — { 파일: Set(정확한 경로), 무늬: [{무늬, 식, 결과물}], 결과물: Set }. 주석원천은 읽어야 할 때만(읽기 = true). */
function 보는파일(root, 줄, { 읽기 = true } = {}) {
  const 파일 = new Map(), 무늬 = [];
  const 넣기 = (p, 결과물) => {
    const q = 슬래시(p);
    if (무늬인가(q)) 무늬.push({ 무늬: q, 식: 무늬식(q), 결과물 });
    else if (!파일.has(q) || 결과물) 파일.set(q, 결과물);
  };
  for (const p of 줄.결과물 || []) 넣기(p, true);
  for (const p of 줄.원천 || []) 넣기(p, false);
  if (줄.명령) { 넣기(줄.명령[0], false); for (const p of 스크립트가부르는(root, 줄.명령[0])) 넣기(p, false); }
  if (줄.시험) 넣기(줄.시험[0], false);
  if (읽기) for (const 묶음 of 줄.주석원천 || []) for (const p of 묶인모듈(root, 묶음)) 넣기(p, false);
  return { 파일, 무늬 };
}

function 걸림(보는, p) {
  if (보는.파일.has(p)) return `${보는.파일.get(p) ? '결과물' : '원천'}: ${p}`;
  const m = 보는.무늬.find((x) => x.식.test(p));
  return m ? `${m.결과물 ? '결과물' : '원천'} ${m.무늬}: ${p}` : null;
}

/** 바꾼 경로(저장소 기준) → 고른 줄 [{ 줄, 까닭 }]. 돌리지는 않는다. */
function 고르기({ root = 뿌리, 바뀐, 표 = null }) {
  const 경로들 = [...new Set((바뀐 || []).map(슬래시))].filter(Boolean);
  if (!경로들.length) return [];
  const 줄들 = (표 || 기본표(root)).filter((줄) => 있는줄(root, 줄));
  // 묶음 파일은 모듈 꼴 파일을 바꾼 push에서만 읽는다 — 문서·장부만 바꾼 push는 파일을 하나도 안 연다.
  const 읽기 = 경로들.some((p) => 모듈확장자.test(p));
  const 결과 = [];
  for (const 줄 of 줄들) {
    const 보는 = 보는파일(root, 줄, { 읽기 });
    const 왜 = 경로들.map((p) => 걸림(보는, p)).find(Boolean);
    if (왜) 결과.push({ 줄, 까닭: 왜 });
  }
  return 결과;
}

// ── 돌리기 ────────────────────────────────────────────────────────────────────

function 실행(argv, { cwd, env, 한도ms }) {
  return new Promise((resolve) => {
    const 시작 = Date.now();
    let 출력 = '', 끝남 = false, 시간초과 = false;
    const 마침 = (status, 오류) => {
      if (끝남) return;
      끝남 = true;
      clearTimeout(시계);
      resolve({ status, 출력: 출력 + (오류 ? `\n${오류.message}` : ''), 초: Math.round((Date.now() - 시작) / 100) / 10, 시간초과 });
    };
    let p, 시계 = null;
    try { p = spawn(process.execPath, argv, { cwd, env, windowsHide: true }); } catch (e) { 마침(null, e); return; }
    const 받기 = (d) => { if (출력.length < 1 << 20) 출력 += d; };
    // 글자 단위로 받는다 — 바이트 덩이를 바로 이으면 덩이 경계에 걸린 한글이 깨진다.
    p.stdout.setEncoding('utf8');
    p.stderr.setEncoding('utf8');
    p.stdout.on('data', 받기);
    p.stderr.on('data', 받기);
    p.on('error', (e) => 마침(null, e));
    p.on('close', (code) => 마침(code));
    시계 = setTimeout(() => {
      시간초과 = true;
      p.kill();
      // 손자 프로세스가 파이프를 쥐고 있으면 close가 안 올 수 있다 — 5초 뒤에는 그대로 끝낸다.
      setTimeout(() => 마침(null), 5000).unref();
    }, 한도ms);
  });
}

const 끝줄 = (글, n = 6) => String(글 || '').replace(/\r/g, '').split('\n').map((l) => l.trimEnd()).filter(Boolean).slice(-n).join('\n');
/** 실패 출력의 요점 — 던진 오류의 첫 줄(코드 조각·스택은 뺀다), 없으면 끝 몇 줄. */
function 요점(글) {
  const 줄들 = String(글 || '').replace(/\r/g, '').split('\n');
  const i = 줄들.findIndex((l) => /^\s*(?:Uncaught )?[A-Za-z]*Error(?: \[[^\]]+\])?: /.test(l));
  return i >= 0 ? 줄들[i].trim().slice(0, 400) : 끝줄(글, 4);
}

/** 줄 하나를 작업본에서 돌린다 → { 판정: 통과|낡음|깨짐|오류|못 돌림, 초, 글, 안내[] }. */
async function 한줄돌리기(root, 줄, { 환경변수, 한도ms }) {
  const 없는환경 = (줄.환경 || []).filter((p) => !fs.existsSync(path.join(root, p)));
  if (없는환경.length) return { 판정: '못 돌림', 초: 0, 글: `이 작업본에 없다: ${없는환경.join(', ')}` };
  if (줄.함수) {
    const 시작 = Date.now();
    try {
      const r = 줄.함수(root);
      return { 판정: r.통과 ? '통과' : '낡음', 초: Math.round((Date.now() - 시작) / 100) / 10, 글: 끝줄(r.글) };
    } catch (e) {
      return { 판정: '오류', 초: Math.round((Date.now() - 시작) / 100) / 10, 글: 끝줄(e.message) };
    }
  }
  if (줄.시험) {
    const [파일, 이름무늬] = 줄.시험;
    const tap = path.join(os.tmpdir(), `synk-짝검사-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tap`);
    const r = await 실행(['--test', '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...(이름무늬 ? [`--test-name-pattern=${이름무늬}`] : []), 파일],
      { cwd: root, env: 환경변수, 한도ms });
    let 글 = '';
    try { 글 = fs.readFileSync(tap, 'utf8'); } catch { /* 아래 */ } finally { fs.rmSync(tap, { force: true }); }
    const { tap실패 } = require('./lib/tap실패.js');
    const t = tap실패(글, { root });
    if (r.시간초과) return { 판정: '오류', 초: r.초, 글: `${Math.round(한도ms / 1000)}초 안에 끝나지 않았다` };
    // 이름 무늬에 맞는 시험이 0개면 아무것도 안 잰 초록이다(시험 이름이 바뀐 것) — 표를 고칠 일이라 오류로 막는다.
    // node는 그때 시험 파일 자체를 통과한 시험 하나로 찍으니, 파일 이름 말고 다른 시험 이름이 하나라도 있는지로 가른다.
    const 잰시험 = [...글.matchAll(/^\s*(?:not )?ok \d+ - (.+?)\s*$/gm)].filter((m) => !/\.test\.[cm]?js$/.test(m[1]));
    if (r.status === 0 && !t.실패수 && !잰시험.length) return { 판정: '오류', 초: r.초, 글: `${파일}에서 이름 무늬 ${이름무늬 || '(없음)'}에 맞는 시험이 없다 — 시험 이름이 바뀌었으면 tools/짝검사.js 표를 고친다` };
    if (r.status === 0 && !t.실패수) return { 판정: '통과', 초: r.초, 글: `${t.통과}/${t.시험} 통과` };
    if (t.실패.length) {
      return { 판정: '깨짐', 초: r.초, 글: t.실패.map((x) => `✗ ${x.시험}${x.오류 ? ` — ${x.오류}` : ''}`).slice(0, 3).join('\n'), 안내: t.실패.flatMap((x) => x.안내 || []).slice(0, 3) };
    }
    return { 판정: 못돌림식.test(r.출력) ? '못 돌림' : '오류', 초: r.초, 글: 요점(r.출력) || `node --test 종료 ${r.status}` };
  }
  const r = await 실행(줄.명령, { cwd: root, env: 환경변수, 한도ms });
  if (r.시간초과) return { 판정: '오류', 초: r.초, 글: `${Math.round(한도ms / 1000)}초 안에 끝나지 않았다` };
  if (r.status === 0) return { 판정: '통과', 초: r.초, 글: 끝줄(r.출력, 2) };
  if (못돌림식.test(r.출력)) return { 판정: '못 돌림', 초: r.초, 글: 요점(r.출력) };
  return { 판정: 줄.낡음 && 줄.낡음.test(r.출력) ? '낡음' : '오류', 초: r.초, 글: 요점(r.출력) };
}

/**
 * 고른 줄을 작업본에서 함께 돌린다.
 *   올린: 이번 push에 통째로 드는 경로 · 새파일: 이번 push로 처음 들어가는 경로(SYNK_새파일로 넘긴다)
 *   더러운: 작업본의 바뀐 경로 [{ 경로, 추적 }] — 주면 「작업본 대조」를 한다 · 공용: 공용 작업본(남의 미커밋이 섞인다)
 *   뒤처진: 이 작업본 바탕과 origin 사이에 origin에서 바뀐 경로(작업본이 옛 판으로 쟀다는 주의만)
 * → { 결과: [{ 이름, 판정, 초, 글, 안내, 고침, 결과물, 안올린, 뒤처짐, 막음, 주의 }], 막음: [이름…], 초 }
 */
async function 돌리기({ root = 뿌리, 고름, 올린 = [], 새파일 = [], 더러운 = null, 공용 = false, 뒤처진 = [], 워크트리 = !공용, 한도ms = 기본한도ms }) {
  const 시작 = Date.now();
  const 환경변수 = { ...process.env };
  // node --test 안에서 부르면 부모 실행기의 표시가 따라와 자식이 TAP 파일 대신 부모에게 결과를 보낸다(관련시험.js와 같다).
  delete 환경변수.NODE_TEST_CONTEXT;
  if (워크트리) 환경변수.CI = '1'; // git 밖 로컬 자료를 읽는 시험이 건너뛴다(현장노트 시험_화면확인) — 공용 작업본에서는 주지 않는다
  if (새파일.length) 환경변수.SYNK_새파일 = JSON.stringify(새파일.map(슬래시));
  const 올림 = new Set(올린.map(슬래시));
  const 뒤 = new Set(뒤처진.map(슬래시));
  const 결과 = new Array(고름.length);
  let 다음 = 0;
  const 일꾼 = async () => {
    while (다음 < 고름.length) {
      const i = 다음++;
      const { 줄, 까닭 } = 고름[i];
      const 돈 = await 한줄돌리기(root, 줄, { 환경변수, 한도ms });
      const 보는 = 보는파일(root, 줄);
      const 안올린 = (더러운 || [])
        .filter((d) => !올림.has(슬래시(d.경로)))
        .map((d) => ({ 경로: 슬래시(d.경로), 추적: d.추적 !== false }))
        .filter((d) => 보는.파일.has(d.경로) || (d.추적 && 보는.무늬.some((m) => m.식.test(d.경로))))
        .map((d) => ({ 경로: d.경로, 결과물: Boolean(보는.파일.get(d.경로)) || 보는.무늬.some((m) => m.결과물 && m.식.test(d.경로)) }));
      const 뒤처짐 = [...뒤].filter((p) => 보는.파일.has(p) || 보는.무늬.some((m) => m.식.test(p)));
      const 대조 = 줄.작업본대조 !== false;
      let 막음 = false, 주의 = null;
      if (돈.판정 === '못 돌림') 주의 = `못 돌렸다(${돈.글.split('\n')[0]}) — CI가 본다`;
      else if (돈.판정 !== '통과') {
        if (공용 && 안올린.length) 주의 = `깨졌지만 공용 작업본의 미커밋(${안올린.slice(0, 3).map((x) => x.경로).join(', ')}${안올린.length > 3 ? ' …' : ''})이 섞였을 수 있어 막지 않았다 — 워크트리에서 다시 본다`;
        else 막음 = true;
      } else if (대조 && 안올린.length) {
        const 목록 = `${안올린.slice(0, 5).map((x) => `${x.경로}${x.결과물 ? '(결과물)' : ''}`).join(', ')}${안올린.length > 5 ? ' …' : ''}`;
        if (공용) 주의 = `작업본에서는 통과했지만 이 검사가 보는 파일 ${목록}이 작업본에서 바뀐 채 이번 push에 없다 — 남의 미커밋이면 괜찮다`;
        else 막음 = true;
      }
      if (!막음 && !주의 && 뒤처짐.length) 주의 = `origin에서 이 검사가 보는 ${뒤처짐.slice(0, 3).join(', ')}${뒤처짐.length > 3 ? ' …' : ''}가 바뀌었다 — 작업본은 옛 판으로 쟀다(CI가 다시 본다)`;
      결과[i] = { 이름: 줄.이름, 단계: 줄.단계, 까닭, ...돈, 고침: 줄.고침, 결과물: 줄.결과물 || [], ...(대조 ? { 안올린 } : {}), 뒤처짐, 막음, 주의 };
    }
  };
  await Promise.all(Array.from({ length: Math.min(함께, 고름.length) }, 일꾼));
  return { 결과, 막음: 결과.filter((x) => x.막음).map((x) => x.이름), 초: Math.round((Date.now() - 시작) / 100) / 10 };
}

// ── 글 ──────────────────────────────────────────────────────────────────────

/** 바로올리기와 명령줄이 같이 쓰는 보고 줄들. x = { 수, 검사[], 결과?, 건너뜀?, 못고름? } */
function 글로(x) {
  if (!x) return [];
  if (x.못고름) return [`  짝 검사: 고르지 못했다 — ${x.못고름}`];
  if (x.건너뜀) return [`  짝 검사 ${x.수}개 건너뜀 — ${x.건너뜀}`];
  if (!x.수) return [];
  if (!x.결과) return [`  짝 검사 ${x.수}개: ${x.검사.join(' · ')}`];
  const r = x.결과;
  if (r.오류) return [`  짝 검사: 돌리지 못했다 — ${r.오류} (막지 않았다 · CI가 같은 검사를 돈다)`];
  const 줄 = [`  짝 검사 ${r.막음.length ? '막힘' : '통과'} — ${r.결과.length}개 · ${r.초}초`];
  for (const y of r.결과) {
    const 안올린 = y.안올린 || [];
    if (y.판정 === '통과' && !y.막음 && !y.주의) { 줄.push(`    ✓ ${y.이름} (${y.초}초)`); continue; }
    줄.push(`    ${y.막음 ? '✗' : y.판정 === '통과' ? '✓' : '△'} ${y.이름} — ${y.판정}${y.판정 === '통과' && y.막음 ? '(작업본에서만)' : ''} (${y.초}초 · ${y.까닭})`);
    if (y.판정 !== '통과' && y.글) for (const l of y.글.split('\n').slice(0, 4)) 줄.push(`        ${l.slice(0, 220)}`);
    for (const l of y.안내 || []) 줄.push(`      → ${l}`);
    if (y.막음 && y.판정 !== '통과') {
      // 시험이 제 안내(→ 줄)를 찍었으면 그것이 더 자세하다 — 표의 고침 줄은 그때 뺀다.
      if (!(y.안내 || []).length) 줄.push(`      → 고친다: ${y.고침}`);
      const 결과물 = y.결과물.filter((p) => !무늬인가(p));
      if (결과물.length) 줄.push(`      → 그 뒤 결과물을 경로에 더해 같이 올린다: ${결과물.slice(0, 4).join(' ')}${결과물.length > 4 ? ' …' : ''}`);
    }
    if (y.막음 && 안올린.length) {
      줄.push(`      → 이 검사가 보는 파일이 작업본에서 바뀌었는데 이번 push에 없다 — 경로에 더해 같이 올리거나 되돌린다: ${안올린.slice(0, 6).map((a) => `${a.경로}${a.결과물 ? '(결과물)' : ''}`).join(' ')}${안올린.length > 6 ? ' …' : ''}`);
    }
    // 작업본 바탕이 뒤처져 깨졌을 수도 있다(남이 origin에서 고친 묶음을 아직 안 받음) — 그때는 최신을 받고 다시 잰다.
    if (y.막음 && (y.뒤처짐 || []).length) {
      줄.push(`      → origin에서 이 검사가 보는 ${y.뒤처짐.slice(0, 3).join(' ')}${y.뒤처짐.length > 3 ? ' …' : ''}가 바뀌었다 — 먼저 node tools/바로올리기.js 따라가기 --실행으로 최신을 받고 다시 올린다`);
    }
    if (y.주의) 줄.push(`      주의: ${y.주의}`);
  }
  return 줄;
}

function 표글(표) {
  const 줄 = [];
  for (const x of 표) {
    const 명령 = x.명령 ? `node ${x.명령.join(' ')}` : x.시험 ? `node --test --test-name-pattern=${x.시험[1]} ${x.시험[0]}` : '(도구 안에서)';
    줄.push(`■ ${x.이름}  [${x.단계}]`, `    검사: ${명령}`, `    고침: ${x.고침}`);
    if ((x.원천 || []).length) 줄.push(`    원천: ${x.원천.join(' · ')}`);
    if ((x.주석원천 || []).length) 줄.push(`    원천(묶인 모듈): ${x.주석원천.join(' · ')}의 「// 경로」 줄`);
    if (x.명령) 줄.push(`    원천(스크립트): ${x.명령[0]}이 상대 경로로 부르는 파일`);
    if ((x.결과물 || []).length) 줄.push(`    결과물: ${x.결과물.slice(0, 6).join(' · ')}${x.결과물.length > 6 ? ` 외 ${x.결과물.length - 6}개` : ''}`);
    if ((x.환경 || []).length) 줄.push(`    환경: ${x.환경.join(' · ')}(없으면 못 돌림)`);
  }
  return 줄.join('\n');
}

// ── 명령줄 ──────────────────────────────────────────────────────────────────

function git(root, args) {
  const r = require('node:child_process').spawnSync('git', ['-c', 'core.quotepath=false', ...args], { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 256 << 20 });
  return r.status === 0 ? String(r.stdout) : null;
}

async function main(argv = process.argv.slice(2)) {
  const root = 뿌리;
  if (argv[0] === '표') { console.log(표글(기본표(root).filter((x) => 있는줄(root, x)))); return 0; }
  const 경로들 = argv.filter((a) => !a.startsWith('--')).map((p) => {
    const rel = path.relative(root, path.resolve(p));
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? 슬래시(rel) : 슬래시(p);
  });
  if (!경로들.length) { console.error('사용: node tools/짝검사.js <경로…> [--돌리기] · node tools/짝검사.js 표'); return 2; }
  const 고름 = 고르기({ root, 바뀐: 경로들 });
  if (!argv.includes('--돌리기')) {
    console.log(`짝 검사 ${고름.length}개`);
    for (const x of 고름) console.log(`  ${x.줄.이름} — ${x.까닭}`);
    return 0;
  }
  const 상태 = (git(root, ['--no-optional-locks', 'status', '--porcelain=v1', '-z', '--untracked-files=all']) || '').split('\0').filter(Boolean);
  const 더러운 = 상태.filter((s) => s.length > 3).map((s) => ({ 경로: s.slice(3), 추적: !s.startsWith('??') }));
  const [gd, cd] = (git(root, ['rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir']) || '').trim().split('\n');
  const 공용 = Boolean(gd && cd && path.resolve(gd) === path.resolve(cd));
  const 새파일 = 더러운.filter((d) => !d.추적 && 경로들.includes(d.경로)).map((d) => d.경로);
  const 결과 = await 돌리기({ root, 고름, 올린: 경로들, 새파일, 더러운, 공용 });
  console.log(글로({ 수: 고름.length, 검사: 고름.map((x) => x.줄.이름), 결과 }).join('\n'));
  return 결과.막음.length ? 1 : 0;
}

if (require.main === module) main().then((code) => { process.exitCode = code; });

module.exports = { 기본표, 고르기, 돌리기, 글로, 표글, 무늬식, 묶인모듈, 스크립트가부르는, 보는파일, 있는줄, ATLAS단계, 계정단계 };
