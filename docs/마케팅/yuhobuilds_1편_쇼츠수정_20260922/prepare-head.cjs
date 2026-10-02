// Convert the ImageGen chroma-key export to an alpha asset for Remotion.
const fs=require('node:fs'),path=require('node:path');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
async function main(){
 const dir=path.join(__dirname,'assets'),input=path.join(dir,'yuho-head-green.png');
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let i=0;i<data.length;i+=4){
  const excess=data[i+1]-Math.max(data[i],data[i+2]);
  const alpha=Math.min(1,Math.max(0,1-(excess-12)/110));
  data[i+3]=Math.round(alpha*255);
  if(alpha<1)data[i+1]=Math.min(data[i+1],Math.max(data[i],data[i+2])+12);
 }
 const target=path.join(dir,'yuho-head.png');
 await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).trim({threshold:4}).png().toFile(target);
 const metadata=await sharp(target).metadata(),stats=await sharp(target).stats();
 if(!metadata.hasAlpha||stats.channels[3].min!==0||stats.channels[3].max!==255)throw Error('Expected alpha cutout');
 console.log(JSON.stringify({width:metadata.width,height:metadata.height,alpha:true}));
}
main().catch(e=>{console.error(e);process.exitCode=1});
