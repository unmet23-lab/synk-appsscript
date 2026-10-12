import {readFileSync} from 'node:fs';

const catalog=JSON.parse(readFileSync(new URL('./content-catalog.json',import.meta.url),'utf8'));
const referenceFields=[['hook','도입'],['structure','전개 구조'],['payoff','시청자가 받는 보상'],['brandFit','SYNK 대상·방향과의 접점'],['adaptation','우리 소재로 바꿀 구체적인 방법']];
const personalizationFields=[
  ['situation','시청자의 상황과 목표','이번 시청자의 배경·목표·가능한 시간이나 제약을 적어 주세요. 직접 확인한 정보와 기획상의 가정을 구분해 주세요.'],
  ['choice','스스로 고를 기준','시청자가 자기 상황에 따라 무엇을 고르며, 그 선택에 따라 설명·예시·도움이 어떻게 달라지는지 적어 주세요.'],
  ['nextStep','자기 상황에서 할 다음 행동','시청자가 지금 자기 상황에서 해볼 작은 행동과 결과를 확인할 방법을 적어 주세요.']
];
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const record=(value,label)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new TypeError(`${label} 입력 형식을 확인해 주세요.`);return value;};
function text(value,label,max=3000,required=false){
  if(value==null&&!required)return '';
  if(typeof value!=='string'||value.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))throw new TypeError(`${label}에는 ${max}자 이내의 문장을 입력해 주세요.`);
  const clean=value.trim();if(required&&!clean)throw new TypeError(`${label}을 입력해 주세요.`);return clean;
}
function referenceOf(value){
  if(value==null||value==='')return null;
  if(typeof value==='string')value={url:value};
  record(value,'참고 자료');
  const raw=text(value.url,'참고 주소',2048);let url='';
  if(raw){try{const parsed=new URL(raw);if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw new Error();url=parsed.href;}catch{throw new TypeError('참고 주소는 공개 HTTPS 주소로 입력해 주세요.');}}
  const result={url,title:text(value.title,'참고 제목',300),publishedAt:text(value.publishedAt,'게시일',80),checkedAt:text(value.checkedAt,'확인일',80),...Object.fromEntries(referenceFields.map(([key,label])=>[key,text(value[key],`참고 ${label}`)])),reactions:{}};
  if(value.reactions!=null){
    const reactions=record(value.reactions,'참고 반응');
    for(const key of ['views','likes','comments','shares','saves','reach']){
      const number=reactions[key];if(number!=null&&(!Number.isSafeInteger(number)||number<0))throw new TypeError('참고 반응은 확인한 0 이상의 정수로 입력해 주세요.');
      result.reactions[key]=number??null;
    }
  }
  return result;
}
function benchmarkOf(value){
  if(value==null)return null;
  record(value,'회사 참고 선정');
  const result={};
  for(const [key,max] of [['id',100],['itemId',100],['title',300],['scope',300],['periodStart',80],['periodEnd',80],['researchedAt',80],['selectionBasis',3000],...referenceFields.map(([key])=>[key,3000])])result[key]=text(value[key],`회사 참고 ${key}`,max);
  if(value.rank!=null&&(!Number.isSafeInteger(value.rank)||value.rank<1))throw new TypeError('회사 참고 순서는 양의 정수로 입력해 주세요.');
  if(value.stale!=null&&typeof value.stale!=='boolean')throw new TypeError('회사 참고 갱신 상태를 확인해 주세요.');
  if(value.seriesIds!=null&&(!Array.isArray(value.seriesIds)||value.seriesIds.length>30))throw new TypeError('회사 참고 시리즈를 확인해 주세요.');
  result.rank=value.rank??null;result.stale=value.stale??null;result.seriesIds=(value.seriesIds||[]).map(id=>text(id,'참고 시리즈',100,true));
  return result;
}
function normalize(input){
  record(input,'기획');
  const seriesId=text(input.seriesId,'시리즈',100,true),topic=text(input.topic,'주제',300,true);
  if(!catalog.series.some(series=>series.id===seriesId))throw new TypeError('목록에 있는 콘텐츠 시리즈를 선택해 주세요.');
  const values={seriesId,topic};
  for(const key of ['audience','experience','proof','takeaway','entertainment'])values[key]=text(input[key],({audience:'시청자',experience:'실제 경험',proof:'근거',takeaway:'가져갈 정보',entertainment:'재미의 장면'})[key]);
  // Editor-only evidence stays metadata; it is not a viewer fact or action.
  values.editorialNote=text(input.editorialNote,'이번 편 제작 실험',3000);
  values.reference=referenceOf(input.reference);
  values.benchmark=benchmarkOf(input.benchmark);
  values.channelContext=null;
  if(input.channelContext!=null){const context=record(input.channelContext,'채널');values.channelContext={id:text(context.id,'채널 ID',100),displayName:text(context.displayName,'채널 이름',300),platform:text(context.platform,'플랫폼',100)};}
  const authenticity=input.authenticity==null?{}:record(input.authenticity,'진정성');
  values.authenticity=Object.fromEntries(['basis','ownPerspective','limits','disclosure'].map(key=>[key,text(authenticity[key],({basis:'경험과 자료의 구분',ownPerspective:'우리의 관점',limits:'한계',disclosure:'공개할 맥락'})[key])]));
  const personalization=input.personalization==null?{}:record(input.personalization,'개인화');
  values.personalization=Object.fromEntries(personalizationFields.map(([key,label])=>[key,text(personalization[key],label,2000)]));
  return values;
}
const replaceTopic=(value,topic)=>value.replaceAll('{topic}',topic.replace(/[\r\n]+/g,' '));
const placeholder=value=>`[작성할 내용: ${value}]`;
const note=(value,missing)=>value||placeholder(missing);
const submitted=value=>value?`입력한 내용 · 사실 확인 전: ${value}`:'';
const question=(field,prompt)=>({id:`question-${field.replaceAll('.','-')}`,field,question:prompt});
const excerpt=(value,max=260)=>value.length>max?`${value.slice(0,max)}…`:value;
const referenceValue=(input,key)=>input.reference?.[key]||input.benchmark?.[key]||'';

export function getContentCatalog(){return structuredClone(catalog);}

function referenceAdaptation(input,angle){
  const {reference,benchmark}=input;
  if(!reference&&!benchmark)return '참고 자료를 선택하지 않았습니다. 이번 안은 회사 제작 양식에서 제안한 구조입니다. 최신 유행이나 인기 효과를 확인한 결과가 아닙니다.';
  const identified=reference?.title||benchmark?.title||reference?.url||'입력한 참고 자료';
  const details=referenceFields.map(([key,label])=>`${label}: ${referenceValue(input,key)?excerpt(referenceValue(input,key)):'미확인 · 원문을 보고 작성'}`).join('\n');
  return `${identified}의 입력한 분석을 검토합니다.\n${details}\n이번 콘텐츠에는 「${angle.angle}」로 변형하는 안입니다. 원본 문장·장면을 그대로 복제하지 않고 우리 소재와 새 설명으로 구성합니다. 게시일·확인일·반응 수는 입력 자료이며 최신·인기 여부를 자동 검증하지 않았습니다.${benchmark?' 회사 선정 순위는 해당 호의 편집 순서이며 플랫폼 전체 인기 순위를 뜻하지 않습니다.':''}`;
}

function beatFor(key,{input,series,angle,hook}){
  const experience=note(input.experience,'이번 회차에 실제로 겪은 상황·선택·결과. 경험이 없다면 실제 경험처럼 낭독하지 않기');
  const proof=note(input.proof,'공식 자료·직접 촬영·실행 결과 중 확인할 근거와 출처·날짜');
  const takeaway=note(input.takeaway,'시청자가 이해하거나 직접 해볼 한 가지');
  const learning=['situation','expression'].includes(series.kind);
  const data={
    hook:{visual:`「${input.topic}」의 핵심 상황 또는 확인할 화면 하나. ${angle.reward}을 만들 장면을 선택합니다. 아직 없는 결과 화면은 만들었다고 표시하지 않습니다.`,narration:hook},
    proof:{visual:`확인할 근거를 화면의 주장 옆에 배치합니다. ${submitted(input.proof)||proof}`,narration:input.proof?`[근거 확인 후 말할 문장 작성] ${proof}`:proof},
    experience:{visual:input.experience?`입력한 실제 경험에서 한 장면을 고릅니다. ${experience} · 당시 화면이 없으면 재구성으로 표시합니다.`:'경험이 없는 상태입니다. 경험 기반 회차는 사실을 입력하고, 정보형 회차는 확인할 예시·자료 장면으로 바꿉니다.',narration:input.experience?`[입력한 경험을 다듬을 원문 · 사실 확인 전] ${experience}`:placeholder('경험 원문 또는 정보형 예시. 일어난 적 없는 사건을 1인칭 회고로 만들지 않기')},
    question:{visual:'선택지나 질문을 한 화면에 보여주고 답을 공개하기 전에 생각할 여백을 둡니다. 선택지의 사실 관계는 근거로 확인합니다.',narration:placeholder(`${input.topic}에서 시청자가 먼저 판단해 볼 질문과 선택 이유`)},
    application:{visual:'실제로 시연할 경우 전체 화면 → 위치 강조 → 행동 → 응답 순서로 보여줍니다. 시연이 없으면 공식 설명 자료임을 표시합니다.',narration:placeholder('이번 대상에게 적용되는 상황·직접 할 행동·확인한 결과. 시연하지 않은 사용 후기는 쓰지 않기')},
    limits:{visual:'적용 대상·조건·미확인 부분을 짧은 항목으로 분리합니다. 준비 단계와 확인된 결과를 구분합니다.',narration:input.authenticity.limits?`[입력한 한계 · 검토 전] ${input.authenticity.limits}`:placeholder('확인한 적용 조건·비용·실패 가능성·아직 확인하지 못한 부분')},
    setup:{visual:'처음 쓰는 사람 기준으로 준비물과 현재 화면의 위치를 먼저 보여줍니다. 필요한 계정·자료·설정은 제작일에 확인합니다.',narration:placeholder(`${input.topic}의 준비물과 시작 위치, 먼저 준비해야 하는 이유`)},
    action:{visual:'한 번에 한 행동만 강조합니다. 어디에 무엇을 넣고 어떤 버튼을 누르는지 같은 화면에서 짚으며 읽는 시간을 둡니다.',narration:placeholder('실제 실행 순서·정확한 입력·행동마다 필요한 이유')},
    check:{visual:`원문과 결과를 나란히 보고 일치·누락·미확인을 구분합니다. ${input.proof?`대조할 입력 근거: ${input.proof}`:'아직 근거가 없으면 검증할 항목을 표시합니다.'}`,narration:placeholder('무엇을 대조했고 어떤 부분을 확인했는지. 새 결과나 수치를 추정하지 않기')},
    analogy:{visual:'익숙한 물건이나 행동과 실제 개념을 대응시킵니다. 같은 점과 비유가 맞지 않는 지점을 따로 보여줍니다.',narration:placeholder(`${input.topic}의 쉬운 정의·익숙한 비유·비유의 한계`)},
    reflection:{visual:input.authenticity.ownPerspective?`입력한 우리의 관점: ${input.authenticity.ownPerspective}`:'당시의 선택과 지금의 판단을 두 칸에 나눠 보여줍니다. 팀에서 실제로 중요하게 보는 기준을 작성합니다.',narration:input.authenticity.ownPerspective?`[입력한 관점 · 검토 전] ${input.authenticity.ownPerspective}`:placeholder('우리의 실제 선택 이유와 지금의 판단. 결과를 보장하는 교훈으로 일반화하지 않기')},
    situation:{visual:learning?`${series.kind==='situation'?'AI 실사 인물의 생활 대화':'승인 마스코트 한 명의 반응'}로 표현을 쓸 순간을 보여줍니다. 학습자의 실수를 비웃지 않고 상황의 어긋남을 설명합니다.`:'검증된 예시의 상황을 보여줍니다. 예시와 실제 경험을 화면에서 구분합니다.',narration:placeholder('이번 표현을 자연스럽게 쓰는 검토된 대화 또는 상황 설명')},
    expression:{visual:'한국어 표현 하나, 상황에 맞는 뜻, 정확한 소리를 함께 제시합니다. 교사 검토 전에는 검토용으로 표시합니다.',narration:placeholder(`${input.topic}에서 가르칠 표현 하나와 상황에 맞는 뜻·예문. 원어 발음을 왜곡하지 않기`)},
    practice:{visual:'정답을 보여준 뒤 따라 말할 여백을 남깁니다. 연습 중 새 정보를 겹치지 않고 표현과 소리의 위치를 맞춥니다.',narration:placeholder('검토된 표현을 천천히 한 번 → 따라 말하기 쉼 → 보통 속도 한 번')},
    replay:{visual:'같은 장면을 짧게 다시 보여줍니다. 새 장면을 늘리기보다 처음에 놓친 단서 하나만 강조합니다.',narration:placeholder('다시 보니 이해할 수 있는 단서와 앞 설명의 연결')},
    transfer:{visual:'정답을 먼저 노출하지 않은 새 상황이나 빈칸을 보여주고 직접 말하거나 적을 시간을 둡니다.',narration:placeholder('같은 표현 또는 판단 기준을 자기 상황에 적용할 질문. 확인된 예시 답은 참여 뒤에 공개')},
    quote:{visual:'실제 인터뷰 원본과 타임코드를 대조한 발언을 사용합니다. 앞뒤 맥락·말끝·표정을 보존합니다.',narration:placeholder('실제 발언 원문과 타임코드. 입력된 근거가 있어도 발언 자체를 새로 만들어 인용하지 않기')},
    context:{visual:'누가 어떤 상황에서 한 말인지 필요한 맥락만 붙입니다. 근거 없는 이력·고객·성과를 덧붙이지 않습니다.',narration:placeholder('발언이나 선택의 실제 앞뒤 맥락과 확인할 근거')},
    takeaway:{visual:`마지막에는 시청자가 가져갈 정보와 행동을 한 가지로 정리합니다. ${input.takeaway?`입력한 목표: ${input.takeaway}`:'목표가 비어 있으므로 구체적인 다음 행동을 작성합니다.'} 자료가 있으면 실제 파일과 받을 경로를 확인합니다.`,narration:input.takeaway?`[입력한 정보 목표 · 본문에서 제공됐는지 확인] ${takeaway}`:takeaway}
  };
  if(!own(data,key))throw new TypeError('콘텐츠 전개 양식을 확인해 주세요.');
  return data[key];
}

function authenticityFor(input){
  const fields=[
    ['basis','경험과 검증 자료의 구분','실제로 겪은 내용, 외부 자료로 확인할 내용, 예시로 재구성할 내용을 구분해 주세요.'],
    ['ownPerspective','우리만의 관점과 선택','이번 주제에서 우리가 택한 이유와 중요하게 보는 기준을 써 주세요.'],
    ['limits','한계와 미확인 부분','실패·적용 조건·아직 확인하지 않은 부분을 과장 없이 써 주세요.'],
    ['disclosure','보는 사람에게 공개할 맥락','AI로 연출한 장면·협찬·참고한 출처가 있는지 확인하고 필요한 안내를 써 주세요. 해당 없으면 그 사실을 적어 주세요.']
  ];
  return {items:fields.map(([id,label,detail])=>({id,label,status:input.authenticity[id]?'provided':id==='disclosure'?'review':'needs-input',detail:input.authenticity[id]?`입력한 내용 · 사실·맥락 확인 전: ${input.authenticity[id]}`:detail})),summary:'경험·관점·한계·공개할 맥락을 따로 확인하는 작성 항목입니다. 입력 여부는 진정성이나 사실성을 자동 판정한 결과가 아닙니다.'};
}

function personalizationFor(input){
  return {
    summary:'SYNK는 각자의 목표와 상황에 맞는 도움을 지향합니다. 이번 기획에서는 상황·선택·다음 행동이 실제로 이어지는지 검토합니다. 이름 삽입이나 취향 추정으로 대체하지 않으며, 장기 개인화 제품의 구현·효과를 인증하는 항목이 아닙니다.',
    items:personalizationFields.map(([id,label,detail])=>({id,label,status:input.personalization[id]?'review':'needs-input',detail:input.personalization[id]?`입력한 기획 · 시청자 적합성 검토 전: ${input.personalization[id]}`:detail}))
  };
}

function applyContext(beats,input,angle){
  const {situation,choice,nextStep}=input.personalization;
  const result=beats.map(beat=>({...beat})),last=result.length-1,middle=Math.floor(last/2);
  if(situation){
    result[0].visual+=`\n시청자 상황에 맞출 장면: ${excerpt(situation)}. 실제 확인한 상황인지 기획 가정인지 표시합니다.`;
    result[0].narration+=`\n[도입에서 연결할 시청자 상황] ${excerpt(situation)}`;
  }
  if(choice){
    result[middle].visual+=`\n시청자가 고를 기준: ${excerpt(choice)}. 「${angle.angle}」에 맞춰 선택별 예시·설명을 나누고, 없는 선택 결과는 미확인으로 남깁니다.`;
    result[middle].narration+=`\n[시청자에게 건넬 선택 질문으로 다듬기] ${excerpt(choice)}`;
  }
  if(nextStep){
    result[last].visual+=`\n자기 상황으로 가져갈 마지막 행동: ${excerpt(nextStep)}. 선택한 조건에서도 가능한지 확인합니다.`;
    result[last].narration+=`\n[본문에서 약속한 도움을 제공한 뒤 안내] ${excerpt(nextStep)}`;
  }
  for(const [index,[key,label]] of referenceFields.entries()){
    const value=referenceValue(input,key);if(!value)continue;
    // Reference notes inform production directions, never become copied dialogue or a popularity claim.
    const target=key==='payoff'?last:key==='brandFit'?middle:key==='adaptation'?Math.max(1,last-1):index;
    result[target].visual+=`\n참고 ${label} 관찰 · 검토 전: ${excerpt(value)}. 「${input.topic}」의 자체 자료와 이 안의 전개로 바꿉니다.`;
  }
  return result;
}

function reviewAxesFor(input,series,missingQuestions){
  const evidence=(...pairs)=>pairs.filter(([,value])=>value).map(([label,value])=>`${label} · 입력 자료, 검토 전: ${excerpt(value,400)}`);
  const questionsFor=(fields,extra)=>[...missingQuestions.filter(item=>fields.some(field=>item.field===field||item.field.startsWith(field+'.'))).map(item=>item.question),...extra];
  const referenceIncomplete=(input.reference||input.benchmark)&&referenceFields.some(([key])=>!referenceValue(input,key));
  const benchmarkMismatch=input.benchmark?.seriesIds.length>0&&!input.benchmark.seriesIds.includes(input.seriesId);
  return [
    {id:'fun',label:'재미와 몰입',status:input.entertainment&&!referenceIncomplete?'review':'needs-input',
      reason:input.entertainment?'재미를 줄 장면을 입력했습니다. 기대가 실제로 해소되는지, 처음 보는 사람이 이해하고 즐기는지는 아직 미확인입니다.':'재미를 주겠다는 목표를 구체적인 기대·장면·보상으로 채워야 합니다.',
      questions:questionsFor(['entertainment','reference','benchmark'],['처음에 생긴 궁금증이 어느 장면에서 풀리며, 답을 보여주기 전에 따라올 시간이 있나요?','움직임·설명·나레이션이 같은 의미를 가리키고 읽거나 듣기 편한가요?']),
      evidence:evidence(['재미 구상',input.entertainment],['참고 도입',referenceValue(input,'hook')],['참고 보상',referenceValue(input,'payoff')]),
      nextAction:input.entertainment?`「${excerpt(input.entertainment,120)}」가 생기는 장면과 해소 장면을 한 쌍으로 만들고 실제 크기로 재생해 확인하세요.`:'세 구성안 중 보상 하나를 고르고 도입의 질문 → 단서 → 답이 드러나는 장면을 구체적인 예시로 작성하세요.'},
    {id:'usefulness',label:'도움과 이해',status:input.takeaway&&input.proof?'review':'needs-input',
      reason:input.takeaway&&input.proof?'가져갈 정보와 대조할 근거가 입력되었습니다. 정확성과 실제로 따라 할 수 있는지는 직접 검토해야 합니다.':'무엇을 이해하거나 해볼지와 그것을 뒷받침할 자료를 함께 채워야 합니다.',
      questions:questionsFor(['takeaway','proof'],['처음 접하는 사람이 어디를 보고 무엇을 하며 왜 필요한지 설명돼 있나요?','막히는 조건이나 실패할 때의 대안까지 자료와 일치하나요?']),
      evidence:evidence(['정보 목표',input.takeaway],['대조할 근거',input.proof],['다음 행동',input.personalization.nextStep]),
      nextAction:input.takeaway?`「${excerpt(input.takeaway,120)}」를 한 가지 실제 예시로 설명하고 원문과 대조한 뒤, 처음 보는 사람이 따라 할 수 있는지 확인하세요.`:'시청자가 해볼 행동 하나를 정하고 준비물·순서·확인할 결과를 실제 자료 옆에 작성하세요.'},
    {id:'authenticity',label:'진정성과 사실',status:Object.values(input.authenticity).every(Boolean)&&input.proof&&(!series.requiresExperience||input.experience)?'review':'needs-input',
      reason:'경험이나 근거를 입력한 것만으로 실제 경험·사실성·진정성이 인증되지 않습니다. 직접 경험, 조사한 정보, 재구성을 원본과 대조해야 합니다.',
      questions:questionsFor(['authenticity','experience','proof'],['실제보다 큰 결과를 약속하거나 남의 경험·발언을 우리 경험처럼 읽는 문장이 있나요?']),
      evidence:evidence(['경험 원문',input.experience],['사실의 바탕',input.authenticity.basis],['우리 관점',input.authenticity.ownPerspective],['한계',input.authenticity.limits],['공개할 맥락',input.authenticity.disclosure]),
      nextAction:'사실 주장마다 직접 경험·외부 자료·재구성 중 출처를 붙여 대조하고, 확인 못 한 결과를 삭제하거나 미확인으로 표시하세요. AI 연출·협찬 등 필요한 맥락도 표시하세요.'},
    {id:'personalization',label:'SYNK다운 개인화',status:Object.values(input.personalization).every(Boolean)&&!benchmarkMismatch?'review':'needs-input',
      reason:'개인의 배경·목표·제약에 따라 선택과 다음 도움이 달라지는지 확인합니다. 이름을 넣거나 특정 성격을 추정하는 것만으로는 적합성을 판단할 수 없습니다.',
      questions:questionsFor(['personalization','benchmark.seriesFit'],['같은 주제를 다른 상황의 사람이 보면 선택 기준과 다음 행동이 실제로 달라지나요?','본인이 밝힌 정보·관측 사실·기획상의 추정을 구분하고 필요한 범위만 사용하나요?','준비 중인 개인화 기능을 이미 제공하거나 효과가 검증된 제품처럼 소개하지 않나요?']),
      evidence:evidence(...personalizationFields.map(([key,label])=>[label,input.personalization[key]]),['참고와 브랜드의 접점',referenceValue(input,'brandFit')]),
      nextAction:Object.values(input.personalization).every(Boolean)?`「${excerpt(input.personalization.situation,100)}」에서 「${excerpt(input.personalization.choice,100)}」를 고른 사람이 「${excerpt(input.personalization.nextStep,100)}」까지 갈 수 있는지 예시·설명·엔딩을 함께 검토하세요.`:'한 사람의 구체적인 상황·목표를 정하고, 그 사람이 고를 기준과 지금 할 다음 행동을 도입·본문·엔딩에 각각 넣으세요.'}
  ];
}

export function generateContentIdeas(rawInput){
  const input=normalize(rawInput),series=catalog.series.find(row=>row.id===input.seriesId),missingQuestions=[];
  if(!input.audience)missingQuestions.push(question('audience',`기본 대상 「${series.audience}」 중 이번 편이 해결할 구체적인 상황은 무엇인가요?`));
  if(!input.experience&&series.requiresExperience)missingQuestions.push(question('experience','이번 회차에 실제로 겪은 상황·선택·결과를 적어 주세요. 직접 경험이 없는 독립 설명은 synkbrief 뉴스·활용·기초에서도 기획할 수 있습니다.'));
  if(!input.proof)missingQuestions.push(question('proof',`「${input.topic}」의 내용과 결과를 확인할 원문·화면·자료는 무엇인가요? 출처와 확인 날짜를 함께 남겨 주세요.`));
  if(!input.takeaway)missingQuestions.push(question('takeaway','시청자가 보고 난 뒤 이해하거나 직접 해볼 한 가지를 구체적으로 적어 주세요.'));
  if(!input.entertainment)missingQuestions.push(question('entertainment','호기심·공감·발견·참여 중 어떤 즐거움을 어느 장면에서 주고 어떻게 해소할까요? 아래 세 안의 제안을 골라 구체화해 주세요.'));
  for(const item of authenticityFor(input).items)if(!input.authenticity[item.id])missingQuestions.push(question(`authenticity.${item.id}`,item.detail));
  for(const item of personalizationFor(input).items)if(!input.personalization[item.id])missingQuestions.push(question(`personalization.${item.id}`,item.detail));
  if(input.reference||input.benchmark){
    for(const [key,label] of referenceFields)if(!referenceValue(input,key))missingQuestions.push(question(`reference.${key}`,`참고 원문에서 ${label}을 확인하고, 「${input.topic}」에서는 무엇을 어떻게 바꿀지 적어 주세요.`));
    if(!input.reference?.url)missingQuestions.push(question('reference.url','참고한 실제 콘텐츠의 원본 주소를 남겨 주세요. 회사 선정 제목만으로 원문 확인을 대신할 수 없습니다.'));
    if(!input.reference?.publishedAt||!input.reference?.checkedAt)missingQuestions.push(question('reference.dates','참고 자료의 실제 게시일과 확인일을 기록해 주세요. 날짜만으로 최신 인기 포맷이라고 판단하지 않습니다.'));
    if(!Object.values(input.reference?.reactions||{}).some(value=>value!==null))missingQuestions.push(question('reference.reactions','반응 수치는 미확인입니다. 확인 가능한 수치와 관측 시점을 남기되, 자료가 없으면 인기나 효과를 주장하지 마세요.'));
  }
  if(input.benchmark){
    for(const [key,label] of [['scope','선정 범위'],['periodStart','조사 기간 시작'],['periodEnd','조사 기간 끝'],['researchedAt','조사 시점'],['selectionBasis','선정 근거']])if(!input.benchmark[key])missingQuestions.push(question(`benchmark.${key}`,`회사 참고 선정의 ${label}이 비어 있습니다. 어떤 자료를 어떤 조건으로 골랐는지 확인해 주세요.`));
    if(input.benchmark.stale!==false)missingQuestions.push(question('benchmark.freshness',input.benchmark.stale?'갱신 시기가 지난 회사 참고 자료입니다. 제작 시점의 원문과 조건을 다시 확인해 주세요.':'회사 참고 자료의 갱신 상태가 미확인입니다. 현재 사용해도 되는 자료인지 확인해 주세요.'));
    if(input.benchmark.seriesIds.length&&!input.benchmark.seriesIds.includes(input.seriesId))missingQuestions.push(question('benchmark.seriesFit',`이 참고의 지정 시리즈에 「${series.name}」이 없습니다. 우리 시청자와 이번 형식에 맞는 이유를 검토하고 변형 방법을 보완해 주세요.`));
  }
  const audience=input.audience||series.audience;
  const factChecks=[
    input.proof?`입력한 근거의 원문·맥락·확인 날짜를 대조합니다: ${input.proof}`:'제작 전에 주장을 확인할 원문·화면·출처·날짜를 확보합니다.',
    input.experience?'입력한 경험이 실제 회고와 일치하는지, 재구성한 장면은 무엇인지 확인합니다.':'실제로 경험하거나 사용한 것처럼 1인칭 사건·후기·결과를 만들어 넣지 않습니다.',
    '기능·가격·조건·표현 사용 여부처럼 바뀔 수 있는 사실은 제작 시점에 다시 확인합니다.',
    '제안한 훅·길이·구조는 검증된 성과나 추천 알고리즘의 성공을 보장하지 않습니다.',
    '시청자의 상황·선택은 확인된 사실과 기획상의 가정을 구분합니다. 동의한 범위 밖의 개인 정보나 추정된 성격을 콘텐츠의 사실로 쓰지 않습니다.',
    'SYNK의 개인화 방향과 지금 확인된 제품 기능·성과를 구분합니다. 전체 장기 기억 시스템의 완성을 이 기획만으로 주장하지 않습니다.',
    ...series.guardrails
  ];
  const ideas=series.angles.map(angle=>{
    const baseHook=replaceTopic(angle.hook,input.topic),hook=input.personalization.situation?`${excerpt(input.personalization.situation,120)} — ${baseHook}`:baseHook,context={input,series,angle,hook};
    const personalizedReason=[input.personalization.situation&&`이번에 겨냥한 상황은 「${excerpt(input.personalization.situation)}」입니다.`,input.personalization.choice&&`자신에게 맞는 판단은 「${excerpt(input.personalization.choice)}」에서 고릅니다.`,input.personalization.nextStep&&`보고 난 뒤 「${excerpt(input.personalization.nextStep)}」로 이어지게 설계합니다.`].filter(Boolean).join(' ');
    return {id:`${series.id}:${angle.id}`,title:replaceTopic(angle.title,input.topic),hook,angle:angle.angle,
      viewerReason:`${audience}에게 「${input.topic}」의 ${input.takeaway?`핵심 정보 「${input.takeaway}」`:'이해할 점과 직접 해볼 행동 하나'}를 전달하는 안입니다. ${personalizedReason||'시청자의 상황·선택·다음 행동은 아직 작성해야 합니다.'} ${angle.reward}을 함께 설계합니다.`,
      storyBeats:applyContext(angle.flow.map((key,index)=>({time:series.timing[index]||`전개 ${index+1}`,...beatFor(key,context)})),input,angle),
      takeaway:note(input.takeaway,'이번 편을 보고 이해하거나 직접 해볼 한 가지'),
      entertainment:input.entertainment?`입력한 재미 구상: ${input.entertainment}\n장면 적용 제안: ${angle.reward}`:`장면 적용 제안: ${angle.reward}. 실제 주제에 맞는 장면과 해소를 작성해 주세요.`,
      materials:[...series.materials],factChecks:[...factChecks],referenceAdaptation:referenceAdaptation(input,angle)};
  });
  const checklist=[
    {id:'audience',label:'누가 왜 볼지',status:input.audience?'provided':'review',detail:input.audience?`입력한 대상: ${input.audience}`:`시리즈 기본 대상에서 출발합니다: ${series.audience}`},
    {id:'information',label:'가져갈 정보',status:input.takeaway?'provided':'needs-input',detail:input.takeaway||'새로 이해할 것·판단 근거·직접 할 행동을 한 가지로 정합니다.'},
    {id:'entertainment',label:'재미와 감정적 보상',status:input.entertainment?'provided':'needs-input',detail:input.entertainment||'세 안의 보상 제안 중 소재와 맞는 장면을 선택하고 구체화합니다.'},
    {id:'experience',label:'실제 경험의 범위',status:input.experience?'provided':series.requiresExperience?'needs-input':'review',detail:input.experience?'경험 원문이 입력되었습니다. 사실 검증이나 시청자 가치 확인은 아직입니다.':series.requiresExperience?'제작 여정에는 실제 경험이 필요합니다. 없는 사건을 만들지 않습니다.':'개인 경험이 없어도 검증할 정보와 재미를 갖춘 설명 콘텐츠를 기획할 수 있습니다.'},
    {id:'evidence',label:'사실과 근거 대조',status:input.proof?'provided':'needs-input',detail:input.proof?'근거 메모가 입력되었습니다. 원문·날짜·사용 조건을 직접 대조해야 합니다.':'원문·화면·출처·날짜가 필요합니다.'},
    {id:'reference',label:'참고 구조와 원본 확인',status:'review',detail:input.reference||input.benchmark?'참고 자료를 입력했습니다. 실제 반응과 구조를 검토하고 자체 내용으로 재구성합니다.':'참고 자료 없이 회사 제작 양식에서 제안했습니다. 현재 인기나 효과를 검증한 기획이 아닙니다.'},
    {id:'personalization',label:'상황·선택·다음 행동 연결',status:Object.values(input.personalization).every(Boolean)?'review':'needs-input',detail:'도입의 시청자 상황, 본문의 선택 기준, 엔딩의 다음 행동이 이어지는지 확인합니다. 이름 삽입이나 취향 단정은 이 연결을 대신하지 않습니다.'},
    {id:'actual-preview',label:'실제 화면·재생·청취 확인',status:'review',detail:'기획 뒤 실제 크기로 읽고 보고 듣습니다. 파일 생성과 콘텐츠 가치 검토를 구분합니다.'},
    {id:'delivery',label:'자료와 다음 행동',status:'review',detail:'본문에서 약속한 정보를 실제로 제공하고, 안내한 자료와 전달 경로가 작동하는지 확인합니다.'}
  ];
  return {mode:'guided-template',seriesId:series.id,seriesName:series.name,topic:input.topic,input,ideas,
    guidance:[`이 기획은 「${series.name}」의 회사 제작 양식과 입력한 내용을 조합한 초안입니다. 실시간 조사나 생성형 모델로 사실을 검증하지 않았습니다.`,
      `형식 출발안: ${series.format}. 시간은 구성 제안이며 촬영·낭독·실제 읽는 시간에 맞춰 조정합니다.`,
      '대괄호의 작성할 내용은 제작 전에 채울 질문입니다. 입력한 경험·근거도 검토 전 자료로 구분합니다.',
      '정보와 재미를 각각 준비합니다. 직접 경험이 있는 회차는 실제 선택과 장면을 우선하고, 경험 없는 설명은 검증할 자료와 직관적인 예시로 구성합니다.',
      'SYNK의 개인화 방향은 각자의 배경·목표·선택에 맞는 다음 도움입니다. 본인이 밝힌 정보·관측 사실·추정을 구분하고 필요한 범위만 활용합니다. 장기 개인화 전체 시스템의 완성이나 효과를 이 기획으로 주장하지 않습니다.',
      '재미·도움·진정성·개인화는 입력만으로 통과하지 않습니다. 근거가 있어도 편집 품질과 실제 경험은 직접 검토합니다.',
      ...series.guardrails],checklist,missingQuestions,authenticity:authenticityFor(input),personalization:personalizationFor(input),reviewAxes:reviewAxesFor(input,series,missingQuestions),benchmark:input.benchmark?structuredClone(input.benchmark):null,sourcePaths:[...new Set([...catalog.sourcePaths,series.sourcePath])]};
}

const markdown=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/([\\`*_{}\[\]()#!|])/g,'\\$1').replace(/\r\n?/g,'\n');
const line=value=>markdown(value).replace(/\n/g,' / ');
const statusLabel=status=>({provided:'입력됨 · 검토 전','needs-input':'작성 필요',review:'검토 필요'})[status]||'검토 필요';
export function renderBriefMarkdown(plan){
  record(plan,'기획안');
  if(plan.mode!=='guided-template'||!Array.isArray(plan.ideas)||!Array.isArray(plan.checklist))throw new TypeError('내보낼 기획안을 확인해 주세요.');
  const lines=[`# ${line(plan.topic)} · 콘텐츠 기획안`,'',`시리즈: ${line(plan.seriesName||plan.seriesId)}`,'','회사 제작 양식 기반 초안입니다. 실시간 유행 조사·사실 검증·제작·게시 완료를 뜻하지 않습니다.','', '## 입력한 소재',''];
  for(const [key,label] of [['audience','시청자'],['experience','실제 경험'],['proof','확인할 근거'],['takeaway','가져갈 정보'],['entertainment','재미의 장면']])lines.push(`- ${label}: ${line(plan.input?.[key]||'미입력')}`);
  if(plan.input?.channelContext)lines.push(`- 담당 채널: ${line(plan.input.channelContext.displayName)} · ${line(plan.input.channelContext.platform)}`);
  if(plan.input?.editorialNote)lines.push('','## 이번 편 제작 실험','','제작자용 메모입니다. 영상의 화면·대사·시청자 행동에 자동으로 넣지 않습니다.','',markdown(plan.input.editorialNote));
  lines.push('','## 진정성 검토','',line(plan.authenticity?.summary||'경험·관점·한계·공개할 맥락은 별도로 검토해야 합니다.'),'');
  for(const item of plan.authenticity?.items||[])lines.push(`- ${line(item.label)} — ${statusLabel(item.status)}: ${line(item.detail)}`);
  lines.push('','## 개인화 방향 검토','',line(plan.personalization?.summary||'시청자의 상황·선택·다음 행동이 이어지는지 직접 검토합니다.'),'');
  for(const item of plan.personalization?.items||[])lines.push(`- ${line(item.label)} — ${statusLabel(item.status)}: ${line(item.detail)}`);
  lines.push('','## 네 가지 콘텐츠 검토 축','','입력 여부를 점수나 품질 통과로 판정하지 않습니다. 실제 읽기·재생·청취와 원문 대조로 검토하세요.');
  for(const axis of plan.reviewAxes||[]){
    lines.push('',`### ${line(axis.label)} — ${statusLabel(axis.status)}`,'',line(axis.reason),'','확인할 질문:',...(axis.questions||[]).map(value=>`- ${line(value)}`),'','입력한 근거 · 확인 전:',...(axis.evidence?.length?axis.evidence.map(value=>`- ${line(value)}`):['- 미확인 · 근거를 작성해 주세요.']),'',`다음 수정: ${line(axis.nextAction)}`);
  }
  lines.push('','## 기획 안내','',...(plan.guidance||[]).map(value=>`- ${line(value)}`));
  for(const [index,idea] of plan.ideas.entries()){
    lines.push('',`## 안 ${index+1}. ${line(idea.title)}`,'',`**첫 문장:** ${line(idea.hook)}`,'',`**관점:** ${line(idea.angle)}`,'',`**볼 이유:** ${line(idea.viewerReason)}`,'','### 전개','');
    for(const beat of idea.storyBeats||[])lines.push(`#### ${line(beat.time)}`,'',`- 화면: ${line(beat.visual)}`,`- 내레이션·문안: ${line(beat.narration)}`,'');
    lines.push('### 정보와 재미','',`- 가져갈 정보: ${line(idea.takeaway)}`,`- 재미: ${line(idea.entertainment)}`,'','### 준비할 자료','',...(idea.materials||[]).map(value=>`- ${line(value)}`),'','### 확인할 사실','',...(idea.factChecks||[]).map(value=>`- ${line(value)}`),'','### 참고 구조의 변형','',line(idea.referenceAdaptation));
  }
  lines.push('','## 작성·검토 체크리스트','');
  for(const item of plan.checklist)lines.push(`- [ ] ${line(item.label)} — ${statusLabel(item.status)}: ${line(item.detail)}`);
  if(plan.missingQuestions?.length)lines.push('','## 더 작성할 질문','',...plan.missingQuestions.map(item=>`- ${line(item.question)}`));
  const reference=plan.input?.reference;
  if(reference){
    lines.push('','## 입력한 참고 자료','',`- 제목: ${line(reference.title||'미입력')}`,`- 주소: ${line(reference.url||'미입력')}`,`- 게시일: ${line(reference.publishedAt||'미입력')}`,`- 확인일: ${line(reference.checkedAt||'미입력')}`,...referenceFields.map(([key,label])=>`- ${label}: ${line(reference[key]||'미확인')}`),'- 반응 수와 날짜는 입력 자료이며 최신·인기 여부를 자동 검증하지 않았습니다.');
    for(const [key,value] of Object.entries(reference.reactions||{}))lines.push(`- ${line(key)}: ${value===null?'미확인':line(value)}`);
  }
  if(plan.benchmark){
    const benchmark=plan.benchmark;
    lines.push('','## 회사 참고 선정 기록','',...([['title','호 제목'],['scope','선정 범위'],['periodStart','조사 기간 시작'],['periodEnd','조사 기간 끝'],['researchedAt','조사 시점'],['selectionBasis','선정 근거'],['rank','해당 호의 편집 순서']].map(([key,label])=>`- ${label}: ${line(benchmark[key]??'미확인')}`)),`- 갱신 상태: ${benchmark.stale===true?'다시 확인 필요':benchmark.stale===false?'서버에서 갱신 기한 내로 표시 · 원문 검토 필요':'미확인'}`,...referenceFields.map(([key,label])=>`- ${label}: ${line(benchmark[key]||'미확인')}`),'- 회사에서 선정한 참고 자료이며 플랫폼 전체 순위나 콘텐츠 효과의 인증이 아닙니다.');
  }
  lines.push('','## 회사 제작 원문','',...(plan.sourcePaths||[]).map(path=>`- ${line(path)}`),'');
  return lines.join('\n');
}
