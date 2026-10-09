'use strict';

// beforeunload normally cancels closing. Electron only proceeds when the native
// will-prevent-unload event is prevented after an explicit leave decision.
function installDraftExitGuard({contents,window,dialog,getRecoveryAvailable=()=>false}){
  const onBlocked=event=>{
    if(window.isDestroyed())return;
    const choice=dialog.showMessageBoxSync(window,{
      type:'question',title:'작성 중인 메모',
      message:'아직 저장하지 않은 메모가 있어요.',
      detail:'돌아가서 저장하거나, 저장하지 않고 종료할 수 있어요. 이미 저장한 기록은 그대로 남습니다.'+(getRecoveryAvailable()?' 초안 복구를 켰다면 마지막 복구본은 다음 실행에서 확인할 수 있어요.':''),
      buttons:['돌아가서 저장','저장 없이 나가기'],defaultId:0,cancelId:0,noLink:true,
    });
    if(choice===1)event.preventDefault();
  };
  contents.on('will-prevent-unload',onBlocked);
  return ()=>contents.removeListener('will-prevent-unload',onBlocked);
}
module.exports={installDraftExitGuard};
