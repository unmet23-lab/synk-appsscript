// 「오늘」 화면 드라마 장면 판(11-18 유호님 「드라마 장면 쪽으로」) — 오늘 할 일 세 가지를 그 드라마의 장면 한 컷씩으로 보인다.
//   node experiences/drama/qa/오늘한장-20261114/장면판_20261118/그림.mjs   → .tmp/senior-f-face/jobs.json에 더한다(같은 id는 바꿔 쓴다)
//   bash .tmp/senior-f-face/돌림2.sh "scene-review scene-ask scene-gate"
// 맹검(today-redo-1118b)이 「정면으로 웃는 인물을 둥근 사각형에 담은 드라마 홍보 썸네일」을 짚었다 — 카메라를 보고 웃는 얼굴을 쓰지 않고,
// 학생 눈높이에서 그 장면 한가운데에 있는 컷으로 굽는다.
import fs from 'node:fs';

const W = 'C:/Users/q1212/Documents/SYNK-appsscript/.tmp/senior-f-face';
const 태오 = 'C:/Users/q1212/Documents/SYNK-appsscript/.tmp/taeo-face-nb/out/taeo-snaggle_g1.png';
const 유나 = `${W}/out/sf2-pony_g1.png`;
const 예쁨 = 'She must look exactly as attractive as in her reference image: the same slim oval face, the same defined straight brows, subtle eyeliner and soft coral lip, the same luminous clear skin. Do not make her face rounder, older or plainer.';
const pov = 'Point of view of a freshman (the viewer) standing or sitting in front of them; the freshman is not visible except, at most, a soft out-of-focus shoulder or hand at the frame edge.';
const pretty = 'Cast them like a Korean drama: attractive, well-groomed, naturally pretty or handsome with lightly retouched clear skin, never plain or awkward.';
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
  // 2판(11-18 유호님 「더 고쳐서」): 둘째 장면의 선배를 이름 없는 새 얼굴 대신 게시판의 다른 선배 한유나로(같은 과 다른 선배 = 고르지 않은 쪽).
  // 드라마 배역 얼굴은 수수한 실사보다 예쁘고 약간 보정된 결로(메모 cast-attractive). 셋째 장면은 1판 소매에 「UNIVERSITY」 글자가 박혀 소매 글자를 막는다.
  {
    id: 'scene-ask2', ratio: '16:9', refs: [유나],
    prompt: `Use the attached image only as the identity reference for the young woman: keep exactly her face and her black hair tied in a high ponytail. ${예쁨} Make a new film still.

A wide campus walkway at a Korean university in early March, late morning. At the end of the walkway stands a modern library building with a tall glass front.

Point of view of a freshman standing on the walkway: the freshman is seen only as a soft out-of-focus hand at the bottom-left holding a phone with a blurred map on its screen. The young woman, a third-year student who just stopped walking, has turned half toward the freshman and is pointing past the camera toward the library at the end of the walkway, explaining the way with a warm, friendly expression, mouth slightly open mid-sentence. She is in sharp focus at the right third of the frame, waist-up, soft front light on her face.

She wears ${점퍼} over a white T-shirt, a canvas tote bag on one shoulder. Other students walk in the soft background, bare trees with the first yellow sansuyu blossoms.

${끝}`,
  },
  {
    id: 'scene-gate2', ratio: '16:9', refs: [],
    prompt: `A film still. The entrance desk of a Korean university library, seen from behind the desk where a student works a part-time shift checking visitors.

On the light wooden counter in the foreground: a worn wooden rubber stamp, a small acrylic stand holding a printed notice (too soft to read), and a short queue line post. A visitor on the other side of the counter is holding out a paper entry ticket with one hand and lifting a canvas tote bag onto the counter with the other; the visitor is framed from the chest down, face out of frame. Behind them, the library lobby with tall bookshelves, glass entrance gates and warm afternoon light; a few students walk by, soft and out of focus.

The student worker is seen only as two hands at the bottom of the frame resting near the stamp, wearing plain cream knit sleeves with no lettering, no badge and no print anywhere on the sleeves.

${끝}`,
  },
  // 앱 옮기기(11-18 유호님 「앱에 옮겨」): 「오늘」 할 일의 종류마다 장면 한 컷. 새 상황(B · C · 처음 보는 대사)은 정답 말이 화면에 없어야 해서
  // 장면은 누구에게 · 어디서만 보인다. 사람은 이름 없는 새 얼굴이다(한유나 · 태오 아님). 메모 cast-attractive를 따른다.
  { id: 'scene-transfer', ratio: '16:9', refs: [], prompt: `A film still. A campus walkway at a Korean university in early March, mid-morning, between two class buildings; at the far end a small campus convenience store with a glass front and a striped awning (no readable sign). A third-year female student from the same department, whom the freshman met for the first time today, has stopped and is explaining the way with a friendly half-smile, one hand pointing down the walkway toward the store. ${pov} ${pretty} She wears a light beige trench coat over a striped knit, shoulder-length hair, a tote bag. Students in soft background, bare trees with the first yellow sansuyu blossoms.

${끝}` },
  { id: 'scene-office', ratio: '16:9', refs: [], prompt: `A film still. A Korean university department office in early March: a long counter, shelves of binders, a window with soft daylight. A young female department assistant in a neat cardigan sits behind the counter at her desk and has just looked up at the freshman with an attentive, kind expression, a pen in hand and papers in front of her. ${pov} ${pretty}

${끝}` },
  { id: 'scene-libdesk', ratio: '16:9', refs: [], prompt: `A film still. The help desk of a modern Korean university library, warm wood and tall bookshelves behind. A young male librarian in a soft grey sweater behind the desk leans forward slightly with a polite, helpful look, as if he has just asked how he can help. On the desk, a returned-books cart and a small desk lamp. ${pov} The freshman's hand at the frame edge holds a hardcover library book. ${pretty}

${끝}` },
  { id: 'scene-dorm', ratio: '16:9', refs: [], prompt: `A film still. The lobby of a Korean university dormitory in the evening, a small supervisor's desk by the entrance with a potted plant and a key cabinet. A warm woman in her forties, the dorm supervisor, in a tidy navy cardigan, stands beside the desk and is asking the freshman how they are settling in, with a gentle, motherly smile. ${pov} ${pretty}

${끝}` },
  { id: 'scene-hall', ratio: '16:9', refs: [], prompt: `A film still. A bright corridor in a Korean university building, notice boards (unreadable) and classroom doors. A university staff member the freshman has never met, a man in his thirties with a lanyard ID card and a shirt with rolled sleeves, carrying a folder, has stopped and turned toward the freshman with a polite, open expression, ready to help. ${pov} ${pretty}

${끝}` },
  { id: 'scene-prof', ratio: '16:9', refs: [], prompt: `A film still. In front of a professor's office in a Korean university building: a wooden door half open with a name plate too soft to read, a corridor window light. A professor in his fifties with silver-rimmed glasses and a tweed jacket stands in the doorway, holding the door, looking at the freshman with a calm, approachable expression. The freshman's hands at the bottom edge hold a clear folder with an assignment. ${pov} ${pretty}

${끝}` },
  { id: 'scene-bus', ratio: '16:9', refs: [], prompt: `A film still. A bus stop on the street in front of a Korean university in early March, morning; a city bus just pulled away in soft background, the university wall and trees across the road. A kind middle-aged woman walking by with a shopping bag has slowed down and turned toward the freshman with a friendly, helpful expression, as if they just said excuse me. ${pov} The freshman's hand at the frame edge holds a phone. ${pretty}

${끝}` },
  // 입장 검사 근무지(11-18 앱 화면 GPT 맹검: 게임의 그림 근무지가 작은 칸에서 「양산형 모바일 게임의 상점 배경」 같았다) — 드라마 장면과 같은 실사로,
  // scene-gate2(중앙도서관)처럼 안내대 안쪽 알바의 손과 표 · 짐을 내미는 손님(얼굴은 화면 밖)을 본다. WORLD 판 근무지 이름(world-content.mjs)을 따른다.
  ...[
    ['scene-venue-pool', 'the entrance desk of an indoor campus swimming pool at a Korean university', 'holding out a paper entry ticket with one hand and lifting a mesh swim bag with a towel and a swim cap onto the counter with the other', 'Behind them, the glass wall of the pool hall with blue water and lane ropes, bright clean light, a few students in tracksuits walking by, soft and out of focus.'],
    ['scene-venue-museum', 'the entrance desk of a small Korean university art museum', 'holding out a paper entry ticket with one hand and setting a small backpack on the counter with the other', 'Behind them, a quiet white gallery with framed paintings and a sculpture on a plinth, soft gallery spotlights, a few visitors looking at the art, soft and out of focus.'],
    ['scene-venue-concert', 'the ticket check table at the entrance of an outdoor spring festival concert on a Korean university campus in the early evening', 'holding out a paper concert ticket with one hand and opening a canvas tote bag on the table with the other', 'Behind them, a festival lawn with a lit stage far away, string lights and students gathering, warm dusk light, soft and out of focus.'],
  ].map(([id, where, hands, back]) => ({ id, ratio: '16:9', refs: [], prompt: `A film still. ${where.replace(/^./, (c) => c.toUpperCase())}, seen from behind the desk where a student works a part-time shift checking visitors.

On the counter in the foreground: a worn wooden rubber stamp, a small acrylic stand holding a printed notice (too soft to read), and a short queue line post. A visitor on the other side of the counter is ${hands}; the visitor is framed from the chest down, face out of frame. ${back}

The student worker is seen only as two hands at the bottom of the frame resting near the stamp, wearing plain cream knit sleeves with no lettering, no badge and no print anywhere on the sleeves.

${끝}` })),
].map((j) => ({ ...j, model: 'carbon', out: `${W}/out/${j.id}.png` }));

const f = `${W}/jobs.json`;
const 있던 = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
const 이름들 = new Set(작업.map((j) => j.id));
fs.writeFileSync(f, JSON.stringify([...있던.filter((j) => !이름들.has(j.id)), ...작업], null, 1));
for (const j of 작업) console.log(j.id, j.ratio, '참고', j.refs.length, '글자', j.prompt.length, j.refs.every((r) => fs.existsSync(r)) ? '' : '· 참고 그림 없음');
