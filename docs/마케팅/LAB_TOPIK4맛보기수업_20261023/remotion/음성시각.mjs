// 구운 목소리의 줄 길이·낱말 시각을 src/lesson/vo.generated.json으로 옮긴다: node 음성시각.mjs [--폴더 범수|범수_견본]
// 줄 파일은 public/vo/<id>.wav로 복사한다(public/은 git 밖). 굽지 않은 줄은 time.ts가 음절 수로 어림한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const folders = args.includes('--폴더') ? [args[args.indexOf('--폴더') + 1]] : ['범수', '범수_견본'];
const VO = path.join(HERE, '..', '음성');
const OUT = path.join(HERE, 'public', 'vo');
fs.mkdirSync(OUT, { recursive: true });

const dur = {};
const words = {};
for (const folder of folders) {
  const list = path.join(VO, folder, 'vo.json');
  if (!fs.existsSync(list)) continue;
  for (const l of JSON.parse(fs.readFileSync(list, 'utf8')).lines) {
    fs.copyFileSync(path.join(VO, folder, l.src), path.join(OUT, `${l.id}.wav`));
    dur[l.id] = l.dur;
    const meta = path.join(VO, folder, `${l.id}.json`);
    if (fs.existsSync(meta)) words[l.id] = (JSON.parse(fs.readFileSync(meta, 'utf8')).words || []).map((w) => [w.text, w.start, w.end]);
  }
}
fs.writeFileSync(path.join(HERE, 'src', 'lesson', 'vo.generated.json'), JSON.stringify({ note: 'node 음성시각.mjs 가 만든다 — 손으로 고치지 않는다.', dur, words }) + '\n');
console.log(`줄 ${Object.keys(dur).length}개 → public/vo · src/lesson/vo.generated.json`);
