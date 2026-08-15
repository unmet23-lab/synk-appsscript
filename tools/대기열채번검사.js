#!/usr/bin/env node
/* 대기열 `#Qnn` 채번 게이트 — 겹친 번호가 **커밋되기 전에** 막는다. (F461 처방 ㄴ · 2026-08-15)
 *
 * 왜 있나 — 이 저장소에서 번호를 매기는 곳은 셋이고, 둘은 이미 같은 병을 앓고 락으로 닫았다:
 *   `tools/bump-version.js` 채번 락 · `tools/friction.js` 의 `friction-F0NN` 태그 예약. 세 번째인
 *   `#Qnn` 만 **사람(세션)이 Edit 로 손수 적는** 번호라 발급 통로 자체가 없었다. 2026-08-15,
 *   두 세션이 7분 차(`2bdc3bb4` 02:24:29 · `70e2f85f` 02:31:13)로 같은 「최대+1」을 읽어 `#Q84` 를
 *   겹쳐 발급했다 — **규약을 어긴 세션은 없는데** 결과가 깨졌다. 그게 이 게이트의 발단이다.
 *
 * 🔑 없던 것은 탐지가 아니라 **예방**이다 — `tests/대기열점유.test.js` 는 그때도 잡았고, 그래서
 *   저장소 전체 CI 가 빨갰다. 문제는 그 적색이 **주인이 없다**는 것이다: 겹친 두 세션 중 누구도
 *   자기 것으로 안 읽고, 그동안 남의 배포 게이트가 막힌다. 커밋 자리로 앞당기면 그 적색이
 *   «지금 그 파일을 만지는 사람» 앞에서, 고칠 수 있는 시점에 발화한다.
 *
 * 🔑 판정은 여기서 안 한다 — `tools/대기열.js` 의 `채번()` 하나가 지고 **사후 회귀도 같은 함수**를
 *   부른다. 여기 사본을 두면 판정이 갈리고, 갈라지는 방향은 언제나 「통과」다(가드 맹점 ④).
 * 🔑 ROOT 에 `CLAUDE_PROJECT_DIR` 을 **안 얹는다** — 그 변수가 다른 저장소를 가리키면 옆 저장소의
 *   스테이징을 재고 조용히 통과한다(회귀 `tests/게이트뿌리.test.js` · F403 이 그 층에서 났다).
 *   그래서 판정 함수만 `대기열.js` 에서 빌려 오고, **어느 파일을 읽나는 여기서 정한다.**
 * 🔑 대상 판정도 여기 있다 — 훅은 조건 없이 부른다. 훅보다 좁은 필터를 앞에 두면 그 필터가 곧
 *   구멍이 되고, 같은 판정이 두 곳에 갈려 적힌다(맹점 ③④).
 *
 * ⚠ `--cached` 는 작업본이 아니라 **커밋될 내용**을 읽는다(F302) — 스테이징만 고치고 작업본은
 *   그대로인 경우가 실재하고, 그때 작업본을 재면 초록이 거짓이다.
 * ⚠ 못 읽거나 0건이면 **막지 않고 말한다** — 여기서 차단하면 그 세션은 아무것도 커밋 못 하는데
 *   처방이 없다. 따를 수 없는 처방은 우회를 정상 통로로 만든다(F103). 대신 통과와 미실행이
 *   같은 모양이 되지 않게 찍는다(F207).
 *
 * 사용:
 *   node tools/대기열채번검사.js --cached   스테이징된 것만 (pre-commit 용)
 *   node tools/대기열채번검사.js            작업본 그대로 (손으로 확인할 때)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

/* ROOT 는 **이 파일이 속한 저장소**다 — 훅이 `$ROOT/tools/…` 로 부르고 워크트리엔 제 사본이
 * 있으니 이 파일의 자리가 곧 커밋되는 저장소다(`tests/게이트뿌리.test.js` 가 이 형태를 강제). */
const ROOT = path.resolve(__dirname, '..');
const 큐 = require(path.join(__dirname, '대기열.js'));
const 좌표 = 큐.대기열좌표;

function git(args) {
  const r = spawnSync('git', ['-c', 'core.quotepath=false', ...args],
    { cwd: ROOT, encoding: 'utf8', timeout: 10000, windowsHide: true });
  return (r.error || r.status !== 0) ? null : String(r.stdout || '');
}

/** 스테이징에 대기열이 있으면 그 blob 을, 없으면 `null`(= 이 커밋의 자리가 아니다). */
function 스테이징본() {
  const 목록 = git(['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR']);
  if (목록 === null) return { 못잼: '스테이징 목록을 못 읽었다 — git 이 답을 안 준다' };
  if (!목록.split('\0').filter(Boolean).includes(좌표)) return { 대상아님: true };
  const 원문 = git(['show', `:${좌표}`]);
  if (원문 === null) return { 못잼: `스테이징된 ${좌표} 를 못 읽었다` };
  return { 원문 };
}

function 작업본() {
  const p = path.join(ROOT, ...좌표.split('/'));
  if (!fs.existsSync(p)) return { 못잼: `${좌표} 가 작업본에 없다` };
  return { 원문: fs.readFileSync(p, 'utf8') };
}

function 보고(argv = []) {
  const 스테이징 = argv.includes('--cached');
  const src = 스테이징 ? 스테이징본() : 작업본();
  if (src.대상아님) return 0;                       // 이 커밋은 대기열을 안 건드린다
  if (src.못잼) { console.error(`[채번] ${src.못잼} — 대조를 **안 했다**(통과가 아니다)`); return 0; }

  const r = 큐.채번(큐.항목들(src.원문));
  const 층 = 스테이징 ? '스테이징' : '작업본';
  if (!r.분모) {
    console.error(`[채번] ${층}에서 열린 줄을 **0건** 셌다 — 위반 없음과 같은 모양이라 초록으로 안 읽는다(파싱을 의심하라 · F207)`);
    return 0;
  }
  if (!r.없음.length && !r.중복.length) return 0;

  console.error(`[채번] ${층} ${좌표} — 열린 ${r.분모}줄 중 규칙 위반 ${r.없음.length + r.중복.length}건 (지금 최대 #Q${r.최대})`);
  /* 처방 번호는 «위반마다 다른 번호»를 준다 — 둘에게 같은 번호를 시키면 그 처방이 다음 충돌이다. */
  let 다음 = r.최대;
  for (const it of r.없음) {
    다음 += 1;
    console.error(`  · 줄${it.줄번호} 「${큐.씨앗(it.본문)}」 에 #Qnn 이 없다 → 차단 표식 바로 뒤에 **#Q${다음}** 를 단다`);
  }
  for (const d of r.중복) {
    다음 += 1;
    console.error(`  · #Q${d.id} 가 줄${d.먼저} ↔ 줄${d.나중} 두 곳에 있다 → **늦게 도입된 쪽**을 **#Q${다음}** 로 옮긴다(지운 번호는 재사용 금지)`);
    console.error(`     어느 쪽이 늦은지: git log -1 --format=%h -L ${d.먼저},${d.먼저}:${좌표} ↔ -L ${d.나중},${d.나중}:${좌표}`);
  }
  console.error('  왜 지금 막나 — 이대로 커밋되면 `tests/대기열점유.test.js` 가 **모든 세션의** CI 를 빨갛게 하고,');
  console.error('                그 적색은 겹친 두 세션 중 누구의 것도 아니라 남의 배포까지 막는다(F461).');
  return 1;
}

module.exports = { 보고, 스테이징본, 작업본 };

if (require.main === module) process.exit(보고(process.argv.slice(2)));
