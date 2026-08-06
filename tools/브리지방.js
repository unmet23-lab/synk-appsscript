#!/usr/bin/env node
// 브리지방 — Claude in Chrome 이 안 붙을 때 **어느 방에 있는지** 1초에 가른다
//
// 왜 있나 (5번째 재발 · 2026-08-06):
//   증상은 언제나 같다 — `list_connected_browsers` 가 `[]` 인데 확장은 설치·로그인·사이드패널
//   전부 정상이다. 화면으로는 아무 이상이 없어서 **「확장을 다시 깔아보세요」로 헛돌기** 쉽고,
//   실제로 그렇게 3분씩 태웠다(08-04 기록).
//
//   🔑 브리지는 네이티브 메시징이 아니라 **클라우드 릴레이**이고, 방 주소가 곧 **계정 UUID** 다:
//        wss://bridge.claudeusercontent.com/chrome/<accountUuid>
//      앱과 확장이 **같은 UUID** 여야 서로를 본다. 계정을 갈아타면 확장은 「마지막으로 온보딩한
//      계정」의 방에 남고, 새 세션은 다른 방에 선다 — 둘 다 릴레이에 붙어 있는데 영원히 못 만난다.
//
//   ☠️ **이메일이 같아서 화면으로는 구별이 안 된다**(전부 unmet23@gmail.com).
//      「참인 채 거짓을 말하는」 형태라, **판정은 UUID 로만** 한다. 그게 이 도구다.
//
// 성격: **읽기 전용.** LevelDB 파일을 열어 문자열만 훑는다. 아무것도 쓰지 않는다.
//       (확장이 돌고 있어도 안전하다 — 잠긴 파일은 건너뛴다.)
//
// 쓰는 법:  node tools/브리지방.js
//
// ⚠ 처방(확장 재온보딩)은 **공유 자원 조작**이다 — 방은 하나뿐이라, 재온보딩하면 다른 계정으로
//   돌고 있는 세션들의 브리지가 끊긴다. 세션이 혼자 정하지 않는다(유호님 판단).
//   브라우저가 꼭 필요한 일이 아니면 **유호님이 그 화면을 직접 1회 조작하는 쪽이 대개 더 싸다.**
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const 확장ID = 'fcoeoabgfenejglbffodgkkbkcdhcgfn';
const UUID정규 = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

/** LevelDB 덤프에서 UUID 별 등장 횟수 — 이 저장소가 실제로 물고 있는 방을 빈도로 가른다.
 *  (설정 한 번에 여러 번 적히므로 **최빈값이 곧 현재 방**이다. 1회짜리는 스쳐간 값이다.) */
function UUID빈도(텍스트) {
  const 횟수 = new Map();
  for (const m of 텍스트.match(UUID정규) || []) 횟수.set(m, (횟수.get(m) || 0) + 1);
  return 횟수;
}

function 내계정UUID() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(os.homedir(), '.claude.json'), 'utf8'));
    return (j.oauthAccount && j.oauthAccount.accountUuid) || null;
  } catch { return null; }
}

function 확장저장소() {
  const base = process.env.LOCALAPPDATA;
  if (!base) return null;
  const p = path.join(base, 'Google', 'Chrome', 'User Data', 'Default', 'Local Extension Settings', 확장ID);
  return fs.existsSync(p) ? p : null;
}

function 진단() {
  const 내방 = 내계정UUID();
  const 저장소 = 확장저장소();
  if (!저장소) return { 내방, 상태: '확장저장소없음' };

  let 합본 = '';
  let deviceId = false;
  for (const f of fs.readdirSync(저장소)) {
    try {
      const s = fs.readFileSync(path.join(저장소, f)).toString('latin1');
      if (/bridgeDeviceId/.test(s)) deviceId = true;
      합본 += s;
    } catch { /* 잠긴 파일 — 확장이 쓰는 중이다. 건너뛴다(부분만 봐도 최빈값은 안 뒤집힌다) */ }
  }
  const 횟수 = UUID빈도(합본);
  const 정렬 = [...횟수.entries()].sort((a, b) => b[1] - a[1]);
  return { 내방, 상태: '읽음', deviceId, 정렬, 내방횟수: (내방 && 횟수.get(내방)) || 0 };
}

if (require.main === module) {
  const r = 진단();
  console.log('[브리지방] 내 세션 계정 UUID :', r.내방 || '(못 읽음)');
  if (r.상태 === '확장저장소없음') {
    console.log('  ❌ 확장 저장소가 없다 — 확장 미설치이거나 **다른 Chrome 프로필**이다.');
    console.log('     설치: https://chromewebstore.google.com/detail/' + 확장ID);
    process.exit(0);
  }
  console.log('  확장이 물고 있는 방 (빈도순 · 최빈값이 현재 방):');
  for (const [u, n] of r.정렬.slice(0, 6)) {
    console.log('    ' + u + '  ×' + n + (u === r.내방 ? '   ← 내 방' : ''));
  }
  console.log('  bridgeDeviceId :', r.deviceId ? '발급됨(접속 시도함)' : '❌ 없음 = 접속 시도조차 없었다');
  console.log('');
  if (r.내방횟수 > 0) {
    console.log('판정 → 방은 맞다. 다른 원인을 본다 — 온보딩 미통과 · 탭이 hidden(팝오버가 안 열린다).');
  } else {
    console.log('판정 → 🔴 **다른 계정의 방에 있다.** 내 UUID 가 확장 저장소에 0회 =');
    console.log('        확장은 이 계정으로 접속을 **시도한 적이 없다**. 재설치는 이걸 안 고친다.');
    console.log('        고치려면: 확장 로그아웃 → 재로그인 → **사이드 패널 온보딩까지 통과**');
    console.log('        ⚠ 단 그건 공유 자원 조작이다 — 다른 계정 세션들의 브리지가 끊긴다.');
    console.log('        브라우저가 꼭 필요한 일이 아니면 유호님이 그 화면을 직접 1회 여는 쪽이 싸다.');
  }
}

module.exports = { UUID빈도, 진단 };
