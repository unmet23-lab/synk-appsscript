// 선배 소개 시안에 드는 그림의 지시문(11-17). 정한 얼굴을 참고 그림으로 넣어 Gemini 웹 「카본」으로 굽는다.
//   node experiences/drama/qa/선배소개-20261117/그림.mjs   → 공용 작업본 .tmp/senior-f-face/jobs.json에 이 작업들을 더한다(같은 id는 바꿔 쓴다)
//   bash .tmp/senior-f-face/돌림2.sh "intro-taeo intro-yuna selfie-yuna2 today-yuna2"
// 게시판 사진은 「정면 얼굴 사진 대신 학교에서 무언가를 하고 있는 사진」이다(이야기 지도 3-5 지킬 것 5).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const { 공용작업본 } = createRequire(import.meta.url)(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
const W = path.join(공용작업본(뿌리), '.tmp', 'senior-f-face').replace(/\\/g, '/');
const 태오 = path.join(공용작업본(뿌리), '.tmp', 'taeo-face-nb', 'out', 'taeo-snaggle_g1.png').replace(/\\/g, '/');
const 유나 = `${W}/out/sf2-pony_g1.png`;
const 학생 = `${W}/ref/student.jpg`;

const 점퍼 = 'a navy university varsity jacket with cream sleeves and striped navy-and-cream cuffs, with a small embroidered shield crest on the left chest (no lettering)';
const 끝 = 'Photorealistic, natural colour, true skin texture, no beauty-filter smoothing. No captions, no subtitles, no watermark, no logo. Any signs or printed paper in the scene are too far or too soft to read. Hands have five natural fingers.';

// 셀카 1판은 창을 등지고 앉아 얼굴에 빛이 평평했고, 정한 얼굴보다 수수하게 나왔다. 2판은 창을 마주 보게 앉히고 정한 얼굴의 화장과 얼굴선을 지키라고 적었다.
const 예쁨 = 'She must look exactly as attractive as in her reference image: the same slim oval face, the same defined straight brows, subtle eyeliner and soft coral lip, the same luminous clear skin. Do not make her face rounder, older or plainer.';

export const 작업 = [
  {
    id: 'intro-taeo', ratio: '4:3', refs: [태오],
    prompt: `Use the attached image only as the identity reference for the young man: keep exactly his face, his brown hair with the soft fringe, and his build. Make a new photo.

A candid snapshot a friend took with a phone on a Korean university campus in early March, late-afternoon sun. A row of white booth tents is being set up along a tree-lined campus walkway for the club fair. The young man is in the middle of working: he carries a stack of three folded white plastic chairs hooked on his right shoulder, walking toward the right. He is seen from the side and slightly behind, laughing with his mouth open at a friend who is out of frame, so we see his face in three-quarter profile. He is not looking at the camera and not posing. He is small in the frame: his whole body is visible and takes up a little under half of the frame height. Two other students in the background are tying a banner to a tent pole, out of focus.

He wears ${점퍼} over a light grey hoodie, dark jeans and white sneakers.

It must read as a real, slightly imperfect phone snapshot: a little off-centre, a tent pole cutting into the left edge, natural motion in his step, warm low sun with long shadows, bare branches with the first small yellow sansuyu blossoms. ${끝}`,
  },
  {
    id: 'intro-yuna', ratio: '4:3', refs: [유나],
    prompt: `Use the attached image only as the identity reference for the young woman: keep exactly her face and her black hair tied in a high ponytail. Make a new photo.

A candid snapshot a friend took with a phone on a Korean university campus in early March, late-afternoon sun. The young woman is walking fast across the plaza just inside the main gate, passing the large campus map board that stands on two posts. She carries an open cardboard box full of printed flyers against her hip with both arms. She is seen from the side, mid-stride, her ponytail swinging behind her, her eyes on where she is going and her mouth closed in a small calm half-smile. She is not looking at the camera and not posing. She is small in the frame: her whole body is visible and takes up a little under half of the frame height. Two students in the background stand in front of the map board looking at it, out of focus.

She wears ${점퍼}, worn open over a plain white T-shirt, straight dark jeans and white sneakers. No jewellery.

It must read as a real, slightly imperfect phone snapshot: a little off-centre, slight motion blur in her trailing foot and in the ponytail tip, warm low sun with long shadows, bare branches with the first small yellow sansuyu blossoms. ${끝}`,
  },
  {
    id: 'selfie-yuna2', ratio: '3:4', refs: [유나, 학생],
    prompt: `Two attached images are identity references. Image 1 is the SENIOR: keep exactly her face and her black high ponytail. Image 2 is the FRESHMAN: keep exactly her face and her age (about twenty), her long brown hair and her lilac hoodie. Make a new photo of the two of them together.

A front-camera phone selfie at a table in a bright Korean university cafeteria at lunchtime in early March. They sit side by side facing the tall window wall, so soft daylight falls on both faces from the front. The SENIOR is the one holding the phone: her right arm reaches toward the lens and leaves the frame at the lower right corner. The FRESHMAN sits close on the left side of the frame, leaning in toward the senior so their shoulders touch.

The freshman smiles brightly with her teeth showing and holds up a small clenched "fighting" fist next to her cheek. The senior makes the same fist with her free left hand but more lazily, at shoulder height, with a closed-lip half-smile, one corner of her mouth higher than the other and one eyebrow slightly raised, as if she is going along with it. Both look into the lens. ${예쁨}

The senior wears ${점퍼}, worn open over a plain white T-shirt. No jewellery. In the bottom of the frame are two steel cafeteria trays with rice, seaweed soup, kimchi and seasoned greens. Behind them is the cafeteria interior: other students eating at long tables, softly out of focus, warm ceiling lights.

Light: large soft window light on both faces from the front, a thin warm rim on their hair from the ceiling lights behind, gentle bloom on the highlights only, milky soft shadows. It must still read as a real front-camera selfie, but held at full arm's length so the faces are not stretched; faces in the top two-thirds of the frame. ${끝}`,
  },
  {
    // 식당 스틸(맞은편 자리에서 본 넓은 컷). 1판(today-yuna)은 「말하는 도중이라 입술이 조금 벌어진」 표정을 시켰더니 정한 얼굴보다 밋밋하게 나왔다.
    // 2판은 정한 사진의 입 다문 반쯤 웃는 표정을 그대로 지키게 하고, 몸을 조금 틀어 빛이 한쪽에서 들어오게 했다.
    id: 'today-yuna2', ratio: '9:16', refs: [유나],
    prompt: `Use the attached image as the identity and setting reference: keep exactly this young woman's face, her black high ponytail, her clothes and this cafeteria. Make a new photo of a different moment at the same table.

Eye-level medium shot from the seat directly across the table, as if the viewer is the freshman sitting opposite her. She sits in the bright Korean university cafeteria at lunchtime in early March. She has just noticed the viewer and is about to speak: she keeps exactly the expression of the reference image, a warm closed-lip half-smile with one corner of her mouth a little higher, her eyes smiling slightly and looking into the lens, her head tilted a few degrees. ${예쁨} Her right hand holds a pair of steel chopsticks loosely above her tray, and her left hand rests flat on the table. Her body is turned about fifteen degrees to her left with her face turned back to the camera, and she leans forward a little, attentive.

She wears ${점퍼}, worn open over a plain white cotton T-shirt. No jewellery. On the table in front of her is a steel cafeteria tray with rice, soup, kimchi and seasoned greens; the near edge of the viewer's own steel tray is at the very bottom of the frame. Behind her, students eat at long tables, softly out of focus, and tall windows show bare branches with small yellow sansuyu blossoms. Every background person has a complete, natural head and body.

Light: large soft window light on her face from the front-left so the right side of her face falls into a gentle soft shadow, a thin warm rim of backlight on her hair and shoulder from the windows behind, gentle bloom on the highlights only, milky soft shadows. 85mm lens look at f/2.2 with the background clearly out of focus. Vertical frame; she sits slightly left of centre with headroom above, her face in the upper third and no larger than one fifth of the frame height. ${끝}`,
  },
].map((j) => ({ ...j, model: 'carbon', out: `${W}/out/${j.id}.png` }));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const f = `${W}/jobs.json`;
  const 있던 = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
  const 이름들 = new Set(작업.map((j) => j.id));
  fs.writeFileSync(f, JSON.stringify([...있던.filter((j) => !이름들.has(j.id)), ...작업], null, 1));
  for (const j of 작업) console.log(j.id, j.ratio, '참고', j.refs.length, '글자', j.prompt.length, j.refs.every((r) => fs.existsSync(r)) ? '' : '· 참고 그림 없음');
}
