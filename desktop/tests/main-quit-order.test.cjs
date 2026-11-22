'use strict';
// 이미 켜진 앱을 한 번 더 켜면 그 실행은 main.cjs를 읽는 도중 `app.requestSingleInstanceLock()`이 거짓이라 `app.quit()`으로 끝난다.
// 창이 없으면 Electron은 before-quit과 will-quit을 그 자리에서 부른다. 그때 처리기가 아직 선언 전인 let 이름을 만지면
// 「Cannot access '…' before initialization」 창이 뜬다(`?.`로는 막지 못한다). 0.5.5 설치본에서 workspaceFollower로 실제로 났다(사무실 세션 11-22 보고).
// 그래서 끝내기 처리기가 만지는 이름은 모두 잠금 줄보다 위에서 선언되어야 한다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','src','main.cjs'),'utf8').replace(/\r\n/g,'\n');

const GLOBALS=new Set(['clearInterval','clearTimeout','event','app','require','process','Promise','void']);
// 처리기 본문에서 이 실행이 그 자리에서 읽는 이름: `X?.…`, `X.…`(app 따위 전역 제외), `if(X)`, `clearX(X)`, `X=…`
function namesIn(body){
  const names=new Set();
  for(const m of body.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)(?=\?\.|\.[A-Za-z_$])/g))names.add(m[1]);
  for(const m of body.matchAll(/\bif\(([A-Za-z_$][\w$]*)\)/g))names.add(m[1]);
  for(const m of body.matchAll(/\bclear(?:Interval|Timeout)\(([A-Za-z_$][\w$]*)\)/g))names.add(m[1]);
  for(const m of body.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)=(?!=|>)/g))names.add(m[1]);
  for(const g of GLOBALS)names.delete(g);
  return [...names];
}
// 맨 위(들여쓰기 없는 줄)의 let · const · var 선언 위치. 함수 선언은 끌어올려지므로 따지지 않는다
function declaredAt(text,name){
  const re=new RegExp('^(?:let|const|var)\\s(?:[^\\n]*?[\\s,])?'+name.replace(/\$/g,'\\$')+'(?=\\s*(?:=|,|;))','m');
  const m=re.exec(text);return m?m.index:-1;
}
const isFunction=(text,name)=>new RegExp('^(?:async\\s+)?function\\s+'+name+'\\b','m').test(text);

function quitBodies(text){
  const bodies=[];
  for(const m of text.matchAll(/^app\.on\('before-quit',([^\n]*)\);$/gm))bodies.push(['before-quit',m[1]]);
  const start=text.indexOf("app.on('will-quit',event=>{");assert.ok(start>=0,'will-quit handler is present');
  const end=text.indexOf('\n});\n',start);assert.ok(end>start,'will-quit handler ends');
  // 업데이트 넘김 갈래(platformUpdate?.needsInstallHandoff())는 잠금 전에는 platformUpdate가 비어 돌지 않는다. 그 아래 정리 줄을 본다
  const whole=text.slice(start,end),tail=whole.slice(whole.lastIndexOf('});return;\n  }')+1);
  bodies.push(['will-quit',tail]);
  return bodies;
}
function lateNames(text){
  const lock=text.indexOf('else if(!app.requestSingleInstanceLock())app.quit();');assert.ok(lock>0,'single-instance lock line is present');
  const late=[];
  for(const [kind,body] of quitBodies(text))for(const name of namesIn(body)){
    if(isFunction(text,name))continue;
    const at=declaredAt(text,name);
    if(at<0||at>lock)late.push(kind+':'+name+(at<0?'(선언 못 찾음)':'(잠금 뒤에 선언)'));
  }
  return late;
}

test('every name the quit handlers touch is declared above the single-instance lock (second launch)',()=>{
  assert.deepEqual(lateNames(source),[],'a second launch quits while main.cjs is still loading; these names would throw before initialization');
});

test('the check catches a quit-handler name declared after the lock',()=>{
  const broken=source.replace('let workspaceAuth=null,workspaceFollower=null;\n','')+'\nlet workspaceAuth=null,workspaceFollower=null;\n';
  const late=lateNames(broken);
  assert.ok(late.includes('will-quit:workspaceFollower(잠금 뒤에 선언)'),late.join(', '));
  assert.ok(late.includes('will-quit:workspaceAuth(잠금 뒤에 선언)'),late.join(', '));
});
