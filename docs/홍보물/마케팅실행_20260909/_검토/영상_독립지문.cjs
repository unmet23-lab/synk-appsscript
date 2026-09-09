// 완성 MP4·실제 SRT·프레임 지문을 독립 대조한다. 원천은 읽고 QA 폴더에만 기록한다.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {spawnSync} = require('node:child_process');
const bundle = path.resolve(__dirname, '..');
const repo = path.resolve(bundle, '../../..');
const ffmpeg = path.join(repo, '영상/node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const normalize = text => text.normalize('NFKC').replace(/\s+/g, '');
const sourceFile = path.join(bundle, '원고/콘텐츠원고.json');
const source = read(sourceFile);
const ids = ['01-lab-youtube','03-lab-tiktok','04-yuhobuilds-youtube','05-yuhobuilds-instagram','06-yuhobuilds-tiktok','07-synkbrief-youtube','09-synkbrief-tiktok','shift-public-class-01','shift-public-clinic-demo-01'];
const results = [];
for (const id of ids) {
  const lecture = id === 'shift-public-class-01', clinic = id === 'shift-public-clinic-demo-01', long = lecture || clinic;
  const relative = long ? `공개수업/${lecture ? '수업' : '클리닉'}.mp4` : `${id}/video.mp4`;
  const video = path.join(bundle, relative);
  const report = read(path.join(__dirname, `영상_${id}_검증.json`));
  const probe = spawnSync('ffprobe', ['-v','error','-show_entries','format=duration:stream=codec_type,codec_name,width,height','-of','json',video], {encoding:'utf8',windowsHide:true});
  if (probe.status !== 0) throw new Error('ffprobe 실패: ' + id);
  const metadata = JSON.parse(probe.stdout);
  const stream = metadata.streams.find(stream => stream.codec_type === 'video');
  const audio = metadata.streams.find(stream => stream.codec_type === 'audio');
  const item = {id, file:relative, videoSha256:sha(video), reportSha256:sha(path.join(__dirname, `영상_${id}_검증.json`)), reportedVideoHashMatches:sha(video)===report.videoSha256, scriptHashMatches:sha(sourceFile)===report.scriptSha256, width:stream.width, height:stream.height, codec:stream.codec_name, audioCodec:audio?.codec_name, durationSeconds:Number(metadata.format.duration), dimensionsMatch:stream.width===report.width && stream.height===report.height, representativeFrames:report.capturedSeconds.length, contactSha256:sha(path.join(__dirname, `영상_${id}_contact.png`))};
  if (!item.reportedVideoHashMatches || !item.scriptHashMatches || !item.dimensionsMatch) throw new Error('최종 보고서와 원천 불일치: ' + id);
  if (long) {
    const srt = path.join(bundle, `공개수업/${lecture ? '수업' : '클리닉'}.srt`);
    const actual = fs.readFileSync(srt,'utf8').replace(/^\uFEFF/,'').split(/\r?\n/).filter(line => line.trim() && !/^\d+$/.test(line.trim()) && !/-->/.test(line)).join(' ');
    const narration = (lecture ? source.lectures[0].chapters : source.extras[0].scenes).map(scene=>scene.narration).join(' ');
    item.srtSha256=sha(srt);
    item.actualSrtEqualsCanonicalNarration=normalize(actual)===normalize(narration);
    if (!item.actualSrtEqualsCanonicalNarration) throw new Error('실제 SRT 정본 누락/변경: ' + id);
    const out = path.join(__dirname, '영상_독립끝'); fs.mkdirSync(out,{recursive:true});
    const target = path.join(out, id+'.png');
    const second = item.durationSeconds-.25;
    const extraction = spawnSync(ffmpeg, ['-y','-v','error','-ss',String(second),'-i',video,'-frames:v','1','-vf','scale=1280:-2',target], {encoding:'utf8',windowsHide:true});
    if (extraction.status !== 0 || !fs.existsSync(target)) throw new Error('독립 끝 화면 추출 실패: ' + id);
    item.independentEndFrame={file:path.relative(__dirname,target),second,sha256:sha(target)};
  }
  results.push(item);
}
const out = {checkedAt:new Date().toISOString(), passed:true, sourceSha256:sha(sourceFile), videoCount:results.length, representativeFrames:results.reduce((n,item)=>n+item.representativeFrames,0), humanListening:false, externalPosting:false, results};
fs.writeFileSync(path.join(__dirname,'영상_독립지문.json'),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({passed:true,videoCount:out.videoCount,representativeFrames:out.representativeFrames, actualSrtMatches:results.filter(item=>item.actualSrtEqualsCanonicalNarration).length},null,2));
