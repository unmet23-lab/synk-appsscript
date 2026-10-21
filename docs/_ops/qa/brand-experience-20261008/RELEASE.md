# 브랜드 경험 프로그램 · 공개와 PC 반영 기록

2026-10-08 후속 요청에 따라 **쇼룸을 공개하고 기존 PC 작업실에 고객·브랜드·품질 기능을 적용했다.** 이어진 사용자 “이어서 해” 요청으로 회원 홈을 포함한 Platform과 WORLD·Messenger Preview 0.4.0을 현재 PC에 설치하고, **연결 복구와 7차 계정 보강까지 세 앱에 업데이트했다.** 공용 작업본의 다른 변경과 현재 데이터를 보존했다. 외부 고객용 서버 연결은 이 기록 초반에는 별도 작업에서 진행 중이었고, 뒤의 10-09 갱신에 HTTPS·실제 로그인 근거가 이어진다. 그 이후의 현재 운영은 [현재 회사 운영 기록](../../../마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md)을 따른다.

## 준비한 결과

### 홈페이지 쇼룸

현재 공개 `synk-policy/main`의 `17122d771b0dbfa9840f81fc6fc780cacbf45dac`를 기준으로 한영 HTML 두 개와 새 스타일·동작·이미지 다섯 개, 총 **7파일**만 분리했다. 쇼룸 추가분을 제거하면 원래 공개 HTML과 바이트가 같다. 같은 날 공개된 Atlas·여행·게임 파일을 되돌리지 않는다.

[고정 후보·검증·반영 기록](../../../../../SYNK-website/qa/showroom-20261008/release-preflight/README.md), [후보 해시](../../../../../SYNK-website/qa/showroom-20261008/release-preflight/candidate-manifest.json)를 따른다. 전체 빌드 및 **444/444** 검사, 실제 후보 한영 **6화면·필터 24회**, 키보드·JS 없는 기본 화면·강제 색 모드를 통과했다.

배포 직전 원격 기준이 같음을 재확인하고 별도 작업본에서 정확히 7파일을 일반 fast-forward로 게시했다. 공개 commit은 `179247fe0c5e12b5885b7f97025be5f3db041a5a`다. Pages **37762783174 성공**, 공통 사이트 검사 **37762783359 성공**을 확인했다. 공통 검사는 23쪽×2기기·8게임×2기기와 질문창을 통과했다. [한국어](https://synk.im/#showroom)·[영어](https://synk.im/en/#showroom)의 공개 7파일 HTTP200·MIME·크기·원시 SHA-256 일치를 확인했다. 실제 공개 한영 320/390/1280px **6화면·필터 24회**와 키보드·깊은 링크·JS 없는 기능·강제 색 모드, 기존 회사 소개·Atlas 입구 **4화면**도 통과했다. [공개 완료 증거](../../../../../SYNK-website/qa/showroom-20261008/release-preflight/completion.json)에 실행 결과를 모았다.

### 고객 라운지·고객 관리·브랜드·품질 작업실

Docker COPY와 dockerignore 규칙을 그대로 적용한 **259파일, 17,225,134바이트**의 후보를 [.tmp/brand-release-20261008/company-payload/workspace](../../../../.tmp/brand-release-20261008/company-payload/workspace/)에 보존했다. 실제 DB·키·자격증명은 포함하지 않았다. [파일 해시 명세](../../../../.tmp/brand-release-20261008/company-payload/payload-manifest.json), [패키지 실행 108개 확인](../../../../.tmp/brand-release-20261008/company-payload/verification.json)과 `COMPLETE`가 있다. 이는 Windows에서 실제 COPY 파일을 실행한 증거이며 Linux Docker 실행 증거는 아니다.

후속 점검에서 단독 `backup.mjs`가 고객 시안·최종 파일·발주서 첨부를 빠뜨리는 것을 수정했다. 통합 백업과 같은 `workspaceMediaNames` 목록을 사용하며 제작 양식·품질 기록도 SQLite 사본에 남는다. 회사 단독 백업과 메신저를 포함하는 통합 백업의 안내를 구분했다. `cloud.env.example`에는 검증된 PULSE 접수 사본을 둘 `/data/pulse-inbox`를 추가했다.

관련 백업·복원·HTTPS 계약 검사 **24/24**, 패키지 검사 **2/2**를 통과했다. 공개 Host 보존, 다른 Host/Origin 거절, 직원·고객 Secure/HttpOnly 쿠키와 경로 분리, HTTPS Host로 내부 readiness 검사까지 합성 환경에서 확인했다. 실제 DNS·TLS·외부 휴대폰 접속은 확인하지 않았다.

실행 상태 확인:

- 운영용 로컬 `4191`: 이전 PID 12888을 정지하고 최신 통합 백업 뒤 검증한 원래 실행기로 **PID 20072**를 시작했다. 시작 직전 후보와 원본 **259파일 SHA가 전부 일치**했다. health ready, 새 기능 정적 파일 **6종 200·원본 바이트 일치**, 비로그인 직원·고객 API **3종 401**을 확인했다. 기존 `4197` 메신저 주소의 회사 서버 연결도 정상이다.
- 합성 체험 `4196`: 새 기능 주소 200, 비로그인 직원 API 401. 실제 운영 계정을 사용하지 않는다.
- 외부 고객용 주소·서버는 아직 연결하지 않았다. 회사 서버 인프라 준비는 [CLOUD-OPERATIONS](../../../마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md)를 따르며 새 VM·유료 전환·DNS 변경을 수행하지 않았다.

실제 관리자 세션으로 읽기 전용 브라우저 검증 **36/36**을 통과했다. 고객 관리·브랜드 제작실·품질 메뉴, 승인 자산 **15종 실제 다운로드**, 회사 문서 **17개**, 기존 메신저 인증·화면, 초대 없는 고객 화면 거절을 확인했다. 1280/390/320px 넘침·브라우저 오류·외부 요청·제품 저장 요청은 0이다. [읽기 검증 결과](pc-live/readonly-report.json), [재시작·데이터 보존·HTTP 증거](pc-live/release-proof.json)를 보존했다. 실제 고객 생성·초대 전달·메시지 발송은 하지 않았다.

### 현재 데이터 보존

공식 통합 백업 도구로 현재 회사·메신저 DB와 원래 키·통합 설정을 저장소 밖의 사용자 로컬 백업 폴더에 보존했다. `COMPLETE`와 두 DB의 `PRAGMA integrity_check=ok`를 확인했다. 백업에는 민감한 데이터와 키가 있으므로 본문·식별자·키를 이 문서에 복사하지 않는다.

첫 사본은 서버를 멈추지 않은 **온라인 보존 사본**이었다. 이번 적용 직전에는 원래 writer PID 12888의 종료·4191/4197 포트 해제와 DB/WAL/SHM **6파일의 독점 접근**을 확인한 뒤 최종 사본 `synk-workspace-2026-10-08T10-28-08-464Z`를 만들었다. 백업 전후 원본이 안정적이고 회사·메신저 DB의 전체 논리 내용과 백업이 정확히 일치했다. 원래 암호화 키·통합 설정도 보존했다. Windows `Stop-Process`로 정지했으며 정상 종료 신호를 처리했다고 기록하지 않는다.

재시작 뒤 회사의 업무 문서·암호화 자격증명과 메신저 **21테이블**이 정지 백업과 같았다. 달라진 것은 만료 정리·로그인을 거친 회사 세션 토큰 테이블뿐이다. 두 DB 무결성과 원래 키·통합 설정 동일성을 다시 확인했다. 원래 자동 수집 설정은 유지했으며 검증용 신규 수집·AI 호출은 실행하지 않았다.

보호된 전체 기록은 `C:/Users/q1212/AppData/Local/Packages/OpenAI.Codex_2p2nqsd0c76g0/LocalCache/Local/SYNK/Backups/brand-experience-20261008/`의 `pc-stop-evidence.json`, `pc-stopped-audit.json`, `pc-after-restart-audit.json`에 있다. 문서에 공개하는 결과는 개인 정보·자격증명·키를 제외한 [release-proof.json](pc-live/release-proof.json)뿐이다. 이는 현재 PC 코드 교체와 데이터 보존 증거이며 외부 서버 복구 인수 완료가 아니다.

### 플랫폼 회원 홈 · 설치 전 후보 이력

동시에 진행 중인 계정 보강 작업과 기존 설치·dist를 보존하고, 별도 시각 고정 사본에서 Windows x64 Preview 0.4.0의 Platform·WORLD·Messenger 패키지 세 개를 만들었다. [후보 안내](../../../../desktop/artifacts/member-home-auth-candidate-2026-10-08T10-09-17-054Z/HANDOFF.md), [해시·검증 결과](../../../../desktop/artifacts/member-home-auth-candidate-2026-10-08T10-09-17-054Z/candidate-summary.json)에 정확한 파일을 기록했다.

원본 81파일과 세 ASAR의 바이트 일치, 사본 시험 **223/223**, 실제 ASAR 회원 홈 **25/25**를 통과했다. 변경하지 않은 Platform EXE를 별도 AppData 프로필에서 숨김 실행해 정상 부팅·암호화 저장 왕복·외부 요청 0·콘솔 오류 0을 확인했다. NSIS 설치 파일 실행, 기존 앱 교체, 코드 서명, 공개 배포는 하지 않았다.

초기 후보의 `runtime.auth=null`을 확인해 기존 공개 인증 설정을 명시한 **새 고정 후보**로 세 앱을 다시 빌드했다. 세 패키지의 인증 설정은 기존 중앙 등록 9종 및 공개 ID 설정과 일치하며, 실제 EXE는 별도 프로필에서 `configured:true / signed-out`으로 정상 부팅했다. 인증 포함 후보의 회원 홈 단위 검사 **7/7**, 실제 ASAR 동작 **25/25**를 통과했다. 최초 화면 캡처의 `UnknownVizError`와 순차 재실행 성공도 후보 안내에 남겼다.

현재 후보는 인증 설정을 포함한 개발용 Preview이며 WORLD/Messenger는 개발용 loopback 서버를 사용한다. 회원 홈 동작은 합성 계정으로 확인했으므로 실제 계정 로그인 완료나 정식 배포본으로 보지 않는다. 설치 실행·중앙 계정 등록 변경·공개 게시 없이 기존 등록을 재사용했다. 이전 후보와 공용 소스는 보존했다.

### 후속 요청으로 실제 설치한 플랫폼 · 첫 설치

사용자는 위 홈페이지·PC 작업실 적용 완료와 “회원 홈 설치본 준비, 실제 설치와 외부 고객용 서버 연결 남음”을 안내한 뒤 **“이어서 해”**라고 요청했다. 기존 후보와 최신 원본을 다시 대조해 로그인 준비 중 취소·로그아웃·중복 요청 경합을 보강한 `auth-service.cjs` 변경을 포함한 새 사본을 만들었다. 진행 중이던 계정 보강 작업의 5차 회귀 완료도 확인했다. 이전 후보를 최신 설치본으로 사용하지 않았다.

- 설치 후보: `desktop/artifacts/member-home-install-candidate-2026-10-08T10-41-54-944Z`, 원본 81파일의 sourceHash `526a140469024459f8a32201bf4a39979953a343266e25762604488d69589dfa`.
- 실제 설치: 2026-10-08 **19:49:53~19:50:44 KST**, 현재 사용자용 NSIS `/S /currentuser`, 종료 코드 0. 설치 위치는 `C:/Users/q1212/AppData/Local/Programs/SYNKPlatformPreview`다.
- 설치 파일 SHA-256: `7b3fa6112548e7c46fb72206909b97e7bab06884dcc2687dc3a0ba7df5447c6f`. [설치 실행 결과](../../../../desktop/artifacts/member-home-install-candidate-2026-10-08T10-41-54-944Z/artifacts/install-result.json).
- 바탕화면과 시작 메뉴에 **SYNK Platform Preview** 바로가기가 생겼고 실제 설치 경로를 가리킨다. 설치 레지스트리·EXE·ASAR·81개 원본·인증 설정 9종·동봉 자식 설치 파일의 해시를 대조했다. [설치 파일 확인](../../../../desktop/artifacts/member-home-install-candidate-2026-10-08T10-41-54-944Z/artifacts/installed-package-verification.json), [등록·바로가기](../../../../desktop/artifacts/member-home-install-candidate-2026-10-08T10-41-54-944Z/artifacts/installed-registration.json).
- 원래 Preview 프로필 **85파일, 32,386,634바이트**를 현재 사용자와 SYSTEM만 접근하는 별도 백업에 보존했다. 설치 직후 첫 실행 전과 격리 검사 후에도 원본·백업 전체 해시가 같았다. 원래 프로필과 로그인 정보를 복원·초기화하지 않았다. [보존 결과](../../../../desktop/artifacts/member-home-install-candidate-2026-10-08T10-41-54-944Z/artifacts/profile-post-isolated-run.json).
- 새 고정 소스 시험 **228/228**, 실제 ASAR의 회원 홈 **25/25**, 설치된 경로의 **변경하지 않은 EXE**를 격리 프로필로 실행한 검사 모두 통과했다. `configured:true / signed-out`, 암호화 저장 왕복, 외부 요청·콘솔 오류 0을 확인했다. [실제 설치 EXE 실행](../../../../desktop/artifacts/member-home-install-candidate-2026-10-08T10-41-54-944Z/artifacts/installed-package-isolated-smoke.json).

이번 설치는 개인 PC의 개발용 Preview다. 정식 코드 서명·공개 배포·실제 SYNK ID 로그인·실물 두 기기 왕복 검증을 뜻하지 않는다. WORLD/Messenger 설치 파일은 동봉됐으며 두 앱을 추가 설치하지 않았다. 두 앱의 Preview 주소는 기존 개발용 loopback을 유지한다.

후속 일반 실행에서는 처음 창이 확인되지 않아 성공으로 기록하지 않았다. 설치 파일을 바꾸지 않고 기존 인스턴스에 정상 실행을 전달한 뒤 PID 15588의 `SYNK Platform` 창이 표시된 것을 확인했다([일반 실행 기록](pc-live/platform-normal-launch.json)). 숨김 검사와 일반 창 표시는 별도 증거이며, 이 확인에서 로그인하거나 개인 기록을 작성하지 않았다.

### 로그인 갱신 보호를 포함한 후속 업데이트

첫 설치 뒤 공유 원본에 [계정 6차 보강](../platform-account-audit-20261008/ROUND6.md)이 추가됐다. 정상 토큰 갱신 중 기존 계정 조회가 늦게 돌아왔을 때 로그아웃되거나 예전 이름·권한이 다시 표시되는 문제를 막는 `auth-service.cjs` 1파일 변경이다. 이를 포함한 새 고정 후보 `desktop/artifacts/member-home-round6-candidate-2026-10-08T11-06-44-757Z`를 만들고 **230/230** 시험·회원 홈 ASAR **25/25**를 통과했다. sourceHash는 `86f2c291090030a9f8919eecd8f28f989407ccb8104a90ae7cc4db98c2f6549e`다.

원래 플랫폼 창을 `CloseMainWindow`로 정상 종료했다. 최초 10초 대기에는 완료되지 않았으나 뒤 재조회에서 설치 경로의 모든 프로세스가 종료된 것을 확인했고 강제 종료하지 않았다. 정상 사용 뒤의 프로필 **90파일, 33,569,383바이트**를 새 보호 백업으로 보존한 뒤 **20:18:43~20:19:26 KST**, 같은 0.4.0 Preview 설치본을 갱신했다. 설치 파일 SHA-256은 `e020e9e17bebb5be3ee285181773144e5f760652abc4349dbf76ff12dc4dfc4b`, 설치 종료 코드 0이다.

업데이트 직후에도 프로필 90파일의 원본·백업 해시가 정확히 같았다. 실제 설치된 EXE·ASAR·81원본·인증 설정·동봉 자식 설치 파일은 새 후보와 일치했다. [업데이트 실행](../../../../desktop/artifacts/member-home-round6-candidate-2026-10-08T11-06-44-757Z/artifacts/install-result.json), [설치된 파일 검증](../../../../desktop/artifacts/member-home-round6-candidate-2026-10-08T11-06-44-757Z/artifacts/installed-package-verification.json), [프로필 보존](../../../../desktop/artifacts/member-home-round6-candidate-2026-10-08T11-06-44-757Z/artifacts/profile-post-install-before-run.json)을 남겼다. 최초 설치·프로필 백업도 이력으로 보존했다.

설치된 EXE의 격리 실행은 첫 화면 캡처 `UnknownVizError`를 별도 보존하고 순차로 한 번 재실행해 통과했다. 제품 바이트 변경 없이 종료 코드 0, 인증 설정 정상·비로그인 상태, 외부 요청·콘솔 오류 0을 확인했다. 격리 실행 후에도 원본 프로필 90파일은 백업과 동일했다. [실제 설치 EXE 검사](../../../../desktop/artifacts/member-home-round6-candidate-2026-10-08T11-06-44-757Z/artifacts/installed-package-isolated-smoke.json), [검사 후 프로필](../../../../desktop/artifacts/member-home-round6-candidate-2026-10-08T11-06-44-757Z/artifacts/profile-post-isolated-run.json).

20:25:15 KST에는 실제 사용자 프로필로 정상 실행해 **PID 39628의 SYNK Platform 창이 표시된 것**을 확인하고 열어 두었다([일반 창 확인](pc-live/platform-round6-normal-launch.json)). 직접 로그인하거나 개인 기록을 추가하지 않았다. 정상 실행 뒤 앱이 갱신하는 캐시는 앞의 설치 전후 동일성 검사와 구분한다. [최신 설치 인계 기록](../../../../desktop/artifacts/member-home-round6-candidate-2026-10-08T11-06-44-757Z/HANDOFF.md).

### WORLD·Messenger 후속 설치와 연결 상태

추가 “이어서 해” 요청으로 Platform에 동봉된 같은 6차 고정 후보의 **WORLD·Messenger Preview 0.4.0**도 현재 사용자에게 설치했다. 20:42 KST 두 설치가 종료 코드 0으로 끝났으며 각 EXE·ASAR·81개 실행 원문·계정 설정·등록·바로가기를 확인했다. 설치된 Platform의 실제 설치 판정 코드와 카탈로그는 둘 다 `installed / canLaunch:true`를 반환했다. 이는 실제 런처 버튼 클릭이나 서비스 화면 사용 완료를 뜻하지 않는다. [후속 인계 기록](desktop-clients/HANDOFF.md), [설치·플랫폼 인식](desktop-clients/installed-verification.json).

기존 WORLD **67파일**과 Messenger **83파일**을 별도 보호 백업에 보존했고 설치 및 격리 실행 뒤 원본 해시가 모두 같았다([프로필 보존](desktop-clients/profile-post-smoke.json)). 각 설치 EXE의 격리 화면 검사는 연결 서버가 꺼져 `ERR_CONNECTION_REFUSED`로 실패했다. 이를 설치 성공과 구분하며, 실제 앱 화면·로그인·메신저 송수신 성공으로 기록하지 않는다.

WORLD의 공식 로컬 서버 시작 명령은 실행 도구에서 거절됐다. 사용자에게 정확한 명령과 범위를 설명한 뒤 **“WORLD 로컬 서버 시작”** 승인을 받았지만, 재시도 역시 프로세스 생성 전에 `blocked by policy`로 거절됐다. 구체적인 사유는 반환되지 않았으며 다른 경로로 우회하지 않았다([차단 기록](desktop-clients/world-start-blocked.json)). 후속 설정 점검에서도 명시적 deny를 찾지 못했으므로 ‘자동 승인 검토’가 원인이라는 앞선 단정은 정정한다. 어느 정책 계층의 판정인지는 미확인이고 사용자 승인 부족은 아니다. Platform 정상 창은 다시 열었으며 실제 SYNK ID 로그인 완료는 아직 확인되지 않았다.

### 연결 복구와 7차 계정 보강 업데이트

서버에 연결하지 못한 앱을 닫았다 열어야 했던 문제를 고쳤다. 이제 기존 SYNK 자산을 쓰는 안내 화면에서 **다시 연결**을 누르면 해당 앱에 고정된 원래 주소만 재시도한다. 안내가 열린 상태에서 앱을 다시 실행해도 재시도하며, 정상 화면은 이 동작만으로 새로고침하지 않는다. 취소·하위 프레임·오래된 이동 실패는 새 화면을 덮지 않는다. 안내에서는 스크립트·외부 연결·계정 IPC를 허용하지 않는다.

- 고정 후보: `desktop/artifacts/connection-recovery-candidate-2026-10-08T12-19-40-726Z`, sourceHash `f5ce616f99600a21c0f741832bc6dd21f9559c7da58155d097883b3d130d4a07`. 6차 설치 대비 main/auth-service 변경과 연결 모듈 2개 추가, 실행 원본 총 83파일. [후보·설치 인계](../../../../desktop/artifacts/connection-recovery-candidate-2026-10-08T12-19-40-726Z/HANDOFF.md).
- 고정 원본 전체 시험 **254/254**, 새 Platform ASAR 회원 홈 **25/25**, 합성 Electron 연결 복구 **14/14** 통과. 합성 검사는 TCP 서버 없이 로컬 프로토콜 응답으로 실패·성공·키보드 재시도를 검증했다. [회원 홈](../../../../desktop/artifacts/connection-recovery-candidate-2026-10-08T12-19-40-726Z/artifacts/member-home-asar-20261008.json), [연결 복구](../../../../desktop/artifacts/connection-recovery-20261008/native-connection.json).
- 실제 후보 WORLD·Messenger EXE는 격리 AppData에서 각 **11/11** 통과했다. 꺼진 고정 loopback 주소를 최초·재시도 각 한 번 요청한 뒤 안내로 돌아왔다. 실제 응답 CSP, 거절되는 계정 IPC, 자산 표시·고정 재시도 주소를 확인했고 EXE/ASAR 바이트는 바꾸지 않았다. 실행 전 메모리에는 격리 경로·숨김 창·QA 관찰만 넣었다. [WORLD 후보](../../../../desktop/artifacts/connection-recovery-20261008/package-world-candidate.json), [Messenger 후보](../../../../desktop/artifacts/connection-recovery-20261008/package-messenger-candidate.json).
- 기존 Platform PID 21084를 `CloseMainWindow`로 정상 종료한 뒤 모든 해당 앱 프로세스가 종료됐음을 확인했다. 강제 종료하지 않았다. WORLD **67파일**, Messenger **83파일**, Platform **102파일**을 현재 Windows 사용자와 SYSTEM만 접근하는 새 백업에 보존하고 원본·백업 전체 해시를 대조했다.
- **21:29:04~21:30:15 KST**, WORLD→Messenger→Platform 순서로 `/S /currentuser` 업데이트를 실행해 모두 종료 코드 0이었다. 설치 EXE·ASAR는 검증한 후보와 같고 등록 3개·바로가기 6개, 원래 프로필 세 개의 바이트 동일성도 확인했다. [설치 실행](../../../../desktop/artifacts/connection-recovery-candidate-2026-10-08T12-19-40-726Z/artifacts/update-install-results.json), [설치·프로필 보존](../../../../desktop/artifacts/connection-recovery-candidate-2026-10-08T12-19-40-726Z/artifacts/update-installed-state.json).
- 실제 설치 경로의 [WORLD EXE 오프라인 검사](../../../../desktop/artifacts/connection-recovery-20261008/package-world-installed.json)도 **11/11** 통과했다. Platform 설치 EXE는 첫 화면 캡처의 `UnknownVizError`를 [실패 원문](../../../../desktop/artifacts/connection-recovery-candidate-2026-10-08T12-19-40-726Z/artifacts/platform-installed-boot-2026-10-08T12-34-24-039Z.json)으로 보존하고 같은 파일의 순차 재검사 한 번이 통과했다. 실제 ASAR 회원 홈·로그인 안내, 인증 설정 정상·로그아웃 상태, 외부 요청/콘솔 오류 0, 임시 암호화 저장 왕복을 확인했다. [통과 결과](../../../../desktop/artifacts/connection-recovery-candidate-2026-10-08T12-19-40-726Z/artifacts/platform-installed-boot-2026-10-08T12-37-23-271Z.json), [실제 설치 EXE 캡처](../../../../desktop/artifacts/connection-recovery-candidate-2026-10-08T12-19-40-726Z/artifacts/platform-installed-boot-2026-10-08T12-37-23-271Z.png). 격리 AppData의 설치 목록은 실제 사용자 설치 목록을 대신하지 않는다.

이 설치에는 계정 7차 보강까지 포함한다. 동결 후 다른 작업에서 수정 중인 회원 홈·초안 보호 코드는 이 후보에 합치지 않았고 별도 해시로 기록했다. 정식 서명·공개 설치본 배포·실제 회원 로그인·서버 운영 복구는 이번 설치 검증에 포함하지 않는다. 차단된 WORLD 서버 명령을 재시도하거나 다른 경로로 실행하지 않았다.

21:44 KST 격리 검사 종료 후에도 WORLD67·Messenger83·Platform102파일의 원본 해시가 설치 전과 같았다([최종 프로필 확인](../../../../desktop/artifacts/connection-recovery-candidate-2026-10-08T12-19-40-726Z/artifacts/profile-post-qa.json)). 이후 21:48 KST 설치된 Platform을 원래 프로필로 정상 실행해 **PID20068의 SYNK Platform 창**을 열어 두었다([일반 창 확인](../../../../desktop/artifacts/connection-recovery-candidate-2026-10-08T12-19-40-726Z/artifacts/platform-normal-launch.json)). 이 정상 실행 뒤의 캐시 변경은 앞의 보존 검사와 구분한다.

### 실제 메신저에서 발견한 SYNK ID 이름 충돌

연결된 설치 Messenger의 격리 로그인 첫 화면은 표시됐고 user:null·빈 입력·CSP·가로 넘침 등 8항목은 통과했다. 하지만 **`Identifier 'synkDesktop' has already been declared` 콘솔 오류로 전체 검사는 실패**했다([실제 결과](../../../../desktop/artifacts/connection-recovery-20261008/package-messenger-installed-connected.json), [캡처](../../../../desktop/artifacts/connection-recovery-20261008/package-messenger-installed-connected.png)). 회사 classic script의 전역 `const synkDesktop`가 Electron의 비구성 `window.synkDesktop` 브리지와 충돌해 SYNK ID 보조 로그인 단추를 만들지 못했다. 실제 로그인·업무 API 호출은 하지 않았다. 처음 허용목록에서 빠진 로그인 이미지 두 개에 대한 검사 실패와 서버가 켜져 오프라인 전제가 달라진 검사도 원문으로 보존했다.

이 문제는 회사 로그인 helper를 `getSynkDesktopBridge()`로 바꾸고 공개 `window.synkDesktop`는 보존하는 두 파일 후보로 준비했다. 서버가 원문을 직접 읽으므로 검수 요청 전에는 `.tmp/company-desktop-bridge-fix-20261008/workspace`에만 수정했다. 변경 전 동일 SyntaxError, 변경 후 기존11개+새 회귀1개 **12/12**를 확인했다. [정확한 후보·해시·차이](../../../../.tmp/company-desktop-bridge-fix-20261008/HANDOFF.md).

21:50 KST 공식 Claude Code 2.1.292, `--model claude-opus-5-5 --effort max`의 읽기 전용 최종검수는 **exit1·is_error:true·모델 사용 없음**으로 세션 한도에 막혔다. 재개 안내는 자정 Asia/Seoul이다([검수 원문](../../../../.tmp/company-desktop-bridge-fix-20261008/claude-review.json)). 검수 통과가 아니다. AI 운영 원칙의 라이브 반영 최종검수 요구를 설명하고 이 두 파일의 현재 PC 적용에만 한정한 예외를 요청했으며, 사용자가 **“이번 수정만 적용”**으로 명시 승인했다. 기존 쇼룸·PC 최초 반영의 예외나 WORLD 실행 도구 차단과는 별개다.

**21:57 KST 적용:** 회사 `public/synk-id.js`와 `synk-id-client.test.mjs`가 후보 작성 때의 원본 SHA와 일치하는지 다시 확인하고 두 원본을 백업했다. 승인한 후보 바이트로 원자 교체했고 source SHA `823dfe02aa5836118a90ce8833e8054a8db829bae4a840bcffa1d536b5cbc52c`, 시험 SHA `e418bdde32beb5b25a0e84163fa35da7e7d190a72c60281890c24427b8616d73`가 일치했다([적용 결과](../../../../.tmp/company-desktop-bridge-fix-20261008/apply-result.json)). 21:58 실제 4191 `/synk-id.js`의 HTTP200 바이트도 후보와 같고 회사 health는 ready였다([HTTP 대조](../../../../.tmp/company-desktop-bridge-fix-20261008/served-file-verification.json)). 서버 재시작·데이터·계정·클라우드 고정 후보는 변경하지 않았다. 클라우드 후보에는 이 후속 두 파일 변경이 아직 들어 있지 않다.

**실제 설치본 재검사 완료:** Messenger의 SYNK ID 보조 단추 표시·비로그인 상태·빈 입력·CSP·가로 넘침·EXE/ASAR 불변을 포함한 **8/8, exit0**이 통과했고 콘솔 오류는 0이다. 요청69개는 모두 GET이고 API는 `/api/me`, `/api/synk-id/status`뿐이었다. 실제 계정 입력·로그인 클릭·업무 API·외부 요청은 없다. [수정 후 실제 설치 EXE 결과](../../../../desktop/artifacts/connection-recovery-20261008/package-messenger-installed-connected-after-bridge-fix.json), [화면](../../../../desktop/artifacts/connection-recovery-20261008/package-messenger-installed-connected-after-bridge-fix.png). 새 단추의 cream 자산 허용목록 누락과 첫 캡처 오류는 보존하고 QA 목록만 수정한 순차 재검사가 통과했다. 실제 제품 파일을 재검사에 맞춰 바꾸지 않았다. WORLD67·Messenger83파일 원본 해시도 그대로였다.

현재 회사 서버의 SYNK ID 설정은 `enabled:false / browserEnabled:false`라서 단추가 **연결 준비 중**으로 비활성 표시된다. 이름 충돌 수정과 실제 로그인 연결 완료는 다르며 계정·설정은 변경하지 않았다. 22:03 읽기 점검에서 WORLD4280은 여전히 꺼져 있고, Platform 설치 메타데이터는 다른 후속 작업의 `3079b9ed56ad8c64620327fed3ad911331732a86e4abb2de5f455617ffe40033`으로 갱신되어 있었다. 이를 덮어쓰거나 재실행하지 않았으며 이 기록의 f5 검증을 후속 설치본 검증으로 사용하지 않는다. [후속 환경 관찰](../../../../.tmp/company-desktop-bridge-fix-20261008/environment-after-apply.json).

### 회사 SYNK ID 설정 준비와 외부 이전 대기

22:28 KST, 회사 실행 프로세스에 기존 직원용 공개 설정 4개가 전달되지 않아 `enabled:false / browserEnabled:false`였음을 확인했다. 공식 `start-company.ps1`이 사용자별 `SYNK/Company/synk-id.public.env`를 선택적으로 읽는 최소 후보를 별도 폴더에 준비했다. 실제 Node 설정 파서와 격리 Windows PowerShell의 경로·옵션·오류·출력 검사는 **8/8** 통과했다. 원본 launcher SHA `e0c7157b…70d5f1`, 후보 SHA `3e445afd…b184b9`이며 실제 원문·사용자 환경·서버·DB·계정에는 적용하지 않았다. [후보와 범위](../../../../.tmp/company-synk-id-enable-20261008/HANDOFF.md), [시험 결과](../../../../.tmp/company-synk-id-enable-20261008/verification.json).

공식 회사 OAuth 도구를 `--apply` 없이 실행해 dry-run exit0·제품 매핑 일치를 확인했고, 기존 공개 키로 인증 설정 GET200을 확인했다. 인증 설정 응답 본문은 저장하지 않았고 키는 로그에 출력하지 않았다. 당시 새로 받은 공개 포털에는 기존4191 콜백이 있었다. 이후 별도 이전 작업이 공개한 포털을 **22:36 새 GET으로 재확인**해 기존4191과 새 `workspace.synk.im` 콜백이 모두 있는 것을 확인했다. 22:28 증거를 덮어쓰지 않았다. [기존 등록 확인](../../../../.tmp/company-synk-id-enable-20261008/remote-readonly-result.json), [공개 반영 후 대조](../../../../.tmp/company-synk-id-enable-20261008/portal-postpublish-2026-10-08T13-36-01-250Z-result.json). 콜백 등록은 실제 직원 로그인·계정 연결의 증거가 아니다.

**적용 보류 이유는 동시 진행 중인 서버 이전이다.** 최신 PC 서버는 별도 승인된 메신저 후속판262파일과 앞서 승인한 로그인 helper 변경으로 구성되어 있었으며, 외부 이전 작업이 PID11088을 22:32:56 KST에 기존 SIGTERM 처리기로 정상 종료했다. 22:36 읽기 점검에서도 4191·4197·4280 리스너가 없었다. 이 작업에서는 서버 종료·재기동·설정 설치·계정 연결을 하지 않았으며 WORLD의 정책 거절 명령도 재시도하지 않았다. [정지 근거](../../../../.tmp/company-cloud-20261008/final-cutover-stop-result.json), [현재 서비스 관찰](../../../../.tmp/company-synk-id-enable-20261008/service-dependency-status.json).

로컬 후보는 외부 이전 완료 뒤 필요성을 다시 판단할 수 있도록 보존한다. 기존 두 파일의 Claude 검수 예외를 새 후보로 확대하지 않았고, 같은 세션 한도로 검수를 반복 요청하거나 새 예외 승인을 요청하지 않았다. 다음 확인은 별도 이전 작업의 확정 릴리스·HTTPS 운영 결과와 실제 직원 로그인이다. PC용 후보를 먼저 적용해 이전용 원본을 다시 쓰게 만들지 않는다.

**22:37 KST 통합 후보 대조:** 외부 이전 작업의 새 `release-messenger-current` 후보는357파일·manifest SHA `528be58c…e913e8b8`, 상태는 `frozen-awaiting-linux-verification`이었다. 고객 프로젝트·접수·최신 업무 흐름·브랜드/품질·백업/미디어·화면·서버·로그인 관련14파일을 읽어 원문·manifest와 모두 일치하며 누락이 없음을 확인했다. 앞서 적용한 로그인 helper SHA `823dfe02…cbc52c`도 포함됐다. 읽는 동안 manifest는 바뀌지 않았다. 이 확인은 후보의 기능 보존 증거이며 Linux 검사·운영 배포 증거가 아니다. 회원 홈과 공개 쇼룸은 별도 설치·공개물로 이 회사 서버 manifest 범위에 넣지 않았다. [후보 포함 대조](../../../../.tmp/company-synk-id-enable-20261008/cloud-candidate-readonly-2026-10-08T13-37-26-973Z.json).

### PC 재시작 뒤 확인 · 23시

PC 부팅 시각은 **2026-10-08 22:45 KST**다. Platform·WORLD·Messenger 설치본은 모두 후속 후보 `3079b9ed…0033`의 Preview0.4.0이고 자식 EXE/ASAR는 설치 Platform의 등록 해시와 일치했다. 원래 프로필을 열지 않는 별도 AppData에서 실제 설치 WORLD와 Messenger를 순차 실행해 오프라인 연결 안내·재시도 각각 **11/11**, 콘솔 오류0, EXE/ASAR 불변을 확인했다. 새 증거로 저장했으며 이전 f5 검사에 합산하지 않는다. [설치 대조](../../../../desktop/artifacts/post-reboot-2026-10-08T14-02-23-100Z/installed-inventory.json), [WORLD](../../../../desktop/artifacts/post-reboot-2026-10-08T14-02-23-100Z/package-world-installed.json), [Messenger](../../../../desktop/artifacts/post-reboot-2026-10-08T14-02-23-100Z/package-messenger-installed.json). 서버 기동·계정 로그인·설치 업데이트는 수행하지 않았다.

공개 쇼룸은 기존 사용자 IAB 탭에서 네 이미지 로딩, 브랜드·제작 필터1건과 전체4건 복원, 관찰된 콘솔 오류0을 확인했다. 한 뷰포트의 표시 확인이며 모든 반응형·링크 목적지 재검사로 확대하지 않는다. [읽기 기록](../../../../desktop/artifacts/post-reboot-2026-10-08T14-02-23-100Z/public-showroom-readonly.json), [화면](../../../../desktop/artifacts/post-reboot-2026-10-08T14-02-23-100Z/public-showroom.jpg).

재부팅으로 이전 보호 프로세스33032는 사라졌지만, 이전 담당 작업이23:01:43에 새17032로 원본 보호를 재확보했고23:04 실제 프로세스·7파일 보호·위반0을 확인했다. 동시 갱신 중 읽기 시점이 섞였던 최초 결과는 덮어쓰지 않고 후속 정정 기록을 남겼다. [새 보호 관찰](../../../../.tmp/company-synk-id-enable-20261008/post-reboot-guard-followup-20261008T140458392Z.json).

그 뒤 **별도 이전 작업의 결과 파일**에서23:05 HTTPS 준비와23:07 첫 운영 백업·외부 보관·독립 복구 검증 성공, 회사 브라우저 바로가기2개의 클라우드 주소 전환을 확인했다. [HTTPS 준비](../../../../.tmp/company-cloud-20261008/public-https-readiness-result.json), [첫 운영 백업 인수](../../../../.tmp/company-cloud-20261008/live-first-backup-acceptance-result.json), [바로가기 전환](../../../../.tmp/company-cloud-20261008/pc-cloud-shortcuts-result.json). 이 채팅의 추가 외부접속 검사는 에이전트 네트워크 권한 철회 오류로 중단됐으므로 이 기록을 자체 HTTP 재검사로 표현하지 않는다.23:12에는 직원 로그인 준비가 미완료였으나, **23:23 담당 결과에서 실제 직원 로그인·본인 메모 저장·111바이트 시험 첨부의 Drive 업로드와 다운로드 SHA 일치를 확인했다.** 다른 사람에게 메시지를 보내지 않았다. 해당 결과의 `cloudDataRestartPersistencePending:true`에 따라 최신 데이터의 재시작 후 유지는 별도 확인으로 남긴다. [직원 실제 사용 기록](../../../../.tmp/company-cloud-20261008/live-staff-browser-result.json). 로컬 설정 후보를 설치해 PC 원본 서버를 다시 켜지 않는다.

### 설치형 Messenger의 클라우드 연결 후보

23:19 KST, 별도 `.tmp/messenger-cloud-preview-20261008/workspace`에서 기존 Messenger Preview가 정확한 `https://workspace.synk.im/?tab=messenger`를 사용할 수 있는 최소 후보를 완성했다. 명시적인 Messenger·development 빌드 옵션과 runtime boolean이 함께 있어야 허용하며 임의 주소·WORLD·Platform·release 우회는 거부한다. 기존 Preview 식별자·native SYNK ID 등록·암호화 저장 경계·정식판 코드 서명 요구를 유지한다. main의 초기 검증과 연결 실패 화면에도 같은 표지를 전달한다.

구현5파일·시험2파일의 최종 선택 회귀는 **44/44**, 실패·생략0이다. 실제 main을 모의 Electron으로 실행해 올바른 runtime 수용·잘못된 runtime의 창 생성 전 거부·고정 주소 재시도를 확인했다. 독립 읽기 검토에서 수정 요청은 없었다. mock 요청·단위 시험은 실제 공개 서버의 Secure 쿠키 왕복이나 설치 EXE 로그인 증거가 아니다. [후보 manifest](../../../../.tmp/messenger-cloud-preview-20261008/manifest.json), [최종 시험](../../../../.tmp/messenger-cloud-preview-20261008/final-regression.log), [최소 변경분](../../../../.tmp/messenger-cloud-preview-20261008/candidate.patch), [읽기 검토·인수 조건](../../../../.tmp/messenger-cloud-preview-20261008/REVIEW.md).

공유 원문과 실제 설치본에는 적용하지 않았다. 별도 진행 중인 플랫폼 최종 후보에 변경 원본 SHA를 대조해 합치고, 새 Messenger EXE/ASAR와 Platform의 등록 해시·동봉 설치본을 함께 갱신해야 한다. 기존 설치본3079의 오프라인 검사와 이 코드 후보의44개 시험은 다른 대상이다. 공개 서버의 실제 `/synk-id.js` 바이트와 격리 앱 첫 화면·로그인은 후속이며, 앞선 두 파일의 검수 예외를 새 후보로 확대하지 않는다.

사용자 **“전달해서 함께 반영”** 승인으로 **SYNK 플랫폼 기능 보강** 채팅에7파일 패치·검토·QA 사본을 전달하고 통합 빌드·설치를 맡겼다. 최신 `platform-continuity-candidate-2026-10-08T14-12-34-974Z`와 공유 원문은 기존6파일 원본 SHA 일치·신규 시험1파일 없음·충돌0이었다([병합 전 대조](../../../../.tmp/messenger-cloud-preview-20261008/merge-preflight-2026-10-08T14-25-12-731Z.json)). 전달은 통합 설치 완료가 아니다. 사용자가 현재 휴대폰 사용은 어렵다고 답해 PC 종료 상태의 실물 휴대폰 검증은 미완료로 남겼다.

### 23:42 통합 후보의 실제 HTTPS 화면과 서버 재부팅

플랫폼 담당이 이어쓰기 후보에7파일을 병합해 sourceHash `6f6702e3824fc1d853da4525ed1d57c8fcc3307eb641c02099e7ced017d35e39`의 세 앱을 다시 묶었다. 고정 전체 시험 **275/275**, 세 앱 ASAR·기존 인증 설정·Platform 자식 해시 대조를 통과했다([통합 후보](../../../../desktop/artifacts/platform-cloud-candidate-2026-10-08T14-36-18-911Z/CLOUD-CANDIDATE.md)). 제품 후보44개와 전체275개는 합산하지 않는다.

별도 읽기 QA 사본에서 `href="#main"`을 정적 경로 `/`로 잘못 넣는 문제를 실행 전에 수정했다. 실제 자산 태그만 수집하고 요청 검사에서도 루트를 거절하며, 실제 회사 index 기반 회귀 포함 **6/6**과 독립 재검토를 통과했다([QA 검토](../../../../.tmp/messenger-cloud-preview-20261008/qa/REVIEW.md)). 플랫폼 담당이 이 사본으로 **실제 Messenger 후보 EXE의 HTTPS 첫 화면8/8**을 확인했다. 익명 세션·SYNK ID 단추·Node 격리·넘침0·콘솔 오류0·허용 밖 요청0·EXE/ASAR 불변이며 기존 프로필을 열거나 실제 로그인하지 않았다([실제 후보 검사](../../../../.tmp/messenger-cloud-preview-20261008/qa/runs/2026-10-08T14-42-03-955Z/package-messenger-candidate-connected.json), [화면](../../../../.tmp/messenger-cloud-preview-20261008/qa/runs/2026-10-08T14-42-03-955Z/package-messenger-candidate-connected.png)).

회사 서버 담당의 결과에서 운영 VM 재부팅 뒤 수동 시작 없이 서비스·공개 HTTPS가 돌아왔고, 실제 브라우저에서 직원 로그인·본인 메모·Drive 첨부111바이트와 SHA, 고객 로그인·조건 없는 상담 복원을 확인했다. 직원/고객 권한 분리도 유지됐다([자동 복구](../../../../.tmp/company-cloud-20261008/production-vm-reboot-result.json), [재부팅 후 실제 사용](../../../../.tmp/company-cloud-20261008/post-reboot-browser-acceptance.json)). 마운트 대상·형식·옵션은 같지만 장치 이름이 `/dev/sdb`에서 `/dev/sda`로 바뀌어 결과의 `persistentMountUnchanged`는 false다. 해당 기록에는 전후 UUID가 없으므로 안정적인 디스크 식별자까지 대조했다고 표현하지 않는다. 서비스와 위 실제 데이터의 유지 확인은 이 한계와 구분한다. 예약 시각 백업의 실제 관측과 실물 휴대폰 검증은 아직 남아 있다.

### 23:47 통합 설치와 설치본 검증

사용자가 플랫폼 창을 직접 닫은 뒤, 플랫폼 담당이 위 `6f6702e3…`의 WORLD·Messenger·Platform Preview를23:45~23:46 현재 PC에 설치했다. 설치3개 모두 종료 코드0이며 EXE·ASAR·실행 원본·공개 인증 설정·Platform 동봉 자식 설치본과 해시가 고정 후보와 일치한다. 설치된 Platform의 자식 앱 판정도 통과했다([설치 결과](../../../../desktop/artifacts/platform-cloud-candidate-2026-10-08T14-36-18-911Z/artifacts/update-install-results.json), [설치 바이트 대조](../../../../desktop/artifacts/platform-cloud-candidate-2026-10-08T14-36-18-911Z/artifacts/installed-update-verification.json)). 이 개인 PC 업데이트는 서버 배포나 설치 파일 공개가 아니므로 AI 운영 원칙의 라이브 최종 검수 예외를 새로 요구하지 않았다.

설치된 Platform EXE의 격리 부팅이 통과했고, **설치된 Messenger EXE**에서도 정확한 회사 HTTPS의 익명 로그인 첫 화면 **8/8**, 콘솔 오류0·차단 요청0·EXE/ASAR 불변을 확인했다. 후보 EXE 검사와 설치 EXE 검사를 구분한다([설치 Platform](../../../../desktop/artifacts/platform-cloud-candidate-2026-10-08T14-36-18-911Z/artifacts/platform-installed-boot.json), [설치 Messenger](../../../../.tmp/messenger-cloud-preview-20261008/qa/runs/2026-10-08T14-46-59-254Z/package-messenger-installed-connected.json)). 기존 사용자 프로필은 열지 않았으며 WORLD67·Messenger83·Platform102파일이 설치 전 보호 사본과 그대로임을 확인했다([검사 후 프로필](../../../../desktop/artifacts/platform-cloud-candidate-2026-10-08T14-36-18-911Z/artifacts/profile-post-qa.json)). 이후 일반 사용자 실행으로 갱신되는 캐시는 이 시점의 보존 증거와 구분한다.

실제 설치 앱의 SYNK ID 로그인 왕복·WORLD 서버 기동·PC 종료 상태 실물 휴대폰·예약 시각 백업 관측은 남아 있다. 브라우저에서 확인한 회사 로그인과 계정 라이브러리2세션 검사를 설치 앱의 OAuth 검증으로 확대하지 않는다.

23:49 최종 인수에서 공개 `/synk-id.js`가 수정 원문과12,529바이트·SHA `823dfe02…cbc52c`까지 같고,23:48 원래 사용자 프로필의 Platform 창이 정상 표시된 것도 확인됐다([담당 설치 기록](../../../../desktop/artifacts/platform-cloud-candidate-2026-10-08T14-36-18-911Z/INSTALLATION.md), [종합 결과](../../../../desktop/artifacts/platform-cloud-candidate-2026-10-08T14-36-18-911Z/artifacts/cloud-install-completion.json)). 이 세션의 Windows 앱 제어가 지원되지 않아 사용자에게 설치 Messenger의 실제 로그인 결과를 물었으며, 답변 전에는 성공으로 표시하지 않는다.

### 10-09 클라우드 현황 갱신

아래 v3·예정 백업·미완료 목록은 10-09 00:26 기준이다. 이후 운영과 설치 결과는 [현재 회사 운영 기록](../../../마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md) 및 [후속 실제 설치·계정 확인](../platform-real-account-20261010/README.md)에서 확인하며 옛 관측기·설치 후보를 재실행하지 않는다.

10-09 00:26 KST 담당 증거를 읽어 현재 상태를 갱신했다. 공개 회사 서버는 Web Push v3 `1965cf4bc2a8`이고, 라운지·접수·브랜드/품질 담당 원문과 UI 9파일은 해당 고정 manifest와 일치한다([현재 원문 대조](core-runtime-current-20261009.json)). 최신 상태는 [담당 handoff](../../../../.tmp/company-cloud-20261008/current-handoff.json)와 [운영 원문](../../../마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md)을 따른다. 이번 갱신은 로컬에 저장된 결과와 코드를 확인한 것이며 새 원격 호출이나 서버 변경은 하지 않았다.

- 현재 v3에서 실제 직원·상담 고객 SYNK ID 로그인, 본인 메모·Drive 첨부111바이트 SHA·글만 적은 상담 초안 보존을 확인했다([실제 브라우저 결과](../../../../.tmp/company-cloud-20261008/push-v3-live-browser-result.json)). `/consultation/` 상담 흐름이며 `/pulse/` 프로젝트 초대·시안 승인·고객 인수 검증을 대체하지 않는다.
- VM 전체 재부팅은 부모 `be219dcc61c9`에서 검증했고 현재 v3는 서비스 재시작과 기록 보존까지 확인했다. 초기 장치 별칭 비교 실패 뒤 별도 [디스크 확인](../../../../.tmp/company-cloud-20261008/production-vm-reboot-storage-result.json)에서 named PD/by-id·ext4 UUID·fstab·실제 volume 일치를 확인했다. 초기 raw 결과는 보존하고 이 후속 근거와 구분한다.
- 00:03에 완성된 v3 백업 객체를 00:19에 독립 다운로드해 SHA를 확인하고 새 비공개 경로에서 두 DB 무결성·행·원래 키·VAPID 암호문·참조 관계를 복구 검증했다([복구 결과](../../../../.tmp/company-cloud-20261008/push-v3-offsite-independent-restore-result.json)). 완료된 온라인 snapshot의 복구 증거이며 현재 데이터의 최신성이나 두 DB의 동일 시점까지 보증하지 않는다.
- 다음 예약 백업 관측값은 03:31:22 KST다. 기존 담당이 03:50 KST에 실행되는 [1회 관측기](../../../../.tmp/company-cloud-20261008/scheduled-backup-observer-install-result.json)를 설치했다. 아직 미래 실행을 확인한 것은 아니며 이 채팅에서 관측기를 중복 설치하지 않는다.
- 사용자가 미룬 실물 휴대폰 시험과 후행 Claude 검수, 설치 Messenger 실계정 로그인 왕복, 정책에 막힌 WORLD 시작은 미완료로 유지한다. Platform 로그인 성공은 사용자 보고이며 계정 동기화 왕복·Messenger 로그인 증거로 확대하지 않는다.

실고객 라운지 인수는 담당자가 합의한 시험 프로젝트의 초대를 직접 전달한 뒤, 고객이 별도 세션에서 일정·시안 열기 → 시간 지정 의견 → 담당자 답변 확인 → 명시적 시안 승인 → 그 승인본에 연결된 최종 파일·사용 안내 확인 → 재접속으로 기록 유지 순서로 확인한다. 직원 내부 메모·접수 원문이 고객에게 보이지 않는지 함께 확인하며, 실제 고객에게 초대나 메시지를 보내는 단계는 이번 코드 검증에 포함하지 않았다.

### 외부 서버 작업과의 연결

아래는 이전 시각별 이력이다. 이 문서의 마지막 당시 상태는 [10-09 현황 갱신](#10-09-클라우드-현황-갱신), 현재 상태는 담당 [CLOUD-OPERATIONS](../../../마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md)를 따른다.

같은 서버의 외부 이전은 **“아틀라스 8종 엔진 최신화 점검”** 채팅에서 진행 중이다. 그 작업에서 이미 준비한 VM·영구 디스크·비공개 백업 저장소를 재사용하며 여기서 중복 인프라를 만들지 않았다. 19:39 KST 고정 후보 대조 결과 공통 실행 파일 **258개 SHA-256이 모두 일치**했고 이번 고객 라운지·고객 관리·브랜드·품질 기능도 포함됐다. [읽기 점검](CLOUD-READONLY.md), [정확한 비교 결과](cloud-release-comparison.json).

후속 20:4x KST 확인에서 별도 작업의 공식 **Opus 5.5 최대 추론 검수는 완료됐고 공개를 막는 P1 한 건이 나왔다.** HTTPS 프록시 뒤에서 여러 사용자의 로그인 제한이 합쳐지는 문제이며 담당 작업이 수정·프록시 경유 검사·재검수를 진행 중이다. 검수 완료와 통과를 구분한다([실제 검수 판정](../../../../.tmp/company-cloud-20261008/claude-review-complete-result.json)). 고정 IP 준비와 시험 백업 왕복, 20:33 KST 시험 장애 알림의 메일 수신도 담당 작업에서 확인했다([알림 수신 증거](../../../../.tmp/company-cloud-20261008/alert-test-status.json)). 실제 데이터 이전·공개 접속 전환은 아직 완료되지 않았다.

20:42 KST 로컬 서비스 재점검에서는 4191·4280의 리스너가 모두 없었다([서비스 점검](desktop-clients/service-preflight.json)). 과거 적용 당시 PID 20072나 더 오래된 PID 12888을 현재 실행 중이라고 취급하지 않는다. 회사 서버 재시작은 같은 서버의 이전 작업과 겹치므로 여기서 실행하지 않았다. 외부 DNS·HTTPS·실데이터 이전·백업/알림 운영·공인 주소 고객 접속의 최종 결과는 [CLOUD-OPERATIONS](../../../마케팅/온라인마케팅지도/engagement/company/CLOUD-OPERATIONS.md)를 따른다.

**21:34 KST 후속 확인:** 회사 서버는 `127.0.0.1:4191`, PID 16268로 다시 응답했고 `/api/health`가 200·`ok:true`·`ready:true`였다. WORLD 4280 리스너는 계속 없었다([새 읽기 점검](desktop-clients/connection-service-status.json)). 여기서는 어느 서버도 시작·종료하지 않았다. 따라서 설치된 Messenger의 오프라인 검사는 전제가 달라진 실패 기록으로 보존하고 연결된 첫 화면 검사와 구분한다. 별도 외부 이전 채팅은 실제 회사·메신저 데이터의 Google Cloud 격리 복구와 원래 키·계정 연결 일치를 보고했지만, 서비스 기동 전 운영 준비 중이며 공개 고객 접속 완료로 보지 않는다. 수정본의 Claude 최종 재검수도 앞서 세션 한도로 보류됐으므로 최초 검수 완료를 최종 통과로 바꾸지 않는다.

## 최종검수 결과와 앞선 쇼룸·PC 서버 반영의 한정 예외

공식 Claude Code 2.1.292에서 `--model claude-opus-5-5 --effort max`를 명시해 고정 쇼룸·회사 후보를 읽기 전용으로 검수 요청했다. [검수 입력](../../../../.tmp/brand-release-20261008/claude-review-prompt.txt)과 [실제 결과 JSON](../../../../.tmp/brand-release-20261008/claude-review.json)을 보존했다.

결과는 **exit 1, is_error=true**, 주간 사용량 제한이었다. 응답의 `subtype=success`는 검수 통과가 아니며 모델 사용 내역도 없었다. 안내된 재개 시각은 **2026-10-12 19:00, Asia/Seoul**이다. 다른 모델로 대체하거나 검수를 완료했다고 기록하지 않았다.

당시 AI 운영 원칙은 “라이브 배포·공개 게시로 나가는 결과만 Claude가 최종 검수”하도록 요구했다. 현재 담당·검증 방식은 [현행 AI 운영 원칙](../../../AI_운영원칙.md)을 따른다. 사용자에게 “이번에 한해 Claude 검수를 생략하고, 쇼룸 공개와 현재 PC 작업실 반영을 진행할까요?”라고 범위를 특정해 물었고, 사용자 “이어서 해” 응답으로 이 한정 반영을 승인받았다. 이번 쇼룸 7파일과 PC 작업실 적용만 GPT 검증 결과로 진행한다. 일반 검수 원칙, 신규 비용·클라우드 생성·실제 고객 메시지 전송 권한으로 확대하지 않는다. Claude 정상 검수는 수행되지 않았다.

## 이 10-08~09 작업에서 완료한 범위와 당시 남은 범위

1. 쇼룸 7파일을 공개했고 Pages·공개 파일·한영 화면을 확인했다. 전체 홈페이지 로컬 변경을 함께 게시하지 않았다.
2. 현재 PC 작업실을 정지 백업 후 검증한 코드로 재시작하고 기존 데이터·계정·메신저·문서·새 메뉴를 확인했다. 실제 고객에게 초대나 메시지를 보내지 않았다.
3. 회원 홈·7차 계정 보강·연결 복구를 포함한 고정 후보로 Platform·WORLD·Messenger Preview를 개인 PC에 업데이트하고 원래 프로필·등록·설치된 실행 파일을 확인했다. 동결 뒤 다른 작업의 후속 소스 변경은 이번 설치와 구분한다. 개발용 Preview를 서명된 정식 배포본으로 표시하지 않는다. 실제 로그인·다른 실물 기기에서의 기록 왕복은 아직 확인하지 않았다.
4. 외부 고객 상시 운영은 별도로 주소·호스팅 사양과 비용·DNS/TLS·영구 저장·접수 연결·외부 기기 확인을 끝낸다. 앞의 쇼룸 공개나 PC 작업실 교체만으로 외부 운영 완료를 선언하지 않는다.
