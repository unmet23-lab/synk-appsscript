# 마루 실제 앱 연결 검수 · 2026-10-10

`../maru-integration.cjs`를 로컬 rehearsal 서버 `http://127.0.0.1:4310`과 분리 DB `.local/maru-integration-20261010`에서 실행했다. 격리된 Edge 브라우저의 합성 A/B 계정만 사용했다. 외부 네트워크와 유료 호출은 차단했다.

## 통합 동작

`report.json`: **111개 통과**, JavaScript 오류 0, 외부 요청 0, 예상하지 않은 HTTP 오류 0.

- 실제 `/`, `/mobile.html`, `/desktop.html` 진입이 마루를 열고 계정을 복원한다.
- 최초 오프닝 → 계정 안내를 강제하지 않는 홈 → 게임 → 홈 영상 재개가 이어진다. 설정에서 오프닝을 다시 보아도 같은 앱으로 돌아온다.
- 가로·세로 설정을 저장하고 새로고침 후 복원한다.
- 바람길·말의 리듬·한글 만나기를 실제 로컬 음원으로 시작한다. 각 게임에서 740×320, 320×740, 844×390, 390×844 회전 중 기존 iframe과 문서가 유지된다. 닫기는 계속 누를 수 있고 복귀 후 iframe은 제거되고 홈 버튼으로 초점이 돌아간다.
- 노래 영상의 재생 시간을 유지한 채 회전한다. 닫으면 영상 재생이 멈추고 홈 영상이 재개된다.
- 첫 문장 놀이의 선택한 답이 회전 후 남는다. 중단 → 새로고침 → 다음 미응답 문장부터 이어하기 → 완료 → 보상 → 옷장 연결을 확인했다.
- 완료 요청을 동일한 requestId로 재전송해도 목도리와 계정 판본은 한 번만 증가한다.
- 실제 피팅룸 렌더러의 confirmed/stage slots에 서버가 보유한 목도리가 표시된다.
- 타운이 같은 계정으로 연결되고 가로·세로 전환 중 문서가 유지되며 닫기 후 마루로 돌아온다.
- 독립된 PC 브라우저에서도 A의 보유품과 차림이 복원된다. B는 A의 목도리를 갖거나 입지 않는다. 자격증명은 localStorage에 남지 않는다.

## 화면 검수

대표 이미지: `opening-portrait.jpg`, `home-landscape.jpg`, `runner-small-landscape.jpg`, `rhythm-small-landscape.jpg`, `hangul-small-landscape.jpg`, `first-sentence-reward.jpg`, `town-landscape.jpg`, `desktop-account-home.jpg`.

초기 통합 화면에서 `first-sentence-landscape.jpg`와 `wardrobe-landscape.jpg`는 세로 스크롤로 기능을 수행할 수 있지만, 작은 가로 화면의 첫 화면에서 보기와 캐릭터가 충분히 보이지 않았다. 이 화면 품질 문제를 보정한 뒤 `compact-check.cjs` / `compact-report.json` **5개 통과**, `wardrobe-scroll.cjs` / `wardrobe-scroll-report.json` **10개 통과**로 재검수했다. 작은 가로 화면에서 첫 문장의 세 보기·다음·쉬기·닫기가 모두 44px 이상이고 화면 안에서 실제로 눌린다. 피팅룸 무대는 740×320에서 140px, 844×390에서 210px 높이를 확보하며 캐릭터 전체와 목도리, 받침대가 보인다. 룩북·촬영실·피팅룸 전환과 목록 스크롤, 앞치마 시착 뒤에도 무대와 닫기가 유지되고, 닫으면 자원이 해제되고 홈 영상이 재개된다. 시착은 서버 차림을 바꾸지 않는다. 최신 사진은 `first-sentence-compact-740x320.jpg`, `wardrobe-compact-740x320.jpg`, `wardrobe-scrolled-apron-740x320.jpg`다.

## 정적 배포물 검수

`static-smoke.cjs`는 최종 `.tmp/world-app-maru-20261010-r6` 출력물을 별도 임시 HTTP 서버의 `/world/`에서 열었다. `static-r6/static-report.json`: **16개 통과**, JavaScript 오류 0, 실패한 자산 0, 외부·변경 요청 0. 앞선 r3의 `static-report.json`과 캡처는 그대로 보존했다.

- 실제 account 모드의 오프닝 → 마루 홈, mobile/desktop 입구, 폰트·미디어 경로를 확인했다.
- 비로그인 상태에서 세 게임은 앱 안의 로그인 안내를 열며 외부 페이지로 이동하지 않는다. 계정 로그인은 제출하지 않았다.
- 방향 선택 저장 → 새로고침 → 실제 화면 회전 → 알맞은 홈 영상 전환과 회전 안내 해제를 확인했다.
- 오프닝 영상 1.584초에서 가로로 회전한 뒤 1.664초로 이어졌다(차이 0.080초). 시작을 누른 시점 1.998초에서 홈 영상 2.031초로 이어졌다(차이 0.033초). 두 검사 모두 ±0.8초 범위다.
- 최종 r6 배포물의 화면은 `static-r6/static-home-landscape.jpg`, `static-r6/static-opening-portrait.jpg`, `static-r6/static-opening-landscape.jpg`, `static-r6/static-*-guest-login.jpg`에 보존했다.

이 폴더의 고유 검사 합계는 **142개 통과**다: 통합 111 + 작은 가로 배치 5 + 옷장 탭·스크롤 10 + 최종 r6 정적 배포물 16. r3에서 먼저 실행한 같은 정적 검사 16개는 중복 합산하지 않았다.

## 확인 범위

- 이 기록은 브라우저와 분리된 로컬 서버의 통합 결과다. 운영 OAuth, 원격 배포, 실물 iPhone/Android, 네이티브 앱은 포함하지 않는다.
- 세 미니게임의 끝까지 완주·점수·음성·필기 회전 검수는 `experiences/brand-opening/qa/maru-v4/README.md`에 별도로 있다. 이 검수는 앱 진입과 복귀 경계를 다룬다.
- 운영 account 모드의 공식 게임 host는 모의 계정 API를 사용해 별도로 검증했다. 아래 계정 연결 검수를 참조한다.

## 계정 연결과 회귀 검사

- 앱/문서/타운/옷장 단위 검사: `unit-tests.txt`, 41 통과·0 실패. 선택적 실제 두 탭 검사는 이 명령에서 1개 생략했으며, 별도 111개 통합 검사에서 A/B 분리와 PC 복원을 확인했다.
- `account-mode.test.mjs`와 공식 play host 검사: 46 통과. 검증된 계정/동의·epoch·최신 게임 준비 요청에 연결하고, 계정별 outbox와 중복 명령 ID를 보존한다.
- 계정 브라우저: `../maru-account-20261010/source-conflict/report.json`. 실제 OAuth/외부 계정 대신 가짜 계정 서버 응답을 사용했다. 게임 iframe 생성 전에 공식 host를 설치하고, runner/rhythm의 보상·중복 보상·진도 저장·회전·닫기, 한글 복귀, 로그아웃 때 host 종료를 확인했다.
- 진도 충돌: 저장 API에 CAS 409를 한 번 주입했다. 앱이 게임을 닫고 계정 진도/이 기기 진도 선택을 제시하며, 직접 계정 진도를 고른 뒤 같은 앱에서 바람길에 재입장해 서버 진도를 읽었다. 코인은 변경되지 않았다. 초기 outbox 충돌, 실행 중 충돌, 이전 기록 import 충돌도 단위 검사했다. 선택 전 자동으로 진도를 덮어쓰지 않는다.

공개용 빌드는 로컬 `.tmp/world-app-maru-20261010-r6/world`에 준비한다. 정적 빌드 생성은 공개 배포가 아니다. 앞선 r1/r2는 빌드 도중 다른 작업의 원본 변경을 감지해 최종본으로 사용하지 않았고, r3은 기본 통합, r4/r5는 충돌 복구를 보완하던 중간 결과다. 최종 파일은 manifest의 `sourceChanges`, `missing`, `publicToolNames`, `privateArtifacts`가 비어 있고 `ok:true`인 출력만 사용한다.


늦은 응답 회귀는 실제 마루 DOM에서 계정 준비/충돌 해결 응답만 지연 모의했다. 준비 중 닫기 뒤 늦은 성공은 iframe을 만들지 않는다. 닫기와 설정 재개방이 같은 이벤트 차례에 이어져도, 늦은 준비 성공·충돌 해결 성공·충돌 해결 실패가 설정을 덮지 않는다. 정상 충돌 해결은 게임에 다시 들어간다. 추가 검수에서 재현한 복구 완료 가드 누락을 수정하고 마지막 3개 경계를 재검사했다. 인증/상품 권한으로 게임 연결이 종료되면 앱 안의 계정 확인 화면으로 돌아간다.
