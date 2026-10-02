'use strict';
// Delivery-only color range/matrix conversion of THESE newly made movies.
// Captured master movies and their producer hashes are preserved, never replaced.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const sharp=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const OUT=__dirname,ROOT=path.resolve(OUT,'../../../..');
const bin='C:/Users/q1212/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-8.1.2-full_build/bin';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function p(rel){const f=path.resolve(OUT,rel);if(!f.startsWith(OUT+path.sep))throw new Error('outside ownership');return f;}
function run(exe,args){const r=spawnSync(path.join(bin,exe+'.exe'),args,{encoding:'utf8',windowsHide:true,maxBuffer:16e6});if(r.status!==0)throw new Error(r.stderr||r.error);return r.stdout;}
async function main(){
  const manifest=JSON.parse(fs.readFileSync(p('manifest.json'),'utf8'));
  const rangeAlreadyConverted=!!manifest.deliveryColorConversion;
  fs.mkdirSync(p('masters'),{recursive:true});
  for(const v of manifest.videos){
    if(hash(fs.readFileSync(p(v.file)))!==v.mp4Sha256)throw new Error('Current delivery movie hash drift');
    if(!rangeAlreadyConverted){
    const input=path.join('masters',v.file.replace('.mp4','-capture-master.mp4'));
    if(hash(fs.readFileSync(p(v.file)))!==v.mp4Sha256)throw new Error('Input movie hash drift');
    if(fs.existsSync(p(input))&&hash(fs.readFileSync(p(input)))!==v.mp4Sha256)throw new Error('Different preserved master exists');
    if(!fs.existsSync(p(input)))fs.copyFileSync(p(v.file),p(input));
    const sourceStream=v.probe.streams.find(s=>s.codec_type==='video');
    if(sourceStream.pix_fmt!=='yuvj420p'||sourceStream.color_range!=='pc'||sourceStream.color_space!=='bt470bg')throw new Error('Unexpected source color mapping; inspect instead of guessing');
    const filter='scale=in_range=pc:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p,sidedata=mode=delete:type=ICC_PROFILE';
    const args=['-y','-hide_banner','-loglevel','error','-i',p(input),'-vf',filter,'-c:v','libx264','-preset','fast','-crf','14','-pix_fmt','yuv420p','-color_range','tv','-colorspace','bt709','-color_primaries','bt709','-color_trc','bt709','-r','30','-fps_mode','cfr','-c:a','copy','-map_metadata','-1','-movflags','+faststart',p(v.file)];
    run('ffmpeg',args);
    v.captureMaster={file:input,sha256:v.mp4Sha256,probe:v.probe};v.mp4Sha256=hash(fs.readFileSync(p(v.file)));
    v.probe=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',p(v.file)]));
    }
    // FFmpeg 8 kept the matrix but omitted the other SPS VUI tags. Set tags by
    // stream copy AFTER the actual range conversion: no new pixel compression.
    const current=v.probe.streams.find(s=>s.codec_type==='video');
    if(current.color_primaries!=='bt709'||current.color_transfer!=='bt709'){
      const tagged=`qa/${v.id}-metadata-tagged.mp4`;
      run('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',p(v.file),'-map','0','-c','copy','-bsf:v','h264_metadata=video_full_range_flag=0:colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1','-movflags','+faststart',p(tagged)]);
      fs.copyFileSync(p(tagged),p(v.file));fs.unlinkSync(p(tagged));
      v.mp4Sha256=hash(fs.readFileSync(p(v.file)));v.probe=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',p(v.file)]));
    }
    const s=v.probe.streams.find(s=>s.codec_type==='video');if(s.pix_fmt!=='yuv420p'||s.color_range!=='tv'||s.color_space!=='bt709'||s.color_primaries!=='bt709'||s.color_transfer!=='bt709')throw new Error('Delivery color conversion failed');
    for(const key of v.keys){run('ffmpeg',['-y','-hide_banner','-loglevel','error','-ss',String(key.time),'-i',p(v.file),'-frames:v','1',p(key.encoded)]);await sharp(p(key.encoded)).resize({width:390}).png().toFile(p(key.encoded.replace('.png','-390.png')));}
    console.log(v.id+': limited-range delivery and all extracted frames updated');
  }
  manifest.deliveryColorConversion={at:new Date().toISOString(),reason:'JPEG capture yielded full-range yuvj420p/bt470bg. Delivery uses explicit limited-range yuv420p, BT.709 matrix/primaries/transfer. No creative grade or motion edit.',oldMoviesReused:false,newMastersPreserved:true,audioStreamCopied:true,ffmpegVersion:'8.1.2',regeneration:'만들기.cjs -> 패키지마감.cjs -> 검증.cjs'};
  const rel=path.relative(ROOT,__filename).replace(/\\/g,'/'),source=fs.readFileSync(__filename);
  if(!manifest.sources.some(s=>s.path===rel))manifest.sources.push({path:rel,sha256:hash(source),bytes:source.length});
  // Keep earlier producer fingerprints when only this packaging step or index
  // typography is refined after capture; never re-label the untouched Loom input.
  for(const s of manifest.sources){const current=fs.readFileSync(path.join(ROOT,s.path)),next=hash(current);if(next!==s.sha256&&['만들기.cjs','패키지마감.cjs'].includes(path.basename(s.path))){manifest.producerRefinements??=[];manifest.producerRefinements.push({path:s.path,captureOrEarlierSha256:s.sha256,currentSha256:next,reason:'Local index word wrapping or delivery VUI metadata only; no Loom/movie composition change.'});s.sha256=next;s.bytes=current.length;}}
  const index=fs.readFileSync(p('index.html'),'utf8').replace('font-synthesis:none;font-weight:500}', 'font-synthesis:none;font-weight:500;word-break:keep-all;overflow-wrap:anywhere}').replaceAll('preload="metadata"','preload="none"');fs.writeFileSync(p('index.html'),index);
  manifest.sourceChanges=manifest.sources.filter(s=>hash(fs.readFileSync(path.join(ROOT,s.path)))!==s.sha256);if(manifest.sourceChanges.length)throw new Error('Source changes detected');
  fs.writeFileSync(p('manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log('Delivery ready, source changes 0. Re-run verification.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
