// 쇼케이스 태오 새 얼굴 후보(아이돌 틀) 원고 — git 밖 .tmp/taeo-face-nb에서 돌린 일감 생성기 사본. 고른 얼굴은 덧니 선배(taeo-snaggle) 1판.
// 쇼케이스 태오 새 얼굴 후보(11-02) — 유호님 「후보 구워 봐」: PULSE 아이돌을 만든 틀(장부 S41: 하이키 앞빛 + 금빛 역광 · 기획사 손질 · 진짜 피부)을
// 학생 식당 드라마 장면에 옮겨, 참조 없이 글로만 새 얼굴 셋 × 두 판. 남자 아이돌 넷(M1 아몬드 눈웃음 + 굵은 눈썹 · M2 처진 강아지 눈 + 사과 볼 ·
// M3 여우 눈 + 얇은 윗입술 · M4 무쌍 + 비뚤 웃음)과 겹치지 않는 특징을 고른다. node jobs.mjs → jobs.json
import fs from 'node:fs';
const D = 'C:/Users/q1212/Documents/SYNK-appsscript/.tmp/taeo-face-nb';

const OPEN = `Create one photograph, vertical 9:16. A still from a bright, fresh Korean romance drama, shot by a top Seoul drama crew. KWON TAE-O, a third-year Korean university student, about 23, the friendly, playful senior everyone likes. He is strikingly handsome in a K-drama-lead way, the kind of face that makes a viewer want to talk to him, with his own clearly distinct, original face.`;

const FACES = {
  dimple: `His face is a clean oval with a softly defined jaw and a straight, neat nose. Two features must be clearly visible: soft crescent eye-smile eyes with gentle inner double eyelids (the fold shows only toward the outer half); and ONE deep dimple low on his left cheek, a soft dent in the skin that appears when he smiles (never a dark dot or a mole). Short, soft black hair, tousled, with light, slightly messy bangs falling over his brows.`,
  snaggle: `His face is a slim oval with a clean jaw and slightly full cheeks. Two features must be clearly visible: bright, open almond eyes with clear double eyelids, looking straight and warm; and a boyish grin in which one upper canine sits slightly forward (a small natural snaggletooth, a Korean "deotni") that shows whenever he smiles. Dark brown hair, soft and airy, with bangs parted slightly off-centre so a little of his forehead shows.`,
  actor: `His face is a lean, slightly long face with a defined jaw, high cheekbones and a tall, straight nose bridge, an actor's face more than an idol's. Two features must be clearly visible: calm, slightly hooded eyes with a fine inner double eyelid, so his gaze looks gentle and a little sleepy; and a faint natural shadow of stubble along his jaw and upper lip. Natural black hair, short at the sides with soft longer bangs swept to one side.`,
};

const MOMENT = `He wears a navy university varsity jacket with cream sleeves and striped navy-and-cream cuffs, with a small embroidered crest on the left chest (a simple shield with a stylized open book and one small star inside, no lettering) over a plain, flat light-grey cotton-jersey hoodie with white drawstrings, the hood lying flat on his shoulders. No earrings, no piercings, no jewelry.
THE MOMENT: lunchtime in a bright university cafeteria in the first week of March. Tae-o sits across a long pale table from the viewer; only the front edge of his stainless-steel lunch tray shows at the bottom of the frame. He has just looked up at the viewer with a warm, closed-lip smile that is starting to grow, eyes bright and friendly, looking straight into the lens. Hands below the frame.
CAMERA: eye level across the table, about 1 m away, 50mm, chest-up; his face in the upper third of the frame and about a third of the frame wide.`;

const LIGHT = `Light and color: bright, high-key, fresh and clear. A large soft frontal light from the tall windows falls evenly on both sides of his face; a warm golden backlight from the windows behind him makes the edges of his hair glow; a gentle bloom only on the brightest highlights; a clean grade with lifted, milky-bright shadows. Nothing grey, dull or muddy; no film grain; no haze over his face.
Grooming by a top agency team, natural for a man: neat natural brows, an even skin tone, the faintest lip tint. The skin must look like an unretouched real photograph: visible pores on his nose and cheeks, fine peach fuzz caught by the backlight, a natural soft sheen, tiny natural unevenness; absolutely no porcelain, airbrushed or plastic skin. No moles, freckles or dots on his face. Natural dark-brown irises. A few flyaway hairs catch the light.
Background: the cafeteria behind him is soft and out of focus, long tables and a few students eating, nobody looking at the camera; through the windows, bare trees with thin dark branches and only a few tiny yellow sansuyu blossoms; no green leaves and no cherry blossoms.
He must not resemble any real actor, idol, model or public figure. No text, letters, logos or watermarks anywhere. No border.`;

const jobs = [];
for (const [k, face] of Object.entries(FACES)) {
  jobs.push({ id: `taeo-${k}`, ratio: '9:16', refs: [], prompt: [OPEN, face, MOMENT, LIGHT].join('\n'), out: `${D}/out/taeo-${k}_g{n}.png` });
}
for (const j of jobs) if (j.prompt.length > 4300) throw new Error(`${j.id} ${j.prompt.length}자 — 4,300자 넘음`);
fs.writeFileSync(`${D}/jobs.json`, JSON.stringify(jobs, null, 1));
console.log(jobs.map((j) => `${j.id} ${j.prompt.length}자`).join('\n'));
