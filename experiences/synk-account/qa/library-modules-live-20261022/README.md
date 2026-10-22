# 웹 플랫폼 계정 라이브러리 — 공개본 모듈을 master 판으로 (2026-10-22)

synk.im 웹 플랫폼(`https://synk.im/account/platform.html`)의 공개 묶음 `account/dist/platform.js`에서 계정 라이브러리 모듈만 master 판으로 바꾼 기록과 도구다. 공개본은 10-14~16 다른 AI의 릴리스 빌드에 글·모듈을 얹어 온 묶음이라 master로 다시 묶으면 남의 미공개 기능이 나간다([현장 노트](../../../../docs/현장노트/배포_공개.md#공개본-accountdistplatformjs를-master-빌드로-덮으면-남의-미공개-기능이-같이-나간다)). 그래서 두 구역만 바꾼다.

- **A — 자료** `platform-library-data`: 공개본에서 `personal-data`가 부르므로 esbuild `__esm`으로 싸인 꼴(`init_platform_library_data`). 공개본 최상위 문장 40–44.
- **R — 계정 노트 → 라이브러리 계정 → 보기**: `account-notebook`·`platform-library-account`·`platform-library-view`(사이의 init 호출 포함). master 판은 여기에 `platform-library-state`·`personal-state`·`platform-library-recovery`를 더 부른다. 공개본 최상위 문장 107–117.
- 함께: `account/platform.html`의 `?v=`, `account/src/platform-library.css`(master 판 — 즐겨찾기 순서 목록·메모 검색 칸 두 줄을 더하고 휴대폰 폭 토글 규칙을 고침, 공개본 줄끝 LF로).

## 왜

배포 뒤 Fable 검수 P3-4([원문](../../../../docs/디자인/플랫폼_시그널/글짝_20261021/검수/Fable_포털_공개뒤.md)) — 공개본은 즐겨찾기와 「이어 쓸 앱」을 `PLATFORM_APP_IDS` 전부로 그려 웹에 없는 「☆ Workspace 내 수업」·「☆ 파트너스」를 보였고, 저장된 교사·파트너스 즐겨찾기를 Workspace·PULSE로 묶지 못했으며, 맨 위 안내가 로그인 전·연결 전·저장 켜기 전을 가르지 못했다. master는 `displayIds()`·`projectPlatformLibrary`·`nextStep()`으로 처리한다(PC 앱 0.4.39~와 같은 판).

## 공개본 옛 판의 내력 — 어느 커밋과도 같지 않아 되살렸다

| 모듈 | 공개본 판 = | 근거 |
|---|---|---|
| 자료 | 10-09 압축 전 판 + 10-18 은퇴 앱 거르기 + 10-22 글 둘 | 압축 전 판은 SYNK-appsscript에 커밋되지 않은 blob 4ceeeb3a4 — synk-policy `try/travel/synk-account/src/platform-library-data.mjs`가 같은 blob이다 |
| 계정 노트 | master(`b4b28e17a`)에서 10-20 「검사 함수를 인자로」(`874a15cdc`)만 되돌린 판 | 공개본은 `personal-data`의 `validatePersonalState`로 검사한다(10-22 `641fb16`이 b4b28e17a 판을 얹으며 남김) |
| 라이브러리 계정 | master에서 PC 앱 재시도(`retryNativeIdentity`·`retryConnection`)를 뺀 판 | 웹에서는 쓰지 않는 갈래 |
| 보기 | 10-09 압축 전 blob 35bc27e52 + 즐겨찾기 의도(10-14~16) + 10-18 은퇴 앱 거르기(`b45319c`) + 10-22 글(`641fb16`) | 도구는 공개본 조각에서 esbuild 번호(`esc2`·`root2`·`render2` …)만 원천 이름으로 되돌린다 |

**옛 판 바이트 대조**: 이 넷을 같은 이름 충돌 환경 — 공개본에서 두 구역 밖에 선언된 최상위 이름 전부를 맨 앞 모듈이 먼저 선언하고, 10-22 공개가 master 빌드 환경에서 컴파일해 남긴 빈자리 이름 `text3`을 더함 — 에서 esbuild 0.28.2(`minifyWhitespace`, iife, es2022)로 컴파일하면 공개본 A·R과 바이트까지 같다. 다른 곳은 10-18 공개(synk-policy `b45319c`)가 컴파일 없이 글자로 얹은 네 자리(`filter(id=>…)` 셋·`''` 하나)뿐이라, 대조할 때 그 넷만 esbuild 꼴로 바꾼다(횟수 단언). → 같은 환경에서 지은 master 판이 공개본의 나머지와 이름이 맞는다.

## 연결 지점

- 공개본 platform 코드가 라이브러리를 부르는 곳(`mountPlatformLibrary` 인자, `library.read()`의 `projection()`, `dispatch()`, `render()`)은 master `platform.mjs`와 글자까지 같다. `getAppIds`는 넘기지 않아 기본값(활성 앱)이다.
- `nextStep()`이 읽는 `getHost().identity().signedIn`을 공개본 `createPlatformAccount`도 준다.
- 복구는 `canUse`가 `native &&`로 시작해 웹에서 아무것도 하지 않는다. 제품 계정(`createProductAccount`)은 라이브러리가 쓰지 않는다. 공개본 문서 동기화는 그대로 두며 master와의 뜻 차이는 가족 앨범 캐시 한도 한 줄뿐이다.
- 계정 노트가 `personal-data`를 더는 부르지 않아 웹에서 그 모듈(과 path-vr·리허설·가족 앨범 모델)은 초기화되지 않는다 — master 웹 빌드는 애초에 묶지 않는다. 검사는 둘 다 64KB JSON 복사 → `validatePlatformLibrary`로 같다.

## 같이 고친 것 — 은퇴 앱 메모를 고치면 저장이 막히던 것 (아르곤 A1)

계정에 남은 서비스를 마친 앱(대화 리허설·가족 앨범) 메모를 「수정」하면 「이어 쓸 앱」 목록에 그 앱이 없어 선택이 비고, 제목만 고쳐 저장해도 「라이브러리 기록 형식이 맞지 않아요.」로 막혔다. 실제 브라우저에서 공개본(옛 판)과 master 둘 다 재현됐다 — 시험의 가짜 DOM은 목록에 없는 값도 받아 줘서 놓쳤다. master에서 고쳐 이 판으로 옮겼다: 보기 `editorOptions()`는 고치는 메모의 앱이 목록에 없으면 한 칸 더 보이고(이름이 없으면 「이전 앱의 메모」), 자료 `edit-note`는 메모가 제 앱을 그대로 두는 수정을 허용한다(옛 Partners 특례를 넓힌 것, 옛 앱으로 옮기기는 그대로 금지). PC 앱 묶음(`desktop/renderer/platform-continuity.mjs`)도 다시 지어 다음 PC 판에 실린다. 시험: 보기·자료에 하나씩.

휴대폰 폭(420px 이하)에서 「최근에 연 시각도 계정에 저장」 토글이 글자를 덮던 것(Fable P2, 옛 판부터)도 고쳤다 — 라이브러리 CSS의 420px 규칙이 체크박스까지 100%로 만든 뒤 `width:auto`로 되돌리면서 웹 토글(`.launcher` 40px)의 너비를 지웠다. 그 규칙을 `input:where(:not([type=checkbox]))`로 좁히고(특이도 그대로) 되돌림 줄을 지웠다. 웹 토글 390px 20 → 40px, PC 앱 기본 체크박스는 제 크기(생성 CSS `platform-continuity.css`도 다시 지음).

## 확인 (10-22, master `c656e1004` + 위 고침, 공개본 synk-policy `fd1fed3` 바이트)

1. `옛판` — A 4,369B·R 44,079B 바이트 같음, 충돌 이름 바뀜 0.
2. `후보` — 묶음 2,054,526 → 2,075,469B(`?v=` 6804d8783eb5 → f27a3201d0c1). 최상위 이름 겹침 0, 구역 밖에서 쓰는 옛 이름 빠짐 0, 전역 참조(eslint-scope) 47 = 47.
3. `run-tests.cjs` — master 라이브러리 시험 110개(보기 70·자료 27·복구 13)를 후보 바이트에서 뗀 모듈로: 110/110, 원천과 같다.
4. 웹 기본값 시험 셋(`tests/platform-library-view.test.mjs` 끝 — 즐겨찾기·「이어 쓸 앱」 6개, 교사·파트너스 묶임과 계정 문서 그대로, 안내 네 상태): master 원천·PC 묶음·후보 통과, 옛 판은 셋 다 실패.
5. [`compare-live.cjs candidate`](../copy-audit-live-20261022/compare-live.cjs) — 14경로 × 1440·390에서 바뀐 줄은 홈·내 라이브러리·설정의 라이브러리 안내 하나(「로그인하면 즐겨찾기와 할 일 메모를 …」). 콘솔 오류·가로 넘침 0.
6. `check-live.cjs` — 로그인 전 「계정 라이브러리 연결」 누르기(공개본 ↔ 후보 같음), 로그인 뒤(시험 계정 없이 페이지 안 가짜 웹 계정 호스트): 즐겨찾기 8 → 6(교사 즐겨찾기는 「★ Workspace」), 순서 목록·메모 검색 생김, 「이어 쓸 앱」 8 → 6, 390px 토글 20 → 40px. 오류·넘침 0. 은퇴 앱 메모 수정은 실제 브라우저에서 옛 판 실패 → 후보 저장(앱 그대로).
7. 검수 — 아르곤 1건(반영 1: 은퇴 앱 메모 수정) · Fable 3건(반영 3: 휴대폰 토글·후보 CSS 줄끝·공개 기준 커밋), 재현되는 P0·P1 0(검수 폴더 공용 작업본 `.tmp/검수/library-modules-live-20261022/`).
8. 공개 — synk-policy `d1bd982`(공개 주소 바이트 3/3 같음, 배포 점검 39766397637 통과). 공개 뒤 실제 주소의 로그인 전 흐름도 새 안내·오류 0.

## 쓰는 법

git 밖 의존성(esbuild·acorn·eslint-scope)은 이 PC 공용 작업본의 `experiences/synk-account/node_modules`·`영상/node_modules`, Playwright는 Codex 런타임에서 찾는다. 원천은 이 도구가 놓인 저장소의 작업본이다 — 공용 작업본에서 돌리면 남의 미커밋이 후보에 실릴 수 있으니 origin/master 워크트리에서 돌린다.

```bash
node patch-live.cjs 받기 <폴더>                 # synk-policy origin/main의 공개본 넷(묶음·페이지·CSS·/try/ 자료 사본)
node patch-live.cjs 옛판 <폴더>                 # 옛 판을 되살려(<폴더>/old-src) 바이트 대조 — 같지 않으면 1
node patch-live.cjs 후보 <폴더> <후보 폴더>      # 후보 셋 + patch-report.json — 이름 겹침·빠짐·새 전역이 있으면 1
node run-tests.cjs <후보 폴더>                  # 후보 바이트로 master 시험 — 원천보다 더 실패하면 1
node check-live.cjs <폴더> <후보 폴더> <캡처 폴더>   # 실제 주소 연결·로그인 뒤 캡처
```

공개는 `node tools/공개.js 올리기 account/dist/platform.js=<후보>/account__dist__platform.js account/platform.html=<후보>/account__platform.html account/src/platform-library.css=<후보>/account__src__platform-library.css --기준 <받은 커밋>`(미리 보기 → `--실행 --계획`).
