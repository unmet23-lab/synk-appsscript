# WORLD · TOWN · Workspace 공통 데이터 검수 — 서버

2026-10-09. 합성 계정과 메모리 PGlite(PostgreSQL 호환 엔진)의 실제 SQL 거래를 검사했다. 운영 PostgreSQL, 운영 계정, 현재 4296의 별도 로컬 DB에는 적용하거나 접속하지 않았다. 아래 수정은 소스와 생성물 준비 상태이며 전체 운영 연동 완료를 뜻하지 않는다.

두 결함을 재현하고 수정했다. WORLD v1의 `play/complete`는 보상·게임 결과를 자체 테이블에만 보관해서 같은 계정의 `synk_learning_events`를 읽는 교사 화면에 학습 기록이 빠졌다. 또 canonical 원장을 지워도 수업 JSON의 서버 읽기 사본을 약점 근거로 계속 사용해 독립 문항 수가 3으로 남았다.

| 키 | 담당 원본·의미 |
|---|---|
| `auth.users.id` → `synk_auth_links.synk_user_id` | 검증한 로그인과 공통 SYNK 계정 연결. 이름·이메일로 소유자를 합치지 않는다. |
| `learners.learner_id`, `class_id` | 실제 학원 명부와 담당 반. `staff_classes`가 교사의 반 접근을 결정한다. |
| `synk_learning_events(synk_user_id,event_id)` | 동의한 개인 학습 원장. `server_seq`는 서버 수신 순서다. payload의 `subject=device`는 호환 학습 scope이며 학생 소유자는 SQL의 `synk_user_id`다. |
| `synk_classroom_event_links` | 공통 원장의 사건을 현재 반·학생·공유 revision에 연결한다. 원장이나 과제 실행의 소유자를 바꾸지 않는다. |
| `synk_world_v1_state/runs/requests` | 같은 공통 계정이 소유한 아바타·보상·게임 실행·재시도 영수증. 독립 평가 엔진이 아니다. |
| `synk_world_v1_learning_scores` | 서버가 채점한 V1 실행의 3응답 receipt. 개인 학습 동의 때만 기록하며 현재 개인 동의 revision과 반 공유로 요약한다. |
| `synk_academy_towns`, `synk_academy_town_memberships` | 학원 반 하나와 공식 마을 하나의 명시적 mapping. 공개 Town을 자동 연결하지 않는다. |
| 수업 `learnerState.town` / `synk_academy_town_activity` | canonical linked Town의 개인 상태와 별도 동의한 활동 요약. 실제 최신 3D Town의 별도 상태 저장소를 이식하거나 통합하지 않았다. |

V1은 1회 완료의 **3응답 receipt**를 연결한다. 기존 Strata의 `ko.reading.detail`과 직접 대응하는 장소 문항 **1개만 측정**한다. 인사·물 요청의 표현 선택 **2개는 영역 미분류 활동**으로 보관하고 약점 통계에 넣지 않는다. 같은 문항 family를 반복해도 새 독립 문항으로 세지 않는다. 서버 채점 출처는 클라이언트가 쓸 수 없는 provenance 표로 확인한다. 이를 게임 조작·생활 완료·TOPIK 효과로 표시하지 않는다.

현재 개인 학습 동의가 꺼져 있으면 V1 완료와 참여 보상은 유지하고 학습 원장은 쓰지 않는다. 이미 끝난 무동의 실행이나 연결 준비 전 실행을 나중에 소급 수집하지 않는다. 반 공유가 꺼져 있으면 교사에게 개인 학습·V1 요약을 보내지 않는다. 개인 동의 revision이 바뀌면 예전 미분류 요약을 재노출하지 않는다. 3응답 receipt 전체를 장소 응답의 `anchor_event_id`에 FK로 묶어 같은 revision에서 원장이 삭제돼도 파생 3행이 함께 지워진다.

수업 투영은 `sourceEventId`가 실제 canonical 원장에 남은 언어 근거만 사용한다. 별도 교사 관찰 메모와 원래 과제 제출 결과는 지우지 않는다. 전체 계정 삭제는 기존 7일 유예·학원 소속 검토·확정 purge 절차를 사용하며 V1 실행·원장·수업 링크·케어·Town 파생 요약까지 제거하고 다른 계정은 보존한다.

새 반례 7개와 기존 수업·삭제·V1·계정 생명주기 회귀를 합쳐 **38/38** 통과했다(25.087초). 마지막 새 시험 **7/7** 재실행(3.702초)은 같은 revision 삭제의 물리 score 0·화면 0, 관찰·원제출 보존도 확인했다. 이 7개는 38개에 포함되는 묶음이며 별도의 45개 시험으로 합산하지 않는다. 상세 명령·실행 시간·최종 소스/생성물 해시는 [backend.json](backend.json)에 있다.

재현은 SYNK-talk에서 다음 명령으로 한다.

```powershell
node --test tests/world-classroom-integration.test.js
node --test tests/world-classroom-integration.test.js tests/synk-classroom.test.js tests/synk-classroom-purge.test.js tests/world-v1-server.test.js tests/world-v1-lifecycle.test.js
node tools/world-v1-build.js --check
node tools/synk-classroom-build.js --check
```

운영 적용 준비 순서는 기존 공통 계정·수업·V1 선행 DB를 확인한 뒤 `20261009230000_synk_teaching_care_towns_c16.sql`과 `20261009233000_world_v1_learning_c16.sql`을 검증하고, V1·수업 함수 생성물, 회사 브라우저·학생·네이티브 호스트를 맞추는 것이다. 이후 별도 승인된 운영 반영과 실계정 왕복이 필요하다. 이번 검수에서 운영 migration·함수 배포·기능 플래그 변경·실계정 사용은 하지 않았다.
