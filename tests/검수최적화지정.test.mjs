import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as api from '../tools/검수묶음.mjs';
import {sha256,후보읽기,정책만들기,최적화검수원문} from '../tools/lib/검수증명.mjs';

const taskId='optimization-security-20261028';
function fixture(t,{source='tools/build-world-account.mjs',target='world/world-account.bundle.mjs'}={}) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-opt-review-')),repo=path.join(dir,'repo'),candidate=path.join(dir,'candidate');
  t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('synk-opt-review-'));fs.rmSync(dir,{recursive:true,force:true,maxRetries:5});});
  const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
  const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(dir,'none'),GIT_AUTHOR_NAME:'test',GIT_AUTHOR_EMAIL:'test@example.invalid',GIT_COMMITTER_NAME:'test',GIT_COMMITTER_EMAIL:'test@example.invalid'};
  for(const key of Object.keys(env))if(key.startsWith('GIT_')&&!['GIT_CONFIG_NOSYSTEM','GIT_CONFIG_GLOBAL','GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL'].includes(key))delete env[key];
  write(path.join(repo,source),'export const value=1;\n');
  const git=(...args)=>execFileSync('git',['-C',repo,'-c','core.autocrlf=false',...args],{env,encoding:'utf8',stdio:'pipe'});
  git('init','-q','-b','main');git('add','.');git('commit','-qm','fixture');const base=git('rev-parse','HEAD').trim();
  write(path.join(repo,source),'export const value=2;\n');write(path.join(candidate,target),'export const value=2;\n');
  write(path.join(candidate,'후보.json'),JSON.stringify({판:1,종류:'synk.im',항목:[{경로:target,종류:'바꿈',모드:'100644',sha256:sha256(fs.readFileSync(path.join(candidate,target)))}]}));
  const record={version:2,taskId,userStatements:{...최적화검수원문},requiredReviewers:['GPT'],finalReviewer:'GPT',allowFallback:false,
    sources:[{path:source,author:'GPT',scope:taskId,sha256:sha256(fs.readFileSync(path.join(repo,source)))}],
    candidate:{manifestSha256:후보읽기(candidate).manifestSha256,rawManifestSha256:sha256(fs.readFileSync(path.join(candidate,'후보.json'))),files:[{path:target,author:'기계생성',scope:taskId,sha256:sha256(fs.readFileSync(path.join(candidate,target)))}]}};
  const recordFile=path.join(dir,'user.json');write(recordFile,JSON.stringify(record));
  return {dir,repo,candidate,target,record,recordFile,write,options:{이름:'optimization',폴더:path.join(dir,'packet'),저장소:repo,바탕:base,종류:'화면',사용자지정:recordFile,배포후보:candidate,경로:[source]}};
}
const answer=b=>({findings:[],coverage:{reviewed:'synthetic test only',limitations:'no model call',complete:true,missing:[]},seen:b.항목,endMarker:b.표식});
const final=i=>({reviewer:'GPT',approveDeployment:true,taskId:i.taskId,inputSha256:i.inputSha256,manifestSha256:i.manifestSha256,requiredReviewsHash:i.requiredReviewsHash,scope:i.scope,conditions:[],limitations:'synthetic fixture only',coverage:{complete:true,missing:[],reviewed:'synthetic input'},endMarker:i.endMarker});

test('four optimizations require exact new consent, independent packet responses and the final sealed candidate decision',async t=>{
  assert.deepEqual(정책만들기({종류:'백엔드',작성자:'GPT'},[]).필수,['GPT','Claude']);
  assert.throws(()=>정책만들기({종류:'화면',작성자:'GPT'},[]),/Claude/);
  const f=fixture(t),p=await api.준비하기(f.options);
  assert.equal(p.목록.정책.판,4);assert.equal(api.검수확인(p.폴더).통과,false);
  assert.throws(()=>api.배포판정준비(p.폴더),/미완료/);
  for(const b of p.목록.묶음){
    assert.throws(()=>api.검수받기(p.폴더,'Claude',b.이름,JSON.stringify(answer(b))),/실제 GPT/);
    assert.throws(()=>api.검수받기(p.폴더,'GPT',b.이름,JSON.stringify({...answer(b),seen:[]})),/응답 검증/);
    api.검수받기(p.폴더,'GPT',b.이름,JSON.stringify(answer(b)));
  }
  assert.equal(api.검수확인(p.폴더).통과,false);
  const input=api.배포판정준비(p.폴더);assert.equal(input.taskId,taskId);assert.equal(input.finalReviewer,'GPT');
  assert.throws(()=>api.배포판정받기(p.폴더,JSON.stringify({...final(input),approveDeployment:'true'})),/명시/);
  assert.equal(api.배포판정받기(p.폴더,JSON.stringify(final(input))).통과,true);
  f.write(path.join(f.candidate,f.target),'export const value=3;\n');assert.equal(api.검수확인(p.폴더).통과,false);
});

test('new task cannot borrow old consent, drop reviewers, widen scope or repin source after preparation',async t=>{
  for(const [name,mutate]of [
    ['task',r=>r.taskId='spaghetti-finish-20261026'],['quote',r=>r.userStatements.independentReview='진행'],
    ['reviewer',r=>r.requiredReviewers=[]],['fallback',r=>r.allowFallback=true],['final',r=>r.finalReviewer='Claude'],
    ['scope',r=>r.sources[0].scope='spaghetti-followup-20261026'],['source hash',r=>r.sources[0].sha256='0'.repeat(64)],
    ['candidate hash',r=>r.candidate.manifestSha256='0'.repeat(64)],
  ])await t.test(name,async t=>{const f=fixture(t);mutate(f.record);f.write(f.recordFile,JSON.stringify(f.record));await assert.rejects(api.준비하기(f.options),/사용자지정/);});
});

test('four-task scope excludes unrelated product code, authentication settings and unrelated public pages',async t=>{
  for(const options of [
    {source:'tools/delete-production.cjs'}, {source:'desktop/src/auth.cjs'}, {source:'atlas/memory-sync.js'},
    {target:'world/private.json'}, {target:'care/app.mjs'}, {target:'index.html'}, {target:'.github/workflows/deploy.yml'},
  ])await t.test(JSON.stringify(options),async t=>{const f=fixture(t,options);await assert.rejects(api.준비하기(f.options),/사용자지정 범위/);});
});

test('release build inputs are bounded and homepage links require their separate publication scope',async t=>{
  const build=fixture(t,{source:'tests/build-world-account.test.mjs',target:'.github/desktop-preview/unified/release-input.json'});
  assert.equal((await api.준비하기(build.options)).목록.정책.판,4);
  const publication=fixture(t,{source:'experiences/synk-account/build-manifest.json',target:'index.html'});
  publication.record.candidate.files[0].scope='optimization-pc-publication-20261028';publication.write(publication.recordFile,JSON.stringify(publication.record));
  assert.equal((await api.준비하기(publication.options)).목록.정책.판,4);
  const unrelated=fixture(t,{target:'.github/desktop-preview/unified/source/src/auth-config.cjs'});
  await assert.rejects(api.준비하기(unrelated.options),/사용자지정 범위/);
});

test('publication admits only the publisher-generated cache token edits to the two public app scripts',async t=>{
  for(const target of ['app.js','en/app.js'])for(const kind of ['토큰','바꿈'])await t.test(target+' '+kind,async t=>{
    const f=fixture(t,{target}),file=path.join(f.candidate,'후보.json'),manifest=JSON.parse(fs.readFileSync(file,'utf8'));
    manifest.항목[0].종류=kind;f.write(file,JSON.stringify(manifest));
    f.record.candidate.files[0].scope='optimization-pc-publication-20261028';
    f.record.candidate.manifestSha256=후보읽기(f.candidate).manifestSha256;
    f.record.candidate.rawManifestSha256=sha256(fs.readFileSync(file));
    f.write(f.recordFile,JSON.stringify(f.record));
    if(kind==='토큰')assert.equal((await api.준비하기(f.options)).목록.정책.판,4);
    else await assert.rejects(api.준비하기(f.options),/사용자지정 범위/);
  });
  const source=fixture(t,{source:'app.js'});source.record.sources[0].scope='optimization-pc-publication-20261028';source.write(source.recordFile,JSON.stringify(source.record));
  await assert.rejects(api.준비하기(source.options),/사용자지정 범위/);
});
