const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../../..');
const RUNTIME = 'C:/Users/q1212/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const sharp = require(path.join(RUNTIME, 'sharp'));
const { chromium } = require(path.join(RUNTIME, 'playwright'));
const loom = require(path.join(ROOT, 'tools/lib/loom.js'));
const mascot = require(path.join(ROOT, 'tools/lib/마스코트자산.js'));
const tokens = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/디자인_토큰.json'), 'utf8'));
const palette = Object.fromEntries(tokens.색.킷.map(c => [c.이름,c.hex]));
const P = palette.Paper, I=palette.Ink, O=palette.Oat, D=palette['Deep Wool'], C=palette['Coral 3'];
const files = {logo:'docs/홍보물/마케팅실행_20260909/브랜드킷/배치용/SYNK-LAB-Ink.png',notebook:'docs/Loom_자산/구움/공방_공책과연필.avif',marin:mascot.마린경로('좌34',{누끼:true})};
const assetHashes = {};
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const output = (p,s) => { const f=path.join(__dirname,p); fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,s); };
async function prepare() {
  for(const [key,rel] of Object.entries(files)){
    const source=fs.readFileSync(path.join(ROOT,rel)); assetHashes[key]={source:rel,sha256:hash(source)};
    // Format conversion / proportional scaling only. Original alpha and artwork are preserved.
    const b=await sharp(source).resize({width:key==='marin'?1800:1800,withoutEnlargement:true}).png().toBuffer(); output(`assets/${key}.png`,b);
  }
  const fabric=loom.기본천();
  const match=fabric&&fabric.match(/base64,([^)]*)/);
  if(match) { const b=Buffer.from(match[1].replace(/["']/g,''),'base64'); output('assets/fabric.png',await sharp(b).png().toBuffer()); }
  output('assets/loom.css',loom.css({지면:'캐러셀'}));
  for(const [f,rel] of Object.entries({
    'suit.woff2':'docs/브랜드_폰트/SUIT/SUIT-Variable.woff2',
    'inter-medium.ttf':'docs/브랜드_폰트/InterTight/InterTight-Medium.ttf',
    'inter-bold.ttf':'docs/브랜드_폰트/InterTight/InterTight-Bold.ttf',
    'mono.ttf':'docs/브랜드_폰트/DM_Mono/DMMono-Medium.ttf',
    'SUIT-OFL.txt':'docs/브랜드_폰트/SUIT/LICENSE_OFL.txt',
    'InterTight-OFL.txt':'docs/브랜드_폰트/InterTight/OFL.txt',
    'DMMono-OFL.txt':'docs/브랜드_폰트/DM_Mono/OFL.txt'
  })) { const b=fs.readFileSync(path.join(ROOT,rel));output('assets/'+f,b);assetHashes[f]={source:rel,sha256:hash(b)}; }
  output('assets/provenance.json',JSON.stringify(assetHashes,null,2));
}
const esc=s=>String(s).replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const data=f=>{const ext=path.extname(f);return `data:${ext==='.png'?'image/png':ext==='.woff2'?'font/woff2':'font/ttf'};base64,${fs.readFileSync(path.join(__dirname,'assets',f)).toString('base64')}`;};
function lines(x,y,rows,size=56,lang='ko',weight=500,fill=I,leading=1.23){return rows.map((s,n)=>`<text data-copy="1" x="${x}" y="${y+n*size*leading}" class="${lang}" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(s)}</text>`).join('');}
function picture(key,x,y,w,h){return `<image data-synk-mascot="${key==='marin'?'마린':''}" href="${data(key+'.png')}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet" ${key==='notebook'?'style="mix-blend-mode:multiply"':''}/>`;}
const rule=(y,x=64,w=952)=>`<path d="M${x} ${y}h${w}" stroke="${D}" stroke-opacity=".3" stroke-width="2"/>`;
function sketch(kind,x,y,w=360){
  let art='';
  if(kind==='game')art=`<path d="M35 169V58L163 25l159 54v110l-125 55L35 169z M35 58l162 61 125-40 M197 119v125 M79 151l117 44 80-34 M111 99v39l34 13v-39z M222 125v36l34-13v-35z"/><path d="M170 157l28-9 35 13-31 13z" fill="${O}"/>`;
  if(kind==='video')art=`<rect x="25" y="42" width="300" height="190" rx="8"/><path d="M25 73h300M25 200h300 M81 42v31m58-31v31m58-31v31m58-31v31 M81 200v32m58-32v32m58-32v32m58-32v32 M65 176l65-70 47 44 40-30 64 56"/><circle cx="252" cy="108" r="15"/>`;
  if(kind==='draw')art=`<path d="M101 92h133v69c0 58-133 58-133 0z M234 108h24c45 0 42 62-24 60 M78 220h185 M139 65c-24-26 22-31 0-57 M184 64c-23-27 23-32 0-57"/><path d="M52 227l-8 34 34-12L299 28 274 4z M53 226l25 23 M265 13l25 24"/>`;
  return `<g transform="translate(${x} ${y}) scale(${w/360})"><path d="M0 0h360v270H0z" fill="${P}"/><g fill="none" stroke="${I}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${art}</g></g>`;
}
function base(id,body,parent=false){
  const n=Number(id.slice(-2)), total=parent?4:6;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350" role="img" aria-labelledby="title-${id}" lang="mn"><title id="title-${id}">${esc(alts[id].mn)}</title><defs><style>
  @font-face{font-family:'SUIT Variable';src:url('${data('suit.woff2')}') format('woff2');font-weight:100 900}
  @font-face{font-family:'Inter Tight';src:url('${data('inter-medium.ttf')}') format('truetype');font-weight:500}
  @font-face{font-family:'Inter Tight';src:url('${data('inter-bold.ttf')}') format('truetype');font-weight:700}
  @font-face{font-family:'DM Mono';src:url('${data('mono.ttf')}') format('truetype');font-weight:500}
  text{font-family:'Inter Tight','SUIT Variable',sans-serif;letter-spacing:-.02em} .ko{font-family:'Inter Tight','SUIT Variable',sans-serif} .mn{font-family:'Inter Tight','SUIT Variable',sans-serif} .mono{font-family:'DM Mono';letter-spacing:.02em} 
  </style><pattern id="cloth" width="240" height="240" patternUnits="userSpaceOnUse"><image href="${data('fabric.png')}" width="240" height="240"/></pattern></defs>
  <rect width="1080" height="1350" fill="${P}"/><rect width="1080" height="1350" fill="url(#cloth)" opacity=".085"/>
  ${picture('logo',64,52,300,92)}${lines(902,112,[String(n).padStart(2,'0')+'/'+String(total).padStart(2,'0')],32,'mono',500,D)}
  ${body}${rule(1248)}${lines(64,1298,[parent?'Гэр бүлээрээ ярилцах нь':'Солонгосоор хэлж үзье'],32,'mn',500,D)}
  </svg>`;
}
const alts={
  'student-01':{ko:'SYNK LAB 공식 로고와 비전: 가고 싶은 방향에 집중할 수 있는 환경을 만듭니다. 몽골어로 해보고 싶은 일을 한국어로 말해 보자는 안내. 아래에는 게임 공간의 예시 스케치와 코랄색 공책·연필이 놓여 있습니다.',mn:'SYNK LAB-ийн лого, солонгос хэлээр бичсэн алсын хараа. Хийж үзмээр зүйлээ солонгосоор хэлж үзэхийг урьсан тайлбарын доор тоглоом доторх орон зайн жишээ зураг, дэвтэр, харандаа байна.'},
  'student-02':{ko:'학습용 예시 대화. 대화 상대가 어떤 전공을 배우고 싶어요?라고 묻습니다. 몽골어 뜻과 아직 결정하지 않았다면 이렇게 말할 수 있다는 안내가 있습니다.',mn:'Сургалтын жишээ яриа. Ярилцаж буй хүн «어떤 전공을 배우고 싶어요?» гэж асууна. Утга нь «Ямар мэргэжлээр сурахыг хүсэж байна вэ?». Шийдээгүй байгаа бол дараагийн өгүүлбэрийг хэлж болно.'},
  'student-03':{ko:'아직 정하지 않았어요. 몽골어 뜻: Одоохондоо шийдээгүй байна. 그다음 해보고 싶은 일을 말해 보라는 안내. 오른쪽 마린의 말풍선은 계획을 확인했다, 바꾸어도 된다는 뜻입니다.',mn:'«아직 정하지 않았어요.» — Одоохондоо шийдээгүй байна. Дараа нь хийж үзмээр байгаа зүйлээ хэлээрэй. Марин: «Төлөвлөгөөг шалгав. …Өөрчилж болно.»'},
  'student-04':{ko:'먼저 게임을 만들어 보고 싶어요, 영상을 만들어 보고 싶어요, 그림을 그려 보고 싶어요라는 한국어 예문과 몽골어 뜻. 각 문장 옆에 게임 공간·영상 장면·그림 소품 스케치가 있습니다.',mn:'Хийж үзмээр зүйлээ хэлэх гурван жишээ: «먼저 게임을 만들어 보고 싶어요.» — эхлээд тоглоом хийж үзмээр байна; «영상을 만들어 보고 싶어요.» — видео хийж үзмээр байна; «그림을 그려 보고 싶어요.» — зураг зурж үзмээр байна.'},
  'student-05':{ko:'빈칸 연습: 아직 정하지 않았어요. 먼저 ______ 보고 싶어요. 게임을 만들어 부분 전체를 영상을 만들어 또는 그림을 그려로 바꿉니다. 세 구절 중 하나를 빈칸에 넣고 문장 전체를 말합니다. 혼자 소리 내어 말할 수 있으며 댓글이나 목소리 공개는 필요 없습니다.',mn:'Өөрийн өгүүлбэрээ хэлж үзье: «아직 정하지 않았어요. 먼저 ______ 보고 싶어요.» “게임을 만들어” гэдэг хэсгийг бүхэлд нь “영상을 만들어” эсвэл “그림을 그려” гэж солино. Ганцаараа чангаар хэлж болно. Сэтгэгдэл бичих, дуу хоолойгоо нийтлэх шаардлагагүй.'},
  'student-06':{ko:'말한 뒤 직접 해볼 작은 일을 고르는 카드. 게임 장면 하나 그리기, 짧은 영상 한 장면 찍기, 좋아하는 물건 그리기. LAB은 이런 선택을 다음 배움과 경험에 잇는 경로를 연구합니다.',mn:'Дараа нь хийж үзэх нэг жижиг зүйлээ сонгоорой: тоглоомын нэг хэсгийг зурах, богино видеоны нэг хэсгийг бичиж авах, дуртай эд зүйлээ зурах. LAB ийм сонголтыг дараагийн сурах зүйл, туршлагатай холбох замыг судалдаг.'},
  'guardian-01':{ko:'보호자용 카드 표지. SYNK LAB 공식 비전 아래 전공을 고르기 전, 자녀가 무엇을 해보고 싶은지 묻습니다. 노트와 작은 게임 공간 예시 스케치가 있습니다.',mn:'SYNK LAB-ийн алсын хараа, гэр бүлээрээ ярилцах сэдэв: Мэргэжлээ сонгохоос өмнө хүүхэд тань юу хийж үзмээр байна вэ? Дэвтэр болон тоглоом доторх орон зайн жишээ зураг байна.'},
  'guardian-02':{ko:'자녀가 아직 결정하지 않았다면 요즘 직접 해보고 싶은 일은 무엇인지 물으며 대화를 이어갑니다. 자녀의 관심을 자녀 자신의 말로 들어 보라는 안내입니다.',mn:'Хүүхэд тань сонголтоо хараахан хийгээгүй бол «Сүүлийн үед өөрөө юу хийж үзмээр санагдаж байна вэ?» гэж асуугаарай. Хүүхдийнхээ сонирхлыг өөрийнх нь үгээр сонсоорой.'},
  'guardian-03':{ko:'학생이 고를 일: 그림 한 장, 짧은 영상 한 장면, 게임 속 공간 하나. 직접 해본 뒤 무엇이 재미있었고 더 해보고 싶은지 대화합니다. 한 번의 활동으로 전공이나 적성을 판정하지 않습니다.',mn:'Хүүхэд өөрөө сонгох зүйл: зураг зурах, богино видео хийж үзэх, тоглоомын нэг хэсгийг зурах. Хийж үзсэний дараа үргэлжлүүлмээр байгаа эсэхийг нь ярилцана. Нэг удаагийн ажлаар мэргэжлийг нь шийдэхгүй.'},
  'guardian-04':{ko:'가족이 함께 확인할 네 항목: 배울 내용, 생활 조건, 비용, 준비할 것과 요구 조건. 학교와 과정을 비교할 때 공식 정보를 함께 확인합니다.',mn:'Гэр бүлээрээ хамт шалгах зүйл: сурах агуулга, амьдрах нөхцөл, зардал, бэлтгэх зүйл ба шаардлага. Сургууль, хөтөлбөрийг харьцуулахдаа албан ёсны мэдээллээс хамт шалгана.'}
};
function cards(){ return [
['student-01',
  lines(64,260,['가고 싶은 방향에','집중할 수 있는','환경을 만듭니다.'],74,'ko',800)+
  lines(64,586,['Хийж үзмээр зүйлээ','солонгосоор хэлж үзье.'],58.24,'mn',700)+
  picture('notebook',535,736,500,500)+sketch('game',82,856,425)+lines(64,768,['Сургалтын жишээ'],34,'mn',500,D)],
['student-02',
  lines(64,224,['Сургалтын жишээ яриа'],42,'mn',500,D)+
  `<rect x="64" y="278" width="952" height="570" rx="16" fill="${O}"/>`+
  lines(104,352,['대화 상대 · Ярилцаж буй хүн'],34,'ko',500,D)+
  lines(104,465,['어떤 전공을','배우고 싶어요?'],78,'ko',800)+
  lines(104,691,['Ямар мэргэжлээр','сурахыг хүсэж байна вэ?'],53.04,'mn',500)+
  lines(64,997,['Шийдээгүй байгаа бол','ингэж хэлж болно.'],58.24,'mn',700)],
['student-03',
  lines(64,270,['아직 정하지','않았어요.'],92,'ko',800)+
  lines(64,566,['Одоохондоо','шийдээгүй байна.'],60.32,'mn',500)+
  lines(64,810,['Дараа нь хийж үзмээр','байгаа зүйлээ хэлээрэй.'],48.88,'mn',500)+
  `<path d="M64 969h526v76l65 44-65-14v61H64z" fill="${O}"/>`+
  lines(96,1035,['Төлөвлөгөөг шалгав.','…Өөрчилж болно.'],44.72,'mn',500)+picture('marin',608,858,408,408)],
['student-04',
  lines(64,225,['해보고 싶은 일을 말해요.'],54,'ko',800)+
  lines(64,292,['Хийж үзмээр зүйлээ хэлээрэй.'],43.68,'mn',500,D)+
  sketch('game',64,382,250)+lines(354,418,['먼저 게임을 만들어','보고 싶어요.'],53,'ko',800)+lines(354,573,['Эхлээд тоглоом','хийж үзмээр байна.'],43.68,'mn',500)+rule(677)+
  sketch('video',64,714,250)+lines(354,744,['영상을 만들어','보고 싶어요.'],53,'ko',800)+lines(354,899,['Видео хийж үзмээр байна.'],43.68,'mn',500)+rule(963)+
  sketch('draw',77,1023,202)+lines(354,1037,['그림을 그려 보고 싶어요.'],49,'ko',800)+lines(354,1135,['Зураг зурж үзмээр байна.'],43.68,'mn',500)],
['student-05',
  lines(64,224,['Өөрийн өгүүлбэрээ','хэлж үзье.'],64.48,'mn',700)+
  `<rect x="64" y="396" width="952" height="275" rx="16" fill="${O}"/>`+
  lines(96,473,['아직 정하지 않았어요.','먼저 ______ 보고 싶어요.'],61,'ko',800)+
  lines(64,740,['“게임을 만들어” гэдэг хэсгийг'],43.68,'mn',500)+
  lines(64,795,['бүхэлд нь солино.'],43.68,'mn',700)+
  lines(64,880,['게임을 만들어','영상을 만들어','그림을 그려'],50,'ko',800,C,1.35)+
  lines(535,880,['Гурван хэсгээс нэгийг','хоосон зайд оруулаад,','бүтнээр нь хэлээрэй.'],42.64,'mn',500, I,1.33)+
  lines(64,1125,['Ганцаараа чангаар хэлж болно.','Сэтгэгдэл, дуу хоолойгоо нийтлэх','шаардлагагүй.'],40.56,'mn',500,D,1.25)],
['student-06',
  lines(64,233,['Дараа нь хийж үзэх','нэг жижиг зүйлээ','сонгоорой.'],64.48,'mn',700)+
  lines(64,516,['말한 뒤, 직접 해볼 작은 일'],42,'ko',500,D)+
  sketch('game',64,592,220)+lines(321,621,['게임 장면 하나 그리기'],50,'ko',800)+lines(321,691,['Тоглоомын нэг хэсгийг зурах'],42.64,'mn',500)+
  sketch('video',64,783,220)+lines(321,809,['짧은 영상 한 장면 찍기'],50,'ko',800)+lines(321,879,['Богино видеоны нэг хэсгийг','бичиж авах'],42.64,'mn',500)+
  sketch('draw',78,955,190)+lines(321,1019,['좋아하는 물건 그리기'],50,'ko',800)+lines(321,1089,['Дуртай эд зүйлээ зурах'],42.64,'mn',500)+
  lines(64,1160,['LAB нь ийм сонголтыг дараа нь юу сурч,','юу хийж үзэхтэй холбох арга замыг судалдаг.'],37.44,'mn',500,D,1.3)],
['guardian-01',
  lines(64,233,['가고 싶은 방향에 집중할 수 있는','환경을 만듭니다.'],49,'ko',800)+
  lines(64,474,['Мэргэжлээ сонгохоос өмнө:'],53.04,'mn',500,D)+
  lines(64,581,['хүүхэд тань юу','хийж үзмээр','байна вэ?'],80.08,'mn',700)+
  sketch('game',75,974,315)+picture('notebook',585,826,420,420)],
['guardian-02',
  lines(64,230,['Сонголтоо хараахан','хийгээгүй байгаа бол…'],56.16,'mn',500,D)+
  lines(64,489,['Сүүлийн үед','өөрөө юу хийж','үзмээр санагдаж','байна вэ?'],80.08,'mn',700)+
  rule(980)+lines(64,1071,['Хүүхдийнхээ сонирхлыг','өөрийнх нь үгээр сонсоорой.'],54.08,'mn',500)],
['guardian-03',
  lines(64,230,['Хүүхэд өөрөө','сонгох зүйл'],76.96,'mn',700)+
  sketch('draw',73,454,220)+lines(332,505,['Зураг зурах'],52,'mn',700)+
  sketch('video',64,650,230)+lines(332,710,['Богино видео','хийж үзэх'],52,'mn',700)+
  sketch('game',64,859,230)+lines(332,906,['Тоглоомын нэг','хэсгийг зурах'],52,'mn',700)+
  lines(64,1131,['Хийж үзсэний дараа үргэлжлүүлмээр','байгаа эсэхийг нь ярилцана.'],43.68,'mn',500,D)],
['guardian-04',
  lines(64,230,['Гэр бүлээрээ хамт','шалгах зүйл'],74.88,'mn',700)+
  lines(64,493,['Сурах агуулга'],62.4,'mn',700)+rule(557)+
  lines(64,656,['Амьдрах нөхцөл'],62.4,'mn',700)+rule(720)+
  lines(64,819,['Зардал'],62.4,'mn',700)+rule(883)+
  lines(64,982,['Бэлтгэх зүйл, шаардлага'],58.24,'mn',700)+
  lines(64,1111,['Сургууль, хөтөлбөрийг харьцуулахдаа','албан ёсны мэдээллээс хамт шалгана.'],43.68,'mn',500,D)]
].map(([id,body])=>({id,svg:base(id,body,id.startsWith('guardian'))}));}

async function build(){
  await prepare();
  const all=cards();
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:2});
  const qa=[];
  const fontEvidence=[];
  for(const card of all){
    const html=`<!doctype html><html lang="mn"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${card.id} · SYNK LAB</title><style>html,body{margin:0;background:${P}}svg{width:100%;height:auto;display:block}body{max-width:1080px;margin:auto}</style>${card.svg}</html>`;
    output('svg/'+card.id+'.svg',card.svg);output('html/'+card.id+'.html',html);
    await page.setContent(html,{waitUntil:'load'});
    await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.querySelectorAll('image')].map(async n=>{const i=new Image();i.src=n.getAttribute('href');await i.decode();}));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    const check=await page.evaluate(()=>{const texts=[...document.querySelectorAll('text')].map(n=>{const b=n.getBBox();return{text:n.textContent,box:{x:b.x,y:b.y,width:b.width,height:b.height}}});const overlaps=[];for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){const a=texts[i].box,b=texts[j].box;if(Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y)>1)overlaps.push([texts[i].text,texts[j].text]);}return{fonts:[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status})),overflow:texts.filter(o=>o.box.x<0||o.box.x+o.box.width>1080||o.box.y<0||o.box.y+o.box.height>1350),textOverlaps:overlaps,textCount:texts.length};});
    qa.push({id:card.id,...check});
    if(card.id==='student-02'){
      const session=await page.context().newCDPSession(page);await session.send('DOM.enable');await session.send('CSS.enable');
      const doc=await session.send('DOM.getDocument');
      for(const sel of ['text.ko','text.ko[font-weight="800"]','text.mn','text.mono']){const {nodeId}=await session.send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:sel});fontEvidence.push({selector:sel,...await session.send('CSS.getPlatformFontsForNode',{nodeId})});}
    }
    await page.screenshot({path:path.join(__dirname,'png',card.id+'.png'),fullPage:false});
  }
  await page.close();
  for(const card of all){await sharp(path.join(__dirname,'png',card.id+'.png')).resize({width:390}).png().toFile(path.join(__dirname,'preview-390',card.id+'.png'));}
  await browser.close();
  const thumbs=all.map((c,i)=>({input:path.join(__dirname,'preview-390',c.id+'.png'),left:(i%5)*414,top:Math.floor(i/5)*512}));
  await sharp({create:{width:2070,height:1024,channels:3,background:P}}).composite(thumbs).png().toFile(path.join(__dirname,'preview-390','contact-sheet.png'));
  output('qa.json',JSON.stringify({createdAt:new Date().toISOString(),screens:qa,fontEvidence,render:'Chromium 1080×1350 @2x; 390px proportional PNG preview (390×488)',visualReview:'See QA.md for direct image review; regenerated files require re-review'},null,2));
  output('alttext.json',JSON.stringify(alts,null,2));
  const draft=fs.readFileSync(path.join(ROOT,'docs/마케팅/전사새출발_20260914/LAB_몽골어_초안.md'),'utf8');
  const quoted=s=>s.split(/\r?\n/).filter(x=>x.startsWith('>')).map(x=>x.replace(/^> ?/,'')).join('\n').trim();
  const student=draft.split('## 5. 학생 게시 본문')[1].split('## 6. 보호자 첫 글')[0];
  const guardian=draft.split('## 6. 보호자 첫 글')[1].split('### 보호자 4장')[0];
  const official='가고 싶은 방향에 집중할 수 있는 환경을 만듭니다.';
  output('caption-student-mn.txt',official+'\n\n'+quoted(student.split('**몽골어**')[1])+'\n');
  output('caption-student-ko.txt',official+'\n\n'+quoted(student.split('**대응 한국어**')[1].split('**몽골어**')[0])+'\n');
  output('caption-guardian-mn.txt',official+'\n\n'+quoted(guardian.split('### 몽골어')[1])+'\n');
  output('caption-guardian-ko.txt',official+'\n\n'+quoted(guardian.split('### 대응 한국어')[1].split('### 몽골어')[0])+'\n');
  const manifest={createdAt:new Date().toISOString(),brand:'SYNK LAB',languageStatus:'Gemini AI 보완검토 완료·G16/S19 및 G22 한정 교정 반영, 원어민 감수 미완료',languageReviewReport:'docs/마케팅/전사새출발_20260914/LAB_몽골어_전체검토.md',publication:'not published',sourceBrief:'docs/마케팅/전사새출발_20260914/forge_B.md',translation:{path:'docs/마케팅/전사새출발_20260914/LAB_몽골어_초안.md',sha256:hash(fs.readFileSync(path.join(ROOT,'docs/마케팅/전사새출발_20260914/LAB_몽골어_초안.md')))},assets:assetHashes,cards:[]};
  for(const c of all){const f='png/'+c.id+'.png';const b=fs.readFileSync(path.join(__dirname,f));const m=await sharp(b).metadata();manifest.cards.push({id:c.id,png:f,width:m.width,height:m.height,bytes:b.length,sha256:hash(b),html:'html/'+c.id+'.html',svg:'svg/'+c.id+'.svg',preview:'preview-390/'+c.id+'.png',alttext:alts[c.id]});}
  manifest.sourceCanon=['docs/SYNK_철학.md','docs/비전_정본.md','docs/마케팅/전사새출발_20260914/forge_B.md','docs/마케팅/전사새출발_20260914/forge_gate.md','docs/마케팅/전사새출발_20260914/승인실물_제작브리프.md','docs/디자인_토큰.json'].map(p=>({path:p,sha256:hash(fs.readFileSync(path.join(ROOT,p)))}));
  manifest.captions=['caption-student-mn.txt','caption-student-ko.txt','caption-guardian-mn.txt','caption-guardian-ko.txt'].map(f=>({file:f,characters:fs.readFileSync(path.join(__dirname,f),'utf8').trim().length,sha256:hash(fs.readFileSync(path.join(__dirname,f)))}));
  output('manifest.json',JSON.stringify(manifest,null,2));
  output('index.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>LAB · 새 첫 게시물</title><style>body{background:${P};color:${I};font:18px system-ui;margin:32px}h1{font-size:28px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,390px));gap:24px}img{width:100%;display:block}a{color:inherit}p{line-height:1.6}</style><h1>LAB 학생 6장 · 보호자 4장</h1><p>몽골어 원어민 감수 전 제작 시안. 공개 게시하지 않았습니다.</p><div class="grid">${all.map(c=>`<a href="html/${c.id}.html"><img src="preview-390/${c.id}.png" alt="${esc(alts[c.id].ko)}"><p>${c.id} · 편집 가능한 HTML</p></a>`).join('')}</div></html>`);
  console.log(JSON.stringify({cards:manifest.cards.length,overflow:qa.flatMap(q=>q.overflow.map(x=>({id:q.id,...x}))),fonts:fontEvidence},null,2));
}
for(const d of ['png','preview-390','html','svg'])fs.mkdirSync(path.join(__dirname,d),{recursive:true});
(process.argv.includes('--prepare')?prepare():build()).catch(e=>{console.error(e);process.exitCode=1});
