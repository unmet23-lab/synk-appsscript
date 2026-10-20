#!/usr/bin/env node
'use strict';
/* 원격 CI 조회 — 「이 커밋이 원격에서 초록인가」에 답한다. (F175 · 2026-08-06)
 *
 * 왜 있나: GitHub Actions 장애로 push 웹훅이 throttle 되자 master 커밋 6건에
 *   syntax-check run 이 **0건**이 됐다. 그런데 `gh run list --limit 1` 은 남의 push 로 생긴
 *   최신 run 을 보여줄 뿐이라 「내 커밋은 미검증」을 말하지 못한다 — 화면에서 초록과 같은
 *   모양이다. 그날은 run 헤드 32개를 손으로 조상 대조해서야 알았다. 그 손일이 이 파일이다.
 *
 * 🔑 판정의 축은 「최신 run」이 아니라 **「내 커밋을 담은 run」**이다.
 *    run 헤드가 내 커밋의 자손이면 그 run 은 내 커밋을 검사한 것이다(자기 자신 포함).
 *    담은 run 이 여럿이면 **최신 완료본**을 쓴다 — 답하는 질문이 「이 커밋이 한때 초록이었나」가
 *    아니라 **「이 커밋이 든 줄이 지금 초록인가」**라서다. 그래서 내 커밋이 초록이었어도
 *    옆 세션이 뒤에서 깨뜨렸으면 적색이라 말한다(어느 run 을 봤는지 헤드까지 찍어 준다).
 * ⚠ 못 재면 초록이라 하지 않는다 — gh 를 못 돌리면 「모름」, 담은 run 이 없으면 「미검증」.
 *    통과와 미실행이 같은 모양이면 안 된다(CLAUDE.md 신뢰성 조항).
 *
 * 🔑 워크플로가 여럿이고 경로로 걸러진다(2026-10-20). 기록 전용 경로(트랙·결정·현장노트…)만 바꾼
 *    push 는 무거운 검사(syntax-check)를 띄우지 않고 기록 검사(records-check)만 띄운다. Windows
 *    검사(windows-check)는 제 입력 파일이 바뀔 때만 뜬다. 그래서 「담은 run 0건」이 웹훅이 끊겼다는
 *    뜻이 아닐 수 있다. 워크플로마다 따로 판정한다:
 *    ① 내 커밋을 담은 run 이 있으면 예전과 같다.
 *    ② 없으면 내 커밋의 조상을 검사한 최신 run 을 찾고, 그 헤드에서 내 커밋까지 바뀐 파일이 그 워크플로의
 *       push 경로 필터에 하나도 안 걸리면 그 run 의 판정을 **이어받는다**(그 워크플로가 읽는 파일이 그대로다).
 *       무거운 검사가 빼는 경로를 읽는 시험은 기록 검사가 모두 다시 돈다(tools/ci읽기대조.cjs가 무거운 검사마다 지킨다).
 *    ③ 걸리는 파일이 있는데 담은 run 이 없으면 예전처럼 「run 0건 = 웹훅이 끊겼다」다.
 *    필터를 못 읽으면(모르는 문법) 이어받지 않는다 — 새는 방향이 통과가 되면 안 된다.
 *
 * 사용: node tools/원격ci.js [커밋]      기본 HEAD
 * exit: 0 = 초록 · 그 외 전부 1 (초록만 초록이다)
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CI_워크플로 = 'syntax-check.yml';
const 창 = 100; // 이보다 뒤로 밀린 run 은 못 본다 → 「미검증」으로 나온다(안전한 방향이다)

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', windowsHide: true, maxBuffer: 64 << 20 });
  if (r.error) return { ok: false, 사유: `${cmd} 실행 불가 (${r.error.code || r.error.message})` };
  if (r.status !== 0) {
    const 첫줄 = String(r.stderr || '').trim().split('\n')[0];
    return { ok: false, 사유: 첫줄 || `${cmd} 가 exit ${r.status} 로 끝났다` };
  }
  return { ok: true, out: String(r.stdout || '') };
}

/* run 헤드가 대상 커밋을 담는가. 로컬에서 그 헤드를 못 찾으면 **null**(판정 불가)이다 —
 * false 로 뭉개면 「없는 run」과 「못 본 run」이 같은 모양이 된다. */
function 담는가만들기(대상) {
  return (헤드) => {
    if (!/^[0-9a-f]{7,40}$/i.test(String(헤드 || ''))) return null;
    if (!sh('git', ['cat-file', '-e', `${헤드}^{commit}`]).ok) return null;
    return sh('git', ['merge-base', '--is-ancestor', 대상, 헤드]).ok;
  };
}
/* 담는가의 반대 방향 — run 헤드가 대상의 조상인가(이어받기 후보). 못 찾으면 null. */
function 조상인가만들기(대상) {
  return (헤드) => {
    if (!/^[0-9a-f]{7,40}$/i.test(String(헤드 || ''))) return null;
    if (!sh('git', ['cat-file', '-e', `${헤드}^{commit}`]).ok) return null;
    return sh('git', ['merge-base', '--is-ancestor', 헤드, 대상]).ok;
  };
}

/* 분리 HEAD 면 `--abbrev-ref` 가 브랜치가 아니라 'HEAD' 를 준다 — 그대로 넘기면 gh 가
 * 「HEAD 라는 브랜치」를 찾아 0건이 나오고, 그게 「미검증」으로 둔갑한다. */
function 브랜치정하기(원시) {
  const s = String(원시 || '').trim();
  return (!s || s === 'HEAD') ? 'master' : s;
}

/* 🔴 push 안 된 커밋은 원격이 **검사할 수가 없다** — 「웹훅이 끊겼다」와 증상이 같지만
 *   원인도 처방도 반대다(전자는 push, 후자는 재발화). 둘을 한 문구로 내면 처방대로 따라도
 *   영영 안 풀린다: `gh workflow run --ref master` 는 origin 을 돌려 내 커밋을 안 담는다.
 *   미실행 두 종류가 같은 모양이면 안 된다(CLAUDE.md 신뢰성 조항) — 그래서 먼저 가른다. */
function 상태결정({ push됨, runs, 담는가 }) {
  if (!push됨) return { 상태: '미push', 판정불가: 0, 담긴: 0 };
  return 판정({ runs, 담는가 });
}

/* 증거가 되는 완료본 — 취소·건너뜀은 아무것도 검사하지 않았다(아래 판정의 두 주석). */
const 증거인가 = (r) => r.status === 'completed' && r.conclusion !== 'cancelled' && r.conclusion !== 'skipped';

/* 순수 판정 — 탐지력은 여기에 픽스처를 부어 못박는다(실저장소 이력에 기대면 그 커밋이
 * 흘러간 뒤 검사가 죽는다 · CLAUDE.md 가드 맹점 ②). tests/원격ci.test.js. */
function 판정({ runs, 담는가 }) {
  const 담긴 = [];
  let 판정불가 = 0;
  for (const r of runs || []) {
    const v = 담는가(r.headSha);
    if (v === null) { 판정불가 += 1; continue; }
    if (v) 담긴.push(r);
  }
  담긴.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (!담긴.length) return { 상태: '미검증', 판정불가, 담긴: 0 };
  /* 🔴 취소는 증거가 아니다 — 같은 ref 에 새 push 가 오면 기다리던 낡은 판 run 은 취소된다(10-20부터는
   * 도는 run 은 끝까지 두고 기다리던 run 만 새 판으로 바뀐다). 취소된 완료본을 적색으로 읽으면 상위 run 이
   * 도는 몇 분 동안 거짓 적색+빈 로그 처방이 나간다(08-07 실측 run 31173804076). 초록으로 읽는 것도
   * 금지다 — 아무것도 검사하지 않았다. 그래서 증거 풀에서 통째로 뺀다. */
  /* 🔴 **건너뜀도 증거가 아니다** (2026-08-18 · 셀프호스티드 스위치와 짝).
   *   워크플로의 `if:` 스위치가 꺼져 있으면 run 은 **한 스텝도 안 돌고** `conclusion: skipped` 로
   *   «완료»된다. 취소와 같은 성질이다 — 아무것도 검사하지 않았다. 증거 풀에 두면 적색으로 읽히고,
   *   성공 취급하면 **검사 0건이 통과**가 된다. 그래서 풀에서 빼고 **자기 이름으로** 낸다. */
  const 완료 = 담긴.filter(증거인가);
  const 도는중 = 담긴.filter((r) => r.status !== 'completed');
  const 건너뜀 = 담긴.filter((r) => r.status === 'completed' && r.conclusion === 'skipped');
  if (!완료.length) {
    // 아직 도는 중이면 초록도 적색도 아니다 — 「곧 초록이겠지」는 판정이 아니다.
    if (도는중.length) return { 상태: '대기', run: 도는중[0], 판정불가, 담긴: 담긴.length };
    /* 취소보다 **먼저** 본다 — 건너뜀은 원인이 하나로 특정된다(스위치가 꺼졌다)이고,
     * 취소는 「더 새 판이 왔다」라 처방이 다르다. 둘이 섞이면 특정된 쪽을 먼저 말한다. */
    if (건너뜀.length) return { 상태: '건너뜀', run: 건너뜀[0], 판정불가, 담긴: 담긴.length };
    return { 상태: '취소뿐', run: 담긴[0], 판정불가, 담긴: 담긴.length };
  }
  return { 상태: 완료[0].conclusion === 'success' ? '초록' : '적색', run: 완료[0], 판정불가, 담긴: 담긴.length };
}

/* ── push 경로 필터 ─────────────────────────────────────────────────────────────
 * 워크플로 YAML 의 `on: push:` 아래 `paths:` / `paths-ignore:` 목록만 읽는다. 그 밖의 거름(branches·tags)이나
 * 모르는 꼴이면 { 종류: '모름' } — 이어받지 않는다. push 가 없으면 { 종류: '없음' }(push 로 안 뜨는 워크플로). */
function 푸시필터(yaml) {
  const 줄들 = String(yaml || '').replace(/\r/g, '').split('\n');
  const 들여 = (s) => s.match(/^ */)[0].length;
  const 값 = (s) => s.replace(/\s+#.*$/, '').trim();
  let i = 줄들.findIndex((l) => /^(on|'on'|"on"):/.test(l));
  if (i < 0) return { 종류: '모름' };
  const 머리 = 값(줄들[i].replace(/^(on|'on'|"on"):/, ''));
  if (머리) {
    const 이름들 = 머리.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    if (머리.startsWith('{')) return { 종류: '모름' };
    return 이름들.includes('push') ? { 종류: '전부' } : { 종류: '없음' };
  }
  // on: 아래 블록에서 push: 를 찾는다.
  let 기준 = -1, push줄 = -1;
  for (let j = i + 1; j < 줄들.length; j++) {
    const l = 줄들[j];
    if (!l.trim() || /^\s*#/.test(l)) continue;
    if (들여(l) === 0) break;
    if (기준 < 0) 기준 = 들여(l);
    if (들여(l) === 기준 && /^\s*push:/.test(l)) { push줄 = j; break; }
  }
  if (push줄 < 0) return { 종류: '없음' };
  const push값 = 값(줄들[push줄].replace(/^\s*push:/, ''));
  if (push값 && push값 !== '{}' && push값 !== '~' && push값 !== 'null') return { 종류: '모름' };
  const 결과 = { 종류: '전부', 패턴: [] };
  let 열쇠 = null, 열쇠들여 = -1;
  for (let j = push줄 + 1; j < 줄들.length; j++) {
    const l = 줄들[j];
    if (!l.trim() || /^\s*#/.test(l)) continue;
    if (들여(l) <= 기준) break;
    const m = l.match(/^(\s*)([A-Za-z-]+):\s*(.*)$/);
    if (m && !/^\s*-/.test(l)) {
      열쇠 = m[2]; 열쇠들여 = m[1].length;
      if (!['paths', 'paths-ignore'].includes(열쇠)) return { 종류: '모름' };
      if (결과.종류 !== '전부' && 결과.종류 !== 열쇠) return { 종류: '모름' }; // 둘을 같이 쓰면 GitHub 도 거절한다
      결과.종류 = 열쇠;
      if (값(m[3])) return { 종류: '모름' }; // 한 줄 목록([a, b])은 읽지 않는다
      continue;
    }
    const 항목 = l.match(/^(\s*)-\s*(.+)$/);
    if (!항목 || !열쇠 || 항목[1].length <= 열쇠들여 - 1) return { 종류: '모름' };
    let 패턴 = 값(항목[2]);
    if (/^'.*'$/.test(패턴)) 패턴 = 패턴.slice(1, -1).replace(/''/g, "'");
    else if (/^".*"$/.test(패턴)) 패턴 = 패턴.slice(1, -1);
    결과.패턴.push(패턴);
  }
  if (결과.종류 === '전부') return { 종류: '전부' };
  if (!결과.패턴.length) return { 종류: '모름' };
  return 결과;
}

/* GitHub 경로 패턴 → 정규식. `**`(아무 글자, / 포함)·`*`(/ 빼고)만 받는다. `?`·`+`·`[` 는 GitHub 에서 뜻이
 * 다르고(앞 글자의 0~1번 등) 여기서 안 쓰므로 모름(null) — 그 워크플로는 이어받지 않는다. */
function 경로패턴(패턴) {
  if (/[?+[\]{}]/.test(패턴)) return null;
  let 식 = '';
  for (let i = 0; i < 패턴.length; i++) {
    const c = 패턴[i];
    if (c === '*' && 패턴[i + 1] === '*') {
      i++;
      if (패턴[i + 1] === '/') { i++; 식 += '(?:.*/)?'; } else 식 += '.*';
    } else if (c === '*') 식 += '[^/]*';
    else 식 += c.replace(/[.^$|()\\]/g, '\\$&');
  }
  return new RegExp('^' + 식 + '$');
}

/* 이 파일들을 바꾼 push 가 그 워크플로를 띄우는가. 모르면 null. GitHub 규칙: 패턴은 차례대로, `!` 는 뒤집기. */
function 걸리나(필터, 파일들) {
  if (!필터 || 필터.종류 === '모름') return null;
  if (필터.종류 === '없음') return false;
  if (필터.종류 === '전부') return 파일들.length > 0;
  const 식들 = 필터.패턴.map((p) => ({ 뒤집기: p.startsWith('!'), 식: 경로패턴(p.replace(/^!/, '')) }));
  if (식들.some((x) => !x.식)) return null;
  const 맞음 = (f) => { let v = false; for (const x of 식들) if (x.식.test(f)) v = !x.뒤집기; return v; };
  return 필터.종류 === 'paths' ? 파일들.some(맞음) : 파일들.some((f) => !맞음(f));
}

/* 담은 run 이 없을 때 — 조상을 검사한 최신 증거 run 의 판정을 이어받을 수 있는가(순수 판정).
 * 바뀐파일(헤드) 은 그 run 헤드에서 대상까지 바뀐 파일 목록, 못 구하면 null. */
function 이어받기({ runs, 조상인가, 필터, 바뀐파일 }) {
  const 조상run = (runs || []).filter((r) => 조상인가(r.headSha) === true)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const 후보 = 조상run.find((r) => 증거인가(r) || r.status !== 'completed');
  if (!후보) return null;
  const 파일들 = 바뀐파일(후보.headSha);
  if (!Array.isArray(파일들)) return null;
  if (걸리나(필터, 파일들) !== false) return null;
  if (후보.status !== 'completed') return { 상태: '대기', run: 후보, 이어받음: true, 바뀐파일수: 파일들.length };
  return { 상태: 후보.conclusion === 'success' ? '초록' : '적색', run: 후보, 이어받음: true, 바뀐파일수: 파일들.length };
}

/* 워크플로 하나의 판정. 담은 run 이 있으면 그것, 없으면 이어받기, 둘 다 아니면 미검증. */
function 워크플로판정({ push됨, runs, 담는가, 조상인가, 필터, 바뀐파일 }) {
  const r = 상태결정({ push됨, runs, 담는가 });
  if (r.상태 !== '미검증') return r;
  const 이음 = 이어받기({ runs, 조상인가, 필터, 바뀐파일 });
  return 이음 ? { ...이음, 판정불가: r.판정불가, 담긴: 0 } : r;
}

/* 여러 워크플로 판정을 하나로 — 초록은 모두가 초록(이어받은 초록 포함)일 때만이다. */
function 종합(결과들) {
  const 순서 = ['미push', '적색', '대기', '건너뜀', '취소뿐', '미검증'];
  for (const 상태 of 순서) {
    const 걸린 = 결과들.find((x) => x.결과.상태 === 상태);
    if (걸린) return { 상태, 대표: 걸린 };
  }
  if (!결과들.length) return { 상태: '미검증', 대표: null };
  return { 상태: '초록', 대표: null };
}

/* 🔴 적색에도 두 종류가 있다 — 「코드가 깨졌다」와 「한 스텝도 안 돌았다」. 후자(F210: 결제
 * 실패·지출 한도로 job 미기동 · run 은 3초 만에 failure 로 «완료»된다)를 같은 ❌ 로 내면
 * 처방(--log-failed)이 빈 로그를 가리키고, 세션마다 ANNOTATIONS 를 손으로 열어 판별을
 * 재도출한다(08-07 실측: 보드 줄 4개가 각자 재도출). 판별은 jobs 의 steps 로 간다 —
 * 미기동 job 은 스텝이 아예 없다(annotation·로그는 표시층이라 기계 판별이 불안정하다). */
function 미기동인가(jobs) {
  return (jobs || []).every((j) => !(j.steps || []).length);
}

/* 적색일 때만 한 번 더 — 그 run 의 jobs 를 읽는다. 못 읽으면 null 로 물러나
 * 평소 적색 문구를 낸다(이 보강이 기본 판정을 죽이면 안 된다). */
function jobs조회(runId) {
  const g = sh('gh', ['run', 'view', String(runId), '--json', 'jobs']);
  if (!g.ok) return null;
  try { return JSON.parse(g.out).jobs || []; } catch (_) { return null; }
}

/* gh 를 못 돌리면 「모름」으로 끝낸다 — 빈 목록을 돌려주면 그게 「미검증」으로 둔갑한다. */
function gh조회(브랜치, 워크플로) {
  const gh = sh('gh', ['run', 'list', `--workflow=${워크플로}`, '--branch', 브랜치,
    '--limit', String(창), '--json', 'headSha,status,conclusion,createdAt,databaseId']);
  if (!gh.ok) {
    console.error(`[원격ci] ❔ 모름 — gh 를 못 돌렸다(${워크플로}): ${gh.사유}`);
    console.error('   초록이 아니다. gh auth status 로 인증부터 본다.');
    process.exit(1);
  }
  try { return JSON.parse(gh.out); } catch (e) {
    console.error(`[원격ci] ❔ 모름 — gh 출력이 JSON 이 아니다(${워크플로}): ${e.message}`);
    process.exit(1);
  }
}

/* 대상 커밋에 있는 워크플로 가운데 push 로 뜨는 것. 그 커밋의 파일을 읽는다(GitHub 도 push 된 커밋의
 * 워크플로 파일로 거른다). syntax-check 는 늘 앞에 둔다. */
function 워크플로찾기(대상) {
  const 목록 = sh('git', ['ls-tree', '--name-only', `${대상}:.github/workflows`]);
  const 이름들 = 목록.ok ? 목록.out.split('\n').map((s) => s.trim()).filter((s) => /\.ya?ml$/.test(s)) : [];
  const 결과 = [];
  for (const 파일 of 이름들) {
    const 본문 = sh('git', ['show', `${대상}:.github/workflows/${파일}`]);
    const 필터 = 푸시필터(본문.ok ? 본문.out : '');
    if (필터.종류 === '없음') continue;
    결과.push({ 파일, 필터 });
  }
  if (!결과.some((w) => w.파일 === CI_워크플로)) 결과.push({ 파일: CI_워크플로, 필터: { 종류: '모름' } });
  return 결과.sort((a, b) => (a.파일 === CI_워크플로 ? -1 : b.파일 === CI_워크플로 ? 1 : a.파일.localeCompare(b.파일)));
}

function 바뀐파일만들기(대상) {
  return (헤드) => {
    const d = sh('git', ['-c', 'core.quotepath=false', 'diff', '--no-renames', '--name-only', '-z', 헤드, 대상, '--']);
    return d.ok ? d.out.split('\0').filter(Boolean) : null;
  };
}

function runDesc(r) {
  return r ? `run ${r.databaseId} (헤드 ${String(r.headSha).slice(0, 7)} · ${r.createdAt})` : '';
}
function 한줄(w, x) {
  const r = x.결과;
  if (r.이어받음) {
    const 꼴 = r.상태 === '초록' ? '초록' : r.상태 === '적색' ? '적색' : '대기';
    return `${w.파일}: ${꼴}을 이어받음 — ${runDesc(r.run)} 뒤로 바뀐 ${r.바뀐파일수}개 파일이 이 워크플로 경로 필터에 안 걸린다`;
  }
  if (r.상태 === '미검증') return `${w.파일}: 담은 run 0건(최근 ${창}건 안에서)`;
  return `${w.파일}: ${r.상태} — ${runDesc(r.run)}`;
}

function main() {
  const 인자 = process.argv[2] || 'HEAD';
  /* 🔴 `--verify --end-of-options` 는 장식이 아니다 — 없으면 인자가 **git 의 옵션으로 먹힌다**.
   *   `--help` 하나로 두 가지가 터졌다: ①exit 0 + 빈 출력이라 대상이 빈 문자열로 통과해 확신에
   *   찬 「미검증」이 나오고 ②Git for Windows 가 **기본 브라우저로 도움말 HTML 을 연다**.
   *   회귀가 이 도구를 `--help` 로 돌리므로 테스트 1회 = 브라우저 탭 1개였다(F191).
   *   git 문서가 주는 정석 처방이다("verifying a name from an untrusted source"). */
  const 해석 = sh('git', ['rev-parse', '--verify', '--end-of-options', 인자]);
  /* ⚠ 그래도 exit 0 을 「읽었다」로 읽지 않는다 — 헤드 쪽에서 이 뭉개기를 막아 놓고
   *   (담는가만들기) 대상 쪽에 안 쓰면 자기모순이다. */
  const 대상 = 해석.ok ? 해석.out.trim() : '';
  if (!/^[0-9a-f]{40}$/i.test(대상)) {
    console.error(`[원격ci] ❔ 모름 — 커밋을 못 읽었다: ${해석.사유 || `"${인자}" 가 커밋이 아니다`}`);
    process.exit(1);
  }

  // 남의 push 로 생긴 run 헤드는 fetch 전엔 로컬에 없다 → 판정불가만 잔뜩 는다. 실패해도 진행.
  sh('git', ['fetch', 'origin', '--quiet']);

  /* 🔴 브랜치를 안 거르면 **남의 브랜치 초록이 내 초록으로 보인다**. 워크플로가 브랜치를 안 걸러
   *   폰 작업 `claude/*` run 이 같은 목록에 섞이는데, 그 헤드가 내 커밋을 담고 있어도 검사한 나무는
   *   내 브랜치가 아니다. 새는 방향이 「통과」라 이쪽을 먼저 막는다. */
  const 브랜치 = 브랜치정하기(sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']).out);
  const push됨 = sh('git', ['merge-base', '--is-ancestor', 대상, `origin/${브랜치}`]).ok;
  const 짧게 = 대상.slice(0, 7);

  // push 도 안 됐으면 원격에 물어볼 것이 없다 — 네트워크를 아끼는 게 아니라 답이 이미 정해졌다.
  if (!push됨) {
    console.log(`[원격ci] 🔴 원격 미검증 — ${짧게} 는 아직 origin/${브랜치} 에 없다(push 전).`);
    console.log('   원격은 없는 커밋을 검사할 수 없다 — 웹훅 문제가 아니라 내 손이 안 간 것이다.');
    console.log(`   → git push origin ${브랜치}`);
    process.exit(1);
  }

  const 담는가 = 담는가만들기(대상), 조상인가 = 조상인가만들기(대상), 바뀐파일 = 바뀐파일만들기(대상);
  const 결과들 = 워크플로찾기(대상).map((w) => ({ w, 결과: 워크플로판정({ push됨, runs: gh조회(브랜치, w.파일),
    담는가, 조상인가, 필터: w.필터, 바뀐파일 }) }));
  const 전체 = 종합(결과들);
  const 대표 = 전체.대표;
  const 요약 = 결과들.map((x) => `${x.w.파일.replace(/\.ya?ml$/, '')} ${x.결과.이어받음 ? '이어받은 ' : ''}${x.결과.상태}`).join(' · ');

  if (전체.상태 === '초록') {
    const 앞 = 결과들.find((x) => x.w.파일 === CI_워크플로) || 결과들[0];
    console.log(`[원격ci] ✅ 초록 — ${짧게}: ${요약} (${CI_워크플로} ${runDesc(앞.결과.run)})`);
  } else if (전체.상태 === '적색') {
    const r = 대표.결과;
    const jobs = jobs조회(r.run.databaseId);
    if (jobs && 미기동인가(jobs)) {
      console.log(`[원격ci] ⛔ 미기동 — ${짧게}: ${대표.w.파일} ${runDesc(r.run)} 이 ${r.run.conclusion} 인데 **한 스텝도 안 돌았다**(job 미기동). ${요약}`);
      console.log('   코드 적색이 아니다 — 시작 전에 막혔다(결제 실패·지출 한도·취소 · F210 계열). 코드는 여전히 미검증이다.');
      console.log(`   → 사유는 gh run view ${r.run.databaseId} 의 ANNOTATIONS 에 있다(로그는 비어 있다)`);
    } else {
      console.log(`[원격ci] ❌ 적색 — ${짧게}: ${대표.w.파일} ${runDesc(r.run)} 이 ${r.run.conclusion}${r.이어받음 ? '(이어받은 판정)' : ''}. ${요약}`);
      console.log(`   → gh run view ${r.run.databaseId} --log-failed`);
    }
  } else if (전체.상태 === '대기') {
    console.log(`[원격ci] ⏳ 대기 — ${짧게}: ${대표.w.파일} ${runDesc(대표.결과.run)} 이 아직 ${대표.결과.run.status}. 초록이 아니다. ${요약}`);
  } else if (전체.상태 === '건너뜀') {
    console.log(`[원격ci] 🔴 원격 미검증 — ${짧게}: ${대표.w.파일} ${runDesc(대표.결과.run)} 이 **건너뜀**(skipped)이다. 한 스텝도 안 돌았다. ${요약}`);
    console.log('   적색이 아니라 **미실행**이다 — 로그를 열어도 비어 있다(열지 말 것).');
    console.log('   원인은 하나로 특정된다: 워크플로의 if: 스위치가 꺼져 있다(비공개 저장소의 SYNK_HOSTED_CI·SYNK_SELFHOSTED).');
    console.log('   → GitHub → 저장소 Settings → Secrets and variables → Actions → Variables 에서 스위치를 본다.');
    console.log(`   → 스위치를 켠 뒤 다시 돌리려면: gh workflow run ${대표.w.파일} --ref ${브랜치}`);
  } else if (전체.상태 === '취소뿐') {
    console.log(`[원격ci] 🔴 원격 미검증 — ${짧게}: ${대표.w.파일} 의 담은 run 은 취소본뿐이고(${runDesc(대표.결과.run)}) 대신 도는 run 도 없다. ${요약}`);
    console.log('   취소는 검사가 아니다 — 낡은 판을 접은 새 판이 완주하기 전에 그 판마저 사라진 모양이다.');
    console.log(`   → gh workflow run ${대표.w.파일} --ref ${브랜치}`);
  } else {
    const 파일 = 대표 ? 대표.w.파일 : CI_워크플로;
    console.log(`[원격ci] 🔴 원격 미검증 — ${짧게}: ${파일} 의 담은 run 이 **0건**인데 이 커밋까지 그 워크플로가 읽는 파일이 바뀌었다(${브랜치} 최근 ${창}건 안에서). ${요약}`);
    console.log('   push 는 됐는데 run 이 없다 = 웹훅이 끊겼거나 아직 안 떴다. 화면에선 「아직 안 돎」과 초록이 같은 모양이라 안 보인다.');
    console.log(`   → gh workflow run ${파일} --ref ${브랜치}`);
  }
  for (const x of 결과들) console.log('   · ' + 한줄(x.w, x));
  const 판정불가 = 결과들.reduce((n, x) => n + (x.결과.판정불가 || 0), 0);
  if (판정불가) console.log(`   ⚠ run 헤드 ${판정불가}개는 로컬에 없어 못 봤다(남의 브랜치일 수 있다) — 판정에서 뺐다.`);
  process.exit(전체.상태 === '초록' ? 0 : 1);
}

if (require.main === module) main();

module.exports = { 판정, 상태결정, 브랜치정하기, 담는가만들기, 조상인가만들기, 미기동인가, 푸시필터, 경로패턴, 걸리나, 이어받기,
  워크플로판정, 종합, CI_워크플로 };
