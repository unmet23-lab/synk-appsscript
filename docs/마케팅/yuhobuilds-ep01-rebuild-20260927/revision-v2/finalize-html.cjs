const fs=require('node:fs'),path=require('node:path'),root=__dirname,T=JSON.parse(fs.readFileSync(path.join(root,'timing.json'),'utf8'));
const ff=`@font-face{font-family:SUIT;src:url('assets/SUIT-Variable.woff2') format('woff2');font-weight:100 950;font-style:normal}`;
for(const s of T.scenes){const p=path.join(root,'compositions',s.id+'.html');let h=fs.readFileSync(p,'utf8').replaceAll('../assets/','assets/');if(!h.includes('@font-face'))h=h.replace('<style>','<style>'+ff);
if(s.id==='prompt'){h=h.replace('height:767px','height:797px').replace('left:310px;top:1270px','left:290px;top:505px');}
if(s.id==='hook'){
 h=h.replace('left:135px;top:696px;width:621px;height:114px','left:135px;top:746px;width:621px;height:124px');
 h=h.replace('left:610px;top:867px;width:320px;height:425px','left:705px;top:854px;width:247px;height:341px');
 h=h.replace('left:100px;top:1134px;width:625px','left:90px;top:1140px;width:610px');
 h=h.replace("en('blank',cue", "tl.to('#hook-app > div:nth-child(2)',{opacity:0,duration:.08},cue('01','정작')-.08);en('blank',cue");
}
if(s.id==='origin')h=h.replace("en('inquiries',cue", "off('title',cue('04','학생')-.18);off('receipt',cue('04','학생')-.18);en('inquiries',cue");
if(s.id==='loop')h=h.replace('left:347px;top:556px;width:365px;height:475px','left:361px;top:531px;width:330px;height:415px');
if(s.id==='monster'){
 h=h.replace("en('base',0", "tl.to('#monster-base > div',{opacity:0,duration:.12},.23);en('base',0");
 h=h.replace("en('stop',k", "['title','base','f1','f2','f3','f4'].forEach(x=>off(x,k-.16));tl.to('#monster-root .frame',{backgroundColor:'#18232D',color:'#F5F3EE',duration:.10},k);en('stop',k");
}
if(s.id==='reset')h=h.replace('padding:44px;border:0','padding:44px;border:0;color:#18232D');
if(s.id==='demo'){
 h=h.replace("en('reopen',reopen", "tl.to('#demo-form,#demo-app > div:nth-child(3),#demo-row',{opacity:0,duration:.06},reopen-.06);tl.to('#demo-form,#demo-app > div:nth-child(3),#demo-row',{opacity:1,duration:.06},Math.min(done,reopen+.52)+.16);en('reopen',reopen");
}
fs.writeFileSync(p,h);}
let h=fs.readFileSync(path.join(root,'index.html'),'utf8');
h=h.replace('src="assets/gsap.min.js"','src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"');
h=h.replace(/<div id="caption-\d+"[\s\S]*?<\/div><\/div>/g,'');h=h.replace(/tl\.fromTo\('#caption-inner-\d+'[^;]+;/g,'');
if(!h.includes('data-composition-id="captions"'))h=h.replace('<div class="progress">',`<div id="slot-captions" class="slot clip" style="z-index:90;pointer-events:none" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="${T.duration}" data-track-index="5" data-track-kind="captions"></div><div class="progress">`);
fs.writeFileSync(path.join(root,'index.html'),h);
fs.writeFileSync(path.join(root,'compositions/captions.html'),`<template><div id="captionRoot" data-composition-id="captions" data-width="1080" data-height="1920" data-duration="${T.duration}"><style>${ff}#captionRoot{position:relative;width:100%;height:100%;pointer-events:none;font-family:SUIT,sans-serif}</style><div class="caption"><div id="captionText" class="captionInner"></div></div></div><script>(()=>{const captions=${JSON.stringify(T.captions)},el=document.getElementById('captionText'),d={t:0};const tl=gsap.timeline({paused:true});tl.to(d,{t:${T.duration},duration:${T.duration},ease:'none',onUpdate:()=>{const c=captions.find(c=>d.t>=c.start&&d.t<c.end);el.textContent=c?c.text:'';el.style.opacity=c?String(Math.min(1,(d.t-c.start)/.09)): '0';el.style.transform=c?'translateY('+Math.max(0,9*(1-(d.t-c.start)/.09))+'px)':'translateY(9px)';}},0);window.__timelines.captions=tl;})();</script></template>`);
console.log('Root-relative assets, local fonts and single caption composition ready.');
