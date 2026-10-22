# Fable 최종 검수 — 웹 플랫폼·계정 포털 (2026-10-22)

**판정: 고친 뒤 공개** — P0 0 · P1 1 · P2 8 · P3 5

P1은 한 곳(맨 위 「계정 라이브러리」 상자의 기본 설명)이며 글 한 줄과 갈래 하나를 고치면 끝난다. 고치면 PC 묶음(`desktop/renderer/platform-continuity.mjs`)과 `platform-library-view.test.mjs`의 기준 글도 같이 다시 만들어야 한다.

직접 재현한 캡처·로그: `C:\Users\q1212\AppData\Local\Temp\claude\C--Users-q1212-Documents-SYNK-appsscript\02aa6936-0224-4f26-b038-67402e4b2d0c\scratchpad\fable\portal-extra\` (A1~A9·B1~B2는 가짜 설정·가짜 계정 서버로 찍은 플랫폼·계정 화면, W1~W4는 공개 synk.im/world/, `shots-log.json`은 화면 글 덤프, 찍는 도구 `shots.mjs`·`world-check.mjs`·`world-play.mjs`). 아래 「after\…」는 scratchpad의 `shots\portal\` 아래 폴더다.

## 지적

[P1] `experiences/synk-account/src/platform-library-view.mjs:44·93` (같은 글이 PC 묶음 `desktop/renderer/platform-continuity.mjs`에도 들어감) — 맨 위 「계정 라이브러리」 상자의 설명 「로그인하면 즐겨찾기와 할 일 메모를 계정에 저장해 다른 기기에서도 봐요.」가 **로그인한 사람에게도 그대로** 나온다. 바로 아래 계정 상자는 「유호님으로 로그인했어요」, 머리 단추는 「유호」인데 위 상자는 로그인하라고 한다. 「계정 라이브러리 연결」을 누른 뒤에도(계정 저장 켜기 전) 상태 「계정에 저장했어요」 옆에 같은 「로그인하면…」이 남는다. 바꾸기 전(HEAD) 글 「즐겨찾기와 다음에 할 일을 같은 SYNK ID로 이어가세요.」는 상태를 가리지 않아 이런 어긋남이 없었다 — 이번에 생긴 것. — 근거: `portal-extra\A1-home-signed-in-1440.png`·`-390.png`(로그인됨·미연결), `A3-home-signed-in-library-connected-1440.png`(연결 뒤·저장 꺼짐); 코드 `summary()` 마지막 분기 — `available`(notebook 활성·canEdit·doc.consent 모두 참)이 아니면 무조건 「로그인하면…」, 처음 HTML(44행) 기본 글도 같음. 로그인 뒤 라이브러리를 아직 안 켠 상태는 모든 회원이 처음 지나는 상태다. — 고칠 방향: 기본 글을 상태 중립으로(예: 「연결하면 즐겨찾기와 할 일 메모를 계정에 저장해 다른 기기에서도 봐요.」) 하거나, `getHost()?.identity()?.signedIn`과 notebook 상태로 세 갈래(로그인 전 「로그인하면…」 / 로그인 뒤 미연결 「「계정 라이브러리 연결」을 누르면…」 / 연결 뒤 저장 꺼짐 「「계정 저장 켜기」를 누르면 지금부터…」)로 쓴다. `tests/platform-library-view.test.mjs`의 기준 글도 함께.

[P2] `experiences/synk-account/src/account-notebook.mjs:25`(상태 칩·제목, 공용 모듈 — 플레저·PC 묶음도 씀) — 연결 직후 아직 저장을 켜기 전인데 「계정에 저장했어요」가 칩과 제목으로 두 번 보이고, 같은 상자 아래에서는 「켜면 지금부터 … 저장해요 [계정 저장 켜기]」라고 한다. 저장했다는 말과 저장을 켜라는 말이 한 상자에 있다. — 근거: `portal-extra\A3-home-signed-in-library-connected-1440.png`. 보고 ⑤에서 칩 글을 그대로 둔 곳. — 고칠 방향: `doc.consent`가 꺼져 있으면 상태를 「저장 꺼짐」으로 하거나 칩·제목을 숨긴다(플레저 쪽과 함께).

[P2] `experiences/synk-account/src/account-notebook.mjs:25` — 펼친 상자의 제목 「내 계정으로 이어가기」. 글원칙이 금한 「~이어가기」 꾸밈이고, 바로 위 머리는 이번에 「계정으로 이어가기」→「계정 라이브러리」로 바꿨는데 안쪽 제목은 그대로라 같은 상자를 두 이름으로 부른다. — 근거: `portal-extra\A3-…-1440.png`, `A4-home-signed-out-library-connect-1440.png`(머리 「계정 라이브러리」 아래 「내 계정으로 이어가기」). 공용 모듈이라 이번 범위 밖에서 남은 것. — 고칠 방향: 기능 이름으로(예: 「SYNK ID 저장 상태」), 플레저 담당과 같은 커밋에.

[P2] `experiences/synk-account/src/platform.mjs:203·206` — config.json을 못 읽은 **한 가지** 실패에 토스트 「연결이 불안정해 화면 설정을 못 불러왔어요. 잠시 뒤 다시 시도해 주세요.」와 계정 상자 「로그인 설정을 못 불러왔어요. 로그인은 그대로이니 「다시 시도」를 눌러 주세요.」가 동시에 뜬다. 같은 것을 「화면 설정」「로그인 설정」으로 다르게 부르고 다음 행동도 둘이다. — 근거: `portal-extra\A5-home-config-failed-1440.png`. — 고칠 방향: 상자가 뜨는 브라우저 화면에서는 토스트를 빼거나, 이름을 하나(「로그인 설정」)로.

[P2] `desktop/renderer/benefits.mjs:6`(총괄 파일, 웹 카드가 그대로 씀) — 회원 혜택 카드와 「다른 회원 혜택」 목록은 「내 성향 확인하기」, 소개 포스터·새소식·도움말·홈 계정 상자는 「내 성향」. 아르곤 A6 반영으로 새소식·도움말은 「내 성향」이 됐지만 카드 제목은 그대로라 둘러보기 → 소개 사이에서 이름이 두 가지다. — 근거: `after2\02-discover-1440.png`(카드 「내 성향 확인하기」), `after\04-benefit-insight-1440.png`(포스터 「내 성향」), `after3\13-help-1440.png`, `after3\05-benefit-care-1440.png`(「다른 회원 혜택」). — 고칠 방향: benefits.mjs의 name을 「내 성향」으로(PC 앱 카드와 함께, 총괄).

[P2] `experiences/synk-account/src/applications.mjs:7` + `platform.mjs` appPage — Workspace 소개 머리에서 부제 「팀이 대화하고 일하는 업무 앱」 바로 아래 설명이 「SYNK 팀이 대화하고 일하는 업무 앱이에요. 교사는 …」로, 같은 문장이 연달아 두 번. — 근거: `after3\17-app-messenger-public-1440.png`·`-390.png`. — 고칠 방향: 설명 첫 문장을 다른 정보로(예: 「채널 대화와 회사 자료, 교사의 「내 수업」이 한 앱에 있어요.」).

[P2] `experiences/synk-account/src/platform.mjs:110`(quickCard meta) — 홈 「설치 없이 바로 열 수 있어요」의 WORLD 카드 한 줄이 「한국어 미니게임」인데 단추 「웹 WORLD 열기」는 이번에 바꾼 입구 synk.im/world/(「우리 동네」 — 언어 고르기·한글 확인 온보딩 → 동네·배우기·놀이·옷장)로 간다. 카드 이름과 열리는 화면이 다르고, 둘러보기 카드·소개의 부제는 「한국어 게임과 TOPIK 연습」이라 같은 앱을 두 가지로 소개한다. — 근거: `after3\01-home-signed-out-1440.png`(카드 글), `portal-extra\W1-world-live-1440.png`·`W4-world-live-after-onboarding-1440.png`(열리는 화면). — 고칠 방향: 카드 한 줄을 부제와 같은 「한국어 게임과 TOPIK 연습」으로.

[P2] `experiences/synk-account/src/platform.mjs:144·149` + `platform.html` 바닥글 — 다운로드 한 화면에 「WORLD와 Workspace는 그 안에서 골라 설치해요」(머리) · 「WORLD와 Workspace도 이 앱 안에서 설치해요」(포스터) · 「PC 앱 안에서 설치하는 앱」(소제목) · 줄 상태 「PC 앱에서 설치」 · 바닥글 「WORLD와 Workspace는 웹에서 열거나 PC 앱에서 설치해요」 — 같은 사실이 다섯 번. — 근거: `after2\11-downloads-feed-failed-1440.png`. — 고칠 방향: 포스터 설명은 PC 앱이 무엇인지 한 줄만, 머리 설명은 설치 순서만 남긴다.

[P2] `experiences/synk-account/client.html:1` — 탭 제목 `<title>SYNK · 계정 연결</title>`이 그대로다. 글원칙 용어 표에서 「계정 연결(로그인을 뜻할 때)」은 안 쓰는 말이고 본문 제목은 「SYNK ID로 로그인하고 기록을 이어 가요」로 바꿨다(index.html 제목은 「SYNK ID」로 바꿈). — 근거: client.html diff에 제목 줄 변경 없음, 공개 client.html도 같은 제목. — 고칠 방향: 「SYNK ID 로그인」.

[P3] `experiences/synk-account/src/preview.mjs:23` — 합성 예시의 providers가 `['email · 합성']` 한 덩어리라 account-view.mjs의 새 표기(email→이메일)를 타지 않고 「로그인 방법: email · 합성」으로 보인다. preview.html은 공개 주소에 없다(synk.im/account/preview.html 404). — 근거: `after3\34-preview-account-1440.png`. — 고칠 방향: `['email']`로 두고 합성 표시는 따로.

[P3] 합성 WORLD 예시(`after\35-preview-world-account-1440.png`) — 「예시 화면이라 기록을 저장하지 않아요.」「예시 화면에서는 코인과 게임 기록을 저장하지 않아요.」「예시 옷장이라 계정에 저장하지 않아요.」가 연달아 세 번. 예시 화면 전용(실제 계정 화면은 상태마다 다른 글)이라 P3. — 고칠 방향: 예시 안내는 위 노란 띠 하나로.

[P3] `experiences/synk-account/src/platform-library-view.mjs:293` — 설정이 아예 없을 때(config.json 404) 「계정 라이브러리 연결」을 누르면 「로그인 설정을 못 불러왔어요. 「계정 라이브러리 연결」을 다시 눌러 주세요.」 — 다시 눌러도 같은 결과라 헛된 다음 행동. 공개 config.json에는 platform 설정이 있어 라이브에서는 안 나온다. — 근거: `portal-extra\A7-home-unconfigured-library-connect-1440.png`. — 고칠 방향: `identity().configured`가 거짓이면 「이 화면에는 로그인 설정이 없어요」로.

[P3] `desktop/renderer/member-insight-view.mjs`(총괄) — 로그인 뒤 「내 성향」에서 기록을 못 읽으면 「내 기록을 불러오지 못했어요. 계정 연결을 확인하거나 다시 불러와 주세요.」 — 「확인하거나」가 글원칙의 「확인해 주세요」 꼴. 가짜 서버(state:null 응답)로만 재현해 실제 서버 응답에서도 이 갈래가 나오는지는 미확인. — 근거: `portal-extra\A8-benefits-insight-signed-in-1440.png`.

[P3] 새 WORLD 입구에서 미니게임 입구 확인 못 함 — synk.im/world/는 온보딩(언어 → 한글 확인 → 튜터 반응…)이 이어져 「놀이」 탭 안을 이번에 못 봤다. 플랫폼의 「미니게임은 설치 없이 웹에서 바로 할 수 있어요」(applications.mjs:6)·「미니게임: 레이싱, 말의 리듬, 주문 폭주 같은 게임을 웹에서 바로 해요」·도움말 「WORLD 미니게임 … 웹에서 바로 열려요」는 그 탭에 세 게임이 있어야 맞다. /world/ HTML에는 `/world/korean-runner/` 링크만 보인다. — 근거: `portal-extra\W1~W4`. — 고칠 방향: 총괄이 WORLD 「놀이」 탭에서 세 게임을 한 번 확인; 없으면 소개 글을 「바람길 …」처럼 있는 것으로.

## 확인해서 문제 없던 것(의뢰서 「특히 볼 것」)

- 계정 상자 ↔ 맨 위 상자: 로그인 전(상자 숨김·머리 「SYNK ID 로그인」)·설정 없음(상자 숨김)·오류(「로그인 상태를 못 불러왔어요」+「다시 시도」, 머리 「SYNK ID 확인」)·계정 서버 오류(「계정 서버에 닿지 못했어요…」)는 갈래가 맞고 겹치지 않는다(`after3\01-home-signed-out`, `01b-home-unconfigured`, `portal-extra\A5·A6`). 어긋나는 것은 위 P1(로그인됨)뿐.
- 이름: 「학습 기록 연결」이 계정 화면 카드·스위치·플랫폼 계정 상자·앱 소개·도움말·포털 바닥글·연결 동의 글에서 같다. 「내 계정 관리」가 가리키는 `client.html?product=platform`에 그 스위치가 실제로 있다(`portal-extra\B1-client-platform-signed-in-1440.png`). 「SYNK ID」「PC 앱」「SYNK Workspace」 일관. PC 앱 글과 같음: 「회원이면 모두 무료.」·「네 가지 회원 혜택」·PATH 「면접 연습 열기」(state.mjs:50)·「웹에서 연습」(previewLabel)·「웹에서 무료」·「설치·업데이트」(convenience.mjs)·「설치 파일 준비」「설치 시작」「설치 상태 확인」「새로 로그인」(launcher.mjs). 안내가 가리키는 단추 「계정 연결 다시 확인」「저장 다시 시도」「기기 기록을 계정으로 옮기기」「마을 연결 다시 확인」「3D 시험 보기」「인증번호 확인」「연결 다시 확인」「계정 저장 켜기」「옷장 다시 확인」「설정 다시 불러오기」 모두 실제 단추 이름이다.
- 새소식 날짜: 10-19 내 성향→WORLD(결정 135행, `WORLD_FOLLOWS_SETTINGS = true`), 10-18 회원 혜택 네 가지·앨범/리허설 폐기(결정 161행), 10-14 Windows 자동 업데이트(desktop/LIFECYCLE.md 0.4.7), 10-09 Workspace 이름(결정 232행) — 항목마다 맞고, 카드·모달·앱 소식 탭이 항목의 date를 읽는다.
- 다운로드: 표를 못 읽으면 판·파일·크기·GitHub 링크를 숨기고 「synk.im에서 받기 ↗」(https://synk.im/#platform-get, 홈페이지에 `id="platform-get"` 있음)와 「공개된 판 정보를 불러오지 못했어요…」, 읽는 중에는 「지금 공개된 판을 확인하고 있어요.」; 읽으면 0.4.37 표시(`after2\11-downloads-feed-*`). 공개 feed는 0.4.37.
- 링크(공개 주소 HTTP 상태): `synk.im/account/client.html?product=platform` 200·`?product=world` 200·`synk.im/world/` 200·`synk.im/id/` 200·`care/`·`fortune/` 200·`src/platform-library.css`·`platform.css`·`benefits.css`·`member-insight.css`·`theme.js`·그림 200. `./index.html`(계정 포털 안)은 공개본에서 `prepare-world-play-public.cjs`가 `https://synk.im/id/`로, `../learning-hub/`·`atlas-learning.js`는 `/try/learning-hub/`로 바꾸는데 새 client.html에 그 세 문자열이 그대로 있어 재작성이 계속 맞는다. 포털 머리 nav도 `prepare-portal.mjs`가 찾는 문자열 그대로. 공개 config.json에 `clients.platform`이 있어 라이브는 로그인 전/후 갈래로 돈다(설정 없음 갈래 아님), `messengerUrl` 없음 → Workspace 소개는 「웹은 회사 주소로 들어가요」 갈래.
- 번들: `node tools/check-account-bundles.js`(--check만) ok 3/3 — `platform-continuity.mjs`·포털 dist·교사 묶음이 지금 원천과 맞음(P1을 고치면 다시 만들어야 함).
- 화면: 1440·390 캡처(before/after/after2/after3 전부와 직접 찍은 A1~B2)에서 가로 넘침·겹침·잘림·페이지 오류 없음. 합쇼체는 개발 연결 전용 한 줄(account-view.mjs:192 localConnection)만 남음.

## 본 범위 / 못 본 범위

- 본 범위: 원천 diff 전체(29 원천·4 html·css·theme.js, 시험 짝 제외), `shots\portal\before·after·after2·after3` 전부(1440·390), 직접 재현 11장(로그인됨·연결 뒤·로그인 전 연결·설정 읽기 실패·계정 서버 오류·설정 없음·내 성향·계정 화면)과 공개 synk.im/world/ 4장, 공개 주소 HTTP 상태·공개 config·공개 client.html, 공개 준비 도구의 재작성 문자열, 번들 검사, 새소식 날짜 근거, PC 앱 글 대조(benefits.mjs·state.mjs·launcher.mjs·convenience.mjs).
- 못 본 범위: Google 로그인·가입·휴대폰 인증·비밀번호 재설정의 실제 흐름(서버 필요, 글만 읽음), WORLD 계정 화면의 실제 학습 기록·게임 기록 상태 글(합성 예시로만), 옷장 3D, 플레저·PC 앱 안에서의 공용 모듈 표시, 교사 앱, synk.im/world/ 「놀이」 탭 안, `member-statement.cjs` 문장, 시험 파일의 글 짝.
