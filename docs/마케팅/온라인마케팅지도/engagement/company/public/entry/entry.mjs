import {createCompanyEntryReceiver} from '/pulse-app/entry-handoff.mjs';

const title=document.getElementById('entry-title');
const status=document.getElementById('entry-status');
const links=document.getElementById('entry-links');
const cancel=document.getElementById('entry-cancel');
const labels={'/':'Workspace 열기','/pulse-app/':'PULSE 열기'};
const errorText={
  INVALID_INPUT:'초대 정보를 확인할 수 없습니다. SYNK에서 받은 코드나 링크를 다시 확인해 주세요.',
  INVITE_REJECTED:'사용할 수 없는 초대입니다. 초대한 분에게 새 초대를 요청해 주세요.',
  RATE_LIMITED:'잠시 후 SYNK 화면에서 다시 시도해 주세요.',
  ACCOUNT_CHANGED:'계정이 바뀌어 연결을 멈췄습니다. 현재 계정으로 다시 시작해 주세요.',
  ACCOUNT_MISMATCH:'선택한 계정과 로그인된 계정이 다릅니다. 계정을 확인한 뒤 다시 시작해 주세요.',
  BUSY:'다른 초대를 확인하고 있습니다. 진행 중인 연결을 먼저 마쳐 주세요.',
  HANDOFF_TIMEOUT:'연결 시간이 지났습니다. SYNK 화면으로 돌아가 다시 시도해 주세요.',
  HANDOFF_UNAVAILABLE:'연결을 준비하지 못했습니다. SYNK 화면으로 돌아가 다시 시도해 주세요.',
  TEMPORARY_UNAVAILABLE:'지금은 초대를 확인할 수 없습니다. 잠시 후 SYNK 화면에서 다시 시도해 주세요.'
};
function showLinks(destinations){
  links.replaceChildren();
  for(const destination of destinations){
    if(!Object.hasOwn(labels,destination))continue;
    const link=document.createElement('a');link.href=destination;link.textContent=labels[destination];
    if(destination==='/'){
      link.addEventListener('click',event=>{
        if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||(link.target&&link.target.toLowerCase()!=='_self'))return;
        try{window.opener=null;}catch{}
      });
    }
    links.append(link);
  }
  links.hidden=!links.childElementCount;
}
function onState(state){
  if(['ready','bound'].includes(state.status))return;
  if(state.status==='classifying'){title.textContent='초대를 확인하고 있어요';status.textContent='확인이 끝나면 초대받은 화면으로 이동합니다.';}
  else if(state.status==='classified'){title.textContent='초대를 확인했어요';status.textContent='초대받은 화면으로 이동하고 있습니다.';cancel.hidden=true;}
  else if(state.status==='resolving'){title.textContent='연결된 공간을 확인하고 있어요';status.textContent='현재 로그인된 계정의 배정을 확인합니다.';}
  else if(state.status==='assignment'){
    cancel.hidden=true;const result=state.result;title.textContent='연결된 공간';
    if(result.status==='login_required'){
      status.textContent='연결된 공간을 확인하려면 고객 계정 로그인이 필요합니다. PULSE에서 기존 로그인으로 계속해 주세요.';showLinks(['/pulse-app/']);
    }else if(result.status==='account_mismatch'){
      status.textContent=errorText.ACCOUNT_MISMATCH;showLinks(['/','/pulse-app/']);
    }else if(result.status==='unavailable'){
      status.textContent='지금은 연결된 공간을 확인할 수 없습니다. 이용하던 공간에서 계속할 수 있습니다.';showLinks(['/','/pulse-app/']);
    }else if(result.status==='partial'){
      status.textContent='확인된 공간만 표시합니다. PULSE 배정은 지금 확인할 수 없습니다.';showLinks(result.destinations);
    }else{
      status.textContent=result.destinations.length?'이용할 공간을 선택해 주세요.':'현재 계정에 배정된 공간이 없습니다. SYNK 화면으로 돌아가 계속해 주세요.';showLinks(result.destinations);
    }
  }else if(['cancelled','disposed'].includes(state.status)){
    title.textContent='연결을 취소했어요';status.textContent='기존 로그인과 작성 중인 내용은 그대로 유지됩니다. SYNK 화면에서 다시 시작할 수 있습니다.';cancel.hidden=true;showLinks([]);
  }else if(['error','unavailable'].includes(state.status)){
    title.textContent='연결을 마치지 못했어요';status.textContent=errorText[state.code]||errorText.TEMPORARY_UNAVAILABLE;cancel.hidden=true;showLinks([]);
  }
}
const receiver=createCompanyEntryReceiver({window,role:'receiver',onState});
cancel.addEventListener('click',()=>receiver.cancel());
if(window.opener||window.synkCompanyEntryHost?.version===1)void receiver.waitForFirstHandoff(15000);
else{
  title.textContent='SYNK에서 초대를 열어 주세요';status.textContent='SYNK의 공통 진입 화면에서 코드나 링크를 넣으면 이곳으로 연결됩니다.';cancel.hidden=true;showLinks(['/','/pulse-app/']);
}
