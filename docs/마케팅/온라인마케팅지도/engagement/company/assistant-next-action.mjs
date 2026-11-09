import { createHash } from 'node:crypto';

export const NEXT_ACTION_POLICY = 'next-action-v1';
const SOURCES = ['messenger', 'client', 'publication'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fail = message => Object.assign(new Error(message), { status: 400 });
const demand = (condition, message = '추천할 업무 자료를 확인하지 못했어요.') => { if (!condition) throw new Error(message); };
const text = (value, limit = 300) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 500 && !/[\u0000-\u001f\u007f]/u.test(value);
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const kstDate = timestamp => new Date(timestamp + 9 * 3600000).toISOString().slice(0, 10);
const dateValue = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const instantValue = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));

function parseKey(value) {
  if (typeof value !== 'string' || value.length > 2000) throw fail('추천 항목을 다시 불러와 주세요.');
  let parts; try { parts = JSON.parse(value); } catch { throw fail('추천 항목을 다시 불러와 주세요.'); }
  if (!Array.isArray(parts) || parts.length !== 3 || !SOURCES.includes(parts[0]) || !identifier(parts[1]) || typeof parts[2] !== 'string' || !/^[a-f0-9]{64}$/.test(parts[2]) || JSON.stringify(parts) !== value) throw fail('추천 항목을 다시 불러와 주세요.');
  return parts;
}

export function validateNextActionInput(input) {
  if (!object(input) || input.intent !== 'next-action') throw fail('추천 요청을 다시 확인해 주세요.');
  const exclusions = input.exclusions === undefined ? [] : input.exclusions;
  if (!Array.isArray(exclusions) || exclusions.length > 100) throw fail('넘긴 추천은 한 번에 100개까지 확인할 수 있어요.');
  for (const key of exclusions) parseKey(key);
  if (input.candidateKey !== undefined) parseKey(input.candidateKey);
  return { exclusions: [...new Set(exclusions)], candidateKey: input.candidateKey };
}

// Only the existing staff workspace pages may be opened. No API, external URL,
// protocol-relative URL, redirect parameter, or duplicate query key is accepted.
export function safeNextActionHref(value) {
  if (typeof value !== 'string' || value.length > 2000 || !value.startsWith('/?') || /[\\\u0000-\u0020\u007f]/u.test(value)) return null;
  let url; try { url = new URL(value, 'https://workspace.invalid'); } catch { return null; }
  if (url.origin !== 'https://workspace.invalid' || url.pathname !== '/' || url.hash) return null;
  const query = url.searchParams, keys = [...query.keys()];
  if (new Set(keys).size !== keys.length) return null;
  const allowed = new Set(['tab', 'section']);
  if (query.get('tab') === 'social') {
    if (!['today', 'fix'].includes(query.get('section'))) return null;
  } else if (query.get('tab') === 'workroom' && query.get('section') === 'clients') {
    for (const key of ['project', 'version', 'message', 'seconds', 'rights', 'rightsTarget', 'followUp', 'delivery', 'schedule', 'requests', 'changes', 'kickoff', 'closeout']) allowed.add(key);
    if (!identifier(query.get('project'))) return null;
    for (const key of ['version', 'message', 'rightsTarget']) if (query.has(key) && !identifier(query.get(key))) return null;
    for (const key of ['rights', 'followUp', 'delivery', 'schedule', 'requests', 'changes', 'kickoff', 'closeout']) if (query.has(key) && query.get(key) !== '1') return null;
    if (query.has('seconds') && (!/^\d+(?:\.\d+)?$/.test(query.get('seconds')) || !Number.isFinite(Number(query.get('seconds'))))) return null;
  } else if (query.get('tab') === 'workroom' && query.get('section') === 'tools') {
    for (const key of ['tool', 'publicationAction', 'inboxId', 'productionId', 'versionId', 'packageId', 'publicationFormat', 'entryId', 'checkpoint']) allowed.add(key);
    if (query.get('tool') !== 'publication' || !['prepare', 'review', 'publish', 'performance', 'link'].includes(query.get('publicationAction'))) return null;
    for (const key of ['inboxId', 'productionId', 'versionId', 'packageId', 'entryId']) if (query.has(key) && !identifier(query.get(key))) return null;
    const action = query.get('publicationAction');
    if (action === 'prepare' && !query.has('inboxId') && !(query.has('productionId') && query.has('versionId'))) return null;
    if (['review', 'publish'].includes(action) && !query.has('packageId')) return null;
    if (action === 'performance' && (!query.has('entryId') || !['24h', '72h'].includes(query.get('checkpoint')))) return null;
    if (action === 'link' && !query.has('packageId') && !query.has('entryId')) return null;
    if (query.has('publicationFormat') && !['youtube-shorts', 'youtube-video', 'instagram-reels'].includes(query.get('publicationFormat'))) return null;
  } else return null;
  if (keys.some(key => !allowed.has(key))) return null;
  return '/?' + query.toString();
}

function dueDate(value, label) {
  if (value === null || value === undefined || value === '') return null;
  demand(dateValue(value));
  return { value, precision: 'date', timezone: 'Asia/Seoul', label };
}
function dueInstant(value, label) {
  demand(instantValue(value));
  return { value: new Date(value).toISOString(), precision: 'instant', timezone: 'Asia/Seoul', label };
}
function candidate(source, row, { context, action, reason, checks, due, version, attention = false }) {
  demand(object(row) && identifier(row.id) && text(row.title));
  const base = { id: source + ':' + row.id, source, sourceId: row.id, title: text(row.title), context, action, reasons: [reason], checks, due };
  const sourceVersion = fingerprint({ ...base, version });
  return { ...base, sourceVersion, key: JSON.stringify([source, row.id, sourceVersion]), _attention: attention };
}

// A message edit does not increment task.revision. Bind confirmation and skips
// to the request, references and result actually visible in the source, while
// ignoring reactions, bookmarks, read acknowledgements and no-op edit times.
function messageVersion(message) {
  if (!message) return null;
  const reference = value => !value ? null : {
    id: value.id ?? null, body: value.body ?? null, authorId: value.user?.id ?? null, deleted: value.deleted === true,
    files: (value.files || []).map(file => ({ id: file.id, name: file.name, size: file.size, mime: file.mime })).sort((a, b) => String(a.id).localeCompare(String(b.id))),
  };
  return { ...reference(message),
    workspaceLink: message.workspaceLink ? { title: message.workspaceLink.title, url: message.workspaceLink.url, kind: message.workspaceLink.kind } : null,
    replyToId: message.replyToId ?? null, replyTo: reference(message.replyTo),
    mentionIds: (message.mentions || []).map(user => user.id).sort(), ackRequired: message.ackRequired === true,
  };
}

function messengerCandidates(data) {
  demand(object(data) && object(data.today?.groups) && object(data.remaining?.groups));
  const today = data.today.groups, remaining = data.remaining.groups;
  for (const key of ['reply', 'due', 'review', 'recovery']) demand(Array.isArray(today[key]));
  for (const key of ['upcoming', 'undated', 'waiting']) demand(Array.isArray(remaining[key]));
  const rows = new Map();
  for (const row of [...today.reply, ...today.due, ...today.review, ...today.recovery, ...remaining.upcoming, ...remaining.undated]) {
    demand(object(row) && identifier(row.id));
    const previous = rows.get(row.id);
    demand(!previous || JSON.stringify(previous) === JSON.stringify(row));
    rows.set(row.id, row);
  }
  const items = []; let unavailableCount = 0;
  for (const row of rows.values()) {
    demand(['requested', 'accepted', 'doing', 'review', 'changes', 'done'].includes(row.stage) && Array.isArray(row.allowedStages) && typeof row.canManage === 'boolean' && typeof row.assigneeUnavailable === 'boolean' && typeof row.reviewerUnavailable === 'boolean');
    if (row.stage === 'done' || row.status === 'done') continue;
    const recovery = row.reviewerUnavailable && row.canReassignReviewer === true && !row.assigneeUnavailable;
    if (!row.canManage || row.assigneeUnavailable || row.reviewerUnavailable && !recovery || !recovery && !row.allowedStages.length) { unavailableCount++; continue; }
    demand(identifier(row.channelId) && /^[1-9]\d*$/.test(String(row.messageId)) && Number.isInteger(row.revision) && row.revision >= 1);
    const label = recovery ? '검토자 지정하기' : { requested: '요청 확인하기', accepted: '작업 시작하기', doing: '작업 이어가기', review: '결과물 검토하기', changes: '수정 내용 확인하기' }[row.stage];
    const explanation = recovery ? '이 업무의 검토자를 다시 지정할 수 있어요.' : { requested: '내가 수락할 요청이 있어요.', accepted: '내가 수락한 업무예요.', doing: '내가 진행 중인 업무예요.', review: '지금 내가 결과물을 검토할 차례예요.', changes: '내가 맡은 업무에 수정 요청이 있어요.' }[row.stage];
    items.push(candidate('messenger', row, {
      context: '내 업무', action: { type: 'messenger', label, channelId: row.channelId, messageId: String(row.messageId), panel: 'tasks' },
      reason: { code: recovery ? 'reviewer_recovery' : 'task_' + row.stage, text: explanation },
      checks: recovery ? ['요청과 결과물을 확인해 주세요.', '이 대화방에서 검토할 크루를 골라 주세요.'] : row.stage === 'review' ? ['연결된 결과물을 열어 주세요.', '요청한 내용과 결과물을 비교해 주세요.'] : ['원래 요청과 참고 자료를 확인해 주세요.', row.stage === 'changes' ? '답글에 남은 수정 의견을 확인해 주세요.' : '현재 업무 상태에서 이어서 처리해 주세요.'],
      due: dueDate(row.dueDate, '업무 기한'), version: { revision: row.revision, stage: row.stage, allowedStages: row.allowedStages, recovery, message: messageVersion(row.message), resultMessage: messageVersion(row.resultMessage) },
    }));
  }
  return { items, unavailableCount };
}

function clientCandidates(data) {
  demand(object(data) && Array.isArray(data.todayItems) && Array.isArray(data.deferredItems) && object(data.rechecks));
  const items = [];
  for (const row of data.todayItems) {
    demand(object(row) && ['reply', 'review', 'next', 'waiting'].includes(row.group));
    if (row.group === 'waiting' || ['done', 'archived'].includes(row.status)) continue;
    demand(identifier(row.id) && row.id.startsWith('client:') && typeof row.kind === 'string');
    const recheck = data.rechecks[row.id];
    demand(object(recheck) && typeof recheck.fingerprint === 'string' && ['active', 'changed', 'due', 'overdue'].includes(recheck.state));
    const href = safeNextActionHref(row.href); demand(href);
    const dateLabels = { follow_up: '고객 연락일', client_rights_expiry: '사용 조건 기한', client_kickoff: '자료 확인일', delivery_receipt: '수령 확인일', client_closeout: '마감 확인일' };
    items.push(candidate('client', row, {
      context: text(row.projectTitle, 180) || '고객 업무', action: { type: 'workspace', label: text(row.actionLabel, 80) || (row.group === 'review' ? '검토할 결과 열기' : '고객 업무 열기'), href },
      reason: { code: 'client_' + row.group, text: row.group === 'review' ? '지금 내가 고객 작업의 결과를 검토할 차례예요.' : row.group === 'reply' ? '내가 처리할 고객 요청이 있어요.' : (text(row.statusLabel, 100) || '고객 업무 확인 필요') + ' 상태로 기록되어 있어요.' },
      checks: ['프로젝트의 현재 요청과 자료를 확인해 주세요.', row.group === 'review' ? '수정 요청과 결과물을 비교해 주세요.' : '해당 화면에서 처리한 결과를 남겨 주세요.'],
      due: dueDate(row.dueDate, dateLabels[row.kind] || '프로젝트 기한'), version: { fingerprint: recheck.fingerprint, state: recheck.state, status: row.status },
      attention: ['client_delivery_check', 'client_rights_expiry'].includes(row.kind),
    }));
  }
  return { items, unavailableCount: 0 };
}

function publicationCandidates(data) {
  demand(object(data) && Array.isArray(data.items));
  const items = [];
  for (const row of data.items) {
    demand(object(row) && ['reply', 'review', 'next', 'waiting'].includes(row.group));
    if (row.group === 'waiting' || ['done', 'published', 'archived'].includes(row.status)) continue;
    demand(identifier(row.id) && /^(?:publication|social):/.test(row.id) && typeof row.kind === 'string');
    const href = safeNextActionHref(row.href); demand(href);
    const due = row.kind === 'publication_performance' ? dueInstant(row.createdAt, '성과 확인 시각') : null;
    const attention = ['failed', 'blocked', 'unknown', 'missed', 'manual', 'manual_required', 'manual-required', 'reconnect_required', 'link-error', 'needs-work'].includes(row.status);
    const review = row.status === 'review' || row.kind === 'publication_review';
    items.push(candidate('publication', row, {
      context: row.kind === 'publication_social' ? 'SNS 운영' : '게시 준비·성과', action: { type: 'workspace', label: text(row.actionLabel, 80) || '게시 업무 열기', href },
      reason: { code: attention ? 'publication_attention' : review ? 'publication_review' : 'publication_next', text: row.status === 'unknown' ? '실제 발행 여부가 아직 확인되지 않았어요.' : (text(row.statusLabel, 100) || '게시 업무 확인 필요') + ' 상태로 기록되어 있어요.' },
      checks: row.status === 'unknown' ? ['실제 채널에서 게시 여부를 먼저 확인해 주세요.', '확인 전에는 같은 게시물을 다시 보내지 마세요.'] : review ? ['해당 채널의 원고와 미디어를 확인해 주세요.', '기존 점검 화면에서 남은 항목을 처리해 주세요.'] : ['원본 화면에서 현재 상태를 확인해 주세요.', '처리한 결과와 실제 주소·시각을 구분해 남겨 주세요.'],
      due, version: { status: row.status, updatedAt: row.updatedAt || null, versionId: row.versionId || null, packageId: row.packageId || null, checkpointHours: row.checkpointHours || null, formats: row.channelFormats || [] }, attention,
    }));
  }
  return { items, unavailableCount: 0 };
}

function ranked(item, at, date) {
  let bucket = 5, order = Number.MAX_SAFE_INTEGER, duePhase = 'undated';
  const reasons = [...item.reasons];
  if (item.due) {
    const due = item.due, day = due.precision === 'date' ? due.value : kstDate(Date.parse(due.value));
    order = due.precision === 'date' ? Date.parse(due.value + 'T00:00:00+09:00') : Date.parse(due.value);
    if (due.precision === 'instant' ? order < at : day < date) { bucket = 0; duePhase = 'overdue'; reasons.unshift({ code: 'due_overdue', text: due.label + '이 지났어요.' }); }
    else if (day === date) { bucket = 1; duePhase = 'today'; reasons.unshift({ code: 'due_today', text: due.label + '이 오늘이에요.' }); }
    else { bucket = 4; duePhase = 'upcoming'; reasons.unshift({ code: 'due_upcoming', text: due.value + ' ' + due.label + '이 있어요.' }); }
  }
  if (bucket > 1 && item._attention) bucket = 2;
  const response = item.reasons.some(reason => /^(task_requested|task_changes|task_review|reviewer_recovery|client_reply|client_review|publication_review)$/.test(reason.code));
  if (bucket > 2 && response) bucket = 3;
  const { _attention, ...value } = item;
  // Crossing a real due boundary revives a skipped suggestion. Merely asking
  // again later in the same phase does not rotate its key.
  const sourceVersion = fingerprint([item.sourceVersion, duePhase]);
  return { value: { ...value, sourceVersion, key: JSON.stringify([item.source, item.sourceId, sourceVersion]), reasons }, bucket, order };
}

// Authorized source projections are inputs; this function never reads or writes
// storage. Missing/malformed sources cannot turn into an empty workload.
export function buildNextAction({ now, sources, exclusions = [], candidateKey } = {}) {
  const options = validateNextActionInput({ intent: 'next-action', exclusions, ...(candidateKey === undefined ? {} : { candidateKey }) });
  demand(instantValue(now), '서버 시계를 확인하지 못했어요.');
  const at = Date.parse(now), generatedAt = new Date(at).toISOString(), date = kstDate(at), coverage = {}, items = [];
  let unavailableCount = 0;
  const adapters = { messenger: messengerCandidates, client: clientCandidates, publication: publicationCandidates };
  for (const source of SOURCES) {
    try {
      demand(sources?.[source]?.ok === true);
      const normalized = adapters[source](sources[source].value), unique = new Map();
      for (const item of normalized.items) { const prior = unique.get(item.id); demand(!prior || prior.key === item.key); unique.set(item.id, item); }
      const result = [...unique.values()]; items.push(...result); unavailableCount += normalized.unavailableCount;
      coverage[source] = { status: 'ok', count: result.length, unavailableCount: normalized.unavailableCount };
    } catch { coverage[source] = { status: 'error', count: 0, unavailableCount: 0 }; }
  }
  const rankedItems = items.map(item => ranked(item, at, date)).sort((a, b) => a.bucket - b.bucket || a.order - b.order || a.value.id.localeCompare(b.value.id));
  const all = rankedItems.map(row => row.value), hidden = new Set(options.exclusions), visible = all.filter(row => !hidden.has(row.key));
  const failed = SOURCES.filter(source => coverage[source].status === 'error').length;
  let candidateCheck = null;
  if (candidateKey !== undefined) {
    const [source, sourceId] = parseKey(candidateKey), current = all.find(row => row.source === source && row.sourceId === sourceId);
    candidateCheck = coverage[source].status !== 'ok' ? { status: 'unverified', candidate: null } : current ? { status: current.key === candidateKey ? 'confirmed' : 'changed', candidate: current } : { status: 'missing', candidate: null };
  }
  return { status: failed === SOURCES.length ? 'unknown' : failed ? 'partial' : visible.length ? 'ready' : 'empty', generatedAt, date, policyVersion: NEXT_ACTION_POLICY, coverage,
    next: visible[0] || null, alternatives: visible.slice(1, 6), excludedCount: all.length - visible.length, unavailableCount, totalCount: all.length, candidateCheck };
}
