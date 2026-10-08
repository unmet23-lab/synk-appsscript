# 사람별 일반 안부 주기 · 2026-10-08

상태: **사용자가 이번 안부 주기 변경만 검수 예외·배포를 승인해 운영·공개 반영 완료.** 공식 Opus5.5/max 검수 자체는 주간 한도 429로 미완료다. 이전 캐시 예외를 확장한 것이 아니라 별도 사용자 승인을 기록했다.

저장 서버 `45ea903`(Care v11, push 두 함수 v9), 공개 웹 `5528be3`에 반영했다. 다른 사이트 변경이 들어온 부모 `9e656f7`는 그대로 보존하고 승인된 Care 9파일만 게시했다.

## 사용자가 얻는 기능

- 사람의 정보 수정에서 7·14·30·60·90일, 직접 입력 1~365일, 일반 안부 추천 끄기를 고른다.
- 미설정은 기존 30일. 기본값을 바꾸지 않은 기존 자료는 새 필드를 강제로 저장하지 않는다.
- 마지막 실제 챙김 기록을 기준으로 계산한다. 챙긴 기록이 없으면 첫 안부를 제안한다. 문구 복사·초안은 챙긴 것으로 세지 않는다.
- 추천 끄기는 생일·기일·사용자가 직접 정한 후속 챙김·수동 안부 준비·기기 알림 시간을 바꾸지 않는다.
- 기존 조심스러운 기간과 미래 후속 챙김 보호를 유지한다.

## 저장 계약

`person.checkinIntervalDays`는 선택 필드다. 명시한 값은 숫자 정수 0~365만 허용하며, 0은 일반 안부 추천 끄기다. null·문자열·소수·명시 undefined는 거절한다.

새 Care 저장 요청은 `messageLibraryVersion:1`과 `checkinPreferenceVersion:1`을 보낸다. 서버는 계정 잠금 안에서 현재 또는 입력 사람에 안부 주기 필드가 있으면 지원 표식 없는 저장을 426으로 차단한다. 명시적 0도 포함한다. 유효한 상태의 이전 revision은 기존 409가 먼저다. 기존 문구 보관함 보호·계정 분리·전체 삭제는 유지한다. DB migration은 없다.

브라우저/native/desktop 어댑터는 새 표식의 정확한 숫자 1과 Care 저장 전용 사용을 검사한다. 서버는 기존 보관함 계약처럼 숫자 1 외에는 미지원으로 간주하며 보호 필드가 있으면 426을 반환한다. 기존 필드가 없는 자료의 구형 앱 저장은 계속 허용한다.

옛 임시 수첩에 서버의 명시적 주기 필드 또는 해당 사람이 빠져 있으면 자동 업로드하지 않고 충돌 선택을 요구한다. 서버 조회 실패 뒤에도 재조회 없이 덮어쓰지 않는다. 명시적 덮어쓰기 선택은 기존 동작을 따른다.

## 확인 결과

| 범위 | 결과 | 증거 |
|---|---:|---|
| Care 전체 | 323/323 | care-tests.txt |
| 공통 계정·desktop | 187/187 | account-tests.txt |
| 저장·bundle·migration·push 회귀 | 59/59 | backend-tests.txt |
| 공개 후보 빌드 | 48파일 | `.tmp/care-checkin-preview-20261008/build-manifest.json` |
| 실제 IAB 로컬 화면 | 완료 | browser-verification.json |

신규 모델 12·동기화 7·UI 11개 시험을 포함한다. UI 시험은 실제 함수·핸들러를 실행해 기본값 부재, 0 보존, 입력 오류, 취소, 계정/원본 변경, 저장 실패의 성공 안내 억제를 검증한다.

브라우저는 게스트 합성 사람으로 45일 저장·재열기, 366 입력 차단, 추천 끄기, 취소 후 설정 유지, 375/320px 화면을 확인했다. 실제 계정의 자료는 수정하지 않았다. 실물 휴대폰 왕복과 OS 알림 수신은 사용자의 보류를 유지한다.

## 완료 증거와 범위

- 사용자 승인: user-review-exception.json. 19개 변경 원본 목록과 48파일 후보 manifest SHA를 동결했다. Claude 성공으로 표시하지 않았다.
- 운영 서버: release-preflight/baseline/deploy/verify.json. 기존 배포 런타임이 기준 HEAD와 같은지 먼저 확인한 뒤 3함수를 배포했다. 생성 런타임 바이트 일치·JWT 활성·익명401을 확인했다. 정적 entrypoint 앵커 비교는 0/0으로 미측정이며 전체 entrypoint 대조로 주장하지 않는다. DB migration·예약·제공자 설정은 바꾸지 않았다.
- 운영 실제 왕복: production-roundtrip.json, **61/61**. 실제 Auth 두 세션과 다른 합성 계정, 실제 browser account adapter/document sync/fetch로 0→365→명시30→필드 제거 저장·복원을 확인했다. 지원 없는 최초 명시값·구버전 삭제426, 이전revision409, 계정 격리, 수첩 삭제 tombstone을 확인했다.
- 합성 계정 2개 정리: synthetic-cleanup-journal.json 및 cleanupProof 모두 true. 생성한 Auth·연결·계정·수첩·구독·세션·audit·active계정 부재를 각각 확인했다. 실사용자 자료는 수정하지 않았다.
- 공개: release.json과 public-verification.json. 정규URL **48/48 SHA·MIME 일치**. Pages 완료 전 첫 대조39/48는 public-verification-before-pages.json에 보존했고, 게시 완료 후 재대조48/48로 마쳤다.
- 실제 공개 IAB: public-browser-verification.json. 일반 새로고침 후 설정 표시,14일 저장/재열기,추천 끄기,375px 설명16px·저장단추52px·가로넘침없음·콘솔오류없음. 합성 게스트 자료는 새로고침으로 정리하고0명/기기저장꺼짐을 확인했다.
- 같은 공개 커밋 CI: ci.json, [Pages](https://github.com/unmet23-lab/synk-policy/actions/runs/37687996197)·[전체 사이트 점검](https://github.com/unmet23-lab/synk-policy/actions/runs/37687996347) 모두 성공.
- Source main working tree의 기존 다른 변경은 보존했다. backend커밋은 기존 codex 브랜치로 push했다. desktop 전달 코드의 로컬 검사는 desktop 설치본 배포 증거가 아니다.
- 실물 휴대폰 왕복·OS 알림 수신은 사용자 보류를 유지한다. 이번 검수 예외는 다른 신규 기능에 적용하지 않는다.
