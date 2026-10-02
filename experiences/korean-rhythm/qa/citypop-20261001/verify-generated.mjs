import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const results=JSON.parse(fs.readFileSync(path.join(root,'generation-results.json'),'utf8'));
const titles=['유영','잔상','밤의 온도'];
const audio=[];
for(const [i,title] of titles.entries()){
 const source=path.join('C:/Users/q1212/Downloads',title+'.mp3');
 const info=JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-show_streams','-of','json',source],{encoding:'utf8'}));
 const tags=info.format.tags;
 assert.equal(tags.title,title);
 assert.ok(tags.comment.includes(results.primaryIds[i]));
 const lyrics=tags['lyrics-eng'];
 assert.ok(lyrics && /[가-힣]/.test(lyrics));
 assert.ok(!/[A-Za-zぁ-んァ-ン]/.test(lyrics.replace(/\[[^\]]*\]/g,'')));
 assert.ok(!lyrics.includes('박자'));
 const decoded=execFileSync('ffmpeg',['-hide_banner','-loglevel','info','-i',source,'-af','volumedetect','-f','null','-'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
 // The complete decode succeeds or execFileSync throws. Suno player listening is recorded separately.
 const bytes=fs.readFileSync(source);const target=path.join(root,title+'.mp3');
 if(fs.existsSync(target))assert.equal(createHash('sha256').update(fs.readFileSync(target)).digest('hex'),createHash('sha256').update(bytes).digest('hex'));
 else fs.writeFileSync(target,bytes);
 audio.push({title,sourceId:results.primaryIds[i],url:'https://suno.com/song/'+results.primaryIds[i],file:target,duration:Number(info.format.duration),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),sampleRate:Number(info.streams[0].sample_rate),channels:info.streams[0].channels,completeDecode:true,koreanLyricsMetadata:true});
}
fs.writeFileSync(path.join(root,'audio-verification.json'),JSON.stringify({audio,limit:'Metadata and complete decoding verify the delivered files; subjective listening, pronunciation and reference similarity require listening review.'},null,2)+'\n');
console.log(JSON.stringify(audio.map(({title,duration,bytes,completeDecode,koreanLyricsMetadata})=>({title,duration,bytes,completeDecode,koreanLyricsMetadata})),null,2));
