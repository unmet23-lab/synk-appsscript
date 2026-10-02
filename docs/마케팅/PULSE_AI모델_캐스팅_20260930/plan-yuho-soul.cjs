// 유호 Soul ID(Higgsfield Soul 2.0 학습 모델)로 대표 후보와 16컷 세트를 만드는 작업 목록.
// 사용: node plan-yuho-soul.cjs <soul_id> [hero|set] > jobs/yuho-soul-<종류>.json → node run-jobs.cjs jobs/yuho-soul-<종류>.json 6
// 참조 사진 없이 학습된 얼굴(custom_reference_id)만으로 표정·각도를 바꾼다. 학습 자료는 raw/yuho-train/ 20장.
// 2026-10-01 유호님 결정: 유호님 얼굴은 확정 얼굴만 쓴다. 예전 얼굴로 학습한 Yuho-PULSE(baf521ba…)로 이 목록을 돌리지 않는다.
//   기준: ../제작양식/실제얼굴_화보_뮤직비디오.md "고정 얼굴 세트". M03 컷은 이미 확정 얼굴로 바꿨다.
const [, , soul, kind = 'hero'] = process.argv;
if (!soul) { console.error('soul_id가 필요하다'); process.exit(1); }
const STUDIO = 'Plain warm-grey seamless studio backdrop, soft key light from camera left with gentle falloff, warm filmic color grade, fine film grain, 85mm lens. Real skin texture with fine pores, a few flyaway hairs, no heavy retouching, no text or logos.';
const WHO = 'a young Korean man in his mid-twenties with black cornrow braids pulled back, wearing a plain black crew-neck t-shirt';
const job = (name, prompt, ar = '3:4') => ({ name: `Myuho-soul-${name}`, model: 'text2image_soul_v2', prompt, args: { aspect_ratio: ar, quality: '2k', custom_reference_id: soul } });
const jobs = [];
if (kind === 'hero') {
  for (const n of [1, 2, 3]) jobs.push(job(`hero-${n}`, `Head-and-shoulders agency profile portrait of ${WHO}, facing the camera with a relaxed, confident expression. ${STUDIO}`));
  for (const n of [1, 2, 3]) jobs.push(job(`smile-${n}`, `Head-and-shoulders agency profile portrait of ${WHO}, facing the camera with a big bright genuine smile showing his upper teeth, eyes narrowing into happy crescents. ${STUDIO}`));
} else {
  const shots = {
    'angle-front': `Waist-up photo of ${WHO}, standing straight and facing the camera, arms relaxed, calm expression.`,
    'angle-left': `Waist-up photo of ${WHO}, standing turned 90 degrees in a clean side profile facing the left edge of the frame.`,
    'angle-right': `Waist-up photo of ${WHO}, standing turned 90 degrees in a clean side profile facing the right edge of the frame.`,
    'angle-back': `Waist-up photo of ${WHO}, seen directly from behind, the back of his braided head and shoulders, face not visible.`,
    'exp-smile': `Head-and-shoulders photo of ${WHO}, facing the camera with a big bright genuine smile showing his upper teeth, eyes narrowing into happy crescents.`,
    'exp-angry': `Head-and-shoulders photo of ${WHO}, facing the camera, genuinely angry: brows pulled down, hard glare, jaw clenched.`,
    'exp-surprised': `Head-and-shoulders photo of ${WHO}, facing the camera, genuinely surprised: eyebrows raised high, eyes wide, mouth open.`,
    'hair-2': 'Head-and-shoulders photo of a young Korean man in his mid-twenties with a clean short two-block haircut of natural black hair, wearing a plain black crew-neck t-shirt, facing the camera, calm expression.',
    'hair-3': 'Head-and-shoulders photo of a young Korean man in his mid-twenties with shoulder-length loose natural black hair tucked behind his ears, wearing a plain black crew-neck t-shirt, facing the camera, calm expression.',
  };
  for (const [k, p] of Object.entries(shots)) jobs.push(job(k, `${p} ${STUDIO}`));
  jobs.push(job('fullbody', `Full-length head-to-toe photo of ${WHO} tucked into straight dark-blue jeans and white sneakers, standing straight facing the camera. Plain light-grey studio wall and pale floor, soft daylight, 50mm lens, true proportions, no text or logos.`, '2:3'));
  jobs.push(job('look-1', 'Three-quarter length fashion photo of a young Korean man in his mid-twenties with black cornrow braids, wearing a black oversized hoodie, loose cargo pants and chunky sneakers. Plain light-grey studio wall, soft daylight, 70mm lens, no text or logos.'));
  jobs.push(job('look-2', 'Three-quarter length fashion photo of a young Korean man in his mid-twenties with black cornrow braids, wearing a relaxed charcoal suit over a black crew-neck t-shirt. Plain light-grey studio wall, soft daylight, 70mm lens, no text or logos.'));
  jobs.push(job('skin', `Extreme close-up beauty photo of the face of ${WHO}, brow to chin filling the frame, soft window light raking across real pores and fine vellus hair, 100mm macro.`, '4:5'));
  jobs.push(job('hands', `Chest-height close-up of the hands of ${WHO} holding a plain black wireless earbuds case with no logo, lower half of his face softly visible, five fingers on each hand, correct anatomy. ${STUDIO}`, '4:5'));
  jobs.push(job('context', `Candid lifestyle photo of ${WHO} in a music studio with headphones around his neck, leaning over a mixing desk with no brand logos and glancing at the camera with a slight smile. 35mm lens, natural light, no text or logos.`, '4:5'));
}
process.stdout.write(JSON.stringify(jobs, null, 1));
