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
 * 사용: node tools/원격ci.js [커밋]      기본 HEAD
 * exit: 0 = 초록 · 그 외 전부 1 (초록만 초록이다)
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const CI_워크플로 = 'syntax-check.yml';

function sh(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', windowsHide: true });
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

/* 순수 판정 — 탐지력은 여기에 픽스처를 부어 못박는다(실저장소 이력에 기대면 그 커밋이
 * 흘러간 뒤 검사가 죽는다 · CLAUDE.md 가드 맹점 ②). */
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
  /* 🔴 취소는 증거가 아니다 — cancel-in-progress(c0f035a)로 「같은 ref 에 새 push 가 오면 낡은 판
   * run 취소」가 일상이 됐다. 취소된 완료본을 적색으로 읽으면 상위 run 이 도는 몇 분 동안 거짓
   * 적색+빈 로그 처방이 나간다(08-07 실측 run 31173804076). 초록으로 읽는 것도 금지다 —
   * 아무것도 검사하지 않았다. 그래서 증거 풀에서 통째로 뺀다. */
  /* 🔴 **건너뜀도 증거가 아니다** (2026-08-18 · 셀프호스티드 스위치와 짝).
   *   워크플로의 `if: vars.SYNK_SELFHOSTED == 'on'` 이 꺼져 있으면 run 은 **한 스텝도 안 돌고**
   *   `conclusion: skipped` 로 «완료»된다. 취소와 같은 성질이다 — 아무것도 검사하지 않았다.
   *   증거 풀에 두면 `conclusion !== 'success'` 라 **적색**으로 읽히는데, 그건 「코드가 깨졌다」로
   *   들려 로그를 열게 만든다(빈 로그다). 반대로 성공 취급하면 **검사 0건이 통과**가 된다 —
   *   새는 방향이 언제나 통과인 그 형태다. 그래서 풀에서 빼고 **자기 이름으로** 낸다. */
  const 완료 = 담긴.filter((r) => r.status === 'completed'
    && r.conclusion !== 'cancelled' && r.conclusion !== 'skipped');
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
function gh조회(브랜치, 창) {
  const gh = sh('gh', ['run', 'list', `--workflow=${CI_워크플로}`, '--branch', 브랜치,
    '--limit', String(창), '--json', 'headSha,status,conclusion,createdAt,databaseId']);
  if (!gh.ok) {
    console.error(`[원격ci] ❔ 모름 — gh 를 못 돌렸다: ${gh.사유}`);
    console.error('   초록이 아니다. gh auth status 로 인증부터 본다.');
    process.exit(1);
  }
  try { return JSON.parse(gh.out); } catch (e) {
    console.error(`[원격ci] ❔ 모름 — gh 출력이 JSON 이 아니다: ${e.message}`);
    process.exit(1);
  }
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

  /* 🔴 브랜치를 안 거르면 **남의 브랜치 초록이 내 초록으로 보인다**. syntax-check 은 브랜치
   *   필터가 없어(on: push) 폰 작업 `claude/*` run 이 같은 목록에 섞이는데, 그 헤드가 내 커밋을
   *   담고 있어도 검사한 나무는 내 브랜치가 아니다. 새는 방향이 「통과」라 이쪽을 먼저 막는다. */
  const 브랜치 = 브랜치정하기(sh('git', ['rev-parse', '--abbrev-ref', 'HEAD']).out);
  const push됨 = sh('git', ['merge-base', '--is-ancestor', 대상, `origin/${브랜치}`]).ok;

  const 창 = 100; // 이보다 뒤로 밀린 run 은 못 본다 → 「미검증」으로 나온다(안전한 방향이다)
  // push 도 안 됐으면 원격에 물어볼 것이 없다 — 네트워크를 아끼는 게 아니라 답이 이미 정해졌다.
  const runs = push됨 ? gh조회(브랜치, 창) : [];

  const r = 상태결정({ push됨, runs, 담는가: 담는가만들기(대상) });
  const 짧게 = 대상.slice(0, 7);
  const run쪽 = r.run ? `run ${r.run.databaseId} (헤드 ${String(r.run.headSha).slice(0, 7)} · ${r.run.createdAt})` : '';

  if (r.상태 === '초록') console.log(`[원격ci] ✅ 초록 — ${짧게} 를 담은 ${run쪽} 통과`);
  else if (r.상태 === '적색') {
    const jobs = jobs조회(r.run.databaseId);
    if (jobs && 미기동인가(jobs)) {
      console.log(`[원격ci] ⛔ 미기동 — ${짧게} 를 담은 ${run쪽} 이 ${r.run.conclusion} 인데 **한 스텝도 안 돌았다**(job 미기동).`);
      console.log('   코드 적색이 아니다 — 시작 전에 막혔다(결제 실패·지출 한도·취소 · F210 계열). 코드는 여전히 미검증이다.');
      console.log(`   → 사유는 gh run view ${r.run.databaseId} 의 ANNOTATIONS 에 있다(로그는 비어 있다)`);
    } else {
      console.log(`[원격ci] ❌ 적색 — ${짧게} 를 담은 ${run쪽} 이 ${r.run.conclusion}`);
      console.log(`   → gh run view ${r.run.databaseId} --log-failed`);
    }
  } else if (r.상태 === '대기') {
    console.log(`[원격ci] ⏳ 대기 — ${짧게} 를 담은 ${run쪽} 이 아직 ${r.run.status}. 초록이 아니다.`);
  } else if (r.상태 === '건너뜀') {
    console.log(`[원격ci] 🔴 원격 미검증 — ${짧게} 를 담은 ${run쪽} 이 **건너뜀**(skipped)이다. 한 스텝도 안 돌았다.`);
    console.log('   적색이 아니라 **미실행**이다 — 로그를 열어도 비어 있다(열지 말 것).');
    console.log('   원인은 하나로 특정된다: 셀프호스티드 러너 스위치가 꺼져 있다.');
    console.log('   → GitHub → 저장소 Settings → Secrets and variables → Actions → Variables 에서');
    console.log('     `SYNK_SELFHOSTED` 를 `on` 으로 둔다. 그리고 러너가 Idle 인지 Settings → Actions → Runners 에서 본다.');
    console.log(`   → 스위치를 켠 뒤 다시 돌리려면: gh workflow run ${CI_워크플로} --ref ${브랜치}`);
  } else if (r.상태 === '취소뿐') {
    console.log(`[원격ci] 🔴 원격 미검증 — ${짧게} 를 담은 run 은 취소본뿐이고(${run쪽}) 대신 도는 run 도 없다.`);
    console.log('   취소는 검사가 아니다 — 낡은 판을 접은 새 판이 완주하기 전에 그 판마저 사라진 모양이다.');
    console.log(`   → gh workflow run ${CI_워크플로} --ref ${브랜치}`);
  } else if (r.상태 === '미push') {
    console.log(`[원격ci] 🔴 원격 미검증 — ${짧게} 는 아직 origin/${브랜치} 에 없다(push 전).`);
    console.log('   원격은 없는 커밋을 검사할 수 없다 — 웹훅 문제가 아니라 내 손이 안 간 것이다.');
    console.log(`   → git push origin ${브랜치}`);
  } else {
    console.log(`[원격ci] 🔴 원격 미검증 — ${짧게} 를 담은 ${CI_워크플로} run 이 **0건**이다(${브랜치} 최근 ${창}건 안에서).`);
    console.log('   push 는 됐는데 run 이 없다 = 웹훅이 끊겼다. 화면에선 「아직 안 돎」과 초록이 같은 모양이라 안 보인다.');
    console.log(`   → gh workflow run ${CI_워크플로} --ref ${브랜치}`);
  }
  if (r.판정불가) {
    console.log(`   ⚠ run 헤드 ${r.판정불가}개는 로컬에 없어 못 봤다(남의 브랜치일 수 있다) — 판정에서 뺐다.`);
  }
  process.exit(r.상태 === '초록' ? 0 : 1);
}

if (require.main === module) main();

module.exports = { 판정, 상태결정, 브랜치정하기, 담는가만들기, 미기동인가, CI_워크플로 };
