// 받아쓰기 대조용 기대 자막: npx tsx 자막.ts → out/expected-ko.srt  (remotion 폴더에서)
// 줄 시각은 time.ts(목소리를 놓은 자리), 글은 ../음성/계획.json의 읽는 글.
import fs from 'node:fs';
import path from 'node:path';
import { ORDER, VO, lineEnd } from './src/p4/time';

const plan = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '음성', '계획.json'), 'utf8'));
const text = Object.fromEntries(plan.lines.map((l: { id: string; text: string }) => [l.id, l.text]));
const ts = (fr: number) => {
  const ms = Math.round((fr / 30) * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const srt = ORDER.map((id, i) => `${i + 1}\n${ts(VO[id])} --> ${ts(lineEnd(id))}\n${text[id]}\n`).join('\n');
fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'out', 'expected-ko.srt'), srt);
console.log(`out/expected-ko.srt ${ORDER.length}줄`);
