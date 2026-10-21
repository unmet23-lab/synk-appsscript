# 공개 전 우주선 복습 경계 수정 · 2026-10-09

다른 창에서 같은 참가자를 이어 플레이하면 SSE `replaced` 이벤트가 이 창을 입구로 돌려놓는다. 이때 남겨 둔 `state.phase`는 `playing`인데, 입구에 표시된 무료 복습 버튼의 내부 조건은 이를 차단해 눌러도 반응하지 않았다. 실제 입구 상태인 `stopped`를 복습 허용 조건에 포함했다. 정상 진행 중인 협동 화면에서는 계속 차단한다. 방·참가자 토큰·완주 기록·보상·계정 계약은 바꾸지 않았다.

- `app.before.mjs`, `recovery.before.test.mjs`, `before-hashes.json`: 수정 전 원문과 SHA.
- `replaced-recall-test.txt`: 실제 app source·합성 DOM 및 `replaced` SSE 응답을 사용한 관련 회귀 1개 통과. `playing` 진행 중 차단·대체된 뒤 복습 허용·기존 방과 토큰 유지 확인.
- `replaced-recall-browser-result.json`: 별도 Chrome의 합성 게스트/세션/SSE fixture 8조건 통과. 실제 승인 MP3 정상 종료 뒤 답 조작 열림, 정상 계정·서버 쓰기0, 외부 요청0, 브라우저 오류0.
- `replaced-entry-recall-390.png`: 기존 `playing` 세션이 다른 창으로 넘어간 뒤 입구에서 열린 복습.
- `browser-cleanup.json`: 본 QA 소유 브라우저 종료·클라이언트 닫기 확인. 이번 집중 QA 명령은 정상 exit-0으로 끝났다.
- `first-harness-AbortController-missing.txt`: 새 SSE 경로 시험에 VM의 `AbortController`가 없었던 첫 harness 실패를 보존했다. 제품 오류로 세지 않는다.

7개 MP3와 manifest의 SHA가 기존 승인 자산과 일치한다. 새로운 음원이나 공식 모델을 호출하지 않았다. 기존 95조건 전체 QA를 반복하지 않고 이번 경계와 승인 MP3만 확인했다. 실제 사람·물리 휴대폰·실계정 복원·공개 배포 증거가 아니다.
