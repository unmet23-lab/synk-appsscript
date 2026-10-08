# 플레저 · 기록에서 다음 행동으로

2026-10-06 로컬 구현/검증. 합성 사용자와 격리 Chrome·로컬 PostgreSQL 호환 DB를 사용했다. 실제 운영 로그인·외부 발송·공개 배포·사용자 만족도 향상 시험은 아니다.

## 사용 흐름

1. 사람 → 마음 전하기 → **이번에는 어떻게 챙길까요?**에서 결과를 바꾸는 질문에 답한다. 추천 준비를 선택하거나 조건을 다시 정한다. 다른 방법과 추천 근거는 접힌 상세에서 확인한다.
2. 문구를 직접 수정 → **표현 점검하기** → 날짜·이름·금지 표현·약속 표지 확인. 이번 수정을 다음에도 쓰고 싶으면 해당 취향 후보를 직접 확인한다. 이미 저장된 미확인 설정이 있으면 그 설정부터 확인한다.
3. 우리의 기록에서 **다음에 챙길 일**을 날짜와 함께 남긴다. 지금 챙기기는 입력을 열며 완료는 별도로 표시한다. 다음에/이제 그만도 직접 선택한다.
4. **기억 카드**에서 1~3개 기록과 발췌문을 확인하고 선택 사진/메시지를 넣어 PNG로 저장한다. 다른 사람의 기록·원문 전체·계정 정보는 내보내지 않는다.

## 확인 결과

| 범위 | 결과 | 증거 |
|---|---|---|
| 모델·기존/신규 엔진·HTTP·PC 계정 및 저장 정책 | 187/187 | [단위/통합 로그](engine-upgrade-20261006/unit-tests.txt) |
| 신규 실제 브라우저 흐름 | 35/35 | [결과](engine-upgrade-20261006/result.json) |
| 비동기 카드와 입력 보호 재현 | 9/9 | [결과](engine-races-20261006/result.json) |
| 기존 수첩·달력·가져오기 회귀 | 26/26 | [결과](account-upgrade-20261006/result.json) |
| 최초 등록·문구 복사·보관·복원 회귀 | 29/29 | [결과](ui-report.json) |
| 계정 충돌·복구·두 탭·로그아웃 회귀 | 39/39 | [결과](account-sync-20261006/result.json) |
| 분리된 backend 후보의 번들/계정/DB | 14/14 | [로그](engine-upgrade-20261006/backend-tests.txt), [현재 SHA](../../../tools/synk-id/qa/engine-upgrade-release-sha-20261006.json) |
| 실제 PNG 생성·디코딩·선택 사진·최대 텍스트 | 통과 | [결과](engine-upgrade-20261006/memory-card-result.json), [PNG](engine-upgrade-20261006/memory-card.png) |

142개 검사 뒤 발견한 미확인 선호의 일괄 승인 경계를 보완하고 PC 계정 경로까지 포함해 최종 187개로 다시 실행했다. 브라우저에서 사람을 바꾸는 동안 끝난 카드가 이전 사람의 미리보기를 열지 않고 다음 카드 버튼도 정상 작동하는지 재현했다. 계정 새로고침은 작성 중인 후속 메모·카드 제목을 확인 없이 지우지 않는다. 추가된 배열을 PC main의 고정 `careSave` 허용 목록에 반영했다.

신규 브라우저 검사는 조건 초기화, 명시적 계획/평가, 준비 통계 500개 한도에서도 계속 쓸 수 있는 계획 저장, 후속 후보 확인·미루기·완료/중단, 실제 PNG 다운로드, 320/375/1440px에서 페이지 넘침과 런타임 오류를 검사한다. 최종 실행의 미처리 오류·실패 리소스 요청은 0건이다. 실기기 검증은 아니다.

DB는 새 `followups`/`preparations`를 포함한 상한에서도 HTTP 4MiB를 유지한다. 모든 컬렉션 상한으로 계산한 JSONB 추가 공백 최대 803,010byte, 합계 최대 4,997,314byte로 기존 DB 5MiB 아래다. 정확히 4MiB인 실제 상태를 typed postgres 직렬화기로 저장한 JSONB는 4,702,194byte였다. 소유자 분리·CAS·삭제 tombstone 검사를 유지했다.

## 화면

- [준비 화면](engine-upgrade-20261006/prepare-ready-desktop.png)
- [375px 준비](engine-upgrade-20261006/preparation-375.png)
- [320px 표현 점검](engine-upgrade-20261006/expression-320.png)
- [320px 카드](engine-upgrade-20261006/memory-card-320.png)

## 재현

```powershell
node --test experiences/relationship-care/tests/*.test.mjs tests/atlas-vellum-expression.test.js tests/atlas-trail-followup.test.js tests/atlas-outcomes.test.js tests/atlas-preparation-outcomes.test.js desktop/tests/care-preview.test.cjs desktop/tests/product-preview.test.cjs desktop/tests/care-account.test.cjs desktop/tests/auth.test.cjs
node experiences/relationship-care/qa/engine-upgrade-smoke.cjs
node experiences/relationship-care/qa/engine-races-smoke.cjs
node experiences/relationship-care/qa/memory-card-smoke.cjs
node experiences/relationship-care/qa/account-upgrade-smoke.cjs
node experiences/relationship-care/qa/account-sync-smoke.cjs
node tools/care-memory-theme.cjs --check
```

기억 카드와 경계 재현 QA는 기본 포트 4296을 사용한다. 신규 전체 UI QA는 자체 격리 loopback 서버를 열고 닫는다. 합성 fixtures만 사용한다.

## 남은 운영 범위

계정 저장 코드는 공통 SYNK ID에 연결돼 있고 새 자료도 같은 경로를 통과한다. 실제 운영 OAuth 등록/설정·최소 DB/function 반영·실계정 두 기기 왕복은 아직 완료하지 않았다. [기존 운영 재개 기록](../../synk-account/qa/unified-account-20261006.md)의 Claude 최종 검수와 등록 검수가 남아 있다. 최종 검수 모델은 사용자 요청대로 `claude-opus-5-5 --effort max`이며 사용량 제한 응답을 통과로 세지 않는다. 이번 로컬 기능 구현을 위해 운영 변경이나 자동 예약은 수행하지 않았다.

LLM 의미 이해, 가족 앨범 자동 조회, 앱 종료 후 자체 푸시, 실제 메시지 발송/선물 결제는 이번 구현에 포함되지 않는다. Core·Ask의 결정과 Vellum의 표면 점검은 제품 규칙에 따른 보조다. 만족도는 본인이 직접 답한 통계이며 개선 효과·상대 기분·관계 점수로 해석하지 않는다.
