# Google 후속 검증 · 2026-10-09

[현재 부울 기록과 정확 바이트](FINAL.json). 이전 공개 Google 연결의 증거는 [운영 릴리스](../google-release-20261009/README.md)에 보존한다. 이 문서는 신규 시험·수정 후보·전달·운영 반영을 구분한다.

## 실제 회원가입과 통합 계정

사용자 지정 unmet25 Google 계정으로 시험 가입을 완료했다. 위임된 시험값은 한국·만25세·성별 응답하지 않음·학습 저장 켜기다. 신규 내부 SYNK ID가 만들어졌고, 같은 Google 계정으로 재로그인하면 같은 ID와 학습 선택을 복원하고 가입 폼을 건너뛴다. 서버의 해당 계정 한 행만 SELECT해 등록 정보·개인정보 확인·실제 learning_enabled·날짜·휴대폰 미인증/유예 등20개 조건을 모두 확인했다. 다른 사용자 조회·SQL 변경0, 시험 계정 삭제0이다.

[가입](signup-fields/unmet25-created.json), [재로그인](signup-fields/unmet25-relogin.json), [정확 한 행20/20](signup-fields/PERSISTENCE.md), [WORLD 웹 SSO](signup-fields/unmet25-world-sso.json). WORLD는 로컬4280 서버를 준비해 실제 브라우저 화면에서 중앙 세션 자동 승인·같은 시험 계정 복귀를 확인했다. 이 결과는 Windows EXE 실행의 증거가 아니다. 시험 뒤 주 계정 unmet23의 기존 ID·Google 연결·학습 저장 선택을 복원했다.

## 네이티브 로그아웃 수정

처음 a26 설치 원본의 API 시험은 로그인·같은 ID를 확인했지만 provider refresh 철회는 미확인으로 남았다. 그 기록을 고쳐 쓰지 않았다. 중앙 서버가 provider 종료에 성공했는데 client가 중복 요청을 해 거짓 ‘미확인’을 표시할 수 있는 경로를 합성으로 재현했다.

후보는 중앙 응답의 HTTP 성공·ok/current/refreshRevoked 모두true일 때만 provider 성공을 보존한다. 다른 실패·누락·잘못된 값·일반403에는 원래 fallback을 유지한다. 병행 편의 기능 설치를 d136 기준100개와 대조했고,99개 원본을 보존하면서 auth-service 한 파일만 수정했다. 새9개 포함456/456·adapter6/6, 정확 후보의 실제 PKCE 로그인·현재 시험 세션과 provider refresh 종료 모두 성공했다. 시험 프로세스 종료·temporary 탭 정리 후 [주 계정 보존](signup-fields/main-preserved-after-native-r2.json)도 확인했다.

[수정 후보와 최초 실패 기록](../google-release-20261009/desktop/native-logout-fix-r2/README.md), [실제 API 결과](../google-release-20261009/desktop/native-logout-fix-r2/actual-oauth-result.json). 공식 Opus5.5/max 검수는 완료됐고 native 지적은 없다. 설치 후 실제 동작과 Windows UI·IPC·DPAPI는 별도 확인 조건이다. API 시험을 그 결과로 부르지 않는다.

사용자가 ‘전달해서 최신 설치본에 반영’으로 승인해 보관 상태의 **SYNK 플랫폼 기능 보강** 채팅을 다시 열고 [정확 수정·보존 조건](native-install-handoff.md)을 전달했다. 담당이 정상 종료 확인 뒤22:37:59 KST에 NSIS exit0으로 설치했다. [설치 결과](../platform-native-logout-install-20261009/install-result.json)·[100개 파일/설정/자식 설치 확인](../platform-native-logout-install-20261009/installed-verification.json)을 읽고 root가 현재 설치 metadata의 afe3cad sourceHash와 ASAR fcff152 SHA를 독립 대조했다. 이 채팅은 제품 source·설치본을 직접 변경하지 않았고 담당은 기존 WORLD/Messenger 설치 파일·설정을 보존했다. 설치 후 실제 Windows 로그아웃은 사용자가 ‘지금은 확인하기 어려워’로 보류한 상태다. 설치·격리 부팅·API 후보 성공을 일반 UI·DPAPI·실제 로그아웃 결과로 확대하지 않는다.

## Google 키 교체 도구

관리 API의 불투명 Secret 반환값과 실제 Google 인증을 분리했다. 같은 client의 Secret 한 필드만 교체하고 다른 Auth·Edge 설정을 보존하는 helper에 대해 최초37개와 P2 보완3개 시험, 총40/40을 확인했다. 공식 검수 [전체 후보](combined-official-review.json) 및 [좁은 보완](ops-delta-official-review.json)는 모두 실제 Opus5.5 단일 모델/max 요청/완료/errorfalse다. 보완 코드와 새 시험에는 지적이 없고 P2는 해소됐다.

당시 P3 절차 권고에는 콘솔의 실제 새 발급, 기존 비공개 JSON과 원문 차이, 비교한 새 JSON과 실제 helper 입력 절대 경로의 일치·실행 전 파일 보존 확인이 포함됐다. 이후 사용자가 키 교체를 취소했으므로 이를 남은 실행 작업으로 취급하지 않는다. 마지막 입력 일치 문구는 root가 보완했으며 문구 자체를 다시 Claude 검수했다고 표시하지 않는다. 코드/시험은 검수된 SHA 그대로다. [현재 코드·시험](../google-release-20261009/ops/opus-p2-fix-manifest.json), [취소된 교체의 설계·검증 경계](../google-release-20261009/ops/opaque-rotation-candidate.md).

**사용자 ‘굳이 교체 안해도 돼’에 따라 이번 키 교체를 취소했다.** 새 발급·provider 변경·이전 키 비활성화는 실행하지 않으며 기존 Google 설정을 유지한다. 교체 도구 보완과 검수 결과는 보존하되, 사용자에게 키 생성 조작을 계속 요청하지 않는다. 향후 다시 교체를 요청하면 브라우저의 인증정보 변경 규칙에 따라 직접 조작 및 위 새 발급·원문 차이·동일 helper 입력·설정 보존 확인을 거친다. 이전 키 실제 비활성화 후 Google 코드 교환까지 성공해야 실효성 완료다. 키 값을 채팅·QA·Git에 기록하지 않는다.

## 예약과 남은 확인

- Google 브랜드: 사용자가 실제 Google 로그인 화면의 Supabase 주소 대신 SYNK 표시를 요청했다. 소유권 반영24시간 뒤인10월10일19:56 KST 이후 재검증→Publish branding→실제 Google 계정 선택/동의 화면의 SYNK 이름 확인까지20:00 한 번의 기존 예약 `synk-google`에 명시했다. [현재 원인·공식 근거·반영 단계](../google-brand-label-20261009/README.md). 이번 콘솔 접근은 timeout으로 실제 설정·공개를 완료하지 못했고 로컬 예약은 PC와 Codex가 실행 중이어야 한다.
- 검수 예약 `synk-google-2`: 이 채팅에서 공식 검수와 코드 보완을 완료해 중복 실행을 막도록 비활성화했다.
- 최신 설치본 반영은 완료했다. 실제 Windows 로그아웃은 사용자 요청으로 보류했으며 예약된 Google 브랜드 공개·이름 표시 확인은 미완료다. 키 교체는 사용자 요청으로 이번 범위에서 제외했다.
- 휴대폰 서비스·실문자는 사용자 요청대로 제외한다.

`summary-draft.*`는 검수·실제 후보 OAuth 이전의 초안이며 현재 판정은 이 README와 FINAL을 따른다.
