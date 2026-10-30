// 범수 줄마다 낱말 시각을 src/y24/vo.generated.ts로 옮긴다: node 음성시각.mjs  (remotion 폴더에서)
// 원본은 ../음성/범수/<줄>.json(tools/나레이션굽기.mjs가 다듬은 소리의 낱말 시각). 소리는 public/vo/<줄>.wav로 복사한다.
// --가짜: 굽기 전 자리 잡기용 — 글자 수로 길이를 어림해 낱말을 고르게 나눈다(소리 파일 없음).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PLAN = JSON.parse(fs.readFileSync(path.join(HERE, '..', '음성', '계획.json'), 'utf8'));
const VOICE_DIR = path.join(HERE, '..', '음성', PLAN.out);
const fake = process.argv.includes('--가짜');
const out = {};
fs.mkdirSync(path.join(HERE, 'public', 'vo'), { recursive: true });
for (const line of PLAN.lines) {
  if (fake) {
    const ws = line.text.split(' ');
    const dur = line.text.replace(/\s/g, '').length / 7.4;
    let t = 0;
    out[line.id] = { dur: +dur.toFixed(3), words: ws.map((w) => { const d = (w.length / line.text.replace(/\s/g, '').length) * dur; const r = [w, +t.toFixed(3), +(t + d).toFixed(3)]; t += d; return r; }) };
    continue;
  }
  const d = JSON.parse(fs.readFileSync(path.join(VOICE_DIR, `${line.id}.json`), 'utf8'));
  out[line.id] = { dur: +d.dur.toFixed(3), words: d.words.map((w) => [w.text, +w.start.toFixed(3), +w.end.toFixed(3)]) };
  fs.copyFileSync(path.join(VOICE_DIR, `${line.id}.wav`), path.join(HERE, 'public', 'vo', `${line.id}.wav`));
}
const ts = `// node 음성시각.mjs${fake ? ' --가짜' : ''}가 만든 파일. 고치지 말고 다시 만든다.\nexport const FAKE = ${fake};\nexport const VOICE = ${JSON.stringify(out)} as const;\n`;
fs.writeFileSync(path.join(HERE, 'src', 'y24', 'vo.generated.ts'), ts);
for (const [id, v] of Object.entries(out)) console.log(`${id.padEnd(4)} ${v.dur.toFixed(2)}초 낱말 ${v.words.length}`);
