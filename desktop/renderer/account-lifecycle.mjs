// 계정 생명주기 registry. 계정이 바뀔 때 화면마다 할 일(초기화·그리기·초안 검사)을 런처가 하나하나 알지 않도록,
// 화면이 자기 훅을 여기에 등록하고 런처는 이 목록만 돈다. DOM을 모르는 작은 모듈이라
// desktop/tests/account-lifecycle.test.cjs가 따로 시험한다.
//
// 등록 순서가 곧 실행 순서다. 단계마다 앞에 등록한 참여자의 훅이 먼저 불린다.
// transition() 한 번은 다음 차례로 돈다.
//   1. beforeOwnerChange(change) — 사람이 바뀔 때만, 새 신원을 반영하기 전(예: 이전 사람의 이동 기록 저장)
//   2. commit()                  — 호출한 쪽이 새 신원·라이브러리를 반영
//   3. onIdentity(change)        — 신원 갱신마다(같은 사람이어도)
//   4. 계정·라이브러리·세션이 바뀌었으면 소유 세대(epoch)를 올리고 onEpoch(epoch), 이어서 onAccountChange(change)
//   5. render()                  — 신원 갱신마다
//   6. afterRender()             — 다 그린 뒤(예: 이 계정의 이동 기록·트레이 맞추기)
// hasUnsavedDrafts()는 앞에서부터 묻다가 처음 걸린 곳에서 멈춘다(검사가 화면의 입력을 초안으로 옮기기도 해서다).
// discardDrafts()는 모든 discardDraft를 차례로 시작해 Promise.allSettled 결과를 그대로 돌려준다.
const HOOKS=new Set(['beforeOwnerChange','onIdentity','onAccountChange','render','afterRender','hasUnsavedDrafts','discardDraft','flushDraft']);

export function createAccountLifecycle({onEpoch}={}){
  const participants=[];let epoch=0;
  // A hook may register or remove participants; each phase walks the list it started with.
  const withHook=hook=>participants.slice().filter(participant=>typeof participant.hooks[hook]==='function');
  const each=(hook,...args)=>{for(const participant of withHook(hook))participant.hooks[hook](...args);};
  return {
    register(name,hooks={}){
      if(typeof name!=='string'||!name)throw new TypeError('Account lifecycle participants need a name.');
      if(participants.some(participant=>participant.name===name))throw new Error('Account lifecycle participant '+name+' is already registered.');
      for(const [hook,value] of Object.entries(hooks))if(!HOOKS.has(hook)||typeof value!=='function')throw new TypeError('Unknown account lifecycle hook '+name+'.'+hook+'.');
      const participant={name,hooks:{...hooks}};participants.push(participant);
      return ()=>{const index=participants.indexOf(participant);if(index>=0)participants.splice(index,1);};
    },
    epoch:()=>epoch,
    isCurrent:value=>value===epoch,
    transition({changed=false,ownerChanged=false,commit}={}){
      const before=Object.freeze({changed:!!changed,ownerChanged:!!ownerChanged,epoch});
      if(before.ownerChanged)each('beforeOwnerChange',before);
      commit?.();
      each('onIdentity',before);
      let change=before;
      if(before.changed){epoch++;change=Object.freeze({...before,epoch});onEpoch?.(epoch);each('onAccountChange',change);}
      each('render');each('afterRender');
      return change;
    },
    render(){each('render');},
    afterRender(){each('afterRender');},
    hasUnsavedDrafts(){return withHook('hasUnsavedDrafts').some(participant=>!!participant.hooks.hasUnsavedDrafts());},
    discardDrafts(){return Promise.allSettled(withHook('discardDraft').map(participant=>participant.hooks.discardDraft()));},
    flushDrafts(){each('flushDraft');}
  };
}
