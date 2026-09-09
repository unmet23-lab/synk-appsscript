'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),cp=require('child_process');
const root=path.resolve(__dirname,'../../..'),out=path.join(__dirname,'라이브13');fs.mkdirSync(out,{recursive:true});
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const pixelPath=path.join(root,'영상/src/radioDreams20260910/pixels.cjs');
const donor='../../docs/Loom_자산/라디오차림/까몽/_후보/여름델+전설의팻말/65f92a753bb5416b/';
const leafOriginal=path.join(root,'docs/Loom_자산/라디오차림/까몽/3개월출석잎망토_본체.webp');
const leafName='leaf-base-'+sha(leafOriginal).slice(0,12)+'.webp',leaf=path.join(out,leafName);fs.copyFileSync(leafOriginal,leaf);
const leafUrl='../../docs/라디오/선정무대_20260910/라이브13/'+leafName;
let kernel=fs.readFileSync(pixelPath,'utf8');
if(!kernel.includes("const edge=require('../../../bots/오버레이/라디오가장자리.js');")||!kernel.includes('module.exports={build,W,H};'))throw Error('Pixel kernel changed');
kernel=kernel.replace("const edge=require('../../../bots/오버레이/라디오가장자리.js');",'const edge=window.라디오가장자리;').replace('module.exports={build,W,H};','');
const helper=`(function(){\n${kernel}\nconst load=async(url)=>{const im=new Image();im.src=url;await im.decode();const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(im,0,0);return context.getImageData(0,0,1024,1024).data;};
const donor=${JSON.stringify(donor)},leafUrl=${JSON.stringify(leafUrl)};
let cache;
const indices={기본:0,깜빡:1,눈웃음:2,궁금함:0,집중:0,안도:2,응원:2,기쁨:2,놀람:0};
window.라디오13={읽기:async(name)=>{
 if(!Object.hasOwn(indices,name))throw Error('Unreviewed leaf expression '+name);
 if(!cache)cache=Promise.all([...['본체','눈감음','눈웃음'].map(n=>load(donor+'여름델+전설의팻말_'+n+'.webp')),load(leafUrl)]).then(all=>{
  const result=build(all.slice(0,3),all[3]);window.라디오13.검사=result.stats;
  return result.field.map(data=>{const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data),1024,1024),0,0);return canvas.toDataURL('image/png');});
 });
 const urls=await cache,im=new Image();im.src=urls[indices[name]];await im.decode();im.dataset.originalSrc=leafUrl;im.dataset.radio13=name;return im;
}};
})();\n`;
new vm.Script(helper);
const helperName='radio13-'+crypto.createHash('sha256').update(helper).digest('hex').slice(0,12)+'.js';
fs.writeFileSync(path.join(out,helperName),helper);
const source=path.join(root,'docs/_ops/라디오생동_20260909/털고정/after-마스코트.html');
if(sha(source)!=='64e3c25efc30375e999be983da7e6295de01108f8b7de0e676f44e32412da983')throw Error('Live source snapshot changed');
let html=fs.readFileSync(source,'utf8');
const replace=(a,b)=>{if(html.split(a).length!==2)throw Error('Unique patch anchor missing '+a);html=html.replace(a,b);};
replace('<script src="라디오가장자리-b76f448ab55a.js"></script>','<script src="라디오가장자리-b76f448ab55a.js"></script>\n<script src="'+helperName+'"></script>');
replace("라디오가장자리.읽기(컷경로[DJ] + 파일, 컷경로[DJ] + 컷표[DJ].기본, 인자.get('경계원본') !== '1')","라디오13.읽기(이름)");
replace("  const 첫결 = 인자.get('결');","  const 첫결 = 인자.get('결') || '반딧불노을들판';");
replace("  드림들판:         { DJ: '까몽', 옷: [], 접지: 'rgba(58,76,42,0.34)' },","  드림들판:         { DJ: '까몽', 옷: [], 접지: 'rgba(58,76,42,0.34)' },\n  반딧불노을들판:   { DJ: '까몽', 옷: [] },");
replace('function 갈아입기(결) {','function 갈아입기(결) {\n  document.body.dataset.radioScene = 결 === \'반딧불노을들판\' ? \'13\' : \'\';');
const token=JSON.parse(fs.readFileSync(path.join(root,'docs/디자인_토큰.json'),'utf8'));
const graphite=token.색.킷.find(c=>c.이름==='Graphite').hex;
const rgb=[1,3,5].map(i=>parseInt(graphite.slice(i,i+2),16)).join(',');
replace('</style>',`/* Selected 13 composition: preserve the approved 1920x1080 layout; no mascot auto-resize. */
body[data-radio-scene="13"] #마스코트틀 {left:23.6979166667vw!important;top:28.2407407407vh!important;width:30.2083333333vw!important;right:auto!important;bottom:auto!important;margin-left:0!important;transform-origin:43% 86.5234375%;}
body[data-radio-scene="13"] #마스코트틀 img:not(.옷) {transform:none!important;}
body[data-radio-scene="13"] #접지 {left:22.3103448276%;top:83.4199892241%;width:41.3793103448%;height:7.7586206897%;bottom:auto;transform:none;background:radial-gradient(ellipse at center,rgba(${rgb},.60) 0%,rgba(${rgb},.26) 34%,transparent 74%);}
</style>`);
for(const [,code] of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(code);
fs.writeFileSync(path.join(out,'after-마스코트.html'),html);
const stage=path.join(out,'field-radio-720p.mp4');
cp.execFileSync('ffmpeg',['-v','error','-y','-i',path.join(root,'영상/public/radioDreams20260910/field-loop.mp4'),'-an','-vf','scale=1280:720:flags=lanczos','-c:v','libx264','-threads','2','-crf','18','-preset','medium','-pix_fmt','yuv420p','-g','30','-movflags','+faststart',stage],{windowsHide:true});
cp.execFileSync('ffmpeg',['-v','error','-i',stage,'-f','null','-'],{windowsHide:true});
const manifest={at:new Date().toISOString(),sourceHtmlSha:sha(source),pixelKernelSha:sha(pixelPath),helperName,helperSha:sha(path.join(out,helperName)),leafName,leafSha:sha(leaf),htmlSha:sha(path.join(out,'after-마스코트.html')),stageSha:sha(stage),stageName:'field-radio13-20260910-'+sha(stage).slice(0,12)+'.mp4',expressions:['기본','깜빡','눈웃음'],otherEventExpressions:'Base/smile aliases; no unreviewed leaf sprites',layout:{left:455,top:305,size:580,canvas:[1920,1080]}};
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify(manifest));
