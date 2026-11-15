import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import * as api from '../tools/검수묶음.mjs';
import {정책만들기,다시검수자들,대신할검수자,끝판정책} from '../tools/lib/검수증명.mjs';

const task='workspace-entry-handoff-20261115';
const prefix='docs/마케팅/온라인마케팅지도/engagement/company/public/';
const paths=['entry/index.html','entry/entry.mjs','entry/entry.css','pulse-app/entry-handoff.mjs','workspace-entry.js','app.js','index.html','pulse-app/app.mjs','pulse-app/sw.js','studio.js','maker-tools.js','maker-tools.css','workspace.js','workspace-access.js'];
const files=paths.map(p=>({경로:prefix+p,상태:'M'}));
const options={종류:'화면',작성자:'GPT',담당예외:task};

test('승인된 Workspace 진입 14경로만 GPT 작성 사실과 일반 화면 검수를 함께 기록한다',()=>{
  for(const selected of [files,...files.map(file=>[file])]){
    const policy=정책만들기(options,selected);
    assert.equal(policy.작성자,'GPT');
    assert.equal(policy.담당예외.taskId,task);
    assert.equal(policy.담당예외.userStatement,'이번 작업은 GPT가 설계·구현·검토 진행');
    assert.deepEqual(policy.필수,['아르곤','Fable']);
    assert.equal(policy.예외,null);
    assert.equal(policy.페이블생략,undefined);
    assert.equal(끝판정책(policy),false);
  }
});

test('Workspace 담당 예외도 지적을 낸 카본과 Fable의 화면 재검수를 유지한다',()=>{
  const policy=정책만들기(options,files);
  assert.deepEqual(다시검수자들(policy,[{출처:'아르곤'}]),['아르곤','Fable']);
  assert.deepEqual(다시검수자들(policy,[{출처:'Fable'}]),['Fable']);
  assert.deepEqual(대신할검수자(policy,'아르곤'),['아르곤','Fable']);
});

test('작업 이름만으로 다른 화면·서버·관문이나 경로 변형을 승인하지 않는다',()=>{
  for(const path of ['server.mjs','public/other.js','public/entry/extra.mjs','../Code.js']){
    assert.throws(()=>정책만들기(options,[{경로:prefix.replace(/public\/$/,'')+path,상태:'M'}]));
  }
  for(const 경로 of ['tools/lib/검수증명.mjs',prefix+'entry/../app.js',prefix+'./app.js',prefix.replaceAll('/','\\')+'app.js']){
    assert.throws(()=>정책만들기(options,[{경로,상태:'M'}]));
  }
  assert.throws(()=>정책만들기(options,[]));
  for(const change of [{상태:'D'},{상태:'R'},{옛경로:prefix+'other.js'}]){
    assert.throws(()=>정책만들기(options,[{...files[0],...change}]));
  }
});

test('담당 예외를 검수 생략·다른 작성자·백엔드·옛 정책과 섞지 않는다',()=>{
  for(const change of [{작성자:'Claude'},{작성자:'카본'},{종류:'백엔드'},{예외:'내부'},{페이블생략:'skip'},{페이블생략:''},{GPT구독:'종료'},{담당예외:task+'-other'}]){
    assert.throws(()=>정책만들기({...options,...change},files));
  }
  for(const 판 of [1,2,5,6])assert.throws(()=>정책만들기(options,files,{판}));
  assert.throws(()=>정책만들기({종류:'화면',작성자:'GPT'},files));
  assert.deepEqual(정책만들기({종류:'백엔드',작성자:'GPT'},files).필수,['GPT','Claude']);
});

// 아래 응답은 관문 회귀를 위한 가짜 답이다. 제품의 실제 검수를 대신하지 않는다.
function fixture(t){
  const root=fs.realpathSync(os.tmpdir()),dir=fs.mkdtempSync(path.join(root,'synk-entry-review-')),repo=path.join(dir,'repo');
  t.after(()=>{assert.equal(path.dirname(path.resolve(dir)),root);assert.ok(path.basename(dir).startsWith('synk-entry-review-'));fs.rmSync(dir,{recursive:true,force:true,maxRetries:5});});
  const write=(name,body)=>{const target=path.join(repo,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body);};
  write(files[0].경로,'<p>before</p>\n');
  const env={...process.env,GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(dir,'no-global'),GIT_AUTHOR_NAME:'fixture',GIT_AUTHOR_EMAIL:'fixture@example.invalid',GIT_COMMITTER_NAME:'fixture',GIT_COMMITTER_EMAIL:'fixture@example.invalid'};
  for(const key of Object.keys(env))if(key.startsWith('GIT_')&&!['GIT_CONFIG_NOSYSTEM','GIT_CONFIG_GLOBAL','GIT_AUTHOR_NAME','GIT_AUTHOR_EMAIL','GIT_COMMITTER_NAME','GIT_COMMITTER_EMAIL'].includes(key))delete env[key];
  const git=(...args)=>execFileSync('git',['-C',repo,'-c','core.autocrlf=false','-c',`core.hooksPath=${path.join(dir,'no-hooks')}`,...args],{env,encoding:'utf8',stdio:'pipe'});
  git('init','-q','-b','main');git('add','.');git('commit','-qm','fixture');
  const base=git('rev-parse','HEAD').trim();write(files[0].경로,'<p>after</p>\n');
  return {dir,repo,write,options:{...options,저장소:repo,바탕:base,이름:'entry-test',폴더:path.join(dir,'review')}};
}
const answer=(packet,findings=[])=>({findings,coverage:{complete:true,missing:[],reviewed:'synthetic fixture',limitations:'no model call'},seen:packet.항목,endMarker:packet.표식,...(packet.대상?{targets:packet.대상.map(id=>({id,resolved:true,note:'fixture correction'}))}:{})});
const review=(packet,who='아르곤',findings=[])=>{for(const part of packet.목록.묶음)api.검수받기(packet.폴더,who,part.이름,JSON.stringify(answer(part,findings)));};

test('실제 준비·확인은 카본의 완독과 Fable 최종을 모두 요구하고 검수 뒤 원천 변경을 거부한다',async t=>{
  const f=fixture(t),packet=await api.준비하기(f.options);
  assert.equal(api.검수확인(packet.폴더).통과,false);
  const part=packet.목록.묶음[0];
  assert.throws(()=>api.검수받기(packet.폴더,'아르곤',part.이름,JSON.stringify({...answer(part),seen:[]})),/응답 검증/);
  review(packet);assert.equal(api.검수확인(packet.폴더).통과,false);
  await api.페이블하기(packet.폴더,{시험:false,캡처:false});
  const proof=JSON.parse(fs.readFileSync(path.join(packet.폴더,'페이블자료.json'))).증명;
  api.페이블받기(packet.폴더,JSON.stringify({...answer(proof),argonReview:[],reviewInputHash:proof.검토입력해시}));
  assert.equal(api.검수확인(packet.폴더).통과,true);
  f.write(files[0].경로,'<p>not reviewed</p>\n');
  assert.equal(api.검수확인(packet.폴더).통과,false);
});

test('카본 P1 수정은 같은 사슬의 카본과 Fable 재검수를 모두 요구한다',async t=>{
  const f=fixture(t),packet=await api.준비하기(f.options);
  review(packet,'아르곤',[{grade:'P1',location:files[0].경로+':1',quote:'after',problem:'synthetic defect',fix:'correct'}]);
  await api.페이블하기(packet.폴더,{시험:false,캡처:false});
  const proof=JSON.parse(fs.readFileSync(path.join(packet.폴더,'페이블자료.json'))).증명;
  api.페이블받기(packet.폴더,JSON.stringify({...answer(proof),argonReview:[{id:'A1',agree:true,note:'synthetic defect remains'}],reviewInputHash:proof.검토입력해시}));
  api.지적표고치기(packet.폴더,p=>api.처리하기(p,['A1=일부:fixture correction requires confirmation']));
  f.write(files[0].경로,'<p>correct</p>\n');
  const next=await api.다시하기({이름:'fixed',폴더:path.join(f.dir,'fixed'),앞:packet.폴더,저장소:f.repo});
  assert.deepEqual(next.목록.검수자들,['아르곤','Fable']);
  review(next);assert.equal(api.검수확인(next.폴더).통과,false);
  review(next,'Fable');assert.equal(api.검수확인(next.폴더).통과,true);
});

test('최종 자료에 끼어든 관문 코드와 배포 후보를 담당 예외로 승인하지 않는다',async t=>{
  const f=fixture(t),packet=await api.준비하기(f.options);review(packet);
  f.write('tools/lib/검수증명.mjs','export const gate = true;\n');
  await assert.rejects(api.페이블하기(packet.폴더,{시험:false,캡처:false}),/직접 승인 범위/);
  const candidate=path.join(f.dir,'candidate');fs.mkdirSync(candidate);
  fs.writeFileSync(path.join(candidate,'후보.json'),JSON.stringify({판:1,종류:'synk.im',항목:[]}));
  assert.throws(()=>정책만들기({...options,배포후보:candidate},files));
});
