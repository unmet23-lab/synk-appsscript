# PULSE 고객 앱 글꼴 · 글자 조각

`python -X utf8 tools/build-pulse-fonts.py`가 만든다(2026-11-11, 첫 방문 무게 줄이기). 결과는 고객 앱 폴더 `docs/마케팅/온라인마케팅지도/engagement/company/public/pulse-app/assets/`에 바로 쓰고, 이 폴더에는 범위 · 크기 기록 `fonts.json`만 둔다. 고객 앱 `film.css`의 글꼴 선언(「글꼴 조각 시작 — 끝」 사이)과 범위도 도구가 맞춘다. 같은 입력이면 같은 바이트다.

**고객 앱 화면 글(pulse-app 모듈의 문자열 · 템플릿 글, index.html)을 바꾸면 다시 돌린다.** 올릴 때는 바로올리기의 짝 검사 「PULSE 글꼴 조각」이 push 전에 같은 시험을 돌려, 새 음절이 있으면 이 명령으로 고치라고 막는다(2026-11-11). 안 돌리면 새 글자 때문에 첫 화면에서 나머지 조각(약 450KB)까지 받는다(글자는 그대로 같은 글꼴로 나온다). 회사 폴더 시험 `pulse-first-load.test.mjs`가 화면 원문 음절이 나머지 범위에 들어가면 알린다. 「화면 원문」(주석을 뺀 문자열 · 템플릿 글)은 도구와 시험이 같은 훑개 `company/pulse-ui-text.mjs`로 센다 — 회사 이미지는 npm 패키지 없이 `company/*.mjs`만 싣어 구문 분석 패키지를 쓰지 않고, acorn과 같은 글을 내는지는 저장소 바닥 `tests/pulse-ui-text.test.mjs`가 실제 파일로 대조한다.

| 파일 | 원본 | 내용 | 크기 |
|---|---|---|---|
| `SYNKSans-pulse-latin.woff2` | SUIT Variable(`../SUIT/SUIT-Variable.woff2`) | 한글 음절이 아닌 모든 글자(라틴 · 숫자 · 문장부호 · 기호 · 자모). SUIT의 자간(kern)은 라틴 63자에만 있어 한 조각에 모았다 | 44.6KB |
| `SYNKSans-pulse-first.woff2` | 같은 원본 | 첫 HTML(본문으로 건너뛰기 · 불러오는 글 · 끊김 알림), 언어를 정하기 전 첫 render()의 머리 단추(「앱 설치」 · 「제작자 공간 ↗」), 언어 메뉴 「한국어」의 음절 58자. 영어 화면은 latin과 이 조각만 받는다 | 15.4KB |
| `SYNKSans-pulse-ui.woff2` | 같은 원본 | 고객 앱 화면 원문(주석 제외)의 나머지 음절(11-11 밤 669자 — 화면 글이 바뀌면 달라진다, 지금 값은 `fonts.json`) | 약 148KB |
| `SYNKSans-pulse-rest.woff2` | 같은 원본 | 그 밖의 음절. 손님이 쓴 글처럼 화면 원문에 없는 글자가 나올 때, 또는 한국어 화면에서 손님이 글 칸에 들어올 때 받는다 | 461.2KB |
| `NotoSerifKR-300-sym.woff2` | 앱 폴더 `NotoSerifKR-300.woff2`(KS X 1001 2,350자로 줄인 판, 원문 Windows `NotoSerifKR-VF.ttf`) | 한글 음절이 아닌 글자 | 7.7KB |
| `NotoSerifKR-300-ui.woff2` | 같은 원본 | 화면 원문의 음절 | 105.7KB |
| `NotoSerifKR-300-rest.woff2` | 같은 원본 | 그 밖의 음절(손님 글이 제목 · 준제목에 나올 때) | 225.2KB |

이전에는 SUIT Variable 전체(610KB)와 명조(292KB)를 첫 화면에서 미리 받았다(`index.html` preload). 지금 첫 방문이 받는 글꼴은 영어 화면 약 60KB(+ 숫자용 DM Mono 27KB), 한국어 화면 약 321KB다. 글자 모양 · 굵기 축(가변 wght 100–900) · 자간은 원본 그대로다.

범위의 규칙: CSS는 뒤에 선언한 면을 먼저 본다(CSS Fonts 4 §4.5)라 rest → ui → first → latin 차례로 선언한다. 범위가 겹치면 앞 조각을 받는 동안 크롬이 뒤 조각까지 받으므로(플랫폼 판과 같은 실측, [플랫폼 웹](../플랫폼_웹/README.md)), rest 범위에는 ui · first 글자와 원본에 없는 화면 음절(「웻」처럼 KS X 1001 밖)을 넣지 않는다. ui 범위는 한글 음절 칸을 통째로(first 글자만 빼고) 잡아 목록을 짧게 했다 — ui에 없는 음절은 ui에서 글자를 못 찾고 rest로 넘어간다.

통째 파일 `SUIT.woff2`(직원 화면 `app.css`의 `SUIT Variable`)와 `NotoSerifKR-300.woff2`(도구의 원본 · 옛 탭)는 그대로 두고 서버도 계속 내보낸다. 서비스 워커는 첫 화면이 쓰는 조각만 미리 받고, 통째 파일 · 나머지 조각은 받을 때 담는다(`sw.js` RUNTIME).

라이선스: 모두 SIL Open Font License 1.1. SUIT의 OFL은 예약 이름(Reserved Font Name) SUIT가 있어, 줄인 수정본의 글꼴 이름을 SYNK Sans로 바꿨다(저작권 «Copyright © 2022 Sun.»·라이선스 문구·주소는 그대로) — CSS 글꼴 이름도 `'SYNK Sans'`다. Noto Serif KR의 OFL에는 예약 이름이 없다. 원본 라이선스 전문은 각 원본 글꼴 폴더에 있다.
