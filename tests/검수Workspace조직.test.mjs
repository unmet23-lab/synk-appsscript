import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as api from '../tools/검수묶음.mjs';
import {sha256,정책만들기,Workspace조직작업ID,Workspace조직원문} from '../tools/lib/검수증명.mjs';

// Synthetic fixtures only: these responses are never model-review evidence.
const taskId='workspace-organization-20261113',company='docs/마케팅/온라인마케팅지도/engagement/company/';
function fixture(t,{source=company+'member-organization.mjs',kind='백엔드',git=false}={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-workspace-review-')),repo=path.join(dir,'repo');
  t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('synk-workspace-review-'));fs.rmSync(dir,{recursive:true,force:true,maxRetries:5});});
  const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
  write(path.join(repo,source),'export const value=1;\n');
  let base;
  if(git){
    const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(dir,'none'),GIT_AUTHOR_NAME:'test',GIT_AUTHOR_EMAIL:'test@example.invalid',GIT_COMMITTER_NAME:'test',GIT_COMMITTER_EMAIL:'test@example.invalid'};
    for(const key of Object.keys(env))if(key.startsWith('GIT_')&&!['GIT_CONFIG_NOSYSTEM','GIT_CONFIG_GLOBAL','GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL'].includes(key))delete env[key];
    const run=(...args)=>execFileSync('git',['-C',repo,'-c','core.autocrlf=false',...args],{env,encoding:'utf8',stdio:'pipe'});
    run('init','-q','-b','main');run('add','.');run('commit','-qm','fixture');base=run('rev-parse','HEAD').trim();
  }
  write(path.join(repo,source),'export const value=2;\n');
  const record={version:2,taskId,userStatements:{implementationReview:'이번 작업은 GPT가 설계·구현·검토 진행'},requiredReviewers:['GPT'],finalReviewer:'GPT',allowFallback:false,
    sources:[{path:source,author:'GPT',scope:taskId,sha256:sha256(fs.readFileSync(path.join(repo,source)))}],candidate:null};
  const recordFile=path.join(dir,'authority.json'),save=()=>write(recordFile,JSON.stringify(record));save();
  const options={이름:'workspace-organization',폴더:path.join(dir,'packet'),저장소:repo,바탕:base,끝:'작업본',종류:kind,사용자지정:recordFile,경로:[source]};
  const files=[{경로:source,상태:'M'}],policy=()=>정책만들기(options,files,{판:4});
  return {dir,repo,source,options,files,record,recordFile,save,write,policy};
}
const answer=b=>({findings:[],coverage:{reviewed:'synthetic policy test',limitations:'no model call',complete:true,missing:[]},seen:b.항목,endMarker:b.표식});
const final=i=>({reviewer:'GPT',approveDeployment:true,taskId:i.taskId,inputSha256:i.inputSha256,manifestSha256:i.manifestSha256,requiredReviewsHash:i.requiredReviewsHash,scope:i.scope,conditions:[],limitations:'synthetic fixture only',coverage:{complete:true,missing:[],reviewed:'synthetic input'},endMarker:i.endMarker});

test('Workspace requires complete independent GPT packets and a final decision for the exact reviewed source',async t=>{
  assert.equal(Workspace조직작업ID,taskId);
  assert.deepEqual(Workspace조직원문,{implementationReview:'이번 작업은 GPT가 설계·구현·검토 진행'});
  assert.deepEqual(정책만들기({종류:'백엔드',작성자:'GPT'},[]).필수,['GPT','Claude']);
  assert.throws(()=>정책만들기({종류:'화면',작성자:'GPT'},[]),/Claude/);
  for(const [kind,source] of [['백엔드',company+'member-organization.mjs'],['화면',company+'public/member-organization.js']])await t.test(kind,async t=>{
    const f=fixture(t,{kind,source,git:true}),{끝,...options}=f.options,packet=await api.준비하기(options);
    assert.equal(packet.목록.정책.판,4);assert.equal(packet.목록.정책.종류,kind);
    assert.equal(api.검수확인(packet.폴더).통과,false);
    assert.throws(()=>api.배포판정준비(packet.폴더),/미완료/);
    for(const b of packet.목록.묶음){
      assert.throws(()=>api.검수받기(packet.폴더,'Claude',b.이름,JSON.stringify(answer(b))),/실제 GPT/);
      assert.throws(()=>api.검수받기(packet.폴더,'GPT',b.이름,JSON.stringify({...answer(b),seen:[]})),/응답 검증/);
      api.검수받기(packet.폴더,'GPT',b.이름,JSON.stringify(answer(b)));
    }
    assert.equal(api.검수확인(packet.폴더).통과,false);
    const input=api.배포판정준비(packet.폴더);assert.equal(input.taskId,taskId);assert.equal(input.finalReviewer,'GPT');
    assert.throws(()=>api.배포판정받기(packet.폴더,JSON.stringify({...final(input),approveDeployment:'true'})),/명시/);
    assert.throws(()=>api.배포판정받기(packet.폴더,JSON.stringify({...final(input),inputSha256:'0'.repeat(64)})),/불일치/);
    assert.equal(api.배포판정받기(packet.폴더,JSON.stringify(final(input))).통과,true);
    f.write(path.join(f.repo,f.source),'export const value=3;\n');assert.equal(api.검수확인(packet.폴더).통과,false);
  });
});

test('Workspace consent cannot borrow earlier tasks, change authors, omit reviewers or repin source',async t=>{
  for(const [name,mutate]of [
    ['task',r=>r.taskId='optimization-security-20261028'],['version',r=>r.version=1],
    ['quote',r=>r.userStatements.implementationReview='진행'],['extra quote',r=>r.userStatements.other='허용'],
    ['reviewer',r=>r.requiredReviewers=[]],['fallback',r=>r.allowFallback=true],['final',r=>r.finalReviewer='Claude'],
    ['scope',r=>r.sources[0].scope='spaghetti-followup-20261026'],['author',r=>r.sources[0].author='Claude'],
    ['source SHA',r=>r.sources[0].sha256='0'.repeat(64)],['source missing',r=>r.sources=[]],
    ['source duplicate',r=>r.sources.push({...r.sources[0]})],['candidate',r=>r.candidate={files:[]}],
  ])await t.test(name,t=>{const f=fixture(t);mutate(f.record);f.save();assert.throws(f.policy,/사용자지정/);});
});

test('Workspace admits only its exact screen and backend paths in the matching review kind',async t=>{
  const groups={
    화면:['public/member-organization.js','public/member-organization.css','public/workspace-access.js','public/app.js','public/workspace.js','public/index.html','workspace-navigation.test.mjs','qa/verify-member-organization.mjs'].map(p=>company+p),
    백엔드:[...['member-organization.mjs','organization.mjs','server.mjs','server-member-organization.test.mjs'].map(p=>company+p),'tools/lib/검수증명.mjs','tests/검수Workspace조직.test.mjs'],
  };
  for(const [kind,sources] of Object.entries(groups))for(const source of sources)await t.test(kind+' '+source,t=>{
    assert.equal(fixture(t,{source,kind}).policy().판,4);
    assert.throws(fixture(t,{source,kind:kind==='화면'?'백엔드':'화면'}).policy,/사용자지정 범위/);
  });
  for(const kind of ['화면','백엔드'])for(const source of [company+'auth.mjs',company+'public/marin-home.js',company+'public/studio.js','tools/검수묶음.mjs','tools/company-release/compose.cjs','tests/검수최적화지정.test.mjs'])await t.test(kind+' '+source,t=>assert.throws(fixture(t,{source,kind}).policy,/사용자지정 범위/));
});

test('Workspace allows additions but excludes deletion, rename, mixed exceptions and publication candidates',async t=>{
  for(const status of ['A','M'])await t.test(status,t=>{const f=fixture(t);f.files[0].상태=status;assert.equal(f.policy().판,4);});
  for(const change of [{상태:'D'},{상태:'R100',옛경로:company+'assistant-service.mjs'},{상태:'T'},{상태:'??'},{옛경로:company+'assistant-service.mjs'}])await t.test(JSON.stringify(change),t=>{const f=fixture(t);Object.assign(f.files[0],change);assert.throws(f.policy,/Workspace.*삭제·이름 변경/);});
  for(const options of [{예외:'내부'},{페이블생략:'이번 승인'},{GPT구독:'종료'},{끝:'HEAD'}])await t.test(JSON.stringify(options),t=>{const f=fixture(t);Object.assign(f.options,options);assert.throws(f.policy,/사용자지정/);});
  const f=fixture(t,{kind:'화면',source:company+'public/member-organization.js'}),candidate=path.join(f.dir,'candidate');
  f.write(path.join(candidate,f.source),'export const value=2;\n');
  f.write(path.join(candidate,'후보.json'),JSON.stringify({판:1,종류:'synk.im',항목:[{경로:f.source,종류:'바꿈',모드:'100644',sha256:sha256(fs.readFileSync(path.join(candidate,f.source)))}]}));
  f.options.배포후보=candidate;assert.throws(f.policy,/Workspace.*배포 후보/);
});
