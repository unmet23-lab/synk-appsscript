# 미니게임 계정 저장 검증 · 2026-10-09

> 공개 전 후보·실패·재검수 순서를 보존한 이력이다. 아래 ‘현재’와 ‘남은 일’은 각 작성 시점의 상태이며, 현행 설치·운영 지시로 사용하지 않는다. 같은 날 실제 계정·게임 공개 결과와 남은 검증은 [완료 기록](README.md)에 있다. 후보 지문과 재현 입력은 당시 검증을 추적할 수 있도록 유지한다.

## 10월 9일 07:35 현재 상태

협동 서버·공개 API는 r4 공식 검토 완료 뒤 기존 VM에 반영했다. 회사 444파일 중 Caddy만 바꾸고 회사 컨테이너·이미지·시작 시각·자료는 유지했다. 실제 공개 HTTPS에서 CORS·독립 SSE 두 연결·18수리·공동 출발을 확인했다. [적용 근거](coop-release/r4/route-apply-result.json), [공개 API 결과](coop-release/r4/public-api-result.json). 게임 웹 페이지 공개나 실제 두 사람의 음성 플레이 성공으로 확대하지 않는다.

이전 네 지적은 공식 재검토에서 해결로 확인됐다. 추가로 발견된 맞춤 문항 교체 P1은 실제 출제 목록으로 정산하도록 수정했고 앱22·서버40·Chrome7흐름(계정/게스트 포함)을 통과했다. 게임 후보는 r8, 서버는7bcb(runtime불변), ESM11·5파일/11bridge 자료대조 통과다. [맞춤 레이싱 실제 Chrome 결과](../../../korean-racing/qa/account-rewards-personalized/results.json).

이 추가 수정의 공식 Opus5.5/max 검토는 사용량 한도로 **미완료**이며 안내된 재개 가능 시각은 **10:30 KST**다. [정확한 상태](release-review-adaptive-r8-status.json). 자동 재시도/예약은 만들지 않았다. 웹 SSO r1은 오래된 응답 경합으로 폐기하고 별도 담당의 r2를 기다린다. r7/v4와 PC r3는 사용 금지다. PC 설치는 통합 플랫폼 담당 채팅에서 계정 복구 수정과 합쳐 진행하며 이 작업의 설치 시도는0이다. DB·Edge·flag·OAuth·새 웹 공개, 실제 OAuth/물리 두 기기 복원은 미완료다. 아래 자료는 각 단계의 당시 근거로 보존한다.

이전 단계 상태: 로컬 구현과 자동 검증 완료. 당시 운영 적용 전.

## 구현 범위

기존 SYNK ID/WORLD 로그인을 통해 공통 코인·구매품·장착·상품 목표와 허용된 게임 진도를 계정에 저장한다. 새 입문 3종의 진행·소풍·별지도·즐겨찾기를 포함한다. 빈 계정에서 이전 브라우저 기록을 명시적으로 가져올 수 있으며 원본은 유지한다. 다른 계정에 자동 복사하거나 잔액을 합산하지 않는다.

서버가 금액과 날짜를 계산하고 계정 단위로 거래를 잠근다. 같은 명령의 응답이 유실돼도 중복 차감·지급하지 않는다. 진도는 읽었을 때의 값과 대조하므로 다른 기기의 진도를 조용히 덮어쓰지 않는다. 연결 실패는 전송 대기로 남기고, 충돌 때는 초안을 보관한 뒤 선택한다. 로그아웃 후 이전 게임이 저장할 수 없다. 레이싱의 서버 응답이 늦어도 완주 후 주행은 계속된다.

Atlas 학습 기록 동의·계정 연결은 기존 통로다. 이야기 교실 체크포인트의 동의 버전 경계, 리듬 기기 보정, 우주선 임시 입장 토큰은 이 기능으로 옮기지 않는다. 코인 지급의 게임 완료 보고는 클라이언트 입력이므로 학습 성과나 부정행위 방지 시험을 통과했다는 뜻은 아니다.

## 실제 브라우저 확인

`node experiences/beginner-games/qa/account-sync.cjs`

별도 Chrome 컨텍스트 두 개와 다른 계정 컨텍스트 하나에서 실제 WORLD 화면·게임 iframe·생성된 공통 지갑을 사용했다. 서버 서비스·저장소·마이그레이션은 실제 코드이며 DB는 로컬 PGlite다. 인증과 완료 기록·초기 보상은 합성 픽스처로 주입했다. 검사 중 구매는 실제 상점 버튼으로 실행했다.

10개 흐름 통과: WORLD 복원 후 진입, 상점 구매·장착, 두 번째 브라우저의 잔액·소유품·진도 복원, 주문 입문 진입, 별지도 즐겨찾기 복원·해제, 연결 실패 뒤 재시도, 다른 계정과 데이터 분리, 로그아웃 후 저장 차단, 320px 폭 화면, 세 게임의 미처리 브라우저 오류 없음.

- [실행 결과](results.json)
- [컬렉션 화면](account-collection.png) · [320px 화면](account-collection-mobile.png) · [계정 저장 표시](account-status.png)
- [게임·지갑·저장 회귀 검사](game-tests.txt)
- [서버·계정 클라이언트 검사](backend-tests.txt)
- [WORLD 계정 화면 검사](account-tests.txt) · [네이티브 인증 경계 검사](native-tests.txt)

최종 실행: 게임·지갑·저장 155/155, WORLD 계정 화면 367/367, 네이티브 인증 97/97, [격리 서버·클라이언트](release-backend-tests.txt) 21/21, [Edge 동봉 형식](edge-bundle-tests.txt) 4/4. 계정·네이티브 묶음에는 기존 기능의 회귀 검사도 포함한다. `earlier-checks/`와 `account-host-reliability-tests.txt`는 중간 실행 로그이며 최종 판정에는 위 파일을 사용한다.

## 운영 후보 준비와 추가 수정 · 2026-10-09

운영의 계정·세션 표와 선행 마이그레이션을 읽기 전용으로 확인했다. 게임 상태·거래 영수증 표는 아직 없다. [적용 전 확인](production-preflight.json). 기존 OAuth 클라이언트 21개를 보존하면서 WORLD 공개 복귀 주소 `https://synk.im/account/client.html?product=world` 하나만 추가하는 변경안도 준비했다. [설정 변경안](world-public-preview.json). 원격 DB·함수·OAuth 설정·secret·웹 공개 변경은 아직 0건이다.

서버는 다른 작업의 변경을 섞지 않은 `C:/Users/q1212/Documents/SYNK-talk-play-release-20261009`의 `codex/play-account-release-20261009` 브랜치, `f54cdbacff069f588988f3a31abe31b9fbd89541` 커밋에 준비했다. 실제 기존 동봉 도구로 만든 [배포 묶음 지문](release-payload-r2.json)을 보존했다. 읽기 전용 사후 SQL은 RLS·직접 접근 권한·계정 삭제 연결·FK·컬럼·CHECK·마이그레이션 지문을 확인한다. 실제 마이그레이션 기반 PGlite에서 13조건과 8가지 변조 탐지까지 [11/11 검사](postflight-tests.txt)를 통과했다. 적용 실패 시 데이터나 표를 지우지 않고 기능 플래그를 꺼서 복구한다.

공개 WORLD 로그인 후보는 `.tmp/world-play-public-20261009-r3`에 실행 파일 47개와 원문 66개를 고정했다. [후보 지문](public-world-candidate.json), [실제 Chrome 9항목](public-entry-results.json), [휴대폰 화면](public-entry-mobile.png), [PC 화면](public-entry-desktop.png). 기존 플랫폼 로그인 주소 보존과 WORLD 버튼의 PKCE 인증 요청을 확인했으며, 인증 요청은 브라우저에서 가로채 공급자에게 전송하지 않았다. 실제 OAuth 완료·계정 저장·공개 URL 검증은 아니다. 설정 도구 23/23, 후보 생성 도구 2/2도 통과했다.

추가 검토에서 발견한 오류도 수정했다. 재연결·충돌 해결 중 서버 읽기 실패를 저장 완료로 남기지 않으며, 세션 철회·인증 세션 누락은 기존 게임 저장을 막고 다시 로그인을 안내한다. 지갑의 성공 응답을 재사용해 저장 성공 뒤 불필요한 영수증 재조회로 성공을 실패로 뒤집지 않는다. 다른 탭이 전송을 끝낸 경우에는 같은 명령 ID로 영수증을 조회한다. 동일 탭의 동시 거래와 뒤따르는 진도 전송 실패에도 각각의 확정 결과를 보존한다. 위 155개·367개 검사와 실제 Chrome 10개 흐름을 수정 후 다시 실행했다.

첫 공식 검수 시도는 구독 한도로 끝났지만, 2026-10-09 05:30 KST에 공식 `claude-opus-5-5 --effort max`를 다시 실행해 검수를 완료했다. [검수 결과](release-review-20261009-0530.md)는 레이싱 복습 요청 거부·대기열 막힘과 보상/진도 순서 문제(P1 두 건), 일시 5xx의 계정 종료 오분류(P2), 서버/공개 문항 자료 대조(P3)를 지적했다. 관련 코드를 수정했고 고정된 새 후보에 대한 후속 검수가 필요하다. [검수 상태](release-review-status.json). 운영 쓰기와 설치는 아직 하지 않았다.

수정 서버 후보는 `f54cdbacff069f588988f3a31abe31b9fbd89541`이며 보상과 진도를 같은 계정 거래로 저장한다. 서버·SDK·사후 SQL 38검사, 거부 기록 복구 host 28검사와 전체 계정 포함 424검사를 통과했다. [새 서버 지문](release-payload-r2.json), [동기화 범위](backend-revision-r2.json), [host 회귀](host-rejection-tests.txt). 실제 Chrome 레이싱 첫50/다음25·복습교정+5·응답유실 재전송의 저장 검사는 통과했으며, 연결 복구 후 실제 결과 화면도 같은 완주의 저장된 보상으로 갱신됨을 확인했다. 같은 보상을 새로 요청하지 않는다. [Chrome 레이싱 5흐름](../../../korean-racing/qa/account-rewards/results.json)과 앱 회귀 19검사가 통과했다.

## 공개 게임·협동 서버·PC 후보 후속 마감

공개 게임 후보는 `.tmp/world-games-public-20261009-r7/payload`의 310파일(33,420,983 bytes)로 고정했다. 최신 공개 기준 `f10cf8e6a0f4ac1b116debc3ac46e4d4cdd502fd`의 다른 SSO 변경을 보존한다. 새 허브·입문 3종·상점과 기존 게임 계정 통로를 포함하며 기존 음성·문제 은행을 보존했다. 정적 참조 593개, 승인 음성 SHA 28개, ESM 입구 11개와 준비 회귀 21개를 확인했다. 비회원 마법→레이싱→마법 상점 왕복 4흐름도 통과했다. r1~r6는 최종 후보가 아니다. 서버가 사용하는 curriculum·campaign·finales·garage·learning 5파일은 공개 자료 전체와 정규화 대조했고 생성 runtime 지문까지 일치한다.

`node experiences/beginner-games/qa/account-sync.cjs --public-candidate .tmp/world-games-public-20261009-r7 --account-candidate .tmp/world-play-public-20261009-r3 --server-candidate C:/Users/q1212/Documents/SYNK-talk-play-release-20261009`의 [최종 Chrome 결과](public-games/results.json)는 12흐름을 통과했다. 실제 구매·장착, 두 브라우저 복원, 즐겨찾기 해제, 재연결, 계정 분리, 로그아웃, 320px 화면과 기존 8개 게임 입구를 확인했다. 거부된 옛 요청은 원본을 보관하고 실제 WORLD 버튼으로 게임을 계속 열 수 있다. 인증은 합성이며 DB는 실제 서비스/저장소와 PGlite다. 운영 로그인이나 물리 두 기기 증거가 아니다.

협동 서버는 `experiences/spaceship-coop/deploy/`에 별도 컨테이너·systemd·Caddy 경로 후보를 준비했다. 공개 API 후보는 `https://workspace.synk.im/api/spaceship`이며 SYNK 계정 토큰을 전달하지 않고 기존 임시 방 토큰을 사용한다. Host/Origin/프록시 주소·요청/방/연결 제한과 50방·256MB·CPU 0.5 한도를 적용했다. 로컬 배포 구성 15검사와 서버 16검사를 통과했다. 기존 VM의 캐시된 Node24.21 이미지로 **네트워크 없음·호스트 마운트 없음·포트 공개 없음**의 임시 컨테이너를 실행해 [Linux 16/16 및 실제 Caddy 구성 검사](coop-release/linux-isolated-validation.json)를 확인했다. 이후 [최종 spaceship 이미지](coop-release/final-image-validation.json)도 실제 빌드했다. `synk-spaceship-candidate:97e3490f30bd`(imageId `sha256:46b1997da8898b04ba848934eda8956b58cc3a34bba5bd2de89d878e44d36865`)의 기본 CMD·Node24.21·Docker healthcheck와 두 참가자 18장치 완주/이륙 등 15검사를 격리 환경에서 통과했다. 실제 컨테이너의 비루트 UID·읽기전용·256MB/CPU0.5·포트/마운트 없음·SIGTERM 정상 종료를 확인했다. 운영 공개 주소의 두 사용자 연결 증거는 아직 아니다. 시험 중 다른 운영 작업으로 회사 컨테이너가 교체돼 변경 전후 동일성은 false이며, 이 시험은 운영 서비스나 경로를 변경하지 않았다. 최신 기준은 `/opt/synk/releases/e696b9efeed7`의 440파일이다. 다른 작업의 SSO 변경 7개를 보존하고 전수 SHA를 대조했다. 실제 적용 직전에는 다시 기준을 확인한다. Caddy 전환·원본 보존·실패 복구 도구도 [Linux 임시 fixture 18/18](coop-release/company-route-linux-fixture-results-r3.json)을 통과했다. 현재 기준에서 Caddy 한 파일만 바꾸며 회사 컨테이너는 유지한다. 운영 적용 성공 후에는 다음 회사 릴리스에서도 경로가 유지되도록 회사 원본 Caddy와 운영 기록을 함께 갱신해야 한다.

추가 적용 직전 읽기에서 회사 운영이 `/opt/synk/releases/1fa6475e97eb`(444파일)로 다시 바뀌었다. 기존 e696 기준 명령은 실행하지 않는다. [최신 읽기 결과](coop-release/service-final-readonly-preflight.json)를 기준으로 변경 보존과 협동 경로만 추가하는 후속 후보를 준비 중이며 운영 쓰기는 0건이다.

PC WORLD는 현재 설치된 22b 기준의 89개 runtime에서 3파일만 수정한 r3 후보를 만들었다. [후보 기록](../../../../desktop/artifacts/world-play-candidate-20261009-r3/CANDIDATE.md): 후보 검사 331/331, 실제 Electron 합성 계정 검사 35/35와 pin 4검사를 통과했다. WORLD·Platform NSIS 모두 생성했고 Platform 실제 패키지의 격리 검사 18/18도 통과했다. [패키지 및 설치 원장](../../../../desktop/artifacts/world-play-candidate-20261009-r3/platform-pin/README.md)은 설치 실패 복구 12검사를 포함한다. 이전 f9/r1/r2 후보를 사용하지 않는다. 두 앱 설치와 사용자 프로필·실제 로그인은 변경하지 않았다.

게임310·계정47·포털설정1의 합동 공개 manifest는 `.tmp/world-public-release-20261009-v4/manifest.json`의 358파일(실제 변경330)로 고정했다. 합동 SHA는 `e36a8f15a74b90491215ad719f89a9bb302008b9ed887c5a4f7f607f7be62fe0`다. `SYNK-website/qa/world-play-20261009/PUBLISH.md`의 실제 적용 설정 일치 확인과 다른 변경을 보존하는 출판 순서를 따른다.

수정 후보의 최종 재검수·운영 반영은 아직 미완료다. 운영 DB·Edge·기능 플래그·OAuth 콜백·웹 게시·상시 협동 서비스·PC 설치는 변경하지 않았다. 서버/계정부터 준비한 뒤 공개 파일을 반영해야 하며, 정적 파일 업로드만으로 협동 플레이나 계정 통합 완료를 보고하지 않는다.

## 재현과 원문

```powershell
node experiences/play-common/build-collection.mjs
node tools/build-synk-account.js
node --test experiences/play-common/account-host.test.mjs experiences/play-common/collection.test.mjs experiences/play-common/beginner-motivation.test.mjs experiences/word-magic/*.test.mjs experiences/order-rush/*.test.mjs experiences/spaceship-coop/*.test.mjs experiences/korean-racing/tests/garage.test.mjs experiences/korean-racing/tests/coast-drive-integration.test.mjs
node --test experiences/synk-account/tests/*.test.mjs
node --test desktop/tests/play-account.test.cjs desktop/tests/account-memory.test.cjs desktop/tests/auth.test.cjs desktop/tests/renderer-auth.test.cjs
node experiences/beginner-games/qa/account-sync.cjs
```

SYNK-talk 저장소:

```powershell
node tools/synk-play-build.js --check
node --test tests/synk-play.test.js tests/synk-account-client.test.js
```

클라이언트 원문은 `experiences/play-common/{account-host,account-client,play-data,racing-command}.mjs`, WORLD 연결은 `experiences/synk-account/src/account-view.mjs`다. 서버 원문은 SYNK-talk의 `lib/synk-play-{server,store}.js`와 `supabase/migrations/20261009170000_synk_play_c16.sql`이다. JSONB는 실제 postgres@3.4.4 직렬화와 `q.json()` 바인딩으로 확인했다.

## 공개 전 당시 운영에 남았던 일

1. 공통 운영 원칙의 라이브 최종 검수 후 신규 DB 마이그레이션을 적용하고 권한·삭제 트리거를 확인한다.
2. SYNK-talk의 기존 동봉 배포 도구로 `synk-play` Edge를 반영하고 `SYNK_PLAY_ENABLED=true`를 설정한다. 기존 WORLD OAuth 매핑·인증을 사용한다.
3. 그다음 갱신한 계정 화면·게임 자산·네이티브 계정 통로를 공개한다. 프런트만 먼저 반영하면 서버 복원 대기에서 게임 진입이 막힐 수 있다.
4. 실제 동일 계정의 다른 두 기기에서 구매·진도·즐겨찾기 해제·로그아웃을 확인하고 운영 검증 기록을 별도로 남긴다.
