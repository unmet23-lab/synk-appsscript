#!/usr/bin/env node
/**
 * 승인키 — 승인을 커밋 SHA에 묶고, 그 SHA의 파일이 바뀌면 스스로 죽게 한다.
 *
 * 왜 있나 — 「검수했다」·「승인했다」는 대상이 밀린다(CLAUDE.md 「승인은 행위에 대한 것이지
 *   조준이 아니다」). 문서에 적힌 승인은 코드가 바뀌어도 그대로 살아 있는 것처럼 보인다.
 *   승인을 SHA에 묶으면 **코드가 바뀌는 순간 승인이 물리적으로 무효**가 되고,
 *   그 판정을 사람이 기억할 필요가 없어진다.
 *
 * 새 장부를 만들지 않는다 — 기록은 커밋 트레일러이고, 조회는 `git log`다.
 *   (prepare-commit-msg 훅이 `Session-Id`를 박는 바로 그 자리)
 *
 *   node tools/승인.js add <종류> <sha> ["사유"]   트레일러 한 줄을 만들어 준다
 *   node tools/승인.js check [--json]              살아있는 승인 / 죽은 승인
 *
 * 종류 = semantic(의미 보존 · 클로드) | technical(기술 실행 가능 · GPT) | owner(운영 적용 · 유호님)
 */
'use strict';
const { execFileSync } = require('child_process');
const { 인자게이트 } = require('./lib/인자게이트.js');

const 종류들 = ['semantic', 'technical', 'owner'];
const 트레일러 = /^Approves-([A-Za-z]+):\s*([0-9a-f]{7,40})\b\s*(.*)$/;

// 커밋 메시지에는 무엇이든 들어간다 — 줄바꿈으로 쪼개면 본문이 통째로 깨진다.
// 필드는 \x1f, 레코드는 \x1e 로 가른다(둘 다 사람이 타이핑할 수 없는 제어문자).
const FS = '\x1f';
const RS = '\x1e';

// 🔴 `-c core.quotepath=false` 는 장식이 아니다 — 없으면 `git show --name-only` 가 한글 경로를
//    `"\352\263\204…"` 로 돌려주고, 그 문자열로 `git log -- <경로>` 를 하면 **아무것도 안 걸려**
//    모든 승인이 조용히 「유효」가 된다(새는 방향은 언제나 통과다 · tests/승인.test.js 가 잡았다).
//    repo 설정은 바꾸지 않는다 — 다른 도구·CI가 그 설정에 얹혀 있다(🚫quotepath 변경).
const git = (...args) => execFileSync('git', ['-c', 'core.quotepath=false', ...args], { encoding: 'utf8' }).trim();

/** 커밋 본문에서 승인 트레일러를 뽑는다. 파싱만 하는 순수 함수(테스트가 여기 걸린다). */
function 트레일러파싱(본문) {
  return (본문 || '').split(/\r?\n/).reduce((모음, 줄) => {
    const m = 트레일러.exec(줄.trim());
    if (m && 종류들.includes(m[1].toLowerCase())) {
      모음.push({ 종류: m[1].toLowerCase(), 대상: m[2], 사유: m[3].trim() });
    }
    return 모음;
  }, []);
}

/** 승인 이후 그 커밋이 만진 경로가 또 바뀌었나 = 승인 소멸 여부 */
function 소멸판정(대상sha, 승인커밋) {
  let 경로;
  try {
    경로 = git('show', '--name-only', '--format=', 대상sha).split('\n').filter(Boolean);
  } catch {
    return { 상태: '불명', 사유: `대상 커밋 ${대상sha} 를 찾을 수 없다(rebase·미fetch)` };
  }
  if (!경로.length) return { 상태: '유효', 사유: '변경 경로 0(빈 커밋)' };

  const 이후 = git('log', '--format=%H', `${대상sha}..HEAD`, '--', ...경로)
    .split('\n').filter((h) => h && h !== 승인커밋);

  return 이후.length
    ? { 상태: '소멸', 사유: `승인 뒤 같은 경로가 ${이후.length}회 더 바뀌었다`, 이후 }
    : { 상태: '유효', 사유: '승인 뒤 해당 경로 변경 0' };
}

function 수집(개수 = 300) {
  const raw = git('log', `-${개수}`, `--format=%H${FS}%s${FS}%b${RS}`);
  return raw.split(RS).flatMap((덩어리) => {
    const [sha, 제목, 본문] = 덩어리.replace(/^\r?\n/, '').split(FS);
    if (!sha || !/^[0-9a-f]{40}$/.test(sha.trim())) return [];
    return 트레일러파싱(본문).map((t) => ({ ...t, 승인커밋: sha.trim(), 제목 }));
  });
}

function check(json) {
  const 목록 = 수집().map((a) => ({ ...a, ...소멸판정(a.대상, a.승인커밋) }));
  if (json) { console.log(JSON.stringify(목록, null, 2)); return 목록; }

  if (!목록.length) {
    console.log('[승인] 승인 트레일러 0건.');
    console.log('  다는 법: 커밋 메시지 끝에  Approves-semantic: <sha> 사유');
    return 목록;
  }
  const 죽음 = 목록.filter((a) => a.상태 !== '유효');
  console.log(`[승인] ${목록.length}건 · 유효 ${목록.length - 죽음.length} · 주의 ${죽음.length}\n`);
  for (const a of 목록) {
    const 표 = a.상태 === '유효' ? '✅' : a.상태 === '소멸' ? '⛔' : '❔';
    console.log(`${표} ${a.종류.padEnd(9)} ${a.대상.slice(0, 8)}  ${a.사유}`);
    if (a.상태 !== '유효') console.log(`     승인한 커밋 ${a.승인커밋.slice(0, 8)} — ${a.제목}`);
  }
  if (죽음.length) {
    console.log('\n⛔ 소멸한 승인은 「없는 것」이다 — 다시 받기 전에는 그 위에서 배포·동결하지 않는다.');
    process.exitCode = 1;   // 조용히 지나가지 않게
  }
  return 목록;
}

function add(종류, sha, 사유) {
  if (!종류들.includes(종류)) {
    console.error(`[승인] 종류는 ${종류들.join('·')} 중 하나여야 한다 (받은 값: ${종류})`);
    process.exit(1);
  }
  // 짧은 sha·태그·HEAD~2 전부 여기서 확정된다. `--verify --end-of-options` 가 없으면 `--help`
  // 같은 인자가 git 옵션으로 먹혀 Windows 에서 브라우저가 열린다(F191 · 같은 구멍의 다른 입구).
  const full = git('rev-parse', '--verify', '--end-of-options', sha);
  console.log(`Approves-${종류}: ${full} ${사유 || ''}`.trim());
  console.error('\n(위 한 줄을 커밋 메시지 끝에 붙인다 — 커밋이 곧 승인 기록이다)');
}

if (require.main === module) {
  /* 🔑 하위 명령(`add`·`check`)과 그 값은 위치 인자다. `--json` 만 낱말로 받는다. */
  const 아는플래그 = ['--json'];
  const 플래그오류 = 인자게이트('승인', process.argv.slice(2), 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); process.exit(1); }
  const [, , 명령, ...나머지] = process.argv;
  if (명령 === 'add') add(나머지[0], 나머지[1], 나머지.slice(2).join(' '));
  else if (명령 === 'check' || !명령) check(나머지.includes('--json'));
  else console.error('사용법: 승인.js add <종류> <sha> ["사유"]  |  승인.js check [--json]');
}

module.exports = { 트레일러파싱, 소멸판정, 수집, 종류들 };
