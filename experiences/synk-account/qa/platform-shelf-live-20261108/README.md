# 웹 플랫폼 A 진열대 — 공개 후보 (2026-11-08)

synk.im 웹 플랫폼(`https://synk.im/account/platform.html`)을 [A 진열대](../../../../docs/디자인/플랫폼_시그널/README.md#platform-shelf-20261108)로 바꾸는 공개 후보를 만드는 도구다. 공개는 이 폴더에서 하지 않는다(`tools/공개.js`).

공개본 `account/dist/platform.js`는 master 빌드와 구성이 달라(회원 성향 묶음 `SYNK_MEMBER_INSIGHT_20261014` + 바깥 플랫폼 코드, [현장 노트](../../../../docs/현장노트/배포_공개.md#공개본-accountdistplatformjs를-master-빌드로-덮으면-남의-미공개-기능이-같이-나간다)) 통째로 덮지 않고 이번 판이 바꾼 세 곳만 갈아 끼운다.

| 구역 | 공개본에서 | 새 판 |
|---|---|---|
| P 바깥 플랫폼 코드 | `var $=…getElementById` ~ 끝(`platform.mjs`) | 새 master 빌드의 같은 구역 |
| M 회원 혜택 모듈 | `var esc=…` ~ `function benefitDetail` | 새 빌드의 선반 모듈 두 문장(`shelfItem` · `shelfColumns`) + 혜택 모듈 |
| A 앱 그림 | `image:"sticker-book.webp"` · `image:"laptop-felt.webp"` | `world-annyeong.webp` · `laptop.webp`(글자로, 곳마다 한 번) |
| I 내 성향 보기 | 회원 성향 묶음 안 `member-insight-view`의 영문 꼬리표 셋(CHOSEN · DONE · 30 DAYS) · 머리 기본 글 `"SYNK FOR YOU"` | 빼고 · `"회원 혜택"`(글자로, 묶음 안에서 곳마다 한 번, 새 master 빌드와 맞는지 단언) |

회원 성향 묶음의 일곱 이름(`renderMemberInsight` · `createMemberInsight` …)은 공개본처럼 `SYNK_MEMBER_INSIGHT_20261014.<이름>`으로 부른다.

## 단언(`patch-live.cjs`)

1. **앞 판 대조** — 공개본 P · M을 앞 판 master 빌드(이 판 직전 커밋의 `dist/platform.js`)의 P · M과 공백 · 지역 이름 번호 · `let/const`를 같게 보고 문장마다 견준다. M은 같고, P의 차이는 이유를 아는 넷만 허용한다: ① 로딩 글 「계정을 확인하고 있어요.」(공개본, 10-22 글 전수조사 전) ↔ 「로그인 상태를 확인하고 있어요.」(master) ② `quickCard`의 「내 수업」 입구(master `caf7fa5ce`에만 — 공개본 `platform-home`에도 그 갈래가 없어서, 새 판 `openAction`은 그 입구를 못 만들면 Workspace 길로 연다) ③ PATH 주소 글자 ↔ `PATH_INTERVIEW_URL`(같은 값) ④ 함수 차례 · 괄호 자리. 그 밖의 차이가 하나라도 있으면 멈춘다(공개본에만 있는 고침을 지우지 않게).
2. 새 구역이 선언하는 최상위 이름이 공개본 나머지와 겹치지 않는다. 문장 수 = 공개본 − 옛 P · M + 새 P · M.
3. 선언 없이 부르는 이름(eslint-scope 전역 참조)이 공개본보다 늘지 않는다. 공개본 M이 선언했고 새 M에 없는 이름(옛 포스터 도우미)을 아무도 부르지 않는다.

## 쓰기

```bash
# 공개본 · 앞 판 빌드를 받아 둔다(도구 전용 bare 사본, autocrlf 끄고)
git -C ~/Documents/synk-vendor/synk-policy-publish.git -c core.autocrlf=false archive <공개 커밋> account | tar -x -C <공개본 폴더>
git show <앞 판 커밋>:experiences/synk-account/dist/platform.js > <앞 판 빌드>
node tools/check-account-bundles.js --build                     # 새 master 빌드
node patch-live.cjs <공개본 폴더>/account/dist/platform.js <앞 판 빌드> ../../dist/platform.js <후보 platform.js>
node candidate.cjs <공개본 폴더>/account <후보 platform.js> <후보 폴더>   # 페이지 · CSS · 그림 · 글꼴 · 매니페스트 + files.json
node tools/공개.js 올리기 <files.json의 공개경로=파일 …> --기준 <공개 커밋> --후보폴더 <빈 폴더>   # 미리 보기
```

`candidate.cjs`는 페이지에 공개본에만 있는 가입 추적 줄(`/social-conversion.js`)과 `?v=` 토큰을 옮기고, 뼈대가 통째로 바뀌는 `platform.css` · `theme.js`에도 `?v=`를 단다(캐시 10분 동안 새 페이지와 옛 CSS가 섞이지 않게). 매니페스트는 공개본 그대로에 색 두 칸만 흰 종이로. `member-insight.css`는 이번 판에서 A 문법으로 바꿔 싣는다(토큰도 갱신). `src/platform-library.css`는 공개본과 같아 싣지 않는다.

## 11-08 결과(공개 전)

- 공개본 `d3dcae1` · 앞 판 master `0b808bc9a` 빌드 → 후보 묶음 3,453,415 → 3,457,242B, 문장 262 → 285, 전역 참조 46 = 46, 이름 겹침 0, 내 성향 글자 바꾸기 4곳.
- 후보 폴더(git 밖) `SYNK-보관함/조사/디자인참고_20261106/구현_웹/공개후보/` — 공개본 `account/` 전체에 후보를 얹어 띄운 화면 38장 가운데 36장이 master 작업본 화면과 픽셀까지 같고(나머지 둘은 그림 디코딩 1~2px 차이), 동작 31개 통과(즐겨찾기 · 탭 · 더 보기 · 설정 테마 알약 · Ctrl+K · 컬렉션 · 스크롤 선).
- `공개.js` 미리 보기: 바뀔 파일 16개 · 계획 `8481686c7dc7`(기준 `d3dcae1`, 11-08 제목 크기 맞춘 뒤), import 엇갈림 ①②③ 0, 도구 이름 · 이 PC 경로 걸림 0, 새 blob 4.8MB, 공개 전 점검(후보 · 공개본 로컬 열기) 새 오류 · axe 치명 0.
