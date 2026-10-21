#!/usr/bin/env node
'use strict';
/* CI 넓은 시험 — 루트 `tests/*.test.js` 밖의 시험(루트 .mjs·.cjs와 제품 폴더)을 CI에서 돌리고,
 * 알려진 실패(기준선)보다 늘어난 실패만 빨강으로 친다 (2026-10-22, wide-tests.yml이 묶음마다 부른다).
 *
 *   node tools/ci넓은시험.js <묶음>             돌리고 판정한다(새 실패가 있으면 종료 1)
 *   node tools/ci넓은시험.js <묶음> --목록      돌릴 파일만 보인다
 *   node tools/ci넓은시험.js <묶음> --기준선 <파일>   이번 실패를 기준선 후보 JSON으로 쓴다(이번 판정은 막지 않는다)
 *   node tools/ci넓은시험.js 기준선모으기 <run 번호>  그 wide-tests run의 후보 다섯을 받아 기준선 파일을 쓴다(까닭 = 본 오류 첫 줄)
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
  return { ...r, 실패: r.실패.map((x) => ({ 파일: x.파일, 시험: x.시험, ...(x.오류 ? { 오류: x.오류 } : {}) })) };
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

/** wide-tests run 하나의 기준선 후보(artifact wide-baseline-*)를 모아 기준선 파일을 쓴다. 까닭은 그 run에서 본 오류 첫 줄이다. */
function 기준선모으기(runId, { root = ROOT, 날 = new Date().toISOString().slice(0, 10) } = {}) {
  const 임시 = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-ci넓은시험-후보-'));
  try {
    const r = spawnSync('gh', ['run', 'download', String(runId), '--pattern', 'wide-baseline-*', '--dir', 임시], { cwd: root, encoding: 'utf8', windowsHide: true });
    if (r.status !== 0) throw new Error(`후보를 못 받았다 — ${String(r.stderr || '').trim().split('\n')[0]}`);
    const 묶음 = {};
    for (const 폴더 of fs.readdirSync(임시)) {
      const 파일 = path.join(임시, 폴더, 'wide-baseline.json');
      if (!fs.existsSync(파일)) continue;
      const 후보 = JSON.parse(fs.readFileSync(파일, 'utf8'));
      묶음[후보.묶음] = 후보.실패.map((x) => ({ 파일: x.파일 || 파일모름, 시험: x.시험,
        까닭: `${날} 첫 Linux 실행(run ${runId})에서 이미 실패 — ${x.오류 || '오류 글 없음'}` }));
    }
    const 값 = { 설명: 'wide-tests 기준선 — 여기 적힌 실패는 빨강으로 치지 않는다(tools/ci넓은시험.js). 고치면 줄을 뺀다. 늘리지 않는다.', run: runId, 묶음 };
    fs.writeFileSync(기준선파일, `${JSON.stringify(값, null, 2)}\n`);
    return 값;
  } finally { fs.rmSync(임시, { recursive: true, force: true }); }
}

function main(argv = process.argv.slice(2)) {
  if (argv[0] === '기준선모으기') {
    if (!/^\d+$/.test(argv[1] || '')) { console.error('사용: node tools/ci넓은시험.js 기준선모으기 <wide-tests run 번호>'); return 2; }
    const 값 = 기준선모으기(argv[1]);
    for (const [묶음, 줄들] of Object.entries(값.묶음)) console.log(`${묶음}: 알려진 실패 ${줄들.length}개`);
    console.log(`→ ${path.relative(ROOT, 기준선파일)}`);
    return 0;
  }
  const 묶음 = argv[0];
  if (!묶음 || !묶음들[묶음]) { console.error(`사용: node tools/ci넓은시험.js <${Object.keys(묶음들).join('|')}> [--목록] [--기준선 <파일>]`); return 2; }
  if (argv.includes('--목록')) { for (const p of 목록(묶음)) console.log(p); return 0; }
  const k = argv.indexOf('--기준선');
  const 후보파일 = k >= 0 ? argv[k + 1] : null;
  const r = 돌리기(묶음);
  console.log(`\n[${묶음}] 파일 ${r.파일} · 시험 ${r.시험} · 통과 ${r.통과} · 실패 ${r.실패수} · 건너뜀 ${r.건너뜀} · ${r.초}초`);
  if (r.실패수 && !r.실패.length) console.log('  (실패를 TAP에서 못 읽었다 — 스폰 실패·구문 오류 쪽을 본다)');
  if (후보파일) {
    fs.mkdirSync(path.dirname(path.resolve(후보파일)), { recursive: true });
    fs.writeFileSync(후보파일, JSON.stringify({ 묶음, 만든때: new Date().toISOString(), 실패: r.실패 }, null, 2));
    console.log(`  기준선 후보 ${r.실패.length}줄 → ${후보파일} (이번 판정은 막지 않는다)`);
    for (const x of r.실패) console.log(`  · ${x.파일 || '(파일 모름)'} — ${x.시험}`);
    return 0;
  }
  const 기준 = 기준선읽기();
  if (!기준) { console.log('  기준선 파일이 없다 — 이번 실패를 모두 새 실패로 친다'); }
  const { 새, 남은, 풀린 } = 견주기(r.실패, 기준 && 기준.묶음 ? 기준.묶음[묶음] : []);
  if (남은.length) console.log(`  알려진 실패 ${남은.length}개(기준선) — 그대로`);
  for (const x of 풀린) console.log(`  ✓ 이제 통과 — 기준선에서 뺀다: ${x.파일} — ${x.시험}`);
  for (const x of 새) console.log(`  ✗ 새 실패: ${x.파일 || '(파일 모름)'} — ${x.시험}`);
  if (r.실패수 && !r.실패.length) return 1;
  if (r.종료 !== 0 && !r.실패수 && !새.length) { console.log(`  node --test 종료 ${r.종료} — 시험 밖에서 실패했다`); return 1; }
  return 새.length ? 1 : 0;
}

if (require.main === module) process.exitCode = main();

module.exports = { 목록, 실패읽기, 기준선읽기, 견주기, 기준선모으기, 묶음들, 기준선파일 };
