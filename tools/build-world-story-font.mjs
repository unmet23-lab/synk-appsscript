// WORLD 이야기 해설 글꼴(본명조 · Noto Serif KR, OFL)을 이야기 장면에 쓰인 글자만 잘라 만든다(10-15 이야기 화면 디테일 ⑥).
// 해설은 책 글씨(본명조 450), 친구 대사는 말 글씨(SUIT). 굵기는 해설 450과 형광펜 650만 쓰므로 가변 축을 450–650으로 줄인다.
//   node tools/build-world-story-font.mjs [--source <NotoSerifKR-VF.ttf>]   → assets/NotoSerifKR-story.woff2 + .json(담긴 글자)
//   node tools/build-world-story-font.mjs --check                          → 이야기 글자가 모두 담겼는지(파이썬 없이)
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
 for(const lesson of LESSONS)for(const scene of lesson.scenes||[])for(const ch of scene.text)if(ch.codePointAt(0)>=0x80)chars.add(ch);
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
  const work=fs.mkdtempSync(path.join(os.tmpdir(),'world-story-font-')),text=path.join(work,'chars.txt'),limited=path.join(work,'limited.ttf');
  fs.writeFileSync(text,chars.join(''),'utf8');
  execFileSync('python',['-X','utf8','-m','fontTools.varLib.instancer',source,'wght=450:650','-o',limited],{stdio:'inherit'});
  execFileSync('python',['-X','utf8','-m','fontTools.subset',limited,`--text-file=${text}`,`--unicodes=${RANGES}`,'--flavor=woff2','--layout-features=kern,liga,ccmp,locl,mark,mkmk','--name-IDs=*',`--output-file=${fontPath}`],{stdio:'inherit'});
  fs.writeFileSync(listPath,JSON.stringify({font:'Noto Serif KR (SIL OFL 1.1)',weights:'450-650',ranges:RANGES,chars:chars.join('')},null,1)+'\n');
  fs.rmSync(work,{recursive:true,force:true});
  console.log(`WORLD story font built: ${chars.length} characters, ${(fs.statSync(fontPath).size/1024).toFixed(1)}KB`);
 }
}
