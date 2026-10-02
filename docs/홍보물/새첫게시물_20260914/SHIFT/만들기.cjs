'use strict';

// Local editorial production only. Does not read accounts or publish anything.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {pathToFileURL} = require('node:url');
const ROOT = path.resolve(__dirname, '../../../..');
const loom = require(path.join(ROOT, 'tools/lib/loom.js'));
const brandFont = require(path.join(ROOT, 'tools/lib/브랜드폰트.js'));
const {loadVisions} = require(path.join(ROOT, 'tools/lib/비전정본.js'));
const C = loom.정본().색;
const SPACE = Object.fromEntries(Object.entries(loom.정본().율.단계).map(([k,v])=>[k,v.px*2]));
const W=2160, H=2700, M=SPACE.막;
const vision=loadVisions().shift;
const philosophy='올바른 가치관과 탄탄한 역량이 기회를 만나도록, 개인과 조직을 연결합니다.';
// 2026-09-18 철학 정본 v2.2 문체 개정에 맞춰 세 문장을 갱신했다. 아래 검사가 정본과의 어긋남을 잡아 준다.
const education='기관 강의와 기업 컨설팅으로 현장이 일하는 방식을 함께 손봅니다.';
const advertising='브랜딩으로는 그 회사가 가진 가치를 고객에게 제대로 닿게 합니다.';
const connection='유학부터 취업까지 교육기관과 기업을 이어, 배운 것을 펼칠 자리를 넓힙니다.';
const canon=fs.readFileSync(path.join(ROOT,'docs/SYNK_철학.md'),'utf8');
for(const exact of [philosophy,education,advertising,connection]) if(!canon.includes(exact)) throw new Error('Current SHIFT copy changed: '+exact);
const sources=new Map();
function source(rel,mime){const data=fs.readFileSync(path.join(ROOT,rel));sources.set(rel,{path:rel,sha256:crypto.createHash('sha256').update(data).digest('hex'),bytes:data.length});return mime?`data:${mime};base64,${data.toString('base64')}`:data.toString('utf8');}
const kit='docs/홍보물/마케팅실행_20260909/브랜드킷';
for(const p of ['AGENTS.md','docs/AI_운영원칙.md','DESIGN.md','docs/SYNK_철학.md','docs/비전_정본.md','docs/디자인_토큰.json','docs/브랜드_폰트_정본.md','docs/로고_중립색_정본_v1.md','docs/명품_기준_v1.md','docs/마케팅/SHIFT.md','docs/SHIFT/첫30일_체크리스트_v1.md','docs/SHIFT/관리자연수_아웃라인_v0.md','docs/마케팅/전사새출발_20260914/forge_B.md','docs/마케팅/전사새출발_20260914/forge_gate.md',`${kit}/사용규칙.md`,`${kit}/배치명세.json`])source(p);
const fonts={inter:source('docs/브랜드_폰트/InterTight/InterTight-Medium.ttf','font/ttf'),interBold:source('docs/브랜드_폰트/InterTight/InterTight-Bold.ttf','font/ttf'),mono:source('docs/브랜드_폰트/DM_Mono/DMMono-Medium.ttf','font/ttf'),monoLight:source('docs/브랜드_폰트/DM_Mono/DMMono-Light.ttf','font/ttf')};
const fontLicenses=[['SUIT-OFL.txt','docs/브랜드_폰트/SUIT/LICENSE_OFL.txt'],['InterTight-OFL.txt','docs/브랜드_폰트/InterTight/OFL.txt'],['DMMono-OFL.txt','docs/브랜드_폰트/DM_Mono/OFL.txt']].map(([name,p])=>({name,path:p,text:source(p)}));
source('docs/브랜드_폰트/SUIT/SUIT-Variable.woff2');
const textures={paper:source('docs/Loom_자산/구움/펠트_종이바탕.webp','image/webp'),dark:source('docs/Loom_자산/구움/펠트_어두운판.webp','image/webp')};
const placements=JSON.parse(source(`${kit}/배치명세.json`)).items;
const logos={};
for(const variant of ['Ink','Paper']){const p=placements.find(p=>p.brand==='SHIFT'&&p.variant===variant);const rel=`${kit}/${p.file}`;const uri=source(rel,'image/png');if(sources.get(rel).sha256!==p.sha256)throw new Error('Unverified logo source');logos[variant]={...p,uri,path:rel};}
const coverPath='docs/홍보물/새첫게시물_20260914/커버/yuhobuilds-youtube.png';
const cover=source(coverPath,'image/png');
const coverManifest=JSON.parse(source('docs/홍보물/새첫게시물_20260914/커버/명세.json'));
const coverEntry=coverManifest.outputs.find(x=>x.id==='yuhobuilds-youtube');
if(coverEntry.sha256!==sources.get(coverPath).sha256||coverEntry.brand!=='shift')throw new Error('YouTube cover source drift');
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const CSS=`${brandFont.면()}
@font-face{font-family:'Inter Tight';src:url('${fonts.inter}') format('truetype');font-weight:500;font-display:block}
@font-face{font-family:'Inter Tight';src:url('${fonts.interBold}') format('truetype');font-weight:700;font-display:block}
@font-face{font-family:'DM Mono';src:url('${fonts.mono}') format('truetype');font-weight:500;font-display:block}
@font-face{font-family:'DM Mono';src:url('${fonts.monoLight}') format('truetype');font-weight:300;font-display:block}
text{font-family:'Inter Tight','SUIT Variable',sans-serif;font-weight:500;letter-spacing:-.02em;font-synthesis:none}
.head{font-weight:800;letter-spacing:-.04em}.mono{font-family:'DM Mono',monospace;letter-spacing:.02em}
`;
let items=[],usedLogos=[];
function txt(lines,x,y,size=88,{color=C.Ink,head=false,leading=1.35,role='body',mono=false,anchor='start'}={}){if(!Array.isArray(lines))lines=[lines];return lines.map((str,i)=>{const id=`text-${items.length+1}`;items.push({id,text:str,size,role,color,head,mono});const content=mono?esc(str).replace(/\//g,'<tspan font-weight="300">/</tspan>'):head?esc(str).replace(/[A-Za-z0-9“”.,·…]+/g,s=>`<tspan font-family="Inter Tight" font-weight="700">${s}</tspan>`):esc(str);return `<text id="${id}" x="${x}" y="${y+i*size*leading}" font-size="${size}" fill="${color}" text-anchor="${anchor}" data-role="${role}" class="${head?'head':mono?'mono':''}">${content}</text>`;}).join('');}
function logo(variant,x=M,y=140,w=680){const a=logos[variant],h=w*a.height/a.width;usedLogos.push({path:a.path,sha256:a.sha256,x,y,width:w,height:h});return `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${a.uri}"/>`;}
function rule(y,color=C.Stone,x=M,w=W-2*M){return `<path d="M${x} ${y}h${w}" stroke="${color}" stroke-width="3" fill="none"/>`;}
function panel(x,y,w,h,fill=C.Paper){return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${fill}"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="url(#grain)" opacity=".18"/>`;}
function footer(n,dark){return rule(2520,dark?C['Deep Wool']:C.Stone)+txt('사업 방향과 협업 안내',M,2603,59,{color:dark?C.Stone:C['Deep Wool'],role:'footer'})+txt(`${String(n).padStart(2,'0')} / 07`,W-M,2603,58,{color:dark?C.Stone:C['Deep Wool'],mono:true,anchor:'end',role:'pagination'});}
const slides=[];
function slide(n,stem,title,mode,compose){items=[];usedLogos=[];const dark=mode==='dark',bg=dark?C['Ink Deep']:mode==='oat'?C.Oat:C.Paper;const body=compose()+footer(n,dark);const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}"><defs><style>${CSS}</style><pattern id="grain" width="2000" height="2000" patternUnits="userSpaceOnUse"><image href="${textures.paper}" width="2000" height="2000"/></pattern></defs><rect width="${W}" height="${H}" fill="${bg}"/><image width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" href="${dark?textures.dark:textures.paper}" opacity="${dark?'.50':'.23'}"/>${body}</svg>`;slides.push({n,stem,title,mode,svg,text:[...items],logos:[...usedLogos]});}
const visionLines=['개인과 조직의 성장이','서로의 기회가 되는','미래를 만듭니다.'];
const subLines=['국경과 환경을 넘어,','개인은 역량을 펼칠 무대를 만나고','조직은 준비된 인재와 함께','성장하는 세상을 지향합니다.'];
if(visionLines.join(' ')!==vision.headline||subLines.join(' ')!==vision.subtext)throw new Error('Official vision reflow differs');

slide(1,'비전','배운 것을 펼칠 곳. 함께 성장할 사람.','dark',()=>
  logo('Paper',M,175,1050)+
  txt(visionLines,M,925,143,{color:C.Paper,head:true,leading:1.32,role:'official-vision'})+
  rule(1670,C['Deep Wool'])+
  txt(['배운 것을 펼칠 곳.','함께 성장할 사람.'],M,1910,104,{color:C.Paper,leading:1.45})+
  txt('SYNK SHIFT가 만드는 연결',M,2330,72,{color:C.Stone})
);
slide(2,'기관교육','기관과 기업에는, 현장에서 쓰는 역량을.','paper',()=>
  logo('Ink')+
  txt(['기관과 기업에는,','현장에서 쓰는 역량을.'],M,590,122,{head:true,leading:1.25,role:'headline'})+
  txt(['기관 강의와 기업 컨설팅으로','현장이 일하는 방식을 함께 손봅니다.'],M,935,78,{role:'official-education'})+
  rule(1140)+
  txt('직원',M,1325,73,{color:C['Lapis Deep'],head:true,role:'speaker'})+
  txt('“다시 한 번 말씀해 주세요.”',M,1490,100,{head:true,role:'public-example'})+
  txt('관리자',M,1765,73,{color:C['Lapis Deep'],head:true,role:'speaker'})+
  txt(['“질문해도 괜찮습니다.','어떻게 진행할지','함께 확인해 볼까요?”'],M,1930,100,{head:true,leading:1.32,role:'public-example'})+
  txt('초안을 바탕으로 만든 공개용 예시',M,2435,69,{color:C['Deep Wool'],role:'status'})
);
slide(3,'브랜딩과광고','기업의 가치가 고객에게 전해지도록.','dark',()=>
  logo('Paper')+
  txt(['기업의 가치가','고객에게 전해지도록.'],M,590,122,{color:C.Paper,head:true,leading:1.25,role:'headline'})+
  txt(['브랜딩으로는 그 회사가 가진 가치를','고객에게 제대로 닿게 합니다.'],M,935,80,{color:C.Oat,role:'official-advertising'})+
  txt('브랜드의 비전에서, 실제 사용처로',M,1300,83,{color:C.Paper,head:true})+
  panel(M,1420,W-2*M,540)+
  `<svg x="${M+25}" y="1445" width="${W-2*M-50}" height="490" viewBox="508.125 508.75 1543.75 422.5"><image href="${cover}" width="2560" height="1440"/></svg>`+
  txt(['유호 YouTube 커버 · 중앙 표시 영역','SYNK 자체 제작 예시 / 커버 공개 반영'],M,2105,73,{color:C.Stone,leading:1.5,role:'status'})+
  txt('문구·배치·용도를 함께 맞춥니다.',M,2400,84,{color:C.Paper})
);
slide(4,'유학과취업','배운 것을 펼칠 기회까지 살피며.','oat',()=>
  logo('Ink')+
  txt(['배운 것을 펼칠','기회까지 살피며.'],M,575,122,{head:true,leading:1.25,role:'headline'})+
  txt(['유학부터 취업까지 교육기관과 기업을 이어,','배운 것을 펼칠 자리를 넓힙니다.'],M,920,76,{role:'official-connection'})+
  panel(M,1300,W-2*M,1060)+
  txt('준비 조건',M+65,1445,74,{head:true,color:C['Lapis Deep'],role:'field-label'})+
  txt('배우려는 분야 · 언어와 생활 준비',M+65,1570,88)+
  rule(1660,C.Stone,M+65,W-2*M-130)+
  txt('확인 담당',M+65,1810,74,{head:true,color:C['Lapis Deep'],role:'field-label'})+
  txt('교육기관 · 기업의 담당자',M+65,1935,88)+
  rule(2025,C.Stone,M+65,W-2*M-130)+
  txt('다음 단계',M+65,2170,74,{head:true,color:C['Lapis Deep'],role:'field-label'})+
  txt('필요 서류와 일정을 함께 확인',M+65,2295,88)+
  txt('지원 준비 지면 예시 · 기관별 실제 조건 확인 필요',M,2440,68,{color:C['Deep Wool'],role:'status'})
);
slide(5,'협업의첫질문','맡을 일부터 구체적으로 이야기합니다.','dark',()=>
  logo('Paper')+
  txt(['그래서, 맡을 일부터','구체적으로 이야기합니다.'],M,590,119,{color:C.Paper,head:true,leading:1.25,role:'headline'})+
  txt('기관·기업',M,1115,79,{head:true,color:C['Lapis Soft']})+
  txt(['어떤 업무가','달라져야 하나요?'],M,1290,115,{color:C.Paper,leading:1.28})+
  rule(1605,C['Deep Wool'])+
  txt('개인',M,1785,79,{head:true,color:C['Lapis Soft']})+
  txt(['어떤 배움을','어디에서 펼치고 싶나요?'],M,1960,115,{color:C.Paper,leading:1.28})+
  txt('그다음, 범위 · 담당 · 조건 · 다음 단계',M,2410,80,{color:C.Oat})
);
slide(6,'현재준비','지금은 이렇게 준비하고 있습니다.','paper',()=>
  logo('Ink')+
  txt(['지금은 이렇게','준비하고 있습니다.'],M,590,122,{head:true,leading:1.25,role:'headline'})+
  txt(['자체 제작물과 교육·지원 설계를','만들고 확인합니다.'],M,945,88)+
  rule(1210)+
  txt('교육·지원 설계',M,1370,74,{head:true,color:C['Lapis Deep']})+
  txt(['관리자 연수 아웃라인','첫 30일 체크리스트'],M,1520,103,{head:true,leading:1.34})+
  txt('현재 초안 / 연수 운영 성과와 구분',M,1830,73,{color:C['Deep Wool'],role:'status'})+
  rule(1890)+
  txt('유호의 개인 채널',M,2035,74,{head:true,color:C['Lapis Deep']})+
  txt(['AI와 회사를 만드는 과정은','유호 채널에서 별도로 나눕니다.'],M,2185,89,{leading:1.36})+
  txt('서비스별 시작 여부와 맡는 범위는 별도 안내합니다.',M,2455,68,{color:C['Deep Wool'],role:'status'})
);
slide(7,'함께성장할미래','국경과 환경을 넘어, 함께 성장할 미래.','dark',()=>
  logo('Paper',M,180,970)+
  txt(subLines,M,1035,105,{color:C.Paper,head:true,leading:1.48,role:'official-subtext'})+
  rule(1890,C['Deep Wool'])+
  txt(['올바른 가치관과 탄탄한 역량이','기회를 만나도록,','개인과 조직을 연결합니다.'],M,2095,83,{color:C.Oat,leading:1.44,role:'official-philosophy'})
);

const alts=[
  '어두운 펠트 바탕의 공식 SYNK SHIFT 로고. 공식 비전 “개인과 조직의 성장이 서로의 기회가 되는 미래를 만듭니다.” 아래에 “배운 것을 펼칠 곳. 함께 성장할 사람.”이라고 적혀 있다. 기관과 기업, 개인의 연결을 소개하는 7장 중 표지다.',
  '기관과 기업에는 현장에서 쓰는 역량을. 기관 강의와 기업 컨설팅으로 현장의 역량과 일하는 방식을 발전시킨다는 방향. 교육 예시에서 직원은 “다시 한 번 말씀해 주세요.”라고 말하고 관리자는 “질문해도 괜찮습니다. 어떻게 진행할지 함께 확인해 볼까요?”라고 답한다. 초안을 바탕으로 만든 공개용 예시라고 명시했으며 실제 교육생의 대화나 연수 성과가 아니다.',
  '기업의 가치가 고객에게 전해지도록. “브랜딩과 광고로 기업의 가치를 알리고, 고객과 연결합니다.”라는 공식 부연 아래에 이번에 자체 제작한 유호 YouTube 커버의 중앙 표시 영역을 보여 준다. 커버에는 SHIFT 비전과 개인 채널의 문구가 들어 있다. SYNK 자체 제작 예시이며 커버 공개 반영이라고 명시한다. 이 카드에는 게시 화면 캡처가 아닌 커버 원본을 담았다. 고객 납품이나 광고 성과를 보여 주는 화면이 아니다.',
  '배운 것을 펼칠 기회까지 살피며. 유학부터 취업까지 교육기관과 기업을 연결하는 방향 아래에 준비 지면 예시가 있다. 준비 조건은 배우려는 분야와 언어·생활 준비, 확인 담당은 교육기관과 기업 담당자, 다음 단계는 필요 서류와 일정을 함께 확인하는 것이다. 기관별 실제 조건을 확인해야 하며 특정 학교·기업의 입학이나 채용을 보장하지 않는다.',
  '맡을 일부터 구체적으로 이야기합니다. 기관과 기업에는 “어떤 업무가 달라져야 하나요?”, 개인에게는 “어떤 배움을 어디에서 펼치고 싶나요?”라고 묻는다. 그다음 확인할 것은 범위, 담당, 조건, 다음 단계다. 답을 제출받는 인터랙티브 화면이 아닌 정적인 협업 안내다.',
  '현재는 자체 제작물과 교육·지원 설계를 만들고 확인한다는 설명. 관리자 연수 아웃라인과 첫 30일 체크리스트는 현재 초안이며 연수 운영 성과와 구분한다. AI와 회사를 만드는 과정은 유호 개인 채널에서 별도로 나눈다. 서비스별 시작 여부와 맡는 범위는 별도로 안내한다고 표시했다.',
  '공식 SYNK SHIFT 로고 아래 승인 서브텍스트 전문: “국경과 환경을 넘어, 개인은 역량을 펼칠 무대를 만나고 조직은 준비된 인재와 함께 성장하는 세상을 지향합니다.” 아래에 공식 철학 “올바른 가치관과 탄탄한 역량이 기회를 만나도록, 개인과 조직을 연결합니다.”를 싣고 마무리한다.'
];
const post=`# 배운 것을 펼칠 곳. 함께 성장할 사람.\n\n> SYNK SHIFT 회사 소개 게시물 · 로컬 제작본 · 미게시\n> 기관·기업 협업 상대에게 회사의 방향을 설명하는 7장입니다. 유호 개인 채널 소개나 계정 커버 변경 작업이 아닙니다.\n\n## 한국어 게시 본문\n\n${vision.headline}\n\nSYNK SHIFT는 ${philosophy}\n\n${education} ${advertising} ${connection}\n\n협업의 출발점은 구체적인 일입니다. 조직은 어떤 업무가 달라져야 하는지, 개인은 어떤 배움을 어디에서 펼치고 싶은지. 그다음 맡을 범위와 담당, 확인할 조건과 다음 단계를 정리합니다.\n\n두 번째 장은 첫 30일 체크리스트 초안을 바탕으로 만든 공개용 예시입니다. 직원은 “다시 한 번 말씀해 주세요.”라고 말하고, 관리자는 “질문해도 괜찮습니다. 어떻게 진행할지 함께 확인해 볼까요?”라고 응답합니다. 실제 교육생의 대화·연수 후기나 효과 검증 결과가 아닙니다.\n\n세 번째 장은 이번 SYNK 자체 제작물인 유호 YouTube 커버의 중앙 표시 영역입니다. SHIFT의 공식 비전과 개인 채널의 설명을 사용처에 맞춰 배치했습니다. 해당 커버는 유호 YouTube 채널에 공개 반영했습니다. 이 카드에는 게시 화면 캡처가 아닌 자체 제작 원본의 중앙 영역을 담았습니다. 고객 납품·광고 성과를 보여 주는 자료가 아닙니다. 네 번째 장은 준비 조건·담당·다음 단계를 정리하는 지원 준비 지면 예시이며, 실제 학교·기업의 조건은 따로 확인해야 합니다.\n\n현재는 자체 제작물과 교육·지원 설계를 만들고 확인하고 있습니다. AI와 회사를 만드는 과정은 유호 채널에서 별도로 나눕니다. 서비스별 시작 여부·계약·지원 범위는 실제 준비 상태에 맞춰 별도로 안내합니다. 소개한 방향이 입학·취업이나 사업 성과를 보장하는 것은 아닙니다.\n\n${vision.subtext}\n\n## 제작·게시 경계\n\n- 이 파일과 카드 7장은 새 첫 게시물 제작본입니다. 이전 첫 게시물의 원고·표지·영상은 재사용하지 않았습니다. 현재 승인 로고·폰트·재질과 이번 신규 커버 실물만 가져왔습니다.\n- 직원·관리자 문장은 이전 초안의 그대로인 인용이 아니라, 초안의 관점을 바탕으로 새로 만든 공개용 예시입니다. 관리자 연수 자체는 현재 초안으로 구분합니다.\n- 게시 대상 계정·실제 업로더 형식·게시 화면·외부 고객 반응은 확인하지 않았습니다. 신규 신청·계약·상담 응답시간을 약속하지 않습니다.\n- 공개 댓글에 개인 정보나 비공개 업무 자료를 받는 요청을 붙이지 않았습니다. 이 정적 캐러셀을 사용자 선택에 따라 바뀌는 인터랙티브 콘텐츠로 부르지 않습니다.\n`;

async function build(){
  fs.mkdirSync(path.join(__dirname,'qa'),{recursive:true});
  fs.mkdirSync(path.join(__dirname,'licenses'),{recursive:true});
  for(const license of fontLicenses) fs.writeFileSync(path.join(__dirname,'licenses',license.name),license.text);
  const {chromium}=require('C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:1});
  const manifest={title:'배운 것을 펼칠 곳. 함께 성장할 사람.',brand:'SYNK SHIFT',status:'local-rendered-unpublished',builtAt:new Date().toISOString(),canvas:{width:W,height:H},mobile:{width:390,height:488,method:'local browser SVG render; not a platform upload preview'},officialCopy:{vision:vision.headline,subtext:vision.subtext,philosophy,education,advertising,connection},coverExample:{source:coverPath,sourceSha256:sources.get(coverPath).sha256,scope:'same new local source image shown through its central viewport; no retouch; source cover publicly applied to Yuho YouTube as verified by main agent; this carousel unpublished; not a live screenshot or customer result',crop:coverEntry.qa.safeArea},imageGeneration:'none; new deterministic editorial composition with approved assets',published:false,livePlatformVerified:false,customerPerformanceVerified:false,approval:'not inferred',sources:[...sources.values()],slides:[]};
  for(const s of slides){
    const name=String(s.n).padStart(2,'0')+'-'+s.stem;
    const html=`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(s.title)}</title><style>${loom.css({지면:'부품만'})}\nhtml,body{margin:0;padding:0;width:100%;background:${C.Paper}}body>svg{display:block;width:100%;height:auto}</style>${s.svg}</html>`;
    fs.writeFileSync(path.join(__dirname,name+'.svg'),s.svg);fs.writeFileSync(path.join(__dirname,name+'.html'),html);
    await page.setViewportSize({width:W,height:H});await page.goto(pathToFileURL(path.join(__dirname,name+'.html')).href);
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(x=>x.decode().catch(()=>{})));});
    const boxes=await page.locator('svg text').evaluateAll(nodes=>nodes.map(el=>{const b=el.getBoundingClientRect();return {id:el.id,text:el.textContent,x:b.x,y:b.y,width:b.width,height:b.height};}));
    const overflow=boxes.filter(b=>b.x<0||b.y<0||b.x+b.width>2160||b.y+b.height>2700);if(overflow.length)throw new Error(name+' text overflow '+JSON.stringify(overflow));
    await page.screenshot({path:path.join(__dirname,name+'.png'),animations:'disabled'});
    const cdp=await page.context().newCDPSession(page);await cdp.send('DOM.enable');await cdp.send('CSS.enable');const {root}=await cdp.send('DOM.getDocument');const actualFonts=[];
    for(const selector of ['text[data-role="headline"]','text[data-role="official-vision"]','text[data-role="official-subtext"]','text[data-role="official-philosophy"]','text[data-role="body"]','text[data-role="pagination"]']){const node=await cdp.send('DOM.querySelector',{nodeId:root.nodeId,selector});if(node.nodeId){const f=await cdp.send('CSS.getPlatformFontsForNode',{nodeId:node.nodeId});actualFonts.push({selector,fonts:f.fonts});}}
    await cdp.detach();await page.setViewportSize({width:390,height:488});await page.screenshot({path:path.join(__dirname,'qa',name+'-390.png'),animations:'disabled'});
    manifest.slides.push({number:s.n,title:s.title,png:name+'.png',html:name+'.html',svg:name+'.svg',mobileQA:'qa/'+name+'-390.png',sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,name+'.png'))).digest('hex'),alt:alts[s.n-1],mode:s.mode,text:s.text,textBBoxes:boxes,logos:s.logos,actualFonts,overflow});
    process.stdout.write(name+': rendered 2160x2700 and 390px\n');
  }
  await browser.close();
  // Read-only source audit: do not silently freeze a concurrently changed input.
  const changedSources=[...sources.values()].filter(s=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,s.path))).digest('hex')!==s.sha256);manifest.sourceDriftAtEnd=changedSources.map(x=>x.path);
  fs.writeFileSync(path.join(__dirname,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  fs.writeFileSync(path.join(__dirname,'게시문.md'),post);
  fs.writeFileSync(path.join(__dirname,'대체텍스트.md'),'# 이미지 대체 텍스트\n\n'+alts.map((s,i)=>`## ${i+1}장\n\n${s}\n`).join('\n'));
  fs.writeFileSync(path.join(__dirname,'index.html'),`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SYNK SHIFT · 배운 것을 펼칠 곳</title><style>${CSS}body{margin:0;padding:32px;background:${C.Oat};color:${C.Ink};font-family:'Inter Tight','SUIT Variable',sans-serif}main{max-width:1260px;margin:auto}h1{font-size:32px;font-weight:800;letter-spacing:-.04em}p{line-height:1.65}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px}figure{margin:0}img{width:100%;display:block}figcaption{padding:16px 0 24px}a{color:inherit}</style><main><h1>배운 것을 펼칠 곳. 함께 성장할 사람.</h1><p>SYNK SHIFT 회사 소개 · 2160×2700 · 7장<br>로컬 제작본 / 미게시. 교육과 지원은 공개용 예시이며 고객 성과가 아닙니다.</p><p><a href="게시문.md">한국어 본문</a> · <a href="대체텍스트.md">대체 텍스트</a> · <a href="검증결과.md">제작·검증 결과</a></p><section>${manifest.slides.map(s=>`<figure><a href="${s.html}"><img src="${s.png}" alt="${esc(s.alt)}"></a><figcaption>${s.number}. ${esc(s.title)} · <a href="${s.svg}">SVG</a></figcaption></figure>`).join('')}</section></main></html>`);
  process.stdout.write('DONE: '+slides.length+' cards. Source drift: '+changedSources.length+'. Manual image review required.\n');
}
build().catch(e=>{console.error(e);process.exitCode=1;});
