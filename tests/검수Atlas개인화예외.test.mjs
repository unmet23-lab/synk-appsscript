import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {정책만들기, 대체순서, 다시검수자들, sha256} from '../tools/lib/검수증명.mjs';
import {후보항목들, 두판diff} from '../tools/검수묶음.mjs';
const opts={종류:'백엔드',작성자:'GPT',담당예외:'atlas-personalization-20261029',끝:'작업본'};
const source={경로:'desktop/assets/launcher/engine.js',상태:'M'};
test('긴 한국어 줄의 낱말 차이가 UTF-8을 쪼개면 원래 unified diff로 보존한다',()=>{
 const before='최종 소스와 검증한 기록을 보존했다. '+ '원래 문장을 함께 읽는다. '.repeat(70);
 const after=before.replace('최종','초기').replace('보존했다','그대로 보존했다');
 const result=두판diff(Buffer.from(before+'\n'),Buffer.from(after+'\n'),'README.md');
 assert.equal(result.글.includes('\uFFFD'),false);assert.ok(result.글.includes('초기'));assert.ok(result.글.includes('최종'));
});
function candidate(t,name='study/app.js',kind='바꿈'){
 const root=fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()),'atlas-personal-review-'));
 t.after(()=>{assert.equal(path.dirname(fs.realpathSync.native(root)),fs.realpathSync.native(os.tmpdir()));assert.ok(path.basename(root).startsWith('atlas-personal-review-'));fs.rmSync(root,{recursive:true});});
 const body=Buffer.from('module.exports={};\n'),file=path.join(root,name);
 if(kind!=='지움'){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body);}
 fs.writeFileSync(path.join(root,'후보.json'),JSON.stringify({판:1,종류:'synk.im',항목:[{경로:name,종류:kind,모드:kind==='지움'?null:'100644',sha256:kind==='지움'?null:sha256(body)}]}));
 return root;
}
test('이번 Atlas 생성물은 GPT·Claude 둘 다 필수이며 기존 정책은 유지한다',t=>{
 const p=정책만들기({...opts,배포후보:candidate(t)},[]);
 assert.deepEqual(p.필수,['GPT','Claude']);assert.equal(p.예외,null);assert.equal(대체순서(p),null);
 assert.deepEqual(다시검수자들(p,[{출처:'GPT'},{출처:'Claude'}]),['GPT','Claude']);
 assert.throws(()=>정책만들기({종류:'화면',작성자:'GPT'},[source]));
 assert.deepEqual(정책만들기({종류:'백엔드',작성자:'GPT'},[source]).필수,['GPT','Claude']);
 for(const delta of [{작성자:'Claude'},{종류:'화면'},{GPT구독:'종료'},{예외:'내부'},{페이블생략:'skip'},{담당예외:'other'}])assert.throws(()=>정책만들기({...opts,...delta},[source]));
});
test('새 화면·인증·삭제·경로 탈출은 이번 생성물 예외에 들어가지 않는다',t=>{
 for(const p of ['world/app-shell.mjs','account/style.css','supabase/functions/auth/index.ts','desktop/src/main.cjs','../desktop/assets/launcher/engine.js'])assert.throws(()=>정책만들기(opts,[{...source,경로:p}]));
 for(const p of ['world/app-shell.mjs','account/style.css'])assert.throws(()=>정책만들기({...opts,배포후보:candidate(t,p)},[]));
 assert.throws(()=>정책만들기({...opts,배포후보:candidate(t,'study/index.html','지움')},[]));
 for(const kind of ['새','바꿈'])assert.throws(()=>정책만들기({...opts,배포후보:candidate(t,'care/index.html',kind)},[]));
 for(const p of ['desktop/releases/client.js','en/llms.txt','docs/platform.md','en/docs/platform.md'])assert.throws(()=>정책만들기({...opts,배포후보:candidate(t,p)},[]));
 assert.throws(()=>정책만들기({...opts,배포후보:candidate(t,'index.html','새')},[]));
 assert.throws(()=>정책만들기(opts,[{...source,상태:'D'}]));
 assert.throws(()=>정책만들기(opts,[{경로:'desktop/renderer/generated/member-shared/chunk-ABCDEFGH.mjs',옛경로:'desktop/src/main.cjs',상태:'R100'}]));
});
test('표준 버전 메타데이터 18개와 PC 빌드 메타데이터 3개만 기존 파일 교체로 허용한다',t=>{
 const paths=['desktop/releases/preview.json','knowledge.json','en/knowledge.json','index.html','en/index.html',...['lab','shift','pulse','path','atlas','founder'].flatMap(p=>[p+'/index.html','en/'+p+'/index.html']),'llms.txt','.github/desktop-preview/package.json','.github/desktop-preview/package-lock.json','.github/desktop-preview/unified/release-input.json'];
 assert.equal(new Set(paths).size,21);
 for(const p of paths)assert.deepEqual(정책만들기({...opts,배포후보:candidate(t,p)},[]).필수,['GPT','Claude']);
});
test('PC 생성 청크의 교체만 삭제를 허용하고 웹 토큰은 정확한 후보 바이트로 묶는다',t=>{
 assert.deepEqual(정책만들기(opts,[{경로:'desktop/renderer/generated/member-shared/chunk-ABCDEFGH.mjs',상태:'D'}]).필수,['GPT','Claude']);
 const root=candidate(t,'study/index.html','토큰');assert.deepEqual(정책만들기({...opts,배포후보:root},[]).필수,['GPT','Claude']);
 fs.appendFileSync(path.join(root,'study/index.html'),'changed');assert.throws(()=>정책만들기({...opts,배포후보:root},[]),/후보 내용 불일치/);
});
test('동일 원시 본문은 한 번 읽되 모든 경로를 참조하고 변조는 거절한다',()=>{
 const body=Buffer.from('const unchanged = 1;\n'),hash=sha256(body);
 const rows=['try/racing/atlas-learning.js','try/runner/atlas-learning.js'].map(경로=>({경로,종류:'바꿈',모드:'100644',sha256:hash}));
 const items=후보항목들({항목:rows},[body,Buffer.from(body)],{동일본문참조:true});
 assert.equal(items.length,3);assert.match(items[1].몸,/const unchanged = 1/);assert.match(items[2].몸,/동일 원시 본문 참조/);assert.ok(items[2].몸.includes(hash));
 assert.throws(()=>후보항목들({항목:rows},[body,Buffer.from('other')],{동일본문참조:true}),/원시 SHA 불일치/);
});
