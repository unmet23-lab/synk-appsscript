// WORLD 말하기 피드백을 실제 모델로 부르는 로컬 통로(2026-10-21 시범·측정용). 운영 통로는 SYNK-talk world-speaking 함수다(설계.md §5).
// · 소리는 Vertex(종량제, 학습에 쓰지 않음)로만 보낸다 — tools/모델정책.js의 「돈」 문(OAuth, --유료-api 필요). 무료 AI Studio 문은 쓰지 않는다.
// · Claude는 tools/lib/클로드키.js의 보내기()로 부른다(키 목록은 SYNK_CLAUDE_KEYS — 시험은 synk.yuh 검수 목록). 소리는 Claude에 가지 않는다.
// · 소리·받아 적은 글을 파일로 남기지 않는다. 부른 쪽이 결과를 기록할 때도 소리는 넣지 않는다.
import {createRequire} from 'node:module';
import {listenPrompt,hearPrompt,blindHearPrompt,writeSystem,writeUser,turnPrompt,LISTEN_SCHEMA,HEAR_SCHEMA,WRITE_SCHEMA,TURN_SCHEMA,vertexSchema,claudeSchema,
 normalizeFeedback,normalizeTurn,mergeSplit,slotsFromText,priceVertex,priceClaude} from './말하기피드백.mjs';
const require=createRequire(import.meta.url);
const 정책=require('../모델정책.js');
const 클로드=require('./클로드키.js');

// 경로(시범값).
// listen·listen-lite = 한 번에(Gemini가 문제를 보며 듣고 세 요소까지) · split = 문제를 보며 듣기(Gemini) → 쓰기(Claude)
// blind-claude·blind-flash = 문제를 보여 주지 않고 받아 적기(Flash-Lite) → 쓰기(Claude 또는 Flash, 글만) · turn = 역할극 한 차례.
// 10-21 측정: 문제를 함께 준 Flash 듣기는 4초 잡음에도 그럴듯한 대답을 지어냈다(c10) — blind 경로가 그 자리를 막는다.
export const ROUTES=Object.freeze({
 listen:Object.freeze({hear:{model:'gemini-3.8-flash',thinking:'low'}}),
 split:Object.freeze({hear:{model:'gemini-3.8-flash',thinking:'low'},write:{provider:'anthropic',model:'claude-sonnet-5-5',effort:'low'}}),
 'listen-lite':Object.freeze({hear:{model:'gemini-3.5-flash-lite'}}),
 'blind-claude':Object.freeze({hear:{model:'gemini-3.5-flash-lite',blind:true},write:{provider:'anthropic',model:'claude-sonnet-5-5',effort:'low'}}),
 'blind-flash':Object.freeze({hear:{model:'gemini-3.5-flash-lite',blind:true},write:{provider:'vertex',model:'gemini-3.6-flash',thinking:'low'}}),
 turn:Object.freeze({hear:{model:'gemini-3.5-flash-lite'}}),
 'turn-blind':Object.freeze({hear:{model:'gemini-3.5-flash-lite',blind:true}}),
 'turn-flash':Object.freeze({hear:{model:'gemini-3.8-flash',thinking:'low'}})
});
const THINKING=new Set(['gemini-3.8-flash','gemini-3.7-flash','gemini-3.6-flash']);

function parseJson(value){try{return JSON.parse(value);}catch{const m=String(value||'').match(/\{[\s\S]*\}/);if(m)try{return JSON.parse(m[0]);}catch{}return null;}}

// 지역: 기본은 전역(global). SYNK_SPEAKING_VERTEX_LOCATION(예: asia-northeast3 서울)이면 그 지역 주소로 부른다.
const vertexUrl=(model,location)=>!location||location==='global'?정책.제미나이URL('돈',model)
 :`https://${location}-aiplatform.googleapis.com/v1/projects/${정책.벌텍스프로젝트()}/locations/${location}/publishers/google/models/${model}:generateContent`;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

/**
 * Vertex generateContent 한 번(소리 + 글). 429·503(몫 다툼)만 2·4·8초 쉬고 다시 보낸다 — 4xx·5xx는 청구되지 않는다(가격 페이지).
 * 시간 초과는 처리됐는지 모르므로 다시 보내지 않는다. 돌려주는 것: {json, usage, modelVersion, ms, cost, retries, location}
 */
export async function callVertex({model,prompt,schema,audio,thinking=null,maxOutput=2048,timeoutMs=45000,retries=3,location=process.env.SYNK_SPEAKING_VERTEX_LOCATION||'global',fetcher=globalThis.fetch}){
 const parts=[];
 if(audio)parts.push({inlineData:{mimeType:audio.mime,data:Buffer.isBuffer(audio.data)?audio.data.toString('base64'):audio.data}});
 parts.push({text:prompt});
 const generationConfig={responseMimeType:'application/json',responseSchema:vertexSchema(schema),maxOutputTokens:maxOutput,temperature:.2};
 if(thinking&&THINKING.has(model))generationConfig.thinkingConfig={thinkingLevel:thinking};
 const payload=JSON.stringify({contents:[{role:'user',parts}],generationConfig});
 const t0=Date.now();let attempt=0;
 for(;;){
  const r=await fetcher(vertexUrl(model,location),{method:'POST',headers:await 정책.제미나이헤더('돈'),body:payload,signal:AbortSignal.timeout(timeoutMs)});
  const body=await r.json().catch(()=>({})),ms=Date.now()-t0;
  if((r.status===429||r.status===503)&&attempt<retries){await sleep(2000*2**attempt);attempt++;continue;}
  if(!r.ok)throw Object.assign(Error(`Vertex ${r.status}: ${String(body?.error?.message||'').slice(0,240)}`),{http:r.status,ms,retries:attempt});
  const textOut=(body.candidates?.[0]?.content?.parts||[]).filter(p=>typeof p.text==='string'&&!p.thought).map(p=>p.text).join('');
  return {json:parseJson(textOut),usage:body.usageMetadata||null,modelVersion:body.modelVersion||null,finish:body.candidates?.[0]?.finishReason||null,ms,retries:attempt,location,cost:priceVertex(model,body.usageMetadata)};
 }
}

/** Claude 한 번(글만). 시스템 글은 캐시한다. 돌려주는 것: {json, usage, ms, cost, keyName} */
export async function callClaude({model,system,user,schema,effort='low',maxTokens=2048,용도='world-speaking-pilot'}){
 const t0=Date.now();
 const {응답,키이름}=await 클로드.보내기({model,max_tokens:maxTokens,system:[{type:'text',text:system,cache_control:{type:'ephemeral'}}],
  messages:[{role:'user',content:user}],output_config:{effort,format:{type:'json_schema',schema:claudeSchema(schema)}}},{용도,시간제한:90000});
 const ms=Date.now()-t0,textOut=(응답.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
 return {json:parseJson(textOut),usage:응답.usage||null,stop:응답.stop_reason,ms,cost:priceClaude(model,응답.usage),keyName:키이름};
}

/** 6유형 문항 하나의 피드백. route: listen | listen-lite | split | blind-claude | blind-flash. audio: {mime, data(Buffer)}, seconds: 녹음 길이(지어낸 받아쓰기 막기). */
export async function speakingFeedback({route='listen',item,types,audio,lang='ko',hearModel=null,seconds=null}){
 const base=ROUTES[route];if(!base||route.startsWith('turn'))throw TypeError(`모르는 경로: ${route}`);
 const plan=hearModel?{...base,hear:{...base.hear,model:hearModel}}:base;
 const t0=Date.now(),calls=[];
 const push=(step,provider,model,r)=>calls.push({step,provider,model,ms:r.ms,usage:r.usage,cost:r.cost,finish:r.finish??r.stop??null,retries:r.retries??0,location:r.location??null});
 if(!plan.write){
  const heard=await callVertex({model:plan.hear.model,thinking:plan.hear.thinking,prompt:listenPrompt({item,types,lang}),schema:LISTEN_SCHEMA,audio});
  push('listen','vertex',plan.hear.model,heard);
  return {route,ms:Date.now()-t0,calls,raw:heard.json,result:normalizeFeedback(heard.json,{item,seconds})};
 }
 const heard=await callVertex({model:plan.hear.model,thinking:plan.hear.thinking,prompt:plan.hear.blind?blindHearPrompt():hearPrompt({item,types}),schema:HEAR_SCHEMA,audio,maxOutput:1536});
 push('hear','vertex',plan.hear.model,heard);
 // 말이 없거나 한국어가 아니거나 거의 안 들리면(또는 녹음 길이에 비해 음절이 너무 많으면) 쓰기 단계를 부르지 않는다 — 돈을 쓰지 않고 다시 녹음을 권한다.
 // 받아 적기 답을 못 읽었으면 말이 없던 것이 아니라 결과를 모르는 것이다(운영 함수와 같이 unavailable — 10-21 아르곤 백엔드 검수).
 const early=heard.json&&typeof heard.json==='object'?normalizeFeedback({...mergeSplit(heard.json,null),covered:[],task:{good:'-',try:''}},{item,seconds}):{status:'unavailable',counted:false};
 if(early.status!=='ok')return {route,ms:Date.now()-t0,calls,raw:{hear:heard.json},result:early};
 const w=plan.write,user=writeUser({item,types,heard:heard.json});
 const write=w.provider==='anthropic'
  ?await callClaude({model:w.model,effort:w.effort,system:writeSystem(lang),user,schema:WRITE_SCHEMA})
  :await callVertex({model:w.model,thinking:w.thinking,prompt:`${writeSystem(lang)}

${user}`,schema:WRITE_SCHEMA});
 push('write',w.provider,w.model,write);
 return {route,ms:Date.now()-t0,calls,raw:{hear:heard.json,write:write.json},result:normalizeFeedback(mergeSplit(heard.json,write.json),{item,seconds})};
}

/** 역할극 한 차례. route: turn | turn-flash */
export async function speakingTurn({route='turn',roleplay,stepId,audio,lang='ko',hearModel=null,seconds=null}){
 const base=ROUTES[route];if(!base||!route.startsWith('turn'))throw TypeError(`모르는 경로: ${route}`);
 const plan=hearModel?{...base,hear:{...base.hear,model:hearModel}}:base;
 const step=roleplay.steps.find(s=>s.id===stepId);if(!step)throw TypeError(`모르는 차례: ${stepId}`);
 if(plan.hear.blind){
  // 문제를 가린 받아 적기 → 주문 칸은 규칙(slotsFromText). 예시 문장은 문항의 것을 쓴다(모델이 새로 만들지 않는다).
  const heard=await callVertex({model:plan.hear.model,prompt:blindHearPrompt(),schema:HEAR_SCHEMA,audio,maxOutput:768});
  const h=heard.json||{},slots=slotsFromText(h.transcript);
  const raw={heard:h.transcript||'',audio:h.audio,...slots,better:step.model,tip:''};
  return {route,ms:heard.ms,calls:[{step:'hear',provider:'vertex',model:plan.hear.model,ms:heard.ms,usage:heard.usage,cost:heard.cost,finish:heard.finish,retries:heard.retries,location:heard.location}],raw,result:normalizeTurn(raw,{roleplay,stepId,seconds})};
 }
 const heard=await callVertex({model:plan.hear.model,thinking:plan.hear.thinking,prompt:turnPrompt({roleplay,step,lang}),schema:TURN_SCHEMA,audio,maxOutput:768});
 return {route,ms:heard.ms,calls:[{step:'turn',provider:'vertex',model:plan.hear.model,ms:heard.ms,usage:heard.usage,cost:heard.cost,finish:heard.finish,retries:heard.retries,location:heard.location}],raw:heard.json,result:normalizeTurn(heard.json,{roleplay,stepId,seconds})};
}
