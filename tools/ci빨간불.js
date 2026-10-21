#!/usr/bin/env node
'use strict';
/* CI 빨간불 — master의 GitHub Actions가 빨개지면 「언제부터·어느 커밋·어느 시험」을 AI 없이 읽어 알린다 (2026-10-21).
 *
 * 왜 있나: 10-21 17:05부터 master syntax-check가 50회 연속 빨갰다. 깨진 시험은 하나였고 로그에 안내까지 찍혀 있었는데,
 *   CI 실패를 알리는 장치가 없어 다섯 시간 넘게 아무도 고치지 않았다(세션 둘이 보고 「알림」만 남겼다). 그사이 push는 계속
 *   나갔고 운영 반영도 그 위로 지나갔다 — 늘 빨간 CI는 새 실패를 가려 주지 못한다.
 *
 *   node tools/ci빨간불.js                    지금 master 상태(워크플로마다 초록·빨강, 빨강이면 언제부터·첫 빨강 커밋·깨진 시험)
 *   node tools/ci빨간불.js --json
 *   node tools/ci빨간불.js --알림             바뀐 것이 있으면 텔레그램 한 통(빨개짐 · 3시간째 · 다시 초록). 작업 스케줄러가 10분마다
 *   node tools/ci빨간불.js 예약등록 [--실행]  그 예약을 Windows 작업 스케줄러에 건다(기본은 미리 보기). 공용 작업본 경로로 건다
 *
 * 읽는 법: `gh run list --branch master`로 워크플로마다 최근 run을 읽는다. 끝난 run 가운데 success는 초록, failure·timed_out·
 *   startup_failure는 빨강이고 cancelled·skipped·neutral은 셈에서 뺀다(새 push가 기다리던 run을 바꿔 끼우면 취소가 난다).
 *   빨강이면 마지막 초록 바로 뒤 run의 커밋이 「첫 빨강」이고, 최신 빨강 run의 실패 로그(`--log-failed`)에서 `not ok` 시험·위치와
 *   시험이 찍은 「→」 안내를 뽑는다. 스텝이 하나도 안 돈 run은 「잡이 시작도 못 했다」다(결제·한도 — 원격ci.js 미기동인가).
 * 🔴 고침 명령을 대신 돌리지 않는다 — 10-21 시험이 찍은 「심는다」는 필요 없는 고침이었고 진짜 원인은 시험 술어였다.
 *   알림은 고칠 세션이 바로 읽을 재료까지만 준다. push 때마다 같은 상태를 바로올리기가 경고로 보인다(빠른상태).
 * 못 읽으면(gh 없음·인증·네트워크) 「모름」이고 상태를 바꾸지 않는다 — 못 본 것을 초록으로 적으면 다음 빨강을 놓친다.
 * 상태 파일은 공용 git 폴더 안(<git-common-dir>/synk-ci빨간불/상태.json)이라 워크트리·공용 작업본이 같이 보고, 저장소에는 안 들어간다.
 * 시험·재현: SYNK_TG_DRYRUN_DIR(텔레그램 대신 그 폴더에 글을 쓴다 — 텔레그램승인.js와 같다) · SYNK_CI빨간불_상태(상태 파일 경로).
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { tap실패 } = require('./lib/tap실패.js');

const ROOT = path.resolve(__dirname, '..');
const 가지 = 'master';
const 창 = 100;
const 빨강결론 = new Set(['failure', 'timed_out', 'startup_failure']);
const 셈밖결론 = new Set(['cancelled', 'skipped', 'neutral', 'stale', 'action_required']);
const 다시알림ms = [3 * 3600e3, 12 * 3600e3]; // 처음 알린 뒤 3시간에 한 번, 그 뒤로는 12시간마다
const 빠른상태신선ms = 10 * 60e3;
const 예약이름 = 'SYNK CI 빨간불 알림';
const 예약간격분 = 10;

function 실행기(cwd = ROOT) {
  return (cmd, args, { timeout = 60000 } = {}) => {
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 << 20, timeout });
    if (r.error) return { ok: false, 사유: `${cmd} 실행 불가 (${r.error.code || r.error.message})` };
    if (r.status !== 0) return { ok: false, 사유: String(r.stderr || '').trim().split('\n')[0] || `${cmd} 종료 ${r.status}` };
    return { ok: true, out: String(r.stdout || '') };
  };
}

/** origin 주소에서 owner/repo — GitHub가 아니면 null(임시 저장소·로컬 원격에서는 아무것도 묻지 않는다). */
function 저장소이름(sh) {
  const r = sh('git', ['remote', 'get-url', 'origin'], { timeout: 10000 });
  if (!r.ok) return null;
  const m = r.out.trim().match(/github\.com[:/]+([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

function 공용git폴더(sh) {
  const r = sh('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { timeout: 10000 });
  return r.ok ? r.out.trim() : null;
}

function 상태파일(sh, 환경 = process.env) {
  if (환경.SYNK_CI빨간불_상태) return 환경.SYNK_CI빨간불_상태;
  const g = 공용git폴더(sh);
  return g ? path.join(g, 'synk-ci빨간불', '상태.json') : null;
}

function gh실행(sh) {
  return (args, 옵션) => {
    const r = sh('gh', args, 옵션);
    if (r.ok || !/실행 불가/.test(r.사유)) return r;
    const 기본 = 'C:\\Program Files\\GitHub CLI\\gh.exe'; // 작업 스케줄러에서 PATH가 짧을 때
    return fs.existsSync(기본) ? sh(기본, args, 옵션) : r;
  };
}

/** master run 목록. 워크플로를 주면 그 워크플로만(자주 도는 워크플로가 드문 워크플로를 창 밖으로 밀지 않게 — 아르곤 10-22 P2). */
function run목록(gh, repo, 한도 = 창, 워크플로 = null) {
  const r = gh(['run', 'list', '--repo', repo, '--branch', 가지, '--limit', String(한도), ...(워크플로 ? ['--workflow', 워크플로] : []),
    '--json', 'databaseId,workflowName,status,conclusion,createdAt,headSha,displayTitle,event,url'], { timeout: 30000 });
  if (!r.ok) return { ok: false, 사유: r.사유 };
  try { return { ok: true, runs: JSON.parse(r.out) }; } catch (e) { return { ok: false, 사유: `gh 출력이 JSON이 아니다 (${e.message})` }; }
}

/** 이 저장소 워크플로 파일 이름들(.github/workflows). 못 읽으면 빈 배열(그때는 한데 묶어 읽는다). */
function 워크플로파일들(root = ROOT) {
  try { return fs.readdirSync(path.join(root, '.github', 'workflows')).filter((f) => /\.ya?ml$/.test(f)).sort(); } catch { return []; }
}

/** 워크플로마다 따로 읽어 모은다 — 하나라도 못 읽으면 그 이유를 돌려준다(못 본 것을 초록으로 적지 않는다). */
function 워크플로별run(gh, repo, 파일들, 한도 = 50) {
  if (!파일들.length) return run목록(gh, repo);
  const 모음 = [];
  for (const 파일 of 파일들) {
    const r = run목록(gh, repo, 한도, 파일);
    if (!r.ok) return { ok: false, 사유: `${파일}: ${r.사유}` };
    모음.push(...r.runs);
  }
  return { ok: true, runs: 모음 };
}

/** 워크플로마다 지금 판정 — runs는 gh run list 결과(아무 순서). */
function 판정하기(runs) {
  const 묶음 = new Map();
  for (const r of runs || []) {
    if (!['push', 'workflow_dispatch', 'schedule'].includes(r.event)) continue;
    if (!묶음.has(r.workflowName)) 묶음.set(r.workflowName, []);
    묶음.get(r.workflowName).push(r);
  }
  const 결과 = [];
  for (const [워크플로, 목록] of 묶음) {
    목록.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const 끝난 = 목록.filter((r) => r.status === 'completed' && !셈밖결론.has(r.conclusion));
    const 도는중 = 목록.filter((r) => r.status !== 'completed').length;
    if (!끝난.length) { 결과.push({ 워크플로, 상태: '모름', 도는중 }); continue; }
    const 최신 = 끝난[0];
    if (!빨강결론.has(최신.conclusion)) { 결과.push({ 워크플로, 상태: '초록', 최신: 요약run(최신), 도는중 }); continue; }
    let 회수 = 0, 첫 = null, 초록찾음 = false;
    for (const r of 끝난) {
      if (!빨강결론.has(r.conclusion)) { 초록찾음 = true; break; }
      회수++; 첫 = r;
    }
    결과.push({ 워크플로, 상태: '빨강', 최신: 요약run(최신), 첫빨강: 요약run(첫), 회수, 첫빨강확실: 초록찾음, 도는중 });
  }
  const 순서 = (w) => (w === 'syntax-check' ? 0 : w === 'records-check' ? 1 : 2);
  return 결과.sort((a, b) => 순서(a.워크플로) - 순서(b.워크플로) || a.워크플로.localeCompare(b.워크플로));
}

function 요약run(r) {
  return r && { run: r.databaseId, sha: String(r.headSha || ''), 제목: String(r.displayTitle || '').split('\n')[0], 시각: r.createdAt, 결론: r.conclusion, url: r.url };
}

/** --log-failed 글에서 깨진 잎 시험(「부모 › 잎」·위치)과 시험이 찍은 「→」 안내를 뽑는다. 한 줄은 「잡\t단계\t시각 글」 꼴이다. */
function 실패읽기(로그) {
  const 줄들 = String(로그 || '').replace(/\r/g, '').split('\n').map((l) => {
    const 칸 = l.split('\t');
    const 글 = 칸.length >= 3 ? 칸.slice(2).join('\t') : l;
    return { 단계: 칸.length >= 3 ? 칸[1] : '', 글: 글.replace(/^\uFEFF?\d{4}-\d\d-\d\dT[\d:.]+Z ?/, '') };
  });
  // 깨진 잎 시험은 tools/lib/tap실패.js가 읽는다(describe 안의 하위 시험은 「부모 › 잎」). wide-tests(tools/ci넓은시험.js)는
  // 기준선에 없는 실패만 「✗ 새 실패: 파일 — 시험」으로 찍으니 그 줄도 읽는다.
  const 시험들 = new Map();
  for (const { 글 } of 줄들) {
    const 넓은 = 글.match(/^\s*✗ 새 실패: (.+?) — (.+?)\s*$/);
    if (넓은 && !시험들.has(넓은[2])) 시험들.set(넓은[2], { 이름: 넓은[2].slice(0, 200), 위치: 넓은[1] === '(파일 모름)' ? null : 넓은[1], 안내: [] });
  }
  for (const x of tap실패(줄들.map((x) => x.글).join('\n')).실패) {
    if (!시험들.has(x.시험)) 시험들.set(x.시험, { 이름: x.시험.slice(0, 200), 위치: x.위치, 안내: x.안내 });
  }
  const 단계들 = [...new Set(줄들.map((x) => x.단계).filter(Boolean))];
  return { 시험: [...시험들.values()].slice(0, 5), 시험수: 시험들.size, 단계: 단계들.slice(0, 5) };
}

function 실패자세히(gh, repo, runId) {
  const 로그 = gh(['run', 'view', String(runId), '--repo', repo, '--log-failed'], { timeout: 60000 });
  const 읽음 = 로그.ok ? 실패읽기(로그.out) : { 시험: [], 시험수: 0, 단계: [] };
  if (읽음.시험수) return 읽음;
  const j = gh(['run', 'view', String(runId), '--repo', repo, '--json', 'jobs'], { timeout: 30000 });
  let jobs = null;
  try { jobs = j.ok ? JSON.parse(j.out).jobs || [] : null; } catch { jobs = null; }
  if (jobs) {
    const { 미기동인가 } = require('./원격ci.js');
    if (미기동인가(jobs)) return { ...읽음, 미기동: true };
    const 깨진단계 = jobs.flatMap((job) => (job.steps || []).filter((s) => 빨강결론.has(s.conclusion)).map((s) => s.name));
    if (깨진단계.length) return { ...읽음, 단계: [...new Set(깨진단계)].slice(0, 5) };
  }
  return 로그.ok ? 읽음 : { ...읽음, 로그못읽음: 로그.사유 };
}

function 지금읽기({ sh = 실행기(), 자세히 = true, 파일들 = 워크플로파일들() } = {}) {
  const repo = 저장소이름(sh);
  if (!repo) return { 상태: '모름', 이유: 'origin이 GitHub 저장소가 아니다', 워크플로: [] };
  const gh = gh실행(sh);
  const 목록 = 워크플로별run(gh, repo, 파일들);
  if (!목록.ok) return { 상태: '모름', 이유: `gh로 run을 못 읽었다 — ${목록.사유}`, repo, 워크플로: [] };
  const 워크플로 = 판정하기(목록.runs);
  if (자세히) for (const w of 워크플로) if (w.상태 === '빨강') w.자세히 = 실패자세히(gh, repo, w.최신.run);
  const 상태 = 워크플로.some((w) => w.상태 === '빨강') ? '빨강' : 워크플로.some((w) => w.상태 === '초록') ? '초록' : '모름';
  return { 상태, repo, 확인시각: new Date().toISOString(), 워크플로 };
}

// ── 글 ────────────────────────────────────────────────────────────────────────

const 짧게 = (sha) => String(sha || '').slice(0, 9);
function 때(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  const k = new Date(d.getTime() + 9 * 3600e3);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
}
function 동안(ms) {
  const 분 = Math.max(0, Math.round(ms / 60e3));
  return 분 >= 60 ? `${Math.floor(분 / 60)}시간 ${분 % 60}분` : `${분}분`;
}

function 빨강줄(w) {
  const 줄 = [];
  const 첫 = w.첫빨강;
  // 회수는 지금 창에서 센 것 — 창보다 길면(회수확실 아님) 「적어도」다. 첫 빨강은 처음 적어 둔 것을 쓴다(알림계획).
  줄.push(`• ${w.워크플로}: ${(w.회수확실 ?? w.첫빨강확실) ? '' : '적어도 '}${w.회수}회 연속 빨강 — 첫 빨강 ${때(첫.시각)} ${짧게(첫.sha)} 「${String(첫.제목 || '').slice(0, 80)}」`);
  const x = w.자세히 || {};
  if (x.미기동) 줄.push('  잡이 시작도 못 했다(스텝 0개) — 결제·사용 한도 쪽이다. 시험이 깨진 것이 아니다.');
  for (const t of x.시험 || []) {
    줄.push(`  깨진 시험: ${t.위치 || '(위치 모름)'} — ${t.이름.slice(0, 120)}`);
    for (const a of t.안내) 줄.push(`    → ${a}`);
  }
  if ((x.시험수 || 0) > (x.시험 || []).length) 줄.push(`  …깨진 시험 모두 ${x.시험수}개`);
  if (!(x.시험 || []).length && !x.미기동 && (x.단계 || []).length) 줄.push(`  깨진 단계: ${x.단계.join(' · ')}`);
  if (x.로그못읽음) 줄.push(`  실패 로그를 못 읽었다 — ${x.로그못읽음}`);
  if (w.최신?.url) 줄.push(`  최신 빨강 run: ${w.최신.url}`);
  return 줄;
}

function 상태글(r) {
  if (r.상태 === '모름' && !r.워크플로.length) return `CI 상태 모름 — ${r.이유}`;
  const 빨강 = r.워크플로.filter((w) => w.상태 === '빨강');
  const 머리 = 빨강.length ? `🔴 master CI 빨강 (${빨강.map((w) => w.워크플로).join(' · ')})` : `master CI 초록 — ${r.워크플로.filter((w) => w.상태 === '초록').map((w) => `${w.워크플로} ✓`).join(' · ')}`;
  const 줄 = [머리];
  for (const w of 빨강) 줄.push(...빨강줄(w));
  const 도는 = r.워크플로.reduce((n, w) => n + (w.도는중 || 0), 0);
  if (도는) 줄.push(`(지금 도는·기다리는 run ${도는}개 — 결과는 그 뒤에 바뀔 수 있다)`);
  return 줄.join('\n');
}

// ── 알림(상태가 바뀔 때만) ─────────────────────────────────────────────────────

function 상태읽기(파일) {
  try { return JSON.parse(fs.readFileSync(파일, 'utf8')); } catch { return null; }
}
function 상태쓰기(파일, 값) {
  fs.mkdirSync(path.dirname(파일), { recursive: true });
  const 임시 = `${파일}.${process.pid}.tmp`;
  fs.writeFileSync(임시, JSON.stringify(값, null, 2));
  fs.renameSync(임시, 파일);
}

/** 앞 상태와 지금을 견줘 보낼 글과 새 상태를 만든다(보내지는 않는다). 지금=지금읽기 결과, 앞=상태 파일 내용(없으면 null). */
function 알림계획(앞, 지금, 지금ms = Date.now()) {
  const 옛 = (앞 && 앞.워크플로) || {};
  const 새 = {};
  const 빨개짐 = [], 계속 = [], 풀림 = [];
  for (const w of 지금.워크플로) {
    const o = 옛[w.워크플로];
    if (w.상태 === '모름') { if (o) 새[w.워크플로] = o; continue; }
    if (w.상태 === '초록') {
      새[w.워크플로] = { 상태: '초록', 최신run: w.최신.run };
      if (o && o.상태 === '빨강') 풀림.push({ w, o });
      continue;
    }
    // 창보다 긴 빨강이면 창 끝이 밀리며 첫 빨강 run이 바뀌어 보인다 — 그때는 같은 줄로 보고, 처음 적어 둔 첫 빨강을 쓴다.
    const 같은줄 = o && o.상태 === '빨강' && (o.첫빨강run === w.첫빨강.run || !w.첫빨강확실);
    if (!같은줄) {
      새[w.워크플로] = { 상태: '빨강', 첫빨강run: w.첫빨강.run, 첫빨강시각: w.첫빨강.시각, 첫빨강sha: w.첫빨강.sha, 첫빨강제목: w.첫빨강.제목,
        첫빨강확실: w.첫빨강확실, 회수: w.회수, 알린시각: new Date(지금ms).toISOString(), 다시알린수: 0, 최신run: w.최신.run };
      빨개짐.push(w);
      continue;
    }
    const 첫 = { run: o.첫빨강run, 시각: o.첫빨강시각 || w.첫빨강.시각, sha: o.첫빨강sha || w.첫빨강.sha, 제목: o.첫빨강제목 || w.첫빨강.제목 };
    const 이어진 = { ...w, 첫빨강: 첫, 첫빨강확실: o.첫빨강확실 ?? w.첫빨강확실, 회수확실: w.첫빨강확실, 회수: Math.max(w.회수, o.회수 || 0) };
    const 남길 = { ...o, 첫빨강sha: 첫.sha, 첫빨강제목: 첫.제목, 회수: 이어진.회수, 최신run: w.최신.run };
    const 다음 = 다시알림ms[Math.min(o.다시알린수 || 0, 다시알림ms.length - 1)];
    const 지난 = 지금ms - Date.parse(o.알린시각);
    if (지난 >= 다음) {
      새[w.워크플로] = { ...남길, 알린시각: new Date(지금ms).toISOString(), 다시알린수: (o.다시알린수 || 0) + 1 };
      계속.push(이어진);
    } else 새[w.워크플로] = 남길;
  }
  for (const [이름, o] of Object.entries(옛)) if (!(이름 in 새)) 새[이름] = o; // 이번 창에 안 보인 워크플로는 그대로 둔다
  const 줄 = [];
  if (빨개짐.length || 계속.length) {
    줄.push(빨개짐.length ? '🔴 master CI가 빨개졌습니다' : '🔴 master CI가 아직 빨갛습니다');
    for (const w of [...빨개짐, ...계속]) {
      줄.push(...빨강줄(w));
      if (계속.includes(w)) 줄.push(`  빨간 지 ${동안(지금ms - Date.parse(w.첫빨강.시각))}`);
    }
    줄.push('', '고칠 것: 깨진 시험의 원인 커밋을 올린 세션이 고칩니다. 고치기 전에 그 지면·코드가 실제로 어떻게 도는지 보고, 시험이 찍은 고침이 맞는지부터 확인합니다(push 때 바로올리기도 같은 경고를 보입니다).');
    줄.push('자세히: node tools/ci빨간불.js');
  }
  if (풀림.length) {
    if (줄.length) 줄.push('');
    for (const { w, o } of 풀림) 줄.push(`✅ master ${w.워크플로} 다시 초록 — 빨간 시간 ${동안(Date.parse(w.최신.시각) - Date.parse(o.첫빨강시각))} (${때(o.첫빨강시각)} → ${때(w.최신.시각)})`);
  }
  return { 글: 줄.length ? 줄.join('\n') : null, 새상태: { 판: 1, 확인시각: 지금.확인시각, 워크플로: 새 }, 빨개짐: 빨개짐.length, 계속: 계속.length, 풀림: 풀림.length };
}

function 알림({ sh = 실행기(), 환경 = process.env, 보내는일 = null, 지금ms = Date.now(), 파일들 = 워크플로파일들() } = {}) {
  const 파일 = 상태파일(sh, 환경);
  if (!파일) return { 결과: '모름', 이유: 'git 폴더를 못 찾았다' };
  const 지금 = 지금읽기({ sh, 파일들 });
  if (지금.상태 === '모름' && !지금.워크플로.length) return { 결과: '모름', 이유: 지금.이유 }; // 상태를 바꾸지 않는다
  const 앞 = 상태읽기(파일);
  const 계획 = 알림계획(앞, 지금, 지금ms);
  let 보냄 = null;
  if (계획.글) {
    보냄 = (보내는일 || require('./텔레그램승인.js').보내기)(계획.글, 환경);
    if (!보냄.ok) return { 결과: '못 보냄', 이유: 보냄.error || '보내기 실패', 글: 계획.글 }; // 상태를 안 바꿔 다음 회차에 다시 보낸다
  }
  상태쓰기(파일, 계획.새상태);
  return { 결과: 계획.글 ? '보냄' : '바뀐 것 없음', 글: 계획.글, 지금: 지금.상태, 상태파일: 파일, ...(보냄 ? { 방법: 보냄.method } : {}) };
}

/** 바로올리기가 push 때 부른다 — 상태 파일이 10분 안이면 그대로, 아니면 run 목록 한 번만(로그는 안 받는다). 못 읽으면 null. */
function 빠른상태({ sh = 실행기(), 환경 = process.env, 지금ms = Date.now() } = {}) {
  try {
    const 파일 = 상태파일(sh, 환경);
    const 앞 = 파일 && 상태읽기(파일);
    if (앞 && 지금ms - Date.parse(앞.확인시각) < 빠른상태신선ms) {
      const 빨강 = Object.entries(앞.워크플로 || {}).filter(([, o]) => o.상태 === '빨강').map(([워크플로, o]) => ({ 워크플로, 첫빨강시각: o.첫빨강시각,
        첫빨강run: o.첫빨강run, 첫빨강sha: o.첫빨강sha, 첫빨강제목: o.첫빨강제목, 회수: o.회수, 첫빨강확실: o.첫빨강확실 }));
      return { 출처: '상태 파일', 확인시각: 앞.확인시각, 빨강 };
    }
    const repo = 저장소이름(sh);
    if (!repo) return null;
    const 목록 = run목록(gh실행(sh), repo, 40);
    if (!목록.ok) return null;
    const 빨강 = 판정하기(목록.runs).filter((w) => w.상태 === '빨강')
      .map((w) => ({ 워크플로: w.워크플로, 첫빨강시각: w.첫빨강.시각, 첫빨강run: w.첫빨강.run, 첫빨강sha: w.첫빨강.sha, 첫빨강제목: w.첫빨강.제목, 회수: w.회수, 첫빨강확실: w.첫빨강확실 }));
    return { 출처: 'gh', 확인시각: new Date(지금ms).toISOString(), 빨강 };
  } catch { return null; }
}

function 빠른경고글(s) {
  if (!s || !s.빨강.length) return null;
  return `⚠ master CI 빨강 — ${s.빨강.map((w) => `${w.워크플로} ${때(w.첫빨강시각)}부터${w.회수 ? ` ${w.첫빨강확실 ? '' : '적어도 '}${w.회수}회` : ''}${w.첫빨강sha ? ` · 첫 빨강 ${짧게(w.첫빨강sha)}${w.첫빨강제목 ? ` 「${w.첫빨강제목.slice(0, 60)}」` : ''}` : ''}`).join(' / ')}`
    + '\n  이 push가 고치는 것이 아니면 깨진 시험부터 본다: node tools/ci빨간불.js';
}

// ── 예약 등록 ────────────────────────────────────────────────────────────────

/** 공용 작업본 경로로 거는 예약의 PowerShell 명령(워크트리에서 돌려도 공용 작업본의 도구를 부른다). */
function 예약명령({ sh = 실행기() } = {}) {
  const g = 공용git폴더(sh);
  if (!g) throw new Error('git 공용 폴더를 못 찾았다');
  const 공용 = path.resolve(path.dirname(g)); // git은 C:/…로 준다 — 작업 스케줄러에는 이 PC의 꼴로 넣는다
  const 파이썬 = path.join(process.env.LOCALAPPDATA || '', 'Python', 'pythoncore-3.14-64', 'pythonw.exe');
  const 따옴 = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const 인자 = `-X utf8 -B "${path.join(공용, 'tools', '숨김실행.py')}" "${path.join(공용, 'tools', 'ci빨간불.js')}" --알림`;
  return {
    공용, 파이썬, 인자,
    ps: [
      `$a = New-ScheduledTaskAction -Execute ${따옴(파이썬)} -Argument ${따옴(인자)} -WorkingDirectory ${따옴(공용)}`,
      `$t = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes ${예약간격분})`,
      '$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew',
      `Register-ScheduledTask -TaskName ${따옴(예약이름)} -Action $a -Trigger $t -Settings $s -Description ${따옴('master CI가 빨개지거나 다시 초록이 되면 텔레그램 한 통(AI 없음). tools/ci빨간불.js')} -Force | Out-Null`,
      `(Get-ScheduledTask -TaskName ${따옴(예약이름)}).State`,
    ].join('; '),
  };
}

// ── 명령줄 ──────────────────────────────────────────────────────────────────

function main(argv = process.argv.slice(2)) {
  const 옵션 = new Set(argv);
  if (argv[0] === '예약등록') {
    const m = 예약명령();
    if (!fs.existsSync(m.파이썬)) { console.error(`pythonw를 못 찾았다: ${m.파이썬}`); return 1; }
    if (!옵션.has('--실행')) {
      console.log(`[미리 보기] 작업 스케줄러 「${예약이름}」 — ${예약간격분}분마다 창 없이\n  ${m.파이썬} ${m.인자}\n  (작업 폴더 ${m.공용})\n--실행을 붙이면 건다.`);
      return 0;
    }
    const r = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', m.ps], { encoding: 'utf8', windowsHide: true });
    console.log(String(r.stdout || '').trim() || String(r.stderr || '').trim());
    return r.status === 0 ? 0 : 1;
  }
  if (옵션.has('--알림')) {
    const r = 알림();
    console.log(`[${r.결과}]${r.이유 ? ` ${r.이유}` : ''}${r.글 ? `\n${r.글}` : ''}`);
    return r.결과 === '보냄' || r.결과 === '바뀐 것 없음' ? 0 : 1;
  }
  const r = 지금읽기();
  console.log(옵션.has('--json') ? JSON.stringify(r, null, 2) : 상태글(r));
  return r.상태 === '초록' ? 0 : 1;
}

if (require.main === module) process.exitCode = main();

module.exports = { 판정하기, 실패읽기, 알림계획, 알림, 지금읽기, 빠른상태, 빠른경고글, 상태글, 저장소이름, 예약명령, 예약이름, 실행기 };
