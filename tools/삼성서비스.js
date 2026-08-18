#!/usr/bin/env node
/* 삼성 서비스 15개 — 「꺼둔 것이 되살아났나」를 재는 도구 (2026-08-12 · local_e7981eca)
 *
 * 왜 파일로 있나
 *   08-12 에 유호님 승인으로 삼성 서비스 15개를 `Start=4`(사용 안 함)로 껐다. 되돌리는 방법은
 *   **세션 스크래치패드의 `되돌리기.ps1` 한 장**뿐이었다 — 세션 temp 폴더라 언제든 사라진다.
 *   그리고 이 검사는 **재부팅할 때마다** 다시 필요하다: 삼성 패키지는 드라이버 업데이트를
 *   설치하며 제 서비스를 도로 켜는 일이 있어서, 「껐다」가 다음 부팅에 조용히 뒤집힌다.
 *   손으로 15번 레지스트리를 여는 대신 여기 한 벌로 모은다(CLAUDE.md 「반복 손일은 시스템으로」).
 *
 * 🔑 이 도구는 **읽기만 한다.** 레지스트리 쓰기(=시스템 설정 변경)는 관리자 권한이 필요하고
 *   유호님이 직접 실행하는 자리다. `--처방` 이 되돌릴 줄만 골라 그대로 붙여넣을 명령을 낸다.
 *
 * ⚠ 「없음」을 「꺼져 있음」으로 세지 않는다 — 키를 못 읽은 것과 4인 것은 다른 사실이다(F207:
 *   초록은 분모와 함께 읽는다). 표 맨 아래에 몇 개를 실제로 읽었는지 항상 같이 낸다.
 *
 *   node tools/삼성서비스.js          → 15개 현재 상태 표
 *   node tools/삼성서비스.js --처방    → 되살아난 것만 골라 되돌리는 명령
 */
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

/** 08-12 에 끈 15개. 원래 값은 **전부 2(자동)** 였다 — 되돌리려면 2, 다시 끄려면 4. */
const 서비스들 = [
  'Samsung Intelligence Service',
  'Samsung Multi Control Service',
  'SamsungContinuityWindowsService',
  'SamsungQuickShareService',
  'SamsungCameraShareService',
  'SamsungStorageShareService',
  'SmartSwitchService',
  'GalaxyBookSmartSwitchService',
  'DqaService',
  'SamsungAnalyticsService',
  'LiveWallpaperService',
  'Quick Search Service',
  'sService Agent Launcher',
  'sServiceLoopBack',
  'SamsungHQMService',
];

const 끔 = 4;
const 뜻 = { 0: '부팅', 1: '시스템', 2: '자동', 3: '수동', 4: '사용 안 함' };

/**
 * `reg query … /v Start` 의 출력에서 Start 값을 뽑는다. 못 찾으면 null.
 *
 * ⚠ 값 이름은 **정확히 `Start`** 여야 한다 — `StartOverride` 같은 형제 값이 같은 키에 있고,
 *   느슨하게 찾으면 엉뚱한 값을 서비스 시작 유형이라고 읽는다(그 오독은 「통과」로 보인다).
 * ⚠ 한국어 Windows 의 reg.exe 오류문은 CP949 라 utf8 로 읽으면 깨진다. 그래서 **오류문을
 *   글자로 판별하지 않는다** — ASCII 인 Start 줄이 있느냐만 본다(F045 「재는 층이 값을 깨뜨리지 않는지」).
 */
function Start값파싱(stdout) {
  const m = /^[ \t]*Start[ \t]+REG_DWORD[ \t]+0x([0-9a-fA-F]+)[ \t]*$/m.exec(String(stdout || ''));
  return m ? parseInt(m[1], 16) : null;
}

/** 한 서비스를 읽는다. { 값, 읽음 } — 읽음=false 면 키가 없거나 못 읽은 것이다. */
function 읽기(이름) {
  let out;
  try {
    out = execFileSync('reg', ['query', `HKLM\\SYSTEM\\CurrentControlSet\\Services\\${이름}`, '/v', 'Start'],
      { encoding: 'latin1', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (_) {
    return { 값: null, 읽음: false };            // 키 없음(제거됨) 또는 접근 불가
  }
  const v = Start값파싱(out);
  return { 값: v, 읽음: v !== null };
}

/** 한 줄의 판정. 되돌릴 대상인지(`되돌릴것`)를 여기 한 곳에서만 정한다. */
function 판정({ 값, 읽음 }) {
  if (!읽음) return { 표식: '❔', 말: '키 없음 — 제거됐거나 못 읽음', 되돌릴것: false };
  if (값 === 끔) return { 표식: '✅', 말: '사용 안 함 유지', 되돌릴것: false };
  return { 표식: '🔴', 말: `되살아남 (${뜻[값] || `Start=${값}`})`, 되돌릴것: true };
}

/** 전체를 재고 행 배열을 낸다. 순수하게 읽기만 한다. */
function 재기(목록 = 서비스들) {
  return 목록.map((이름) => {
    const r = 읽기(이름);
    return { 이름, ...r, ...판정(r) };
  });
}

function 처방(행들) {
  const 대상 = 행들.filter((r) => r.되돌릴것);
  if (!대상.length) return null;
  return 대상
    .map((r) => `Set-ItemProperty -LiteralPath "HKLM:\\SYSTEM\\CurrentControlSet\\Services\\${r.이름}" -Name Start -Value ${끔}`)
    .join('\n');
}

function 본문() {
  /* 🔑 목록은 눈으로 정하지 않았다 — `CLI도구들()` 이 재고, 회귀 ④ 가 매번 다시 센다.
   * ⚠ 종료 코드를 **돌려주는** 꼴이라 `process.exit` 를 여기서 부르지 않는다. */
  const 아는플래그 = ['--처방'];
  const 플래그오류 = 인자게이트('삼성서비스', process.argv.slice(2), 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); return 1; }
  const 처방만 = process.argv.includes('--처방');
  const 행들 = 재기();

  const 폭 = Math.max(...행들.map((r) => r.이름.length));
  console.log('삼성 서비스 — 껐던 15개의 현재 시작 유형 (기대: 사용 안 함 = Start 4)\n');
  for (const r of 행들) {
    const 값 = r.읽음 ? String(r.값) : '-';
    console.log(`  ${r.표식} ${r.이름.padEnd(폭)}  Start=${값.padStart(2)}  ${r.말}`);
  }

  const 읽은수 = 행들.filter((r) => r.읽음).length;
  const 되돌릴 = 행들.filter((r) => r.되돌릴것);
  console.log(`\n  분모: ${서비스들.length}개 중 **${읽은수}개를 실제로 읽었다** (못 읽은 ${서비스들.length - 읽은수}개는 「꺼짐」이 아니라 「모름」이다).`);
  console.log(`  되살아난 것: ${되돌릴.length}개`);

  const 명령 = 처방(행들);
  if (!명령) {
    console.log('\n  ▶ 할 일 없음 — 전부 그대로 꺼져 있다.');
    return 0;
  }
  console.log('\n  ▶ 되돌리려면 — **관리자 권한 PowerShell**(시작 → PowerShell 우클릭 → 관리자 권한으로 실행)에 그대로 붙여넣기:');
  if (!처방만) console.log('    (명령만 보려면: node tools/삼성서비스.js --처방)');
  console.log('\n' + 명령.split('\n').map((l) => '    ' + l).join('\n') + '\n');
  console.log('  붙여넣고 나서 이 도구를 다시 돌리면 전부 ✅ 여야 한다.');
  return 0;
}

module.exports = { 서비스들, 끔, Start값파싱, 판정, 처방, 재기 };

if (require.main === module) process.exit(본문());
