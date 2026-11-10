import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as api from '../tools/검수묶음.mjs';
import {정책만들기, 후보읽기, sha256, 사이트점검단독작업ID, 사이트점검단독원문} from '../tools/lib/검수증명.mjs';

// Only synthetic fixtures. These answers never stand in for a real review.
function fixture(t,{source='site-v10/drama.js',kind='화면',candidate=false,git=false}={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-audit-self-')),repo=path.join(dir,'repo');
  t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('synk-audit-self-'));fs.rmSync(dir,{recursive:true,force:true,maxRetries:5});});
  const write=(p,b)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);};
  write(path.join(repo,source),'export const value=1;\n');
  let base;
  if(git){
    const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(dir,'none'),GIT_AUTHOR_NAME:'fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid'};
    for(const k of Object.keys(env))if(k.startsWith('GIT_')&&!['GIT_CONFIG_NOSYSTEM','GIT_CONFIG_GLOBAL','GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL'].includes(k))delete env[k];
    const run=(...a)=>execFileSync('git',['-C',repo,'-c','core.autocrlf=false','-c',`core.hooksPath=${path.join(dir,'no-hooks')}`,...a],{env,encoding:'utf8',stdio:'pipe'});
    run('init','-q','-b','main');run('add','.');run('commit','-qm','fixture');base=run('rev-parse','HEAD').trim();
  }
  write(path.join(repo,source),'export const value=2;\n');
  const authority={version:2,taskId:사이트점검단독작업ID,userStatements:{...사이트점검단독원문},requiredReviewers:['GPT'],finalReviewer:'GPT',allowFallback:false,
    sources:[{path:source,author:'GPT',scope:사이트점검단독작업ID,sha256:sha256(fs.readFileSync(path.join(repo,source)))}],candidate:null};
  const record=path.join(dir,'authority.json'),save=()=>write(record,JSON.stringify(authority));
  const options={이름:'audit-self',폴더:path.join(dir,'review'),저장소:repo,바탕:base,끝:'작업본',종류:kind,사용자지정:record,경로:[source]};
  if(candidate){
    const out=path.join(dir,'candidate');write(path.join(out,'index.html'),'<p>audited</p>\n');
    write(path.join(out,'후보.json'),JSON.stringify({판:1,종류:'synk.im',항목:[{경로:'index.html',종류:'바꿈',모드:'100644',sha256:sha256(fs.readFileSync(path.join(out,'index.html')))}]}));
    const manifest=후보읽기(out);options.배포후보=out;
    authority.candidate={manifestSha256:manifest.manifestSha256,rawManifestSha256:sha256(fs.readFileSync(path.join(out,'후보.json'))),files:manifest.항목.map(f=>({path:f.경로,author:'GPT',scope:사이트점검단독작업ID,sha256:f.sha256}))};
  }
  save();const files=[{경로:source,상태:'M'}];
  return {dir,repo,source,write,save,authority,options,files,policy:()=>정책만들기(options,files,{판:4})};
}
const answer=b=>({findings:[],coverage:{complete:true,missing:[],reviewed:'synthetic fixture input',limitations:'no model call'},seen:b.항목,endMarker:b.표식});
const final=i=>({reviewer:'GPT',approveDeployment:true,taskId:i.taskId,inputSha256:i.inputSha256,manifestSha256:i.manifestSha256,requiredReviewsHash:i.requiredReviewsHash,scope:i.scope,conditions:[],limitations:'synthetic fixture only',coverage:{complete:true,missing:[],reviewed:'synthetic complete input'},endMarker:i.endMarker});

test('직접 검수 승인도 전체 입력과 최종 후보 판정 없이는 통과하지 않는다',async t=>{
  const f=fixture(t,{candidate:true,git:true}),{끝,...o}=f.options,packet=await api.준비하기(o);
  assert.equal(packet.목록.정책.판,4);assert.deepEqual(packet.목록.정책.필수,['GPT']);
  assert.equal(api.검수확인(packet.폴더).통과,false);
  assert.throws(()=>api.배포판정준비(packet.폴더),/미완료/);
  for(const b of packet.목록.묶음){
    assert.throws(()=>api.검수받기(packet.폴더,'GPT',b.이름,JSON.stringify({...answer(b),seen:[]})),/응답 검증/);
    api.검수받기(packet.폴더,'GPT',b.이름,JSON.stringify(answer(b)));
  }
  assert.equal(api.검수확인(packet.폴더).통과,false);
  const input=api.배포판정준비(packet.폴더);assert.equal(input.taskId,사이트점검단독작업ID);
  assert.throws(()=>api.배포판정받기(packet.폴더,JSON.stringify({...final(input),inputSha256:'0'.repeat(64)})),/불일치/);
  assert.equal(api.배포판정받기(packet.폴더,JSON.stringify(final(input))).통과,true);
  f.write(path.join(f.options.배포후보,'index.html'),'<p>unreviewed</p>');assert.equal(api.검수확인(packet.폴더).통과,false);
});

test('두 사용자 원문·작성자·경로·SHA·검수자·최종 판정은 모두 정확해야 한다',t=>{
  assert.deepEqual(사이트점검단독원문,{implementation:'이번 수정은 GPT가 직접 진행',review:'너 혼자 직접 검수하고 진행해'});
  for(const mutate of [r=>r.taskId='other',r=>r.userStatements.review='진행',r=>delete r.userStatements.implementation,r=>r.userStatements.extra='yes',r=>r.requiredReviewers=[],r=>r.finalReviewer='Claude',r=>r.allowFallback=true,r=>r.sources[0].author='Claude',r=>r.sources[0].scope='site-audit-20261110',r=>r.sources[0].sha256='0'.repeat(64),r=>r.sources=[]]){
    const f=fixture(t);mutate(f.authority);f.save();assert.throws(f.policy,/사용자지정/);
  }
  const f=fixture(t);assert.equal(f.policy().판,4);f.write(path.join(f.repo,f.source),'changed');assert.throws(f.policy,/SHA/);
});

test('화면과 관문 경로를 분리하고 기존 정책과 다른 제품·삭제·이름 변경을 보존한다',t=>{
  assert.throws(()=>정책만들기({종류:'화면',작성자:'GPT'},[]),/Claude/);
  assert.deepEqual(정책만들기({종류:'백엔드',작성자:'GPT'},[]).필수,['GPT','Claude']);
  for(const source of ['tools/lib/검수증명.mjs','tools/검수묶음.mjs','tests/검수사이트점검단독.test.mjs']){
    assert.equal(fixture(t,{source,kind:'백엔드'}).policy().판,4);
    assert.throws(fixture(t,{source,kind:'화면'}).policy,/범위/);
  }
  for(const source of ['site-v10/site.js','experiences/synk-account/src/core.mjs','Code.js','tools/공개.js','supabase/migrations/remove.sql'])for(const kind of ['화면','백엔드'])assert.throws(fixture(t,{source,kind}).policy,/범위/);
  for(const change of [{상태:'D'},{상태:'R',옛경로:'site-v10/drama.css'},{상태:'C'},{상태:'T'}]){const f=fixture(t);Object.assign(f.files[0],change);assert.throws(f.policy,/사이트 점검/);}
  const empty=fixture(t,{candidate:true});empty.files.length=0;assert.throws(empty.policy,/후보 단독/);
});
