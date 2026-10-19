// 하루 만들기 뒤의 확인 질문을 화면 밖에서 계산한다(planner-ui.mjs의 planThenAsk). 결과 직후의 누름이 이 계산(PC 1초 안팎)을 기다리지 않게 한다.
// 지도 경로 함수는 메시지로 넘길 수 없어, 화면과 같은 보행 지도를 직접 읽어 같은 방법으로 만든다.
import { planTravel } from './planner.mjs';
import { createWalkingRouter } from './walking-router.mjs';

let router=null;
function loadRouter(){
 const pending=router??=fetch(new URL('./assets/jongno-walking.json',import.meta.url)).then(response=>{if(!response.ok)throw new Error('map unavailable');return response.json();}).then(createWalkingRouter);
 // 못 읽었으면 다음 질문 때 다시 읽는다.
 pending.catch(()=>{if(router===pending)router=null;});
 return pending;
}
// 첫 질문이 지도 읽기를 기다리지 않게 미리 읽어 둔다.
loadRouter().catch(()=>{});
// 화면은 { token, input, now, feedback, intents, routed, mapStamp }를 보내고 { token, primaryId, question }을 받는다.
// 지도를 못 읽었거나 화면과 다른 판이면 { token, error }를 돌려주고, 화면이 예전처럼 직접 계산한다.
addEventListener('message',async({data})=>{
 const {token,input,now,feedback,intents,routed,mapStamp}=data;
 try{
  const routeLeg=routed?await loadRouter():null;
  if(routeLeg&&(routeLeg.data.sourceTimestamp??null)!==mapStamp)throw new Error('map differs');
  const full=planTravel(input,{now,feedback,intents,routeLeg});
  postMessage({token,primaryId:full.primary?.id??null,question:full.question});
 }catch(error){postMessage({token,error:String(error?.message??error)});}
});
