import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as api from '../tools/검수묶음.mjs';
import {sha256,후보읽기,정책만들기,사용자지정원문,대체순서,다시검수자들,대신할검수자} from '../tools/lib/검수증명.mjs';
const sourcePath='experiences/synk-world-app/app-shell.mjs';
function fixture(t,{large=false}={}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'synk-user-review-')),repo=path.join(dir,'repo');fs.mkdirSync(repo);
 t.after(()=>{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep));fs.rmSync(dir,{recursive:true,force:true,maxRetries:5});});
 const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(dir,'none'),GIT_AUTHOR_NAME:'test',GIT_AUTHOR_EMAIL:'test@example.invalid',GIT_COMMITTER_NAME:'test',GIT_COMMITTER_EMAIL:'test@example.invalid'};
 for(const k of Object.keys(env))if(k.startsWith('GIT_')&&!['GIT_CONFIG_NOSYSTEM','GIT_CONFIG_GLOBAL','GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL'].includes(k))delete env[k];
 const git=(...a)=>execFileSync('git',['-C',repo,'-c','core.autocrlf=false',...a],{env,encoding:'utf8',stdio:'pipe'});
 const write=(p,bytes)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,bytes);};
 git('init','-q','-b','main');write(path.join(repo,sourcePath),'export const a=1;\n');git('add','.');git('commit','-qm','base');const base=git('rev-parse','HEAD').trim();write(path.join(repo,sourcePath),'export const a=2;\n');
 const candidate=path.join(dir,'candidate'),entries=[['world/app-shell.mjs','E01','GPT'],['world/town/day-app.mjs','E10','Claude']].map(([p,scope,author],i)=>{
  const bytes='export const value='+i+';\n'+(large?Array.from({length:500},(_,j)=>'// '+j+' '+String(i).repeat(70)).join('\n'):'');write(path.join(candidate,p),bytes);return {경로:p,종류:'바꿈',모드:'100644',sha256:sha256(bytes),scope,author};
 });
 write(path.join(candidate,'후보.json'),JSON.stringify({판:1,종류:'synk.im',항목:entries.map(({scope,author,...f})=>f)}));
 const record={version:1,taskId:'spaghetti-refactor-20261023',userStatements:{...사용자지정원문},requiredReviewers:['GPT','아르곤'],finalReviewer:'Claude',allowFallback:false,
  sources:[{path:sourcePath,sha256:sha256(fs.readFileSync(path.join(repo,sourcePath))),author:'GPT',scope:'E01'}],
  candidate:{manifestSha256:후보읽기(candidate).manifestSha256,rawManifestSha256:sha256(fs.readFileSync(path.join(candidate,'후보.json'))),files:entries.map(f=>({path:f.경로,sha256:f.sha256,scope:f.scope,author:f.author}))}};
 const recordFile=path.join(dir,'user.json');write(recordFile,JSON.stringify(record));
 return {dir,repo,base,candidate,record,recordFile,write,options:{이름:'test',폴더:path.join(dir,'out'),저장소:repo,바탕:base,종류:'화면',사용자지정:recordFile,배포후보:candidate,경로:[sourcePath],...(large?{크기:35000}:{})}};
}
const reviewAnswer=b=>({findings:[],coverage:{reviewed:'entire packet',limitations:'synthetic test only',complete:true,missing:[]},seen:b.항목,endMarker:b.표식});
function reviews(packet,whoList=['GPT','아르곤']){for(const who of whoList)for(const b of packet.목록.묶음)api.검수받기(packet.폴더,who,b.이름,JSON.stringify(reviewAnswer(b)));}
const finalAnswer=input=>({reviewer:'Claude',approveDeployment:true,taskId:input.taskId,inputSha256:input.inputSha256,manifestSha256:input.manifestSha256,requiredReviewsHash:input.requiredReviewsHash,scope:input.scope,conditions:[],limitations:'synthetic test only',coverage:{complete:true,missing:[],reviewed:'entire manifest and all required review results'},endMarker:input.endMarker});

test('default policies keep their old requirements; policy 3 cannot be selected without the explicit bounded record',()=>{
 assert.deepEqual(정책만들기({종류:'백엔드'},[]).필수,['GPT']);
 assert.deepEqual(정책만들기({종류:'백엔드',작성자:'GPT'},[]).필수,['GPT','Claude']);
 assert.throws(()=>정책만들기({종류:'화면',작성자:'GPT'},[]),/Claude 담당/);
 assert.throws(()=>정책만들기({종류:'화면'},[],{판:3}),/정책 판/);
 assert.deepEqual(다시검수자들(정책만들기({종류:'화면',페이블생략:'style only'},[]),[{출처:'아르곤'}]),['아르곤','Fable']);
});
test('bounded mixed authorship requires every reviewer on every packet and a separate global Claude approval',async t=>{
 const f=fixture(t,{large:true}),p=await api.준비하기(f.options);assert.ok(p.목록.묶음.length>1);assert.equal(p.목록.정책.판,3);assert.equal(p.목록.정책.작성자,'혼합');assert.equal(대체순서(p.목록.정책),null);assert.deepEqual(대신할검수자(p.목록.정책,'아르곤'),['아르곤']);
 assert.deepEqual(p.목록.정책.필수,['GPT','아르곤']);
 reviews(p,['GPT']);assert.match(api.검수확인(p.폴더).사유.join(' '),/필수 아르곤/);assert.throws(()=>api.배포판정준비(p.폴더),/미완료/);
 api.검수받기(p.폴더,'아르곤',p.목록.묶음[0].이름,JSON.stringify(reviewAnswer(p.목록.묶음[0])));assert.match(api.검수확인(p.폴더).사유.join(' '),/필수 아르곤/);
 reviews(p,['아르곤']);assert.match(api.검수확인(p.폴더).사유.join(' '),/최종 Claude 배포 판정이 없다/);
 const input=api.배포판정준비(p.폴더);assert.equal(input.reviews.length,p.목록.묶음.length*2);assert.equal(input.scope.length,3);
 const a=finalAnswer(input);assert.throws(()=>api.배포판정받기(p.폴더,JSON.stringify({...a,scope:a.scope.slice(1)})),/전체 후보 범위/);
 assert.throws(()=>api.배포판정받기(p.폴더,JSON.stringify({...a,approveDeployment:'true'})),/boolean/);
 assert.throws(()=>api.배포판정받기(p.폴더,JSON.stringify({...a,scope:[]})),/전체 후보 범위/);
 assert.throws(()=>api.배포판정받기(p.폴더,JSON.stringify({...a,requiredReviewsHash:'0'.repeat(64)})),/requiredReviewsHash/);
 assert.equal(api.배포판정받기(p.폴더,JSON.stringify(a)).통과,true);assert.equal(api.검수확인(p.폴더).통과,true);
 await assert.rejects(api.다시하기({이름:'delta',앞:p.폴더,폴더:path.join(f.dir,'delta')}),/새.*봉인/);
 assert.throws(()=>api.페이블받기(p.폴더,'{}'),/Fable로 대체/);
 await assert.rejects(api.페이블하기(p.폴더),/Fable로 대체/);
 f.write(path.join(p.폴더,'GPT-'+p.목록.묶음[0].이름+'.json'),fs.readFileSync(path.join(p.폴더,'GPT-'+p.목록.묶음[0].이름+'.json'),'utf8')+'\n');
 assert.equal(api.검수확인(p.폴더).통과,false,'a different complete review result invalidates global approval');
});
test('empty reviewers, wrong task/user text, GPT path expansion, missing source and candidate replacement are rejected',async t=>{
 for(const [name,mutate]of [
  ['empty',r=>r.requiredReviewers=[]],['task',r=>r.taskId='another-task'],['quote',r=>r.userStatements.review='approved'],
  ['gpt-outside',r=>r.candidate.files[1].author='GPT'],['scope',r=>r.candidate.files[0].scope='E10'],
  ['missing-source',r=>r.sources=[]],['missing-output',r=>r.candidate.files.pop()],['manifest',r=>r.candidate.manifestSha256='0'.repeat(64)],
  ['sha',r=>r.sources[0].sha256='0'.repeat(64)],['fallback',r=>r.allowFallback=true],
  ['duplicate',r=>r.candidate.files[1]={...r.candidate.files[0]}],['scope-extension',r=>{r.candidate.files[1].path='id/unapproved.js';r.candidate.files[1].scope='E11';}],
 ]){await t.test(name,async t=>{const f=fixture(t);mutate(f.record);f.write(f.recordFile,JSON.stringify(f.record));await assert.rejects(api.준비하기(f.options),/사용자지정|GPT 화면/);});}
});
test('a changed source, changed authorization, or changed candidate cannot retain an earlier packet proof',async t=>{
 const f=fixture(t),p=await api.준비하기(f.options);reviews(p);const input=api.배포판정준비(p.폴더);api.배포판정받기(p.폴더,JSON.stringify(finalAnswer(input)));assert.equal(api.검수확인(p.폴더).통과,true);
 const original=fs.readFileSync(f.recordFile);f.write(f.recordFile,Buffer.concat([original,Buffer.from('\n')]));assert.equal(api.검수확인(p.폴더).통과,false);f.write(f.recordFile,original);
 const source=fs.readFileSync(path.join(f.repo,sourcePath));f.write(path.join(f.repo,sourcePath),'export const a=3;\n');assert.equal(api.검수확인(p.폴더).통과,false);f.write(path.join(f.repo,sourcePath),source);
 const dispositionFile=path.join(p.폴더,'지적표.json'),disposition=fs.readFileSync(dispositionFile);const changed=JSON.parse(disposition);changed.memo='different review limitations';f.write(dispositionFile,JSON.stringify(changed));assert.equal(api.검수확인(p.폴더).통과,false);f.write(dispositionFile,disposition);
 f.write(path.join(f.candidate,'world/app-shell.mjs'),'export const value=99;\n');assert.equal(api.검수확인(p.폴더).통과,false);
});
test('Claude refusal and unresolved conditions are stored honestly and never open the deployment gate',async t=>{
 for(const partial of [{approveDeployment:false},{conditions:['needs live check']}])await t.test(JSON.stringify(partial),async t=>{
  const f=fixture(t),p=await api.준비하기(f.options);reviews(p);const a={...finalAnswer(api.배포판정준비(p.폴더)),...partial};
  assert.equal(api.배포판정받기(p.폴더,JSON.stringify(a)).통과,false);assert.match(api.검수확인(p.폴더).사유.join(' '),/거절했거나 미해결 조건/);
 });
});
test('CLI recognizes the explicit input only on preparation and cannot retrofit an old chain',async t=>{
 assert.equal(api.인자읽기(['준비','new','--사용자지정','approval.json']).사용자지정,'approval.json');
 const f=fixture(t),old=await api.준비하기({...f.options,종류:'백엔드',작성자:'GPT',사용자지정:undefined,배포후보:undefined});reviews(old,['GPT','Claude']);
 await assert.rejects(api.다시하기({이름:'new',앞:old.폴더,폴더:path.join(f.dir,'legacy-delta'),사용자지정:f.recordFile}),/기존 정책/);
});

test('explicit screen exception cannot replace backend review policy or include server sources',async t=>{
 const f=fixture(t);
 assert.throws(()=>정책만들기({...f.options,종류:'백엔드',끝:'작업본',배포후보:null},[],{판:3}),/백엔드의 기존/);
 const server='company/server.mjs';f.write(path.join(f.repo,server),'export const server=true;\n');
 f.record.sources=[{path:server,sha256:sha256(fs.readFileSync(path.join(f.repo,server))),scope:'C01',author:'Claude'}];f.write(f.recordFile,JSON.stringify(f.record));
 await assert.rejects(api.준비하기({...f.options,경로:[server]}),/범위·작성자/);
});

test('mixed GPT and Claude authorship remains honest without extending GPT permission',async t=>{
 const f=fixture(t);f.record.sources[0].author='GPT+Claude';f.record.candidate.files[0].author='GPT+Claude';f.write(f.recordFile,JSON.stringify(f.record));
 const p=await api.준비하기(f.options);assert.equal(p.목록.정책.사용자지정.sources[0].author,'GPT+Claude');
 f.record.candidate.files[1].author='GPT+Claude';f.write(f.recordFile,JSON.stringify(f.record));
 await assert.rejects(api.준비하기({...f.options,폴더:path.join(f.dir,'outside')}),/GPT 화면 사용자 승인 밖/);
});

test('same raw body reference is lossless per path, never merges different hashes, and keeps old policy bodies',()=>{
 const text=Buffer.from(Array.from({length:1000},(_,i)=>`// ${i} ${'text'.repeat(20)}`).join('\n'));
 const contents=[text,Buffer.from(text),Buffer.concat([text,Buffer.from('\n')])];
 const candidate={판:1,종류:'synk.im',항목:contents.map((b,i)=>({경로:`world/${i}.mjs`,sha256:sha256(b),종류:'바꿈',모드:'100644'}))};
 const old=api.후보항목들(candidate,contents),dedup=api.후보항목들(candidate,contents,{동일본문참조:true});
 assert.equal(old[1].몸,old[2].몸);assert.equal(dedup[1].몸,text.toString());assert.equal(dedup[3].몸,contents[2].toString());
 assert.ok(dedup[2].몸.includes(`[${dedup[1].id}]`));assert.ok(dedup[2].몸.includes(candidate.항목[1].sha256));assert.match(dedup[2].제목,/world\/1\.mjs/);
 const parts=api.묶기(dedup,{한도:30000}).flatMap(p=>p.항목),original=parts.filter(p=>p.제목.includes(`공통 본문 원본 [${dedup[1].id}]`));
 assert.ok(original.length>1);assert.equal(original.map(p=>p.몸).join('\n'),text.toString());
 assert.throws(()=>api.후보항목들(candidate,[text,contents[2],contents[2]],{동일본문참조:true}),/원시 SHA/);
 const malformed=structuredClone(candidate);malformed.항목[2].sha256=malformed.항목[0].sha256;
 assert.throws(()=>api.후보항목들(malformed,contents,{동일본문참조:true}),/원시 SHA/);
 assert.throws(()=>api.후보항목들(candidate,contents.slice(1),{동일본문참조:true}),/내용 수/);
 const invalid=Buffer.from([0xff]);assert.throws(()=>api.후보항목들({항목:[{경로:'invalid',sha256:sha256(invalid)}]},[invalid],{동일본문참조:true}),/UTF-8/);
});

test('reference path still requires coverage and tampering with any mirrored candidate blocks approval',async t=>{
 const f=fixture(t),same=fs.readFileSync(path.join(f.candidate,'world/app-shell.mjs'));
 f.write(path.join(f.candidate,'world/town/day-app.mjs'),same);
 const manifest=JSON.parse(fs.readFileSync(path.join(f.candidate,'후보.json')));manifest.항목[1].sha256=sha256(same);f.write(path.join(f.candidate,'후보.json'),JSON.stringify(manifest));
 f.record.candidate.files[1].sha256=sha256(same);f.record.candidate.manifestSha256=후보읽기(f.candidate).manifestSha256;f.record.candidate.rawManifestSha256=sha256(fs.readFileSync(path.join(f.candidate,'후보.json')));f.write(f.recordFile,JSON.stringify(f.record));
 const p=await api.준비하기(f.options),b=p.목록.묶음.find(b=>b.항목.some(id=>id.startsWith('P02-'))),ref=b.항목.find(id=>id.startsWith('P02-'));
 const answer=reviewAnswer(b);answer.seen=answer.seen.filter(id=>id!==ref);
 assert.throws(()=>api.검수받기(p.폴더,'GPT',b.이름,JSON.stringify(answer)),/빠진|seen|항목|완독/);
 reviews(p);api.배포판정받기(p.폴더,JSON.stringify(finalAnswer(api.배포판정준비(p.폴더))));assert.equal(api.검수확인(p.폴더).통과,true);
 f.write(path.join(f.candidate,'world/town/day-app.mjs'),'changed mirror');assert.equal(api.검수확인(p.폴더).통과,false);
});
