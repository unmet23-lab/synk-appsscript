# 고른 튜터의 실수별 힌트와 해당 부분 재연습 · 2026-10-10

로컬 구현. [마루 미리보기](http://127.0.0.1:4314/mobile.html?opening=off&companion=1&practice=1&hints=1)의 놀이에서 고른 튜터와 게임을 시작한다. 실제 판정 뒤 게임 바의 ‘힌트’를 누르면 최근 어려웠던 부분과 그 부분만 다시 연습하는 단추가 나온다. 첫 튜터 선택과 조작 연습은 기존 흐름을 사용한다.

## 범위와 근거

- 바람길의 실제 실패 동작과 표시선 타이밍을 구분한다. 실행/충돌만으로 문장 이해 오류를 진단하지 않는다. 별도 듣기 확인의 오답은 실제 고른 행동과 기존 교정 해설을 사용한다.
- 리듬의 실제 O/X 판정과 실제 노트 품질은 별개다. 정답+박자 놓침, 문장 오답, 두 실패, 응답 없음이 각각 다르게 표시된다. 긴 노트에서 손을 빨리 떼는 실수는 유지 입력 연습으로 연결된다.
- 한글의 실제 소리/글자 불일치와 소리 전달 미확인을 나눈다. 첫 문장 힌트는 서버가 확인한 종료 결과의 정확한 답 표현을 사용한다.
- 동작은 제한된 한 단계, 문장은 이미 답한 문항을 다시 연습한다. 실제 녹음 ended 이벤트 전에는 선택을 잠그며 실패/취소에서는 성공을 만들지 않는다. 문항을 새로 생성하거나 처음 보는 문제의 답을 먼저 보여 주지 않는다.
- 원래 첫 답·점수·한글 진도·듣기 확인·첫 문장 서버 종료 결과는 재연습으로 덮어쓰지 않는다. 이 화면의 ‘함께 연습 완료’는 도움 연습 사실이며 독립 정답/급수/학습효과/추가 코인이 아니다.
- 최근 도움 12개는 기기 안의 계정/비회원·튜터·게임별로 나눈다. 새 서버 저장 키/동기화, 유료 AI 대화, 새 이미지/음성 생성, 공개 배포는 없다.

## 검수 결과

- [게임/힌트/재연습](browser-result.json): 43개 통과, 오류/누락 자산/외부 요청 0. 마린 바람길, 까몽 리듬, 몽글 한글, 계정 첫 문장까지 실제 조작과 기존 녹음을 사용했다. 해당 동작 한 단계, 문장 재선택, 진행/점수 유지, 페이지 복원, 계정 분리를 확인했다.
- [타이밍/긴 노트/화면/실패](extra-result.json): 19개 통과, 브라우저 오류/누락 자산/외부 요청 0. 실제 늦은 점프, 실제 긴 노트 조기 해제, 320×568/740×320 화면, 실제 듣기 확인 오답, 의도적으로 막은 녹음과 재시도, 입구에서의 재연습을 확인했다.
- [관련 Node 시험](unit.tap): 129개 통과, 실패 0. 새로운 관찰 분류/힌트/저장/제한된 동작 9개와 기존 게임 판정·음성·듣기 확인/교정·선택/튜토리얼·문서 경계를 포함한다.

개발 중 `browser-failure.json`/`extra-failure.json`과 failure 이미지는 이전 실행 기록이며 완료 근거는 위 최종 result다. 지난 조작 연습에서 확인한 리듬 `app-learning.test.mjs`의 기존 VM/top-level await 하네스 문제는 그 문서에 남겨 두었고 이번 129개 집계에는 넣지 않는다. 저장소 전체 시험을 통과했다고 표시하지 않는다.

자동 검수는 QA 시간 이동/알려진 정답·합성 계정과 실제 UI 입력을 사용한다. 실제 학생의 이해·학습효과, 실물 휴대폰의 터치/소리/지속 성능, 운영 계정 왕복, 공개 반영을 입증하지 않는다. 틀린 선택의 원인은 추측하지 않고 확인한 선택과 게임 판정만 표시한다.

## 화면

[마린 동작 힌트](marin-control-hint.png) · [마린 점프 타이밍](marin-jump-timing.png) · [맞은 답의 박자 놓침](kkamong-correct-answer-missed-beat.png) · [까몽 문장 힌트](kkamong-language-hint.png) · [까몽 재연습 성공](kkamong-language-rehearsed.png) · [몽글 소리/글자 힌트](mongle-hangul-hint.png) · [몽글 재연습 성공](mongle-hangul-rehearsed.png) · [작은 화면](support-320x568.png) · [가로 화면](support-740x320.png).

## 실행

```powershell
node experiences/brand-opening/qa/verify-tutor-hints.cjs
node experiences/brand-opening/qa/verify-tutor-hints-extra.cjs
node --test experiences/brand-opening/qa/tutor-support.test.mjs experiences/brand-opening/qa/tutor-practice.test.mjs experiences/brand-opening/qa/tutor-practice-audio.test.mjs experiences/brand-opening/qa/game-tutor.test.mjs experiences/brand-opening/qa/tutor-choice.test.mjs experiences/synk-world-app/qa/document.test.mjs experiences/korean-runner/core.test.mjs experiences/korean-runner/controls.test.mjs experiences/korean-runner/audio.test.mjs experiences/korean-runner/listening-check.test.mjs experiences/korean-runner/listening-feedback.test.mjs experiences/korean-runner/listening-recheck.test.mjs experiences/korean-rhythm/core.test.mjs experiences/korean-rhythm/audio.test.mjs experiences/hangul-stage/core.test.mjs experiences/hangul-stage/audio.test.mjs
```

4314는 rehearsal·합성 계정·로컬 PostgreSQL이다. 현재 서버와 자료를 보존하며 변경 전 사본은 `.tmp/tutor-hints-20261010/source-before/`에 있다.
