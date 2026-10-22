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
  for(const text of ['SYNK Platform 업데이트','브라우저에서 가입한 뒤','지금 v',' · 시험판','최신 버전이에요.'])assert.ok(expected.includes(text),text);
  assert.deepEqual(expected.filter(text=>!renderer.includes(text)),[],'화면 글을 바꿨다면 검증 도구와 공개 CI 사본의 기대 글도 같은 판에서 맞춰 주세요');
});
