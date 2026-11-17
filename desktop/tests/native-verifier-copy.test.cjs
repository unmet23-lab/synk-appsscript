'use strict';
// 공개 CI가 Windows 설치본을 실제로 켜 보는 검증(tools/verify-windows-startup-native.cjs)은 화면 글을 글자 그대로 기다린다.
// 화면 글만 바꾸면 로컬 시험은 다 통과하고 CI 실기 검증에서야 멈춘다(0.4.38, 2026-10-22). 기대 글이 지금 화면 원천에 있는지 여기서 먼저 본다.
// 기대 글을 바꿀 때는 공개 저장소 사본(synk-policy .github/desktop-preview/unified/tools/)도 같은 빌드 커밋에서 함께 고친다.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),verifier=fs.readFileSync(path.join(root,'tools/verify-windows-startup-native.cjs'),'utf8');
const renderer=fs.readdirSync(path.join(root,'renderer')).filter(name=>/\.(html|mjs)$/.test(name)).map(name=>fs.readFileSync(path.join(root,'renderer',name),'utf8')).join('\n');
function expectations(source){
  const found=new Set();
  for(const match of source.matchAll(/(?:includes|startsWith|endsWith)\(\s*'([^'\\\n]*)'|===\s*'([^'\\\n]*)'|\+\s*'([^'\\\n]*)'/g)){const text=match[1]??match[2]??match[3];if(/[가-힣]/.test(text))found.add(text);}
  return [...found];
}
test('Windows native verifier waits only for screen copy the renderer still has',()=>{
  const expected=expectations(verifier);
  assert.ok(expected.length>=8,'verifier copy expectations were not found: '+JSON.stringify(expected));
  // 검정 구 얼굴(PC 클라이언트 1단계)의 묻는 화면과 솔리오 첫 화면 글도 기다린다
  for(const text of ['새 판을 확인하고 있습니다.','브라우저에서 가입한 뒤','처음이라면 가입하기','로그인하면 구독별 남은 양이 여기에 보입니다.','지금 v',' · 시험판','최신 버전이에요.'])assert.ok(expected.includes(text),text);
  assert.deepEqual(expected.filter(text=>!renderer.includes(text)),[],'화면 글을 바꿨다면 검증 도구와 공개 CI 사본의 기대 글도 같은 판에서 맞춰 주세요');
});
test('Windows native verifier keeps the gate from opening early while it holds the first feed answer',()=>{
  // 검사기는 첫 피드 답을 시작 창 캡처 뒤에 돌려준다. 관문의 4초 먼저 열기를 그대로 두면 느린 러너에서 앱 창이 먼저 열려 거짓으로 실패한다(0.4.96 Fable F3)
  const hold=verifier.indexOf('await startupReady;'),swap=verifier.indexOf('gates.createStartupUpdateGate=options=>originalGate({...options,earlyOpenMs:');
  assert.ok(hold>0,'the verifier no longer holds the first feed answer; drop this test with that change');
  assert.ok(swap>0&&swap<verifier.indexOf("/runtime.json'"),'the startup gate must be swapped inside observe() with the updater, before src/main.cjs evaluates');
  const value=Number(/earlyOpenMs:(\d+)/.exec(verifier.slice(swap))?.[1]);
  const startupWait=Number(/'startup-renderer'(?:,(\d+))?\)/.exec(verifier)?.[1]||15000);
  assert.ok(value>startupWait+5000,'earlyOpenMs '+value+' must outlast the startup window wait '+startupWait);
  const {createStartupUpdateGate}=require('../src/platform-startup-update.cjs');
  assert.equal(typeof createStartupUpdateGate,'function');
});
test('Windows native verifier plants the face stage record when the app document is ready',()=>{
  // did-finish-load 뒤에 심으면 본체가 넘긴 드러남 시각만큼 welcome이 짧아져 느린 러너에서 놓칠 수 있었다(0.4.96 공개 후보 Fable P3)
  const at=verifier.indexOf("contents.on('dom-ready'");
  assert.ok(at>0,'the verifier no longer plants the stage record at dom-ready');
  const line=verifier.slice(at,verifier.indexOf('\n',at));
  assert.ok(line.includes('__orbSeen=[p.dataset.portalState')&&line.includes('attributeOldValue:true'),line.slice(0,200));
  // webContents.executeJavaScript는 쪽이 다 실릴 때(did-stop-loading)까지 미뤄져 dom-ready에서 불러도 일찍 심기지 않는다. 프레임에 바로 심어야 한다(0.4.96 첫 빌드 Mac 두 작업)
  assert.ok(line.includes('contents.mainFrame.executeJavaScript(')&&!/contents\.executeJavaScript\(/.test(line),line.slice(0,200));
  // 겹쳐 넘기는 길에서는 welcome이 지나간 뒤 기록으로 통과한다. 그때 판정은 지금 값이 아니라 welcome 때 적어 둔 값으로 해야 한다(0.4.96 Mac 사본 검수 P2)
  assert.ok(line.includes("window.__orbWelcome={auth:p.dataset.portalAuthStatus")&&line.includes("attributeFilter:['data-portal-state','data-portal-auth-status'"),line.slice(0,200));
  const wait=verifier.slice(verifier.lastIndexOf('await waitFor(contents,',verifier.indexOf("'orb-welcome'")),verifier.indexOf("'orb-welcome'"));
  assert.ok(wait.includes("const w=window.__orbWelcome;return (window.__orbSeen||[]).includes('welcome')&&!!w&&!w.hidden&&w.active==='true'&&w.auth==='signed-out'&&w.client==='portal'&&w.inert===true"),wait.slice(0,240));
});
test('Windows native verifier checks that the startup sentence is really hidden while checking',()=>{
  // 문장 칸의 글과 data-ui는 HTML에 처음부터 적힌 값이라 숨김 CSS가 깨져도 맞는다. 보이는 글이 빈 것까지 봐야 실제로 숨었는지 안다(0.4.96 공개 후보 Fable P2)
  const at=verifier.indexOf("check('real startup window is isolated and checking'");
  assert.ok(at>0);
  const line=verifier.slice(at,verifier.indexOf('\n',at));
  assert.ok(line.includes("state.text.trim()===''")&&line.includes("state.ui==='none'"),line.slice(0,240));
});
