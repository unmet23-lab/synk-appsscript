// 영상용 그림 · 컷 사본을 public 아래에 만든다(public/img · public/plate는 git 밖).
//   node scripts/img.mjs
// 판(GPT 이미지 2.5) · 시안(실제 ChatGPT 화면, 휴대폰 폭 430 × 3배)은 편 폴더에 있고, Flow 컷은 git 밖 ~/ego/synkbrief-b27-20261106/flow에 있다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const 편 = path.join(ROOT, '..');
const 컷 = path.join(os.homedir(), 'ego/synkbrief-b27-20261106/flow');
const 그림 = {
  kitchen: "판/주방_075002.png",
  night: "판/밤_085018.png",
  phone: "판/폰_082219.png",
  realize: "판/깨달음_080624_1.png",
  s_first: "시안/실제_먼저개선.png",
  s_ask: "시안/실제_입력창_세기.png",
  s_table: "시안/실제_세기표_폭600.png",
};
fs.mkdirSync(path.join(ROOT, 'public/img'), { recursive: true });
fs.mkdirSync(path.join(ROOT, 'public/plate'), { recursive: true });
for (const [이름, 상대] of Object.entries(그림)) {
  fs.copyFileSync(path.join(편, 상대), path.join(ROOT, 'public/img', 이름 + '.png'));
  console.log('img', 이름, '←', 상대);
}
for (const f of ['b27-a.mp4', 'b27-b.mp4', 'b27-c2.mp4', 'b27-d2.mp4']) {
  fs.copyFileSync(path.join(컷, f), path.join(ROOT, 'public/plate', f));
  console.log('plate', f);
}
