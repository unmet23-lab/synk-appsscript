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
 *   node tools/ci넓은시험.js 자산받기 <묶음>         git이 무시하는 출시 자산 가운데 공개 저장소에 같은 바이트로 실린 것을 받아 놓는다(wide-tests가 시험 전에)
 *   묶음: 루트 · 회사 · desktop · experiences · tools
 *
 * 왜 있나: 10-21 조사에서 CI가 도는 시험은 루트 tests/*.test.js(190개 파일)뿐이고, 루트 .mjs·.cjs 172개와 회사 서버 320개·
 *   PC 앱 75개·경험 앱 341개·tools 66개 파일이 CI 밖이었다. 그 시험들은 오래 안 돈 탓에 이미 깨진 것이 섞여 있어(실제 PostgreSQL·
 *   고정 포트처럼 CI에 없는 환경 포함), 켜자마자 빨강이 되면 늘 빨간 CI가 되어 새 실패를 못 가린다. 그래서 첫 CI 실행의 실패를
 *   기준선(tests/ci넓은시험_알려진실패.json)으로 적고, 그보다 늘어난 실패만 빨강으로 친다 — 래칫이다. 기준선에서 빠질 수는 있어도
 *   늘지는 않게, 기준선에 있는데 통과한 시험은 「이제 통과 — 기준선에서 뺀다」로 알린다.
 * 기준선 줄: { 파일, 시험, 까닭 } — 까닭 없는 줄은 받지 않는다. 같은 파일·같은 이름이면 같은 실패다.
 *   시험 이름이 파일 경로인 줄(파일째 죽은 시험 — 모듈 없음·맨 위 예외)은 그 파일의 시험을 모두 덮는다. 그때는 파일 안 시험이
 *   하나도 돌지 않았으니, 원인을 고쳐 안의 시험이 돌다 깨져도 「늘어난 실패」가 아니다. 기준선줄이기는 그 줄을 그 run에서 실제로
 *   깨진 안의 시험으로 좁힌다(덮는 범위는 줄기만 한다, 10-22).
 * 파일째 죽은 시험의 원인은 점 보고기에 안 나온다 — node가 그 파일의 stderr를 TAP 「# 」 줄로 그 파일 바로 앞에 찍으니 거기서 거둬
 *   오류로 삼고 로그에도 보인다(10-22 — 「test failed」만으로는 원인을 못 가렸다).
 * 시험 하나가 걸려도 묶음 전체가 멈추지 않게 시험마다 시간 한도(--test-timeout)를 둔다.
 */
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
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

/** 파일째 죽은 시험의 stderr 줄 — node는 파일마다 출력을 모아 그 파일의 「# Subtest: <파일>」 바로 앞에 「# 」 줄로 찍는다. */
function 파일째출력(글, 잎) {
  const 줄들 = String(글 || '').replace(/\r/g, '').split('\n');
  const 자리 = 줄들.indexOf(`# Subtest: ${잎}`);
  const 모음 = [];
  for (let j = 자리 - 1; 자리 > 0 && j >= 0 && 줄들[j].startsWith('# ') && !줄들[j].startsWith('# Subtest: '); j--) 모음.unshift(줄들[j].slice(2));
  return 모음.filter((l) => l.trim() && !/^\s+at /.test(l) && !/^Node\.js v\d/.test(l));
}

/** TAP에서 깨진 잎 시험 {파일, 시험(「부모 › 잎」), 오류} — tools/lib/tap실패.js. 부모(subtestsFailed)는 세지 않는다.
 *  파일째 죽은 시험은 「test failed」 대신 그 파일의 stderr에서 오류 줄을 찾아 오류로 삼고, stderr 앞 줄들을 출력으로 붙인다. */
function 실패읽기(글, root = ROOT) {
  const r = tap실패(글, { root });
  return { ...r, 실패: r.실패.map((x) => {
    const 출력 = x.파일 && x.시험 === x.파일 ? 파일째출력(글, x.잎) : [];
    const 오류 = 출력.find((l) => /Error|ENOENT|Cannot find|not found/i.test(l)) || x.오류;
    return { 파일: x.파일, 시험: x.시험, ...(오류 ? { 오류: 오류.trim().slice(0, 200) } : {}), ...(출력.length ? { 출력: 출력.slice(0, 12) } : {}) };
  }) }; // 셈도 그대로 넘긴다
}

function 기준선읽기(파일 = 기준선파일) {
  let 값;
  try { 값 = JSON.parse(fs.readFileSync(파일, 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  for (const [묶음, 줄들] of Object.entries(값.묶음 || {})) {
    for (const x of 줄들) if (!x.파일 || !x.시험 || !String(x.까닭 || '').trim()) throw new Error(`기준선 ${묶음}: 파일·시험·까닭이 다 있어야 한다 — ${JSON.stringify(x)}`);
  }
  return 값;
}

const 파일째줄 = (x) => Boolean(x.파일) && x.파일 !== 파일모름 && x.시험 === x.파일;

/** 이번 실패와 기준선을 견준다 → { 새, 남은, 풀린, 좁힐 }
 *  파일째 줄은 그 파일의 실패를 모두 덮는다. 그 파일이 이제 안 죽고 안의 시험만 깨지면 「좁힐」이다(기준선줄이기가 좁힌다). */
function 견주기(실패, 기준) {
  const 열쇠 = (x) => `${x.파일 || 파일모름}\0${x.시험}`;
  const 알려진 = new Map((기준 || []).map((x) => [열쇠(x), x]));
  const 덮는파일 = new Set((기준 || []).filter(파일째줄).map((x) => x.파일));
  const 앎 = (x) => 알려진.has(열쇠(x)) || 덮는파일.has(x.파일);
  const 이번 = new Set(실패.map(열쇠)), 이번파일 = new Set(실패.map((x) => x.파일));
  return {
    새: 실패.filter((x) => !앎(x)),
    남은: 실패.filter(앎),
    풀린: (기준 || []).filter((x) => (파일째줄(x) ? !이번파일.has(x.파일) : !이번.has(열쇠(x)))),
    좁힐: (기준 || []).filter((x) => 파일째줄(x) && 이번파일.has(x.파일) && !이번.has(열쇠(x))),
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

/* git이 무시하는(*.glb) 출시 자산 가운데 공개 저장소 synk-policy에 같은 바이트로 실린 것 — 저장소의 출시 목록(sha256·bytes)과
 * 맞을 때만 제자리에 놓는다. 이미 있는 파일은 건드리지 않는다. 받지 못하면 그 시험이 그대로 깨져 보인다(숨기지 않는다). */
const 공개자산 = {
  experiences: [{ 목록: 'experiences/korean-racing/qa/package-manifest.json', 자리: 'experiences/korean-racing',
    원본: 'https://raw.githubusercontent.com/unmet23-lab/synk-policy/main/try/racing', 경로: ['assets/car.glb', 'assets/coastal-rocks-v6.glb'] }],
};

async function 공개자산받기(묶음, { root = ROOT, 받기 = (url) => fetch(url) } = {}) {
  const 줄들 = [];
  for (const 판 of 공개자산[묶음] || []) {
    const 목록 = JSON.parse(fs.readFileSync(path.join(root, 판.목록), 'utf8'));
    for (const rel of 판.경로) {
      const 자리 = path.join(root, 판.자리, rel), 기대 = (목록.files || []).find((x) => x.path === rel);
      if (fs.existsSync(자리)) { 줄들.push(`있음 — ${판.자리}/${rel}`); continue; }
      if (!기대) { 줄들.push(`✗ 출시 목록에 없다 — ${판.목록}의 ${rel}`); continue; }
      try {
        const 답 = await 받기(`${판.원본}/${rel}`);
        if (!답.ok) throw new Error(`HTTP ${답.status}`);
        const 바이트 = Buffer.from(await 답.arrayBuffer());
        const 해시 = crypto.createHash('sha256').update(바이트).digest('hex');
        if (바이트.length !== 기대.bytes || 해시 !== 기대.sha256) throw new Error(`출시 목록과 다르다(${바이트.length}바이트 ${해시.slice(0, 12)})`);
        fs.mkdirSync(path.dirname(자리), { recursive: true });
        fs.writeFileSync(자리, 바이트);
        줄들.push(`받음 — ${판.자리}/${rel} (${바이트.length}바이트, 출시 목록 해시 일치)`);
      } catch (e) { 줄들.push(`✗ 못 받음 — ${판.자리}/${rel}: ${e.message}`); }
    }
  }
  return 줄들;
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
 *  파일째 줄은 그 파일이 이제 안 죽으면 그 run에서 실제로 깨진 안의 시험 줄로 좁힌다(그 줄이 원래 덮던 범위 안이다).
 *  그 run에 후보가 없는 묶음은 그대로 둔다(못 본 것을 통과로 치지 않는다). */
function 기준선줄이기(runId, { root = ROOT, 받은 = null, 파일 = 기준선파일, 날 = new Date().toISOString().slice(0, 10) } = {}) {
  const 기준 = 기준선읽기(파일);
  if (!기준) throw new Error('기준선 파일이 없다 — 처음에는 기준선모으기를 쓴다');
  const 이번 = 받은 || 후보받기(runId, root);
  const 열쇠 = (x) => `${x.파일 || 파일모름}\0${x.시험}`;
  const 뺀 = {}, 좁힌 = {};
  const 묶음 = {};
  for (const [이름, 줄들] of Object.entries(기준.묶음 || {})) {
    if (!이번[이름]) { 묶음[이름] = 줄들; continue; }
    const 지금 = new Set(이번[이름].map(열쇠));
    const 남김 = [], 넣은 = new Set();
    const 넣기 = (x) => { if (!넣은.has(열쇠(x))) { 넣은.add(열쇠(x)); 남김.push(x); } };
    for (const x of 줄들) {
      if (지금.has(열쇠(x))) { 넣기(x); continue; }
      if (!파일째줄(x)) continue;
      const 안 = 이번[이름].filter((y) => y.파일 === x.파일);
      if (안.length) 좁힌[이름] = (좁힌[이름] || 0) + 1;
      for (const y of 안) 넣기({ 파일: y.파일, 시험: y.시험, 까닭: `${날} run ${runId}에서 파일째 죽던 것이 풀린 뒤 남은 실패 — ${y.오류 || '오류 글 없음'}` });
    }
    묶음[이름] = 남김;
    뺀[이름] = 줄들.filter((x) => !넣은.has(열쇠(x)) && !(파일째줄(x) && 이번[이름].some((y) => y.파일 === x.파일))).length;
  }
  fs.writeFileSync(파일, `${JSON.stringify({ ...기준, 설명: 기준선설명, 줄인run: runId, 묶음 }, null, 2)}\n`);
  return { 뺀, 좁힌, 묶음 };
}

function main(argv = process.argv.slice(2)) {
  if (argv[0] === '기준선모으기' || argv[0] === '기준선줄이기') {
    if (!/^\d+$/.test(argv[1] || '')) { console.error(`사용: node tools/ci넓은시험.js ${argv[0]} <wide-tests run 번호>`); return 2; }
    if (argv[0] === '기준선줄이기') {
      const { 뺀, 좁힌, 묶음 } = 기준선줄이기(argv[1]);
      for (const [이름, 줄들] of Object.entries(묶음)) console.log(`${이름}: 알려진 실패 ${줄들.length}개${뺀[이름] ? ` (이제 통과해 ${뺀[이름]}개 뺌)` : ''}${좁힌[이름] ? ` (파일째 줄 ${좁힌[이름]}개를 남은 실패로 좁힘)` : ''}`);
    } else {
      const 값 = 기준선모으기(argv[1]);
      for (const [묶음, 줄들] of Object.entries(값.묶음)) console.log(`${묶음}: 알려진 실패 ${줄들.length}개`);
    }
    console.log(`→ ${path.relative(ROOT, 기준선파일)}`);
    return 0;
  }
  if (argv[0] === '자산받기') {
    if (!묶음들[argv[1]]) { console.error(`사용: node tools/ci넓은시험.js 자산받기 <${Object.keys(묶음들).join('|')}>`); return 2; }
    return 공개자산받기(argv[1]).then((줄들) => { for (const 줄 of 줄들) console.log(줄); return 0; });
  }
  const 묶음 = argv[0];
  if (!묶음 || !묶음들[묶음]) { console.error(`사용: node tools/ci넓은시험.js <${Object.keys(묶음들).join('|')}> [--목록] [--기준선 <파일>]`); return 2; }
  if (argv.includes('--목록')) { for (const p of 목록(묶음)) console.log(p); return 0; }
  const 값 = (이름) => { const i = argv.indexOf(이름); return i >= 0 ? argv[i + 1] : null; };
  const 처음후보 = 값('--기준선'), 후보 = 값('--후보');
  const r = 돌리기(묶음);
  console.log(`\n[${묶음}] 파일 ${r.파일} · 시험 ${r.시험} · 통과 ${r.통과} · 실패 ${r.실패수} · 건너뜀 ${r.건너뜀} · ${r.초}초`);
  if (r.실패수 && !r.실패.length) console.log('  (실패를 TAP에서 못 읽었다 — 스폰 실패·구문 오류 쪽을 본다)');
  for (const x of r.실패.filter((y) => y.출력)) { console.log(`  ⤷ 파일째 죽음: ${x.파일}`); for (const l of x.출력.slice(0, 6)) console.log(`      ${l.slice(0, 240)}`); }
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
  const { 새, 남은, 풀린, 좁힐 } = 견주기(r.실패, 기준줄들);
  const 줄들 = [];
  if (남은.length) 줄들.push(`알려진 실패 ${남은.length}개(기준선) — 그대로`);
  for (const x of 풀린) 줄들.push(`✓ 이제 통과 — 기준선에서 뺀다: ${x.파일} — ${x.시험}`);
  for (const x of 좁힐) 줄들.push(`◐ 파일째 죽던 것이 풀려 안의 시험만 깨진다 — 기준선줄이기가 그 줄로 좁힌다: ${x.파일}`);
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

if (require.main === module) Promise.resolve(main()).then((코드) => { process.exitCode = 코드; }, (e) => { console.error(e.message); process.exitCode = 1; });

module.exports = { 목록, 실패읽기, 기준선읽기, 견주기, 종료판정, 기준선모으기, 기준선줄이기, 공개자산받기, 묶음들, 기준선파일 };
