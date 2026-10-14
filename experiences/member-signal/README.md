# 회원 혜택 앱 · 싱ㅋ 시그널 공통 틀

> 2026-10-14 유호님 「싱크 플렛폼에 무료혜택 하나하나 들어가서 기능들 빠진거 많거든? GPT로 만들어놨는데 매우 조잡하고 잘 못만든것같아. 프론트든 기능이든 전부 리디자인해도 좋으니 제대로 만들어줘볼래?」 → 플랫폼 회원 혜택에서 들어가는 네 앱(무료 운세·플레저·중요한 대화 리허설·가족 이야기 앨범)을 플랫폼과 같은 시그널 화면으로 다시 짜고 기능을 채웠다. 근거는 [벤치마킹 조사](조사_20261014.md).

## 이 폴더

| 파일 | 하는 일 |
|---|---|
| `signal.css` | 토큰(밤 기본·낮·기기 설정, 앱별 사업 색 `.app-fortune|care|rehearsal|album`) · 틀(책상 위 판 `.board`, 유리 캡슐 `.bar`, 휴대폰 아래 탭 `.tabbar`) · 포스터(`.poster` + 펠트 누끼 `.cut`·흰 인화지 `.print`, `.low`·`.wide`·`.band`) · 단추(흰 알약 `.btn.primary` 화면당 하나, 선 알약 `.soft`) · 선택(`.opt`·`.chip`·`.seg`, 고르면 바탕 뒤집기) · 계기판 `.meta` · 카드·입력·목록·안내 상자·판(`.sheet`)·알림(`.toast`) · 계정 수첩(`.account-notebook`)을 판 안에서 시그널로 |
| `signal.mjs` | `initTheme`·`cycleTheme`(웹 플랫폼과 같은 `localStorage synk.platform.theme`), `esc`·`keepDots`(「·」 덩어리 줄바꿈 막기), `poster`·`secHead`·`level`(다섯 칸 기운)·`icon`(24px 1.8선 SVG), `createToast`·`createSheet`(Esc·바탕 누르기·초점 돌려주기), `seoulDate`·`dayLabel`·`stampLabel` |
| `theme.js` | 그리기 전에 테마를 입히는 고전 스크립트(인라인 스크립트를 막는 CSP 때문에 파일) |
| `serve.mjs` | 로컬 앱 서버가 `/member-signal/…`을 내주는 허용 목록 |
| `assets/` | SUIT Variable·Inter Tight(SYNK Latin)·DM Mono·SYNK Arrow 글꼴과 라이선스, 로고, 포스터 그레인 |

공개 빌드는 `tools/lib/member-signal-public.mjs`가 같은 파일을 앱 폴더 안 `signal/`에 상대 경로로 싣는다(`tools/prepare-personal-public.mjs` 운세·리허설, `tools/prepare-care-public.mjs` 플레저).

## 규칙(플랫폼 시그널 README와 같은 손)

- 앱마다 사업 색 하나: 운세 팝 `#E05C97`, 플레저 청금석 `#3D6BC9`, 리허설 코랄 `#F96859`, 앨범 버터 `#F5C445`(플랫폼 `.benefit-<id>`와 같은 값).
- 포스터 주인공은 그 화면 내용을 설명하는 펠트 물건 하나, 화면마다 다르게. 정본 `docs/Loom_자산/구움`의 누끼를 `assets/art/`(앱 폴더)로 오려 썼다. 운세: 별똥별·해·달력·하트·폭죽·별 / 플레저: 메모·편지·저금통 / 리허설: 연단(인화지)·말풍선·따옴표·생각 구름·트로피·도장 / 앨범: 카메라·물음표·액자·책·마이크.
- 글자: 큰 제목 680 · 카드 제목 650 · 강조 600 · 라벨 550 · 본문 450(포스터 큰 한글만 900), 한글 13px 이상, 영문 모노 라벨 11.5px .08em, 카드 왼쪽 색 막대 없음.
- 스스로 움직이는 효과 없음. 녹음 중 표시도 깜빡임 대신 사업 색 단추 + 글자.
- 점수를 진단처럼 보이지 않게 숫자 대신 다섯 칸(`level`).

## 확인

각 앱 서버(`node experiences/<앱>/server.mjs`, 포트 4296 플레저 · 4297 리허설 · 4298 앨범 · 4299 운세)를 띄우고 1280·390px에서 흐름을 눌러 본다. 공개 빌드 시험: `node --test tests/prepare-personal-public.test.mjs experiences/relationship-care/tests/public-build.test.mjs`.
