import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const timing=JSON.parse(fs.readFileSync(path.join(dir,'audio-timing.json'),'utf8'));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const img=(name,cl='',style='')=>`<img class="${cl}" style="${style}" src="assets/images/${name}.png" alt="${name==='source'?'AI로 만든 원본 예시':name==='hero'?'전체 컷 실제 생성 결과':name==='detail'?'디테일 컷 실제 생성 결과':'사용 장면 실제 생성 결과'}">`;
const shared=`
  @font-face{font-family:SUIT;src:url('assets/fonts/SUIT.woff2') format('woff2');font-weight:100 900;font-display:block}@font-face{font-family:InterTight;src:url('assets/fonts/InterTight.ttf');font-weight:700 900;font-display:block}
  *{box-sizing:border-box} #root{position:absolute;inset:0;width:1080px;height:1920px;overflow:hidden;background:#fff;color:#000;font-family:SUIT,sans-serif}
  h1,h2,p{margin:0} img{display:block;object-fit:cover} .label{font:750 31px/1.2 SUIT;letter-spacing:.025em}
  .step{position:absolute;left:76px;top:256px;font:800 36px/1 SUIT;letter-spacing:.04em;color:#274BDD}
  .heading{position:absolute;left:72px;top:322px;font:900 106px/1.04 SUIT;letter-spacing:-.06em;width:930px}
  .heading span{display:block}.blue{color:#274BDD}.rule{position:absolute;left:76px;right:104px;top:228px;height:3px;background:#000}
  .photo{position:absolute;overflow:hidden;background:#efefef}.photo img{width:100%;height:100%}
  .stamp{background:#274BDD;color:#fff;padding:14px 22px;font:800 34px/1 SUIT;display:inline-block}
  .note{font:550 30px/1.35 SUIT;color:#464646}.line{height:3px;background:#000}
`;
function scene(n,name,markup,css,js){
 const s=timing.segments[n-1], id=`scene-${n}`;
 const html=`<!doctype html><html lang="ko"><head><meta charset="UTF-8"><title>${name}</title></head><body><template><style>${shared}\n${css}</style><div id="root" data-composition-id="${id}" data-width="1080" data-height="1920" data-duration="${s.duration}">${markup}</div><script>(function(){const tl=gsap.timeline({paused:true});\n${js}\nwindow.__timelines=window.__timelines||{};window.__timelines['${id}']=tl;})();</script></template></body></html>`;
 fs.writeFileSync(path.join(dir,`compositions/frames/0${n}-${name}.html`),html);
 return {...s,file:`compositions/frames/0${n}-${name}.html`,id,markup,css,js};
}
const scenes=[];
scenes.push(scene(1,'result',`
 <div class="rule"></div><div class="introtitle"><span class="first">사진 <b>1장</b>으로</span><span class="second">광고 <b>3컷</b></span></div>
 <div class="original"><div class="label">원본</div>${img('source')}<div class="note">파란 머그컵</div></div>
 <div class="arrow">→</div>
 <div class="result photo">${img('hero','hero')}${img('detail','detail')}${img('lifestyle','lifestyle')}<span class="stamp">AI 편집 결과</span></div>
 <div class="thumbs">${['hero','detail','lifestyle'].map((p,i)=>`<div class="thumb t${i}">${img(p)}<span>${['전체','디테일','사용 장면'][i]}</span></div>`).join('')}</div>
 <div class="under">제품은 하나. 보여주는 장면은 셋.</div>`,
 `.introtitle{position:absolute;left:70px;top:292px;font:900 136px/1.03 SUIT;letter-spacing:-.065em}.introtitle>span{display:block}.introtitle b{color:#274BDD;font-weight:900}.second{margin-top:12px}.original{position:absolute;left:76px;top:716px;width:258px}.original .label{margin-bottom:16px}.original img{width:258px;height:330px}.original .note{margin-top:15px}.arrow{position:absolute;left:345px;top:873px;font:400 64px SUIT}.result{left:426px;top:646px;width:550px;height:688px}.result img{position:absolute;inset:0}.result .stamp{position:absolute;left:18px;top:18px;font-size:28px}.thumbs{position:absolute;left:426px;top:646px;display:flex;gap:20px}.thumb{position:absolute;width:268px;height:424px;background:white;border:3px solid #000;padding:9px;box-shadow:8px 10px 0 #000}.thumb img{width:244px;height:340px}.thumb span{display:block;font:800 30px SUIT;padding:12px 4px}.t0{left:-65px;top:300px}.t1{left:180px;top:60px}.t2{left:360px;top:320px}.under{position:absolute;left:76px;top:1413px;font:700 36px SUIT;letter-spacing:-.02em}`,
 `tl.fromTo('.introtitle .first',{y:70},{y:0,duration:.42,ease:'power4.out'},0);tl.fromTo('.introtitle .second',{y:90},{y:0,duration:.48,ease:'power4.out'},.05);
 tl.fromTo('.original',{x:-70,opacity:0},{x:0,opacity:1,duration:.42,ease:'power2.out'},0);
 tl.fromTo('.result',{x:130},{x:0,duration:.45,ease:'power4.out'},0);
 tl.fromTo('.detail',{opacity:0},{opacity:1,duration:.1},.93);tl.fromTo('.lifestyle',{opacity:0},{opacity:1,duration:.1},1.83);
 tl.fromTo('.thumbs',{opacity:0},{opacity:1,duration:.05},3.02);tl.to('.result',{opacity:0,duration:.15},3.02);tl.to('.original,.arrow',{opacity:0,duration:.15},3.02);
 tl.fromTo('.t0',{x:50,y:-50,rotation:0},{x:-205,y:0,rotation:-8,duration:.5,ease:'back.out(1.15)'},3.03);
 tl.fromTo('.t1',{x:0,y:100,rotation:0},{x:-85,y:35,rotation:1,duration:.5,ease:'power3.out'},3.1);
 tl.fromTo('.t2',{x:-100,y:-50,rotation:0},{x:-118,y:0,rotation:8,duration:.5,ease:'back.out(1.15)'},3.16);
 tl.fromTo('.under',{opacity:0,y:15},{opacity:1,y:0,duration:.3},4.2);`
));
scenes.push(scene(2,'source',`
 <div class="rule"></div><div class="step">01 / 사진 준비</div><h2 class="heading"><span>제품이 잘 보이는</span><span>사진 한 장</span></h2>
 <div class="sourcepaper">${img('source')}<div class="fileline"><span>머그컵_원본.png</span><b>＋</b></div></div>
 <div class="attach"><span>이미지 편집 AI에 첨부</span><span class="up">↑</span></div>
 <div class="side">모양이 선명하게</div>`,
 `.sourcepaper{position:absolute;left:206px;top:602px;width:610px;background:#fff;border:3px solid #000;box-shadow:12px 14px 0 #d9dff7}.sourcepaper img{width:604px;height:755px}.fileline{padding:20px 26px;display:flex;justify-content:space-between;align-items:center;font:700 32px SUIT;border-top:3px solid #000}.fileline b{font-size:42px;color:#274BDD}.attach{position:absolute;left:161px;top:1450px;width:700px;height:82px;display:flex;align-items:center;justify-content:space-between;padding:0 34px;background:#274BDD;color:#fff;font:800 36px SUIT;box-shadow:8px 9px 0 #000}.up{width:54px;height:54px;border:2px solid white;display:grid;place-items:center;font:600 51px SUIT}.side{position:absolute;left:660px;top:1158px;background:#fff;border:3px solid #274BDD;padding:14px 22px;font:800 31px SUIT;color:#274BDD}`,
 `tl.fromTo('.heading span',{y:55,opacity:0},{y:0,opacity:1,duration:.4,stagger:.1,ease:'power3.out'},0);tl.fromTo('.sourcepaper',{y:90,rotation:-4},{y:0,rotation:0,duration:.65,ease:'power3.out'},.1);tl.fromTo('.attach',{y:100,opacity:0},{y:0,opacity:1,duration:.5,ease:'back.out(1.05)'},2.6);tl.fromTo('.up',{y:10},{y:-7,duration:.5,repeat:1,yoyo:true,ease:'power2.inOut'},3.15);tl.fromTo('.side',{scale:.7,opacity:0},{scale:1,opacity:1,duration:.32,ease:'back.out(1.7)'},5.15);`
));
scenes.push(scene(3,'prompt',`
 <div class="rule"></div><div class="step">02 / 바꾸지 않을 것</div><h2 class="heading"><span>제품은 고정.</span><span class="blue">연출만 변경.</span></h2>
 <div class="tokens"><span class="tok">모양</span><span class="tok">색</span><span class="tok">재질</span></div>
 <div class="promptpaper"><div class="label">복사할 기본 요청문</div><div class="quotemark">“</div><div class="prompttext"><span class="phrase">이 제품의 모양·색·재질은</span><span class="phrase">그대로 유지해 주세요.</span><span class="phrase last">글자는 추가하지 말아 주세요.</span></div><div class="bottomline"></div><span class="note">그다음 배경·빛·구도를 지정합니다.</span></div>
 <div class="cornerphoto">${img('source')}</div>`,
 `.tokens{position:absolute;left:76px;top:617px;display:flex;gap:19px}.tok{font:800 53px SUIT;border:3px solid #000;padding:15px 29px;background:#fff}.promptpaper{position:absolute;left:76px;top:771px;width:900px;height:670px;border:3px solid #000;background:white;box-shadow:12px 12px 0 #274BDD;padding:44px}.promptpaper .label{color:#274BDD}.quotemark{font:900 128px InterTight;position:absolute;left:34px;top:104px;color:#274BDD}.prompttext{position:absolute;left:46px;top:218px;font:750 48px/1.5 SUIT;letter-spacing:-.03em}.phrase{display:block}.last{margin-top:26px;font-size:45px}.bottomline{position:absolute;left:46px;right:46px;top:533px;height:2px;background:#a6a6a6}.promptpaper .note{position:absolute;left:46px;top:567px}.cornerphoto{position:absolute;left:730px;top:553px;width:200px;height:250px;border:3px solid #000;overflow:hidden}.cornerphoto img{width:100%;height:100%}`,
 `tl.fromTo('.heading span',{y:60,opacity:0},{y:0,opacity:1,duration:.4,stagger:.1,ease:'power4.out'},0);tl.fromTo('.promptpaper',{y:110},{y:0,duration:.6,ease:'power3.out'},.2);tl.fromTo('.cornerphoto',{rotation:-8,y:60,opacity:0},{rotation:7,y:0,opacity:1,duration:.55,ease:'back.out(1.1)'},.4);tl.fromTo('.tok',{scale:.85,opacity:0},{scale:1,opacity:1,duration:.28,stagger:.13,ease:'back.out(1.5)'},2.7);tl.fromTo('.phrase',{clipPath:'inset(0 100% 0 0)'},{clipPath:'inset(0 0% 0 0)',duration:1.0,stagger:1.25,ease:'none'},2.9);tl.fromTo('.last',{color:'#000'},{color:'#274BDD',duration:.2},7.9);`
));
scenes.push(scene(4,'three-shots',`
 <div class="rule"></div><div class="step">03 / 한 장씩 따로 요청</div><h2 class="heading"><span>전체 → 질감 → 상황</span></h2>
 ${['hero','detail','lifestyle'].map((p,i)=>`<div class="shot s${i}"><div class="shotphoto">${img(p)}</div><div class="shotfoot"><span class="num">0${i+1}</span><div><strong>${['전체 컷','가까운 컷','사용 컷'][i]}</strong><p>${['빛으로 분위기','가까이서 질감','손과 소품으로 상황'][i]}</p></div></div></div>`).join('')}
 <div class="shotindex"><span class="d d0"></span><span class="d d1"></span><span class="d d2"></span></div>`,
 `.heading{font-size:84px;top:337px;white-space:nowrap}.shot{position:absolute;left:76px;top:524px;width:900px;height:925px;background:#fff;overflow:hidden;border:3px solid #000}.shotphoto{height:754px;overflow:hidden}.shotphoto img{width:100%;height:100%;object-position:50% 58%}.shotfoot{display:flex;align-items:center;gap:34px;padding:25px 32px;background:#fff;height:167px}.num{font:800 83px InterTight;color:#274BDD}.shotfoot strong{font:900 51px SUIT}.shotfoot p{font:500 35px SUIT;margin-top:5px}.shotindex{position:absolute;left:76px;top:1480px;display:flex;gap:15px}.d{display:block;width:290px;height:7px;background:#cbd2ef}`,
 `tl.fromTo('.heading',{y:45,opacity:0},{y:0,opacity:1,duration:.4,ease:'power3.out'},0);tl.fromTo('.s0',{y:40},{y:0,duration:.35,ease:'power3.out'},0);tl.to('.s0',{opacity:0,duration:.1},4.03);tl.to('.s1',{opacity:0,duration:.1},7.0);tl.fromTo('.s1',{x:1050,rotation:5,opacity:0},{x:0,rotation:0,opacity:1,duration:.4,ease:'power4.out'},4.03);tl.fromTo('.s2',{x:1050,rotation:-5,opacity:0},{x:0,rotation:0,opacity:1,duration:.4,ease:'power4.out'},7.0);tl.fromTo('.s0 img',{scale:1.02},{scale:1.09,duration:4.3,ease:'none'},0);tl.fromTo('.s1 img',{scale:1.0,x:0},{scale:1.05,x:-15,duration:3.25,ease:'none'},4.03);tl.fromTo('.s2 img',{scale:1.0},{scale:1.045,duration:4.3,ease:'none'},7);tl.to('.d0',{backgroundColor:'#274BDD',duration:.1},0);tl.to('.d1',{backgroundColor:'#274BDD',duration:.1},4.03);tl.to('.d2',{backgroundColor:'#274BDD',duration:.1},7);`
));
scenes.push(scene(5,'compare',`
 <div class="rule"></div><div class="step">04 / 결과 확인</div><h2 class="heading"><span>예뻐도,</span><span>원본과 비교.</span></h2>
 <div class="pair"><div class="pairitem"><div class="label">원본</div><div class="pairphoto">${img('source')}<span class="circle ca"></span></div></div><div class="pairitem"><div class="label blue">AI 편집 결과</div><div class="pairphoto">${img('hero')}<span class="circle cb"></span></div></div></div>
 <div class="checks"><span class="c c0">손잡이</span><span class="c c1">색</span><span class="c c2">테두리</span></div><p class="checknote">다르면 원본을 다시 붙여 수정 요청</p>`,
 `.pair{position:absolute;left:76px;top:685px;display:flex;gap:24px}.pairitem{width:438px}.pairphoto{position:relative;margin-top:20px;height:547px;overflow:hidden;border:2px solid #000}.pairphoto img{width:100%;height:100%}.circle{position:absolute;left:305px;top:200px;width:87px;height:160px;border:5px solid #f05034;border-radius:50%}.cb{top:197px}.checks{position:absolute;left:76px;top:1340px;display:flex;gap:24px}.c{width:284px;height:89px;border:3px solid #000;font:800 44px SUIT;display:grid;place-items:center;background:#fff}.checknote{position:absolute;left:76px;top:1460px;font:650 32px SUIT;color:#474747}`,
 `tl.fromTo('.heading span',{y:50,opacity:0},{y:0,opacity:1,duration:.4,stagger:.1,ease:'power3.out'},0);tl.fromTo('.pair',{y:75,opacity:0},{y:0,opacity:1,duration:.5,ease:'power3.out'},.2);tl.fromTo('.circle',{scale:.7,opacity:0},{scale:1,opacity:1,duration:.35,ease:'back.out(1.7)'},4.65);tl.fromTo('.checks',{y:40,opacity:0},{y:0,opacity:1,duration:.3},3.35);tl.to('.c0',{backgroundColor:'#274BDD',color:'#fff',duration:.2},4.65);tl.to('.c1',{backgroundColor:'#274BDD',color:'#fff',duration:.2},5.5);tl.to('.c2',{backgroundColor:'#274BDD',color:'#fff',duration:.2},6.08);tl.fromTo('.checknote',{opacity:0},{opacity:1,duration:.25},7.4);`
));
scenes.push(scene(6,'finish',`
 <div class="rule"></div><div class="montage"><div class="adbase">${img('hero','ad0')}${img('detail','ad1')}${img('lifestyle','ad2')}<div class="adtext"><span>하루의</span><span>파란 쉼표.</span></div><span class="adlabel">3컷 편집 예시</span></div></div>
 <div class="end"><div class="step">직접 따라 해보세요</div><h2 class="heading"><span>프롬프트 +</span><span>확인표까지.</span></h2><div class="guidepaper"><img src="guide-preview.png" alt="실제 PDF 가이드 첫 페이지"></div><div class="promptmini"><span class="label">COPY &amp; CREATE</span><strong>제품은 그대로.<br>장면은 새롭게.</strong><div class="line"></div><span>원본 · 요청문 · 비교 확인표</span></div><div class="cta"><span>팔로우하고 댓글에</span><b>synk</b></div></div>`,
 `.montage{position:absolute;left:76px;top:315px;width:900px;height:1130px;overflow:hidden}.adbase{position:relative;width:100%;height:100%}.adbase img{position:absolute;inset:0;width:100%;height:100%}.adtext{position:absolute;left:40px;top:40px;font:900 76px/1.08 SUIT;letter-spacing:-.05em;color:#000;background:#fff;padding:16px 22px;box-shadow:7px 7px 0 #274BDD}.adtext span{display:block}.adlabel{position:absolute;left:38px;bottom:40px;background:#fff;padding:13px 20px;font:750 29px SUIT}.end{position:absolute;inset:0;background:white}.guidepaper{position:absolute;left:116px;top:671px;width:476px;height:672px;border:3px solid #000;box-shadow:12px 14px 0 #000;overflow:hidden;background:white}.guidepaper img{width:100%;height:100%;object-fit:cover}.promptmini{position:absolute;left:567px;top:801px;width:366px;height:469px;background:#274BDD;color:#fff;padding:34px 28px;box-shadow:10px 12px 0 #000}.promptmini .label{font-size:25px;font-family:InterTight}.promptmini strong{display:block;font:850 46px/1.2 SUIT;letter-spacing:-.04em;margin:50px 0 40px}.promptmini .line{background:white;margin-bottom:28px}.promptmini>span:last-child{font:550 27px/1.5 SUIT}.cta{position:absolute;left:76px;top:1393px;display:flex;align-items:center;gap:34px}.cta span{font:750 44px SUIT}.cta b{font:800 81px InterTight;color:#274BDD}`,
 `tl.fromTo('.adbase',{scale:1.03},{scale:1,duration:2.3,ease:'none'},0);tl.fromTo('.ad1',{opacity:0},{opacity:1,duration:.05},.72);tl.fromTo('.ad2',{opacity:0},{opacity:1,duration:.05},1.43);tl.to('.montage',{opacity:0,duration:.1},2.3);tl.fromTo('.end',{y:1920},{y:0,duration:.5,ease:'power4.out'},2.3);tl.fromTo('.guidepaper',{rotation:-8,y:60},{rotation:-4,y:0,duration:.6,ease:'back.out(1.1)'},2.7);tl.fromTo('.promptmini',{rotation:4,y:90,opacity:0},{rotation:4,y:0,opacity:1,duration:.6,ease:'power3.out'},2.9);tl.fromTo('.cta',{y:30,opacity:0},{y:0,opacity:1,duration:.4,ease:'power3.out'},5.4);tl.fromTo('.cta b',{scale:.8},{scale:1,duration:.5,ease:'back.out(1.7)'},7.7);`
));
const captions=timing.captions||timing.sentences;
if(!captions)throw Error('No captions in audio-timing.json');
const captionHTML=captions.map((c,i)=>`<div class="clip caption" id="cap-${i}" data-start="${c.start}" data-duration="${(c.end-c.start).toFixed(4)}" data-track-index="10"><span>${esc(c.text)}</span></div>`).join('\n');
const root=`<!doctype html><html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>synkbrief 활용 — 사진 한 장으로 광고 세 컷</title><script src="assets/gsap.min.js"></script><style>
@font-face{font-family:SUIT;src:url('assets/fonts/SUIT.woff2') format('woff2');font-weight:100 900;font-display:block}@font-face{font-family:InterTight;src:url('assets/fonts/InterTight.ttf');font-weight:700 900;font-display:block}
*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff}#main{position:relative;width:1080px;height:1920px;overflow:hidden;font-family:SUIT,sans-serif;background:#fff}.clip{position:absolute;inset:0}.brandbar{position:absolute;top:155px;left:76px;right:104px;display:flex;justify-content:space-between;align-items:center}.brand{display:flex;align-items:baseline;gap:16px;font:800 38px InterTight;color:#000;white-space:nowrap}.series{font:800 34px SUIT;color:#274BDD}.brandtag{font:650 27px SUIT;color:#444}.progress{position:absolute;left:76px;top:1730px;width:900px;height:5px;background:#d6defa}.progress i{display:block;width:100%;height:100%;background:#274BDD;transform-origin:left center}.caption{display:flex;align-items:flex-start;justify-content:center;padding-top:1552px;pointer-events:none}.caption span{display:block;max-width:928px;min-height:75px;padding:15px 26px 17px;background:#000;color:white;font:700 49px/1.3 SUIT;text-align:center;word-break:keep-all;letter-spacing:-.025em}.footline{position:absolute;left:76px;top:1770px;font:650 23px SUIT;color:#595959;letter-spacing:.04em}
</style></head><body><div id="main" data-composition-id="synkbrief-photo" data-width="1080" data-height="1920" data-duration="56.5" data-fps="30">
${scenes.map(s=>`<div class="clip" id="slot-${s.id}" data-composition-id="${s.id}" data-composition-src="${s.file}" data-start="${s.start}" data-duration="${s.duration}" data-track-index="1" data-width="1080" data-height="1920"></div>`).join('\n')}
<div class="clip" data-start="0" data-duration="56.5" data-track-index="8" id="identity"><div class="brandbar"><span class="brand">synkbrief <span class="series">활용</span></span><span class="brandtag">AI 생성 예시 · 직접 제작</span></div><div class="progress"><i></i></div><div class="footline">PHOTO → PROMPT → 3 CUTS</div></div>
${captionHTML}
<audio id="master-audio" src="assets/audio/master.wav" data-start="0" data-duration="56.5" data-track-index="20"></audio>
</div><script>const tl=gsap.timeline({paused:true});tl.fromTo('.progress i',{scaleX:0},{scaleX:1,duration:56.5,ease:'none'},0);window.__timelines=window.__timelines||{};window.__timelines['synkbrief-photo']=tl;</script></body></html>`;
// The CLI inlines local scripts before GPU inspection. Load GSAP after the
// composition root so v0.8.79's tag scanner does not recurse over a large script.
const ready=root.replace('<script src="assets/gsap.min.js"></script>','').replace('</div><script>const tl=','</div><script src="assets/gsap.min.js"></script><script>const tl=');
fs.writeFileSync(path.join(dir,'index.html'),ready);
fs.writeFileSync(path.join(dir,'scenes.json'),JSON.stringify(scenes.map(({file,id,start,end,duration,text})=>({file,id,start,end,duration,text})),null,2));
console.log(`Built ${scenes.length} scenes, ${captions.length} captions, ${timing.duration}s.`);
