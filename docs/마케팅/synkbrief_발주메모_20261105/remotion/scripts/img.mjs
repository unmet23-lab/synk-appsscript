// 영상용 그림 · 컷 사본을 public 아래에 만든다(public/img · public/plate는 git 밖).
//   node scripts/img.mjs
// 판(GPT 이미지 2.5) · 시안(실제 ChatGPT 화면, 휴대폰 폭 430 × 3배)은 편 폴더에 있고, Flow 컷은 git 밖 ~/ego/synkbrief-b28-20261105/flow에 있다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const 편 = path.join(ROOT, '..');
const 컷 = path.join(os.homedir(), 'ego/synkbrief-b28-20261105/flow');
const 그림 = {
  memo: '판/메모_다_111620.png',
  phone_night: '판/폰밤_*.png',
  phone_morning: '판/폰아침_*.png',
  shoot: '판/찍기_123305_2.png',
  night: '판/밤불_*.png',
  morning: '판/아침오븐_*.png',
  end: '판/끝2_*.png',
  s_kong: '시안/실제_기본4.png',
  s_hobak: '시안/실제_기본2.png',
  s_carrot: '시안/실제_더7.png',
  s_walnut: '시안/실제_더8.png',
  s_q: '시안/실제_물음3.png',
};
fs.mkdirSync(path.join(ROOT, 'public/img'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'public/plate'), { recursive: true });
for (const [이름, 상대] of Object.entries(그림)) {
  let 원 = path.join(편, 상대);
  if (상대.includes('*')) {
    const [폴더, 꼴] = [path.dirname(원), path.basename(원).replace('*', '')];
    const 후보 = fs.readdirSync(폴더).filter((f) => f.startsWith(꼴.split('.')[0]) && f.endsWith('.png')).sort();
    if (!후보.length) { console.log('없음', 상대); continue; }
    원 = path.join(폴더, 후보[후보.length - 1]);
  }
  fs.copyFileSync(원, path.join(ROOT, 'public/img', 이름 + '.png'));
  console.log('img', 이름, '←', path.relative(편, 원));
}
for (const f of fs.existsSync(컷) ? fs.readdirSync(컷).filter((f) => f.endsWith('.mp4')) : []) {
  fs.copyFileSync(path.join(컷, f), path.join(ROOT, 'public/plate', f));
  console.log('plate', f);
}
