// 「오늘」 화면 드라마 장면 판(11-18 유호님 「드라마 장면 쪽으로」) — 오늘 할 일 세 가지를 그 드라마의 장면 한 컷씩으로 보인다.
//   node experiences/drama/qa/오늘한장-20261114/장면판_20261118/그림.mjs   → .tmp/senior-f-face/jobs.json에 더한다(같은 id는 바꿔 쓴다)
//   bash .tmp/senior-f-face/돌림2.sh "scene-review scene-ask scene-gate"
// 맹검(today-redo-1118b)이 「정면으로 웃는 인물을 둥근 사각형에 담은 드라마 홍보 썸네일」을 짚었다 — 카메라를 보고 웃는 얼굴을 쓰지 않고,
// 학생 눈높이에서 그 장면 한가운데에 있는 컷으로 굽는다.
import fs from 'node:fs';

const W = 'C:/Users/q1212/Documents/SYNK-appsscript/.tmp/senior-f-face';
const 태오 = 'C:/Users/q1212/Documents/SYNK-appsscript/.tmp/taeo-face-nb/out/taeo-snaggle_g1.png';
const 점퍼 = 'a navy university varsity jacket with cream sleeves and striped navy-and-cream cuffs, with a small embroidered shield crest on the left chest (no lettering)';
const 끝 = 'Photorealistic film still from a Korean campus drama, 16:9, natural colour, true skin texture, no beauty-filter smoothing, shallow depth of field. No captions, no subtitles, no watermark, no logo, no on-screen text. Any signs or printed paper in the scene are too far or too soft to read. Hands have five natural fingers.';

export const 작업 = [
  {
    id: 'scene-review', ratio: '16:9', refs: [태오],
    prompt: `Use the attached image only as the identity reference for the young man: keep exactly his face and his brown hair with the soft fringe. Make a new film still.

Over-the-shoulder shot in a bright Korean university cafeteria at lunchtime in early March. The camera sits just behind the left shoulder of a freshman who is seen only as a soft out-of-focus shoulder and the back of dark hair in the left third of the frame. Across the table, the young man (a third-year student) is in the middle of listening to the freshman: he has stopped eating, chopsticks resting on his steel tray, leaning slightly forward with a small encouraging nod, eyes on the freshman, not on the camera. He is not posing and not grinning at the lens.

He wears ${점퍼} over a light grey hoodie. Steel trays with rice, soup, kimchi and seasoned greens. Large windows behind him with soft daylight and bare trees with the first yellow sansuyu blossoms; other students eating in the soft background.

${끝}`,
  },
  {
    id: 'scene-ask', ratio: '16:9', refs: [],
    prompt: `A film still. A wide campus walkway at a Korean university in early March, late morning. At the end of the walkway stands a modern library building with a tall glass front.

Point of view of a freshman standing on the walkway: the freshman is seen only as a soft out-of-focus hand at the bottom-left holding a phone with a blurred map on its screen. A third-year female student who just stopped walking has turned half toward the freshman and is pointing past the camera toward the library at the end of the walkway, explaining the way with a friendly, natural expression, mouth slightly open mid-sentence. She is in sharp focus at the right third of the frame, waist-up.

She wears ${점퍼} over a white T-shirt, a canvas tote bag on one shoulder, shoulder-length black hair. Other students walk in the soft background, bare trees with the first yellow sansuyu blossoms.

${끝}`,
  },
  {
    id: 'scene-gate', ratio: '16:9', refs: [],
    prompt: `A film still. The entrance desk of a Korean university library, seen from behind the desk where a student works a part-time shift checking visitors.

On the light wooden counter in the foreground: a worn wooden rubber stamp, a small acrylic stand holding a printed notice (too soft to read), and a short queue line post. A visitor on the other side of the counter is holding out a paper entry ticket with one hand and lifting a canvas tote bag onto the counter with the other; the visitor is framed from the chest down, face out of frame. Behind them, the library lobby with tall bookshelves, glass entrance gates and warm afternoon light; a few students walk by, soft and out of focus.

The student worker is seen only as two hands at the bottom of the frame resting near the stamp, wearing the sleeves of ${점퍼}.

${끝}`,
  },
].map((j) => ({ ...j, model: 'carbon', out: `${W}/out/${j.id}.png` }));

const f = `${W}/jobs.json`;
const 있던 = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
const 이름들 = new Set(작업.map((j) => j.id));
fs.writeFileSync(f, JSON.stringify([...있던.filter((j) => !이름들.has(j.id)), ...작업], null, 1));
for (const j of 작업) console.log(j.id, j.ratio, '참고', j.refs.length, '글자', j.prompt.length, j.refs.every((r) => fs.existsSync(r)) ? '' : '· 참고 그림 없음');
