// 이해 시험 · 받아쓰기 대조용 「초  들리는 말」 줄: npx tsx 말표.ts > ../시험/말_A.txt  (remotion 폴더에서)
// 글은 원고 그대로, 소리 나는 대로 쓴 낱말(에이아이)은 화면에 보이는 꼴(AI)로 바꾼다. B판은 말이 없다(../시험/말_B.txt는 손으로 쓴 소리 설명 한 줄).
import { VOICE } from './src/y29/vo.generated';
import { ORDER, vo } from './src/y29/time';
for (const id of ORDER) {
  const text = VOICE[id].words.map((w) => w[0]).join(' ').replace(/에이아이/g, 'AI');
  console.log(`${(vo(id) / 30).toFixed(1)}s  ${text}`);
}
