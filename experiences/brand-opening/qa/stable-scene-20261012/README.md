# 마루·시작 화면의 일렁임 수정 · 2026-10-12

사용자가 회사 로고 뒤의 풍경, 특히 몽글·까몽·마린이 지진처럼 일렁인다고 지적했다.

## 원인과 수정 범위

`opening.mjs`와 `home.mjs`는 같은 v9 MP4를 반복한다. 지속적인 CSS 위치 변형은 없지만 `processors/lock-opening-background.py`가 세 친구 전체를 움직임 영역에 남겼다. 기존 v9의 고정 구조물 15지점 통과는 마스코트의 털결·윤곽·몸 변형 검증이 아니었다. 원본 SHA는 기존 v9 증거와 일치한다.

v10은 같은 소스 첫 프레임으로 세 친구·고정 풍경을 유지하고, 안전한 수역의 물결·배만 남기는 로컬 합성이다. **캐릭터 동작을 정지한 안정화**이며, 새 리깅·눈 깜빡임·손짓 구현으로 보고하지 않는다. 기존 v9 원본과 포스터는 보존한다. 추가 AI 생성·과금·공개 배포·설치본 교체는 없다.

## 결과 위치와 재생

- `../../assets/world-menu-mobile-stable-v10-web.mp4`
- `../../assets/world-menu-desktop-stable-v10-web.mp4`
- 로컬 시작 화면: <http://127.0.0.1:4322/brand-opening/index.html>
- 로컬 홈: <http://127.0.0.1:4322/brand-opening/home.html>
- 통합 앱: <http://127.0.0.1:4322/mobile.html?opening=replay>

로컬 미리보기는 독립 DB `experiences/synk-world-app/.local/stable-scene-20261012`를 사용한다. 실제 계정 로그인·동의·학습 기록은 건드리지 않는다.

## 검증 기록

세로·가로 각 240프레임(10초·24fps)을 검증했다. 세 얼굴과 넓은 고정 전경의 합성 전 픽셀 변화는 전 프레임 0이며, 최종 MP4에는 미세한 코덱 값 차이만 남는다. 강 영역은 계속 움직인다. [세로 측정](mobile-metrics.json), [가로 측정](desktop-metrics.json). 물결의 첫/끝 픽셀까지 동일한 루프는 아니다.

Codex 내장 브라우저의 390×844·1440×900에서 [9개 관찰 검증](browser-result.json)을 통과했다. 두 방향 자연 재생을 각각 11.5초 관찰해 한 바퀴 이상의 진행과 반복 경계를 확인했고, 모든 표본에서 화면 사각형은 고정됐다. 시작→튜터 선택→홈 복귀, 독립/통합 홈 소스, 홈과 OS 움직임 감소도 확인했다. 수집한 콘솔 경고·오류는 0개다. 물리 기기 검증과는 구분한다.

최종 파일은 세로 842,011바이트, 가로 922,325바이트다. [로컬 HTTP 200·전체 바이트 SHA 일치](local-served-assets.json)를 확인했다. 방향별 21개 시점의 강/배·캐릭터 표본을 직접 확인했으며, 가로 7.125~7.583초에 마스크에서 잘리던 낙엽은 좁은 오른쪽 수역에서만 원본 첫 프레임으로 치환했다. [세로 강 표본](mobile-river-contact.jpg), [가로 강 표본](desktop-river-contact.jpg).

- 코드 구문: `node --check experiences/brand-opening/opening.mjs`, `node --check experiences/brand-opening/home.mjs` 통과.
- 패키징 코드: `tools/build-world-app-public.mjs`가 `opening.mjs`의 두 MP4 문자열을 수집한다. 통합 앱은 같은 `home.mjs`를 사용한다. 전체 공개 빌드·배포는 미실행.
- 원본 화면 참고: `before-landscape.png`. 정지 캡처만으로 흔들림 제거를 증명하지 않는다.
- 수정 화면: [시작 가로](after-landscape.png), [시작 세로](after-portrait.png), [통합 홈 가로](after-home-landscape.png), [통합 홈 세로](after-home-portrait.png).
- 재현: `python experiences/brand-opening/processors/stabilize-maru-scene.py --variant both` (`cv2`·`numpy`·FFmpeg가 있는 Python 환경). 출처·원본 해시·마스크·최종 디코드 수치도 함께 생성한다.

## 남은 범위

개별 캐릭터의 자연스러운 동작·장면 직접 터치·착용 의상의 큰 캐릭터 반영은 [홈의 추가 제안](../../HOME.md)이며 이번 안정화에 구현되지 않았다. 물리 휴대폰, 설치 앱, 공개 서비스의 변경 후 재생은 별도 확인 대상이다.
