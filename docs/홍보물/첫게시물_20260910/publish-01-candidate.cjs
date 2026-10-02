'use strict';
// Local deliverable promotion only. Does not publish to a platform or remove backups.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const base=__dirname,qa=path.join(base,'_검토/01-표정편집엔딩'),candidate=path.join(qa,'최종후보'),inspect=path.join(candidate,'검증'),target=path.join(base,'01-lab-youtube'),targetQa=path.join(base,'_검토/video/01-lab-youtube');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const put=(p,data)=>{const tmp=p+'.candidate-pending',fd=fs.openSync(tmp,'w');try{fs.writeFileSync(fd,Buffer.isBuffer(data)||typeof data==='string'?data:JSON.stringify(data,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,p);};
function main(){
 const technical=read(path.join(qa,'기술검증.json')),visual=read(path.join(qa,'시각검증.json')),proof=read(path.join(inspect,'verification.json')),source=path.join(candidate,'video.mp4'),output=path.join(target,'video.mp4'),backup=path.join(qa,'이전완성본/video.mp4');
 if(!technical.fullDecode||technical.sha256!==sha(source)||technical.sha256!==proof.sha256||visual.sha256!==proof.sha256||!visual.completed||!visual.images?.length)throw Error('Current candidate technical and actual visual evidence required');
 if(proof.sourceScriptSha256!==sha(path.join(base,'원고/video.json'))||proof.renderInputSha256!==sha(path.join(inspect,'render-input.json')))throw Error('Source changed after candidate verification');
 for(const image of visual.images)if(sha(image.file)!==image.sha256)throw Error('Viewed frame changed');
 const backupSha=sha(backup),currentSha=sha(output);if(currentSha!==backupSha&&currentSha!==proof.sha256)throw Error('Active video differs from preserved previous completion');
 const productionProof={...proof,video:'01-lab-youtube/video.mp4',visualReview:visual.summary,visualReviewEvidence:'_검토/01-표정편집엔딩/시각검증.json',audioStatus:'Existing native 48kHz synthesized example voice reused at gain 0.7, unchanged playback speed; existing approved short mascot sound; no human listening approval claimed',humanListening:false};
 const stage=path.join(qa,'납품후보메타데이터');fs.mkdirSync(stage,{recursive:true});const files=[];
 const add=(name,data,dest)=>{const file=path.join(stage,name);put(file,data);files.push({file,dest,sha256:sha(file)});};
 for(const name of ['subtitles-ko.json','subtitles-ko.srt','subtitles-ko.vtt','subtitles-mn.json','subtitles-mn.srt','subtitles-mn.vtt','자막.json','자막.srt','자막.vtt','챕터.json','챕터.txt'])add(name,fs.readFileSync(path.join(candidate,name)),path.join(target,name));
 add('render-input.json',fs.readFileSync(path.join(inspect,'render-input.json')),path.join(targetQa,'render-input.json'));
 add('verification.json',productionProof,path.join(targetQa,'verification.json'));
 add('final-all.png',fs.readFileSync(path.join(inspect,'final-all.png')),path.join(targetQa,'final-all.png'));
 const final={...technical,status:'completed local revision; final user listening approval not recorded',visualReview:visual,previousVideoSha256:backupSha,previousVersionPreserved:backup,productionVerification:'_검토/video/01-lab-youtube/verification.json',candidateVideoPreserved:true};
 add('최종검증.json',final,path.join(qa,'최종검증.json'));
 const manifest={sourceSha256:proof.sha256,previousSha256:backupSha,files,status:'prepared',videoCopy:'exact candidate bytes; no new encoding'};put(path.join(qa,'납품교체.json'),manifest);
 if(currentSha!==proof.sha256){const pending=output+'.candidate-pending';fs.copyFileSync(source,pending);if(sha(pending)!==proof.sha256)throw Error('Candidate delivery copy mismatch');fs.renameSync(pending,output);}
 // The exact source candidate and metadata remain available if a later small
 // write fails: rerunning accepts this same new video and finishes only copies.
 for(const file of files){if(sha(file.file)!==file.sha256)throw Error('Prepared metadata changed');put(file.dest,fs.readFileSync(file.file));}
 if(sha(output)!==proof.sha256)throw Error('Promoted video mismatch');put(path.join(qa,'납품교체.json'),{...manifest,status:'committed',completedAt:new Date().toISOString()});console.log(JSON.stringify({sha256:proof.sha256,video:output,verification:path.join(qa,'최종검증.json'),backupPreserved:true},null,2));
}
main();
