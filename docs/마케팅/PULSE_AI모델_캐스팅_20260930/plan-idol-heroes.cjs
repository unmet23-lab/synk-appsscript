// 10~30대 아이돌·배우형 대표 얼굴 후보(Soul 2.0). 사용: node plan-idol-heroes.cjs > jobs-idol-heroes.json
const slots = {
  M10: ['man', 'a 19-year-old Korean young man with a bright, boyish K-pop idol visual: small face, clear double eyelids with big bright eyes and soft aegyo-sal, soft straight nose, fluffy black hair with light see-through bangs, clean fresh skin', 'plain white cotton crew-neck t-shirt'],
  M20: ['man', 'a 25-year-old Korean man with a striking K-pop idol visual: sharp V-line jaw, deep-set eyes with a thin crease, high nose bridge, full lips, ash-brown hair in a soft wavy comma cut', 'plain black cotton crew-neck t-shirt'],
  M30: ['man', 'a 33-year-old Korean man with a charismatic actor-like visual: defined jaw and cheekbones, calm confident eyes, thick straight brows, neat black hair styled up and back, faint stubble', 'plain white cotton crew-neck t-shirt'],
  F10: ['woman', 'a 19-year-old Korean young woman with a bright, lovely K-pop idol visual: small oval face, big clear eyes with soft aegyo-sal, soft rosy cheeks, long straight black hair with wispy see-through bangs, light glossy lips', 'plain white cotton crew-neck t-shirt'],
  F20: ['woman', 'a 25-year-old Korean woman with a glamorous K-pop idol visual: small V-line face, cat-like almond eyes with subtle eyeliner, high nose bridge, full glossy lips, long glossy dark hair with soft waves', 'plain black cotton crew-neck t-shirt'],
  F30: ['woman', 'a 32-year-old Korean woman with an elegant actress-like visual: refined features, calm confident almond eyes, clean straight brows, collarbone-length sleek dark-brown hair tucked behind one ear, soft nude lips', 'plain white cotton crew-neck t-shirt'],
};
const extra = ['M10', 'M20', 'F10', 'F20'];
const hero = (d, o) => `Korean entertainment agency profile photo of ${d}, wearing a ${o}. Head and shoulders, facing the camera straight on with a relaxed, confident expression. Clean light-grey studio wall, soft large window light from camera left, gentle falloff, catchlights in the eyes. Full-frame camera, 85mm lens at f/2.8, eye level. Real skin texture even with light makeup: visible pores, fine vellus hair, subtle natural unevenness, a few flyaway hairs. Natural color, fine film grain, no heavy retouching, no plastic skin.`;
const jobs = [];
for (const [code, [, d, o]] of Object.entries(slots)) for (const k of extra.includes(code) ? ['a', 'b'] : ['a'])
  jobs.push({ name: `${code}-hero-${k}`, model: 'text2image_soul_v2', prompt: hero(d, o), args: { aspect_ratio: '3:4', quality: '2k' } });
process.stdout.write(JSON.stringify(jobs, null, 1));
