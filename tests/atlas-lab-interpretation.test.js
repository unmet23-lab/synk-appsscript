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

test('complete predicates and whole subjects prevent substring facts from denial, transitions and other people', async () => {
  const texts = [
    '제 램은 16GB가 아닙니다.', '지금 램은 8GB가 아닌 16GB입니다.', '현재 RAM은 64GB가 아님.',
    '예산은 100~150만원이 아닙니다.', '제 램은 16GB였다가 32GB로 올렸어요.',
    '제 램은 8GB에서 16GB로 바꿨어요.', '지금 램은 8GB에서 32GB가 됐어요.',
    'Tom은 프리미어로 4K 영상을 편집해요.', '민수 컴퓨터가 있어요.', '민수만 맥이 편해요.',
    '팀장님도 윈도우가 편해요.', '3팀은 프리미어로 영상을 편집해요.', '형 노트북이 있어요.',
    '제 램은 16GB인 것 같아요.', '제 램은 16GB일 거예요.', '제 램은 32GB면 좋겠어요.',
    '사려고 봐 둔 램 32GB 노트북이 있어요.', '제 램은 32GB로 늘릴 거예요.', '제 램은 16GB 이상이어야 해요.',
    'Ollama는 무거워서 ChatGPT를 써요.', 'LM Studio는 지웠고 Gemini를 써요.',
    '로컬 AI보다 웹 AI를 써요.', '포토샵보다 캔바를 써요.', '아이패드를 매일 들고 다녀요.',
    '4K 모니터로 영상을 편집해요.', '내 컴퓨터에서 ChatGPT 같은 AI를 사용해요.',
  ];
  for (const text of texts) {
    const instance = await session(text), result = instance.analyze();
    assert.deepEqual(result.proposals, [], text);
    assert.ok(result.held.length, text);
    assert.deepEqual(result.answers, { uses: [] });
    for (const h of result.held) assert.equal(text.slice(h.start, h.end), h.quote);
  }
});

test('supported self/current statements retain useful facts without confusing cloud AI, monitor size or parameter count', async () => {
  const texts = [
    ['저는 프리미어로 4K 영상을 편집합니다.', [['uses.video', true], ['video.app', 'premiere'], ['video.res', '4k']]],
    ['제 컴퓨터에서 웹 AI를 써요.', [['uses.web', true]]],
    ['지금 제 컴퓨터에서 ChatGPT를 사용합니다.', [['uses.web', true]]],
    ['저는 포토샵으로 사진을 보정해요.', [['uses.photo', true], ['photo', 'adobe']]],
    ['제 노트북을 매일 들고 다녀요.', [['place', 'carry']]],
    ['내 데스크톱을 집에서만 씁니다.', [['place', 'home']]],
    ['제 예산은 150만원에서 250만원 사이입니다.', [['budget', '150_250']]],
    ['컴퓨터를 새로 살 거예요.', [['owned', 'new']]],
    ['Ollama로 8B 모델을 돌립니다.', [['uses.localai', true], ['localai.small', true]]],
  ];
  for (const [text, expected] of texts) {
    const instance = await session(text), result = instance.analyze();
    assert.deepEqual(result.proposals.map(p => [p.field, p.value]), expected, text);
    assert.ok(result.proposals.every(p => p.status === 'pending'));
    assert.deepEqual(result.answers, { uses: [] });
    for (const p of result.proposals) for (const e of p.evidence) assert.equal(text.slice(e.start, e.end), e.quote);
  }
  const instance = await session('제 램은 16GB가 아닙니다. 현재 램은 32GB입니다.');
  const result = instance.analyze();
  assert.deepEqual(result.proposals.map(p => [p.field, p.value]), [['owned', 'have'], ['current.ram', '32']]);
  assert.equal(result.held.length, 1);
});

test('source edits retire dependent manual details before a removed use or device can be enabled again', async () => {
  for (const change of [instance => instance.clearText(), instance => instance.setText('윈도우가 편해요.')]) {
    const instance = await session('로컬 AI 70B를 돌려요. 램 8GB 노트북이 있어요.');
    instance.analyze(); confirmAll(instance);
    instance.setManual('localai', ['large']); instance.setManual('current.os', 'win11'); instance.setManual('budget', 'lt100');
    change(instance);
    assert.equal(Object.hasOwn(instance.snapshot().manual, 'localai'), false);
    assert.equal(Object.hasOwn(instance.snapshot().manual, 'current.os'), false);
    instance.setManualMember('uses.localai', true); instance.setManual('owned', 'have');
    assert.equal(instance.snapshot().answers.localai, undefined);
    assert.equal(instance.snapshot().answers['current.os'], undefined);
    assert.equal(instance.snapshot().answers.budget, 'lt100');
  }
});

test('quoted or unresolved subject context cannot leak through a period, while an explicit self statement resumes matching', async () => {
  for (const text of [
    '친구가 “프리미어로 영상을 편집해요. 맥이 편해요. 매일 들고 다녀요.”라고 했어요.',
    'Tom은 컴퓨터를 좋아해요. 프리미어로 4K 영상을 편집해요.',
    '예전 이야기예요. 램 8GB 노트북이 있어요.',
  ]) {
    const instance = await session(text), result = instance.analyze();
    assert.deepEqual(result.proposals, [], text);
    for (const h of result.held) assert.equal(text.slice(h.start, h.end), h.quote);
  }
  const instance = await session('Tom은 영상을 편집해요. 저는 웹 AI를 써요. 맥이 편해요.');
  assert.deepEqual(instance.analyze().proposals.map(p => [p.field, p.value]), [['uses.web', true], ['os', 'mac']]);
});

test('source edits preserve details whose parent is still explicitly manual, and unchanged text does not retire facts', async () => {
  const instance = await session('로컬 AI 70B를 돌려요.'); instance.analyze(); confirmAll(instance);
  instance.setManual('uses', ['localai']); instance.setManual('localai', ['large']);
  instance.setText('로컬 AI 70B를 돌려요.');
  assert.ok(instance.snapshot().proposals.some(p => p.review?.action === 'confirm'));
  instance.clearText();
  assert.deepEqual(instance.snapshot().answers, { uses: ['localai'], localai: ['large'] });
});
