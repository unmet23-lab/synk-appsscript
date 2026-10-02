'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const OUT=__dirname,ROOT=path.resolve(OUT,'../../../..');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const FF='C:/Users/q1212/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const m=JSON.parse(fs.readFileSync(path.join(OUT,'manifest.json'))),items=[];
 for(const k of m.keyframes){
  const old=path.join(OUT,k.encoded.replace('-encoded.png','-before-tags.png'));
  const r=spawnSync(FF,['-y','-hide_banner','-loglevel','error','-ss',String(k.time),'-i',path.join(OUT,'qa/색표식전.mp4'),'-frames:v','1',old],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error(r.stderr);
  const oldRaw=await sharp(old).raw().toBuffer(),newRaw=await sharp(path.join(OUT,k.encoded)).raw().toBuffer();
  let changed=0,maxDiff=0;for(let i=0;i<oldRaw.length;i++){const d=Math.abs(oldRaw[i]-newRaw[i]);if(d)changed++;maxDiff=Math.max(maxDiff,d);}
  items.push({frame:k.frame,pngFileIdentical:sha(fs.readFileSync(old))===sha(fs.readFileSync(path.join(OUT,k.encoded))),rgbPixelIdentical:oldRaw.equals(newRaw),changedChannels:changed,maxChannelDifference:maxDiff});
 }
 const result={checkedAt:new Date().toISOString(),allRgbPixelsIdentical:items.every(x=>x.rgbPixelIdentical),items};
 fs.writeFileSync(path.join(OUT,'qa/PNG_화소대조.json'),JSON.stringify(result,null,2)+'\n');
 const self=fs.readFileSync(__filename);m.sources.push({path:path.relative(ROOT,__filename).replace(/\\/g,'/'),sha256:sha(self),bytes:self.length});m.pngColorLabelComparison=result;
 fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
