'use strict';
/* 바탕화면 실경로 — 이 저장소에서 바탕화면을 찾는 **단 하나의 통로**.
 *
 * 왜 모듈인가 (2026-08-10 분리 반박 패스 M3 발견 · CLAUDE.md 신뢰성 「3번째 = 원인을 쓸 수 없게 만든다」):
 *   같은 탐지가 세 파일에 흩어져 있었다 — `철학열람빌드`·`교재읽기본` 은 **글자 단위 사본**,
 *   `운영자료` 는 PowerShell `[Environment]::GetFolderPath('Desktop')` 로 **다른 방식**.
 *   회귀는 운영자료 쪽만 물어서, OneDrive 리디렉션이 바뀌는 날 셋이 서로 다른 폴더를
 *   가리켜도 아무 데도 빨갛지 않았다. 그래서 호출부마다 고치지 않고 **옛 통로를 못 쓰게** 만든다
 *   (`tests/바탕화면통로.test.js(⚠삭제됨 e75fc7fc 2026-08-19 — 지금 없다)` 가 tools/ 안의 직접 조회를 금지한다).
 *
 * 방식 판정 (2026-08-10 실측 — 유호님 지시대로 「갈리는 케이스」를 먼저 쟀다):
 *   레지스트리와 GetFolderPath 는 이 기계에서 **같은 값**을 낸다(둘 다 `C:\Users\q1212\OneDrive\Desktop`).
 *   .NET 의 GetFolderPath 도 결국 이 레지스트리를 backing store 로 읽기 때문이다 —
 *   **갈리는 자리는 정상 경로가 아니라 폴백**이다(reg 실패 vs powershell 실패는 서로 다른 날 터진다).
 *   정본을 레지스트리로 둔다: reg.exe 1회가 powershell 기동보다 싸고, 셋 중 둘이 이미 그 방식이다.
 *   폴백을 썼는지는 삼키지 않고 `폴백` 으로 **드러낸다**(F044 — 실제로 일하는 건 폴백이다).
 *
 * 왜 「경로를 상수로 쓰면 안 되나」 (2026-08-09 실사고 · 회귀 승계 대상):
 *   OneDrive 백업이 켜져 있으면 진짜 바탕화면은 `OneDrive\Desktop` 이고, `USERPROFILE\Desktop` 은
 *   **존재하고 Test-Path 가 True 인** 껍데기로 남는다. 그 자리에 폴더를 만들고 「바탕화면에 넣었습니다」로
 *   보고했다(유호님이 "안 보이는데?"로 잡음). 그래서 후보 사슬은 레지스트리를 **맨 앞**에 둔다.
 *
 * ⚠ require 부작용 0 — 최상위에서 아무것도 조회하지 않는다(철학열람빌드 회귀가 이 모듈을 require 한다).
 * ⚠ 탐지력은 픽스처가 진다 — `확장`·`후보사슬` 은 순수 함수고, `찾기` 는 `실존` 을 주입받는다.
 *   repo 밖 환경(진짜 레지스트리·진짜 바탕화면)에 기대는 검사는 CI 에서 skip 으로 드러낸다.
 */
const fs = require('fs');
const path = require('path');
const os = require('node:os');

/** Explorer 가 실제로 읽는 값이 사는 자리. 이 문자열은 여기 한 번만 적힌다. */
const 레지키 = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders';

/** `reg query` 출력에서 Desktop 값을 뽑고 `%VAR%` 를 확장한다. 순수 함수 — 못 뽑으면 null. */
function 확장(reg출력, env = process.env) {
  const m = String(reg출력 || '').match(/Desktop\s+REG_(?:EXPAND_)?SZ\s+(.+)/);
  if (!m) return null;
  /* 값 안의 %OneDrive% 같은 자리는 **이 프로세스의** 환경으로 편다.
   * 🔴 하나라도 못 펴면 값 전체를 버린다 — 빈 문자열로 갈음하면 `%없는변수%\Desktop` 이
   * `\Desktop`(현재 드라이브 루트의 상대경로)로 남는다. 그게 우연히 존재하는 기계에서는
   * **엉뚱한 폴더가 「바탕화면」이 되고, 산출물은 유호님 화면에 안 보인다** — 08-09 사고의 재판이다. */
  let 못편것 = null;
  const 값 = m[1].trim().replace(/%([^%]+)%/g, (_, v) => {
    if (!env[v]) { 못편것 = v; return ''; }
    return env[v];
  });
  if (못편것 || !값) return null;
  return 값;
}

/** 레지스트리 정본 조회. 못 읽으면 null 을 주고 **폴백 판단은 사슬에 맡긴다**(여기서 삼키지 않는다). */
function 레지스트리조회(env = process.env) {
  if (process.platform !== 'win32') return null; // 바탕화면 리디렉션은 Windows 셸 개념이다
  try {
    const { execFileSync } = require('child_process');
    const out = execFileSync('reg', ['query', 레지키, '/v', 'Desktop'], {
      encoding: 'utf8',
      windowsHide: true,
    });
    return 확장(out, env);
  } catch {
    return null; // reg 가 없거나 값이 없다 — 아래 환경변수 후보로 내려간다
  }
}

/** 후보 사슬: 레지스트리(정본) → OneDrive → 홈. 순수 함수 — 중복은 접는다. */
function 후보사슬(정본, env = process.env, 홈 = os.homedir()) {
  const 후보 = [];
  const 담기 = (p) => {
    if (p && !후보.includes(p)) 후보.push(p);
  };
  담기(정본);
  if (env.OneDrive) 담기(path.join(env.OneDrive, 'Desktop'));
  const 프로필 = env.USERPROFILE || 홈;
  if (프로필) 담기(path.join(프로필, 'Desktop'));
  return 후보;
}

/**
 * 바탕화면을 찾는다.
 * @returns {{경로: string|null, 폴백: boolean, 존재: boolean, 후보: string[]}}
 *   `폴백: true` = 레지스트리 정본이 아닌 자리를 골랐다 → **여기가 유호님 화면이 맞는지 눈으로 확인해야 한다**.
 *   `존재: false` = 후보 중 실존하는 게 없다 → 경로는 첫 후보(추측)다. 던질지는 호출부가 정한다.
 *
 * `실존`·`조회` 는 회귀가 주입한다 — 안 그러면 픽스처가 **이 기계의 진짜 레지스트리**에 오염돼
 * 사슬 순서를 재는 검사가 기계마다 다른 답을 낸다(2026-08-10 실측: 픽스처가 그 자리에서 빨개졌다).
 */
function 찾기({ env = process.env, 실존 = (p) => fs.existsSync(p), 조회 = 레지스트리조회 } = {}) {
  const 정본 = 조회(env);
  const 후보 = 후보사슬(정본, env);
  for (const c of 후보) {
    if (실존(c)) return { 경로: c, 폴백: c !== 정본, 존재: true, 후보 };
  }
  return { 경로: 후보[0] || null, 폴백: true, 존재: false, 후보 };
}

/** 실존하는 바탕화면만 준다. 못 찾으면 조용히 추측하지 않고 던진다(빌드 산출물이 「없는 곳」에 나가면 안 된다). */
function 경로(opt) {
  const r = 찾기(opt);
  if (!r.존재) throw new Error('바탕화면을 못 찾았다: ' + r.후보.join(' | '));
  return r.경로;
}

module.exports = { 찾기, 경로, 확장, 후보사슬, 레지스트리조회, 레지키 };
