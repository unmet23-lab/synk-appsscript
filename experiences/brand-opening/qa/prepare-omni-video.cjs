// Encoding-only delivery copy of the complete reviewed Omni shot.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const variant=process.argv[2];if(!['portrait','landscape'].includes(variant))throw Error('Choose variant');
const revision=process.argv.find(s=>s.startsWith('--revision='))?.split('=')[1]||'v6';
if(!['v6','v7','v8','v9'].includes(revision))throw Error('Unsupported revision');
const locked=process.argv.includes('--locked');
if(locked&&revision!=='v9')throw Error('Background lock is only reviewed for v9');
const root=path.resolve(__dirname,'..'),device=variant==='portrait'?'mobile':'desktop';
const source=path.join(root,`raw/felt-trio-${revision}/${variant}-omni11-1080p-${revision}${locked?'-locked':''}.mp4`);
const probe=file=>JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}));
const original=probe(source).streams.find(s=>s.codec_type==='video');
const fps=original.r_frame_rate.split('/').reduce((a,b)=>Number(a)/Number(b));
const target=path.join(root,`assets/world-menu-${device}-omni11-${revision}-web.mp4`);
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',source,'-map','0:v:0','-c:v','libx264','-preset','medium','-crf','18','-threads','2','-g',String(Math.round(fps)),'-keyint_min',String(Math.round(fps)),'-sc_threshold','0','-pix_fmt','yuv420p','-an','-movflags','+faststart',target]);
const video=probe(target).streams.find(s=>s.codec_type==='video');
if(video.nb_frames!==original.nb_frames||video.width!==original.width||video.height!==original.height||video.r_frame_rate!==original.r_frame_rate)throw Error('Native geometry/timing changed');
const poster=path.join(root,`assets/felt-world-scene-${device}-${revision}.webp`);
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',source,'-frames:v','1','-c:v','libwebp','-quality','95',poster]);
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const records=[{file:`assets/${path.basename(target)}`,source:`raw/felt-trio-${revision}/${path.basename(source)}`,model:'gemini-omni-1.1-flash-preview',modelVerified:true,operationEvidence:`raw/felt-trio-${revision}/${variant}.job.json`,nativeSeconds:Number(video.duration),width:video.width,height:video.height,fps,frames:Number(video.nb_frames),bytes:fs.statSync(target).size,sha256:hash(target),transform:'Full native shot; H.264 delivery encoding and muted audio only; no retouching, trimming, reverse, speed change, face/boat layers'},
{file:`assets/${path.basename(poster)}`,source:`raw/felt-trio-${revision}/${path.basename(source)}`,sha256:hash(poster),bytes:fs.statSync(poster).size,transform:'First decoded frame, WebP encoding only'}];
fs.mkdirSync(path.join(__dirname,`felt-${revision}/${variant}`),{recursive:true});
if(locked){records[0].transform='New native Omni v9 generation followed by static-background cinemagraph finishing; H.264 delivery encoding and muted audio; no separate face/head/boat overlays, crop, reverse or speed changes';records[0].finishingEvidence=`qa/felt-${revision}/${variant}/background-lock.json`;}
fs.writeFileSync(path.join(__dirname,`felt-${revision}/${variant}/web-encoding.json`),JSON.stringify(records,null,2)+'\n');
console.log(JSON.stringify({variant,seconds:Number(video.duration),fps,frames:video.nb_frames,bytes:records[0].bytes}));
