#!/usr/bin/env node
'use strict';
/* CI 넓은 시험 — 루트 `tests/*.test.js` 밖의 시험(루트 .mjs·.cjs와 제품 폴더)을 CI에서 돌리고,
 * 알려진 실패(기준선)보다 늘어난 실패만 빨강으로 친다 (2026-10-22, wide-tests.yml이 묶음마다 부른다).
 *
 *   node tools/ci넓은시험.js <묶음>             돌리고 판정한다(새 실패가 있으면 종료 1)
 *   node tools/ci넓은시험.js <묶음> --목록      돌릴 파일만 보인다
 *   node tools/ci넓은시험.js <묶음> --기준선 <파일>   이번 실패를 기준선 후보 JSON으로 쓴다(이번 판정은 막지 않는다)
 *   node tools/ci넓은시험.js <묶음> --후보 <파일>     판정은 그대로 하고 이번 실패를 후보로도 남긴다(wide-tests가 늘 붙인다)
 *   node tools/ci넓은시험.js 기준선모으기 <run 번호>  처음 한 번 — 그 run의 후보로 기준선 파일을 쓴다(까닭 = 본 오류 첫 줄)
 *   node tools/ci넓은시험.js 기준선줄이기 <run 번호>  그 run에서 통과한 줄만 기준선에서 뺀다(새 실패는 들이지 않는다)
 *   묶음: 루트 · 회사 · desktop · experiences · tools
 *
 * 왜 있나: 10-21 조사에서 CI가 도는 시험은 루트 tests/*.test.js(190개 파일)뿐이고, 루트 .mjs·.cjs 172개와 회사 서버 320개·
 *   PC 앱 75개·경험 앱 341개·tools 66개 파일이 CI 밖이었다. 그 시험들은 오래 안 돈 탓에 이미 깨진 것이 섞여 있어(실제 PostgreSQL·
 *   고정 포트처럼 CI에 없는 환경 포함), 켜자마자 빨강이 되면 늘 빨간 CI가 되어 새 실패를 못 가린다. 그래서 첫 CI 실행의 실패를
 *   기준선(tests/ci넓은시험_알려진실패.json)으로 적고, 그보다 늘어난 실패만 빨강으로 친다 — 래칫이다. 기준선에서 빠질 수는 있어도
 *   늘지는 않게, 기준선에 있는데 통과한 시험은 「이제 통과 — 기준선에서 뺀다」로 알린다.
 * 기준선 줄: { 파일, 시험, 까닭 } — 까닭 없는 줄은 받지 않는다. 같은 파일·같은 이름이면 같은 실패다.
 * 시험 하나가 걸려도 묶음 전체가 멈추지 않게 시험마다 시간 한도(--test-timeout)를 둔다.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { tap실패 } = require('./lib/tap실패.js');

const ROOT = path.resolve(__dirname, '..');
const 기준선파일 = path.join(ROOT, 'tests', 'ci넓은시험_알려진실패.json');
const 회사 = 'docs/마케팅/온라인마케팅지도/engagement/company';
const 시험꼴 = /\.test\.(?:js|mjs|cjs)$/;
const 파일모름 = '(파일 모름)'; // TAP에 위치가 없는 실패(파일째 죽은 시험 등) — 기준선에서도 이 이름으로 짝짓는다
const 묶음들 = {
  루트: (p) => /^tests\/[^/]+\.test\.(?:mjs|cjs)$/.test(p),
  회사: (p) => p.startsWith(`${회사}/`) && 시험꼴.test(p),
  desktop: (p) => /^desktop\/tests\/[^/]+\.test\.cjs$/.test(p),
  experiences: (p) => p.startsWith('experiences/') && 시험꼴.test(p),
  tools: (p) => p.startsWith('tools/') && 시험꼴.test(p),
};

function 추적파일들(root = ROOT) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', 'ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 256 << 20 });
  return String(r.stdout || '').split('\0').filter(Boolean);
}

function 목록(묶음, root = ROOT, 추적 = 추적파일들(root)) {
  const 맞음 = 묶음들[묶음];
  if (!맞음) throw new Error(`모르는 묶음: ${묶음} (${Object.keys(묶음들).join(' · ')})`);
  return 추적.filter((p) => !/(^|\/)node_modules\//.test(p) && 맞음(p) && fs.existsSync(path.join(root, p))).sort();
}

/** TAP에서 깨진 잎 시험 {파일, 시험(「부모 › 잎」), 오류} — tools/lib/tap실패.js. 부모(subtestsFailed)는 세지 않는다. */
function 실패읽기(글, root = ROOT) {
  const r = tap실패(글, { root });
  return { ...r, 실패: r.실패.map((x) => ({ 파일: x.파일, 시험: x.시험, ...(x.오류 ? { 오류: x.오류 } : {}) })) }; // 셈도 그대로 넘긴다
}

function 기준선읽기(파일 = 기준선파일) {
  let 값;
  try { 값 = JSON.parse(fs.readFileSync(파일, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  for (const [묶음, 줄들] of Object.entries(값.묶음 || {})) {
    for (const x of 줄들) if (!x.파일 || !x.시험 || !String(x.까닭 || '').trim()) throw new Error(`기준선 ${묶음}: 파일·시험·까닭이 다 있어야 한다 — ${JSON.stringify(x)}`);
  }
  return 값;
}

/** 이번 실패와 기준선을 견준다 → { 새, 남은, 풀린 } */
function 견주기(실패, 기준) {
  const 열쇠 = (x) => `${x.파일 || 파일모름}\0${x.시험}`;
  const 알려진 = new Map((기준 || []).map((x) => [열쇠(x), x]));
  const 이번 = new Set(실패.map(열쇠));
  return {
    새: 실패.filter((x) => !알려진.has(열쇠(x))),
    남은: 실패.filter((x) => 알려진.has(열쇠(x))),
    풀린: (기준 || []).filter((x) => !이번.has(열쇠(x))),
  };
}

function 돌리기(묶음, { root = ROOT, 시험한도ms = 120000 } = {}) {
  const 파일들 = 목록(묶음, root);
  if (!파일들.length) return { 파일: 0, 시험: 0, 통과: 0, 실패수: 0, 실패: [], 초: 0 };
  const tap = path.join(os.tmpdir(), `synk-ci넓은시험-${묶음}-${process.pid}.tap`);
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const 시작 = Date.now();
  const r = spawnSync(process.execPath, ['--test', `--test-timeout=${시험한도ms}`, '--test-reporter=tap', `--test-reporter-destination=${tap}`,
    '--test-reporter=dot', '--test-reporter-destination=stdout', ...파일들], { cwd: root, env, stdio: ['ignore', 'inherit', 'inherit'] });
  let 글 = '';
  try { 글 = fs.readFileSync(tap, 'utf8'); } catch { /* 아래 */ } finally { fs.rmSync(tap, { force: true }); }
  return { 파일: 파일들.length, 종료: r.status, ...실패읽기(글, root), 초: Math.round((Date.now() - 시작) / 1000) };
}

/** wide-tests run 하나의 후보(artifact wide-baseline-*, 묶음마다 그 run의 실패)를 받는다 → { 묶음: [{파일, 시험, 오류}] } */
function 후보받기(runId, root = ROOT) {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci넓은시험-후보-'));
  try {
    const r = spawnSync('gh', ['run', 'download', String(runId), '--pattern', 'wide-baseline-*', '--dir', 임시], { cwd: root, encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) throw new Error(`후보를 못 받았다 — ${String(r.stderr || '').trim().split('\n')[0]}`);
    const 묶음 = {};
    for (const 폴더 of fs.readdirSync(임시)) {
      const 파일 = path.join(임시, 폴더, 'wide-baseline.json');
      if (!fs.existsSync(파일)) continue;
      const 후보 = JSON.parse(fs.readFileSync(파일, 'utf8'));
      묶음[후보.묶음] = 후보.실패.map((x) => ({ ...x, 파일: x.파일 || 파일모름 }));
    }
    return 묶음;
  } finally { fs.rmSync(임시, { recursive: true, force: true }); }
}

const 기준선설명 = 'wide-tests 기준선 — 여기 적힌 실패는 빨강으로 치지 않는다(tools/ci넓은시험.js). 고치면 줄이 빠진다(기준선줄이기). 손으로 늘리지 않는다.';

/** 처음 한 번 — 기준선이 없을 때 그 run의 실패로 기준선을 쓴다. 까닭은 그 run에서 본 오류 첫 줄이다. */
function 기준선모으기(runId, { root = ROOT, 날 = new Date().toISOString().slice(0, 10) } = {}) {
  const 받은 = 후보받기(runId, root);
  const 묶음 = Object.fromEntries(Object.entries(받은).map(([이름, 줄들]) => [이름, 줄들.map((x) => ({ 파일: x.파일, 시험: x.시험,
    까닭: `${날} 첫 Linux 실행(run ${runId})에서 이미 실패 — ${x.오류 || '오류 글 없음'}` }))]));
  const 값 = { 설명: 기준선설명, run: runId, 묶음 };
  fs.writeFileSync(기준선파일, `${JSON.stringify(값, null, 2)}\n`);
  return 값;
}

/** 래칫 — 기준선을 「지금 기준선 ∩ 그 run의 실패」로 줄인다. 그 run에서 통과한 줄만 빠지고, 새 실패는 절대 들이지 않는다.
 *  그 run에 후보가 없는 묶음은 그대로 둔다(못 본 것을 통과로 치지 않는다). */
function 기준선줄이기(runId, { root = ROOT, 받은 = null, 파일 = 기준선파일 } = {}) {
  const 기준 = 기준선읽기(파일);
  if (!기준) throw new Error('기준선 파일이 없다 — 처음에는 기준선모으기를 쓴다');
  const 이번 = 받은 || 후보받기(runId, root);
  const 열쇠 = (x) => `${x.파일 || 파일모름}\0${x.시험}`;
  const 뺀 = {};
  const 묶음 = {};
  for (const [이름, 줄들] of Object.entries(기준.묶음 || {})) {
    if (!이번[이름]) { 묶음[이름] = 줄들; continue; }
    const 지금 = new Set(이번[이름].map(열쇠));
    묶음[이름] = 줄들.filter((x) => 지금.has(열쇠(x)));
    뺀[이름] = 줄들.length - 묶음[이름].length;
  }
  fs.writeFileSync(파일, `${JSON.stringify({ ...기준, 설명: 기준선설명, 줄인run: runId, 묶음 }, null, 2)}\n`);
  return { 뺀, 묶음 };
}

function main(argv = process.argv.slice(2)) {
  if (argv[0] === '기준선모으기' || argv[0] === '기준선줄이기') {
    if (!/^\d+$/.test(argv[1] || '')) { console.error(`사용: node tools/ci넓은시험.js ${argv[0]} <wide-tests run 번호>`); return 2; }
    if (argv[0] === '기준선줄이기') {
      const { 뺀, 묶음 } = 기준선줄이기(argv[1]);
      for (const [이름, 줄들] of Object.entries(묶음)) console.log(`${이름}: 알려진 실패 ${줄들.length}개${뺀[이름] ? ` (이제 통과해 ${뺀[이름]}개 뺌)` : ''}`);
    } else {
      const 값 = 기준선모으기(argv[1]);
      for (const [묶음, 줄들] of Object.entries(값.묶음)) console.log(`${묶음}: 알려진 실패 ${줄들.length}개`);
    }
    console.log(`→ ${path.relative(ROOT, 기준선파일)}`);
    return 0;
  }
  const 묶음 = argv[0];
  if (!묶음 || !묶음들[묶음]) { console.error(`사용: node tools/ci넓은시험.js <${Object.keys(묶음들).join('|')}> [--목록] [--기준선 <파일>]`); return 2; }
  if (argv.includes('--목록')) { for (const p of 목록(묶음)) console.log(p); return 0; }
  const 값 = (이름) => { const i = argv.indexOf(이름); return i >= 0 ? argv[i + 1] : null; };
  const 처음후보 = 값('--기준선'), 후보 = 값('--후보');
  const r = 돌리기(묶음);
  console.log(`\n[${묶음}] 파일 ${r.파일} · 시험 ${r.시험} · 통과 ${r.통과} · 실패 ${r.실패수} · 건너뜀 ${r.건너뜀} · ${r.초}초`);
  if (r.실패수 && !r.실패.length) console.log('  (실패를 TAP에서 못 읽었다 — 스폰 실패·구문 오류 쪽을 본다)');
  // 이번 실패는 늘 후보로 남긴다 — 기준선줄이기가 통과하기 시작한 줄을 그 run으로 뺀다.
  for (const 파일 of [처음후보, 후보].filter(Boolean)) {
    fs.mkdirSync(path.dirname(path.resolve(파일)), { recursive: true });
    fs.writeFileSync(파일, JSON.stringify({ 묶음, 만든때: new Date().toISOString(), 실패: r.실패 }, null, 2));
  }
  if (처음후보) {
    console.log(`  기준선 후보 ${r.실패.length}줄 → ${처음후보} (기준선이 없어 이번 판정은 막지 않는다)`);
    for (const x of r.실패) console.log(`  · ${x.파일 || 파일모름} — ${x.시험}`);
    return 0;
  }
  const 기준 = 기준선읽기();
  if (!기준) console.log('  기준선 파일이 없다 — 이번 실패를 모두 새 실패로 친다');
  const 판 = 종료판정(r, 기준 && 기준.묶음 ? 기준.묶음[묶음] : []);
  for (const 줄 of 판.줄들) console.log(`  ${줄}`);
  return 판.코드;
}

/** 돌린 결과와 기준선 줄들로 종료 코드와 찍을 줄을 정한다. 기준선에 실패가 있어도 못 읽은 실패·끝까지 못 간 실행은 빨강이다
 *  — 그런 실패가 기준선 뒤에 숨지 않게(아르곤 10-22 P1). */
function 종료판정(r, 기준줄들) {
  const { 새, 남은, 풀린 } = 견주기(r.실패, 기준줄들);
  const 줄들 = [];
  if (남은.length) 줄들.push(`알려진 실패 ${남은.length}개(기준선) — 그대로`);
  for (const x of 풀린) 줄들.push(`✓ 이제 통과 — 기준선에서 뺀다: ${x.파일} — ${x.시험}`);
  for (const x of 새) 줄들.push(`✗ 새 실패: ${x.파일 || 파일모름} — ${x.시험}`);
  const 읽은수 = r.셈 ?? r.실패.length;
  if (r.실패수 > 읽은수) {
    줄들.push(`TAP 요약의 실패 ${r.실패수}개 가운데 ${r.실패수 - 읽은수}개를 못 읽었다 — 파일째 죽은 시험·스폰 실패 쪽을 본다`);
    return { 코드: 1, 줄들 };
  }
  if (r.파일 && !r.시험) { 줄들.push('TAP 요약(# tests)이 없다 — 시험 실행기가 끝까지 못 갔다'); return { 코드: 1, 줄들 }; }
  if (r.종료 !== undefined && r.종료 !== 0 && !r.실패수) { 줄들.push(`node --test 종료 ${r.종료} — 시험 밖에서 실패했다`); return { 코드: 1, 줄들 }; }
  return { 코드: 새.length ? 1 : 0, 줄들 };
}

if (require.main === module) process.exitCode = main();

module.exports = { 목록, 실패읽기, 기준선읽기, 견주기, 종료판정, 기준선모으기, 기준선줄이기, 묶음들, 기준선파일 };
