# 웹 플랫폼 회원 혜택 그림 · 웹용 판

`tools/build-synk-account.js`가 이 세 파일을 `experiences/synk-account/assets/member/`로 같은 이름으로 내보낸다(공개 `synk.im/account/assets/member/`). 원본은 데스크톱 앱이 쓰는 `desktop/assets/launcher/`에 그대로 있고, 파일 이름·형식은 번들과 데스크톱 앱(`desktop/renderer/benefits.mjs`)이 함께 쓰므로 바꾸지 않았다.

| 파일 | 원본 | 웹용 판 | 기준 |
|---|---|---|---|
| `care-note.webp` | 569×415 · 209KB(무손실) | 같은 크기 · WebP q90 · 45KB | 가장 크게 쓰는 곳이 돌봄 상세 438px(2배 화면 876px)라 원본 크기가 상한 |
| `fortune-star.avif` | 3615×2546 · 518KB | 960×676 · AVIF q70 · 74KB | 운세 상세 454px × 2배 화면 = 908px |
| `teacher-cover.png` | 1254×1254 · 1.55MB | 720×720 · PNG(같은 색 수) · 554KB | 리허설 상세 341px × 2배 화면 = 682px. 256색 PNG는 바닥 그림자에 계단이 생겨 쓰지 않았다 |

만든 법(2026-10-13, Pillow 12.3): care-note `save(quality=90, method=6)`, fortune-star `resize((960, 676), LANCZOS)` 뒤 `save('AVIF', quality=70)`, teacher-cover `resize((720, 720), LANCZOS)` 뒤 `save('PNG', optimize=True)`. 1440px 2배 화면의 각 상세에서 원본과 나란히 찍어 차이가 보이지 않음을 확인했다(평균 차이 care-note 0.96·fortune-star 0.87·teacher-cover 0.86/255). 근거는 `experiences/path-vr/qa/optimize-20261013/README.md`의 웹 플랫폼 절.
