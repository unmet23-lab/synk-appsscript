// 범수 줄마다 낱말 시각을 src/day1/vo.generated.ts로 옮긴다: node 음성시각.mjs  (remotion 폴더에서)
// 원본은 ../음성/범수/<줄>.json(tools/나레이션굽기.mjs가 다듬은 소리의 낱말 시각). 소리는 public/vo/<줄>.wav로 복사한다.
// fo(「팔로우하면 다음 편도 보여 드릴게요」)도 이 편 계획에서 새로 구운 줄이다(Fable 콘티 검수 M5).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VOICE_DIR = path.join(HERE, '..', '음성', '범수');
const PLAN = JSON.parse(fs.readFileSync(path.join(HERE, '..', '음성', '계획.json'), 'utf8'));
const out = {};
fs.mkdirSync(path.join(HERE, 'public', 'vo'), { recursive: true });
for (const line of PLAN.lines) {
  const d = JSON.parse(fs.readFileSync(path.join(VOICE_DIR, `${line.id}.json`), 'utf8'));
  out[line.id] = { dur: +d.dur.toFixed(3), words: d.words.map((w) => [w.text, +w.start.toFixed(3), +w.end.toFixed(3)]) };
  fs.copyFileSync(path.join(VOICE_DIR, `${line.id}.wav`), path.join(HERE, 'public', 'vo', `${line.id}.wav`));
}
const ts = `// node 음성시각.mjs가 만든 파일. 고치지 말고 다시 만든다.\nexport const VOICE = ${JSON.stringify(out, null, 1)} as const;\n`;
fs.writeFileSync(path.join(HERE, 'src', 'day1', 'vo.generated.ts'), ts);
for (const [id, v] of Object.entries(out)) console.log(`${id.padEnd(4)} ${v.dur.toFixed(2)}초 낱말 ${v.words.length}`);
console.log(`src/day1/vo.generated.ts · ${Object.keys(out).length}줄`);
