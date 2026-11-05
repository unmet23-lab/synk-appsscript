// 서울행 배경 소리 · 효과음을 상업용으로 다시 굽는다(일레븐랩스 효과음, 2026-11-05).
// 시안의 소리 15개는 비상업 조건 모델로 만들어 공개 앱에 그대로 쓸 수 없다(설계 7절). 지시문은 시안과 같게 두고, 같은 이름으로 굽는다.
//   node experiences/seoul-arrival/qa/소리굽기.mjs --시험            한 개만(권한 확인)
//   node experiences/seoul-arrival/qa/소리굽기.mjs [--판 2] [--만 room,crowd]   → .tmp/seoul-sound/raw/<이름>_<판>.mp3
// 다듬기는 소리다듬기.py. 열쇠는 ~/SYNK_보안/elevenlabs.txt(저장소 밖). 초당 40크레딧이라 한 벌(판 2) 약 7천 크레딧이다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('../../../',import.meta.url));
const OUT=path.join(ROOT,'.tmp/seoul-sound/raw');
const key=fs.readFileSync(path.join(os.homedir(),'SYNK_보안','elevenlabs.txt'),'utf8').trim().split(/\s+/).pop();

// loop: 바탕 소리는 이어 붙이기 좋게 고리로 굽는다. 길이는 다듬은 뒤 쓰는 길이보다 조금 길게.
export const SOUNDS=[
 {name:'room',sec:9,loop:true,text:'a quiet small bedroom at night, soft low room tone, very faint distant city traffic far away outside a closed window'},
 {name:'clock',sec:9,loop:true,text:'a wall clock ticking slowly once per second in a silent bedroom at night, clear soft tick, no other sounds'},
 {name:'dawn',sec:9,loop:true,text:'early morning, small birds chirping outside an open window, a quiet room, a pencil writing and scribbling on paper close by'},
 {name:'cabin',sec:9,loop:true,text:'inside an airplane cabin during descent, steady low jet engine hum, soft air conditioning hiss, calm'},
 {name:'train',sec:9,loop:true,text:'inside a subway train crossing a long steel bridge, rhythmic wheels clacking over rail joints, steady rumble, airy and bright'},
 {name:'campus',sec:9,loop:true,text:'a university campus plaza on a spring morning, birds singing in trees, distant students chatting and laughing softly, light footsteps on stone'},
 {name:'airport',sec:9,loop:true,text:'a quiet airport departure gate before dawn, soft distant murmur of a few travellers, gentle air conditioning hum, calm and spacious'},
 {name:'hall',sec:9,loop:true,text:'a large bright airport arrivals hall, soft murmur of many travellers waiting in line, rolling suitcase wheels in the distance, footsteps on hard floor, spacious reverb'},
 {name:'canteen',sec:9,loop:true,text:'a busy university cafeteria at lunchtime, soft murmur of many students talking far away, metal trays and spoons clinking, plates being stacked, spacious room'},
 {name:'crowd',sec:6,text:'a huge outdoor concert crowd cheering and screaming with excitement, thousands of fans, roaring applause'},
 {name:'applause',sec:6,text:'an audience in a small movie theater applauding warmly after a premiere screening, clapping hands, indoors, no music, no voices'},
 {name:'zip',sec:3,text:'closing the zipper of a suitcase in one long quick pull, close up, then a soft pat on the lid'},
 {name:'walk',sec:5,text:'footsteps on stone pavement while pulling a rolling suitcase, the small wheels rumbling over the tiles, outdoors'},
 {name:'print',sec:3,text:'a small plastic card printer printing an id card, short mechanical whirr and a click as the card drops out'},
 {name:'stamp',sec:1.5,text:'a single firm rubber stamp pressed hard onto a passport page on a desk, one solid thump'},
];

async function bake(s,take){
 const file=path.join(OUT,`${s.name}_${take}.mp3`);
 if(fs.existsSync(file))return {file,cached:true};
 const r=await fetch('https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_192',{method:'POST',headers:{'xi-api-key':key,'content-type':'application/json'},
  body:JSON.stringify({text:s.text,duration_seconds:s.sec,prompt_influence:.5,model_id:'eleven_text_to_sound_v2',...(s.loop?{loop:true}:{})})});
 if(!r.ok)throw Object.assign(Error(`${s.name}: ${r.status} ${(await r.text()).slice(0,300)}`),{status:r.status});
 fs.mkdirSync(OUT,{recursive:true});fs.writeFileSync(file,Buffer.from(await r.arrayBuffer()));
 return {file,cached:false};
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=n=>{const i=args.indexOf(n);return i<0?null:args[i+1];};
 const takes=Number(arg('--판'))||2,only=arg('--만')?.split(','),test=args.includes('--시험');
 const list=test?SOUNDS.filter(s=>s.name==='stamp'):SOUNDS.filter(s=>!only||only.includes(s.name));
 for(const s of list)for(let t=1;t<=(test?1:takes);t++){
  const {file,cached}=await bake(s,t);
  console.log(cached?'있음':'구움',s.name,t,fs.statSync(file).size);
 }
}
