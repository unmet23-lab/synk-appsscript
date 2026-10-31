'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {installDraftExitGuard,WORKSPACE_EXIT_TEXT}=require('../src/draft-exit.cjs');

test('native close keeps unsaved work unless the user explicitly discards it',()=>{
  const contents=new EventEmitter(),shown=[];let choice=0,proceeded=0;
  const dispose=installDraftExitGuard({contents,window:{isDestroyed:()=>false},dialog:{showMessageBoxSync(_window,options){shown.push(options);return choice;}}});
  const event={preventDefault(){proceeded++;}};
  contents.emit('will-prevent-unload',event);
  assert.equal(proceeded,0);assert.equal(shown[0].defaultId,0);assert.equal(shown[0].cancelId,0);
  choice=1;contents.emit('will-prevent-unload',event);assert.equal(proceeded,1);
  choice=-1;contents.emit('will-prevent-unload',event);assert.equal(proceeded,1);
  dispose();contents.emit('will-prevent-unload',event);assert.equal(shown.length,3);
});

test('destroyed windows do not display a late draft prompt',()=>{
  const contents=new EventEmitter();let shown=false;
  installDraftExitGuard({contents,window:{isDestroyed:()=>true},dialog:{showMessageBoxSync(){shown=true;}}});
  contents.emit('will-prevent-unload',{preventDefault(){throw Error('Should not continue');}});
  assert.equal(shown,false);
});

test('another window passes its own wording with the same keep-first choices',()=>{
  const contents=new EventEmitter(),shown=[];
  installDraftExitGuard({contents,window:{isDestroyed:()=>false},dialog:{showMessageBoxSync(_window,value){shown.push(value);return 0;}},text:{title:'합성 제목',message:'합성 안내',detail:'합성 설명'}});
  contents.emit('will-prevent-unload',{preventDefault(){throw Error('Should not continue');}});
  assert.equal(shown[0].title,'합성 제목');assert.equal(shown[0].message,'합성 안내');assert.equal(shown[0].detail,'합성 설명');
  assert.deepEqual(shown[0].buttons,['돌아가서 저장','저장 없이 나가기']);assert.equal(shown[0].defaultId,0);assert.equal(shown[0].cancelId,0);
});

test('Workspace wording names the leave button and never offers a memo recovery it does not have',()=>{
  const contents=new EventEmitter(),shown=[];
  installDraftExitGuard({contents,window:{isDestroyed:()=>false},dialog:{showMessageBoxSync(_window,value){shown.push(value);return 0;}},getRecoveryAvailable:()=>true,text:WORKSPACE_EXIT_TEXT});
  contents.emit('will-prevent-unload',{preventDefault(){throw Error('Should not continue');}});
  assert.equal(shown[0].title,'SYNK Workspace');assert.equal(shown[0].message,'아직 저장하지 않은 작업이 있어요.');
  assert.deepEqual(shown[0].buttons,['돌아가서 저장','저장하지 않고 나가기']);assert.equal(shown[0].defaultId,0);assert.equal(shown[0].cancelId,0);
  assert.doesNotMatch(shown[0].detail,/메모|되살리기/);assert.ok(Object.isFrozen(WORKSPACE_EXIT_TEXT));
});

test('exit wording preserves saved records and describes only the last opted-in recovery copy',()=>{
  const contents=new EventEmitter(),shown=[];let available=false;
  installDraftExitGuard({contents,window:{isDestroyed:()=>false},dialog:{showMessageBoxSync(_window,value){shown.push(value);return 0;}},getRecoveryAvailable:()=>available});
  contents.emit('will-prevent-unload',{preventDefault(){}});available=true;contents.emit('will-prevent-unload',{preventDefault(){}});
  assert.doesNotMatch(shown[0].detail,/복구본|버리고/);assert.match(shown[1].detail,/쓰던 메모 되살리기」를 켜 두었다면/);assert.doesNotMatch(shown[1].detail,/버리고/);
});
