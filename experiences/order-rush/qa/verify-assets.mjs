import {readFile,writeFile} from 'node:fs/promises';
import {ORDERS,REVIEW} from '../core.mjs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// 주소: RUSH_URL(기본은 server.mjs의 http://127.0.0.1:5203/)
const base=new URL('../',import.meta.url),report=[],origin=(process.env.RUSH_URL||'http://127.0.0.1:5203/').replace(/\/?$/,'/');
for(const order of [...ORDERS,...REVIEW]){
 const r=await fetch(`${origin}audio/${order.id}.wav`);assert.equal(r.status,200);assert.ok(r.headers.get('content-type').includes('audio/wav'));
 const b=Buffer.from(await r.arrayBuffer());assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');
 let pos=12,fmt,data;while(pos+8<=b.length){const tag=b.toString('ascii',pos,pos+4),n=b.readUInt32LE(pos+4);if(tag==='fmt ')fmt=b.subarray(pos+8,pos+8+n);if(tag==='data')data=b.subarray(pos+8,pos+8+n);pos+=8+n+(n%2);}
 assert.ok(fmt&&data);const sampleRate=fmt.readUInt32LE(4),bytesPerSecond=fmt.readUInt32LE(8),bits=fmt.readUInt16LE(14),channels=fmt.readUInt16LE(2);assert.equal(bits,16);let peak=0;for(let i=0;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)));const seconds=data.length/bytesPerSecond;assert.ok(seconds>1&&seconds<15);assert.ok(peak>500);
 report.push({id:order.id,text:order.text,status:r.status,bytes:b.length,sampleRate,channels,bits,seconds:Number(seconds.toFixed(3)),peak});
}
// 2026-10-06 펠트 키트 화면: 키트·손님·재료·쿠션 그림까지
const cast=['bear','deer','ducks','fox','hedgehog','otter','panda','penguin','rabbit','raccoon','sheep','squirrel'];
for(const relative of ['index.html','style.css','app.mjs','stage.mjs','audio.mjs','core.mjs','cafe.mjs','learning.mjs','collection.js','atlas-learning.js','vendor/three.module.js','vendor/three.core.js',
 'kit/lab.css','kit/lab.mjs','kit/fonts/SUIT-Variable.woff2','kit/felt/tex-cream.webp','kit/felt/tex-coral.webp','kit/brand/mongle-cheer.webp',
 ...['coffee','tea','milk','ice','sugar','cold','cushion-cream-tile','cushion-blush-tile','cushion-cream-phone','cushion-cream-mid'].map(n=>`assets/felt/${n}.webp`),
 ...cast.flatMap(n=>[`assets/cast/${n}.webp`,`assets/cast/face/${n}.webp`])]){
 const r=await fetch(`${origin}${relative}`);assert.equal(r.status,200,relative);assert.ok((await r.arrayBuffer()).byteLength>0,relative);
}
for(const module of ['app.mjs','stage.mjs','audio.mjs','core.mjs','cafe.mjs','server.mjs']){const r=spawnSync(process.execPath,['--check',fileURLToPath(new URL(module,base))],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
await writeFile(new URL('audio-assets.json',import.meta.url),JSON.stringify({voice:'Microsoft Heami Desktop',method:'local System.Speech synthesis',orders:report,note:'Waveform and browser playback-state verification; not a human listening or naturalness assessment.'},null,2));
console.log(`Verified ${report.length} non-silent WAVs, core assets, and module syntax.`);
