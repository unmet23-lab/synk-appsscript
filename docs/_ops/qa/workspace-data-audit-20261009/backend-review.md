# WORLD v1 공통 학습 연결 · 독립 읽기 검토

2026-10-09. 별도 `messenger_scope` 후속 수정 중인 로컬 소스를 읽었다. **독립 테스트 실행·현재 런타임 적용·배포 검증으로 표현하지 않는다.** 현대 3D 런타임 판정은 [modern-runtime](modern-runtime.md)을 따른다.

검토한 범위는 `SYNK-talk/lib/world-v1-learning.js`, `world-v1-store.js`, `world-v1-server.js`, `synk-classroom-store.js`, `synk-classroom-teaching.js`, `20261009233000_world_v1_learning_c16.sql`과 기존 `synk-store.js`의 계정 트랜잭션·학습 append, Atlas의 계정 소유 history·문항군 처리다.

- 완료 결과는 검증된 Auth → 기존 `withAccount`의 실제 owner 트랜잭션에서 저장한다. 개인 학습 동의가 꺼져 있으면 공통 학습 기록을 수집하지 않으며, 이미 끝낸 무동의 수행을 이후 동의로 소급 수집하는 호출은 없다.
- 학습 기록은 `finished.changed`인 첫 완료에만 추가한다. 기존 request receipt와 run 완료 상태를 확인하는 재요청 분기는 새 기록을 추가하지 않는다. 클라이언트가 전달한 `correct`나 과제 owner를 신뢰하는 경로를 추가하지 않았다.
- 서버 채점된 `location`만 기존 `ko.reading.detail` 측정에 연결하고, `greeting`·`water`는 `taxonomy-unmapped`로 보관해 약점 통계에서 제외한다. 고정 location의 같은 문항군 식별자를 유지한다.
- classroom의 신뢰 출처는 사용자의 출처 문구 대신 불변 서버 score table의 같은 owner·eventId 연결로 판정한다. 현재 담당 반·계정·공유 revision 및 개인 학습 revision의 경계를 유지한다.
- 검토 중 root가 발견한 삭제 누락의 후속 보강을 확인했다. 표현 2행의 `anchor_event_id` 삽입과 canonical event FK cascade가 추가됐고, classroom의 `liveSources`와 연결되지 않은 저장 evidence를 제거하는 코드가 반영됐다. 원래 과제 제출 receipt를 보존하는 것과 삭제된 학습 근거를 계속 평가에 사용하는 것을 구분한다.

**이 읽기 범위에서 추가로 보고할 재현 근거가 있는 P1/P2 문제는 찾지 못했다.** 작성 중인 소스의 전체 migration/동의·중복·삭제 테스트, 현재 4296 프로세스의 재시작과 실제 WORLD → Workspace 왕복은 해당 작업의 별도 검증 기록을 확인해야 한다. 이 학습 hook 보강은 현대 Town의 계정별 JSON 저장과 Workspace 생활 활동을 연결한 변경이 아니다.
