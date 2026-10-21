# Platform 한 번 로그인 · 2026-10-09

사용자 요청은 Platform에서 로그인하면 지원 앱도 같은 SYNK ID로 자동 연결되는 것이다. 기존 OAuth/PKCE·독립 암호화 금고·서버 계정 확인을 유지한다. 토큰 복사·이메일 기반 회원 병합·회사/교사 권한 확대는 하지 않는다.

현재 웹·회사·PC 결과와 증거 파일의 조회 시점 SHA는 [통합 인수 기록](../../../../.tmp/platform-unified-login-20261009/world-web-sso-followup-r2/FINAL-ACCEPTANCE.json)에 모았다. 이 채팅의 직접 확인, 단일 운영 담당의 실제 계정 확인, 아직 미검증인 항목을 구분한다.

## 후속 수정 인수 — 10-09

WORLD 웹 SSO r2는 75/75 통과 후 단일 담당이 canonical 4파일을 반영했고, [실제 원문 대조](../../../../.tmp/platform-unified-login-20261009/world-web-sso-followup-r2/shared-canonical-acceptance.json)에서 모두 일치했다. account-r4에 공용 여행 코드가 섞여 Platform이 245,011B 커진 문제는 Platform 입력을 별도로 고정한 r6에서 해소했다. [account-r6 인수](../../../../.tmp/platform-unified-login-20261009/world-web-sso-followup-r2/world-play-public-20261009-r6-acceptance.json)는 manifest 4091ab0e의 48출력·WORLD 22/Platform 21모듈·r3의 다른 20파일 일치를 확인한다. 최종 Platform은 224,251B로 r4보다 244,105B 줄었으며, 이전 공개본보다는 로그인 수정분 906B가 증가했다.

웹 결합 v6는 커밋 `744e9f28ff5f742f7740b22a7533bee932476bdc`로 공개됐고, [출판 기록](../../../../.tmp/world-public-release-20261009-v6/published-result.json)에서 같은 커밋의 Pages 완료를 확인했다. 배포 담당의 [공개 359파일 대조](../../../../.tmp/world-public-release-20261009-v6/public-file-verification.json)가 모두 통과했으며, 이 채팅의 [공개 SSO 4파일 직접 확인](../../../../.tmp/platform-unified-login-20261009/world-web-sso-followup-r2/public-r6-account-acceptance.json)도 HTTP 200·정확한 r6 SHA 일치다. 후속 공개 7b749a6은 try/travel만 변경해 WORLD 출시 파일을 보존했다고 기록했다. [공개 협동게임 브라우저 검사](../../../../experiences/beginner-games/qa/account-sync/coop-release/r4/public-browser/ui-results.json)는 96/96 통과했다. 화면 전환 대기 순서 때문에 멈췄던 첫 검사 기록은 보존했으며, 브라우저의 작은 화면 검사를 실제 휴대폰 확인으로 표현하지 않는다.

회사 새 릴리스 3a2f537a는 [최종 인수](../../../../.tmp/company-final-review-fixes-20261009/FINAL-ACCEPTANCE.json)에서 Linux 843/843, 배포 444파일·공개 17파일 일치, 기존 직원 5·고객 1세션과 키·업무 자료 보존을 확인했다. 실제 기존 브라우저에서도 재로그인 없이 원래 계정·메모·첨부·고객 초안을 확인했다. 첫 배포의 사전 조건 중단은 변경 없이 종료됐고 원본 실패를 보존했다. 이 채팅의 익명 상태 조회는 전환 중 한 번 실패했으나 후속 HTTP 200·ready를 확인했다. 익명 상태 확인을 자료 보존 근거로 사용하지 않는다.

PC 담당의 [현재 설치 결과](../platform-unified-followup-20261009/installed-result.json)는 새 a26c7647 세 앱 설치·단위 369/종료보호 38/설치부팅 16/익명 Messenger 연결 9 통과와 기존 데이터 275파일 보존을 기록한다. 275파일 SHA 보존의 확인 시점은 정상 사용자 UI를 열기 전까지다. 첫 숨김 캡처 실패와 회사 전환 중 익명 접속 거절은 원본을 보존했고, 각각 상태를 확인한 뒤 격리 재검사 1회에서 회복했다.

새 a26 설치본의 [실제 계정 인수](../platform-unified-followup-20261009/actual-account-r2.json)도 완료됐다. 완료 메모 5행·별도 복구 1개를 확인했고 반복 확인창은 없었다. Platform의 최근 Messenger 실행 버튼으로 기존 회원 작업실·실시간 연결·원래 자기 대화와 111B 첨부파일을 확인했다. 비밀번호 재입력·메모 수정/삭제·복구 선택·새 메시지·새 직원 연결은 없다. 첫 Platform 창이 사라진 원인은 확정하지 않았고, 강제 종료 없이 한 번 다시 열어 확인했다. 아래의 22b 실계정 인수는 이전 버전의 기록이다.

WORLD 단일 담당의 [실제 공개 계정 인수](../../../../experiences/beginner-games/qa/account-sync/actual-public-account.json)에서 Platform→WORLD OAuth·계정 저장 완료와 상점 목표의 새 WORLD 탭 복원을 확인했다. 같은 브라우저 프로필의 두 탭이며 물리 두 기기 확인은 아니다. 확인용 목표는 해제했으며 코인·구매품·게임 진도·계정 권한은 변경하지 않았다. 비밀번호 입력·전역 로그아웃 없이 확인했고, 이 채팅은 실제 계정을 중복 조작하지 않았다. 옷장의 로컬/계정 저장 대기 문구와 수업 소속 미연결 관찰은 해당 담당이 별도 범위로 분리해 Platform 담당에게 전달했다.

추가 공식 Claude 검수는 사용자의 직접적인 후행 지시에 따라 미완료로 남긴다. 휴대폰에서 PC를 끈 뒤 이용, 다른 실제 계정 전환, 물리 IME·OS 알림 표시/클릭도 아직 검증하지 않았다. 아래는 이전 후보와 실패·인수 이력이며 현재 결과는 이 절을 우선한다.

## 기존 완료 기준 — 운영 반영·PC 설치·메모 복원·Messenger 자동 연결 확인

회사e696b9ef 운영 반영과 직원·고객 로그인·자료 보존 확인, 웹f10cf8e6 공개와92파일 대조·전체CI, PC22b4c7 세 앱 설치가 완료됐다. [PC 설치 결과](../platform-unified-followup-20261009/installed-result.json)는 각 설치exit0, runtime89파일씩·인증설정9개 일치, 설치된Platform 첫실행16·Messenger 익명연결9 통과를 기록한다. 정상 사용자 프로필을 열기 전까지 WORLD67·Messenger127·Platform105개 프로필 파일은 설치 전과 같았다.

원래Platform 정상 프로필에서 [실계정 검수](../platform-unified-followup-20261009/actual-account-pc-restoration.json)를 완료했다. 계정 메모5개·완료5행·별도 복구1개를 확인했고, Platform의 실행 버튼으로 설치된Messenger를 열어 자격증명 재입력 없이 기존 회원 작업실·실시간 연결·기존 나에게 메시지·첨부파일을 확인했다. 메모 쓰기·삭제·복구 선택·새 직원 연결·권한 변경은 없었다. 앞선Esc 중단은 당시 추가조작 없이 이력으로 보존했고, 후속 사용자의 “실제계정연결, pc메모복원 이어서 진행해” 요청 뒤에만 재개했다. 이 채팅은 UI를 중복 조작하지 않았다.

WORLD 로컬 서버 실행의 기존 차단, 휴대폰/PC 꺼짐·다른 실제 계정 전환·OS 알림·물리 IME 검수는 별도로 남아 있다. 이번 실제 자동 로그인 확인 범위는 기존 회원의 Platform→Messenger 연결이며, 모든 앱·모든 기기의 실사용 완료로 확대하지 않는다.

### 10-09 후행 검수 완료와 수정 진행

[공식 검수 결과](../platform-unified-web-release-20261009/final-review/result-v8-22b.json)는 Opus 5.5·max 정상 완료, P0/P1 없음·P2 3건·P3 6건이다. 완료된 검수와 발견된 문제의 수정 완료는 구분한다. 회사 담당은 동일 계정 토큰 갱신 중 화면 가림 지연과 초기 일시 오류 뒤 로그인 복원 중단을, PC 담당은 손상된 계정 선택 파일의 복구를 수정하고 있다. WORLD와 PC 수정은 한 설치 후보로 합쳐 검증하며 이 채팅은 설치나 공용 원문을 중복 변경하지 않는다.

[추가 합성 재현](../../../../.tmp/platform-unified-login-20261009/suite-edge-audit/result.json)은 동결 22b의 실제 계정 조율 모듈과 메모리 저장소로 두 예외를 확인했다. 초기 복원 오류에서 회복한 뒤 사용자가 로그아웃해도 조율 파일의 일시 읽기 실패·회복이 자동 OAuth를 다시 시작할 수 있고, 자식 세션이 철회된 뒤 Platform에서 같은 계정으로 명시 재로그인해도 자식 앱이 재확인하지 않는다. 실제 프로필·네트워크 접근 없이 재현했으며 PC 단독 담당에게 전달했다.

[공개 포털 등록 대조](../../../../.tmp/platform-unified-login-20261009/all-app-consumer-audit/public-native-callbacks.json)는 설치 후보의 native OAuth 9개가 실제 공개 설정과 기존 등록 영수증에 정확히 일치함을 확인했다. 미연결 직원을 자동 생성하지 않는 계약은 유지한다. 다만 native의 연결 실패 안내가 외부 회사 웹의 기존 명시 연결 절차로 안내하지 못하는 문제와 배경 Messenger 만료 경로는 회사 담당에게 후속 검토를 전달했다.

[WORLD 입구 조회](../../../../.tmp/platform-unified-login-20261009/world-resume-audit/availability-20261009.json)는 06:49 KST 기준 공개 화면 HTTP 200, 공개 WORLD client 설정 미완성, 새 account r3와 공개 번들 불일치, `synk-play` 함수 HTTP 404를 기록한다. 회사 상태는 HTTP 200·ok·ready다. 게임 담당의 합동 웹 v4·backend f54cdb는 당시 재검수 중이며 운영 반영 전이다. 웹 Platform→WORLD의 기대 계정 전달·자동 OAuth 누락은 [격리 r2 수정본](../../../../.tmp/platform-unified-login-20261009/world-web-sso-followup-r2/README.md)에서 보완했다. 실제 소비 코드에서 초기 진입·callback·저장 실패·취소·로그아웃과 다섯 앱의 계정 확인 중 열기, 늦은 visibility 응답 경합을 포함해75/75 통과했다. 이전r1에 같은 소비 시험을 실행하면49개 중17개 실패하며 기록을 보존했다. r3의다른20파일과 공통helper상태기계는 보존했다. [파일별 SHA·검증 범위](../../../../.tmp/platform-unified-login-20261009/world-web-sso-followup-r2/overlay-manifest.json)는manifest57dccf66이며 canonical적용용4파일과published변환입력을구분한다. 단일WORLD배포담당에게PC조율채팅을통해전달했다. 공용제품원문·공개·OAuth등록·설치변경은이채팅에서0이며, 수정자자체확인과공식검수·배포완료는구분한다. 4280 서버 시작은 이전 실행 도구의 정책 거절(정책 계층과 사유 미확인)을 우회하지 않는다.

## 후속 WORLD 연결 대조 — 현재 설치본과 새 화면의 요청 불일치

현재22b 설치 기준은 `playLoad`/`playMutate`를 제공하지 않지만 최신WORLD 화면은 게임 기록 연결에 이 요청을 사용한다. [실제 모듈의 합성 소비 재현](../../../../.tmp/platform-unified-login-20261009/world-resume-audit/contract-result.json)에서 같은OAuth fingerprint·같은Platform 계정으로22b는signedIn 상태여도 `INVALID_REQUEST`로게임저장연결이offline이었다. 새WORLD r3 `51ecdf33…`는같은조건에서synced이며, 다른계정응답·Platform계정변경·세션없음·다른제품요청차단까지6/6 통과했다. 서버나앱기동·외부통신·실계정접근은 하지 않았다.

r3는 현재 설치22b 기준으로 재구성된 [WORLD 후보](../../../../desktop/artifacts/world-play-candidate-20261009-r3/candidate-summary.json)다. 런타임89개 중 요청·설정·응답검증3개만 변경하고86개와기존계정통합코드를 보존했다. 구r2/f9기준을 설치하지 않는다. 후보기존검사는단위331·격리native35·패키지검증통과이며, 이번6개는별도합성소비근거다. [감사요약](../../../../.tmp/platform-unified-login-20261009/world-resume-audit/summary.json). 설치단독담당「SYNK 플랫폼 기능 보강」에 증빙을 전달했으며 이채팅은제품원문·후보·설치를중복변경하지않았다.

현재4280포트의리스너는없다. [기존실행차단기록](../brand-experience-20261008/desktop-clients/world-start-blocked.json)은사용자승인뒤에도동일공식서버시작이 `blocked by policy`로거절됐고구체이유는제공되지않았음을남긴다. 새후보도동일진입주소를사용하므로요청불일치수정과서버가용성은별도조건이다. 재기동우회·실제실행완료주장은하지않는다.

웹 [전체 CI 근거](../platform-unified-web-release-20261009/ci/summary.json)는 같은f10cf8e6의 회귀69/69·25페이지/8게임의2화면크기 검사 성공이다. runner한 화면의hero.js 최초503은 해당화면 전체 재검사1회에서 회복했고 최초실패를 보존했다. 전체 워크플로 재실행은 없었다. 리허설 번들의 불필요한277,980바이트 감소도 실제 공개 파일로 확인했다. 아래는 후보 준비·검증·반영 과정의 근거다.

아래는 **회사·웹 반영 후 PC 설치를 준비하던 단계의 검증 근거**다. 회사v7의 늦은 응답이 이전 계정 화면의 가림을 해제하는 문제는 서버 담당이 cloud-v8에서 수정했다. Windows766개 중764통과·2제외·실패0이며, [Linux 결과](../../../../.tmp/platform-unified-login-20261009/company-linux-v8/HANDOFF.json)도766통과·실패0이다. 공개v7은 로그인 검사를 통과했지만 리허설에 불필요한 여행 의존성이 들어가 v8에서 해당 앱의 입력만 기존 공개 원문으로 고정했다. PC v5와 공개 v6는 발견된 문제 때문에 보류했고 후속 후보에서 보완했다. 기존 설치 f9d의 메모/복구 개선을 보존하며, PC 설치는 「SYNK 플랫폼 기능 보강」 채팅의 단일 담당이 맡는다.

회사 운영 e696b9ef는 [교체 기록](../../../../.tmp/platform-unified-login-20261009/company-linux-v8/operator-apply-1791492090919.json)과 [기존 자료 대조](../../../../.tmp/platform-unified-login-20261009/company-linux-v8/operator-compare-1791492204190.json)에서 확인했다. 대조를 위한 서비스 정지 중 SSH 응답 수신이 끊겼지만 [원격 원본 영수증 복구](../../../../.tmp/platform-unified-login-20261009/company-linux-v8/capture-recovered-receipt.json)로 같은 버전의 서비스·기존 타이머 재시작과healthy를 확인했다. root의 별도 공개 `/api/health`도200·ok·ready였다. [최종 운영 인수](../../../../.tmp/platform-unified-login-20261009/company-linux-v8/FINAL-ACCEPTANCE.json)는 직원·고객 세션과 키·기존 자료 보존 및 기존 브라우저의 재로그인 없는 화면 복원을 확인했다. 정적 웹f10cf8e6는push·Pages 성공 후 [실제92파일](../platform-unified-web-release-20261009/public-2026-10-08T20-48-45.737Z.json)의 SHA·MIME가 모두 일치했다. 같은 커밋의 전체 CI도 위 최신 결과처럼 완료됐다.

회사 cloud-v8 manifest는 `e696b9efeed78191a6e4619665bdab885abb1483dcb05cc4b5c193c44cf0fcef`다. [Windows 결과](../../../../.tmp/platform-unified-login-20261009/company-cloud-v8/windows-tests.json)는 정확한440파일·76시험파일을 대상으로 한다. 수정·Linux 검증·운영 배포는 회사 서버 담당 한 곳이 맡는다. 공개v8은 공유 Path 원문이나 PC22b4c7 입력을 바꾸지 않는다. 공개 경량 후보는 웹 담당이 `public-v8-rehearsal-slim`에서 단독 준비하며, 이 채팅의 하위 담당은 중복 빌드를 중단하고 읽기 검토만 맡는다.

## 정적 경량 v8 — 공개 완료

웹 담당 후보는 [public-v8-rehearsal-slim](../../../../.tmp/platform-unified-login-20261009/public-v8-rehearsal-slim/manifest.json), manifest `899209bf336910773eb46efd339b412d68de195a0c4cdac6de1ab06437cfe8a9`, allowlist `5e9e5aafbe29031076348386cb46b4f275d47b1799cad971fe487f86f1d2eab1`다. 리허설의 personal-data 입력만 기존 공개 원문 `e77c1b58…`으로 고정해 번들이1,362,780→1,084,800바이트로277,980바이트 줄었다. 바뀐 출력은 리허설app·index·build-manifest3개이며, 다른 앱 출력은v7과 같다. 웹 담당이 정확한 후보 검사와 반영을 맡는다. 이 채팅에서 중복 생성된 `public-v8/`는 검사 중단 상태로 보존하며 출시 대상이 아니다.

회사 cloud-v8의 [추가 경합 검사](../../../../.tmp/platform-unified-login-20261009/company-renewal-cross-review.json)는4/4 및 기존native12/12 통과,440파일 SHA 일치다. [격리 인증 검증](../../../../.tmp/platform-unified-login-20261009/company-linux-v8/auth-result.json)도 서버 교체·인증 장애·복구·권한 철회에서 세션과 자료 보존을 통과했다. 이 결과는 합성 인증이며 실계정 공개 반영 증거는 별도다.

[정적 v8 독립 검토](../../../../.tmp/platform-unified-login-20261009/public-v8-slim-cross-review.json)는 입력136·Platform21·출력91의 SHA를 확인했다. 공개 원문으로 고정한 차이는 여행 import·limit·validator3구문뿐이며, 리허설 검증·JSON·소유권 계약과app/domain/storage/book 원문, 최신 로그인 런타임3개는 그대로다. 다른 앱 출력과Platform 입력 변경은 없다. 추가 결함은 발견하지 않았으며 중복 시험이나 빌드는 하지 않았다.

웹 담당의 [정확한 v8 검사](../../../../.tmp/platform-unified-login-20261009/public-v8-rehearsal-slim/final-report.json)는 로그인60/60·리허설31/31 통과,21파일 재빌드 일치,선언85·참조164 일치다. Platform13/13은 입력과 출력이 같은v7의 결과를 재사용한다. 실제 공개와 PC 설치는 이 후보 준비와 구분한다.

## 정적 후보 v7 — 로그인 검증 완료, 용량 최적화 후속 준비

최종 경로는 [public-v7-attempt2](../../../../.tmp/platform-unified-login-20261009/public-v7-attempt2/final-report.json)이다. manifest SHA `02c9f742f1ac5451261636933b4e111fc7d0987e47bfb0584771f4545820d9c0`, allowlist SHA `30875cd19d92b42b0e5fe1cec91fb1792766ddc0d06e64b120f32b2a72f19e60`. a171b5b 기준16파일 변경·삭제0, 공개91파일/14,829,072바이트다. 일반 입력136·Platform 입력21·manifest 선언85·로컬 참조128을 대조했다. 기존 메모 Platform 번들8dcc0512, 포털4b7edd4a, Care 알림 개선 원문은 유지했다.

최초 설정조회503·저장 실패에도 기대 계정을 먼저 보관하며, 보관 실패면 URL 조건을 남긴다. 명시 로그아웃은 저장·삭제·서버 철회가 모두 실패해 옛 토큰이 남아도 취소 표지로 자동 계정 복원·자동 OAuth를 막는다. 사용자 명시 재연결과 새 Platform 진입만 다시 연결한다. 평상시 검증 완료의 기대 계정 조건은 유지한다.

관련165/165, 정확한 동결 소비 코드60/60, 정확한 Platform13/13, 독립 경합28/28 통과. [동결·교차검사 SHA 증빙](../../../../.tmp/platform-unified-login-20261009/public-v7-attempt2/handoff-proof.json). 실제 계정·공개 반영 결과는 별도다. 첫 준비본의 입력 선택 오류는 `public-v7/failure.json`에 보존했고, 그 경로는 최종 후보가 아니다. 웹 담당은 회사 경합 수정의 공개 확인 뒤 이16파일을 반영한다.

## PC 상세 버튼과 공개 앱 입구 추가 검사

PC `5f175f`의 회원혜택 상세 링크는 `shell.openExternal`로 바로 열려 기존 SSO public-app 경로를 우회했다. `desktop/renderer/launcher.mjs`의 native 상세 버튼을 기존 `command('public-web', id)`에 연결했고, 일반 브라우저 미리보기의 링크는 보존했다. native에서 기능·권한이 없으면 비활성 버튼으로 두며 링크로 우회하지 않는다. 수정 전 새 회귀4개 실패, 수정 후 renderer45/45 및 공개입구 합성53/53을 확인했다. [원문 두 파일 SHA·검증 근거](../../../../.tmp/platform-unified-login-20261009/benefit-public-entry-fix/result.json). 이전 후보 원문·패키지는 변경하지 않았고 PC 담당에게 새 후보 반영을 전달했다.

공개 v6는 정확한 Care 소비 코드를 사용해 `A 기대 계정 + B 저장 세션 → 첫 설정 조회503 → 새로고침 → B 표시`를 재현했다. 기대 UUID fragment를 탭 저장소 기록 전에 지우는 순서가 원인이다. [실패 근거](../../../../.tmp/platform-unified-login-20261009/public-entry-durable-repro.json)는 합성 계정·HTTP만 사용했다. 실제 운영 계정에 시험하지 않았다. 위 공개v7에서 같은 공통 helper를 쓰는 세 개인 앱을 함께 수정했다. **공개 v6는 반영하지 않는다.**

## 회사 후보 v7 — 후속 경합 수정 필요

[회사 v7 후보](../../../../.tmp/platform-unified-login-20261009/company-v7/candidate-manifest.json)는 SHA `9e25852b01a4bdcbe9727645a21ff132120bbe1e0efb5fec75c7b96641c0ada8`, 440파일이다. 현재 운영 중인 고객 세션 유지 버전 `20fda68c…` 위에 아래 SSO 런타임4·시험3개만 합쳤다. 정적 웹 `f24725f7`은 바뀌지 않는다. PC는 같은 인증 계약 위 launcher 상세 버튼을 보완한 새 후보를 준비한다. 현재 운영 Messenger의 모든 파일과 고객 인증·데이터 보존 코드는 부모와 같은 바이트다. 새 전송 복구 기능과 그 세 테이블은 포함하지 않는다.

**회사 v7도 그대로 배포하지 않는다.** 서버 담당의 추가 검토에서 계정 변경 중 지연 응답이 기존 화면 마스킹을 해제하는 경합을 재현했다. 해당 회사 원문 수정·후속 후보 검증·반영은 서버 담당 한 곳이 맡는다. 아래761통과는 당시 포함한 검사에 대한 결과이며 새로 발견한 경합의 통과 근거가 아니다.

회사 v6의 전체 검사 결과는 792개 중788통과·2실패·2Windows제외였다. [원인 분리](../../../../.tmp/platform-unified-login-20261009/productivity-fixture-v7/result.json)에서 기존 전송 시험의 서버 기능 확인 상태 누락을 재현했고 해당 fixture만 채우면12/12 통과했다. UUID stub 변경만으로는 같은2건이 실패했다. 제품의 보호 조건을 풀지 않았다.

추가로 v6의 부모였던 Messenger 전송 복구 `31585a0f…`는 별도 실제 결함3개 때문에 그 담당이 배포 금지했다. 따라서 **v6는 배포하지 않는다.** 원본 실패·후보는 보존하며, 해당 신규 기능의 준비가 끝나기를 로그인 작업의 의무로 만들지 않고 이미 운영 중인20fda에 SSO만 합쳤다. 이는 시험을 삭제하거나 실패를 무시하는 방식이 아니라 배포할 기능 범위와 그 부모를 바꾼 것이다. [부모 호환성 검사](../../../../.tmp/platform-unified-login-20261009/company-v7-base-compatibility.json)는 의존 API·동일 Messenger·고객 세션 보존을 확인했다. [v7 전체 Windows 실행 검사](../../../../.tmp/platform-unified-login-20261009/company-v7/windows-tests.json)는76시험파일·763개 중 **761통과·0실패·2심볼릭링크 제외**, 약288초다. 실행 후에도440개 소스 hash가 같았다. Linux·공개·실계정 인수는 별도 미완료다. [운영 전달문](../../../../.tmp/platform-unified-login-20261009/COMPANY-SSO-HANDOFF-V7.md)을 준비했다.

## 연결 구현과 정적 웹 v6

- [이전 회사 v6 후보 — 배포 금지](../../../../.tmp/platform-unified-login-20261009/company-v6/candidate-manifest.json): SHA `26a79f93570da5275a1a93f399a21bea6a11a0115104ac109f8420a56579f628`, 444파일. 여기에 동결한 SSO 런타임4개·시험3개는 같은 바이트로 v7에 보존했다. v6에 들어간 별도 Messenger 신규 기능은 v7에서 제외했다.
- [이전 정적 웹 v6 후보 — 반영 보류](../../../../.tmp/platform-unified-login-20261009/public-v6/manifest.json): SHA `f24725f7eeeb2bc75f92f2729e342cd3525e4d5068ef13f741f5825af7f9bf0f`. a171b5b 기준 [허용 파일 16개](../../../../.tmp/platform-unified-login-20261009/public-v6/allowlist.json)다. 기존 메모 Platform 입력, `account/dist/platform.js`, Care 조회 지연·지원 범위 문구를 보존하는 v7의 기반으로만 사용한다.
- 회사 gate는 기존 authStatus/challenge/exchange 계약을 사용한다. PC 인증 코어는 앞서 확인한 **5f175f**와 같지만 상세 웹 버튼 수정이 추가되어 새 패키지를 준비해야 한다. 기존5f175를 설치하지 않는다.
- 순서는 **회사 gate 공개 확인 → 중앙 포털·정적 웹 공개 확인 → PC 설치·실계정 인수**다. 기존 회사 화면은 기대 UUID를 읽지 않아 옛 회사 쿠키를 그대로 보여 줄 수 있으므로 순서를 바꾸지 않는다.

웹에서는 주소의 기대 UUID를 탭 저장소에 먼저 보관한 뒤 HTTP 호출 전에 제거한다. 저장 실패는 주소에 조건을 남겨 새로고침으로 검증이 사라지지 않게 한다. 회사의 `/api/me`가 서버 재시작 뒤 암호화 세션을 재검증하되, 기대 계정 일치 전에는 화면 상태에 사용자를 넣지 않는다. OAuth 기대 계정은 서버 challenge에 고정하고 중앙 인증 결과와 맞지 않으면 기존 세션·회원 연결을 바꾸지 않는다. 만료 후 회사 비밀번호 입력으로 다른 계정을 표시하는 경로도 요청 전에 차단했다.

PC에서는 기존 회사 세션도 처음 자료를 불러오기 전에 현재 SYNK ID와 비교한다. 같은 연결은 자동 승격하고, 다른 회사 계정은 그대로 보존한 채 명시 로그아웃 후 재연결을 안내한다. 갱신 중 본문·모달·알림은 잠시 가리며 초안 DOM은 유지한다. 계정 변경 이벤트 뒤 늦게 도착한 이전 상태 응답도 처음 계정 상태를 설치하기 전에 차단한다.

[프런트·계정 경합 43/43](../../../../.tmp/platform-unified-login-20261009/company-gates-v6.tap), 서버 계정 회귀49/49, 공개 링크 관련46/46 통과. 정확한 회사444파일 전체 시험과 정적 후보 검사는 별도 결과에 기록한다. 실패 재현은 `company-entry-gap-{before,after}.json`, `company-entry-password-{before,after}.json`, `company-native-status-race-{before,after}.txt`로 보존했다. 초기 native 마스킹 시험 로그에는 fixture stub 영향이 섞여 있어 수정 전 실제 제품 실패의 증거로 사용하지 않는다.

공식 Claude 최종 검수는 여전히 미완료다. 「싱크 플랫폼 사용자 경험 개선」 채팅의 직접 사용자 원문(01a11be1, “최종검수는 지금 안해도 되 나머지 이어서 해”)과 그 직전 검수 대기 설명을 확인했다. 검수 완료로 바꾸지 않으며 실제 계정 계약·데이터 보존 검증은 계속한다. 회사 서버 담당 채팅 전달·반영은 같은 채팅의 직접 사용자 답변 “전달하고 반영까지 진행”(user01a11d1e-2397)을 원문으로 확인했고 전달 완료했다. [승인 근거](../../../../.tmp/platform-unified-login-20261009/server-coordination-user-authorization.json). 운영 작업은 서버 담당 한 곳에서 실행하며 중복 배포하지 않는다.

## 후보의 동작

- PC Platform은 마지막 서버 검증 계정만 공통 선택 기록으로 전달한다. 토큰은 각 앱의 금고에 남고 각 앱이 서버에서 같은 계정인지 확인한다.
- Platform 종료·같은 계정 갱신·로그인 취소는 다른 앱의 선택을 바꾸지 않는다. 명시 로그아웃은 선택 기록 저장 성공 후 실행하고, 다른 계정은 서버 확인과 기록 저장 후 표시한다.
- Platform 선택 기록이 없는 기존 개별 앱 사용자는 자기 금고를 복원한다. 명시적인 Platform 로그아웃 후에는 Platform에서 로그인하도록 안내한다.
- 웹/PC Platform → 공개 플레저·운세·리허설은 토큰 없는 기대 계정 UUID를 전달한다. 즉시 주소에서 제거한 뒤 기존 OAuth를 자동 시작하고 결과 계정의 일치를 확인한다.
- 중앙 포털은 확인된 사용자·등록된 client/정확한 callback/기본 scope에만 기존 SDK 승인을 자동 1회 실행한다.
- native Messenger는 검증된 계정으로 기존 회사 challenge/exchange를 자동 시작한다. 기존 회사 연결과 직원 권한은 유지한다.

웹 Platform → 웹 Messenger와 기존 legacy 회사 세션 전환은 위 v6에서 구현했다. WORLD 실사용 경로와 전체 경로의 실계정 인수는 남아 있다. 모든 서비스의 통합 완료로 보고하지 않는다.

## 검증

- [v5 동결 입력 146개](../../../../.tmp/platform-unified-login-20261009/candidate-v5/manifest.json). PC 허용 overlay는 src 7개·시험 3개다. f9d auth-config 원본과 전체 기존 인증 시험을 보존하고 SSO 변경만 분리했다. 다른 WORLD 기능/시험은 공유 원문에 유지한다.
- [PC 324/324](../../../../.tmp/platform-unified-login-20261009/desktop-full-v9.txt). 합성 OAuth HTTP·격리 금고로 계정 불일치, 로그아웃, 자식 토큰 회전 중 Platform 갱신/종료, 새 refresh token 보관과 추가 OAuth 없음 확인.
- [웹 433/433](../../../../.tmp/platform-unified-login-20261009/web-full.txt). callback·자동 승인·취소·다른 계정 차단·기기 원문 보존·공개 빌드 검사.
- [회사 15/15](../../../../.tmp/platform-unified-login-20261009/company-sso-tests-v2.txt). 자동 입장·진행 중 OAuth 재시작 방지·거절 후 반복 차단. 운영 로그인 증거는 아니다.
- [운영 callback 대조](../platform-unified-followup-20261009/oauth-callback-registration.json). 설치 담당이 기존 9개 등록과 정확한 loopback callback을 읽기 확인했다.

## 검수 및 실패 이력

[v2 공식 검수](../../../../.tmp/platform-unified-login-20261009/claude-review.json)는 Opus 5.5 max로 정상 완료됐고 출시 불가였다. 종료·갱신 중단 및 자동 재로그인 지적에 따라 v4에서 lease/heartbeat와 파일 삭제를 없앴다.

v3 트레이 방안은 폐기했다. 격리 Electron 시험의 종료 정리가 파괴된 window.webContents getter를 접근해 오류창을 냈다. 단위 fixture는 해당 조건을 재현하지 못했다. 실제 설치/실계정 프로필은 시험 대상이 아니었고 설치 담당이 f9d ASAR 불변·해당 코드 미포함을 대조했다. 실패 후보/로그는 보존하며 재실행하지 않는다. 현재 원문과 v4에 presence/Tray 연결은 없다.

[v4 후속 공식 검수](../../../../.tmp/platform-unified-login-20261009/claude-followup.json)는 04:05 KST 세션 한도로 중단됐다(`is_error:true`, exit1). PASS가 아니며 안내된 해제 시각은 10월 9일 05:30 KST다. 다른 모델이나 과거 한정 예외로 대체하지 않는다. 실제 대상은 [v5 최종 검수 요청문](../../../../.tmp/platform-unified-login-20261009/claude-final-prompt.txt)으로 다시 검수해야 한다. 원문 구현·합성 검사·설치·공개·실계정 성공은 각각 구분한다.

후속 분리 검사는 v4 전체 파일에 별도 WORLD 변경이 섞인 문제를 발견했다(고정 f9d 통합 322개 중 2개 실패). 실패 후보 493e7d는 보존하고 설치하지 않았다. v5는 f9d 전체 시험에 SSO 시험만 추가하며 WORLD 기능을 임의로 추가하거나 해당 작업의 시험을 삭제하지 않는다. 실제 token 회전 중 임시 메타데이터 읽기 실패도 [수정 전 실패](../../../../.tmp/platform-unified-login-20261009/rotation-read-error-before.txt) → [수정 후 통과](../../../../.tmp/platform-unified-login-20261009/rotation-read-error-after.txt)로 확인했다. 임시 checking은 계정 접근만 가리고 새 토큰의 검증·보관을 완료시킨다. 명시 로그아웃 기록이 있으면 재시작 시 오래된 금고를 자동 복원하지 않는다. [관련 원문 67검사](../../../../.tmp/platform-unified-login-20261009/native-auth-tests-v10.txt)는 별도 WORLD 2개를 포함하므로 정확한 f9d 통합 검사는 설치 담당이 별도로 수행한다.

v5의 정확한 f9d 통합 후보 `5f175fbb…`는 전체 **322/322**를 통과했다([설치 담당 근거](../platform-unified-followup-20261009/README.md)). 같은 auth 원문 hash를 대조한 [추가 경합 3/3](../../../../.tmp/platform-unified-login-20261009/request-fence-v5.txt)도 통과했다. [공개 산출물 재현](../../../../.tmp/platform-unified-login-20261009/artifact-audit-v5-exact/result.json)은 고정 입력 146개와 고정 builder로 care 50·fortune 17·rehearsal 21파일 및 portal 번들의 바이트 일치를 확인했다. 최초 산출물 대조의 fortune manifest 불일치는 공유 builder가 다른 작업에서 변경된 원인이므로 실패 로그를 보존하고 고정 builder로 다시 확인했다. 네트워크 호출·공개 반영은 없다.
