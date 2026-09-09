# PULSE — 2026-09-10 장면 개선

사용자의 09-10 피드백(현실감·펠트 디테일·WASD·몽환적인 분위기 부족)을 받은 뒤, 현행 통합본 `a1d64fb04f8766dbef1cd3607c99577062f30f18`에서 새 sparse worktree로 구현했다. 이전 프로토타입의 미술 완성 승인을 가정하지 않았다.

## 사용한 현재 원본

- 정본 저장소: `C:/Users/q1212/Documents/SYNK-appsscript`.
- `AGENTS.md`, `docs/AI_운영원칙.md`의 자율 실행·실물 확인·09-10 피드백 반영, `DESIGN.md`, `docs/명품_기준_v1.md`의 인터페이스/완성도 관련 절.
- `synk-design/SKILL.md`, `forge/SKILL.md`, `emil-design-eng/SKILL.md`.
- 위 HEAD의 `pulse/scene.js`와 기존 실제 `pulse/qa/scene-street.png`. 원본과 새로운 작업 사본의 텍스트 일치를 확인한 뒤 시작했다.
- root가 생성하고 직접 검수한 `assets/felt-fibers-v2.png`. 원본 복사만 했으며 이미지 픽셀 편집·축소 없이 표면색과 높이 변화에 사용한다. SHA-256 `863962cb3b70b2724b3f50cc1d5be7f8cda171ca77d0654990c8329ef6f87da9`. 이 이미지의 커밋은 root 소유다.
- Three.js r180 SSAOPass의 버전 고정 공식 원문과 MIT 라이선스. 정확 URL·변경 범위는 [ssao/SOURCES.md](ssao/SOURCES.md), 전문은 [ssao/LICENSE.txt](ssao/LICENSE.txt).

## A안과 구현

포지 A안은 '불빛이 안내하는 짧은 해안 산책'이다. 기본 시점을 걸을 수 있는 높이로 내리고, 가까운 물건 E 조사와 장소 버튼을 같은 조사 흐름으로 연결한다. B안의 전차 회로 복원/방송 주파수 조율은 root와 앱 담당이 구현하며, 장면은 공개 복원 상태를 받아 실제 작은 장치에 반영한다.

장면에는 새 섬유 표면색·범프(조명에 반응하는 미세 높낮이), 표면에 눕는 짧은 곡선 보풀, 굴곡 있는 봉제선, 천 커튼·창틀·유리, 전차의 열린 실내와 좌석, 해안 안개층과 구름·달·별, 작은 회로함·라디오·작업등·생활 소품을 추가했다. 보이지 않던 접촉 그림자를 바닥 위로 옮기고 화면 공간의 접촉 음영을 더했다. 화면 전체의 블룸은 섬유 대비 저하와 첫 시점의 검은 사각형 결함을 확인해 제거했으며, 광원 가까이의 작은 번짐과 실제 조명은 유지한다.

## 장면 API

기존 `focus`, `setQuality`, `setReducedMotion`, `setPhase`, `setRole`, `setEnding`, `getMetrics`, `dispose`를 유지한다.

- `setCameraMode('walk'|'orbit'|'overview')`, `setWalkMode(boolean)`.
- `getNavigationState()`는 모드·위치·구역·이동·근접 대상·충돌 횟수를 반환한다.
- `updateRestoration({power:{solved,rotations:[0..3,0..3,0..3]},radio:{solved,frequency:90..104}})`는 표시 바늘/주파수 눈금과 작은 작업등·수신기 표시등을 갱신한다. 도시 전체가 켜지지 않는다. 비공개 정답·개인 단서는 장면에 없다.
- `onStatus({zone,moving,nearest,step?,cameraMode})`: 구역/이동/근접 상태 변화 또는 발걸음 간격에만 전달한다. 구역은 `harbor/tram/radio/postbox/square`. 소리는 앱/오디오 담당이 이 이벤트를 소비한다.

WASD는 프레임 수가 아닌 지난 시간에 비례해 걷는다. 물가·건물 경계와 주요 사물에 충돌하고, 작은 이동 단계로 나눠 빠른 입력의 통과를 막는다. 마우스 드래그는 시선, 방향키는 키보드 시선 대체, E는 가까운 물건 조사, Home은 시작 위치다. 텍스트 입력·슬라이더·contenteditable·수정키 조합을 가로채지 않으며, 입력창 포커스/창 blur/숨김에서 눌린 키를 해제한다. 흔들리는 보행 카메라는 강제하지 않는다. 모바일은 장소 버튼과 드래그를 사용한다.

## 검증과 실물

- `qa/verify-world.cjs`: WASD 4방향, 실제 충돌, 입력창/blur, 드래그와 오조사 방지, 네 장소의 안전한 조사 위치, E, 전체 보기 복귀, 초기 숨은 버튼, 복원·리셋·상태 이벤트 등 **17개 통과**. `qa/verification-v2.json`.
- 1440×900/DPR1, 설치된 Windows Chrome의 headless WebGL2 장면에서 각 5초 측정: high **59.96fps**, low **59.64fps**. 전체 앱·AI가 함께 실행될 때의 성능이나 다른 하드웨어의 보장은 아니다. Low에서 반사·보풀·접촉 음영이 실제 꺼지는 것도 확인했다.
- `qa/verify-adaptation.cjs`: 인위적인 75ms 프레임 지연에서 auto가 가벼운 효과로 전환됐다. 이 결과는 정책 검사이며 실제 기기 FPS가 아니다. `qa/adaptation-v2.json`.
- `qa/verify-camera-input.cjs`: plaintext 편집창 입력 예외, 휠 시야각 한계·전체 보기, 390×844 리사이즈 통과. `qa/camera-input-v2.json`. 모바일 화면 크기를 데스크톱 브라우저로 확인한 것이며 실제 휴대전화 GPU 시험은 아니다.
- root 4399의 실제 앱/서버/스타일에 새 소유 scene 모듈만 시험 라우팅하여 진입→탐색 화면 확인, 실행 오류 0. `qa/app-overlay-v2.json`. `app-tram-overlay-v2.png`는 당시 CSS, `app-tram-overlay-comparison-v2.png`는 시험 페이지에서만 덧씌움을 약하게 한 비교다. 제품 CSS는 이 작업에서 편집하지 않았으며 root가 별도로 탐색 vignette .3, film-grain .015를 반영했다.
- 실제 장면: `qa/world-street-v2.png`, `world-tram-v2.png`, `world-radio-v2.png`, `world-restored-v2.png`, `world-overview-v2.png`, `world-mobile-v2.png`. 생성 이미지 한 장을 3D라고 표시한 자료가 아니다.

로컬 실행: 이 worktree에서 `node experiences/20260909/pulse/scene-assets/qa/server.cjs` → `http://127.0.0.1:4439/pulse/scene-assets/qa/world.html`. 테스트 스크립트의 Playwright 경로는 이 기계의 설치 경로다. root 4399 서버는 종료·교체하지 않았다.

## 남은 실제 한계

탐색 가능한 해안 광장을 만든 미니어처 프로토타입이다. 충돌은 주요 사물의 근사 상자이며 계단·점프·실내 자유 이동은 없다. 하늘은 절차적 3D 돔, 낮은 안개는 공간에 배치한 반투명 층으로, 광선을 계산하는 완전한 체적 안개가 아니다. 원경 건물은 반복되는 조형이며 모든 도시를 돌아다닐 수 없다. Three.js/WebGL2를 사용하며 Unreal Engine이나 AAA 수준이라고 주장하지 않는다. 정서적 몰입·머무르고 싶은 정도·놀이의 재미·실제 배포 적합성은 이번 자동 검사로 증명되지 않았다. 이야기·오디오·실제 AI 대화와 전체 통합 검증은 root 담당 결과와 구분한다.
