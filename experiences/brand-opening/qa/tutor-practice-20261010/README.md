# 고른 AI 튜터의 시범과 조작 연습 · 2026-10-10

로컬 구현·검수. [현재 마루](http://127.0.0.1:4314/mobile.html?opening=off&companion=1&practice=1)의 놀이에서 게임을 고르면 처음에는 시범/따라 하기 연습을 연다. 기존 튜터 선택을 유지하며, 다시 고르려면 설정의 튜터 선택을 사용한다. 한 번 마친 연습은 조작법 → 직접 다시 연습하기에서 다시 할 수 있다.

## 실제 확인한 흐름

- 마린/까몽/몽글 × 바람길/말의 리듬/한글, 아홉 조합을 실제 화면의 키/터치로 마쳤다. 단계별 시범·오입력 재도전·성공 표정, 전부 완료 후 실제 게임 시작, iframe 입력 복귀, 기기 안 완료 저장을 확인했다.
- 바람길은 방향·점프·숙이기와 기존 부탁 MP3, 리듬은 O/X와 실제 선의 타이밍, 한글은 승인 Typecast 글자 MP3와 선택/다음이다. 녹음 파일의 실제 ended 이벤트 뒤에 답을 열며, 불러오기 실패에서는 재시도까지 답을 잠근다. 연습용 리듬 부탁은 본 채점 문항과 다르다.
- 중간 취소는 완료를 저장하지 않으며 재진입에서 첫 미완료 연습을 시작한다. 재연습 동안 실제 바람길 시계가 멈추고 마치면 같은 판을 이어간다. 후속 생명주기 검수는 한글의 실제 글자 MP3 위치/문항 유지, 서버 첫 문장, 비회원/계정 분리, 저장 불가 상황을 확인한다.
- 320×568, 390×844, 740×320, 844×390, 1440×900 화면의 가로 넘침과 보이는 44px 이상 단추를 확인했다. 움직임 감소/일반 움직임, 키보드 F/J·방향키·Space와 터치 입력을 사용했다.
- 기존 승인 캐릭터 컷·펠트 부품·녹음 파일만 사용했다. 새 이미지/음성 생성, 유료 AI 호출, 공개 배포는 없다.

## 결과

- [기본 조작 연습 브라우저](browser-result.json): 141개 통과, 오류/누락 자산/외부 요청 0. 실제 입력과 실제 녹음 재생을 쓰는 자동 검수다.
- [추가 생명주기 브라우저](lifecycle-result.json): 15개 통과, 오류 0. 한글 재생 중 조작법/재연습, 첫 문장과 서버 결과, 계정·저장 경계를 확인했다.
- [터치 스와이프](swipe-result.json): 6개 통과, 오류 0. 휴대폰 크기의 브라우저에 CDP 터치 이벤트를 보내 왼쪽·오른쪽·점프·숙이기와 취소를 확인했다. 실물 기기 검수와 구분한다.
- [관련 Node 시험](unit.tap): 102개 통과, 실패 0. 단계/완료 저장/박자 경계/음성 중단·이어 하기와 기존 선택/문서/게임 판정/녹음 시험을 포함한다.
- [첫 만남 선택 회귀](choice-regression/browser-result.json): 기존 62개 통과. 튜터 선택·취소·저장·실제 크기·독립 마루의 게임 연결을 다시 확인했다.

개발 중의 `browser-failure.json`/`lifecycle-failure.json`은 이전 실행 기록이며 위 최종 result가 완료 근거다. 리듬의 별도 `app-learning.test.mjs`는 기존 VM 시험판이 현재 앱의 top-level await를 읽지 못해 6개가 SyntaxError로 끝났다. 작업 전 사본에도 같은 await가 있으며 위 102개 집계에는 포함하지 않았다. 그 시험판의 전환은 이번 조작 연습 범위에서 하지 않았다.

실물 휴대폰의 소리·터치·회전·지속 성능, 학생 학습효과, 운영 계정 선택 동기화, 공개 배포는 별도다. 연습 성공은 언어 평가·TOPIK 급수·코인 보상으로 쓰지 않는다.

## 화면

[마린 시범](marin-runner-demo.png) · [마린 성공](marin-runner-success.png) · [출발 준비](marin-runner-ready.png) · [까몽 성공](kkamong-runner-success.png) · [몽글 재도전](mongle-hangul-retry.png) · [가로 화면](practice-740x320.png) · [작은 세로 화면](practice-320x568.png).

## 재현

```powershell
node experiences/brand-opening/qa/verify-tutor-practice.cjs
node experiences/brand-opening/qa/verify-practice-lifecycle.cjs
$env:SYNK_PRACTICE_QA_SWIPES_ONLY='1'
node experiences/brand-opening/qa/verify-practice-lifecycle.cjs
Remove-Item Env:SYNK_PRACTICE_QA_SWIPES_ONLY
$env:SYNK_TUTOR_QA_URL='http://127.0.0.1:4314'
$env:SYNK_TUTOR_QA_OUTPUT='experiences/brand-opening/qa/tutor-practice-20261010/choice-regression'
node experiences/brand-opening/qa/verify-tutors.cjs
node --test experiences/brand-opening/qa/tutor-practice.test.mjs experiences/brand-opening/qa/tutor-practice-audio.test.mjs experiences/brand-opening/qa/game-tutor.test.mjs experiences/brand-opening/qa/tutor-choice.test.mjs experiences/synk-world-app/qa/document.test.mjs experiences/korean-runner/core.test.mjs experiences/korean-runner/controls.test.mjs experiences/korean-runner/audio.test.mjs experiences/korean-runner/listening-check.test.mjs experiences/korean-rhythm/core.test.mjs experiences/korean-rhythm/audio.test.mjs experiences/hangul-stage/core.test.mjs experiences/hangul-stage/audio.test.mjs
```

4314 서버는 rehearsal·고정 합성 계정·로컬 PostgreSQL이고 실제 운영 로그인이 아니다. 게임 판정 시험의 입력/빨리 감기는 기능을 확인하는 합성 실행이며 실제 학생 효과나 사람의 청취 검수로 표시하지 않는다.
