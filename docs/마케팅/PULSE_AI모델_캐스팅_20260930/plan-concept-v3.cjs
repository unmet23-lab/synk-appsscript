// 콘셉트 후보 v2: 확정한 두 대표 사진을 «사진 양식»(조명·배경·색감·필름 질감·구도)만 참조하고 얼굴은 전혀 다른 사람으로 만든다.
// 사용: node plan-concept-v2.cjs [이름필터] > jobs-concept-v2.json
const ref = { man: 'raw/M20-hero-b.png', woman: 'raw/F20-hero-b-clean.png' };
const style = (d, look) => `Head-and-shoulders portrait of ${d} ${look} Plain warm-grey seamless studio backdrop, soft key light from camera left with gentle falloff, warm filmic color grade, fine film grain. Give this person their own distinct, individual facial features. Styled by a professional hair and makeup team for a K-pop entertainment agency profile and fashion magazine beauty portrait: strikingly attractive with model-like facial proportions, yet clearly a real human with visible pores, fine vellus hair, subtle natural unevenness, individual lashes and a few flyaway hairs. Warm color-film look without any film border or edge markings, 85mm lens at f/2, soft key light with gentle falloff. No plastic skin, no heavy retouching, opaque clothing, no text or logos.`;
const c = {
  'M10-fresh': ['man', 'a 19-year-old Korean young man with a bright, refreshing K-pop idol visual: small face, big clear double-lidded eyes with soft aegyo-sal, straight nose, soft black hair with airy see-through bangs, clean glowing skin.', 'A light, boyish smile. Wearing a plain white crew-neck t-shirt.'],
  'M10-smart': ['man', 'a 19-year-old Korean young man with a neat, intelligent K-pop idol visual: sharp clear eyes behind thin round gold metal-frame glasses, straight brows, high nose bridge, tidy black hair with a soft side part.', 'Calm, composed expression. Wearing a crisp white oxford shirt with the top button open.'],
  'F10-fresh': ['woman', 'a 19-year-old Korean young woman with a bright, refreshing K-pop girl-group visual: small face, big sparkling eyes with soft aegyo-sal, rosy cheeks, a high ponytail with wispy see-through bangs, light coral lip tint.', 'A small bright smile. Wearing a plain white crew-neck t-shirt.'],
  'F10-smart': ['woman', 'a 19-year-old Korean young woman with a calm, intelligent K-pop girl-group visual: clear doe eyes, straight natural brows, high nose bridge, long straight black hair tucked behind her ears, subtle rose lip tint.', 'Calm, composed expression. Wearing a light-blue oxford shirt.'],
  'M20-fresh': ['man', 'a 24-year-old Korean man with a fresh, sunny K-pop idol visual: small face, bright double-lidded eyes, straight high nose, light-brown fluffy hair with soft bangs.', 'A warm open smile. Wearing a plain white crew-neck t-shirt.'],
  'M20-sexy': ['man', 'a 27-year-old Korean man with a sultry, charismatic K-pop idol visual: sharp V-line jaw, intense hooded eyes with a direct smoldering gaze, full lips, dark tousled hair falling over the forehead.', 'Lips slightly parted, confident look. Wearing a fitted black crew-neck t-shirt.'],
  'F20-fresh': ['woman', 'a 23-year-old Korean woman with a fresh, lively K-pop girl-group visual: small oval face, bright almond eyes with aegyo-sal, peachy blush, glossy coral lips, shoulder-length light-brown hair with airy bangs.', 'A soft playful smile. Wearing a plain white crew-neck t-shirt.'],
  'F20-smart': ['woman', 'a 26-year-old Korean woman with a sleek, intelligent actress visual: calm confident almond eyes, clean straight brows, high nose bridge, hair in a sleek low ponytail, subtle nude makeup, thin gold hoop earrings.', 'Poised, composed expression. Wearing a crisp white collared shirt.'],
  'M30-smart': ['man', 'a 33-year-old Korean man with a refined, intellectual K-drama lead actor visual: defined jaw, calm focused eyes behind thin black rectangular glasses, neat side-parted black hair, clean-shaven.', 'Calm, assured expression. Wearing a navy crew-neck knit sweater.'],
  'M30-sexy': ['man', 'a 34-year-old Korean man with a mature, sensual K-drama lead actor visual: strong jaw with light stubble, deep-set confident eyes with an intense gaze, black hair loosely swept back with a few strands falling.', 'Confident, magnetic look. Wearing a black shirt with the top two buttons open.'],
  'F30-smart': ['woman', 'a 32-year-old Korean woman with an elegant, intelligent actress visual: refined features, clear confident eyes, a sleek chin-length bob, subtle makeup, small pearl earrings.', 'Poised, warm expression. Wearing an ivory silk blouse.'],
  'F30-sexy': ['woman', 'a 31-year-old Korean woman with a glamorous, alluring actress visual: sharp almond cat eyes with soft smoky liner, high cheekbones, full rosewood lips, long glossy black hair in loose waves over one shoulder.', 'Confident, magnetic look. Wearing a fitted black square-neck top.'],
};
const f = process.argv[2];
const jobs = [];
for (const [k, [who, d, look]] of Object.entries(c)) {
  if (f && !k.startsWith(f) && !f.split(',').includes(k)) continue;
  for (const n of [1, 2]) jobs.push({ name: `${k}-v3-${n}`, prompt: style(d, look), aspect: '3:4' });
}
process.stdout.write(JSON.stringify(jobs, null, 1));
