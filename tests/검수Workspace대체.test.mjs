import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {registerHooks} from 'node:module';
import {fileURLToPath} from 'node:url';

const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const auth=Buffer.from('{"synthetic":"approved user statement"}\n'),quota=Buffer.from('{"synthetic":"actual quota refusal"}\n');
// Private authorization bytes and the already-sealed production first packet
// are replaced in memory with explicit fixture pins. The same guards still run.
const approvedInput=Symbol.for('synk.review-substitution.fixture-first-input');
const approvedToolInput=Symbol.for('synk.review-substitution.fixture-tool-first-input');
const shared=fs.mkdtempSync(path.join(os.tmpdir(),'synk-review-substitution-shared-'));
after(()=>{assert.ok(fs.realpathSync(shared).startsWith(fs.realpathSync(os.tmpdir())+path.sep));fs.rmSync(shared,{recursive:true,force:true,maxRetries:5});delete globalThis[approvedInput];delete globalThis[approvedToolInput];});
const owner=new URL('../tools/lib/검수증명.mjs',import.meta.url),ownerBefore=hash(fs.readFileSync(owner));
const hook=registerHooks({load(url,context,next){
  const result=next(url,context);
  if(url!==owner.href)return result;
  let source=result.source.toString();
  for(const [original,replacement] of [['90b2f01abcd9a1031f4c25d9ec6fe6ee330e4c09e8ebcdaccfe401b9e30385a2',hash(auth)],['efb6436d0af2054ace6b38320b086ff2cf8aeca2540f6fd018137868ff594449',hash(quota)]]){
    assert.equal(source.split(original).length,2,'patch exactly one pinned digest');source=source.replace(original,replacement);
  }
  const pin="input: '78629ee9fff8e7c8f1ae8900f3998411fbb1651a68b7f231cd0fc4757085b258'";
  assert.equal(source.split(pin).length,2);source=source.replace(pin,"get input() { return globalThis[Symbol.for('synk.review-substitution.fixture-first-input')]; }");
  const toolPin="input: '4e2d4fd43d89b725d8ccd4be98be10946e1aed4ead586e65ab0500d5de5037a1'";
  assert.equal(source.split(toolPin).length,2);source=source.replace(toolPin,"get input() { return globalThis[Symbol.for('synk.review-substitution.fixture-tool-first-input')]; }");
  const home="path.join(os.homedir(), 'Documents/SYNK-appsscript')";
  assert.equal(source.split(home).length,2);source=source.replace(home,JSON.stringify(shared));
  return {...result,source};
}});
const api=await import('../tools/검수묶음.mjs'),proof=await import('../tools/lib/검수증명.mjs');
hook.deregister();
for(const key of Object.keys(process.env))if(/^GIT_/.test(key))delete process.env[key];
Object.assign(process.env,{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(os.tmpdir(),'synk-review-no-global-config'),GIT_TERMINAL_PROMPT:'0',
  GIT_AUTHOR_NAME:'fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid'});
const name='workspace-repair-qa-inputs-20261114',sourceFile='tools/conditional-qa/reregister.cjs';
function fixture(t,repoOverride=null){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-review-substitution-')),repo=repoOverride||path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  t.after(()=>{assert.ok(fs.realpathSync(root).startsWith(fs.realpathSync(os.tmpdir())+path.sep));fs.rmSync(root,{recursive:true,force:true,maxRetries:5});assert.equal(hash(fs.readFileSync(owner)),ownerBefore);});
  const write=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,value);};
  const git=(...args)=>execFileSync('git',['-C',repo,'-c','core.autocrlf=false',...args],{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
  git('init','-q','-b','main');write(path.join(repo,sourceFile),'const value=1;\n');git('add','-A');git('commit','-q','-m','baseline');
  const baseline=git('rev-parse','HEAD');write(path.join(repo,sourceFile),'const value=2;\n');
  const user=path.join(root,'user.json'),blocked=path.join(root,'quota.json');write(user,auth);write(blocked,quota);
  return {root,repo,write,baseline,user,blocked,options:{이름:name,폴더:path.join(root,name),저장소:repo,종류:'백엔드',작성자:'GPT',바탕:baseline}};
}
const answer=(m,extra={})=>JSON.stringify({findings:[],seen:m.묶음[0].항목,coverage:{reviewed:'synthetic full packet',limitations:'fixture only',complete:true,missing:[]},endMarker:m.묶음[0].표식,
  ...(m.갈래==='델타'?{targets:m.대상.map(t=>({id:t.아이디,resolved:true,note:'fixed in the supplied diff'}))}:{}),...extra});
const accept=(folder,m,who,extra={})=>api.검수받기(folder,who,m.묶음[0].이름,answer(m,extra));
const seal=(f,folder)=>api.대체승인하기(folder,{사용자승인:f.user,GPT막힘:f.blocked});
const prepare=async options=>{const r=await api.준비하기(options);globalThis[approvedInput]=r.목록.증명.검토입력해시;return r;};
// Malformed-scope fixtures retain real packet bytes and recompute only their
// claimed proof. They must fail before a review or sidecar can authorize them.
function writeClaim(first,folder,edit){
  const m=structuredClone(first.목록);edit(m);delete m.증명.검토입력해시;delete m.증명.표식;
  m.증명.검토입력해시=proof.정규해시(m.증명);m.증명.표식=`END_OF_FINAL_REVIEW_${m.증명.검토입력해시}`;
  fs.mkdirSync(folder,{recursive:true});for(const b of m.묶음)fs.copyFileSync(path.join(first.폴더,b.파일),path.join(folder,b.파일));
  fs.writeFileSync(path.join(folder,'묶음.json'),JSON.stringify(m));return {폴더:folder,목록:m};
}

test('ordinary GPT policy remains mandatory; scoped approval needs exact bytes and both Carbon and Claude',async t=>{
  const f=fixture(t),{폴더,목록}=await prepare(f.options);
  accept(폴더,목록,'아르곤');accept(폴더,목록,'Claude');
  assert.equal(api.검수확인(폴더,{저장소:f.repo}).통과,false,'Carbon cannot replace GPT without approval');
  const frozen=fs.readFileSync(path.join(폴더,'묶음.json')),packet=fs.readFileSync(path.join(폴더,목록.묶음[0].파일));
  fs.writeFileSync(f.user,'wrong approval');assert.throws(()=>seal(f,폴더),/원문 SHA/);assert.equal(fs.existsSync(path.join(폴더,'대체승인')),false);fs.writeFileSync(f.user,auth);
  fs.writeFileSync(f.blocked,'timeout is not a quota approval');assert.throws(()=>seal(f,폴더),/원문 SHA/);fs.writeFileSync(f.blocked,quota);
  const receipt=seal(f,폴더);assert.deepEqual(receipt.requiredReviewers,['아르곤','Claude']);
  assert.deepEqual(fs.readFileSync(path.join(폴더,'묶음.json')),frozen);assert.deepEqual(fs.readFileSync(path.join(폴더,목록.묶음[0].파일)),packet);
  assert.throws(()=>seal(f,폴더),/EEXIST/,'sealed approval is not overwritten');
  const ok=api.검수확인(폴더,{저장소:f.repo});assert.equal(ok.통과,true,ok.사유.join(' / '));assert.equal(ok.증명.검수대체[0].receiptSha256,receipt.receiptSha256);
  await assert.rejects(api.다시하기({이름:name+'-r2',폴더:path.join(f.root,name+'-r2'),앞:폴더,합침만:true}),/합침으로 자동 승계/);
  const claude=path.join(폴더,'Claude-A.json'),bytes=fs.readFileSync(claude);fs.unlinkSync(claude);
  assert.equal(api.검수확인(폴더,{저장소:f.repo}).통과,false,'Claude cannot be omitted');fs.writeFileSync(claude,bytes);
  const carbon=path.join(폴더,'아르곤-A.json'),carbonBytes=fs.readFileSync(carbon);fs.unlinkSync(carbon);
  assert.equal(api.검수확인(폴더,{저장소:f.repo}).통과,false,'Carbon cannot be omitted');fs.writeFileSync(carbon,carbonBytes);
  for(const rel of ['대체승인/사용자.json','대체승인/GPT막힘.json','대체승인/결속.json']){
    const file=path.join(폴더,rel),saved=fs.readFileSync(file);fs.writeFileSync(file,'{}');assert.equal(api.검수확인(폴더,{저장소:f.repo}).통과,false,rel);fs.writeFileSync(file,saved);
  }
  const binding=path.join(폴더,'대체승인/결속.json'),bindingBytes=fs.readFileSync(binding);fs.unlinkSync(binding);
  assert.match(api.검수확인(폴더,{저장소:f.repo}).사유.join(' / '),/부분 기록/);fs.writeFileSync(binding,bindingBytes);
  f.write(path.join(f.repo,sourceFile),'const value=3;\n');assert.equal(api.검수확인(폴더,{저장소:f.repo}).통과,false,'new source bytes need a new review');
});

test('an allowed name cannot authorize other sources, a different first packet, or an unrelated chain',async t=>{
  const f=fixture(t),first=await prepare(f.options),pin=globalThis[approvedInput];
  const other=writeClaim(first,path.join(f.root,'copy',name),m=>{m.증명.파일[0].sha256='f'.repeat(64);});
  assert.notEqual(other.목록.증명.검토입력해시,pin);
  assert.throws(()=>seal(f,other.폴더),/최초 검수 사슬 범위/);
  const outside=writeClaim(first,path.join(f.root,'outside',name),m=>{m.증명.파일[0].경로='outside-task.cjs';});
  globalThis[approvedInput]=outside.목록.증명.검토입력해시; // isolate the path guard from the first-input guard
  assert.deepEqual(outside.목록.증명.파일.map(x=>x.경로),['outside-task.cjs']);
  assert.throws(()=>seal(f,outside.폴더),/원천.*범위/);
  const stranger=writeClaim(first,path.join(f.root,'unrelated-work'),m=>{m.이름='unrelated-work';});
  const delta=writeClaim(first,path.join(f.root,name+'-r2'),m=>{m.이름=name+'-r2';m.갈래='델타';m.앞={이름:stranger.목록.이름,폴더:stranger.폴더};m.증명.앞={이름:stranger.목록.이름,검토입력해시:stranger.목록.증명.검토입력해시};});
  globalThis[approvedInput]=pin;
  assert.throws(()=>seal(f,delta.폴더),/최초 검수 사슬 범위/);
  assert.equal(fs.existsSync(path.join(delta.폴더,'대체승인')),false);
  assert.throws(()=>proof.Workspace대체결속({...first.목록,갈래:'합침'}),/범위/);
  let parent=first;
  for(const round of ['r2','r3','r4']){
    const previous=parent;
    parent=writeClaim(first,path.join(f.root,'allowed',name+'-'+round),m=>{m.이름=name+'-'+round;m.갈래='델타';m.앞={이름:previous.목록.이름,폴더:previous.폴더};m.증명.앞={이름:previous.목록.이름,검토입력해시:previous.목록.증명.검토입력해시};});
  }
  const receipt=seal(f,parent.폴더);assert.deepEqual(receipt.chain.map(x=>x.review),[name,name+'-r2',name+'-r3',name+'-r4']);
  assert.throws(()=>proof.Workspace대체결속({...first.목록,이름:name+'-r5'}),/범위/);
});

test('blocked GPT evidence is retained and a truncated GPT P1 cannot disappear through substitution',async t=>{
  const f=fixture(t),{폴더,목록}=await prepare(f.options),b=목록.묶음[0],file=path.join(폴더,'GPT-A.json');
  const finding={grade:'P1',location:sourceFile+':1',quote:'value=2',problem:'synthetic incomplete finding',fix:'fix it'};
  const partial={묶음:b.이름,입력sha256:b.sha256,상태:'잘림',답:{findings:[finding]},원문:answer(목록,{findings:[finding],endMarker:'truncated'})};
  fs.writeFileSync(file,JSON.stringify(partial));assert.throws(()=>seal(f,폴더),/미완료 GPT 답을 안전하게 분류/);
  assert.equal(fs.existsSync(path.join(폴더,'대체승인')),false);
  const blocked=Buffer.from(JSON.stringify({묶음:b.이름,입력sha256:b.sha256,상태:'막힘',실패원문:'synthetic quota refusal'}));
  fs.writeFileSync(file,blocked);accept(폴더,목록,'아르곤');accept(폴더,목록,'Claude');
  const receipt=seal(f,폴더);assert.deepEqual(receipt.originalGPT,[{path:'GPT-A.json',sha256:hash(blocked)}]);
  assert.deepEqual(fs.readFileSync(file),blocked);assert.equal(api.검수확인(폴더,{저장소:f.repo}).통과,true);
});

test('a completed GPT packet in a partial multi-packet review still contributes its P1',async t=>{
  const f=fixture(t);f.write(path.join(f.repo,sourceFile),Array.from({length:1800},(_,i)=>`const fixture_value_${i} = 'long synthetic line ${i}';`).join('\n'));
  const {폴더,목록}=await prepare({...f.options,크기:30000});assert.ok(목록.묶음.length>1);
  const finding={grade:'P1',location:sourceFile+':1',quote:'fixture_value_0',problem:'synthetic partial packet defect',fix:'fix first packet'};
  accept(폴더,목록,'GPT',{findings:[finding]});
  for(const b of 목록.묶음)for(const who of ['아르곤','Claude'])api.검수받기(폴더,who,b.이름,answer({...목록,묶음:[b]}));
  const saved=fs.readFileSync(path.join(폴더,'GPT-A.json'));seal(f,폴더);
  const result=api.검수확인(폴더,{저장소:f.repo});assert.equal(result.통과,false);assert.match(result.사유.join(' / '),/GA1|P1/);
  assert.deepEqual(fs.readFileSync(path.join(폴더,'GPT-A.json')),saved);
});

test('future release67 scope pins the exact repository, full source set and unique first folder before allowing descendants',async t=>{
  const release='company-workspace67-operators-20261114',repo=path.join(shared,'.tmp/company-workspace67-carry-20261114');
  const paths=['lineage-ha-rest-67.cjs','port67/admission67.cjs','port67/admission67.test.cjs','port67/lib67.cjs','port67/make-final-pins.cjs','port67/p67-operators.cjs','port67/port-root67.cjs','port67/run-local-67.cjs','port67/run67.cjs','public-health-release67-watch.cjs','read-inert-artifacts-67.cjs','read-inert-progress-67.cjs','run-deploy-67.sh','run-stage-relay-67.sh','seal67.cjs'];
  const f=fixture(t,repo);f.write(path.join(repo,sourceFile),'const value=1;\n');for(const p of paths)f.write(path.join(repo,p),'// synthetic release operator\n');
  const options={...f.options,이름:release,폴더:path.join(shared,'.tmp/검수',release),경로:paths};
  const first=await api.준비하기(options);assert.deepEqual(first.목록.증명.파일.map(x=>x.경로).sort(),[...paths].sort());
  const clone=writeClaim(first,path.join(f.root,release),()=>{});
  assert.throws(()=>seal(f,clone.폴더),/고정 폴더/);
  const wrongRepo={...first.목록,저장소:f.root};assert.throws(()=>proof.Workspace대체결속(wrongRepo),/원천.*범위/);
  const missing=structuredClone(first.목록);missing.증명.파일.pop();assert.throws(()=>proof.Workspace대체결속(missing),/원천.*범위/);
  accept(first.폴더,first.목록,'아르곤');accept(first.폴더,first.목록,'Claude');seal(f,first.폴더);
  assert.equal(proof.Workspace대체읽기(first.폴더,first.목록).review,release);
  assert.throws(()=>seal(f,first.폴더),/EEXIST/);
  // Full official delta review is covered by the one-file chain tests below;
  // this fixture isolates the 15-path authorization contract without repeated git scans.
  const delta=writeClaim(first,path.join(shared,'.tmp/검수',release+'-r2'),m=>{m.이름=release+'-r2';m.갈래='델타';m.앞={이름:release,폴더:first.폴더};m.증명.앞={이름:release,검토입력해시:first.목록.증명.검토입력해시};});
  const binding=path.join(first.폴더,'대체승인/결속.json'),saved=fs.readFileSync(binding);fs.unlinkSync(binding);
  assert.throws(()=>seal(f,delta.폴더),/부분 기록/);assert.equal(fs.existsSync(path.join(delta.폴더,'대체승인')),false);fs.writeFileSync(binding,saved);
  seal(f,delta.폴더);assert.deepEqual(proof.Workspace대체읽기(delta.폴더,delta.목록).chain.map(x=>x.review),[release,release+'-r2']);
  const r4=writeClaim(first,path.join(shared,'.tmp/검수',release+'-r4'),m=>{m.이름=release+'-r4';m.갈래='델타';m.앞={이름:delta.목록.이름,폴더:delta.폴더};m.증명.앞={이름:delta.목록.이름,검토입력해시:delta.목록.증명.검토입력해시};});
  assert.throws(()=>seal(f,r4.폴더),/원천.*범위/,'other tasks do not inherit the explicitly allowed QA/tool fourth rounds');
});

test('only the pinned tool chain gets one fourth review for the upstream merge; it cannot start a new root or a fifth round',async t=>{
  const f=fixture(t),tool='workspace-repair-review-substitution-20261114',source='tools/검수묶음.mjs';
  f.write(path.join(f.repo,source),'// synthetic tool change\n');
  const first=await api.준비하기({...f.options,이름:tool,폴더:path.join(f.root,tool),경로:[source]});
  globalThis[approvedToolInput]=first.목록.증명.검토입력해시;
  accept(first.폴더,first.목록,'아르곤');accept(first.폴더,first.목록,'Claude');seal(f,first.폴더);
  let parent=first;
  for(const round of ['r2','r3','r4']){
    const previous=parent;
    parent=writeClaim(first,path.join(f.root,tool+'-'+round),m=>{m.이름=tool+'-'+round;m.갈래='델타';m.앞={이름:previous.목록.이름,폴더:previous.폴더};m.증명.앞={이름:previous.목록.이름,검토입력해시:previous.목록.증명.검토입력해시};});
  }
  const receipt=seal(f,parent.폴더);assert.deepEqual(receipt.chain.map(x=>x.review),[tool,tool+'-r2',tool+'-r3',tool+'-r4']);
  assert.throws(()=>proof.Workspace대체결속({...first.목록,이름:tool+'-r4'}),/원천.*범위/,'the fourth name cannot authorize a new first packet');
  assert.throws(()=>proof.Workspace대체결속({...first.목록,이름:tool+'-r5'}),/범위/);
});

test('approval rejects other tasks, changed binding, existing complete GPT and in-flight GPT',async t=>{
  const f=fixture(t),{폴더,목록}=await prepare(f.options);
  for(const bad of ['unrelated-task','workspace-repair-qa-inputs-20261114-r4','company-workspace68-product-20261114'])assert.throws(()=>proof.Workspace대체결속({...목록,이름:bad}),/범위/);
  for(const key of ['예외','사용자지정','담당예외'])assert.throws(()=>proof.Workspace대체결속({...목록,정책:{...목록.정책,[key]:{}}}),/범위/);
  assert.throws(()=>proof.Workspace대체결속({...목록,정책:{...목록.정책,작성자:'Claude'}}),/범위/);
  const mark=path.join(폴더,'GPT-A.보내는중.json');fs.writeFileSync(mark,'{}');assert.throws(()=>seal(f,폴더),/진행 중/);fs.unlinkSync(mark);
  accept(폴더,목록,'GPT');assert.throws(()=>seal(f,폴더),/이미 완료/);
  fs.unlinkSync(path.join(폴더,'GPT-A.json'));seal(f,폴더);
  const record=path.join(폴더,'대체승인/결속.json'),body=JSON.parse(fs.readFileSync(record)),saved=fs.readFileSync(record);
  for(const key of ['taskId','reviewInputHash','policySha256','sourcesSha256','candidateSha256','previousInputHash']){
    fs.writeFileSync(record,JSON.stringify({...body,[key]:'tampered'}));assert.throws(()=>proof.Workspace대체읽기(폴더,목록),/결속/);
  }
  fs.writeFileSync(record,saved);fs.writeFileSync(path.join(폴더,'GPT-A.json'),'{}');assert.throws(()=>proof.Workspace대체읽기(폴더,목록),/기존 GPT/,'an original response cannot be added or replaced after sealing');
});

test('delta keeps the original chain and requires Carbon to resolve the original GPT target; approval is not inherited',async t=>{
  const f=fixture(t),first=await prepare(f.options),finding={grade:'P1',location:sourceFile+':1',quote:'value=2',problem:'synthetic gate defect',fix:'change to three'};
  accept(first.폴더,first.목록,'GPT',{findings:[finding]});accept(first.폴더,first.목록,'Claude');
  api.지적표고치기(first.폴더,table=>api.처리하기(table,['GA1=반영:fixed in fixture']));f.write(path.join(f.repo,sourceFile),'const value=3;\n');
  const delta=await api.다시하기({이름:name+'-r2',폴더:path.join(f.root,name+'-r2'),앞:first.폴더,끝판:true});
  const frozen=fs.readFileSync(path.join(delta.폴더,'묶음.json'));seal(f,delta.폴더);
  assert.throws(()=>accept(delta.폴더,delta.목록,'아르곤',{targets:[]}),'all original targets are required');
  assert.throws(()=>accept(delta.폴더,delta.목록,'아르곤',{endMarker:'wrong-marker'}),'approval does not bypass the end marker');
  assert.throws(()=>accept(delta.폴더,delta.목록,'아르곤',{seen:[]}),'approval does not bypass read coverage');
  accept(delta.폴더,delta.목록,'아르곤');accept(delta.폴더,delta.목록,'Claude');
  const ok=api.검수확인(delta.폴더,{저장소:f.repo});assert.equal(ok.통과,true,ok.사유.join(' / '));assert.deepEqual(ok.증명.사슬,[name,name+'-r2']);
  assert.equal(ok.다시[0].대상[0].누구,'아르곤');assert.deepEqual(fs.readFileSync(path.join(delta.폴더,'묶음.json')),frozen);
  f.write(path.join(f.repo,sourceFile),'const value=4;\n');
  const next=await api.다시하기({이름:name+'-r3',폴더:path.join(f.root,name+'-r3'),앞:delta.폴더,끝판:true});
  accept(next.폴더,next.목록,'아르곤');accept(next.폴더,next.목록,'Claude');
  assert.equal(api.검수확인(next.폴더,{저장소:f.repo}).통과,false,'a new candidate does not inherit approval');
  f.write(path.join(f.repo,sourceFile),'const value=3;\n');
  accept(delta.폴더,delta.목록,'아르곤',{targets:delta.목록.대상.map(x=>({id:x.아이디,resolved:false,note:'not fixed'}))});
  const unresolved=api.검수확인(delta.폴더,{저장소:f.repo});
  assert.equal(unresolved.통과,false,'an unresolved original target blocks the unchanged candidate');
  assert.ok(unresolved.사유.some(reason=>/GA1|P1|풀리지/.test(reason)),unresolved.사유.join(' / '));
});

test('bootstrap binding preserves the frozen first P1 and permits only a reviewed delta for changed source',async t=>{
  const f=fixture(t),first=await prepare(f.options),finding={grade:'P1',location:sourceFile+':1',quote:'value=2',problem:'synthetic bootstrap scope defect',fix:'change to three'};
  accept(first.폴더,first.목록,'아르곤');accept(first.폴더,first.목록,'Claude',{findings:[finding]});
  const frozen=fs.readFileSync(path.join(first.폴더,'묶음.json')),raw=fs.readFileSync(path.join(first.폴더,'Claude-A.json'));
  f.write(path.join(f.repo,sourceFile),'const value=3;\n');seal(f,first.폴더);
  const firstVerdict=api.검수확인(first.폴더,{저장소:f.repo});assert.equal(firstVerdict.통과,false);assert.match(firstVerdict.사유.join(' / '),/CA1|P1/);assert.match(firstVerdict.사유.join(' / '),/검수 뒤 파일 변경/);
  api.지적표고치기(first.폴더,table=>api.처리하기(table,['CA1=반영:fixed in synthetic source; not yet re-reviewed']));
  assert.equal(api.검수확인(first.폴더,{저장소:f.repo}).통과,false);
  const delta=await api.다시하기({이름:name+'-r2',폴더:path.join(f.root,name+'-r2'),앞:first.폴더,끝판:true});
  seal(f,delta.폴더);assert.equal(api.검수확인(delta.폴더,{저장소:f.repo}).통과,false,'binding alone is not a completed review');
  accept(delta.폴더,delta.목록,'아르곤');accept(delta.폴더,delta.목록,'Claude');assert.equal(api.검수확인(delta.폴더,{저장소:f.repo}).통과,true);
  assert.deepEqual(fs.readFileSync(path.join(first.폴더,'묶음.json')),frozen);assert.deepEqual(fs.readFileSync(path.join(first.폴더,'Claude-A.json')),raw);
});

test('a truncated GPT delta negative target cannot be dropped when the original P1 is reassigned',async t=>{
  const f=fixture(t),first=await prepare(f.options),finding={grade:'P1',location:sourceFile+':1',quote:'value=2',problem:'synthetic unresolved gate defect',fix:'change to three'};
  accept(first.폴더,first.목록,'GPT',{findings:[finding]});accept(first.폴더,first.목록,'Claude');
  api.지적표고치기(first.폴더,table=>api.처리하기(table,['GA1=반영:fix requires independent confirmation']));f.write(path.join(f.repo,sourceFile),'const value=3;\n');
  const delta=await api.다시하기({이름:name+'-r2',폴더:path.join(f.root,name+'-r2'),앞:first.폴더,끝판:true});
  const targets=delta.목록.대상.map(x=>({id:x.아이디,resolved:false,note:'original P1 is not fixed'})),raw=answer(delta.목록,{findings:[],targets,endMarker:'truncated'});
  const base={묶음:'A',입력sha256:delta.목록.묶음[0].sha256,상태:'잘림',답:JSON.parse(raw),원문:raw};
  const unknown=answer(delta.목록,{targets:[{id:'unknown-target',resolved:false,note:'not fixed'}]}),wrongType=answer(delta.목록,{targets:targets.map(x=>({...x,resolved:'false'}))});
  for(const result of [base,{...base,원문:unknown,답:JSON.parse(unknown)},{...base,원문:wrongType,답:JSON.parse(wrongType)},
    {...base,원문:'{"findings":[],"targets":',답:null},{...base,원문:'',답:JSON.parse(raw)},
    {...base,원문:answer(delta.목록),답:JSON.parse(raw)},
    {...base,원문:'',답:null,상태:'실패',실패원문:''},
    ...[0,false,[],{}].map(원문=>({...base,원문,답:null,상태:'실패',실패원문:'synthetic failure with an unclassified response type'}))]){
    fs.writeFileSync(path.join(delta.폴더,'GPT-A.json'),JSON.stringify(result));
    assert.throws(()=>seal(f,delta.폴더),/미완료 GPT 답을 안전하게 분류/);
    assert.equal(fs.existsSync(path.join(delta.폴더,'대체승인')),false);
  }
  const failed={묶음:'A',입력sha256:base.입력sha256,상태:'실패',원문:'',답:null,실패원문:'synthetic official CLI timeout without a substantive response'};
  fs.writeFileSync(path.join(delta.폴더,'GPT-A.json'),JSON.stringify(failed));seal(f,delta.폴더);
  accept(delta.폴더,delta.목록,'아르곤');accept(delta.폴더,delta.목록,'Claude');assert.equal(api.검수확인(delta.폴더,{저장소:f.repo}).통과,true);
});
