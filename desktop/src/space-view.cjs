'use strict';
const {EventEmitter}=require('node:events');

// 공간(PULSE, Workspace)의 화면을 플랫폼 창 안의 WebContentsView로 붙이는 자리다(검정 구 3단계 구현 설계 2.2 · 3절, 4단계 구현 설계 3.1).
// 관리자(pulse-app.cjs, workspace-app.cjs)는 여기서 만든 「겉」을 예전 창처럼 쓴다. 본체는 공간마다 자리를 하나씩 만든다.
// - 보이기는 화면이 place({visible, top})로 정한다. 겉의 show()와 focus()는 플랫폼 창만 앞으로 부른다.
// - 뷰는 창이 닫혀도, 앱이 끝나도 beforeunload를 돌지 않는다(11-20 Electron 44.5.1 시험). 그래서 창이 정말 닫히기 전에
//   closeForExit()로 그 공간을 먼저 닫으며 쓰던 글을 묻는다(installCloseGate). 자리가 둘이면 문도 둘이고 차례로 묻는다.
const BAND_MAX=160;
const EXIT_ANSWER_MS=20000;

// 꼭 {visible, top} 두 칸이고, visible은 참·거짓, top은 0~160의 띠 높이(CSS px)다. 다른 꼴은 null.
function pulseViewPlacement(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||Object.getPrototypeOf(input)!==Object.prototype)return null;
  const keys=Reflect.ownKeys(input);if(keys.length!==2||!keys.includes('visible')||!keys.includes('top'))return null;
  const visible=Object.getOwnPropertyDescriptor(input,'visible'),top=Object.getOwnPropertyDescriptor(input,'top');
  if(!('value' in visible)||!('value' in top)||typeof visible.value!=='boolean'||typeof top.value!=='number'||!Number.isFinite(top.value)||top.value<0||top.value>BAND_MAX)return null;
  return {visible:visible.value,top:top.value};
}
// 꾸밈 키 없이 누른 F6만 띠로 가는 키다
function bandKey(input){return !!input&&input.type==='keyDown'&&input.key==='F6'&&!input.control&&!input.alt&&!input.shift&&!input.meta&&!input.isAutoRepeat;}

// onHidden은 본체가 스스로 뷰를 숨겼을 때 화면에 알린다. 화면은 보낸 값을 잊고 다시 보낸다(설계 검토 R13)
function createSpaceViewHost({WebContentsView,getWindow,onChange=()=>{},onFocusBand=()=>{},onHidden=()=>{},timers=globalThis,exitAnswerMs=EXIT_ANSWER_MS}){
  let current=null,exiting=null;
  const wanted={visible:false,top:0};
  const alive=()=>!!current&&!current.closed&&!current.contents.isDestroyed()&&!current.parent.isDestroyed();
  const state=()=>({open:alive()});
  function zoomOf(parent){try{const z=parent.webContents.getZoomFactor();return Number.isFinite(z)&&z>0?z:1;}catch{return 1;}}
  // 띠 아래를 뷰가 채운다. 보일 때 초점은 옮기지 않는다. 초점은 화면이 focusView로 정한다(Esc로 펼침을 닫으면 작은 구에 남는다, 설계 검토 R3).
  // 보임에서 숨김으로 바뀔 때 뷰에 있던 초점은 플랫폼 화면에 돌려준다
  function layout(){
    if(!alive())return;
    const {parent,view,contents}=current;
    const [width,height]=parent.getContentSize();
    const y=Math.min(height,Math.round(wanted.top*zoomOf(parent)));
    view.setBounds({x:0,y,width,height:Math.max(0,height-y)});
    if(view.getVisible()===wanted.visible)return;
    const hadFocus=!wanted.visible&&contents.isFocused();
    view.setVisible(wanted.visible);
    if(hadFocus&&!parent.webContents.isDestroyed())parent.webContents.focus();
  }
  function focusBand(){if(!alive())return;try{current.parent.webContents.focus();}catch{}onFocusBand();}
  function createSurface(options={}){
    const parent=getWindow();
    if(!parent||parent.isDestroyed())throw Error('SPACE_VIEW_NO_WINDOW');
    if(alive())throw Error('SPACE_VIEW_BUSY');
    const view=new WebContentsView({webPreferences:options.webPreferences});
    view.setBackgroundColor(options.backgroundColor||'#000000');
    view.setVisible(false);
    parent.contentView.addChildView(view);
    const contents=view.webContents,events=new EventEmitter();events.setMaxListeners(0);
    const record={parent,view,contents,closed:false,focused:false};
    const focused=()=>{record.focused=true;},blurred=()=>{record.focused=false;};
    const relayout=()=>layout();
    const parentClosed=()=>surface.destroy();
    // 플랫폼 화면이 새 문서를 싣기 시작하거나 화면 프로세스가 사라지면 숨긴다. 새로 뜬 화면이 다시 place를 보낼 때까지 PULSE는 살아 있되 보이지 않는다
    const parentNavigating=(details,_url,isInPlace,isMainFrame)=>{const main=details?.isMainFrame??isMainFrame,same=details?.isSameDocument??isInPlace;if(main===true&&same!==true)hideByMain();};
    const parentGone=()=>hideByMain();
    const input=(event,value)=>{if(bandKey(value)){event.preventDefault();focusBand();}};
    const gone=()=>surface.destroy();
    const finish=()=>{
      if(record.closed)return;record.closed=true;
      for(const name of ['resize','maximize','unmaximize','restore'])parent.removeListener(name,relayout);
      parent.removeListener('closed',parentClosed);
      try{parent.webContents.removeListener('did-start-navigation',parentNavigating);parent.webContents.removeListener('render-process-gone',parentGone);}catch{}
      try{if(!parent.isDestroyed())parent.contentView.removeChildView(view);}catch{}
      // 초점이 있던 뷰가 닫히면(계정 바뀜, 프로세스 사라짐) 초점을 플랫폼 화면에 돌려준다(설계 검토 R9)
      if(record.focused){try{if(!parent.isDestroyed()&&!parent.webContents.isDestroyed())parent.webContents.focus();}catch{}}
      if(current===record)current=null;
      events.emit('closed');
      onChange(state());
    };
    const surface={
      webContents:contents,
      isDestroyed:()=>record.closed||contents.isDestroyed(),
      // 묻지 않고 닫는다. 계정이 바뀔 때 관리자가 부른다(예전 창의 destroy와 같다)
      destroy(){if(record.closed)return;try{if(!contents.isDestroyed())contents.close();}catch{}finish();},
      once(name,listener){events.once(name,listener);return surface;},
      on(name,listener){events.on(name,listener);return surface;},
      removeListener(name,listener){events.removeListener(name,listener);return surface;},
      loadURL:(url,loadOptions)=>contents.loadURL(url,loadOptions),
      // 플랫폼 창만 앞으로 부른다. 뷰를 보일지는 화면이 정한다
      show(){if(parent.isDestroyed())return;if(parent.isMinimized())parent.restore();if(!parent.isVisible())parent.show();},
      focus(){if(!parent.isDestroyed())parent.focus();},
      isMinimized:()=>!parent.isDestroyed()&&parent.isMinimized(),
      restore(){if(!parent.isDestroyed())parent.restore();},
      dialogParent:()=>parent,
    };
    for(const name of ['resize','maximize','unmaximize','restore'])parent.on(name,relayout);
    parent.once('closed',parentClosed);
    parent.webContents.on('did-start-navigation',parentNavigating);parent.webContents.on('render-process-gone',parentGone);
    contents.on('before-input-event',input);
    contents.on('focus',focused);contents.on('blur',blurred);
    contents.once('destroyed',finish);
    contents.on('render-process-gone',gone);
    current=record;
    layout();
    onChange(state());
    return surface;
  }
  function place(input){
    const value=pulseViewPlacement(input);
    if(!value)return {ok:false,code:'INVALID_INPUT'};
    wanted.visible=value.visible;wanted.top=value.top;
    layout();
    return {ok:true,...state()};
  }
  function hide(){wanted.visible=false;layout();}
  function hideByMain(){const was=wanted.visible;hide();if(was)onHidden();}
  function focusView(){if(!alive()||!current.view.getVisible())return {ok:false,code:'SPACE_VIEW_HIDDEN'};current.contents.focus();return {ok:true};}
  // 뷰가 지금 보이는지. 화면 공유는 보이는 Workspace 뷰에서만 청할 수 있다(4단계 구현 설계 4.2)
  function visible(){if(!alive())return false;try{return current.view.getVisible()===true;}catch{return false;}}
  function busy(){if(!alive())return false;try{return current.contents.isCurrentlyAudible()||current.contents.isBeingCaptured();}catch{return false;}}
  // 창이 정말 닫히기 전에 그 공간을 먼저 닫는다. 쓰던 글이 있으면 관리자의 쓰던 글 확인이 묻는다.
  // 'none' 겉 없음, 'closed' 닫힘(쓰던 글 없음이거나 「저장 없이 나가기」), 'kept' 「돌아가서 저장」이나 답이 없음.
  // 답이 없으면 닫지 않는다. 쓰던 글을 잃는 쪽보다 끝내기를 다시 누르게 하는 쪽을 고른다
  function closeForExit(){
    if(!alive())return Promise.resolve('none');
    if(exiting)return exiting;
    const {contents}=current;
    // 약속을 먼저 걸어 둔다. 닫힘이 같은 차례에 끝나도 「닫는 중」이 남아 다음 닫기가 앞의 답을 받지 않는다
    let resolve;const asked=new Promise(r=>{resolve=r;});exiting=asked;
    {
      let timer=null,ended=false;
      const done=outcome=>{if(ended)return;ended=true;timers.clearTimeout(timer);contents.removeListener('will-prevent-unload',prevented);contents.removeListener('destroyed',destroyed);if(exiting===asked)exiting=null;resolve(outcome);};
      const destroyed=()=>done('closed');
      // 쓰던 글 확인(관리자의 installDraftExitGuard)이 먼저 달린 귀라 이 귀보다 먼저 돈다. 막았으면 나가기로 고른 것이라 닫히기를 기다린다
      // 대화상자에 답이 오면 시계를 멈춘다. 사람이 오래 생각한 뒤 「저장 없이 나가기」를 골라도 늦게 도는 시계가 「머묾」으로 끝내지 않는다(설계 검토 R4)
      const prevented=event=>{timers.clearTimeout(timer);timer=null;if(!event.defaultPrevented)done('kept');};
      contents.on('will-prevent-unload',prevented);contents.once('destroyed',destroyed);
      timer=timers.setTimeout(()=>done(alive()?'kept':'closed'),exitAnswerMs);timer?.unref?.();
      try{contents.close({waitForBeforeUnload:true});}catch{done(alive()?'kept':'closed');}
    }
    return asked;
  }
  // 플랫폼 창의 close에 다는 문(3절). 트레이(platform-tray.cjs)보다 뒤에 단다.
  // 트레이가 숨기려고 막았거나 Windows 세션이 끝나면 아무것도 하지 않는다. 창이 정말 닫히려 하고 겉이 살아 있으면 이 닫기를 막고 그 공간을 먼저 닫는다.
  // 앞 문이 이미 막았으면(defaultPrevented) 이 문은 지나간다. 앞 문이 자기 공간을 닫고 close()를 다시 부르면 이 문의 차례다
  // 닫히면 끝내던 중이면 quit()을, 아니면 창의 close()를 다시 부른다. 「돌아가서 저장」이면 onKept()를 부른다
  function installCloseGate(parent,{quitting,quit,onKept=()=>{}}){
    let ending=false;
    const sessionEnd=()=>{ending=true;};
    const close=event=>{
      if(event.defaultPrevented||ending||!alive()||current.parent!==parent)return;
      event.preventDefault();
      void closeForExit().then(outcome=>{
        if(outcome==='kept'){onKept();return;}
        if(parent.isDestroyed())return;
        if(quitting())quit();else parent.close();
      });
    };
    parent.on('close',close);parent.on('session-end',sessionEnd);
    return ()=>{parent.removeListener('close',close);parent.removeListener('session-end',sessionEnd);};
  }
  // 띠의 닫기 글(「PULSE 닫기」, 「Workspace 닫기」, 3단계 설계 2.2 · 검토 R6): 쓰던 글이 있으면 묻고 닫는다. 'closed' · 'kept' · 'none'
  async function closeByPerson(){return {ok:true,outcome:await closeForExit()};}
  return {createSurface,place,hide,relayout:layout,focusView,visible,state,busy,hasSurface:alive,closeForExit,closeByPerson,installCloseGate};
}

module.exports={createSpaceViewHost,spaceViewPlacement:pulseViewPlacement,SPACE_VIEW_BAND_MAX:BAND_MAX,pulseViewPlacement};
