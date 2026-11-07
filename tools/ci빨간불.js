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
 *   node tools/ci빨간불.js --알림             새 실패 · 복구 때 텔레그램 한 통. 같은 실패의 시간 경과 · run 이동은 다시 알리지 않는다.
 *                                            같은 회차에 앱 예약 작업 감시(tools/예약멈춤.js --알림)도 돈다 — 예약을 따로 늘리지 않으려고(10-22)
 *   node tools/ci빨간불.js 예약등록 [--실행]  그 예약을 Windows 작업 스케줄러에 건다(기본은 미리 보기). 공용 작업본 경로로 건다
 *
 * 읽는 법: `gh run list --branch master`로 워크플로마다 최근 run을 읽는다. 끝난 run 가운데 success는 초록, failure·timed_out·
 *   startup_failure는 빨강이고 cancelled·skipped·neutral은 셈에서 뺀다(새 push가 기다리던 run을 바꿔 끼우면 취소가 난다).
 *   빨강이면 마지막 초록 바로 뒤 run의 커밋이 「첫 빨강」이고, 최신 빨강 run의 실패 로그(`--log-failed`)에서 `not ok` 시험·위치와
 *   시험이 찍은 「→」 안내를 뽑는다. 스텝이 하나도 안 돈 run은 「잡이 시작도 못 했다」다(결제·한도 — 원격ci.js 미기동인가).
 *   연속 구간의 빨강 run마다 깨진 작업(job)을 읽어 작업별 횟수를 세고, 깨진 시험·단계는 작업마다 그 작업의 최근 빨강 run에서
 *   읽는다(11-08 — conditional-qa 「적어도 14회」 가운데 13회가 local-coverage였는데 최신 빨강 run 하나의 Windows 단계만 보여
 *   「Windows 14회 연속」으로 읽혔다). 알림 식별자는 그대로 최신 빨강 run에서 만든다. 작업 읽기는 상한·시간 한도 안에서만 하고
 *   못 읽은 run은 「모름」으로 센다. --알림 회차는 보낼 글이 있을 때만 작업별로 읽는다(평소 10분 회차의 gh 호출은 그대로).
 * 🔴 고침 명령을 대신 돌리지 않는다 — 10-21 시험이 찍은 「심는다」는 필요 없는 고침이었고 진짜 원인은 시험 술어였다.
 *   알림은 고칠 세션이 바로 읽을 재료까지만 준다. push 때마다 같은 상태를 바로올리기가 경고로 보인다(빠른상태).
 * 못 읽으면(gh 없음·인증·네트워크) 「모름」이고 상태를 바꾸지 않는다 — 못 본 것을 초록으로 적으면 다음 빨강을 놓친다.
 * 상태 파일은 공용 git 폴더 안(<git-common-dir>/synk-ci빨간불/상태.json)이라 워크트리·공용 작업본이 같이 보고, 저장소에는 안 들어간다.
 * 시험·재현: SYNK_TG_DRYRUN_DIR(텔레그램 대신 그 폴더에 글을 쓴다 — 텔레그램승인.js와 같다) · SYNK_CI빨간불_상태(상태 파일 경로).
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { tap실패 } = require('./lib/tap실패.js');

const ROOT = path.resolve(__dirname, '..');
const 가지 = 'master';
const 창 = 100;
const 빨강결론 = new Set(['failure', 'timed_out', 'startup_failure']);
const 셈밖결론 = new Set(['cancelled', 'skipped', 'neutral', 'stale', 'action_required']);
const 빠른상태신선ms = 10 * 60e3;
const 예약이름 = 'SYNK CI 빨간불 알림';
const 예약간격분 = 10;
const git한도ms = 60000; // 10-22 PC가 바쁠 때(git 16개) 10초 한도의 rev-parse가 넘쳐 회차가 「git 폴더를 못 찾았다」로 끝났다
const 못읽음한도 = 6;    // 10분 회차로 약 1시간 내리 못 읽으면 감시가 멈춘 것을 한 번 알린다
// 10-23 바쁜 PC에 텔레그램 연결 지연까지 겹쳐 hermes send가 보내기 도구의 기본 45초를 넘기자, 15:48부터 한 시간 넘게
// 「넓은 시험 빨개짐」·「다시 초록」이 한 통도 못 나갔다(매 회차 다시 시도만 했다). 회차 한도(숨김실행 280초) 안에서 넉넉히 준다.
// 11-04 CPU 100%에서는 120초 · 180초 모두 넘겨 예약알림보내기가 MTProto를 먼저 쓴다. 이 한도는 hermes로 넘어갔을 때의 몫이다.
const 보내기한도ms = 120000;
// 연속 구간의 작업 읽기(11-08). 빨강 run마다 gh를 한 번 더 부르므로 최신부터 상한까지만, 한 번 읽기에 시간 한도 안에서만 읽는다.
// --알림 회차는 숨김실행 한도(280초) 안에 보내기 몫(120초)을 남기려고 회차 시작부터 140초가 지나면 더 읽지 않는다.
const 작업읽기상한 = 30;
const 작업읽기한도ms = 60000;
const 알림작업마감ms = 140000;
const 최소호출ms = 5000;   // 이보다 덜 남았으면 부르지 않고 「모름」
const 작업자세히상한 = 4;  // 깨진 시험·단계를 따로 읽는 작업 수(횟수가 많은 것부터)
const 미기동작업 = '(잡 시작 못 함)';

// 여럿을 동시에 띄우는 자식 node — 입력 {cwd, 명령들:[[cmd,args]], timeout, 동시}, 출력은 sh와 같은 꼴의 결과 배열(JSON).
const 동시도우미 = `
const { execFile } = require('node:child_process');
const 입력 = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
const 결과 = new Array(입력.명령들.length);
let 다음 = 0;
const 하나 = () => {
  const i = 다음++;
  if (i >= 입력.명령들.length) return Promise.resolve();
  const [cmd, args] = 입력.명령들[i];
  return new Promise((끝) => execFile(cmd, args, { cwd: 입력.cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 << 20, timeout: 입력.timeout }, (e, out, err) => {
    if (!e) 결과[i] = { ok: true, out: String(out || '') };
    else if (typeof e.code === 'string' || e.killed) 결과[i] = { ok: false, 사유: cmd + ' 실행 불가 (' + (e.killed ? 'ETIMEDOUT' : e.code) + ')' };
    else 결과[i] = { ok: false, 사유: String(err || '').trim().split('\\n')[0] || cmd + ' 종료 ' + e.code };
    끝();
  })).then(하나);
};
Promise.all(Array.from({ length: Math.min(입력.동시, 입력.명령들.length) }, 하나)).then(() => process.stdout.write(JSON.stringify(결과)));
`;

function 실행기(cwd = ROOT) {
  const sh = (cmd, args, { timeout = 60000 } = {}) => {
    const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 << 20, timeout });
    if (r.error) return { ok: false, 사유: `${cmd} 실행 불가 (${r.error.code || r.error.message})` };
    if (r.status !== 0) return { ok: false, 사유: String(r.stderr || '').trim().split('\n')[0] || `${cmd} 종료 ${r.status}` };
    return { ok: true, out: String(r.stdout || '') };
  };
  /** 명령 여럿을 동시에(작업 읽기 — 빨강 run마다 gh를 하나씩 부르면 run 38개에 1분이 넘었다, 11-08). 전체ms가 지나면 모두 못 읽음. */
  sh.여럿 = (명령들, { timeout = 30000, 전체ms = 60000, 동시 = 6 } = {}) => {
    const 못함 = (사유) => 명령들.map(() => ({ ok: false, 사유 }));
    const r = spawnSync(process.execPath, ['-e', 동시도우미], { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 << 20,
      timeout: 전체ms, input: JSON.stringify({ cwd, 명령들, timeout, 동시 }) });
    if (r.error) return 못함(r.error.code === 'ETIMEDOUT' ? '시간 한도' : `동시 실행 불가 (${r.error.code || r.error.message})`);
    try {
      const 결과 = JSON.parse(r.stdout);
      return 명령들.map((_, i) => 결과[i] || { ok: false, 사유: '결과 없음' });
    } catch { return 못함(`동시 실행 결과를 못 읽었다 (종료 ${r.status})`); }
  };
  return sh;
}

/** origin 주소에서 owner/repo — GitHub가 아니면 null(임시 저장소·로컬 원격에서는 아무것도 묻지 않는다). */
function 저장소이름(sh) {
  const r = sh('git', ['remote', 'get-url', 'origin'], { timeout: git한도ms });
  if (!r.ok) return null;
  const m = r.out.trim().match(/github\.com[:/]+([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/i);
  return m ? `${m[1]}/${m[2]}` : null;
}

/**
 * 공용 git 폴더. git이 답을 못 하면(바쁜 PC의 시간 한도 등) 이 도구가 든 작업본의 `.git`에서 찾는다 — 폴더면 그대로, 파일이면
 * (예약이 도는 운영 사본 같은 연결 워크트리, 10-22) 가리키는 워크트리 git 폴더의 commondir를 따라간다.
 */
function 공용git폴더(sh, root = ROOT) {
  const r = sh('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { timeout: git한도ms });
  if (r.ok) return r.out.trim();
  const 곁 = path.join(root, '.git');
  try {
    if (fs.statSync(곁).isDirectory()) return 곁;
    const m = /^gitdir:\s*(.+?)\s*$/m.exec(fs.readFileSync(곁, 'utf8'));
    if (!m) return null;
    const 작업 = path.resolve(root, m[1]);
    const 공용 = path.resolve(작업, fs.readFileSync(path.join(작업, 'commondir'), 'utf8').trim());
    return fs.statSync(공용).isDirectory() ? 공용 : null;
  } catch { return null; }
}

function 상태파일(sh, 환경 = process.env, root = ROOT) {
  if (환경.SYNK_CI빨간불_상태) return 환경.SYNK_CI빨간불_상태;
  const g = 공용git폴더(sh, root);
  return g ? path.join(g, 'synk-ci빨간불', '상태.json') : null;
}

function gh실행(sh) {
  const 기본 = 'C:\\Program Files\\GitHub CLI\\gh.exe'; // 작업 스케줄러에서 PATH가 짧을 때
  const gh = (args, 옵션) => {
    const r = sh('gh', args, 옵션);
    if (r.ok || !/실행 불가/.test(r.사유)) return r;
    return fs.existsSync(기본) ? sh(기본, args, 옵션) : r;
  };
  // 동시에 부를 수 있는 실행기면 gh.여럿도 둔다(시험의 가짜 실행기에는 없어 하나씩 돈다). gh를 못 찾은 것만 기본 경로로 다시
  if (sh.여럿) {
    gh.여럿 = (args목록, 옵션) => {
      const rs = sh.여럿(args목록.map((a) => ['gh', a]), 옵션);
      const 다시 = rs.map((r, i) => (!r.ok && /gh 실행 불가 \(ENOENT\)/.test(r.사유) ? i : -1)).filter((i) => i >= 0);
      if (!다시.length || !fs.existsSync(기본)) return rs;
      const 둘째 = sh.여럿(다시.map((i) => [기본, args목록[i]]), 옵션);
      다시.forEach((i, k) => { rs[i] = 둘째[k]; });
      return rs;
    };
  }
  return gh;
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
    if (!['push', 'workflow_dispatch', 'schedule', 'workflow_run'].includes(r.event)) continue;
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
    if (!빨강결론.has(최신.conclusion)) {
      // 다시 초록이 된 때는 지금 초록 줄의 맨 처음 run이다 — 보내기가 밀려 늦게 알려도 빨간 시간이 늘어나지 않게(10-23)
      let 첫초록 = 최신;
      for (const r of 끝난) { if (빨강결론.has(r.conclusion)) break; 첫초록 = r; }
      결과.push({ 워크플로, 상태: '초록', 최신: 요약run(최신), 첫초록: 요약run(첫초록), 도는중 }); continue;
    }
    let 회수 = 0, 첫 = null, 초록찾음 = false;
    const 빨강들 = []; // 연속 구간의 빨강 run(최신부터) — 작업별로 읽을 때 쓴다
    for (const r of 끝난) {
      if (!빨강결론.has(r.conclusion)) { 초록찾음 = true; break; }
      회수++; 첫 = r; 빨강들.push(요약run(r));
    }
    // 최신 빨강 뒤로 취소·건너뜀만 있으면 그 실패가 지금도 그대로인지 모른다 — 글에 그 수를 밝힌다(11-08)
    const 뒤셈밖 = 목록.filter((r) => r.status === 'completed' && 셈밖결론.has(r.conclusion) && String(r.createdAt) > String(최신.createdAt)).length;
    결과.push({ 워크플로, 상태: '빨강', 최신: 요약run(최신), 첫빨강: 요약run(첫), 회수, 첫빨강확실: 초록찾음, 도는중, 빨강들, 뒤셈밖 });
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
  return { 시험: [...시험들.values()].slice(0, 5), 시험수: 시험들.size, 단계: 단계들.slice(0, 5),
    실패식별자: [...시험들.values()].map(시험식별자) };
}

const 식별해시 = value => createHash('sha256').update(value).digest('hex');
function 시험식별자(t) { return 식별해시(`test:${String(t.위치 || '').replace(/:\d+(?::\d+)?$/, '')}:${t.이름}`); }
function 실패식별자(w) {
  const x = w.자세히 || {};
  if (x.실패식별자?.length) return x.실패식별자;
  if (x.시험?.length) return x.시험.map(시험식별자);
  if (x.미기동) return [식별해시('startup_failure')];
  return (x.단계 || []).map(s => 식별해시(`step:${s}`));
}

/** 한 번 읽기 안에서 같은 run의 로그·작업을 두 번 받지 않는다(최신 빨강 run은 알림 식별자와 작업별 자세히가 함께 쓴다). */
const 새캐시 = () => ({ 로그: new Map(), jobs: new Map(), jobs못읽음: new Map() });

function 실패로그(gh, repo, runId, 캐시, timeout = 60000) {
  if (캐시.로그.has(runId)) return 캐시.로그.get(runId);
  const r = gh(['run', 'view', String(runId), '--repo', repo, '--log-failed'], { timeout });
  캐시.로그.set(runId, r);
  return r;
}

/** run의 작업 목록 — 읽은 것만 캐시에 둔다(못 읽은 것은 다음 쓰임에서 한 번 더 묻는다). */
function 작업목록(gh, repo, runId, 캐시, timeout = 30000) {
  if (캐시.jobs.has(runId)) return { ok: true, jobs: 캐시.jobs.get(runId) };
  const j = gh(['run', 'view', String(runId), '--repo', repo, '--json', 'jobs'], { timeout });
  if (!j.ok) return { ok: false, 사유: j.사유 };
  let jobs;
  try { jobs = JSON.parse(j.out).jobs || []; } catch (e) { return { ok: false, 사유: `gh 출력이 JSON이 아니다 (${e.message})` }; }
  캐시.jobs.set(runId, jobs);
  return { ok: true, jobs };
}

const 미기동인가 = (jobs) => require('./원격ci.js').미기동인가(jobs);
const 깨진단계들 = (jobs) => [...new Set(jobs.flatMap((job) => (job.steps || []).filter((s) => 빨강결론.has(s.conclusion)).map((s) => s.name)))].slice(0, 5);

/** 최신 빨강 run 하나의 실패 — 알림 식별자(실패식별자)가 여기서 나온다. 11-08 작업별 읽기를 더한 뒤에도 그대로 둔다. */
function 실패자세히(gh, repo, runId, 캐시 = 새캐시()) {
  const 로그 = 실패로그(gh, repo, runId, 캐시);
  const 읽음 = 로그.ok ? 실패읽기(로그.out) : { 시험: [], 시험수: 0, 단계: [] };
  if (읽음.시험수) return 읽음;
  const j = 작업목록(gh, repo, runId, 캐시);
  if (j.ok) {
    if (미기동인가(j.jobs)) return { ...읽음, 미기동: true };
    const 깨진단계 = 깨진단계들(j.jobs);
    if (깨진단계.length) return { ...읽음, 단계: 깨진단계 };
  }
  return 로그.ok ? 읽음 : { ...읽음, 로그못읽음: 로그.사유 };
}

/**
 * 캐시에 없는 run들을 한꺼번에 받는다 — 동시에 부를 수 있으면 gh.여럿으로, 아니면 하나씩(부르기 전마다 남은 시간을 본다).
 * 종류는 'jobs'(작업 목록, 캐시.jobs) · '로그'(--log-failed, 캐시.로그). 시간이 없어 못 부른 run은 캐시에 안 남는다.
 */
function 한꺼번에받기(gh, repo, 종류, ids, 캐시, { 마감, 시계 }) {
  const 기본ms = 종류 === 'jobs' ? 30000 : 60000;
  const 인자 = (id) => ['run', 'view', String(id), '--repo', repo, ...(종류 === 'jobs' ? ['--json', 'jobs'] : ['--log-failed'])];
  const 넣기 = (id, r) => (종류 === 'jobs' ? 작업목록넣기(id, r, 캐시) : 캐시.로그.set(id, r));
  const 남은 = () => 마감 - 시계();
  const 받을 = [...new Set(ids)].filter((id) => !(종류 === 'jobs' ? 캐시.jobs : 캐시.로그).has(id));
  if (!받을.length) return;
  if (gh.여럿) {
    const t = 남은();
    if (t < 최소호출ms) return;
    gh.여럿(받을.map(인자), { timeout: Math.min(기본ms, t), 전체ms: t }).forEach((r, i) => 넣기(받을[i], r));
    return;
  }
  for (const id of 받을) {
    const t = Math.min(기본ms, 남은());
    if (t < 최소호출ms) return;
    넣기(id, gh(인자(id), { timeout: t }));
  }
}

function 작업목록넣기(id, r, 캐시) {
  if (r.ok) {
    try { 캐시.jobs.set(id, JSON.parse(r.out).jobs || []); return; } catch (e) { 캐시.jobs못읽음.set(id, `gh 출력이 JSON이 아니다 (${e.message})`); return; }
  }
  캐시.jobs못읽음.set(id, r.사유);
}

/** 그 run에서 작업 하나의 실패 — 로그는 첫 칸(작업 이름)이 같은 줄만, 시험이 없으면 그 작업의 깨진 단계. 캐시에 받아 둔 것만 읽는다. */
function 작업실패자세히(runId, 이름, 캐시) {
  if (이름 === 미기동작업) return { 시험: [], 시험수: 0, 단계: [], 미기동: true };
  const 로그 = 캐시.로그.get(runId) || { ok: false, 사유: '작업 읽기 시간 한도' };
  const 내줄 = 로그.ok ? String(로그.out || '').replace(/\r/g, '').split('\n').filter((l) => l.split('\t')[0].replace(/^\uFEFF/, '') === 이름).join('\n') : '';
  const 읽음 = 실패읽기(내줄);
  if (읽음.시험수) return 읽음;
  const job = (캐시.jobs.get(runId) || []).find((x) => x.name === 이름);
  if (job) {
    if (!(job.steps || []).length) return { ...읽음, 미기동: true };
    const 깨진단계 = 깨진단계들([job]);
    if (깨진단계.length) return { ...읽음, 단계: 깨진단계 };
  }
  return 로그.ok ? 읽음 : { ...읽음, 로그못읽음: 로그.사유 };
}

/**
 * 연속 구간의 빨강 run마다 깨진 작업을 읽어 작업별로 센다(11-08). 연속 횟수는 run 결론을 세지만 깨진 작업은 run마다 다를 수 있다.
 * 최신부터 상한까지, 마감 전까지만 읽고, 못 읽었거나 깨진 작업이 안 보이는 run은 「모름」으로 센다. 작업마다 가장 최근 빨강 run을
 * 남기고, 횟수가 많은 작업부터 작업자세히상한개까지 그 run에서 깨진 시험·단계를 읽는다.
 */
function 작업별읽기(gh, repo, w, 캐시, { 상한 = 작업읽기상한, 마감, 시계 = Date.now }) {
  const 작업 = new Map();
  const 모름까닭 = new Set();
  let 모름 = 0;
  const 빨강들 = w.빨강들 || [];
  const 읽을 = 빨강들.slice(0, 상한);
  if (빨강들.length > 읽을.length) { 모름 += 빨강들.length - 읽을.length; 모름까닭.add(`최신 ${상한}회까지만 읽음`); }
  한꺼번에받기(gh, repo, 'jobs', 읽을.map((r) => r.run), 캐시, { 마감, 시계 });
  for (const r of 읽을) {
    const jobs = 캐시.jobs.get(r.run);
    if (!jobs) { 모름++; 모름까닭.add(String(캐시.jobs못읽음.get(r.run) || '시간 한도').slice(0, 80)); continue; }
    const 깨진 = jobs.filter((x) => 빨강결론.has(x.conclusion)).map((x) => String(x.name || ''));
    const 이름들 = 깨진.length ? [...new Set(깨진)] : 미기동인가(jobs) ? [미기동작업] : [];
    if (!이름들.length) { 모름++; 모름까닭.add('깨진 작업이 안 보이는 run'); continue; }
    for (const 이름 of 이름들) {
      if (!작업.has(이름)) 작업.set(이름, { 이름, 회수: 0, 최신: r }); // 최신부터 도니 처음 본 run이 그 작업의 최근 빨강
      작업.get(이름).회수++;
    }
  }
  const 목록 = [...작업.values()].sort((a, b) => b.회수 - a.회수 || String(b.최신.시각).localeCompare(String(a.최신.시각)));
  const 자세히할 = 목록.slice(0, 작업자세히상한);
  한꺼번에받기(gh, repo, '로그', 자세히할.filter((x) => x.이름 !== 미기동작업).map((x) => x.최신.run), 캐시, { 마감, 시계 });
  for (const x of 자세히할) x.자세히 = 작업실패자세히(x.최신.run, x.이름, 캐시);
  return { run수: 빨강들.length, 작업: 목록, 모름, 모름까닭: [...모름까닭] };
}

function 작업별붙이기(gh, repo, 워크플로, 캐시, { 시계 = Date.now, 상한, 마감 } = {}) {
  const 끝 = 마감 ?? 시계() + 작업읽기한도ms;
  for (const w of 워크플로) if (w.상태 === '빨강' && !w.작업별) w.작업별 = 작업별읽기(gh, repo, w, 캐시, { 상한, 마감: 끝, 시계 });
}

function 지금읽기({ sh = 실행기(), 자세히 = true, 작업별 = 자세히, 파일들 = 워크플로파일들(), 캐시 = 새캐시(), 시계 = Date.now, 작업한도 = {} } = {}) {
  const repo = 저장소이름(sh);
  if (!repo) return { 상태: '모름', 이유: 'origin이 GitHub 저장소가 아니다', 워크플로: [] };
  const gh = gh실행(sh);
  const 목록 = 워크플로별run(gh, repo, 파일들);
  if (!목록.ok) return { 상태: '모름', 이유: `gh로 run을 못 읽었다 — ${목록.사유}`, repo, 워크플로: [] };
  const 워크플로 = 판정하기(목록.runs);
  if (자세히) for (const w of 워크플로) if (w.상태 === '빨강') w.자세히 = 실패자세히(gh, repo, w.최신.run, 캐시);
  if (작업별) 작업별붙이기(gh, repo, 워크플로, 캐시, { 시계, 상한: 작업한도.상한, 마감: 작업한도.ms != null ? 시계() + 작업한도.ms : undefined });
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
  if (w.뒤셈밖 && w.최신) {
    줄.push(`  최신 빨강(${때(w.최신.시각)} ${짧게(w.최신.sha)}) 뒤 run ${w.뒤셈밖}개는 취소·건너뜀이라 셈에서 뺐다 — 아래 실패가 지금도 그대로인지는 다음 결과가 나와야 안다`);
  }
  const 작업 = w.작업별;
  if (작업 && 작업.작업.length) {
    줄.push(...작업줄(작업));
    return 줄;
  }
  줄.push(...자세히줄(w.자세히 || {}, '  '));
  if (작업 && 작업.모름) 줄.push(`  깨진 작업 모름 — 빨강 run ${작업.모름}개를 못 읽었다(${작업.모름까닭.join(' · ')}). 위는 최신 빨강 run 하나의 것이다`);
  if (w.최신?.url) 줄.push(`  최신 빨강 run: ${w.최신.url}`);
  return 줄;
}

/** 깨진 시험·단계 줄 — 최신 빨강 run 하나(옛 꼴)에도, 작업 하나에도 쓴다. */
function 자세히줄(x, 앞) {
  const 줄 = [];
  if (x.미기동) 줄.push(`${앞}잡이 시작도 못 했다(스텝 0개) — 결제·사용 한도 쪽이다. 시험이 깨진 것이 아니다.`);
  for (const t of x.시험 || []) {
    줄.push(`${앞}깨진 시험: ${t.위치 || '(위치 모름)'} — ${t.이름.slice(0, 120)}`);
    for (const a of t.안내 || []) 줄.push(`${앞}  → ${a}`);
  }
  if ((x.시험수 || 0) > (x.시험 || []).length) 줄.push(`${앞}…깨진 시험 모두 ${x.시험수}개`);
  if (!(x.시험 || []).length && !x.미기동 && (x.단계 || []).length) 줄.push(`${앞}깨진 단계: ${x.단계.join(' · ')}`);
  if (x.로그못읽음) 줄.push(`${앞}실패 로그를 못 읽었다 — ${x.로그못읽음}`);
  return 줄;
}

/** 작업별 횟수 한 줄 + 작업마다 그 작업의 최근 빨강 run에서 읽은 깨진 시험·단계(11-08). */
function 작업줄(작업) {
  const 셈 = 작업.작업.map((x) => `${x.이름} ${x.회수}회(${x.회수 > 1 ? '최근 ' : ''}${짧게(x.최신.sha)})`);
  if (작업.모름) 셈.push(`모름 ${작업.모름}회(${작업.모름까닭.join(' · ')})`);
  const 줄 = [`  깨진 작업(빨강 run ${작업.run수}개를 run마다 셈): ${셈.join(' · ')}`];
  for (const x of 작업.작업) {
    if (!x.자세히) continue;
    줄.push(`  ▸ ${x.이름} — 최근 빨강 ${때(x.최신.시각)} ${짧게(x.최신.sha)} 「${String(x.최신.제목 || '').slice(0, 60)}」`);
    줄.push(...자세히줄(x.자세히, '    '));
    if (x.최신.url) 줄.push(`    run: ${x.최신.url}`);
  }
  const 안읽음 = 작업.작업.filter((x) => !x.자세히).length;
  if (안읽음) 줄.push(`  (나머지 작업 ${안읽음}개는 깨진 시험을 안 읽었다 — 횟수가 많은 ${작업자세히상한}개까지만 읽는다)`);
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
    // Older local jobs can finish later and move the first-red boundary. A run
    // ID is not a new failure. A newer red streak after an unseen green is.
    const 식별자 = 실패식별자(w);
    const 재발 = o?.최신시각 && w.첫빨강확실 && Date.parse(w.첫빨강.시각) > Date.parse(o.최신시각);
    const 같은줄 = o && o.상태 === '빨강' && !재발;
    if (!같은줄) {
      새[w.워크플로] = { 상태: '빨강', 첫빨강run: w.첫빨강.run, 첫빨강시각: w.첫빨강.시각, 첫빨강sha: w.첫빨강.sha, 첫빨강제목: w.첫빨강.제목,
        첫빨강확실: w.첫빨강확실, 회수: w.회수, 알린시각: new Date(지금ms).toISOString(), 다시알린수: 0,
        최신run: w.최신.run, 최신시각: w.최신.시각, 알린실패: 식별자 };
      빨개짐.push(w);
      continue;
    }
    const 첫 = { run: o.첫빨강run, 시각: o.첫빨강시각 || w.첫빨강.시각, sha: o.첫빨강sha || w.첫빨강.sha, 제목: o.첫빨강제목 || w.첫빨강.제목 };
    const 이어진 = { ...w, 첫빨강: 첫, 첫빨강확실: o.첫빨강확실 ?? w.첫빨강확실, 회수확실: w.첫빨강확실, 회수: Math.max(w.회수, o.회수 || 0) };
    // Seed old state without re-sending an already announced incident on upgrade.
    const 알린 = new Set(o.알린실패 || 식별자);
    const 새실패 = 식별자.some(id => !알린.has(id));
    const 남길 = { ...o, 첫빨강sha: 첫.sha, 첫빨강제목: 첫.제목, 회수: 이어진.회수, 최신run: w.최신.run,
      최신시각: w.최신.시각, 알린실패: [...new Set([...알린, ...식별자])] };
    if (새실패) {
      새[w.워크플로] = { ...남길, 알린시각: new Date(지금ms).toISOString() };
      계속.push(이어진);
    } else 새[w.워크플로] = 남길;
  }
  for (const [이름, o] of Object.entries(옛)) if (!(이름 in 새)) 새[이름] = o; // 이번 창에 안 보인 워크플로는 그대로 둔다
  const 줄 = [];
  if (빨개짐.length || 계속.length) {
    줄.push(빨개짐.length ? '🔴 master CI가 빨개졌습니다' : '🔴 master CI에 새 실패가 있습니다');
    for (const w of [...빨개짐, ...계속]) {
      줄.push(...빨강줄(w));
      if (계속.includes(w)) 줄.push(`  빨간 지 ${동안(지금ms - Date.parse(w.첫빨강.시각))}`);
    }
    줄.push('', '고칠 것: 깨진 시험의 원인 커밋을 올린 세션이 고칩니다. 고치기 전에 그 지면·코드가 실제로 어떻게 도는지 보고, 시험이 찍은 고침이 맞는지부터 확인합니다(push 때 바로올리기도 같은 경고를 보입니다).');
    줄.push('자세히: node tools/ci빨간불.js');
  }
  if (풀림.length) {
    if (줄.length) 줄.push('');
    for (const { w, o } of 풀림) {
      const 풀린때 = (w.첫초록 || w.최신).시각;
      줄.push(`✅ master ${w.워크플로} 다시 초록 — 빨간 시간 ${동안(Date.parse(풀린때) - Date.parse(o.첫빨강시각))} (${때(o.첫빨강시각)} → ${때(풀린때)})`);
    }
  }
  return { 글: 줄.length ? 줄.join('\n') : null, 새상태: { 판: 1, 확인시각: 지금.확인시각, 워크플로: 새 }, 빨개짐: 빨개짐.length, 계속: 계속.length, 풀림: 풀림.length,
    빨강글워크플로: [...빨개짐, ...계속].map((w) => w.워크플로) };
}

/** 못 읽은 회차를 센다 — 못읽음한도(약 1시간)에 닿으면 「감시가 멈췄다」를 한 번 보낸다. 감시가 조용히 멈추는 것이 이 도구가 막으려던 꼴이다(10-22). */
function 못읽음기록(파일, 이유, { 환경, 보내는일, 지금ms }) {
  let 앞 = {};
  try { 앞 = JSON.parse(fs.readFileSync(파일, 'utf8')); } catch { 앞 = {}; }
  const 회수 = (앞.회수 || 0) + 1, 처음 = 앞.처음 || new Date(지금ms).toISOString();
  let 알림 = Boolean(앞.알림);
  if (회수 >= 못읽음한도 && !알림) {
    const 글 = `⚠ CI 빨간불 알림이 ${회수}회(${동안(지금ms - Date.parse(처음))}) 내리 master CI 상태를 못 읽었습니다 — ${이유}\n`
      + '그동안 CI가 빨개져도 알림이 가지 않습니다. 확인: node tools/ci빨간불.js · 회차 기록: <공용 작업본>/.git/synk-숨김실행/ci빨간불.log';
    const r = (보내는일 || require('./텔레그램승인.js').예약알림보내기)(글, 환경, { 한도ms: 보내기한도ms });
    알림 = Boolean(r && r.ok);
  }
  try {
    fs.mkdirSync(path.dirname(파일), { recursive: true });
    fs.writeFileSync(파일, JSON.stringify({ 처음, 회수, 마지막이유: 이유, 알림 }));
  } catch { /* 셈을 못 남겨도 이번 회차 결과는 그대로 */ }
  return { 회수, 알림 };
}

function 알림({ sh = 실행기(), 환경 = process.env, 보내는일 = null, 지금ms = Date.now(), 파일들 = 워크플로파일들(), 시계 = Date.now } = {}) {
  const 회차시작 = 시계();
  const 파일 = 상태파일(sh, 환경);
  // 상태 폴더가 없으면 못 읽은 회차를 셀 곳도 없다 — .git이 파일인 워크트리에서 git이 답을 못 할 때뿐이고,
  // 예약은 .git 폴더가 있는 공용 작업본에서 돌아 공용git폴더가 늘 찾는다(임시 폴더에 세면 다시 읽혀도 못 지운다).
  if (!파일) return { 결과: '모름', 이유: 'git 폴더를 못 찾았다' };
  const 못읽음파일 = path.join(path.dirname(파일), '못읽음.json');
  const 모름 = (이유) => ({ 결과: '모름', 이유, 못읽음: 못읽음기록(못읽음파일, 이유, { 환경, 보내는일, 지금ms }) });
  const 캐시 = 새캐시();
  const 지금 = 지금읽기({ sh, 파일들, 작업별: false, 캐시 });
  if (지금.상태 === '모름' && !지금.워크플로.length) return 모름(지금.이유); // 상태를 바꾸지 않는다
  const 앞 = 상태읽기(파일);
  let 계획 = 알림계획(앞, 지금, 지금ms);
  // 보낼 빨강 글이 있을 때만, 그 글에 실리는 워크플로만 작업별로 읽고 글을 다시 짠다 — 작업별은 글에만 들고 새 상태·알림 식별자는
  // 바꾸지 않는다(알림계획은 같은 입력에 같은 새 상태를 낸다)
  if (계획.빨강글워크플로.length) {
    const 실릴 = new Set(계획.빨강글워크플로);
    작업별붙이기(gh실행(sh), 지금.repo, 지금.워크플로.filter((w) => 실릴.has(w.워크플로)), 캐시,
      { 시계, 마감: Math.min(시계() + 작업읽기한도ms, 회차시작 + 알림작업마감ms) });
    계획 = 알림계획(앞, 지금, 지금ms);
  }
  // 못 읽다가 다시 읽히면 셈을 지우고, 「멈췄다」를 보냈었다면 다시 읽힌다는 한 줄을 붙인다.
  let 못읽음 = null;
  try { 못읽음 = JSON.parse(fs.readFileSync(못읽음파일, 'utf8')); } catch { 못읽음 = null; }
  // 「내리」 셈은 읽힌 이 회차에서 끊는다 — 아래 보내기가 실패해도 다음에 못 읽으면 1회부터 센다(아르곤 10-22 P2).
  // 「멈췄다」를 보냈었으면 「다시 읽습니다」가 나갈 때까지 셈 파일을 둔다(그동안 또 못 읽어도 「멈췄다」를 거듭 보내지 않는다).
  if (못읽음 && !못읽음.알림) { fs.rmSync(못읽음파일, { force: true }); 못읽음 = null; }
  const 글 = [계획.글, 못읽음 ? `✅ CI 빨간불 알림이 다시 master CI 상태를 읽습니다(${못읽음.회수}회 못 읽은 뒤).` : null].filter(Boolean).join('\n\n') || null;
  let 보냄 = null;
  if (글) {
    보냄 = (보내는일 || require('./텔레그램승인.js').예약알림보내기)(글, 환경, { 한도ms: 보내기한도ms });
    if (!보냄.ok) return { 결과: '못 보냄', 이유: 보냄.error || '보내기 실패', 글 }; // 상태를 안 바꿔 다음 회차에 다시 보낸다
  }
  상태쓰기(파일, 계획.새상태);
  if (못읽음) fs.rmSync(못읽음파일, { force: true });
  return { 결과: 글 ? '보냄' : '바뀐 것 없음', 글, 지금: 지금.상태, 상태파일: 파일, ...(보냄 ? { 방법: 보냄.method } : {}) };
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

/**
 * 예약의 PowerShell 명령. 운영 사본(tools/운영사본.js — 공용 git 폴더의 synk-ops-path)이 있으면 그 경로로, 없으면 공용 작업본 경로로
 * 건다(어느 작업본에서 돌려도 같다). 세션이 고치는 작업본의 코드를 예약이 실행하지 않게(10-22).
 */
function 예약명령({ sh = 실행기() } = {}) {
  const g = 공용git폴더(sh);
  if (!g) throw new Error('git 공용 폴더를 못 찾았다');
  let 운영 = null;
  try { 운영 = fs.readFileSync(path.join(g, 'synk-ops-path'), 'utf8').trim() || null; } catch {}
  // git은 C:/…로 준다 — 작업 스케줄러에는 이 PC의 꼴로 넣는다
  const 공용 = path.resolve(운영 && fs.existsSync(운영) ? 운영 : path.dirname(g));
  const 파이썬 = path.join(process.env.LOCALAPPDATA || '', 'Python', 'pythoncore-3.14-64', 'pythonw.exe');
  const 따옴 = (s) => `'${String(s).replace(/'/g, "''")}'`;
  const 인자 = `-X utf8 -B "${path.join(공용, 'tools', '숨김실행.py')}" "${path.join(공용, 'tools', 'ci빨간불.js')}" --알림`;
  return {
    공용, 파이썬, 인자,
    ps: [
      `$a = New-ScheduledTaskAction -Execute ${따옴(파이썬)} -Argument ${따옴(인자)} -WorkingDirectory ${따옴(공용)}`,
      `$t = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes ${예약간격분})`,
      '$s = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew -Priority 5',
      `Register-ScheduledTask -TaskName ${따옴(예약이름)} -Action $a -Trigger $t -Settings $s -Description ${따옴('master CI가 빨개지거나 다시 초록이 되면 텔레그램 한 통(AI 없음). tools/ci빨간불.js')} -Force | Out-Null`,
      `(Get-ScheduledTask -TaskName ${따옴(예약이름)}).State`,
    ].join('; '),
  };
}

// ── 명령줄 ──────────────────────────────────────────────────────────────────

/** 같은 10분 예약에 얹은 앱 예약 작업 감시 — CI를 못 읽은 회차에도 돌고, 이쪽이 깨져도 CI 알림은 그대로다. */
function 예약멈춤알림() {
  try {
    const r = require('./예약멈춤.js').알림();
    console.log(`[예약 작업 ${r.결과}]${r.이유 ? ` ${r.이유}` : ''}${r.글 ? `\n${r.글}` : ''}`);
    return r.결과 === '보냄' || r.결과 === '바뀐 것 없음';
  } catch (e) {
    console.log(`[예약 작업 감시 오류] ${e && e.message}`);
    return false;
  }
}

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
    const 예약 = 예약멈춤알림();
    return (r.결과 === '보냄' || r.결과 === '바뀐 것 없음') && 예약 ? 0 : 1;
  }
  const r = 지금읽기();
  console.log(옵션.has('--json') ? JSON.stringify(r, null, 2) : 상태글(r));
  return r.상태 === '초록' ? 0 : 1;
}

if (require.main === module) process.exitCode = main();

module.exports = { 판정하기, 실패읽기, 알림계획, 알림, 지금읽기, 빠른상태, 빠른경고글, 상태글, 저장소이름, 공용git폴더, 예약명령, 예약이름, 실행기 };
