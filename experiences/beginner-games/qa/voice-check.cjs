'use strict';
// Local audio inspection only: no generation, no network, no paid transcription.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const G=require('../../../tools/lib/미니게임목소리_게임.cjs');
const {createLocalTranscriber}=require('../../../tools/patent-studio/local-transcriber.cjs');
(async()=>{
 const bank=JSON.parse(fs.readFileSync(path.join(__dirname,'../audio/manifest.json'),'utf8'));
 const files=Object.values(bank.clips).map(c=>path.resolve(__dirname,'..',c.file));
 const list=path.join(__dirname,'voice-check.ffconcat');
 fs.writeFileSync(list,'ffconcat version 1.0\n'+files.map(p=>`file '${p.replace(/\\/g,'/')}'`).join('\n')+'\n');
 const output=path.join(__dirname,'voice-check.mp3');
 execFileSync(G.tool('ffmpeg'),['-v','error','-nostdin','-y','-safe','0','-f','concat','-i',list,'-af','asetpts=N/SR/TB','-codec:a','libmp3lame','-b:a','96k',output],{windowsHide:true});
 const stt=createLocalTranscriber();
 try {
  const available=await stt.status();
  if(!available.available)throw Error('설치된 로컬 받아쓰기 없음');
  const result=await stt.transcribe({bytes:fs.readFileSync(output),mimeType:'audio/mpeg'});
  const record={at:new Date().toISOString(),expected:Object.values(bank.clips).map(c=>c.text),transcript:result.text,
   duration:result.raw.response.durationSeconds,offline:result.raw.offline,networkAttempts:result.raw.networkAttempts,
   model:result.model,needsHumanListening:true,note:'자동 받아쓰기는 실제 발음·목소리 선호의 사람 청취를 대신하지 않는다.'};
  fs.writeFileSync(path.join(__dirname,'voice-check.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify(record));
 } finally {await stt.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
