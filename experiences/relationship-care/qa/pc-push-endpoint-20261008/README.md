# PC 알림 구독 주소 호환성 · 2026-10-08

상태: **사용자 검수 예외 승인 후 운영 반영·실제 기기 구독·예약 발송 gateway 수락·시험 정리까지 완료.** 09시 복원과 두 시험 후속 항목의 완료·계정 재조회 확인을 마쳤다. 공식 Claude Opus 5.5/max 검수는 주간 한도 429로 미완료다. 실제 PC 알림 표시·클릭은 사용자가 “못 봤어요 — 실제 수신 확인은 보류”라고 답해 미검증·보류로 남긴다. 물리 휴대폰 확인도 계속 보류한다.

## 실제 PC에서 확인한 문제

사용자의 “휴대폰은 계속 보류 — PC 쪽만 진행”에 따라 기존 SYNK 계정 수첩 복원을 확인했다. 기존 동기화 시험 사람에게 오늘 날짜의 `PC 알림 시험 · 2026-10-08` 후속 항목을 저장한 다음 기기 알림을 켰다. 사용자가 브라우저에서 허용을 눌렀지만 서버가 `INVALID_SUBSCRIPTION`으로 거절했다. Chrome에서 한 번 더 시도하고 CDP 네트워크를 통해 요청의 비밀값 없는 형식과 HTTP 400을 확인했다.

- Google 호스트 `jmt17.google.com`, 경로 접두 `/fcm/send/`, query/fragment 없음.
- 구독 키 길이 p256dh 87자·auth 22자. 실제 키·endpoint 전체·토큰·계정 식별자·이메일은 출력하거나 증거 파일에 저장하지 않았다.
- 서버는 기존 Google 주소 `fcm.googleapis.com/fcm/send/`만 허용했다. [Chromium 공식 상수](https://chromium.googlesource.com/chromium/src/+/refs/tags/141.0.7390.94/components/push_messaging/push_messaging_constants.cc)에 관찰된 주소 및 다른 정식 Web Push 주소가 명시돼 있다.
- [브라우저 진단 요약](browser-diagnostic.json). 08:03:35 KST 읽기 전용 운영 집계는 구독 0·오늘 평가 0·발송/실패/건너뛰기 0·활성 cron 1이었다. 실제 닫힌 탭 알림 발송·OS 수신에는 도달하지 못했다.

## 준비된 수정과 확인

분리 서버 체크아웃 `C:/Users/q1212/Documents/SYNK-talk-care-release-20261006`, 기준 HEAD `45ea9030551aeeaf7728c86c110f7ffb6c2571d0`에서 아래 3파일만 수정했다.

1. `lib/synk-care-push-server.js`: 공식 Google 호스트와 경로 4조합만 허용. 임의 Google 하위 도메인, 비 HTTPS, 사용자 정보, 포트, 경로 정규화, query/fragment를 거절한다. 빈 `?`·`#`도 차단하며 WNS의 정식 token query는 유지한다.
2. `tests/care-push.test.js`: 네 주소의 등록→조회→발송 전 재검증→하루 한 번→시간 변경→해제와 악성 변형의 외부 요청 이전 차단을 확인한다.
3. `supabase/functions/_shared/synk-care-push-runtime.js`: 같은 원본으로 재생성. 설정 함수와 발송 함수 양쪽이 사용하는 런타임이다.

`NODE_PATH=C:/Users/q1212/Documents/SYNK-talk/node_modules` 환경에서 `node tools/synk-care-push-build.js`, `node tools/synk-care-push-build.js --check`, `node --test --test-reporter=tap tests/care-push.test.js tests/care-push-integration.test.js`를 실행해 **37/37, 실패 0**을 확인했다. 3파일 문법·`git diff --check`·원본/생성 runtime의 합성 URL 24개 결과 일치도 통과했다. 실행 결과는 작업 도구 로그에 있으며 별도 전체 TAP 파일은 저장하지 않았다.

독립 코드 감사에서도 추가 수정 지적이 없었고 합성 악성 URL 24개 차단을 별도로 확인했다. 이는 Claude 최종 검수나 실제 기기 수신 증거를 대신하지 않는다. 수정·검사 단계에서 원래 변경 중이던 배포장부 SHA `4f7808833f2ea5b2b5f739cdcba1b6a06c13fb74a89364696dd22d2c12f6d903`을 보존했고, 이후 운영 배포 도구의 정상 장부 추가를 구분한다.

## 검수와 남은 일

공식 CLI `--model claude-opus-5-5 --effort max`를 요청했다. [실행 결과](claude-process.json)와 [응답](claude-review.json)은 `usage_limit_reached`, HTTP 429, 토큰 사용 0, 실제 모델 실행 없음이다. 초기화 안내는 10월 12일 19시 KST였다. [검수 범위 SHA](claude-source-inventory.json)와 [diff](source-delta.diff)는 현재 수정본과 일치한다.

사용자가 **“이번 알림 호환성 수정만 예외 승인·운영 반영”**이라고 명시 승인했다. [승인 범위](user-review-exception.json)에는 원본 3파일 SHA 목록을 동결했다. 과거 예외를 확대하지 않았다. `d4acb2931964727cd057596eec62b095be426b0a`를 기존 `codex/synk-care-personal-20261006`에 커밋·push하고 설정·발송 두 함수를 **v11→v12**로 운영 반영했다. 배포 전 기존 HEAD runtime 일치, 배포 후 두 runtime 일치·ACTIVE·JWT 유지·익명401을 확인했다. entrypoint 정적 앵커는 0/0 미측정이며 전체 본체 바이트 대조로 주장하지 않는다. 웹사이트·DB migration·cron 변경은 없다. [운영 결과](release.json), [배포 전 대조](release-baseline.json), [배포 후 대조](release-verify.json).

공용 SYNK-talk 브랜치에는 이 Care 원본 3파일이 없어 부분 복사를 하지 않았다. 정상 원본은 위 전용 브랜치·커밋에 보존했다. [공용 파일 확인](canonical-source-sync.json).

첫 실패 시험의 임시 후속 항목은 완료 처리 후 `SYNK 계정에 저장했어요`를 확인했다. 이는 시험 정리이며 알림 수신 성공 기록이 아니다. 첫 실패 시점에는 기기 구독이 생성되지 않았고 화면 시간은 기본 09:00이었다. 사용자가 허용한 브라우저 알림 권한은 남았다. 이후 새 재시험 상태는 아래와 구분한다. 휴대폰 수신·동기화는 계속 보류한다.

## 수정 후 실제 예약 발송

새 후속 항목 `PC 알림 재시험 · 2026-10-08`을 오늘로 저장하고 계정 저장 완료 안내를 확인한 뒤 **08:18 KST**로 기기 구독을 켰다. 운영 UI에서 구독 성공·08:18·시간 저장/끄기 단추를 확인했다. Chrome의 Care 탭 2개는 미저장 입력이 없음을 확인한 후 닫았고, Chrome과 IAB 목록 모두 공개 Care 탭 0개였다. 로그아웃은 하지 않았다.

정규 cron 실행 후 **08:18:53 KST 구독1·활성1·오늘평가1·sent1, failed/skipped/retry/dispatching 각각0**을 확인했다. [운영 집계](delivery-aggregate.json). 이는 gateway 수락까지의 증거이며 OS 알림 표시와 클릭 이동은 사용자에게 별도 확인을 요청했지만 답변은 아직 없다.

08:26 이후 정리를 위해 다시 열 때 Chrome 탭 생성이 활성 탭 제약으로 실패했다. 기존 빈 Chrome 탭을 Care로 이동했지만 새 탭은 로그인이 복원되지 않은 게스트 화면이었다. 마우스 입력은 응답 시간 초과, 캡처는 0폭 오류를 반환했다. 문서화된 키보드 조작·임시 PC viewport로도 로그인/화면 제어가 복구되지 않았다. 임시 viewport는 reset했고, Codex에서 Care 열기는 queued였다. 해당 탭은 후속 작업을 위해 handoff로 보존했다. 인증·알림 권한을 강제 변경하거나 비밀값을 추출하지 않았다.

그때는 활성 구독 시간 08:18과 두 번째 재시험 후속 항목이 남았다. 아래 재개에서 정리를 마쳤으며, 이 장애 기록을 현재 미완료 상태로 해석하지 않는다.

## 09:14 KST 재개 · 정리 완료

현재 열린 공개 Care 화면에서 기존 SYNK SSO로 복귀했다. 기존 구독의 08:18을 **09:00 한국 시간**으로 저장하고, 설정 창 재열기에서 09:00과 활성 구독을 확인했다. `PC 알림 재시험 · 2026-10-08`을 완료 처리하고 `SYNK 계정에 저장했어요` 안내를 확인한 다음 계정 자료를 다시 불러왔다. 두 시험 항목 모두 완료, 미완료 후속 없음, 원래 동기화 시험 메모 보존을 확인했다. 이는 시험 정리이며 실제 인간관계 활동이나 OS 수신 성공을 뜻하지 않는다. [브라우저 확인](cleanup-browser-verification.json), [현재 완료·보류 범위](completion.json).

사용자는 **“못 봤어요 — 실제 수신 확인은 보류”**라고 답했다. PC 실제 알림 표시·클릭과 물리 휴대폰 검증은 보류이며 새 시험 알림을 만들거나 발송하지 않았다. 기존 기기 구독은 켠 상태로 유지하고 일정이 있는 날 오전 9시에 동작하도록 복원했다. 이번 재개에서는 제품 코드·서버 배포를 변경하지 않았다.

09:15:09 KST의 최소 읽기 전용 운영 집계 1회에서 **활성 구독1·09:00 한국 시간 구독1·오늘 sent1 유지**를 확인했다. [서버 정리 확인](cleanup-aggregate.json). 구독을 끈 원상태 복원이 아니라 기존 활성 구독을 유지한 시간 복원이며, 시험 항목 완료는 계정 재조회 UI 증거와 구분한다.
