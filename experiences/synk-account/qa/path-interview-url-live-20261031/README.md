# 웹 플랫폼 회원 성향 「PATH 열기」 — 공개본에 빠진 상수 선언 한 줄 (2026-10-31)

synk.im 웹 플랫폼(`https://synk.im/account/platform.html`)의 공개 묶음 `account/dist/platform.js`에서, 로그인한 회원이 회원 성향(내 성향) 「고른 관심과 이어지는 앱」의 「PATH 열기」를 누르면 아무 일도 일어나지 않았다. `openInsightActivity`가 선언 없는 전역 `PATH_INTERVIEW_URL`을 써서 `ReferenceError`가 났기 때문이다(synk-policy `12b1a30`부터). master `experiences/synk-account/src/applications.mjs`는 이 상수를 `APPLICATIONS` 바로 앞에서 내보내지만, 공개본 묶음의 applications 모듈은 옛 판이라 선언이 없다. 10-22 계정 라이브러리 모듈을 옮기며 공개본 「선언 없이 쓰는 이름」을 견줄 때 드러났다([10-22 기록](../library-modules-live-20261022/README.md)).

공개본은 10-14~16 다른 AI의 릴리스 빌드 위에 모듈·글을 얹어 온 묶음이라 master로 다시 묶지 않고([현장 노트](../../../../docs/현장노트/배포_공개.md#공개본-accountdistplatformjs를-master-빌드로-덮으면-남의-미공개-기능이-같이-나간다)), esbuild가 master에서 지을 꼴 그대로 한 줄만 같은 자리에 넣었다.

```js
init_core();var PATH_INTERVIEW_URL="https://synk.im/path/interview/film/rehearsal.html";var APPLICATIONS=Object.freeze([…
```

같은 주소는 공개본의 `shortcutDestination`·`launchControls`에 글자로 박혀 있어 그 둘은 원래 열렸다. 회원 성향 갈래만 상수 이름을 썼다.

## 이 폴더

| 파일 | 하는 일 |
|---|---|
| `patch-live.cjs` | `node patch-live.cjs <바탕> <후보>` — 공개본(바탕)에 선언 한 줄을 넣는다. 넣기 전: 이름이 쓰는 자리 한 번만 나오고 선언 없이 쓰이는지, 넣을 자리가 하나인지. 넣은 뒤: 넣은 줄을 빼면 공개본과 바이트가 같은지, 최상위 문장으로 한 번 선언되고 쓰는 함수보다 앞인지, 「선언 없이 쓰는 이름」(eslint-scope, [`live-modules.cjs`](../library-modules-live-20261022/live-modules.cjs) `globalsOf`)에서 이 이름 하나만 빠지고 새로 생긴 이름이 없는지. 페이지 `?v=`도 맞춘다(공개 도구가 다시 맞춘다). 결과 `patch-report.json`. |
| `check-path.cjs` | `node check-path.cjs <후보> <캡처>` — 실제 공개 주소를 시험 계정 없이 열어 회원 성향과 같은 단추(`mi2-ghost mi2-small` · `data-insight-action="activity"` · `data-insight-target="path"`)를 `#page-content`에 넣고 누른다. 그 클릭은 같은 위임 처리기 → `openInsightActivity('path')`로 가고, 웹에서 PATH는 로그인과 상관없이 여는 앱이라(`accountEntryReady` — 공개 입구 표에 path가 없다) 로그인 전 페이지로 같은 갈래를 탄다. 공개본(그대로)과 후보(Playwright로 묶음·페이지만 끼움)를 1440·390에서 견준다. 결과 `check-path.json`. |

바탕 받기는 `node ../library-modules-live-20261022/patch-live.cjs 받기 <폴더>`(synk-policy origin/main 바이트).

## 확인 (10-31, 공개본 synk-policy `21632b4` — 묶음은 `b101b97f` 판, 공개 주소 바이트와 같음)

1. `patch-live.cjs` — 묶음 2,852,025 → 2,852,101B(`?v=` b93eacab6652 → 877cd9a77c02). 최상위 문장 261 → 262(선언 81번째 · `openInsightActivity` 198번째), 전역 참조 47 → 46(빠짐 `PATH_INTERVIEW_URL` 하나 · 새로 0).
2. `check-path.cjs` — 공개본은 1440·390 모두 `ReferenceError: PATH_INTERVIEW_URL is not defined`(처리 안 된 거부)로 새 창이 안 열린다. 후보는 둘 다 오류 0으로 새 창이 `https://synk.im/path/interview/film/rehearsal.html`로 간다.
3. [`compare-live.cjs candidate`](../copy-audit-live-20261022/compare-live.cjs) — 로그인 전 14경로 × 1440·390에서 바뀐 줄 0, 콘솔 오류 0, 가로 넘침 0.
4. 검수 `path-interview-url-live-20261031`(공용 작업본 `.tmp/검수/`) — 아르곤 26묶음 모두 끝까지 읽음, 1건(P2: `check-path.cjs`의 이 PC 전용 Playwright 경로 — 같은 계열 도구와 같은 규칙이라 반영 안 함, Fable도 동의) · Fable 0건. 재현 P0·P1 0.

## 공개 (10-31)

- synk.im — synk-policy `49a6572`(`account/dist/platform.js` 한 줄 + `account/platform.html` `?v=`, 공개 도구가 그사이 올라온 `0890ade` 위에 3방향으로 지음). 공개 주소 바이트 2/2 같음, 배포 점검 41194871729 통과(새 접근성 위반 0 — 기준 그림이 달라진 /builds/·/prompts/·/world/ 게임 둘은 이번에 손대지 않은 쪽이라 기준을 바꾸지 않음).
- 공개 뒤 끼우기 없이 실제 주소에서 `check-path.cjs`: 1440·390 둘 다 오류 0, 새 창이 PATH 면접 연습 주소로 간다.
