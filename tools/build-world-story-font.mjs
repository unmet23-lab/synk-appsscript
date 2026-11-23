// WORLD 이야기 해설 글꼴(본명조 · Noto Serif KR, OFL)을 이야기 장면에 쓰인 글자만 잘라 만든다(10-15 이야기 화면 디테일 ⑥). 11-23부터는 학생 시트의 레슨 제목 · 문제 상황 글자도 담는다.
// 해설은 책 글씨(본명조 450), 친구 대사는 말 글씨(SUIT). 굵기는 해설 450과 배울 말 650만 쓰므로 가변 축을 450–650으로 줄인다.
//   node tools/build-world-story-font.mjs [--source <NotoSerifKR-VF.ttf>]   → assets/NotoSerifKR-story.woff2 + .json(담긴 글자)
//   node tools/build-world-story-font.mjs --check                          → 이야기 글자가 모두 담겼는지(파이썬 없이)
//   … --also <앞 판 NotoSerifKR-story.json>   그 판의 글자도 함께 담는다. 원고를 바꿔 선택 공개할 때, 아직 옛 이야기를 싣고 있는
//     공개 묶음(홈을 혼자 여는 판)과 캐시에 남은 옛 원고가 새 글꼴로 빠진 글자 없이 보이게 한다(11-23).
// 만들 때는 fontTools(pyftsubset·varLib.instancer)와 brotli가 필요하다. 원본은 Windows에 깔린 가변 글꼴을 기본으로 쓴다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const assets=path.join(root,'experiences/brand-opening/assets');
const fontPath=path.join(assets,'NotoSerifKR-story.woff2'),listPath=path.join(assets,'NotoSerifKR-story.json');
const RANGES='U+0020-007E,U+00B7,U+2010-2027';

export async function storyCharacters(){
 const {LESSONS}=await import(pathToFileURL(path.join(root,'experiences/synk-world-app/life-content.mjs')).href);
 const chars=new Set();
 const add=text=>{for(const ch of String(text||''))if(ch.codePointAt(0)>=0x80)chars.add(ch);};
 // 이야기 해설에 더해, 종이 겉 학생 시트(11-23 「종이」 · 「학생 시트만」)의 레슨 제목과 문제 상황 글(복습 상황 포함)도 같은 명조로 쓴다.
 for(const lesson of LESSONS){for(const scene of lesson.scenes||[])add(scene.text);add(lesson.title);for(const q of lesson.questions||[]){add(q.context);add(q.review?.context);}}
 return [...chars].sort();
}
export function missingCharacters(chars,list=JSON.parse(fs.readFileSync(listPath,'utf8'))){const have=new Set(list.chars);return chars.filter(ch=>!have.has(ch));}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const chars=await storyCharacters();
 if(process.argv.includes('--check')){
  const missing=missingCharacters(chars);
  if(missing.length)throw Error(`이야기 해설 글꼴에 없는 글자 ${missing.length}개: ${missing.join('')} — node tools/build-world-story-font.mjs로 다시 만드세요`);
  console.log(`WORLD story font covers ${chars.length} characters`);
 }else{
  const at=process.argv.indexOf('--source'),source=at>0?process.argv[at+1]:'C:/Windows/Fonts/NotoSerifKR-VF.ttf';
  if(!fs.existsSync(source))throw Error(`원본 글꼴이 없어요: ${source}`);
  const also=process.argv.indexOf('--also');
  if(also>0){const all=new Set([...chars,...JSON.parse(fs.readFileSync(process.argv[also+1],'utf8')).chars]);chars.length=0;chars.push(...[...all].sort());}
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'world-story-font-')),text=path.join(work,'chars.txt'),limited=path.join(work,'limited.ttf');
  fs.writeFileSync(text,chars.join(''),'utf8');
  execFileSync('python',['-X','utf8','-m','fontTools.varLib.instancer',source,'wght=450:650','-o',limited],{stdio:'inherit'});
  execFileSync('python',['-X','utf8','-m','fontTools.subset',limited,`--text-file=${text}`,`--unicodes=${RANGES}`,'--flavor=woff2','--layout-features=kern,liga,ccmp,locl,mark,mkmk','--name-IDs=*',`--output-file=${fontPath}`],{stdio:'inherit'});
  fs.writeFileSync(listPath,JSON.stringify({font:'Noto Serif KR (SIL OFL 1.1)',weights:'450-650',ranges:RANGES,chars:chars.join('')},null,1)+'\n');
  fs.rmSync(work,{recursive:true,force:true});
  console.log(`WORLD story font built: ${chars.length} characters, ${(fs.statSync(fontPath).size/1024).toFixed(1)}KB`);
 }
}
