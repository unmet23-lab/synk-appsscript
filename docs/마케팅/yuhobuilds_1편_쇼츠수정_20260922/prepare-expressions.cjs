const fs=require('node:fs'),path=require('node:path');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const dir=path.join(__dirname,'assets/expressions');
const names={smile:'exec-8b06ace1-65a4-40c9-b4d6-814596a9e593.png',puzzled:'exec-0e163f49-d05a-44b6-a060-d1e92427d6fd.png',surprise:'exec-01297b08-03dc-4f43-9179-3f57c78dacb5.png',blink:'exec-7155d9d6-9490-4b2f-b0ae-6a7838f8f24f.png'};
async function keyed(input){const {data,info}=await sharp(input).resize(1254,1254).ensureAlpha().raw().toBuffer({resolveWithObject:true});for(let i=0;i<data.length;i+=4){const excess=data[i+1]-Math.max(data[i],data[i+2]);const alpha=Math.min(1,Math.max(0,1-(excess-12)/110));data[i+3]=Math.round(alpha*255);if(alpha<1)data[i+1]=Math.min(data[i+1],Math.max(data[i],data[i+2])+12);}return sharp(data,{raw:{width:info.width,height:info.height,channels:4}});}
(async()=>{
 fs.mkdirSync(dir,{recursive:true});
 const ref=await keyed(path.join(__dirname,'assets/yuho-head-green.png'));
 const {info}=await ref.clone().trim({threshold:4}).toBuffer({resolveWithObject:true});
 const crop={left:Math.abs(info.trimOffsetLeft),top:Math.abs(info.trimOffsetTop),width:info.width,height:info.height};
 for(const [name,file] of Object.entries(names)){
  const input=path.join(dir,name+'-green.png');if(!fs.existsSync(input))fs.copyFileSync(path.join('C:/Users/q1212/.codex/generated_images/01a0c46e-2209-7841-90b2-034f2eb9fcd6',file),input);
  const keyedImage=await keyed(input);await keyedImage.extract(crop).png().toFile(path.join(dir,name+'.png'));
 }
 fs.writeFileSync(path.join(dir,'alignment.json'),JSON.stringify({crop,method:'Shared neutral-head crop; all expressions keep the same canvas alignment.',variants:Object.keys(names)},null,2));
 console.log(JSON.stringify(crop));
})().catch(e=>{console.error(e);process.exitCode=1});
