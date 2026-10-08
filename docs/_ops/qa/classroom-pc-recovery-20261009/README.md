# 교실 PC 오류 복구 후속 · 2026-10-09

**로컬 수정·시험·설치 ZIP 준비 완료. 새 시험판 게시 전 최종 검수 대기.** 공식 Claude Code Opus 5.5·max 요청이 세션 사용량 한도로 종료됐고, 도구는 10:30 KST 재개를 안내했다. 이는 검수 완료가 아니다. 기존 GitHub 설치 시험판의 APK·PC ZIP과 운영·리허설 서버는 이번 작업에서 변경하지 않았다.

## 고친 동작

- 영구 409 충돌(`VIDEO_ALREADY_LINKED`, `SESSION_IDENTITY_CONFLICT`, `STALE_STATE`, `BLOCKED_VIDEO_REPLACEMENT_REQUIRES_RECOVERY`)과 서버의 `retryable:false`는 원인을 구분해 `syncPaused`로 저장한다. 재시작해도 해당 작업의 외부 요청을 반복하지 않는다. 다른 작업은 계속한다. 담당자가 원인을 해결한 뒤 `retry-sync CONFIG SESSION --confirmed-resolved`로 로컬 일시정지를 풀고, 다음 `once/watch`의 소유권 확인·정상 동기화를 확인한다. 기존 영상·순번·원본은 보존한다.
- OBS `RECORDING_STARTED`/`STOPPED`의 실제 시각을 완료 파일에 기록한다. 예정 시각 전에 끝나도 정상 등록하며 0초·시계 역행은 원본·점유를 보존하고 거절한다. 라이브 백업의 실제 녹화 시각은 `recording`에 보관하고 YouTube 방송 시각을 덮지 않는다.
- 명백한 YouTube HTTP 401 응답이면 토큰 갱신·채널 재확인 후 한 번만 재전송한다. 재401은 토큰을 폐기하며 동시 요청은 갱신을 공유한다. 네트워크 오류·시간초과·5xx·응답 분실은 재전송하지 않아 중복 생성 가드를 보존한다. 인증 갱신 실패의 작업자 안내도 추가했다. API의 인증 오류·갱신 의미는 [Google 오류 문서](https://developers.google.com/youtube/v3/docs/core_errors), [OAuth 갱신 문서](https://developers.google.com/youtube/v3/guides/auth/installed-apps)를 확인했다.

## 증거와 산출물

- 소스 커밋: `96bbfc169977ae867665343b497c29baccb5a007`, 기준 배포 PC `d932e135b7cda3e3067d8a8d0e8b9e7ff05dc621`.
- 브랜치: `codex/classroom-pc-recovery-20261009`.
- 격리 작업본: `C:/Users/q1212/.codex/worktrees/classroom-pc-recovery/SYNK-appsscript`.
- [최종 시험](pc-tests-final.txt): **120/120 통과, 실패·건너뜀 0**. 인증 모의 응답 22건, 실제 Lua 실행 14건 포함. 앱·서버 소스는 바꾸지 않아 이전 앱 3,246개 시험을 이번 PC 시험과 더하지 않는다.
- [새 PC ZIP](../../../../.tmp/classroom-pc-recovery-20261009/synk-classroom-pc-recovery-96bbfc1.zip): 81,032바이트, SHA-256 `6f9a6ab9ca76a1e7438efb627519e23cbe0f6f39d10af20f3a77c910ac689295`.
- [패키지 검사](package-verification.json): 확정 소스 12개·ZIP 15항목 전부 바이트 일치, 상대 의존성 4개 존재, CLI 도움말 실행·미설정 예제 거절 확인. 일반 자격증명 패턴 미검출은 보조 검사이며, 실제 자격증명·학생 자료는 묶음에 넣지 않았다.
- [공용 작업본 반영](shared-source-preservation.json): 이번 12경로가 기준 소스와 같은지 먼저 확인한 뒤 수정본을 반영했다. 다른 작업의 변경·공용 Git index는 보존했다.
- [검수 미완료 응답](claude-review.json): `is_error:true`, 실제 완료 모델 없음. 검수 대상 요청은 `9972ed5ac`였고, 이후 안내 1건을 더 고친 최종 `96bbfc169`는 아직 검수를 요청하지 않았다. 다음에는 **최종 소스 전체**로 검수한다.

## 이어 할 일

1. 사용량 한도 해제 후 공식 Opus 5.5·max로 최종 `96bbfc169` 및 ZIP을 검수한다. `claude-review.json`의 제한 응답을 승인으로 사용하지 않는다.
2. 통과하면 새 비공개 설치 시험판에 PC ZIP·설치 안내·manifest/checksum을 게시하고 다시 내려받아 대조한다. 기존 APK `fc00450`와 서버는 이 PC 수정으로 다시 빌드·배포할 필요가 없다. 새 게시 전까지 배포된 PC는 이전 `d932e13`이다.
3. 실제 교실·반·학생·시청기간·계정 준비 후 별도 시험 기기에서 설치, 채널·활성 스트림 송출원 확인, 카메라·마이크·라이브·끊김 복구·복습과 미초대 계정 차단을 확인한다. 현장 시험은 아직 수행하지 않았다.

운영 프로그램 갱신은 기존 worker와 OBS 녹화가 끝난 뒤 수행하고 Lua를 다시 불러온다. `state/inbox/recordings`·설정·`.in-use`·원본은 설치 ZIP으로 덮어쓰거나 삭제하지 않는다. 실제 권한·비밀값·방송을 활성화하지 않았다.
