# 웹 플랫폼 회원 혜택 그림 · 웹용 판

`tools/build-synk-account.js`가 이 일곱 파일을 `experiences/synk-account/assets/member/`로 같은 이름으로 내보낸다(공개 `synk.im/account/assets/member/`). 원본은 [혜택물건](../혜택물건/)(PC 앱은 원본을 `desktop/assets/launcher/`로 그대로 쓴다)이고, 파일 이름은 웹 번들과 PC 앱이 함께 읽는 `desktop/renderer/benefits.mjs`의 `asset`과 같다.

2026-10-17 혜택 포스터 다시 굽기([기록](../README.md#member-benefit-objects-20261017))로 10-13 웹용 판(`care-note.webp`·`fortune-star.avif`·`teacher-cover.png`)과 `studio-camera.webp` 사본은 웹에서 더 쓰지 않아 지웠다(원본은 `desktop/assets/launcher/`에 그대로 있다).

| 파일 | 원본 | 웹용 판 | 기준 |
|---|---|---|---|
| `benefit-gift.webp` | 1046×1079 · 274KB | 582×600 · 100KB | 회원 혜택 첫머리. 2560×1440 2배 화면 579px, 1440×900 2배 564px 높이로 보인다 |
| `benefit-insight.webp` | 996×1162 · 284KB | 429×500 · 64KB | 나머지 여섯은 소개 머리가 가장 크다: 2560×1440 2배 491px, 1440×900 2배 398~437px, 390 3배 450~470px |
| `benefit-subscriptions.webp` | 978×775 · 220KB(11-08 다시 구움) | 원본과 같은 바이트 | 가로가 가장 넓은 물건(2560 2배에서 624px 폭). PC 원본 `혜택물건/benefit-subscriptions.webp`와 같은 파일 |
| `benefit-care.webp` | 1045×903 · 236KB | 579×500 · 82KB | |
| `benefit-fortune.webp` | 873×1094 · 270KB | 399×500 · 69KB | |
| `benefit-rehearsal.webp` | 793×1086 · 164KB | 365×500 · 43KB | |
| `benefit-album.webp` | 895×1128 · 270KB | 397×500 · 63KB | |
| `solio-object.webp` | 960×1000 · 302KB(PC `혜택물건/solio-object.webp`) | 480×500 · 81KB | 솔리오(2026-11-13) — 솔리오 홈 소개 머리 · 내 홈 칸. 코랄 바탕에서 구워 오렸고, 바닥 테의 코랄 기운(PC판 5,494 · 웹판 1,444픽셀, 아래 22%)만 빨강을 초록 값으로 낮췄다(알파 · 다른 픽셀 그대로) |

일곱 장 1.9MB → 약 560KB. 필요한 크기는 [웹 포스터 확인](../../../../experiences/synk-account/qa/member-benefit-objects-20261017/README.md)의 `check.mjs`가 10가지 창(2560 2배 ~ 320 2배) × 회원 혜택·소개 여섯·홈·둘러보기·라이브러리에서 실제 그려진 크기 × 화면 배율로 잰 값이다.

만든 법(2026-10-17, Pillow 12.3): `convert('RGBa')`(미리 곱한 알파)로 바꾼 뒤 `resize(…, LANCZOS)`, 다시 `RGBA`로 바꿔 `save('WEBP', quality=90, method=6)`(알파는 무손실 기본값). 투명한 바깥 칸의 색이 가장자리에 섞이지 않게 미리 곱한 알파로 줄였다. 원본과 웹용 판을 같은 화면 36장(1440 2배·390 3배, 밤·낮)으로 찍어 바뀐 칸 안 평균 차이 1.1/255 이하, 펠트에는 보이는 차이가 없었다(가장 큰 차이는 리허설 휴대폰 스티커 가장자리 1px).

**2026-11-08 A 진열대(회색 선반):** 물건이 사업 색 면이 아니라 회색 선반(낮 `#F3F3F4` · 밤 `#1A1A1C`) 위에 서면서 구운 바탕 색이 가장자리에 드러났다. `benefit-subscriptions.webp`는 받침 아래 가장자리의 초록 기운(초록 면에서 구운 자국, 2,535픽셀, y ≥ 345)만 같은 픽셀의 빨강·파랑 평균 회색으로 바꿨다(알파 · 다른 픽셀 그대로). `world-annyeong.webp`(새로 둠)는 [시안 원본](../시안_20261106/assets/world-annyeong.webp)에서 받침 아래 청금석 기운(4,567픽셀, y ≥ 560)만 같은 방법으로 지운 웹용 판이다 — 시안 원본은 PC 런처도 쓰므로 그대로 둔다. 남은 것: 구독 계정판 받침 아래에는 원본부터 납작한 다각형 그림자 조각이 구워져 있어 밤 선반에서 조각이 드러난다(낮은 그림자로 읽힘). 알파를 메우는 처리로는 낮 화면이 나빠졌고, 조각만 투명으로 지우는 처리(질감 없는 어두운 칸 18,888픽셀)는 조각이 받침 실루엣 안쪽(받침 아래 곡선)에 있어 2배로 보면 받침이 크게 깎였다 — 그대로 두었다. 밤에도 깨끗하려면 물건을 다시 구워야 한다. → 11-08 같은 물건 · 같은 각도 · 순백 바탕 · 그림자 없음으로 다시 구웠다(GPT 이미지 2.5, 지시문 [`혜택물건/benefit-subscriptions.지시문.json`](../혜택물건/benefit-subscriptions.지시문.json)). 받침 아래 조각이 없고 숯색 둘레의 흰 털끝을 밝기로 풀어 밤 선반에서도 테가 없다. PC · 웹이 같은 바이트(978×775)를 쓴다.
