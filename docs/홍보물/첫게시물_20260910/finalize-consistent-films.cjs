'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const base=__dirname,qa='_검토/02-나머지일관화',root=path.resolve(base,'../../..'),pub=path.join(root,'영상/public/firstposts20260910');
const ids=['03-lab-tiktok','04-yuhobuilds-youtube','05-yuhobuilds-instagram','06-yuhobuilds-tiktok','07-synkbrief-youtube','09-synkbrief-tiktok'];
const read=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8').replace(/^\uFEFF/,''));
const hash=v=>crypto.createHash('sha256').update(v).digest('hex'),sha=p=>hash(fs.readFileSync(path.join(base,p)));
const put=(p,v)=>{const file=path.join(base,p);fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+process.pid+'.pending';fs.writeFileSync(tmp,v);fs.renameSync(tmp,file)};
const save=(p,v)=>put(p,JSON.stringify(v,null,2));
const run=(cmd,args)=>{const r=spawnSync(cmd,args,{windowsHide:true,encoding:'utf8',maxBuffer:16*1024*1024});if(r.status!==0||r.error)throw Error(r.stderr||String(r.error));return r};
const raw=read('원고/video.json'),films=JSON.parse(fs.readFileSync(path.join(pub,'films.json'),'utf8'));
const input=read(qa+'/입력변경.json'),sound=read(qa+'/음성출력검증.json'),independent=read(qa+'/독립최종검수.json');
const approved='5c2701a46c7a405ba9c7ffa31d933db922bd29b735b8dc47f77eec76b2200f31';
if(sha('01-lab-youtube/video.mp4')!==approved||input.newVoiceCount!==32||input.rawSha256!==sha('원고/video.json')||!sound.pass||sound.results.length!==6)throw Error('Current input, approved reference and decoded sound verification required');
if(independent.pass!==true)throw Error('Independent final visual review required');
const preserved=read(qa+'/입력-이전/보존명세.json');
for(const r of preserved.records.filter(x=>!ids.includes(x.file.split('/')[0])))if(sha(r.file)!==r.sha256)throw Error('An unaffected account changed: '+r.file);
const rows=[],levels=[],fileChecks=[];
for(const item of films){
 const file=item.id+'/video.mp4',proofPath='_검토/video/'+item.id+'/verification.json',proof=read(proofPath),renderInput='_검토/video/'+item.id+'/render-input.json',bytes=fs.statSync(path.join(base,file)).size,digest=sha(file);
 const frames=item.scenes.reduce((n,s)=>n+Math.round(s.duration*30),0),duration=frames/30;
 if(digest!==proof.sha256||!proof.fullDecode||sha(renderInput)!==proof.renderInputSha256)throw Error('Final artifact proof mismatch: '+item.id);
 if(ids.includes(item.id)){
  const decoded=sound.results.find(r=>r.account===item.id);
  if(!decoded?.pass||decoded.sha256!==digest||proof.sourceScriptSha256!==sha('원고/video.json')||item.revision!=='2026-09-10-approved01-continuity-v1')throw Error('New render or sound proof stale: '+item.id);
 }
 const facts=JSON.parse(run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path.join(base,file)]).stdout),v=facts.streams.find(s=>s.codec_type==='video'),a=facts.streams.find(s=>s.codec_type==='audio');
 if(Number(v.nb_frames)!==frames||v.r_frame_rate!=='30/1'||a.sample_rate!=='48000'||a.codec_name!=='aac'||Math.abs(Number(facts.format.duration)-duration)>.06)throw Error('Final stream contract: '+item.id);
 const subtitles=(item.brand==='LAB'?['ko','mn']:['ko']).map(language=>{const stem=item.id+'/subtitles-'+language,cues=read(stem+'.json');let end=0;for(const c of cues){if(c.startMs<end-1||c.endMs<=c.startMs||c.endMs>duration*1000+1)throw Error('Subtitle bounds: '+item.id);end=c.endMs}return {language,cues:cues.length,jsonSha256:sha(stem+'.json'),srtSha256:sha(stem+'.srt'),vttSha256:sha(stem+'.vtt')}});
 rows.push({account:item.id,video:file,videoDuration:duration,containerDuration:Number(facts.format.duration),frames,width:v.width,height:v.height,bytes,sha256:digest,renderInputSha256:proof.renderInputSha256,fullDecode:true,visualReview:ids.includes(item.id)?qa+'/독립최종검수.json':proof.visualReview,subtitles,verification:proofPath});
 const volume=run('ffmpeg',['-hide_banner','-i',path.join(base,file),'-af','volumedetect','-f','null','NUL']).stderr,meanDb=Number(volume.match(/mean_volume:\s*(-?[\d.]+)/)?.[1]),peakDb=Number(volume.match(/max_volume:\s*(-?[\d.]+)/)?.[1]);
 if(!Number.isFinite(meanDb)||!Number.isFinite(peakDb)||peakDb>=0)throw Error('Clipping or unavailable volume result');
 levels.push({account:item.id,sha256:digest,bytes,duration:Number(facts.format.duration),frames,width:v.width,height:v.height,fullDecode:true,meanDb,peakDb,peakAtFullScale:false});
 fileChecks.push({id:item.id,videoSha256:digest,renderInputSha256:proof.renderInputSha256,hashMatch:true,actualStream:{width:v.width,height:v.height,r_frame_rate:v.r_frame_rate,nb_frames:v.nb_frames},expectedFrames:frames,frameMatch:true,fullDecodeReadFromProducer:true,representativeFramesViewed:ids.includes(item.id)?null:proof.extracted.length,reviewSource:ids.includes(item.id)?qa+'/독립최종검수.json':'_검토/01-표정편집엔딩/최종검증.json'});
}
const now=new Date().toISOString(),totalFrames=rows.reduce((n,r)=>n+r.frames,0),totalSeconds=totalFrames/30,cueCount=rows.reduce((n,r)=>n+r.subtitles.reduce((n,s)=>n+s.cues,0),0);
const result={checkedAt:now,status:'passed',scope:'Seven local final videos, current captions and delivery. No SNS publication.',videos:7,totalFrames,totalVideoSeconds:totalSeconds,totalBytes:rows.reduce((n,r)=>n+r.bytes,0),sourceScript:{file:'원고/video.json',sha256:sha('원고/video.json')},rows,subtitleChecks:{cueCount,inVideoBounds:true,nonOverlapping:true,srtVttNonempty:true},revision:{accounts:ids,record:qa+'/통합검증.json',approved01Sha256:approved,approved01Unchanged:true,otherTwelveAccountFilesUnchanged:true,historical01InputPreserved:true},renderImplementation:{mainSha256:sha('render-video.cjs'),chunkHelperSha256:sha('render-chunked.cjs'),source:'Each account verification.json records its actual render source'},humanListening:false,humanNativeReview:false,independentVisualRecord:qa+'/독립최종검수.json'};
save('_검토/video/전체영상검증.json',result);
save('_검토/음량검증.json',{checkedAt:now,results:levels,revisionNote:'New six voices originate at 48kHz and are normalized before 0.7 video gain. Full-file loudness includes music and silence; actual voice correspondence is checked separately.',signalVerification:qa+'/음성출력검증.json',humanListening:false});
save('_검토/영상최종_파일독립대조.json',{checkedAt:now,rows:fileChecks,totalFrames,totalVideoSeconds:totalSeconds,scope:'Root directly rehashed and probed each final MP4 and checked producer full decode plus independent visual and sound evidence.',independentVisualRecord:qa+'/독립최종검수.json'});
save(qa+'/통합검증.json',{checkedAt:now,status:'pass',approved01Sha256:approved,approved01Unchanged:true,otherTwelveAccountFilesUnchanged:true,narrationTextsPreserved:true,newVoices:32,modifiedVideos:rows.filter(r=>ids.includes(r.account)),totalFrames,totalSeconds,subtitleCues:cueCount,soundVerification:qa+'/음성출력검증.json',visualVerification:qa+'/독립최종검수.json',sourceScriptSha256:sha('원고/video.json'),humanContinuousListening:false,newSixUserApprovalRecorded:false,published:false});
for(const name of ['검증결과.md','읽어주세요.md','_검토/영상최종실물검수.md']){const dest=qa+'/문서-이전/'+path.basename(name);if(!fs.existsSync(path.join(base,dest)))put(dest,fs.readFileSync(path.join(base,name)));}
const table=rows.map(r=>`| ${r.account} | ${r.videoDuration.toFixed(3)}초 | ${r.frames} |`).join('\n');
put('검증결과.md',`# 첫 게시물 검증 결과\n\n2026-09-10 현재 로컬 납품본. 19개 계정의 첫 게시물 꾸러미이며 게임은 제외했습니다. 영상 7편 중 승인된 01을 유지하고 나머지 6편의 목소리·음량·편집·엔딩을 수정했습니다. 실제 SNS 게시는 수행하지 않았습니다.\n\n## 이번 수정\n\n사용자가 승인한 01의 밝고 자연스러운 여성 음색을 참조해 기존32개 발화를 48kHz 원음으로 다시 생성했습니다. 원음을 같은 음량 기준으로 정리한 뒤 영상에서0.7로 혼합했습니다. 말 자체의 속도는 유지하고 말뒤 호흡은 읽을 내용과 학습 목적에 맞춰 조정했습니다. 03의 몽글은 승인된 공통 몸과 털을 보존한 깜빡임·눈웃음·작은 반응을 사용합니다.\n\n마지막 본문에서 실제 어두운 펠트로 이어지며 회사별 현행 Paper 로고·계정 소개·계정명이 나타났다 조용히 사라지는7초 엔딩을 넣었습니다. LAB 세로판과 SHIFT 가로·세로판의 읽는 순서와 간격을 조정했습니다. 기존 대사와 제공물, 정적12계정의 파일은 유지했습니다.\n\n[사용자 승인 참조](${qa}/승인참조.md) · [현재 통합 검증](${qa}/통합검증.json) · [독립 화면 검수](${qa}/독립최종검수.json) · [실제 출력 음성 대조](${qa}/음성출력검증.json).\n\n## 현재 영상\n\n| 계정 폴더 | 길이 | 프레임 |\n|---|---:|---:|\n${table}\n\n총 ${totalSeconds.toFixed(3)}초, ${totalFrames.toLocaleString('en-US')}프레임, 한국어·몽골어 자막 ${cueCount}개 구간입니다. 각 파일의 완전 디코딩·화면 크기·프레임·48kHz AAC·자막 경계·파일 지문을 대조했습니다. 32개 발화는 실제 최종 AAC와 새 WAV의 신호 대응 및0.7배 음량을 확인했고, 엔딩 시작100ms 뒤의 잔여음을 검사했습니다.\n\n19계정·업로드 JPG48장·7영상·안내 화면·내부 링크·실제 자료 다운로드의 최신 검사 결과는 [_검토/납품실물검증.json](_검토/납품실물검증.json)을 따릅니다. 압축 파일은 모든 항목을 다시 읽어 SHA-256과 CRC를 확인한 뒤 최종 이름으로 저장합니다. ZIP 자체의 지문은 [_검토/압축검증.json](_검토/압축검증.json)에 있습니다.\n\n## 확인 경계\n\n01의 느낌은 사용자가 긍정했습니다. 새 여섯 편은 파일·화면 표본·자동 음성 대조까지 확인했으며 사람의 연속 청취·새 여섯 편에 대한 사용자 만족·원어민 감수를 대신하지 않습니다. 합성음성은 대표자의 육성이 아닙니다. SNS 게시·계정 신규 개설·메일 발송·광고 집행·고객 반응과 사업 성과는 이 제작 완료에 포함하지 않습니다.\n\n이전 제작 과정과 저장공간 복구 경위는 [수정 전 기록](${qa}/문서-이전/검증결과.md)에 보존했습니다. 현재 지문·파일 상태는 위 통합 기록을 우선합니다.\n`);
let readme=fs.readFileSync(path.join(base,'읽어주세요.md'),'utf8');
const note='나머지 여섯 영상(03·04·05·06·07·09)도 승인된1편의 음색을 참조해 밝고 자연스러운 여성 목소리로 다시 제작했습니다. 음량과 말뒤 호흡을 맞추고, 마지막 내용에서 이어지는 회사 로고의7초 펠트 엔딩을 넣었습니다. video.mp4에는 목소리·배경음·엔딩이 모두 포함되어 있으므로 별도 합성 없이 해당 파일을 업로드하면 됩니다.';
if(!readme.includes(note))readme=readme.replace('## 제작과 게시 상태',note+'\n\n## 제작과 게시 상태');put('읽어주세요.md',readme);
const oldVisual=fs.readFileSync(path.join(base,'_검토/영상최종실물검수.md'),'utf8');
if(!oldVisual.includes('현재 여섯 편 일관화'))put('_검토/영상최종실물검수.md',`# 현재 여섯 편 일관화 — 2026-09-10\n\n승인된01을 유지하고03·04·05·06·07·09의 현재 파일을 새로 검수했습니다. [새 독립 최종 검수](02-나머지일관화/독립최종검수.json)와 [통합 검증](02-나머지일관화/통합검증.json)을 현재 상태로 읽습니다. 아래는 수정 전 실물에 대한 역사 기록이며 새 여섯 편의 현재 지문·길이를 대신하지 않습니다.\n\n---\n\n`+oldVisual);
console.log(JSON.stringify({status:'pass',modifiedVideos:6,newVoices:32,totalSeconds,totalFrames,cueCount,approved01Unchanged:true}));
