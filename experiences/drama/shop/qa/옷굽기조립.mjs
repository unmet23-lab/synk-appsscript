#!/usr/bin/env node
/**
 * 옷 상점 1차 8벌 앞 · 뒤 굽기 지시문 (2026-11-05) — 팁 장부 44행 · 끌어넘기기 구현 준비 3절 「필요한 자산」.
 *
 * 앞은 11-04 시범 옷장(데님 · 니트 조끼 · MA-1)과 같은 글 틀이다 — 흰 바탕, 같은 나무 옷걸이, 같은 빛 · 각도.
 * 다른 점은 옷 길이 한 줄뿐: 봉에 나란히 걸면 짧은 카디건은 위에서, 트렌치는 아래까지 내려와야 실제 옷가게로 읽힌다.
 * 뒤는 그 옷의 앞 판을 Image 1로 넣고 「옷걸이째 돌려 뒤를 보여 줘」로 굽는다 — 다른 옷이 되지 않게.
 * 엔진은 GPT 이미지 2.5(`../../qa/제2의나-20261102/T-C/굽기.cjs`, ChatGPT 구독 · 현금 0). 그림은 git 밖.
 *
 *   node experiences/drama/shop/qa/옷굽기조립.mjs            → .tmp/me2-20261102/옷상점/글/<id>-front.txt · <id>-back.txt
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const 여기 = path.dirname(fileURLToPath(import.meta.url));
const 뿌리 = path.resolve(여기, '..', '..', '..', '..');
const { 공용작업본 } = require(path.join(뿌리, 'tools', 'lib', '공용작업본.js'));
export const 밖 = path.join(공용작업본(뿌리), '.tmp', 'me2-20261102', '옷상점');

const 바탕 = 'PHOTOREAL E-COMMERCE PRODUCT PHOTO, vertical 3:4. A seamless pure white studio background (#FFFFFF) fills the whole frame — no floor line, no wall, no props. No text, no logo, no brand label, no tag anywhere. Soft, even, diffused studio light from slightly above left; only a faint natural shadow directly behind or under the item. The look of a minimal Seoul concept-store web shop: sharp real fabric texture, natural colour, not glossy, not CGI.';
const 걸이 = (길이) => `It hangs on one plain light-wood hanger with a thin silver hook, seen straight from the front and perfectly centred. The hook reaches up to about 6% below the top edge of the frame, the garment fills about ${길이}% of the frame height with even white margins left and right, and the sleeves hang relaxed and natural. No person, no mannequin, nothing else in the frame.`;

/**
 * 1차 8벌. 앞 셋(denim · vest · bomber)은 11-04에 이미 구웠다(`.tmp/me2-20261102/옷사진/판/shop-outfit-*`).
 * 길이(%)는 화면 높이에 대한 옷 길이 — 봉에서 서로 견줘 실제 비율로 보이게(짧은 카디건 58 ~ 트렌치 86).
 * 뒤: 그 옷의 뒤에서만 보이는 것. 글자 · 무늬 · 패치는 뒤에도 없다.
 */
export const 옷들 = [
  { id: 'outfit-trench', 길이: 86, 앞: 'a short beige cotton trench coat, double-breasted with plain horn buttons, the belt tied loosely at the waist, open collar, falling to about mid-thigh.',
    뒤: 'the back yoke (storm flap) across the shoulders, the centre back vent, the belt passing through its loops at the back.' },
  { id: 'outfit-cardigan', 길이: 58, 앞: 'a soft butter-yellow chunky cotton-knit V-neck cardigan with small round cream buttons, buttoned only at the middle, layered over a plain white crew-neck T-shirt on the same hanger.',
    뒤: 'the plain knit back with ribbed hem and cuffs; the white T-shirt is hidden behind the cardigan except a sliver at the neck.' },
  { id: 'outfit-varsity', 길이: 64, 앞: 'a cherry-red wool varsity jacket with cream leather sleeves, cream-and-red striped rib collar, cuffs and hem, plain snap buttons — no letters, no patches, no chenille, no embroidery.',
    뒤: 'the plain red wool back panel with the cream sleeves and the striped rib hem — no letters or patches.' },
  { id: 'outfit-bomber', 길이: 72, 지난판: 'shop-outfit-bomber_224951.png',
    뒤: 'the smooth back panel and the ribbed knit hem and cuffs; the grey T-shirt is hidden behind it except a sliver at the neck.' },
  { id: 'outfit-rugby', 길이: 66, 앞: 'a long-sleeve rugby polo shirt with wide navy and cream horizontal stripes, a plain white woven collar and a short white button placket.',
    뒤: 'the same wide navy and cream stripes continuing straight across the back, every stripe evenly crisp and solid from side to side — no faded, smudged or blurred band anywhere; the white collar folded down at the back of the neck.' },
  { id: 'outfit-leather', 길이: 62, 앞: 'a black soft-leather biker jacket with silver zips, the asymmetric front zip open, the lapels folded back, layered over a plain white crew-neck T-shirt on the same hanger.',
    뒤: 'the smooth black leather back with its seams and the belted hem; the white T-shirt is hidden behind it except a sliver at the neck.' },
  { id: 'outfit-denim', 길이: 72, 지난판: 'shop-outfit-denim_224920.png',
    뒤: 'the denim back with its yoke seam, the two vertical back seams and the button-tab waistband; the white T-shirt is hidden behind it except a sliver at the neck.' },
  { id: 'outfit-vest', 길이: 72, 지난판: 'shop-outfit-vest_224936.png',
    뒤: 'the plain knit back of the vest with its ribbed hem, the pale-blue shirt collar and sleeves showing above and beside it.' },
];

export const 앞글 = (옷) => [바탕, `THE ITEM: ${옷.앞}`, 걸이(옷.길이)].join('\n');
export const 뒤글 = (옷) => `PHOTO EDIT of Image 1 — Image 1 is the FRONT of this exact garment on its hanger. Show the SAME garment on the SAME hanger, turned around 180° on its hook so we now see its BACK, straight on and perfectly centred.
KEEP EXACTLY: the same garment — colour, fabric, texture, length, sleeve length and fit; the same light-wood hanger with the thin silver hook; the same scale and the same place in the frame (hook tip at the same height, garment the same height and width); the same seamless pure white studio background, the same soft light from slightly above left and the same faint shadow.
THE BACK: ${옷.뒤}
No text, no logo, no label, no tag anywhere. No person, no mannequin, nothing else in the frame.`;

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const 글 = path.join(밖, '글');
  fs.mkdirSync(글, { recursive: true });
  let n = 0;
  for (const 옷 of 옷들) {
    if (옷.앞) { fs.writeFileSync(path.join(글, `${옷.id}-front.txt`), 앞글(옷) + '\n'); n++; }
    fs.writeFileSync(path.join(글, `${옷.id}-back.txt`), 뒤글(옷) + '\n'); n++;
  }
  console.log(`[옷 상점] 지시문 ${n}건 → ${글}`);
}
