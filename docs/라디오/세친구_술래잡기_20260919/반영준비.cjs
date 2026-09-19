'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const dir=__dirname,root=path.resolve(dir,'../../..');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const before=fs.readFileSync(path.join(dir,'before-방송층.html'),'utf8');
const logo=fs.readFileSync(path.join(dir,'방송로고_Paper.png')).toString('base64');
const anchor="  var 파일 = { 마스코트: '마스코트.html', 전광판: '전광판.html', 무대: '무대.html' };";
if(before.split(anchor).length!==2)throw Error('방송층 기준점이 달라졌다');
let after=before.replace(anchor,`  // 2026-09-19: 현재 무대 영상에 세 친구가 포함된다. 영상마스코트=0은 별도 인형 무대용이다.
  var 영상마스코트 = 인자.get('영상마스코트') !== '0';
  if (영상마스코트) 층들 = 층들.filter(function (s) { return s !== '마스코트'; });
${anchor}`);
after=after.replace('</style>',`  #라디오각인 { position:absolute; left:84px; bottom:69px; width:300px; pointer-events:none; color:#FBF7F0; }
  #라디오각인 img { display:block; width:156px; height:auto; filter:drop-shadow(0 2px 2px rgba(30,20,15,.25)); }
  #라디오각인 .선 { width:220px; height:1px; margin:24px 0 18px; background:rgba(251,247,240,.42); }
  #라디오각인 .글 { font:700 18px/22px Arial,sans-serif; letter-spacing:5px; text-shadow:0 1px 3px rgba(30,20,15,.45); }
</style>`);
after=after.replace('<div id="맥박"></div>',`<div id="맥박"></div>
<div id="라디오각인" aria-hidden="true"><img src="data:image/png;base64,${logo}" alt=""><div class="선"></div><div class="글">ORIGINAL SOUND</div></div>`);
after=after.replace("  if (영상마스코트) 층들", "  if (!영상마스코트) document.getElementById('라디오각인').remove();\n  if (영상마스코트) 층들");
fs.writeFileSync(path.join(dir,'after-방송층.html'),after);
const pack=JSON.parse(fs.readFileSync(path.join(dir,'송출패키지.json')));
const name='three-friends-20260919-'+pack.sha256.slice(0,12)+'.mp4';
const list="ffconcat version 1.0\nfile '"+name+"'\n";
fs.writeFileSync(path.join(dir,'after-목록.txt'),list);
const snapshot=JSON.parse(fs.readFileSync(path.join(dir,'서버현황.json')));
const parent='/opt/synk-radio/지면/bots/오버레이/방송층.html',stageList='/opt/synk-radio/무대차례/목록.txt';
const plan={at:new Date().toISOString(),remoteAsset:'/opt/synk-radio/무대차례/'+name,localAsset:pack.file,assetSha256:pack.sha256,
  changes:[{target:parent,beforeSha256:snapshot.hashes[parent],afterSha256:sha(after),local:'after-방송층.html'},
    {target:stageList,beforeSha256:snapshot.hashes[stageList],afterSha256:sha(list),local:'after-목록.txt'}],
  protected:Object.fromEntries(Object.entries(snapshot.hashes).filter(([k])=>k!==parent&&k!==stageList)),
  oldStage:'/opt/synk-radio/무대차례/chuseok-natural-20260909-v2.mp4',audio:'/opt/synk-radio/소리/synk-radio-blok11-20260909-gapless.flac',
  logo:{source:'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-Paper.png',sourceSha256:'78de96ceb567f245281df78d01b82e5c3aba9fc0cc959dc3763967367fc3b7fe',displayWidthAt1080:156}};
fs.writeFileSync(path.join(dir,'반영계획.json'),JSON.stringify(plan,null,2));
console.log(JSON.stringify({...plan,protected:Object.keys(plan.protected)},null,2));
