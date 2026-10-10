# 말의 리듬 · 플레이 중 세로/가로 전환 검수

2026-10-10 · 로컬 `http://127.0.0.1:4307/brand-opening/home.html`의 실제 게임 iframe.

## 결과

- **전체 곡 검수 255/255 통과**: `rhythm-result.json`.
- **최종 44px 보완 후 가로 최초 시작·첫 문항 재검수 76/76 통과**: `rhythm-probe.json` (`landscapeFirst: true`).
- Edge의 새 격리 게스트 context, 화면 320×740 ↔ 740×320. 외부 요청과 GET/HEAD 이외 요청을 차단했으며 두 최종 실행 모두 해당 요청 시도 0건, 콘솔 오류 0건, 정적 자산 HTTP 오류 0건.
- 기존 MP3를 실제로 decode/playback했다. 새 음성/영상/AI 생성, 실계정 로그인·저장, 공개 배포 없음.

## 재현된 결함과 수정

초기 가로 화면에서는 홈 iframe 헤더·계정 안내·게임 바 아래 무대 높이가 127px만 남았다. 문항 카드가 O/X 버튼 중앙을 덮어 실제 포인터 답 입력이 실패했고, 글로 보기 문장 하단도 잘렸다. 수정 전 화면과 실패 결과는 `rhythm-before/`에 보존했다.

`experiences/korean-rhythm/style.css`에서 짧은 가로 화면을 **왼쪽 문항 / 오른쪽 무대와 O/X**로 배치했다. 계정 상태는 한 줄로 줄이되 원문과 계정 링크를 유지한다. 일시정지 창은 두 열로 배치하고 스크롤 가능한 최대 높이를 둔다. 멈춤·글로 보기·설정 칩·박자 보정·처음으로 버튼의 실제 영역은 44px 이상이다.

`experiences/korean-rhythm/stage.mjs`에서 캔버스가 오른쪽으로 이동한 위치를 몽글 좌표에 반영하고, 낮은 무대에서는 지평선·판정선·노트 크기를 조정해 노트가 내려오는 공간을 남겼다. 입력·채점·음원 예약·보상 로직은 변경하지 않았다. 기존 `app.mjs`의 계정 준비 변경과 `collection.js` 등 다른 dirty 파일은 보존했다.

## 실제 플레이 확인

- 첫 곡 **초록 202.68초**를 건너뛰거나 가속하지 않고 자연 종료까지 재생했다. 첫 시작 캡처 04:17:45, 결과 캡처 04:21:14(KST); 일시정지 시간이 포함된다.
- 일반 박자 노트만 기존 `?qa`의 실제 입력 함수 자동 연주를 사용했다. 듣기 문항 다섯 개는 자동 답 계획을 비운 뒤 **실제 O/X 버튼 포인터 입력**으로 답했다. 문항의 정답을 알고 입력한 기능 시험이며 학습 효과 검증은 아니다.
- 나레이션 다섯 개 모두 `delivered: completed`, 정답 **5/5**. 두 번째 문항의 글로 보기는 `texted: true`, 독립 응답은 false로 유지됐다.
- 듣는 중 입력은 답으로 저장되지 않았다. 문항·글로 보기·답하기·정답 표시·일반 노트 구간에서 회전했다.
- iframe 문서의 `performance.timeOrigin`, 캔버스 노드, AudioContext 객체가 유지됐다. 각 방향에서 캔버스의 실제 해상도가 CSS 크기와 DPR을 따라갔다.
- 일시정지하고 가로·세로로 바꿔도 음악 시간과 점수가 그대로였다. 나레이션 중 멈춤의 음악 시간은 전후 **10.0717062초**로 같았고, 이어 하기 후 같은 시계가 진행됐다.
- 전체 곡의 최종 박자 점수 **256600**, 결과 후 네 차례 회전에서도 동일했다. 코인 **25**, `rewardedRounds`에 `rhythm:` 라운드 **1개**, 게임 통계 완주 **1회**. 회전으로 중복 지급되지 않았다.
- 결과에서 실제 처음으로 버튼 → 게임 입구 → WORLD 닫기 → 배경 영상 재생 복귀를 확인했다. 별도 새 context에서 가로 최초 시작·세로 전환·가로 복귀·일시정지 회전도 확인했다.
- 마지막 44px 보완은 화면 크기만 바꾼 최소 CSS 수정이다. 전체 곡 검수 이후 최종 짧은 가로 최초 시작/글로 보기/답 입력/일시정지 회전으로 다시 확인했다.

## 근거 화면

- 최종 가로 글로 보기: `rhythm-probe-q1-text-landscape.jpg`
- 최종 가로 정답·O/X: `rhythm-probe-q1-answer-landscape.jpg`
- 최종 가로 일시정지: `rhythm-probe-narration-pause-landscape.jpg`
- 세로 문항·답 유지: `rhythm-q2-answer-portrait.jpg`
- 한 곡 5/5 결과·25코인: `rhythm-result-rotation-2.jpg`
- WORLD 복귀: `rhythm-back-to-world.jpg`

## 실행과 검사 범위

```powershell
node experiences/brand-opening/qa/verify-rhythm-rotation.cjs
node experiences/brand-opening/qa/verify-rhythm-rotation.cjs --probe --landscape-first
```

core/audio/flow 시험 **24개 통과**, assignment-target/grammar-links/personalization 시험 **10개 통과**. `node --check`로 app·stage·신규 QA 스크립트 구문 통과.

별도 기존 `app-learning.test.mjs`의 6개 시험은 사전 dirty인 `app.mjs:12`의 top-level `await globalThis.SynkPlayAccount.ready()`를 `vm.runInNewContext`로 실행해 `SyntaxError: await is only valid in async functions and the top level bodies of modules`로 실패했다. 이번 CSS/Stage 수정과 무관하며 해당 테스트나 계정 구현은 변경하지 않았다.

실물 휴대폰의 OS 회전 잠금, 실제 터치 지연·다중 터치·발열, 스피커 출력의 직접 청취는 검수하지 않았다. 이번 증거는 브라우저 화면 크기 전환과 Web Audio 재생 상태·나레이션 완료·입력·저장의 검증이다.
