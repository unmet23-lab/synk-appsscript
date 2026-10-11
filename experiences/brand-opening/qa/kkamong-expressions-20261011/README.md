# 까몽 민망·놀람 표정 최종 화면 검수

2026-10-11. `http://127.0.0.1:4314/mobile.html?opening=off&tutor=choose`의 로컬 소스를 Edge에서 검수했다. [검수 결과](report.json)는 **158/158 통과**이며 페이지 오류·자산 누락·외부 요청·서버 쓰기 요청은 모두 0이다.

- 선택 화면 390px·648px: 자기소개, 성공, 실패, 인사 직후 240ms 놀람, 반복 인사의 민망, 기본 표정 복귀.
- 생활 한국어: 실제 첫 오답, 다른 상황에서 재연습 오답·정답, 본 학습 정답.
- 카페: 실제 품절 주문 오답, 재연습 오답·정답, 주문 수정. 원래 첫 오답과 카페 진행 위치 보존.
- 한글 게임: 조작 연습을 거쳐 실제 선택 오답·정답 반응. 선택한 까몽과 몸 이미지 유지.

민망 `758b2b522cea`, 놀람 `29ab707f8df1`, 성공 스티치 `e1f338ab9589`가 실제 이미지 URL·서버 바이트·생성 파일 해시와 일치한다. 까몽 얼굴 마스크를 `ellipse 25% 12% at 40.5% 31%`로 바로잡은 후 최종 캡처했다.

22개 반응 화면에서 양쪽 눈을 **같은 크기의 마스크 없는 원본 렌더**와 픽셀 비교했다. 양쪽 눈의 최대 RGB 차이는 모두 **0**이다. QA는 스크린샷 비교 순간에만 테스트 페이지의 마스크를 해제하고 즉시 복원한다. 제품 코드는 바꾸지 않는다.

직접 확인한 대표 화면:

- [민망 표정](648-retry-portrait.png) · [눈 원본 비교](648-retry-eyes-compare.png): 두 눈 모두 U자 자수이며 기존 눈동자나 흰 반사가 비치지 않는다.
- [놀람 눈 비교](648-touch-surprise-eyes-compare.png): 둥근 검은 눈과 녹색 테두리가 유지된다.
- [성공 스티치 비교](390-success-eyes-compare.png): 양쪽 ∩자 눈웃음이 깨끗하게 표시된다.
- [생활 오답](life-retry.png) · [카페 오답](cafe-retry.png) · [카페 연습 성공](cafe-guided-success.png) · [게임 오답](game-hangul-retry.png) · [게임 눈 비교](game-hangul-retry-eyes-compare.png).

매 흐름은 새 브라우저 컨텍스트의 격리된 게스트로 실행했다. 계정 진입·로그인·실계정 데이터 변경 없이 GET/HEAD만 허용했고, QA가 연 브라우저를 종료했다. 공개 배포나 공개 사이트 검수는 하지 않았다.

최종 빌드: `.tmp/world-app-kkamong-expressions-20261011-r2/world`. 해당 `manifest.json` 기준 1,817개 파일, 185,833,469바이트이며 `missing`, `sourceChanges`, `privateArtifacts`, `publicToolNames`는 모두 0, `oldPayloadUnchanged`는 true다. 이 폴더의 브라우저 검수 대상은 위 로컬 소스 서버다.

재실행: 저장소 루트에서 `node experiences/brand-opening/qa/kkamong-expressions-20261011/verify-expressions.cjs`.
