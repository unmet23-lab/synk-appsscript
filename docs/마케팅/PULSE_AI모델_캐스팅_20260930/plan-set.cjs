// 대표 사진을 참조해 모델별 전체 세트 작업 목록을 만든다.
// 사용: node plan-set.cjs F01 [M01 ...] > jobs-set.json   (코드를 생략하면 여섯 명 전부)
const { models } = require('./roster.json');
const picks = require('./picks.json');
const codes = process.argv.slice(2);
const TAIL = 'Unretouched model agency digitals, same plain warm light-grey wall and soft window daylight as the reference, 85mm lens, real skin texture with visible pores and fine vellus hair, natural color, fine film grain, no retouching, no beauty filter, no skin smoothing.';
const jobs = [];
for (const m of models.filter((x) => !codes.length || codes.includes(x.code))) {
  const who = m.gender === '남' ? 'man' : 'woman';
  const his = m.gender === '남' ? 'his' : 'her';
  const same = `The exact same ${who} as the reference photo: identical face, bone structure, eyes, brows, skin tone and hairstyle, same ${m.outfit}. Do not add any moles, marks or blemishes that are not in the reference.`;
  const sameFace = `The exact same ${who} as the reference photo: identical face, bone structure, eyes, brows and skin tone. Do not add any moles, marks or blemishes that are not in the reference.`;
  const ref = [`raw/${m.code}-hero-${picks[m.code]}.png`];
  const add = (key, prompt, ar) => jobs.push({ name: `${m.code}-${key}`, model: 'nano_banana_pro', prompt, images: ref, args: { aspect_ratio: ar, resolution: '2k' } });
  add('angle-front', `${same} Upper body from the waist up, standing straight and facing the camera, arms relaxed at ${his} sides, relaxed neutral expression. ${TAIL}`, '3:4');
  add('angle-left', `${same} Upper body from the waist up, standing and turned 90 degrees so the camera sees a clean side profile, ${his} face and body pointing toward the left edge of the frame, relaxed neutral expression. ${TAIL}`, '3:4');
  add('angle-right', `${same} Upper body from the waist up, standing and turned 90 degrees so the camera sees a clean side profile, ${his} face and body pointing toward the right edge of the frame, relaxed neutral expression. ${TAIL}`, '3:4');
  add('angle-back', `${same} Upper body from the waist up, seen directly from behind: the back of ${his} head and hair, ${his} shoulders and back facing the camera, face not visible. ${TAIL}`, '3:4');
  add('exp-smile', `${same} Head and shoulders facing the camera with a big genuine smile showing the upper teeth, eyes crinkling with natural creases, cheeks raised. ${TAIL}`, '3:4');
  add('exp-angry', `${same} Head and shoulders facing the camera, genuinely angry: brows pulled down and together, eyes narrowed in a hard glare, jaw clenched, nostrils slightly flared, lips pressed tight, tension across the forehead. ${TAIL}`, '3:4');
  add('exp-surprised', `${same} Head and shoulders facing the camera, genuinely surprised: eyebrows raised high with forehead creases, eyes wide open, mouth dropped open, head pulled slightly back. ${TAIL}`, '3:4');
  m.hair.forEach((h, i) => { if (i) add(`hair-${i + 1}`, `${sameFace} Same ${m.outfit}. Change only the hairstyle to ${h.prompt}. Head and shoulders facing the camera, relaxed neutral expression. ${TAIL}`, '3:4'); });
  add('fullbody', `${sameFace} Same hairstyle. Full-length head-to-toe photo, standing straight facing the camera with arms relaxed, feet visible, wearing a fitted ${m.outfit.replace(/^plain /, 'plain ')} tucked into straight dark-blue jeans and plain white sneakers. Plain warm light-grey wall meeting a pale floor, soft window daylight. Unretouched model agency digitals, 50mm lens, true body proportions, real skin texture, natural color, fine film grain, no beauty filter.`, '2:3');
  add('skin', `${sameFace} Extreme close-up of ${his} face from brow to chin filling the frame, soft window light raking across the skin, showing real pores, fine vellus hair, subtle natural unevenness and individually visible lashes. Beauty campaign macro photo, 100mm macro lens, natural color, no retouching, no smoothing.`, '4:5');
  add('hands', `${sameFace} Close-up at chest height of ${his} hands ${m.hands}, the lower half of ${his} face softly visible above, same ${m.outfit}. Natural nails, real knuckle creases, fine skin texture and veins, exactly five fingers on each hand, correct anatomy. Plain wall, soft window daylight, 85mm, natural color, fine film grain.`, '4:5');
  m.looks.forEach((l, i) => add(`look-${i + 1}`, `${sameFace} Same hairstyle. Three-quarter length photo from mid-thigh up, standing in a relaxed natural pose, wearing ${l.prompt}. Plain warm light-grey wall, soft window daylight. Fashion lookbook photo, 70mm lens, real fabric texture and natural creases, real skin texture, natural color, fine film grain, no beauty filter.`, '3:4'));
  add('context', `${sameFace} Same hairstyle. Candid commercial lifestyle photo: ${m.context}. Natural unposed moment, 35mm lens, shallow depth of field, real skin texture, natural color, fine film grain, no text, no logos.`, '4:5');
}
process.stdout.write(JSON.stringify(jobs, null, 1));
