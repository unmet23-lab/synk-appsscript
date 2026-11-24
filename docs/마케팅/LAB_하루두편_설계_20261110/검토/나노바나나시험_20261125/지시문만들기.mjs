// 나노바나나(Gemini 웹 카본) 시험 지시문 — LAB 덥다뜨겁다(M48) 판 지시문(판/_지시문만들기.py)을 Gemini 웹 한도(4,300자 · 한 줄)에 맞게 줄였다.
// GPT 판과 조건은 같다: 입 · 팔다리 없는 몽글, 양머리 수건, 펠트 계란, 위 24% 빈 벽, 고리 · 구멍 · 빽빽한 점 무늬 없음, 글자 없음.
// 쓰는 법: node 지시문만들기.mjs → 같은 폴더에 <이름>.txt, 길이를 찍는다.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

const COMMON = [
  'Create exactly ONE image: a photo of a handmade needle-felt miniature diorama, one panel of a vertical comedy short.',
  'Copy only the craft style, light and scale of the felt reference photo, not its place or people.',
  'Warm golden-amber light, shallow depth of field, cosy felt-and-wool textures everywhere.',
  'WORLD: a tiny felt Korean jjimjilbang (bathhouse) rest hall seen from floor level, fixed camera low and straight-on.',
  'The floor is plain smooth warm amber heated-floor mats (no dots, holes or woven pattern).',
  'Behind: a warm wooden plank wall; at the right back the arched doorway of a felt kiln sauna room glowing soft orange.',
  'A few soft smooth curls of warm steam (smooth wisps, never dots). It is very hot: faces flushed.',
  'The TOP 24% of the image is plain warm wooden wall with nothing on it (no signs, lamps or clock).',
  'THE TWO FRIENDS: two needle-felted Korean young-adult dolls (round heads, small black bead eyes, rosy cheeks, real little arms and legs) in loose short-sleeve T-shirts and shorts of soft peach-orange felt.',
  'Each wears a cream terry towel folded on the head in the Korean sheep-head style: a smooth band with two plump rounded side puffs like sheep ears, fully covered in smooth terry nap, with no rolled ends, no spiral or swirl lines and no ring shapes.',
  'THE GIRL (black hair bun under the towel) sits on the mat at the LEFT back fanning herself with a small plain paper fan. THE BOY (short black hair) sits at the RIGHT back.',
  'MONGLE: a small coral-pink felt blob mascot. Copy the mascot reference only for its body shape, coral wool colour, fine short smooth felted fuzz, scalloped bottom hem with a thin neat cream running stitch and glossy black bead eyes (no white sclera; closed eyes are two short curved dark stitched lines).',
  'Mongle has NO arms, NO legs, NO hands, NO neck and NO MOUTH, ever: head and body are one soft dome, and feelings show only through the two bead eyes, body colour and posture. No curly loops or ring-shaped curls in its wool.',
  'Mongle also wears a small cream terry sheep-head towel on top of its dome in the same style.',
  'THE EGGS: a small round bowl of brown felted wool holds five Korean roasted eggs (maekbanseok eggs) made of matte needle-felted wool with visible fibres and no shine: clear hen-egg ovals, deep chestnut-brown, each with two or three thin darker stitched crack lines.',
  'The top egg is half-peeled, showing smooth pale tan felt egg white, with two small curled brown shell pieces in the bowl, so they read instantly as roasted eggs. A thin smooth wisp of steam rises from the eggs. No sauna stones anywhere.',
].join(' ');

const TAIL = [
  'Only the characters named in this panel, nobody else.',
  'Everything is needle-felt and wool craft: no real food, no glossy realistic surfaces, no realistic wood grain.',
  'Absolutely no text, letters, numbers, symbols or watermarks anywhere. No logos.',
  'No rings, holes or dense dot patterns anywhere (no woven baskets, perforated panels, polka dots, speckled shells or bubbles).',
].join(' ');

const PANELS = {
  // 기준 판 — GPT k1(첫 판)과 k1d(세 번 고친 판)에 견준다. 참고: 몽글 정본 본체 · 펠트 결 참고
  nb_k1: {
    refs: 'Image 1 is the mascot reference. Image 2 is the felt craft-style reference.',
    body: 'THIS PANEL (the base panel): MONGLE sits on the mat in the CENTRE-LEFT foreground, its hem on the floor at about 80% of the image height, about 32% of the image width wide. The egg bowl sits right next to Mongle on the floor, CENTRE-RIGHT foreground. MONGLE leans its whole dome body sideways toward the egg bowl, curious and a little doubtful, its bead eyes looking down at the nearest egg; its scalloped hem is about a finger\'s width away from the nearest egg, NOT touching yet. The two friends in the back watch Mongle while fanning and sweating.',
    common: true,
  },
  // 빈 판 — GPT k0에 견준다. 참고: 나노바나나 기준 판
  nb_k0: {
    refs: 'Image 1 is a photo of a needle-felt diorama.',
    body: 'Recreate Image 1 as the SAME photograph: the same fixed camera, framing, hall, wall, kiln doorway, the two friends and their poses, the felt bowl, every felt egg, the steam and the light stay exactly as they are. Change only one thing: the small coral-pink felt blob with the towel (Mongle) is NOT in the picture at all. Where it sat, the warm amber felt mat simply continues naturally as empty floor. Do not add anything. No text anywhere.',
    common: false,
  },
  // 닿는 순간 가까이 — GPT k2(k2_082128)에 견준다. 참고: 나노바나나 기준 판 · 몽글 정본 놀람
  nb_k2: {
    refs: 'Image 1 is the base panel (the same Mongle, towel, bowl, eggs, mat and light). Image 2 is the surprised mascot reference (bigger round bead eyes, no mouth).',
    body: 'THIS PANEL: CLOSE-UP from floor level, the camera has moved in low beside the egg bowl. The LEFT 55% of the frame is MONGLE\'s body seen big and close: coral wool fibres, the cream sheep-head towel at the top-left, both glossy bead eyes popped bigger and rounder in shock like the surprised mascot reference, no mouth, NO sweat drop on the face. Mongle\'s scalloped bottom hem with the cream running stitch is PRESSED flat against the nearest chestnut-brown felt egg in the felt bowl on the right, the exact instant of touching, and a small sharp puff of white heat steam bursts out where the hem meets the shell. The hall behind is softly blurred warm amber; the top of the frame is blurred plain wooden wall. No friends visible.',
    common: true,
  },
  // 가까운 칸의 빈 판 — GPT k2e(k2e_085158)에 견준다. 참고: 나노바나나 가까운 판
  nb_k2e: {
    refs: 'Image 1 is a close-up photo of a needle-felt diorama.',
    body: 'Recreate Image 1 as the SAME photograph: the same close-up camera, framing, the felt bowl, every felt egg (the half-peeled one on top), the shell pieces, the steam above the eggs and the blurred background stay exactly as they are. Change only one thing: the big coral-pink felt blob with the towel (Mongle) on the left is NOT in the picture at all. Where its body was, show the softly blurred warm wooden wall and the warm amber felt mat continuing naturally behind and beside the bowl. No sweat drops, no splash, no new objects. No text anywhere.',
    common: false,
  },
  // 펄쩍 — GPT k3x(k3x_155920, > < 눈으로 고친 마지막 판)에 견준다. 참고: 나노바나나 기준 판 · 몽글 정본 뾰로통(> <)
  nb_k3: {
    refs: 'Image 1 is the base panel: reproduce its camera, framing, hall, friends, bowl and eggs. Image 2 is the squeezed-eye mascot reference (eyes as two sideways V-shaped stitches > <, no mouth).',
    body: 'THIS PANEL: same fixed camera as Image 1, the very next instant: MONGLE has JUMPED straight up off the mat in shock. Its whole body is in the air above the spot where it sat, its hem about 22% of the image height above the mat, with a clear gap of empty floor and a soft round shadow on the mat below it. Mongle is stretched a little taller, flushed bright red all over, both eyes squeezed tight in pain as dark stitched sideways V shapes like ">" and "<" exactly like the squeezed-eye reference, NO mouth, its sheep-head towel bounced up a little but still touching its head, NO sweat drops anywhere. A puff of white steam rises from the nearest egg and a thin wisp from Mongle\'s hem. The two friends in the back jolt in surprise, the girl\'s fan stopped mid-air, the boy\'s mouth open. The bowl and eggs are exactly where they were.',
    common: true,
  },
};

for (const [name, p] of Object.entries(PANELS)) {
  const text = (p.common ? [COMMON, p.refs, p.body, TAIL] : [p.refs, p.body]).join(' ').replace(/\s+/g, ' ').trim();
  writeFileSync(join(here, `${name}.txt`), text, 'utf8');
  console.log(name, text.length);
}
