#!/usr/bin/env node
/**
 * 입장 검사 펠트 자산 굽기 — 도장·짐·손님·근무지 장면을 GPT Image 2.5로 굽는다.
 *
 * 원칙은 docs/디자인/펠트부품/README.md와 같다.
 *  - 승인 펠트(몽글 본체·펠트 노트북)를 참조로 줘서 브랜드 펠트와 같은 재질로 맞춘다.
 *  - 같은 종류는 한 판에 함께 굽는다(실·빛·털 결을 맞추려고).
 *  - 글자는 굽지 않는다. 화면 글자로 얹는다.
 *  - 근무지 장면은 승인된 게임 방향(먼 풍경은 회화, 가까운 물건은 펠트, 2026-09-19)을 따른다.
 *  - 종량제라 --유료-api 없이는 만들지 않는다.
 *
 *   node experiences/entry-check/art-source/bake.mjs --목록
 *   node experiences/entry-check/art-source/bake.mjs --판 도구 --유료-api
 * 결과: art-source/raw/<판>_<시각>.png (git 제외) + art-source/생성기록.json
 * 열쇠: C:\Users\q1212\SYNK_보안\openai.txt (git 밖). env OPENAI_KEY_FILE로 바꾼다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const MODEL = 'gpt-image-2.5-sunburst';
const RATE = { input: 8 / 1e6, output: 30 / 1e6 }; // 펠트부품GPT굽기.js와 같은 참고 요율(실제 청구액 아님)
const KRW = 1470;
const KEY_FILE = process.env.OPENAI_KEY_FILE || 'C:\\Users\\q1212\\SYNK_보안\\openai.txt';

const REF = {
  mongle: 'docs/디자인/SNS키트/assets/mascot-몽글_본체.webp',
  laptop: 'docs/디자인/SNS키트/assets/felt-laptop.webp',
  kkamong: 'docs/디자인/SNS키트/assets/mascot-까몽_본체.webp',
  marin: 'docs/디자인/SNS키트/assets/mascot-마린_본체.webp',
};

const PARTS = [
  'Studio product photograph of real handmade needle-felted wool craft pieces on a pure white background.',
  'Soft, even, diffused top light with gentle soft contact shadows. Visible short wool fibers, a slight fuzz halo, real thickness and soft rounded edges.',
  'Match the exact felt material, fiber texture, color warmth and lighting of the reference photos (REFERENCE 1 coral felt ghost, REFERENCE 2 felt laptop). Same studio, same maker.',
  'Each piece is separate with generous white space between pieces (at least 8% of the image), nothing touching, nothing cropped by the frame.',
  'Absolutely no letters, numbers, words, logos or brand marks anywhere. Clean, premium, minimal craft quality. No hands, no table texture, no extra props.',
].join(' ');

// 투명 바탕 부품: 흰 바탕에서 구우면 오릴 때 바닥 그림자가 옅은 흰 번짐으로 남는다(2026-10-02 진한 바탕 시트에서 확인)
const PARTS_CLEAR = [
  'Studio product photograph of real handmade needle-felted wool craft pieces, each isolated on a fully transparent background.',
  'Soft, even, diffused light. Visible short wool fibers, a subtle natural fuzz halo, real thickness and soft rounded edges. NO ground shadow, NO floor, NO backdrop.',
  'Match the exact felt material, fiber texture, color warmth and lighting of the reference photos (REFERENCE 1 coral felt ghost, REFERENCE 2 felt laptop). Same studio, same maker.',
  'Each piece is separate with generous empty space between pieces (at least 8% of the image), nothing touching, nothing cropped by the frame.',
  'Absolutely no letters, numbers, words, logos or brand marks anywhere. Clean, premium, minimal craft quality. No hands, no extra props.',
].join(' ');

const CAST = [
  'Studio photograph of handmade needle-felted wool animal doll characters for a cozy story game, each standing upright on a transparent background, straight-on front view at the eye level of the character (NOT from above), full body visible from the top of the ears to the feet.',
  'Premium collectible art-doll quality: dense short wool fibers, a subtle fuzz halo, small glossy black bead eyes, tiny embroidered or felted mouths, soft sculpted volumes, clothes made of felt and fine knit with neat tiny stitches.',
  'Match the felt material, fiber texture, bead eyes, color warmth and soft studio lighting of the reference mascots, but DO NOT copy their shapes or colors; these are new characters.',
  'Warm soft key light from the upper left, gentle shading. Each character keeps a natural, expressive, distinct personality and silhouette; they must not look alike.',
  'Arms relaxed at the sides unless described otherwise. Hands and paws are empty: they hold nothing unless described.',
  'Generous empty space between characters; nothing touching, nothing cropped. No text, no numbers, no logos, no props on the ground, no floor, no background scenery.',
].join(' ');

const SCENE = [
  'Wide cinematic game background painting for a cozy Korean-learning game, 3:2 landscape. Hybrid art direction:',
  'the FAR scenery (sky, clouds, distant city, distant trees and hills) is a refined painterly illustration with soft brushwork, atmospheric perspective and generous calm space;',
  'the NEAR objects (entrance gate, building facade details close to the viewer, planters, benches, queue posts and ropes, signboards, flowers, paving edge) are real handmade needle-felted wool with visible short fibers, real thickness and soft contact shadows, like a felt diorama.',
  'Camera: eye-level view from a small ticket booth looking straight out at the entrance across a quiet paved forecourt. The lower-middle third of the image is an EMPTY clear paved area where a visitor will stand (no people, no animals, no objects there).',
  'Warm, gentle light; harmonious palette built around coral #F96859, warm cream #FBF7F0, lapis blue #3D6BC9, butter yellow #F5C445 and meadow green #7DB45A, never garish.',
  'All signboards, banners and posters are BLANK shapes: absolutely no letters, numbers, words, logos or symbols anywhere. No people, no characters, no animals. No UI, no frame, no border.',
].join(' ');

const BOARDS = {
  도구: {
    kind: 'parts', size: '2048x2048', refs: ['mongle', 'laptop'],
    note: '도장 두 개, 판정 원판 두 개, 돋보기, 탁상시계, 메모, 호출벨, 반응 스티커(하트·땀방울·반짝), 압정 세 개',
    prompt: [
      'Arrange these 14 pieces in a neat grid of 4 rows, evenly spaced, viewed from a slight three-quarter angle above so their thickness shows:',
      'Row 1: (1) a chunky rubber stamp made of felt: a rounded knob handle in warm cream wool on a short neck, mounted on a rectangular stamp block of meadow green felt (#7DB45A), the block about 1.6 times wider than tall, the stamp face hidden underneath; (2) the identical stamp with a coral felt block (#F96859); (3) a round meadow green felt disc with a white felt check-mark appliqué sewn on with tiny visible white running stitches; (4) a round coral felt disc with a white felt X cross appliqué sewn on with tiny visible white running stitches.',
      'Row 2: (5) a felt magnifying glass: thick cream felt ring rim, pale sky-blue felt lens with a soft highlight, butter yellow felt handle; (6) a small round desk clock: cream felt face with a coral felt rim, twelve tiny stitched dots around the edge instead of numbers, two short black stitched hands, two little round feet; (7) a small folded memo note of cream felt with two short stitched lines like text lines, a tiny coral felt push pin at the top; (8) a small service desk bell: butter-yellow felt dome on a round cream felt base with a small felt button on top.',
      'Row 3: (9) a puffy coral felt heart; (10) a lapis blue felt sweat-drop shape (teardrop); (11) a butter yellow felt four-point sparkle star; (12) three small round cream felt dots joined in a short row as one piece, like a thinking ellipsis.',
      'Row 4: (13) a round coral felt ball push pin with a short silver needle; (14) the same push pin in butter yellow felt.',
    ].join(' '),
  },
  짐1: {
    kind: 'parts', size: '2048x2048', refs: ['mongle', 'laptop'],
    note: '수영 모자, 물병, 김밥, 과자 봉지, 수건, 튜브, 도서관 카드, 수영장 카드, 책',
    prompt: [
      'Arrange these 9 small felt objects in a neat 3×3 grid, evenly spaced, each about the same visual size, simple iconic silhouettes readable at small size, gentle three-quarter front view:',
      'Row 1: (1) a swim cap in lapis blue felt (#3D6BC9), dome shape with a soft rim; (2) a plastic water bottle made of pale aqua translucent-looking felt with a lapis blue felt screw cap and a plain cream label band (no text); (3) a Korean gimbap roll on its side with two cut slices in front showing white rice and colorful fillings (egg yellow, carrot orange, spinach green), wrapped in dark seaweed felt.',
      'Row 2: (4) a crinkled snack chip bag in butter yellow felt with a sealed zigzag top edge, completely blank; (5) a neatly rolled bath towel with coral and cream stripes; (6) an inflatable swim ring (donut float) with coral and cream stripes.',
      'Row 3: (7) a rectangular membership card in cream felt with a lapis blue felt stripe along the top, a small coral felt photo square on the left and three short stitched lines on the right (no text); (8) a rectangular membership card in pale aqua felt with a white felt wave shape appliqué on the left and three short stitched lines on the right (no text); (9) a closed hardcover book in lapis blue felt with cream felt pages visible on the side.',
    ].join(' '),
  },
  짐2: {
    kind: 'parts', size: '2048x2048', refs: ['mongle', 'laptop'],
    note: '뚜껑 있는 커피, 뚜껑 없는 커피, 카메라, 휴대폰, 작은 가방, 돗자리, 접이식 의자, 우산',
    prompt: [
      'Arrange these 8 small felt objects in a neat grid (3 in row 1, 3 in row 2, 2 in row 3), evenly spaced, each about the same visual size, simple iconic silhouettes readable at small size, gentle three-quarter front view:',
      'Row 1: (1) a takeaway coffee cup in cream felt with a brown felt sleeve and a clearly visible WHITE plastic-like felt LID on top; (2) the same cup WITHOUT any lid, open top showing the round brown coffee surface; (3) a compact camera in charcoal black felt with a large round lens and a coral felt strap.',
      'Row 2: (4) a smartphone in charcoal black felt, a thin rounded slab with a dark glossy-looking screen side; (5) a small crossbody purse in coral felt with a thin strap; (6) a rolled picnic mat in a butter yellow and cream gingham check, tied with a coral strap.',
      'Row 3: (7) a small folding camping chair, lapis blue felt seat and back with light wood-colored felt legs, shown unfolded; (8) a closed long umbrella in coral felt with a curved hook handle.',
    ].join(' '),
  },
  손님1: {
    kind: 'cast', size: '2048x2048', refs: ['mongle', 'kkamong', 'marin'],
    note: '곰 대학생, 너구리 아저씨, 토끼 할머니, 여우 회사원',
    prompt: [
      'Four characters in a 2×2 grid, each centered in its own quarter with large empty margins. Adults are about the same height.',
      'TOP LEFT: a young brown bear university student, round black-rimmed glasses, butter-yellow hooded sweatshirt, cream trousers, a bright friendly open smile.',
      'TOP RIGHT: a middle-aged raccoon man with the classic dark eye mask markings, a coral and cream striped polo shirt over a small round belly, a sly grin with one eyebrow raised.',
      'BOTTOM LEFT: an elderly white rabbit grandmother with long ears, tiny round gold glasses, a lavender knitted cardigan with a small pearl necklace, a gentle closed-eye smile, holding a short wooden walking cane in one paw.',
      'BOTTOM RIGHT: a slim red fox office worker in a navy suit jacket, white shirt and lapis blue tie, a slightly hurried, tired but polite expression.',
    ].join(' '),
  },
  손님2: {
    kind: 'cast', size: '2048x2048', refs: ['mongle', 'kkamong', 'marin'],
    note: '아기 다람쥐(6살), 고슴도치 어린이(9살), 펭귄, 오리 엄마와 아기 오리',
    prompt: [
      'Four characters in a 2×2 grid, each centered in its own quarter with large empty margins. Children are clearly smaller than adults.',
      'TOP LEFT: a little squirrel child about six years old (height about 55% of an adult), denim overalls over a cream striped shirt, a big fluffy tail, very big shiny eyes and a cheeky toothy grin.',
      'TOP RIGHT: a hedgehog child about nine years old (height about 65% of an adult), soft brown felt spikes, a meadow green t-shirt with a small cream felt star appliqué, a proud confident pose with chin up.',
      'BOTTOM LEFT: a cheerful young penguin (adult height) wearing a coral knitted beanie, one flipper raised in a friendly wave.',
      'BOTTOM RIGHT: a white duck mother (adult height) wearing a butter-yellow knitted scarf, holding the wing of a small fluffy yellow duckling child (height about 40% of the mother) standing beside her; both look happy. This pair is ONE unit in this quarter.',
    ].join(' '),
  },
  손님3: {
    kind: 'cast', size: '2048x2048', refs: ['mongle', 'kkamong', 'marin'],
    note: '수달 할아버지, 사슴 예술가, 판다 중학생(15살), 양 아가씨',
    prompt: [
      'Four characters in a 2×2 grid, each centered in its own quarter with large empty margins.',
      'TOP LEFT: an elderly otter grandfather with grey whiskers, a tweed flat cap, a cream knitted vest over a pale blue shirt, a wooden walking cane in one paw, a proud stubborn expression with chest puffed out.',
      'TOP RIGHT: a slender young deer artist with small rounded antlers, a black beret and a long coral scarf, a calm, dreamy expression.',
      'BOTTOM LEFT: a panda middle-school student about fifteen years old (height about 85% of an adult), navy school blazer, white shirt, small lapis tie, an earnest slightly nervous smile.',
      'BOTTOM RIGHT: a fluffy cream sheep young woman with lapis blue headphones resting around her neck, a pale pink dress, an excited happy expression.',
    ].join(' '),
  },
  수영장: {
    kind: 'scene', size: '1536x1024', refs: ['mongle', 'laptop'],
    note: '하늘 수영장 입구 — 여름 낮',
    prompt: 'SCENE: the entrance of a bright outdoor public swimming pool on a clear summer afternoon. Painterly far: high blue sky with soft white summer clouds, distant green hills and a few light city buildings. Felt near: a low coral and cream striped awning over the entrance gate, a white felt railing, glimpses of turquoise pool water and a lifeguard chair through the gate, potted palm and monstera plants in felt, a blank lapis blue sign shape above the gate, two queue posts with a soft coral felt rope.',
  },
  도서관: {
    kind: 'scene', size: '1536x1024', refs: ['mongle', 'laptop'],
    note: '별빛 도서관 입구 — 늦은 오후',
    prompt: 'SCENE: the entrance of a charming neighborhood library in the late afternoon golden hour. Painterly far: warm peach and lavender sky, tall trees with soft foliage, distant rooftops. Felt near: a warm red-brick and cream felt facade with tall arched windows glowing with warm interior light, wooden double doors slightly open, bookshelves visible inside, a blank cream signboard shape, felt flower planters, a bicycle rack with no bicycles, two queue posts with a lapis felt rope.',
  },
  미술관: {
    kind: 'scene', size: '1536x1024', refs: ['mongle', 'laptop'],
    note: '바람 미술관 입구 — 맑은 낮',
    prompt: 'SCENE: the entrance of a modern art museum on a crisp clear day. Painterly far: pale blue sky with long soft clouds, a distant sea horizon on one side. Felt near: a curved white and cream felt building facade with a tall glass entrance, two tall BLANK vertical banner shapes in coral and lapis hanging beside the door, a small abstract felt sculpture of round stacked shapes on a plinth, neat felt shrubs, two queue posts with a coral felt rope.',
  },
  음악회: {
    kind: 'scene', size: '1536x1024', refs: ['mongle', 'laptop'],
    note: '노을 공원 음악회 입구 — 해 질 녘',
    prompt: 'SCENE: the entrance gate of an outdoor summer concert in a city park at sunset. Painterly far: a glowing coral, peach and lavender sunset sky, a small distant stage with warm lights, soft silhouettes of trees and a city skyline. Felt near: a felt archway gate wrapped with warm string lights (felt bulbs), a blank butter-yellow banner shape across the arch, rolled felt grass lawn edges, felt flower beds, two queue posts with a butter felt rope.',
  },
};

const args = (() => { const a = process.argv.slice(2); const o = {}; for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[i + 1] : true; return o; })();

function key() {
  if (!fs.existsSync(KEY_FILE)) throw new Error('열쇠 파일이 없다: ' + KEY_FILE);
  const m = String(fs.readFileSync(KEY_FILE, 'utf8')).match(/sk-[A-Za-z0-9_\-]{20,}/);
  if (!m) throw new Error('열쇠 파일에 sk- 값이 없다');
  return m[0];
}
// 투명 바탕 참조는 모델이 빈 그림으로 읽는다 → 흰 바탕 JPEG로 바꿔 준다(tools/펠트부품GPT굽기.js와 같은 처방)
function ref(name) {
  const dst = path.join(here, 'ref', `${name}.jpg`);
  if (!fs.existsSync(dst)) {
    const r = spawnSync('python', ['-c', `
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA')
bg = Image.new('RGB', im.size, (255,255,255)); bg.paste(im, mask=im.split()[3])
bb = Image.new('L', im.size, 0); bb.paste(im.split()[3]); box = bb.getbbox(); bg = bg.crop(box) if box else bg
m = max(bg.size)
if m > 1280: r = 1280/m; bg = bg.resize((round(bg.width*r), round(bg.height*r)), Image.LANCZOS)
pad = Image.new('RGB', (bg.width+120, bg.height+120), (255,255,255)); pad.paste(bg, (60,60)); pad.save(sys.argv[2], 'JPEG', quality=92)
`, path.join(repo, REF[name]), dst], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error('참조 만들기 실패: ' + r.stderr);
  }
  return dst;
}

async function bake(name) {
  const board = BOARDS[name];
  if (!board) throw new Error('--판 ' + Object.keys(BOARDS).join('|'));
  const transparent = board.kind === 'cast' || (board.kind === 'parts' && args.투명);
  const common = board.kind === 'parts' ? (transparent ? PARTS_CLEAR : PARTS) : board.kind === 'cast' ? CAST : SCENE;
  const fd = new FormData();
  fd.append('model', MODEL);
  fd.append('prompt', `${common} ${board.prompt}`);
  fd.append('size', board.size);
  fd.append('n', '1');
  if (transparent) { fd.append('background', 'transparent'); fd.append('output_format', 'png'); }
  for (const r of board.refs) fd.append('image[]', new Blob([fs.readFileSync(ref(r))], { type: 'image/jpeg' }), `${r}.jpg`);
  const t0 = Date.now();
  const res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key()}` }, body: fd });
  const j = await res.json();
  if (j.error) throw new Error(`${name}: ${j.error.message}`);
  fs.mkdirSync(path.join(here, 'raw'), { recursive: true });
  const file = `${name}${board.kind === 'parts' && transparent ? '투명' : ''}_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
  fs.writeFileSync(path.join(here, 'raw', file), Buffer.from(j.data[0].b64_json, 'base64'));
  const u = j.usage || {};
  const usd = (u.input_tokens || 0) * RATE.input + (u.output_tokens || 0) * RATE.output;
  const logFile = path.join(here, '생성기록.json');
  const log = fs.existsSync(logFile) ? JSON.parse(fs.readFileSync(logFile, 'utf8')) : [];
  log.push({ 시각: new Date().toISOString(), 판: name, 종류: board.kind, 모델: MODEL, 크기: board.size, 파일: `raw/${file}`, 칸: `${u.input_tokens || 0}+${u.output_tokens || 0}`, 참고값_달러: +usd.toFixed(4), 참고값_원: Math.round(usd * KRW), 걸린초: Math.round((Date.now() - t0) / 1000), 설명: board.note });
  fs.writeFileSync(logFile, JSON.stringify(log, null, 1));
  console.log(`구움 ${name} → raw/${file} · 칸 ${u.input_tokens || 0}+${u.output_tokens || 0} · 참고값 약 ${Math.round(usd * KRW)}원`);
}

if (args.목록) { for (const [k, v] of Object.entries(BOARDS)) console.log(`${k} (${v.kind} ${v.size}): ${v.note}`); process.exit(0); }
if (!args['유료-api']) { console.log('생성 안 함: GPT Image 2.5 종량제다. 한 판 대략 60~200원. 실행하려면 --유료-api'); process.exit(0); }
const names = String(args.판 || '').split(',').filter(Boolean);
if (!names.length) throw new Error('--판 이름[,이름…]');
const results = await Promise.allSettled(names.map(bake));
for (const [i, r] of results.entries()) if (r.status === 'rejected') { console.error(`실패 ${names[i]}: ${r.reason.message}`); process.exitCode = 1; }
