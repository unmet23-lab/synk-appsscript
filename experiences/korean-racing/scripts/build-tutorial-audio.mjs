import { writeFile } from 'node:fs/promises';

// Then run powershell.exe -NoProfile -File scripts/synthesize-tutorial.ps1.
const jobs = [
  { id: 'tutorial-welcome', text: '왼쪽으로 움직여 봐.' },
  { id: 'tutorial-right', text: '좋아! 이번엔 오른쪽.' },
  { id: 'tutorial-listen', text: '잘 들어봐. 사과.' },
  { id: 'tutorial-choices', text: '왼쪽 바나나, 가운데 포도, 오른쪽 사과. 사과 쪽으로 가 봐.' },
  { id: 'tutorial-retry', text: '사과는 오른쪽이야. 다시 가 보자.' },
  { id: 'tutorial-correct', text: '정답! 부스터가 충전됐어.' },
  { id: 'tutorial-boost', text: '정답을 맞히면 자동으로 빨라져. 부스터로 달려 보자.' },
  { id: 'tutorial-finish', text: '좋아! 이제 레이스를 시작해 보자.' },
  { id: 'tutorial-go', text: '위쪽 화살표를 눌러 출발해 봐.' },
];
if (jobs.length !== 9 || new Set(jobs.map(job => job.id)).size !== jobs.length) {
  throw new Error('Tutorial narration requires nine unique clips.');
}
await writeFile(new URL('../audio-source/tutorial-jobs.json', import.meta.url), JSON.stringify(jobs, null, 2));
console.log(`${jobs.length} first-play tutorial narration jobs`);
