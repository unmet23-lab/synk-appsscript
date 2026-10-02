export const ORDERS=[
 {id:'o01',text:'따뜻한 커피 한 잔 주세요.',skill:'온도 · 수량',cups:[{base:'coffee',milk:false,temp:'hot',ice:false}]},
 {id:'o02',text:'아이스커피 한 잔 주세요.',skill:'음료 · 온도',cups:[{base:'coffee',milk:false,temp:'cold',ice:true}]},
 {id:'o03',text:'따뜻한 차 한 잔 주세요. 설탕은 빼 주세요.',skill:'부정 · 제외',cups:[{base:'tea',milk:false,temp:'hot',ice:false,sugar:false}]},
 {id:'o04',text:'아이스라테 한 잔 주세요.',skill:'음료 조합',cups:[{base:'coffee',milk:true,temp:'cold',ice:true}]},
 {id:'o05',text:'따뜻한 커피 한 잔 주세요. 설탕도 넣어 주세요.',skill:'추가 요청',cups:[{base:'coffee',milk:false,temp:'hot',ice:false,sugar:true}]},
 {id:'o06',text:'아이스커피 두 잔 주세요. 한 잔은 얼음 빼 주세요.',skill:'수량 · 서로 다른 조건',cups:[{base:'coffee',milk:false,temp:'cold',ice:true},{base:'coffee',milk:false,temp:'cold',ice:false}]},
 {id:'o07',text:'따뜻한 라테 한 잔 주세요. 설탕 없이요.',skill:'부정 표현',cups:[{base:'coffee',milk:true,temp:'hot',ice:false,sugar:false}]},
 {id:'o08',text:'차 두 잔 차갑게 주세요. 둘 다 설탕은 빼 주세요.',skill:'둘 다 · 조건',cups:[{base:'tea',milk:false,temp:'cold',sugar:false},{base:'tea',milk:false,temp:'cold',sugar:false}]},
 {id:'o09',text:'따뜻한 커피 대신 차 한 잔 주세요.',skill:'대신 · 변경',cups:[{base:'tea',milk:false,temp:'hot',ice:false}]},
 {id:'o10',text:'라테 한 잔하고 커피 한 잔 주세요. 둘 다 아이스로요.',skill:'음료 구별 · 둘 다',cups:[{base:'coffee',milk:true,temp:'cold',ice:true},{base:'coffee',milk:false,temp:'cold',ice:true}]},
 {id:'o11',text:'차 한 잔에 얼음 넣어 주세요. 설탕은 넣지 마세요.',skill:'추가 · 금지',cups:[{base:'tea',milk:false,temp:'cold',ice:true,sugar:false}]},
 {id:'o12',text:'커피 두 잔 주세요. 하나는 따뜻하게, 다른 하나는 차갑게요.',skill:'하나 · 다른 하나',cups:[{base:'coffee',milk:false,temp:'hot',ice:false},{base:'coffee',milk:false,temp:'cold'}]}
];
export const REVIEW=[
 {id:'r01',text:'아이스라테 대신 아이스커피 한 잔 주세요.',skill:'새 문장 · 대신',cups:[{base:'coffee',milk:false,temp:'cold',ice:true}]},
 {id:'r02',text:'따뜻한 차 두 잔 주세요. 한 잔만 설탕을 넣어 주세요.',skill:'새 문장 · 한 잔만',cups:[{base:'tea',milk:false,temp:'hot',ice:false,sugar:true},{base:'tea',milk:false,temp:'hot',ice:false,sugar:false}]},
 {id:'r03',text:'아이스라테 두 잔 주세요. 둘 다 얼음 없이요.',skill:'새 문장 · 둘 다',cups:[{base:'coffee',milk:true,temp:'cold',ice:false},{base:'coffee',milk:true,temp:'cold',ice:false}]}
];
export const makeCup=()=>({base:null,milk:false,temp:'hot',ice:false,sugar:false});
export function editCup(cup,action){
 const c={...cup};
 if(action==='coffee'||action==='tea'){c.base=c.base===action?null:action;if(action==='tea'||!c.base)c.milk=false;}
 if(action==='milk')c.milk=!c.milk;
 if(action==='ice'){c.ice=!c.ice;if(c.ice)c.temp='cold';}
 if(action==='sugar')c.sugar=!c.sugar;
 if(action==='cold'){c.temp=c.temp==='cold'?'hot':'cold';if(c.temp==='hot')c.ice=false;}
 return c;
}
export function describeCup(c){if(!c.base)return '빈 컵';return `${c.temp==='hot'?'따뜻한':'차가운'} ${c.base==='tea'?(c.milk?'우유를 넣은 차':'차'):c.milk?'라테':'커피'} · ${c.ice?'얼음 있음':'얼음 없음'} · ${c.sugar?'설탕 있음':'설탕 없음'}`;}
const match=(c,e)=>Object.entries(e).every(([k,v])=>c[k]===v);
export function judgeOrder(order,cups){
 if(cups.length!==order.cups.length)return {correct:false,feedback:`${order.cups.length===1?'한':'두'} 잔을 부탁했어요. 컵 수를 다시 확인해 주세요.`,kind:'quantity'};
 const targets=order.cups;
 if(targets.every((e,i)=>match(cups[i],e))||(cups.length===2&&targets.every((e,i)=>match(cups[1-i],e))))return {correct:true,feedback:'주문대로 만들었어요. 고맙습니다!',kind:'correct'};
 const closest=targets.map(e=>({e,c:cups.reduce((a,b)=>Object.keys(e).filter(k=>a[k]!==e[k]).length<=Object.keys(e).filter(k=>b[k]!==e[k]).length?a:b)})).find(({e,c})=>!match(c,e))||{e:targets[0],c:cups[0]};
 const {e,c}=closest;
 if(c.base!==e.base)return {correct:false,feedback:e.base==='tea'?'커피가 아니라 차를 부탁했어요.':'커피를 부탁했어요. 음료를 다시 확인해 주세요.',kind:'drink'};
 if(c.milk!==e.milk)return {correct:false,feedback:e.milk?'라테에는 우유가 들어가요.':'우유가 없는 음료를 부탁했어요.',kind:'milk'};
 if(c.temp!==e.temp)return {correct:false,feedback:e.temp==='hot'?'따뜻하게 부탁했어요.':'차갑게 부탁했어요.',kind:'temperature'};
 if('ice'in e&&c.ice!==e.ice)return {correct:false,feedback:e.ice?'얼음이 들어간 음료를 부탁했어요.':'얼음은 빼 달라고 했어요.',kind:'ice'};
 if('sugar'in e&&c.sugar!==e.sugar)return {correct:false,feedback:e.sugar?'설탕을 넣어 달라고 했어요.':'설탕은 빼 달라고 했어요.',kind:'sugar'};
 return {correct:false,feedback:'두 잔의 조건이 달라요. 주문을 다시 들어보세요.',kind:'combination'};
}
export class CafeSession{
 constructor(mode='practice',seed=1234,{deck=null,selectOrder=null,orderLimit=null}={}){this.mode=mode;this.time=0;this.queue=[];this.records=[];this.score=0;this.combo=0;this.best=0;this.serial=0;this.nextSpawn=8;this.done=false;this.deck=deck|| (mode==='practice'?ORDERS.slice(0,8):[...ORDERS]);this.selectOrder=selectOrder;this.orderLimit=orderLimit??this.deck.length;this.selectedOrderIds=new Set();let s=seed;this.random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};this.spawn();}
 spawn(){if(this.queue.length>=3||this.done)return;
  if(this.mode==='practice'&&this.serial>=this.orderLimit){this.done=true;return;}
  let order;
  if(this.selectOrder){
   let candidates=this.deck.filter(item=>!this.selectedOrderIds.has(item.id));
   if(!candidates.length&&this.mode==='rush'){this.selectedOrderIds.clear();candidates=this.deck.filter(item=>!this.queue.some(t=>t.order.id===item.id));}
   if(candidates.length){const selected=this.selectOrder(candidates);order=candidates.find(item=>item.id===selected?.id)||candidates[0];this.selectedOrderIds.add(order.id);}
  }else order=this.mode==='practice'?this.deck[this.serial]:this.deck[Math.floor(this.random()*this.deck.length)];
  if(!order){this.done=true;return;}this.queue.push({uid:++this.serial,order,born:this.time,help:false,attempts:0,first:null});}
 step(dt){if(this.done)return;this.time+=Math.max(0,dt);if(this.mode==='rush'){for(const ticket of [...this.queue])if(this.time-ticket.born>=42){this.records.push({...ticket,outcome:'missed'});this.queue=this.queue.filter(t=>t!==ticket);this.combo=0;}if(this.time>=90){this.finish();return;}if(this.time>=this.nextSpawn){this.nextSpawn=this.time+10;this.spawn();}}}
 submit(uid,cups){const ticket=this.queue.find(t=>t.uid===uid);if(!ticket||this.done)return null;const result=judgeOrder(ticket.order,cups);ticket.attempts++;if(ticket.first===null)ticket.first=result.correct;if(result.correct){this.combo++;this.best=Math.max(this.best,this.combo);this.score+=100+Math.min(60,this.combo*10);this.records.push({...ticket,outcome:'served'});this.queue=this.queue.filter(t=>t!==ticket);if(this.mode==='practice')this.spawn();}else this.combo=0;return result;}
 finish(){if(this.done)return;for(const t of this.queue)this.records.push({...t,outcome:'unanswered'});this.queue=[];this.done=true;}
 stats(){const answered=this.records.filter(r=>r.first!==null);return {served:this.records.filter(r=>r.outcome==='served').length,answered:answered.length,firstCorrect:answered.filter(r=>r.first).length,help:answered.filter(r=>r.help).length,unanswered:this.records.filter(r=>r.first===null).length};}
}
