#!/usr/bin/env node
/**
 * 브라우저열기 — 원격 작업용 화면을 **작업 계정 크롬 프로필**로만 연다.
 *
 * 왜 있나 (유호님 상시 지시 2026-08-11 「앞으로 모든 원격관련 작업은 unmet23@gmail.com 에서 해줘」):
 *   그날 실측하니 원격 통로는 이미 전부 그 계정이었다 — clasp(`unmet23@gmail.com`) ·
 *   구글 드라이브 데스크톱 · gh CLI(`unmet23-lab`). **어긋난 것은 브라우저 하나**였다.
 *   `Start-Process "<url>"` 은 「기본 브라우저」에 맡기는 것이라 어느 프로필이 받을지
 *   호출자가 통제하지 못하고, 그날 실제로 다른 브라우저가 받아 유호님이 로그인부터 다시 했다.
 *
 * 왜 프로즈가 아니라 도구인가:
 *   계정 착오는 이 저장소에서 이미 사고를 냈다(F089 — 77yuhbs 창에서 시트를 열고
 *   「저장 공간 60GB 초과로 앱이 새 파일을 못 만든다」고 오진단 · 작업 계정에서 재니 텅 비어
 *   있었다). 같은 화면, 로그인만 달랐다. 「조심하자」로는 두 번째를 못 막는다.
 *
 * 설계 3:
 *   ① **프로필을 폴더 이름으로 찾지 않는다.** `Profile 2` 는 순서일 뿐이라 프로필을 지우거나
 *      더하면 밀린다 — **계정 이메일로 찾는다**(`Local State` 의 `profile.info_cache`).
 *      유호님이 프로필 표시 이름·색을 바꿔도 계정은 안 바뀌므로 이 축이 유일하게 안정적이다.
 *   ② **못 찾으면 멈춘다.** 기본 브라우저로 폴백하면 그 순간 이 도구의 존재 이유가 사라지고,
 *      「열리긴 했는데 딴 계정」이 된다 — 그게 F089 의 모양이다. 실패는 통과가 아니라 정지로.
 *   ③ **URL 만 받는다.** 프로필·실행 파일을 인자로 받지 않는다(잘못 조준할 여지를 없앤다).
 *
 * 사용:
 *   node tools/브라우저열기.js https://script.google.com/...
 *   node tools/브라우저열기.js --확인            # 어느 프로필로 열리는지만 보고 안 연다
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { 인자게이트 } = require(path.join(__dirname, 'lib', '인자게이트.js'));

/** 작업 계정 — 유호님 확정. 여기 말고 다른 곳에 적지 않는다. */
const 작업계정 = 'unmet23@gmail.com';

const USER_DATA = path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
const 크롬후보 = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

/**
 * `Local State` 내용에서 작업 계정의 프로필 **폴더 이름**을 찾는다.
 * 🔑 순수 함수다 — 파일·프로세스를 안 만져야 회귀가 닿는다(값이 갈리는 자리가 여기다).
 * @param {object} localState 파싱된 Local State
 * @param {string} 계정 찾을 이메일
 * @returns {string|null} 폴더 이름(`Default`·`Profile 2`…) · 없으면 null
 */
function 프로필찾기(localState, 계정) {
  const cache = (localState && localState.profile && localState.profile.info_cache) || {};
  const 목표 = String(계정 || '').trim().toLowerCase();
  if (!목표) return null;
  for (const 폴더 of Object.keys(cache).sort()) {
    const u = String((cache[폴더] || {}).user_name || '').trim().toLowerCase();
    if (u === 목표) return 폴더;
  }
  return null;
}

function 크롬경로() {
  return 크롬후보.find((p) => fs.existsSync(p)) || null;
}

function 프로필폴더() {
  const ls = path.join(USER_DATA, 'Local State');
  if (!fs.existsSync(ls)) return { err: `크롬 사용자 데이터를 못 찾았다: ${ls}` };
  let j;
  try { j = JSON.parse(fs.readFileSync(ls, 'utf8')); }
  catch (e) { return { err: `Local State 를 못 읽었다: ${e.message}` }; }
  const 폴더 = 프로필찾기(j, 작업계정);
  if (!폴더) return { err: `크롬에 ${작업계정} 로 로그인된 프로필이 없다 — 그 계정으로 로그인한 뒤 다시 부른다.` };
  return { 폴더 };
}

function main(argv) {
  const args = argv.slice(2);
  /* 🔑 목록은 눈으로 정하지 않았다 — `CLI도구들()` 이 재고, 회귀 ④ 가 매번 다시 센다.
   * ⚠ 위치 인자(열 주소)는 `--` 로 안 시작하니 안 걸린다 — 아래 `url` 이 그 칸이다. */
  const 아는플래그 = ['--확인'];
  const 플래그오류 = 인자게이트('브라우저열기', args, 아는플래그);
  if (플래그오류) { console.error(`\n🔴 ${플래그오류}\n`); process.exit(1); }
  const 확인만 = args.includes('--확인');
  const url = args.find((a) => !a.startsWith('--'));

  const exe = 크롬경로();
  if (!exe) { console.error('[브라우저열기] ⛔ 크롬을 못 찾았다 — 원격 작업은 크롬 작업 계정에서만 연다(유호 상시 08-11).'); process.exit(2); }

  const r = 프로필폴더();
  if (r.err) { console.error('[브라우저열기] ⛔ ' + r.err); process.exit(2); }

  if (확인만) { console.log(`[브라우저열기] ${작업계정} ▸ 프로필 폴더 "${r.폴더}" (열지 않았다)`); return; }
  if (!url) { console.error('[브라우저열기] 열 주소를 달라. 예: node tools/브라우저열기.js https://github.com/settings'); process.exit(1); }
  if (!/^https?:\/\//i.test(url)) { console.error('[브라우저열기] http(s) 주소만 연다: ' + url); process.exit(1); }

  const child = spawn(exe, [`--profile-directory=${r.폴더}`, url], { detached: true, stdio: 'ignore' });
  child.unref();
  console.log(`[브라우저열기] ✅ ${작업계정}(${r.폴더}) 로 열었다 — ${url}`);
}

if (require.main === module) main(process.argv);
module.exports = { 프로필찾기, 작업계정 };
