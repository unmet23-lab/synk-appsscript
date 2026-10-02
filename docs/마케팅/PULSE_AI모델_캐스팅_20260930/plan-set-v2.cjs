// roster-v2.json의 확정 모델마다 대표 사진을 참조해 전체 세트(15장) 작업 목록을 만든다(구글 Nano Banana Pro).
// 사용: node plan-set-v2.cjs M20b F20b > jobs-set-v2.json   (키를 생략하면 전부)
const { models } = require('./roster-v2.json');
const keys = process.argv.slice(2);
const TAIL = 'Same plain studio wall and soft window daylight as the reference photo, 85mm lens, real skin texture with visible pores and fine vellus hair, natural color, fine film grain, no heavy retouching, no plastic skin, opaque clothing, no text or logos anywhere.';
const jobs = [];
for (const m of models.filter((x) => !keys.length || keys.includes(x.key))) {
  const who = m.gender === '남' ? 'man' : 'woman', his = m.gender === '남' ? 'his' : 'her';
  // 실제 인물처럼 참조를 더 준 모델은 첫 장이 기준 사진이고 나머지는 같은 사람의 다른 장면이라고 알린다.
  const refs = [m.hero, ...(m.extraRefs || [])];
  const extra = refs.length > 1 ? ' The other attached photos show the same real person from other angles; use them only to keep his or her identity accurate.' : '';
  const keep = `Do not add any moles, marks or blemishes that are not in the reference.${m.keepTraits ? ' ' + m.keepTraits : ''}${extra}`;
  const same = `The exact same ${who} as in the first attached reference photo: identical face, bone structure, eyes, brows, lips, skin tone and hairstyle, same ${m.outfit}. ${keep}`;
  const face = `The exact same ${who} as in the first attached reference photo: identical face, bone structure, eyes, brows, lips and skin tone. ${keep}`;
  const add = (shot, prompt, aspect) => jobs.push({ name: `${m.key}-${shot}`, prompt, aspect, images: refs });
  add('angle-front', `${same} Upper body from the waist up, standing straight and facing the camera, arms relaxed at ${his} sides, relaxed confident expression. ${TAIL}`, '3:4');
  add('angle-left', `${same} Upper body from the waist up, standing and turned 90 degrees so the camera sees a clean side profile, ${his} face and body pointing toward the left edge of the frame, relaxed expression. ${TAIL}`, '3:4');
  add('angle-right', `${same} Upper body from the waist up, standing and turned 90 degrees so the camera sees a clean side profile, ${his} face and body pointing toward the right edge of the frame, relaxed expression. ${TAIL}`, '3:4');
  add('angle-back', `${same} Upper body from the waist up, seen directly from behind: the back of ${his} head and hair, ${his} shoulders and back facing the camera, face not visible. ${TAIL}`, '3:4');
  add('exp-smile', `${same} Head and shoulders facing the camera with a big genuine smile showing the upper teeth, eyes crinkling with natural creases, cheeks raised. ${TAIL}`, '3:4');
  add('exp-angry', `${same} Head and shoulders facing the camera, genuinely angry: brows pulled down and together, eyes narrowed in a hard glare, jaw clenched, lips pressed tight, tension across the forehead. ${TAIL}`, '3:4');
  add('exp-surprised', `${same} Head and shoulders facing the camera, genuinely surprised: eyebrows raised high with forehead creases, eyes wide open, mouth dropped open, head pulled slightly back. ${TAIL}`, '3:4');
  m.hair.forEach((h, i) => { if (i) add(`hair-${i + 1}`, `${face} Same ${m.outfit}. Change only the hairstyle to ${h.prompt}. Head and shoulders facing the camera, relaxed confident expression. ${TAIL}`, '3:4'); });
  add('fullbody', `${face} Same hairstyle. Full-length head-to-toe photo, standing straight facing the camera with arms relaxed, feet visible, wearing a ${m.outfit} tucked into straight dark-blue jeans and plain white sneakers. Plain light-grey studio wall meeting a pale floor, soft window daylight. Model agency digitals, 50mm lens, true body proportions, real skin texture, natural color, fine film grain, no text or logos.`, '2:3');
  add('skin', `${face} Extreme close-up of ${his} face from brow to chin filling the frame, soft window light raking across the skin, showing real pores, fine vellus hair, subtle natural unevenness and individually visible lashes. Beauty campaign macro photo, 100mm macro lens, natural color, no heavy retouching.`, '4:5');
  add('hands', `${face} Close-up at chest height of ${his} hands ${m.hands}, the lower half of ${his} face softly visible above, same ${m.outfit}. Natural nails, real knuckle creases, fine skin texture, exactly five fingers on each hand, correct anatomy. Plain wall, soft window daylight, 85mm, natural color, fine film grain, no text or logos.`, '4:5');
  m.looks.forEach((l, i) => add(`look-${i + 1}`, `${face} Same hairstyle. Three-quarter length fashion lookbook photo from mid-thigh up, standing in a relaxed natural pose, wearing ${l.prompt}. Plain light-grey studio wall, soft window daylight, 70mm lens, real fabric texture and natural creases, real skin texture, natural color, fine film grain, no text or logos.`, '3:4'));
  add('context', `${face} Same hairstyle. Candid commercial lifestyle photo: ${m.context}. Natural unposed moment, 35mm lens, shallow depth of field, real skin texture, natural color, fine film grain, no text, no logos.`, '4:5');
}
process.stdout.write(JSON.stringify(jobs, null, 1));
