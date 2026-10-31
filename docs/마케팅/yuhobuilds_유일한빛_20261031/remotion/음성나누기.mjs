// v6(낱말마다 사진이 뒤집히는 줄)을 네 토막으로 나눠 public/vo/v6_<n>.wav로 둔다: node 음성나누기.mjs  (remotion 폴더에서)
// 말 사이를 벌려 사진이 한 장씩 보이게 한다(r4 시험 셋이 「0.3초씩 지나간다」고 짚음). 나누는 자리는 ../음성/범수/v6.json 낱말 시각.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(HERE, '..', '음성', '범수');
const j = JSON.parse(fs.readFileSync(path.join(dir, 'v6.json'), 'utf8'));
const start = (w) => j.words.find((x) => x.text.includes(w)).start;
const cuts = [0, start('초,'), start('가게'), start('헤드라이트'), j.dur];
for (let i = 0; i < 4; i++) {
  const a = Math.max(0, cuts[i] - 0.04);
  const b = cuts[i + 1] - 0.04;
  const len = (b - a).toFixed(3);
  const out = path.join(HERE, 'public', 'vo', `v6_${i + 1}.wav`);
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', a.toFixed(3), '-t', len, '-i', path.join(dir, 'v6.wav'), '-af', `afade=t=in:d=0.01,afade=t=out:st=${(b - a - 0.03).toFixed(3)}:d=0.03`, out]);
  console.log(`v6_${i + 1} ${len}초`);
}
