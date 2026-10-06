// Offline export and inspection of a fixed product comparison. No transport or credentials.
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';

export const PACKET_VERSION = 'learning-blind-packet-1';
export const RESULTS_VERSION = 'learning-blind-results-1';
export const EVALUATION_VERSION = 'learning-blind-evaluation-1';
const plain = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const copy = v => JSON.parse(JSON.stringify(v));
const assert = (ok, message) => { if (!ok) throw new TypeError(`Learning blind: ${message}`); };
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function canonicalJSON(value) {
  return JSON.stringify(value, (_key, v) => plain(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v, 2) + '\n';
}
const fingerprint = value => sha256(canonicalJSON(value));
const keyOf = (caseId, trial, provider) => JSON.stringify([caseId, trial, provider]);
const keysOnly = (value, allowed) => plain(value) && Object.keys(value).every(k => allowed.includes(k));
const identifier = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$/.test(v);
const forbiddenRequestKeys = new Set(['baseline', 'rubric', 'acceptableCandidateIds', 'forbiddenCandidateIds', 'expected', 'expectedCandidateId', 'expectedEvidenceId', 'policyAgreement']);

function noExpectedKeys(value) {
  if (!plain(value) && !Array.isArray(value)) return;
  for (const [k, v] of Object.entries(value)) {
    assert(!forbiddenRequestKeys.has(k), `private evaluation field in model input: ${k}`);
    noExpectedKeys(v);
  }
}
export function seededShuffle(values, seed) {
  const out = [...values]; let state = Number.parseInt(sha256(String(seed)).slice(0, 8), 16) >>> 0;
  const random = () => { state += 0x6D2B79F5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
function validateBundle(bundle) {
  assert(plain(bundle) && Array.isArray(bundle.cases) && bundle.cases.length > 0 && bundle.cases.length <= 1000, 'cases required');
  assert(typeof bundle.schemaVersion === 'string' && Array.isArray(bundle.sourceFiles), 'case version and source files required');
  const seen = new Set();
  for (const c of bundle.cases) {
    assert(identifier(c.id) && !seen.has(c.id), 'duplicate or invalid case ID'); seen.add(c.id);
    assert(identifier(c.groupId) && typeof c.label === 'string' && (typeof c.stage === 'string' || Number.isSafeInteger(c.stage)), 'case grouping required');
    assert(keysOnly(c.input, ['observations', 'context', 'candidates']) && Array.isArray(c.input.observations) && Array.isArray(c.input.candidates)
      && c.input.candidates.length > 0 && plain(c.input.context), 'nonempty fixed candidates and observations required');
    noExpectedKeys(c.input);
    for (const list of [c.input.observations, c.input.candidates]) assert(list.every(row => plain(row) && identifier(row.id) && row.id !== 'none') && new Set(list.map(row => row.id)).size === list.length, 'duplicate or invalid input IDs');
    assert(c.input.candidates.every(row => typeof row.label === 'string' && row.label.trim()), 'candidate labels required');
    assert(plain(c.baseline) && c.input.candidates.some(row => row.id === c.baseline.candidateId)
      && (c.baseline.evidenceId === 'none' || c.input.observations.some(row => row.id === c.baseline.evidenceId)), 'baseline outside case vocabulary');
    assert(plain(c.rubric) && Array.isArray(c.rubric.acceptableCandidateIds) && Array.isArray(c.rubric.forbiddenCandidateIds)
      && [...c.rubric.acceptableCandidateIds, ...c.rubric.forbiddenCandidateIds].every(id => c.input.candidates.some(row => row.id === id)), 'rubric outside case vocabulary');
    assert(!c.rubric.acceptableCandidateIds.some(id => c.rubric.forbiddenCandidateIds.includes(id)), 'conflicting authored rubric');
  }
}
async function newDirectory(outDir) {
  const target = resolve(outDir); await mkdir(dirname(target), { recursive: true });
  try { await mkdir(target); } catch (error) { if (error.code === 'EEXIST') throw new Error('Learning blind: output directory already exists; use a fresh path'); throw error; }
  return target;
}
const exclusiveWrite = async (dir, path, value) => { const full = resolve(dir, path); await mkdir(dirname(full), { recursive: true }); await writeFile(full, canonicalJSON(value), { flag: 'wx' }); };
const requestJSON = value => JSON.stringify(value, null, 2) + '\n';
function inside(dir, path) {
  assert(typeof path === 'string' && !isAbsolute(path), 'packet path must be relative');
  const full = resolve(dir, path), rel = relative(resolve(dir), full);
  assert(rel && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel), 'packet path escaped directory'); return full;
}

export async function preparePacket({ outDir, caseBundle, providers, buildRequest, sourceFiles = [], seed = 'synk-learning-blind-v1', preparedAt = new Date().toISOString(), workspace = process.cwd() }) {
  validateBundle(caseBundle);
  assert(plain(providers) && Object.keys(providers).length > 0 && typeof buildRequest === 'function', 'fixed provider adapters required');
  const providerNames = Object.keys(providers), requests = [], files = {}, costs = [];
  for (const [index, c] of caseBundle.cases.entries()) {
    const shuffledCandidates = seededShuffle(c.input.candidates.map(row => row.id), `${seed}:${c.id}:candidates`);
    const shuffledEvidence = seededShuffle([...c.input.observations.map(row => row.id), 'none'], `${seed}:${c.id}:evidence`);
    for (const trial of [0, 1]) {
      const candidateOrder = trial ? [...shuffledCandidates].reverse() : shuffledCandidates;
      const evidenceOrder = trial ? [...shuffledEvidence].reverse() : shuffledEvidence;
      for (const [providerIndex, provider] of providerNames.entries()) {
        const body = buildRequest(provider, copy(c.input), { candidateOrder: [...candidateOrder], evidenceOrder: [...evidenceOrder] });
        assert(plain(body), 'provider request must be an object'); noExpectedKeys(body);
        // Preserve object insertion order too: Jev's criteria objects encode the displayed choices.
        const requestText = requestJSON(body), requestSha256 = sha256(requestText), inputSha256 = fingerprint(c.input);
        const path = `requests/c${String(index + 1).padStart(3, '0')}-t${trial}-p${providerIndex + 1}.json`;
        const config = providers[provider];
        assert(Number.isFinite(config.inputPerMillion) && config.inputPerMillion >= 0 && Number.isFinite(config.outputPerMillion) && config.outputPerMillion >= 0
          && (config.maxOutputTokens === null || Number.isSafeInteger(config.maxOutputTokens) && config.maxOutputTokens > 0), 'pricing metadata required');
        const bytes = Buffer.byteLength(requestText, 'utf8'), inputTokenPlanningBound = bytes + 4096;
        assert(config.maxOutputTokens !== null || config.outputPerMillion === 0, 'priced output without an output bound');
        const outputTokenPlanningBound = config.maxOutputTokens ?? 0;
        const cost = { caseId: c.id, trial, provider, requestBytes: bytes, inputTokenPlanningBound, outputTokenPlanningBound,
          inputPerMillionUSD: config.inputPerMillion, outputPerMillionUSD: config.outputPerMillion,
          estimatedUSD: (inputTokenPlanningBound * config.inputPerMillion + outputTokenPlanningBound * config.outputPerMillion) / 1000000 };
        costs.push(cost);
        requests.push({ caseId: c.id, groupId: c.groupId, trial, provider, model: config.model, path, requestSha256, inputSha256, candidateOrder: [...candidateOrder], evidenceOrder: [...evidenceOrder] });
        files[path] = { sha256: requestSha256, text: requestText };
      }
    }
  }
  const sources = [];
  for (const path of [...new Set([...caseBundle.sourceFiles, ...sourceFiles])]) {
    const full = resolve(workspace, path), bytes = await readFile(full);
    sources.push({ path: full, sha256: sha256(bytes), byteLength: bytes.length });
  }
  const casesSnapshot = copy(caseBundle), casesSha256 = fingerprint(casesSnapshot);
  const manifest = { schemaVersion: PACKET_VERSION, preparedAt, seed, caseSchemaVersion: caseBundle.schemaVersion,
    evaluationSplit: caseBundle.evaluationSplit ?? 'development', caseCount: caseBundle.cases.length,
    groupCount: new Set(caseBundle.cases.map(c => c.groupId)).size, trialsPerCase: 2, providerNames,
    recordCount: requests.length, casesPath: 'private/cases.json', casesSha256,
    inputsSha256: fingerprint(caseBundle.cases.map(c => ({ id: c.id, input: c.input }))), sources, requests,
    providerVersions: Object.fromEntries(providerNames.map(name => [name, { model: providers[name].model,
      inputPerMillion: providers[name].inputPerMillion, outputPerMillion: providers[name].outputPerMillion,
      maxOutputTokens: providers[name].maxOutputTokens }])),
    meaning: 'Prepared requests and authored development checks. No external call, learning effect, model winner, or independent learner sample is implied. Trial 1 reverses trial 0 order.',
  };
  manifest.packetSha256 = fingerprint(manifest);
  const template = { schemaVersion: RESULTS_VERSION, packetSha256: manifest.packetSha256,
    rows: requests.map(row => ({ caseId: row.caseId, trial: row.trial, provider: row.provider, requestSha256: row.requestSha256, status: 'not_run' })) };
  const costEstimate = { schemaVersion: 'learning-blind-cost-planning-1', packetSha256: manifest.packetSha256,
    method: 'Full serialized request UTF-8 bytes plus 4096 input-token allowance; configured maximum output; listed ordinary API rates; no cache/batch discounts.',
    limitation: 'Planning estimate only. Bytes are not measured tokens and this is not a provider-certified bound or billing guarantee. Jev output is unpriced, not a claim of zero output tokens.',
    estimatedTotalUSD: costs.reduce((sum, row) => sum + row.estimatedUSD, 0),
    byProvider: Object.fromEntries(providerNames.map(name => [name, costs.filter(row => row.provider === name).reduce((sum, row) => sum + row.estimatedUSD, 0)])),
    rows: costs, actualUsage: null, actualBilling: null };
  const dir = await newDirectory(outDir);
  await exclusiveWrite(dir, 'private/cases.json', casesSnapshot);
  for (const [path, row] of Object.entries(files)) { const full = resolve(dir, path); await mkdir(dirname(full), { recursive: true }); await writeFile(full, row.text, { flag: 'wx' }); }
  await exclusiveWrite(dir, 'manifest.json', manifest);
  await exclusiveWrite(dir, 'results-template.json', template);
  await exclusiveWrite(dir, 'cost-estimate.json', costEstimate);
  return { outDir: dir, manifest, costEstimate };
}

async function readJSON(path) { return JSON.parse(await readFile(path, 'utf8')); }
export async function readPacket(packetDir) {
  const dir = resolve(packetDir), manifest = await readJSON(resolve(dir, 'manifest.json'));
  assert(manifest.schemaVersion === PACKET_VERSION && Array.isArray(manifest.requests), 'unsupported packet');
  const { packetSha256, ...basis } = manifest;
  assert(packetSha256 === fingerprint(basis), 'packet manifest hash mismatch');
  const rawCases = await readFile(inside(dir, manifest.casesPath));
  assert(sha256(rawCases) === manifest.casesSha256, 'case snapshot hash mismatch');
  const bundle = JSON.parse(rawCases.toString('utf8')); validateBundle(bundle);
  assert(manifest.caseCount === bundle.cases.length && manifest.inputsSha256 === fingerprint(bundle.cases.map(c => ({ id: c.id, input: c.input }))), 'input snapshot hash mismatch');
  assert(manifest.recordCount === manifest.requests.length && new Set(manifest.requests.map(row => keyOf(row.caseId, row.trial, row.provider))).size === manifest.requests.length, 'invalid packet records');
  const caseIds = new Set(bundle.cases.map(c => c.id));
  for (const row of manifest.requests) {
    assert(caseIds.has(row.caseId) && [0, 1].includes(row.trial) && manifest.providerNames.includes(row.provider), 'invalid packet record identity');
    assert(sha256(await readFile(inside(dir, row.path))) === row.requestSha256, 'saved request hash mismatch');
  }
  return { manifest, bundle };
}
function shapeResultRows(results, manifest) {
  assert(keysOnly(results, ['schemaVersion', 'packetSha256', 'rows']) && results.schemaVersion === RESULTS_VERSION && Array.isArray(results.rows), 'invalid results envelope');
  assert(results.packetSha256 === manifest.packetSha256, 'results belong to another packet');
  const expected = new Map(manifest.requests.map(row => [keyOf(row.caseId, row.trial, row.provider), row])), supplied = new Map();
  for (const row of results.rows) {
    assert(keysOnly(row, ['caseId', 'trial', 'provider', 'requestSha256', 'status', 'body', 'error']), 'unexpected result field');
    const key = keyOf(row.caseId, row.trial, row.provider), request = expected.get(key);
    assert(request && !supplied.has(key), 'duplicate or unexpected result identity');
    assert(row.requestSha256 === request.requestSha256, 'result request hash mismatch');
    assert(['not_run', 'completed', 'failed'].includes(row.status), 'invalid result status');
    assert(row.status !== 'not_run' || row.body === undefined && row.error === undefined, 'not_run cannot contain a response');
    assert(row.status !== 'completed' || plain(row.body) && row.error === undefined, 'completed needs a body and no error');
    assert(row.status !== 'failed' || row.error !== undefined && row.body === undefined, 'failed needs an error and no body');
    supplied.set(key, row);
  }
  return supplied;
}

function inspectDecision(c, normalized) {
  const candidate = c.input.candidates.find(row => row.id === normalized.candidateId);
  const evidence = c.input.observations.find(row => row.id === normalized.evidenceId);
  const reasons = [];
  if (!candidate) reasons.push('candidate-outside-vocabulary');
  if (!evidence && normalized.evidenceId !== 'none') reasons.push('evidence-outside-vocabulary');
  if (candidate && c.input.context.audioAvailable !== true && (candidate.audioRequired === true || candidate.modality === 'listening')) reasons.push('audio-not-available');
  if (candidate && candidate.eligible === false) reasons.push('candidate-ineligible');
  let evidenceCompatibility = 'not-rated';
  if (candidate && evidence?.kind === 'language-item-summary') {
    const skills = candidate.skillIds ?? [candidate.skillId];
    evidenceCompatibility = skills.includes(evidence.skillId) && candidate.difficulty === evidence.difficulty && candidate.responseFormat === evidence.responseFormat ? 'same-measurement-cell' : 'different-measurement-cell';
  } else if (normalized.evidenceId === 'none') evidenceCompatibility = 'no-observation-cited';
  const accepted = c.rubric.acceptableCandidateIds;
  return { contractPassed: reasons.length === 0, reasons, evidenceCompatibility,
    authoredCriterion: !candidate || c.rubric.forbiddenCandidateIds.includes(normalized.candidateId) ? 'unacceptable' : !accepted.length ? 'needs-human' : accepted.includes(normalized.candidateId) ? 'acceptable' : 'outside-authored-acceptable-set',
    policyAgreement: { candidate: normalized.candidateId === c.baseline.candidateId, evidence: normalized.evidenceId === c.baseline.evidenceId,
      both: normalized.candidateId === c.baseline.candidateId && normalized.evidenceId === c.baseline.evidenceId },
    teachingQuality: null, learningEffect: null, candidate, evidence };
}
export function evaluateRows({ manifest, bundle, results, normalizeResponse, providers }) {
  assert(typeof normalizeResponse === 'function', 'normalizer required');
  if (providers) for (const name of manifest.providerNames) assert(providers[name]?.model === manifest.providerVersions[name]?.model, 'provider model changed since packet preparation');
  const supplied = shapeResultRows(results, manifest), byCase = new Map(bundle.cases.map(c => [c.id, c]));
  const rows = manifest.requests.map(request => {
    const base = { caseId: request.caseId, groupId: request.groupId, trial: request.trial, provider: request.provider, requestSha256: request.requestSha256 };
    const row = supplied.get(keyOf(request.caseId, request.trial, request.provider));
    if (!row || row.status === 'not_run') return { ...base, status: 'not_run', normalizationPassed: null, contractPassed: null, teachingQuality: null, learningEffect: null, knownUsageCostEstimateUSD: null };
    if (row.status === 'failed') return { ...base, status: 'failed', normalizationPassed: false, contractPassed: false, failure: copy(row.error), teachingQuality: null, learningEffect: null, knownUsageCostEstimateUSD: null };
    let normalized;
    try {
      normalized = normalizeResponse(request.provider, copy(row.body));
      assert(plain(normalized) && identifier(normalized.candidateId) && identifier(normalized.evidenceId), 'invalid normalized decision');
    } catch (error) {
      return { ...base, status: 'failed', normalizationPassed: false, contractPassed: false, failure: String(error.message || error), teachingQuality: null, learningEffect: null, knownUsageCostEstimateUSD: null };
    }
    const inspection = inspectDecision(byCase.get(request.caseId), normalized);
    const config = manifest.providerVersions[request.provider], usage = normalized.usage;
    const knownUsageCostEstimateUSD = config && Number.isSafeInteger(usage?.inputTokens) && usage.inputTokens >= 0 && Number.isSafeInteger(usage?.outputTokens) && usage.outputTokens >= 0
      ? (usage.inputTokens * config.inputPerMillion + usage.outputTokens * config.outputPerMillion) / 1000000 : null;
    return { ...base, status: 'completed', normalizationPassed: true, normalized: copy(normalized), ...inspection, knownUsageCostEstimateUSD };
  });
  const count = status => rows.filter(row => row.status === status).length;
  const completed = rows.filter(row => row.status === 'completed'), contractPass = completed.filter(row => row.contractPassed).length;
  const orderPairs = bundle.cases.flatMap(c => manifest.providerNames.map(provider => {
    const trials = [0, 1].map(trial => rows.find(row => row.caseId === c.id && row.provider === provider && row.trial === trial));
    const comparable = trials.every(row => row?.status === 'completed');
    return { caseId: c.id, groupId: c.groupId, provider, comparable,
      candidateChanged: comparable ? trials[0].normalized.candidateId !== trials[1].normalized.candidateId : null,
      evidenceChanged: comparable ? trials[0].normalized.evidenceId !== trials[1].normalized.evidenceId : null,
      meaning: 'Order sensitivity only. Different educationally equivalent choices are not automatically wrong.' };
  }));
  const summary = { schemaVersion: EVALUATION_VERSION, packetSha256: manifest.packetSha256, evaluationSplit: manifest.evaluationSplit,
    denominator: rows.length, caseCount: bundle.cases.length, groupCount: new Set(bundle.cases.map(c => c.groupId)).size,
    notRun: count('not_run'), failed: count('failed'), completed: count('completed'), contractPassed: contractPass,
    contractPassRateAllExpected: contractPass / rows.length, contractPassRateCompleted: completed.length ? contractPass / completed.length : null,
    policyAgreementCount: completed.filter(row => row.policyAgreement.both).length,
    policyAgreementRateAllExpected: completed.filter(row => row.policyAgreement.both).length / rows.length,
    authoredCriterionAcceptable: completed.filter(row => row.authoredCriterion === 'acceptable').length,
    teachingQuality: null, learningEffect: null, modelWinner: null,
    actualBilling: null, knownUsageCostEstimateUSD: completed.some(row => row.knownUsageCostEstimateUSD !== null)
      ? completed.reduce((sum, row) => sum + (row.knownUsageCostEstimateUSD ?? 0), 0) : null,
    rowsWithUnknownUsageOrBilling: rows.filter(row => row.knownUsageCostEstimateUSD === null).length,
    limitations: ['Missing saved output is not proof that no request was sent or billed.', 'Policy agreement is not recommendation quality.', 'Authored development checks are not held-out accuracy or student learning effects.', 'Providers and order variants are paired observations, not independent learner samples.', 'Provider token usage and listed rates are not a verified invoice.'] };
  return { summary, rows, orderPairs };
}
const md = value => String(value ?? '').replace(/[\\`*_{}\[\]<>|]/g, '\\$&').replace(/[\r\n]+/g, ' ');
export function makeBlindReview({ manifest, bundle, evaluation }) {
  const cases = [], reveal = [], ratings = [];
  for (const c of bundle.cases) for (const trial of [0, 1]) {
    const modelRows = evaluation.rows.filter(row => row.caseId === c.id && row.trial === trial && row.status === 'completed');
    if (!modelRows.length) continue;
    const options = [{ provider: 'current-product-policy', decision: c.baseline }, ...modelRows.map(row => ({ provider: row.provider, decision: row.normalized }))];
    const shuffled = seededShuffle(options, `${manifest.seed}:${c.id}:t${trial}:blind`);
    const cards = shuffled.map((row, index) => {
      const slot = String.fromCharCode(65 + index), candidate = c.input.candidates.find(x => x.id === row.decision.candidateId), evidence = c.input.observations.find(x => x.id === row.decision.evidenceId);
      reveal.push({ caseId: c.id, trial, slot, provider: row.provider });
      ratings.push({ caseId: c.id, trial, slot, taskAppropriateness: null, evidenceSupport: null, overclaimRisk: null, note: '' });
      return { slot, candidateId: candidate?.id ?? null, candidateLabel: candidate?.label ?? '허용 목록 밖 선택',
        evidenceId: evidence?.id ?? (row.decision.evidenceId === 'none' ? 'none' : null), evidence: evidence ? copy(evidence) : null,
        evidenceNote: evidence ? '제공된 관측 원문' : row.decision.evidenceId === 'none' ? '직접 뒷받침하는 관측을 인용하지 않음' : '허용 목록 밖 근거' };
    });
    cases.push({ caseId: c.id, groupId: c.groupId, stage: c.stage, label: c.label, trial, input: copy(c.input), cards,
      comparisonScope: modelRows.length === manifest.providerNames.length ? 'all-saved-completed-outputs' : 'completed-subset', expectedCardCount: manifest.providerNames.length + 1 });
  }
  const review = { schemaVersion: 'learning-blind-review-1', reviewScope: evaluation.summary.notRun || evaluation.summary.failed ? 'completed-subset' : 'all-saved-completed-outputs',
    note: '현재 제품 정책과 실제 저장된 완료 결과만 표시합니다. 빠진 결과를 만들어 채우지 않습니다. 선택과 주요 관측을 동일한 형식으로 표시합니다. 모델 이름·사용량·신뢰도는 별도 봉인 파일에 있습니다.',
    expectedDecisionRecords: manifest.recordCount, savedCompletedDecisionRecords: evaluation.summary.completed, cases,
    rubric: { taskAppropriateness: '0 부적절 / 1 가능한 대안 / 2 다음 실제 과제로 적절', evidenceSupport: '0 무관·과잉해석 / 1 부분 근거 / 2 선택을 지지하는 주요 근거', overclaimRisk: '0 위험 / 1 확인 필요 / 2 과잉단정 없음',
      instruction: '원문 기록과 실제 후보를 보고 독립 판단합니다. 현재 규칙과 일치하는지로 점수를 정하지 않습니다. 교육적으로 동등한 후보를 허용합니다. 학생 학습효과는 여기서 채점하지 않습니다.' } };
  const lines = ['# 맞춤 학습 블라인드 검토', '', review.note, '', `범위: ${review.reviewScope === 'completed-subset' ? '완료된 일부 결과' : '저장된 완료 결과 전체'} · 실제 완료 ${review.savedCompletedDecisionRecords}/${review.expectedDecisionRecords}`, '',
    '각 선택의 다음 과제 적절성·주요 근거·과잉단정 위험을 0~2로 따로 평가합니다. 규칙 일치와 학습 효과를 점수로 대신하지 않습니다.', ''];
  if (!cases.length) lines.push('실제 완료된 모델 결과가 없어 비교 카드를 만들지 않았습니다. 요청 준비만으로 모델 결과를 표시하지 않습니다.');
  for (const c of cases) {
    lines.push(`## ${md(c.caseId)} · ${md(c.label)} · 보기 ${c.trial + 1}`, '', c.comparisonScope === 'completed-subset' ? '완료된 일부 결과만 비교합니다.' : '현재 정책과 세 개 완료 결과를 비교합니다.', '', '학습 기록과 현재 조건:', '', '```json', JSON.stringify(c.input, null, 2), '```', '');
    for (const card of c.cards) lines.push(`### 선택 ${card.slot}`, '', `다음 과제: ${md(card.candidateLabel)} (${md(card.candidateId ?? '허용 밖')})`, '', `근거: ${md(card.evidenceId ?? '허용 밖')} · ${md(card.evidenceNote)}`, '', ...(card.evidence ? ['```json', JSON.stringify(card.evidence, null, 2), '```', ''] : []));
  }
  return { review, markdown: lines.join('\n') + '\n', reveal: { schemaVersion: 'learning-blind-reveal-1', packetSha256: manifest.packetSha256, rows: reveal },
    ratings: { schemaVersion: 'learning-blind-human-ratings-1', completedBy: null, completedAt: null, rows: ratings, learningEffect: null } };
}
export async function evaluatePacket({ packetDir, resultsPath, outDir, normalizeResponse, providers }) {
  const { manifest, bundle } = await readPacket(packetDir), results = await readJSON(resolve(resultsPath));
  const evaluation = evaluateRows({ manifest, bundle, results, normalizeResponse, providers }), blind = makeBlindReview({ manifest, bundle, evaluation });
  const dir = await newDirectory(outDir);
  await exclusiveWrite(dir, 'summary.json', evaluation.summary);
  await exclusiveWrite(dir, 'private/evaluation.json', { schemaVersion: EVALUATION_VERSION, packetSha256: manifest.packetSha256, rows: evaluation.rows, orderPairs: evaluation.orderPairs });
  await exclusiveWrite(dir, 'private/results-original.json', results);
  await exclusiveWrite(dir, 'private/reveal.json', blind.reveal);
  await exclusiveWrite(dir, 'blind-review.json', blind.review);
  await exclusiveWrite(dir, 'human-ratings-template.json', blind.ratings);
  await writeFile(resolve(dir, 'blind-review.md'), blind.markdown, { flag: 'wx' });
  return { outDir: dir, ...evaluation, blindReview: blind.review };
}
