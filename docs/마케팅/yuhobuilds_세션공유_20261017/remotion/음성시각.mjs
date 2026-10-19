// 범수 목소리 줄마다 낱말 시각을 src/full/vo.generated.ts로 옮긴다: node 음성시각.mjs  (remotion 폴더에서)
// 머리글 낱말이 말과 같은 프레임에 들어오게 쓴다. 원본은 ../음성/범수/<줄>.json(Typecast with-timestamps).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VOICE = path.join(HERE, '..', '음성', '범수');
const IDS = ['sum', 'sum2', 'h1b', 'h1', 'h1e', 's1', 'c1', 't1', 't2', 't3', 'r1', 'm1', 'm2', 'e1', 'f1', 'cta'];
/** 다른 줄을 잘라 만든 줄(준비.mjs가 같은 자리에서 소리를 자른다). f1a = f1의 「공개했어요.」까지. */
export const DERIVED = { f1a: { from: 'f1', words: 11, dur: 4.0 } };
const out = {};
for (const id of IDS) {
  const d = JSON.parse(fs.readFileSync(path.join(VOICE, `${id}.json`), 'utf8'));
  out[id] = { dur: +d.audio_duration.toFixed(3), words: d.words.map((w) => [w.text, +w.start.toFixed(3), +w.end.toFixed(3)]) };
}
for (const [id, { from, words, dur }] of Object.entries(DERIVED)) out[id] = { dur, words: out[from].words.slice(0, words) };
const ts = `// node 음성시각.mjs가 만든 파일. 고치지 말고 다시 만든다.\nexport const VOICE = ${JSON.stringify(out, null, 1)} as const;\n`;
fs.writeFileSync(path.join(HERE, 'src', 'full', 'vo.generated.ts'), ts);
console.log(`src/full/vo.generated.ts · ${Object.keys(out).length}줄`);
