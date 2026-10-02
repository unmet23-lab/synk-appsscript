// Own the real session lifecycle independently of Three.js for failure/re-entry tests.
export function createXR({xr,renderer,onChange=()=>{},secure=true,native=false}){
  let session=null,pending=false,disposed=false;
  const emit=(status,message)=>onChange({status,message});
  async function check(){
    if(native){emit('native','PC 3D 미리보기 · VR은 지원 브라우저에서 열어 주세요.');return false;}
    if(!secure||!xr?.isSessionSupported){emit('unsupported','이 환경에서는 3D 화면으로 연습할 수 있어요.');return false;}
    try{const yes=await xr.isSessionSupported('immersive-vr');if(!disposed)emit(yes?'ready':'unsupported',yes?'VR 기기를 연결하고 시작할 수 있어요.':'VR 기기가 없어도 모든 연습을 완료할 수 있어요.');return yes;}catch{emit('unsupported','VR 지원을 확인하지 못했어요. 3D 화면을 이용해 주세요.');return false;}
  }
  async function enter(){
    if(disposed||pending||session||native||!secure||!xr?.requestSession)return false;
    pending=true;emit('starting','VR을 연결하고 있어요.');let requested;
    try{
      requested=await xr.requestSession('immersive-vr',{optionalFeatures:['local-floor']});
      if(disposed){await requested.end();return false;}
      session=requested;session.addEventListener('end',()=>{if(session===requested){session=null;emit('ready','VR을 종료했어요. 화면에서 이어서 할 수 있어요.');}},{once:true});
      await renderer.xr.setSession(session);if(disposed||session!==requested)return false;
      emit('active','컨트롤러로 판을 가리키고 선택하세요.');return true;
    }catch{if(requested){try{await requested.end();}catch{}}session=null;if(!disposed)emit('ready','VR을 시작하지 못했어요. 연결·브라우저 권한을 확인하고 다시 시도하세요.');return false;}
    finally{pending=false;}
  }
  async function exit(){if(session){try{await session.end();}catch{emit('active','VR 종료를 다시 시도하거나 기기의 종료 버튼을 사용해 주세요.');}}}
  async function dispose(){disposed=true;await exit();}
  return {check,enter,exit,dispose,get active(){return !!session;},get pending(){return pending;}};
}
