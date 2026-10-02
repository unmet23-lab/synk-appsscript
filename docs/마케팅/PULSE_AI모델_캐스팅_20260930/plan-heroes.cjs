// 대표 사진 후보 작업 목록을 만든다. 사용: node plan-heroes.cjs > jobs-heroes.json
const { models } = require('./roster.json');
const hero = (m) => `Unretouched model agency digitals photo of ${m.prompt}, wearing a ${m.outfit}. Head and shoulders, facing the camera straight on with a relaxed neutral expression, lips gently closed. Plain warm light-grey wall. Soft daylight from a large window at camera left, gentle falloff, faint catchlights in the eyes. Shot on a full-frame camera, 85mm lens at f/4, eye level. Real skin texture: visible pores, fine vellus hair, natural unevenness and tiny imperfections, a few flyaway hairs. Natural color, fine film grain, no retouching, no beauty filter, no skin smoothing.`;
const jobs = [];
for (const m of models) for (const k of (m.code === 'F01' ? ['b', 'c'] : ['a', 'b', 'c']))
  jobs.push({ name: `${m.code}-hero-${k}`, model: 'text2image_soul_v2', prompt: hero(m), args: { aspect_ratio: '3:4', quality: '2k' } });
process.stdout.write(JSON.stringify(jobs, null, 1));
