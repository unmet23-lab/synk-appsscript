// 쇼케이스 끝 그림(덧니 선배) 원고 — git 밖 .tmp/taeo-face-nb에서 돌린 일감 생성기 사본. C3 끝은 이 지시문에 「Image 2 is another photo of the same young man …」 한 문장과 얼굴 참고 F1(f-face.jpg)을 더한 fend-c3f 판을 골랐다(이 판은 얼굴이 기울어 닮음이 낮게 나와 참고를 하나 더 줬다).
// 쇼케이스 식당 끝 그림 넷 · 덧니 선배 판(11-02) — 고른 시작 그림(fstart c1_g2 · c3_g1 · c4_g2)을 나노바나나로 한 번 편집해 「같은 구도의 다른 순간」을 만든다
// (최신기법 10-31 끝 그림과 같은 방법: 고개 · 손 · 뒤 학생만 바꿈). 명세는 쇼케이스 지시문.mjs의 「끝」 칸. node jobs3.mjs → jobs.json에 end-* 일감
import fs from 'node:fs';
const D = 'C:/Users/q1212/Documents/SYNK-appsscript/.tmp/taeo-face-nb';
const S = (f) => `${D}/refs/${f}`;

const HEAD = `Edit Image 1. Make the SAME photograph a few seconds later: exactly the same camera position, framing and crop (vertical 9:16), the same cafeteria, the same light, the same table, lunch trays and food in exactly the same places, and the same young man — keep his face exactly as in Image 1 (face shape, eyes and eyelids, brows, nose, lips, jaw), his hair, his clothes and his real, unretouched skin texture. He stays just as handsome. His head stays the same size in the frame.`;
const TAIL = `Also, a moment has passed in the background: two or three of the students at the tables far behind him have shifted — one has turned her head, one has lifted a spoon, one has leaned back — so the background is clearly a different moment, still softly out of focus and nobody looking at the camera.
Only the front edge of the freshman's own tray shows at the bottom edge — no hands, arms or body of hers. No text, letters or logos. Hands have five fingers. He must not resemble any real actor or idol.`;

const 일감 = [
  { id: 'fend-c1', src: 'fstart-c1.png', change: `CHANGE ONLY THIS: his raised right hand has come back down and rests relaxed at his side (or lightly on the backpack strap); his left hand still holds the lunch tray level exactly as before. He gives a warm, closed-lip smile, eyes on the lens, his head tilted very slightly.` },
  { id: 'fend-c3', src: 'fstart-c3.png', change: `CHANGE ONLY THIS: he leans his upper body forward a little across the table and cups one hand behind his ear, as if playfully asking "pardon?" — a teasing, amused smile with lips together or just slightly parted, eyebrows lifted, eyes on the lens. His other forearm still rests on the table; his hands do not touch the tray or food.` },
  { id: 'fend-c2', src: 'fstart-c3.png', change: `CHANGE ONLY THIS: both his hands rest flat on the table beside his tray, and he tilts his head a little to one side, smiling warmly with lips closed as he waits for her answer, eyes on the lens. His hands do not touch the tray or food.` },
  { id: 'fend-c4', src: 'fstart-c4.png', change: `CHANGE ONLY THIS: he still holds the spoon lightly in his right hand in the same place, and he smiles warmly with lips closed while waiting for her answer, his head tilted slightly, eyes on the lens. His hands do not move the food.` },
];

const jobs = JSON.parse(fs.readFileSync(`${D}/jobs.json`, 'utf8')).filter((j) => !j.id.startsWith('fend-'));
for (const g of 일감) {
  const prompt = [HEAD, g.change, TAIL].join('\n');
  jobs.push({ id: g.id, ratio: '9:16', refs: [S(g.src)], prompt, out: `${D}/out/${g.id}_g{n}.png` });
  console.log(g.id, prompt.length);
}
fs.writeFileSync(`${D}/jobs.json`, JSON.stringify(jobs, null, 1));
