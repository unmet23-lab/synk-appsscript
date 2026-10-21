// WORLD 말하기 연습 피드백의 핵심(2026-10-21 시범). 프롬프트·출력 꼴·답 정리·값 셈만 있고 네트워크·파일은 쓰지 않는다.
// 부르는 쪽: tools/lib/말하기호출.mjs(로컬 측정·시범), 나중에 SYNK-talk world-speaking 함수(같은 파일을 동봉해 옮긴다).
// 설계: experiences/synk-world-app/qa/speaking-pilot-20261021/설계.md
// · 소리는 Vertex Gemini만 듣는다(학습에 쓰지 않는 유료 경로). Claude에는 받아 적은 글만 간다. 무료 Gemini API는 쓰지 않는다.
// · 피드백은 공식 세 요소(내용 및 과제 수행 · 언어 사용 · 발화 전달력)의 「참고」다. 점수·등급·급수·합격을 만들지 않는다.
// · 소리를 못 알아들은 것은 학생의 약점이 아니다. 말이 없거나 잘 안 들리면 그 요소를 보지 않고(보류) 다시 녹음을 권한다.
// · 답이 짧으면 언어 사용을 보류한다(문항의 minSyllables, 시범값). 보류는 서버가 정한다 — 모델이 낸 말을 그대로 믿지 않는다.

export const SPEAKING_FEEDBACK_VERSION='speaking-feedback-1';

// USD / 100만 토큰. Vertex 전역(global) 2026-10-21 가격 페이지, Anthropic 2026-10-06 표. 추정용이며 청구서가 아니다.
// Gemini 3.8 Flash의 2026-12-31까지 가격($0.75/$3.75)은 같은 모델 순 지출의 50%를 크레딧으로 돌려주는 방식이라 청구는 정가로 먼저 된다.
export const PRICES=Object.freeze({
 'gemini-3.8-flash':Object.freeze({input:1.5,output:7.5,cached:.15,promo:Object.freeze({until:'2026-12-31',input:.75,output:3.75})}),
 'gemini-3.7-flash':Object.freeze({input:1.5,output:7.5,cached:.15,promo:Object.freeze({until:'2026-12-31',input:.75,output:3.75})}),
 'gemini-3.6-flash':Object.freeze({input:1.5,output:7.5,cached:.15,promo:Object.freeze({until:'2026-12-31',input:.75,output:3.75})}),
 'gemini-3.5-flash-lite':Object.freeze({input:.3,output:2.5,cached:.03}),
 'gemini-3.1-flash-lite':Object.freeze({input:.25,audioInput:.5,output:1.5,cached:.025}),
 'gemini-3.5-transcribe':Object.freeze({input:2,output:12}),
 'claude-sonnet-5-5':Object.freeze({input:2,output:10,cacheRead:.2,cacheWrite5m:2.5}),
 'claude-haiku-5-5':Object.freeze({input:.1,output:.5,cacheRead:.01,cacheWrite5m:.125}),
 'claude-opus-5-5':Object.freeze({input:4,output:20,cacheRead:.2,cacheWrite5m:5})
});
export const LANGS=Object.freeze(['ko','en','mn']);
const LANG_NAME={ko:'한국어',en:'English',mn:'Монгол хэл (кирилл)'};
const isRecord=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=(value,max=400)=>typeof value==='string'?value.replace(/\s+/g,' ').trim().slice(0,max):'';

/** 한글 음절 수(받아 적은 말의 길이를 재는 시범 기준). */
export function syllables(value){return (String(value??'').match(/[가-힣]/g)||[]).length;}

// 점수·등급처럼 읽히는 말은 화면에 내지 않는다(쓰기 피드백의 판정 말 거름망과 같은 뜻).
const SCORE_WORDS=/(\d+\s*(점|급)|\d+\s*\/\s*\d+|\d+\s*%|[A-F][+-]?\s*(등급|단계)|등급|급수|합격|점수|만점|[초중고]급(자|\s*(수준|단계|정도))|\bscores?\b|\bgrades?\b|\blevel\s*\d|\b(pass(ed)?|fail(ed)?)\b|\b(beginner|intermediate|advanced)\s+level\b|оноо|түвшин\s*\d|тэнц|(анхан|дунд|ахисан)\s*шатны)/i;
// 자료 해석(5번)은 자료의 퍼센트를 그대로 인용하는 것이 정상이다 — 문항 자료에 있는 퍼센트만 거름에서 뺀다(10-21 Fable 검수).
function dataPercents(item){
 const out=new Set(),add=v=>{const m=String(v??'').match(/(\d+(?:\.\d+)?)\s*%/);if(m)out.add(m[1]);};
 for(const row of item?.data?.reasons?.rows||[])add(row.value);
 if(/%/.test(String(item?.data?.unit||'')))for(const s of item.data.series||[])out.add(String(s.value));
 return out;
}
function clean(value,max,allow=null){
 const out=text(value,max),probe=allow?.size?out.replace(/(\d+(?:\.\d+)?)\s*%/g,(m,n)=>allow.has(n)?' ':m):out;
 return SCORE_WORDS.test(probe)?'':out;
}

/** 문항 하나를 프롬프트에 넣을 글로 바꾼다(그림·자료는 글로 설명한다 — 모델은 그림을 보지 않는다). */
export function taskBrief(item,types){
 const type=types?.[item.type]||{};
 const lines=[`문항 유형: ${item.type}번 ${type.name||''} (준비 ${type.prepSec}초 · 대답 ${type.answerSec}초)`];
 if(item.situation)lines.push(`상황: ${item.situation}`);
 if(item.partner)lines.push(`${item.partner.role}의 말: 「${item.partner.line}」`);
 if(item.picture)lines.push(`그림: ${item.picture.alt}`);
 // 모델은 그림을 보지 않으므로 칸마다 장면 설명(scene, 없으면 alt)을 글로 준다.
 if(Array.isArray(item.panels))lines.push(`그림 ${item.panels.length}칸(순서대로): ${item.panels.map((p,i)=>`${i+1} ${p.scene||p.alt}`).join(' · ')}`);
 if(Array.isArray(item.dialogue))lines.push('대화:',...item.dialogue.map(d=>`${d.speaker}: ${d.line}`));
 if(item.news)lines.push(`뉴스: ${item.news}`);
 if(item.data){const d=item.data;lines.push(`자료(${d.source}) ${d.title}: ${d.series.map(s=>`${s.label} ${s.value}${d.unit}`).join(', ')}`);if(d.reasons)lines.push(`${d.reasons.title}: ${d.reasons.rows.map(r=>`${r.label} ${r.value}`).join(', ')}`);}
 if(item.prompt)lines.push(`과제: ${item.prompt}`);
 lines.push(`다뤄야 할 것: ${item.covers.map((c,i)=>`(${i+1}) ${c}`).join(' ')}`);
 return lines.join('\n');
}

const OUTPUT_RULES=lang=>`출력 언어 규칙 — 한 칸에 한 언어:
- transcript·quote·better·model_line 칸은 한국어로만 쓴다(학생이 한 말 그대로 또는 고친 한국어).
- good·try·note 칸은 ${LANG_NAME[lang]}로만 쓴다. 한국어 표현을 예로 들 때는 「」 안에 짧게만 넣는다.
- 점수·등급·급수·합격 여부·숫자 평가를 쓰지 않는다. 「참고」로 읽히게 쓴다.`;

// 공식 평가 요소의 세부 물음(topik.go.kr 시험 소개, 2026-10-21 확인)을 그대로 기준으로 준다.
const ELEMENTS=`평가 요소(공식, 참고로만 쓴다):
1. 내용 및 과제 수행 — 과제에 맞는 내용인가? 과제를 충실하게 했는가? 말의 짜임이 조직적인가?
2. 언어 사용 — 상황에 맞는 말을 썼는가? 어휘와 표현이 다양한가? 어휘와 표현이 정확한가?
3. 발화 전달력 — 발음과 억양을 알아들을 수 있는가? 말하는 속도가 자연스러운가?`;

/** 한 번에 듣고 피드백까지(경로 listen): Gemini가 소리를 듣고 세 요소를 낸다. */
export function listenPrompt({item,types,lang='ko'}){
 return `너는 한국어를 배우는 학생의 TOPIK 말하기 연습을 듣고 짧은 참고 피드백을 주는 선생님이다. 녹음 하나와 문항이 주어진다.
${ELEMENTS}

할 일:
- 먼저 녹음을 들리는 그대로 받아 적는다(transcript). 고치지 말고, 잘 안 들린 곳은 (?)로 둔다. 말이 없으면 빈 글로 둔다.
- audio.speech: 말소리가 또렷하면 clear, 일부가 잘 안 들리면 partly_unclear, 거의 알아들을 수 없으면 unclear, 말이 없거나 잡음뿐이면 none.
- audio.language: 대부분 한국어면 ko, 한국어와 다른 말이 섞였으면 mixed, 한국어가 아니면 other.
- covered: '다뤄야 할 것'의 번호 가운데 학생이 실제로 말한 것만(1부터). 말하지 않은 것은 넣지 않는다.
- task·language·delivery 각각 good(잘한 점 하나)·try(다음에 해 볼 것 하나)를 짧게. 칭찬을 지어내지 않는다.
- language.quote는 학생이 실제로 한 말에서 고칠 곳 하나를 그대로 옮기고, language.better는 그 부분을 자연스럽게 고친 한국어다. 고칠 곳이 없으면 둘 다 빈 글.
- delivery는 녹음에서 실제로 들린 것만 말한다(속도·멈춤·끝소리·억양). 발음이 틀렸다고 단정하지 말고, 확실하지 않으면 good만 쓰고 try는 빈 글로 둔다.
- 소리가 잘 안 들리는 것은 학생의 잘못이 아니다. 그런 경우 note에 다시 녹음해 보자고만 쓴다.
- 대답이 아주 짧으면(한글 ${item.minSyllables||20}음절 미만) language는 모두 빈 글로 두고, 다른 칸에서도 문법·어휘를 지적하지 않는다(더 길게 말해 보자고만).
- model_line: 이 문항에서 학생이 다음에 써 볼 만한 한국어 한 문장.
${OUTPUT_RULES(lang)}

문항:
${taskBrief(item,types)}`;
}

/** 나눠서(경로 split) 1단계: Gemini가 듣고 받아 적기와 전달 관찰만 낸다(내용·언어 판단은 하지 않는다). */
export function hearPrompt({item,types}){
 return `너는 한국어 학습자의 말하기 녹음을 듣는 받아쓰기·관찰 담당이다. 판단이나 피드백은 하지 않는다.
- transcript: 들리는 그대로 받아 적는다. 고치지 말고, 잘 안 들린 곳은 (?)로 둔다. 말이 없으면 빈 글.
- audio.speech: clear · partly_unclear · unclear · none(말이 없거나 잡음뿐).
- audio.language: ko · mixed · other.
- delivery_notes: 녹음에서 실제로 들린 전달 관찰을 한국어로 짧게 0~3개(속도, 긴 멈춤, 끝소리가 작아짐, 억양 등). 발음이 틀렸다고 단정하지 않는다. 확실하지 않으면 쓰지 않는다.
- speech_seconds: 실제로 말한 시간(초, 어림).
참고로 문항은 다음과 같다(받아 적는 데만 쓴다):
${taskBrief(item,types)}`;
}

/**
 * 문제를 보여 주지 않고 받아 적기만(경로 blind-*): 10-21 측정에서 문제 글을 함께 준 듣기는 4초 잡음에도 그 문제의 그럴듯한 대답을
 * 통째로 지어냈다(c10 · Flash 3.6·3.7). 받아 적는 단계에는 문제를 주지 않고, 피드백은 받아 적은 글로 따로 쓴다.
 */
export function blindHearPrompt(){
 return `너는 한국어 학습자의 말하기 녹음을 듣고 받아 적는 담당이다. 문제나 상황은 알려 주지 않는다 — 짐작해서 채우지 않는다.
- transcript: 소리에서 실제로 들린 말만 들리는 그대로 받아 적는다. 고치지 말고, 잘 안 들린 곳은 (?)로 둔다.
- 사람 말소리가 없으면(조용함·잡음·숨소리·음악뿐) transcript는 반드시 빈 글이고 audio.speech는 none이다. 말을 지어내지 않는다.
- 한국어가 아닌 말이어도 사람 말소리면 들리는 그대로 받아 적고 audio.language를 other로 둔다.
- audio.speech: clear · partly_unclear · unclear · none. audio.language: ko · mixed · other.
- delivery_notes: 실제로 들린 전달 관찰을 한국어로 짧게 0~3개(속도, 긴 멈춤, 끝소리가 작아짐, 억양). 발음이 틀렸다고 단정하지 않는다. 확실하지 않으면 쓰지 않는다.
- speech_seconds: 실제로 말한 시간(초, 어림).`;
}

/** 나눠서 2단계: Claude가 받아 적은 글로 내용·언어 피드백을 쓴다(소리는 받지 않는다). */
export function writeSystem(lang='ko'){
 return `너는 한국어를 배우는 학생의 TOPIK 말하기 연습에 짧은 참고 피드백을 주는 선생님이다. 녹음은 듣지 못하고, 받아 적은 글과 듣기 담당의 전달 관찰만 받는다.
${ELEMENTS}

할 일:
- covered: '다뤄야 할 것'의 번호 가운데 학생이 실제로 말한 것만(1부터).
- task·language 각각 good(잘한 점 하나)·try(다음에 해 볼 것 하나)를 짧게. 칭찬을 지어내지 않는다.
- language.quote는 받아 적은 글에서 고칠 곳 하나를 그대로 옮기고, language.better는 자연스럽게 고친 한국어다. 고칠 곳이 없으면 둘 다 빈 글.
- 받아 적은 글의 (?)는 잘 안 들린 곳이다. 그곳을 학생의 실수로 보지 않는다.
- 받아 적기 담당은 문제를 모른 채 들어서 이름·낱말을 비슷한 소리로 잘못 적었을 수 있다(예: 문제의 「수아」를 「수어」로). 문제에 나오는 말과 소리만 조금 다르면 받아 적기 차이로 보고 고칠 곳으로 고르지 않는다.
- delivery는 전달 관찰을 학생에게 전하는 말로만 옮긴다. 관찰이 없으면 good·try를 빈 글로 둔다. 새로 지어내지 않는다.
- 답 길이가 「짧은 답」이면 language는 모두 빈 글로 두고, 다른 칸에서도 문법·어휘를 지적하지 않는다(더 길게 말해 보자고만).
- model_line: 이 문항에서 학생이 다음에 써 볼 만한 한국어 한 문장.
${OUTPUT_RULES(lang)}`;
}
export function writeUser({item,types,heard}){
 const n=syllables(heard.transcript||''),min=Number(item?.minSyllables)||20;
 return `문항:\n${taskBrief(item,types)}\n\n받아 적은 글: 「${heard.transcript||''}」\n답 길이: 한글 ${n}음절(${n<min?'짧은 답':'보통'} — 기준 ${min}음절)\n소리 상태: ${heard.audio?.speech||'unknown'} · 언어 ${heard.audio?.language||'unknown'}\n전달 관찰: ${(heard.delivery_notes||[]).join(' / ')||'(없음)'}`;
}

/** 역할극 한 차례(경로 turn): 학생이 한 말에서 주문 칸을 고른다. 다음 직원 말은 화면이 정한다(미리 구운 목소리). */
export function turnPrompt({roleplay,step,lang='ko'}){
 return `한국어 학습자가 카페 직원과 말로 주문하는 연습을 하고 있다. 직원의 말에 학생이 대답한 녹음을 듣고 주문 내용을 고른다.
직원의 말: 「${step.line}」
학생의 목표: ${roleplay.mission}
- heard: 들리는 그대로 받아 적은 한국어(고치지 않는다, 안 들린 곳은 (?)).
- audio.speech: clear · partly_unclear · unclear · none. audio.language: ko · mixed · other.
- drink: tea(차·녹차·홍차 등) · juice · coffee · other · none(말하지 않음).
- temperature: warm(따뜻한·뜨거운) · cold(차가운·시원한·아이스) · none.
- count: 학생이 실제로 말한 잔 수(숫자). 잔 수를 말하지 않았으면 반드시 0이다(「주세요」만 있으면 한 잔으로 짐작하지 않는다).
- place: here(여기서·매장에서·마시고 갈게요) · togo(가져갈게요·포장) · none.
- answer: yes(네·맞아요) · no(아니요·아니에요) · none.
- polite: 직원에게 맞는 높임말(-요/-습니다, 주세요)이면 yes, 반말이면 no, 판단할 수 없으면 unclear.
- better: 이 차례에서 자연스러운 한국어 한 문장(목표에 맞게).
- tip: ${LANG_NAME[lang]}로 짧은 도움말 하나. 이미 잘했으면 빈 글. 점수·평가 말은 쓰지 않는다.`;
}

// ── 출력 꼴(Vertex responseSchema · OpenAPI 부분집합 / Claude output_config.format · JSON Schema) ──
const S=(type,extra={})=>({type,...extra});
const AUDIO={type:'object',properties:{speech:S('string',{enum:['clear','partly_unclear','unclear','none']}),language:S('string',{enum:['ko','mixed','other']})},required:['speech','language']};
const GOODTRY={type:'object',properties:{good:S('string'),try:S('string')},required:['good','try']};
const LANGUSE={type:'object',properties:{good:S('string'),try:S('string'),quote:S('string'),better:S('string')},required:['good','try','quote','better']};
export const LISTEN_SCHEMA={type:'object',properties:{transcript:S('string'),audio:AUDIO,covered:{type:'array',items:S('integer')},task:GOODTRY,language:LANGUSE,delivery:GOODTRY,model_line:S('string'),note:S('string')},required:['transcript','audio','covered','task','language','delivery','model_line','note']};
export const HEAR_SCHEMA={type:'object',properties:{transcript:S('string'),audio:AUDIO,delivery_notes:{type:'array',items:S('string')},speech_seconds:S('number')},required:['transcript','audio','delivery_notes','speech_seconds']};
export const WRITE_SCHEMA={type:'object',properties:{covered:{type:'array',items:S('integer')},task:GOODTRY,language:LANGUSE,delivery:GOODTRY,model_line:S('string'),note:S('string')},required:['covered','task','language','delivery','model_line','note']};
export const TURN_SCHEMA={type:'object',properties:{heard:S('string'),audio:AUDIO,drink:S('string',{enum:['tea','juice','coffee','other','none']}),temperature:S('string',{enum:['warm','cold','none']}),count:S('integer'),place:S('string',{enum:['here','togo','none']}),answer:S('string',{enum:['yes','no','none']}),polite:S('string',{enum:['yes','no','unclear']}),better:S('string'),tip:S('string')},required:['heard','audio','drink','temperature','count','place','answer','polite','better','tip']};
// Vertex responseSchema는 OpenAPI 부분집합(대문자 형 이름)을 받는다.
export function vertexSchema(schema){
 if(Array.isArray(schema))return schema.map(vertexSchema);
 if(!isRecord(schema))return schema;
 const out={};
 for(const [key,value]of Object.entries(schema)){
  if(key==='type')out.type=String(value).toUpperCase();
  else if(key==='properties')out.properties=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,vertexSchema(v)]));
  else if(key==='items')out.items=vertexSchema(value);
  else out[key]=value;
 }
 if(out.properties)out.propertyOrdering=Object.keys(out.properties);
 return out;
}
// Claude 구조화 출력은 모든 객체에 additionalProperties:false가 있어야 한다.
export function claudeSchema(schema){
 if(Array.isArray(schema))return schema.map(claudeSchema);
 if(!isRecord(schema))return schema;
 const out={...schema};
 if(out.properties)out.properties=Object.fromEntries(Object.entries(out.properties).map(([k,v])=>[k,claudeSchema(v)]));
 if(out.items)out.items=claudeSchema(out.items);
 if(out.type==='object')out.additionalProperties=false;
 return out;
}

// ── 답 정리: 모델 출력 → 화면에 줄 꼴. 보류·거름은 여기서 정한다. ──
const ELEMENT_IDS=['task','language','delivery'];
/**
 * raw: listen 경로의 출력, 또는 split 경로의 {heard, write}를 합친 것. item: 문항. lang: 설명 언어.
 * 돌려주는 것: {status:'ok', heard:{transcript,speech,language}, covered:[0-base], elements:{task,language,delivery}, modelLine, note}
 *             또는 {status:'no_speech'|'not_korean'|'unclear'} — 다시 녹음을 권하고 학생의 약점으로 세지 않는다(counted:false).
 */
/** 소리 관문: 말이 없거나(no_speech) 한국어가 아니거나(not_korean) 거의 안 들리면(unclear) 피드백을 만들지 않는다. */
export function audioGate(raw){
 const audio=isRecord(raw?.audio)?raw.audio:{},speech=['clear','partly_unclear','unclear','none'].includes(audio.speech)?audio.speech:'unclear';
 const language=['ko','mixed','other'].includes(audio.language)?audio.language:'ko';
 const transcript=text(raw?.transcript,1200),n=syllables(transcript);
 // 한국어가 아닌 말은 한글 음절이 없으니 말소리 여부보다 먼저 본다. 거의 알아들을 수 없으면 받아 적은 글도 믿을 수 없다 — 내용·언어도 보지 않는다.
 const spoken=speech!=='none'&&(n>=3||String(transcript).replace(/[\s(?)]/g,'').length>=6);
 // 한글이 거의 없고 다른 글자로 받아 적혔으면 모델이 「섞임」이라 해도 한국어 대답이 아니다(10-21 측정 c11: Flash-Lite가 영어 대답을 mixed로 냄).
 const foreign=n<3&&(String(transcript).match(/[A-Za-zА-Яа-яЁёӨөҮү]/g)||[]).length>=6;
 const status=!spoken?'no_speech':language==='other'||foreign?'not_korean':n<3?'no_speech':speech==='unclear'?'unclear':'ok';
 return {status,heard:{transcript,speech,language,syllables:n}};
}
// 사람은 한국어를 1초에 9음절보다 빨리 말하지 못한다. 녹음 길이에 비해 받아 적은 음절이 너무 많으면 지어낸 받아쓰기로 보고 피드백하지 않는다.
const MAX_SYLLABLES_PER_SECOND=9;
export function normalizeFeedback(raw,{item,seconds=null}){
 if(!isRecord(raw))return {status:'unavailable',counted:false};
 const gate=audioGate(raw);
 if(gate.status!=='ok')return {status:gate.status,counted:false,heard:gate.heard};
 if(Number(seconds)>0&&gate.heard.syllables>Number(seconds)*MAX_SYLLABLES_PER_SECOND)return {status:'unclear',counted:false,heard:gate.heard,suspect:'too-many-syllables'};
 // 쓰기 몫(task·language·delivery)이 하나도 없으면 피드백을 못 받은 것이다 — 빈 「참고」를 정상으로 내지 않는다(10-21 아르곤 백엔드 검수).
 if(!ELEMENT_IDS.some(id=>isRecord(raw[id])))return {status:'unavailable',counted:false};
 const {transcript,speech,language,syllables:n}=gate.heard;
 const covers=Array.isArray(item?.covers)?item.covers.length:0;
 const covered=[...new Set((Array.isArray(raw.covered)?raw.covered:[]).filter(i=>Number.isInteger(i)&&i>=1&&i<=covers).map(i=>i-1))].sort((a,b)=>a-b);
 const allow=dataPercents(item),pick=(key,fields)=>{const v=isRecord(raw[key])?raw[key]:{};return Object.fromEntries(fields.map(f=>[f,clean(v[f],f==='quote'||f==='better'?200:300,allow)]));};
 const elements={task:pick('task',['good','try']),language:pick('language',['good','try','quote','better']),delivery:pick('delivery',['good','try'])};
 // 인용과 고친 말은 짝이다 — 한쪽이 비었으면(거름망에 걸린 것 포함) 둘 다 뺀다(10-21 아르곤 백엔드 검수). 고친 말이 학생 말과 같으면 고칠 곳이 없는 것이다.
 if(!elements.language.quote||!elements.language.better||elements.language.quote===elements.language.better){elements.language.quote='';elements.language.better='';}
 // 인용은 실제로 받아 적은 말에 있어야 한다(지어낸 인용을 막는다 — 띄어쓰기만 무시).
 const squash=v=>v.replace(/\s+/g,'');
 // 한두 글자 인용은 아무 곳에나 걸리므로 세 음절 이상만 받는다(10-21 아르곤 검수).
 if(elements.language.quote&&(syllables(elements.language.quote)<3||!squash(transcript).includes(squash(elements.language.quote)))){elements.language.quote='';elements.language.better='';}
 const short=n<(Number(item?.minSyllables)||20);
 if(short)elements.language={withheld:'short'};
 // 일부가 잘 안 들렸으면 그 까닭이 마이크·주변 소리일 수 있어 전달력은 보지 않는다. 아주 짧은 답도 마찬가지다.
 if(speech==='partly_unclear'||n<10)elements.delivery={withheld:speech==='partly_unclear'?'audio':'short'};
 for(const id of ELEMENT_IDS){const e=elements[id];if(!e.withheld&&!e.good&&!e.try&&!e.quote)elements[id]={withheld:'nothing'};}
 return {status:'ok',counted:true,heard:gate.heard,covered,elements,modelLine:clean(raw.model_line,200,allow),note:clean(raw.note,300,allow),...(speech==='partly_unclear'?{partlyUnclear:true}:{})};
}
/** split 경로의 두 출력을 listen 꼴로 합친다(소리 상태·받아 적기는 듣기 단계의 것을 쓴다). */
export function mergeSplit(heard,write){
 if(!isRecord(heard))return null;
 return {transcript:heard.transcript,audio:heard.audio,covered:write?.covered,task:write?.task,language:write?.language,delivery:write?.delivery,model_line:write?.model_line,note:write?.note};
}

/** 역할극 한 차례의 출력 정리 + 다음 걸음. 다음 직원 말은 미리 구운 소리 가운데서 고른다(새 음성을 만들지 않는다). */
export function normalizeTurn(raw,{roleplay,stepId,seconds=null}){
 if(!isRecord(raw))return {status:'unavailable',counted:false};
 const audio=isRecord(raw.audio)?raw.audio:{},speech=['clear','partly_unclear','unclear','none'].includes(audio.speech)?audio.speech:'unclear';
 const heard=text(raw.heard,300);
 if(speech==='none'||!heard.replace(/[\s(?)]/g,''))return {status:'no_speech',counted:false,heard};
 // 한글이 거의 없고 다른 글자로 받아 적혔으면 모델이 「섞임」이라 해도 한국어 대답이 아니다(시험 형식 audioGate와 같은 선 — 10-21 아르곤 백엔드 검수).
 if(audio.language==='other'||(syllables(heard)<3&&(heard.match(/[A-Za-zА-Яа-яЁёӨөҮү]/g)||[]).length>=6))return {status:'not_korean',counted:false,heard};
 if(syllables(heard)<1)return {status:'no_speech',counted:false,heard};
 if(speech==='unclear')return {status:'unclear',counted:false,heard};
 if(Number(seconds)>0&&syllables(heard)>Number(seconds)*MAX_SYLLABLES_PER_SECOND)return {status:'unclear',counted:false,heard,suspect:'too-many-syllables'};
 const slot={drink:['tea','juice','coffee','other','none'].includes(raw.drink)?raw.drink:'none',temperature:['warm','cold','none'].includes(raw.temperature)?raw.temperature:'none',
  count:Number.isInteger(raw.count)&&raw.count>=0&&raw.count<10?raw.count:0,place:['here','togo','none'].includes(raw.place)?raw.place:'none',answer:['yes','no','none'].includes(raw.answer)?raw.answer:'none'};
 return {status:'ok',counted:true,heard,unclear:speech!=='clear',slots:slot,polite:['yes','no','unclear'].includes(raw.polite)?raw.polite:'unclear',better:clean(raw.better,160),tip:clean(raw.tip,240),next:nextStep({roleplay,stepId,slots:slot})};
}
/**
 * 받아 적은 말에서 주문 칸을 규칙으로 고른다(경로 turn-blind). 10-21 측정: 임무를 함께 준 Flash는 4초 잡음에도 「따뜻한 차 두 잔
 * 매장에서 마시고 갈게요」를 들었다고 지어냈다(r7). 모델은 문제를 모른 채 받아 적기만 하고, 주문 칸은 여기서 정한다(지어낼 수 없다).
 */
const NUMBER_WORDS=Object.freeze({한:1,하나:1,두:2,둘:2,세:3,셋:3,네:4,넷:4,다섯:5});
// 「A 말고 B」·「A 아니고 B」·「A 대신 B」의 A는 고르지 않은 것이다 — 칸 고르기에서 뺀다(10-21 아르곤 다시 받기 둘~다섯째).
// · 머리는 바로 앞 낱말(붙여 쓰면 그 앞말 — 「커피말고」)이다. 주문 말(온도·음료/거·수·잔)이 아니면(「매장 말고」) 그 낱말만 뺀다.
// · B(다음 「말고」나 끝까지)가 칸을 다시 말했으면 A 쪽(머리부터 앞으로 이어지는 주문 말)에서 그 칸의 낱말만 뺀다. 음료를 바꾸면
//   그 음료에 붙었던 온도도 버린다(「차가운 차 말고 커피」의 커피는 차갑다고 하지 않았다). 잔 수는 B가 다시 말할 때만 바꾼다 —
//   「차 한 잔 말고 두 잔」은 차 두 잔, 「커피 두 잔 말고 차」는 차 두 잔, 「따뜻한 차 두 잔 차가운 거 말고 따뜻한 걸로」는 온도만 고친 것이다.
// · B가 칸을 다시 말하지 않았으면(「차가운 거 말고요」) 머리에서 한 구절(온도 → 음료/거 → 수 → 잔의 차례가 거꾸로 이어지는 동안)만 뺀다.
// · 낱말의 칸: 온도 0 · 음료/거 1(「아이스커피」는 0과 1) · 수 2 · 잔 3(「두잔」은 2와 3). rank는 한 구절을 잴 때의 자리다.
const NOT_THIS=/^(.*?)(말고|말구|아니고|대신)(요|에)?$/;
const DRINK_WORD='(녹차|홍차|유자차|보리차|허브차|차|주스|쥬스|커피|아메리카노|라떼|카페라떼)(를|을|로|는|도|가|랑|하고|만)?';
const ORDER_WORDS=[
 [/^(따뜻한|따듯한|뜨거운|따끈한|차가운|시원한|아이스|찬|핫)$/,0,[0]],
 [new RegExp(`^(아이스|핫)${DRINK_WORD}$`),1,[0,1]],
 [new RegExp(`^${DRINK_WORD}$|^(거|것|걸|건)$`),1,[1]],
 [/^(\d+|한|두|세|네|다섯|하나|둘|셋|넷)$/,2,[2]],
 [/^(\d+|한|두|세|네|다섯|하나|둘|셋|넷)(잔|개|컵)$/,3,[2,3]],
 [/^(잔|개|컵)$/,3,[3]]
];
const orderWord=w=>{for(const [re,rank,cats] of ORDER_WORDS)if(re.test(w))return {rank,cats};return null;};
// 음료 낱말 뒤에는 조사·「요」·「주세요」만 붙는다(「차가운」·「커피숍」은 음료 주문이 아니다).
const DRINK_TAIL='(를|을|로|는|도|가|랑|하고|만)?(요|예요|이요|주세요)?$';
/** 낱말들에서 주문 세 칸(음료·온도·잔 수)을 고른다. */
function orderSlots(tokens){
 const kept=tokens.join(' '),has=re=>tokens.some(w=>re.test(w));
 // 「차가운」은 차(tea)가 아니다 — 낱말 단위로 본다.
 const drink=has(new RegExp(`^(녹차|홍차|유자차|보리차|허브차|차)${DRINK_TAIL}`))?'tea':has(new RegExp(`^(주스|쥬스)${DRINK_TAIL}`))?'juice'
  :has(new RegExp(`^(아이스|핫)?(커피|아메리카노|라떼|카페라떼)${DRINK_TAIL}`))?'coffee':'none';
 // 차가운 것도 낱말 단위로 본다 — 「녹차가·홍차는·차가 두 잔」의 「차가」는 차 + 조사라 차가운 것이 아니다(10-21 문항 검수 P2).
 // 차가운 것: 차가운·차가워·차가우면·차갑게·차게·시원한·아이스(티)·찬 거. 「반찬」·「칭찬」의 「찬」은 아니다(10-21 아르곤 백엔드 검수).
 const temperature=/따뜻|따듯|뜨거|뜨겁|따끈|핫/.test(kept)?'warm':has(/^(차가[운워우]|차갑|차게|시원)|아이스|^찬$|^찬(거|걸|것)/)?'cold':'none';
 // 「동네 잔치」의 네 잔은 잔 수가 아니다 — 한글 수는 낱말 머리에서만 본다(「3개월」의 개도 잔 수가 아니다). 잔 없이 말한 수는
 // 주문하는 꼴(「둘이요」·「하나만 주세요」·「둘 주세요」)일 때만 센다 — 「하나만 물어볼게요」·「하나, 둘, 셋」·「둘 다」는 잔 수가 아니다(10-21 아르곤 다시 받기).
 const counted=kept.match(/(\d+)\s*(잔|컵|개(?!월))|(?:^|\s)(한|두|세|네|다섯)\s*(잔|컵|개(?!월))|(?:^|\s)(하나|둘|셋|넷|다섯)만?(?:이요|요|이에요|예요|주세요|\s+주세요)(?=$|\s)/);
 const number=counted?counted[1]||counted[3]||counted[5]:null,count=number?Number(number)||NUMBER_WORDS[number]||0:0;
 return {drink,temperature,count};
}
export function slotsFromText(text){
 const t=String(text??'').replace(/\(\?\)/g,' ').replace(/\s+/g,' ').trim(),words=t.split(/[\s,.!?~…]+/).filter(Boolean);
 const skip=new Set();
 words.forEach((w,i)=>{
  const m=w.match(NOT_THIS);if(!m)return;
  skip.add(i);
  const attached=m[1];
  let j=i-1;
  const headWord=attached||words[j];if(!headWord)return;
  const head=orderWord(headWord);
  if(!head){if(!attached)skip.add(j);return;}
  let end=words.findIndex((x,k)=>k>i&&NOT_THIS.test(x));if(end<0)end=words.length;
  const b=orderSlots(words.slice(i+1,end)),again=new Set([...(b.temperature!=='none'?[0]:[]),...(b.drink!=='none'?[1]:[]),...(b.count>0?[2,3]:[])]);
  if(again.size){
   if(again.has(1))again.add(0);
   const hit=o=>o.cats.some(c=>again.has(c));
   if(!attached&&hit(head))skip.add(j);
   for(let k=attached?j:j-1;k>=0;k--){const o=orderWord(words[k]);if(!o)break;if(hit(o))skip.add(k);}
   return;
  }
  if(!attached)skip.add(j--);
  for(let r=head.rank;r>0&&j>=0;j--){const o=orderWord(words[j]);if(!o||o.rank>=r)break;skip.add(j);r=o.rank;}
 });
 const tokens=words.filter((_,i)=>!skip.has(i)),kept=tokens.join(' ');
 const {drink,temperature,count}=orderSlots(tokens);
 const place=/여기서|매장|먹고\s*갈|마시고\s*갈|앉아서|안에서/.test(kept)?'here':/가져|포장|테이크\s*아웃|들고\s*갈/.test(kept)?'togo':'none';
 // 「네 잔」의 네는 대답이 아니다. 「예전에」·「네모난」·「응원」처럼 낱말 머리일 뿐인 것도 대답이 아니다.
 const said=words.join(' ');
 const answer=/^(네|예)+(?![가-힣])(?!\s*(잔|개|컵))|^넵(?![가-힣])|^응(?![가-힣])|맞아요|맞습니다|그래요/.test(said)?'yes':/^(아니|아뇨)|아니에요|아니요/.test(said)?'no':'none';
 const last=t.replace(/[.!?~…\s"'」』)\]]+$/,'');
 const polite=/(요|니다|세요|십시오|해요)$/.test(last)?'yes':/(줘|해|야|어|아|줄래|할래|봐)$/.test(last)?'no':'unclear';
 return {drink,temperature,count,place,answer,polite};
}

/**
 * 카페 역할극의 다음 걸음(화면도 같은 함수를 쓴다). 목표와 다르면 직원이 되묻거나(미리 구운 말이 있을 때) 튜터가 말풍선으로 돕는다.
 * 돌려주는 것: {step:'다음 직원 말 id'|'done', hint:null|'drink'|'temperature'|'count'|'place'|'answer'}
 */
export function nextStep({roleplay,stepId,slots}){
 const goal=roleplay.goal;
 if(['order','count','soldout'].includes(stepId)){
  if(slots.drink==='juice'&&stepId!=='soldout')return {step:'soldout',hint:null};
  // 잔 수만 묻는 차례(「따뜻한 차를 몇 잔…」)는 음료·온도를 말하지 않아도 되지만, 말했으면 그 말로 본다(10-21 아르곤 검수).
  // 말하지 않은 칸은 그 역할극의 목표로 채운다(다른 목표의 역할극이 더해져도 맞게 — 10-21 아르곤 백엔드 검수).
  const drink=stepId==='count'&&slots.drink==='none'?goal.drink:slots.drink,temp=stepId==='count'&&slots.temperature==='none'?goal.temperature:slots.temperature;
  if(drink!==goal.drink)return {step:stepId,hint:'drink'};
  if(temp!==goal.temperature)return {step:stepId,hint:'temperature'};
  if(slots.count===0)return {step:'count',hint:null};
  if(slots.count!==goal.count)return {step:stepId==='count'?'count':stepId,hint:'count'};
  return {step:'confirm',hint:null};
 }
 if(stepId==='confirm')return slots.answer==='yes'?{step:'place',hint:null}:{step:'confirm',hint:'answer'};
 if(stepId==='place')return slots.place===goal.place?{step:'done',hint:null}:{step:'place',hint:'place'};
 return {step:'done',hint:null};
}

// ── 값 셈 ──
/** Vertex usageMetadata → 추정 USD(정가·할인가). 소리 토큰은 promptTokensDetails의 AUDIO로 따로 센다. */
export function priceVertex(model,usage,{at=Date.now()}={}){
 const p=PRICES[model];if(!p||!isRecord(usage))return null;
 const prompt=Number(usage.promptTokenCount)||0,cached=Number(usage.cachedContentTokenCount)||0,out=(Number(usage.candidatesTokenCount)||0)+(Number(usage.thoughtsTokenCount)||0);
 const audio=(usage.promptTokensDetails||[]).filter(d=>d.modality==='AUDIO').reduce((n,d)=>n+(Number(d.tokenCount)||0),0);
 const textIn=Math.max(0,prompt-cached-audio);
 const cost=(rate)=>(textIn*rate.input+audio*(rate.audioInput??rate.input)+cached*(rate.cached??rate.input)+out*rate.output)/1e6;
 const list=cost(p),promo=p.promo&&at<=Date.parse(p.promo.until+'T23:59:59+09:00')?cost({...p,...p.promo,cached:p.promo.input/10}):list;
 return {list,promo,tokens:{text:textIn,audio,cached,output:usage.candidatesTokenCount||0,thinking:usage.thoughtsTokenCount||0}};
}
/** Anthropic usage → 추정 USD(캐시 쓰기 5분 1.25배, 읽기 0.1배). */
export function priceClaude(model,usage){
 const p=PRICES[model];if(!p||!isRecord(usage))return null;
 const read=Number(usage.cache_read_input_tokens)||0,write=Number(usage.cache_creation_input_tokens)||0,input=Number(usage.input_tokens)||0,out=Number(usage.output_tokens)||0;
 return {list:(input*p.input+write*p.cacheWrite5m+read*p.cacheRead+out*p.output)/1e6,tokens:{input,cacheWrite:write,cacheRead:read,output:out}};
}
/** 소리 길이로 미리 잡는 예약액(서버의 금액 예약용 어림): 초당 32토큰으로 넉넉히 + 글 입력 + 최대 출력. */
export function reserveEstimate({model,seconds,promptTokens=1500,maxOutput=2048}){
 const p=PRICES[model],s=Number(seconds);if(!p||!Number.isFinite(s)||s<0)return null;
 return (Math.ceil(s)*32*(p.audioInput??p.input)+promptTokens*p.input+maxOutput*p.output)/1e6;
}
