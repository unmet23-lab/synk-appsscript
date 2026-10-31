// 로컬 드라마 시범판 전용. 녹음은 파일로 쓰지 않고 제한된 메모리에서 해독한다.
import {spawn} from 'node:child_process';
import {차례로부르기, 바탕주소, 키차례} from './오픈AI키.mjs';
import fs from 'node:fs';

export const AUDIO_LIMIT = Object.freeze({seconds:20, bytes:2_500_000, sampleRate:16_000});
export const TRANSCRIBE_USD_PER_MINUTE = 0.0045;
export class PilotError extends Error {
  constructor(code, status=400) {super(code); this.code=code; this.status=status;}
}

export function pcmInfo(pcm, sampleRate=AUDIO_LIMIT.sampleRate) {
  if (!Buffer.isBuffer(pcm) || pcm.length%2) throw new PilotError('invalid_audio');
  let squares=0, voicedSamples=0;
  const frames=Math.floor(pcm.length/2), frameSize=Math.round(sampleRate*.02);
  // 단순 에너지 관찰은 무음을 거를 뿐 발음/감정/말하기 실력을 판정하지 않는다.
  for(let i=0;i<frames;i+=frameSize) {
    let energy=0; const end=Math.min(frames,i+frameSize);
    for(let j=i;j<end;j++){const sample=pcm.readInt16LE(j*2);energy+=sample*sample;}
    squares+=energy;
    if(Math.sqrt(energy/Math.max(1,end-i))>=120) voicedSamples+=end-i;
  }
  return {seconds:frames/sampleRate, speechSeconds:voicedSamples/sampleRate, rms:Math.sqrt(squares/Math.max(1,frames))};
}

export function wavFromPCM(pcm, sampleRate=AUDIO_LIMIT.sampleRate) {
  const out=Buffer.alloc(44+pcm.length);
  out.write('RIFF',0);out.writeUInt32LE(36+pcm.length,4);out.write('WAVEfmt ',8);
  out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);
  out.writeUInt32LE(sampleRate,24);out.writeUInt32LE(sampleRate*2,28);
  out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);
  out.writeUInt32LE(pcm.length,40);pcm.copy(out,44);return out;
}

export async function decodeAudio(bytes,{ffmpeg='ffmpeg',seconds=AUDIO_LIMIT.seconds,timeoutMs=12_000}={}) {
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>AUDIO_LIMIT.bytes) throw new PilotError('audio_size',413);
  const pcm=await new Promise((resolve,reject)=>{
    // ffmpeg 읽기 통로를 pipe로 한정해 업로드된 재생목록/파일이 로컬 파일·URL을 열지 못하게 한다.
    const child=spawn(ffmpeg,['-nostdin','-hide_banner','-loglevel','error','-protocol_whitelist','pipe',
      '-i','pipe:0','-map','0:a:0','-vn','-sn','-dn','-t',String(seconds+.1),'-threads','1',
      '-ac','1','-ar',String(AUDIO_LIMIT.sampleRate),'-f','s16le','pipe:1'],{windowsHide:true,stdio:['pipe','pipe','ignore']});
    const chunks=[];let size=0,settled=false;
    const stop=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);if(error){child.kill();reject(error);}else resolve(value);};
    const timer=setTimeout(()=>stop(new PilotError('audio_decode_timeout',422)),timeoutMs);
    child.on('error',()=>stop(new PilotError('audio_decoder_unavailable',503)));
    child.stdin.on('error',()=>{});
    child.stdout.on('data',chunk=>{
      size+=chunk.length;
      if(size>Math.ceil((seconds+.2)*AUDIO_LIMIT.sampleRate*2)) return stop(new PilotError('audio_too_long',422));
      chunks.push(chunk);
    });
    child.on('close',code=>stop(code===0&&size?null:new PilotError('invalid_audio',422),Buffer.concat(chunks)));
    child.stdin.end(bytes);
  });
  const info=pcmInfo(pcm);
  if(info.seconds>seconds+.04) throw new PilotError('audio_too_long',422);
  if(info.seconds<.25) throw new PilotError('audio_too_short',422);
  return {...info,wav:wavFromPCM(pcm),silent:info.rms<45||info.speechSeconds<.12};
}

export function existingTranscriptionAvailable() {
  try{return 키차례('말하기').some(k=>fs.existsSync(k.파일));}catch{return false;}
}

export async function transcribeWithExistingCredits(wav) {
  const {답,요청}=await 차례로부르기(()=>{
    const form=new FormData();
    form.set('file',new Blob([wav],{type:'audio/wav'}),'speech.wav');
    form.set('model','gpt-transcribe');
    // 목표 대사·핵심 낱말을 prompt에 넣지 않는다. 처음 보는 상황의 답을 받아쓰기에 주입하지 않는다.
    return {주소:`${바탕주소()}/audio/transcriptions`,몸:form};
  },{용도:'말하기',제한ms:30_000});
  return {text:답?.text,languages:답?.languages,requestId:요청};
}
