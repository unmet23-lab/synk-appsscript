'use strict';
// Product vocabulary and clarification replay. Core Ask chooses the next useful
// question; Core Interpretation/Domain own evidence and confirmed declarations.
// The frozen ko-1 module is retained so old saved rows never change meaning.
const Legacy = require('./member-statement-v1.cjs');
const Ask = require('../../../atlas/ask');
const PARSER_VERSION = 'member-statement-ko-2';
const MEMBER_STATEMENT_LIMITS = Object.freeze({ ...Legacy.MEMBER_STATEMENT_LIMITS, clarifications: 12 });
const VALUES = Legacy.MEMBER_STATEMENT_VALUES, LABELS = Legacy.MEMBER_STATEMENT_LABELS;
const CONDITIONS = Object.freeze({ ...Legacy.MEMBER_STATEMENT_CONDITIONS, 'after-example': '예시를 본 다음',
  'first-try-after-example': '처음 시도하며 예시를 본 다음', 'familiar-after-example': '익숙한 내용에서 예시를 본 다음', 'busy-after-example': '바쁠 때 예시를 본 다음' });
const plain = x => x !== null && typeof x === 'object' && !Array.isArray(x) && [Object.prototype, null].includes(Object.getPrototypeOf(x));
const data = (x, key) => { const d = Object.getOwnPropertyDescriptor(x, key);return d?.enumerable === true && Object.hasOwn(d, 'value'); };
const exact = (x, fields) => plain(x) && Reflect.ownKeys(x).length === fields.length && fields.every(key => data(x, key));
const list = (x, max) => Array.isArray(x) && x.length <= max && Reflect.ownKeys(x).length === x.length + 1 && Array.from({ length: x.length }, (_, i) => data(x, String(i))).every(Boolean);
const fail = () => { throw new TypeError('Member statement: invalid confirmed statement'); };
const instant = x => typeof x === 'string' && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x ? Date.parse(x) : fail();
const semanticKey = m => [m.field, m.value, m.polarity, m.condition || 'general'].join(':');
const copy = x => JSON.parse(JSON.stringify(x));
// Synchronous SHA-256 binds question IDs to the complete immutable source in
// browser, desktop and edge runtimes alike (no Node crypto/network dependency).
const SHA_K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
function sourceKey(text) {
  const bytes = new TextEncoder().encode(text), padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);padded.set(bytes);padded[bytes.length] = 128;
  new DataView(padded.buffer).setUint32(padded.length - 4, bytes.length * 8);
  const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], w = new Uint32Array(64), ro = (x,n) => (x >>> n) | (x << (32-n));
  for (let offset = 0; offset < padded.length; offset += 64) {
    const view = new DataView(padded.buffer, offset, 64);for (let i=0;i<16;i++) w[i]=view.getUint32(i*4);
    for(let i=16;i<64;i++){const x=w[i-15],y=w[i-2];w[i]=(w[i-16]+(ro(x,7)^ro(x,18)^(x>>>3))+w[i-7]+(ro(y,17)^ro(y,19)^(y>>>10)))>>>0;}
    let [a,b,c,d,e,f,g,hh]=h;
    for(let i=0;i<64;i++){const t1=(hh+(ro(e,6)^ro(e,11)^ro(e,25))+((e&f)^(~e&g))+SHA_K[i]+w[i])>>>0,t2=((ro(a,2)^ro(a,13)^ro(a,22))+((a&b)^(a&c)^(b&c)))>>>0;hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    [a,b,c,d,e,f,g,hh].forEach((v,i)=>{h[i]=(h[i]+v)>>>0;});
  }
  return h.map(n=>n.toString(16).padStart(8,'0')).join('');
}
const POSITIVE = /^(?:좋(?:아(?:해(?:요)?|요)?|다|습니다)?|선호(?:해(?:요)?|한다|합니다)|원(?:해(?:요)?|한다|합니다)|필요(?:해(?:요)?|하다|합니다)|편(?:해(?:요)?|하다|합니다)|편안(?:해(?:요)?|하다|합니다)|마음에들(?:어(?:요)?|어요)|(?:하고|받고|보고)?싶(?:어(?:요)?|다|습니다)|관심(?:이)?있(?:어(?:요)?|다|습니다)|해줘(?:요)?)$/u;
const NEGATIVE = /^(?:싫(?:어(?:요)?|다|습니다)|부담스러(?:워(?:요)?|워요)|좋(?:아하지|지는?|아하진)않(?:아(?:요)?|다|습니다)|선호하지않(?:아(?:요)?|는다|습니다)|원하지않(?:아(?:요)?|는다|습니다)|필요(?:가)?없(?:어(?:요)?|다|습니다)|필요하지않(?:아(?:요)?|다|습니다)|관심(?:이)?없(?:어(?:요)?|다|습니다))$/u;
const SUBJECTS = [
 ['support','independent',/^(?:혼자(?:서)?|스스로|독립적으로)(?:시도해보는|시도하는|해보는|해결하는|진행하는|하는|시도해보고|시도하고|해보고|하고)?(?:방식|것|편|게|걸|건|하기)?/u],
 ['support','together',/^(?:(?:다른사람과|누군가와|사람들과)?(?:같이|함께))(?:해보는|하는|해보고|하고)?(?:방식|것|편|게|걸|건|하기)?/u],
 ['support','example',/^(?:예시|예제|샘플)(?:를|가|는|부터)?(?:먼저)?(?:보는|살펴보는|보여주는|보고|보기)?(?:방식|것|편|게|걸|건)?/u],
 ['support','step',/^(?:단계별(?:로)?|차근차근|하나씩차례대로)(?:도움|안내|설명|알려주는|설명해주는)?(?:것|편|게|걸|건)?/u],
 ['support','choose',/^필요할때(?:만)?(?:도움(?:을)?(?:받는|선택하는|받고|선택하고)?)(?:것|편|게|걸|건)?/u],
 ['explanation','brief',/^(?:(?:설명(?:은|을)?)?(?:짧게|간단하게|간결하게|짧고핵심만)(?:설명해주는|설명하는|알려주는)?|(?:짧은|간단한|간결한)설명)(?:것|편|게|걸|건)?/u],
 ['explanation','detailed',/^(?:(?:설명(?:은|을)?)?(?:자세히|상세히|길게)(?:설명해주는|설명하는|알려주는)?|(?:자세한|상세한|긴)설명)(?:것|편|게|걸|건)?/u],
 ['explanation','standard',/^보통길이(?:의)?설명/u], ['practice-mode','mixed',/^듣기와읽기(?:를)?함께(?:하는)?(?:것|편|게|걸|건)?/u],
 ['practice-mode','listening',/^(?:듣기(?:연습)?|듣는연습|듣고배우는것)/u], ['practice-mode','reading',/^(?:읽기(?:연습)?|읽는연습|읽고배우는것)/u],
 ['topic','travel-planning',/^(?:여행일정(?:짜기)?|여행동선|여행계획)/u], ['topic','travel-food',/^(?:여행지음식|현지음식|음식주문)/u],
 ['topic','travel-stay',/^(?:여행지숙소|여행숙소)/u], ['topic','career-interview',/^면접(?:준비)?/u], ['topic','career-planning',/^(?:진로탐색|진로계획)/u],
 ['topic','content-video',/^(?:영상제작|영상만들기|동영상제작|영상만드는것)/u], ['topic','content-design',/^(?:디자인제작|디자인)/u],
 ['topic','ai-tools',/^(?:AI도구(?:활용)?|인공지능도구(?:활용)?)/iu], ['topic','work-collaboration',/^(?:업무협업|업무에서협업)/u]
];
function phrase(body, condition) {
  for(const [field,value,pattern] of SUBJECTS){const match=pattern.exec(body);if(!match)continue;const predicate=body.slice(match[0].length).replace(/^(?:을|를|이|가|은|는|에|엔|도)/u,'');
    const polarity=NEGATIVE.test(predicate)?'avoid':POSITIVE.test(predicate)?'prefer':null;if(polarity)return {field,value,polarity,condition};}
  return null;
}
function expanded(quote) {
  let body=quote.replace(/\s/gu,'').replace(/(?:지만|는데)$/u,'');
  if(/["“”‘’]/u.test(body)||/(?:라고|다고)(?:했|말|들)/u.test(body))return null;
  if(/^(?:(?:내|제)?(?:친구|동료|엄마|아빠|어머니|아버지)|그사람|다른사람|그녀|그|너|당신)(?:은|는|이|가)/u.test(body))return null;
  if(/(?:예전|과거|전에는|좋아했|선호했|필요했|원했|했었|만약|라면|다면|으면|싫지않|없지않|않지는않)/u.test(body))return null;
  body=body.replace(/^(?:저는|나는|난|제가|내가|제경우에는|내경우에는)/u,'').replace(/^(?:요즘(?:은|엔)?|지금(?:은|엔)?|현재(?:는)?|평소(?:에는|엔|는)|보통은|일반적으로는)/u,'');
  let condition=null;
  const prefixes=[['first-try',/^(?:처음(?:에는|엔|은)|처음(?:시도)?할때(?:에는|는)?|처음배울때(?:에는|는)?|처음(?:배우는|해보는|하는)(?:일|내용)(?:은|을할때(?:는)?)|낯선(?:일|내용)(?:은|을할때(?:는)?))/u],['familiar',/^(?:익숙할때(?:는)?|익숙한(?:내용|일)(?:일때(?:는)?|은))/u],['busy',/^(?:바쁠때(?:는)?|시간이없을때(?:는)?|바쁜날(?:에는|엔|은))/u]];
  for(const [id,re] of prefixes)if(re.test(body)){condition=id;body=body.replace(re,'');break;}
  const sequence=/^(?:예시|예제|샘플)(?:를|을)?(?:먼저)?(?:(?:보고(?:감을잡은)?|살펴본|본)(?:뒤(?:에)?|다음(?:에)?|후(?:에)?)|보고나서)/u.exec(body);
  if(sequence){const next=phrase(body.slice(sequence[0].length),condition?condition+'-after-example':'after-example');
    if(next?.field==='support'&&next.value==='independent'&&next.polarity==='prefer')return {meanings:[{field:'support',value:'example',polarity:'prefer',condition},next]};return null;}
  const uncertain=/(?:좋을수도있(?:어(?:요)?|다)|좋을것같(?:아(?:요)?|다)|좋(?:아)?하는것같(?:아(?:요)?|다)|편할수도있(?:어(?:요)?|다))$/u.exec(body);
  if(uncertain){const candidate=phrase(body.slice(0,uncertain.index)+(uncertain[0].startsWith('편')?'편해':'좋아'),condition);return candidate?{meanings:[candidate],uncertain:true}:null;}
  if(/(?:것같|듯|모르|아마|어쩌면|일지도|글쎄|수도|때|땐|경우|상황|동안|오늘만|내일만|이번만|퇴근후|출근전)/u.test(body)&&!/^필요할때/u.test(body))return null;
  const result=phrase(body,condition);if(result)return {meanings:[result]};
  const corrected=body.replace(/혼쟈/gu,'혼자').replace(/예씨/gu,'예시');
  if(corrected!==body){const candidate=phrase(corrected,condition);if(candidate)return {meanings:[candidate],typo:true};}
  return null;
}
const OPTIONS_END = [{id:'unsure',label:'아직 잘 모르겠어요'},{id:'skip',label:'이 부분은 건너뛸게요'}];
const FIELDS = { support:'도움받는 방식', explanation:'설명 길이', 'practice-mode':'연습 방식', topic:'관심 분야' };
function analyze(text) {
  const base=Legacy.parseMemberStatement(text), segments=[...base.meanings.map(m=>({evidence:m.evidence,meanings:[m]})),...base.unresolved.map(u=>({evidence:{start:u.start,end:u.end,quote:u.quote},unresolved:u}))].sort((a,b)=>a.evidence.start-b.evidence.start);
  let blocked=false;
  for(const segment of segments){
    if(segment.unresolved && ['other','past','hypothetical','quotation','duplicate'].includes(segment.unresolved.reason))continue;
    const ending = /^[\s.!?]*/u.exec(text.slice(segment.evidence.end))[0];
    if(ending.includes('?')){delete segment.meanings;segment.unresolved={...segment.evidence,reason:'uncertain',reasonLabel:'질문으로 적은 내용을 현재 선호로 정하지 않았어요.'};segment.generic=true;continue;}
    if(!segment.unresolved)continue;const u=segment.unresolved;
    if(u.reason==='limit'){blocked=true;continue;}if(blocked||['other','past','hypothetical','quotation','duplicate'].includes(u.reason))continue;
    const found=expanded(u.quote);
    if(found&&!(u.reason==='condition'&&found.meanings.some(m=>!m.condition))){
      if(found.uncertain||found.typo||u.reason==='uncertain')segment.candidate={...found,uncertain:found.uncertain||u.reason==='uncertain'};
      else segment.meanings=found.meanings;
    }else segment.generic=true;
  }
  return segments;
}
function stateFor(text,segments,answers,key) {
  const raw=[],unresolved=[],questions=[];
  const question=(index,stage,label,options,apply)=>{const id=`q.${key}.${index}.${stage}`,answer=answers[id];if(answer!==undefined){apply(answer);return;}questions.push({id,about:id,kind:'follow_up',label,options:[...options,...OPTIONS_END].map(o=>({...o,value:o.id}))});};
  for(let index=0;index<segments.length;index++){
    const s=segments[index],add=meanings=>meanings.forEach(m=>raw.push({...m,evidence:copy(s.evidence)}));
    if(s.meanings){add(s.meanings);continue;}
    let handled=false;
    if(s.candidate){question(index,'confirm',`「${s.evidence.quote}」${s.candidate.typo?'의 표기를 이렇게 이해해도 될까요?':'에서 말한 뜻을 현재 선호로 확인할까요?'}`,
      [{id:'confirm',label:s.candidate.meanings.map(meaningLabel).join(' / ')+' — 지금 원하는 내용이 맞아요'},{id:'not-current',label:'현재 선호로 확정하지 않을게요'}],answer=>{handled=true;if(answer==='confirm')add(s.candidate.meanings);});}
    else if(s.generic){question(index,'field',`「${s.evidence.quote}」에서 확인하고 싶은 현재 선호는 어느 쪽인가요?`,Object.entries(FIELDS).map(([id,label])=>({id,label})),field=>{
      handled=true;if(!Object.hasOwn(VALUES,field))return;
      question(index,'value',`${FIELDS[field]}에서 어떤 내용을 확인할까요?`,VALUES[field].map(id=>({id,label:LABELS[id]})),selected=>{
        if(!VALUES[field].includes(selected))return;
        question(index,'polarity',`‘${LABELS[selected]}’을 지금 어떻게 생각하나요?`,[{id:'prefer',label:'원하거나 선호해요'},{id:'avoid',label:'원하거나 선호하지 않아요'}],polarity=>{
          if(!['prefer','avoid'].includes(polarity))return;
          question(index,'condition','이 내용은 어느 상황에 해당하나요?', [{id:'general',label:'특정 상황에 한정하지 않은 현재 선호예요'},...Object.entries(Legacy.MEMBER_STATEMENT_CONDITIONS).map(([id,label])=>({id,label}))],condition=>{
            if(condition==='general'||Object.hasOwn(Legacy.MEMBER_STATEMENT_CONDITIONS,condition))add([{field,value:selected,polarity,condition:condition==='general'?null:condition}]);
          });
        });
      });
    });}
    if(!raw.some(m=>m.evidence.start===s.evidence.start))unresolved.push({...s.unresolved,...(handled?{reasonLabel:'답한 범위에서 확인 중이거나, 이번에는 반영하지 않기로 한 내용이에요.'}:{})});
  }
  const meanings=[],seen=new Set();
  for(const m of raw){const identity=semanticKey(m);if(seen.has(identity))continue;if(meanings.length===MEMBER_STATEMENT_LIMITS.meanings){unresolved.push({...m.evidence,reason:'limit',reasonLabel:'이번에 확인할 수 있는 범위를 넘어 남겨 두었어요.'});continue;}seen.add(identity);meanings.push({id:'p'+meanings.length,field:m.field,value:m.value,polarity:m.polarity,condition:m.condition,evidence:m.evidence});}
  const grouped=new Set();
  for(const m of meanings){if(grouped.has(m.id))continue;const group=meanings.filter(other=>other.id===m.id||Legacy.meaningsConflict(m,other));if(group.length<2)continue;group.forEach(p=>grouped.add(p.id));
    const id=`q.${key}.conflict.${sourceKey(group.map(p=>p.id+semanticKey(p)).join('|')).slice(0,16)}`,answer=answers[id];
    if(answer===undefined)questions.push({id,about:id,kind:'choice',label:'같은 상황의 뜻이 서로 달라요. 현재 원하는 뜻을 골라 주세요.',options:[...group.map(p=>({id:p.id,label:meaningLabel(p),value:p.id})),...OPTIONS_END.map(o=>({...o,value:o.id}))]});
    else for(const p of group)if(p.id!==answer)p.withheld=true;
  }
  return {meanings:meanings.filter(m=>!m.withheld),unresolved:unresolved.slice(0,MEMBER_STATEMENT_LIMITS.unresolved),questions};
}
function choose(state,text,segments,answers,key) {
  const result=Ask.choose({questions:state.questions,decide:scenario=>{
    const outcome=stateFor(text,segments,{...answers,...scenario},key);
    return {meanings:outcome.meanings.map(m=>semanticKey(m)),questions:outcome.questions.map(q=>q.id)};
  }});
  return result.status==='ask'?{id:result.question.id,label:result.question.label,options:result.question.options.map(({id,label})=>({id,label}))}:null;
}
function parseMemberStatement(text,{clarifications=[],parserVersion=PARSER_VERSION}={}) {
  if(parserVersion===Legacy.PARSER_VERSION){if(clarifications.length)fail();return Legacy.parseMemberStatement(text);}if(parserVersion!==PARSER_VERSION)fail();
  if(!list(clarifications,MEMBER_STATEMENT_LIMITS.clarifications)||clarifications.some(row=>!exact(row,['questionId','optionId'])||typeof row.questionId!=='string'||typeof row.optionId!=='string'))fail();
  const segments=analyze(text),key=sourceKey(text),answers=Object.create(null),clarificationAnswers=[];let state=stateFor(text,segments,answers,key),question=choose(state,text,segments,answers,key);
  for(const row of clarifications){if(!question||question.id!==row.questionId||Object.hasOwn(answers,row.questionId))fail();const option=question.options.find(o=>o.id===row.optionId);if(!option)fail();
    answers[row.questionId]=row.optionId;clarificationAnswers.push({...row,questionLabel:question.label,optionLabel:option.label});state=stateFor(text,segments,answers,key);question=choose(state,text,segments,answers,key);}
  if(clarifications.length===MEMBER_STATEMENT_LIMITS.clarifications&&question){
    const conflicted=state.meanings.filter(a=>state.meanings.some(b=>a!==b&&Legacy.meaningsConflict(a,b)));
    state.meanings=state.meanings.filter(m=>!conflicted.includes(m));
    state.unresolved=[...state.unresolved,...conflicted.map(m=>({...m.evidence}))].slice(0,MEMBER_STATEMENT_LIMITS.unresolved).map(u=>({...u,reason:'limit',reasonLabel:'추가 질문은 이번에 12개까지만 확인해요. 이 부분은 반영하지 않았어요.'}));question=null;
  }
  return {parserVersion:PARSER_VERSION,meanings:state.meanings,unresolved:state.unresolved,question,clarifications:copy(clarifications),clarificationAnswers};
}
function meaningLabel(m){return `${m.condition?CONDITIONS[m.condition]+' · ':''}${m.polarity==='avoid'?'선호하지 않는 내용':'원하는 내용'}: ${LABELS[m.value]}`;}
function validateMemberStatement(row,{now=Date.now(),enforceTime=false}={}) {
  const parserVersion=plain(row)?Object.getOwnPropertyDescriptor(row,'parserVersion')?.value:null;
  if(parserVersion===Legacy.PARSER_VERSION)return Legacy.validateMemberStatement(row,{now,enforceTime});
  if(!exact(row,['id','parserVersion','text','at','confirmedAt','meanings','clarifications'])||parserVersion!==PARSER_VERSION||typeof row.id!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(row.id)||!list(row.meanings,MEMBER_STATEMENT_LIMITS.meanings)||!row.meanings.length)fail();
  const at=instant(row.at),confirmed=instant(row.confirmedAt),cutoff=enforceTime?typeof now==='string'?instant(now):Number.isSafeInteger(now)?now:fail():null;
  if(confirmed<at||enforceTime&&confirmed>cutoff)fail();const parsed=parseMemberStatement(row.text,{clarifications:row.clarifications});if(parsed.question)fail();
  const ids=new Set(),meanings=row.meanings.map(m=>{if(!exact(m,['id','field','value','polarity','condition','evidence'])||!exact(m.evidence,['start','end','quote'])||ids.has(m.id))fail();ids.add(m.id);
    const expected=parsed.meanings.find(p=>p.id===m.id);if(!expected||['field','value','polarity','condition'].some(key=>m[key]!==expected[key])||['start','end','quote'].some(key=>m.evidence[key]!==expected.evidence[key]))fail();return copy(expected);
  }).sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1)));
  if(meanings.some((a,i)=>meanings.slice(i+1).some(b=>Legacy.meaningsConflict(a,b))))fail();
  return {id:row.id.toLowerCase(),parserVersion:PARSER_VERSION,text:row.text,at:row.at,confirmedAt:row.confirmedAt,meanings,clarifications:parsed.clarifications};
}
module.exports={PARSER_VERSION,MEMBER_STATEMENT_LIMITS,MEMBER_STATEMENT_VALUES:VALUES,MEMBER_STATEMENT_LABELS:LABELS,MEMBER_STATEMENT_CONDITIONS:CONDITIONS,parseMemberStatement,validateMemberStatement,meaningsConflict:Legacy.meaningsConflict,meaningLabel};
