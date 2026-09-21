# 까몽 공통 프로필 — 일본·베트남

- 도구: 내장 image_gen, imagegen 스킬. 외부 CLI/API 전환 없음.
- 참조: `docs/캐릭터/정본_4K/까몽_본체.png`
- 대상: 두 YouTube 채널의 동일한 정지 프로필 한 장. 정본 캐릭터·기존 앱 표정 세트는 변경하지 않는다.
- 사용자 수정: 마린·까몽 각각 제작 대신 둘 중 하나만. 까몽을 선택했다.
- 최종 파일: `kkamong-profile-v2.png` · 1254×1254 · 1,979,110바이트.
- SHA-256: `e43fc4fec8bf6fcb5f082eaa4c78b4e24396b2dc316a74bfc8eb505db2dfb8ad`.
- 2026-09-20 07:21 KST: 일본·베트남 YouTube의 원형 크롭 및 공개 프로필 반영 확인. v1은 미업로드, 이전 몽글 자산·문구는 `versions/v1/`에 보존.

## 전체 프롬프트

Use case: identity-preserve. Asset type: finished square YouTube profile portrait, one image only, for the SYNK LAB Japan and Vietnam channels. Input image 1 is the canonical identity reference for Kkamong (까몽), not a generic animal. Create a new static close-up profile portrait with a gently playful, welcoming expression: the eye on the viewer's left is softly winking through its existing eyelid, and the other eye remains a glossy black bead with the same moss-green iris and a small soft reflection. The expression is warm and curious, never smug or angry. A very slight natural whole-character tilt adds life. Frame the head and upper body large and centered, both rounded fuzzy top protrusions entirely visible with generous white margin; lower torso may leave the square frame intentionally. Keep eyes and all important facial features safely inside the central circular crop. Do not depict a drawn circular border. Background: absolutely clean pure neutral white #FFFFFF, not cream, paper texture, yellowish vignette or gray backdrop. Preserve the exact reference character identity, soft round body, original dark chestnut felt/fur and fine wispy edge fibers, original small green eyes and their spacing, original ambiguous little side/back folds. No mouth, nose, eyebrows, teeth, tongue, whiskers, new ears, horns, human hands, articulated limbs, bat wings, or dragon anatomy. No costume, props, accessories, text, flags, logos or watermarks. The same tactile felt character with restrained studio lighting, clear detail and readable silhouette at 98px. Avoid plasticky CGI, smooth clay, oversharpening or oversized anime eyes. Output one square high-resolution portrait suitable for direct upload, preferably 1024x1024, under 4MB. This is a new framed static portrait, not a replacement for canonical animation-expression sprites; retain identity and material faithfully.

## v2 — 사용자 피드백

왼쪽 눈이 동공처럼 보이므로 아주 조금 더 감기게 한다. v1은 업로드하지 않았다.

Use case: precise-object-edit. Input image 1 is the exact edit target, a finished Kkamong profile portrait. Make one very small, localized change ONLY to the already-winking eye on the VIEWER'S LEFT. It currently has a visible black crescent gap underneath its green upper eyelid, which reads as an exposed pupil. Close that eye just a tiny bit further so the pupil and black eye interior are completely hidden. Bring the lower eyelid up gently to meet the existing lid, leaving only a soft, natural, fully closed eyelid crease. Retain the existing curved happy-wink shape, and a restrained thin moss-green eyelid edge, but no black opening, no visible pupil, no white sclera, and no dark hollow crescent. Do not over-close it into a tense squint. Keep the other open eye absolutely unchanged. Keep all fur outside the narrow left-eye outline, body silhouette, head tilt, crop, scale, fuzzy top protrusions, side folds, lighting, pure white background, material, and colors unchanged. Do not regenerate the face broadly. No new facial features. The user specifically requested only a VERY SLIGHT additional closure of the left eye. Deliver one square image, same framing and resolution as the input.
