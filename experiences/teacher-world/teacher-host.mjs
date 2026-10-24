// 교사 화면이 수업 자료를 주고받는 세 통로를 같은 꼴의 포트로 나눈다.
//   account-linked  「내 수업」 탭(같은 출처 부모 창)이 연 반 하나. 부모가 준 SYNKClassroomHost로만 요청하고 자격 토큰을 보지 않는다.
//   local-linked    이 기기의 WORLD 연결 서버. 교사 연결 키로 받은 bearer를 이 탭의 sessionStorage에만 둔다.
//   demo            예시 자료 서버. 쓰기에는 판과 함께 받은 미리보기 토큰(X-SYNK-Preview-Token)만 붙인다.
// 포트는 화면·선택 상태를 읽지 않는다. 요청마다 선택 세션의 lease를 받아, 쓰기를 열기 전에는 lease.ready를,
// 응답 뒤에는 lease.current()를 본다. 세대가 바뀌었으면 결과를 버리고 SESSION_CHANGED로 끝낸다.
// 공통 계약
//   request(path,payload,lease)  payload가 있으면 쓰기(POST), 없으면 읽기. 실패는 화면에 그대로 보일 문장의 Error.
//   readWorkspace(lease)         판 읽기. 연결 통로는 그 통로의 판(mode)인지 확인한다.
//   linked·signedIn              학생 공유 동의에 묶이는 통로인지, 지금 요청할 자격이 있는지.
//   attached·focus·selection·announce·receive·sharingScope  부모 창과의 약속. 부모가 없는 통로는 아무것도 하지 않는다.
// 연결 종료 책임: local-linked 포트는 지금 연결의 401을 받으면 onSignedOut(안내)를 먼저 부르고 던진다.
// 세대를 올리고 화면을 비우는 일은 받은 쪽이 선택 세션에 맡긴다.

const sessionChanged=message=>Object.assign(Error(message),{code:'SESSION_CHANGED'});
const RECHECKING='연결을 다시 확인하는 중이에요. 잠시 뒤 다시 해 주세요.';
// 서버 거절 코드를 선생님께 보일 문장으로 바꾼다(이 기기 연결·예시 자료 통로). 계정 통로의 문장은 부모 쪽 수업 연결이 정한다.
const messages={OVERRIDE_REASON_REQUIRED:'추천과 다른 연습을 보내는 이유를 한 줄 적어 주세요.',AUTH_NOT_CONFIGURED:'SYNK ID 로그인이 아직 준비되지 않았어요.',FORBIDDEN:'이 학생을 볼 권한을 확인하지 못했어요. 새로고침해 주세요.',INVALID_DUE_AT:'오늘 이후의 마감일을 골라 주세요.',INVALID_DUE_DATE:'오늘 이후의 마감일을 골라 주세요.',DUPLICATE_ASSIGNMENT:'이미 같은 과제가 진행 중이에요.',ASSIGNMENT_CLOSED:'이미 제출했거나 취소한 과제라 바꿀 수 없어요.',SERVER_ERROR:'저장하지 못했어요. 잠시 뒤 다시 해 주세요.',
  AUTH_REQUIRED:'교사 연결 키를 확인하고 다시 열어 주세요.',RATE_LIMITED:'연결을 너무 자주 시도했어요. 잠시 뒤 다시 해 주세요.',LEARNING_DISABLED:'학생이 WORLD를 연결하고 학습 공유를 켜야 과제를 보내거나 관찰을 남길 수 있어요.',INVALID_INPUT:'입력한 내용을 확인해 주세요.'};
const conflicts={REVISION_CONFLICT:'그사이 기록이 바뀌었어요. 새로고침한 뒤 다시 해 주세요.',SHARING_DISABLED:'학생의 학습 공유가 바뀌어 이 과제는 고치거나 취소할 수 없어요. 다시 불러와 주세요.',LINK_REVOKED:'학생 연결이 해제됐어요.',INVALID_NAME:'학생 이름을 적어 주세요.'};
const refused=code=>Error(messages[code]||conflicts[code]||'처리하지 못했어요. 새로고침한 뒤 다시 해 주세요.');
const expectMode=mode=>data=>{if(data.mode!==mode)throw Object.assign(Error('연결된 수업을 확인하지 못했어요. 다시 불러와 주세요.'),{code:'INVALID_CLASSROOM_RESPONSE',status:403});return data;};
async function exchange(send,path,payload,headers){
  const response=await send(path,{cache:'no-store',headers,...(payload?{method:'POST',body:JSON.stringify(payload)}:{})});
  return {response,result:await response.json()};
}
const parentless={attached:()=>false,focus(){},selection:()=>null,announce(){},receive:()=>null,sharingScope:()=>null};

// 서버가 알려 준 통로. workspace.synk.im에서 직접 열면 회사 서버라 수업 통로가 아니다.
export async function readHostMode(send){
  const response=await send('/api/health',{cache:'no-store'}),health=await response.json();
  if(!response.ok)throw Error('연결 상태를 확인하지 못했어요. 새로고침해 주세요.');
  return health.app==='synk-company'?'workspace-entry':health.mode==='local-linked'?'local-linked':'demo';
}

export function createDemoHost({send}){
  let previewToken='';
  async function request(path,payload,lease){
    const {response,result}=await exchange(send,path,payload,payload?{'Content-Type':'application/json','X-SYNK-Preview-Token':previewToken}:{});
    if(!lease.current())throw sessionChanged('연결 상태가 바뀌었어요.');
    if(!response.ok||result.ok===false)throw refused(result.code);
    return result;
  }
  // 예시 서버는 판과 함께 미리보기 토큰을 준다. 쓰기에는 마지막으로 받은 그 토큰만 붙인다.
  return Object.freeze({...parentless,mode:'demo',linked:false,signedIn:false,request,readWorkspace:lease=>request('/api/workspace',undefined,lease).then(data=>{previewToken=data?._token||'';return data;})});
}

const TOKEN_KEY='synk.teacher.local-linked.session',AUTH_ROUTES=['/api/teacher/session','/api/logout'];
// storage는 sessionStorage를 돌려주는 함수다. 저장소를 막은 브라우저에서는 읽기·쓰기 모두 조용히 비운다.
export function createLinkedHost({send,storage,onSignedOut=()=>{}}){
  let token='';
  const saved={get(){try{return storage().getItem(TOKEN_KEY)||'';}catch{return '';}},set(value){try{if(value)storage().setItem(TOKEN_KEY,value);else storage().removeItem(TOKEN_KEY);}catch{}}};
  async function request(path,payload,lease){
    // 연결 키 교환과 연결 끊기는 판 확인과 상관없이 보낸다. 나머지 쓰기는 확인된 판 위에서만 열고, 응답 뒤 권한 세대까지 견준다.
    const credential=token,guardedWrite=!!payload&&!AUTH_ROUTES.includes(path);
    if(!credential&&path!=='/api/teacher/session')throw Error('교사 연결 키로 먼저 열어 주세요.');
    if(guardedWrite&&!lease.ready)throw Error(RECHECKING);
    const {response,result}=await exchange(send,path,payload,{...(credential?{Authorization:`Bearer ${credential}`}:{}),...(payload?{'Content-Type':'application/json'}:{})});
    if(!lease.current({write:guardedWrite}))throw sessionChanged('연결 상태가 바뀌었어요.');
    if(!response.ok||result.ok===false){if(response.status===401&&path!=='/api/teacher/session')onSignedOut('연결이 끊겼어요. 교사 연결 키로 다시 열어 주세요.');throw refused(result.code);}
    return result;
  }
  return Object.freeze({...parentless,mode:'local-linked',linked:true,get signedIn(){return !!token;},request,
    readWorkspace:lease=>request('/api/workspace',undefined,lease).then(expectMode('local-linked')),
    restore(){token=saved.get();},
    async exchangeKey(key,lease){const result=await request('/api/teacher/session',{key},lease);if(typeof result.token!=='string'||!result.token)throw Error('교사 연결 키를 확인하지 못했어요. 다시 넣어 주세요.');return result.token;},
    adopt(next){token=next;saved.set(token);},
    forget(){token='';saved.set('');}
  });
}

// 「내 수업」 탭이 아직 반을 열지 않았거나 확인하지 못했을 때. 요청은 늘 탭으로 돌려보낸다.
export function detachedAccountHost(){
  const request=async()=>{throw sessionChanged('「내 수업」 탭에서 다시 열어 주세요.');};
  return Object.freeze({...parentless,mode:'account-linked',linked:false,signedIn:false,request,readWorkspace:lease=>request('/api/workspace',undefined,lease)});
}

const validPermission=row=>typeof row?.id==='string'&&Number.isSafeInteger(row.revision)&&typeof row.enabled==='boolean'&&typeof row.connected==='boolean'&&typeof row.revoked==='boolean';
// frame은 이 iframe의 window, origin은 이 문서의 출처다. 같은 출처의 부모가 연 반 하나에만 붙는다.
export function connectAccountHost({frame,origin}){
  const parent=frame.parent;
  if(parent===frame||parent.location.origin!==origin||parent.SYNKClassroomHost?.mode!=='account-linked')throw Error('「내 수업」 탭에서 열어 주세요.');
  const host=parent.SYNKClassroomHost;
  // 부모가 반을 바꾸거나 닫으면 SYNKClassroomHost가 바뀐다. 그 뒤의 요청과 늦은 응답은 이 frame의 것이 아니다.
  const attached=()=>frame.parent!==frame&&frame.parent.SYNKClassroomHost===host;
  async function request(path,payload,lease){
    if(!attached())throw sessionChanged('「내 수업」 탭에서 다시 열어 주세요.');
    if(payload&&!lease.ready)throw Error(RECHECKING);
    const result=await host.request(path,payload);
    if(!lease.current({write:!!payload})||frame.parent.SYNKClassroomHost!==host)throw sessionChanged('수업 연결이 바뀌었어요.');
    return result;
  }
  return Object.freeze({mode:'account-linked',linked:true,signedIn:true,classId:host.classId,attached,request,
    readWorkspace:lease=>request('/api/workspace',undefined,lease).then(expectMode('account-linked')),
    focus(){host.focusWorkspace?.();},
    // 부모가 고른 반·학생(개요에서 누른 학생). 모르면 null이다.
    selection:()=>frame.parent.SYNKClassroomSelection,
    announce(classId,learnerId){frame.parent.postMessage({type:'synk-teacher-selected',classId,learnerId},origin);},
    // 부모 창이 같은 출처에서 보낸 것만 받는다. 학생 고르기는 부모의 현재 선택과 같을 때만 따른다.
    receive(event){
      if(event.source!==frame.parent||event.origin!==origin)return null;
      const data=event.data;
      if(data?.type==='synk-teacher-sharing')return {type:data.type,classId:data.classId,learners:data.learners};
      if(data?.type!=='synk-teacher-select')return null;
      const selection=frame.parent.SYNKClassroomSelection;
      if(!attached()||selection?.classId!==data.classId||selection?.learnerId!==data.learnerId)return null;
      return {type:data.type,classId:data.classId,learnerId:data.learnerId};
    },
    // 부모가 확인한 반 학생 모두의 공유 상태. 이 반·이 연결의 온전한 목록일 때만 돌려준다.
    sharingScope(classId,learners){return attached()&&classId===host.classId&&Array.isArray(learners)&&learners.every(validPermission)?learners:null;}
  });
}
