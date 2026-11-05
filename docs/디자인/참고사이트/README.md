# 디자인 참고 사이트 장부

> 2026-11-06 처음 씀 · 마지막 크롤링 2026-11-06 · 유호님 「새로운 디자인사이트들 저장해두면 디자인참고할때 매번 들어가지않아도되니까 잘 기억해줘」

화면 · 웹 · 앱 디자인을 시작할 때 **이 장부터 연다**. 여기 있는 사이트는 다시 열지 않고 아래 실측과 「가져올 것」을 쓴다. 「마지막 크롤링」 날짜 뒤에 올라온 것만 새로 받고, 받은 날 이 장의 숫자와 날짜를 고친다. 최신 트렌디 사이트의 평균이 슬롭을 막는 바닥이다([DESIGN](../../../DESIGN.md) 맨 위 「모든 화면이 우리 포트폴리오다」).

- **남의 화면은 저장소에 넣지 않는다**(공개 저장소). 캡처 · 받은 목록 · 다시 재는 스크립트는 저장소 밖 `C:/Users/q1212/Documents/SYNK-보관함/조사/디자인참고_20261106/`에 있다 — `sheet-*.jpg`(한눈 판), `shots/`(사이트마다 1440×900 첫 화면), `m-*.json`(실측), `recent/`·`awwwards/`·`cosmos/`(목록).
- **원리만 가져온다.** 남의 화면을 그대로 옮기지 않고 SYNK 색 · 서체 · 펠트로 다시 짓는다.
- **새 사이트가 생기면** — 유호님이 헤르메스로 보낸 디자인 사이트는 [참고 카드](../../참고카드/README.md)에 먼저 쌓인다. 다음 디자인 작업을 시작할 때 이 장의 날짜 뒤에 생긴 「디자인 참고」 카드를 보고, 웹 · 앱 화면에 쓸 사이트면 아래 1절 표에 한 줄 더한다.

## 1. 유호님이 보낸 사이트 — 가장 먼저 본다

헤르메스로 보내 주신 것(팁 장부 행 번호). 11-06 실측은 1440×900 첫 화면의 가장 큰 글(제목)이다.

| 사이트 | 주소 | 장부 | 11-06 제목 실측 | 볼 때 | 가져올 것 |
|---|---|---|---|---|---|
| Linear | linear.app | 13행 | Inter Variable 64px · 510 · −0.022em · 검정 바탕 | 도구 · 작업 화면 | 첫 화면이 곧 제품 화면. 색은 결정 단추에만, 바뀐 것만 보여 주는 검토 |
| Nothing | nothing.tech | 13행 | NType82 48px · 400 · 0 · 흰 바탕 | 상태 · 숫자 표시 | 숫자 · 상태를 문장 속 알약으로. 점 글자 시계 |
| Ramp | ramp.com | 13행 | Lausanne 64px · 400 · 0 · 흰 바탕 | 돈 · 대조 화면 | 가장 지루한 확인을 화면이 대신. 큰 숫자 하나 + 연두 하나 |
| Motion | motion.dev | 7행 | TASA Orbiter 35px · 700 · 검정 | 전환 · 움직임 | 「Doors」 문 열림 전환(면 색이 다음 화면 강조색) |
| Anime.js | animejs.com | 7행 | DIN 40px · 800 · 검정 | 움직임 | 원형 다이얼 안 변형 · 3D 선 |
| Kokonut UI | kokonutui.com | 7행 | Geist 124px · 600 · −0.06em · 흰 바탕 | 부품 | 큰 제목 + 실제 부품을 첫 화면에 늘어놓기(링 게이지 · 밀어서 결제) |
| Bklit UI | ui.bklit.com | 7행 | calSans 60px · 700 · 흰 바탕 | 그래프 | 빗금 도넛 · 여러 겹 고리(우리 [그래프 문법](../그래프_문법.md)과 같은 쪽) |
| Paper | paper.design | 23행 | Matter 48px · **360** · −0.02em · 미색 바탕 | 도구 · 첫 화면 | 가는 제목 + 회색 둘째 줄, 아래에 실제 캔버스. Paper Shaders(Apache-2.0)의 유리 · 금속 |
| Liquid Glass JS | github.com/dashersw/liquid-glass-js | 23행 | — | 유리 | 유리 가장자리 굴절 = 두께(카드 2026-10-21) |
| Cosmos | cosmos.so | 14행 | cosmosOracle 72px · 700 · 흰 바탕 | 결 모으기 | 한 장에서 「비슷한 것」으로 번지는 캔버스, AI 그림 숨기기. 아래 2절 수집 |
| wearebrand | wearebrand.io (UNKNOWN 상점) | 44 · 45행 | 11-06 첫 화면이 「일시적으로 사용할 수 없음」, `unknown.wearebrand.io`는 주소가 안 풀림 — 카드의 화면 실측을 쓴다 | 상점 · 목록 | 격자 카드 대신 옷걸이 봉 하나가 곧 가게, 고른 것만 크게 |
| Cosign | (투표 커뮤니티) | 13행 | cosign.com은 도메인 판매 화면 — 출처 순위 원본은 못 봄 | — | Linear · Nothing · Ramp를 고른 「tasteful 테크 회사」 투표의 출처로만 |

## 2. 인기 숫자가 있는 큐레이션

| 곳 | 받는 법(로그인 없음) | 11-06 받은 양 | 신호 |
|---|---|---|---|
| Recent(옛 Godly) | `POST api.recent.design/rpc/items/list`, 본문 `{"json":{"feed":"x","format":"tweet","category":"web|interface|branding","sort":"recent|popular","limit":20}}` · `nextCursor` 끝까지. `sort`는 `recent` · `popular`(「latest」는 400). Websites 피드는 `format:"site"`(99개, 7월에 멈춤) — 현장 노트 [시험 · 화면 확인](../../현장노트/시험_화면확인.md) 「Recent 목록 화면을…」 | web 150 · interface 300 · branding 111(겹침 빼고 561, 6/11~11/05) | 열람(`stats.opens`) · 노출 · 태그(style · color · interaction) |
| Awwwards 오늘의 사이트 | `/websites/sites_of_the_day/?page=1·2` → `/sites/<slug>`의 `toolbar-bts__item` 주소 · 「Site of the Day - 날짜」 · 색 | 62곳(9/05~11/05) 모두 실측 | 심사위원 선정. 실제 사이트를 열어 글자를 잰다 |
| Cosmos | GraphQL `SearchGlobalClusters` → `GetClusterElements`(현장 노트 [수집](../../현장노트/수집_yt-dlp.md) 「Cosmos 공개 컬렉션은…」) | 컬렉션 1,969 찾음 → 팔로워 순 140개 · 엘리먼트 21,209(웹사이트 1,671) | 컬렉션 팔로워 · 여러 컬렉션 겹쳐 저장 · 저장 날짜. 웹사이트보다 그림이 많아 결 모으기에 쓴다 |
| Typewolf | typewolf.com 첫 화면 「Site of the Day」 | — | **2025-12-14에서 멈춤.** 글꼴 짝(세리프 + 산세리프) 참고로만 |
| Fonts In Use | fontsinuse.com | — | Cosmos 9월 뒤 저장에서 가장 자주 나온 글꼴 사례 사이트(3회) |
| 그 밖에 Cosmos 저장에서 나온 큐레이션 | bestdesignsonx.com · designstudios.cc · layers.to · interfacecraft.dev · wise.design(디자인 체계) · abcdinamo.com(글꼴 회사) | — | 다음 크롤링 때 목록 꼴부터 본다 |

같은 날 워크스페이스 새 판 조사가 업무 제품 사이트(Vercel · Raycast · Superhuman · Notion · Figma · Apple · Slack · Cursor)의 글자 단계와 업무 메신저 13개 앱스토어 평점 · 리뷰를 따로 쟀다 — 워크스페이스 조사 `docs/디자인/워크스페이스_시그널/조사_20261106.md` 3 · 4절(그 세션이 올리는 중). 결론이 이 장과 같다(크기 5~8단계, 굵기 둘~셋, 큰 제목은 굵게가 아니라 크게 400~600).

## 3. 한글 글자 견줌

외국 사이트 평균만 보면 한글 화면의 굵기 · 자간을 그대로 옮기기 쉽다. 한글은 국내 서비스와 같이 본다.

| 사이트 | 11-06 제목 실측 | 첫 화면 글 덩어리 중 영문 대문자 꼬리표 |
|---|---|---|
| 토스 toss.im | Toss Product Sans 80px · 700 · 자간 0 · 줄 1.2, 사진 한 장 꽉 | 9개 중 1개(언어 바꾸기 「KOR」) |
| 당근 about.daangn.com | Karrot Sans 64px · 700 · 0 · 줄 1.31, 흰 바탕 + 큰 사진 | 5개 중 0개 |
| 29CM | 29CM Editorial 40px · 700 · 0, 편집 사진 격자 | 영문 메뉴가 많은 편(상점) |
| 토스 테크 toss.tech | Toss Product Sans 36px · 700 · 0 · 줄 1.35, 본문 17px · 줄 1.6 | 24개 중 0개 |

## 4. 2026-11-06 평균 — 슬롭을 막는 바닥

- **제목 굵기:** Awwwards 62곳 중 28px 넘는 제목 40개의 굵기 중앙값 **400**(400이 23개, 700 넘는 것은 7개). 1절 제품 사이트 아홉의 중앙값 600, 한글 서비스 넷은 모두 700. **900은 Awwwards 한 곳뿐**이다.
- **제목 자간:** Awwwards 중앙값 −0.006em(거의 0), 한글 서비스 넷 모두 0. 줄 간격은 1.0.
- **제목 크기:** Awwwards 중앙값 80px(폭의 5.6%).
- **본문:** 14px · 굵기 400(Awwwards 중앙값). 한글 본문은 17px · 줄 1.6(토스 테크).
- **바탕:** Awwwards 밝은 바탕 52%. Recent 10월 뒤 열람 가중 Light 51% · Dark 36%.
- **단추 모서리:** Awwwards 첫 화면 단추 83개 중 각진 0px 31 · 알약 28 · 1~8px 22 · **9~20px 2**. 「반쯤 둥근」 14~22px 상자는 거의 안 쓴다.
- **모노 글꼴:** 62곳 중 12곳에만 있다. 있어도 숫자 · 코드 · 작은 꼬리표다.
- **세리프 제목:** 40곳 중 6곳(Emotion Serif · Editorial Old · Times · PP Fragment · Instrument). Recent 상위에도 세리프 제목이 다시 보인다(Sam Cheng · 「Designing artifacts that feel alive」 · Dreamvision).
- **Recent 9/15 뒤 열람 상위 30의 결:** 넓은 흰 여백 위에 실물 같은 물건 하나(명찰 · 줄에 매단 프로필 카드 · 타자기 · 우표 · 영수증 · 레코드판)를 끌고 흔들고 눌러 보게 한다. 제목은 가늘게, 둘째 줄은 회색으로 이어 쓴다(「Meet the people / behind the work.」). 어두운 판은 유리 · 빛 · 홀로그램처럼 특별한 순간에 쓴다.
- **Recent 10월 뒤 태그(열람 가중):** 스타일 Minimal 43% · 3D 28% · Playful 24% · Typographic 19% · Experimental 17%. 인터랙션 Microinteraction 42% · Transitions 32% · Scroll Animation 14% · Drag & Drop 13%.
- **Cosmos 9/15 뒤 UI · 타이포 컬렉션 저장:** 성격 있는 옛 간판 글자(따뜻한 갈색 · 빨강), 밝은 단색 면 위 실물 하나, 제품 화면은 밝고 조용하다.

## 5. 지금 SYNK 화면 실측(11-06, 견줌용)

| 화면 | 제목 | 첫 화면 영문 대문자 꼬리표 | 그 밖 |
|---|---|---|---|
| 웹 플랫폼 synk.im/account/platform.html | SUIT(SYNK Arrow) 74.88px · **900** · **−0.06em** · 줄 0.95 | 글 덩어리 39개 중 9개(PLATFORM · MENU · APPS · WEB · MY LIBRARY · HOME · KOREAN STUDY · ON THE WEB …), 모노 글꼴 14개 | 검정 바탕 · 모서리 14 · 22px 판, 알약 |
| PC 앱 런처 `desktop/renderer/launcher.css` | 굵기 900 · 850 · 800 · 700 · 680 · 650 · 600 · 550 여덟 단계 | 모노 29곳 | 알약(999) 33곳 · 그림자 40곳 · 유리 9곳 |
| 홈페이지 synk.im | SYNK Latin 30px · 760 · −0.035em(첫 화면 주인공은 「싱ㅋ」 큰 그림 글자) | — | 검정 바탕 |

## 6. 다시 재는 법

보관함 폴더의 스크립트를 그 폴더에서 돌린다(Playwright는 저장소 `node_modules`, 브라우저는 설치된 크롬).

- Recent: `node collect.mjs recent/<분류>-recent.json x tweet <web|interface|branding> recent 15` → `node tags.cjs`(열람 가중 태그 · 상위 40).
- Awwwards: `python aw.py`(목록 두 쪽 → 사이트 주소 · 날짜 · 색) → `node measure.mjs sites-aw.json m-aw.json shots` → `python agg.py m-aw.json`.
- 1절 · 3절: `node measure.mjs sites-hermes.json m-hermes.json shots`, 영문 꼬리표 세기는 `node upper.mjs`(한글 덩어리는 대문자로 세지 않는다 — 처음 판은 한글 문장 속 「AI」까지 대문자로 세서 바로잡았다).
- Cosmos: `node cosmos-crawl.mjs all`(낱말은 파일 위 `TERMS`).
