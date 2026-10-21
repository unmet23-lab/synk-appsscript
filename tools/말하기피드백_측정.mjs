#!/usr/bin/env node
// WORLD 말하기 피드백 시범 측정(2026-10-21): 합성 학생 음성으로 경로별 비용·지연·결과를 잰다.
//   node tools/말하기피드백_측정.mjs --유료-api [--소리만] [--경로 listen,split,listen-lite,turn,turn-flash] [--듣기모델 gemini-3.6-flash,…] [--사례 c1,c2] [--결과 <파일>] [--다시굽기]
// · 학생 음성은 합성이다(Vertex 음성 합성 → 브라우저 녹음과 같은 webm/opus 32kbps 한 채널). 실제 학생 소리를 쓰지 않는다.
// · 소리 파일은 .tmp/speaking-pilot-20261021/audio/(git 밖)에만 두고, 결과 JSON에는 소리를 넣지 않는다.
// · Claude 키는 SYNK_CLAUDE_KEYS(시험은 synk.yuh 검수 목록)를 쓴다. Vertex는 tools/모델정책.js의 「돈」 문이라 --유료-api가 필요하다.
// 결과: experiences/synk-world-app/qa/speaking-pilot-20261021/측정.json
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {speakingFeedback,speakingTurn} from './lib/말하기호출.mjs';
import {priceVertex,syllables,normalizeFeedback,normalizeTurn,mergeSplit} from './lib/말하기피드백.mjs';
const require=createRequire(import.meta.url);
const 정책=require('./모델정책.js');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const bank=JSON.parse(fs.readFileSync(path.join(root,'experiences/synk-world-app/world-speaking-items.json'),'utf8'));
const audioDir=path.join(root,'.tmp/speaking-pilot-20261021/audio');
// 결과 파일(git 밖). --결과 <파일>로 바꿀 수 있다(경로 묶음을 나눠 잴 때).
const outFile=(i=>i>=0?path.resolve(process.argv[i+1]):path.join(root,'experiences/synk-world-app/qa/speaking-pilot-20261021/측정.json'))(process.argv.indexOf('--결과'));
const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:null;};
const TTS_MODEL='gemini-3.8-flash-tts';

// 학생 역(합성): 문항·대본·목소리·기대(자동 확인). 대본의 말버릇(음…·어…)은 일부러 넣었다.
const LEARNER=['Speaker: an adult Mongolian learner of Korean at beginner-to-intermediate level, speaking to a practice app.',
 'Delivery: a little slow, with short hesitation pauses where the transcript has 음… or 어…, a light non-native accent. Read exactly the transcript and nothing else.'];
const FLUENT=['Speaker: an advanced adult learner of Korean answering a speaking test question.','Delivery: calm, clear and at a natural speed. Read exactly the transcript and nothing else.'];
const CASES=[
 {id:'c1',item:'s1-weekend',voice:'Kore',notes:LEARNER,script:'저는 주말에 보통 집에서 쉬어요. 그리고 친구하고 카페에 가요. 음… 지난 주말에는 친구 생일이었어요. 그래서 같이 식당에서 밥을 먹었어요. 아주 재미있었어요.',expect:{status:'ok',covered:[0,1]}},
 {id:'c2',item:'s1-weekend',voice:'Puck',notes:LEARNER,script:'음… 주말에… 쉬어요.',expect:{status:'ok',withheld:{language:'short'}}},
 {id:'c3',item:'s1-weekend',voice:'Leda',notes:LEARNER,lang:'en',script:'저는 주말에 보통 운동을 했어요. 지난 주말에는 친구를 만나요. 우리는 같이 영화를 봐요. 영화가 정말 재미있어요.',expect:{status:'ok',languageTry:true}},
 {id:'c4',item:'s2-cafe',voice:'Charon',notes:LEARNER,script:'어… 안녕하세요. 차가운 커피 두 개 주세요. 음… 여기서 먹을 거예요.',expect:{status:'ok',covered:[0,1]}},
 {id:'c5',item:'s3-birthday',voice:'Kore',notes:LEARNER,lang:'mn',script:'수아 씨는 친구 생일에 케이크를 샀어요. 그리고 편지를 썼어요. 음… 저녁에 친구한테 꽃을 줬어요. 친구가 아주 좋아했어요.',expect:{status:'ok',covered:[0,1,3],notCovered:[2]}},
 {id:'c6',item:'s4-festival',voice:'Fenrir',notes:LEARNER,script:'그 말도 맞아요. 하지만 시험 전에 축제를 하면 학생들이 공부 때문에 즐길 수 없어요. 그리고 시험이 끝난 다음 날에 하면 고향에 가기 전이니까 사람들이 많이 올 거예요.',expect:{status:'ok',covered:[0,1,2]}},
 {id:'c7',item:'s5-bike',voice:'Leda',notes:FLUENT,script:'자료를 보면 한강 공원의 자전거 대여 건수가 2021년에 120만 건이었는데 2025년에는 340만 건으로 많이 늘었습니다. 이유는 자전거 길이 늘었고 휴대폰으로 쉽게 빌릴 수 있기 때문입니다.',expect:{status:'ok',covered:[0,1],notCovered:[2]}},
 {id:'c8',item:'s6-phone',voice:'Charon',notes:FLUENT,script:'저는 학교에서 휴대폰 사용을 제한하는 것에 찬성합니다. 첫째, 수업 시간에 휴대폰 알림이 오면 학생들이 집중하기 어렵습니다. 둘째, 쉬는 시간에도 휴대폰만 보면 친구들과 이야기할 시간이 줄어듭니다. 물론 급한 연락이 필요할 때도 있으니까 정해진 곳에서만 쓰게 하면 좋겠습니다.',expect:{status:'ok',covered:[0,1,2],noInventedDelivery:true}},
 {id:'c9',item:'s6-phone',voice:'Puck',notes:LEARNER,script:'저는 휴대폰으로 음악을 자주 들어요. 요즘 한국 노래를 좋아해요. 특히 아이돌 노래를 많이 들어요.',expect:{status:'ok',coveredMax:0}},
 {id:'c10',item:'s1-weekend',noise:true,expect:{status:'no_speech'}},
 {id:'c11',item:'s1-weekend',voice:'Kore',notes:['Language: English. Speaker: a learner who answers in English by mistake.','Delivery: natural speed.'],script:'I usually go hiking on weekends. Last weekend I visited my grandmother.',expect:{status:'not_korean'}},
 // 역할극 차례
 {id:'r1',roleplay:'rp-cafe-tea',step:'order',voice:'Kore',notes:LEARNER,script:'따뜻한 차 두 잔 주세요.',expect:{next:'confirm',polite:'yes'}},
 {id:'r2',roleplay:'rp-cafe-tea',step:'order',voice:'Puck',notes:LEARNER,script:'음… 따뜻한 차 주세요.',expect:{next:'count'}},
 {id:'r3',roleplay:'rp-cafe-tea',step:'order',voice:'Leda',notes:LEARNER,script:'차가운 주스 두 잔 주세요.',expect:{next:'soldout'}},
 {id:'r4',roleplay:'rp-cafe-tea',step:'place',voice:'Charon',notes:LEARNER,script:'가져갈게요.',expect:{next:'place',hint:'place'}},
 {id:'r5',roleplay:'rp-cafe-tea',step:'confirm',voice:'Kore',notes:LEARNER,script:'네, 맞아요.',expect:{next:'place'}},
 {id:'r6',roleplay:'rp-cafe-tea',step:'order',voice:'Fenrir',notes:LEARNER,script:'따뜻한 차 두 잔 줘.',expect:{next:'confirm',polite:'no'}},
 {id:'r7',roleplay:'rp-cafe-tea',step:'order',noise:true,expect:{status:'no_speech'}}
];

const NOTE=lines=>["### DIRECTOR'S NOTES (never read these notes aloud)",...lines,'','### TRANSCRIPT'].join('\n');
function ffmpeg(args){const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y',...args],{encoding:'utf8'});if(r.status!==0)throw Error('ffmpeg: '+r.stderr);}
function probeSeconds(file){const r=spawnSync('ffprobe',['-v','error','-show_entries','format=duration','-of','csv=p=0',file],{encoding:'utf8'});return Number(r.stdout.trim())||null;}
// 브라우저 녹음(MediaRecorder)과 같은 꼴: webm/opus 한 채널 32kbps.
const toWebm=(input,out,inputArgs=[])=>ffmpeg([...inputArgs,'-i',input,'-ac','1','-ar','48000','-c:a','libopus','-b:a','32k',out]);

async function synth(c){
 fs.mkdirSync(audioDir,{recursive:true});
 const out=path.join(audioDir,`${c.id}.webm`);
 if(fs.existsSync(out)&&!process.argv.includes('--다시굽기'))return {file:out,seconds:probeSeconds(out),cached:true};
 if(c.noise){ffmpeg(['-f','lavfi','-i','anoisesrc=color=brown:amplitude=0.02:duration=4','-ac','1','-ar','48000','-c:a','libopus','-b:a','32k',out]);return {file:out,seconds:probeSeconds(out),usage:null,cost:null};}
 const url=정책.제미나이URL('돈',TTS_MODEL);
 const body={contents:[{role:'user',parts:[{text:NOTE(c.notes)+'\n'+c.script}]}],generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:c.voice}}}}};
 for(let attempt=1;attempt<=3;attempt++){
  const r=await fetch(url,{method:'POST',headers:await 정책.제미나이헤더('돈'),body:JSON.stringify(body)});
  const j=await r.json().catch(()=>({}));
  if(r.status===429||r.status>=500){await new Promise(res=>setTimeout(res,4000*attempt));continue;}
  if(!r.ok)throw Error(`TTS ${r.status}: ${j.error?.message}`);
  const part=j.candidates?.[0]?.content?.parts?.find(p=>p.inlineData);if(!part)throw Error('TTS 소리 없음');
  const raw=path.join(audioDir,`${c.id}.tts`),mime=part.inlineData.mimeType||'';fs.writeFileSync(raw,Buffer.from(part.inlineData.data,'base64'));
  const rate=Number(mime.match(/rate=(\d+)/)?.[1])||24000;
  if(/wav/i.test(mime))toWebm(raw,out);else toWebm(raw,out,['-f','s16le','-ar',String(rate),'-ac','1']);
  fs.rmSync(raw);
  // 음성 합성 값: 글 입력 + 소리 출력(초당 25토큰 어림 대신 usage를 그대로 쓴다)
  const u=j.usageMetadata||{},cost=((u.promptTokenCount||0)*.5+(u.candidatesTokenCount||0)*9)/1e6;
  return {file:out,seconds:probeSeconds(out),usage:u,cost};
 }
 throw Error('TTS 세 번 실패');
}

// 받아 적은 말이 대본과 얼마나 같은가(한글 음절 기준, 순서 무시한 겹침 비율 — 합성 음성의 어긋남·받아쓰기 확인용 어림).
function overlap(a,b){const A=(a.match(/[가-힣]/g)||[]),B=(b.match(/[가-힣]/g)||[]);if(!A.length||!B.length)return null;const bag=new Map();for(const ch of B)bag.set(ch,(bag.get(ch)||0)+1);let hit=0;for(const ch of A){const n=bag.get(ch)||0;if(n){hit++;bag.set(ch,n-1);}}return +(2*hit/(A.length+B.length)).toFixed(3);}

function checkExam(c,result){
 const e=c.expect,fails=[];
 // 잡음만 든 녹음은 「말 없음」이든 「잘 안 들림」이든 다시 녹음을 권하고 세지 않으면 맞다.
 if(result.status!==e.status&&!(e.status==='no_speech'&&result.status==='unclear'))fails.push(`status ${result.status}≠${e.status}`);
 if(result.status==='ok'){
  for(const i of e.covered||[])if(!result.covered.includes(i))fails.push(`covered에 ${i+1} 없음`);
  for(const i of e.notCovered||[])if(result.covered.includes(i))fails.push(`covered에 ${i+1}이 있으면 안 됨`);
  if(Number.isInteger(e.coveredMax)&&result.covered.length>e.coveredMax)fails.push(`covered ${result.covered.length}개(최대 ${e.coveredMax})`);
  for(const [k,v]of Object.entries(e.withheld||{}))if(result.elements[k]?.withheld!==v)fails.push(`${k} 보류(${v}) 아님`);
  if(e.languageTry&&!(result.elements.language?.try||result.elements.language?.better))fails.push('언어 사용 고칠 점 없음');
 }
 return fails;
}
function checkTurn(c,result){
 const e=c.expect,fails=[];
 if(e.status){if(result.status===e.status||e.status==='no_speech'&&result.status==='unclear')return fails;fails.push(`status ${result.status}≠${e.status}`);return fails;}
 if(result.status!=='ok'){fails.push(`status ${result.status}`);return fails;}
 if(e.next&&result.next.step!==e.next)fails.push(`next ${result.next.step}≠${e.next}`);
 if(e.hint&&result.next.hint!==e.hint)fails.push(`hint ${result.next.hint}≠${e.hint}`);
 if(e.polite&&result.polite!==e.polite)fails.push(`polite ${result.polite}≠${e.polite}`);
 return fails;
}

// 경로별 요약: 오류 수·통과·다시 보냄·지연(중앙·90%)·평균 값(정가·할인가)·소리 1분당 값·받아쓰기 겹침.
export function summarize(runs){
 const summary={};
 for(const route of [...new Set(runs.map(r=>r.route))]){
  const all=runs.filter(r=>r.route===route),rows=all.filter(r=>!r.error);if(!rows.length){summary[route]={runs:all.length,errors:all.length};continue;}
  const sorted=rows.map(r=>r.ms).sort((a,b)=>a-b),pick=q=>sorted[Math.min(sorted.length-1,Math.floor(q*(sorted.length-1)+.5))];
  const per=rows.filter(r=>r.result?.status==='ok');
  summary[route]={runs:all.length,errors:all.length-rows.length,pass:rows.filter(r=>r.pass).length,retries:rows.reduce((n,r)=>n+r.calls.reduce((m,c)=>m+(c.retries||0),0),0),msMedian:pick(.5),msP90:pick(.9),
   costAvgList:+(rows.reduce((n,r)=>n+r.cost.list,0)/rows.length).toFixed(6),costAvgPromo:+(rows.reduce((n,r)=>n+r.cost.promo,0)/rows.length).toFixed(6),
   costPerAudioMinuteList:+(rows.reduce((n,r)=>n+r.cost.list,0)/Math.max(1,rows.reduce((n,r)=>n+(r.audioSeconds||0),0))*60).toFixed(6),
   matchAvg:+(per.reduce((n,r)=>n+(r.match||0),0)/Math.max(1,per.length)).toFixed(3)};
 }
 return summary;
}

// ── 보고(측정.md) ── node tools/말하기피드백_측정.mjs --보고 <측정 JSON…> : 결과 파일들을 합쳐 경로별·사례별 표와 비용 어림을 쓴다(git에 올릴 몫).
// 비용 어림의 쓰임 가정(시범값): 시험 형식 피드백 n번 + 역할극 m차례 / 학생 한 달.
const USE=Object.freeze([{name:'가볍게',exam:12,turns:16,note:'주 3번 · 피드백 1번씩 + 역할극 한 달 4번'},{name:'보통',exam:40,turns:40,note:'주 5번 · 피드백 2번씩 + 역할극 한 달 10번'},{name:'많이',exam:120,turns:120,note:'매일 피드백 4번 + 역할극 매일 1번'}]);
function report(files){
 const sets=files.map(f=>JSON.parse(fs.readFileSync(f,'utf8')));
 // 지금의 서버 정리 규칙(녹음 길이 대비 음절 수 등)과 사례 기대로 저장된 모델 출력을 다시 판정한다(모델을 다시 부르지 않는다).
 const runs=sets.flatMap(s=>s.runs).map(r=>{if(r.error||!r.raw)return r;const c=CASES.find(x=>x.id===r.case);if(!c)return r;
  const item=c.item&&bank.items.find(i=>i.id===c.item),roleplay=c.roleplay&&bank.roleplays.find(x=>x.id===c.roleplay),seconds=r.audioSeconds;
  const result=roleplay?normalizeTurn(r.raw,{roleplay,stepId:c.step,seconds}):r.raw.hear?(r.raw.write?normalizeFeedback(mergeSplit(r.raw.hear,r.raw.write),{item,seconds}):normalizeFeedback({...mergeSplit(r.raw.hear,null),covered:[],task:{good:'-',try:''}},{item,seconds})):normalizeFeedback(r.raw,{item,seconds});
  const fails=roleplay?checkTurn(c,result):checkExam(c,result);return {...r,result,fails,pass:fails.length===0};});
 const summary=summarize(runs);
 const usd=v=>v==null?'—':v<.01?`$${v.toFixed(4)}`:`$${v.toFixed(3)}`,sec=ms=>ms==null?'—':`${(ms/1000).toFixed(1)}초`;
 const lines=['# 말하기 피드백 측정 보고(합성 음성)','',`> ${sets.map(s=>s.measuredAt.slice(0,16).replace('T',' ')+' UTC').join(' · ')} 측정. ${sets[0].note}`,'',
  '## 경로별','','| 경로@듣기 모델 | 시도 | 오류 | 기대와 맞음 | 지연 중앙 · 90% | 1회 평균 정가 · 할인가 | 소리 1분당(정가) | 다시 보냄 |','|---|---:|---:|---:|---|---|---:|---:|'];
 for(const [route,s]of Object.entries(summary))lines.push(s.msMedian==null?`| ${route} | ${s.runs} | ${s.errors} | — | — | — | — | — |`
  :`| ${route} | ${s.runs} | ${s.errors} | ${s.pass}/${s.runs-s.errors} | ${sec(s.msMedian)} · ${sec(s.msP90)} | ${usd(s.costAvgList)} · ${usd(s.costAvgPromo)} | ${usd(s.costPerAudioMinuteList)} | ${s.retries} |`);
 const errs=runs.filter(r=>r.error).reduce((m,r)=>{const k=/429/.test(r.error)?'429 몫 다툼':/timeout|aborted/i.test(r.error)?'시간 초과(45초)':/fetch failed/.test(r.error)?'연결 끊김':r.error.slice(0,40);m[k]=(m[k]||0)+1;return m;},{});
 lines.push('',`오류 종류: ${Object.entries(errs).map(([k,n])=>`${k} ${n}건`).join(' · ')||'없음'}`,'','## 사례별(✓ 기대와 맞음 · ✗ 어긋남 · ! 오류)','');
 const routes=Object.keys(summary),cases=[...new Set(runs.map(r=>r.case))];
 lines.push(`| 사례 | ${routes.join(' | ')} |`,`|---|${routes.map(()=>'---').join('|')}|`);
 for(const c of cases)lines.push(`| ${c} | ${routes.map(route=>{const r=runs.find(x=>x.case===c&&x.route===route);return !r?'':r.error?'!':r.pass?'✓':`✗ ${r.fails.join('; ').replace(/\|/g,'/')}`;}).join(' | ')} |`);
 const turnRoute=summary['turn-blind']?'turn-blind':'turn',turn=summary[turnRoute]?.costAvgList??null;
 lines.push('','## 한 달 비용 어림(정가 기준 · 할인가는 2026-12-31까지 절반)','',`시험 형식 피드백은 경로별 1회 평균, 역할극 차례는 \`${turnRoute}\` 1회 평균으로 셈한다.`,'');
 lines.push(`| 시험 형식 경로 | ${USE.map(u=>`${u.name}(${u.note})`).join(' | ')} | 학생 100명 · 1,000명 · 10,000명(보통) |`,`|---|${USE.map(()=>'---:').join('|')}|---|`);
 for(const [route,s]of Object.entries(summary)){if(route.startsWith('turn')||s.costAvgList==null)continue;
  const per=u=>u.exam*s.costAvgList+u.turns*(turn??0),mid=per(USE[1]);
  lines.push(`| ${route} | ${USE.map(u=>usd(per(u))).join(' | ')} | ${[100,1000,10000].map(n=>`$${(mid*n).toFixed(n>=1000?0:2)}`).join(' · ')} |`);}
 lines.push('','학생 한 명의 AI 금액 통(쓰기·전사·교정과 같이 씀): 하루 $0.05 · 한 달 $0.30(10-05 운영 시험값). 위 「보통」이 이 통에 들어가는지를 경로 고르기의 기준으로 본다.');
 return lines.join('\n')+'\n';
}

async function main(){
 if(process.argv.includes('--보고')){const files=process.argv.slice(process.argv.indexOf('--보고')+1).filter(a=>!a.startsWith('--'));const md=report(files);
  const file=path.join(root,'experiences/synk-world-app/qa/speaking-pilot-20261021/측정.md');fs.writeFileSync(file,md);console.log(md);return;}
 정책.유료API요구('WORLD 말하기 시범 측정(Vertex)');
 const only=arg('--사례')?.split(','),routes=(arg('--경로')||'listen,split,listen-lite,turn,turn-flash').split(',');
 // --듣기모델 gemini-3.6-flash,gemini-3.7-flash: 플래시 층 경로(listen·split·turn-flash)의 듣기 모델을 바꿔 가며 잰다(이름은 경로@모델).
 const hearModels=arg('--듣기모델')?.split(',')||[null];
 const cases=CASES.filter(c=>!only||only.includes(c.id));
 const prior=fs.existsSync(outFile)?JSON.parse(fs.readFileSync(outFile,'utf8')):null;
 const runs=[],tts=[];
 // 사례가 끝날 때마다 결과 파일을 다시 쓴다(중간에 끊겨도 잰 것은 남는다).
 const save=()=>{
  const out={version:1,measuredAt:new Date().toISOString(),note:'합성 학생 음성(Vertex 음성 합성 → webm/opus 32kbps 한 채널)으로 잰 시범 값. 실제 학생의 발음·주변 소리·길이 분포가 아니다. 가격은 tools/lib/말하기피드백.mjs PRICES(2026-10-21 확인)로 셈한 추정이며 청구서가 아니다.',
   prices:'tools/lib/말하기피드백.mjs PRICES',tts,summary:summarize(runs),runs:(prior&&only?[...prior.runs.filter(r=>!only.includes(r.case)||!routes.includes(r.route.split('@')[0])),...runs]:runs)};
  fs.mkdirSync(path.dirname(outFile),{recursive:true});fs.writeFileSync(outFile,JSON.stringify(out,null,1)+'\n');return out;
 };
 for(const c of cases){
  const audio=await synth(c);tts.push({id:c.id,seconds:audio.seconds,cost:audio.cost??null,cached:!!audio.cached});
  console.log(`· ${c.id} 소리 ${audio.seconds?.toFixed(1)}초${audio.cached?' (전에 구운 것)':''}`);
 }
 if(process.argv.includes('--소리만'))return;
 for(const c of cases){
  const data=fs.readFileSync(path.join(audioDir,`${c.id}.webm`)),audio={mime:'audio/webm',data},seconds=probeSeconds(path.join(audioDir,`${c.id}.webm`));
  const item=c.item&&bank.items.find(i=>i.id===c.item),roleplay=c.roleplay&&bank.roleplays.find(r=>r.id===c.roleplay);
  for(const route of routes)for(const hearModel of ['listen','split','turn-flash'].includes(route)?hearModels:[null]){
   if(!!roleplay!==route.startsWith('turn'))continue;
   const at=new Date().toISOString(),label=hearModel?`${route}@${hearModel}`:route;
   try{
    const run=roleplay?await speakingTurn({route,roleplay,stepId:c.step,audio,lang:c.lang||'ko',hearModel,seconds}):await speakingFeedback({route,item,types:bank.types,audio,lang:c.lang||'ko',hearModel,seconds});
    const result=run.result,fails=roleplay?checkTurn(c,result):checkExam(c,result);
    const transcript=roleplay?result.heard:result.heard?.transcript;
    const cost={list:run.calls.reduce((n,x)=>n+(x.cost?.list||0),0),promo:run.calls.reduce((n,x)=>n+(x.cost?.promo??x.cost?.list??0),0)};
    runs.push({case:c.id,route:label,lang:c.lang||'ko',at,audioSeconds:seconds,ms:run.ms,cost,calls:run.calls,match:c.script?overlap(transcript||'',c.script):null,pass:fails.length===0,fails,result,raw:run.raw});
    console.log(`  ${c.id} ${label.padEnd(30)} ${String(run.ms).padStart(6)}ms  $${cost.list.toFixed(5)} (할인 $${cost.promo.toFixed(5)})  ${fails.length?'✗ '+fails.join('; '):'✓'}`);
   }catch(error){runs.push({case:c.id,route:label,at,error:String(error.message).slice(0,300),pass:false});console.log(`  ${c.id} ${label} 오류 ${error.message}`);}
  }
  save();
 }
 const out=save();
 console.log('\n경로별 요약:',JSON.stringify(out.summary,null,1));
 console.log(`음성 합성 값: $${tts.reduce((n,x)=>n+(x.cost||0),0).toFixed(4)} · 결과 ${path.relative(root,outFile)}`);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
