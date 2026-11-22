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

// `app.on(` 뒤 여는 괄호부터 짝이 맞는 닫는 괄호까지를 돌려준다. 글자열과 주석 속 괄호는 세지 않는다(처리기가 여러 줄이어도 본다, GPT pc-second-launch GA1)
function callArgs(text,open){
  let depth=0;
  for(let i=open;i<text.length;i++){
    const c=text[i];
    if(c==="'"||c==='"'||c==='`'){for(i++;i<text.length&&text[i]!==c;i++)if(text[i]==='\\')i++;continue;}
    if(c==='/'&&text[i+1]==='/'){i=text.indexOf('\n',i);if(i<0)break;continue;}
    if(c==='/'&&text[i+1]==='*'){i=text.indexOf('*/',i+2)+1;if(i<=0)break;continue;}
    if(c==='('||c==='{'||c==='[')depth++;
    else if(c===')'||c==='}'||c===']'){depth--;if(depth===0)return text.slice(open+1,i);}
  }
  throw Error('unbalanced app.on( call at '+open);
}
// 잠금 줄보다 앞에서 맨 위(들여쓰기 없는 줄)에 건 끝내기 처리기만 본다. 잠금 뒤에 건 처리기는 두 번째 실행에서 걸리지 않는다
function quitBodies(text,lock){
  const bodies=[];
  for(const m of text.matchAll(/^app\.on\('(before-quit|will-quit)',/gm)){
    if(m.index>lock)continue;
    let body=callArgs(text,m.index+'app.on'.length);
    // will-quit의 업데이트 넘김 갈래(platformUpdate?.needsInstallHandoff())는 잠금 전에는 platformUpdate가 비어 돌지 않는다. 그 갈래 뒤를 본다
    if(m[1]==='will-quit'&&body.includes('needsInstallHandoff()')){const cut=body.lastIndexOf('});return;');assert.ok(cut>0,'will-quit handoff branch ends with return');body=body.slice(cut+'});return;'.length);}
    bodies.push([m[1],body]);
  }
  assert.ok(bodies.some(([kind])=>kind==='will-quit'),'will-quit handler is present before the lock');
  return bodies;
}
function lateNames(text){
  const lock=text.indexOf('else if(!app.requestSingleInstanceLock())app.quit();');assert.ok(lock>0,'single-instance lock line is present');
  const late=[];
  for(const [kind,body] of quitBodies(text,lock))for(const name of namesIn(body)){
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

// GPT pc-second-launch GA1: 한 줄짜리 처리기만 보면 같은 일을 여러 줄 블록으로 쓴 처리기를 놓친다
test('the check also reads multi-line before-quit handlers',()=>{
  const one="app.on('before-quit',()=>aiSubscriptions?.dispose());\n";
  assert.ok(source.includes(one)&&source.includes('let aiSubscriptions=null;\n'),'the aiSubscriptions quit handler and declaration are where this test expects');
  const broken=source.replace(one,"app.on('before-quit',()=>{\n  // 구독 방 정리\n  aiSubscriptions?.dispose();\n});\n").replace('let aiSubscriptions=null;\n','')+'\nlet aiSubscriptions=null;\n';
  assert.ok(lateNames(broken).includes('before-quit:aiSubscriptions(잠금 뒤에 선언)'),lateNames(broken).join(', '));
  // 잠금 뒤에 건 처리기는 두 번째 실행에서 걸리지 않으므로 따지지 않는다
  const afterLock=source+"\nlet lateThing=null;\napp.on('before-quit',()=>{lateThing?.dispose();});\n";
  assert.deepEqual(lateNames(afterLock),[]);
});
