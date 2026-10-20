'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {operationsStatus,nextAction,runView}=require('../tools/operations-home/operations-status.cjs');
const {trackItems,state}=require('../tools/운영홈.js');
function fixture(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'synk-work-status-test-'));
  t.after(()=>{assert.equal(path.dirname(root),os.tmpdir());fs.rmSync(root,{recursive:true,force:true});});
  fs.mkdirSync(path.join(root,'docs','_ops'),{recursive:true});return root;
}
test('과거 완료 문구와 종료한 작업창을 사업 완료로 추정하지 않는다',t=>{
  const root=fixture(t),pending=trackItems('## 제품\n- **광고:** 10-18 제작 완료. 아직 배포 전. [검증](qa/proof.json)\n');
  const output=operationsStatus({root,pending});
  assert.equal(output.items[0].stage,'현재 단계 미확인');assert.equal(output.items[0].evidence[0].state,'missing');
  assert.equal(runView({id:'synk-abcdefabcdef',engine:'claude',state:'exited'}).stage,'실행 종료 · 완료 근거 미확인');
});
test('명시된 최신 후속과 실제 담당을 같은 행으로 묶고 근거의 존재만 확인한다',t=>{
  const root=fixture(t);fs.writeFileSync(path.join(root,'docs','proof.md'),'# 검증\n실행 통과');
  const pending=trackItems('## 1. 유호님 차례\n- **새 화면:** 남은 일: 이전 결정. 다음 단계: 휴대폰에서 화면을 확인한다. [검증](../proof.md)\n');
  const output=operationsStatus({root,pending,modifiedAt:'2026-10-20T08:00:00Z'}),row=output.items[0];
  assert.equal(row.owner,'유호');assert.match(row.nextAction,/휴대폰에서/);assert.doesNotMatch(row.nextAction,/이전 결정/);
  assert.equal(row.evidence[0].state,'present');assert.equal(row.source.line,2);assert.ok(row.decision);
  assert.equal(row.stage,'선택·확인 대기 기록');
});
test('원본 반영 근거는 작업 ID로만 연결하며 제목 유사성이나 완료 문구로 붙이지 않는다',t=>{
  const root=fixture(t),id='synk-abcdefabcdef',pending=trackItems(`## 제품\n- **첫 작업:** 요청 ${id}. 남은 일: 운영 반영 여부 확인.\n- **비슷한 첫 작업:** 완료.\n`);
  const task={id,engine:'claude',state:'exited',integration:'integrated',integrationReceipt:{verified:true,completedAt:'2026-10-20T08:00:00Z'},validationReceipt:{status:'passed'}};
  const output=operationsStatus({root,pending,taskRecords:{available:true,complete:true,items:[task]}});
  assert.equal(output.items[0].stage,'원본 반영 확인');assert.equal(output.items[1].runs.length,0);
  assert.match(output.items[0].nextAction,/운영 반영/);assert.equal(output.items[0].runs[0].evidence.length,2);
});
test('외부 경로·인증 쿼리를 근거로 열지 않으며 반환값에 싣지 않는다',t=>{
  const root=fixture(t),pending=trackItems('## 자료\n- **보기:** [비밀](../../../private.json) [인증](https://example.com/?token=SECRET) [실제](https://example.com/report)\n');
  const result=operationsStatus({root,pending});assert.equal(result.items[0].evidence.length,1);
  assert.doesNotMatch(JSON.stringify(result),/SECRET|private\.json/);
});
test('본문 언급 순서와 무관하게 최신 실행을 고르고 시각 누락·동률은 보수적으로 표시한다',t=>{
  const root=fixture(t),older='synk-111111111111',newer='synk-222222222222';
  const pending=trackItems(`## 제품\n- **후속:** ${newer} 다음에 과거 ${older}를 참고.\n`);
  const old={id:older,state:'exited',createdAt:'2026-10-19T06:00:00Z',integration:'integrated',integrationReceipt:{verified:true,completedAt:'2026-10-19T08:00:00Z'}};
  const latest={id:newer,state:'exited',createdAt:'2026-10-20T08:00:00Z',needsAttention:true};
  const view=items=>operationsStatus({root,pending,taskRecords:{available:true,items}}).items[0];
  assert.equal(view([old,latest]).stage,'판단·조치 대기');
  assert.equal(view([old,{...latest,createdAt:null}]).stage,'실행 순서 미확인');
  assert.equal(view([old,{...latest,createdAt:'2026-10-19T08:00:00Z'}]).stage,'판단·조치 대기');
  assert.equal(runView({...latest,validationReceipt:{status:'needs_attention'}}).evidence[0].label,'검증 확인 필요');
  assert.equal(runView({...old,validationReceipt:{status:'no_changes'}}).evidence[0].label,'검증 변경 없음');
});
test('운영 홈은 주입된 기존 사본과 통합 상태를 매번 읽고 원문을 바꾸지 않는다',t=>{
  const root=fixture(t),home=path.join(root,'hermes'),backup=path.join(root,'vault');
  fs.mkdirSync(path.join(home,'runtime','synk-overview'),{recursive:true});fs.mkdirSync(backup);
  const track='# 트랙\n## 업무\n- **제작:** 남은 일: 시안 검토.\n';
  fs.writeFileSync(path.join(root,'docs','_ops','트랙.md'),track);
  const at=new Date().toISOString(),file=path.join(home,'runtime','synk-overview','sns-cache.json');
  fs.writeFileSync(file,JSON.stringify({version:1,performance:{schemaVersion:1,checkedAt:at,appRunning:true,channels:[],entries:[]}}));
  fs.writeFileSync(path.join(backup,'backup-health.json'),JSON.stringify({schemaVersion:1,checkedAt:at,components:[{id:'media',status:'healthy'}]}));
  const result=state(root,{backupRoot:backup,hermesHome:home});
  assert.equal(result.performance.available,true);assert.equal(result.maintenance[0].source.file,'backup-health.json');
  assert.equal(result.operations.items.length,1);assert.match(result.operations.items[0].nextAction,/시안 검토/);
  assert.equal(fs.readFileSync(path.join(root,'docs','_ops','트랙.md'),'utf8'),track);
  fs.writeFileSync(file,'{}');assert.equal(state(root,{backupRoot:backup,hermesHome:home}).performance.available,false);
});
