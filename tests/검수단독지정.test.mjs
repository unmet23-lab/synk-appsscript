import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as api from '../tools/검수묶음.mjs';
import {sha256,후보읽기,정책만들기,단독검수원문,대체순서,다시검수자들} from '../tools/lib/검수증명.mjs';

const sourcePath='atlas/memory-sync.js', scope='spaghetti-followup-20261026';
function fixture(t,{sourceOnly=false,candidateOnly=false}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-solo-review-')),repo=path.join(dir,'repo');fs.mkdirSync(repo);
 t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),path.resolve(os.tmpdir()));assert.ok(path.basename(dir).startsWith('synk-solo-review-'));fs.rmSync(dir,{recursive:true,force:true,maxRetries:5});});
 const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(dir,'none'),GIT_AUTHOR_NAME:'test',GIT_AUTHOR_EMAIL:'test@example.invalid',GIT_COMMITTER_NAME:'test',GIT_COMMITTER_EMAIL:'test@example.invalid'};
 for(const k of Object.keys(env))if(k.startsWith('GIT_')&&!['GIT_CONFIG_NOSYSTEM','GIT_CONFIG_GLOBAL','GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL'].includes(k))delete env[k];
 const git=(...args)=>execFileSync('git',['-C',repo,'-c','core.autocrlf=false',...args],{env,encoding:'utf8',stdio:'pipe'});
 const write=(file,bytes)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);};
 git('init','-q','-b','main');write(path.join(repo,sourcePath),'export const version=1;\n');git('add','.');git('commit','-qm','base');const base=git('rev-parse','HEAD').trim();
 if(!candidateOnly)write(path.join(repo,sourcePath),'export const version=2;\n');
 const candidate=sourceOnly?null:path.join(dir,'candidate'),candidatePath='world/app-shell.mjs';
 if(candidate){write(path.join(candidate,candidatePath),'export const value=2;\n');write(path.join(candidate,'후보.json'),JSON.stringify({판:1,종류:'synk.im',항목:[{경로:candidatePath,종류:'바꿈',모드:'100644',sha256:sha256(fs.readFileSync(path.join(candidate,candidatePath)))}]}));}
 const record={version:2,taskId:'spaghetti-finish-20261026',userStatements:{...단독검수원문},requiredReviewers:['GPT'],finalReviewer:'GPT',allowFallback:false,
  sources:candidateOnly?[]:[{path:sourcePath,author:'GPT',scope,sha256:sha256(fs.readFileSync(path.join(repo,sourcePath)))}],
  candidate:candidate?{manifestSha256:후보읽기(candidate).manifestSha256,rawManifestSha256:sha256(fs.readFileSync(path.join(candidate,'후보.json'))),files:[{path:candidatePath,author:'GPT',scope,sha256:sha256(fs.readFileSync(path.join(candidate,candidatePath)))}]}:null};
 const recordFile=path.join(dir,'user.json');write(recordFile,JSON.stringify(record));
 return {dir,repo,base,candidate,candidatePath,record,recordFile,write,options:{이름:'solo',폴더:path.join(dir,'packet'),저장소:repo,바탕:base,종류:sourceOnly?'백엔드':'화면',사용자지정:recordFile,...(candidate?{배포후보:candidate}:{}),경로:candidateOnly?[]:[sourcePath]}};
}
const answer=(bundle,findings=[])=>({findings,coverage:{reviewed:'entire synthetic fixture',limitations:'test only; no model call',complete:true,missing:[]},seen:bundle.항목,endMarker:bundle.표식});
function review(packet,findings=[]){for(const bundle of packet.목록.묶음)api.검수받기(packet.폴더,'GPT',bundle.이름,JSON.stringify({...answer(bundle,findings),...(packet.목록.갈래==='델타'?{targets:(bundle.대상||[]).map(id=>({id,resolved:true,note:'synthetic correction checked'}))}:{})}));}
const final=input=>({reviewer:'GPT',approveDeployment:true,taskId:input.taskId,inputSha256:input.inputSha256,manifestSha256:input.manifestSha256,requiredReviewsHash:input.requiredReviewsHash,scope:input.scope,conditions:[],limitations:'synthetic fixture only',coverage:{complete:true,missing:[],reviewed:'entire synthetic final input'},endMarker:input.endMarker});

test('only the fixed latest direct instruction enables policy 4; default backend and old policy stay separate',async t=>{
 assert.deepEqual(정책만들기({종류:'백엔드',작성자:'GPT'},[]).필수,['GPT','Claude']);
 assert.throws(()=>정책만들기({종류:'화면'},[],{판:4}),/정책 판/);
 const f=fixture(t),p=await api.준비하기(f.options);
 assert.equal(p.목록.정책.판,4);assert.deepEqual(p.목록.정책.필수,['GPT']);assert.equal(대체순서(p.목록.정책),null);assert.deepEqual(다시검수자들(p.목록.정책,[]),['GPT']);
 assert.equal(api.검수확인(p.폴더).통과,false);assert.throws(()=>api.배포판정준비(p.폴더),/미완료/);
 for(const who of ['Claude','아르곤','Fable'])assert.throws(()=>api.검수받기(p.폴더,who,p.목록.묶음[0].이름,JSON.stringify(answer(p.목록.묶음[0]))),/실제 GPT/);
 review(p);assert.match(api.검수확인(p.폴더).사유.join(' '),/최종 GPT 배포 판정이 없다/);
 const input=api.배포판정준비(p.폴더);assert.equal(input.finalReviewer,'GPT');assert.ok(input.reviews.every(row=>row.reviewer==='GPT'));assert.equal(input.scope.length,2);
 assert.throws(()=>api.배포판정받기(p.폴더,JSON.stringify({...final(input),reviewer:'Claude'})),/GPT의 명시/);
 assert.equal(api.배포판정받기(p.폴더,JSON.stringify(final(input))).통과,true);
 assert.equal(fs.existsSync(path.join(p.폴더,'Claude-배포판정.json')),false);
 assert.ok(api.검수확인(p.폴더).증명.최종GPT배포판정);
});

test('authority cannot be widened by task, shortened quote, empty paths, author, scope, manifest, SHA or fallback edits',async t=>{
 for(const [name,mutate]of [
  ['task',r=>r.taskId='other'],['old-task',r=>r.taskId='spaghetti-refactor-20261023'],['quote',r=>r.userStatements.implementationReviewDeployment='단독 검수 허용'],
  ['empty-reviewer',r=>r.requiredReviewers=[]],['wrong-reviewer',r=>r.requiredReviewers=['Claude']],['wrong-final',r=>r.finalReviewer='Claude'],['fallback',r=>r.allowFallback=true],
  ['missing-source',r=>r.sources=[]],['missing-candidate',r=>r.candidate.files=[]],['author',r=>r.sources[0].author='unknown'],['scope',r=>r.sources[0].scope='other'],
  ['source-sha',r=>r.sources[0].sha256='0'.repeat(64)],['manifest',r=>r.candidate.manifestSha256='0'.repeat(64)],['raw-manifest',r=>r.candidate.rawManifestSha256='0'.repeat(64)],
  ['candidate-sha',r=>r.candidate.files[0].sha256='0'.repeat(64)],['unrelated',r=>r.sources[0].path='payments/server.mjs'],
  ['private-public-path',r=>r.candidate.files[0].path='docs/_ops/private.md'],
 ])await t.test(name,async t=>{const f=fixture(t);mutate(f.record);f.write(f.recordFile,JSON.stringify(f.record));await assert.rejects(api.준비하기(f.options),/사용자지정/);});
});

test('incomplete reading, false approval and unresolved P0/P1 cannot open policy 4',async t=>{
 const f=fixture(t),p=await api.준비하기(f.options),b=p.목록.묶음[0];
 assert.throws(()=>api.검수받기(p.폴더,'GPT',b.이름,JSON.stringify({...answer(b),seen:[]})),/응답 검증/);
 assert.throws(()=>api.검수받기(p.폴더,'GPT',b.이름,'{}'),/응답 검증/);
 assert.throws(()=>api.검수받기(p.폴더,'GPT',b.이름,JSON.stringify({...answer(b),coverage:{complete:false,missing:['body'],reviewed:'partial',limitations:'incomplete'}})),/응답 검증/);
 review(p,[{grade:'P1',location:sourcePath+':1',quote:'version=2',problem:'synthetic unresolved defect',fix:'repair'}]);
 assert.equal(api.검수확인(p.폴더).통과,false);assert.throws(()=>api.배포판정준비(p.폴더),/P1/);
 const clean=fixture(t),q=await api.준비하기(clean.options);review(q);const input=api.배포판정준비(q.폴더);
 for(const delta of [{approveDeployment:'true'},{scope:[]},{requiredReviewsHash:'0'.repeat(64)},{coverage:{complete:true,missing:['one'],reviewed:'partial'}}])assert.throws(()=>api.배포판정받기(q.폴더,JSON.stringify({...final(input),...delta})),/boolean|범위|Hash|완독/);
 assert.equal(api.배포판정받기(q.폴더,JSON.stringify({...final(input),approveDeployment:false})).통과,false);
});

test('post-review input, candidate, review and authority mutations invalidate policy 4',async t=>{
 const f=fixture(t),p=await api.준비하기(f.options);review(p);api.배포판정받기(p.폴더,JSON.stringify(final(api.배포판정준비(p.폴더))));
 for(const file of [f.recordFile,path.join(f.repo,sourcePath),path.join(f.candidate,f.candidatePath),path.join(f.candidate,'후보.json'),path.join(p.폴더,`GPT-${p.목록.묶음[0].이름}.json`)]){
  const before=fs.readFileSync(file);f.write(file,Buffer.concat([before,Buffer.from('\n')]));assert.equal(api.검수확인(p.폴더).통과,false,file);f.write(file,before);
 }
 assert.equal(api.검수확인(p.폴더).통과,true);
});

test('source-only backend and candidate-only screen retain all final checks',async t=>{
 for(const kind of ['sourceOnly','candidateOnly'])await t.test(kind,async t=>{
  const f=fixture(t,{[kind]:true}),p=await api.준비하기(f.options);review(p);const input=api.배포판정준비(p.폴더);assert.equal(input.scope.length,1);
  assert.equal(api.배포판정받기(p.폴더,JSON.stringify(final(input))).통과,true);
 });
});

test('P0 and empty candidate paths remain blocking even under the explicit solo policy',async t=>{
 const f=fixture(t),p=await api.준비하기(f.options);
 review(p,[{grade:'P0',location:sourcePath+':1',quote:'version=2',problem:'synthetic data-loss boundary',fix:'repair'}]);
 assert.equal(api.검수확인(p.폴더).통과,false);assert.throws(()=>api.배포판정준비(p.폴더),/P0/);
 const empty=fixture(t,{candidateOnly:true});empty.write(path.join(empty.candidate,'후보.json'),JSON.stringify({판:1,종류:'synk.im',항목:[]}));
 assert.throws(()=>후보읽기(empty.candidate),/manifest/);
 empty.record.candidate={manifestSha256:'0'.repeat(64),rawManifestSha256:sha256(fs.readFileSync(path.join(empty.candidate,'후보.json'))),files:[]};
 empty.write(empty.recordFile,JSON.stringify(empty.record));
 await assert.rejects(api.준비하기({...empty.options,종류:'백엔드'}),/비었다|대상|manifest/);
});

test('same-task warning followup accepts only six named public pages, with the existing sealed GPT decision',async t=>{
 for(const target of ['name/index.html','name/family/index.html','nombre/index.html','rl/index.html','privacy/index.html','lab/topik4/index.html','name/private.html','privacy/source.md','.github/workflows/site-check.yml'])await t.test(target,async t=>{
  const f=fixture(t,{candidateOnly:true}),allowed=target.endsWith('index.html');
  const bytes=fs.readFileSync(path.join(f.candidate,f.candidatePath));f.write(path.join(f.candidate,target),bytes);
  const manifest=JSON.parse(fs.readFileSync(path.join(f.candidate,'후보.json')));manifest.항목[0].경로=target;
  f.write(path.join(f.candidate,'후보.json'),JSON.stringify(manifest));f.record.candidate.files[0].path=target;
  f.record.candidate.manifestSha256=후보읽기(f.candidate).manifestSha256;
  f.record.candidate.rawManifestSha256=sha256(fs.readFileSync(path.join(f.candidate,'후보.json')));f.write(f.recordFile,JSON.stringify(f.record));
  if(!allowed){await assert.rejects(api.준비하기(f.options),/사용자지정 범위/);return;}
  const p=await api.준비하기(f.options);assert.equal(api.검수확인(p.폴더).통과,false);review(p);
  assert.equal(api.검수확인(p.폴더).통과,false,'whole-candidate final decision still required');
  assert.equal(api.배포판정받기(p.폴더,JSON.stringify(final(api.배포판정준비(p.폴더)))).통과,true);
 });
});

test('warning baselines stay limited to the reviewed pages and metadata, never executable CI or unrelated pictures',async t=>{
 for(const target of ['.github/site-check/baseline/manifest.json','.github/site-check/baseline/axe.json','.github/site-check/baseline/desktop/name.jpg','.github/site-check/baseline/mobile/world~hangul-stage.png','.github/site-check/baseline/desktop/world~korean-rhythm.jpg','.github/site-check/baseline/mobile/name.js','.github/workflows/site-check.yml'])await t.test(target,t=>{
  const f=fixture(t,{candidateOnly:true});f.write(path.join(f.candidate,target),'fixture\n');
  const manifest=JSON.parse(fs.readFileSync(path.join(f.candidate,'후보.json')));manifest.항목[0].경로=target;manifest.항목[0].sha256=sha256(Buffer.from('fixture\n'));f.write(path.join(f.candidate,'후보.json'),JSON.stringify(manifest));
  f.record.candidate.files[0]={...f.record.candidate.files[0],path:target,sha256:manifest.항목[0].sha256};f.record.candidate.manifestSha256=후보읽기(f.candidate).manifestSha256;f.record.candidate.rawManifestSha256=sha256(fs.readFileSync(path.join(f.candidate,'후보.json')));f.write(f.recordFile,JSON.stringify(f.record));
  const imageOrMetadata=/^\.github\/site-check\/baseline\/.+\.(json|jpg|png)$/.test(target);
  const o={...f.options,끝:'작업본',종류:imageOrMetadata?'백엔드':'화면'};const allowed=imageOrMetadata&&!target.includes('korean-rhythm');
  if(allowed){const p=정책만들기(o,[],{판:4});assert.deepEqual(p.필수,['GPT']);assert.equal(p.사용자지정.finalReviewer,'GPT');}
  else assert.throws(()=>정책만들기(o,[],{판:4}),/사용자지정 범위/);
 });
});

test('real binary baseline image reaches the sealed review and still requires the whole GPT decision',async t=>{
 const f=fixture(t,{candidateOnly:true}),target='.github/site-check/baseline/mobile/world~hangul-stage.png';
 const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64');
 f.write(path.join(f.candidate,target),bytes);const m=JSON.parse(fs.readFileSync(path.join(f.candidate,'후보.json')));m.항목[0]={...m.항목[0],경로:target,sha256:sha256(bytes)};f.write(path.join(f.candidate,'후보.json'),JSON.stringify(m));
 f.record.candidate.files[0]={...f.record.candidate.files[0],path:target,sha256:sha256(bytes)};f.record.candidate.manifestSha256=후보읽기(f.candidate).manifestSha256;f.record.candidate.rawManifestSha256=sha256(fs.readFileSync(path.join(f.candidate,'후보.json')));f.write(f.recordFile,JSON.stringify(f.record));
 const c=후보읽기(f.candidate);assert.throws(()=>api.후보항목들(c,[bytes],{동일본문참조:true}),/UTF-8/);
 assert.throws(()=>api.후보항목들(c,[Buffer.from('wrong')],{동일본문참조:true,단독기준그림검수:true}),/원시 SHA/);
 const invalid=Buffer.from('not a png');assert.throws(()=>api.후보항목들({...c,항목:[{...c.항목[0],sha256:sha256(invalid)}]},[invalid],{동일본문참조:true,단독기준그림검수:true}),/형식/);
 const p=await api.준비하기({...f.options,종류:'백엔드'});assert.equal(api.검수확인(p.폴더).통과,false);review(p);
 assert.equal(api.검수확인(p.폴더).통과,false);assert.equal(api.배포판정받기(p.폴더,JSON.stringify(final(api.배포판정준비(p.폴더)))).통과,true);
 f.write(path.join(f.candidate,target),Buffer.concat([bytes,Buffer.from([0])]));assert.equal(api.검수확인(p.폴더).통과,false);
});

test('policy 4 candidate-only correction preserves old evidence and requires a fresh GPT whole-chain decision',async t=>{
 const f=fixture(t,{candidateOnly:true}),p=await api.준비하기(f.options);review(p);
 api.배포판정받기(p.폴더,JSON.stringify(final(api.배포판정준비(p.폴더))));
 const original=fs.readFileSync(path.join(p.폴더,'GPT-배포판정.json'));
 const candidate=path.join(f.dir,'next-candidate'),recordFile=path.join(f.dir,'next-user.json'),record=structuredClone(f.record);
 f.write(path.join(candidate,f.candidatePath),'export const value=3;\n');
 const hash=sha256(fs.readFileSync(path.join(candidate,f.candidatePath)));
 f.write(path.join(candidate,'후보.json'),JSON.stringify({판:1,종류:'synk.im',항목:[{경로:f.candidatePath,종류:'바꿈',모드:'100644',sha256:hash}]}));
 record.candidate={manifestSha256:후보읽기(candidate).manifestSha256,rawManifestSha256:sha256(fs.readFileSync(path.join(candidate,'후보.json'))),files:[{...record.candidate.files[0],sha256:hash}]};
 f.write(recordFile,JSON.stringify(record));
 const next=await api.다시하기({이름:'next',앞:p.폴더,폴더:path.join(f.dir,'next'),사용자지정:recordFile,배포후보:candidate});
 assert.equal(next.목록.정책.판,4);assert.deepEqual(next.목록.검수자들,['GPT']);assert.equal(api.검수확인(next.폴더).통과,false);
 review(next);const input=api.배포판정준비(next.폴더);assert.equal(input.chain.length,2);assert.ok(input.reviews.every(row=>row.reviewer==='GPT'));
 assert.equal(api.배포판정받기(next.폴더,JSON.stringify(final(input))).통과,true);
 assert.deepEqual(fs.readFileSync(path.join(p.폴더,'GPT-배포판정.json')),original);
});

test('known generated consumers and pause HTML are admitted only as exact source paths',async t=>{
 const f=fixture(t,{sourceOnly:true}),paths=['experiences/learning-hub/atlas-learning.js','experiences/brand-opening/content/life-standalone.mjs','experiences/entry-check/index.html','desktop/renderer/platform-continuity.mjs'];
 f.record.sources=paths.map(p=>{f.write(path.join(f.repo,p),'export const fixture=true;\n');return {path:p,scope,author:'기계생성',sha256:sha256(fs.readFileSync(path.join(f.repo,p)))};});
 f.write(f.recordFile,JSON.stringify(f.record));
 const p=await api.준비하기({...f.options,경로:paths});assert.equal(p.목록.정책.사용자지정.sources.length,paths.length);
 for(const pathName of ['experiences/learning-hub/unrelated.mjs','docs/_ops/private.md']){
  f.write(path.join(f.repo,pathName),'export const fixture=true;\n');f.record.sources=[{path:pathName,scope,author:'GPT',sha256:sha256(fs.readFileSync(path.join(f.repo,pathName)))}];f.write(f.recordFile,JSON.stringify(f.record));
  await assert.rejects(api.준비하기({...f.options,폴더:path.join(f.dir,path.basename(pathName)),경로:[pathName]}),/범위·작성자/);
 }
});

function candidateFiles(f,files){
 const rows=files.map(([p,bytes])=>{f.write(path.join(f.candidate,p),bytes);return {경로:p,종류:'바꿈',모드:'100644',sha256:sha256(bytes)};});
 f.write(path.join(f.candidate,'후보.json'),JSON.stringify({판:1,종류:'synk.im',항목:rows}));
 f.record.candidate={manifestSha256:후보읽기(f.candidate).manifestSha256,rawManifestSha256:sha256(fs.readFileSync(path.join(f.candidate,'후보.json'))),files:rows.map(r=>({path:r.경로,author:'GPT',scope,sha256:r.sha256}))};
 f.write(f.recordFile,JSON.stringify(f.record));
}

test('only this release cafe source assets, evidence and test are included with exact raw pins',async t=>{
 const f=fixture(t,{sourceOnly:true}),voice='experiences/brand-opening/assets/cafe-voice/',qa='experiences/synk-world-app/qa/cafe-honorific-20261026/';
 const paths=[...['cafe-visit-soldout-2.mp3','cafe-compose-2.mp3','manifest.json'].map(p=>voice+p),...['receipt.json','speech-transcription.json','speech-transcription-small.json'].map(p=>qa+p),'experiences/synk-world-app/qa/cafe-compose.test.mjs'];
 f.record.sources=paths.map(p=>{f.write(path.join(f.repo,p),p.endsWith('.mp3')?Buffer.from([0x49,0x44,0x33,0,0xff]):'{}\n');return {path:p,scope,author:'GPT',sha256:sha256(fs.readFileSync(path.join(f.repo,p)))};});
 f.write(f.recordFile,JSON.stringify(f.record));
 const p=await api.준비하기({...f.options,경로:paths});assert.equal(p.목록.정책.사용자지정.sources.length,paths.length);
 const outside=voice+'another.mp3';f.write(path.join(f.repo,outside),Buffer.from([0,1]));f.record.sources=[{path:outside,scope,author:'GPT',sha256:sha256(fs.readFileSync(path.join(f.repo,outside)))}];f.write(f.recordFile,JSON.stringify(f.record));
 await assert.rejects(api.준비하기({...f.options,폴더:path.join(f.dir,'outside'),경로:[outside]}),/범위·작성자/);
});

test('policy 4 preserves separate raw audio items and pins; policy 3 still rejects binary body references',async t=>{
 const f=fixture(t,{candidateOnly:true}),voice='world/brand-opening/assets/cafe-voice/',bytes=Buffer.from([0x49,0x44,0x33,0,0xff,0xfa]);
 candidateFiles(f,[[voice+'cafe-visit-soldout-2.mp3',bytes],[voice+'cafe-compose-2.mp3',bytes],[voice+'manifest.json',Buffer.from('{}\n')],['account/dist/client.js',Buffer.from('export const client=1;\n')],['account/dist/platform.js',Buffer.from('export const platform=1;\n')],['account/client.html',Buffer.from('<script src="dist/client.js?v=1"></script>\n')],['account/platform.html',Buffer.from('<script src="dist/platform.js?v=1"></script>\n')]]);
 const candidate=후보읽기(f.candidate),contents=candidate.항목.map(row=>fs.readFileSync(path.join(f.candidate,row.경로)));
 assert.throws(()=>api.후보항목들(candidate,contents,{동일본문참조:true}),/UTF-8/);
 const items=api.후보항목들(candidate,contents,{동일본문참조:true,단독음성검수:true}),audio=items.filter(item=>item.몸.includes('음성 자산 원시 SHA'));
 assert.equal(audio.length,2);assert.ok(audio.every(item=>item.몸.includes(sha256(bytes))&&item.몸.includes('coverage.complete')&&!item.몸.includes('동일 원시 본문 참조')));
 assert.ok(audio.every(item=>item.몸.includes('음성 내용(STT 등)·재생·대응 대사·해시 검증 근거')&&item.몸.includes('실제 직접 청취 여부와 한계')&&!item.몸.includes('들을 수 없거나')));
 const p=await api.준비하기(f.options);assert.equal(p.목록.정책.사용자지정.candidate.files.length,7);assert.equal(api.검수확인(p.폴더).통과,false);
 review(p);const input=api.배포판정준비(p.폴더);assert.equal(input.scope.length,7);assert.equal(api.배포판정받기(p.폴더,JSON.stringify(final(input))).통과,true);
 f.write(path.join(f.candidate,voice+'cafe-compose-2.mp3'),Buffer.from([0,2]));assert.equal(api.검수확인(p.폴더).통과,false);
});

test('candidate paths outside the four account outputs and any public QA are rejected even with matching manifests',async t=>{
 for(const p of ['account/dist/other.js','account/other.html','world/qa/cafe-honorific-20261026/receipt.json','world/qa/cafe-honorific-20261026/speech-transcription.json','world/qa/cafe-honorific-20261026/speech-transcription-small.json','docs/_ops/private.md'])await t.test(p,async t=>{
  const f=fixture(t,{candidateOnly:true});candidateFiles(f,[[p,Buffer.from('{}\n')]]);
  await assert.rejects(api.준비하기(f.options),/범위·작성자/);
 });
});

test('policy 4 audio handling cannot admit arbitrary binary candidates or mismatched content',async t=>{
 const f=fixture(t,{candidateOnly:true}),p='world/brand-opening/assets/cafe-voice/another.mp3';candidateFiles(f,[[p,Buffer.from([0,255])]]);
 await assert.rejects(api.준비하기(f.options),/UTF-8/);
 const approved='world/brand-opening/assets/cafe-voice/cafe-compose-2.mp3',bytes=Buffer.from([0,255]);candidateFiles(f,[[approved,bytes]]);
 const candidate=후보읽기(f.candidate);assert.throws(()=>api.후보항목들(candidate,[Buffer.from([0,254])],{동일본문참조:true,단독음성검수:true}),/원시 SHA/);
});
