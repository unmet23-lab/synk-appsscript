import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as api from '../tools/검수묶음.mjs';
import {AI마켓작업ID, AI마켓원문, AI마켓아르곤대체, sha256, 후보읽기, 정책만들기, 대신할검수자} from '../tools/lib/검수증명.mjs';

// Synthetic gate fixtures only. No model is called; none of these answers is a real review receipt.
const taskId = 'ai-market-first-bundle-20261110';
const screen = 'experiences/ai-market/app.mjs';
const company = 'docs/마케팅/온라인마케팅지도/engagement/company/';
const backend = company + 'ai-market-store.mjs';
function fixture(t, {kind = '화면', source = kind === '화면' ? screen : backend, target = source, git = false, candidateOnly = false, large = false} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'synk-market-review-')), repo = path.join(dir, 'repo');
  t.after(() => {
    assert.equal(path.dirname(path.resolve(dir)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('synk-market-review-'));
    fs.rmSync(dir, {recursive: true, force: true, maxRetries: 5});
  });
  const write = (file, text) => { fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, text); };
  write(path.join(repo, source), 'export const value=1;\n');
  let base;
  if (git) {
    const env = {...process.env, GIT_CONFIG_NOSYSTEM:'1', GIT_CONFIG_GLOBAL:path.join(dir,'no-global'), GIT_AUTHOR_NAME:'test', GIT_AUTHOR_EMAIL:'test@example.invalid', GIT_COMMITTER_NAME:'test', GIT_COMMITTER_EMAIL:'test@example.invalid'};
    for (const k of Object.keys(env)) if (k.startsWith('GIT_') && !['GIT_CONFIG_NOSYSTEM','GIT_CONFIG_GLOBAL','GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL'].includes(k)) delete env[k];
    const run = (...args) => execFileSync('git', ['-C',repo,'-c','core.autocrlf=false',...args], {env, encoding:'utf8',stdio:'pipe'});
    run('init','-q','-b','main'); run('add','.'); run('commit','-qm','base'); base = run('rev-parse','HEAD').trim();
  }
  if (!candidateOnly) write(path.join(repo, source), 'export const value=2;\n' + (large ? Array.from({length:1500}, (_,i) => `// ${i} ${'synthetic only '.repeat(6)}\n`).join('') : ''));
  const authority = () => ({version:2, taskId, userStatements:{...AI마켓원문}, requiredReviewers:kind === '화면' ? ['아르곤'] : ['GPT'], finalReviewer:'GPT', allowFallback:kind === '화면', sources:[], candidate:null});
  const record = authority();
  if (!candidateOnly) record.sources = [{path:source, author:'GPT', scope:taskId, sha256:sha256(fs.readFileSync(path.join(repo,source)))}];
  const recordFile = path.join(dir,'authority.json'), save = () => write(recordFile, JSON.stringify(record)); save();
  const candidate = (name, value = 1) => {
    const out = path.join(dir,name), file = path.join(dir,`${name}-authority.json`);
    write(path.join(out,target), `export const value=${value};\n`);
    write(path.join(out,'후보.json'), JSON.stringify({판:1,종류:'synk.im',항목:[{경로:target,종류:'바꿈',모드:'100644',sha256:sha256(fs.readFileSync(path.join(out,target)))}]}));
    const a = authority();
    a.candidate = {manifestSha256:후보읽기(out).manifestSha256, rawManifestSha256:sha256(fs.readFileSync(path.join(out,'후보.json'))), files:[{path:target,author:'GPT',scope:taskId,sha256:sha256(fs.readFileSync(path.join(out,target)))}]};
    write(file,JSON.stringify(a)); return {out,file,record:a};
  };
  const files = candidateOnly ? [] : [{경로:source,상태:'M'}];
  const options = {이름:'market',폴더:path.join(dir,'packet'),저장소:repo,바탕:base,종류:kind,사용자지정:recordFile,경로:[source],크기:30000};
  if (candidateOnly) { const c = candidate('initial'); options.사용자지정=c.file; options.배포후보=c.out; }
  const policy = () => 정책만들기({...options,끝:'작업본'},files,{판:4});
  return {dir,repo,source,options,files,record,recordFile,write,save,policy,candidate};
}
function answer(packet, reviewer, {findings=[],resolved=true} = {}) {
  for (const b of packet.목록.묶음) api.검수받기(packet.폴더,reviewer,b.이름,JSON.stringify({
    findings, seen:b.항목, endMarker:b.표식,
    coverage:{reviewed:'synthetic gate fixture',limitations:'no model call',complete:true,missing:[]},
    ...(packet.목록.갈래 === '델타' ? {targets:b.대상.map(id => ({id,resolved,note:'synthetic resolution'}))} : {}),
  }));
}
const final = input => ({reviewer:'GPT',approveDeployment:true,taskId:input.taskId,inputSha256:input.inputSha256,manifestSha256:input.manifestSha256,requiredReviewsHash:input.requiredReviewsHash,scope:input.scope,conditions:[],limitations:'synthetic fixture only',coverage:{complete:true,missing:[],reviewed:'synthetic full candidate'},endMarker:input.endMarker});
async function blocked(packet, message = 'RESOURCE_EXHAUSTED quota') {
  let calls = 0;
  await api.아르곤보내기(packet.폴더,packet.목록,{call:async () => { calls++; throw new Error(message); },몫:async () => null});
  return calls;
}

test('AI market keeps default policies and seals exact authorization, authors and reviewer roles', async t => {
  assert.equal(AI마켓작업ID,taskId);
  assert.deepEqual(정책만들기({종류:'백엔드',작성자:'GPT'},[]).필수,['GPT','Claude']);
  assert.throws(() => 정책만들기({종류:'화면',작성자:'GPT'},[]),/Claude/);
  const f = fixture(t), p = f.policy();
  assert.equal(p.작성자,'GPT'); assert.deepEqual(p.필수,['아르곤']); assert.equal(p.사용자지정.finalReviewer,'GPT');
  assert.equal(AI마켓아르곤대체(p),true); assert.deepEqual(대신할검수자(p,'아르곤'),['아르곤','GPT']);
  const b = fixture(t,{kind:'백엔드'}).policy();
  assert.deepEqual(b.필수,['GPT']); assert.equal(b.사용자지정.allowFallback,false); assert.deepEqual(대신할검수자(b,'GPT'),['GPT']);
  for (const [name, mutate] of [
    ['task',r=>r.taskId='spaghetti-finish-20261026'], ['review quote',r=>r.userStatements.independentReview='진행'],
    ['implementation quote',r=>r.userStatements.implementation='GPT 허용'], ['scope quote',r=>r.userStatements.firstBundle='모든 서비스'],
    ['reviewer',r=>r.requiredReviewers=['GPT']], ['final reviewer',r=>r.finalReviewer='Claude'], ['fallback',r=>r.allowFallback=false],
    ['author',r=>r.sources[0].author='Claude'], ['mixed author',r=>r.sources[0].author='GPT+Claude'], ['hash',r=>r.sources[0].sha256='0'.repeat(64)],
    ['scope',r=>r.sources[0].scope='optimization-security-20261028'], ['duplicate',r=>r.sources.push(r.sources[0])],
  ]) await t.test(name, t => { const x=fixture(t);mutate(x.record);x.save();assert.throws(x.policy,/사용자지정/); });
  const falseBackend = fixture(t,{kind:'백엔드'});falseBackend.record.allowFallback=true;falseBackend.save();assert.throws(falseBackend.policy,/사용자지정/);
});

test('exact product paths exclude idk, staff auth, unrelated products and wrong review category', async t => {
  for (const [kind, source] of [
    ['화면','experiences/ai-market/index.html'], ['화면','experiences/ai-market/style.css'],
    ...['ai-market-routes.mjs','customer-identity.mjs','customer-routes.mjs','server.mjs','Dockerfile','Dockerfile.dockerignore'].map(p=>['백엔드',company+p]),
    ['백엔드','tools/lib/검수증명.mjs'], ['백엔드','tests/검수AI마켓지정.test.mjs'],
  ]) await t.test(`allowed ${source}`,t=>assert.equal(fixture(t,{kind,source}).policy().사용자지정.taskId,taskId));
  for (const options of [
    {source:backend}, {kind:'백엔드',source:screen}, {source:'experiences/idk/app.mjs'}, {source:'experiences/ai-market/request.mjs'},
    {kind:'백엔드',source:company+'synk-identity.mjs'}, {kind:'백엔드',source:company+'store.mjs'},
    {kind:'백엔드',source:'tools/delete-production.cjs'}, {source:'experiences/ai-market-prep/app.js'},
  ]) await t.test(`rejected ${options.source}`,t=>assert.throws(fixture(t,options).policy,/사용자지정 범위/));
  for (const change of [{상태:'D'},{상태:'R100',옛경로:screen},{옛경로:screen}]) await t.test(`delete/rename ${JSON.stringify(change)}`,t=>{const f=fixture(t);Object.assign(f.files[0],change);assert.throws(f.policy,/삭제·이름 변경/);});
});

test('screen needs actual Argon packets plus independent final GPT, backend needs complete GPT and sealed final', async t => {
  for (const kind of ['화면','백엔드']) await t.test(kind,async t=>{
    const f=fixture(t,{kind,git:true}),packet=await api.준비하기(f.options);
    assert.equal(api.검수확인(packet.폴더).통과,false);
    assert.throws(()=>api.배포판정준비(packet.폴더),/미완료/);
    const b=packet.목록.묶음[0];
    assert.throws(()=>api.검수받기(packet.폴더,'Claude',b.이름,'{}'),/AI 마켓/);
    if(kind==='화면'){answer(packet,'GPT');assert.throws(()=>api.배포판정준비(packet.폴더),/아르곤.*미완료/);}
    answer(packet,kind==='화면'?'아르곤':'GPT');
    assert.equal(api.검수확인(packet.폴더).통과,false);
    const input=api.배포판정준비(packet.폴더);assert.equal(input.finalReviewer,'GPT');
    assert.throws(()=>api.배포판정받기(packet.폴더,JSON.stringify({...final(input),approveDeployment:'true'})),/명시/);
    assert.throws(()=>api.배포판정받기(packet.폴더,JSON.stringify({...final(input),requiredReviewsHash:'0'.repeat(64)})),/불일치/);
    assert.equal(api.배포판정받기(packet.폴더,JSON.stringify(final(input))).통과,true);
    f.write(path.join(f.repo,f.source),'export const value=3;\n');assert.equal(api.검수확인(packet.폴더).통과,false);
  });
});

test('only verified Argon limit/auth failure permits final GPT fallback and seals unsent bundles', async t => {
  const f=fixture(t,{git:true,large:true}),packet=await api.준비하기(f.options);
  assert.ok(packet.목록.묶음.length>1);
  assert.equal(await blocked(packet),1);
  assert.equal(api.검수확인(packet.폴더).통과,false,'blocking evidence is not a completed review');
  const input=api.배포판정준비(packet.폴더);
  assert.equal(input.reviews[0].status,'막힘');assert.equal(input.reviews[0].blockingEvidence.종류,'한도');
  assert.ok(input.reviews.slice(1).every(x=>x.status==='미전송'&&x.requiresIndependentFinalReview));
  assert.equal(api.배포판정받기(packet.폴더,JSON.stringify(final(input))).통과,true);
  const file=path.join(packet.폴더,'아르곤-A.json'),raw=fs.readFileSync(file),saved=JSON.parse(raw);
  for(const mutate of [r=>r.실패원문='ordinary network failure',r=>r.입력sha256='0'.repeat(64),r=>r.차단증거.종류='로그인']){
    const changed=structuredClone(saved);mutate(changed);f.write(file,JSON.stringify(changed));assert.equal(api.검수확인(packet.폴더).통과,false);f.write(file,raw);
  }
  f.write(file,Buffer.concat([raw,Buffer.from('\n')]));assert.equal(api.검수확인(packet.폴더).통과,false,'even same parsed failure with changed raw bytes invalidates final approval');
});

test('unsent, generic failures, incomplete answers and wrong-input failures never count as Argon fallback', async t => {
  for(const mode of ['unsent','generic','incomplete','wrong-input'])await t.test(mode,async t=>{
    const f=fixture(t,{git:true}),packet=await api.준비하기(f.options);
    if(mode==='generic')await blocked(packet,'connection lost');
    if(mode==='incomplete')await api.아르곤보내기(packet.폴더,packet.목록,{몫:async()=>null,call:async()=>({text:'{}'})});
    if(mode==='wrong-input'){
      await blocked(packet);const file=path.join(packet.폴더,'아르곤-A.json'),r=JSON.parse(fs.readFileSync(file));r.입력sha256='0'.repeat(64);f.write(file,JSON.stringify(r));
    }
    answer(packet,'GPT');assert.throws(()=>api.배포판정준비(packet.폴더),/미완료/);assert.equal(api.검수확인(packet.폴더).통과,false);
  });
});

test('candidate correction retains source of fallback findings and binds the complete actual review chain', async t => {
  const f=fixture(t,{git:true,candidateOnly:true}),root=await api.준비하기(f.options);
  const p1={grade:'P1',location:screen+':1',quote:'value=1',problem:'synthetic error',fix:'change value'};
  answer(root,'아르곤',{findings:[p1]});
  api.지적표고치기(root.폴더,p=>api.처리하기(p,['A1=반영']));
  const c2=f.candidate('fixed-2',2),d2=await api.다시하기({이름:'delta-2',폴더:path.join(f.dir,'delta-2'),앞:root.폴더,사용자지정:c2.file,배포후보:c2.out});
  await blocked(d2);assert.throws(()=>api.배포판정준비(d2.폴더),/미완료/,'a delta needs a real resolution vote');
  answer(d2,'GPT',{resolved:false});assert.equal(api.검수확인(d2.폴더).통과,false);
  const rows=api.지적표읽기(d2.폴더).지적;assert.equal(rows.length,1);assert.equal(rows[0].출처,'GPT');
  for(const row of rows)api.지적표고치기(d2.폴더,p=>api.처리하기(p,[`${row.번호}=반영`]));
  const c3=f.candidate('fixed-3',3),d3=await api.다시하기({이름:'delta-3',폴더:path.join(f.dir,'delta-3'),앞:d2.폴더,사용자지정:c3.file,배포후보:c3.out});
  answer(d3,'아르곤');
  const input=api.배포판정준비(d3.폴더);assert.equal(input.chain.length,3);
  assert.ok(input.reviews.some(r=>r.reviewer==='GPT'&&r.chain==='delta-2'));
  assert.equal(api.배포판정받기(d3.폴더,JSON.stringify(final(input))).통과,true);
  f.write(path.join(c3.out,screen),'changed after final');assert.equal(api.검수확인(d3.폴더).통과,false);
});
