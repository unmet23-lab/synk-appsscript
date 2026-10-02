import { CAMPAIGN } from '../campaign.js';
import { writeFile } from 'node:fs/promises';
const jobs = [
  { id: 'lane-left', text: '왼쪽 길.' },
  { id: 'lane-center', text: '가운데 길.' },
  { id: 'lane-right', text: '오른쪽 길.' },
  ...CAMPAIGN.flatMap(stage => stage.items.flatMap(question => question.choices.map(choice => ({ id: choice.id, text: choice.word }))))
];
await writeFile(new URL('../audio-source/choice-jobs.json', import.meta.url), JSON.stringify(jobs, null, 2));
console.log(`${jobs.length} lane and answer-choice narration jobs`);
