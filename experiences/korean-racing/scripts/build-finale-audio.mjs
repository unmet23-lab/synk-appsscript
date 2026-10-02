import { FINALES } from '../finales.js';
import { writeFile } from 'node:fs/promises';

const jobs=FINALES.flatMap(s=>s.items.flatMap(q=>[
  {id:q.audio[0],text:q.spoken},
  {id:q.answerAudio[0],text:`${q.word}. ${q.explanation}`},
  ...q.choices.map(c=>({id:c.id,text:c.word}))
]));
if(jobs.length!==150||new Set(jobs.map(j=>j.id)).size!==150)throw new Error('Finale narration requires 150 unique jobs.');
await writeFile(new URL('../audio-source/finale-jobs.json',import.meta.url),JSON.stringify(jobs,null,2));
console.log(`${jobs.length} finale question, explanation and choice narration jobs`);
