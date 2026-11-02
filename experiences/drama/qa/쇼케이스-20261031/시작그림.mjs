// 쇼케이스 시작 그림(덧니 선배) 원고 — git 밖 .tmp/taeo-face-nb에서 돌린 일감 생성기 사본(차례.sh · gem21.mjs 실행기는 제2의나 결 실행기를 옮김).
// 쇼케이스 식당 시작 그림 셋 · 덧니 선배 판(11-02) — 유호님 「덧니선배 1판 2판이 제일 좋은데 ?」, 얼굴 참고는 1판(taeo-snaggle_g1): 칸 11 · 12 · 13의 구도를 9:16으로, 얼굴 · 피부 · 빛은 B(같은 태오 · 나노바나나 빛, 시작-T1a).
// 명세는 experiences/drama/qa/쇼케이스-20261031/지시문.mjs의 「시작」 칸(입 다문 미소 · 학생 손 · 수저 없음 · 손짓은 9:16 가운데 안).
// node jobs2.mjs → jobs.json에 start-* 일감을 더한다(앞 taeo-* 일감은 그대로).
import fs from 'node:fs';
const D = 'C:/Users/q1212/Documents/SYNK-appsscript/.tmp/taeo-face-nb';
const R = (f) => `${D}/refs/${f}`;

const HEAD = (pose) => `Make ONE new photograph, vertical 9:16: a photoreal still from a bright Korean campus romance TV drama.
Image 1 = a rough sketch of the scene: copy only its layout — where Kwon Tae-o is, ${pose}, the bright university cafeteria with tall windows, long tables and stainless-steel lunch trays. Do NOT copy its drawing style, its exaggerated grin or its glossy, smooth skin.
Image 2 = KWON TAE-O himself. This is THE SAME PERSON: keep his face exactly as in Image 2 — face shape, eyes and eyelids, brows, nose, lips, jawline — and his soft, airy dark-brown hair with bangs parted slightly off-centre. Take from Image 2 also the natural look of his skin and his warm, boyish smile. He stays just as handsome as in Image 2.
He wears a navy university varsity jacket with cream sleeves and striped navy-and-cream cuffs, a small embroidered crest on the left chest (a simple shield with a stylized open book and one small star, no lettering), over a light-grey hoodie with white drawstrings, and a black backpack strap over one shoulder.`;

const TAIL = `His expression: a warm, friendly CLOSED-LIP smile, lips together, eyes bright and looking straight into the lens.
The viewer is a freshman sitting at the table: only the front edge of her own stainless-steel lunch tray shows along the bottom edge of the frame — no hands, no arms, no spoon or chopsticks, no part of her body.
Keep all of his hands and the tray inside the middle of the vertical frame, nothing cut off at the sides.
LIGHT: March daylight from the tall cafeteria windows, soft and bright on his face, a gentle warm rim on his hair. Behind him the cafeteria is softly out of focus: long tables, students eating, nobody looking at the camera; through the windows, bare trees with thin dark branches and a few tiny yellow sansuyu blossoms — no green leaves, no cherry blossoms.
SKIN: real, unretouched young skin — visible pores on his nose and cheeks, fine peach fuzz, a natural soft sheen, tiny natural unevenness. Not porcelain, not airbrushed, no beauty filter, no moles or dots on his face.
He is an original person who must not resemble any real actor, idol or public figure. No text, letters, numbers or logos anywhere. No border. Hands have five fingers.`;

const 일감 = [
  { id: 'fstart-c1', ref: 'p11-hello.jpg',
    pose: 'standing next to the table',
    moment: `THE MOMENT: Tae-o stands beside the table, waist-up in the frame, holding his lunch tray level in his left hand at waist height, food on it. He has just spotted the freshman and his free right hand is starting to lift — at chest height, fingers relaxed, the moment just before a wave.` },
  { id: 'fstart-c3', ref: 'p12-intro.jpg',
    pose: 'sitting across the table',
    moment: `THE MOMENT: Tae-o sits across the table, a medium shot from mid-chest up, his own lunch tray with food in front of him. Both forearms rest on the table beside his tray, hands relaxed, not touching the tray or food. He is listening to the freshman.` },
  { id: 'fstart-c4', ref: 'p13-wave.jpg',
    pose: 'sitting across the table holding a spoon',
    moment: `THE MOMENT: Tae-o sits across the table, a medium shot from mid-chest up, his own lunch tray with food in front of him. His right hand lightly holds a metal spoon resting on the edge of his tray; his left forearm rests on the table. He is listening to the freshman between bites.` },
];

const jobs = JSON.parse(fs.readFileSync(`${D}/jobs.json`, 'utf8')).filter((j) => !j.id.startsWith('fstart-'));
for (const g of 일감) {
  const prompt = [HEAD(g.pose), g.moment, TAIL].join('\n');
  if (prompt.length > 4300) throw new Error(`${g.id} ${prompt.length}자`);
  jobs.push({ id: g.id, ratio: '9:16', refs: [R(g.ref), R('f-face.jpg')], prompt, out: `${D}/out/${g.id}_g{n}.png` });
  console.log(g.id, prompt.length);
}
fs.writeFileSync(`${D}/jobs.json`, JSON.stringify(jobs, null, 1));
