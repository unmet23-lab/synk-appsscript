'use strict';
// Read only pre-existing synthetic sample WAVs. The database is always a fresh OS-temp database.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { StudioStore } = require('../store.cjs');
const core = require('../core.cjs');
const { verifyExport } = require('../projection-replay.cjs');
const { canonical, digest } = require('../projection.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const iso = seconds => new Date(Date.parse('2026-09-11T00:00:00Z') + seconds * 1000).toISOString();
const semantic = result => { const { projectionCache, computation, execution, ...rest } = result; return rest; };
const snapshot = s => ({ revision: s.revision, cells: s.analysis.cells.map(c => ({ id: c.id, skill: c.skill, purpose: c.purpose,
  utteranceId: c.utteranceId, evidenceEpoch: c.evidenceEpoch, status: c.status, value: c.value, reasonCode: c.reasonCode,
  assistance: c.assistance, sourceAudioRef: c.sourceAudioRef })), metrics: s.analysis.metrics });
const output = { schemaVersion: 'synk.registration-proof.v1', generatedAt: new Date().toISOString(),
  scope: '실제 Store/Core를 호출한 합성 조건 실행. 학생 데이터·실제 마이크·전사 API를 사용하지 않는다. 판정 자격의 정확도나 특허 요건 통과 증명이 아니다.',
  assumptions: [
    '음성은 기존 Windows SAPI 합성 샘플이며 실제 학생 발화가 아니다.',
    'captureStartedAt/captureEndedAt 및 acquisition=microphone은 브라우저 녹음 계약을 시험하기 위해 주입한 합성 메타데이터다. 실제 마이크 녹음 사실을 주장하지 않는다.',
    'review-original/review-response의 confirmed=true, 역할 조건, 과거형 독립성, 도움 관측 범위는 통제 입력이다. 이번 사람이 직접 들어 확인했다는 증거가 아니다.',
    '도움 at은 주입한 발생 시각, recordedAt은 실제 임시 DB에 저장된 수신 시각이다.'
  ], limits: [
    '지원된 문장 및 asr/object/past 범위만 사용했다. 지원 밖 skill 값의 유효성 검증 미비는 해결하지 않았으며 이 묶음의 통과가 그 경계를 검증하지 않는다.',
    '발생 시각과 도움 범위의 입력 진실성은 이 시험으로 입증하지 않는다.',
    '증분 계산은 전체 입력/셀을 순회한다. 함수 재사용 개수는 실행시간 전체가 영향 셀 수에만 비례함을 뜻하지 않는다.',
    '한 기계의 로컬 합성 실행이며 제품 배포·실사용·학습효과·신규성·진보성을 검증하지 않는다.'
  ], sourceFingerprints: ['core.cjs','store.cjs','projection.cjs','projection-replay.cjs'].map(name => ({ name, sha256: hash(fs.readFileSync(path.join(__dirname,'..',name))) })), scenarios: [], passed: false };
let store;
try {
  const argIndex = process.argv.indexOf('--samples');
  let sampleDir = argIndex >= 0 ? path.resolve(process.argv[argIndex + 1]) : path.join(process.env.LOCALAPPDATA || os.homedir(), 'SYNK', 'patent-studio', 'samples');
  if (!fs.existsSync(path.join(sampleDir, 'manifest.json'))) {
    const runtime = JSON.parse(fs.readFileSync(path.join(__dirname, '../.runtime/studio.json'), 'utf8'));
    sampleDir = path.join(runtime.directory, 'samples');
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(sampleDir,'manifest.json'),'utf8').replace(/^\uFEFF/,''));
  assert.equal(manifest.kind,'synthetic-speech');
  const entry = manifest.files.find(f => f.file === 'original.wav');
  const wav = fs.readFileSync(path.join(sampleDir,'original.wav'));
  assert.equal(hash(wav), entry.sha256); assert.equal(wav.length, entry.bytes);
  output.audioSource = { manifestKind: manifest.kind, generator: manifest.generator, origin: manifest.origin,
    file: 'original.wav', sha256: entry.sha256, bytes: wav.length, sampleDirectory: sampleDir };
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'synk-registration-proof-'));
  output.database = { location: directory, freshOsTemp: true, existingDatabaseOpened: false, retainedForInspection: true };
  store = new StudioStore(directory);
  const apply = (s, type, payload={}) => store.apply(s.id,s.revision,{ id: `${type}-${s.revision+1}`, type, ...payload });
  const attach = (s, role, name, start, end) => store.attach(s.id,s.revision,{ eventId: name, role, bytes: wav, mimeType:'audio/wav',
    acquisition:'microphone', captureStartedAt:iso(start),captureEndedAt:iso(end) });
  const create = () => {
    let s=store.create({mode:'recording',sourceKind:'synthetic-speech',sampleName:'original.wav'});
    s=attach(s,'original','original-audio',10,20);
    s=apply(s,'task-confirmed',{roleConfirmed:true,pastIndependent:true,exposureScopeConfirmed:true});
    s=apply(s,'review-original',{text:core.TARGET,confirmed:true});
    assert.equal(s.analysis.metrics.accepted,3);
    return s;
  };
  for (const config of [
    {id:'late-before',title:'판정 뒤 수신한 수행 전 object 도움',helpAt:5,expected:'excluded'},
    {id:'late-after',title:'판정 뒤 수신한 수행 후 object 도움',helpAt:25,expected:'accepted'},
    {id:'late-overlap',title:'판정 뒤 수신한 수행 구간 중 object 도움',helpAt:15,expected:'held'},
    {id:'response-not-original',title:'도움 뒤 새 응답을 원래 독립 수행으로 승격하지 않음',helpAt:5,expected:'excluded',response:true}
  ]) {
    const proof={id:config.id,title:config.title,passed:false}; output.scenarios.push(proof);
    try {
      const before=create(); proof.before=snapshot(before);
      let after=apply(before,'help-presented',{text:'친구를',skills:['object'],exposesAnswer:true,at:iso(config.helpAt)});
      const correction=after.effectLedger.entries.at(-1);
      proof.helpEvent=after.events.at(-1);
      proof.correction={summary:correction.summary,transitions:correction.transitions.map(t => ({cellId:t.cellId,action:t.action,
        beforeStatus:t.before?.status,afterStatus:t.after?.status,withdrawnEffect:t.withdrawnEffect,admittedEffect:t.admittedEffect})),sha256:correction.sha256};
      proof.afterHelp=snapshot(after);
      if(config.response){
        after=attach(after,'response','response-audio',30,40);
        after=apply(after,'review-response',{responseId:'response-audio',text:core.TARGET,confirmed:true,exposureScopeConfirmed:true});
        assert.equal(after.analysis.cells.find(c=>c.id==='e1:object').status,'accepted');
        assert.equal(after.analysis.cells.find(c=>c.id==='e1:object').assistance,'after-help');
        assert.equal(after.analysis.cells.find(c=>c.id==='e1:earlier-proof').status,'excluded');
        assert.notEqual(after.original.id,after.responses[0].id);
        proof.sameBytesDistinctEvents={sameHash:after.audios[0].sha256===after.audios[1].sha256,
          occurrenceIds:after.audios.map(a=>a.audioEventId),utteranceIds:[after.original.id,after.responses[0].id]};
      }
      proof.after=snapshot(after);
      assert.equal(after.analysis.cells.find(c=>c.id==='e0:object').status,config.expected);
      assert.equal(after.analysis.cells.find(c=>c.id==='e0:asr').status,'accepted');
      assert.equal(after.analysis.cells.find(c=>c.id==='e0:past').status,'accepted');
      const originalBefore=before.audios.find(a=>a.role==='original'), originalAfter=after.audios.find(a=>a.role==='original');
      proof.originalAudio={before:originalBefore,after:originalAfter,unchanged:canonical(originalBefore)===canonical(originalAfter),
        storedBytesSha256:hash(store.audio(originalAfter.audioRef).bytes)};
      assert.equal(proof.originalAudio.unchanged,true); assert.equal(proof.originalAudio.storedBytesSha256,entry.sha256);
      assert.ok(Date.parse(proof.helpEvent.recordedAt)>Date.parse(proof.helpEvent.at));
      assert.ok(proof.helpEvent.revision>before.revision);
      const bundle=store.export(after.id), full=core.evaluate(bundle.replay.finalState,{forceFull:true});
      proof.computation={incremental:after.analysis.computation,full:full.computation,
        semanticValuesIdentical:canonical(semantic(after.analysis))===canonical(semantic(full))};
      assert.equal(proof.computation.semanticValuesIdentical,true);
      proof.replay=verifyExport(bundle); assert.equal(proof.replay.valid,true);
      proof.replayBundle=bundle;
      proof.passed=true;
    } catch(error) { proof.failure={name:error.name,message:error.message}; }
  }
  output.passed=output.scenarios.length===4 && output.scenarios.every(s=>s.passed);
} catch(error) { output.failure={name:error.name,message:error.message}; }
finally {
  store?.close();
  output.scriptSha256=hash(fs.readFileSync(__filename));
  fs.writeFileSync(path.join(__dirname,'evidence.json'),JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({passed:output.passed,scenarios:output.scenarios.map(s=>({id:s.id,passed:s.passed,failure:s.failure,replay:s.replay,
    correction:s.correction?.summary,semanticValuesIdentical:s.computation?.semanticValuesIdentical})),failure:output.failure},null,2));
  if(!output.passed) process.exitCode=1;
}
