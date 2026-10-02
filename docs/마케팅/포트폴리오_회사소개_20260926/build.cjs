const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {pathToFileURL} = require('url');
const deps = 'C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const {chromium} = require(path.join(deps, 'playwright'));
const sharp = require(path.join(deps, 'sharp'));
const root = path.resolve(__dirname, '../../..');
const brandFont = require(path.join(root,'tools/lib/브랜드폰트.js'));
const src = 'docs/마케팅/프로필최신화_20260919/커버_펠트글래스_v4/';
const sources = {
  hero: src+'shift-pinterest.png',
  before: src+'이전_Behance_공개크롭보정전/shift-behance.png',
  after: src+'shift-behance.png',
  lab: src+'lab-facebook.png',
  brief: src+'synkbrief-youtube.desktop.png',
  maker: src+'yuhobuilds-youtube.desktop.png',
  profileBefore:'docs/마케팅/프로필최신화_20260919/배경_순백_20260919/synklab-profile-before.png',
  profileAfter:'docs/마케팅/프로필최신화_20260919/배경_순백_20260919/synklab-profile-white.png',
  logo:'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-Ink.png',
  shiftLogo:'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-SHIFT-Ink.png',
  friends:'docs/캐릭터/웹_대표장면/세친구_20260915_한강과남산.png',
  learn:'docs/디자인/웹_단락이미지/20260919/shift-ai-workshop.png',
  consult:'docs/디자인/웹_단락이미지/20260919/shift-workflow-planning.png',
  branding:'docs/디자인/웹_단락이미지/20260919/shift-branding-studio.png',
  glass:src+'assets/shift-glass-white.png',
  props:'docs/마케팅/프로필최신화_20260919/커버/shift-centered-gpt-source.png',
};
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const buf={}; const assets=[];
for(const [key,rel] of Object.entries(sources)) {
  buf[key]=fs.readFileSync(path.join(root,rel));
  assets.push({key,source:rel,sha256:crypto.createHash('sha256').update(buf[key]).digest('hex')});
}
const data=key=>'data:image/png;base64,'+buf[key].toString('base64');
const latin=fs.readFileSync(path.join(root,'docs/브랜드_폰트/InterTight/InterTight-Medium.ttf')).toString('base64');
const latinBold=fs.readFileSync(path.join(root,'docs/브랜드_폰트/InterTight/InterTight-Bold.ttf')).toString('base64');
const fonts=brandFont.면()+`@font-face{font-family:InterTight;src:url(data:font/ttf;base64,${latin});font-weight:400 600}@font-face{font-family:InterTight;src:url(data:font/ttf;base64,${latinBold});font-weight:700 900}`;
const css=`${fonts}*{box-sizing:border-box}html,body{margin:0}body{font-family:InterTight,'SUIT Variable',sans-serif;color:#111;background:#fff}.canvas{position:relative;overflow:hidden;background:#fff}.text{position:absolute;margin:0;white-space:pre-line;word-break:keep-all;letter-spacing:-.035em;line-height:1.24}.muted{color:#5b6066}.photo{position:absolute;display:block;object-fit:contain}.clip{position:absolute;overflow:hidden}.clip img{position:absolute}.credit{position:absolute;bottom:42px;left:76px;right:76px;display:flex;justify-content:space-between;font-size:18px;color:#646970;letter-spacing:.01em}.line{position:absolute;height:2px;background:#e4e8ed}`;
const text=(content,x,y,w,size=40,weight=500,color='#111',extra='')=>`<div class="text" style="left:${x}px;top:${y}px;width:${w}px;font-size:${size}px;font-weight:${weight};color:${color};${extra}">${esc(content)}</div>`;
const img=(key,x,y,w,h,extra='')=>`<img class="photo" src="${data(key)}" alt="${key}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px;${extra}">`;
const crop=(key,x,y,w,h,iw,ih,ix,iy)=>`<div class="clip" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"><img src="${data(key)}" alt="${key} 세부 확대" style="width:${iw}px;height:${ih}px;left:${ix}px;top:${iy}px"></div>`;
const line=(y,w=1248,x=76)=>`<div class="line" style="top:${y}px;left:${x}px;width:${w}px"></div>`;
const foot=(r='SYNK · 자체 브랜드 프로젝트')=>`<div class="credit"><span>Felt &amp; Glass Social Design</span><span>${esc(r)}</span></div>`;
const cards=[];
function add(id,channel,w,h,title,body,alt){cards.push({id,channel,w,h,title,body,alt});}

add('behance-00-cover','Behance',1616,1264,'프로젝트 표지',
 img('logo',84,54,250,120)+text('Felt & Glass',84,205,1450,116,800)+text('SYNK의 SNS 브랜드 디자인',90,360,1420,44,500,'#525960')+img('hero',84,450,1448,814),
 'SYNK 로고와 Felt & Glass 제목 아래 검은 펠트 바탕, 파란 소품과 유리 로고를 사용한 SNS 커버');

add('behance-01-overview','Behance',1400,1310,'완성 작품',
text('하나의 브랜드를\n서로 다른 채널에',76,74,1210,86,800)+text('SYNK의 SNS 커버와 프로필을 디자인한 자체 프로젝트',80,305,1240,32,500,'#5b6066')+
img('hero',76,414,1248,702)+text('방향 설정 · AI 이미지 활용 · 디지털 합성 · 채널별 배치',80,1160,1240,27,500,'#515962')+foot(),
'검정 펠트 바탕에 유리 로고, 파란 웹·콘텐츠 소품을 배치한 SYNK SHIFT 완성 커버');

add('behance-02-channels','Behance',1400,1540,'채널별 설명',
text('재질은 이어지고,\n설명은 달라집니다',76,68,1200,78,800)+text('누가 방문하는지에 맞춰 문구와 소품을 골랐습니다.',80,278,1210,32,500,'#5b6066')+
text('한국어 학습과 유학 준비',80,371,1180,34,700,'#bd493c')+img('lab',80,425,1240,540,'object-fit:contain')+
text('업무에 AI를 쓰는 방법',80,975,1180,32,700,'#294f91')+img('brief',80,1028,1240,205)+
text('직접 만들고 고친 과정',80,1270,1180,32,700,'#294f91')+img('maker',80,1320,1240,145)+foot(),
'한국어 교육, AI 업무 활용, 유호의 제작 기록에 맞춰 문구와 소품을 달리한 실제 커버 세 개');

add('behance-03-material','Behance',1400,1400,'재질과 가독성',
text('가까이서 볼 질감,\n작게 보아도 읽히는 글',76,72,1230,78,800)+text('펠트·자수·유리의 표면과 글자의 공간을 나누었습니다.',80,285,1240,32,500,'#5b6066')+
crop('glass',76,399,1248,360,1400,525,-76,-70)+crop('props',76,785,1248,300,1538,866,-140,-270)+
text('유리의 가장자리와 두께',80,1140,590,36,750)+text('반사와 그림자로 로고를 강조합니다.',80,1198,590,28,500,'#5b6066')+
text('소품의 펠트와 자수',744,1140,590,36,750)+text('색과 소재로 채널의 성격을 이어줍니다.',744,1198,585,28,500,'#5b6066')+foot('커버에 사용한 원본 자산'),
'SNS 커버에 사용한 밝은 배경의 유리 로고와 파란 펠트 소품 원본을 보여주는 재질 상세');

add('behance-04-before-after','Behance',1400,1610,'실제 수정 전후',
text('보이는 자리까지\n확인하고 수정했습니다',76,65,1260,78,800)+
text('01  Behance 커버의 배치',80,295,1240,35,750)+text('수정 전 · 업로드용 원본',80,355,1240,24,500,'#5b6066')+img('before',80,397,1240,159)+
text('수정 후 · 업로드용 원본',80,584,1240,24,500,'#5b6066')+img('after',80,626,1240,159)+
text('처음 미리보기에서 소품이 잘려 배치를 중앙으로 모으고 아래로 옮겼습니다.\n비교 이미지는 당시 업로드용 원본입니다.',80,816,1240,29,500,'#515962')+
text('02  흰 페이지와 만나는 프로필',80,969,1240,35,750)+img('profileBefore',170,1040,390,390)+img('profileAfter',837,1040,390,390)+
text('수정 전',170,1440,390,25,500,'#5b6066','text-align:center')+text('수정 후',837,1440,390,25,500,'#5b6066','text-align:center')+foot('2026.09.19 실제 수정 사례'),
'위쪽은 Behance 커버 배치 수정 전후 업로드 원본. 아래쪽은 몽글 프로필의 크림색 배경을 흰색으로 바꾼 실제 원본 비교');

add('behance-05-process','Behance',1400,1100,'제작 과정과 크레딧',
text('한 장을 만든 뒤,\n쓰일 곳에 맞게 다듬습니다',76,74,1250,76,800)+
text('01',80,341,120,40,750,'#315891')+text('방문자와 전달할 내용 정하기',242,341,1070,38,750)+text('학습 안내, 실무 활용, 제작 기록의 목적을 구분합니다.',242,405,1060,30,500,'#5b6066')+
text('02',80,512,120,40,750,'#315891')+text('브랜드 자산과 이미지 조합하기',242,512,1070,38,750)+text('기존 로고와 재질을 유지하고 문구·소품·여백을 맞춥니다.',242,576,1060,30,500,'#5b6066')+
text('03',80,683,120,40,750,'#315891')+text('실제 표시 크기에서 수정하기',242,683,1070,38,750)+text('글자가 읽히는지, 중요한 소품이 잘리지 않는지 확인합니다.',242,747,1060,30,500,'#5b6066')+
line(880)+text('Direction & production  Yuho Yang / SYNK SHIFT\nAI 이미지 생성 · 기존 브랜드 자산 · 디지털 합성',80,914,1240,26,500,'#5b6066')+foot('synk.im'),
'방문자와 내용 정하기, 브랜드 자산 조합하기, 실제 크기 확인하기의 세 단계와 제작 크레딧');

add('pinterest-01-overview','Pinterest',1000,1500,'대표 디자인 핀',
img('logo',62,55,200,100)+text('Felt\n& Glass',64,213,875,112,800)+text('SYNK Social Design',68,512,860,33,500,'#5b6066')+
img('hero',0,640,1000,563)+text('펠트의 질감과\n유리의 투명함으로',68,1270,870,52,750)+text('SYNK · 자체 브랜드 디자인',68,1430,870,23,500,'#5b6066'),
'흰 바탕의 Felt & Glass 제목과 검정 펠트에 파란 소품을 배치한 SYNK 커버 디자인');

add('pinterest-02-light-dark','Pinterest',1000,1500,'밝고 어두운 바탕 핀',
text('같은 재질,\n다른 바탕',62,70,880,78,800)+text('SYNK Social Design',66,291,870,30,500,'#5b6066')+
img('lab',28,407,944,512)+img('hero',0,937,1000,563)+
text('Light & Dark',65,353,870,28,700,'#315891'),
'위쪽 흰 바탕의 LAB 커버와 아래쪽 검정 바탕의 SHIFT 커버를 비교한 디자인 핀');

add('pinterest-03-detail','Pinterest',1000,1500,'재질 상세 핀',
text('Felt, stitch\n& glass',62,69,900,86,800)+text('가까이서 보는 브랜드의 질감',67,310,870,34,500,'#5b6066')+
crop('glass',0,415,1000,370,1120,420,-50,-42)+crop('props',0,819,1000,489,1221,687,-135,-90)+
text('SNS 커버에 사용한 원본 자산',65,1380,870,27,500,'#5b6066')+text('SYNK Social Design',65,1432,870,23,500,'#5b6066'),
'SNS 커버에 사용한 투명 유리 로고 원본과 파란 펠트 소품의 섬유·실땀 상세');

add('linkedin-personal-01','LinkedIn 개인',1200,1500,'유호의 제작 판단',
text('통일할 것과\n달라져야 할 것을\n먼저 나눴습니다',70,72,1080,79,800)+text('양유호 · SYNK의 SNS 디자인을 만들며',74,405,1050,29,500,'#5b6066')+
text('공통으로 유지',74,522,1030,31,750,'#315891')+text('로고 · 펠트 · 자수 · 유리',74,572,1050,42,750)+
text('채널에 맞춰 조정',74,675,1040,31,750,'#315891')+text('설명 · 소품 · 잘리는 영역',74,725,1050,42,750)+
img('hero',70,840,1060,596)+text('SYNK 자체 브랜드 프로젝트 · 방향 설정과 제작',74,1450,1060,22,500,'#5b6066'),
'양유호의 SNS 디자인 판단. 공통으로 유지한 로고와 재질, 채널별로 조정한 설명과 소품을 완성 커버와 함께 소개');

add('linkedin-company-01','LinkedIn 회사',1200,1500,'회사 소개와 제작 사례',
img('logo',68,38,205,100)+text('교육과 콘텐츠를\n만드는 SYNK',72,185,1060,76,800)+
text('각자의 목표와 상황에 맞는 도움을\n제공하는 개인화 시스템을 만듭니다.',76,397,1050,35,500,'#4f565e')+
img('friends',70,540,1060,663)+
text('LAB',76,1251,224,31,800,'#bf5048')+text('한국어 교육',76,1300,230,25)+
text('SHIFT',341,1251,224,31,800,'#315891')+text('AI 활용·브랜딩',341,1300,250,25)+
text('PULSE',623,1251,224,31,800,'#963e78')+text('음악·영상·캐릭터',623,1300,280,25)+
text('PATH',935,1251,224,31,800,'#47715d')+text('유학·취업 준비',935,1300,245,25)+
text('이미지: SYNK 자체 캐릭터 작품  ·  사업별 운영·준비 상태는 본문에 안내',76,1430,1060,21,500,'#5b6066'),
'펠트 서울 풍경 속 세 캐릭터와 SYNK의 LAB, SHIFT, PULSE, PATH 사업 소개');

add('kakao-shift-01','카카오톡 SHIFT',1080,1080,'상담 분야 안내',
img('shiftLogo',58,32,330,105)+text('AI를 일에 쓰고,\n회사의 가치를 전하는 일',62,187,957,65,800)+
text('기업·기관 AI 교육 · 컨설팅 · 브랜딩을 준비합니다.',65,381,945,29,500,'#5b6066')+
img('learn',48,469,315,315)+img('consult',382,469,315,315)+img('branding',715,469,315,315)+
text('AI 교육',62,821,296,32,750,'#315891','text-align:center')+text('업무 활용 상담',392,821,296,32,750,'#315891','text-align:center')+text('브랜딩',722,821,296,32,750,'#315891','text-align:center')+
text('채널 채팅으로 필요한 일을 알려주세요.\n내용을 확인하고 현재 도울 수 있는 범위부터 안내합니다.',65,923,960,29,500),
'AI 교육, 업무 활용 상담, 브랜딩 세 분야를 서비스 설명용 펠트 이미지와 함께 소개. 준비 중이며 채널 채팅으로 문의 안내');

add('kakao-shift-02','카카오톡 SHIFT',1080,1080,'문의 방법',
img('shiftLogo',58,32,330,105)+text('이 세 가지만\n남겨주세요',62,183,950,76,800)+
text('01',65,420,100,36,750,'#315891')+text('지금 하는 일',205,420,800,39,750)+text('예: 매주 교육 자료를 만들고 있어요.',205,481,790,29,500,'#5b6066')+
text('02',65,587,100,36,750,'#315891')+text('불편한 부분',205,587,800,39,750)+text('예: 같은 형식에 옮기는 일이 반복돼요.',205,648,790,29,500,'#5b6066')+
text('03',65,754,100,36,750,'#315891')+text('필요한 결과',205,754,800,39,750)+text('예: 팀이 함께 쓸 제작 순서와 양식이 필요해요.',205,815,790,29,500,'#5b6066')+
text('SYNK SHIFT 채널 채팅으로 보내주세요',65,968,950,29,750,'#315891'),
'카카오톡 채팅 문의에 적을 세 가지: 지금 하는 일, 불편한 부분, 필요한 결과. 각 항목에 짧은 예시');

async function main(){
  for(const dir of ['images','source','qa'])fs.mkdirSync(path.join(__dirname,dir),{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const qa=[];
  for(const c of cards){
    const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(c.title)}</title><style>${css}</style></head><body><main class="canvas" style="width:${c.w}px;height:${c.h}px">${c.body}</main></body></html>`;
    const source=path.join(__dirname,'source',c.id+'.html');fs.writeFileSync(source,html);
    const page=await browser.newPage({viewport:{width:c.w,height:c.h},deviceScaleFactor:1});
    await page.goto(pathToFileURL(source).href);await page.evaluate(()=>document.fonts.ready);
    await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
    const issues=await page.locator('.text').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent.slice(0,55),x:r.x,y:r.y,w:r.width,h:r.height};}).filter(r=>r.x<0||r.y<0||r.x+r.w>document.querySelector('.canvas').clientWidth+1||r.y+r.h>document.querySelector('.canvas').clientHeight+1));
    const file='images/'+c.id+'.png';await page.screenshot({path:path.join(__dirname,file),fullPage:false});
    const metadata=await sharp(path.join(__dirname,file)).metadata();
    qa.push({id:c.id,width:metadata.width,height:metadata.height,bytes:fs.statSync(path.join(__dirname,file)).size,issues,fonts:await page.evaluate(()=>({suit:document.fonts.check('800 50px "SUIT Variable"'),latin:document.fonts.check('700 50px InterTight')}))});
    c.file=file;await page.close();console.log('rendered '+c.id);
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname,'qa','render.json'),JSON.stringify(qa,null,2));
  fs.writeFileSync(path.join(__dirname,'sources.json'),JSON.stringify({created:'2026-09-26',publication:'not-published',assets,claims:['기존 SNS 디자인 작업과 2026-09-19 수정 기록에 기반','서비스는 기업·기관 AI 교육·컨설팅·브랜딩 준비 단계','프로필과 커버 원본 비교이며 플랫폼 캡처가 아님'],specSources:[{title:'Behance Cover Images',url:'https://help.behance.net/hc/en-us/articles/360033998134-Guide-Cover-Images'},{title:'Behance Image Formatting',url:'https://help.behance.net/hc/en-us/articles/204484614-Guide-Formatting-Images-For-Display-On-Behance'},{title:'Pinterest Image Specifications',url:'https://help.pinterest.com/en/business/article/pinterest-product-specs'}]},null,2));
  fs.writeFileSync(path.join(__dirname,'images.json'),JSON.stringify(cards.map(({body,...c})=>c),null,2));
  buildPreview();
}

function buildPreview(){
 const groupMap={'Behance':'Behance.md','Pinterest':'Pinterest.md','LinkedIn 개인':'LinkedIn_개인.md','LinkedIn 회사':'LinkedIn_회사.md','카카오톡 SHIFT':'카카오톡_SHIFT.md'};
 const groups=Object.entries(groupMap).map(([name,copy],n)=>{
   const publicFile=copy.replace('.md','.txt');
   const file=path.join(__dirname,'publish',publicFile),raw=fs.existsSync(file)?fs.readFileSync(file,'utf8'):fs.readFileSync(path.join(__dirname,'copy',copy),'utf8');
   return `<section id="g${n}"><div class="sectionhead"><h2>${esc(name)}</h2><a href="publish/${encodeURIComponent(publicFile)}" download>게시 문안 받기</a></div><div class="gallery">${cards.filter(c=>c.channel===name).map(c=>`<figure><a href="${c.file}" target="_blank"><img src="${c.file}" loading="lazy" alt="${esc(c.alt)}"></a><figcaption>${esc(c.title)}<span>${c.w} × ${c.h}</span><a href="${c.file}" download>이미지 받기</a></figcaption></figure>`).join('')}</div><details><summary>게시 문안 읽기</summary><pre>${esc(raw)}</pre></details></section>`;
 }).join('');
 const html=`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK 포트폴리오 · 회사 소개</title><style>${fonts}*{box-sizing:border-box}body{margin:0;background:#fff;color:#111;font-family:InterTight,'SUIT Variable',sans-serif;letter-spacing:-.02em}main{max-width:1300px;margin:auto;padding:42px 30px 100px}header{padding:40px 0 50px}header img{width:145px}h1{font-size:clamp(32px,4.7vw,62px);line-height:1.13;margin:36px 0 20px}p{color:#535e69;font-size:18px;line-height:1.7}nav{display:flex;gap:12px;flex-wrap:wrap;margin:28px 0}a{color:#24548a;text-underline-offset:4px}nav a{border:1px solid #d3dce5;padding:12px 18px;border-radius:26px;text-decoration:none}a:focus-visible,summary:focus-visible{outline:3px solid #2c69be;outline-offset:4px}.download{display:inline-block;background:#193f76;color:white;padding:14px 21px;border-radius:9px;text-decoration:none}.status{font-size:14px;color:#53616f}.sectionhead{display:flex;align-items:center;justify-content:space-between;gap:18px}h2{font-size:31px;margin:0}section{padding:38px 0 64px;border-top:1px solid #e2e6ea;scroll-margin-top:15px}.gallery{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;margin-top:28px;align-items:start}figure{margin:0;border:1px solid #e0e5ea;border-radius:8px;overflow:hidden}figure img{display:block;width:100%;height:auto}figcaption{padding:15px;background:#fff;font-weight:700;line-height:1.7}figcaption span{display:block;font-weight:400;font-size:13px;color:#69717b}figcaption a{font-weight:500;font-size:14px}details{margin-top:25px;border-top:1px solid #e0e5ea;padding:22px 0}summary{cursor:pointer;font-size:18px;font-weight:650}pre{white-space:pre-wrap;font:16px/1.8 InterTight,'SUIT Variable',sans-serif;max-width:900px;padding:22px 0;overflow-wrap:anywhere}footer{font-size:14px;color:#66717d}@media(max-width:760px){main{padding:20px 18px 65px}.gallery{grid-template-columns:1fr}.sectionhead{align-items:flex-start;flex-direction:column}nav{gap:8px}nav a{font-size:14px;padding:10px 13px}header{padding-top:10px}h2{font-size:26px}}</style></head><body><main><header><img src="${data('logo')}" alt="SYNK"><h1>포트폴리오 · 회사 소개</h1><p>첫 사례는 SYNK의 펠트·유리 SNS 디자인입니다.<br>완성 작품, 실제 수정 전후, 회사 소개와 문의 안내를 채널별로 구성했습니다.</p><div class="status">2026.09.26 · 검토본 · 외부 미게시</div><nav>${Object.keys(groupMap).map((g,n)=>`<a href="#g${n}">${esc(g)}</a>`).join('')}</nav><a class="download" href="SYNK_포트폴리오_회사소개_게시준비.zip" download>이미지와 게시 문안 모두 받기</a></header>${groups}<footer>자체 브랜드 제작 사례입니다. 서비스 설명 이미지와 캐릭터 작품은 AI 이미지·디지털 합성으로 제작된 기존 SYNK 자산을 사용했습니다.</footer></main></body></html>`;
 fs.writeFileSync(path.join(__dirname,'preview.html'),html);
}

if(process.argv.includes('--preview-only')){const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'images.json'),'utf8'));cards.length=0;cards.push(...manifest);buildPreview();}else main().catch(e=>{console.error(e);process.exit(1)});
