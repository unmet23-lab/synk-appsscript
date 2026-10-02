'use strict';

// SYNK first carousel. This builds local editorial artifacts only; no account API.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const ROOT = path.resolve(__dirname, '../../../..');
const loom = require(path.join(ROOT, 'tools/lib/loom.js'));
const brandFont = require(path.join(ROOT, 'tools/lib/브랜드폰트.js'));
const {loadVisions} = require(path.join(ROOT, 'tools/lib/비전정본.js'));
const TOKENS = loom.정본();
const C = TOKENS.색;
const SPACE = Object.fromEntries(Object.entries(TOKENS.율.단계).map(([k,v]) => [k,v.px * 2]));
const W = 2160, H = 2700, M = SPACE.막;
const vision = loadVisions().synk;
const philosophySource = fs.readFileSync(path.join(ROOT,'docs/SYNK_철학.md'),'utf8');
const philosophy = philosophySource.match(/^## 1\. (.+)$/m)[1].trim().replace(/\.$/,'') + '.';
const kit = 'docs/홍보물/마케팅실행_20260909/브랜드킷';
const placements = JSON.parse(fs.readFileSync(path.join(ROOT,kit,'배치명세.json'),'utf8')).items;
const sources = new Map();
function source(rel,mime) {
  const data=fs.readFileSync(path.join(ROOT,rel));
  const sha256=crypto.createHash('sha256').update(data).digest('hex');
  sources.set(rel,{path:rel,sha256,bytes:data.length});
  return mime ? `data:${mime};base64,${data.toString('base64')}` : data.toString('utf8');
}
for (const rel of ['AGENTS.md','docs/AI_운영원칙.md','DESIGN.md','docs/디자인_토큰.json','docs/브랜드_폰트_정본.md','docs/로고_중립색_정본_v1.md','docs/비전_정본.md','docs/SYNK_철학.md','docs/마케팅/제작_인수기준.md','docs/마케팅/전사새출발_20260914/forge_B.md','docs/마케팅/전사새출발_20260914/forge_gate.md',`${kit}/사용규칙.md`,`${kit}/배치명세.json`]) source(rel);
for(const rel of ['tools/lib/loom.js','tools/lib/브랜드폰트.js','tools/lib/비전정본.js',path.relative(ROOT,__filename)]) source(rel);
const fonts = {
  suit:source('docs/브랜드_폰트/SUIT/SUIT-Variable.woff2','font/woff2'),
  inter:source('docs/브랜드_폰트/InterTight/InterTight-Medium.ttf','font/ttf'),
  interBold:source('docs/브랜드_폰트/InterTight/InterTight-Bold.ttf','font/ttf'),
  mono:source('docs/브랜드_폰트/DM_Mono/DMMono-Medium.ttf','font/ttf'),
  monoLight:source('docs/브랜드_폰트/DM_Mono/DMMono-Light.ttf','font/ttf')
};
const textures = {
  paper:source('docs/Loom_자산/구움/펠트_종이바탕.webp','image/webp'),
  dark:source('docs/Loom_자산/구움/펠트_어두운판.webp','image/webp')
};
const logos = {};
for(const [brand,variant] of [['SYNK','Ink'],['SYNK','Paper'],['LAB','Ink'],['SHIFT','Ink'],['PULSE','Ink']]) {
  const item=placements.find(p=>p.brand===brand&&p.variant===variant);
  const rel=`${kit}/${item.file}`;
  const uri=source(rel,'image/png');
  if(sources.get(rel).sha256!==item.sha256) throw new Error(`Logo source drift: ${rel}`);
  logos[`${brand}-${variant}`]={...item,uri,path:rel};
}
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const CSS=`
${brandFont.면()}
@font-face{font-family:'Inter Tight';src:url('${fonts.inter}') format('truetype');font-weight:500;font-display:block}
@font-face{font-family:'Inter Tight';src:url('${fonts.interBold}') format('truetype');font-weight:700;font-display:block}
@font-face{font-family:'DM Mono';src:url('${fonts.mono}') format('truetype');font-weight:500;font-display:block}
@font-face{font-family:'DM Mono';src:url('${fonts.monoLight}') format('truetype');font-weight:300;font-display:block}
text{font-family:'Inter Tight','SUIT Variable',sans-serif;letter-spacing:-.02em;font-weight:500}
.head{font-family:'Inter Tight','SUIT Variable',sans-serif;font-weight:800;letter-spacing:-.04em;font-synthesis:none}
.mono{font-family:'DM Mono',monospace;font-weight:500;letter-spacing:.02em}
`;
let textItems=[], logoItems=[];
function text(lines,x,y,size=80,opts={}) {
  if(typeof lines==='string') lines=[lines];
  const {color=C.Ink,weight,head=false,mono=false,leading=1.3,role='body',anchor='start'}=opts;
  return lines.map((line,i)=>{
    const id=`text-${textItems.length+1}`;
    textItems.push({id,text:line,fontSize:size,role,fontFamily:mono?'DM Mono':'Inter Tight, SUIT Variable',color});
    const markup=mono ? esc(line).replace(/\//g,'<tspan font-weight="300">/</tspan>') : head ? esc(line).replace(/[A-Za-z0-9“”.,·…]+/g,part=>`<tspan font-family="Inter Tight" font-weight="700">${part}</tspan>`) : esc(line);
    return `<text id="${id}" data-role="${esc(role)}" x="${x}" y="${y+i*size*leading}" font-size="${size}" fill="${color}" text-anchor="${anchor}" class="${head?'head':mono?'mono':''}"${weight?` style="font-weight:${weight}"`:''}>${markup}</text>`;
  }).join('');
}
function logo(key,x,y,width) {
  const a=logos[key],height=width*a.height/a.width;
  const id=`logo-${logoItems.length+1}`;
  logoItems.push({id,key,source:a.path,sourceSha256:a.sha256,x,y,width,height});
  return `<image id="${id}" x="${x}" y="${y}" width="${width}" height="${height}" href="${a.uri}"/>`;
}
function paper(x,y,w,h,angle=0,body='',base=C.Paper) {
  return `<g transform="rotate(${angle} ${x+w/2} ${y+h/2})"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${base}" filter="url(#paper-shadow)"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="url(#paper-grain)" opacity=".24"/><path d="M ${x+2} ${y+2} H ${x+w-2}" stroke="${C.Paper}" stroke-width="4" opacity=".85"/>${body}</g>`;
}
function line(x1,y1,x2,y2,color=C.Stone,sw=3){return `<path d="M${x1} ${y1}H${x2}" transform="translate(0 ${y2-y1})" fill="none" stroke="${color}" stroke-width="${sw}"/>`;}
function defs(){return `<defs><style>${CSS}</style><pattern id="paper-grain" width="2000" height="2000" patternUnits="userSpaceOnUse"><image href="${textures.paper}" width="2000" height="2000"/></pattern><radialGradient id="warm-light" cx=".1" cy=".06" r="1"><stop offset="0" stop-color="${C.Stitch}" stop-opacity=".2"/><stop offset=".67" stop-color="${C.Stitch}" stop-opacity="0"/></radialGradient><filter id="paper-shadow" x="-.2" y="-.2" width="1.4" height="1.5"><feDropShadow dx="0" dy="23" stdDeviation="20" flood-color="${C.Ink}" flood-opacity=".15"/></filter></defs>`;}
function background(mode){
  const dark=mode==='dark';
  return `<rect width="${W}" height="${H}" fill="${dark?C['Ink Deep']:mode==='oat'?C.Oat:C.Paper}"/><image width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" href="${dark?textures.dark:textures.paper}" opacity="${dark?'.65':mode==='oat'?'.33':'.28'}"/><rect width="${W}" height="${H}" fill="url(#warm-light)"/>`;
}
function footer(n,dark=false){return line(M,H-178,W-M,H-178,dark?C['Deep Wool']:C.Stone,2)+text(`${String(n).padStart(2,'0')} / 07`,W-M,H-98,56,{mono:true,color:dark?C.Stone:C['Deep Wool'],anchor:'end',role:'pagination'});}
const slides=[];
function slide(n,title,mode,compose){
  textItems=[];logoItems=[];
  const body=compose()+footer(n,mode==='dark');
  slides.push({n,title,mode,textItems:[...textItems],logoItems:[...logoItems],svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${defs()}${background(mode)}${body}</svg>`});
}
const visionLines=['저마다의 삶을','온전히 누리는','미래를 만듭니다.'];
const philosophyLines=['한 사람을 깊이 이해한','개인화 시스템을','만듭니다.'];
const subLines=['AI가 넓힌 가능성을','배움과 일, 문화로','연결합니다.'];
if(visionLines.join(' ')!==vision.headline || subLines.join(' ')!==vision.subtext || philosophyLines.join(' ')!==philosophy) throw new Error('Official copy changed. Reflow exact current canon, do not silently keep old copy.');

slide(1,'SYNK 비전','paper',()=>
  logo('SYNK-Ink',M,190,590)+
  text(visionLines,M,810,146,{head:true,weight:900,leading:1.29,role:'official-vision'})+
  paper(190,1530,1530,430,-3,text('어제',280,1645,64,{color:C['Deep Wool'],role:'note-label'})+text('발표를 잘하고 싶어요.',280,1800,88,{head:true,role:'example'}))+
  paper(390,1915,1550,500,3,text('오늘',480,2030,64,{color:C['Deep Wool'],role:'note-label'})+text(['그 전에, 제 생각부터','정리하고 싶어요.'],480,2170,88,{head:true,leading:1.3,role:'example'}))
);
slide(2,'같은 사람의 질문도 달라집니다','oat',()=>
  text(['같은 사람의 질문도','달라집니다.'],M,310,124,{head:true,leading:1.27,role:'headline'})+
  paper(M,650,W-2*M,630,-1.4,text('어제',M+80,790,72,{color:C['Deep Wool'],role:'note-label'})+text(['“발표를 잘하고','싶어요.”'],M+80,975,108,{head:true,leading:1.3,role:'example'}))+
  paper(M,1440,W-2*M,720,1.2,text('오늘',M+80,1580,72,{color:C['Deep Wool'],role:'note-label'})+text(['“그 전에, 제 생각부터','정리하고 싶어요.”'],M+80,1775,108,{head:true,leading:1.3,role:'example'}))+
  text('개인화 방향을 설명하는 예시',M,2350,68,{color:C['Deep Wool'],role:'disclosure'})
);
slide(3,'필요가 바뀌면 다음 도움도 바뀌어야 합니다','dark',()=>
  logo('SYNK-Paper',M,165,390)+
  text(['필요가 바뀌면,','다음 도움도','바뀌어야 합니다.'],M,635,137,{head:true,color:C.Paper,leading:1.28,role:'headline'})+
  text(['발표 연습을 바로 시작하기보다,','지금 정리할 말을 먼저 찾는 것.'],M,1260,82,{color:C.Oat,leading:1.55})+
  paper(M,1640,W-2*M,745,-1.2,
    text('먼저, 내 생각부터',M+80,1800,88,{head:true,role:'note-label'})+
    text(['지금 하려는 일은','먼저 정리하고 싶은 것은','오늘 필요한 도움은'],M+80,1955,74,{leading:1.73,role:'worksheet-preview'})+
    line(M+80,1985,W-M-80,1985)+line(M+80,2113,W-M-80,2113)+line(M+80,2241,W-M-80,2241))
);
slide(4,'지금 생각을 정리하는 세 줄','paper',()=>
  text('지금 생각을 정리하는',M,350,118,{head:true,role:'headline'})+
  text('세 줄',M,540,166,{head:true,role:'headline'})+
  text('지금 하려는 일은',M,915,90,{head:true,role:'worksheet'})+line(M,1095,W-M,1095,C.Stone,4)+
  text('먼저 정리하고 싶은 것은',M,1370,90,{head:true,role:'worksheet'})+line(M,1550,W-M,1550,C.Stone,4)+
  text('오늘 필요한 도움은',M,1825,90,{head:true,role:'worksheet'})+line(M,2005,W-M,2005,C.Stone,4)+
  text(['내 메모에 옮겨 적고,','달라지면 고쳐도 됩니다.'],M,2290,80,{leading:1.35,color:C['Deep Wool']})
);
slide(5,'SYNK의 철학과 발전 방향','dark',()=>
  logo('SYNK-Paper',M,155,390)+
  text(philosophyLines,M,615,121,{head:true,color:C.Paper,leading:1.27,role:'official-philosophy'})+
  text(['그 이해가 실제 도움을 바꾸도록,','만들고 확인하고 고쳐 갑니다.'],M,1130,80,{color:C.Oat,leading:1.4})+
  line(M,1390,W-M,1390,C['Deep Wool'])+
  text('만들고',M,1540,103,{head:true,color:C.Paper,role:'process'})+
  text('지금 필요한 도움을 형태로.',M,1660,76,{color:C.Oat})+
  line(M,1770,W-M,1770,C['Deep Wool'])+
  text('확인하고',M,1920,103,{head:true,color:C.Paper,role:'process'})+
  text('처음의 이해가 여전히 맞는지.',M,2040,76,{color:C.Oat})+
  line(M,2150,W-M,2150,C['Deep Wool'])+
  text('고쳐 갑니다',M,2300,103,{head:true,color:C.Paper,role:'process'})+
  text('달라진 필요에 맞춰 다음 도움을.',M,2420,76,{color:C.Oat})
);
slide(6,'세 사업은 서로 다른 일을 맡습니다','paper',()=>
  text(['세 사업은 서로 다른','일을 맡습니다.'],M,340,120,{head:true,leading:1.28,role:'headline'})+
  logo('LAB-Ink',M,760,790)+
  text(['삶의 방향과','배움·경험의 경로 연구'],M,1145,82,{leading:1.35})+
  line(M,1370,W-M,1370)+
  logo('SHIFT-Ink',M,1440,875)+
  text(['기관·기업의 성장과','개인의 기회 연결'],M,1795,82,{leading:1.35})+
  line(M,2020,W-M,2020)+
  logo('PULSE-Ink',M,2080,900)+
  text('감정과 기억을 남기는 작품 제작',M,2430,82)
);
slide(7,'배움과 일, 문화로 연결합니다','oat',()=>
  text(subLines,M,380,132,{head:true,weight:900,leading:1.3,role:'official-subtext'})+
  text(['이곳에는 우리가 만드는 것과,','그 안에서 바꾼 결정을 남깁니다.'],M,1050,82,{leading:1.45})+
  paper(290,1410,1550,750,-3,text('어제',390,1510,72,{color:C['Deep Wool'],role:'note-label'})+text('발표를 잘하고 싶어요.',390,1650,89,{head:true,role:'example'}))+
  paper(M,1715,W-2*M,610,2,text('오늘',M+80,1855,72,{color:C['Deep Wool'],role:'note-label'})+text(['그 전에, 제 생각부터','정리하고 싶어요.'],M+80,2015,100,{head:true,leading:1.35,role:'example'}))
);

const post=`# 같은 사람, 달라진 질문\n\n> SYNK 회사 첫 게시물 · 로컬 제작본 · 실제 게시하지 않음\n> 1장은 게시물 표지입니다. 계정 커버·프로필 소개·핸들 변경용 파일이 아닙니다.\n\n## LinkedIn 회사 Page 본문\n\n${vision.headline}\n\n어제는 발표를 잘하고 싶었지만, 오늘은 그 전에 자신의 생각부터 정리하고 싶을 수 있습니다. 한 사람을 이해한다는 것은 처음 들은 답을 오래 보관하는 것만으로 끝나지 않습니다. 달라진 필요를 확인하고, 다음 도움도 바꾸는 일이라고 생각합니다.\n\nSYNK는 ${philosophy} LAB은 삶의 방향과 배움·경험의 경로를 연구하고, SHIFT는 기관·기업의 성장과 개인의 기회를 연결하며, PULSE는 감정과 기억을 남기는 작품을 만듭니다.\n\n카드의 대화는 이 방향을 설명하기 위한 예시입니다. 메모와 5장의 세 과정은 설명용 편집이며, 실제 고객의 기록이나 제품 화면이 아닙니다. 현재 학습·기록 제품과 표현 방식을 개발하고 있으며, 개인화가 실제로 어떤 도움을 만드는지는 계속 확인해 갑니다.\n\n네 번째 장의 세 줄은 각자의 메모에 그대로 가져가셔도 좋습니다.\n\n${vision.subtext}\n\n## Instagram 회사 소개 게시물 본문\n\n${vision.headline}\n\n어제는 발표를 잘하고 싶었지만, 오늘은 그 전에 자신의 생각부터 정리하고 싶을 수 있습니다. 달라진 필요를 확인하고 다음 도움도 바꾸는 일. SYNK가 만들어 가려는 개인화입니다.\n\n대화와 메모는 방향을 설명하는 예시이며 실제 고객 기록이나 제품 화면이 아닙니다. 개인화가 실제로 어떤 도움을 만드는지는 계속 확인해 갑니다.\n\n네 번째 장의 세 줄을 자신의 메모에 옮겨 적어 보셔도 좋습니다. 달라지면 고쳐도 됩니다.\n\n${vision.subtext}\n\n## 게시 경계\n\n- 회사 Page 게시물용 원고이며 LinkedIn 개인 중복 계정에는 게시하지 않았습니다.\n- Instagram의 기존 계정 전환·이름·사진·핸들 변경·게시 대상 결정은 별개입니다. 이 제작은 어떤 계정도 변경하지 않았습니다.\n- ‘같은 사람, 달라진 질문’은 이 게시물의 제목이지 새 기업 슬로건이나 정본 비전이 아닙니다.\n- PNG 7장이 원본입니다. 플랫폼의 실제 업로더 형식·재압축·미리보기는 아직 확인하지 않았습니다.\n`;
const alts=[
  '밝은 펠트 바탕에 공식 SYNK 로고와 “저마다의 삶을 온전히 누리는 미래를 만듭니다.”라는 비전. 아래에는 어제의 “발표를 잘하고 싶어요.”와 오늘의 “그 전에, 제 생각부터 정리하고 싶어요.”가 각각 적힌 종이 메모가 겹쳐 있다. 대화는 설명용 예시다.',
  '“같은 사람의 질문도 달라집니다.” 위아래 두 메모의 어제 질문은 “발표를 잘하고 싶어요.”, 오늘 질문은 “그 전에, 제 생각부터 정리하고 싶어요.”이다. 아래에 “개인화 방향을 설명하는 예시”라고 명시했다.',
  '어두운 펠트 바탕의 문장: “필요가 바뀌면, 다음 도움도 바뀌어야 합니다.” 발표 연습을 바로 시작하기보다 지금 정리할 말을 먼저 찾는다는 설명 아래에 세 줄 메모가 놓여 있다. 지금 하려는 일, 먼저 정리하고 싶은 것, 오늘 필요한 도움을 적는 공간이다.',
  '지금 생각을 정리하는 세 줄. “지금 하려는 일은”, “먼저 정리하고 싶은 것은”, “오늘 필요한 도움은” 아래에 각각 넓은 빈줄이 있다. 내 메모에 옮겨 적고 달라지면 고쳐도 된다는 안내. 로그인이나 답변 제출 없이 혼자 쓸 수 있는 정적인 메모 양식이다.',
  '공식 SYNK 로고 아래 철학: “한 사람을 깊이 이해한 개인화 시스템을 만듭니다.” 그 이해가 실제 도움을 바꾸도록 만들고 확인하고 고쳐 간다는 설명. 세 과정은 “만들고—지금 필요한 도움을 형태로”, “확인하고—처음의 이해가 여전히 맞는지”, “고쳐 갑니다—달라진 필요에 맞춰 다음 도움을”이다. 제품 화면이 아닌 지향을 설명하는 편집 지면이다.',
  '“세 사업은 서로 다른 일을 맡습니다.” 공식 SYNK LAB, SYNK SHIFT, SYNK PULSE 완성 로고가 위아래로 배치되어 있다. LAB은 삶의 방향과 배움·경험의 경로 연구, SHIFT는 기관·기업의 성장과 개인의 기회 연결, PULSE는 감정과 기억을 남기는 작품 제작으로 설명한다.',
  '“AI가 넓힌 가능성을 배움과 일, 문화로 연결합니다.” 이곳에는 우리가 만드는 것과 그 안에서 바꾼 결정을 남긴다는 문장. 어제의 메모 앞에 오늘의 “그 전에, 제 생각부터 정리하고 싶어요.” 메모가 놓여 있다. 설명용 예시이며 신청 버튼이나 QR 코드는 없다.'
];

async function build(){
  fs.mkdirSync(path.join(__dirname,'qa'),{recursive:true});
  fs.mkdirSync(path.join(__dirname,'라이선스'),{recursive:true});
  for(const [name,rel] of [['SUIT-OFL.txt','docs/브랜드_폰트/SUIT/LICENSE_OFL.txt'],['InterTight-OFL.txt','docs/브랜드_폰트/InterTight/OFL.txt'],['DMMono-OFL.txt','docs/브랜드_폰트/DM_Mono/OFL.txt']]) fs.writeFileSync(path.join(__dirname,'라이선스',name),source(rel));
  const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
  const manifest={title:'같은 사람, 달라진 질문',brand:'SYNK',status:'local-rendered-unpublished',createdAt:new Date().toISOString(),canvas:{width:W,height:H},mobile:{width:390,height:488,method:'real browser SVG render at 390 CSS px; not platform preview'},officialCopy:{vision:vision.headline,subtext:vision.subtext,philosophy},imageGeneration:'none; approved bitmap textures and unchanged logo placements are reused within new editable compositions',realProductScreenshots:0,realCustomerRecords:0,approval:'not requested or inferred by renderer',published:false,livePlatformVerified:false,sources:[...sources.values()],slides:[]};
  for(const s of slides){
    const stem=`${String(s.n).padStart(2,'0')}-${['비전','달라진질문','다음도움','세줄메모','철학과과정','세사업','연결'][s.n-1]}`;
    const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.title)}</title><style>${loom.css({지면:'부품만'})}\nhtml,body{margin:0;padding:0;width:100%;background:${C.Paper}}body>svg{display:block;width:100%;height:auto}</style>${s.svg}</html>`;
    fs.writeFileSync(path.join(__dirname,`${stem}.svg`),s.svg);
    fs.writeFileSync(path.join(__dirname,`${stem}.html`),html);
    await page.setViewportSize({width:W,height:H});
    await page.goto(pathToFileURL(path.join(__dirname,`${stem}.html`)).href);
    await page.evaluate(async()=>{await document.fonts.ready; await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
    await page.screenshot({path:path.join(__dirname,`${stem}.png`),animations:'disabled'});
    const boxes=await page.locator('svg text').evaluateAll(nodes=>nodes.map(el=>{const b=el.getBoundingClientRect(),s=getComputedStyle(el);return {id:el.id,text:el.textContent,x:b.x,y:b.y,width:b.width,height:b.height,fontSize:s.fontSize,fontWeight:s.fontWeight,fontFamily:s.fontFamily};}));
    const outOfCanvas=boxes.filter(b=>b.x<0||b.y<0||b.x+b.width>2160||b.y+b.height>2700);
    if(outOfCanvas.length) throw new Error(`Text outside canvas ${stem}: ${JSON.stringify(outOfCanvas)}`);
    const client=await page.context().newCDPSession(page);
    await client.send('DOM.enable');await client.send('CSS.enable');
    const {root}=await client.send('DOM.getDocument');
    const first=await client.send('DOM.querySelector',{nodeId:root.nodeId,selector:'svg text'});
    const actualFonts=await client.send('CSS.getPlatformFontsForNode',{nodeId:first.nodeId});
    await client.detach();
    await page.setViewportSize({width:390,height:488});
    await page.screenshot({path:path.join(__dirname,'qa',`${stem}-390.png`),animations:'disabled'});
    manifest.slides.push({number:s.n,title:s.title,file:`${stem}.png`,html:`${stem}.html`,svg:`${stem}.svg`,mobileQA:`qa/${stem}-390.png`,alt:alts[s.n-1],sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,`${stem}.png`))).digest('hex'),bytes:fs.statSync(path.join(__dirname,`${stem}.png`)).size,text:s.textItems,textBBoxes:boxes,logos:s.logoItems,actualFontSample:actualFonts.fonts,outOfCanvas});
    process.stdout.write(`${stem}: ${boxes.length} text elements, 2160x2700 and 390px rendered\n`);
  }
  await browser.close();
  fs.writeFileSync(path.join(__dirname,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(__dirname,'게시문.md'),post);
  fs.writeFileSync(path.join(__dirname,'대체텍스트.md'),'# 이미지 대체 텍스트\n\n'+alts.map((a,i)=>`## ${i+1}장\n\n${a}\n`).join('\n'));
  fs.writeFileSync(path.join(__dirname,'index.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK · 같은 사람, 달라진 질문</title><style>${CSS}body{margin:0;padding:32px;background:${C.Oat};color:${C.Ink};font-family:'SUIT Variable',sans-serif}main{max-width:1260px;margin:auto}h1{font-size:32px;font-weight:800;letter-spacing:-.04em}p{line-height:1.6}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}figure{margin:0}img{display:block;width:100%;height:auto}figcaption{padding:12px 0 20px;font-size:15px}a{color:inherit}</style><main><h1>같은 사람, 달라진 질문</h1><p>SYNK 회사 첫 캐러셀 · 2160×2700 · 7장<br>로컬 제작본 / 미게시. 메모와 과정은 설명용 편집이며 실제 제품 화면이나 고객 기록이 아닙니다.</p><p><a href="게시문.md">한국어 게시문</a> · <a href="대체텍스트.md">대체 텍스트</a> · <a href="검증결과.md">검증 결과</a></p><section>${manifest.slides.map(s=>`<figure><a href="${s.html}"><img src="${s.file}" alt="${esc(s.alt)}"></a><figcaption>${s.number}. ${esc(s.title)} · <a href="${s.svg}">SVG</a></figcaption></figure>`).join('')}</section></main></html>`);
  process.stdout.write(`DONE: ${slides.length} slides; ${manifest.sources.length} current sources hashed. Manual image review still required.\n`);
}
build().catch(e=>{console.error(e);process.exitCode=1;});
