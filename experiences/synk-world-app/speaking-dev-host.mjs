// 말하기 연습 시범의 로컬 서버 몫(2026-10-21): WORLD 개발 서버(server.mjs)의 리허설 모드 /api/world/speaking만 이것을 부른다.
// 운영 통로가 아니다 — 운영은 SYNK-talk world-speaking 함수(설계.md §5)이고, 이 파일은 공개 빌드에 들어가지 않는다.
// · 기본은 꺼짐: {enabled:false}와 status 'off'만 답한다. SYNK_WORLD_SPEAKING_DEV=1과 SYNK_ALLOW_PAID_API=1을 같이 주고 띄웠을 때만
//   실제 모델(소리는 Vertex, 글은 Claude 또는 Vertex)을 부른다. 경로는 SYNK_WORLD_SPEAKING_ROUTE(기본 blind-claude — 측정 보고 참고),
//   역할극은 SYNK_WORLD_SPEAKING_TURN_ROUTE(기본 turn-blind: 문제를 가린 받아 적기 + 규칙으로 주문 칸).
// · 받은 소리·받아 적은 말은 파일·로그에 남기지 않는다. 콘솔에는 경로·모델·시간·추정 금액만 찍는다.
// · 서버 계약(운영 함수 SYNK-talk world-speaking과 같은 꼴·같은 검사 순서): {action:'status'} → {ok,enabled,dailyLimit,remaining,itemsVersion} ·
//   {action:'feedback'|'turn', request_id, consent:'send-once', item_id|roleplay_id+step_id, items_version(은행 contentHash), lang, audio:{mime,data}, seconds} →
//   {ok:true,status:'ok',feedback|turn} 또는 {ok:true,status:'off'|'limit'|'done_before'|'too_long'|'unavailable'}. 형식 오류는 400, 문항이 바뀌었으면 409.
//   운영 함수와 다른 점: 하루 횟수는 이 프로세스 메모리로 세고, 역할극 차례는 세지 않으며, 금액 원장과 검수 전 문항 닫기가 없다(리허설 시범값).
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

const MIMES=new Set(['audio/webm','audio/ogg','audio/mp4','audio/wav','audio/x-wav','audio/mpeg']);
const MAX_BASE64=1900000;

export function createSpeakingDevHost({enabled=process.env.SYNK_WORLD_SPEAKING_DEV==='1',route=process.env.SYNK_WORLD_SPEAKING_ROUTE||'blind-claude',turnRoute=process.env.SYNK_WORLD_SPEAKING_TURN_ROUTE||'turn-blind',dailyLimit=Number(process.env.SYNK_WORLD_SPEAKING_DAILY||10),log=console.log,caller=null}={}){
 const bank=JSON.parse(fs.readFileSync(fileURLToPath(new URL('./world-speaking-items.json',import.meta.url)),'utf8'));
 const used=new Map(),seen=new Set();
 const day=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
 const count=id=>used.get(`${day()}|${id}`)||0;
 let lib=caller;
 const load=async()=>lib||=await import('../../tools/lib/말하기호출.mjs');
 // 오류 몸통은 운영 함수 꼴(code)과 리허설 클라이언트(world-client.mjs)가 읽는 꼴(error.code)을 함께 싣는다(10-21 Fable 검수).
 const bad=(code,status=400)=>({status,body:{ok:false,code,error:{code}}});
 async function handle(accountId,raw){
  let input;try{input=JSON.parse(Buffer.isBuffer(raw)?raw.toString('utf8'):String(raw||''));}catch{return bad('INVALID_JSON');}
  if(!input||typeof input!=='object')return bad('INVALID_JSON');
  if(input.action==='status')return {status:200,body:{ok:true,accountId,enabled,dailyLimit,remaining:Math.max(0,dailyLimit-count(accountId)),itemsVersion:bank.contentHash}};
  if(!['feedback','turn'].includes(input.action))return bad('INVALID_ACTION');
  if(typeof input.request_id!=='string'||!/^[0-9a-f-]{36}$/i.test(input.request_id))return bad('INVALID_REQUEST_ID');
  if(input.consent!=='send-once')return bad('CONSENT_REQUIRED');
  if(!['ko','en','mn'].includes(input.lang))return bad('INVALID_LANGUAGE');
  const lang=input.lang;
  const mime=String(input.audio?.mime||'').split(';')[0].toLowerCase(),data=input.audio?.data;
  if(!MIMES.has(mime)||typeof data!=='string'||!data)return bad('INVALID_AUDIO');
  if(typeof input.seconds!=='number'||!Number.isFinite(input.seconds)||input.seconds<=0)return bad('INVALID_SECONDS');
  if(input.items_version!==bank.contentHash)return bad('ITEM_CHANGED',409);
  let item=null,roleplay=null,step=null;
  if(input.action==='feedback'){item=bank.items.find(i=>i.id===input.item_id);if(!item)return bad('ITEM_CHANGED',409);}
  else{roleplay=(bank.roleplays||[]).find(r=>r.id===input.roleplay_id);step=roleplay?.steps.find(s=>s.id===input.step_id);if(!step)return bad('ITEM_CHANGED',409);}
  const limit=item?bank.types[item.type].answerSec:roleplay.answerSec;
  if(data.length>MAX_BASE64||Number(input.seconds)>limit+5)return {status:200,body:{ok:true,accountId,status:'too_long'}};
  if(!enabled)return {status:200,body:{ok:true,accountId,status:'off'}};
  if(seen.has(input.request_id))return {status:200,body:{ok:true,accountId,status:'done_before'}};
  // 역할극 한 차례는 짧아 하루 횟수에 세지 않는다(시범값 · 운영은 설계.md §7의 한도).
  if(item&&count(accountId)>=dailyLimit)return {status:200,body:{ok:true,accountId,status:'limit',remaining:0}};
  seen.add(input.request_id);if(seen.size>500)seen.delete(seen.values().next().value);
  if(item)used.set(`${day()}|${accountId}`,count(accountId)+1);
  const audio={mime,data:Buffer.from(data,'base64')};
  try{
   const api=await load();
   const seconds=input.seconds;
   const run=item?await api.speakingFeedback({route,item,types:bank.types,audio,lang,seconds}):await api.speakingTurn({route:turnRoute,roleplay,stepId:step.id,audio,lang,seconds});
   const cost=run.calls.reduce((n,c)=>n+(c.cost?.list||0),0);
   log(`[speaking-dev] ${input.action} ${item?.id||`${roleplay.id}/${step.id}`} ${run.route} ${run.calls.map(c=>c.model).join('+')} ${run.ms}ms ≈$${cost.toFixed(5)} → ${run.result.status}`);
   return {status:200,body:{ok:true,accountId,status:'ok',...(item?{feedback:run.result}:{turn:run.result}),remaining:item?Math.max(0,dailyLimit-count(accountId)):undefined}};
  }catch(error){
   log(`[speaking-dev] ${input.action} 실패: ${String(error.message).slice(0,160)}`);
   // 처리 여부를 모르는 실패는 횟수를 돌려주지 않는다(운영 함수와 같은 방향 — 설계.md §5).
   return {status:200,body:{ok:true,accountId,status:'unavailable'}};
  }
 }
 return {handle,enabled};
}
