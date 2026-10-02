import {readFile,writeFile} from 'node:fs/promises';
import {ORDERS,REVIEW} from '../core.mjs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const base=new URL('../',import.meta.url),report=[];
for(const order of [...ORDERS,...REVIEW]){
 const r=await fetch(`http://127.0.0.1:5203/audio/${order.id}.wav`);assert.equal(r.status,200);assert.ok(r.headers.get('content-type').includes('audio/wav'));
 const b=Buffer.from(await r.arrayBuffer());assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WAVE');
 let pos=12,fmt,data;while(pos+8<=b.length){const tag=b.toString('ascii',pos,pos+4),n=b.readUInt32LE(pos+4);if(tag==='fmt ')fmt=b.subarray(pos+8,pos+8+n);if(tag==='data')data=b.subarray(pos+8,pos+8+n);pos+=8+n+(n%2);}
 assert.ok(fmt&&data);const sampleRate=fmt.readUInt32LE(4),bytesPerSecond=fmt.readUInt32LE(8),bits=fmt.readUInt16LE(14),channels=fmt.readUInt16LE(2);assert.equal(bits,16);let peak=0;for(let i=0;i<data.length;i+=2)peak=Math.max(peak,Math.abs(data.readInt16LE(i)));const seconds=data.length/bytesPerSecond;assert.ok(seconds>1&&seconds<15);assert.ok(peak>500);
 report.push({id:order.id,text:order.text,status:r.status,bytes:b.length,sampleRate,channels,bits,seconds:Number(seconds.toFixed(3)),peak});
}
for(const relative of ['index.html','style.css','app.mjs','stage.mjs','audio.mjs','core.mjs','vendor/three.module.js','vendor/three.core.js','assets/cafe.webp','assets/logo-ink.svg','assets/SUIT-Variable.woff2']){
 const r=await fetch(`http://127.0.0.1:5203/${relative}`);assert.equal(r.status,200);assert.ok(Number(r.headers.get('content-length'))>0);
}
for(const module of ['app.mjs','stage.mjs','audio.mjs','core.mjs','server.mjs']){const r=spawnSync(process.execPath,['--check',fileURLToPath(new URL(module,base))],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
await writeFile(new URL('audio-assets.json',import.meta.url),JSON.stringify({voice:'Microsoft Heami Desktop',method:'local System.Speech synthesis',orders:report,note:'Waveform and browser playback-state verification; not a human listening or naturalness assessment.'},null,2));
console.log(`Verified ${report.length} non-silent WAVs, core assets, and module syntax.`);
