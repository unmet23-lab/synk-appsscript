# 까몽 얼굴 확대 — 두 눈을 뜬 프로필 v4

- 요청: 같은 각도·확대 구도에서 윙크하지 않는 버전 제작 및 일본·베트남 YouTube 프로필 적용.
- 방식: 내장 `image_gen` 편집, `precise-object-edit`. CLI·외부 생성 서비스 미사용.
- 편집 원본: `kkamong-profile-v3-closeup.png`.
- 생성 원본: `C:/Users/q1212/.codex/generated_images/01a0b650-38f0-7bd3-af82-1a55c3c7b0e3/exec-5de3e8d1-1d26-46ab-9cf8-326032798f3c.png`.
- 프로젝트 파일: `kkamong-profile-v4-open-eyes.png`.
- 크기: 1254×1254, 2,215,566바이트.
- SHA-256: `a72b86bb2ad8d492d97b1bee00c4ebf2832ee50d5c88233bdcd1749e2f32f66b`.
- 원본과 생성 결과 시각 대조: 감긴 눈이 열린 녹색 눈으로 교체됨. 기존 고개 기울기·얼굴 확대 구도·흰 바탕·갈색 털 인상을 유지. 픽셀 단위 동일성은 보증하지 않으며 앱 표정 전환 세트로 사용하지 않는다.
- 기존 이미지·정본·앱 자산은 덮어쓰지 않음. 직전 실행 기록은 `versions/v3/`에 보존. 실제 게시 확인은 `publication.json`.

## 최종 프롬프트

Edit Image 1, the supplied current Kkamong YouTube profile portrait. Make exactly one local change: replace the closed winking eye on the viewer's LEFT with a naturally OPEN eye. Match the existing viewer-right open eye's moss-green iris material, glossy black round pupil, small upper-left white catchlight, and relative size. Place the newly opened eye at the anatomically corresponding position on this gently tilted head, with a calm friendly attentive gaze toward camera. Remove all trace of the closed curved green eyelid; do not add another eyebrow or extra eye. IMPORTANT: Preserve the exact current camera angle, slight head tilt, very tight face-closeup framing, zoom level, head silhouette, top furry protrusions, brown fluffy felt fibers, color, lighting, existing viewer-right eye, white background, and lower-edge crop. Do not slim, widen, rotate, recenter or zoom the head. No mouth, nose, arms, props, text or new features. This is a precise local eye-expression edit, not a redesigned character. Output one square high-quality static profile image suitable for a circular YouTube avatar crop.
