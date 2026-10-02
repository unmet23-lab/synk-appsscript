const fs=require('node:fs'),path=require('node:path');
const root=__dirname,T=JSON.parse(fs.readFileSync(path.join(root,'timing.json'),'utf8'));
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const display=s=>s.replaceAll('유월','6월').replaceAll('일인 기업가','1인 기업가');
const groups={
'01':['오늘은 AI로 출석 앱 만들다,','정작 출석을 까먹은 얘깁니다.'],
'02':['이 한 줄부터 정했다면, 덜 헤맸을 거예요.'],
'03':['몽골 학원에서 일하던 유월.','번역하려고 클로드를 결제했어요.'],
'04':['학생 문의가 늘자, 출석 앱도 만들고 싶어졌죠.'],
'05':['문제는, 개발을 하나도 몰랐다는 거.'],
'06':['화면 찍고, 물어보고,','그대로 따라 했습니다.'],
'07':['그런데 이 기능도 좋아 보이고,','저것도 넣고 싶고.'],
'08':['기능은 늘었는데,','정작 출석은 뒷전.','나 뭐 만들고 있었지?'],
'09':['지금 다시 한다면,','완성의 기준부터 한 줄로 정하겠어요.'],
'10':['학생 한 명의 출석을 저장하고,','다시 확인할 수 있게.'],
'11':['화면으로 볼게요.','이름을 고르고, 출석 저장.'],
'12':['목록에 남았죠? 다시 열어도 기록이 보이면,','첫 단계 완료!'],
'13':['AI에게는 이렇게 말해보세요.','나는 개발이 처음이야.'],
'14':['학생 한 명의 출석을 저장하고, 다시 확인하고 싶어.'],
'15':['추가 기능은 빼고,','가장 쉬운 방법과 확인 순서를 알려줘.'],
'16':['작게 완성하고, 확인한 뒤, 다음 기능.','순서가 생겼죠?'],
'17':['제가 헤맨 길, 여러분은 건너뛰세요.'],
'18':['왕초보에서 일인 기업가까지.','여러분의 시간을 아껴드립니다!']};
const fontkit=require('C:/Users/q1212/AppData/Local/npm-cache/_npx/110f701c48e68d66/node_modules/fontkit');
const font=fontkit.openSync(path.join(root,'assets/SUIT-Variable.woff2'));
const measure=s=>font.layout(s).positions.reduce((sum,p)=>sum+p.xAdvance,0)/font.unitsPerEm*52*1.07-(s.length-1)*1.25;
function lines(text){
 const semantic={'학생 문의가 늘자, 출석 앱도 만들고 싶어졌죠.':['학생 문의가 늘자,','출석 앱도 만들고 싶어졌죠.'],'목록에 남았죠? 다시 열어도 기록이 보이면,':['목록에 남았죠?','다시 열어도 기록이 보이면,']};
 if(semantic[text])return semantic[text];if(measure(text)<=805)return [text];let best=null;const a=text.split(' ');for(let i=1;i<a.length;i++){const parts=[a.slice(0,i).join(' '),a.slice(i).join(' ')],widths=parts.map(measure);if(parts.some(s=>s.replace(/\s/g,'').length<4)||Math.max(...widths)>805)continue;const score=Math.abs(widths[0]-widths[1]);if(!best||score<best.score)best={parts,score};}if(!best)throw Error('No readable caption split: '+text);return best.parts;}
T.captions=[];for(const s of T.segments){let wi=0;for(const text of groups[s.id]){const n=text.split(' ').length,w=s.words.slice(wi,wi+n);if(w.map(x=>x.text).join(' ')!==text)throw Error('Caption mismatch '+s.id);const c={segment:s.id,spoken:text,text:display(text),start:Math.max(0,Math.floor((s.start+w[0].start)*30)/30),end:Math.ceil((s.start+w.at(-1).end+.12)*30)/30};c.lines=lines(c.text);c.lineWidths=c.lines.map(measure);T.captions.push(c);wi+=n;}if(wi!==s.words.length)throw Error('Word dropped');}
for(let i=0;i<T.captions.length;i++){const c=T.captions[i],next=T.captions[i+1];if(next)c.end=Math.min(c.end,next.start);else c.end=Math.min(c.end,T.duration);c.startFrame=Math.round(c.start*30);c.endFrame=Math.round(c.end*30);}
fs.writeFileSync(path.join(root,'timing.json'),JSON.stringify(T,null,2));
const fmt=t=>{const n=Math.round(t*1000);return `${String(Math.floor(n/3600000)).padStart(2,'0')}:${String(Math.floor(n/60000)%60).padStart(2,'0')}:${String(Math.floor(n/1000)%60).padStart(2,'0')},${String(n%1000).padStart(3,'0')}`;};
fs.writeFileSync(path.join(root,'yuhobuilds_EP01_자막.srt'),T.captions.map((c,i)=>`${i+1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.lines.join('\n')}\n`).join('\n'));
const ff="@font-face{font-family:SUIT;src:url('assets/SUIT-Variable.woff2') format('woff2');font-weight:100 950}";
fs.writeFileSync(path.join(root,'compositions/captions.html'),`<template><div id="caps-root" data-composition-id="captions" data-width="1080" data-height="1920" data-duration="${T.duration}"><style>${ff}#caps-root{position:relative;width:100%;height:100%;font-family:SUIT,sans-serif}.phrase{position:absolute;left:70px;top:1455px;width:902px;display:flex;justify-content:center;opacity:0}.phrase-box{background:#14202c;color:#fffdf8;border:2px solid #62717e;border-radius:19px;padding:18px 27px 20px;font-size:52px;line-height:1.23;font-weight:820;letter-spacing:-1.25px;box-shadow:0 7px 0 rgba(20,32,44,.12);text-align:center}.phrase-line{display:block;white-space:pre}</style>${T.captions.map((c,i)=>`<div id="cap-${i}" class="phrase"><div class="phrase-box">${c.lines.map(l=>`<span class="phrase-line">${esc(l)}</span>`).join('')}</div></div>`).join('')}</div><script>(()=>{const tl=gsap.timeline({paused:true});${T.captions.map((c,i)=>`tl.fromTo('#cap-${i}',{opacity:0,y:7},{opacity:1,y:0,duration:.065,ease:'power2.out',immediateRender:false},${c.start});tl.set('#cap-${i}',{opacity:0},${c.end});`).join('')}window.__timelines.captions=tl;})();</script></template>`);

// The title mask and camera wrapper are inside each timed scene; clip visibility stays runtime-owned.
const add=(id,markup,anim,change=h=>h)=>{
 const file=path.join(root,'compositions',id+'.html');let h=change(fs.readFileSync(file,'utf8'));
 h=h.replace('<div class="topline"></div>','<div class="topline"></div><div id="'+id+'-stage" class="motion-stage">');
 h=h.replace('</div></div><script>',''+markup+'</div></div></div><script>');
 const stageAnim=`tl.fromTo('#${id}-stage',{scale:1.025,y:20},{scale:1,y:0,duration:.35,ease:'power3.out',immediateRender:false},0);`;
 h=h.replace(`window.__timelines['${id}']=tl;`,stageAnim+anim+`window.__timelines['${id}']=tl;`);
 // Stable two-line blocks reveal from their own masks, with no reflow.
 h=h.replace(/<span class="line([^"]*)">([^<]*)<\/span>/g,(m,cls,text)=>`<span class="line-mask"><span class="line${cls}">${text}</span></span>`);
 h=h.replace(`window.__timelines['${id}']=tl;`,`tl.fromTo('#${id}-title .line',{yPercent:110},{yPercent:0,duration:.38,stagger:.07,ease:'power4.out',immediateRender:false},.02);window.__timelines['${id}']=tl;`);
 fs.writeFileSync(file,h);
};
add('hook',`<svg id="hook-streaks" class="hidden" width="220" height="210" viewBox="0 0 220 210" style="position:absolute;left:745px;top:701px;overflow:visible"><path d="M70 72L22 27M105 46L100 3M135 66L181 22" stroke="#E64938" stroke-width="9" stroke-linecap="round" fill="none"/></svg>`,
 `tl.to('#hook-stage',{scale:1.055,x:-11,y:-28,duration:.25,ease:'power3.out'},cue('01','정작'));tl.to(q('app'),{rotation:-5,x:-15,duration:.22,ease:'power3.out'},cue('01','정작'));en('streaks',cue('01','까먹은'),{scale:.5,y:10,d:.2});tl.to(q('streaks'),{opacity:0,scale:1.1,duration:.18},cue('01','까먹은')+.38);tl.fromTo(q('mark'),{rotation:-12},{rotation:8,duration:.13,repeat:1,yoyo:true,immediateRender:false},cue('01','까먹은')+.16);tl.to('#hook-stage',{scale:1,x:0,y:0,duration:.30,ease:'power3.inOut'},cue('02','한')-.10);`,
 h=>h.replace('출석 앱 만들다','출석 앱 만들다').replace('출석을 까먹음.','출석을 까먹었다.'));
add('origin','',`tl.to(q('receipt'),{scale:1.025,rotation:-1,duration:.36,ease:'power3.out'},cue('03','번역하려고'));tl.fromTo(q('inquiries'),{x:105},{x:0,duration:.28,ease:'power4.out',immediateRender:false},cue('04','학생'));tl.to(q('note2'),{rotation:-1.3,duration:.24},cue('04','늘자')+.15);`,h=>h.replace('2026.06.02 · 첫 Claude 결제','6월 2일 · 첫 Claude 결제').replace('top:620px;width:772px;height:449px','top:599px;width:772px;height:490px'));
add('loop','',`tl.fromTo('#loop-title .acid',{scale:1.25},{scale:1,duration:.3,ease:'back.out(1.4)',transformOrigin:'left center',immediateRender:false},.19);tl.to(q('face'),{scale:1.08,rotation:3,duration:.27,ease:'power3.out'},cue('05','하나도'));[['step1','화면',-80],['step2','물어보고',80],['step3','그대로',-80]].forEach(([id,w,x])=>tl.fromTo(q(id),{x},{x:0,duration:.24,ease:'power4.out',immediateRender:false},cue('06',w)));`);
add('monster','',`tl.to('#monster-stage',{scale:1.035,y:-15,duration:1.35,ease:'power1.inOut'},.20);tl.to('#monster-stage',{scale:1,y:0,duration:.17,ease:'power4.out'},cue('08','정작'));tl.fromTo(q('lost'),{scale:1.2,rotation:-5},{scale:1,rotation:0,duration:.33,ease:'power4.out',immediateRender:false},cue('08','정작')+.05);`,h=>h.replaceAll('.26+i*.50','.19+i*.36').replaceAll('.53+i*.5','.44+i*.36').replaceAll('y:90,rotation:[-6,5,-4,7]','y:165,rotation:[-10,9,-8,11]'));
add('reset',`<div id="reset-question" class="hidden" style="position:absolute;left:91px;top:750px;width:790px"><div style="font-size:35px;color:#DFFF6A;font-weight:750;margin-bottom:24px">앱 전체 말고,</div><div style="font-size:91px;font-weight:950;line-height:1.23;letter-spacing:-4px">무엇이 되면<span style="display:block">첫 단계 완료?</span></div></div>`,
 `en('question',.28,{y:38,d:.3});off('question',cue('10','학생')-.19,-90);tl.fromTo(q('goal'),{x:115},{x:0,duration:.35,ease:'power4.out',immediateRender:false},cue('10','학생'));tl.to('#reset-stage',{scale:1.025,y:-11,duration:.26},cue('10','저장하고'));`,h=>h.replace('top:701px;width:810px','top:680px;width:810px').replace('top:1230px','top:1238px'));
add('demo',`<div id="demo-click-ring" class="hidden" style="position:absolute;left:409px;top:882px;width:160px;height:160px;border:5px solid #365EE7;border-radius:50%;pointer-events:none"></div>`,
 `tl.to(q('app'),{scale:1.027,rotationY:0,duration:.30,ease:'power3.out'},cue('11','이름을'));tl.fromTo(q('click-ring'),{opacity:1,scale:.15},{opacity:0,scale:1.7,duration:.38,ease:'power3.out',immediateRender:false},cue('11','저장'));tl.to(q('row'),{backgroundColor:'#dfff6a',duration:.18,repeat:1,yoyo:true},cue('12','기록이'));tl.fromTo(q('success'),{x:-35},{x:0,duration:.3,ease:'back.out(1.3)',immediateRender:false},cue('12','기록이'));`);
add('payoff',`<svg width="100" height="570" viewBox="0 0 100 570" style="position:absolute;left:120px;top:644px;pointer-events:none;opacity:.55"><path id="payoff-path" d="M40 20V524" fill="none" stroke="#DFFF6A" stroke-width="7" stroke-dasharray="504" stroke-dashoffset="504"/></svg>`,
 `tl.to('#payoff-path',{strokeDashoffset:0,duration:1.35,ease:'power2.inOut'},cue('16','작게'));['a','b','c'].forEach((id,i)=>{const w=['작게','확인한','다음'][i];tl.fromTo(q(id),{x:95},{x:0,duration:.27,ease:'power4.out',immediateRender:false},cue('16',w));tl.fromTo(q(id)+' .check',{scale:0},{scale:1,duration:.28,ease:'back.out(1.8)',immediateRender:false},cue('16',w)+.12);});`);
add('ending','',`tl.fromTo(q('photo'),{rotation:2},{rotation:0,duration:.45,ease:'power3.out',immediateRender:false},.1);tl.fromTo(q('signoff'),{scale:.94},{scale:1,duration:.32,ease:'back.out(1.3)',immediateRender:false},cue('18','여러분의'));`);

// Prompt lines are laid out once. Revealing a character never moves any other character.
const scene=T.scenes.find(s=>s.id==='prompt');
const lineSets=[{seg:'13',skip:'나는',lines:['나는 개발이 처음이야.']},{seg:'14',lines:['학생 한 명의 출석을','저장하고, 다시 확인하고 싶어.']},{seg:'15',lines:['추가 기능은 빼고,','가장 쉬운 방법과','확인 순서를 알려줘.']}];
const letterTimes=[],rows=lineSets.map((row,ri)=>{const s=scene.segments.find(x=>x.id===row.seg);let chars=s.characters;if(row.skip){const w=s.words.find(w=>w.text===row.skip);chars=chars.filter(c=>c.start>=w.start-.001);}const actual=chars.filter(c=>c.text.trim());let n=0;const content=row.lines.map((line,li)=>`<span class="typed-line">${Array.from(line).map(ch=>{if(ch===' ')return '<span class="typed-space"> </span>';const c=actual[n++];if(!c||c.text!==ch)throw Error('Typing mismatch '+row.seg+' '+ch);const id='glyph-'+letterTimes.length;letterTimes.push({id,t:s.local+c.end});return `<span id="${id}" class="typed-glyph">${esc(ch)}</span>`;}).join('')}</span>`).join('');if(n!==actual.length)throw Error('Dropped typing char');return `<div id="prompt-row${ri}" class="typed-row ${ri===1?'typed-target':''}"><div class="typed-label">${['01 · 내 경험 수준','02 · 첫 완성의 기준','03 · 필요한 안내만'][ri]}</div>${content}</div>`;}).join('');
const promptMarkup=`<template><div id="prompt-root" data-composition-id="prompt" data-width="1080" data-height="1920" data-duration="${scene.duration}"><style>${ff}#prompt-root{position:relative;width:100%;height:100%;font-family:SUIT,sans-serif}.typed-row{position:absolute;left:80px;width:832px;border-top:2px solid #c3cbd6;padding:22px 26px 25px;color:#18232D}.typed-label{font-size:27px;color:#365EE7;font-weight:800;letter-spacing:.2px;margin-bottom:20px}.typed-row:nth-child(1){top:570px}.typed-row:nth-child(2){top:773px}.typed-row:nth-child(3){top:1030px}.typed-target{background:#e9efff;border-top:3px solid #365EE7;border-radius:17px}.typed-line{display:block;white-space:pre;font-size:49px;line-height:1.35;font-weight:850;letter-spacing:-1.8px}.typed-glyph{opacity:0;display:inline-block}.typed-space{white-space:pre}.typed-glyph:last-child{margin-right:0}</style><div class="frame"><div class="mast"><span>yuho<b>builds</b></span><span class="tag">EP.01 · 내 아이디어로 바꿔 쓰기</span></div><div class="topline"></div><div id="prompt-stage" class="motion-stage"><h1 class="title" id="prompt-title"><span class="line-mask"><span class="line">AI에게는</span></span><span class="line-mask"><span class="line blueText">이렇게 말해요.</span></span></h1><div id="prompt-fields">${rows}</div><div id="prompt-guide" style="position:absolute;left:374px;top:488px;font-size:28px;font-weight:800;color:#365EE7;opacity:0">파란 부분을 내 목표로 바꿔요 ↓</div></div></div></div><script>(()=>{const tl=gsap.timeline({paused:true});tl.fromTo('#prompt-title .line',{yPercent:110},{yPercent:0,duration:.32,stagger:.07,ease:'power4.out'},0);${lineSets.map((row,i)=>{const s=scene.segments.find(s=>s.id===row.seg);return `tl.fromTo('#prompt-row${i}',{opacity:0,x:38},{opacity:1,x:0,duration:.22,ease:'power3.out',immediateRender:false},${Math.max(0,s.local-.14)});`;}).join('')}${letterTimes.map(c=>`tl.set('#${c.id}',{opacity:1},${c.t});`).join('')}tl.fromTo('#prompt-guide',{opacity:0,y:12},{opacity:1,y:0,duration:.22,ease:'power3.out'},${scene.segments[1].local+.15});window.__timelines.prompt=tl;})();</script></template>`;
fs.writeFileSync(path.join(root,'compositions/prompt.html'),promptMarkup);
const promptWidths=lineSets.flatMap(r=>r.lines.map(text=>({text,width:font.layout(text).positions.reduce((n,p)=>n+p.xAdvance,0)/font.unitsPerEm*49-(text.length-1)*1.8})));if(promptWidths.some(l=>l.width>776))throw Error('Prompt overflow');
fs.writeFileSync(path.join(root,'audit/text-layout.json'),JSON.stringify({captions:T.captions,promptWidths,typingCharacterCount:letterTimes.length,fixedLineLayout:true},null,2));
let h=fs.readFileSync(path.join(root,'index.html'),'utf8');
const extraCSS='.motion-stage{position:absolute;inset:0;transform-origin:540px 900px}.line-mask{display:block;overflow:hidden;padding-bottom:5px;margin-bottom:-5px}.title .line{display:block}.title{font-size:98px;line-height:1.15}.card{border-radius:25px;box-shadow:0 16px 27px rgba(24,35,45,.09),0 3px 0 rgba(24,35,45,.07)}.sceneFoot{font-size:26px;color:inherit;opacity:.68}';
h=h.replace('</style>',''+extraCSS+'#slot-captions{z-index:200!important}</style>');
const transitions=['loop','reset','payoff'].map((id,i)=>({id:'sweep'+i,t:T.scenes.find(s=>s.id===id).start,color:i===1?'#365EE7':'#18232D'}));
h=h.replace('<div class="progress">',transitions.map(t=>`<div id="${t.id}" style="position:absolute;inset:0;background:${t.color};z-index:120;opacity:0;pointer-events:none"></div>`).join('')+'<div class="progress">');
h=h.replace("window.__timelines['yuho-ep01']=tl;",transitions.map(t=>`tl.fromTo('#${t.id}',{xPercent:-100,opacity:1},{xPercent:100,opacity:1,duration:.30,ease:'power3.inOut',immediateRender:false},${t.t-.15});tl.set('#${t.id}',{opacity:0},${t.t+.15});`).join('')+"window.__timelines['yuho-ep01']=tl;");
fs.writeFileSync(path.join(root,'index.html'),h);
console.log(JSON.stringify({duration:T.duration,captions:T.captions.length,maxCaptionLine:Math.max(...T.captions.flatMap(c=>c.lineWidths)),promptWidths}));
