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
  const 완료 = 담긴.filter((r) => r.status === 'completed');
  // 아직 도는 중이면 초록도 적색도 아니다 — 「곧 초록이겠지」는 판정이 아니다.
  if (!완료.length) return { 상태: '대기', run: 담긴[0], 판정불가, 담긴: 담긴.length };
  return { 상태: 완료[0].conclusion === 'success' ? '초록' : '적색', run: 완료[0], 판정불가, 담긴: 담긴.length };
}

function main() {
  const 인자 = process.argv[2] || 'HEAD';
  const 해석 = sh('git', ['rev-parse', 인자]);
  if (!해석.ok) { console.error(`[원격ci] ❔ 모름 — 커밋을 못 읽었다: ${해석.사유}`); process.exit(1); }
  const 대상 = 해석.out.trim();

  // 남의 push 로 생긴 run 헤드는 fetch 전엔 로컬에 없다 → 판정불가만 잔뜩 는다. 실패해도 진행.
  sh('git', ['fetch', 'origin', '--quiet']);

  const 창 = 100; // 이보다 뒤로 밀린 run 은 못 본다 → 「미검증」으로 나온다(안전한 방향이다)
  const gh = sh('gh', ['run', 'list', `--workflow=${CI_워크플로}`, '--limit', String(창),
    '--json', 'headSha,status,conclusion,createdAt,databaseId']);
  if (!gh.ok) {
    console.error(`[원격ci] ❔ 모름 — gh 를 못 돌렸다: ${gh.사유}`);
    console.error('   초록이 아니다. gh auth status 로 인증부터 본다.');
    process.exit(1);
  }
  let runs;
  try { runs = JSON.parse(gh.out); } catch (e) {
    console.error(`[원격ci] ❔ 모름 — gh 출력이 JSON 이 아니다: ${e.message}`);
    process.exit(1);
  }

  const r = 판정({ runs, 담는가: 담는가만들기(대상) });
  const 짧게 = 대상.slice(0, 7);
  const run쪽 = r.run ? `run ${r.run.databaseId} (헤드 ${String(r.run.headSha).slice(0, 7)} · ${r.run.createdAt})` : '';

  if (r.상태 === '초록') console.log(`[원격ci] ✅ 초록 — ${짧게} 를 담은 ${run쪽} 통과`);
  else if (r.상태 === '적색') {
    console.log(`[원격ci] ❌ 적색 — ${짧게} 를 담은 ${run쪽} 이 ${r.run.conclusion}`);
    console.log(`   → gh run view ${r.run.databaseId} --log-failed`);
  } else if (r.상태 === '대기') {
    console.log(`[원격ci] ⏳ 대기 — ${짧게} 를 담은 ${run쪽} 이 아직 ${r.run.status}. 초록이 아니다.`);
  } else {
    console.log(`[원격ci] 🔴 원격 미검증 — ${짧게} 를 담은 ${CI_워크플로} run 이 **0건**이다(최근 ${창}건 안에서).`);
    console.log('   웹훅이 끊기면 이렇게 된다. 화면에선 「아직 안 돎」과 초록이 같은 모양이라 안 보인다.');
    console.log(`   → gh workflow run ${CI_워크플로} --ref master`);
  }
  if (r.판정불가) {
    console.log(`   ⚠ run 헤드 ${r.판정불가}개는 로컬에 없어 못 봤다(남의 브랜치일 수 있다) — 판정에서 뺐다.`);
  }
  process.exit(r.상태 === '초록' ? 0 : 1);
}

if (require.main === module) main();

module.exports = { 판정, 담는가만들기, CI_워크플로 };
