import {VOICE_LINES,VOICE_TEXT_VERSION} from '../voice-lines.mjs';
import {STORY_VERSION} from '../story.mjs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const folder=new URL('../assets/voice/',import.meta.url);
await mkdir(folder,{recursive:true});
const sourceHashes=Object.fromEntries(await Promise.all(['story.mjs','voice-lines.mjs'].map(async file=>[file,createHash('sha256').update(await readFile(new URL('../'+file,import.meta.url))).digest('hex')])));
await writeFile(new URL('jobs.json',folder),JSON.stringify({storyVersion:STORY_VERSION,textVersion:VOICE_TEXT_VERSION,sourceHashes,lines:VOICE_LINES},null,2)+'\n');
console.log(`Frozen Korean voice texts: ${VOICE_LINES.length}`);
