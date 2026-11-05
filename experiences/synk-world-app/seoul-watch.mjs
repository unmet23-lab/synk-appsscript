// 드라마 1화 틀을 고치지 않고 끝을 안다(서울행 설계 6절). 틀이 같은 출처이므로 부모가 읽기만 한다.
// · #epTag 단계 꼬리표가 차례로 바뀔 때 장면 끝을 알린다. 첫 화면 카드에서 바로 새 상황으로 가는 길은 장면 끝으로 안 친다.
// · .wrap이 나오면 말한 줄 수와 테이크 2 · 새 상황을 판마다 한 번 읽는다. 시범판이 바뀌어 못 읽으면 0으로 본다(막지 않는다).
// 시험(tests/seoul-arrival.test.mjs)이 실제 시범판 글(한 · 영 · 몽)과 꼬리표로 이 읽기를 지킨다.

export const EPISODE='s1e01';
export const STEP_TAGS=Object.freeze({scene:'EP.01 · Scene 2',take2:'EP.01 · Take 2',transfer:'New situation',wrap:'EP.01 · Today'});

// 오늘 기록의 첫 줄 글은 언어마다 숫자 차례가 달라(「3줄 중 2줄」 · 「2 of 3」) 작은 값을 말한 줄로 본다.
export function spokenOf(text){const nums=(String(text||'').match(/\d+/g)||[]).map(Number);return nums.length?Math.min(...nums):0;}
export function readWrap(doc){
 const items=doc?.querySelectorAll?.('.wrap .log > li');if(!items?.length)return null;
 const line=items[0].querySelector(':scope > div > p');
 const on=li=>!!li?.querySelector(':scope > .tick.on');
 return {n:spokenOf(line?.textContent),t2:on(items[1]),tr:on(items[2])};
}
// 꼬리표 차례 → 끝난 단계. 상태는 {started,sent:Set}을 넘겨받는다.
export function stepsDone(prev,next,seen){
 const out=[];
 const send=id=>{if(!seen.has(id)){seen.add(id);out.push(`${EPISODE}.${id}`);}};
 if(prev===next)return out;
 if(next===STEP_TAGS.take2&&seen.has('started'))send('scene');
 if(next===STEP_TAGS.transfer){if(seen.has('started'))send('scene');if(prev===STEP_TAGS.take2)send('take2');}
 if(next===STEP_TAGS.wrap){if(seen.has('started'))send('scene');if(prev===STEP_TAGS.take2)send('take2');if(prev===STEP_TAGS.transfer)send('transfer');}
 return out;
}

export function watchEpisode(frame,{onScene=()=>{},onWrap=()=>{}}={}){
 let doc=null,observer=null,tag='',seen=new Set(),wrapped=false,stopped=false,queued=false;
 function inspect(){
  queued=false;if(stopped||!doc)return;
  const next=doc.getElementById('epTag')?.textContent?.trim()||'';
  if(next===STEP_TAGS.scene&&!doc.querySelector('.intro')&&!doc.querySelector('.outside'))seen.add('started');
  if(next!==tag){
   // 다시 하기: 첫 화면으로 돌아오면 이번 판을 새로 센다
   if(next===STEP_TAGS.scene&&tag===STEP_TAGS.wrap){seen=new Set();wrapped=false;}
   for(const id of stepsDone(tag,next,seen))try{onScene({id});}catch{}
   tag=next;
  }
  if(!wrapped){const wrap=readWrap(doc);if(wrap){wrapped=true;try{onWrap(wrap);}catch{}}}
 }
 const later=()=>{if(queued||stopped)return;queued=true;queueMicrotask(inspect);};
 function attach(){
  if(stopped)return;
  try{doc=frame.contentDocument;}catch{doc=null;}
  if(!doc)return;
  observer?.disconnect();
  observer=new (frame.contentWindow?.MutationObserver||MutationObserver)(later);
  observer.observe(doc.documentElement,{subtree:true,childList:true,characterData:true});
  later();
 }
 frame.addEventListener('load',attach);
 if(frame.contentDocument?.readyState==='complete'&&frame.contentDocument.location?.href!=='about:blank')attach();
 return Object.freeze({dispose(){stopped=true;observer?.disconnect();observer=null;frame.removeEventListener('load',attach);},read(){return doc?readWrap(doc):null;}});
}
