import fs from 'node:fs';
import {LISTENING,spoken} from '../listening.mjs';
const jobs=LISTENING.flatMap((items,t)=>items.flatMap((q,i)=>[...q.claims.map((claim,v)=>({id:`t${t}q${i}v${v}`,text:spoken({...q,...claim})})),{id:`t${t}q${i}r`,text:spoken(q.recall)}]));
fs.mkdirSync(new URL('../audio-source/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('../audio-source/jobs.json',import.meta.url),JSON.stringify(jobs,null,2));
console.log(`${jobs.length} Korean listening narration clips`);
