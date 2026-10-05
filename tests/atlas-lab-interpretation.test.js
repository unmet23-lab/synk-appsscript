'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Interpretation = require('../atlas/interpretation');
const Domain = require('../atlas/domain');
const content = require('../docs/마케팅/맞춤도구/computer/content');
const Ask = require('../atlas/ask');
const rules = require('../docs/마케팅/맞춤도구/computer/rules');
const product = import('../experiences/atlas-lab/interpretation.mjs');
const consultation = import('../experiences/atlas-lab/consultation.mjs').then(module => module.createComputerConsultation({ Ask, rules, content }));
const at = '2026-10-05T00:00:00.000Z';
const explicit = '프리미어로 4K 영상을 편집해요. 램 8GB 노트북이 있어요. 매일 들고 다녀요.';
async function session(text = explicit) {
  const { createComputerInterpretation } = await product;
  const instance = createComputerInterpretation({ Interpretation, content, clock: () => at });
  instance.setText(text); return instance;
}
function confirmAll(instance) { for (const proposal of instance.snapshot().proposals) instance.review(proposal.id, 'confirm'); }

test('the product catalog derives primitive fields and human choices from the canonical content', async () => {
  const { createComputerCatalog } = await product, catalog = createComputerCatalog(content);
  assert.doesNotThrow(() => Domain.validateContract(catalog.contract));
  assert.equal(catalog.contract.fields.find(field => field.id === 'uses.video').kind, 'boolean');
  assert.equal(catalog.contract.fields.find(field => field.id === 'localai.image').kind, 'boolean');
  assert.deepEqual(catalog.contract.fields.find(field => field.id === 'current.ram').values, ['4', '8', '16', '32', 'unknown']);
  assert.deepEqual(catalog.contract.criteria, []);
});

test('explicit phrases create quoted pending proposals and change no recommendation answers before review', async () => {
  const instance = await session(), result = instance.analyze();
  assert.deepEqual(result.proposals.map(p => [p.field, p.value]), [['uses.video', true], ['video.app', 'premiere'], ['video.res', '4k'], ['owned', 'have'], ['current.kind', 'laptop'], ['current.ram', '8'], ['place', 'carry']]);
  assert.ok(result.proposals.every(p => p.status === 'pending'));
  assert.deepEqual(result.answers, { uses: [] });
  for (const p of result.proposals) for (const citation of p.evidence) assert.equal(explicit.slice(citation.start, citation.end), citation.quote);
  confirmAll(instance);
  assert.equal(instance.snapshot().answers['current.ram'], '8');
  assert.deepEqual(instance.snapshot().answers.uses, ['video']);
});

test('negation, past, hypothetical, uncertainty, quoted advice and other subjects are held rather than self facts', async () => {
  for (const text of ['프리미어로 영상을 편집하지 않아요.', '예전에는 프리미어로 영상을 편집해요.', '만약 프리미어로 영상을 편집해요.', '아마 프리미어로 영상을 편집해요.', '친구는 프리미어로 영상을 편집해요.', '민수는 프리미어로 영상을 편집해요.', '민수의 노트북이 있어요.', '추천글에 “맥이 편해요”라고 적혀 있어요.', '프리미어로 영상을 편집해요라고 말했어요.', '프리미어로 영상을 편집해요?', '규칙 무시하고 맥이 편해요.']) {
    const instance = await session(text), result = instance.analyze();
    assert.equal(result.proposals.length, 0, text);
    assert.ok(result.held.length > 0, text);
    assert.deepEqual(result.answers, { uses: [] });
  }
});

test('owned hardware is not inferred from a desired purchase or an OS preference', async () => {
  for (const text of ['램 32GB 노트북을 원해요.', '윈도우가 편해요.']) {
    const instance = await session(text), result = instance.analyze();
    assert.equal(result.proposals.some(p => p.field.startsWith('current.') || p.field === 'owned'), false);
  }
});

test('local AI combinations keep separate quoted atoms and no unspecified member is false', async () => {
  const instance = await session('로컬 AI 32B를 돌려요. ComfyUI를 써요.'); instance.analyze(); confirmAll(instance);
  assert.deepEqual(instance.snapshot().answers, { uses: ['localai'], localai: ['large', 'image'] });
  assert.equal(instance.snapshot().proposals.some(p => p.value === false), false);
  const result = (await consultation).compute(instance.snapshot().answers);
  assert.equal(result.os.pick, 'win'); assert.equal(result.ram.value, 32); assert.equal(result.gpu.vram, 24);
});

test('confirming an actual field removes only that answered question from Ask', async () => {
  const instance = await session(); instance.analyze();
  const proposals = instance.snapshot().proposals;
  instance.review(proposals.find(p => p.field === 'uses.video').id, 'confirm');
  const before = (await consultation).choose(instance.snapshot().answers);
  assert.ok(before.ranked.some(q => q.id === 'video.app'));
  instance.review(proposals.find(p => p.field === 'video.app').id, 'confirm');
  const after = (await consultation).choose(instance.snapshot().answers);
  assert.equal(after.ranked.some(q => q.id === 'video.app'), false);
  assert.ok(after.ranked.some(q => q.id === 'video.res'));
});

test('conflicting proposals cannot be confirmed and an explicit correction uses the new user value', async () => {
  const instance = await session('맥이 편해요. 윈도우가 편해요.'); const result = instance.analyze();
  assert.equal(result.proposals.length, 2); assert.ok(result.proposals.every(p => p.status === 'conflict'));
  assert.throws(() => instance.review(result.proposals[0].id, 'confirm'), /unambiguous/);
  instance.review(result.proposals[0].id, 'correct', 'any');
  assert.equal(instance.snapshot().answers.os, 'any');
  assert.equal(instance.snapshot().lineage.at(-1).basis, 'user-correction');
  assert.equal(instance.snapshot().proposals[0].evidence[0].quote, '맥이 편해요.');
});

test('rejection and withdrawal remove only their reviewed field and never create an empty completed multi-answer', async () => {
  const instance = await session('로컬 AI 32B를 돌려요. ComfyUI를 써요.'); const result = instance.analyze();
  const uses = result.proposals.find(p => p.field === 'uses.localai'), large = result.proposals.find(p => p.field === 'localai.large'), image = result.proposals.find(p => p.field === 'localai.image');
  instance.review(uses.id, 'confirm'); instance.review(large.id, 'correct', false); instance.review(image.id, 'reject');
  assert.deepEqual(instance.snapshot().answers, { uses: ['localai'] });
  assert.ok((await consultation).choose(instance.snapshot().answers).ranked.some(q => q.id === 'localai'));
  instance.review(large.id, 'correct', true); instance.review(large.id, 'withdraw');
  assert.deepEqual(instance.snapshot().answers, { uses: ['localai'] });
});

test('manual values always win over confirmations and corrections and survive clearing the source', async () => {
  const instance = await session('윈도우가 편해요.'); instance.analyze();
  instance.setManual('os', 'mac'); const p = instance.snapshot().proposals[0];
  instance.review(p.id, 'confirm'); assert.equal(instance.snapshot().answers.os, 'mac');
  instance.review(p.id, 'correct', 'any'); assert.equal(instance.snapshot().answers.os, 'mac');
  instance.clearText(); assert.deepEqual(instance.snapshot().answers, { uses: [], os: 'mac' });
});

test('a manually clicked member does not promote other text-derived members into manual answers', async () => {
  const instance = await session(); instance.analyze(); confirmAll(instance);
  instance.setManualMember('uses.web', true);
  assert.deepEqual(instance.snapshot().answers.uses, ['web', 'video']);
  instance.clearText(); assert.deepEqual(instance.snapshot().answers, { uses: ['web'] });
});

test('a complete manually confirmed multi-set overrides text members and invalid values are refused', async () => {
  const instance = await session('로컬 AI 32B를 돌려요.'); instance.analyze(); confirmAll(instance);
  instance.setManual('localai', ['image']); assert.deepEqual(instance.snapshot().answers.localai, ['image']);
  assert.throws(() => instance.setManual('localai', ['invented']), /invalid/);
  assert.throws(() => instance.setManual('os', '__proto__'), /invalid/);
  assert.throws(() => instance.setManualMember('uses.video', 'true'), /invalid/);
});

test('editing or replacing source text immediately withdraws old text facts while preserving manual facts', async () => {
  const instance = await session(); instance.analyze(); confirmAll(instance); instance.setManual('budget', 'lt100');
  instance.setText('윈도우가 편해요.');
  assert.deepEqual(instance.snapshot().answers, { uses: [], budget: 'lt100' });
  assert.equal(instance.snapshot().reviews.length, 0);
  instance.analyze(); assert.equal(instance.snapshot().answers.os, undefined);
});

test('host request/ingest is replaceable, source-bound and rejects late responses after edits or manual choices', async () => {
  const { extractComputerProposals } = await product;
  for (const change of [instance => instance.setText('맥이 편해요.'), instance => instance.setManual('os', 'mac')]) {
    const instance = await session(), request = instance.buildExtractionRequest();
    const result = extractComputerProposals({ source: request.sources[0], catalog: instance.catalog });
    change(instance);
    assert.throws(() => instance.ingest({ requestId: request.id, revision: request.revision, ...result }), /stale/);
  }
});

test('malformed or failed same-source re-analysis preserves confirmed answers; valid replacement requires new reviews', async () => {
  const { extractComputerProposals } = await product, instance = await session(); instance.analyze(); confirmAll(instance);
  const before = instance.snapshot().answers, request = instance.buildExtractionRequest();
  assert.deepEqual(instance.snapshot().answers, before);
  const result = extractComputerProposals({ source: request.sources[0], catalog: instance.catalog });
  const bad = structuredClone(result); bad.proposals[0].evidence[0].quote = '허위 인용';
  assert.throws(() => instance.ingest({ requestId: request.id, revision: request.revision, ...bad }), /quotation/);
  assert.deepEqual(instance.snapshot().answers, before);
  instance.ingest({ requestId: request.id, revision: request.revision, ...result });
  assert.deepEqual(instance.snapshot().answers, { uses: [] });
  assert.equal(instance.snapshot().reviews.length, 0);
});

test('host held quotes and mode metadata are bounded and source-checked before committing', async () => {
  const { extractComputerProposals } = await product, instance = await session(); instance.analyze(); confirmAll(instance);
  const before = instance.snapshot().answers, request = instance.buildExtractionRequest();
  const result = extractComputerProposals({ source: request.sources[0], catalog: instance.catalog });
  for (const metadata of [{ held: [{ start: 0, end: 2, quote: '가짜', reason: '대기' }] }, { held: Array(101).fill({}) }, { extractor: 'x'.repeat(81) }, { extractor: {} }]) {
    assert.throws(() => instance.ingest({ requestId: request.id, revision: request.revision, ...result, ...metadata }), /metadata|quotation/);
    assert.deepEqual(instance.snapshot().answers, before);
  }
});

test('quoted external proposal packets use the same review gate rather than auto-applying model output', async () => {
  const instance = await session('원하는 운영체제는 직접 확인할게요.'), request = instance.buildExtractionRequest();
  const source = request.sources[0], proposal = { id: 'external-p1', field: 'os', value: 'mac', subject: 'other', stance: 'current', evidence: [{ sourceId: source.id, start: 0, end: source.text.length, quote: source.text }] };
  instance.ingest({ requestId: request.id, revision: request.revision, proposals: [proposal] });
  assert.equal(instance.snapshot().proposals[0].status, 'blocked');
  assert.throws(() => instance.review(proposal.id, 'confirm'), /unambiguous/);
  assert.throws(() => instance.review(proposal.id, 'correct', 'mac'), /unavailable/);
  assert.deepEqual(instance.snapshot().answers, { uses: [] });
});

test('UTF-16 quote offsets survive emoji and repeated statements are bounded without duplicate facts', async () => {
  const instance = await session('💻 프리미어로 4K 영상을 편집해요.\n맥이 편해요.'); const result = instance.analyze();
  for (const proposal of result.proposals) for (const e of proposal.evidence) assert.equal(instance.snapshot().text.slice(e.start, e.end), e.quote);
  const repeated = await session('맥이 편해요. '.repeat(300));
  assert.equal(repeated.analyze().proposals.length, 1);
  assert.throws(() => repeated.setText('x'.repeat(4001)), /4000/);
});

test('plain particles, polite endings and explicit currency range connectors preserve the same fields', async () => {
  for (const text of ['영상편집해요.', '영상 편집을 합니다.']) {
    const instance = await session(text); assert.ok(instance.analyze().proposals.some(p => p.field === 'uses.video' && p.value === true));
  }
  for (const text of ['예산은 100~150만원이에요.', '예산은 100만원에서 150만원 사이입니다.']) {
    const instance = await session(text); assert.ok(instance.analyze().proposals.some(p => p.field === 'budget' && p.value === '100_150'));
  }
  for (const text of ['현재 램은 16GB입니다.', '지금 컴퓨터의 램은 16GB입니다.', '램 16GB 노트북이 있습니다.']) {
    const instance = await session(text); assert.ok(instance.analyze().proposals.some(p => p.field === 'current.ram' && p.value === '16'), text);
  }
});

test('turning a use off retires its manually answered details, while other uses and global conditions remain', async () => {
  const instance = await session('');
  instance.setManual('uses', ['localai', 'video']);
  instance.setManual('localai', ['huge']);
  instance.setManual('video.app', 'premiere');
  instance.setManual('os', 'win');
  instance.setManualMember('uses.localai', false);
  assert.equal(Object.hasOwn(instance.snapshot().manual, 'localai'), false);
  instance.setManualMember('uses.localai', true);
  assert.equal(instance.snapshot().answers.localai, undefined);
  assert.equal(instance.snapshot().answers['video.app'], 'premiere');
  assert.equal(instance.snapshot().answers.os, 'win');
  assert.ok((await consultation).choose(instance.snapshot().answers).ranked.some(q => q.id === 'localai'));
});

test('parent removal withdraws confirmed text details without deleting proposals and allows explicit reconfirmation', async () => {
  const instance = await session('로컬 AI 70B를 돌려요.'); instance.analyze(); confirmAll(instance);
  const original = instance.snapshot().proposals, detail = original.find(p => p.field === 'localai.huge');
  instance.setManualMember('uses.localai', false);
  assert.equal(instance.snapshot().proposals.length, original.length);
  assert.equal(instance.snapshot().proposals.find(p => p.id === detail.id).review.action, 'withdraw');
  instance.setManualMember('uses.localai', true);
  assert.equal(instance.snapshot().answers.localai, undefined);
  instance.review(detail.id, 'confirm');
  assert.deepEqual(instance.snapshot().answers.localai, ['huge']);
});

test('withdrawing or correcting a text parent retires both manual and reviewed detail answers', async () => {
  for (const action of ['withdraw', 'correct']) {
    const instance = await session('로컬 AI 70B를 돌려요.'); instance.analyze(); confirmAll(instance);
    instance.setManual('localai', ['large']);
    const parent = instance.snapshot().proposals.find(p => p.field === 'uses.localai');
    instance.review(parent.id, action, false);
    assert.equal(Object.hasOwn(instance.snapshot().manual, 'localai'), false);
    instance.review(parent.id, 'confirm');
    assert.equal(instance.snapshot().answers.localai, undefined);
    const detail = instance.snapshot().proposals.find(p => p.field === 'localai.huge');
    assert.equal(detail.review.action, 'withdraw');
  }
});

test('changing ownership retires device details from manual and source records instead of hiding them until have returns', async () => {
  for (const owner of ['new', 'extra']) {
    const instance = await session('램 4GB 노트북이 있어요.'); instance.analyze(); confirmAll(instance);
    instance.setManual('current.kind', 'desktop');
    instance.setManual('current.os', 'win11');
    instance.setManual('budget', 'lt100');
    const ram = instance.snapshot().proposals.find(p => p.field === 'current.ram');
    instance.setManual('owned', owner);
    assert.equal(Object.keys(instance.snapshot().manual).some(key => key.startsWith('current.')), false);
    assert.equal(instance.snapshot().proposals.find(p => p.id === ram.id).review.action, 'withdraw');
    instance.setManual('owned', 'have');
    assert.equal(instance.snapshot().answers['current.ram'], undefined);
    assert.equal(instance.snapshot().answers.budget, 'lt100');
    instance.review(ram.id, 'confirm');
    assert.equal(instance.snapshot().answers['current.ram'], '4');
  }
});

test('changing a confirmed ownership proposal also retires current-device details', async () => {
  const instance = await session('램 4GB 노트북이 있어요.'); instance.analyze(); confirmAll(instance);
  const owner = instance.snapshot().proposals.find(p => p.field === 'owned');
  instance.review(owner.id, 'correct', 'new');
  instance.review(owner.id, 'confirm');
  assert.equal(instance.snapshot().answers['current.ram'], undefined);
  assert.equal(instance.snapshot().proposals.find(p => p.field === 'current.ram').review.action, 'withdraw');
});

test('detail-first confirmation remains pending behind its parent and initial activation does not discard it', async () => {
  const instance = await session('로컬 AI 70B를 돌려요. 램 4GB 노트북이 있어요.'); instance.analyze();
  const proposals = instance.snapshot().proposals;
  instance.review(proposals.find(p => p.field === 'localai.huge').id, 'confirm');
  instance.review(proposals.find(p => p.field === 'current.ram').id, 'confirm');
  assert.equal(instance.snapshot().answers.localai, undefined);
  assert.equal(instance.snapshot().answers['current.ram'], undefined);
  instance.review(proposals.find(p => p.field === 'uses.localai').id, 'confirm');
  instance.review(proposals.find(p => p.field === 'owned').id, 'confirm');
  assert.deepEqual(instance.snapshot().answers.localai, ['huge']);
  assert.equal(instance.snapshot().answers['current.ram'], '4');
});

test('full-set manual selection and later member changes cannot override one another by object insertion order', async () => {
  const instance = await session('');
  instance.setManualMember('uses.localai', false);
  instance.setManual('uses', ['localai']);
  assert.deepEqual(instance.snapshot().answers.uses, ['localai']);
  instance.setManualMember('uses.localai', false);
  assert.deepEqual(instance.snapshot().answers.uses, []);
  instance.setManualMember('uses.video', true);
  assert.deepEqual(instance.snapshot().answers.uses, ['video']);
});

test('ordinary explicit activities, present RAM categories and portability statements accept common formal endings', async () => {
  const cases = [
    ['웹 AI로 문서를 작성합니다.', 'uses.web', true], ['문서를 작성해요.', 'uses.web', true],
    ['현재 RAM은 64GB입니다.', 'current.ram', '32'], ['지금 컴퓨터의 램은 128GB입니다.', 'current.ram', '32'],
    ['들고 다녀야 합니다.', 'place', 'carry'], ['매일 들고 다닙니다.', 'place', 'carry'],
    ['집에서만 씁니다.', 'place', 'home'], ['책상에서만 사용합니다.', 'place', 'home'],
    ['가끔 들고 다녀야 합니다.', 'place', 'both'],
  ];
  for (const [text, field, value] of cases) {
    const instance = await session(text), result = instance.analyze();
    assert.ok(result.proposals.some(p => p.field === field && p.value === value), text);
    assert.equal(result.proposals.some(p => p.field === field && p.value !== value), false, text);
    for (const p of result.proposals) for (const e of p.evidence) assert.equal(text.slice(e.start, e.end), e.quote);
  }
});

test('formal grammar expansion does not promote negated, past, reported or hypothetical sentences', async () => {
  for (const text of ['웹 AI로 문서를 작성하지 않습니다.', '과거에는 현재 RAM은 64GB라고 말했어요.', '친구는 집에서만 씁니다.', '만약 들고 다녀야 합니다.', '민수는 웹 AI로 문서를 작성합니다.', '현재 RAM은 64GB였어요.']) {
    const instance = await session(text), result = instance.analyze();
    assert.equal(result.proposals.length, 0, text);
    assert.ok(result.held.length, text);
  }
});

test('ownership particles and first-person possessive forms support present device and local AI declarations', async () => {
  for (const text of ['컴퓨터가 있어요.', '제 컴퓨터가 있습니다.', '컴퓨터를 쓰고 있어요.']) {
    const instance = await session(text), result = instance.analyze();
    assert.ok(result.proposals.some(p => p.field === 'owned' && p.value === 'have'), text);
  }
  for (const text of ['제 램은 16GB입니다.', '내 RAM은 64GB입니다.', '제 컴퓨터의 램은 8GB입니다.']) {
    const instance = await session(text), result = instance.analyze();
    assert.ok(result.proposals.some(p => p.field === 'current.ram'), text);
    assert.ok(result.proposals.some(p => p.field === 'owned' && p.value === 'have'), text);
  }
  for (const text of ['제 컴퓨터에 8B 대화 AI 모델을 설치해서 씁니다.', '내 컴퓨터에서 8B 대화 AI 모델을 실행합니다.', '제컴퓨터에8B대화AI모델을설치해서씁니다.']) {
    const instance = await session(text), result = instance.analyze();
    assert.ok(result.proposals.some(p => p.field === 'uses.localai' && p.value === true), text);
    assert.ok(result.proposals.some(p => p.field === 'localai.small' && p.value === true), text);
    assert.equal(result.proposals.some(p => p.field === 'current.ram'), false, 'model parameters are not installed RAM');
    for (const p of result.proposals) for (const e of p.evidence) assert.equal(text.slice(e.start, e.end), e.quote);
  }
});

test('new ownership forms still withhold negative, conditional, past and other-person statements', async () => {
  for (const text of ['컴퓨터가 없어요.', '제 램은 16GB였어요.', '친구 컴퓨터가 있어요.', '민수의 램은 16GB입니다.', '만약 제 컴퓨터에 8B 대화 AI 모델을 설치해서 씁니다.', '제 컴퓨터에 8B 대화 AI 모델을 쓰지 않습니다.']) {
    const instance = await session(text), result = instance.analyze();
    assert.equal(result.proposals.length, 0, text);
    assert.ok(result.held.length, text);
  }
});
