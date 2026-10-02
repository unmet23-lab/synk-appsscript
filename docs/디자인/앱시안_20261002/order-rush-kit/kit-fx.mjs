// SNS 키트 모션을 주문 폭주 화면에 옮긴 표현 전용 모듈(2026-10-02 시안).
// 게임 규칙·점수·학습 기록·소리는 건드리지 않는다. 화면에 보이는 반응만 맡는다.
// 원문: docs/디자인/SNS키트/README.md §9, motion.js(punch·crayon·count·paper).
// 마스코트는 흔들거나 떠다니지 않는다. 화면 흔들기·번쩍임 없음. 모션 줄이기 설정이면 모두 건너뛴다.
const $=id=>document.getElementById(id);
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

// 틀린 조건을 가리키는 낱말. core.mjs가 돌려준 문장에서 찾기만 하고 문장은 바꾸지 않는다.
const WORDS={quantity:/[한두] 잔/,drink:/차를|커피를/,milk:/우유가 없는|우유/,temperature:/따뜻하게|차갑게/,ice:/얼음이 들어간|얼음은 빼/,sugar:/설탕을 넣어|설탕은 빼/,combination:/두 잔의 조건/};

// 펀치(M.punch): 한 번 커졌다 제자리. 0.08초에 올라가고 0.7초에 돌아온다
export function punch(el,to=1.16){
 if(!el?.animate||calm())return;
 el.animate([{transform:'scale(1)',easing:'cubic-bezier(.16,1,.3,1)'},{transform:`scale(${to})`,offset:.1,easing:'cubic-bezier(.33,1,.68,1)'},{transform:'scale(1)'}],{duration:780});
}

// 맞게 서빙: 도장·몽글·펠트 점은 #celebration이 보일 때 CSS가 한 번 붙인다. 여기서는 콤보 숫자만 펀치
export function served(){punch($('combo')?.closest('.hud'));}

// 틀리게 서빙: 안내 문장 속 조건 낱말에 크레용 동그라미(M.crayon). 글자 내용은 그대로 둔다
export function missed(kind){
 const box=$('feedback'),re=WORDS[kind];if(!box||!re)return;
 const text=box.textContent,m=re.exec(text);if(!m)return;
 const ring=document.createElement('span');ring.className='ring';ring.textContent=m[0];
 box.replaceChildren(text.slice(0,m.index),ring,text.slice(m.index+m[0].length));
}

// 결과 점수 세기(M.count): 0에서 실제 점수까지 0.9초
export function results(){
 const b=document.querySelector('#result-metrics>div:first-child b');if(!b)return;
 const to=Number(b.textContent);if(!(to>0)||calm())return;
 const t0=performance.now(),dur=900;b.textContent='0';
 const step=now=>{const p=Math.min(1,(now-t0)/dur);b.textContent=String(Math.round(to*(1-(1-p)**3)));if(p<1)requestAnimationFrame(step);};
 requestAnimationFrame(step);
}

// 주문서 번호: 지금 고른 손님 번호를 주문서 머리에 옮겨 적고, 새 손님이면 종이가 한 번 올라와 앉는다(M.paper)
function watchSlip(){
 const q=$('queue'),no=$('slip-no'),slip=no?.closest('.slip');if(!q||!no)return;
 let last=null;
 const sync=()=>{
  const s=q.querySelector('.customer[aria-pressed="true"] strong'),n=s?s.textContent.replace(/\D/g,''):'--';
  if(n===last)return;no.textContent=n;
  if(last!==null&&n!=='--'&&slip?.animate&&!calm())slip.animate([{transform:'translateY(16px) rotate(1.5deg)',opacity:0},{transform:'none',opacity:1}],{duration:340,easing:'cubic-bezier(.22,1,.36,1)'});
  last=n;
 };
 new MutationObserver(sync).observe(q,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-pressed']});sync();
}
watchSlip();
