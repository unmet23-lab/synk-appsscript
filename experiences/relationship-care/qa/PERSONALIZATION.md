# 플레저 · 선택한 기억과 일상 안부 검증

2026-10-06 로컬 개발부터 이어진 기록. 기존 [엔진 연결 단계](ENGINE-UPGRADE.md)에 **기억의 실제 반영 / 일정 없는 안부 / 후속 챙김 달력 내보내기**를 추가했다. 개발·리허설 당시 결과와 아래 10월 7일 운영 반영 결과를 구분한다.

## 2026-10-08 · 후속 운영 검증

운영의 개인자료 만료·보존과 공식 계정 삭제 유예·완료를 worker 직접 24/24, 기존 SQL/Vault/pg_net 호출 경로 25/25로 확인했다. 로컬 회귀 21/21, 두 실행의 합성 자료 정리와 과거 독립 리허설 staging의 실제 만료 뒤 부재도 확인했다. 새 fixture만 시간을 조정했으며 운영 cron 시각·실제 7일 경과 관찰과 구분한다. [정리 QA](../../synk-account/qa/cleanup-20261008/README.md).

아래 최초 배포 시점의 미완료 항목 중 사용자 가입 메일·확인·로그인·계정 수첩 저장/조회는 이후 [로그인 마감](../../synk-account/qa/login-polish-20261007/README.md)에서, 두 세션의 동시 수정·삭제·해제는 [운영 왕복](ops-roundtrip-20261008/README.md)에서 확인했다. 휴대폰 실물 왕복은 보류한다.

## 2026-10-07 · 운영 배포와 공개 설정 반영

사용자의 운영 반영 명시 승인 후 care/personal migration 2개, `synk-care`·`synk-personal`·`personal-media-cleanup` 함수 3개, 활성화 flag 2개를 운영에 반영했다. [운영 검증](../../../tools/synk-id/qa/care-personal-production-verify-20261007.json)에서 세 함수 ACTIVE·JWT 검사, 비공개 원본 보관함, cron 등록, 무인증 요청 401을 확인했다. 후보 `adbcfa3`의 제품 24파일은 검수본과 동일하며 제품 커밋은 `285bf9`다.

[운영 OAuth 등록·설정](../../../tools/synk-id/qa/production-provision-verified-20261007.json)은 신규 15개와 기존 4개, 총 19개 등록·매핑을 확인했다. 기존 매핑을 보존하고 로컬 웹·PC 설정에 실제 운영 ID를 반영했다. 교사 browser 연결은 준비 중이다. [공개 포털 설정](../../../tools/synk-id/qa/production-portal-published-20261007.json)은 커밋 `67cc025`의 `id/config.json`이 Pages에 게시되어 HTTP 200·공개 SHA 일치·19개 동의 항목을 확인했다. 리허설 설정과 기존 포털 번들은 보존했다. Pages 게시 성공 뒤 전체 사이트 CI는 다른 작업의 후속 배포 때문에 두 번 취소됐으며, 후속 [37521564890](https://github.com/unmet23-lab/synk-policy/actions/runs/37521564890)이 `7af3679`에서 2026-10-06 19:59:18Z에 최종 성공했다.

[운영 설정을 연결한 초기 로컬 화면](production-local-20261007/result.json)은 **11/11** 통과했다. 375px 화면, 로그인 버튼 활성화, 운영 endpoint/CSP, 소스 7파일 일치를 확인했으며 로그인 클릭·토큰 교환·외부 요청은 하지 않았다. [초기 QA 판정](production-local-20261007/result-initial-check.json)은 care의 API 제품을 잘못 기대한 검사였고, 정본의 `care → platform` 매핑에 맞춰 QA 기대값만 고쳤다. 제품·설정 수정으로 통과시킨 결과가 아니다.

[정리 작업 설정 대조](../../../tools/synk-id/qa/care-personal-production-cleanup-config-20261007.json)는 service-role 키의 정확한 지문 일치, 단일 자격증명, cron 대상과 일감 조건을 확인했다. 이 최초 설정 대조에서는 실제 cleanup 호출·만료 뒤 정리 완료를 검증하지 않았다. 인증된 기능 왕복의 증거는 아래 **리허설 32/32·PKCE 9/9**이며, 이 최초 배포 시점의 운영 실사용자 로그인·자료 왕복·실기기 왕복·일반 신규가입 SMTP는 미완료였다. 운영 익명 화면의 로그인 입구는 아래 별도 브라우저 검사 7/7로 확인했다.

## 달라진 행동

| 기능 | 확인한 동작 | 경계 |
|---|---|---|
| 이번에 쓸 기억 | 같은 사람의 기억 하나와 용도를 직접 확인하면 원문 근거를 표시하고 기존 Core의 추천·준비 순서·초안에 반영 | 자유 텍스트의 뜻은 추론하지 않음. 함께한 기억은 문구에, 선물 취향은 해당 선물 준비 순서에 사용. 다른 사람·철회된 기억과 현재 표현 제한 검사 |
| 오늘 그냥 안부 | 일정 없이 사람 등록 → 준비 → 수정 → 복사 → 명시적 문구 기억·실제 연락 기록 | `eventId: ''`, `eventType: 'checkin'`으로 저장하며 가짜 일정·회차 없음. 복사는 발송 증거가 아님 |
| 후속 챙김 달력 | 남아 있는 후속 챙김 하나를 종일 또는 직접 고른 한국 시각으로 내보냄 | 기본 알림 없음. 완료·중단·지난 날짜 거부. 근거 원문 제외. 파일 생성은 완료 기록이나 외부 달력 자동 동기화가 아님 |

선택 기억은 세션 입력이며 계정·사람·기억 변경 뒤 다시 확인한다. 기존 v1 백업과 4MiB 제한을 유지하고 안부용 `savedMessages.checkin` 및 일정 없는 준비·복사 기록만 호환 확장했다. 최종 문구는 5,000자 이내이며 금지 표현 검사 후 실제 들어간 인용만 반영 완료로 표시한다. 이미 보관한 문구를 다시 쓰는 경우 같은 인용을 중복 추가하지 않는다. 원문·기억을 삭제할 때는 그 기억의 문장이 들어간 같은 사람의 저장 문구와 복사 기록도 확인 후 함께 삭제한다. 단순 선택 해제와 철회를 구분하며 자유롭게 바꿔 쓴 문장의 의미를 추적하는 기능은 아니다. 준비 기록은 최근 500건 안에서 계속 선택·평가할 수 있다. NUL·짝 없는 서로게이트는 저장 전에 거부하고 정상 한글·이모지는 유지한다.

## 검증 결과

서로 겹치는 시험 묶음이므로 아래 숫자를 합산하지 않는다. 초기 208개 결과와 snapshot은 당시 기록으로 유지한다. 코어 지적 수정 후 전체 회귀 215개가 통과했고, 마지막 준비 기록 500건 가져오기·삭제 확인창 변경은 계정 브라우저 43개와 개인화 브라우저 33개로 확인했다. 215개 전체를 마지막 UI 변경 뒤 다시 실행했다고 해석하지 않는다.

| 범위 | 결과 | 근거 |
|---|---|---|
| 모델·엔진·HTTP·PC 계정 전체 회귀 | 215/215 통과, 코어 지적 수정 후 | [최종 전체 회귀 로그](personalization-final-tests-20261006.txt). 마지막 UI 변경의 브라우저 결과와 시점 구분 |
| 신규 개인화·안부·후속 ICS 모델 | 19/19 통과, 중복 인용·기억 철회·DB 문자·최근 500건 회귀 포함 | [시험 소스](../tests/care-personalization.test.mjs) |
| 분리 backend 후보 | 40/40 통과, 중복 인용 수정 전. 수정 후 번들 재생성 | [실행 로그](personalization-backend-20261006.txt), [소스·릴리스 SHA](../../../tools/synk-id/qa/personalization-release-sha-20261006.json)의 제한된 해시 갱신 시점 구분 |
| 새 실제 Chrome 흐름 | 33/33 통과, 원문 철회 후 저장 문구·복사 기록·다음 초안 검사 포함 | [합성 인물 결과](personalization-20261006/result.json) |
| 계정 브라우저 회귀 | 43/43 통과, 계정별 복구·500건 상태의 기기 수첩 가져오기 포함 | [합성 계정 결과](account-sync-20261006/result.json) |
| 기존 관계 수첩 브라우저 회귀 | 26/26 통과 | [결과](account-upgrade-20261006/result.json) |
| 최초 흐름 브라우저 회귀 | 29/29 통과 | [결과](ui-report.json) |
| 실제 PKCE 리허설 도구의 합성 시험 | 10/10 통과, 이 단위시험 자체는 원격 호출 없음 | [도구](../../../tools/synk-id/qa/care-pkce-rehearsal.cjs), [시험](../../../tools/synk-id/qa/care-pkce-rehearsal.test.cjs) |
| 리허설 공급자 browser/native PKCE | 9/9 통과, 합성 계정의 실제 공급자 왕복 | [실제 결과](../../../tools/synk-id/qa/care-pkce-provider-20261007.json). 로그인 UI·OS 보관함·실기기 시험은 아님 |

Chrome 검사에는 원문 근거 확인과 실제 문구 변화, 선택 해제, 금지 표현, 선물 약속 미생성, 기억 삭제, 사람·계정 전환, 편집 중 새로 불러오기·로그아웃 취소, 안부 복사·연락 기록 구분, ICS 내용과 320/375px 화면을 포함한다. 운영 인증은 합성 전송으로 대체했으며 실제 휴대전화나 달력 앱의 알림 수신 시험은 아니다.

- [375px 일정 없는 안부](personalization-20261006/home-checkin-375.png) · [PC 준비](personalization-20261006/personalized-ready-desktop.png) · [PC 문구](personalization-20261006/personalized-message-desktop.png)
- [320px 선물 기억](personalization-20261006/gift-memory-320.png) · [320px 후속 달력](personalization-20261006/followup-calendar-320.png) · [실제 생성 ICS](personalization-20261006/synk-care.ics)

서버는 이벤트가 0개인 안부 자료의 새 세션 왕복과 실제 typed JSONB 직렬화를 검사했다. 모델 최대 구조에서 JSONB 공백 증가 상한은 808,010바이트이며, 4MiB에 이를 더한 5,002,314바이트는 DB 5MiB 제한 안이다. 4MiB 경계 자료의 실제 JSONB 직렬화는 4,700,840바이트였다. 릴리스 후보는 공용 작업본의 다른 인증·저장소 변경을 포함하지 않고 정해진 파일 목록을 사용한다.

## 재현과 남은 운영 확인

```powershell
node --test experiences/relationship-care/tests/care-personalization.test.mjs
node experiences/relationship-care/qa/personalization-smoke.cjs
node --test tools/synk-id/qa/care-pkce-rehearsal.test.cjs
```

전체 모델 회귀 명령은 [기존 엔진 검증 기록](ENGINE-UPGRADE.md)의 명령을 사용한다. PKCE 도구는 기본 실행에서 준비 상태만 표시하며, 실제 등록된 rehearsal 프로젝트의 browser/native client 확인과 명시적 `--run`이 있어야 공급자에 접근한다. 2026-10-07 실제 리허설 실행은 위 9/9 결과로 확인했다. 이 실행의 합성 계정 2개는 삭제 요청 접수·deletion-pending까지 확인했으며 7일 유예 뒤 purge는 미확인이다.

공식 Claude Code에 `--model claude-opus-5-5 --effort max`를 명시한 [코어 후속 검수](../../synk-account/qa/operational-core-closure-20261006.json)와 [마지막 UI 변경 검수](../../synk-account/qa/operational-care-final-delta-20261007.json)가 완료됐다. 실제 응답 모델은 Opus 5.5이며 max는 CLI 인자 근거다. 준비 기록 500건 상태에서의 기기 수첩 가져오기까지 해결됐고 마지막 검수 범위에 남은 실제 문제는 없다고 판정했다. [최초 수정 필요 결과](../../synk-account/qa/operational-core-review-20261006.json)는 당시 기록으로 유지한다.

리허설에서는 public OAuth client 18개(신규 15개·기존 3개)의 등록·매핑과 동의 포털 반영, care/personal 두 migration 및 세 함수 배포를 완료했다. [등록·포털 결과](../../../tools/synk-id/qa/운영재개-리허설완료-20261007.md), [배포 결과](../../../tools/synk-id/qa/care-personal-rehearsal-deployed-20261007.json)에 근거를 분리했다. 운영 환경 전환 완료를 뜻하지 않는다.

앞선 [개인자료 공급자 시험](../../synk-account/qa/personal-provider-20261007.json)은 기능 32개가 통과했지만 최초 정리 실패로 `ok:false`다. 뒤이은 [범위를 한정한 복구](../../../tools/synk-id/qa/personal-provider-recovery-20261007.json)에서 두 실행의 합성 계정 4개·원본 4개를 정리하고 관련 auth user·활성 계정·개인 행 0개를 확인했다. 업로드 staging 만료 재확인은 별도 남아 있으며 이 정리 결과를 위 PKCE 실행의 7일 유예 계정과 혼동하지 않는다.

이후 [독립 재실행](../../synk-account/qa/personal-provider-isolated-20261007.json)은 실제 리허설 공급자 기능 **32/32**, `exitCode: 0`, `cleanup.complete: true`로 끝났다. 이 실행에서 만든 합성 Auth 계정 2개와 관련 활성 계정·개인 행은 모두 0개로 확인했고 원본 4개 삭제·4개 prefix 비어 있음을 검증했다. 위 최초 실패와 4계정 복구 결과는 별도 역사로 유지한다. `pendingUploadExpiryRecheck: true`는 남아 있으며, 이 실행 자체는 OAuth PKCE·실기기 검증이나 운영 환경 배포 완료를 뜻하지 않는다.

의미 기반 개인 모델, 앱 종료 후 자체 예약 푸시, 외부 자동 연락, 관계 개선 효과 측정과 실제 사용자·실기기 검증은 이번 리허설 결과에 포함되지 않는다. 운영 배포·공개 설정 반영은 위 10월 7일 절의 별도 증거로 확인한다.

운영 화면 후속 확인: [375px 실제 버튼에서 공개 로그인 화면 도달](production-local-20261007/portal-result.json)도 7/7 통과했다. 운영 care client·콜백과 S256 요청을 확인했고 입력·가입·동의·토큰 교환은 하지 않았다. 이 결과는 인증 후 개인자료 왕복과 구분한다.
