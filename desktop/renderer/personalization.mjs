import {APP_IDS,APPS} from './state.mjs';

export const PERSONAL_KEY='synk.platform.launcher.personalization.v1';
export const PLATFORM_SCOPE=Object.freeze({personId:'anonymous-local',productId:'platform',contextId:'launcher',domain:'SYNK'});
export const CONTEXTS={
  everyday:{label:'일상에서 둘러보기',goal:'explore',ids:APP_IDS},
  student:{label:'한국어를 배우는 학생',goal:'study',ids:['world','path']},
  teacher:{label:'교사·교육기관',goal:'clarity',ids:['teacher']},
  work:{label:'AI 업무 연습',goal:'work',ids:['messenger']},
  creator:{label:'콘텐츠 제작',goal:'expression',ids:['messenger','pulse']},
  customer:{label:'작품 감상·제작 의뢰',goal:'explore',ids:['pulse']},
  career:{label:'진로·다음 단계 준비',goal:'prepare',ids:['path','world']},
  partner:{label:'외부 창작·파트너 협업',goal:'expression',ids:['partners']},
  team:{label:'SYNK 사내 업무',goal:'work',ids:['messenger']},
};
const goals={world:['study'],messenger:['work','expression'],teacher:['clarity'],path:['prepare'],pulse:['explore'],partners:['expression']};
const goalLabels={explore:'새로운 공간 살펴보기',study:'한국어 학습 시작하기',clarity:'수업과 설명 준비하기',work:'업무에 활용하기',expression:'만들고 표현하기',prepare:'다음 단계 준비하기'};
const defaults={textSize:'standard',explanation:'standard',motion:'full'};
const now=()=>new Date().toISOString();

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
  if(engine){try{const raw=storage.getItem(key);if(raw)record=validate(JSON.parse(raw));}catch{error='저장된 맞춤 설정을 읽지 못했어요. 다시 설정하거나 삭제해 주세요.';}}
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
      const reason=preferred.length?`이용 가능한 앱 중 직접 고른 ‘${context.label}’ 맥락${match?'과 ‘'+goalLabels[result.values.goal]+'’ 목적':''}을 기준으로 먼저 보여 드려요.`:'현재 이 계정에 연결된 앱에서 먼저 살펴볼 공간이에요.';
      return {active:true,available:true,context:record.context,values:result.values,presentation:result.presentation,selected,order,reason,plan:result.plan,provenance:result.provenance,error:null};
    }catch{return {active:false,available:true,order:allowed,presentation:{...defaults},error:'맞춤 표시를 적용하지 못했어요. 설정을 다시 저장해 주세요.'};}
  }
  return {
    current:evaluate,
    save({context,goal,textSize,explanation,motion,consent}){
      if(!engine)throw Error('맞춤 기능을 불러오지 못했어요. 플랫폼을 다시 열어 주세요.');
      if(consent!==true)throw Error('저장과 맞춤 사용에 동의하면 적용할 수 있어요. 건너뛰어도 계정에 연결된 앱을 이용할 수 있습니다.');
      if(!Object.hasOwn(CONTEXTS,context))throw Error('사용 맥락을 골라 주세요.');
      const at=clock(),prior=record?.profile||engine.createProfile({scope:{...scope},at});
      const next={version:1,context,profile:engine.updateProfile(prior,{consent:true,values:{goal,textSize,explanation,motion}},at)};
      validate(next);
      try{storage.setItem(key,JSON.stringify(next));}catch{throw Error('이 기기에 저장하지 못했어요. 저장 공간 설정을 확인해 주세요.');}
      record=next;error=null;return evaluate();
    },
    clear(){
      try{storage.removeItem(key);}catch{throw Error('저장된 맞춤 설정을 삭제하지 못했어요. 다시 시도해 주세요.');}
      record=null;error=null;return evaluate();
    },
  };
}
