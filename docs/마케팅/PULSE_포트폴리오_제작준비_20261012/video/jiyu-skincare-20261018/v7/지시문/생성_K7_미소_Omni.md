# 컷 7 미소 · Flow Omni 1.1 Flash (2026-10-21)

- 유호님(10-21): 「컷 7 미소만 생성해줘 그리고 동영상은 일만 옴니로 해보자」 — 사람 컷 셋 가운데 컷 7만 생성하고, 영상 모델은 Omni로 먼저 해 본다(힉스필드 크레딧 0). 컷 2 · 5는 정지컷 판 그대로.
- 곳: Flow `flow.google.com/u/4/project/5946f1bb-098d-4615-8901-bf1f975fd2fb`(77yuhbs Ultra), ego lite 작업 공간에서 조작(`synk-vendor/…/v7/영상/omni/ego-20261021-1800/round-*.mjs`).
- 설정: 동영상 · 프레임(시작 그림만) · 9:16 · **Omni 1.1 Flash** · 720p · 4초 · x1 — 한 판 7크레딧, 두 판 14. 새 프로젝트의 모델 칸이 처음엔 「Veo 3.1 - Quality」(100크레딧)라 바꾼 뒤 「생성 시 7 크레딧」 · 모델 이름 · 그림 칸 크기(940×1672)를 읽어 맞을 때만 눌렀다.
- 시작 그림: 승인된 이미지 콘티의 K7 정지컷 `synk-vendor/…/v7/콘티/판/K7_미소_142211.png`(업로드).

## 판 1(쓴 판)

```
Locked-off camera, a beauty close-up of the same young Korean woman looking straight into the lens. Her lips stay closed the whole time. Between 0.5 and 2 seconds her soft closed-lips smile slowly grows a little warmer and reaches her eyes, a tiny, natural change; no teeth, no frown, no squint, no head turn, no talking. She breathes calmly. The warm morning window light, her white headband and her hair stay the same. Real footage, natural skin texture with pores. No hands, no text, no new objects.
```

결과 `synk-vendor/…/v7/영상/omni/K7_미소_omni_판1.mp4`(720×1280 · 24fps · 96프레임): 0.5~1.2초 두 눈을 천천히 감았다 뜨고(감은 눈 0.7초), 1.3초부터 렌즈를 보며 미소가 조금 짙어진 채 머문다. 입은 내내 다묾, 이 안 보임, 고개 · 머리띠 · 빛 그대로. → **24~59번(1.0~2.5초)**을 컷 7에 쓴다 — 컷 5(눈 감고 들숨)에서 이어 「눈을 뜨며 렌즈를 보고 미소」.

- 키우기: `영상_키우기.py … 24 36 K7_미소 37` — 그 36장만 SeedVR2-3B 배치 하나(37)로 1080×1920(283초). 처음엔 16~63번 48장을 배치 33으로 키웠는데 배치 이음새 한 장(가편집 10.46초)이 흐려졌다(Fable). 옛 판은 `…/영상/업/K7_미소_옛_193813/`.
- 결: SeedVR2 판이 정지컷보다 두 배쯤 또렷해(머리카락 · 속눈썹 · 머리띠 결) 가편집에서 가우시안 σ0.5를 건다(`가편집.py` CLIPS `soft`) — 컷 2 정지컷과 같은 결.
- Fable(10-21 18시 반): **「보여 드려도 됨」**. 연기 — 9.50~9.63 감은 눈의 옅은 미소, 9.67~9.83 눈 뜸, 9.88~10.96 렌즈를 보며 입꼬리가 천천히 올라감(10.4초 무렵 뚜렷), 36장 내내 입 다묾 · 이 없음 · 과장 · 짜증 없음(얼굴 이동 최대 2.1px). 같은 사람(콘티 · 참조 01/05 · 컷 2 · 5), 흔들림 · 녹음 없음. 남은 P3: 감은 눈이 0.17초뿐이라 「컷에 걸린 깜빡임」으로도 읽힐 수 있다 — 감은 눈을 더 두려면 원본 20번부터(0.33초), 뜨는 중에 들어가려면 27번부터.

## 판 2

```
Locked-off camera, a beauty close-up of the same young Korean woman looking straight into the lens. Her lips stay closed the whole time. Between 0.5 and 2.5 seconds her closed-lips smile gently widens, her cheeks lift a little and her eyes soften into a content, happy look, unhurried and natural; no teeth, no laughing, no frown, no squint, no head turn, no talking. The warm morning window light, her white headband and her hair stay the same. Real footage, natural skin texture with pores. No hands, no text, no new objects.
```

결과 `…/omni/K7_미소_omni_판2.mp4`: 미소 폭은 더 크고 볼이 올라가지만, 0.5~0.7초에 한쪽 눈만 먼저 감겨 윙크처럼 읽힌다 — 표정 절제(장부 공통 원칙 7)에 맞지 않아 쓰지 않음.
