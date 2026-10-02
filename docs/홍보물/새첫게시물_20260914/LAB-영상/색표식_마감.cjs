'use strict';
// Existing limited-range BT.709 pixels remain unchanged; fill missing H.264 SPS labels.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const OUT=__dirname,ROOT=path.resolve(OUT,'../../../..');
const FF='C:/Users/q1212/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin/ffmpeg.exe',FP=path.join(path.dirname(FF),'ffprobe.exe');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function run(exe,args){const r=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,maxBuffer:12*1024*1024});if(r.status!==0)throw Error(r.stderr||String(r.error));return r.stdout;}
function probe(p){return JSON.parse(run(FP,['-v','error','-show_streams','-show_format','-of','json',p]));}
async function main(){
 const m=JSON.parse(fs.readFileSync(path.join(OUT,'manifest.json'))),mp4=path.join(OUT,m.file+'.mp4');
 const before=probe(mp4).streams.find(s=>s.codec_type==='video');
 if(before.pix_fmt!=='yuv420p'||before.color_range!=='tv'||before.color_space!=='bt709')throw Error('Actual conversion must already be limited BT.709');
 const ownBuild='docs/홍보물/새첫게시물_20260914/LAB-영상/만들기.cjs';
 for(const s of m.sources)if(s.path!==ownBuild&&sha(fs.readFileSync(path.join(ROOT,s.path)))!==s.sha256)throw Error('Unrelated source drift '+s.path);
 const backup=path.join(OUT,'qa/색표식전.mp4'),temp=path.join(OUT,'qa/색표식후.mp4');
 if(fs.existsSync(backup))throw Error('Pre-finish backup already exists; inspect instead of replacing');
 fs.copyFileSync(mp4,backup);
 const bsf='h264_metadata=video_full_range_flag=0:colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1';
 run(FF,['-y','-hide_banner','-loglevel','error','-i',backup,'-map','0','-c','copy','-bsf:v',bsf,'-movflags','+faststart',temp]);
 const after=probe(temp).streams.find(s=>s.codec_type==='video');
 if(after.color_range!=='tv'||after.color_space!=='bt709'||after.color_transfer!=='bt709'||after.color_primaries!=='bt709')throw Error('Color labels still incomplete');
 const rawHash=p=>run(FF,['-hide_banner','-loglevel','error','-i',p,'-map','0:v:0','-f','hash','-hash','sha256','-']).trim();
 const rawBefore=rawHash(backup),rawAfter=rawHash(temp);if(rawBefore!==rawAfter)throw Error('Decoded YUV changed');
 const beforePng=m.keyframes.map(k=>({file:k.encoded,sha256:sha(fs.readFileSync(path.join(OUT,k.encoded)))}));
 fs.copyFileSync(temp,mp4);
 for(const k of m.keyframes){run(FF,['-y','-hide_banner','-loglevel','error','-ss',String(k.time),'-i',mp4,'-frames:v','1',path.join(OUT,k.encoded)]);await sharp(path.join(OUT,k.encoded)).resize({width:390}).png().toFile(path.join(OUT,k.encoded.replace('.png','-390.png')));}
 const unchangedPng=beforePng.every(x=>sha(fs.readFileSync(path.join(OUT,x.file)))===x.sha256);
 const record={checkedAt:new Date().toISOString(),mode:'H264 SPS labels only; stream copy; no re-encode',bsf,backup:'qa/색표식전.mp4',beforeSha256:sha(fs.readFileSync(backup)),afterSha256:sha(fs.readFileSync(mp4)),rawBefore,rawAfter,decodedPixelsIdentical:rawBefore===rawAfter,encodedKeyframePngIdentical:unchangedPng};
 fs.writeFileSync(path.join(OUT,'qa/색표식_대조.json'),JSON.stringify(record,null,2)+'\n');
 const build=m.sources.find(s=>s.path===ownBuild),bb=fs.readFileSync(path.join(ROOT,ownBuild));build.sha256=sha(bb);build.bytes=bb.length;
 const self=fs.readFileSync(__filename);m.sources.push({path:path.relative(ROOT,__filename).replace(/\\/g,'/'),sha256:sha(self),bytes:self.length});
 m.probe=probe(mp4);m.mp4Sha256=record.afterSha256;m.mp4Bytes=fs.statSync(mp4).size;m.colorLabelFinish=record;m.sourceChanges=[];
 fs.writeFileSync(path.join(OUT,'manifest.json'),JSON.stringify(m,null,2)+'\n');console.log(JSON.stringify(record,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
