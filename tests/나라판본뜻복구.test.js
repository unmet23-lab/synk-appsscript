'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { publishGrade, earlierExamBusy, recoverItem, copyPreviousExam, judgeQuota, eligible, inWindow, readyVersions, validAnswer, verifyInput } = require('../tools/나라판본뜻복구');
const { sha256 } = require('../tools/lib/판본글');
const { 보내기 } = require('../tools/lib/클로드키');

const slot = Date.parse('2026-11-22T22:10:00+09:00');
const cfg = { enabledAt: '2026-11-22T18:00:00+09:00' };
const run = { 작업: 'synk-daily-lab-versions', 예정: slot, 실행: { 켜짐: true, 바쁨: false },
  판정: { 종류: '멈춤', 확실: true, 한도: true, 까닭: "You've hit your 5-hour limit · resets 3am" } };

test('실제 나라 판본 회차의 구독 한도만 복구한다', () => {
  assert.equal(eligible(run, cfg, slot + 300000), true);
  for (const change of [{ 작업: 'synk-daily-lab' }, { 실행: {켜짐:false} }, { 실행:{켜짐:true,바쁨:true} },
    {판정:{...run.판정, 까닭:'429 rate_limit_error'}}, {판정:{...run.판정, 종류:'끝남'}}]) {
    assert.ok(!eligible({...run,...change},cfg,slot+300000));
  }
  assert.ok(!eligible(run,{enabledAt:new Date(slot+1).toISOString()},slot+300000));
  assert.ok(!inWindow(slot,Date.parse('2026-11-23T06:30:00+09:00')));
  const day = Date.parse('2026-11-23T09:10:00+09:00');
  assert.ok(inWindow(day,day+60)); assert.ok(!inWindow(day,Date.parse('2026-11-23T13:30:00+09:00')));
});
test('영상·현지어·글자의 통과 지문이 같은 대기 판본만 고른다', t => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lab-ready-')); t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const ep=path.join(root,'docs','마케팅','LAB_한편'), pub=path.join(ep,'게시');
  fs.mkdirSync(pub,{recursive:true}); const source=path.join(pub,'글.json'), video=path.join(pub,'video.mp4');
  fs.writeFileSync(source,'{}');fs.writeFileSync(video,'data');
  const row={편:'LAB_한편',키:'UZ',상태:'뜻 검수 전'};
  const m={글:'게시/글.json',파일:'게시/video.mp4',검수:{글자:{결과:'통과',지문:sha256(video),글지문:sha256(source)},현지어:{결과:'통과',지문:sha256(source)}}};
  fs.writeFileSync(path.join(pub,'준비.json'),JSON.stringify({돌림:{판본:{UZ:m}}}));
  assert.deepEqual(readyVersions(root,root,[row,{...row,상태:'뜻 검수 고칠 것'}]),[row]);
  fs.writeFileSync(video,'new');assert.deepEqual(readyVersions(root,root,[row]),[]);
});
test('시험지와 뮤즈 원답 지문을 확인하고 잘린 답과 빈 요약을 거절한다',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'lab-paper-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const ep=path.join(root,'docs','마케팅','LAB_편'), out=path.join(root,'exam'), cache=path.join(root,'.tmp','뮤즈1차');
  for (const p of [ep,out,cache])fs.mkdirSync(p,{recursive:true});
  const report='1'.repeat(64)+'.txt', src=path.join(ep,'글.json'), q=path.join(out,'질문.md');
  fs.writeFileSync(src,'{}');fs.writeFileSync(q,'question');fs.writeFileSync(path.join(cache,report),'review');
  const m={편:'LAB_편',판본:'UZ',만든곳:root,편폴더:ep,글:src,지문:sha256(src),시험관:['sonnet','haiku'],뮤즈1차:{모델:'muse-spark-1.3',원답:report,원답지문:sha256(path.join(cache,report)),질문지문:sha256(q)}};
  fs.writeFileSync(path.join(out,'재료.json'),JSON.stringify(m));assert.equal(verifyInput(root,out).지문,m.지문);
  fs.appendFileSync(q,'replacement');assert.throws(()=>verifyInput(root,out),/현재 시험지/);
  assert.throws(()=>validAnswer('{}',m));assert.throws(()=>validAnswer('{"요약":',m));
});
test('등록한 검수 크레딧만 쓰고 거절된 계정 다음의 허용된 계정으로 이어간다',async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'lab-credit-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const rows=['outside','empty','allowed'].map(n=>({이름:n,키파일:n}));for(const r of rows)fs.writeFileSync(path.join(dir,r.키파일),'sk-'+'ant-fixture-'+r.이름);
  const opts={목록경로:path.join(dir,'list.json'),상태경로:path.join(dir,'state.json'),기록경로:path.join(dir,'usage.jsonl'),검수전용키:['empty','allowed'],지금:new Date()};
  fs.writeFileSync(opts.목록경로,JSON.stringify({키:rows}));
  let before = 0, sent = 0;
  const expire = {...opts, 상태경로:path.join(dir,'expired-state.json'),기록경로:path.join(dir,'expired-usage.jsonl'),
    보내기전:()=>{ if (++before === 2) throw Error('예약 시간 종료'); },
    fetch:async()=>{ sent++; return new Response(JSON.stringify({error:{message:'credit balance is too low'}}),{status:400}); }};
  await assert.rejects(보내기({model:'claude-sonnet-5-5',max_tokens:100,messages:[]},expire),/예약 시간 종료/);
  assert.equal(sent,1);
  const seen=[];opts.fetch=async (_url,req)=>{const k=req.headers['x-api-key'].split('-').pop();seen.push(k);return new Response(JSON.stringify(k==='empty'?{error:{message:'credit balance is too low'}}:{model:'claude-sonnet-5-5',content:[],usage:{input_tokens:5,output_tokens:1}}),{status:k==='empty'?400:200})};
  const res=await 보내기({model:'claude-sonnet-5-5',max_tokens:100,messages:[{role:'user',content:'test'}]},opts);
  assert.equal(res.키이름,'allowed');assert.deepEqual(seen,['empty','allowed']);
  seen.length=0;opts.fetch=async(_url,req)=>{seen.push(req.headers['x-api-key'].split('-').pop());return new Response('{"error":{"type":"rate_limit_error"}}',{status:429})};
  await assert.rejects(보내기({model:'claude-sonnet-5-5',max_tokens:100,messages:[]},opts),/429/);assert.deepEqual(seen,['allowed']);
});


test('현재 시험지에 배정된 시험관의 실제 구독 한도 응답만 인정한다', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'lab-agent-quota-'));
  t.after(() => fs.rmSync(dir,{recursive:true,force:true}));
  const stamp = new Date(slot + 2000).toISOString();
  const m = { 시각: new Date(slot).toISOString(), 뮤즈1차:{질문지문:'1'.repeat(64)} };
  const log = path.join(dir,'agent-001.jsonl');
  fs.writeFileSync(path.join(dir,'agent-001.meta.json'),JSON.stringify({model:'sonnet',description:'뜻검사 '+'1'.repeat(16)}));
  const row={type:'assistant',timestamp:stamp,isApiErrorMessage:true,apiError:'usage_limit_reached',message:{role:'assistant',content:'error'}};
  fs.writeFileSync(log,JSON.stringify(row)+'\n');
  assert.ok(judgeQuota(dir,m,'sonnet'));
  assert.ok(!judgeQuota(dir,m,'haiku'));
  assert.ok(!judgeQuota(dir,{...m,뮤즈1차:{질문지문:'2'.repeat(64)}},'sonnet'));
  fs.appendFileSync(log,JSON.stringify({...row,isApiErrorMessage:false})+'\n');
  assert.ok(!judgeQuota(dir,m,'sonnet'));
});

test('새 예약은 다른 사본의 답을 이동하지 않고 끝난 회차의 지적만 보존한다', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'meaning-history-'));
  t.after(() => fs.rmSync(root,{recursive:true,force:true}));
  const old = path.join(root,'shared');
  const fresh = path.join(root,'slot','exam');
  fs.mkdirSync(old);
  const material = {시각:new Date().toISOString()};
  fs.writeFileSync(path.join(old,'재료.json'),JSON.stringify(material));
  fs.writeFileSync(path.join(old,'답_sonnet.md'),'prior answer');
  assert.throws(() => copyPreviousExam(old,fresh,()=>true),/채점 중/);
  assert.ok(!fs.existsSync(fresh));
  copyPreviousExam(old,fresh,()=>false);
  assert.ok(!fs.existsSync(fresh));
  fs.writeFileSync(path.join(old,'채점.json'),JSON.stringify({시각:material.시각,결과:'고칠 것'}));
  copyPreviousExam(old,fresh);
  fs.writeFileSync(path.join(fresh,'답_sonnet.md'),'new answer');
  assert.equal(fs.readFileSync(path.join(old,'답_sonnet.md'),'utf8'),'prior answer');
  assert.equal(JSON.parse(fs.readFileSync(path.join(fresh,'채점.json'))).결과,'고칠 것');
});

test('고정한 시험 폴더가 사라지면 다시 결제하지 않고 이미 확인한 결과를 재사용한다',async t=>{
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'meaning-binding-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const state=path.join(root,'slot'), episode='LAB_한편', key='UZ', hash='d'.repeat(64);
  const folder=path.join(state,'시험',episode,key);
  const item={episode,key,hash,folder};
  const run={예정:slot,시작:slot,세션:'test-session'};
  const id=require('node:crypto').createHash('sha256').update(JSON.stringify([slot,episode,key,hash,path.resolve(folder),null])).digest('hex');
  fs.mkdirSync(path.join(state,'고정'),{recursive:true});
  fs.writeFileSync(path.join(state,'고정',id+'.json'),JSON.stringify({재료시각:new Date(slot).toISOString(),세션:run.세션}));
  const never=()=>assert.fail('새 호출을 해서는 안 된다');
  await assert.rejects(recoverItem(root,state,run,{},item,never),/고정한 시험 재료/);
  const proof={편:episode,판본:key,지문:hash,세션:run.세션,결과:'고칠 것',운영:'공용 파일과 Git 기록 확인'};
  const proofDir=path.join(state,'결과',episode,key);
  fs.mkdirSync(proofDir,{recursive:true});
  fs.writeFileSync(path.join(proofDir,id+'.json'),JSON.stringify(proof));
  assert.deepEqual(await recoverItem(root,state,run,{},item,never),proof);
});

test('같은 작업본의 다른 바쁜 세션이 있어도 실제로 재료를 만든 종료 회차를 구분한다',()=>{
  const home=path.resolve('example');
  const original={작업:'synk-daily-lab-versions',시작:slot,세션:'owner',실행:{사본:home,켜짐:true,바쁨:false},판정:{종류:'멈춤'}};
  const another={...original,세션:'unrelated',시작:slot+120000,실행:{...original.실행,바쁨:true},판정:{종류:'도는 중'}};
  const material={만든곳:home,예약세션:'owner',시각:new Date(slot+60000).toISOString()};
  assert.equal(earlierExamBusy(material,[original,another]),false);
  assert.equal(earlierExamBusy(material,[{...another,세션:'owner',시작:slot}]),true);
  assert.equal(earlierExamBusy(material,[another]),false);
});

test('공용 Git·작업본의 원고와 점수가 모두 같을 때만 반영을 확인한다', t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'meaning-publish-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const ep=path.join(root,'docs','마케팅','LAB_편');
  const publish=path.join(ep,'게시');
  fs.mkdirSync(publish,{recursive:true});
  const text=path.join(ep,'글.json'), prep=path.join(publish,'준비.json');
  const relative=path.relative(root,prep).split(path.sep).join('/');
  fs.writeFileSync(text,'original');
  const git=(...args)=>require('node:child_process').execFileSync('git',args,{cwd:root,windowsHide:true,stdio:'pipe'});
  git('init','-q','-b','master');
  const write=value=>fs.writeFileSync(prep,JSON.stringify({돌림:{판본:{UZ:{글:'글.json',검수:{뜻:value}}}}},null,2)+'\n');
  const grade={결과:'고칠 것',지문:sha256(text),시각:'fixture',시험관:['sonnet','haiku']};
  const proof={편:'LAB_편',판본:'UZ',지문:grade.지문,검수기록:grade,시험관:grade.시험관,채점시각:grade.시각,결과:grade.결과,글:text};
  write(grade);
  git('add','.');
  git('-c','user.name=fixture','-c','user.email=fixture@invalid.example','-c','commit.gpgsign=false','commit','-qm','fixture');
  git('update-ref','refs/remotes/origin/master','HEAD');
  const never=()=>assert.fail('이미 온전한 검수 결과를 다시 올리면 안 된다');
  assert.throws(()=>publishGrade(root,relative,{...proof,검수기록:undefined},never),/온전하지/);
  assert.match(publishGrade(root,relative,proof,never),/^[0-9a-f]{40,64}$/);
  fs.writeFileSync(text,'changed');
  assert.throws(()=>publishGrade(root,relative,proof,never),/원고/);
  git('add','.');
  git('-c','user.name=fixture','-c','user.email=fixture@invalid.example','-c','commit.gpgsign=false','commit','-qm','other source');
  git('update-ref','refs/remotes/origin/master','HEAD');
  fs.writeFileSync(text,'original');
  assert.throws(()=>publishGrade(root,relative,proof,never),/원고/);
});
