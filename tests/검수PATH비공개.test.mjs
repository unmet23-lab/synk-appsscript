import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as api from '../tools/검수묶음.mjs';
import {sha256,후보읽기,정책만들기,PATH비공개작업ID,PATH비공개원문} from '../tools/lib/검수증명.mjs';

// Synthetic policy fixtures only. These responses are not evidence of a model review.
const taskId='platform-path-private-20261028',publication='platform-path-private-publication-20261028';
const library='desktop/renderer/library.mjs',buildLibrary='.github/desktop-preview/unified/source/renderer/library.mjs';
function fixture(t,{source=library,target=buildLibrary,kind='바꿈',scope=taskId,git=false}={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-path-private-')),repo=path.join(dir,'repo'),candidate=path.join(dir,'candidate');
  t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('synk-path-private-'));fs.rmSync(dir,{recursive:true,force:true,maxRetries:5});});
  const write=(p,text)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,text);};
  write(path.join(repo,source),'export const value=1;\n');
  let base;
  if(git){
    const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(dir,'none'),GIT_AUTHOR_NAME:'test',GIT_AUTHOR_EMAIL:'test@example.invalid',GIT_COMMITTER_NAME:'test',GIT_COMMITTER_EMAIL:'test@example.invalid'};
    for(const key of Object.keys(env))if(key.startsWith('GIT_')&&!['GIT_CONFIG_NOSYSTEM','GIT_CONFIG_GLOBAL','GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL'].includes(key))delete env[key];
    const run=(...args)=>execFileSync('git',['-C',repo,'-c','core.autocrlf=false',...args],{env,encoding:'utf8',stdio:'pipe'});
    run('init','-q','-b','main');run('add','.');run('commit','-qm','fixture');base=run('rev-parse','HEAD').trim();
  }
  write(path.join(repo,source),'export const value=2;\n');
  if(kind!=='지움')write(path.join(candidate,target),'export const value=2;\n');
  write(path.join(candidate,'후보.json'),JSON.stringify({판:1,종류:'synk.im',항목:[{경로:target,종류:kind,모드:kind==='지움'?null:'100644',sha256:kind==='지움'?null:sha256(fs.readFileSync(path.join(candidate,target)))}]}));
  const record={version:2,taskId,userStatements:{...PATH비공개원문},requiredReviewers:['GPT'],finalReviewer:'GPT',allowFallback:false,
    sources:[{path:source,author:'GPT',scope:taskId,sha256:sha256(fs.readFileSync(path.join(repo,source)))}],
    candidate:{manifestSha256:후보읽기(candidate).manifestSha256,rawManifestSha256:sha256(fs.readFileSync(path.join(candidate,'후보.json'))),files:[{path:target,author:'기계생성',scope,sha256:kind==='지움'?null:sha256(fs.readFileSync(path.join(candidate,target)))}]}};
  const recordFile=path.join(dir,'authority.json'),save=()=>write(recordFile,JSON.stringify(record));save();
  const options={이름:'path-private',폴더:path.join(dir,'packet'),저장소:repo,바탕:base,끝:'작업본',종류:'화면',사용자지정:recordFile,배포후보:candidate,경로:[source]};
  const files=[{경로:source,상태:'M'}],policy=()=>정책만들기(options,files,{판:4});
  return {dir,repo,candidate,source,target,options,files,record,recordFile,save,write,policy};
}
const answer=b=>({findings:[],coverage:{reviewed:'synthetic policy test',limitations:'no model call',complete:true,missing:[]},seen:b.항목,endMarker:b.표식});
const final=i=>({reviewer:'GPT',approveDeployment:true,taskId:i.taskId,inputSha256:i.inputSha256,manifestSha256:i.manifestSha256,requiredReviewsHash:i.requiredReviewsHash,scope:i.scope,conditions:[],limitations:'synthetic fixture only',coverage:{complete:true,missing:[],reviewed:'synthetic input'},endMarker:i.endMarker});

test('PATH direct task requires independent complete GPT packets and the final sealed decision',async t=>{
  assert.equal(PATH비공개작업ID,taskId);
  assert.deepEqual(정책만들기({종류:'백엔드',작성자:'GPT'},[]).필수,['GPT','Claude']);
  assert.throws(()=>정책만들기({종류:'화면',작성자:'GPT'},[]),/Claude/);
  const f=fixture(t,{git:true}),{끝,...packetOptions}=f.options,packet=await api.준비하기(packetOptions);
  assert.equal(packet.목록.정책.판,4);assert.equal(api.검수확인(packet.폴더).통과,false);
  assert.throws(()=>api.배포판정준비(packet.폴더),/미완료/);
  for(const b of packet.목록.묶음){
    assert.throws(()=>api.검수받기(packet.폴더,'Claude',b.이름,JSON.stringify(answer(b))),/실제 GPT/);
    assert.throws(()=>api.검수받기(packet.폴더,'GPT',b.이름,JSON.stringify({...answer(b),seen:[]})),/응답 검증/);
    api.검수받기(packet.폴더,'GPT',b.이름,JSON.stringify(answer(b)));
  }
  assert.equal(api.검수확인(packet.폴더).통과,false);
  const input=api.배포판정준비(packet.폴더);assert.equal(input.taskId,taskId);
  assert.throws(()=>api.배포판정받기(packet.폴더,JSON.stringify({...final(input),approveDeployment:'true'})),/명시/);
  assert.equal(api.배포판정받기(packet.폴더,JSON.stringify(final(input))).통과,true);
  f.write(path.join(f.candidate,f.target),'export const value=3;\n');assert.equal(api.검수확인(packet.폴더).통과,false);
});

test('PATH scope requires all three exact quotes and cannot borrow or enlarge old task permissions',async t=>{
  for(const [name,mutate]of [
    ['task',r=>r.taskId='optimization-security-20261028'],['version',r=>r.version=1],
    ...['implementation','independentReview','visibilityScope'].map(key=>[key,r=>r.userStatements[key]='진행']),
    ['extra quote',r=>r.userStatements.extra='더 허용'],['reviewer',r=>r.requiredReviewers=[]],
    ['fallback',r=>r.allowFallback=true],['final',r=>r.finalReviewer='Claude'],
    ['old source scope',r=>r.sources[0].scope='optimization-security-20261028'],
    ['old candidate scope',r=>r.candidate.files[0].scope='optimization-security-20261028'],
    ['source SHA',r=>r.sources[0].sha256='0'.repeat(64)],['manifest SHA',r=>r.candidate.manifestSha256='0'.repeat(64)],
    ['raw manifest SHA',r=>r.candidate.rawManifestSha256='0'.repeat(64)],['candidate SHA',r=>r.candidate.files[0].sha256='0'.repeat(64)],
  ])await t.test(name,t=>{const f=fixture(t);mutate(f.record);f.save();assert.throws(f.policy,/사용자지정/);});
});

test('PATH permits the exact source files and four build inputs; direct PATH web and unrelated code stay outside',async t=>{
  const sources=[library,'desktop/renderer/launcher.mjs','desktop/renderer/member-home.mjs','desktop/tests/development-catalog.test.cjs','desktop/tests/path-visibility.test.mjs','tools/lib/검수증명.mjs','tests/검수PATH비공개.test.mjs'];
  for(const source of sources)await t.test(source,t=>assert.equal(fixture(t,{source}).policy().판,4));
  for(const target of ['.github/desktop-preview/unified/release-input.json',buildLibrary,'.github/desktop-preview/unified/source/renderer/launcher.mjs','.github/desktop-preview/unified/source/renderer/member-home.mjs'])await t.test(target,t=>assert.equal(fixture(t,{target}).policy().판,4));
  for(const source of ['desktop/renderer/other.mjs','desktop/src/auth.cjs','experiences/path-travel/app.mjs','tests/검수최적화지정.test.mjs','tools/검수묶음.mjs'])await t.test(source,t=>assert.throws(fixture(t,{source}).policy,/사용자지정 범위/));
  for(const target of ['path/index.html','world/world-account.bundle.mjs','.github/desktop-preview/package.json','.github/desktop-preview/unified/source/src/auth.cjs','.github/desktop-preview/unified/source/renderer/other.mjs'])await t.test(target,t=>assert.throws(fixture(t,{target}).policy,/사용자지정 범위/));
});

test('publication uses a distinct task scope and reads token kind from the sealed manifest',async t=>{
  for(const target of ['index.html','en/knowledge.json','desktop/releases/preview.json'])await t.test(target,t=>assert.equal(fixture(t,{target,scope:publication}).policy().판,4));
  for(const target of ['app.js','en/app.js'])for(const kind of ['토큰','바꿈'])await t.test(target+' '+kind,t=>{
    const f=fixture(t,{target,kind,scope:publication});
    if(kind==='토큰')assert.equal(f.policy().판,4);else{f.record.candidate.files[0].kind='토큰';f.save();assert.throws(f.policy,/사용자지정 범위/);}
  });
  const old=fixture(t,{target:'index.html',scope:'optimization-pc-publication-20261028'});assert.throws(old.policy,/사용자지정 범위/);
  const source=fixture(t,{source:'app.js'});source.record.sources[0].scope=publication;source.save();assert.throws(source.policy,/사용자지정 범위/);
  assert.throws(fixture(t,{target:'path/private.html',scope:publication}).policy,/사용자지정 범위/);
});

test('source deletion, renaming and candidate deletion remain blocked',async t=>{
  for(const change of [{상태:'D'},{상태:'R100',옛경로:'desktop/renderer/launcher.mjs'},{옛경로:'desktop/renderer/member-home.mjs'}])await t.test(JSON.stringify(change),t=>{
    const f=fixture(t);Object.assign(f.files[0],change);assert.throws(f.policy,/PATH 비공개.*삭제·이름 변경/);
  });
  assert.throws(fixture(t,{kind:'지움'}).policy,/삭제 후보/);
});
