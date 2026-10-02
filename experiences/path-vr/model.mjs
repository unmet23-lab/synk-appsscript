export const STORAGE_KEY = 'synk.path.rehearsal.v1';
export const SCOPE = Object.freeze({personId:'local-visitor',productId:'path',contextId:'campus-rehearsal',domain:'PATH'});
export const ZONES = Object.freeze([
  {id:'welcome',label:'안내 데스크',short:'도착',subtitle:'모르는 장소를 확인하기',minutes:3,color:0xe2ba63,goals:['prepare','study'],pace:'short',position:[-6,0,0],
    steps:[
      {prompt:'첫 수업을 찾고 있어요. 안내문에는 “첫 만남 · 2층 204호 · 오후 2시”라고 적혀 있어요. 먼저 무엇을 확인할까요?',hint:'장소와 시간을 함께 확인하면 이동 전에 혼란을 줄일 수 있어요.',choices:['“204호가 어디인가요? 오후 2시 수업이 맞나요?”','“수업이 있나요?”','아무 교실에 들어가서 기다린다'],best:0,check:'교실 위치와 시작 시간을 함께 확인했어요.',retry:'다음에는 장소와 시간을 함께 넣어 질문해 보세요.'},
      {prompt:'직원이 “계단 옆 엘리베이터로 2층에 가세요”라고 말했어요. 아직 길이 헷갈려요.',hint:'이해하지 못한 부분을 구체적으로 다시 물어도 괜찮아요.',choices:['아는 척하고 출발한다','“계단 옆 엘리베이터가 저쪽인가요?”','수업을 포기한다'],best:1,check:'확실하지 않은 방향을 다시 확인했어요.',retry:'헷갈리는 방향을 한 번 더 확인하는 연습이 필요해요.'}]},
  {id:'seminar',label:'수업 준비실',short:'수업',subtitle:'도움을 요청하고 일정 정하기',minutes:6,color:0x8dafa0,goals:['study','clarity'],pace:'standard',position:[0,0,-6],
    steps:[
      {prompt:'첫 모임에서 자기소개를 부탁받았어요. 지금 연습에 알맞은 시작을 골라 보세요.',hint:'이름은 가명을 써도 돼요. 관심 있는 것과 배우고 싶은 것을 간단히 연결해 보세요.',choices:['개인 연락처부터 모두 말한다','“저는 가온이에요. 한국 문화를 배우고 싶어요.”','아무 말 없이 자리를 떠난다'],best:1,check:'공개해도 되는 소개와 학습 목적을 연결했어요.',retry:'가명과 배우고 싶은 것 한 가지로 소개를 시작해 보세요.'},
      {prompt:'모임 준비물은 “노트 한 권”, 다음 모임은 “목요일 오전 10시”예요. 친구에게 어떻게 확인할까요?',hint:'준비물·요일·시간 중 빠진 것이 없는지 확인해 보세요.',choices:['“다음에 보면 되죠?”','“준비물이 많이 필요하죠?”','“목요일 오전 10시에 노트 한 권을 가져오면 되나요?”'],best:2,check:'다음 일정과 준비물을 구체적으로 확인했어요.',retry:'요일·시간·준비물을 함께 확인하는 문장을 연습해 보세요.'}]},
  {id:'career',label:'진로 상담실',short:'진로',subtitle:'막연한 관심을 질문으로 바꾸기',minutes:6,color:0x7594c6,goals:['work','prepare'],pace:'standard',position:[6,0,0],
    steps:[
      {prompt:'가상의 진로 상담이에요. 아직 하고 싶은 일이 분명하지 않아요. 어떤 말로 시작할까요?',hint:'모른다는 사실도 출발점이에요. 해 보고 싶은 활동을 하나 말해 보세요.',choices:['“사람을 돕는 활동을 좋아해요. 어떤 경험부터 해 보면 좋을까요?”','“무조건 취업시켜 주세요.”','준비되지 않았으니 질문하지 않는다'],best:0,check:'관심 있는 활동을 구체적인 상담 질문으로 바꿨어요.',retry:'관심 있는 활동 하나와 궁금한 점 하나를 연결해 보세요.'},
      {prompt:'상담사가 다음 만남 전 “관심 직무 하나를 골라 필요한 경험을 찾아보자”고 제안했어요. 어떤 다음 행동이 좋을까요?',hint:'지금 할 수 있는 작은 행동과 확인할 대상을 정해 보세요.',choices:['정보를 확인하지 않고 지원한다','“관심 직무의 실제 채용 공고 하나를 찾아 필요한 경험을 적어 올게요.”','모든 직업을 한 번에 조사한다'],best:1,check:'실제 자료를 확인하는 작은 다음 행동을 정했어요.',retry:'확인할 자료 하나와 적어 볼 항목을 정해 보세요.'}]}
]);
export const DEFAULT_PREFS=Object.freeze({goal:'study',minutes:6,support:'step'});
export const initialCursor=()=>({step:0,choice:null,helped:false,showResults:false});
export const initialState=()=>({version:1,consent:false,prefsConfirmed:false,prefs:{...DEFAULT_PREFS},zone:'welcome',cursor:initialCursor(),answers:[]});
const validPrefs=p=>p&&Object.keys(p).length===3&&['study','work','prepare'].includes(p.goal)&&[3,6,12].includes(p.minutes)&&['step','independent'].includes(p.support);
export function validateState(value){
  if(!value||Object.keys(value).some(k=>!['version','consent','prefsConfirmed','prefs','zone','cursor','answers'].includes(k))||value.version!==1||value.consent!==true||typeof value.prefsConfirmed!=='boolean'||!validPrefs(value.prefs)||!ZONES.some(z=>z.id===value.zone)||!Array.isArray(value.answers)||value.answers.length>60)throw Error('invalid progress');
  const c=value.cursor;if(!c||Object.keys(c).length!==4||![0,1].includes(c.step)||![null,0,1,2].includes(c.choice)||typeof c.helped!=='boolean'||typeof c.showResults!=='boolean'||(c.showResults&&(c.step!==1||c.choice===null)))throw Error('invalid cursor');
  for(const a of value.answers){const z=ZONES.find(z=>z.id===a.zone);if(!z||Object.keys(a).length!==5||!Number.isInteger(a.step)||!z.steps[a.step]||!Number.isInteger(a.choice)||!z.steps[a.step].choices[a.choice]||typeof a.helped!=='boolean'||typeof a.at!=='string'||!Number.isFinite(Date.parse(a.at)))throw Error('invalid answer');}
  return structuredClone(value);
}
export function createStore(storage){
  return {
    load(){try{const raw=storage.getItem(STORAGE_KEY);return raw?{state:validateState(JSON.parse(raw)),notice:'이 기기에 저장한 연습을 이어서 열었어요.'}:{state:initialState(),notice:''};}catch{return {state:initialState(),notice:'저장 기록을 읽지 못했어요. 이번 연습은 임시로 시작합니다. 저장을 선택하면 이전 기록을 바꿉니다.'};}},
    save(state){if(!state.consent)return {ok:true,persisted:false};try{storage.setItem(STORAGE_KEY,JSON.stringify(validateState(state)));return {ok:true,persisted:true};}catch{return {ok:false,persisted:false,message:'저장하지 못했어요. 화면을 닫으면 이번 변경이 사라질 수 있어요. 저장 공간을 확인한 뒤 다시 저장해 주세요.'};}},
    clear(){try{storage.removeItem(STORAGE_KEY);return {ok:true};}catch{return {ok:false,message:'기록을 지우지 못했어요. 브라우저 저장 공간 설정을 확인해 주세요.'};}}
  };
}
export function recommend(engine,prefs,at=new Date().toISOString()){
  if(!validPrefs(prefs))throw Error('invalid preferences');
  if(!engine)return {zone:ZONES[0],reason:'맞춤 기능을 불러오지 못해 안내 데스크부터 보여 드려요.',engine:false};
  let profile=engine.createProfile({scope:{...SCOPE},at});
  profile=engine.updateProfile(profile,{consent:true,values:{...prefs}},at);
  const result=engine.selectPersonalization({profile,scope:{...SCOPE},experienceId:'path-campus',events:[],at,candidates:ZONES.map(z=>({id:z.id,minutes:z.minutes,pace:z.pace,goals:z.goals,supports:['step','independent']}))});
  const zone=ZONES.find(z=>z.id===result.plan.selected?.id)||ZONES[0];
  return {zone,reason:`직접 고른 ${prefs.goal==='study'?'유학·학교생활':prefs.goal==='work'?'취업·진로':'첫 방문'} 목적과 ${prefs.minutes}분을 기준으로 골랐어요. ${prefs.support==='step'?'설명 힌트를 함께 볼 수 있어요.':'먼저 혼자 선택해 보세요.'}`,engine:true,policy:result.plan.version,presentation:result.presentation,plan:result.plan};
}
export function recordAnswer(state,zoneId,step,choice,helped=false,at=new Date().toISOString()){
  const zone=ZONES.find(z=>z.id===zoneId);if(!zone?.steps[step]||!Number.isInteger(choice)||!zone.steps[step].choices[choice])throw Error('invalid choice');
  return {...state,zone:zoneId,answers:[...state.answers,{zone:zoneId,step,choice,helped:!!helped,at}].slice(-60)};
}
export function results(state,zoneId){
  const zone=ZONES.find(z=>z.id===zoneId);if(!zone)throw Error('unknown zone');
  return zone.steps.map((step,i)=>{const attempts=state.answers.filter(a=>a.zone===zoneId&&a.step===i),last=attempts.at(-1);return {done:!!last,met:!!last&&last.choice===step.best,helped:last?.helped||false,attempts:attempts.length,choice:last?.choice,label:!last?'아직 연습하지 않았어요.':last.choice===step.best?step.check:step.retry,next:step.retry};});
}
