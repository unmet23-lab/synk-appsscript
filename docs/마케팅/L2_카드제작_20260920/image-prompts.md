# L2 v2 이미지 생성 기록

2026-09-20. 내장 ImageGen을 사용했다. CLI/API 유료 폴백이나 Higgsfield는 사용하지 않았다. 두 장의 참조 이미지는 생성 전 직접 확인했다.

- 마스코트 정체성: `docs/캐릭터/정본_4K/몽글_본체.png`
- 카페·재질 참고: `docs/마케팅/첫콘텐츠_제작_20260919_이전원고보관/assets/cafe-mongle.png`
- 로고와 글자는 생성하지 않고 승인 로고·서체를 별도 HTML 조판으로 사용했다.
- 생성물의 외곽 비율·털·스티치를 눈으로 확인했다. 원본 마스코트와 픽셀 단위로 동일한 이미지라는 뜻은 아니다. 몽글의 팔·손·발·입·눈썹은 없다. 영수증을 든 손은 화면 밖 성인 직원의 손이다.
- 선택 그림의 알파는 원본대로 보존하고 흰 지면에 표시한다. 4장은 승인된 단독 몽글 원본과 되감기·힌트 말풍선으로 조판하며, 2장의 카페 그림을 반복하지 않는다. 1장과 2장 역시 다른 원본이다.

## 2장 · 두 행동

저장: [choice-scene-v2.png](assets/choice-scene-v2.png)

생성 원본: `C:/Users/q1212/.codex/generated_images/01a0b650-38f0-7bd3-af82-1a55c3c7b0e3/exec-38984b13-ab54-492b-b78d-9b013c7ba6c8.png`

```text
Use case: illustration-story.
Asset type: a single wide two-panel narrative illustration for an absolute-beginner Korean learning carousel, no text. 2:1 landscape composition. Image 1 is the exact mascot identity reference. Image 2 is the cafe setting/material reference, not a layout to copy.
Create two equally sized, visually separate miniature cafe scenes side by side, divided by a generous clean white gutter, not a collage of the supplied photo. In both scenes show the SAME little coral needle-felt bell-shaped mascot at the customer side of a low white cafe counter, with realistic tactile fine wool and glass bead eyes.
LEFT panel: the mascot dips its entire soft bell body slightly forward as a hesitant nod, eyes looking down, as though it did not understand but nodded. RIGHT panel: a distinctly different closer three-quarter pose, the mascot tilts its whole body about 10 degrees to the side and looks attentively upward toward an off-frame cafe employee, ready to ask again. Tiny clean blank glass speech capsule near the right mascot, with no writing or symbols. No empty capsule on left.
Cafe is bright white with restrained pale timber, a silver coffee machine out of focus, one cup resting securely on the counter. Ground contact and subtle shadows must be clear. Keep a calm high-quality handmade stop-motion look, expressive through gaze/body lean, not exaggerated cartoon facial anatomy.
Identity invariants: same coral tone, short fine wool, black spherical bead eyes with small reflections, softly domed bell silhouette, wavy scalloped hem and continuous peach stitch seam. Mascot has NO ARMS, NO HANDS, NO FINGERS, NO LEGS, NO FEET, NO MOUTH, NO EYEBROWS, NO NOSE. Do not invent a face or add clothing. Whole silhouette visible in each panel, not floating. No humans or additional characters, no labels, no numbers, no question marks, no Korean or Mongolian text, no logos, no watermark. The two panels must depict visibly distinct actions and camera framing. White overall daylight; no yellow vintage wash.
```

## 5장 · 영수증을 건네며 다시 묻는 직원

저장: [receipt-scene-v2.png](assets/receipt-scene-v2.png)

생성 원본: `C:/Users/q1212/.codex/generated_images/01a0b650-38f0-7bd3-af82-1a55c3c7b0e3/exec-2dec9808-b6bd-4c68-ba8e-e4db4f47bbcd.png`

```text
Use case: illustration-story.
Asset type: a wide scene for the last card of a Korean beginner carousel, for older teens, not small children.
Input images: image 1 is the exact approved mascot identity. Image 2 is a cafe setting and material reference; create a NEW camera angle and new action, do not duplicate that composition.
Primary request: In a bright modern white cafe, show the little coral felt mascot at a low customer counter just after receiving a drink. A cafe employee, cropped strictly to an apron torso and ONE naturally attached forearm/hand from the upper LEFT of the frame, holds out a small blank white receipt over the counter. The adult employee's face and head are entirely out of frame. Fingers anatomically natural and connected. The mascot is on the RIGHT, its whole bell-shaped body tilting very slightly up toward the receipt with attentive glass bead eyes, as if it has just missed the employee's next question. One cream ceramic cup on a saucer sits securely on the counter, not held by the mascot. This is a mildly funny relatable 'another question already?' moment, expressed by the situation and eye direction, no cartoon facial additions.
Composition: 3:2 landscape. A diagonal low white counter leads from lower left to middle right. Whole mascot visible and grounded on the customer side with realistic soft contact shadow. The receipt must be clearly separate from the mascot and in the employee's hand, no fake arm growing from mascot. Different perspective from the source; a little closer to mascot eye level, subtle cafe background blur. Leave clear empty space in the upper center for a speech bubble added later in typography, do not draw a bubble yourself.
Material/style: elegant tactile stop-motion art photographed in a real clean cafe, obvious fine coral wool fibers, glossy black bead eyes, visible continuous peach embroidered hem stitching; neutral bright daylight, pure white overall backdrop, soft shadows, not yellow, beige or vintage. Retain mascot rounded dome/bell silhouette and natural scalloped hem. It has NO ARMS, NO HANDS, NO LEGS, NO FEET, NO MOUTH, NO EYEBROWS, NO NOSE, no clothes. No readable text, no symbols, no logo, no watermark, no thick sticker outlines. Fully opaque complete photograph, no transparency or cutout corners.
```
