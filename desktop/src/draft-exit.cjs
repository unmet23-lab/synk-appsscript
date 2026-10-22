'use strict';

const MEMO_TEXT={title:'작성 중인 메모',message:'아직 저장하지 않은 메모가 있어요.',detail:'돌아가서 저장하거나, 저장하지 않고 끌 수 있어요. 이미 저장한 메모는 그대로 남아요.'};
// beforeunload normally cancels closing. Electron only proceeds when the native
// will-prevent-unload event is prevented after an explicit leave decision.
// Other windows (the PULSE customer window) pass their own wording as text.
function installDraftExitGuard({contents,window,dialog,getRecoveryAvailable=()=>false,text=MEMO_TEXT}){
  const onBlocked=event=>{
    if(window.isDestroyed())return;
    const choice=dialog.showMessageBoxSync(window,{
      type:'question',title:text.title,
      message:text.message,
      detail:text.detail+(getRecoveryAvailable()?' 「쓰던 메모 되살리기」를 켜 두었다면 다음에 열 때 되살릴 수 있어요.':''),
      buttons:['돌아가서 저장','저장 없이 나가기'],defaultId:0,cancelId:0,noLink:true,
    });
    if(choice===1)event.preventDefault();
  };
  contents.on('will-prevent-unload',onBlocked);
  return ()=>contents.removeListener('will-prevent-unload',onBlocked);
}
module.exports={installDraftExitGuard};
