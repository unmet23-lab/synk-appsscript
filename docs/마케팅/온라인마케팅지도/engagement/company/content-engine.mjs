import {readFileSync} from 'node:fs';

const catalog=JSON.parse(readFileSync(new URL('./content-catalog.json',import.meta.url),'utf8'));
const referenceFields=[['hook','도입'],['structure','전개'],['payoff','보고 나서 얻는 것'],['brandFit','우리 방향과 맞는 점'],['adaptation','만들 때 적용할 점']];
const personalizationFields=[
  ['situation','보는 사람의 상황','보는 사람의 배경과 목표, 쓸 수 있는 시간이나 제약을 적어 주세요. 직접 확인한 것과 짐작한 것은 나눠 적어 주세요.'],
  ['choice','상황마다 고를 수 있는 도움','보는 사람이 자기 상황에 따라 무엇을 고르고, 고른 쪽에 따라 설명·예시·도움이 어떻게 달라지는지 적어 주세요.'],
  ['nextStep','보고 나서 바로 할 일','보고 나서 자기 상황에서 바로 해 볼 작은 행동과, 잘됐는지 확인하는 방법을 적어 주세요.']
];
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const record=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError(`${label} 내용을 읽지 못했어요. 새로고침한 뒤 다시 해 주세요.`);return value;};
function text(value,label,max=3000,required=false){
  if(value==null&&!required)return '';
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))throw new TypeError(`‘${label}’ 칸에는 ${max}자까지 글만 적을 수 있어요.`);
  const clean=value.trim();if(required&&!clean)throw new TypeError(`‘${label}’ 칸을 채워 주세요.`);return clean;
}
function referenceOf(value){
  if(value==null||value==='')return null;
  if(typeof value==='string')value={url:value};
  record(value,'참고 자료');
  const raw=text(value.url,'참고 주소',2048);let url='';
  if(raw){try{const parsed=new URL(raw);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new Error();url=parsed.href;}catch{throw new TypeError('참고 주소는 https://로 시작하는 공개 주소로 적어 주세요.');}}
  const result={url,title:text(value.title,'참고 제목',300),publishedAt:text(value.publishedAt,'게시일',80),checkedAt:text(value.checkedAt,'확인일',80),...Object.fromEntries(referenceFields.map(([key,label])=>[key,text(value[key],`참고 ${label}`)])),reactions:{}};
  if(value.reactions!=null){
    const reactions=record(value.reactions,'참고 반응');
    for(const key of ['views','likes','comments','shares','saves','reach']){
      const number=reactions[key];if(number!=null&&(!Number.isSafeInteger(number)||number<0))throw new TypeError('참고 반응 수는 0 이상의 정수로 적어 주세요.');
      result.reactions[key]=number??null;
    }
  }
  return result;
}
function benchmarkOf(value){
  if(value==null)return null;
  record(value,'회사 참고 자료');
  const result={};
  for(const [key,max] of [['id',100],['itemId',100],['title',300],['scope',300],['periodStart',80],['periodEnd',80],['researchedAt',80],['selectionBasis',3000],...referenceFields.map(([key])=>[key,3000])])result[key]=text(value[key],'회사 참고 자료',max);
  if(value.rank!=null&&(!Number.isSafeInteger(value.rank)||value.rank<1))throw new TypeError('회사 참고 자료의 순서가 1 이상의 정수가 아니에요. 관리자에게 조사 자료를 다시 올려 달라고 해 주세요.');
  if(value.stale!=null&&typeof value.stale!=='boolean')throw new TypeError('회사 참고 자료의 조사 시기를 읽지 못했어요. 관리자에게 조사 자료를 다시 올려 달라고 해 주세요.');
  if(value.seriesIds!=null&&(!Array.isArray(value.seriesIds)||value.seriesIds.length>30))throw new TypeError('회사 참고 자료의 지정 시리즈를 읽지 못했어요. 관리자에게 조사 자료를 다시 올려 달라고 해 주세요.');
  result.rank=value.rank??null;result.stale=value.stale??null;result.seriesIds=(value.seriesIds||[]).map(id=>text(id,'참고 시리즈',100,true));
  return result;
}
function normalize(input){
  record(input,'기획');
  const seriesId=text(input.seriesId,'콘텐츠 시리즈',100,true),topic=text(input.topic,'이야기할 주제',300,true);
  if(!catalog.series.some(series=>series.id===seriesId))throw new TypeError('목록에 있는 콘텐츠 시리즈를 골라 주세요.');
  const values={seriesId,topic};
  for(const key of ['audience','experience','proof','takeaway','entertainment'])values[key]=text(input[key],({audience:'보는 사람',experience:'직접 겪은 일',proof:'근거',takeaway:'얻어 갈 정보',entertainment:'끝까지 볼 이유'})[key]);
  // Editor-only evidence stays metadata; it is not a viewer fact or action.
  values.editorialNote=text(input.editorialNote,'이번 편 제작 실험',3000);
  values.reference=referenceOf(input.reference);
  values.benchmark=benchmarkOf(input.benchmark);
  values.channelContext=null;
  if(input.channelContext!=null){const context=record(input.channelContext,'채널');values.channelContext={id:text(context.id,'채널',100),displayName:text(context.displayName,'채널 이름',300),platform:text(context.platform,'플랫폼',100)};}
  const authenticity=input.authenticity==null?{}:record(input.authenticity,'진정성');
  values.authenticity=Object.fromEntries(['basis','ownPerspective','limits','disclosure'].map(key=>[key,text(authenticity[key],({basis:'사실과 경험의 바탕',ownPerspective:'우리만의 생각과 선택',limits:'솔직하게 밝혀야 할 한계',disclosure:'출처와 연출 표시'})[key])]));
  const personalization=input.personalization==null?{}:record(input.personalization,'개인화');
  values.personalization=Object.fromEntries(personalizationFields.map(([key,label])=>[key,text(personalization[key],label,2000)]));
  return values;
}
const replaceTopic=(value,topic)=>value.replaceAll('{topic}',topic.replace(/[\r\n]+/g,' '));
const placeholder=value=>`[채울 것: ${value}]`;
const note=(value,missing)=>value||placeholder(missing);
const submitted=value=>value?`적어 둔 근거 · 사실 확인 전: ${value}`:'';
const question=(field,prompt)=>({id:`question-${field.replaceAll('.','-')}`,field,question:prompt});
const excerpt=(value,max=260)=>value.length>max?`${value.slice(0,max)}…`:value;
const referenceValue=(input,key)=>input.reference?.[key]||input.benchmark?.[key]||'';

export function getContentCatalog(){return structuredClone(catalog);}

function referenceAdaptation(input,angle){
  const {reference,benchmark}=input;
  if(!reference&&!benchmark)return '참고 자료 없이 유형별 기획 양식으로 짠 구성이에요. 요즘 유행하는지, 반응이 좋은지는 확인하지 않았어요.';
  const identified=reference?.title||benchmark?.title||reference?.url||'제목 없는 참고 자료';
  const details=referenceFields.map(([key,label])=>`${label}: ${referenceValue(input,key)?excerpt(referenceValue(input,key)):'원문을 보고 채워 주세요'}`).join(' / ');
  return `「${identified}」에서 적어 둔 분석 — ${details} / 이번 구성은 이렇게 바꿔요: ${angle.angle} 원본의 문장과 장면을 그대로 쓰지 않고, 우리 소재와 우리 설명으로 다시 짜요. 게시일·확인일·반응 수는 적어 둔 값이고, 지금도 인기인지는 확인하지 않았어요.${benchmark?' 회사 참고 순서는 그 조사 자료 안에서 정한 순서일 뿐, 플랫폼 전체 순위가 아니에요.':''}`;
}

function beatFor(key,{input,series,angle,hook}){
  const experience=note(input.experience,'이번 편에서 실제로 겪은 상황·선택·결과. 겪은 일이 없으면 겪은 것처럼 말하지 않기');
  const proof=note(input.proof,'공식 자료·직접 찍은 화면·실행 결과 중 확인할 근거와 그 출처·날짜');
  const takeaway=note(input.takeaway,'시청자가 이해하거나 직접 해 볼 한 가지');
  const learning=['situation','expression'].includes(series.kind);
  const data={
    hook:{visual:`「${input.topic}」의 핵심 상황이나 확인할 화면 하나로 열어요. 이 장면에서 노릴 재미: ${angle.reward}. 아직 만들지 않은 결과 화면을 있는 것처럼 보여 주지 않아요.`,narration:hook},
    proof:{visual:`근거는 화면의 주장 바로 옆에 둬요. ${submitted(input.proof)||proof}`,narration:input.proof?`[근거를 확인한 뒤 말로 다듬기] ${proof}`:proof},
    experience:{visual:input.experience?`적어 둔 경험에서 한 장면을 골라요. 그때 화면이 없으면 「재구성한 장면」이라고 표시해요. 적어 둔 경험: ${experience}`:'아직 적은 경험이 없어요. 겪은 일을 이야기하는 편이면 실제로 겪은 일을 적고, 정보를 주는 편이면 확인할 예시나 자료 장면으로 바꿔요.',narration:input.experience?`[사실 확인 전 · 적어 둔 경험을 말로 다듬기] ${experience}`:placeholder('실제 경험이나 정보를 보여 줄 예시. 없었던 일을 1인칭 회고로 만들지 않기')},
    question:{visual:'선택지나 질문을 한 화면에 보여 주고, 답을 밝히기 전에 생각할 틈을 둬요. 선택지의 내용이 맞는지는 근거로 확인해요.',narration:placeholder(`「${input.topic}」에서 시청자가 먼저 골라 볼 질문과 그렇게 고르는 이유`)},
    application:{visual:'직접 시연한다면 전체 화면 → 누를 곳 → 행동 → 결과 순서로 보여 줘요. 시연 화면이 없으면 공식 안내 자료라고 밝혀요.',narration:placeholder('이 시청자에게 맞는 상황·직접 할 행동·확인한 결과. 써 보지 않은 사용 후기는 쓰지 않기')},
    limits:{visual:'누구에게, 어떤 조건에서 되는지와 아직 모르는 부분을 짧게 나눠 보여 줘요. 준비 중인 것과 확인한 결과를 섞지 않아요.',narration:input.authenticity.limits?`[적어 둔 한계 · 확인 전] ${input.authenticity.limits}`:placeholder('확인한 적용 조건·비용·안 될 수 있는 경우·아직 확인하지 못한 부분')},
    setup:{visual:'처음 쓰는 사람 눈높이로 준비물과 지금 어느 화면인지부터 보여 줘요. 필요한 계정·자료·설정은 만드는 날 다시 확인해요.',narration:placeholder(`「${input.topic}」의 준비물과 시작하는 곳, 먼저 준비해야 하는 이유`)},
    action:{visual:'한 번에 한 행동만 짚어요. 어디에 무엇을 넣고 어떤 단추를 누르는지 같은 화면에서 가리키고, 읽을 시간을 둬요.',narration:placeholder('실제 순서·정확히 넣을 내용·행동마다 필요한 이유')},
    check:{visual:`원문과 결과를 나란히 놓고 맞는 곳·빠진 곳·아직 모르는 곳을 나눠요. ${input.proof?`견줄 근거: ${input.proof}`:'아직 근거가 없으니 확인할 항목만 표시해요.'}`,narration:placeholder('무엇을 견줘 봤고 어디까지 확인했는지. 결과나 수치를 짐작해 넣지 않기')},
    analogy:{visual:'익숙한 물건이나 행동에 개념을 빗대요. 닮은 점과 비유가 맞지 않는 점을 따로 보여 줘요.',narration:placeholder(`「${input.topic}」의 쉬운 뜻·익숙한 비유·비유가 맞지 않는 곳`)},
    reflection:{visual:input.authenticity.ownPerspective?`적어 둔 우리 생각: ${input.authenticity.ownPerspective}`:'그때의 선택과 지금의 판단을 두 칸에 나눠 보여 줘요. 팀이 실제로 중요하게 보는 기준을 적어요.',narration:input.authenticity.ownPerspective?`[적어 둔 생각 · 확인 전] ${input.authenticity.ownPerspective}`:placeholder('우리가 실제로 고른 이유와 지금의 판단. 누구나 따라 하면 된다는 교훈처럼 말하지 않기')},
    situation:{visual:learning?`${series.kind==='situation'?'AI 실사 인물의 생활 대화로':'승인된 마스코트 한 명의 반응으로'} 이 표현을 쓰는 순간을 보여 줘요. 학습자의 실수를 놀리지 않고, 상황이 왜 어긋났는지 풀어 줘요.`:'확인한 예시 상황을 보여 줘요. 예시인지 실제로 겪은 일인지 화면에서 구분해요.',narration:placeholder('이 표현을 자연스럽게 쓰는 대화나 상황 설명. 검토받은 것만 쓰기')},
    expression:{visual:'한국어 표현 하나와 그 상황에서의 뜻, 정확한 소리를 함께 보여 줘요. 교사 검토 전이면 「검토용」이라고 표시해요.',narration:placeholder(`「${input.topic}」에서 가르칠 표현 하나와 상황에 맞는 뜻·예문. 원어 발음을 왜곡하지 않기`)},
    practice:{visual:'정답을 보여 준 뒤 따라 말할 틈을 둬요. 연습하는 동안 새 정보를 얹지 않고, 표현 글자와 소리가 나오는 때를 맞춰요.',narration:placeholder('검토받은 표현을 천천히 한 번 → 따라 말할 쉼 → 보통 속도로 한 번')},
    replay:{visual:'같은 장면을 짧게 다시 보여 줘요. 새 장면을 늘리기보다 처음에 놓친 단서 하나만 짚어요.',narration:placeholder('다시 보면 보이는 단서와 앞 설명이 이어지는 곳')},
    transfer:{visual:'정답을 가린 새 상황이나 빈칸을 보여 주고, 직접 말하거나 적을 시간을 둬요.',narration:placeholder('같은 표현이나 판단 기준을 자기 상황에 써 보게 하는 질문. 확인한 예시 답은 해 본 뒤에 보여 주기')},
    quote:{visual:'인터뷰 원본에서 타임코드를 대조한 발언만 써요. 앞뒤 맥락·말끝·표정을 그대로 살려요.',narration:placeholder('실제 발언 원문과 타임코드. 근거를 적어 뒀어도 발언을 새로 지어 인용하지 않기')},
    context:{visual:'누가 어떤 상황에서 한 말인지, 필요한 맥락만 붙여요. 근거 없는 이력·고객·성과는 덧붙이지 않아요.',narration:placeholder('발언이나 선택의 실제 앞뒤 맥락과 확인할 근거')},
    takeaway:{visual:`마지막에 시청자가 얻어 갈 정보와 행동을 하나로 정리해요. 나눠 줄 자료가 있으면 실제 파일과 받는 길을 확인해요. ${input.takeaway?`적어 둔 목표: ${input.takeaway}`:'얻어 갈 정보를 아직 안 적었으니 구체적인 다음 행동부터 정해요.'}`,narration:input.takeaway?`[적어 둔 목표 · 본문에서 정말 줬는지 확인] ${takeaway}`:takeaway}
  };
  if(!own(data,key))throw new TypeError('이 유형의 이야기 구성을 찾지 못했어요. 다른 콘텐츠 시리즈를 골라 주세요.');
  return data[key];
}

function authenticityFor(input){
  const fields=[
    ['basis','사실과 경험의 바탕','직접 겪은 일, 조사로 확인할 내용, 예시로 재구성할 장면을 나눠 적어 주세요.'],
    ['ownPerspective','우리만의 생각과 선택','이 주제를 우리가 다루는 이유와 중요하게 보는 기준을 적어 주세요.'],
    ['limits','솔직하게 밝혀야 할 한계','잘 안 된 점, 되는 조건, 아직 확인하지 못한 부분을 부풀리지 말고 적어 주세요.'],
    ['disclosure','출처와 연출 표시','AI로 만든 장면, 협찬, 참고한 출처가 있는지 보고 밝힐 내용을 적어 주세요. 없으면 없다고 적어 주세요.']
  ];
  return {items:fields.map(([id,label,detail])=>({id,label,status:input.authenticity[id]?'provided':id==='disclosure'?'review':'needs-input',detail:input.authenticity[id]?`${input.authenticity[id]} · 사실 확인 전`:detail})),summary:'점수가 아니라 하나씩 확인할 목록이에요. 직접 겪은 일과 조사한 내용, 우리 생각, 한계, 출처와 연출을 따로 봐요.'};
}

function personalizationFor(input){
  return {
    summary:'보는 사람의 상황, 상황마다 고를 수 있는 도움, 보고 나서 바로 할 일이 실제로 이어지는지 봐요. 이름을 넣거나 취향을 짐작하는 것으로 대신하지 않아요. 이 점검으로 SYNK 개인화 기능이 다 됐다거나 효과가 있다고 볼 수는 없어요.',
    items:personalizationFields.map(([id,label,detail])=>({id,label,status:input.personalization[id]?'review':'needs-input',detail:input.personalization[id]?`${input.personalization[id]} · 이 시청자에게 맞는지 확인 전`:detail}))
  };
}

function applyContext(beats,input){
  const {situation,choice,nextStep}=input.personalization;
  const result=beats.map(beat=>({...beat})),last=result.length-1,middle=Math.floor(last/2);
  if(situation){
    result[0].visual+=`\n시청자 상황에 맞춰 장면을 고르고, 직접 확인한 상황인지 짐작한 상황인지 표시해요. 맞출 상황: ${excerpt(situation)}`;
    result[0].narration+=`\n[도입에서 이을 시청자 상황] ${excerpt(situation)}`;
  }
  if(choice){
    result[middle].visual+=`\n이 구성의 방향에 맞춰 고르는 쪽마다 예시와 설명을 나누고, 확인하지 못한 결과는 「확인 전」으로 남겨요. 상황마다 고를 수 있는 도움: ${excerpt(choice)}`;
    result[middle].narration+=`\n[시청자에게 던질 질문으로 다듬기] ${excerpt(choice)}`;
  }
  if(nextStep){
    result[last].visual+=`\n고른 조건에서도 할 수 있는 일인지 확인해요. 보고 나서 바로 할 일: ${excerpt(nextStep)}`;
    result[last].narration+=`\n[본문에서 약속한 도움을 준 다음에 안내] ${excerpt(nextStep)}`;
  }
  for(const [index,[key,label]] of referenceFields.entries()){
    const value=referenceValue(input,key);if(!value)continue;
    // Reference notes inform production directions, never become copied dialogue or a popularity claim.
    const target=key==='payoff'?last:key==='brandFit'?middle:key==='adaptation'?Math.max(1,last-1):index;
    result[target].visual+=`\n참고 메모 · 확인 전 · ${label}: ${excerpt(value)} — 우리 자료와 이 구성에 맞게 바꿔 쓰기`;
  }
  return result;
}

function reviewAxesFor(input,series,missingQuestions){
  const evidence=(...pairs)=>pairs.filter(([,value])=>value).map(([label,value])=>`${label}: ${excerpt(value,400)}`);
  const questionsFor=(fields,extra)=>[...missingQuestions.filter(item=>fields.some(field=>item.field===field||item.field.startsWith(field+'.'))).map(item=>item.question),...extra];
  const referenceIncomplete=(input.reference||input.benchmark)&&referenceFields.some(([key])=>!referenceValue(input,key));
  const benchmarkMismatch=input.benchmark?.seriesIds.length>0&&!input.benchmark.seriesIds.includes(input.seriesId);
  return [
    {id:'fun',label:'재미와 몰입',status:input.entertainment&&!referenceIncomplete?'review':'needs-input',
      reason:input.entertainment?'재미를 줄 장면은 적었어요. 궁금증이 실제로 풀리는지, 처음 보는 사람도 따라오며 즐기는지는 아직 몰라요.':'「재미있게」를 구체적인 궁금증·장면·보상으로 바꿔 적어야 해요.',
      questions:questionsFor(['entertainment','reference','benchmark'],['처음 생긴 궁금증은 어느 장면에서 풀리나요? 답을 보여 주기 전에 따라올 시간이 있나요?','움직임·설명·내레이션이 같은 것을 가리키고, 읽고 듣기 편한가요?']),
      evidence:evidence(['재미 구상',input.entertainment],['참고 자료의 도입',referenceValue(input,'hook')],['참고 자료에서 얻는 것',referenceValue(input,'payoff')]),
      nextAction:input.entertainment?`재미 구상 「${excerpt(input.entertainment,120)}」에 맞춰 궁금증이 생기는 장면과 풀리는 장면을 한 쌍으로 만들고, 실제 크기로 재생해 봐요.`:'세 구성의 재미 제안 중 하나를 고르고, 도입의 질문 → 단서 → 답이 드러나는 장면을 구체적인 예시로 적어 봐요.'},
    {id:'usefulness',label:'도움과 이해',status:input.takeaway&&input.proof?'review':'needs-input',
      reason:input.takeaway&&input.proof?'얻어 갈 정보와 견줄 근거를 적었어요. 내용이 정확한지, 실제로 따라 할 수 있는지는 직접 봐야 해요.':'무엇을 이해하거나 해 볼지와, 그걸 뒷받침할 자료를 함께 채워야 해요.',
      questions:questionsFor(['takeaway','proof'],['처음 보는 사람도 어디를 보고, 무엇을 하고, 왜 필요한지 알 수 있나요?','막히는 경우와 안 될 때의 대안까지 자료와 맞나요?']),
      evidence:evidence(['얻어 갈 정보',input.takeaway],['견줄 근거',input.proof],['보고 나서 바로 할 일',input.personalization.nextStep]),
      nextAction:input.takeaway?`얻어 갈 정보 「${excerpt(input.takeaway,120)}」에 맞는 실제 예시 하나로 설명하고, 원문과 견준 뒤 처음 보는 사람이 따라 할 수 있는지 봐요.`:'시청자가 해 볼 행동 하나를 정하고, 준비물·순서·확인할 결과를 실제 자료 옆에 적어 봐요.'},
    {id:'authenticity',label:'진정성과 사실',status:Object.values(input.authenticity).every(Boolean)&&input.proof&&(!series.requiresExperience||input.experience)?'review':'needs-input',
      reason:'경험과 근거를 적었다고 사실이 확인된 건 아니에요. 직접 겪은 일, 조사한 정보, 재구성한 장면을 원본과 하나씩 견줘 봐야 해요.',
      questions:questionsFor(['authenticity','experience','proof'],['실제보다 큰 결과를 약속하거나, 남의 경험·발언을 우리 경험처럼 말하는 문장은 없나요?']),
      evidence:evidence(['직접 겪은 일',input.experience],['사실과 경험의 바탕',input.authenticity.basis],['우리만의 생각과 선택',input.authenticity.ownPerspective],['솔직하게 밝혀야 할 한계',input.authenticity.limits],['출처와 연출 표시',input.authenticity.disclosure]),
      nextAction:'사실이라고 말하는 곳마다 직접 겪은 일·외부 자료·재구성한 장면 중 무엇인지 붙여 견줘 보고, 확인 못 한 결과는 빼거나 「확인 전」으로 표시해요. AI 연출·협찬처럼 밝혀야 할 것도 표시해요.'},
    {id:'personalization',label:'SYNK다운 개인화',status:Object.values(input.personalization).every(Boolean)&&!benchmarkMismatch?'review':'needs-input',
      reason:'보는 사람의 배경·목표·제약에 따라 고를 것과 다음 도움이 달라지는지 봐요. 이름을 넣거나 성격을 짐작하는 것만으로는 그 사람에게 맞는다고 할 수 없어요.',
      questions:questionsFor(['personalization','benchmark.seriesFit'],['같은 주제라도 상황이 다른 사람이 보면 고를 기준과 다음 행동이 실제로 달라지나요?','본인이 밝힌 정보, 직접 본 사실, 우리가 짐작한 것을 나누고 필요한 만큼만 쓰나요?','준비 중인 개인화 기능을 이미 있거나 효과가 확인된 것처럼 소개하지 않나요?']),
      evidence:evidence(...personalizationFields.map(([key,label])=>[label,input.personalization[key]]),['참고 자료와 우리 방향이 맞는 점',referenceValue(input,'brandFit')]),
      nextAction:Object.values(input.personalization).every(Boolean)?`「${excerpt(input.personalization.situation,100)}」에서 「${excerpt(input.personalization.choice,100)}」 쪽을 고른 사람이 「${excerpt(input.personalization.nextStep,100)}」까지 갈 수 있는지 예시·설명·끝맺음을 같이 봐요.`:'한 사람의 구체적인 상황과 목표를 정하고, 그 사람이 고를 수 있는 도움과 바로 할 일을 도입·본문·끝맺음에 하나씩 넣어 봐요.'}
  ];
}

export function generateContentIdeas(rawInput){
  const input=normalize(rawInput),series=catalog.series.find(row=>row.id===input.seriesId),missingQuestions=[];
  if(!input.audience)missingQuestions.push(question('audience',`이번 편은 「${series.audience}」 가운데 어떤 상황의 사람을 돕나요?`));
  if(!input.experience&&series.requiresExperience)missingQuestions.push(question('experience','이번 편에서 실제로 겪은 상황·선택·결과를 적어 주세요. 겪은 일 없이 설명만 하는 편은 synkbrief 뉴스·활용·기초로 기획할 수 있어요.'));
  if(!input.proof)missingQuestions.push(question('proof',`「${input.topic}」의 내용과 결과를 확인할 원문·화면·자료가 있나요? 출처와 확인한 날짜를 같이 적어 주세요.`));
  if(!input.takeaway)missingQuestions.push(question('takeaway','보고 나서 이해하거나 직접 해 볼 한 가지를 구체적으로 적어 주세요.'));
  if(!input.entertainment)missingQuestions.push(question('entertainment','호기심·공감·발견·참여 중 어떤 재미를 어느 장면에서 주고, 어디서 풀어 줄까요? 세 구성의 재미 제안 중 하나를 골라 구체적으로 적어 주세요.'));
  for(const item of authenticityFor(input).items)if(!input.authenticity[item.id])missingQuestions.push(question(`authenticity.${item.id}`,item.detail));
  for(const item of personalizationFor(input).items)if(!input.personalization[item.id])missingQuestions.push(question(`personalization.${item.id}`,item.detail));
  if(input.reference||input.benchmark){
    for(const [key,label] of referenceFields)if(!referenceValue(input,key))missingQuestions.push(question(`reference.${key}`,`참고 자료의 「${label}」 부분은 아직 분석 전이에요. 원문에서 확인하고, 「${input.topic}」에서는 어떻게 바꿀지 적어 주세요.`));
    if(!input.reference?.url)missingQuestions.push(question('reference.url','참고한 콘텐츠의 원본 주소를 적어 주세요. 회사가 고른 제목만으로는 원문을 확인할 수 없어요.'));
    if(!input.reference?.publishedAt||!input.reference?.checkedAt)missingQuestions.push(question('reference.dates','참고 자료의 게시일과 확인한 날을 적어 주세요. 최근에 올라왔다고 요즘 인기 형식인 것은 아니에요.'));
    if(!Object.values(input.reference?.reactions||{}).some(value=>value!==null))missingQuestions.push(question('reference.reactions','반응 수치가 없어요. 확인한 수치와 본 시각을 적고, 수치가 없으면 인기나 효과를 말하지 말아 주세요.'));
  }
  if(input.benchmark){
    for(const [key,label] of [['scope','고른 범위'],['periodStart','조사 기간 시작'],['periodEnd','조사 기간 끝'],['researchedAt','조사한 날'],['selectionBasis','고른 근거']])if(!input.benchmark[key])missingQuestions.push(question(`benchmark.${key}`,`회사 참고 자료에 「${label}」 칸이 비어 있어요. 어떤 자료를 어떤 조건으로 골랐는지 확인해 주세요.`));
    if(input.benchmark.stale!==false)missingQuestions.push(question('benchmark.freshness',input.benchmark.stale?'조사한 지 오래된 회사 참고 자료예요. 만들기 전에 원문과 조건을 다시 확인해 주세요.':'회사 참고 자료를 언제 조사했는지 알 수 없어요. 지금 써도 되는 자료인지 확인해 주세요.'));
    if(input.benchmark.seriesIds.length&&!input.benchmark.seriesIds.includes(input.seriesId))missingQuestions.push(question('benchmark.seriesFit',`이 참고 자료는 「${series.name}」용으로 고른 것이 아니에요. 우리 시청자와 이번 형식에 맞는 이유를 따져 보고, 바꿀 방법을 더 적어 주세요.`));
  }
  const audience=input.audience||series.audience;
  const factChecks=[
    input.proof?`적어 둔 근거의 원문·맥락·확인한 날짜를 견줘 봐요: ${input.proof}`:'만들기 전에 주장을 확인할 원문·화면·출처·날짜를 챙겨요.',
    input.experience?'적어 둔 경험이 실제 기억과 맞는지, 어느 장면이 재구성한 장면인지 확인해요.':'겪거나 써 본 것처럼 1인칭 사건·후기·결과를 지어 넣지 않아요.',
    '기능·가격·조건·표현의 쓰임처럼 바뀔 수 있는 사실은 만드는 날 다시 확인해요.',
    '여기서 제안한 도입·길이·짜임이 조회수나 추천 노출을 보장하지는 않아요.',
    '시청자의 상황과 선택은 확인한 사실과 짐작한 것을 나눠 적어요. 동의받은 범위 밖의 개인 정보나 짐작한 성격을 사실처럼 쓰지 않아요.',
    'SYNK가 가려는 개인화 방향과 지금 실제로 되는 기능·성과를 나눠 말해요. 이 기획 하나로 장기 기억까지 다 됐다고 말하지 않아요.',
    ...series.guardrails
  ];
  const ideas=series.angles.map(angle=>{
    const baseHook=replaceTopic(angle.hook,input.topic),hook=input.personalization.situation?`${excerpt(input.personalization.situation,120)} — ${baseHook}`:baseHook,context={input,series,angle,hook};
    const personalizedReason=[input.personalization.situation&&`시청자 상황 「${excerpt(input.personalization.situation)}」에 맞춰요.`,input.personalization.choice&&`본문에서는 「${excerpt(input.personalization.choice)}」처럼 자기 상황에 맞는 쪽을 고르게 해요.`,input.personalization.nextStep&&`보고 나서 「${excerpt(input.personalization.nextStep)}」까지 이어지게 해요.`].filter(Boolean).join(' ');
    return {id:`${series.id}:${angle.id}`,title:replaceTopic(angle.title,input.topic),hook,angle:angle.angle,
      viewerReason:`${audience}에게 「${input.topic}」에서 ${input.takeaway?`「${input.takeaway}」 한 가지`:'이해할 점과 직접 해 볼 행동 하나'}를 건네는 구성이에요. ${personalizedReason||'보는 사람의 상황·상황마다 고를 수 있는 도움·보고 나서 바로 할 일은 아직 안 적었어요.'} ${angle.reward}까지 챙겨요.`,
      storyBeats:applyContext(angle.flow.map((key,index)=>({time:series.timing[index]||`전개 ${index+1}`,...beatFor(key,context)})),input),
      takeaway:note(input.takeaway,'이번 편을 보고 이해하거나 직접 해 볼 한 가지'),
      entertainment:input.entertainment?`${input.entertainment} · 이 구성의 재미 제안 — ${angle.reward}`:`${angle.reward} — 이 구성이 제안하는 재미예요. 주제에 맞는 장면과 궁금증이 풀리는 곳을 적어 주세요.`,
      materials:[...series.materials],factChecks:[...factChecks],referenceAdaptation:referenceAdaptation(input,angle)};
  });
  const checklist=[
    {id:'audience',label:'누가 왜 볼지',status:input.audience?'provided':'review',detail:input.audience?input.audience:`${series.audience} · 이 유형의 기본 시청자`},
    {id:'information',label:'얻어 갈 정보',status:input.takeaway?'provided':'needs-input',detail:input.takeaway||'새로 알게 될 것·판단 근거·직접 할 행동 중 하나로 정해요.'},
    {id:'entertainment',label:'계속 볼 재미',status:input.entertainment?'provided':'needs-input',detail:input.entertainment||'세 구성의 재미 제안 중 소재에 맞는 장면을 골라 구체적으로 적어요.'},
    {id:'experience',label:'직접 겪은 일',status:input.experience?'provided':series.requiresExperience?'needs-input':'review',detail:input.experience?'경험을 적었어요. 사실인지, 시청자에게 쓸모 있는지는 아직 확인 전이에요.':series.requiresExperience?'제작 여정은 실제로 겪은 일이 있어야 해요. 없었던 일을 지어내지 않아요.':'직접 겪은 일이 없어도, 확인할 정보와 재미가 있으면 설명하는 콘텐츠로 기획할 수 있어요.'},
    {id:'evidence',label:'근거와 사실 확인',status:input.proof?'provided':'needs-input',detail:input.proof?'근거를 적었어요. 원문·날짜·쓰는 조건은 직접 견줘 봐야 해요.':'원문·화면·출처·날짜가 필요해요.'},
    {id:'reference',label:'참고 자료와 원본',status:'review',detail:input.reference||input.benchmark?'참고 자료를 골랐어요. 실제 반응과 짜임을 보고 우리 내용으로 다시 짜요.':'참고 자료 없이 유형별 기획 양식으로 짰어요. 지금 인기인지, 효과가 있는지는 확인하지 않았어요.'},
    {id:'personalization',label:'상황·도움·할 일 잇기',status:Object.values(input.personalization).every(Boolean)?'review':'needs-input',detail:'도입의 보는 사람 상황, 본문의 상황별 도움, 끝의 바로 할 일이 이어지는지 봐요. 이름을 넣거나 취향을 단정하는 것으로 대신하지 않아요.'},
    {id:'actual-preview',label:'실제 크기로 보고 듣기',status:'review',detail:'만든 뒤 실제 크기로 읽고, 보고, 들어 봐요. 파일이 나온 것과 볼 만한 콘텐츠인 것은 따로 확인해요.'},
    {id:'delivery',label:'약속한 자료 전달',status:'review',detail:'본문에서 약속한 정보를 실제로 주는지, 안내한 자료를 받는 길이 제대로 되는지 확인해요.'}
  ];
  return {mode:'guided-template',seriesId:series.id,seriesName:series.name,topic:input.topic,input,ideas,
    guidance:[`「${series.name}」 유형별 기획 양식에 적은 내용을 넣어 만든 초안이에요. 실시간 조사나 AI로 사실을 확인하지는 않았어요.`,
      `형식: ${series.format}. 장면별 시간은 제안이니 실제로 찍고 읽어 보며 정해요.`,
      '[채울 것]은 만들기 전에 채울 자리예요. 적어 둔 경험과 근거도 확인 전 자료로 다뤄요.',
      '정보와 재미를 따로 챙겨요. 직접 겪은 일이 있는 편은 실제 선택과 장면을 앞세우고, 겪은 일 없이 설명하는 편은 확인할 자료와 쉬운 예시로 짜요.',
      'SYNK의 개인화는 각자의 배경·목표·선택에 맞는 다음 도움을 주는 거예요. 본인이 밝힌 정보, 직접 본 사실, 짐작한 것을 나누고 필요한 만큼만 써요. 이 기획 하나로 장기 개인화가 다 됐다거나 효과가 있다고 말하지 않아요.',
      '재미·도움·진정성·개인화는 칸을 채웠다고 통과하는 게 아니에요. 근거가 있어도 편집 품질과 실제 경험은 직접 봐요.',
      ...series.guardrails],checklist,missingQuestions,authenticity:authenticityFor(input),personalization:personalizationFor(input),reviewAxes:reviewAxesFor(input,series,missingQuestions),benchmark:input.benchmark?structuredClone(input.benchmark):null,sourcePaths:[...new Set([...catalog.sourcePaths,series.sourcePath])]};
}

const markdown=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/([\\`*_{}\[\]()#!|])/g,'\\$1').replace(/\r\n?/g,'\n');
const line=value=>markdown(value).replace(/\n/g,' / ');
const statusLabel=status=>({provided:'작성됨','needs-input':'채워야 함',review:'직접 검토'})[status]||'직접 검토';
export function renderBriefMarkdown(plan){
  record(plan,'기획안');
  if(plan.mode!=='guided-template'||!Array.isArray(plan.ideas)||!Array.isArray(plan.checklist))throw new TypeError('내려받을 기획안을 읽지 못했어요. 「고쳐서 새로 만들기」로 다시 만든 뒤 내려받아 주세요.');
  const lines=[`# ${line(plan.topic)} · 콘텐츠 기획안`,'',`시리즈: ${line(plan.seriesName||plan.seriesId)}`,'','유형별 기획 양식으로 만든 초안이에요. 실시간 유행 조사·사실 확인·제작·게시를 마쳤다는 뜻은 아니에요.','', '## 적은 내용',''];
  for(const [key,label] of [['audience','보는 사람'],['experience','직접 겪은 일'],['proof','보여 줄 근거'],['takeaway','얻어 갈 정보'],['entertainment','끝까지 볼 이유']])lines.push(`- ${label}: ${line(plan.input?.[key]||'안 적음')}`);
  if(plan.input?.channelContext)lines.push(`- 담당 채널: ${line(plan.input.channelContext.displayName)} · ${line(plan.input.channelContext.platform)}`);
  if(plan.input?.editorialNote)lines.push('','## 이번 편 제작 실험','','만드는 사람만 보는 메모예요. 영상의 화면·대사·시청자 행동에는 넣지 않아요.','',markdown(plan.input.editorialNote));
  lines.push('','## 진정성 점검','',line(plan.authenticity?.summary||'경험·생각·한계·출처와 연출을 따로 확인해 주세요.'),'');
  for(const item of plan.authenticity?.items||[])lines.push(`- ${line(item.label)} — ${statusLabel(item.status)}: ${line(item.detail)}`);
  lines.push('','## 개인화 점검','',line(plan.personalization?.summary||'보는 사람의 상황·상황마다 고를 수 있는 도움·보고 나서 바로 할 일이 이어지는지 직접 봐 주세요.'),'');
  for(const item of plan.personalization?.items||[])lines.push(`- ${line(item.label)} — ${statusLabel(item.status)}: ${line(item.detail)}`);
  lines.push('','## 좋은 기획을 위한 네 가지 질문','','칸을 채웠다고 점수를 매기거나 통과로 보지 않아요. 실제로 읽고, 재생하고, 듣고, 원문과 견줘 봐 주세요.');
  for(const axis of plan.reviewAxes||[]){
    lines.push('',`### ${line(axis.label)} — ${statusLabel(axis.status)}`,'',line(axis.reason),'','확인할 질문:',...(axis.questions||[]).map(value=>`- ${line(value)}`),'','적은 근거 · 확인 전:',...(axis.evidence?.length?axis.evidence.map(value=>`- ${line(value)}`):['- 아직 없어요. 근거를 적어 주세요.']),'',`다음에 할 일: ${line(axis.nextAction)}`);
  }
  lines.push('','## 적용한 제작 기준','',...(plan.guidance||[]).map(value=>`- ${line(value)}`));
  for(const [index,idea] of plan.ideas.entries()){
    lines.push('',`## 구성 ${index+1}. ${line(idea.title)}`,'',`**첫 장면의 한마디:** ${line(idea.hook)}`,'',`**풀어 갈 방향:** ${line(idea.angle)}`,'',`**볼 이유:** ${line(idea.viewerReason)}`,'','### 이야기 구성','');
    for(const beat of idea.storyBeats||[])lines.push(`#### ${line(beat.time)}`,'',`- 화면: ${line(beat.visual)}`,`- 말할 내용: ${line(beat.narration)}`,'');
    lines.push('### 얻어 갈 정보와 재미','',`- 얻어 갈 정보: ${line(idea.takeaway)}`,`- 계속 볼 재미: ${line(idea.entertainment)}`,'','### 필요한 자료','',...(idea.materials||[]).map(value=>`- ${line(value)}`),'','### 사실 확인','',...(idea.factChecks||[]).map(value=>`- ${line(value)}`),'','### 참고를 우리 것으로 바꾸기','',line(idea.referenceAdaptation));
  }
  lines.push('','## 제작 전 확인','');
  for(const item of plan.checklist)lines.push(`- [ ] ${line(item.label)} — ${statusLabel(item.status)}: ${line(item.detail)}`);
  if(plan.missingQuestions?.length)lines.push('','## 조금 더 채워 볼 질문','',...plan.missingQuestions.map(item=>`- ${line(item.question)}`));
  const reference=plan.input?.reference;
  if(reference){
    lines.push('','## 고른 참고 자료','',`- 제목: ${line(reference.title||'안 적음')}`,`- 주소: ${line(reference.url||'안 적음')}`,`- 게시일: ${line(reference.publishedAt||'안 적음')}`,`- 확인일: ${line(reference.checkedAt||'안 적음')}`,...referenceFields.map(([key,label])=>`- ${label}: ${line(reference[key]||'안 적음')}`),'- 반응 수와 날짜는 적어 둔 값이에요. 지금도 인기인지는 확인하지 않았어요.');
    for(const [key,value] of Object.entries(reference.reactions||{}))lines.push(`- ${({views:'조회',likes:'좋아요',comments:'댓글',shares:'공유',saves:'저장',reach:'도달'})[key]||line(key)}: ${value===null?'모름':line(value)}`);
  }
  if(plan.benchmark){
    const benchmark=plan.benchmark;
    lines.push('','## 회사 참고 자료','',...([['title','조사 자료 제목'],['scope','고른 범위'],['periodStart','조사 기간 시작'],['periodEnd','조사 기간 끝'],['researchedAt','조사한 날'],['selectionBasis','고른 근거'],['rank','조사 자료 안 순서']].map(([key,label])=>`- ${label}: ${line(benchmark[key]||'안 적음')}`)),`- 조사 시기: ${benchmark.stale===true?'오래됨 · 다시 확인해 주세요':benchmark.stale===false?'최근 · 원문은 직접 봐 주세요':'알 수 없음'}`,...referenceFields.map(([key,label])=>`- ${label}: ${line(benchmark[key]||'안 적음')}`),'- 회사가 고른 참고 자료예요. 플랫폼 전체 순위도, 효과를 확인한 결과도 아니에요.');
  }
  lines.push('','## 제작 기준 원문','',...(plan.sourcePaths||[]).map(path=>`- ${line(path)}`),'');
  return lines.join('\n');
}
