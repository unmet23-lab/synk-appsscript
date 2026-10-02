import { CAMPAIGN } from '../campaign.js';
import {writeFile} from 'node:fs/promises';
const jobs=CAMPAIGN.flatMap(s=>s.items.flatMap(q=>[{id:q.audio[0],text:q.spoken},{id:q.answerAudio[0],text:`${q.word}. ${q.explanation}`} ]));
await writeFile(new URL('../audio-source/challenge-jobs.json',import.meta.url),JSON.stringify(jobs,null,2));
console.log(`${jobs.length} original sentence and feedback narration jobs`);
