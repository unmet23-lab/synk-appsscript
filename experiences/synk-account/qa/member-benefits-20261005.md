# 회원 혜택 플랫폼 반영 · 2026-10-05

이 문서는 첫 소개 화면 검증 이력이다. 같은 날 이어 진행한 두 앱의 실제 초기 기능과 현재 검증은 [후속 MVP 결과](member-mvp-20261005/RESULTS.md)를 따른다.

## 구현

설치형 플랫폼과 웹 개발 화면에 회원 혜택 메뉴, SYNK FOR YOU 소개, 세 서비스 카드와 상세, 검색 진입을 연결했다. 공통 카탈로그는 `desktop/renderer/benefits.mjs`이며 웹과 설치형이 같은 이름·상태·소개를 쓴다. 플레저는 개발 미리보기, 중요한 대화 리허설과 가족 이야기 앨범은 준비 중이다.

회원 소개는 공개 탐색이며 앱 권한 부여가 아니다. 설치형 플레저 실행은 기존 계정의 `care` 권한과 개발 미리보기 capability를 확인한다. 웹의 플레저 링크는 HTTP loopback에서만 표시한다. 운영 사용자의 파일·계정·권한을 수정하지 않았고 유료 모델 호출·외부 발송·공개 배포도 하지 않았다.

## 자동 확인

- `npm --prefix experiences/synk-account test`: 95/95.
- `node --test experiences/learning-hub/server.test.mjs tests/learning-hub-server.test.js`: 6/6.
- 설치형 전체 시험: 159/159. 회원 혜택 진입·준비 서비스·기존 권한 회귀 포함.
- `node tools/build-synk-account.js` 및 `--check`: 원문과 생성물 일치.
- `desktop/tools/benefits-native-smoke.cjs`: 숨김 Electron의 1280/390/320px, 목록·상세·뒤로 가기·권한 철회·미리보기 bridge 확인 19/19. 합성 계정과 대체 bridge를 썼으므로 운영 로그인이나 실제 플레저 클라이언트 실행의 증거는 아니다.

설치형 결과: [검증 JSON](../../../desktop/artifacts/benefits-native-20261005.json), [PC 화면](../../../desktop/artifacts/platform-benefits-1280.png), [390px](../../../desktop/artifacts/platform-benefits-390.png), [320px](../../../desktop/artifacts/platform-benefits-320.png). 이미지 오류·가로 넘침·콘솔 오류·외부 요청은 0개다. 이 산출물은 로컬 검증 파일이며 Git에 포함되지 않을 수 있다.

## 웹 실제 화면 확인

실행은 `node experiences/learning-hub/server.mjs`, 주소는 `http://127.0.0.1:4280/synk-account/platform.html#benefits`다. Codex 내장 브라우저에서 PC 화면과 390/320px 화면을 확인했다. 승인 자산·서체 로드, 카드 가독성, 메뉴 줄바꿈, 가족 앨범 상세, 검색어 ‘가족’으로 한 서비스만 표시되는 동작을 확인했다. 390/320px에서 가로 넘침이 없으며 준비 서비스에 파일 업로드·녹음·실행 컨트롤은 없다.

최종 빌드에서 검색 결과 제목·정정한 이미지 설명, 리허설→플레저 상세 이동을 재확인했다. 플레저 개발 미리보기 링크가 새 탭으로 `http://127.0.0.1:4296/`의 ‘SYNK 플레저 · 잊지 않고, 내 말투로’를 열었다. 개인 자료를 입력하지 않았으며 검증용 팝업은 닫았다. 반응형 viewport 설정을 해제하고 회원 혜택 화면을 최종 미리보기로 남겼다.

## 남은 범위

리허설의 실제 연습·되묻기·재연습과 가족 앨범의 사진·이야기·원음·가족 참여 기능은 후속 개발이다. 계정별 저장·동기화·예약 알림·운영 회원 혜택 제공, 실제 기기 설치·공개 배포를 이번 검증 결과로 간주하지 않는다.
