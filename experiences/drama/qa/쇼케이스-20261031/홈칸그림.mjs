// 홈 · LAB 장면 재생기의 칸 다섯(1화 칸 1 · 11 · 12 · 13 · 14)을 덧니 선배로 다시 굽는 일감(2026-11-03, 결정 11-02 「쇼케이스 태오 얼굴 = 덧니 선배」 — 홈 칸도 같은 얼굴).
// 칸 15(박람회)는 태오가 없어 그대로 둔다. 실행기는 시작그림.mjs와 같은 git 밖 .tmp/taeo-face-nb(나노바나나 2.1 · 구독 안 0원).
// Gemini 비율 메뉴에 4:5가 없어 3:4로 구워 위아래를 조금 잘라 4:5로 맞춘다. node 홈칸그림.mjs → jobs.json에 home-* 일감을 더한다. 참고: Image 1 = 지금 칸(구도만), Image 2 = 얼굴 기준 F1.
import fs from 'node:fs';
const D = 'C:/Users/q1212/Documents/SYNK-appsscript/.tmp/taeo-face-nb';
// 참고로 쓸 지금 칸은 SYNK-website claude/home-drama-pub-20261031의 site-v10/assets/drama-s1e01-*.webp를 refs/home-p??.jpg로 옮긴 것.

const HEAD = `Make ONE new photograph, vertical 3:4: a photoreal still from a bright Korean campus romance TV drama. Both people in it are adult university students in their twenties.
Image 1 = the current scene: copy its layout, camera position and framing — where Kwon Tae-o stands or sits, his pose, the setting, the props and where the other student is. Do NOT copy his face, his hair, his exaggerated grin or the glossy, smooth drawing-like skin.
Image 2 = KWON TAE-O himself. This is THE SAME PERSON: keep his face exactly as in Image 2 — face shape, eyes and eyelids, brows, nose, lips, jawline, his slightly uneven canine tooth when he smiles — and his soft, airy dark-brown hair with bangs parted slightly off-centre. Take from Image 2 also the natural look of his skin and his warm, boyish charm.
He wears a navy university varsity jacket with cream sleeves and striped navy-and-cream cuffs, a small embroidered crest on the left chest (a simple shield with a stylized open book and one small star, no lettering), over a light-grey hoodie with white drawstrings, and a black backpack strap over one shoulder.`;

const TAIL = `LIGHT: March daylight, soft and bright on his face, a gentle warm rim on his hair; the background is softly out of focus, nobody in it looks at the camera.
SKIN: real, unretouched young skin — visible pores on his nose and cheeks, fine peach fuzz, a natural soft sheen, tiny natural unevenness. Not porcelain, not airbrushed, no beauty filter, no moles or dots on his face.
He is an original person who must not resemble any real actor, idol or public figure. No text, letters, numbers or logos anywhere. No border. Hands have five fingers.`;

const 일감 = [
 { id: 'home-p01', moment: `THE MOMENT: outside the university main gate on a spring morning, Tae-o walks past and glances back with a small friendly smile, seen waist-up. In the left foreground, blurred and from behind, the other student in a beige coat, grey knit beanie and black backpack. Students walk in the background past a red-brick building.` },
 { id: 'home-p11', moment: `THE MOMENT: in a bright university cafeteria with tall windows, Tae-o stands beside the table holding a stainless-steel lunch tray with food level in his left hand, waving hello with his right hand raised, a warm open smile. In the foreground the edge of the table and a tray.` },
 { id: 'home-p12', moment: `THE MOMENT: Tae-o sits across the cafeteria table, mid-chest up, pointing at himself with his right thumb, laughing warmly as he introduces himself. His tray with food is in front of him; the other student's beige sleeves and tray are at the bottom edge of the frame.` },
 { id: 'home-p13', moment: `THE MOMENT: Tae-o sits across the cafeteria table, mid-chest up, a metal spoon lightly in his right hand on his tray, his left hand raised palm out in a playful "no, no" wave, laughing. The other student's beige sleeves and tray are at the bottom edge of the frame.` },
 { id: 'home-p14', moment: `THE MOMENT: outdoors on the campus plaza after lunch, Tae-o has turned back toward the camera and gives a thumbs-up, a warm smile, black backpack on his shoulder. In the right foreground, blurred and from behind, the other student in a beige coat, grey knit beanie and black backpack. A glass-and-brick campus building and walking students behind.` },
];

fs.mkdirSync(`${D}/refs`, { recursive: true });
const jobs = JSON.parse(fs.readFileSync(`${D}/jobs.json`, 'utf8')).filter((j) => !j.id.startsWith('home-'));
for (const g of 일감) {
 const prompt = [HEAD, g.moment, TAIL].join('\n');
 jobs.push({ id: g.id, ratio: '3:4', refs: [`${D}/refs/home-${g.id.slice(5)}.jpg`, `${D}/refs/f-face.jpg`], prompt, out: `${D}/out/${g.id}_g{n}.png` });
 console.log(g.id, prompt.length);
}
fs.writeFileSync(`${D}/jobs.json`, JSON.stringify(jobs, null, 1));
