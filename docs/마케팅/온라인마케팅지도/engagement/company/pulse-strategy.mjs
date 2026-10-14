const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const TEXT_FIELDS=['product','audience','situation','barrier','targetNotes','successMetric','successTarget','measurementWindow','baseline','measurementSource','primaryPromise','value1','evidence1','value2','evidence2','value3','evidence3','memoryHook','desiredAction','channelNotes','budgetNotes','mood','visualStyle','dialogue','voice','wardrobe','casting','subtitles','screenCopy','scope','rightsNotes','scheduleNotes','revisionNotes','notes'];
const ENUMS={objective:['','sales','brand','both'],distribution:['','owned','paid','mixed'],aspectRatio:['','9:16','16:9','1:1','4:5','multiple','other'],planInterest:['','basic','premium','custom']};
const CHANNELS=['instagram','youtube','facebook','tiktok','website','blog','offline','tv','other'];
const NUMBERS={durationSeconds:[1,600],budgetProduction:[0,1e12],budgetMedia:[0,1e12]};
const CASTING_ENUMS={modelId:['','M01','F01','F02','F03','M02','F04','M03'],hair:['','original','short','bob','long-straight','wave','updo','custom'],makeup:['','natural','clean','glow','smoky','custom'],jacket:['','none','blazer','casual','leather','custom'],top:['','tshirt','shirt','knit','blouse','custom'],bottom:['','trousers','denim','skirt','custom'],voice:['','A','B','C'],earrings:['','none','stud','hoop','drop','custom'],ring:['','none','simple','layered','custom']};
const CASTING_FIELDS=[...Object.keys(CASTING_ENUMS),'notes'];
const FIELDS=[...TEXT_FIELDS,...Object.keys(ENUMS),...Object.keys(NUMBERS),'channels','destinationUrl','proposedDeadline','castingSelection'];
const HISTORY_LIMIT=20;

// Use the same names the customer fills in when reporting missing or changed fields.
export const CUSTOMER_STRATEGY_LABELS={objective:'이 광고에서 가장 중요한 목적',product:'무엇을 소개하나요?',audience:'주로 누구에게 보여줄까요?',situation:'그 사람은 언제 필요를 느끼나요?',barrier:'선택을 망설이는 이유는 무엇인가요?',targetNotes:'대상에 대해 더 알려줄 내용',successMetric:'어떤 지표를 볼까요?',successTarget:'기대하는 변화·목표',measurementWindow:'언제 확인할까요?',baseline:'비교할 이전 상태',measurementSource:'어디에서 확인하나요?',primaryPromise:'기억하게 할 메시지 하나',value1:'보조 가치 1',evidence1:'이 메시지를 믿을 근거',value2:'보조 가치 2',evidence2:'이를 뒷받침할 자료 2',value3:'보조 가치 3',evidence3:'이를 뒷받침할 자료 3',memoryHook:'보고 난 뒤 무엇이 기억나면 좋을까요?',desiredAction:'시청 후 유도할 행동 하나',channels:'어디에서 보여줄 예정인가요?',channelNotes:'채널별로 필요한 점',distribution:'어떻게 노출할 예정인가요?',aspectRatio:'필요한 화면 비율',durationSeconds:'희망 영상 길이',destinationUrl:'이동할 주소',budgetProduction:'제작에 생각하는 예산',budgetMedia:'광고 노출에 생각하는 예산',budgetNotes:'예산에 관해 함께 볼 내용',planInterest:'상담하고 싶은 구성',mood:'전체 분위기',visualStyle:'색감·구도·화면의 느낌',dialogue:'등장인물이 하는 말',voice:'목소리·말하는 느낌',wardrobe:'의상·소품의 느낌',casting:'등장인물에 바라는 점',castingSelection:'모델·스타일 선택',subtitles:'말소리를 옮기는 자막',screenCopy:'별도로 강조할 화면 문구',scope:'필요한 결과물과 범위',rightsNotes:'사용처·사용 기간·권리 관련 내용',proposedDeadline:'희망 전달일',scheduleNotes:'일정에서 고려할 것',revisionNotes:'수정·확인 방식에서 상의할 것',notes:'기타·메모'};

export function emptyCastingSelection(){return Object.fromEntries(CASTING_FIELDS.map(key=>[key,'']));}
export function emptyStrategyData(){return {...Object.fromEntries(TEXT_FIELDS.map(key=>[key,''])),...Object.fromEntries(Object.keys(ENUMS).map(key=>[key,''])),...Object.fromEntries(Object.keys(NUMBERS).map(key=>[key,null])),channels:[],destinationUrl:'',proposedDeadline:'',castingSelection:emptyCastingSelection()};}
export function emptyStrategy(){return {revision:0,data:emptyStrategyData(),request:null,confirmation:null,history:[]};}
function text(value,key){if(value===undefined)return '';if(typeof value!=='string'||value.length>(key==='notes'?3000:1000)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))throw fail('제작 설계의 입력 내용과 길이를 확인해 주세요.');return value.trim();}
export function normalizeCastingSelection(input){
  if(!object(input)||Object.keys(input).some(key=>!CASTING_FIELDS.includes(key)))throw fail('모델과 스타일 선택 항목을 확인해 주세요.');
  const result=emptyCastingSelection();
  for(const [key,values]of Object.entries(CASTING_ENUMS)){const value=Object.hasOwn(input,key)?input[key]:'';if(!values.includes(value))throw fail('모델과 스타일 선택값을 확인해 주세요.');result[key]=value;}
  if(Object.hasOwn(input,'notes')&&typeof input.notes!=='string')throw fail('모델과 스타일 요청 내용을 확인해 주세요.');
  result.notes=text(input.notes,'castingNotes');
  if(result.voice&&!result.modelId)throw fail('목소리를 선택하기 전에 모델을 선택해 주세요.');
  return result;
}
export function normalizeStrategyData(input){
  if(!object(input)||Object.keys(input).some(key=>!FIELDS.includes(key)))throw fail('제작 설계 입력 항목을 확인해 주세요.');
  const result=emptyStrategyData();
  for(const key of TEXT_FIELDS)result[key]=text(input[key],key);
  for(const [key,values]of Object.entries(ENUMS)){const value=input[key]===undefined?'':input[key];if(!values.includes(value))throw fail('제작 설계의 선택 항목을 확인해 주세요.');result[key]=value;}
  for(const [key,[min,max]]of Object.entries(NUMBERS)){const value=input[key]??null;if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max))throw fail('제작 설계의 길이와 예산 범위를 확인해 주세요.');result[key]=value;}
  const channels=input.channels===undefined?[]:input.channels;if(!Array.isArray(channels)||channels.length>CHANNELS.length||new Set(channels).size!==channels.length||channels.some(value=>!CHANNELS.includes(value)))throw fail('게재할 채널을 확인해 주세요.');result.channels=[...channels];
  const destination=text(input.destinationUrl,'destinationUrl');if(destination){let parsed;try{parsed=new URL(destination);}catch{throw fail('연결할 HTTPS 주소를 입력해 주세요.');}if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw fail('연결할 HTTPS 주소를 입력해 주세요.');result.destinationUrl=parsed.href;}
  const deadline=text(input.proposedDeadline,'proposedDeadline');if(deadline&&(!/^\d{4}-\d{2}-\d{2}$/.test(deadline)||!Number.isFinite(Date.parse(deadline+'T00:00:00Z'))||new Date(deadline+'T00:00:00Z').toISOString().slice(0,10)!==deadline))throw fail('희망 일자를 확인해 주세요.');result.proposedDeadline=deadline;
  if(Object.hasOwn(input,'castingSelection'))result.castingSelection=normalizeCastingSelection(input.castingSelection);
  return result;
}

// Reading legacy rows adds a default without rewriting their existing fields.
// Unknown stored fields survive subsequent saves but never enter the public view.
export function strategyOf(value){const base=emptyStrategy();if(!object(value))return base;const data=object(value.data)?structuredClone(value.data):{};return {...structuredClone(value),revision:Number.isSafeInteger(value.revision)&&value.revision>=0?value.revision:0,data:{...base.data,...data,castingSelection:{...base.data.castingSelection,...(object(data.castingSelection)?data.castingSelection:{})}},request:value.request?structuredClone(value.request):null,confirmation:value.confirmation?structuredClone(value.confirmation):null,history:Array.isArray(value.history)?structuredClone(value.history):[]};}
function safeCastingSelection(value){
  const result=emptyCastingSelection();if(!object(value))return result;
  for(const [key,values]of Object.entries(CASTING_ENUMS))if(values.includes(value[key]))result[key]=value[key];
  if(typeof value.notes==='string'&&value.notes.length<=1000&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value.notes))result.notes=value.notes.trim();
  if(!result.modelId)result.voice='';
  return result;
}
function safeData(value){const defaults=emptyStrategyData();return Object.fromEntries(FIELDS.map(key=>[key,key==='castingSelection'?safeCastingSelection(value?.[key]):structuredClone(value?.[key]??defaults[key])]));}
function metadata(value){if(!object(value))return null;return {strategyRevision:value.strategyRevision,author:value.author,authorName:value.authorName,at:value.at};}
function snapshot(value){return {revision:value.revision,data:structuredClone(value.data),request:structuredClone(value.request),confirmation:structuredClone(value.confirmation),...(value.updatedAt?{updatedAt:value.updatedAt,author:value.author,authorName:value.authorName,authorId:value.authorId}:{})};}
function safeSnapshot(value){return {revision:value.revision,data:safeData(value.data),request:metadata(value.request),confirmation:metadata(value.confirmation),...(value.updatedAt?{updatedAt:value.updatedAt,author:value.author,authorName:value.authorName}:{})};}
export function strategyView(value){const strategy=strategyOf(value);return {...safeSnapshot(strategy),history:strategy.history.map(safeSnapshot)};}
export function strategyReadiness(data){
  const missing=['primaryPromise','evidence1','desiredAction'].filter(key=>typeof data?.[key]!=='string'||!data[key].trim());
  return {ready:missing.length===0,missing};
}
export function applyStrategyAction(value,input,stamp){
  const strategy=strategyOf(value),staff=stamp.author==='staff';
  if(input.action==='save_strategy'){
    if(!object(input.strategy))throw fail('제작 설계 입력 항목을 확인해 주세요.');
    const data={...structuredClone(strategy.data),...normalizeStrategyData({...safeData(strategy.data),...input.strategy})};
    if(!Object.hasOwn(input.strategy,'castingSelection'))data.castingSelection=structuredClone(strategy.data.castingSelection);
    if(strategy.revision>=Number.MAX_SAFE_INTEGER)throw fail('제작 설계 버전 한도에 도달했습니다.',409);
    const history=strategy.revision>0?[...strategy.history,snapshot(strategy)].slice(-HISTORY_LIMIT):strategy.history.slice(-HISTORY_LIMIT);
    return {...strategy,revision:strategy.revision+1,data,request:null,confirmation:null,history,updatedAt:stamp.at,author:stamp.author,authorName:stamp.authorName,authorId:stamp.authorId};
  }
  if(input.action==='request_strategy_review'){
    if(!staff)throw fail('제작 담당자만 설계 확인을 요청할 수 있습니다.',403);
    if(!strategy.revision||!strategyReadiness(strategy.data).ready)throw fail('기억할 메시지 하나·이를 믿을 근거·시청 후 행동 하나를 먼저 정리해 주세요.',409);
    if(strategy.request?.strategyRevision===strategy.revision)throw fail('이미 이 제작 설계의 확인을 요청했습니다.',409);
    return {...strategy,request:{strategyRevision:strategy.revision,...stamp},confirmation:null};
  }
  if(input.action==='confirm_strategy'){
    if(staff)throw fail('제작 설계 확인은 고객 화면에서만 기록합니다.',403);
    if(!Number.isSafeInteger(input.strategyRevision)||input.strategyRevision!==strategy.revision||strategy.request?.strategyRevision!==strategy.revision)throw fail('현재 요청된 제작 설계 버전을 확인해 주세요.',409);
    if(strategy.confirmation?.strategyRevision===strategy.revision)throw fail('이미 이 제작 설계를 확인했습니다.',409);
    return {...strategy,confirmation:{strategyRevision:strategy.revision,...stamp}};
  }
  throw fail('제작 설계 요청을 확인해 주세요.');
}

export function sceneStrategy(input,found,value){
  const strategy=strategyOf(value);
  if(found&&!Object.hasOwn(input,'purpose')&&!Object.hasOwn(input,'valueNumbers'))return {purpose:found.purpose??'',valueNumbers:structuredClone(found.valueNumbers??[]),strategyRevision:found.strategyRevision??0,valueLabels:structuredClone(found.valueLabels??[])};
  const purpose=input.purpose===undefined?(found?.purpose??''):input.purpose,numbers=input.valueNumbers===undefined?(found?.valueNumbers??[]):input.valueNumbers;
  if(!['','hook','value','proof','cta'].includes(purpose))throw fail('장면의 역할을 확인해 주세요.');
  if(!Array.isArray(numbers)||numbers.length>3||new Set(numbers).size!==numbers.length||numbers.some(number=>!Number.isInteger(number)||number<1||number>3))throw fail('장면에 연결할 가치 번호를 확인해 주세요.');
  const valueLabels=numbers.map(number=>{const label=strategy.data['value'+number];if(typeof label!=='string'||!label.trim())throw fail('현재 제작 설계에 작성한 가치만 장면에 연결할 수 있습니다.');return {number,text:label};});
  return {purpose,valueNumbers:[...numbers],strategyRevision:strategy.revision,valueLabels};
}
