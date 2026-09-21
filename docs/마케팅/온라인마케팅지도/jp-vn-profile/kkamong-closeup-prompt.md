# 까몽 얼굴 클로즈업 v3

- 사용자 피드백: 몸이 너무 통통하게 보이므로 프로필의 얼굴 확대.
- 스킬: synk-design으로 현재 프로필·정본 경계 확인, imagegen 내장 image_gen으로 구도 편집. 외부 CLI/API 미사용.
- 편집 원본: `kkamong-profile-v2.png`.
- 산출물: `kkamong-profile-v3-closeup.png`.
- 방향: 몸·양쪽 접힘을 프레임 밖으로 덜어내고 얼굴을 크게 보여 준다. 왼쪽 눈이 완전히 감긴 윙크·초록 홍채·갈색 펠트·흰 바탕 유지.
- 확인: 실제 생성 이미지에서 얼굴 중심 확대, 몸 비중 축소, 감긴 눈에 검은 동공 틈 없음, 펠트 섬유 시각 확인. AI 구도 편집이며 원본 픽셀의 단순 크롭이나 비변경 영역 픽셀 일치를 주장하지 않음.
- 게시 상태: 제작 당시에는 로컬 후보였으나 후속 사용자 적용 요청으로 2026-09-20 07:44 KST 일본·베트남 YouTube 프로필에 업로드·저장·공개 사진 확인 완료. 커버·소개·정본·앱 표정 자산 불변.
- 파일: 1254×1254 · 2353025바이트 · SHA-256 `3419ae0f69c877d2e66a0347cc69382d7d693ab4359acc2c1308f7384214941f`.

## 전체 프롬프트

Use case: identity-preserve.
Input image 1 is the exact edit target: the current Kkamong profile portrait. Change ONLY its framing into a tighter face close-up for a circular social profile.
The user says the visible body makes the character look too bulky and wants the FACE larger. Solve this through camera crop and enlargement, NOT by widening, inflating, slimming, reshaping, or redesigning the character.
Zoom the existing head approximately 1.25–1.3x relative to the square canvas. Move the crop upward so both soft rounded top protrusions remain visible with a small white margin. Let the face and head fill roughly 85% of the image width. Crop away almost all of the long lower torso; show at most a tiny amount immediately below the face at the bottom edge. The two raised side folds can leave the frame naturally and must not make a wide full-body silhouette. The eyes should sit near the horizontal center band, not too high in the square. Keep the eye region safely inside a circular avatar crop, without a drawn circle or border.
Keep the EXACT same facial identity, head tilt, eye sizes and spacing, dark chestnut felt fur color, individual soft fibers, lighting and expression. Critically retain the VIEWER-LEFT wink completely CLOSED: same thin moss-green curved lid, NO black gap, NO visible pupil. The other eye retains its original green iris, black bead and small white reflection. No nose, mouth, eyebrows, new ears, horns, extra limbs, accessories, props, text or logos.
Background remains clean neutral pure white #FFFFFF. Preserve fine felt texture without making the fur shaggy or noisy. One square high-resolution image. This is a composition edit of the supplied portrait, not a new character design.
