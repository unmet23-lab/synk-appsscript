# 홈페이지부터 내 홈·종료까지 · 2026-10-08

후속 「이어서 해」에서 실제 회원 OAuth 연결·내 홈·새로고침·제품 로그아웃·재로그인 확인을 마쳤다. 개발 중인 계정 이어쓰기 메모의 종료 보호도 원본에 연결했다. 아래는 최초 공개 시점의 기록이며, 최신 후속 범위·새 설치/공개 여부는 [회원 흐름·초안 보호 기록](../platform-continuity-exit-20261008/README.md)을 따른다.

사용자 요청: SYNK를 켜는 순간부터 끄는 순간까지 편안하고 간편한 경험으로 발전시킨다. 대상은 통합 플랫폼과 홈페이지이며, 경험 시안과 우선 개선 묶음에 대해 「오케이. 전부 이어서 진행해.」로 구현을 승인했다.

후속 요청으로 **현재 PC의 Platform·WORLD·Messenger Preview를 업데이트하고, 홈페이지와 웹 내 홈을 공개했다.** 기존 OAuth 등록에 공개 플랫폼 복귀 주소를 추가했으며 실제 공개 홈페이지→내 홈→공급자 인가→SYNK ID 로그인 화면→복귀를 확인했다. 이번 수정의 실제 회원 로그인·실물 두 기기 검증은 하지 않았다. 기존 미커밋 작업과 사용자 프로필을 보존했다.

## PC 설치 반영 · 2026-10-08 21:54~21:59 KST

- 고정 후보: `desktop/artifacts/experience-install-scoped-2026-10-08T12-48-40-546Z`, sourceHash `3079b9ed56ad8c64620327fed3ad911331732a86e4abb2de5f455617ffe40033`, 실행 원본 84파일. 별도 작업에서 개발 중인 계정 라이브러리 동기화 연결은 이 사본에서만 제외했고 공용 소스는 유지했다.
- 고정 소스 전체 **265/265**, native 사용자 흐름 **32/32**, 실제 ASAR 사용자 흐름 **32/32** 통과. ASAR의 첫 고정 대기 검사 실패는 원문 보존 후 QA를 close 이벤트 완료 대기로 고쳐 재검증했다. 제품 파일은 바꾸지 않았다.
- 사용자가 「작성 중인 내용 없음 — 업데이트 진행」으로 확인했다. 기존 Platform 창을 정상 종료하고 WORLD 67·Messenger 83·Platform 102파일을 현재 사용자와 SYSTEM만 접근하는 백업에 보존했다. 21:54~21:55에 세 설치 파일을 `/S /currentuser`로 실행해 모두 종료 코드 0이었다.
- 설치된 EXE·ASAR·84원본·인증 설정 9종·동봉 자식 설치 파일·등록·바로가기를 대조했다. 설치 직후와 격리 검사 뒤에 원래 프로필 해시가 모두 동일했다. [설치 결과](../../../../desktop/artifacts/experience-install-scoped-2026-10-08T12-48-40-546Z/artifacts/update-install-results.json), [설치 파일 대조](../../../../desktop/artifacts/experience-install-scoped-2026-10-08T12-48-40-546Z/artifacts/installed-update-verification.json), [검사 뒤 프로필 보존](../../../../desktop/artifacts/experience-install-scoped-2026-10-08T12-48-40-546Z/artifacts/profile-post-qa.json).
- 변경하지 않은 설치 EXE를 격리 프로필에서 실행해 인증 준비·로그아웃 상태, 암호화 저장 왕복, 외부 요청·콘솔 오류 0을 확인했다. 첫 캡처의 `UnknownVizError`는 실패 기록으로 남겼고 같은 파일의 순차 재검사가 통과했다. [격리 실행](../../../../desktop/artifacts/experience-install-scoped-2026-10-08T12-48-40-546Z/artifacts/platform-installed-boot-2026-10-08T12-58-44-643Z.json).
- 21:59 KST 원래 사용자 프로필의 Platform을 다시 열어 PID 47072의 `SYNK Platform` 창 표시를 확인했다. 로그인·개인 기록 작성은 수행하지 않았다. [일반 실행](../../../../desktop/artifacts/experience-install-scoped-2026-10-08T12-48-40-546Z/artifacts/platform-normal-launch.json).

개인 PC의 개발용 Preview 업데이트다. 정식 서명·설치 파일 공개나 WORLD 서버 운영 복구를 뜻하지 않는다.

## 홈페이지와 웹 내 홈 공개 · 2026-10-08 22:17 KST

고정 작업본 `.tmp/entry-home-release-20261008/policy`에서 공개 기준 `37e70c7`에 홈페이지 8파일, 새 `account/` 36파일, `id/config.json` 1파일만 합쳐 **`05be3a5d5c2fbe23eca384469270652ed443cbaa`를 main에 일반 push**했다. 홈페이지 HTML 3파일은 이번 조각을 역변환하면 기존 공개 바이트와 같다. 공급자의 기존 platform browser에 `https://synk.im/account/client.html?product=platform` 복귀 주소 하나를 추가하고 재조회해 확인했다. 기존 loopback 주소·21개 등록·제품 매핑은 유지됐다. [운영 등록 결과](../../../../.tmp/synk-id/platform-public-applied/plan.json).

- [홈페이지](https://synk.im/)의 **바로 시작**은 체험 목록으로, **내 홈**은 [공개 플랫폼](https://synk.im/account/platform.html#home)으로 이어진다. 영어 첫 화면과 Atlas에도 같은 홈 입구가 있다.
- Pages [37782933115](https://github.com/unmet23-lab/synk-policy/actions/runs/37782933115)는 22:17 KST 성공 완료했다. 실제 공개 45파일 HTTP 200·원시 SHA-256이 검증한 후보와 모두 같았다. [공개 파일 확인](../../../../.tmp/platform-public-release-20261008-v2/live-files.json).
- 새 익명 Chrome에서 홈페이지·영문·Atlas × 320/390/1280px **9조건**의 내 홈 왕복, 한영 × 3폭 **6조건**의 첫 방문·설정·재방문·해제를 통과했다. 가로 넘침·JS 오류·누락 파일 0. [공개 브라우저](../../../../../SYNK-website/qa/entry-start-20261008/release/live-browser/verification.md).
- 실제 공개 플랫폼의 로그인 버튼으로 공급자 인가와 정확한 HTTPS callback·PKCE S256을 거쳐 중앙 SYNK ID 로그인 폼에 도착하고 내 홈으로 돌아오는 **8/8**을 통과했다. 요청을 가로채거나 응답을 모의하지 않았고 계정·비밀번호는 입력하지 않았다. [공개 OAuth 시작·복귀](../../../../.tmp/platform-public-release-20261008-v2/live-auth/result.json).
- 공통 `synk.im 배포 점검` [37782931868](https://github.com/unmet23-lab/synk-policy/actions/runs/37782931868)도 **22:27 KST 첫 실행 성공**했다. 변경45파일, 공개 문구3228파일, 페이지23쪽 × 2화면, 게임8개 × 2화면, 질문창까지 통과했다. [실행 결과](../../../../../SYNK-website/qa/entry-start-20261008/release/site-check-result.json), [로그](../../../../../SYNK-website/qa/entry-start-20261008/release/site-check.log).

동결 웹 회귀 **52/52**, 홈 브라우저 **37/37**, 로그인 시작·취소·복귀 **19/19**, OAuth 등록 변경 보호 **10/10**을 통과했다. 홈페이지 전체 **444/444**, `/`·`/en/`·`/atlas/` × 320·390·1280px에서 실제 내 홈 클릭·게스트 렌더·뒤로가기 **9조건**을 통과했다. 누락 자산·자바스크립트 오류·가로 넘침은 없었다. 로그인 요청 검사는 공급자 인가 끝점을 가로채 확인했으며 실제 회원 로그인 증거와 구분한다. [45파일 명세](../../../../../SYNK-website/qa/entry-start-20261008/release/combined-manifest.json), [연결 검사](../../../../../SYNK-website/qa/entry-start-20261008/release/home-browser/browser.json), [공개 웹 사본](../../../../.tmp/platform-public-release-20261008-v2/manifest.json).

공식 Claude Code 2.1.292에 `--model claude-opus-5-5 --effort max`를 명시했으나 세션 사용량 제한(429, `modelUsage: {}`, exit 1)으로 검수하지 못했다. 재개 안내는 10월 9일 00:00 KST였다. [실제 응답](../../../../../SYNK-website/qa/entry-start-20261008/release/claude-entry-review-result.json). 검수 규정과 정확한 공개 범위를 설명한 뒤 사용자가 **「웅 진행해.」**로 이번 공개에 한한 예외를 승인했다. 이 승인으로 위 45파일과 복귀 주소 한 개를 반영했으며 일반 검수 원칙이나 다른 작업에 예외를 확대하지 않는다. 정상 Claude 검수는 수행되지 않았다.

## 달라진 흐름

| 순간 | 구현 | 확인 범위 |
|---|---|---|
| 홈페이지 입장 | 처마·싱ㅋ 아래와 공통 메뉴의 **바로 시작**이 실제 무료 체험 목록으로 연결된다. 사용자가 선택하면 다음 기본 주소 방문에 체험 목록부터 연다. 첫 화면 복귀·설정 해제도 가능하다. | 한영 320/390/1280px, 키보드, 저장 차단, 명시적 주소 우선, 움직임 감소·고대비·JS 없는 진입 |
| 웹의 내 홈 | 기본 `platform.html#home`, 로고·계정 화면의 복귀, 현재 계정 상태·같은 자리 재시도·최근 선택/즐겨찾기 바로 열기 | 격리 Chrome, 합성 계정·실행 브리지. 웹 링크 선택과 앱 실행 성공 응답을 구분 |
| PC의 다음 행동 | 미완료 할 일·최근 성공 실행·현재 실행 가능한 앱을 우선한다. 홈에서 직접 열고, 실행 중에는 같은 자리를 유지하며 중복 요청을 막는다. 앱 정보는 별도로 남긴다. | 현재 권한과 기존 `primaryAction`을 재검증. 홈에서 설치·업데이트를 자동 시작하지 않음 |
| 목적 선택 | 목적을 누르면 이 창의 안내가 바로 바뀐다. **다음에도 이렇게 보기**에서 별도 동의한 경우에만 기존 계정별 맞춤 설정에 저장한다. | 일시적인 동일 계정 재확인 중 숨김·복구, 다른 계정·로그아웃에서 분리 |
| 찾기 | PC 플랫폼의 320/390px에서도 검색 단추로 앱·혜택을 찾는다. Ctrl/Cmd K와 Escape가 열기·닫기·초점을 처리한다. 웹은 검색어를 주소에 보관해 상세→뒤로가기에서 복구한다. | 검색 결과, 키보드, 가로 넘침, 회원 혜택 이동 |
| 멈춤과 종료 | 작성 중인 홈 메모의 취소·로그아웃·창 닫기에서 계속 쓰기/저장 없이 나가기를 구분한다. OS 닫기·새로고침에도 `beforeunload`와 네이티브 확인을 연결한다. | 실제 숨김 Electron의 native close 이벤트. 이전 버리기 선택 후 새 확인창에서 Escape를 눌러도 초안 보존 |
| 마무리와 재방문 | 홈 메모의 저장 성공을 확인한 뒤에만 초안 보호를 해제하고, 이 기기의 같은 계정에서 다시 찾을 위치를 안내한다. 기존 리허설 작품집·가족의 책 소장 기능은 유지한다. | 저장 실패 보호, 계정 전환·앱 권한 철회 분리. 모든 앱의 원본/진행 위치를 홈에서 수집하거나 복원하는 기능은 추가하지 않음 |

## 중요한 연결 경계

초기 확인에서 공개 `/account/platform.html`은 HTTP 404였다. 이번 공개로 실제 `account/` 화면·공개 설정과 홈페이지 **내 홈** 링크를 연결해 HTTP 200 및 로그인 시작을 확인했다. `바로 시작`은 기존 `/#products` 무료 체험 목록을 유지한다.

홈의 할 일·결과 메모는 직접 작성한 기기 기록이며 앱 작업 위치와 다르다. 임시 초안은 메모리에만 유지한다. 저장 동의 없이 자동 영구 보관하지 않으며, 확인창에서 버리기를 선택하거나 실제 계정/권한이 바뀌면 보호 경계를 따른다.

## 검증 결과

- 데스크톱 전체 `node --test desktop/tests/*.test.cjs`: **265/265**. [로그](../../../../desktop/artifacts/experience-unit-tests-20261008.txt).
- 기존 홈 native 검사: **29/29**, 1280/390/320px. [결과](../../../../desktop/artifacts/member-home-native-20261008.json).
- 새 사용자 여정 native 검사: **32/32**. [실행 코드](../../../../desktop/tools/experience-native-smoke.cjs), [결과](../../../../desktop/artifacts/experience-20261008/native.json). 격리 프로필과 합성 실행을 사용했으며 외부 요청·콘솔 오류 0개.
- 기존 라이브러리 반응형 검사: **87/87**, 외부 요청·콘솔 오류 0개.
- 웹 플랫폼: 관련 회귀 **46/46**, 실제 격리 Chrome **37/37**, 6번들 빌드/일치 확인. [웹 기록](../../../../experiences/synk-account/qa/platform-home-20261008/README.md).
- 홈페이지: 전체 빌드, 기본 301 + 영어 143 = **444개 시험** 통과. 최종 진입 회귀 35개와 브라우저 한영 6화면 및 예외 상태 확인. [홈페이지 기록](../../../../../SYNK-website/qa/entry-start-20261008/README.md).
- 변경 파일의 `git diff --check` 통과. 실제 이용자 편의성 효과나 학습 효과를 측정한 결과는 아니다.

독립 검토에서 일시 인증 오류 후 재연결이 저장 자격 재검증을 건너뛰는 문제와, 같은 계정 토큰 갱신 중 임시 목적이 사라지는 문제를 발견해 수정했다. 새 native 검사에 두 재현을 포함했다. 네이티브 종료가 취소되면 서비스가 살아 있어야 하므로 종료 정리는 `before-quit` 대신 실제 종료의 `will-quit`에서 수행한다.

## 현재 화면

- [PC 내 홈](../../../../desktop/artifacts/experience-20261008/home-1280.png)
- [320px 검색](../../../../desktop/artifacts/experience-20261008/mobile-search-320.png)
- [홈페이지 390px](../../../../../SYNK-website/qa/entry-start-20261008/ko-390-entrance.png)

## 변경 위치

- 홈페이지: `SYNK-website/entry-start.mjs`, `compose-sites.mjs`, `brand-navigation.mjs`, `src/cosmic-entry.js/.css`, 영어 원문과 생성물.
- PC: `desktop/renderer/member-home.mjs/.css`, `launcher.mjs/.css`, `personalization.mjs`, `index.html`, `desktop/src/draft-exit.cjs`, `main.cjs`.
- 웹: `experiences/synk-account/src/platform-home.mjs`, `src/platform.mjs`, `platform.html/.css`, `client.html`, 생성 번들.

설치와 공개 반영은 위 고정 후보에 한정한다. 공용 소스의 동결 이후 변경이나 별도 작업의 계정 라이브러리 동기화는 이번 완료에 포함하지 않는다.
