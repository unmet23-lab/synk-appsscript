# 개발 중 전체 앱 표시 · 2026-10-09

사용자가 unmet23으로 Platform Preview에 로그인했으나 앱이 하나도 보이지 않는다고 알리고, 개발 중에는 지원 앱 전체를 노출하도록 요청했다. 코드에서 로그인 계정의 서버 메뉴 목록이 비면 라이브러리가 0개가 되는 경로를 재현했다. 실제 unmet23의 서버 권한 응답을 읽거나 변경한 것은 아니다.

## 변경

- 네이티브 Platform 개발판에서 등록된 10개 앱을 항상 표시한다. 게스트·로그인 중·로그인 계정·일시 오류 모두 목록은 유지한다. 인증 상태와 기록 소유자는 기존 검증 결과를 유지한다.
- WORLD·Messenger는 설치 상태에 맞춰 기존 실행을 제공한다. 플레저·무료 운세·중요한 대화 리허설은 고정 공개 주소의 **웹으로 열기**를 제공한다.
- 교사·PATH·가족 이야기 앨범은 로컬 MVP 상태, PULSE·Partners는 준비 중 상태를 표시한다. 패키지에 없는 로컬 MVP를 실행 가능하다고 표시하지 않는다.
- 실제 서비스 권한·직원 자격·개인 기록 접근은 서버 검증을 유지한다. 정식 배포판과 일반 웹의 카탈로그 필터는 이 변경에 포함하지 않는다.
- 환경 정보가 인증 응답보다 먼저 도착해도 진행 중인 로그인 결과를 버리지 않는다. 공개 앱의 실행 안내는 기본 브라우저를 연다고 표시한다.

## 고정 후보와 검증

최종 후보: `desktop/artifacts/development-catalog-candidate-2026-10-08T15-08-06-005Z`, sourceHash `82ebd49669828b7a3219ebc9a4bf0461c03eb4b818d62197427e3f2b7f6748b8`.

현재 설치 기준 `6f6702e3…` 위에 실행 파일 8개만 반영했다. 별도 작업의 `platform-continuity.mjs`·CSS·관련 QA 변경은 공유 작업본에 보존하고 이번 고정 후보에 섞지 않았다. 먼저 만든 `157093e2…` 후보는 공개 앱 안내 문구 수정 전 중간 결과이며 설치하지 않는다.

- 최종 고정 후보 전체 단위 검사 **287/287**: 후보의 `qa-tests.log`.
- 합성 계정 숨김 Electron **59/59**: 후보의 `artifacts/development-catalog-20261009/2026-10-08T15-12-10-604Z/report.json`.
- 0개 메뉴 계정의 앱 10개 표시, 계정·게스트 메모 분리, 로그인 응답 순서, 로그아웃, 개발/준비/설치 필터, 공개 3종·설치 2종의 고정 ID 호출 확인.
- 1280·390·320px 홈/라이브러리와 정식판 빈 목록 총 7장 확인. 가로 넘침·콘솔 오류·네트워크·실제 외부 앱 실행 0건. 실제 사용자 계정 시험은 아니다.
- 독립 읽기 검토에서 공개 앱 설명 오류 1건을 수정했고 후속 검토에서 추가 문제 없음.
- Windows x64 Preview 설치 파일 3종 검증 완료: 후보의 `artifacts/package-verification.json`. 각 ASAR 실행 원본 87파일과 인증 설정·Messenger 회사 HTTPS·Platform 자식 설치 파일/실행 해시를 대조했다.
- 실제 Platform 후보 EXE 격리 부팅 통과: 후보의 `artifacts/development-catalog-packaged-smoke.json`. 새 appData/userData/sessionData에서 숨김 실행하고 익명 상태·네트워크 요청 0·콘솔 오류 0·합성 암호화 저장 왕복·패키지 바이트 불변을 확인했다. 이 검사는 첫 부팅 증거이며 위 59개 합성 화면 검사를 실제 로그인 검증으로 바꾸지 않는다.

## 개인 PC 적용 상태

사용자가 Platform을 닫은 뒤 현재 프로필을 사용자와 SYSTEM만 접근 가능한 폴더에 백업하고 세 앱을 `82ebd496…`로 업데이트했다. 세 설치 프로그램 모두 exit 0이며 실제 EXE/ASAR·실행 원본 87파일·인증 설정 9종·Platform에 포함된 WORLD/Messenger 설치 파일과 실행 해시가 일치한다. 실제 설치 Platform의 설치 상태 조회에서 두 자식 앱 모두 실행 가능으로 확인했다. 실제 자식 앱을 열어 서비스를 이용한 검사는 아니다.

- 설치 결과: 후보의 `artifacts/update-install-results.json`, `update-installed-state.json`, `installed-update-verification.json`.
- 보호 백업: `%LOCALAPPDATA%/SYNK Desktop Backups/platform-cloud-2026-10-08T15-20-28-932Z`. 기존 프로필 WORLD 67·Messenger 83·Platform 104파일은 백업 및 설치 후 해시가 모두 동일하다. 사용자 데이터 복원·초기화·강제 종료는 하지 않았다.
- 실제 설치 EXE 격리 부팅: `artifacts/development-catalog-installed-smoke-diagnostic.json` **16/16 통과**. 원래 프로필을 읽지 않고 새 QA 프로필에서 익명 부팅·네트워크/콘솔 오류 0·바이트 불변을 확인했다. 재검증 뒤 `profile-post-qa.json`에서도 원래 세 프로필이 동일하다.
- 최초 설치 EXE 검사 `development-catalog-installed-smoke.json`은 exit 1이었다. 그때 검사 도구가 원시 오류를 기록하지 않아 원인은 미확정이며 실패 기록을 보존했다. 도구에 원시 로그와 오류 보존만 추가하고 설치 파일 변경 없이 재실행해 통과했다.

동시 설치 조율: 별도 「SYNK 플랫폼 기능 보강」 작업의 계정 홈 UX 설치가 같은 시각 겹쳤고, 해당 작업은 WORLD 설치 exit 2 뒤 즉시 중단했다고 전달했다. 양쪽에서 실제 설치 `82ebd496…`와 기존 프로필 보존을 확인했다. 이 채팅은 추가 설치·정상 앱 재실행을 보류하고, 해당 작업이 **82eb 기반 + 승인된 계정 홈 JS/CSS 2파일**을 합쳐 최종 설치를 단독으로 맡았다. 전체 앱 표시 변경을 구버전으로 덮어쓰지 않도록 후보·검증 자료를 전달했다.

### 최종 통합 설치 · 00:39~00:42 KST

최종 원본은 `4738b9082613187b35fb7db810d21030008e8915d1edb4d8e874a58197e98f90`이며 `desktop/artifacts/platform-integrated-candidate-2026-10-08T15-27-45-012Z`에 있다. 담당 작업의 전체287·메모/종료 보호38·카탈로그59 검사 후 세 앱 설치가 모두 exit 0으로 끝났다. `artifacts/update-installed-state.json`과 `installed-update-verification.json`에서 세 프로필 67/83/104파일 보존·실제 설치 바이트·인증 설정·자식 앱 등록 일치를, `platform-installed-boot.json`에서 설치 Platform의 격리 부팅 성공을 확인했다.

이 채팅에서도 [최종 설치 원문을 독립 대조](development-catalog-integrated-install.json)했다. 실제 Platform ASAR의 전체 실행 원본87파일이 통합 후보와 같으며, 이 작업의 전체 목록·공개 앱 실행 변경8파일은 `82eb`의 검증본과 바이트 동일하다. 사용자 계정이나 프로필을 읽거나 수정하지 않았다.

설치 담당은 실제 설치 Messenger의 회사 HTTPS 익명 화면8/8을 확인하고, 00:43에 원래 프로필로 Platform을 한 번만 다시 열었다. 정상 창·실행 경로·최종 해시를 확인했다([최종 설치 완료](../../../../desktop/artifacts/platform-integrated-candidate-2026-10-08T15-27-45-012Z/artifacts/integrated-install-completion.json)). 프로필 해시 보존은 이 정상 재실행 전까지의 증거이며 이후 앱 캐시·세션 갱신과 구분한다. 4738의 첫 숨김 부팅 검사는 `UnknownVizError`로 실패했고, 설치 바이트·실행 조건을 바꾸지 않은 재검사16/16이 통과했다. 원인 미확정인 첫 기록도 보존했다.

이 채팅은 사용자에게 다시 열린 앱 목록과 Messenger의 실제 SYNK ID 로그인 결과를 물었다. 답변 전에는 실제 로그인 성공으로 표시하지 않는다. 설치 첫 화면·합성 계정 UI·정상 창 존재는 서로 다른 검증 범위다.
