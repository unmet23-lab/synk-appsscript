import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {slotsFromText,normalizeFeedback,normalizeTurn,nextStep,audioGate,priceVertex,priceClaude,vertexSchema,claudeSchema,LISTEN_SCHEMA,TURN_SCHEMA,syllables,taskBrief,listenPrompt,reserveEstimate} from '../../../tools/lib/말하기피드백.mjs';
import STRINGS from '../../brand-opening/world-strings.mjs';
import {t} from '../../brand-opening/world-lang.mjs';
import {bankHash,coreModule,itemsModule,TALK_FILES} from '../../../tools/build-world-speaking-talk.mjs';
import {speakingPreviewOn,readSpeakingSummary,SPEAKING_CANDIDATES,SPEAKING_SKILLS,SPEAKING_FLAG_KEY,SPEAKING_EXAM_KEY,readSpeakingExam,writeSpeakingExam,speakingWeek} from '../world-speaking-practice.mjs';
import {createSpeakingDevHost} from '../speaking-dev-host.mjs';
// 말하기 연습 시범(2026-10-21): 문항·공식 시간, 피드백 정리(보류·거름·인용), 역할극 다음 걸음, 값 셈, 플래그 꺼짐, 공개 빌드 밖, 개발 서버 몫,
// 운영 통로(SYNK-talk world-speaking 함수의 서버 사본·계정 경로·app-shell 연결).
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
 // 인용과 고친 말은 짝이다 — 고친 말이 거름망에 걸려 비면 인용도 내지 않는다(「인용 → 」 반쪽 막기, 10-21 아르곤 백엔드 검수).
 const half=normalizeFeedback({...base,language:{...base.language,better:'2급 수준으로 같이 영화를 봤어요'}},{item:it});
 assert.equal(half.elements.language.quote,'');assert.equal(half.elements.language.better,'');
 assert.equal(normalizeFeedback({...base,language:{...base.language,better:''}},{item:it}).elements.language.quote,'');
 // 쓰기 몫이 하나도 없으면(쓰기 답을 못 읽음) 빈 「참고」를 정상으로 내지 않는다.
 const noWrite=normalizeFeedback({transcript:base.transcript,audio:base.audio},{item:it});
 assert.equal(noWrite.status,'unavailable');assert.equal(noWrite.counted,false);
 assert.equal(normalizeFeedback({...base,task:{good:'초급자에게 흔한 실수예요.',try:''}},{item:it}).elements.task.withheld,'nothing','수준 이름도 거른다');
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
 assert.equal(reserveEstimate({model:'gemini-3.8-flash',seconds:NaN}),null);assert.equal(reserveEstimate({model:'gemini-3.8-flash',seconds:-1}),null);
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
 // 모델이 「섞임」·한국어라 해도 한글 없이(또는 감탄사 한 글자만) 다른 글자로 받아 적혔으면 「말 없음」이 아니라 「한국어 아님」이다.
 for(const heard of ['Two warm teas please','아, two warm teas please'])
  assert.equal(normalizeTurn({heard,audio:{speech:'clear',language:'mixed'}},{roleplay:rp,stepId:'order'}).status,'not_korean',heard);
 // 잔 수 차례에서 말하지 않은 칸은 그 역할극의 목표로 채운다(목표가 다른 역할극).
 const iced={...rp,goal:{...rp.goal,drink:'coffee',temperature:'cold'}};
 assert.deepEqual(nextStep({roleplay:iced,stepId:'count',slots:slots({count:2})}),{step:'confirm',hint:null});
});

test('역할극 주문 칸은 받아 적은 말에서 규칙으로 고른다(모델이 지어낼 수 없다)',()=>{
 assert.deepEqual(slotsFromText('따뜻한 차 두 잔 주세요.'),{drink:'tea',temperature:'warm',count:2,place:'none',answer:'none',polite:'yes'});
 assert.equal(slotsFromText('차가운 주스 두 잔 주세요.').drink,'juice','「차가운」은 차가 아니다');
 assert.equal(slotsFromText('음… 따뜻한 차 주세요.').count,0,'잔 수를 말하지 않으면 0');
 assert.equal(slotsFromText('따뜻한 차 두 잔 줘.').polite,'no');
 assert.equal(slotsFromText('네, 맞아요.').answer,'yes');assert.equal(slotsFromText('네 잔 주세요').answer,'none');assert.equal(slotsFromText('네 잔 주세요').count,4);
 assert.equal(slotsFromText('가져갈게요.').place,'togo');assert.equal(slotsFromText('여기서 마실게요.').place,'here');
 assert.deepEqual(slotsFromText('(?) (?)'),{drink:'none',temperature:'none',count:0,place:'none',answer:'none',polite:'unclear'});
 // 10-21 아르곤 백엔드 검수: 낱말 머리만 같은 말·「A 말고 B」·잔 없이 말한 수·붙여 쓴 조사.
 assert.equal(slotsFromText('칭찬 고마워요').temperature,'none','칭찬의 찬은 차가운 것이 아니다');
 assert.equal(slotsFromText('찬 거 주세요').temperature,'cold');
 for(const said of ['예전에 마신 차 주세요','네모난 컵이요','응원해요'])assert.equal(slotsFromText(said).answer,'none',said);
 assert.equal(slotsFromText('넵 맞아요').answer,'yes');assert.equal(slotsFromText('아니요 따뜻한 거요').answer,'no');
 assert.equal(slotsFromText('동네 잔치').count,0);assert.equal(slotsFromText('차 둘이요').count,2);assert.equal(slotsFromText('하나 주세요').count,1);
 assert.equal(slotsFromText('둘이서 마실게요').count,0);assert.equal(slotsFromText('한 잔 말고 두 잔이요').count,2);
 assert.equal(slotsFromText('매장 말고 포장해 주세요').place,'togo');
 assert.equal(slotsFromText('따뜻한 거 말고 차가운 차 주세요').temperature,'cold');
 assert.deepEqual(slotsFromText('차가운 거 말고 따뜻한 차 두 잔 주세요'),{drink:'tea',temperature:'warm',count:2,place:'none',answer:'none',polite:'yes'});
 assert.equal(slotsFromText('차 말고 커피 주세요').drink,'coffee');assert.equal(slotsFromText('커피말고 차 두 잔').drink,'tea');
 for(const said of ['차로요','따뜻한 차는요','차주세요','녹차예요'])assert.equal(slotsFromText(said).drink,'tea',said);
 assert.equal(slotsFromText('커피숍에서').drink,'none');assert.equal(slotsFromText('아이스아메리카노 두 잔').drink,'coffee');
 assert.equal(slotsFromText('따뜻한 차 두 잔이요.」').polite,'yes','닫는 따옴표 뒤도 말끝을 본다');
 // 아르곤 다시 받기: 잔 없이 말한 수는 주문하는 꼴일 때만, 두 어절 이상의 「… 말고」는 이어진 주문 말을 함께 뺀다.
 for(const said of ['따뜻한 차로 할게요. 하나만 물어볼게요, 화장실 어디예요?','하나, 둘, 셋 아아 들리나요? 따뜻한 차 주세요','녹차랑 홍차 둘 다 되나요?','하나 둘 셋','3개월 전에 마셨어요'])
  assert.equal(slotsFromText(said).count,0,said);
 for(const [said,n] of [['하나만 주세요',1],['둘 주세요',2],['둘요',2],['따뜻한 차 셋이요',3]])assert.equal(slotsFromText(said).count,n,said);
 // 잔 수는 B가 다시 말할 때만 바꾼다 — 음료만 바꾼 「차 한 잔 말고 따뜻한 커피」는 커피 한 잔이다.
 assert.deepEqual(slotsFromText('차 한 잔 말고 따뜻한 커피 주세요'),{drink:'coffee',temperature:'warm',count:1,place:'none',answer:'none',polite:'yes'});
 assert.equal(slotsFromText('두 개 말고요 잔은 없나요').count,0);
 assert.deepEqual(slotsFromText('따뜻한 차 두 잔 주세요 매장 말고 포장이요'),{drink:'tea',temperature:'warm',count:2,place:'togo',answer:'none',polite:'yes'});
 assert.deepEqual(slotsFromText('따뜻한 차 두 잔 말고 차가운 커피 한 잔이요'),{drink:'coffee',temperature:'cold',count:1,place:'none',answer:'none',polite:'yes'});
 assert.equal(slotsFromText('네, 따뜻한 차 말고 커피요').answer,'yes','대답 칸은 뺀 것 없이 본다');
 // 셋째 확인: 「… 말고」는 한 구절만 — 앞에서 이미 말한 정상 주문은 남긴다.
 for(const said of ['따뜻한 차 두 잔 차가운 거 말고 따뜻한 걸로 주세요','차 두 잔 뜨거운 거 말고 따뜻한 걸로요'])
  assert.deepEqual(slotsFromText(said),{drink:'tea',temperature:'warm',count:2,place:'none',answer:'none',polite:'yes'},said);
 assert.equal(slotsFromText('따뜻한 차하고 차가운 거 말고 따뜻한 거 주세요').drink,'tea');
 assert.deepEqual([slotsFromText('두 잔 차 말고 커피').drink,slotsFromText('두 잔 차 말고 커피').count],['coffee',2]);
 // 넷째 확인: B가 다시 말한 칸만 A에서 뺀다 — 잔 수만 고치면 음료·온도는 남고, 어순이 바뀐 구절도 고친 칸은 빠진다.
 assert.deepEqual(slotsFromText('차 한 잔 말고 두 잔 주세요'),{drink:'tea',temperature:'none',count:2,place:'none',answer:'none',polite:'yes'});
 assert.deepEqual(slotsFromText('따뜻한 차, 한 잔 말고 두 잔 주세요'),{drink:'tea',temperature:'warm',count:2,place:'none',answer:'none',polite:'yes'});
 for(const said of ['차 차가운 말고 따뜻한 걸로 주세요','차 아이스 말고 따뜻한 거요','커피 차가운 거 말고 따뜻한 차 주세요'])
  assert.deepEqual([slotsFromText(said).drink,slotsFromText(said).temperature],['tea','warm'],said);
 assert.equal(slotsFromText('차 따뜻한 말고 커피 주세요').drink,'coffee');
 for(const [said,n] of [['한 잔 차 말고 두 잔 커피 주세요',2],['두 잔 차 말고 한 잔 커피요',1]])
  assert.deepEqual([slotsFromText(said).drink,slotsFromText(said).count],['coffee',n],said);
 assert.equal(slotsFromText('칭찬 고마워요 차가운 거 말고요').temperature,'none','B가 없으면 한 구절만');
 // 다섯째 확인: 음료를 바꾸면 그 음료의 온도도 버리고, 온도가 붙은 음료 낱말(아이스커피)은 온도·음료 두 칸이다.
 for(const said of ['차가운 차 말고 커피 주세요','아이스 차 말고 커피요'])
  assert.deepEqual([slotsFromText(said).drink,slotsFromText(said).temperature],['coffee','none'],said);
 assert.deepEqual(slotsFromText('따뜻한 커피 말고 차 두 잔 주세요'),{drink:'tea',temperature:'none',count:2,place:'none',answer:'none',polite:'yes'});
 assert.deepEqual([slotsFromText('차가운 차 말고 따뜻한 거요').drink,slotsFromText('차가운 차 말고 따뜻한 거요').temperature],['tea','warm'],'온도만 고치면 음료는 남는다');
 assert.deepEqual([slotsFromText('커피 두 잔 말고 차 주세요').drink,slotsFromText('커피 두 잔 말고 차 주세요').count],['tea',2],'음료만 바꾸면 잔 수는 남는다');
 assert.deepEqual([slotsFromText('아이스커피 말고 따뜻한 걸로 주세요').drink,slotsFromText('아이스커피 말고 따뜻한 걸로 주세요').temperature],['none','warm']);
 assert.deepEqual(slotsFromText('차 두 잔 말고 아이스커피 주세요'),{drink:'coffee',temperature:'cold',count:2,place:'none',answer:'none',polite:'yes'});
 // 10-21 문항 검수 P2: 「녹차가·차가」의 「차가」는 차 + 조사다 — 차가운 것으로 읽어 「따뜻한 걸로」 도움말을 내지 않는다.
 for(const said of ['녹차가 두 잔이요.','차가 두 잔이요.','홍차는 두 잔 주세요.','보리차를 두 잔 주세요.','유자차가 좋아요.','반찬 두 개 주세요.'])assert.equal(slotsFromText(said).temperature,'none',said);
 assert.deepEqual(slotsFromText('녹차가 두 잔이요.'),{drink:'tea',temperature:'none',count:2,place:'none',answer:'none',polite:'yes'});
 assert.deepEqual(nextStep({roleplay:bank.roleplays[0],stepId:'count',slots:slotsFromText('녹차가 두 잔이요.')}),{step:'confirm',hint:null},'잔 수 차례의 「녹차가 두 잔이요」는 온도 도움말 없이 확인으로');
 for(const said of ['차가운 녹차 두 잔 주세요.','녹차는 차갑게 해 주세요.','차가워야 해요.','시원한 걸로 주세요.','아이스티 두 잔 주세요.','찬 거 두 잔 주세요.','아이스로 주세요.'])assert.equal(slotsFromText(said).temperature,'cold',said);
 assert.equal(slotsFromText('따뜻한 녹차가 두 잔이요.').temperature,'warm');
});

test('화면 글: 공용 글 표의 speaking.* 줄 — 세 언어가 모두 있고 영어·몽골어 칸에는 「」 밖 한글이 없다(한 자리 한 언어)',()=>{
 const rows=Object.entries(STRINGS).filter(([key])=>key.startsWith('speaking.'));
 assert.ok(rows.length>=120,`speaking.* ${rows.length}줄`);
 assert.equal(fs.existsSync(path.join(app,'world-speaking-strings.mjs')),false,'시범 글 표는 공용 표로 옮겼다');
 const practice=fs.readFileSync(path.join(app,'world-speaking-practice.mjs'),'utf8');
 for(const [,key]of practice.matchAll(/\bst\('([\w.]+)'/g))assert.ok(Object.hasOwn(STRINGS,`speaking.${key}`),`speaking.${key}`);
 for(const [key,row]of rows){
  for(const lang of ['ko','en','mn'])assert.ok(String(row[lang]||'').trim(),`${key}.${lang}`);
  for(const lang of ['en','mn'])assert.doesNotMatch(String(row[lang]).replace(/「[^」]*」/g,''),/[가-힣]/,`${key}.${lang}`);
  assert.doesNotMatch(Object.values(row).join(' '),/Gemini|Claude|Vertex|Google|Anthropic|GPT|OpenAI/i,`${key}: 도구 이름`);
 }
 assert.equal(t('speaking.type.meta',{prep:20,answer:30},'mn'),'Бэлтгэх 20 секунд · Хариулах 30 секунд');
});

test('플래그: 기본은 꺼짐, 주소 ?speaking=preview나 이 기기 설정일 때만 켜진다 · 공개 빌드에는 모듈·글·문항·그림이 있다',()=>{
 const storage=memory();
 assert.equal(speakingPreviewOn({location:{search:''},storage}),false);
 assert.equal(speakingPreviewOn({location:{search:'?speaking=preview'},storage}),true);
 storage.setItem(SPEAKING_FLAG_KEY,'1');assert.equal(speakingPreviewOn({location:{search:''},storage}),true);
 const shell=fs.readFileSync(path.join(app,'app-shell.mjs'),'utf8');
 assert.doesNotMatch(shell,/^import[^\n]*world-speaking-practice/m,'정적 import가 없다');
 assert.match(shell,/if\(speakingFlag\)void import\('\.\/world-speaking-practice\.mjs'\)/);
 const build=fs.readFileSync(path.join(root,'tools/build-world-app-public.mjs'),'utf8');
 // app-shell이 부르는 모듈이 공개 빌드에 없으면 빌드가 missing으로 멈춘다(10-21 ④ 세션 보고) — 파일은 싣고 켜는 것은 플래그다.
 for(const name of ['world-speaking-practice.mjs','world-speaking.css','world-speaking-items.json'])assert.ok(build.includes(`'${name}'`),name);
 assert.match(build,/speaking-assets/);assert.doesNotMatch(build,/speaking-dev-host/,'개발 서버 몫은 싣지 않는다');
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

test('개발 서버 몫: 기본은 꺼짐, 운영 함수와 같은 순서로 형식·판 지문·길이를 보고, 같은 요청은 다시 처리하지 않는다',async()=>{
 const calls=[];
 const caller={speakingFeedback:async({item})=>{calls.push(item.id);return {route:'listen',ms:5,calls:[{model:'fake',cost:{list:.001}}],result:{status:'ok',counted:true,covered:[0]}};},speakingTurn:async()=>({route:'turn',ms:5,calls:[],result:{status:'ok',next:{step:'confirm',hint:null}}})};
 const audio={mime:'audio/webm;codecs=opus',data:Buffer.from('fake').toString('base64')};
 const exam=(extra={})=>JSON.stringify({action:'feedback',request_id:crypto.randomUUID(),consent:'send-once',item_id:'s1-weekend',items_version:bank.contentHash,lang:'ko',audio,seconds:20,...extra});
 const off=createSpeakingDevHost({enabled:false,caller,log:()=>{}});
 const status=(await off.handle('a',JSON.stringify({action:'status'}))).body;
 assert.deepEqual([status.enabled,status.itemsVersion],[false,bank.contentHash]);
 assert.equal((await off.handle('a',exam())).body.status,'off');
 const on=createSpeakingDevHost({enabled:true,caller,dailyLimit:1,log:()=>{}});
 for(const [extra,code]of [[{consent:undefined},'CONSENT_REQUIRED'],[{request_id:'x'},'INVALID_REQUEST_ID'],[{lang:'ja'},'INVALID_LANGUAGE'],[{audio:{mime:'text/plain',data:'x'}},'INVALID_AUDIO'],[{seconds:undefined},'INVALID_SECONDS']]){
  const r=await on.handle('a',exam(extra));assert.deepEqual([r.status,r.body.code],[400,code],code);
 }
 for(const extra of [{items_version:'0000000000000000'},{items_version:bank.version},{item_id:'s9-none'}]){const r=await on.handle('a',exam(extra));assert.deepEqual([r.status,r.body.code],[409,'ITEM_CHANGED'],JSON.stringify(extra));}
 assert.equal((await on.handle('a',exam({seconds:60}))).body.status,'too_long');
 const id=crypto.randomUUID(),first=await on.handle('a',exam({request_id:id}));
 assert.equal(first.body.status,'ok');assert.equal(first.body.feedback.status,'ok');
 assert.equal((await on.handle('a',exam({request_id:id}))).body.status,'done_before');
 assert.equal((await on.handle('a',exam())).body.status,'limit');
 const turn=await on.handle('a',JSON.stringify({action:'turn',request_id:crypto.randomUUID(),consent:'send-once',roleplay_id:'rp-cafe-tea',step_id:'order',items_version:bank.contentHash,lang:'ko',audio,seconds:4}));
 assert.equal(turn.body.turn.next.step,'confirm','역할극 차례는 하루 횟수에 세지 않는다');
 assert.deepEqual(calls,['s1-weekend']);
});

test('운영 통로: 은행 판 지문이 내용과 맞고, talk 함수의 서버 사본 둘(피드백 핵심 CommonJS·문항)을 이 저장소에서 만든다',()=>{
 assert.equal(bank.contentHash,bankHash(bank),'node tools/build-world-speaking-talk.mjs --write 뒤 --talk <SYNK-talk>로 서버 사본도 다시 만든다');
 const core=coreModule(),items=itemsModule(bank);
 assert.doesNotMatch(core,/^export /m);
 const exported=core.match(/module\.exports = \{([^}]*)\}/)[1].split(',').map(s=>s.trim());
 for(const name of ['blindHearPrompt','writeSystem','writeUser','normalizeFeedback','normalizeTurn','slotsFromText','PRICES','reserveEstimate'])assert.ok(exported.includes(name),name);
 assert.ok(items.includes(`const BANK_HASH = "${bank.contentHash}";`));
 // talk 작업본을 주면(SYNK_TALK_ROOT) 그 저장소의 사본이 지금 원본과 바이트까지 같은지 본다 — 다르면 함수가 다른 판으로 피드백한다.
 const talk=process.env.SYNK_TALK_ROOT;
 if(talk)for(const [rel,want]of [[TALK_FILES.core,core],[TALK_FILES.items,items]])assert.equal(fs.readFileSync(path.join(talk,rel),'utf8').replace(/\r\n/g,'\n'),want,`${rel} — node tools/build-world-speaking-talk.mjs --talk ${talk}`);
});

test('운영 통로: 계정 모드는 SYNK-talk world-speaking 함수(feedback, 95초, 웹만)로 보내고 app-shell이 그 통로를 준다 · 화면은 판 지문을 보낸다',()=>{
 const account=fs.readFileSync(path.join(app,'world-account.mjs'),'utf8');
 assert.ok(account.includes("['speaking','POST']"));assert.ok(account.includes("path==='speaking'?'world-speaking'"));assert.ok(account.includes("path==='writing'||path==='speaking'?'feedback'"));
 assert.ok(account.includes("path==='writing'||path==='speaking'?95000:12000"));assert.ok(account.includes('get supportsSpeaking(){return !native;}'));
 assert.match(fs.readFileSync(path.join(app,'world-account.bundle.mjs'),'utf8'),/\["speaking", ?"POST"\][\s\S]*speakingRequest/,'node tools/build-world-account.mjs');
 const shell=fs.readFileSync(path.join(app,'app-shell.mjs'),'utf8');
 assert.ok(shell.includes("operating?(client.snapshot&&account?.supportsSpeaking?{status:()=>account.speakingRequest({action:'status'}),request:payload=>account.speakingRequest(payload)}:null)"));
 const practice=fs.readFileSync(path.join(app,'world-speaking-practice.mjs'),'utf8');
 assert.equal((practice.match(/items_version:bank\.contentHash/g)||[]).length,2,'시험 형식·역할극 모두 판 지문을 보낸다');
 assert.ok(practice.includes('status.itemsVersion===bank?.contentHash'),'서버 판이 다르면 자동 피드백 단추를 띄우지 않는다');
});

// ── 시험 정보 「말하기 평가도 준비해요」와 이번 주 계획의 말하기 칸(10-21) ──
test('말하기 평가 선택: 이 기기에만 계정·손님마다 따로 두고({on,at}), 한 주의 시각·해 본 유형을 계획에 넘긴다',()=>{
 const storage=memory(),at='2026-10-21T03:00:00.000Z';
 assert.equal(SPEAKING_EXAM_KEY,'synk.world.speaking.exam.v1');
 assert.equal(readSpeakingExam({storage,owner:'acc-a'}),false,'처음에는 꺼짐');
 assert.equal(writeSpeakingExam({storage,owner:'acc-a',on:true,now:()=>Date.parse(at)}),true);
 assert.deepEqual(JSON.parse(storage.getItem('synk.world.speaking.exam.v1:acc-a')),{on:true,at});
 assert.equal(readSpeakingExam({storage,owner:'acc-a'}),true);
 assert.equal(readSpeakingExam({storage,owner:'acc-b'}),false,'다른 계정에는 없다');assert.equal(readSpeakingExam({storage,owner:'guest'}),false,'손님에게도 없다');
 writeSpeakingExam({storage,owner:'acc-a',on:false});assert.equal(readSpeakingExam({storage,owner:'acc-a'}),false);
 storage.setItem('synk.world.speaking.exam.v1:guest','{broken');assert.equal(readSpeakingExam({storage,owner:'guest'}),false,'못 읽으면 꺼짐');
 assert.equal(writeSpeakingExam({storage:null,owner:'acc-a',on:true}),false,'저장소가 없으면 쓰지 못했다고 알린다');
 // 한 주: 센 시도만, 그 주(월요일 0시부터) 안의 유형만 「해 봤어요」. 지난주·세지 않은 녹음·역할극은 유형에 들지 않는다(역할극 시각은 times에 남는다).
 const week={start:Date.parse('2026-10-18T15:00:00.000Z'),end:Date.parse('2026-10-25T15:00:00.000Z')};
 storage.setItem('synk.world.speaking.v1:acc-a',JSON.stringify({consent:null,log:[{at,mode:'exam',type:3,source:'self',counted:true},{at,mode:'exam',type:5,source:'ai-unclear',counted:false},
  {at:'2026-10-15T03:00:00.000Z',mode:'exam',type:1,source:'ai-reference',counted:true},{at,mode:'roleplay',itemId:'rp-cafe-tea',done:true,counted:true}]}));
 const state=speakingWeek({storage,owner:'acc-a',week});
 assert.deepEqual(state.tried,[3]);assert.equal(state.times.length,3);assert.deepEqual(speakingWeek({storage,owner:'acc-b',week}),{times:[],tried:[]});
 assert.deepEqual(readSpeakingSummary({storage,owner:'acc-a'}).typeTimes,{1:['2026-10-15T03:00:00.000Z'],2:[],3:[at],4:[],5:[],6:[]});
});

test('계획 연결: 말하기를 고른 TOPIK 학생만 이번 주 계획·추천·시험 정보 칸에 말하기가 생기고, 고르지 않은 학생은 지금과 같다',async()=>{
 const [{createWorldEducation},{worldLearning},{createWorldLearningPlan},{worldPosition},{createLifeProgress},{PACKS,LESSONS}]=await Promise.all(['../world-learning-ui.mjs','../world-learning-map.mjs','../world-learning-plan.mjs','../world-position-kit.mjs','../life-progress.mjs','../life-content.mjs'].map(file=>import(file)));
 const fullMemory=()=>{const values=new Map();return {get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k)};};
 // 같은 기기 기록으로 시작하는 TOPIK 학생 한 명(손님): 학습 목표 저장 → 학습 화면. host: 호스트가 넘기는 말하기 함수 묶음(app-shell과 같은 꼴) 또는 null.
 function fixture({host=true,type='topik1',audio='available'}={}){
  const storage=fullMemory(),life=createLifeProgress({storage,owner:'guest'}),plans=[],shown=[],opened=[];life.summary(PACKS,LESSONS);
  life.updateLearningProfile({consent:true,expectedRevision:life.learningProfile().profile.revision,values:{reasons:['exam'],primaryReason:'exam',examType:type,targetGrade:type==='topik2'?4:type==='topik1'?2:null,examDate:'2027-04',weeklyMinutes:120},today:{audio}});
  const speakingPractice=host?{available:()=>true,candidates:()=>SPEAKING_CANDIDATES.filter(row=>row.exam==='speaking'),chosen:owner=>readSpeakingExam({storage,owner}),choose:(owner,on)=>writeSpeakingExam({storage,owner,on}),
   week:(owner,week)=>speakingWeek({storage,owner,week}),open:route=>opened.push(route)}:null;
  const education=createWorldEducation({home:{updateStudy:plan=>plans.push(plan),toast(){},showPanel:(title,html)=>shown.push(html),closePanel(){}},getProgress:()=>life,engine:worldLearning,createPlan:createWorldLearningPlan,
   launchGame(){},startLesson(){},startReview(){},position:worldPosition,speakingPractice,target:{localStorage:storage,addEventListener(){},removeEventListener(){},document:{querySelector:()=>null}}});
  return {storage,life,education,plans,shown,opened};
 }
 // 고르지 않은 학생: 말하기 함수가 있어도 계획은 말하기 함수가 없던 판과 바이트까지 같고, Core 후보에도 말하기가 없다.
 for(const type of ['topik1','topik2']){
  const before=fixture({host:false,type}),after=fixture({type});
  const a=before.education.refresh(),b=after.education.refresh();
  assert.equal(JSON.stringify(b.examPlan),JSON.stringify(a.examPlan),`${type}: 고르지 않은 학생의 계획`);
  assert.ok(b.examPlan&&!b.examPlan.areas.some(row=>row.area==='speaking')&&!('speaking' in b.examPlan));
  assert.ok(!b.candidates.some(candidate=>candidate.route==='speaking'));
 }
 // 고른 학생(이 기기, 이 주인): 영역 speaking · 아직 안 해 본 유형 여섯 · 추천 후보는 route 'speaking'과 계획 토큰.
 const f=fixture();writeSpeakingExam({storage:f.storage,owner:'guest',on:true});
 const chosen=f.education.refresh(),plain=fixture().education.refresh();
 assert.equal(chosen.examPlan.exam.speaking,true);assert.deepEqual(chosen.examPlan.speaking,{untried:6,total:6});
 // 말하기는 다른 영역의 자리를 빼앗지 않고 한 주에 한 번을 더한다(10-21 결정) — 배우기 판 줄·머리 줄의 「이번 주 n번」도 그만큼 는다.
 assert.equal(chosen.examPlan.areas.find(row=>row.area==='speaking')?.planned,1);
 assert.deepEqual(chosen.examPlan.areas.filter(row=>row.area!=='speaking'),plain.examPlan.areas,'다른 영역은 고르지 않은 학생과 같다');
 const sum=plan=>plan.areas.reduce((n,row)=>n+row.planned,0);
 assert.equal(sum(chosen.examPlan),sum(plain.examPlan)+1);assert.equal(chosen.examPlan.sessions.total,sum(chosen.examPlan));
 assert.ok(f.education.planRow().includes(`이번 주 연습 0/${sum(chosen.examPlan)} `),'배우기 판 줄의 이번 주 횟수에 말하기 한 번이 들어 있다');
 const offered=chosen.candidates.filter(candidate=>candidate.route==='speaking');
 assert.deepEqual(offered.map(candidate=>candidate.routeId),['speaking:1','speaking:2','speaking:3','speaking:4','speaking:5','speaking:6']);
 assert.ok(offered.every(candidate=>candidate.goals.includes('plan.area.speaking')&&candidate.audioRequired===true&&candidate.targets.length===0&&/^말하기 연습 · /.test(candidate.label)));
 // 이번 주에 1번을 해 보면: 필요 5, 이번 주 한 번, 1번은 추천 후보에서 빠진다(다른 계정 기록은 세지 않는다).
 f.storage.setItem('synk.world.speaking.v1:guest',JSON.stringify({consent:null,log:[{at:new Date().toISOString(),mode:'exam',type:1,source:'self',counted:true}]}));
 f.storage.setItem('synk.world.speaking.v1:acc-b',JSON.stringify({consent:null,log:[{at:new Date().toISOString(),mode:'exam',type:2,source:'self',counted:true}]}));
 const after=f.education.refresh();
 assert.deepEqual(after.examPlan.speaking,{untried:5,total:6});assert.equal(after.examPlan.areas.find(row=>row.area==='speaking').done,1);
 assert.deepEqual(after.candidates.filter(candidate=>candidate.route==='speaking').map(candidate=>candidate.routeId),['speaking:2','speaking:3','speaking:4','speaking:5','speaking:6']);
 // 시험 정보 칸: 말하기를 쓸 수 있으면 체크 하나(고른 값 그대로, 이 기기라는 설명), 없으면 칸이 없다.
 f.education.open();assert.match(f.shown.at(-1),/<label class="study-consent study-speaking" data-study-speaking><input type="checkbox" name="speakingExam" checked><span><strong>말하기 평가도 준비해요<\/strong><small>[^<]*이 기기에만 저장돼요\.<\/small>/);
 const none=fixture({host:false});none.education.open();assert.doesNotMatch(none.shown.at(-1),/data-study-speaking|speakingExam/);
 const unknown=fixture({type:'unknown'});writeSpeakingExam({storage:unknown.storage,owner:'guest',on:true});unknown.education.open();
 assert.match(unknown.shown.at(-1),/data-study-speaking hidden>/,'시험 종류를 모르면 칸을 숨긴다');
 assert.ok(!unknown.education.refresh().examPlan.areas.some(row=>row.area==='speaking'),'시험 종류를 모르면 계획에도 없다');
 // 소리를 끈 날: 계획에서 닫고 까닭을 남기며, Core도 말하기 후보를 뺀다.
 const quiet=fixture({audio:'off'});writeSpeakingExam({storage:quiet.storage,owner:'guest',on:true});
 const muted=quiet.education.refresh();
 assert.ok(!muted.examPlan.areas.some(row=>row.area==='speaking'));assert.ok(muted.examPlan.notes.includes('speaking-audio-off'));
 assert.notEqual(muted.selected?.route,'speaking');assert.ok(muted.excluded.some(row=>row.id==='topik-speaking-1'&&row.reasons.includes('audio.unavailable')));
});

test('계획 연결: app-shell은 말하기 모듈을 정적으로 부르지 않고 함수로 넘기며, 문항을 읽으면 계획을 다시 세우고, 말한 날은 공부한 날로 센다',()=>{
 const shell=fs.readFileSync(path.join(app,'app-shell.mjs'),'utf8');
 assert.doesNotMatch(shell,/^import[^\n]*world-speaking-practice/m);
 assert.match(shell,/speakingPractice:\{available:\(\)=>!!speakingModule\?\.speakingReady\(\)/);
 for(const name of ['readSpeakingExam','writeSpeakingExam','speakingWeek'])assert.ok(shell.includes(`speakingModule.${name}({storage:localStorage,owner`),name);
 assert.ok(shell.includes("SPEAKING_CANDIDATES.filter(row=>row.exam==='speaking')"),'계획에는 시험 유형만(카페 역할극은 아직 넣지 않는다)');
 assert.ok(shell.includes('.then(()=>{repaintSpeakingRow();education?.refresh();})'),'은행을 읽으면 추천·계획을 다시 세운다');
 assert.ok(shell.includes('speakingModule.readSpeakingSummary({storage:localStorage,owner:writingOwnerId()}).times)add(at)'),'알림의 「그날 공부함」에 말하기 시각');
 const ui=fs.readFileSync(path.join(app,'world-learning-ui.mjs'),'utf8');
 assert.ok(ui.includes("speakingPractice.open('speaking')"),'계획 판의 「말하기 연습 열기」는 유형 목록을 연다');
 assert.ok(ui.includes("if(selected.route==='speaking'&&typeof speakingPractice?.open==='function')return speakingPractice.open(selected.routeId);"),'「지금 할 것」은 그 유형을 바로 연다');
});
