# 웹 플랫폼 글꼴 · 웹용 판

`python -X utf8 tools/build-platform-fonts.py`가 만들고, `tools/build-synk-account.js`가 `experiences/synk-account/assets/`로 같은 이름으로 내보낸다(공개 `synk.im/account/assets/`). 플랫폼 `platform.css`의 글꼴 선언과 범위도 도구가 맞춘다. 같은 입력이면 같은 바이트다. **플랫폼 화면 글(`experiences/synk-account/src`·html)을 바꾸면 다시 돌린다.** 안 돌리면 새 글자 때문에 첫 화면에서 나머지판(약 500KB)까지 받는다(글자는 그대로 같은 글꼴로 나온다).

| 파일 | 원본 | 내용 |
|---|---|---|
| `SYNKSans-ui.woff2` | SUIT Variable(`experiences/learning-hub/assets/SUIT-Variable.woff2`) | 플랫폼 원문(html·css·src)과 기본 라틴·문장부호에 나오는 글자 |
| `SYNKSans-rest.woff2` | 같은 원본 | 그 밖의 글자. 사용자 이름·작품 제목처럼 화면판에 없는 글자가 나올 때만 받는다 |
| `SYNKArrow.woff2` | `../InterTight/InterTight-Medium.ttf` | 화살표 네 글자(U+2190-2193)만. SUIT의 →가 꺾쇠처럼 보여 따로 쓰는 면이다 |
| `InterTight-Regular.woff2`·`InterTight-Medium.woff2` | `../InterTight/*.ttf` | 글자·힌팅 그대로 형식만 WOFF2 |
| `DMMono-Medium.woff2` | `../DM_Mono/DMMono-Medium.ttf` | CSS 범위(U+0021-007E, U+00A0-00FF, U+2010-2027, U+2190-21FF)만 |

라이선스: 모두 SIL Open Font License 1.1. SUIT의 OFL은 예약 이름(Reserved Font Name) SUIT가 있어, 줄인 수정본의 글꼴 이름을 SYNK Sans로 바꿨다(저작권 «Copyright © 2022 Sun.»·라이선스 문구·주소는 그대로). Inter Tight·DM Mono의 OFL에는 예약 이름이 없다. 원본 라이선스 전문은 각 원본 글꼴 폴더에 있다.

나머지판 CSS 범위에는 화면판 글자를 넣지 않는다(겹치면 화면판을 받는 동안 크롬이 나머지판까지 받는다). 화면판 범위는 한글 음절 칸을 통째로 잡아 목록을 짧게 했다 — 화면판에 없는 음절은 화면판에서 글자를 못 찾고 나머지판으로 넘어간다. 같은 방식을 쓴 PATH 면접실의 검증은 `experiences/path-vr/qa/optimize-20261013/README.md`에 있다.
