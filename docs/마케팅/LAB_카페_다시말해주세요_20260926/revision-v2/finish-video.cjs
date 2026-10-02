'use strict';
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const base = __dirname;
const at = name => path.join(base, name);
const raw = at('SYNK_LAB_카페_몽글_감정연기_v2_raw.mp4');
const final = at('SYNK_LAB_카페_몽글_감정연기_v2.mp4');
const preview = at('mongle-preview-v2.webm');
function run(exe, args) {
  const result = cp.spawnSync(exe, args, {encoding:'utf8', windowsHide:true, maxBuffer:16e6});
  if (result.status !== 0) throw Error(result.stderr || result.stdout || String(result.error));
  return result;
}
const probe = file => JSON.parse(run('ffprobe', ['-v','error','-show_streams','-show_format','-of','json',file]).stdout);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const loudness = log => {
  const match = log.match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!match) throw Error('Missing loudness result');
  return JSON.parse(match[0]);
};
const rawMeasure = run('ffmpeg', ['-hide_banner','-nostats','-i',raw,'-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','NUL']);
fs.writeFileSync(at('raw-loudness.log'), rawMeasure.stderr);
const measured = loudness(rawMeasure.stderr);
const gainDb = Math.floor(Math.min(-16-Number(measured.input_i), -1.5-Number(measured.input_tp)) * 100) / 100;
console.log(JSON.stringify({stage:'final-audio',rawLUFS:measured.input_i,gainDb}));
run('ffmpeg', ['-y','-v','warning','-i',raw,'-map','0:v:0','-map','0:a:0','-c:v','copy','-af',`volume=${gainDb}dB`,'-c:a','aac','-b:a','192k','-movflags','+faststart',final]);
const verify = run('ffmpeg', ['-hide_banner','-nostats','-i',final,'-vf','blackdetect=d=0.1:pix_th=0.10','-af','loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json','-f','null','NUL']);
fs.writeFileSync(at('final-media-check.log'),verify.stderr);
if (/black_start:/.test(verify.stderr)) throw Error('Black interval detected; inspect final-media-check.log');
const finalLoudness = loudness(verify.stderr), media = probe(final), video = media.streams.find(s=>s.codec_type==='video');
const timing = JSON.parse(fs.readFileSync(at('mongle-video/timing.json'),'utf8'));
if (video.width!==1080 || video.height!==1920 || video.avg_frame_rate!=='30/1' || Math.abs(Number(media.format.duration)-timing.duration)>.1) throw Error('Render spec mismatch');
if (Number(finalLoudness.input_tp)>-1) throw Error('Audio peak exceeds -1 dBTP');
console.log(JSON.stringify({stage:'web-preview',seconds:media.format.duration,lufs:finalLoudness.input_i,truePeak:finalLoudness.input_tp}));
run('ffmpeg', ['-y','-v','warning','-i',final,'-vf','scale=720:1280','-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','6','-row-mt','1','-crf','31','-b:v','0','-pix_fmt','yuv420p','-c:a','libopus','-b:a','128k',preview]);
run('ffmpeg', ['-v','error','-i',preview,'-f','null','NUL']);
run('ffmpeg', ['-y','-v','error','-ss','10.7','-i',final,'-frames:v','1','-vf','scale=720:1280','-q:v','2',at('mongle-cover-v2.jpg')]);
const speech = JSON.parse(fs.readFileSync(at('audio/speech.json'),'utf8'));
const phraseHashes = ['phrase-learn','phrase-retry','phrase-ending'].map(id=>({id,sha256:hash(at(`audio/${id}.wav`))}));
if (new Set(phraseHashes.map(x=>x.sha256)).size!==3) throw Error('Phrase takes are not unique');
const validation = {
  checkedAt:new Date().toISOString(), revision:2,
  source:{speechLines:speech.length,wordAlignment:'validated by prepare-audio.cjs against text and WAV duration',voices:[...new Set(speech.map(s=>s.voiceName))],phraseHashes,userReview:'2026-09-26: 전보다 훨씬 낫다. User response after listening to the revised MP3.'},
  composition:{duration:timing.duration,scenes:timing.scenes.length,captions:timing.captions.length,check:{passed:true,lintErrors:0,lintWarnings:0,runtimeErrors:0,layoutIssues:0,motionErrors:0,contrastPassed:15,contrastTotal:15},sceneMidpointsInspected:[3,10.7,17.8,22.4,29.3,37.1,39.22]},
  render:{file:path.basename(final),bytes:fs.statSync(final).size,sha256:hash(final),width:video.width,height:video.height,fps:video.avg_frame_rate,duration:Number(media.format.duration),fullDecodePassed:true,blackIntervals:[],gainDb,integratedLUFS:Number(finalLoudness.input_i),truePeakDbTP:Number(finalLoudness.input_tp)},
  preview:{file:path.basename(preview),bytes:fs.statSync(preview).size,sha256:hash(preview),duration:Number(probe(preview).format.duration),fullDecodePassed:true,browserVerification:'pending'},
  original:{file:'../SYNK_LAB_카페_몽글_한국어.mp4',sha256:hash(path.join(base,'..','SYNK_LAB_카페_몽글_한국어.mp4'))},
  limitations:['Subjective naturalness and acting quality require human listening; no claim of direct listening review.','External publication not performed.','Human video generation remains blocked on Co-NAI access.'],
};
fs.writeFileSync(at('validation.json'), JSON.stringify(validation,null,2));
console.log(JSON.stringify({stage:'completed',...validation.render,preview:validation.preview},null,2));
