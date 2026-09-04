/* 촬영 규격 정본 — 굽는 도구가 «둘»이라 한 곳에만 둔다 (2026-09-05).
 * 낮 배치 = `tools/공방굽기.js` · 밤 배치 = `tools/밤굽기.js`.
 * 🔑 한 값을 두 곳이 알면 갈린다(기억 constant-known-in-two-places) — 규격을 고치면
 *   그 규격으로 구운 것과 결이 갈리므로, 고칠 때는 «전량 재굽기»를 각오하고 고친다.
 */
'use strict';

/* 촬영 규격 — 계획 항목의 `규격` 키가 고른다(없으면 `부품`).
 * 🔑 규격은 «종류»가 적고 지시문은 «가짓수»가 많다. 그래서 규격만 여기 두고 물건 설명은
 *   계획.json 이 든다. 규격을 고치면 이미 구운 것과 결이 갈리므로, 고칠 때는
 *   «그 규격으로 구운 것 전량 재굽기»를 각오하고 고친다.
 *
 * 부품 — 시험 굽기 여섯이 통과한 그 규격 그대로다(유호 판정 09-05).
 * 천   — 배경으로 «까는» 것이라 물건도 여백도 없어야 한다. 부품 규격으로 구우면
 *        천 한 조각이 가운데 놓인 사진이 나와 배경으로 못 쓴다.
 * 장면 — PPT 표지·홍보물에 크게 앉는 것. 크림 바탕 위에 물건 하나, 여백이 넉넉해야
 *        그 위에 글자를 얹을 수 있다. */
const 규격표 = {
  /* 🔑 «떠 있는» 이라고 써야 그림자가 안 온다(09-05 실측 · 세 판을 태워 알았다).
   *   「no shadow」를 아무리 못 박아도 «바닥에 놓인» 상황으로 쓰면 모델이 그림자를 낸다 —
   *   골무·실패가 크게 물렸다. `펠트색굽기.js` 의 스튜디오 문장이 처음부터
   *   "floating object with no ground shadow" 였던 것이 이 이유다. */
  부품:
    'Macro product photograph of a single handmade object, floating in empty space against a ' +
    'plain flat pure white background. The object is NOT resting on any surface — there is no ' +
    'ground, no table, no contact point, and therefore no cast shadow, no drop shadow, no grey ' +
    'pooling and no reflection anywhere in the frame. ' +
    'Studio lighting: broad soft diffused light wrapping the object from every side, ' +
    'with one gentle key from the upper left shaping the form. ' +
    'The white behind and around the object is perfectly clean and identical in every corner. ' +
    'The object sits exactly in the centre with generous empty margin on all four sides. ' +
    'Every wool fibre is resolved — you can count the strands and see how the nap catches light. ' +
    'No text, no watermark, no props, no hands, no background pattern. ' +
    'Tack sharp, medium format macro, photorealistic craft object.',
  /* ⚠ 이 규격은 «장면»으로 쓴다 — 09-05 에 `IMAGE_RECITATION` 으로 거절당했다.
   *   첫 판은 flat·seamless·even·no vignette 를 거듭 못 박았는데, 그렇게 쓰면 모델이
   *   「알려진 텍스처 이미지를 그대로 내라」는 요구로 읽고 통째로 거절한다(펠트 크림을
   *   처음 구울 때 밟은 것과 같은 무늬 · 기억 loom-baked-assets-only-for-ui).
   *   그래서 «작업대 위에 놓인 큰 천에 가까이 다가간 사진»이라는 장면을 준다. */
  천:
    'A close macro photograph of a large piece of cloth lying on a work table, the camera near ' +
    'enough that the cloth fills the whole frame and no edge, corner or fold of it comes into ' +
    'view. Soft north-window daylight rakes gently across the surface, so the individual fibres ' +
    'and the direction of the nap are easy to read. ' +
    'Nothing else is in the picture — no objects, no hands, no seams, no printed motif. ' +
    'No text, no watermark. Tack sharp, medium format macro.',
  장면:
    'A still life photograph of a single handmade object resting on a plain warm off-white ' +
    'paper surface, shot slightly from above. Soft daylight from a north window, one gentle ' +
    'shadow falling to the lower right. The object sits in the lower left third, leaving the ' +
    'upper right open and empty so type can be set there. ' +
    'Every wool fibre is resolved. Calm, quiet, expensive-looking craft photography. ' +
    'No text, no watermark, no props, no hands.',
};

module.exports = { 규격표 };
