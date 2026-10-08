# 교실 PC 오류 복구 후속 · 2026-10-09

**07:47 KST, 수정 PC와 기존 APK를 묶은 비공개 설치 시험판 게시 완료.** 사용자 「클로드 검수는 나중에 받을게. 저장만해주고 일단 전부 배포하고 종료해줘」에 따라 이번 PC 수정판만 Claude 최종 검수를 뒤로 미뤘다. 검수 완료·승인으로 기록하지 않는다. [배포본](https://github.com/unmet23-lab/SYNK-talk/releases/tag/classroom-rehearsal-20261009-pc96bbfc1)의 APK·PC ZIP·설치 안내·manifest·checksum 5파일을 다시 내려받아 크기와 SHA-256 일치, 게시 상태와 태그 소스를 확인했다. 실제 장비 설치·송출·학생 시청은 아직 미시험이다.

## 고친 동작

- 영구 409 충돌(`VIDEO_ALREADY_LINKED`, `SESSION_IDENTITY_CONFLICT`, `STALE_STATE`, `BLOCKED_VIDEO_REPLACEMENT_REQUIRES_RECOVERY`)과 서버의 `retryable:false`는 원인을 구분해 `syncPaused`로 저장한다. 재시작해도 해당 작업의 외부 요청을 반복하지 않는다. 다른 작업은 계속한다. 담당자가 원인을 해결한 뒤 `retry-sync CONFIG SESSION --confirmed-resolved`로 로컬 일시정지를 풀고, 다음 `once/watch`의 소유권 확인·정상 동기화를 확인한다. 기존 영상·순번·원본은 보존한다.
- OBS `RECORDING_STARTED`/`STOPPED`의 실제 시각을 완료 파일에 기록한다. 예정 시각 전에 끝나도 정상 등록하며 0초·시계 역행은 원본·점유를 보존하고 거절한다. 라이브 백업의 실제 녹화 시각은 `recording`에 보관하고 YouTube 방송 시각을 덮지 않는다.
- 명백한 YouTube HTTP 401 응답이면 토큰 갱신·채널 재확인 후 한 번만 재전송한다. 재401은 토큰을 폐기하며 동시 요청은 갱신을 공유한다. 네트워크 오류·시간초과·5xx·응답 분실은 재전송하지 않아 중복 생성 가드를 보존한다. 인증 갱신 실패의 작업자 안내도 추가했다. API의 인증 오류·갱신 의미는 [Google 오류 문서](https://developers.google.com/youtube/v3/docs/core_errors), [OAuth 갱신 문서](https://developers.google.com/youtube/v3/guides/auth/installed-apps)를 확인했다.

## 증거와 산출물

- 소스 커밋: `96bbfc169977ae867665343b497c29baccb5a007`, 기준 배포 PC `d932e135b7cda3e3067d8a8d0e8b9e7ff05dc621`.
- 브랜치: `codex/classroom-pc-recovery-20261009`.
- 격리 작업본: `C:/Users/q1212/.codex/worktrees/classroom-pc-recovery/SYNK-appsscript`.
- [최종 시험](pc-tests-final.txt): **120/120 통과, 실패·건너뜀 0**. 인증 모의 응답 22건, 실제 Lua 실행 14건 포함. 앱·서버 소스는 바꾸지 않아 이전 앱 3,246개 시험을 이번 PC 시험과 더하지 않는다.
- **최종 게시 PC ZIP:** 81,270바이트, SHA-256 `315c6779b486ebe4ced381c5d2442df295c95099b99386f2ffcdbca675e67bfc`. [게시·다운로드 대조](publication-published-verification.json), [게시 입력·소스 대조](publication-inputs.json), [종합 인수 기록](deployment-final.json).
- 이전 로컬 후보 ZIP은 81,032바이트, SHA-256 `6f9a6ab9ca76a1e7438efb627519e23cbe0f6f39d10af20f3a77c910ac689295`로 보존했다. 게시본에서는 source-manifest·설치준비 안내의 검수/게시 상태만 갱신했으며 프로그램 12파일은 확정 소스 `96bbfc169`와 바이트 일치한다.
- [이전 후보 패키지 검사](package-verification.json): 확정 소스 12개·ZIP 15항목 전부 바이트 일치, 상대 의존성 4개 존재, CLI 도움말 실행·미설정 예제 거절 확인. 일반 자격증명 패턴 미검출은 보조 검사이며, 실제 자격증명·학생 자료는 묶음에 넣지 않았다.
- [공용 작업본 반영](shared-source-preservation.json): 이번 12경로가 기준 소스와 같은지 먼저 확인한 뒤 수정본을 반영했다. 다른 작업의 변경·공용 Git index는 보존했다.
- [검수 미완료 응답](claude-review.json): `is_error:true`, 실제 완료 모델 없음. 검수 대상 요청은 `9972ed5ac`였고, 이후 안내 1건을 더 고친 최종 `96bbfc169`는 아직 검수를 요청하지 않았다. 다음에는 **최종 소스 전체**로 검수한다.
- [검수 연기·재개 기록](deferred-review.json)에 사용자 지시, 최종 변경 경로, 검수 범위, 게시 파일과 재개 조건을 저장했다. 공통 검수 원칙은 바꾸지 않았다.
- [서버 재조회](server-recheck.json): 양환경 4함수 본문 SHA-256이 검증된 `fc00450` 배포본과 일치하며 모두 ACTIVE, JWT는 classroom=true / classroom-sync=false다. 현재 리허설 v3·운영 v4. 엄격 메타데이터 검사 `pass:false`는 과거 운영 v2 기록과 버전만 달라서이며, [개별 조회](server-version-followup.json)에서도 v4를 확인했다. 버전 변경 원인은 미확인이다. 이번 PC 게시에서 서버·DB·비밀값은 변경하지 않았다.

## 이어 할 일

1. 사용자가 나중에 검수를 재개할 때 공식 Opus 5.5·max로 최종 `96bbfc169`와 **게시된** ZIP을 검수한다. `claude-review.json`의 제한 응답을 승인으로 사용하지 않는다. 자동 재검수나 예약은 설정하지 않았다.
2. 실제 교실·반·학생·시청기간·계정 준비 후 별도 시험 기기에서 설치, 채널·활성 스트림 송출원 확인, 카메라·마이크·라이브·끊김 복구·복습과 미초대 계정 차단을 확인한다. 현장 시험은 아직 수행하지 않았다.

운영 프로그램 갱신은 기존 worker와 OBS 녹화가 끝난 뒤 수행하고 Lua를 다시 불러온다. `state/inbox/recordings`·설정·`.in-use`·원본은 설치 ZIP으로 덮어쓰거나 삭제하지 않는다. 실제 권한·비밀값·방송을 활성화하지 않았다.
