// PULSE 화면의 움직임 한 곳(2026-11-04). 움직임은 「무엇이 어디로 갔는지」를 보여 줄 때만 쓴다.
// CSP(style-src 'self') 안에서 돌도록 style 속성 글자 대신 Web Animations와 CSSOM만 쓴다. 움직임을 줄이는 설정이면 모두 바로 끝낸다.
export const ease=Object.freeze({
  out:'cubic-bezier(.22,1,.36,1)',   // 들어올 때
  move:'cubic-bezier(.32,.72,0,1)',  // 자리를 옮기거나 시트가 올라올 때
  leave:'cubic-bezier(.4,0,1,1)',    // 나갈 때(짧게만)
});
export const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
const done={finished:Promise.resolve(),cancel(){}};
export function play(el,frames,options={}){
  if(!el?.animate||reduced())return done;
  return el.animate(frames,{fill:'both',easing:ease.out,...options});
}
// 값 근거: 입력 흐름의 전환은 나감 120~150ms · 들어옴 220~300ms, 이동은 8~16px(조사 docs/마케팅/PULSE_의뢰흐름_20261104/README.md 「움직임」).
// 들어오기: 아래에서 올라오며 또렷해진다. 끝나면 붙은 값을 지워 다음 그리기에 영향을 주지 않는다.
export function rise(el,{delay=0,y=12,blur=2,duration=300}={}){
  const animation=play(el,[{opacity:0,transform:`translateY(${y}px)`,filter:`blur(${blur}px)`},{opacity:1,transform:'translateY(0)',filter:'blur(0)'}],{delay,duration});
  return animation.finished.catch(()=>{}).then(()=>{animation.cancel?.();return el;});
}
export function riseAll(list,{gap=26,start=0,...rest}={}){
  return Promise.all([...list].map((el,index)=>rise(el,{...rest,delay:start+Math.min(index,10)*gap})));
}
export function sink(el,{y=-8,blur=0,duration=130}={}){
  const animation=play(el,[{opacity:1,transform:'translateY(0)',filter:'blur(0)'},{opacity:0,transform:`translateY(${y}px)`,filter:`blur(${blur}px)`}],{duration,easing:ease.leave});
  return animation.finished.catch(()=>{}).then(()=>el);
}
// 제목은 어절마다 가린 자리에서 올라온다. 어절을 묶는 띄어쓰기를 그대로 두어 줄바꿈(keep-all)이 바뀌지 않는다.
export function splitWords(el){
  const text=el.textContent||'';el.setAttribute('aria-label',text.replace(/\s+/g,' ').trim());el.textContent='';
  text.split('\n').map(line=>line.trim()).filter(Boolean).forEach(line=>{
    const row=document.createElement('span');row.className='kw-line';
    const words=line.split(/\s+/).filter(Boolean);
    words.forEach((word,index)=>{
      const clip=document.createElement('span'),inner=document.createElement('span');
      clip.className='kw';inner.className='kw-in';inner.textContent=word;clip.setAttribute('aria-hidden','true');clip.append(inner);row.append(clip);
      if(index<words.length-1)row.append(' ');
    });
    el.append(row,' ');
  });
  return [...el.querySelectorAll('.kw-in')];
}
export function revealWords(el,{delay=0,gap=30,duration=460}={}){
  const words=splitWords(el);
  return Promise.all(words.map((word,index)=>{
    const animation=play(word,[{transform:'translateY(108%)'},{transform:'translateY(0)'}],{delay:delay+index*gap,duration});
    return animation.finished.catch(()=>{}).then(()=>animation.cancel?.());
  }));
}
// 스크롤해 처음 보일 때 한 번만 부른다. 관찰할 수 없거나 움직임을 줄이는 설정이면 부르지 않아 처음부터 그대로 보인다.
export function onView(list,run){
  if(typeof IntersectionObserver!=='function'||reduced())return;
  const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);run(entry.target);}});
  [...list].forEach(node=>observer.observe(node));
}
// 자리·크기 바꾸기: 바꾸기 전을 재고 바꾼 뒤 되돌려 놓았다가 제자리로 움직인다.
export function flip(el,mutate,{duration=560,easing=ease.move}={}){
  const before=el.getBoundingClientRect();mutate();
  const after=el.getBoundingClientRect();
  if(!before.width||!after.width||reduced()||!el.animate)return done;
  const dx=before.left-after.left,dy=before.top-after.top,sx=before.width/after.width,sy=before.height/after.height;
  if(!dx&&!dy&&sx===1&&sy===1)return done;
  return play(el,[{transformOrigin:'0 0',transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`},{transformOrigin:'0 0',transform:'none'}],{duration,easing,fill:'none'});
}
// 숫자 굴리기: 값·개수가 바뀐 것을 눈으로 따라가게 한다. format은 그린 뒤 글자를 돌려준다.
const rolling=new WeakMap();
export function roll(el,to,{duration=620,format=value=>String(Math.round(value))}={}){
  const from=Number(el.dataset.value??to);el.dataset.value=to;
  cancelAnimationFrame(rolling.get(el)||0);
  if(reduced()||from===to||!Number.isFinite(from)){el.textContent=format(to);return;}
  const start=performance.now();
  const tick=now=>{const t=Math.min(1,(now-start)/duration),k=1-Math.pow(1-t,4);el.textContent=format(from+(to-from)*k);if(t<1)rolling.set(el,requestAnimationFrame(tick));};
  rolling.set(el,requestAnimationFrame(tick));
}
// 글자가 찍히듯 들어온다. 사람이 읽을 틈을 빼앗지 않게 전체 길이를 짧게 묶는다.
const typing=new WeakMap();
export function typeIn(el,text,{perChar=16,max=420}={}){
  clearInterval(typing.get(el)||0);
  const value=String(text??'');
  if(reduced()||value.length<2){el.textContent=value;return;}
  const chars=[...value],step=Math.max(1,Math.ceil(chars.length*perChar/max));let shown=0;el.textContent='';
  typing.set(el,setInterval(()=>{shown=Math.min(chars.length,shown+step);el.textContent=chars.slice(0,shown).join('');if(shown>=chars.length)clearInterval(typing.get(el));},perChar));
}
// 화면을 통째로 바꿀 때. 지원하지 않는 브라우저는 그냥 바꾼다.
export function swap(update){
  if(reduced()||typeof document.startViewTransition!=='function'){update();return Promise.resolve();}
  return document.startViewTransition(update).finished.catch(()=>{});
}
