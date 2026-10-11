# Windows 중심 성능 개선 · 2026-10-12

사용자 요청 순서에 따라 WORLD·게임, Platform 실행·전환, 회사 홈페이지를 점검했다. 계정·로그인·학습 저장 방식은 이번 성능 수정의 대상이 아니다.

## WORLD·게임

- 바람길은 최대 DPR 1.5·약 160만 렌더 픽셀을 기준으로 시작하고, 지속적인 프레임 저하에 따라 품질을 조절한다. 입력·음성·게임 시계는 유지한다. 그림자는 1024, 동일 크기 재설정과 HUD 중복 쓰기는 건너뛴다.
- 공개 Windows 브라우저 1280×720·DPR 2에서 실제 게임은 1920×823으로 렌더했다. 이전 2560×1097보다 픽셀이 약 44% 적다. 일시정지 2초 동안 렌더 프레임 454와 게임 시간이 그대로이고 오디오는 suspended였다(`runner-live.json`). 자동 연주나 점수 변경 없이 공개 첫 문항과 조작을 확인했다.
- 로컬 공개 후보에서 QA 자동 입력으로 90초 주행을 끝내고 11/11 문항 완료·음성 16개·도착 화면까지 확인했다(`runner-complete.json`, `runner-complete.png`). FPS 전후 측정에는 창 높이·동시 GPU 부하 차이가 있어 정확한 FPS 개선율을 주장하지 않는다.
- 옷장 모듈은 열 때 불러온다. 첫 화면에서 상품 14개를 3D로 조립·캡처하던 작업은 정적 256px 미리보기로 바꾸고, 사용자 후보는 보이는 것만 유휴 시간에 순차 생성한다. 닫기·화면 이탈·입력 때 작업을 취소하거나 미룬다.
- 로컬 실제 옷장은 처음 조립된 상품 0·동적 썸네일 캡처 0, 상품 선택 뒤 해당 상품만 조립, 보이는 후보만 캡처, 닫은 뒤 canvas 0·대기 작업 0을 확인했다. 첫 WebGL 셰이더 준비 비용은 여전히 남는다. 구도 변경 중 유휴 캡처가 오래된 캐시 키에 저장되던 회귀도 수정했다(수정 전 6개 실패 → 수정 후 source/public 각각 8/8).
- 홈의 버튼·표면 자산 네 개는 원본을 보존한 WebP 파생본으로 1,388,864 → 191,972 bytes(86.2% 감소). 실제 화면·이미지 로딩·가로 넘침을 확인했다.
- 관련 runner 23개, 옷장·계정 경계 29개 회귀검사 통과. 세부 근거는 `wardrobe/verification.json`, `wardrobe/unit.tap`과 각 JSON·PNG다.

공개 커밋 `e54e7890f5dd7ae16c95f7b1cb5a378ee71cea0f`, [Pages](https://github.com/unmet23-lab/synk-policy/actions/runs/38165949789)·[공개 사이트 점검](https://github.com/unmet23-lab/synk-policy/actions/runs/38165950218) 성공. 변경 38파일을 익명 HTTPS로 받아 Git blob SHA-256과 대조했다(`public-live.json`). 공개 홈에서 옷장 모듈이 미리 요청되지 않고 새 WebP가 로드되는 것을 확인했다. 공개 옷장은 로그인 안내까지만 확인했고 실제 계정으로 들어가지 않았다. 옷장 기능 검증은 격리된 로컬 공개 후보에서 수행했다.

## Platform 0.4.3

실행 파일·ASAR 약 539 MB를 한 번에 읽던 무결성 검사를 64 KiB 스트림으로 바꿨다. 매 검사·실행 시 실제 파일을 새로 SHA-256 검사한다. 같은 길이·수정시각의 변조도 계속 거부한다.

같은 Windows PC의 3회 교대 측정에서 최대 이벤트 루프 지연 63.4–71.1 → 14.9–21.9 ms, 임시 메모리 증가 480–499 → 33–41 MiB였다. 전체 검사 시간은 256–316 → 301–319 ms로 줄지 않았다. 개선은 메모리 급증과 UI 정지 완화이며 전체 앱 실행 시간 단축이라는 뜻은 아니다.

공개 Windows·Apple Silicon·Intel 후보는 각각 네이티브 16/16, 관련 회귀검사 15/15를 통과했다. 실제 DMG 마운트·아키텍처·파일 해시와 GitHub 아티팩트 전체 SHA를 대조했다. [후보·검증 세부](desktop/README.md), [공개 대상 3개](desktop/release-candidates.json).

[공개 릴리스](https://github.com/unmet23-lab/synk-policy/releases/tag/platform-preview-0.4.3-20261012)에 검증된 세 설치파일과 체크섬·manifest를 게시했다. 게시 후 인증 없는 공개 URL에서 전체 1,329,908,796 bytes를 다시 받아 세 파일 모두 길이·SHA-256이 검증 후보와 일치했다(`desktop/public-download-verification.json`). 기존 0.4.1 릴리스와 WORLD·Workspace 설치파일은 유지했다. 공개 빌드 원천은 `1bb9b82`에서 통합됐다.

현재 PC에는 기존 WORLD 0.4.2·Workspace 0.4.0 구성을 보존하는 전용 Platform 0.4.3 설치파일로 업데이트했다. 실제 EXE·ASAR는 검증 후보와 일치하며 기존 프로필 187개 파일과 포함된 자식 설치파일은 byte 동일하다. 기존 EXE·ASAR·설치 메타데이터는 `.tmp/platform-performance-20261012/local-platform/installed-before-update`에 백업했다. 실제 계정으로 앱을 재실행하거나 로그인 상태를 변경하지 않았다(`desktop/private-pc/installed-verification.json`).

Mac은 macOS 13 이상, Intel은 x64·M 시리즈는 arm64다. Intel CI는 소프트웨어 GPU이며 실물 Intel MacBook GPU 성능·Gatekeeper 승인은 미검증이다. Preview의 정식 게시자 서명·Apple 공증 상태는 바뀌지 않았다.

## 홈페이지

화면 맨 아래 대화 구의 첫 ResizeObserver 통지가 가시성과 상관없이 픽셀 계산을 시작하던 문제를 고쳤다. 화면 근처에서만 준비하고, 화면 밖·숨은 탭에서는 중단한다. 픽셀 배열·ImageData·색 판독 결과를 재사용한다.

실제 Windows 브라우저 동일 1280×720·DPR 2에서 기존 공개판은 첫 화면에서 640×640 구를 이미 그렸지만 후보는 화면 밖 구를 그리지 않았다. 문의 구역 진입 시 1회 준비·그리기, hover 때 같은 ImageData 재사용, 다른 구역으로 스크롤 후 그리기 중단, 질문창의 0.4.3 안내를 확인했다. 콘솔 오류와 가로 넘침은 0이었다. DPR 1/1.5/2/3의 12개 픽셀 결과가 기존과 동일하고 관련 38/38 시험이 통과했다. 이는 반복 작업 제거의 검증이며 모든 PC의 체감 속도 보장은 아니다.

홈페이지 원천·검증은 `C:/Users/q1212/Documents/SYNK-website/site-v10/site.js`, `qa/homepage-performance-20261012/`, `qa/RESULTS.md`에 있다. 다운로드·질문 안내는 Platform 0.4.3으로 갱신하고 WORLD·Workspace 기존 설치파일은 유지한다.

홈페이지 원천 `7a125e2`, 공개 `4210347c185e038eefe68e444bba720b821ab5e2`, [Pages 배포](https://github.com/unmet23-lab/synk-policy/actions/runs/38166987394) 성공. 변경 18파일의 공개 SHA-256 일치(`homepage-live.json`), 실제 공개 화면의 Windows·Apple Silicon·Intel 링크, 새 스크립트 캐시 키, 화면 밖 구의 초기 미렌더, 콘솔 오류·가로 넘침 0을 확인했다(`homepage-live-browser.json`, `homepage-live.png`). [공개 사이트 자동 점검 38166987784](https://github.com/unmet23-lab/synk-policy/actions/runs/38166987784)도 8분 50초에 성공했다.

## 원천 보존

앱 원천 성능 변경 18파일은 `e9c76003b`에 선별 커밋했다. 원천 옷장의 v8 미술 선행 변경은 다른 작업의 미커밋 상태여서 그 변경을 섞어 커밋하지 않았다. 현재 원천 작업본에는 옷장 성능 수정·회귀검사·정적 자산이 있고 공개 저장소에는 현행 미술과 함께 완결된 개선판이 배포됐다. 재현용 성능-only 패치는 `wardrobe/performance-only.patch`와 `.tmp/wardrobe-thumbnail-key-regression/`, 선별 index 계획은 `.tmp/world-performance-20261012/source-stage/`에 보존했다.
