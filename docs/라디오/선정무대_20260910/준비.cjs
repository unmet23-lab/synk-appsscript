'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..'),pub=path.join(root,'영상/public/radioDreams20260910');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const faces=['본체','눈감음','눈웃음'];
const donor='docs/Loom_자산/라디오차림/까몽/_후보/여름델+전설의팻말/65f92a753bb5416b';
async function main(){
 fs.mkdirSync(pub,{recursive:true});const inputs=[];
 const copy=(source,name)=>{const p=path.join(root,source),out=path.join(pub,name),sha=hash(p);fs.copyFileSync(p,out);if(hash(out)!==sha)throw Error('Copy mismatch');inputs.push({path:source,sha256:sha,copy:name});return out;};
 const donorPaths=faces.map((f,i)=>copy(`${donor}/여름델+전설의팻말_${f}.webp`,`water-${i}.webp`));
 const leafPath=copy('docs/Loom_자산/라디오차림/까몽/3개월출석잎망토_본체.webp','leaf-base.webp');
 copy('docs/라디오/무대/dream_water.png','water-still.png');copy('docs/라디오/무대/dream_field.png','field-still.png');
 const donors=await Promise.all(donorPaths.map(p=>sharp(p).ensureAlpha().raw().toBuffer())),leaf=await sharp(leafPath).ensureAlpha().raw().toBuffer();
 const result=require(path.join(root,'영상/src/radioDreams20260910/pixels.cjs')).build(donors,leaf);
 // Analysis mask is not an edited mascot; preserve the exact allowed support for verification.
 await sharp(Buffer.from(result.mask),{raw:{width:1024,height:1024,channels:1}}).png().toFile(path.join(__dirname,'눈영역_검사.png'));
 const schedule=[];const rhythm=require(path.join(root,'bots/오버레이/라디오표정리듬.js')).만들기({seed:20260910});
 const expression={기본:0,깜빡:1,눈웃음:2};
 for(let f=0;f<1848;f++)schedule.push(expression[rhythm.읽기(f*1000/30,{밤:true,가능표정:Object.keys(expression)}).표정]);
 // The master is a 60s loop: ensure a calm open-eyed seam; no state jump or repeated closed face.
 for(let f=1740;f<1848;f++)schedule[f]=0;
 const plan={duration:61.6,masterDuration:60,fps:30,faces:schedule,files:inputs,stats:result.stats};
 fs.writeFileSync(path.join(pub,'plan.json'),JSON.stringify(plan));
 const record={at:new Date().toISOString(),head:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),inputs,stats:result.stats,method:'Display-time composition: approved three water eyes reused only within non-rectangular eye support on a fixed leaf body. Common edge recipe per body. No new wardrobe image generation; no original asset edits.',visualQA:'pending'};
 fs.writeFileSync(path.join(__dirname,'자산검사.json'),JSON.stringify(record,null,2));
 console.log(JSON.stringify({prepared:inputs.length,stats:result.stats,expressions:[...new Set(schedule)]}));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
