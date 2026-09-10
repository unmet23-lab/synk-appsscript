'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const base=__dirname;
const read=f=>JSON.parse(fs.readFileSync(path.join(base,f),'utf8'));
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(base,f))).digest('hex');
const write=(f,v)=>fs.writeFileSync(path.join(base,f),JSON.stringify(v,null,2)+'\n');
const images=read('_검토/이미지검증.json');
const delivered=read('_검토/납품실물검증.json');
const promoted=read('_검토/로고반영/납품반영.json');
const records=[];
for(const image of images.records){
  if(image.overflow||sha(image.file)!==image.sha256)throw Error('Image verification drift: '+image.file);
}
for(const item of delivered.records){
  for(const image of item.images){
    const current=images.records.find(r=>r.file===image.file.replace(/\\/g,'/'));
    if(!current)throw Error('Missing current image '+image.file);
    Object.assign(image,{sha256:current.sha256,width:current.width,height:current.height});
  }
  if(!item.video)continue;
  const film=promoted.films.find(r=>r.id===item.id);
  const proofFile='_검토/로고반영/'+(['01-lab-youtube','05-yuhobuilds-instagram'].includes(item.id)?'':'기존6편/')+item.id+'/verification.json';
  const proof=read(proofFile);
  const actual=sha(item.video.file);
  if(actual!==film.sha256||actual!==proof.sha256||!proof.audioStreamIdentical||!proof.fullDecode)throw Error('Video verification drift: '+item.id);
  Object.assign(item.video,{sha256:actual,duration:film.duration,width:film.width,height:film.height});
  records.push({...film,file:item.video.file,fullDecode:proof.fullDecode,originalAudioStreamSha256:proof.audioStreamHash,proof:proofFile,sourceSha256:proof.sourceSha256,visualInspection:proof.visualInspection});
}
if(records.length!==7||images.records.length!==48)throw Error('Expected 7 videos and 48 images');
const assets=fs.readdirSync(path.join(base,'assets')).filter(f=>/^logo-.*\.png$/.test(f)).map(f=>({file:'assets/'+f,sha256:sha('assets/'+f)}));
const pdfs=fs.readdirSync(path.join(base,'resources')).filter(f=>f.endsWith('.pdf')).map(f=>({file:'resources/'+f,sha256:sha('resources/'+f)}));
pdfs.push({file:'13-yuhobuilds-linkedin/게시할자료.pdf',sha256:sha('13-yuhobuilds-linkedin/게시할자료.pdf'),pages:5});
const at=new Date().toISOString();
delivered.logoReplacement={at,status:'pass',images:48,videos:7,proof:'_검토/로고반영/최종검증.json'};
write('_검토/납품실물검증.json',delivered);
write('_검토/로고반영/최종검증.json',{at,status:'pass',policy:'SYNK만 무실땀 펠트. LAB/SHIFT/PULSE 사업명 고유색·스티치 보존.',approvedSource:'../마케팅실행_20260909/브랜드킷/배치용/',counts:{accounts:19,uploadImages:48,films:7,pdfs:pdfs.length,logoVariants:assets.length},records,images:images.records,assets,pdfs,scope:'현재 제공 영상·정적 실물의 로고 교체. 영상 AAC 원본 스트림, 기존 원고·음성·타이밍·승인 엔딩 보존. 05 영상 안 소개서와 01 음악 영상 안 로고도 포함.',visualProofs:['_검토/전체이미지.png','_검토/로고반영/linkedin-page1.png','_검토/로고반영/01-lab-youtube/review.png','_검토/로고반영/기존6편/review.png','_검토/로고반영/기존6편/entry-exit-review.png','_검토/로고반영/05-yuhobuilds-instagram/frame-1.8.png'],remaining:'현재 내레이션·대사·안내 음성은 전부 교체 대기. DIVE·유호 본인 목소리의 새 적용 기준이 준비된 뒤 사용처 전반을 교체하며, 그전에는 기존 음성 추가 보정·생성을 보류한다. AAC 보존 검사는 음성 품질 승인이 아니다. SNS 게시·사이트 배포는 이 검증의 범위 밖.'});
console.log(JSON.stringify({status:'pass',images:48,films:7,pdfs:pdfs.length,logoVariants:assets.length}));
