# LAB · 한글날 「이 이름 누구일까요?」 · 몽골어 21초 (v1 검토본)

2026-10-02 · [제작 방식 v2](../콘텐츠_제작방식_v2_20261002.md)로 만든 첫 편. 페이스북 synkworld와 인스타 @synk.mn에 같은 영상을 올린다. 게시는 유호님 승인 뒤.

- 무엇: 한글로 쓴 몽골 이름 맞히기 두 판(홀란 → Хулан, 뭉흐 → Мөнх) → 몽골어 о·у는 ㅗ, ө·ү는 ㅜ로 합쳐진다 → 실제 synk.im/name에 「Хулан」을 한 글자씩 → 홀란·다른 표기 홀랑·펠트 이름 카드 → 「내 이름 써 보기」
- 원고·장면표·근거: [원고.md](원고.md) · 브리프: [BRIEF.md](BRIEF.md) · 게시 묶음: [게시/](게시/게시_체크리스트.md)
- 검토본: `renders/SYNK_LAB_한글날_내이름한글로_MN_v1.mp4`(git 제외, 바탕화면 사본 있음)

## 파일

| 위치 | 담당 |
|---|---|
| `index.html` | 컴포지션(HyperFrames 0.8.111, 1080×1920·30fps·21초). 키트 `lab` 테마·모션 프리셋 |
| `녹화_도구화면.cjs` | 실제 synk.im/name 을 휴대폰 크기(390×844@3)로 찍는다. 결과 `assets/media/tool/*.png`(원본, git 제외)와 `녹화기록.json`(입력·결과·요소 위치) |
| `assets/media/tool/*.webp` | 영상에 쓰는 화면 사진(PNG 원본을 WebP 92로 줄임 — 10초 불러오기 제한 때문) · `felt_card_hulan.webp`는 카드 화면을 잘라낸 실제 결과 |
| `assets/media/sound/` | LAB 음악(`../LAB표현소개_아맞다_20260927/음악/lyria3_b.mp3` 사본), 브랜드 사운드킷 사본, 사인 틱 둘(`tick_e7.wav`·`key_c7.wav`, ffmpeg로 생성) |
| `assets/synk-kit/` | 키트 사본(git 제외). `node tools/SNS키트_영상연결.js <이 폴더>`로 다시 넣는다 |
| `beats/` | 음악 박자 측정 결과(`npx hyperframes beats .`) |

## 다시 만들기

```bash
node tools/SNS키트_영상연결.js "docs/마케팅/LAB_한글날_내이름한글로_20261002"
node "docs/마케팅/LAB_한글날_내이름한글로_20261002/녹화_도구화면.cjs"
```

화면 사진을 다시 찍었으면 PNG → WebP 변환(`ffmpeg -i X.png -c:v libwebp -quality 92 X.webp`)과 카드 자르기(`crop=888:1110:141:360`)를 다시 한다. 그다음 폴더 안에서:

```bash
npx --yes hyperframes@0.8.111 check
npx --yes hyperframes@0.8.111 render --quality delivery -o renders/SYNK_LAB_한글날_내이름한글로_MN_v1.mp4
```

## 확인한 것

- `hyperframes check` 통과(오류 0). 남은 경고: 실땀 전환 중 두 장면 글자 겹침(전환 동안만), 같은 로고 그림 두 번, 키트 형광펜 밑줄의 z-index(화면에서 밑줄이 보이는 것을 스냅숏으로 확인).
- 14개 시점 스냅숏(`snapshots/`)으로 표지·정답·모음 표·실제 화면·카드·끝 장을 눈으로 봤다. 끝 장의 카드가 바닥 로고에 닿던 것을 고쳤다.
- 변환 결과는 공개 페이지와 같은 코드(`convert()`)로 확인했다(공개본과 저장소 원본 sha256 일치).

## 남은 것

- 유호님 시청·청취와 게시 승인. 몽골어 문장 원어민 확인(도구 페이지 표현을 최대한 그대로 썼다).
- 인스타 프로필 링크에 synk.im/name 추가(게시 체크리스트).
