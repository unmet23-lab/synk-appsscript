# 플레저 · 닫힌 앱 알림 · 2026-10-07

구현과 운영 반영 기록. policy `a227d85671269bd4ed6095c5db1545ba36bd1857` 공개 47개 파일과 서버 2개의 운영 반영을 확인했다. 실물 알림 수신은 별도 미확인이다.

**10월 8일 후속:** 지연된 송신의 자정·90분 처리 창 재확인과 응답 시각 기준 재시도를 서버 커밋 `9b68b62`, 두 함수 v5로 운영 반영했다. 서버 51/51·Opus 5.5/max 검수, 배포 전후 각각 운영 36/36으로 실제 두 세션의 충돌·삭제·해제와 완료/미룬 후속의 cron 건너뛰기 및 합성 자료 정리를 확인했다. 아래는 10월 7일의 기록이며 최신 증거는 [운영 두 세션·시간 경계 QA](../ops-roundtrip-20261008/README.md)다. 실물 수신 미검증은 유지한다.

## 제공 범위

- SYNK 계정으로 로그인한 웹에서 기기마다 직접 동의한다. 시작·새로고침 때 권한을 요청하지 않는다.
- 한국 시간으로 사용자가 정한 시각에 하루 한 번 평가한다. 일정의 선택한 미리 알림 날짜와 정확히 오늘로 정한 후속 챙김만 대상이다. 지난 후속 챙김을 매일 재촉하거나 일반 안부 추천을 푸시하지 않는다.
- 최신 **계정 저장본**을 전송 직전에 확인한다. 완료·미루기·삭제가 아직 기기에만 대기 중이면 서버에 반영되기 전이다.
- 잠금화면 문구는 ‘오늘 챙길 일이 있어요. 수첩에서 확인해 주세요.’로 고정한다. 이름·일정명·기억·대화·자격증명을 보내지 않는다. 누르면 서비스 워커가 등록된 같은 출처의 플레저 경로를 연다(운영 `/care/`, 로컬 `/`).
- 로그아웃·세션 해제·계정 삭제·수첩 삭제에 구독을 연결한다. 브라우저 해제 실패와 서버 해제 실패를 구분하고 재시도할 수 있다.
- 알림을 껐다 켜 새 endpoint가 생겨도 같은 로그인 세션의 당일 발송 이력을 유지한다. 활성 기기 10개·한국 날짜당 새 endpoint 20개로 제한하고 오래된 비활성 endpoint를 정리한다.

## 재시도와 한계

예약 시각 이후 최대 90분(한국 자정을 넘기지 않음) 안에서 처리한다. 확실한 미수락 응답 429/5xx만 5분 간격으로 최대 3번 시도한다. 전송 결과가 불명확하면 중복 발송을 피하려 당일 다시 보내지 않는다. 서비스 중단·브라우저/OS 설정·네트워크에 따라 알림이 누락되거나 늦을 수 있다. push gateway TTL은 5분이다. 이미 전달된 알림을 이후 완료 기록으로 회수할 수 있다고 보장하지 않는다.

현재 작업자는 분당 최대 10개 기기를 순서대로 처리한다. 같은 시각에 몰린 기기는 90분 창에서 이론상 약 900개까지만 처리할 수 있고, 재시도·지연이 있으면 더 적다. 대규모 운영 전 처리량 확장이 필요하다.

첫 사용 시 수첩을 계정에 저장한 뒤 알림을 켠다. 저장본이 없으면 권한 허용 뒤에도 저장 안내와 함께 등록이 거절될 수 있다. iPhone/iPad는 홈 화면에 추가한 웹앱에서 설정한다. 기존 PC 네이티브 개발 앱에는 Web Push 권한을 추가하지 않았다. 서비스 워커는 페이지·수첩·토큰을 캐시하지 않는다.

## 검사

- 전체 Care 회귀: **213/213**. [프런트 출력](tests-frontend.txt).
- 신규 backend·독립 통합·기존 Care 서버: **44/44**. [서버 출력](tests-backend.txt).
- 29개 알림 컨트롤러/SW 시험은 위 213개에 포함한다. 초기 로그인 복원, 계정 전환 중 늦은 구독, 해제 실패 재시도, 변경 응답 유실, 수첩 삭제, 고정 링크를 포함한다.
- 실제 PGlite 스키마와 postgres JSON 직렬화 시험은 서버 44개에 포함한다. 완료/미루기·소유권·실행 경합·claim 이후 로그아웃/삭제·당일 endpoint 교체를 포함한다.
- [web-push@3.6.7 실제 암호화/복호화](web-push-offline-crypto.json)는 합성 키만 사용하고 외부 전송을 하지 않았다.
- 공식 Claude Opus 5.5/max 검수는 초기 `claude-review.json`, 수정 후 `claude-delta-review.json`·`claude-final-review.json`, 운영 키 설정 `claude-deploy-review.json` 순서다. 초기 P1과 독립 재현 P1을 모두 수정했다. 실제 모델·완료 판정·소스 해시 동결은 `claude-model-proof.json`과 `claude-source-inventory.json`으로 확인한다.
- 초기 연결 실패 뒤 CUA가 복구되어 [공개 게스트 화면과 합성 조작](browser-verification.json)을 실제 Chrome에서 확인했다. 375/320px 가로 넘침 없음, 상태문 16px, 주요 저장 단추 56px. 닫힌 브라우저의 실제 기기 수신은 아직 확인하지 못했다. PC↔실물 휴대폰 왕복은 사용자 요청대로 보류한다.

## 운영 결과

`production-schema.json`, `production-functions.json`, `production-verify.json`에서 운영 migration/함수/접근권한/예약 설정을 확인했다. `production-provider-smoke.json`은 실제 Auth의 합성 계정으로 수첩 저장, 알림 등록/해제, 분 단위 cron이 빈 수첩을 건너뛰는 동작, 수첩 삭제의 알림 해제를 확인하고 시험 자료를 정리한 결과다. 외부 gateway로 알림을 보내거나 실제 기기에서 받은 증거는 아니다. `public-verification.json`의 공개 47/47 SHA/MIME 일치, `deployment-ci.json`의 Pages·전체 사이트 자동 검사도 최종 커밋에서 모두 통과했다. 최초 검사는 관련 없는 LAB racing 파일의 일시 503 한 건으로 실패했고 재확인/최종 재실행에서 해소됐다.

`SYNK_CARE_PUSH_DISPATCH_KEY`는 현재 Vault `service_role_key`와 같은 운영 프로젝트의 비밀 키를 확인한 뒤 복사한 설정이다. 현재 Vault는 신형 secret 키이며 기존 값을 바꾸지 않았다. worker의 정확한 키 비교와 gateway JWT 검사를 유지한다. Vault 키를 교체하면 이 환경변수도 함께 갱신해야 한다. 초기 점검의 키 형식/HTTP 헤더/빈 응답 처리와 시험 계정 정리 경위는 `deployment-reconciliation.json`, provider smoke 결과에 기록했다.

참고: [Microsoft Edge Web Push](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/push), [Microsoft WNS 도메인 검증](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/push-notifications/wns-overview), [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API), [WebKit 홈 화면 Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/), [web-push 공식 소스](https://github.com/web-push-libs/web-push/tree/v3.6.7). 현재 소스에는 무료 프로토콜 연결만 추가했고 유료 AI 호출은 없다.
