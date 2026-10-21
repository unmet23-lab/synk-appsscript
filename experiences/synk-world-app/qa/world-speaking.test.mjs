import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {slotsFromText,normalizeFeedback,normalizeTurn,nextStep,audioGate,priceVertex,priceClaude,vertexSchema,claudeSchema,LISTEN_SCHEMA,TURN_SCHEMA,syllables,taskBrief,listenPrompt,reserveEstimate} from '../../../tools/lib/말하기피드백.mjs';
import {SPEAKING_STRINGS,st} from '../world-speaking-strings.mjs';
import {speakingPreviewOn,readSpeakingSummary,SPEAKING_CANDIDATES,SPEAKING_SKILLS,SPEAKING_FLAG_KEY} from '../world-speaking-practice.mjs';
import {createSpeakingDevHost} from '../speaking-dev-host.mjs';
// 말하기 연습 시범(2026-10-21): 문항·공식 시간, 피드백 정리(보류·거름·인용), 역할극 다음 걸음, 값 셈, 플래그 꺼짐, 공개 빌드 밖, 개발 서버 몫.
// 네트워크·모델을 부르지 않는다(개발 서버 몫은 가짜 caller).
const root=fileURLToPath(new URL('../../../',import.meta.url));
const app=path.join(root,'experiences/synk-world-app');
const bank=JSON.parse(fs.readFileSync(path.join(app,'world-speaking-items.json'),'utf8'));
const memory=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)};};

test('문항: 공식 6유형 준비·대답 시간(topik.go.kr 10-21)과 문항 모양·그림·소리 파일',()=>{
 const official={1:[20,30],2:[30,40],3:[40,60],4:[40,60],5:[70,80],6:[70,80]};
 for(const [type,[prep,answer]]of Object.entries(official)){
  assert.equal(bank.types[type].prepSec,prep,`${type}번 준비`);assert.equal(bank.types[type].answerSec,answer,`${type}번 대답`);
  assert.ok(bank.items.some(i=>i.type===Number(type)),`${type}번 문항`);
 }
 assert.deepEqual(bank.basis.elements,['내용 및 과제 수행','언어 사용','발화 전달력']);
 assert.equal(bank.status,'draft');
 for(const it of bank.items){
  assert.ok(it.covers.length>=2&&it.model&&Number.isInteger(it.minSyllables),it.id);
  assert.ok(syllables(it.model)>=it.minSyllables*2,`${it.id} 예시 답은 보류 문턱보다 넉넉히 길다`);
  for(const src of [it.picture?.src,...(it.panels||[]).map(p=>p.src),it.partner?.clip].filter(Boolean))assert.ok(fs.existsSync(path.join(app,src)),`${it.id} ${src}`);
 }
 // 역할극 직원 말은 승인된 카페 목소리 그대로(글이 소리와 같다).
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'experiences/brand-opening/assets/cafe-voice/manifest.json'),'utf8'));
 for(const step of bank.roleplays[0].steps){const clip=path.basename(step.clip,'.mp3');assert.equal(manifest.clips[clip]?.text,step.line,step.id);}
 const s2=bank.items.find(i=>i.id==='s2-cafe');assert.equal(manifest.clips[path.basename(s2.partner.clip,'.mp3')].text,s2.partner.line);
 // 그림 칸 출처: 승인 소품의 지문과 같다.
 const sources=JSON.parse(fs.readFileSync(path.join(app,'speaking-assets/sources.json'),'utf8'));
 for(const [name,row]of Object.entries(sources.panels))for(const from of row.from)assert.ok(fs.existsSync(path.join(root,from.file)),`${name} ← ${from.file}`);
});

test('피드백 정리: 말 없음·한국어 아님·잘 안 들림은 세지 않고, 짧으면 언어 사용을 보류한다',()=>{
 const it=bank.items.find(i=>i.id==='s1-weekend');
 const base={transcript:'저는 주말에 보통 집에서 쉬어요. 지난 주말에는 친구를 만났어요. 같이 영화를 봤어요.',audio:{speech:'clear',language:'ko'},covered:[1,2],task:{good:'두 가지를 말했어요.',try:'이유를 더해 봐요.'},language:{good:'시제를 잘 나눴어요.',try:'이어 주는 말을 써 봐요.',quote:'같이 영화를 봤어요',better:'그리고 같이 영화를 봤어요'},delivery:{good:'속도가 알맞아요.',try:''},model_line:'다음 주말에는 공원에 가고 싶어요.',note:''};
 const ok=normalizeFeedback(base,{item:it});
 assert.equal(ok.status,'ok');assert.equal(ok.counted,true);assert.deepEqual(ok.covered,[0,1]);
 assert.equal(ok.elements.language.better,'그리고 같이 영화를 봤어요');
 assert.equal(normalizeFeedback({...base,transcript:'',audio:{speech:'none',language:'ko'}},{item:it}).status,'no_speech');
 const en=normalizeFeedback({...base,transcript:'I usually go hiking on weekends.',audio:{speech:'clear',language:'other'}},{item:it});
 assert.equal(en.status,'not_korean');assert.equal(en.counted,false);
 assert.equal(normalizeFeedback({...base,audio:{speech:'unclear',language:'ko'}},{item:it}).status,'unclear');
 const short=normalizeFeedback({...base,transcript:'음… 주말에 쉬어요.'},{item:it});
 assert.equal(short.status,'ok');assert.deepEqual(short.elements.language,{withheld:'short'});assert.deepEqual(short.elements.delivery,{withheld:'short'});
 // 녹음 길이에 비해 음절이 너무 많으면(1초 9음절 넘음) 지어낸 받아쓰기로 보고 세지 않는다(측정 c10: 4초 잡음에 50음절).
 const invented4s=normalizeFeedback({...base,transcript:'주말에는 저는 보통 공원에서 자전거를 타요. 그리고 친구를 만나요. 지난 주말에는 집에서 영화를 봤어요. 아주 재미있었어요.'},{item:it,seconds:4});
 assert.equal(invented4s.status,'unclear');assert.equal(invented4s.counted,false);
 assert.equal(normalizeFeedback(base,{item:it,seconds:20}).status,'ok');
 const partly=normalizeFeedback({...base,audio:{speech:'partly_unclear',language:'ko'}},{item:it});
 assert.equal(partly.partlyUnclear,true);assert.deepEqual(partly.elements.delivery,{withheld:'audio'});
 // 번호 밖·중복 covered는 버리고 1부터를 0부터로.
 assert.deepEqual(normalizeFeedback({...base,covered:[2,2,0,9]},{item:it}).covered,[1]);
 // 받아 적은 말에 없는 인용은 지운다(지어낸 인용 막기).
 const invented=normalizeFeedback({...base,language:{...base.language,quote:'학교에 갔어요'}},{item:it});
 assert.equal(invented.elements.language.quote,'');assert.equal(invented.elements.language.better,'');
 // 점수·급수·합격처럼 읽히는 말은 내지 않는다.
 const scored=normalizeFeedback({...base,task:{good:'이 대답은 3점이에요.',try:'2급 수준이에요.'},note:'합격할 수 있어요.'},{item:it});
 assert.deepEqual(scored.elements.task,{withheld:'nothing'});assert.equal(scored.note,'');
 for(const said of ['중급 수준으로 말했어요.','You would pass this part.','This is an intermediate level answer.','80% 정도 맞았어요.','만점에 가까워요.','Та тэнцэнэ.'])
  assert.equal(normalizeFeedback({...base,task:{good:said,try:''}},{item:it}).elements.task.withheld,'nothing',said);
 // 자료 해석(5번)은 자료에 있는 퍼센트 인용을 지우지 않는다. 자료에 없는 퍼센트는 여전히 점수 말로 거른다(10-21 Fable 검수).
 const bike=bank.items.find(i=>i.id==='s5-bike'),bikeSaid='공원 자전거 길이 늘었다는 응답이 45%로 가장 많았습니다';
 const bikeBase={...base,transcript:`자료를 보면 대여 건수가 많이 늘었습니다. ${bikeSaid}. 그리고 휴대폰으로 쉽게 빌린다는 응답이 30%였습니다.`,language:{good:'',try:'',quote:bikeSaid,better:'공원 자전거 길이 늘었다는 응답이 45%로 가장 많았습니다.'},model_line:'이유로는 자전거 길이 늘었다는 응답이 45%로 가장 많았고, 휴대폰으로 쉽게 빌린다는 응답이 30%로 뒤를 이었습니다.'};
 const bikeOut=normalizeFeedback(bikeBase,{item:bike});
 assert.equal(bikeOut.elements.language.quote,bikeSaid);assert.match(bikeOut.modelLine,/45%/);
 assert.equal(normalizeFeedback({...bikeBase,task:{good:'80% 정도 맞았어요.',try:''}},{item:bike}).elements.task.withheld,'nothing');
 // 한두 글자 인용은 받지 않는다(아무 곳에나 걸린다).
 const tiny=normalizeFeedback({...base,language:{...base.language,quote:'에는',better:'에서는'}},{item:it});
 assert.equal(tiny.elements.language.quote,'');
});

test('소리 관문과 값 셈',()=>{
 assert.equal(audioGate({transcript:'(?)',audio:{speech:'partly_unclear',language:'ko'}}).status,'no_speech');
 assert.equal(audioGate({transcript:'Hello, I like coffee.',audio:{speech:'clear',language:'other'}}).status,'not_korean');
 // 모델이 「섞임」이라 해도 한글 없이 다른 글자로만 받아 적혔으면 한국어 대답이 아니다(측정 c11).
 assert.equal(audioGate({transcript:'I usually go hiking on weekends.',audio:{speech:'clear',language:'mixed'}}).status,'not_korean');
 assert.equal(audioGate({transcript:'Би амралтын өдөр алхдаг.',audio:{speech:'clear',language:'mixed'}}).status,'not_korean');
 const usage={promptTokenCount:2400,candidatesTokenCount:500,thoughtsTokenCount:300,promptTokensDetails:[{modality:'TEXT',tokenCount:900},{modality:'AUDIO',tokenCount:1500}]};
 const p=priceVertex('gemini-3.8-flash',usage,{at:Date.parse('2026-10-21T12:00:00+09:00')});
 assert.equal(p.tokens.audio,1500);assert.equal(p.tokens.text,900);
 assert.ok(Math.abs(p.list-(2400*1.5+800*7.5)/1e6)<1e-12);assert.ok(Math.abs(p.promo-p.list/2)<1e-12);
 assert.equal(priceVertex('gemini-3.8-flash',usage,{at:Date.parse('2027-01-02T00:00:00+09:00')}).promo,priceVertex('gemini-3.8-flash',usage).list);
 const lite=priceVertex('gemini-3.1-flash-lite',usage);assert.ok(Math.abs(lite.list-(900*.25+1500*.5+800*1.5)/1e6)<1e-12);
 const c=priceClaude('claude-sonnet-5-5',{input_tokens:400,cache_read_input_tokens:1200,cache_creation_input_tokens:0,output_tokens:600});
 assert.ok(Math.abs(c.list-(400*2+1200*.2+600*10)/1e6)<1e-12);
 assert.ok(reserveEstimate({model:'gemini-3.8-flash',seconds:80})>0);
});

test('출력 꼴: Vertex는 대문자 형·속성 순서, Claude는 모든 객체에 additionalProperties:false',()=>{
 const v=vertexSchema(LISTEN_SCHEMA);assert.equal(v.type,'OBJECT');assert.equal(v.properties.audio.properties.speech.type,'STRING');assert.deepEqual(v.propertyOrdering,Object.keys(LISTEN_SCHEMA.properties));
 const walk=(s,fn)=>{fn(s);for(const value of Object.values(s.properties||{}))walk(value,fn);if(s.items)walk(s.items,fn);};
 walk(claudeSchema(TURN_SCHEMA),s=>{if(s.type==='object')assert.equal(s.additionalProperties,false);});
 const brief=taskBrief(bank.items.find(i=>i.id==='s5-bike'),bank.types);
 assert.match(brief,/2025년 340만 건/);assert.match(brief,/준비 70초 · 대답 80초/);
 const prompt=listenPrompt({item:bank.items[0],types:bank.types,lang:'mn'});
 assert.match(prompt,/Монгол хэл/);assert.match(prompt,/점수·등급·급수·합격 여부·숫자 평가를 쓰지 않는다/);
});

test('카페 역할극: 목표와 다르면 직원이 되묻거나(미리 구운 말) 튜터가 돕고, 맞으면 다음 말로 간다',()=>{
 const rp=bank.roleplays[0],slots=(over={})=>({drink:'none',temperature:'none',count:0,place:'none',answer:'none',...over});
 assert.deepEqual(nextStep({roleplay:rp,stepId:'order',slots:slots({drink:'tea',temperature:'warm',count:2})}),{step:'confirm',hint:null});
 assert.deepEqual(nextStep({roleplay:rp,stepId:'order',slots:slots({drink:'tea',temperature:'warm'})}),{step:'count',hint:null});
 assert.deepEqual(nextStep({roleplay:rp,stepId:'order',slots:slots({drink:'juice',temperature:'cold',count:2})}),{step:'soldout',hint:null});
 assert.deepEqual(nextStep({roleplay:rp,stepId:'soldout',slots:slots({drink:'juice',temperature:'cold',count:2})}),{step:'soldout',hint:'drink'});
 assert.deepEqual(nextStep({roleplay:rp,stepId:'order',slots:slots({drink:'tea',temperature:'cold',count:2})}),{step:'order',hint:'temperature'});
 assert.deepEqual(nextStep({roleplay:rp,stepId:'count',slots:slots({count:2})}),{step:'confirm',hint:null});
 assert.deepEqual(nextStep({roleplay:rp,stepId:'count',slots:slots({count:3})}),{step:'count',hint:'count'});
 // 잔 수 차례라도 다른 음료·온도를 말하면 그대로 본다.
 assert.deepEqual(nextStep({roleplay:rp,stepId:'count',slots:slots({drink:'juice',temperature:'cold',count:2})}),{step:'soldout',hint:null});
 assert.deepEqual(nextStep({roleplay:rp,stepId:'count',slots:slots({temperature:'cold',count:2})}),{step:'count',hint:'temperature'});
 assert.deepEqual(nextStep({roleplay:rp,stepId:'confirm',slots:slots({answer:'yes'})}),{step:'place',hint:null});
 assert.deepEqual(nextStep({roleplay:rp,stepId:'place',slots:slots({place:'togo'})}),{step:'place',hint:'place'});
 assert.deepEqual(nextStep({roleplay:rp,stepId:'place',slots:slots({place:'here'})}),{step:'done',hint:null});
 const turn=normalizeTurn({heard:'따뜻한 차 두 잔 줘',audio:{speech:'clear',language:'ko'},drink:'tea',temperature:'warm',count:2,place:'none',answer:'none',polite:'no',better:'따뜻한 차 두 잔 주세요.',tip:'Use 「주세요」.'},{roleplay:rp,stepId:'order'});
 assert.equal(turn.status,'ok');assert.equal(turn.polite,'no');assert.deepEqual(turn.next,{step:'confirm',hint:null});
 assert.equal(normalizeTurn({heard:'(?)',audio:{speech:'unclear',language:'ko'}},{roleplay:rp,stepId:'order'}).status,'no_speech');
 assert.equal(normalizeTurn({heard:'따뜻(?)',audio:{speech:'unclear',language:'ko'}},{roleplay:rp,stepId:'order'}).status,'unclear');
});

test('역할극 주문 칸은 받아 적은 말에서 규칙으로 고른다(모델이 지어낼 수 없다)',()=>{
 assert.deepEqual(slotsFromText('따뜻한 차 두 잔 주세요.'),{drink:'tea',temperature:'warm',count:2,place:'none',answer:'none',polite:'yes'});
 assert.equal(slotsFromText('차가운 주스 두 잔 주세요.').drink,'juice','「차가운」은 차가 아니다');
 assert.equal(slotsFromText('음… 따뜻한 차 주세요.').count,0,'잔 수를 말하지 않으면 0');
 assert.equal(slotsFromText('따뜻한 차 두 잔 줘.').polite,'no');
 assert.equal(slotsFromText('네, 맞아요.').answer,'yes');assert.equal(slotsFromText('네 잔 주세요').answer,'none');assert.equal(slotsFromText('네 잔 주세요').count,4);
 assert.equal(slotsFromText('가져갈게요.').place,'togo');assert.equal(slotsFromText('여기서 마실게요.').place,'here');
 assert.deepEqual(slotsFromText('(?) (?)'),{drink:'none',temperature:'none',count:0,place:'none',answer:'none',polite:'unclear'});
});

test('화면 글: 세 언어가 모두 있고 영어·몽골어 칸에는 「」 밖 한글이 없다(한 자리 한 언어)',()=>{
 for(const [key,row]of Object.entries(SPEAKING_STRINGS)){
  for(const lang of ['ko','en','mn'])assert.ok(String(row[lang]||'').trim(),`${key}.${lang}`);
  for(const lang of ['en','mn'])assert.doesNotMatch(String(row[lang]).replace(/「[^」]*」/g,''),/[가-힣]/,`${key}.${lang}`);
  assert.doesNotMatch(Object.values(row).join(' '),/Gemini|Claude|Vertex|Google|Anthropic|GPT|OpenAI/i,`${key}: 도구 이름`);
 }
 assert.equal(st('type.meta',{prep:20,answer:30},'mn'),'Бэлтгэх 20 секунд · Хариулах 30 секунд');
 assert.equal(st('없는 키',{},'en'),'없는 키');
});

test('플래그: 기본은 꺼짐, 주소 ?speaking=preview나 이 기기 설정일 때만 켜진다 · 공개 빌드 목록 밖',()=>{
 const storage=memory();
 assert.equal(speakingPreviewOn({location:{search:''},storage}),false);
 assert.equal(speakingPreviewOn({location:{search:'?speaking=preview'},storage}),true);
 storage.setItem(SPEAKING_FLAG_KEY,'1');assert.equal(speakingPreviewOn({location:{search:''},storage}),true);
 const shell=fs.readFileSync(path.join(app,'app-shell.mjs'),'utf8');
 assert.doesNotMatch(shell,/^import[^\n]*world-speaking-practice/m,'정적 import가 없다');
 assert.match(shell,/if\(speakingFlag\)void import\('\.\/world-speaking-practice\.mjs'\)/);
 const build=fs.readFileSync(path.join(root,'tools/build-world-app-public.mjs'),'utf8');
 assert.doesNotMatch(build,/world-speaking|speaking-assets/,'시범은 공개 빌드에 넣지 않는다');
});

test('기기 기록 요약과 계획 후보(제안): 세지 않은 녹음은 빠지고, 후보는 말하기 영역',()=>{
 const storage=memory(),at='2026-10-21T03:00:00.000Z';
 storage.setItem('synk.world.speaking.v1:acc',JSON.stringify({consent:{at,version:1},log:[
  {at,mode:'exam',type:1,source:'ai-reference',counted:true},{at,mode:'exam',type:1,source:'self',counted:true},
  {at,mode:'exam',type:2,source:'ai-unclear',counted:false},{at,mode:'roleplay',itemId:'rp-cafe-tea',done:true,counted:true}]}));
 const sum=readSpeakingSummary({storage,owner:'acc'});
 assert.equal(sum.attempts[1],2);assert.equal(sum.feedback[1],1);assert.equal(sum.attempts[2],0);assert.equal(sum.roleplays,1);assert.equal(sum.times.length,3);
 assert.equal(SPEAKING_CANDIDATES.length,7);assert.ok(SPEAKING_CANDIDATES.every(c=>c.area==='speaking'&&c.targets.every(id=>Object.values(SPEAKING_SKILLS).includes(id))));
});

test('개발 서버 몫: 기본은 꺼짐, 동의·형식·길이를 보고, 같은 요청은 다시 처리하지 않는다',async()=>{
 const calls=[];
 const caller={speakingFeedback:async({item})=>{calls.push(item.id);return {route:'listen',ms:5,calls:[{model:'fake',cost:{list:.001}}],result:{status:'ok',counted:true,covered:[0]}};},speakingTurn:async()=>({route:'turn',ms:5,calls:[],result:{status:'ok',next:{step:'confirm',hint:null}}})};
 const audio={mime:'audio/webm;codecs=opus',data:Buffer.from('fake').toString('base64')};
 const off=createSpeakingDevHost({enabled:false,caller,log:()=>{}});
 assert.deepEqual((await off.handle('a',JSON.stringify({action:'status'}))).body.enabled,false);
 assert.equal((await off.handle('a',JSON.stringify({action:'feedback',request_id:crypto.randomUUID(),consent:'send-once',item_id:'s1-weekend',audio,seconds:20}))).body.status,'off');
 const on=createSpeakingDevHost({enabled:true,caller,dailyLimit:1,log:()=>{}});
 assert.equal((await on.handle('a',JSON.stringify({action:'feedback',request_id:crypto.randomUUID(),item_id:'s1-weekend',audio}))).status,400,'동의 없음');
 assert.equal((await on.handle('a',JSON.stringify({action:'feedback',request_id:crypto.randomUUID(),consent:'send-once',item_id:'s1-weekend',audio:{mime:'text/plain',data:'x'}}))).status,400,'소리 아님');
 assert.equal((await on.handle('a',JSON.stringify({action:'feedback',request_id:crypto.randomUUID(),consent:'send-once',item_id:'s1-weekend',audio,seconds:60}))).body.status,'too_long');
 const id=crypto.randomUUID(),first=await on.handle('a',JSON.stringify({action:'feedback',request_id:id,consent:'send-once',item_id:'s1-weekend',audio,seconds:20}));
 assert.equal(first.body.status,'ok');assert.equal(first.body.feedback.status,'ok');
 assert.equal((await on.handle('a',JSON.stringify({action:'feedback',request_id:id,consent:'send-once',item_id:'s1-weekend',audio,seconds:20}))).body.status,'done_before');
 assert.equal((await on.handle('a',JSON.stringify({action:'feedback',request_id:crypto.randomUUID(),consent:'send-once',item_id:'s1-weekend',audio,seconds:20}))).body.status,'limit');
 const turn=await on.handle('a',JSON.stringify({action:'turn',request_id:crypto.randomUUID(),consent:'send-once',roleplay_id:'rp-cafe-tea',step_id:'order',audio,seconds:4}));
 assert.equal(turn.body.turn.next.step,'confirm','역할극 차례는 하루 횟수에 세지 않는다');
 assert.deepEqual(calls,['s1-weekend']);
});
