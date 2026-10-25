// 이해 시험 · 받아쓰기 대조용 「초  들리는 말」 줄: npx tsx 말표.ts <ig|yt> > ../시험/말_<판>.txt  (remotion 폴더에서)
// 글은 계획.json 그대로, 소리 나는 대로 쓴 낱말(에이아이 · 디엠)은 화면에 보이는 꼴(AI · DM)로 바꾼다.
import fs from 'node:fs';
import { TIMING, type Cut } from './src/y7/time';
const cut = (process.argv[2] || 'ig') as Cut;
const plan = JSON.parse(fs.readFileSync('../음성/계획.json', 'utf8'));
const t = TIMING[cut];
for (const id of t.order) {
  const text = plan.lines.find((l: { id: string }) => l.id === id).text.replace(/에이아이/g, 'AI').replace(/디엠/g, 'DM');
  console.log(`${(t.vo[id] / 30).toFixed(1)}s  ${text}`);
}
