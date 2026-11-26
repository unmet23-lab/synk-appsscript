/* 고르는 줄의 젤리 알약(유호님 11-27 「굿 훨씬 낫다」, 원천 docs/디자인/synk.im_줄이기_20261125/AI강의_솔리오단락_20261127/짓기.py).
   회색 홈 하나(.jg) 안에서 고른 칸(aria-pressed="true")에만 말랑한 흰 알약이 떠 있고, 옮길 때 앞쪽 끝이 먼저 닿는다.
   화면이 innerHTML로 다시 그려져도 key마다 앞 자리를 기억해 그 자리에서 옮겨 간다. 움직임 줄이기면 바로 옮긴다. */
(function(){
  const at=new Map(),still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css=`
.jg{position:relative;isolation:isolate;display:inline-flex;gap:2px;max-width:100%;padding:4px;border-radius:999px;background:#EBE9E4;box-shadow:inset 0 1px 2px rgba(17,17,19,.09),inset 0 0 0 1px rgba(17,17,19,.04);overflow-x:auto;scrollbar-width:none}
.jg::-webkit-scrollbar{display:none}
.jg>button{position:relative;z-index:1;flex:none;border-radius:999px;background:transparent;transition:color .25s}
.jg>button[disabled]{opacity:.5;cursor:default}
.jg>.jelly{position:absolute;z-index:0;top:4px;bottom:4px;left:0;width:0;border-radius:999px;pointer-events:none;
  background:linear-gradient(180deg,#fff 0%,#fdfcfa 48%,#f2f0eb 100%);
  box-shadow:0 1px 1px rgba(17,17,19,.07),0 10px 18px -10px rgba(17,17,19,.45),inset 0 1px 0 #fff,inset 0 -3px 6px rgba(17,17,19,.06)}
.jg>.jelly::before{content:"";position:absolute;left:10px;right:10px;top:2px;height:46%;border-radius:999px;background:linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,0))}
.jg.dark{background:rgba(255,255,255,.06);box-shadow:inset 0 1px 2px rgba(0,0,0,.5),inset 0 0 0 1px rgba(255,255,255,.05)}
.jg.dark>.jelly{background:linear-gradient(180deg,#3a3c42 0%,#2c2e33 50%,#25272b 100%);box-shadow:0 1px 1px rgba(0,0,0,.4),0 10px 18px -10px rgba(0,0,0,.9),inset 0 1px 0 rgba(255,255,255,.14),inset 0 -3px 6px rgba(0,0,0,.25)}
.jg.dark>.jelly::before{background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,0))}`;
  const st=document.createElement('style');st.textContent=css;document.head.append(st);
  window.jelly=function(bar,key){
    if(!bar)return;
    let j=bar.querySelector(':scope>.jelly');
    if(!j){j=document.createElement('span');j.className='jelly';j.setAttribute('aria-hidden','true');bar.prepend(j);}
    const b=bar.querySelector(':scope>button[aria-pressed="true"]');
    if(!b){j.style.width='0';at.delete(key);return;}
    const to={x:b.offsetLeft,w:b.offsetWidth},prev=at.get(key);
    if(!to.w)return; // 숨은 화면에서는 재지 않는다(보일 때 다시 놓는다)
    j.style.transform='translateX('+to.x+'px)';j.style.width=to.w+'px';
    if(prev&&!still&&j.animate&&(prev.x!==to.x||prev.w!==to.w)){
      const r=to.x>prev.x,L=(a,c,t)=>a+(c-a)*t;
      const l=r?L(prev.x,to.x,.22):L(prev.x,to.x,.78),rr=r?L(prev.x+prev.w,to.x+to.w,.78):L(prev.x+prev.w,to.x+to.w,.22);
      j.animate([{transform:'translateX('+prev.x+'px) scaleY(1)',width:prev.w+'px'},{transform:'translateX('+l+'px) scaleY(.88)',width:(rr-l)+'px',offset:.45},{transform:'translateX('+to.x+'px) scaleY(1.05)',width:to.w+'px',offset:.78},{transform:'translateX('+to.x+'px) scaleY(1)',width:to.w+'px'}],{duration:480,easing:'cubic-bezier(.3,.7,.25,1)'});
    }
    at.set(key,to);
  };
})();
