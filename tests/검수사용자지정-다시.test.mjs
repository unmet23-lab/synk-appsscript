import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as api from '../tools/검수묶음.mjs';
import {sha256,후보읽기,사용자지정원문} from '../tools/lib/검수증명.mjs';

async function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-user-delta-')),repo=path.join(dir,'repo');fs.mkdirSync(repo);
 t.after(()=>{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true,maxRetries:5});});
 const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(dir,'none'),GIT_AUTHOR_NAME:'test',GIT_AUTHOR_EMAIL:'test@example.invalid',GIT_COMMITTER_NAME:'test',GIT_COMMITTER_EMAIL:'test@example.invalid'};
 for(const k of Object.keys(env))if(k.startsWith('GIT_')&&!['GIT_CONFIG_NOSYSTEM','GIT_CONFIG_GLOBAL','GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL'].includes(k))delete env[k];
 const git=(...args)=>execFileSync('git',['-C',repo,'-c','core.autocrlf=false',...args],{env,encoding:'utf8',stdio:'pipe'}),write=(p,b)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b);};
 git('init','-q','-b','main');write(path.join(repo,'AGENTS.md'),'fixture\n');git('add','.');git('commit','-qm','base');const base=git('rev-parse','HEAD').trim();
 function candidate(name,value=1,mutate=null){
  const out=path.join(dir,name),recordFile=path.join(dir,name+'.json'),rows=[{path:'world/app-shell.mjs',scope:'E01',author:'GPT',text:`export const value=${value};\n`},{path:'world/town/day-app.mjs',scope:'E10',author:'Claude',text:'export const town=1;\n'}];
  mutate?.(rows);for(const row of rows)write(path.join(out,row.path),row.text);
  const entries=rows.map(r=>({경로:r.path,sha256:sha256(r.text),모드:r.mode||'100644',종류:r.type||'바꿈'}));
  write(path.join(out,'후보.json'),JSON.stringify({판:1,종류:'synk.im',항목:entries}));
  const record={version:1,taskId:'spaghetti-refactor-20261023',userStatements:{...사용자지정원문},requiredReviewers:['GPT','아르곤'],finalReviewer:'Claude',allowFallback:false,sources:[],candidate:{manifestSha256:후보읽기(out).manifestSha256,rawManifestSha256:sha256(fs.readFileSync(path.join(out,'후보.json'))),files:rows.map((r,i)=>({path:r.path,sha256:entries[i].sha256,author:r.author,scope:r.scope}))}};
  write(recordFile,JSON.stringify(record));return {out,recordFile,record};
 }
 const initial=candidate('initial'),root=await api.준비하기({이름:'first',폴더:path.join(dir,'first'),저장소:repo,바탕:base,종류:'화면',경로:['AGENTS.md'],사용자지정:initial.recordFile,배포후보:initial.out});
 const next=(c,name='delta')=>({이름:name,폴더:path.join(dir,name),앞:root.폴더,사용자지정:c.recordFile,배포후보:c.out});
 return {dir,repo,write,candidate,initial,root,next};
}
const p1={grade:'P1',location:'world/app-shell.mjs:1',quote:'value=1',problem:'synthetic regression',fix:'set value=2'};
function answer(packet,reviewer,{findings=[],resolved=true}={}){for(const b of packet.목록.묶음){const a={findings,seen:b.항목,coverage:{reviewed:'all supplied bytes',limitations:'synthetic test only',complete:true,missing:[]},endMarker:b.표식,...(packet.목록.갈래==='델타'?{targets:(b.대상||[]).map(id=>({id,resolved,note:'checked changed code'}))}:{})};api.검수받기(packet.폴더,reviewer,b.이름,JSON.stringify(a));}}
function mark(packet){api.지적표고치기(packet.폴더,p=>api.처리하기(p,['GA1=반영']));}
function approve(input){return {reviewer:'Claude',approveDeployment:true,taskId:input.taskId,inputSha256:input.inputSha256,manifestSha256:input.manifestSha256,requiredReviewsHash:input.requiredReviewsHash,scope:input.scope,conditions:[],limitations:'synthetic only',coverage:{complete:true,missing:[],reviewed:'all chain evidence and final candidate'},endMarker:input.endMarker};}
function reviewedRoot(f,withFinding=true){answer(f.root,'GPT',{findings:withFinding?[p1]:[]});answer(f.root,'아르곤');if(withFinding)mark(f.root);}

test('candidate-only same-scope delta preserves initial evidence, requires both reviewers, and one final whole-chain Claude approval',async t=>{
 const f=await fixture(t);reviewedRoot(f);const oldPacket=fs.readFileSync(path.join(f.root.폴더,'묶음.json')),oldGPT=fs.readFileSync(path.join(f.root.폴더,'GPT-A.json'));
 assert.equal(api.검수확인(f.root.폴더).통과,false,'marking reflected is not a review');
 const c=f.candidate('fixed',2),delta=await api.다시하기(f.next(c));
 assert.deepEqual(delta.목록.검수자들,['GPT','아르곤']);assert.equal(delta.목록.대상.length,1);assert.deepEqual(delta.목록.증명.파일,[]);
 answer(delta,'GPT');assert.equal(api.검수확인(delta.폴더).통과,false);
 answer(delta,'아르곤');assert.match(api.검수확인(delta.폴더).사유.join(' '),/최종 Claude 배포 판정이 없다/);
 const input=api.배포판정준비(delta.폴더);assert.equal(input.chain.length,2);assert.equal(input.reviews.length,4);assert.equal(input.disposition.length,2);assert.equal(input.chain[1].targets[0].번호,'GA1');
 assert.equal(api.배포판정받기(delta.폴더,JSON.stringify(approve(input))).통과,true);
 assert.deepEqual(fs.readFileSync(path.join(f.root.폴더,'묶음.json')),oldPacket);assert.deepEqual(fs.readFileSync(path.join(f.root.폴더,'GPT-A.json')),oldGPT);
 assert.equal(api.검수확인(f.root.폴더).통과,false,'delta does not approve old intermediate candidate');
 f.write(path.join(f.root.폴더,'GPT-A.json'),Buffer.concat([oldGPT,Buffer.from('\n')]));assert.equal(api.검수확인(delta.폴더).통과,false,'ancestor review raw bytes bind final approval');
});

test('incomplete original review, unhandled P1 and false reflected status cannot create a passing chain',async t=>{
 const f=await fixture(t),c=f.candidate('fixed',2);answer(f.root,'GPT',{findings:[p1]});mark(f.root);
 await assert.rejects(api.다시하기(f.next(c)),/필수 아르곤/);
 answer(f.root,'아르곤');const same=f.candidate('unchanged',1);await assert.rejects(api.다시하기(f.next(same,'same')),/바뀐 것이 없다/);
 const delta=await api.다시하기(f.next(c));answer(delta,'GPT');answer(delta,'아르곤',{resolved:false});
 const table=api.지적표읽기(delta.폴더);for(const row of table.지적)api.지적표고치기(delta.폴더,p=>api.처리하기(p,[`${row.번호}=재현안됨:synthetic override attempt`]));
 assert.match(api.검수확인(delta.폴더).사유.join(' '),/모두가 고침을 해결/);assert.throws(()=>api.배포판정준비(delta.폴더),/미완료/);
});

test('new authority cannot change original scope, modes, creation status, author or reviewer requirements',async t=>{
 for(const [name,change]of [
  ['path',rows=>rows.push({path:'world/world-session.mjs',scope:'E01',author:'GPT',text:'export const added=1;\n'})],
  ['author',rows=>rows[0].author='GPT+Claude'],['mode',rows=>rows[0].mode='100755'],['type',rows=>rows[0].type='새'],
 ])await t.test(name,async t=>{const f=await fixture(t);reviewedRoot(f);const c=f.candidate(name,2,change);await assert.rejects(api.다시하기(f.next(c)),/범위|작성자|모드/);});
 for(const [name,change]of [['reviewer',r=>r.requiredReviewers=['GPT']],['quote',r=>r.userStatements.review='override'],['sha',r=>r.candidate.files[0].sha256='0'.repeat(64)]])await t.test(name,async t=>{const f=await fixture(t);reviewedRoot(f);const c=f.candidate(name,2);change(c.record);f.write(c.recordFile,JSON.stringify(c.record));await assert.rejects(api.다시하기(f.next(c)),/사용자지정/);});
});

test('reused Claude approval and new candidate or authority tampering fail closed',async t=>{
 const f=await fixture(t);reviewedRoot(f,false);const oldInput=api.배포판정준비(f.root.폴더),oldApproval=approve(oldInput);api.배포판정받기(f.root.폴더,JSON.stringify(oldApproval));
 const c=f.candidate('fixed',2),delta=await api.다시하기(f.next(c));answer(delta,'GPT');answer(delta,'아르곤');
 assert.throws(()=>api.배포판정받기(delta.폴더,JSON.stringify(oldApproval)),/불일치/);
 const input=api.배포판정준비(delta.폴더);api.배포판정받기(delta.폴더,JSON.stringify(approve(input)));assert.equal(api.검수확인(delta.폴더).통과,true);
 const auth=fs.readFileSync(c.recordFile);f.write(c.recordFile,Buffer.concat([auth,Buffer.from('\n')]));assert.equal(api.검수확인(delta.폴더).통과,false);f.write(c.recordFile,auth);
 f.write(path.join(c.out,'world/app-shell.mjs'),'changed after approval');assert.equal(api.검수확인(delta.폴더).통과,false);
});

test('unresolved policy 3 votes remain bound through the next actual correction and both reviewers',async t=>{
 const f=await fixture(t);reviewedRoot(f);const c2=f.candidate('fixed-2',2),d2=await api.다시하기(f.next(c2));
 answer(d2,'GPT',{resolved:false});answer(d2,'아르곤',{resolved:false});
 const rows=api.지적표읽기(d2.폴더).지적;assert.equal(rows.length,2,'both negative votes have their own findings');
 for(const row of rows)api.지적표고치기(d2.폴더,p=>api.처리하기(p,[`${row.번호}=재현안됨:cannot erase a raw negative vote`]));
 assert.throws(()=>api.배포판정준비(d2.폴더),/미완료/);
 const c3=f.candidate('fixed-3',3),next={...f.next(c3,'delta-3'),앞:d2.폴더};
 await assert.rejects(api.다시하기(next),/모두가 고침/,'table-only dismissals cannot close ancestor votes');
 for(const row of rows)api.지적표고치기(d2.폴더,p=>api.처리하기(p,[`${row.번호}=반영`]));
 assert.equal(api.검수확인(d2.폴더).통과,false,'a reflection is still not a deployment approval');
 const d3=await api.다시하기(next);assert.deepEqual(d3.목록.대상.map(x=>x.번호).sort(),rows.map(x=>x.번호).sort());
 answer(d3,'GPT');assert.throws(()=>api.배포판정준비(d3.폴더),/미완료/);
 answer(d3,'아르곤',{resolved:false});assert.throws(()=>api.배포판정준비(d3.폴더),/미완료/,'one reviewer cannot resolve the descendant targets');
 answer(d3,'아르곤');
 const input=api.배포판정준비(d3.폴더);assert.equal(input.chain.length,3);assert.equal(input.reviews.length,6);assert.equal(input.chain[2].targets.length,2);
 assert.equal(api.배포판정받기(d3.폴더,JSON.stringify(approve(input))).통과,true);
 const tablePath=path.join(d2.폴더,'지적표.json'),oldTable=fs.readFileSync(tablePath),table=JSON.parse(oldTable);
 table.지적=table.지적.filter(x=>x.번호!==rows[0].번호);f.write(tablePath,JSON.stringify(table));
 assert.equal(api.검수확인(d3.폴더).통과,false,'missing intermediate finding breaks the ancestor link');f.write(tablePath,oldTable);
 assert.equal(api.검수확인(d3.폴더).통과,true);
});
