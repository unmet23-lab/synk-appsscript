'use strict';
// 시작 창에서 앱 창으로 넘길 때, 시작 창이 하나뿐인 창이면 앱 창을 먼저 만들어야 한다.
// 시작 창을 먼저 없애면 「모든 창이 닫힘」이 app.quit()를 불러 앱이 켜지자마자 멈췄다. 확인이 시작 창이 보이기 전에 끝나는 실행
// (빠른 인터넷, 공개 CI의 Windows 검사기)이 이 길을 탄다(0.4.96 대역 빌드 검사에서 찾음).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function handoffSource(){
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8').replace(/\r\n/g,'\n');
  const found=main.match(/function handoffToMain\(\{waitedForStart=false\}=\{\}\)\{[\s\S]*?\n\}\n/);
  assert.ok(found,'handoffToMain is no longer where this test reads it');
  return found[0];
}
function run({visible=false,kind='first',reduced=false,mainReady=false}={}){
  const open=new Set(['startup']),events=[];
  const closeWindow=name=>{open.delete(name);events.push('close '+name);if(open.size===0)events.push('all-closed');};
  const startupWindow={isVisible:()=>visible,bounds:()=>({x:0,y:0,width:1440,height:940,maximized:false}),whenShown:()=>new Promise(()=>{}),dispose:()=>closeWindow('startup')};
  const context={
    orbBoot:{kind,startedAt:Date.now()},startupWindow,window:null,mainWindowReady:mainReady,startupHandoff:null,startupAllowed:false,ARRIVE_SCENE_MS:1800,
    prefersReducedMotion:()=>reduced,
    showPlatformMain:()=>{open.add('main');events.push('main');},
    setTimeout:(fn,ms)=>{events.push('timer '+ms);return 0;},Promise,Date,
  };
  vm.createContext(context);vm.runInContext(handoffSource(),context);
  context.handoffToMain();
  return {events,context};
}
test('a startup window that never became visible is closed only after the app window exists',()=>{
  for(const kind of ['first','back']){
    const {events,context}=run({kind});
    assert.deepEqual(events,['main','close startup'],kind);
    assert.equal(context.startupWindow,null,kind);
    assert.equal(context.startupAllowed,true,kind);
  }
  // 움직임 줄이기에서는 도착 장면을 기다리지 않고 같은 길로 간다
  const reduced=run({kind:'arrive',reduced:true});
  assert.deepEqual(reduced.events,['main','close startup']);
  assert.ok(!reduced.events.includes('all-closed'));
});
test('the arrival scene waits for the startup window, then still opens the app window before closing it',()=>{
  const {events,context}=run({kind:'arrive'});
  // 시작 창이 보이기를 기다리는 동안(3초까지)은 아무 창도 없애지 않는다
  assert.deepEqual(events,['timer 3000']);
  context.handoffToMain({waitedForStart:true});
  assert.deepEqual(events,['timer 3000','main','close startup']);
});
test('a visible startup window stays until the app window takes over',()=>{
  const {events,context}=run({visible:true});
  assert.deepEqual(events,['main']);
  assert.equal(context.startupHandoff?.done,false);
  assert.ok(context.startupWindow,'the startup window is closed later by finishHandoff');
});
