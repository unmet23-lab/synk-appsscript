# SYNK 공통 계정 연결 · 2026-10-06

10월 9일 후속 요청은 Platform 로그인 한 번으로 앱에 자동 연결하는 것이다. [현재 후보와 검증](../../../docs/_ops/qa/platform-single-sign-on-20261009/README.md)에 기존 계정 연결과 새 자동 로그인, 원문 검증과 실제 설치/공개/인수를 구분해 기록한다.

사용자 요청은 모든 앱·서비스를 하나의 SYNK 계정으로 연결하고, 플레저에서 남긴 정보를 필요할 때 다시 꺼내 쓰는 것이다. 기존 운영 SYNK ID와 계정 서버가 이미 존재함을 확인했다. 새 계정 체계를 만들지 않고 현재 앱별 등록·공개 설정·개인 기록 저장 연결을 보강했다.

## 2026-10-08 · 개인자료 자동 정리 경로 검증

운영의 만료/보존 대조군과 공식 계정 삭제 유예·완료·반복 처리를 확인했다. worker 직접 24/24, 기존 SQL/Vault/pg_net 호출 경로 25/25, 로컬 회귀 21/21 통과. 두 실행의 합성 계정 3개씩과 파일·문서·큐를 정리했고, 마지막 독립 리허설의 staging도 실제 2시간+2분 경과 뒤 부재를 확인했다. 새 운영 fixture는 서명 업로드 토큰 없이 만들어 그 시각만 과거로 조정했으며, 운영 cron 시각이나 실제 7일 경과를 기다린 것으로 표시하지 않는다. 제품 코드·스키마·예약 변경은 없다. [결과와 정확한 검증 범위](cleanup-20261008/README.md).

아래 최초 운영 연결 이후 실제 사용자 가입 메일·이메일 확인·로그인·플레저 계정 저장/조회도 완료했다. [로그인 마감 기록](login-polish-20261007/README.md), [운영 두 세션 후속 검증](../../relationship-care/qa/ops-roundtrip-20261008/README.md). 실물 휴대폰 왕복은 사용자 요청으로 보류한다.

## 2026-10-07 · 사용자 승인 후 운영 반영

같은 날 휴대폰 경로 요청에 따라 **[플레저 공개 웹](https://synk.im/care/)**을 policy `7bd9b70`로 게시했다. HTTPS 전용 public client를 한 개 추가해 현재 운영 등록·매핑·공개 동의 목록은 **20개**다. 아래 표의 19개는 최초 운영 연결 시점이다. 기존 등록·로컬3설정은 보존했고, 최종 Opus5.5/max 검수·공개39파일SHA·375px 화면·단추에서 운영 로그인 입구 도달을 확인했다([공개판 QA](../../relationship-care/qa/PUBLIC-WEB.md)). 이 최초 공개 시점에는 인증된 실사용자 왕복·물리 두 기기·SMTP가 미완료였으며, 이후 확인 결과는 위 후속 절에 구분했다.

사용자의 명시 승인 후 운영 서버·OAuth 등록·공개 포털 설정을 반영했다. 아래 로컬·리허설 수치와 합산하거나 실사용자 로그인 증거로 해석하지 않는다.

| 범위 | 확인한 결과 | 근거 |
|---|---|---|
| 운영 DB·함수 | care/personal migration 2개, 함수 3개 ACTIVE·JWT 검사, 활성화 flag 2개, 비공개 원본 보관함, cron 등록, 무인증 401 | [운영 검증](../../../tools/synk-id/qa/care-personal-production-verify-20261007.json). 후보 `adbcfa3`, 제품 `285bf9`, 검수 제품 24파일 SHA 유지 |
| OAuth·로컬 설정 | 신규 15개·기존 4개로 총 19개 등록·매핑, 기존 매핑 보존, 웹·PC 설정에 실제 운영 ID 반영 | [등록·설정 확인](../../../tools/synk-id/qa/production-provision-verified-20261007.json). 교사 browser는 준비 중 |
| 공개 포털 설정 | `67cc025`의 `id/config.json` 게시, HTTP 200·공개 SHA 일치·동의 항목 19개. 리허설 설정과 기존 포털 번들 보존 | [공개 게시 결과](../../../tools/synk-id/qa/production-portal-published-20261007.json). Pages 성공. 다른 작업의 후속 배포로 전체 CI가 두 번 취소된 이력을 유지하며, 후속 [37521564890](https://github.com/unmet23-lab/synk-policy/actions/runs/37521564890)이 `7af3679`에서 2026-10-06 19:59:18Z에 최종 성공 |
| 운영 설정의 초기 로컬 화면 | 11/11, 375px·활성 로그인 버튼·운영 CSP·소스 7파일 일치 | [플레저 화면 결과](../../relationship-care/qa/production-local-20261007/result.json). 로그인 클릭·토큰 교환·외부 요청 없음 |
| 예약 정리 설정 | service-role 키의 정확한 지문 일치·단일 자격증명·cron 대상·일감 조건 확인 | [읽기 대조](../../../tools/synk-id/qa/care-personal-production-cleanup-config-20261007.json). 실제 cleanup 실행 아님 |

초기 로컬 QA의 [실패 기록](../../relationship-care/qa/production-local-20261007/result-initial-check.json)은 care의 API 제품 기대값 오류로 보존한다. 정본의 `care → platform`에 맞춰 QA 기대값만 고쳤고 제품·운영 설정은 변경하지 않았다. 운영 익명 화면의 로그인 입구 도달은 아래 별도 브라우저 검사 7/7로 확인했다.

인증된 자료 저장·조회·원본 왕복은 **리허설 공급자 32/32·PKCE 9/9**로 확인했다. 이 최초 배포 시점에는 운영 실사용자 로그인과 자료 왕복, 실기기 간 왕복, 일반 신규가입의 SMTP 전달, 예약 정리의 실제 실행·만료 뒤 완료를 아직 검증하지 않았다. 운영 배포·설정 게시 완료와 이 남은 범위를 구분한다.

## 로컬 구현과 확인

- 플레저: 사람·일정·확인한 기억·선택해 보관한 대화 원문·초안·경조금/연락 기록의 계정 수첩.
- PATH: 장소·선택·연습 기록. 기기 저장 동의를 계정 정보로 이동하지 않는다.
- 대화 리허설: 완료한 대화 기록과 재시도. 진행 중 입력은 계정 저장 응답으로 초기화하지 않는다.
- 가족 앨범: 이야기·레시피·덧붙인 기억과 사진·음성 원본. 문서에는 파일 참조만, 원본은 비공개 보관함에 저장하는 계약이다.
- 공통: 계정 소유권 확인, 기기 기록의 명시 이전, 로그아웃 시 기존 기기 기록 복원, revision 충돌 선택, 계정별 오프라인 대기본, 저장 실패/원본 재시도. 서버에 저장된 계정 사본은 기기에 남기지 않고, 미전송 대기본과 손상된 원본만 보존한다. 로그아웃 뒤에는 남은 기록의 존재만 알린다. 해당 계정으로 로그인한 뒤에만 그 계정의 복구 파일 내보내기·명시 삭제를 제공하며 현재 편집·전송 중 삭제는 막는다. 다른 계정의 기록과 소유자를 확인할 수 없는 손상 원문은 내보내거나 지우지 않는다.

| 확인 범위 | 결과 | 근거 |
|---|---|---|
| 4앱 모델·저장·HTTP·계정·원본 회귀 | 201/201 | [실행 결과](unified-account-unit-20261006.txt), 공통 캐시·복구 시험 23개 포함 |
| 플레저 새 기능 실제 브라우저 | 26/26 | [결과](../../relationship-care/qa/account-upgrade-20261006/result.json) |
| 플레저 합성 2기기 계정 | 43/43 | [결과](../../relationship-care/qa/account-sync-20261006/result.json) |
| PATH·리허설·가족앨범 합성 브라우저 | 76/76 | [결과](personal-apps-20261006/results.json), 미전송 복구·명시 삭제·앨범 전체 삭제 포함 |
| 실제 Chrome 두 탭 공유 저장 공간 | 26/26 | [수정 전 실패](shared-cache-20261006/before-fix.json), [후속 통과](shared-cache-20261006/authenticated-recovery.json), 다른 탭 미전송 원문 보존·단일 초안 직접 선택·마지막 초안 해소 뒤 화면 회복 |
| 실제 Electron 개인 앱 | 3/3, 화면 준비·오류 0 | [결과](../../../desktop/artifacts/personal-native-20261006.json) |
| 네이티브 계정/원본 관련 | 81/81 | desktop 관련 tests |
| 등록·설정 생성·부분 실패 복구 | 34/34 | [실행 결과](../../../tools/synk-id/qa/provision-unit-20261006.txt), 원격 호출은 mock |
| care/personal 서버와 공급자 시험 도구 | 39/39 | [분리 작업본 검증](../../../tools/synk-id/qa/care-release-verification-20261006.txt), 실제 공급자 실행 아님 |
| 전체 스키마와 생성물 | 26/26, 번들·합본 일치 | SYNK-talk tests/L0스키마.test.js, 두 build --check |

사진 복원은 두 격리 브라우저 context에서 원래 바이트가 같은지 확인했다. 주소·계정·파일 ID·MIME·크기·SHA가 다르면 원본을 적용하지 않는다. 웹 화면은 375/1440px에서 넘침·누락 리소스·페이지 오류 0건이다. 실제 휴대전화나 실제 사용자 계정 이용 증거는 아니다.

같은 계정의 여러 탭은 변경마다 고유한 미저장 초안을 보관한다. 저장 ACK는 자신이 보낸 초안만 정리하고, 이전 초안은 한 개여도 사용자가 이어 쓸 기록을 직접 고른다. 선택하지 않은 기록·손상 원문은 보존한다. `pendingStored`로 현재 편집의 실제 기기 보관 여부를 확인하여 기기 저장도 실패했을 때 로그아웃 경고를 표시한다. 아직 수첩에 넣지 않은 메시지·대화 입력도 로그아웃과 페이지 이탈 전에 확인한다.

## 등록과 운영 반영 상태

10월 6일 초기 운영 읽기 조회에서는 살펴본 WORLD·맞춤 도구 등록 2개와 서버 매핑의 일치를 확인했다. 당시 연결 목록은 native 9개, browser 8개였으며 교사 browser는 준비 중이었다. 최신 전체 등록 수와 반영 결과는 위 10월 7일 절에 기록했다. [공통 목록과 적용 도구](../../../tools/synk-id/UNIFIED-CONFIG.md)는 기존 등록을 삭제하지 않고 실제 공급자 등록 결과의 ID만 설정에 반영한다. 읽기 계획, 등록/매핑, 동의 포털 공개, DB/function 반영, 실제 사용자 왕복은 각각 별도 단계다.

2026-10-07 리허설에서는 public OAuth client 18개(신규 15개·기존 3개)의 등록·매핑과 동의 포털 반영을 확인했다. care `20261006100000`와 personal `20261007010000` 두 migration 및 `synk-care`·`synk-personal`·`personal-media-cleanup` 함수 배포도 확인했다. 근거는 [등록·포털 결과](../../../tools/synk-id/qa/운영재개-리허설완료-20261007.md)와 [배포 결과](../../../tools/synk-id/qa/care-personal-rehearsal-deployed-20261007.json)다. 운영 환경 전환 완료를 뜻하지 않는다.

## 최종 검수와 리허설 결과 · 2026-10-07

공식 Claude Code에 `--model claude-opus-5-5 --effort max`를 명시한 [코어 후속 검수](operational-core-closure-20261006.json)와 [마지막 UI 변경 검수](operational-care-final-delta-20261007.json)가 완료됐다. 준비 기록 500건 가져오기 문제까지 해결된 것으로 판정했다. 실제 응답 모델은 Opus 5.5이며 max는 호출 인자 근거다. [등록 도구 최종 검수](../../../tools/synk-id/qa/운영재개-등록최종검수증거-20261007.json)도 통과했다.

실제 리허설 공급자의 [개인자료 기능 32개](personal-provider-20261007.json)는 통과했지만 최초 실행은 정리 실패로 `ok:false`다. 뒤이은 [범위를 한정한 복구](../../../tools/synk-id/qa/personal-provider-recovery-20261007.json)에서 두 실행의 합성 계정 4개·원본 4개를 정리하고 관련 auth user·활성 계정·개인 행 0개를 확인했다. 업로드 staging 만료 재확인은 별도 남아 있다. 원래 실패 결과를 성공으로 덮어쓰지 않는다.

이후 [독립 재실행](personal-provider-isolated-20261007.json)은 실제 리허설 공급자 기능 **32/32**, `exitCode: 0`, `cleanup.complete: true`로 끝났다. 이 실행에서 만든 합성 Auth 계정 2개와 관련 활성 계정·개인 행은 모두 0개로 확인했고 원본 4개 삭제·4개 prefix 비어 있음을 검증했다. 위 최초 실패와 4계정 복구 결과는 별도 역사로 유지한다. `pendingUploadExpiryRecheck: true`는 남아 있으며, 이 실행 자체는 OAuth PKCE·실기기 검증이나 운영 환경 배포 완료를 뜻하지 않는다.

플레저 [browser/native 실제 공급자 PKCE 왕복 9/9](../../../tools/synk-id/qa/care-pkce-provider-20261007.json)도 합성 계정으로 통과했다. 같은 소유자·초안 저장·native 세션 복원·다른 계정 격리·CAS·삭제 tombstone을 확인했다. 이 PKCE 실행의 합성 계정 2개는 삭제 요청 접수·deletion-pending까지 확인했으며 7일 유예 뒤 purge는 미확인이다. 브라우저 로그인 UI·native OS 보관함·실제 사용자·실기기 검증 및 운영 전환 완료와는 구분한다.

아래는 10-06 단계별 검수·중단의 역사 기록이다. 당시 snapshot과 원래 결과 파일은 유지한다.

### 10-06 초기 검수와 재개 전 상태

10월 6일 당시에는 라이브 배포·공개 게시 후보에 Claude 최종 검수를 적용했다. 이 절의 고정 검수 절차는 당시 이력이며, 현재 역할·작업 방식은 [AI 운영 원칙](../../../docs/AI_운영원칙.md)을 따른다. 공식 Claude Code 읽기 검수는 [수정 필요 결과](unified-account-review-20261006.json)를 냈다. 가족 앨범의 참조 해제 원본, 로그아웃 뒤 계정 사본, 영구 저장 오류 분류, 손상된 임시 기록 경고를 수정했다. 사진 교체 저장이 성공했을 때만 이전 참조를 정리하며, 아직 한 번도 문서에 저장되지 않은 원본은 7일 유예 뒤 정리한다. 저장된 앨범이 참조하는 원본에는 이 유예 만료가 적용되지 않는다.

care 4MiB 입력이 JSONB 5MiB를 넘을 수 있다는 지적은 현재 모델에서 재현되지 않았다. 컬렉션 상한으로 계산한 최대 추가 공백 775,008byte를 더해도 DB 상한 이내이며, 실제 postgres 직렬화기·격리 DB에서 정확히 4MiB인 상태의 저장과 JSONB 4,702,190byte를 확인했다. 해당 경계 시험을 추가했으며 서버·DB 상한은 변경하지 않았다.

등록 도구의 후속 Claude 검수는 사용량 한도로 종료되었다([실제 응답](../../../tools/synk-id/qa/unified-provisioning-final-review-20261006.json), 안내된 재개 시각 2026-10-06 22:50 Asia/Seoul). 이후 사용자 요청으로 최종 검수 기준을 **Opus 5.5 · max**로 변경했다. 21:55에 `--model claude-opus-5-5 --effort max`를 명시하고 재개했지만 [다시 사용량 제한 응답](unified-account-opus55-review-20261006.json)을 받았다. 새 추론은 실행되지 않았으며 재개 결과의 과거 `modelUsage: claude-opus-5`는 기존 세션 누적 기록이다. Opus 5.5 검수 성공 증거로 쓰지 않는다.

당시에는 위 수정분의 Claude 재검수와 등록 도구 검수가 끝나기 전까지 운영 변경을 보류했다. [재검수 자료](unified-account-review-followup-20261006.md)에 변경 근거·명시한 모델/추론 옵션·이어갈 세션을 남겼다. 자동 재개·예약은 설정하지 않았다.

10월 6일 당시 릴리스 후보는 `C:/Users/q1212/Documents/SYNK-talk-care-release-20261006`, `codex/synk-care-personal-20261006`에 분리했다. 기존 auth/store의 다른 작업 변경을 제외하고 이번 26개 파일만 준비했으며 이 시점에는 커밋·push를 하지 않았다. 이후 모델·번들 대조, 검수, 리허설 공급자 왕복과 운영 반영 결과는 위 10월 7일 절에 별도로 기록했다.

## 22시대 후속 · 플레저 행동 준비 확장

사용자 승인으로 플레저에 준비 추천·수정 취향 확인·표현 점검·후속 챙김·PNG 기억 카드를 추가했다. `followups`/`preparations`는 같은 SYNK ID 수첩에 포함하고 PC main 전송 허용 목록과 서버 정본 번들을 함께 갱신했다. 현재 검증은 [ENGINE-UPGRADE](../../relationship-care/qa/ENGINE-UPGRADE.md), 현재 후보 SHA는 [engine-upgrade-release-sha](../../../tools/synk-id/qa/engine-upgrade-release-sha-20261006.json)다.

새 모델의 JSONB 최대 추가 공백은 803,010byte, HTTP 최대와 합쳐 4,997,314byte다. 정확히 4MiB인 실제 입력의 typed JSONB 저장은 4,702,194byte였다. 별도 release 후보에서도 모델/번들/DB14개 검사를 통과했다. 위 775,008/4,702,190 수치는 확장 전 모델의 증거다. 이 22시대 로컬 작업만으로는 원격 등록·배포나 Claude 최종 검수 완료 상태가 바뀌지 않았다. 이후 리허설과 검수 결과는 위 2026-10-07 절에 구분했다.

운영 화면 후속 확인: [375px 실제 버튼에서 공개 로그인 화면 도달](../../relationship-care/qa/production-local-20261007/portal-result.json)도 7/7 통과했다. 운영 care client·콜백과 S256 요청을 확인했고 입력·가입·동의·토큰 교환은 하지 않았다. 이 결과는 인증 후 개인자료 왕복과 구분한다.
