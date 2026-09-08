'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../../..');
const 브랜드폰트=require(path.join(root,'tools/lib/브랜드폰트.js'));
const tokens=require(path.join(root,'docs/디자인_토큰.json'));
const 색=name=>tokens.색.킷.find(x=>x.이름===name).hex;
const pair=(kr,mn,cl='')=>`<div class="pair ${cl}"><div class="kr">${kr}</div><div class="mn">${mn}</div></div>`;
const label=s=>`<div class="label">${s}</div>`;
const title=s=>`<h1>${s}</h1>`;
const note=s=>`<div class="note">${s}</div>`;
const cards=[
 {kind:'cover',body:label('НЭГ ҮГ · ӨӨР УТГА')+title('<span class="kr">괜찮아요.</span>')+`<div class="hook">Кофе уумаар байна.<br>Та юу гэж хариулах вэ?</div>`+pair('커피 드릴까요?','Кофе өгөх үү?')+`<div class="choices"><div class="kr">A&nbsp; 괜찮아요.</div><div class="kr">B&nbsp; 네, 주세요.</div></div>`},
 {kind:'answer',body:label('КОФЕ АВАХ')+title('Авмаар байвал — B.')+pair('네, 주세요.','Тийм ээ, өгөөч.','hero')+note('Зөвхөн «괜찮아요» гэж хэлбэл<br>татгалзаж байгаа мэт сонсогдож болно.')},
 {kind:'dialogue',body:label('ЭЕЛДГЭЭР ТАТГАЛЗАХ')+title('Энэ удаа<br>кофе уухгүй.')+pair('커피 드릴까요?','Кофе өгөх үү?')+pair('아니요, 괜찮아요.','Үгүй ээ, зүгээр.','reply')+pair('감사합니다.','Баярлалаа.','small')},
 {kind:'dialogue',body:label('САНАА АМРААХ')+title('Найз тань ширээн дээр<br>ус асгачихлаа.')+pair('미안해요.','Уучлаарай.')+pair('괜찮아요.<br>닦으면 돼요.','Зүгээр ээ.<br>Арччихвал болно.','reply')},
 {kind:'compare',body:label('ӨМНӨХ ҮГИЙГ НЬ СОНСООРОЙ')+title('Ижил үг.<br>Өөр нөхцөл.')+`<div class="comparison">${pair('커피 드릴까요?','Кофе өгөх үү?')}${pair('괜찮아요.','Татгалзаж байгаа мэт сонсогдож болно.','small')}</div><div class="comparison">${pair('미안해요.','Уучлаарай.')}${pair('괜찮아요.','Асуудалгүй гэсэн үг.','small')}</div>`},
 {kind:'quiz',body:label('ОДОО ТА ХЭЛЭЭД ҮЗЭЭРЭЙ')+title('Ус авмаар байна.')+pair('물 드릴까요?','Ус өгөх үү?')+`<div class="choices"><div class="option">${pair('A  네, 주세요.','Тийм ээ, өгөөч.')}</div><div class="option">${pair('B  아니요, 괜찮아요.','Үгүй ээ, зүгээр.')}</div></div>`+note('Авмаар байвал A.')},
 {kind:'keep',body:label('ХАДГАЛЖ АВААД ХЭРЭГЛЭЭРЭЙ')+title('Өнөөдөр хэрэглэх<br>гурван өгүүлбэр.')+`<div class="keeps">${label('АВАХДАА')}${pair('네, 주세요.','Тийм ээ, өгөөч.')}${label('ТАТГАЛЗАХДАА')}${pair('아니요, 괜찮아요.','Үгүй ээ, зүгээр.')}${label('УУЧЛАЛД ХАРИУЛАХДАА')}${pair('괜찮아요.','Зүгээр ээ.')}</div>`}
];
const fontRoot=path.join(root,'docs/브랜드_폰트/InterTight');
const fonts=[['Regular',400],['Medium',500],['SemiBold',600],['Bold',700]].map(([n,w])=>`@font-face{font-family:'Inter Tight';font-weight:${w};src:url(data:font/ttf;base64,${fs.readFileSync(path.join(fontRoot,`InterTight-${n}.ttf`)).toString('base64')}) format('truetype');}`).join('');
const logo=require(path.join(root,'tools/lib/로고정본.js')).워드마크({판:'라이트',표현:'민',신호:'k',색갈래:'단색'});
const css=`${fonts}
*{box-sizing:border-box}.판{display:none}body{color:${색('Ink')};font-family:'Inter Tight';text-align:left}.content{position:absolute;left:88px;right:88px;top:176px;bottom:180px;display:flex;flex-direction:column;align-items:flex-start;gap:52px}.brand{position:absolute;top:54px;left:82px;display:flex;align-items:center;gap:4px}.brand svg{width:108px;height:74px}.brand span{font:600 22px 'Inter Tight';letter-spacing:.12em}.edition{position:absolute;right:88px;top:87px;font:400 23px 'Inter Tight';color:${색('Deep Wool')}}h1{font-size:70px;line-height:1.12;letter-spacing:-.035em;font-weight:600;margin:0}.label{font-size:24px;font-weight:600;letter-spacing:.055em;color:${색('Deep Wool')}}.kr{font-family:'SUIT Variable';font-weight:700;letter-spacing:-.035em;line-height:1.2}.pair .kr{font-size:65px}.mn{font-size:35px;line-height:1.35;margin-top:13px;color:${색('Deep Wool')}}.note{font-size:34px;line-height:1.4;color:${색('Deep Wool')}}.hero{margin-top:64px}.hero .kr{font-size:105px;color:${색('Coral 3')}}.hero .mn{font-size:45px}.reply{margin-left:52px}.reply .kr{color:${색('Coral 3')};font-size:72px}.small .kr{font-size:53px}.small .mn{font-size:32px}.hook{font-size:51px;line-height:1.25}.choices{display:flex;flex-direction:column;gap:30px}.choices>.kr{font-size:52px}.cover h1 .kr{font-size:150px;color:${색('Coral 3')}}.cover{gap:40px}.cover .pair .kr{font-size:57px}.cover .choices{gap:24px}.cover .mn{font-size:32px}.comparison{display:flex;flex-direction:column;gap:20px;padding-bottom:32px;border-bottom:1px solid ${색('Deep Wool')};width:100%}.compare{gap:34px}.comparison .pair:first-child .kr{font-size:48px}.comparison .mn{font-size:31px}.comparison .small .kr{color:${색('Coral 3')}}.quiz .choices{gap:42px}.quiz .option .kr{font-size:57px}.quiz .note{font-size:29px;margin-top:10px}.keep{gap:40px}.keep h1{font-size:64px}.keeps{display:flex;flex-direction:column;gap:13px}.keeps .pair{margin-bottom:27px}.keeps .kr{font-size:63px}.keeps .mn{font-size:31px;margin-top:8px}.keeps .label{font-size:21px}.몽글{bottom:100px;right:70px;width:210px}.바닥{bottom:49px}.꼬리{font:400 23px 'Inter Tight';color:${색('Deep Wool')}}.땀줄{position:absolute;left:90px;bottom:145px;width:190px}.땀줄 img{max-width:100%}
`;
cards.forEach((c,i)=>{
 let html=fs.readFileSync(path.join(__dirname,'../괜찮아요_20260909',`${String(i+1).padStart(2,'0')}.html`),'utf8');
 const stitch=i===0?(html.match(/<div class="땀줄">[\s\S]*?<\/div>/)||[''])[0]:'';
 html=html.replace(/<div class="판">[\s\S]*?<\/div>\s*\n\s*(?=<img class="몽글"|<div class="바닥")/,`<div class="brand">${logo}<span>LAB</span></div><div class="edition">한국어 한마디</div><main class="content ${c.kind}">${c.body}</main>${stitch}\n`);
 html=html.replace('</style>',css+'</style>');html=브랜드폰트.심기(html).html;
 fs.writeFileSync(path.join(__dirname,`${String(i+1).padStart(2,'0')}.html`),html);
});
fs.writeFileSync(path.join(__dirname,'문안.json'),JSON.stringify(cards,null,2));
console.log('7/7 HTML 생성');
