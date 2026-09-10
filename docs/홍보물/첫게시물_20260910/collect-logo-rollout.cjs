'use strict';
// Collect the already validated current files; this does not render, publish, or stage them.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const repo=path.resolve(__dirname,'../../..'),qa=path.join(__dirname,'_검토/로고반영');
const read=f=>JSON.parse(fs.readFileSync(path.resolve(repo,f),'utf8'));
const relative=f=>path.relative(repo,f).replace(/\\/g,'/');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const first='docs/홍보물/첫게시물_20260910',marketing='docs/홍보물/마케팅실행_20260909',accounts='docs/홍보물/계정별콘텐츠_20260909',reels='docs/홍보물/릴10편_20260909';
const activeFiles=[];
function add(file,proof,record,scope='logo-updated'){
  const absolute=path.resolve(repo,file),hash=sha(absolute);
  if(record.sha256&&hash!==record.sha256)throw Error('Current output drift: '+file);
  activeFiles.push({path:relative(absolute),absolutePath:absolute.replace(/\\/g,'/'),sha256:hash,bytes:fs.statSync(absolute).size,frames:record.frames??null,durationSeconds:record.durationSeconds??record.duration??null,width:record.width??null,height:record.height??null,audioStreamIdentical:record.audioStreamIdentical??null,fullDecode:record.fullDecode??null,scope,proof});
}
for(const r of read(first+'/_검토/로고반영/최종검증.json').records)add(first+'/'+r.file,first+'/'+r.proof,r);
for(const r of read(marketing+'/_검토/영상_로고반영_20260910.json').results)add(r.output,marketing+'/_검토/영상_로고반영_20260910.json',r);
for(const r of read(first+'/_검토/로고반영/klofi/verification.json').outputs)add(marketing+'/'+r.file,first+'/_검토/로고반영/klofi/verification.json',{...r,frames:1848,duration:61.6,width:1920,height:1080});
for(const r of read(accounts+'/_검토/로고반영/verification.json').results)add(r.output,accounts+'/_검토/로고반영/verification.json',r);
for(const r of read(reels+'/검사/로고반영/verification.json').records)add(reels+'/영상/'+r.id+'.mp4',reels+'/검사/로고반영/verification.json',{...r,width:1080,height:1920});
const music=activeFiles.find(r=>r.path===marketing+'/01-lab-youtube/video.mp4');
for(const f of [first+'/assets/pulse-full.mp4','영상/public/firstposts20260910/pulse-full.mp4','docs/홍보물/회사별콘텐츠_20260910/03-pulse/video.mp4'])add(f,first+'/_검토/로고반영/klofi/verification.json',music,'updated-music-copy');
const preserved=[];
for(const [file,reason,evidence] of [
 [accounts+'/01-lab-youtube/video.mp4','ListeningScene 소스와 실제 프레임에 로고가 없는 밤의 독서방 영상. 원본 보존.',first+'/_검토/로고반영/account-listening.png'],
 [marketing+'/assets/craft-film-4k.mp4','공방 매크로 영상의 끝 SYNK LAB은 자수 그래픽 로고가 아닌 본문 타이틀. 옛 2027.02.11 체험 일정 포함. 일정·엔딩 편집을 이번 로고 교체에 섞지 않고 원본 보존.',first+'/_검토/로고반영/craft-film-end.png'],
 ['C:/Users/q1212/Documents/synk-policy/name/assets/synk_film_1080p.mp4','공방 영상과 같은 평문 타이틀/옛 일정. 자수 그래픽 로고 없음, 원본 보존.',first+'/_검토/로고반영/name-film-end.png']
]){const absolute=path.resolve(repo,file);preserved.push({path:relative(absolute),absolutePath:absolute.replace(/\\/g,'/'),sha256:sha(absolute),bytes:fs.statSync(absolute).size,status:'checked-preserved',reason,evidence});}
const sources=[
'영상/자산모으기.js','영상/계정별굽기.cjs','영상/klofi로고갱신.cjs','영상/계정별로고갱신.cjs','영상/릴10편로고갱신.cjs',
'영상/src/klofi20260909/index.tsx','영상/src/계정별20260909/README.md','영상/src/계정별20260909/LogoPlate.tsx','영상/src/firstposts20260910/Film.tsx','영상/src/firstposts20260910/LogoPlate.tsx',
...['prepare.cjs','build.cjs','workbook.cjs','refresh-approved-logos.cjs','render-existing-six-logos.cjs','render-approved-logo-01.cjs','apply-logo-delivery.cjs','finalize-logo-review.cjs','collect-logo-rollout.cjs','package.py'].map(f=>first+'/'+f),
reels+'/모아보기만들기.cjs',reels+'/검사.cjs'
];
const deliveryPaths=new Set(activeFiles.filter(f=>f.scope==='logo-updated'&&(f.path.startsWith(first)||f.path.startsWith(reels)||f.path.startsWith(marketing+'/01-lab-youtube'))).map(f=>f.path));
const images=read(first+'/_검토/이미지검증.json');for(const r of images.records)deliveryPaths.add(first+'/'+r.file);
const items=read(first+'/콘텐츠원고.json').items;
for(const i of items){deliveryPaths.add(first+'/'+i.id+'/cover.jpg');if(i.orientation==='landscape')deliveryPaths.add(first+'/'+i.id+'/thumbnail.jpg');}
for(const name of ['읽어주세요.md','검증결과.md','전체_업로드.zip','_검토/압축검증.json','_검토/납품실물검증.json','_검토/이미지검증.json','_검토/전체이미지.png','_검토/자산과원본.json','_검토/재사용자료.json'])deliveryPaths.add(first+'/'+name);
deliveryPaths.add('영상/public/firstposts20260910/assets.json');
for(const name of ['꺾쇠라이트.svg','단색라이트.svg','민다크.svg','민라이트.svg','알록꺾쇠.svg','알록synk.svg','펠트다크.svg','펠트라이트.svg'])deliveryPaths.add('영상/public/로고/'+name);
for(const name of ['synk-intro.png','pulse-frame.png','pulse-last.png','proof-start.png','proof-ready.png'])deliveryPaths.add('영상/public/firstposts20260910/'+name);
for(const name of ['labpage.png','shiftpage.png','pulsepage.png'])deliveryPaths.add('영상/public/계정별20260909/'+name);
for(const r of read(first+'/_검토/로고반영/최종검증.json').pdfs)deliveryPaths.add(first+'/'+r.file);
for(const name of ['synk-intro.png','pulse-frame.png','pulse-last.png','pulse-full.mp4','proof-start.png','proof-ready.png'])deliveryPaths.add(first+'/assets/'+name);
for(const name of ['직접작성_실제다운로드.txt','직접작성_모바일.png','직접작성검증.json'])deliveryPaths.add(first+'/_검토/'+name);
for(const r of read(first+'/_검토/로고반영/자산동기화.json').copies)if(!r.file.includes('/_검토/video/public/'))deliveryPaths.add(r.file);
for(const name of ['upload-01.jpg','cover.jpg'])deliveryPaths.add(marketing+'/01-lab-youtube/'+name);
for(const id of items.filter(i=>i.format==='video').map(i=>i.id))deliveryPaths.add(first+'/_검토/video/'+id+'/verification.json');
for(let n=1;n<=10;n++){const id='gift-'+String(n).padStart(2,'0');for(const name of ['표지/'+id+'-cover.png','제공자료/'+id+'-resource-1.png','검사/'+id+'.json','검사/'+id+'-전체장면.png',...[1,2,3,4,5].map(i=>'검사/'+id+'-scene-'+i+'.png')])deliveryPaths.add(reels+'/'+name);}
for(const name of ['10편-모아보기.png','index.html','읽어주세요.md','제작검사.md','검사/최종기계검사.json','검사/모아보기-1440.png','검사/모아보기-390.png'])deliveryPaths.add(reels+'/'+name);
const proofPaths=[first+'/_검토/로고반영/최종검증.json',first+'/_검토/로고반영/납품반영.json',first+'/_검토/로고반영/자산동기화.json',first+'/_검토/로고반영/직접작성캡처대조.json',first+'/_검토/로고반영/klofi/verification.json',reels+'/검사/로고반영/verification.json',reels+'/검사/로고반영/review.png',reels+'/검사/로고반영/resources-review.png'];
for(const r of read(first+'/_검토/로고반영/최종검증.json').records)proofPaths.push(first+'/'+r.proof);
proofPaths.push(first+'/_검토/로고반영/04-yuhobuilds-youtube/omitted-proof-logo-audit.json');
const manifest={at:new Date().toISOString(),owner:'video_logo_rollout',status:'pass',counts:{changedVideoDeliveries:activeFiles.filter(f=>f.scope==='logo-updated').length,musicCopies:3,preservedVideoFiles:preserved.length,firstPostImages:48,firstPostPdfs:7,reelStaticImages:20},activeFiles,preserved,sourceFiles:sources,deliveryFiles:[...deliveryPaths].sort(),proofFiles:[...new Set(proofPaths)],integrationNotes:['원본 AAC 스트림을 복사했으며 음성 생성·속도·새 엔딩 변경 없음.','첫게시물 05와 계정별 04/05/06은 삽입 소개서 안 옛 로고도 교체.','현재 영상 33개 파일에는 마케팅 01의 동일 내용 업로드용 원본 사본 1개가 포함됨. 고유 영상은 32편.','app_logo_rollout 담당 마케팅·계정별 최종 소유 파일은 별도 인계 목록과 함께 통합.','원래 미추적이던 첫게시물 전체와 영상/src/radioDreams20260910을 이번 작업의 신규 변경으로 일괄 스테이징하지 말 것.','_검토/로고반영의 before*.mp4, video-silent.mp4, 임시 번들·프레임 연속열은 이전 원본/검증용이므로 현재 배포·Git 스테이징 대상에서 제외.','외부 게시·Sites 배포·커밋은 주담당의 별도 검증 범위.']};
for(const f of [...sources,...deliveryPaths,...proofPaths])if(!fs.existsSync(path.resolve(repo,f)))throw Error('Missing owned file '+f);
fs.writeFileSync(path.join(qa,'현재영상목록.json'),JSON.stringify({at:manifest.at,counts:manifest.counts,activeFiles,preserved},null,2)+'\n');
fs.writeFileSync(path.join(qa,'소유파일목록.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({counts:manifest.counts,sourceFiles:sources.length,deliveryFiles:deliveryPaths.size,proofFiles:new Set(proofPaths).size}));
