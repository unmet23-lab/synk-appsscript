# 마린·몽글 표정 전환 최종 검수

2026-10-11 22:16 KST. 정본 교정과 `prepare-tutors.cjs` 재생성 후, 로컬 `http://127.0.0.1:4314`의 실제 화면을 Edge에서 검수했다. [최종 결과](report.json)는 **575/575 통과**다. 페이지 오류·자산 누락·외부 요청·서버 쓰기 요청은 모두 **0**이다.

## 확인한 범위

- 마린 8개와 몽글 9개, 총 **17개 프로필 표정**을 같은 648px 선택 화면의 이미지 SRC에 직접 넣어 검사했다. `sprite-*` 파일은 이 **명시적 자산 검사**이며 자연스럽게 발생한 게임 반응을 뜻하지 않는다. 기본·졸림·윙크·으쓱을 포함한다.
- 실제 선택 화면의 자기소개·성공·실패·터치 놀람·반복 인사·자연 깜빡임·기본 복귀를 648px와 390px에서 확인했다. 320×568 세로와 844×390 가로에서도 성공·실패·놀람을 확인했다.
- 실제 생활 한국어와 카페 품절 주문에서 오답을 선택하고, 다른 상황 재연습의 오답·정답·복귀를 확인했다. 첫 오답 기록과 카페 진행 위치는 보존됐다.
- 실제 한글 게임의 조작 연습을 마친 뒤 선택 오답·정답 반응을 확인했다. 종료 시 튜터 자원 해제도 통과했다.

## 눈 합성과 몸 비교

**79개 반응 화면**에서 실제 합성 화면을 같은 크기의 마스크 없는 해당 WebP 렌더와 비교했다. 양쪽 눈의 타원 영역 RGB 차이는 모두 **0**, 고정된 몸 하단 RGB 차이도 **0**이다. 몸 이미지 주소와 portrait 내부 위치·크기도 검사했다. 의도된 CSS 동작을 마친 정지 프레임을 비교하며, 운동 중 프레임 전체의 밝기를 계측한 시험은 아니다.

마린 눈 영역은 정사각 sprite 기준 중심 x33.4%/66.6%, y47%, 반지름 x13%·y19%이고, 몽글은 x34%/66%, y35%, 반지름 x9%·y10%다. 비정사각 화면에서는 `object-fit:contain` 여백을 반영한다. SVG 마스크의 실제 URL과 `contain / center / no-repeat` 설정도 검사한다. 비교 순간에만 격리된 테스트 페이지의 마스크를 해제하고 복원했다.

눈 타원 밖 사각형 모서리의 주변 재질 차이는 별도로 기록했고 최대 18이다. 따라서 이 결과는 이미지 전체 RGB 일치를 의미하지 않는다. 새 눈 영역으로도 [수정 전 마린 렌즈 잘림을 최대 210으로 검출한 회귀 근거](../mask-only/eye-roi-regression.json)를 남겼다. 원본 PNG의 눈 밖 RGBA 보존 검사는 이 브라우저 시험과 별도다.

## 직접 본 대표 화면

- 마린 [집중](marin/sprite-집중-eyes-compare.png)·[졸림](marin/sprite-졸림-portrait.png): 원형 노란 렌즈를 유지하며 밝기로 구분한다. 새 졸림에 반눈 덮개나 흰 번쩍임이 없다.
- 마린 [놀람 비교](marin/648-touch-surprise-eyes-compare.png): 원본의 큰 렌즈가 위쪽이나 바깥쪽에서 잘리지 않는다.
- 마린 [생활 오답](marin/life-retry.png)·[카페 재연습 성공](marin/cafe-guided-success.png)·[게임 오답](marin/game-hangul-retry.png).
- 몽글 [민망](mongle/sprite-민망-portrait.png)·[놀람](mongle/sprite-놀람-portrait.png)·[졸림](mongle/sprite-졸림-portrait.png)·[윙크](mongle/sprite-윙크-portrait.png): 기존 구슬·자수 표정과 몸 외형을 유지한다.
- 몽글 [가로 화면 성공](mongle/844x390-success.png)·[생활 오답](mongle/life-retry.png)·[카페 재연습 성공](mongle/cafe-guided-success.png)·[게임 오답](mongle/game-hangul-retry.png).

## 실행 환경과 빌드

새 브라우저 컨텍스트의 **격리 게스트**로만 실행했다. 계정 진입·로그인·실계정 데이터 변경 없이 로컬 GET/HEAD만 허용했고, QA가 연 브라우저는 정상 종료했다. 공개 배포나 공개 사이트 검수는 하지 않았다. 실제 로드된 17개 이미지의 URL 버전·서버 바이트·디스크 SHA-256을 대조했다.

동결 빌드 위치는 `.tmp/world-app-mascot-expressions-20261011/world`이다. 해당 `manifest.json` 확인 결과 1,819개 파일, 185,842,584바이트, `missing/sourceChanges/privateArtifacts/publicToolNames` 모두 0, `oldPayloadUnchanged:true`다. 이 보고서의 브라우저 시험 대상은 위 로컬 소스 서버이며 동결 빌드의 별도 서비스 시험은 아니다.

재실행은 저장소 루트에서 `SYNK_TUTOR_QA_OUTPUT`을 이 `final` 폴더로 지정한 뒤 `node experiences/brand-opening/qa/mascot-expressions-20261011/verify-expressions.cjs`를 실행한다.
