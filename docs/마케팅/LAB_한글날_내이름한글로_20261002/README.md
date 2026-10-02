# LAB · 한글날 「이 이름 누구일까요?」 · 몽골어 22초 (v2 검토본 · 서현 목소리)

2026-10-02 · [제작 방식 v2](../콘텐츠_제작방식_v2_20261002.md)로 만든 첫 편. 페이스북 synkworld와 인스타 @synk.mn에 같은 영상을 올린다. 게시는 유호님 승인 뒤.

- 무엇: 한글로 쓴 몽골 이름 맞히기 두 판(홀란 → Хулан, 뭉흐 → Мөнх) → 몽골어 о·у는 ㅗ, ө·ү는 ㅜ로 합쳐진다 → 실제 synk.im/name에 「Хулан」을 한 글자씩 → 홀란·다른 표기 홀랑·펠트 이름 카드 → 「내 이름 써 보기」
- v2(10-03): 화면은 v1 그대로 두고 Typecast 서현 목소리 9줄을 넣었다. 화면의 한국어 문장·스티커와 같은 순간에 같은 말을 한다. 대사표는 [원고.md](원고.md#목소리서현-대사표).
- 원고·장면표·근거: [원고.md](원고.md) · 브리프: [BRIEF.md](BRIEF.md) · 게시 묶음: [게시/](게시/게시_체크리스트.md)
- 검토본: `renders/SYNK_LAB_한글날_내이름한글로_MN_v2.mp4`(git 제외, 바탕화면 사본 있음). v1(목소리 없음, 21초)도 같은 폴더에 둔다.

## 파일

| 위치 | 담당 |
|---|---|
| `index.html` | 컴포지션(HyperFrames 0.8.111, 1080×1920·30fps·22초). 키트 `lab` 테마·모션 프리셋 |
| `녹화_도구화면.cjs` | 실제 synk.im/name 을 휴대폰 크기(390×844@3)로 찍는다. 결과 `assets/media/tool/*.png`(원본, git 제외)와 `녹화기록.json`(입력·결과·요소 위치) |
| `assets/media/tool/*.webp` | 영상에 쓰는 화면 사진(PNG 원본을 WebP 92로 줄임 — 10초 불러오기 제한 때문) · `felt_card_hulan.webp`는 카드 화면을 잘라낸 실제 결과 |
| `assets/media/sound/` | LAB 음악(`../LAB표현소개_아맞다_20260927/음악/lyria3_b.mp3` 사본), 브랜드 사운드킷 사본, 사인 틱 둘(`tick_e7.wav`·`key_c7.wav`, ffmpeg로 생성) |
| `음성/voice-plan.json` | 서현 대사 9줄 — 문장·감정·빠르기와 `cue`(첫 말소리가 들릴 영상 시각) |
| `음성/voice-connection.cjs` | 유호님이 기존 Typecast API 키를 붙여 넣는 로컬 연결 화면(http://127.0.0.1:5212). 키는 메모리에만 2시간, 결제·충전 기능 없음 |
| `음성/audio/` | 생성된 대사 `<id>.wav`와 낱말 시각 `<id>.json`(키는 담지 않는다) |
| `음성/넣기.cjs` | 파일 앞 무음을 재서 `data-start = cue − 앞 무음`으로 `index.html`에 대사를 넣는다. 겹침·간격 검사 |
| `assets/synk-kit/` | 키트 사본(git 제외). `node tools/SNS키트_영상연결.js <이 폴더>`로 다시 넣는다 |
| `beats/` | 음악 박자 측정 결과(`npx hyperframes beats .`) |

## 다시 만들기

```bash
node tools/SNS키트_영상연결.js "docs/마케팅/LAB_한글날_내이름한글로_20261002"
node "docs/마케팅/LAB_한글날_내이름한글로_20261002/녹화_도구화면.cjs"
```

화면 사진을 다시 찍었으면 PNG → WebP 변환(`ffmpeg -i X.png -c:v libwebp -quality 92 X.webp`)과 카드 자르기(`crop=888:1110:141:360`)를 다시 한다.

목소리를 다시 만들 때(폴더 안에서):

1. `node 음성/voice-connection.cjs`를 켜고 유호님이 http://127.0.0.1:5212 에 Typecast API 키를 붙여 넣는다. 구글 로그인은 앱 안 브라우저에서 팝업이 막히니 평소 크롬에서 연다.
2. 대사마다 `curl -X POST http://127.0.0.1:5212/generate -H "Content-Type: application/json" -d '{"id":"q1"}'`(다시 만들 때는 `"force":true`).
3. `node 음성/넣기.cjs` — 경고가 없어야 한다. 시각을 바꾸려면 `voice-plan.json`의 `cue`만 고친다.
4. 음악 비켜 주기(carve)를 다시 쓴다. `@hyperframes/core@0.8.111`이 깔린 폴더를 `--core`로 준다(저장소에는 깔지 않는다).

```bash
node <hyperframes-audio 스킬>/scripts/carve.mjs --comp index.html --bed music --voice vo-q1 --voice vo-ans1 --voice vo-q2 --voice vo-ans2 --voice vo-why --voice vo-try --voice vo-tada --voice vo-card --voice vo-cta --strength 0.6 --core <@hyperframes/core 설치 폴더>
```

세기 0.6은 음악을 살리려고 고른 값이다(기본 0.8은 말할 때 음악을 최대 19dB까지 낮춘다). 음악이 너무 작게 들리면 0.5, 목소리가 묻히면 0.8로 다시 돌린다. 그다음:

```bash
npx --yes hyperframes@0.8.111 check
npx --yes hyperframes@0.8.111 render --quality delivery -o renders/SYNK_LAB_한글날_내이름한글로_MN_v2.mp4
```

## 확인한 것

- v1: `hyperframes check` 통과(오류 0). 남은 경고: 실땀 전환 중 두 장면 글자 겹침(전환 동안만), 같은 로고 그림 두 번, 키트 형광펜 밑줄의 z-index(화면에서 밑줄이 보이는 것을 스냅숏으로 확인). 14개 시점 스냅숏(`snapshots/`)으로 표지·정답·모음 표·실제 화면·카드·끝 장을 눈으로 봤다. 변환 결과는 공개 페이지와 같은 코드(`convert()`)로 확인했다(공개본과 저장소 원본 sha256 일치).
- v2: 아래 「v2 소리 확인」.

## v2 소리 확인(10-03)

- 생성: Typecast `ssfm-v30` 서현으로 9줄, 대사 111자(스마트 감정 문맥 포함 131자). 유호님이 결제해 둔 API Lite 월 크레딧 안에서 만들었고 결제·충전은 없다.
- 배치: `음성/넣기.cjs`의 겹침·간격 경고 0. 말 시작은 화면의 같은 문장·스티커가 나오는 순간이다([대사표](원고.md#목소리서현-대사표)).
- 음악: carve 0.6(목소리 대역 160·250·1000·1600·2500Hz를 말을 따라 −5.8~−11.6dB)과 duck(말할 때 −8dB, 말 사이에는 복귀). 말 없는 6.97~8.64초에서 음악 크기는 v1과 0.5dB 차이다. carve 기본 크기 맞춤만 쓴 첫 렌더는 22초 내내 음악이 약 −13dB로 눌려 있어 버렸다.
- 완성본: 1080×1920·30fps·22.0초, −15.1 LUFS, 최고 −1.6dBFS(v1 −15.5 LUFS). `hyperframes check` 통과(v1과 같은 경고 3).
- 받아쓰기: 로컬 faster-whisper `large-v3-turbo`로 완성본(음악·효과음 포함)을 받아써 9줄 모두 원고와 일치했다(낱말 확률 0.81~1.0).
- 장면: 0.3·2.45·5.75·9.6·13.6·15.3·18.6·19.9초 화면을 뽑아 「정답!」「딩동댕!」「짜잔!」 스티커와 자막이 목소리와 함께 나오는 것을 봤다.
- 귀로 듣는 확인(목소리 말투, 음악과의 균형)은 유호님 몫이다.

## 남은 것

- 유호님 시청·청취와 게시 승인. 몽골어 문장 원어민 확인(도구 페이지 표현을 최대한 그대로 썼다).
- 게시할 때 AI 표시 켜기(서현 목소리), 인스타 프로필 링크에 synk.im/name 추가(게시 체크리스트).
