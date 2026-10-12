import {INTERVIEW_INFO,PROMPTS,FOLLOWUPS,REPAIRS,NEXT_PRACTICE} from './content.mjs';

// A small Korean phrase router, not an unrestricted semantic or ability model.
// A match chooses a prepared question; it does not verify the speaker's history.
const RULES = Object.freeze([
  {id:'no-experience',category:'preparation',patterns:[
    /(?:경험|경력|실습|봉사)(?:이|은|는|을|를)?\s*(?:(?:아직|전혀|별로|거의)\s*)?(?:없|부족|안\s*해|못\s*해|하지\s*않|해\s*보지\s*않)/u,
    /(?:해|돌봐|일해|근무해|봉사해|실습해)\s*본\s*적(?:이|은)?\s*없/u,
    /(?:한|돌본|일한|근무한|봉사한|실습한)\s*적(?:이|은)?\s*없/u,
    /(?:돌봤|돌보았|간병했|도와드렸|일했|근무했|봉사했|실습했)(?:던|다고)?\s*(?:적|경험)(?:이|은|는)?\s*(?:(?:전혀|아직)\s*)?없/u,
    /경험(?:이|은|는)?\s*(?:많지|있지)\s*않/u,
    /(?:일|근무|돌봄|간병|실습|봉사)(?:을|를|는)?\s*(?:해\s*보지|하지)\s*(?:않|못)/u,
    /(?:돌봤|도왔|도와드렸|간병했|부축했|일했|근무했)다고(?:는)?\s*(?:할\s*수|말할\s*수)(?:는)?\s*없/u
  ]},
  {id:'past-action',category:'experience',patterns:[
    /(?:돌봤|돌보았|돌본|보살폈|보살핀|간병했|간병한|부축했|도와드렸|도와\s*드렸|모셨|근무했|일했|봉사했|실습했)/u,
    /(?:경험|경력)(?:이|은|는)?\s*(?:조금\s*|많이\s*)?있/u
  ]},
  {id:'preparation-plan',category:'preparation',patterns:[
    /(?:배우고|배워\s*보고|교육을|교육\s*받|자격증|자격시험|공부|준비|훈련|연습)/u
  ]},
  {id:'motivation-cue',category:'motivation',patterns:[
    /(?:돕고\s*싶|도와\s*드리고\s*싶|돌보고\s*싶|보람|관심|좋아|지원|일하고\s*싶|도움이\s*되고|사람을\s*돕|어르신|노인|할머니|할아버지|생계|안정|돈을\s*벌|급여|월급)/u
  ]},
  {id:'unrelated-topic-cue',category:'off-topic',patterns:[
    /(?:축구|야구|날씨|주식|비트코인|로또|게임\s*점수|점심\s*메뉴)/u
  ]}
]);

function repair(reason){return {kind:'repair',reason,category:null,evidence:'',ruleId:null};}

// These complete, short replies inherit the question's experience context.
// The anchors matter: an unrelated activity or a quoted sentence is not a
// denial of care experience, and misspelled words are never corrected here.
const SHORT_DENIAL = /^(?:제가|저는|나는|내가|저도)?(?:(?:요양원|요양|돌봄|간병|실습|봉사)(?:에서)?(?:일|근무)?(?:을|를|은|는|이)?)?(?:(?:아직|전혀|한번도|지금까지))*(?:(?:경험|경력)(?:이|은|는)?없|(?:안|못)(?:해봤|해보았)|해본적(?:이|은)?없|해보지(?:는)?않았)(?:어요|습니다|어|다)[.!?。！？]*$/u;
export function isShortExperienceDenial(text){
  return typeof text==='string'&&SHORT_DENIAL.test(text.normalize('NFC').replace(/\s/gu,''));
}

function hasUnresolvedExperienceCorrection(value){
  const history=/(?:돌봤|돌보았|돌본|보살폈|보살핀|간병했|부축했|도왔|도와드렸|모셨|근무했|일했|봉사했|실습했|보조했|수행했|담당했|맡았|준비했|확인했|기록했|보고했|살폈)|(?:경험|경력)(?:이|은|는)?(?:조금|많이)?있/u;
  const hasHistory=history.test(value);
  const hasDenial=RULES[0].patterns.some(pattern=>pattern.test(value));
  // Nonstandard past+negative combinations have more than one plausible
  // reading. Ask the speaker; do not silently turn them into either history.
  if(hasHistory&&/(?:봤|보았|폈|핀|했|왔|렸|셨|았|었)지(?:는)?(?:않|못)|(?:봤|했|왔|렸|셨)(?:어요|습니다|다)(?:는|은)(?:아니|아닙)/u.test(value))return true;
  if((hasHistory||hasDenial)&&/(?:[.!?。！？,，;]|습니다|어요|해요)아니(?:요|다|에요|야)?(?=아직|없|있|안|못|경험|경력|제가|저는|그건|[.!?。！？,，;])/u.test(value))return true;
  const clauses=value.split(/[.!?。！？,，;]+/u).filter(Boolean);
  const bareDenial=/^(?:제가|저는|나는|내가)?(?:사실은?|아직|지금은|현재는|전혀|한번도)*(?:경험(?:이|은|는)?)?(?:없(?:어요|습니다|어|다)|(?:안|못)(?:했|해봤|해보았)(?:어요|습니다|어|다)|해본적(?:이|은)?없(?:어요|습니다|어|다))$/u;
  const bareAffirmation=/^(?:제가|저는|나는|내가)?(?:사실은?|지금은|현재는|이제는)*있(?:어요|습니다|어|다)$/u;
  let affirmed=false,denied=false;
  for(const clause of clauses){
    // A following subjectless reversal may refer to the preceding statement.
    // Explicitly different scopes ("시설 경험은 없지만 ... 식사를 도왔다")
    // remain independent; they do not match these whole-clause replies.
    if(affirmed&&bareDenial.test(clause)||denied&&bareAffirmation.test(clause))return true;
    const negative=RULES[0].patterns.some(pattern=>pattern.test(clause))||isShortExperienceDenial(clause);
    if(history.test(clause)&&!negative)affirmed=true;
    if(negative)denied=true;
  }
  return false;
}

export function classifyAnswer(text,{confidence,recognitionError=false}={}){
  if(recognitionError)return repair('recognition');
  if(confidence!==undefined&&confidence!==null&&(!Number.isFinite(confidence)||confidence<0.55||confidence>1))return repair('recognition');
  if(typeof text!=='string'||!text.trim())return repair('empty');
  const normalized=text.normalize('NFC').replace(/\s+/gu,' ').trim();
  if(normalized.length>2000)return repair('length');
  // Some local recognizers insert spaces inside Korean words. Match a second,
  // compact view while retaining offsets into the user's original spaced text.
  const offsets=[];let compact='';
  for(let i=0;i<normalized.length;i++)if(!/\s/u.test(normalized[i])){offsets.push(i);compact+=normalized[i];}
  const candidates=[{text:normalized,offsets:null},{text:compact,offsets}];
  const repeatPattern=/(?:다시\s*(?:말씀|말해|말해주|들려|질문|해\s*주)|한\s*번\s*더\s*(?:질문|말씀|말해|들려)|못\s*들었|안\s*들렸|질문(?:을|이)?\s*(?:못\s*들|뭐|다시))|^다시(?:요)?[.!?\s]*$/u;
  const uncertainPattern=/(?:잘\s*)?모르겠(?:어요|습니다|는데|네요)|^모르(?:겠)?[.!?\s]*$|^(?:잘\s*)?(?:모름|모르겠음|몰라요)[.!?\s]*$|(?:생각|기억)이?\s*안\s*나|답(?:을|변을)?\s*못\s*하겠|모르겠습니다/u;
  if(candidates.some(candidate=>repeatPattern.test(candidate.text)))return repair('repeat');
  if(candidates.some(candidate=>uncertainPattern.test(candidate.text)))return repair('uncertain');
  if(hasUnresolvedExperienceCorrection(compact))return repair('uncertain');
  if(isShortExperienceDenial(normalized))return {kind:'usable',category:'preparation',evidence:normalized,ruleId:'no-experience',negatedExperience:true};
  for(const rule of RULES){
    for(const pattern of rule.patterns){
      for(const candidate of candidates){
        const match=pattern.exec(candidate.text);
        if(match){
          const evidence=candidate.offsets?normalized.slice(candidate.offsets[match.index],candidate.offsets[match.index+match[0].length-1]+1):match[0];
          return {kind:'usable',category:rule.category,evidence,ruleId:rule.id,negatedExperience:rule.id==='no-experience'};
        }
      }
    }
  }
  return {kind:'usable',category:'unclear',evidence:'',ruleId:'no-supported-cue',negatedExperience:false};
}

export function createInterviewSession({answerLimitMs=INTERVIEW_INFO.answerLimitMs}={}){
  if(!Number.isFinite(answerLimitMs)||answerLimitMs<1000||answerLimitMs>120000)throw new RangeError('answerLimitMs must be between 1000 and 120000');
  const initial=()=>({phase:'idle',turn:0,prompt:null,answerLimitMs,answers:[],branch:null,repair:null,reflections:[],repeatCount:0});
  let state=initial(),activeQuestion=null;
  const snapshot=()=>structuredClone(state);
  const speaking=(phase,prompt)=>{state.phase=phase;state.prompt={...prompt};return snapshot();};
  const start=()=>{
    if(state.phase!=='idle')return snapshot();
    return speaking('intro',PROMPTS.intro);
  };
  const listen=()=>{state.phase='listening';state.prompt=null;state.repair=null;return snapshot();};
  const advance=()=>{
    if(state.phase==='intro'){
      state.turn=1;activeQuestion=PROMPTS.question;
      return speaking('question',activeQuestion);
    }
    if(state.phase==='question'||state.phase==='followup')return listen();
    if(state.phase==='repair'){
      if(state.repair?.reason==='repeat')return speaking(state.turn===1?'question':'followup',activeQuestion);
      return listen();
    }
    if(state.phase==='closing'){
      state.phase='reflection';state.prompt=null;
      const category=state.branch?.category||'unclear';
      state.reflections=[
        '두 질문에 답하는 연습을 마쳤어요. 이 기록은 답변 내용의 사실 확인이나 채용 평가가 아닙니다.',
        NEXT_PRACTICE[category]
      ];
    }
    return snapshot();
  };
  const requestRepair=reason=>{
    state.repair={reason,turn:state.turn};
    return speaking('repair',REPAIRS[reason]||REPAIRS.recognition);
  };
  const answer=(text,options={})=>{
    if(state.phase!=='listening')return snapshot();
    const meaning=classifyAnswer(text,options);
    if(meaning.kind==='repair')return requestRepair(meaning.reason);
    const normalized=text.normalize('NFC').replace(/\s+/gu,' ').trim();
    state.answers.push({turn:state.turn,text:normalized,category:meaning.category,evidence:meaning.evidence,ruleId:meaning.ruleId});
    state.repair=null;
    if(state.turn===1){
      state.branch={...meaning,explanation:meaning.evidence?`답변의 ‘${meaning.evidence}’ 표현을 바탕으로 다음 질문을 골랐어요.`:'이번 답변에서 준비된 분기에 맞는 표현을 찾지 못해, 계기를 구체적으로 묻는 질문을 골랐어요.'};
      state.turn=2;activeQuestion=FOLLOWUPS[meaning.category];
      return speaking('followup',activeQuestion);
    }
    return speaking('closing',PROMPTS.closing);
  };
  const repeat=()=>{
    if(!activeQuestion||!['question','followup','listening','repair'].includes(state.phase))return snapshot();
    state.repeatCount++;state.repair=null;
    return speaking(state.turn===1?'question':'followup',activeQuestion);
  };
  const timeout=()=>state.phase==='listening'?requestRepair('timeout'):snapshot();
  const reset=()=>{state=initial();activeQuestion=null;return snapshot();};
  const dispose=()=>{state=initial();state.phase='disposed';activeQuestion=null;};
  return Object.freeze({start,advance,answer,repeat,timeout,reset,dispose,snapshot});
}
