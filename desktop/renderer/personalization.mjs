import {APP_IDS,APPS} from './state.mjs';

export const PERSONAL_KEY='synk.platform.launcher.personalization.v1';
export const PLATFORM_SCOPE=Object.freeze({personId:'anonymous-local',productId:'platform',contextId:'launcher',domain:'SYNK'});
export const CONTEXTS={
  everyday:{label:'둘러보기',goal:'explore',ids:APP_IDS},
  student:{label:'한국어 공부',goal:'study',ids:['world','path']},
  teacher:{label:'수업 준비',goal:'clarity',ids:['teacher']},
  work:{label:'회사 업무',goal:'work',ids:['messenger']},
  creator:{label:'콘텐츠 만들기',goal:'expression',ids:['messenger','pulse']},
  customer:{label:'광고 제작 맡기기',goal:'explore',ids:['pulse']},
  career:{label:'면접·진로 준비',goal:'prepare',ids:['path','world']},
  partner:{label:'외부 창작자·파트너 협업',goal:'expression',ids:['pulse']},
  team:{label:'SYNK 팀 업무',goal:'work',ids:['messenger']},
};
const goals={world:['study'],messenger:['work','expression'],teacher:['clarity'],path:['prepare'],pulse:['explore','expression'],care:['prepare','expression'],fortune:['explore']};
const goalLabels={explore:'이것저것 보기',study:'한국어 공부',clarity:'수업 준비',work:'업무',expression:'만들기',prepare:'면접·진로 준비'};
const defaults={textSize:'standard',explanation:'standard',motion:'full'};
const now=()=>new Date().toISOString();

// Choosing a purpose can guide this window without writing a consented profile.
export function previewPurpose(state,context,appIds=APP_IDS){
  if(!Object.hasOwn(CONTEXTS,context))return state;
  const allowed=APP_IDS.filter(id=>appIds.includes(id));
  const order=[...new Set([...CONTEXTS[context].ids,...(state.order||[]),...allowed])].filter(id=>allowed.includes(id));
  return {...state,active:true,sessionOnly:true,context,values:{...state.values,goal:CONTEXTS[context].goal},order,selected:order[0]||null,reason:'고른 일에 맞는 앱을 이 창에서만 먼저 보여 줘요. 다음에도 이렇게 보려면 저장해 주세요.'};
}

// Local, voluntary preferences are partitioned by the verified account ID.
// They neither read product records nor determine access to an app.
export function createPlatformPersonalization(engine,storage,{clock=now,scope=PLATFORM_SCOPE,key=PERSONAL_KEY}={}){
  let record=null,error=null;
  function validate(value){
    if(!value||value.version!==1||!Object.hasOwn(CONTEXTS,value.context)||Object.keys(value).some(k=>!['version','context','profile'].includes(k)))throw Error('invalid local settings');
    engine.validateProfile(value.profile);
    if(!value.profile.consent||value.profile.status!=='active'||Object.keys(scope).some(k=>value.profile.scope[k]!==scope[k]))throw Error('foreign or unconsented profile');
    return value;
  }
  if(engine){try{const raw=storage.getItem(key);if(raw)record=validate(JSON.parse(raw));}catch{error='저장한 설정을 읽지 못했어요. 다시 고르거나 지워 주세요.';}}
  function evaluate({appIds=APP_IDS}={}){
    const allowed=APP_IDS.filter(id=>appIds.includes(id));
    if(!engine||!record)return {active:false,order:allowed,presentation:{...defaults},error,available:!!engine};
    try{
      const context=CONTEXTS[record.context];
      if(!allowed.length){const values={...record.profile.values};return {active:true,available:true,context:record.context,values,presentation:{textSize:values.textSize||defaults.textSize,explanation:values.explanation||defaults.explanation,motion:values.motion||defaults.motion},order:[],selected:null,reason:'',error:null};}
      const preferred=context.ids.filter(id=>allowed.includes(id));
      const candidates=preferred.length?preferred:allowed;
      const result=engine.selectPersonalization({profile:record.profile,scope:{...scope},experienceId:'platform-catalog',events:[],at:clock(),candidates:candidates.map(id=>({id,minutes:3,pace:'standard',goals:goals[id]}))});
      const selected=result.plan.selected?.id;
      const order=[...new Set([selected,...result.plan.alternatives,...allowed].filter(id=>allowed.includes(id)))];
      const match=selected&&goals[selected].includes(result.values.goal);
      const goal=match&&goalLabels[result.values.goal]!==context.label?' · ‘'+goalLabels[result.values.goal]+'’':'';
      const reason=preferred.length?`고른 일(‘${context.label}’${goal})에 맞춰 먼저 보여 줘요.`:'이 계정에서 쓸 수 있는 앱 가운데 먼저 볼 만한 앱이에요.';
      return {active:true,available:true,context:record.context,values:result.values,presentation:result.presentation,selected,order,reason,plan:result.plan,provenance:result.provenance,error:null};
    }catch{return {active:false,available:true,order:allowed,presentation:{...defaults},error:'앱 순서를 바꾸지 못했어요. 다시 저장해 주세요.'};}
  }
  return {
    current:evaluate,
    save({context,goal,textSize,explanation,motion,consent}){
      if(!engine)throw Error('맞춤 기능을 불러오지 못했어요. 플랫폼을 다시 열어 주세요.');
      if(consent!==true)throw Error('저장에 동의해야 적용돼요. 건너뛰어도 앱은 그대로 쓸 수 있어요.');
      if(!Object.hasOwn(CONTEXTS,context))throw Error('무엇을 하러 왔는지 골라 주세요.');
      const at=clock(),prior=record?.profile||engine.createProfile({scope:{...scope},at});
      const next={version:1,context,profile:engine.updateProfile(prior,{consent:true,values:{goal,textSize,explanation,motion}},at)};
      validate(next);
      try{storage.setItem(key,JSON.stringify(next));}catch{throw Error('이 PC에 저장하지 못했어요. 저장 공간이 부족한지 봐 주세요.');}
      record=next;error=null;return evaluate();
    },
    clear(){
      try{storage.removeItem(key);}catch{throw Error('저장한 설정을 지우지 못했어요. 다시 눌러 주세요.');}
      record=null;error=null;return evaluate();
    },
  };
}
