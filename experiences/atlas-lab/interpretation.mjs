// Product vocabulary and a deliberately limited, free, local expression matcher.
// Core owns citation validation and confirmation; this adapter never treats a
// matched phrase as a confirmed answer and makes no language-model call.
export const COMPUTER_EXTRACTOR = 'computer-explicit-ko-1';
export const MAX_COMPUTER_TEXT = 4000;
const clone = value => JSON.parse(JSON.stringify(value));

export function createComputerCatalog(content) {
  const fields = [];
  for (const step of content.steps) {
    const label = step.short || step.eyebrow || step.title;
    if (step.type === 'multi') for (const option of step.options) fields.push({ id: `${step.id}.${option.id}`, about: step.id,
      member: option.id, label: `${label} · ${option.label}`, kind: 'boolean', options: [{ id: true, label: '맞아요' }, { id: false, label: '해당하지 않아요' }] });
    else for (const field of step.type === 'group' ? step.fields : [step]) fields.push({
      id: step.type === 'group' ? `${step.id}.${field.id}` : step.id,
      about: step.type === 'group' ? `${step.id}.${field.id}` : step.id,
      label: step.type === 'group' ? `${label} · ${field.label}` : label, kind: 'enum',
      options: field.options.map(option => ({ id: option.id, label: option.label, ...(option.sub ? { description: option.sub } : {}) })),
    });
  }
  const contract = { id: 'computer.consultation', version: '1', purpose: 'computer-recommendation',
    fields: fields.map(field => ({ id: field.id, kind: field.kind, ...(field.kind === 'enum' ? { values: field.options.map(option => option.id) } : {}) })), criteria: [] };
  return { contract, fields };
}

export function extractComputerProposals({ source, catalog }) {
  if (!source || typeof source.id !== 'string' || typeof source.text !== 'string' || source.text.length > MAX_COMPUTER_TEXT) throw new TypeError('Computer interpretation: invalid source');
  const known = new Map(catalog.fields.map(field => [field.id, field])), proposals = [], held = [];
  for (const sentence of source.text.matchAll(/[^.!?\n]+[.!?]*/gu)) {
    const quote = sentence[0].trim();
    if (!quote) continue;
    const start = sentence.index + sentence[0].indexOf(quote), end = start + quote.length;
    const unknownSubject = [...quote.matchAll(/(?:^|\s)([가-힣]{1,8})(?:는|은|이가|이|가)(?=\s)/gu)].some(match => !['저', '제', '나', '내', '예산', '윈도우', '맥', '노트북', '데스크톱', '컴퓨터', '램', '영상', '프로그램', '운영체제'].includes(match[1]));
    const reason = /["'“”‘’«»]|라고|라던|라더|대요|답니다|추천글|리뷰|기사|후기|말했|적혀|인용/u.test(quote) ? '인용이나 전해 들은 말은 직접 선택으로 확인해 주세요.'
      : unknownSubject || /친구|동료|직원|학생|부모|엄마|아빠|동생|언니|누나|남편|아내|아들|그 사람/u.test(quote)
        || [...quote.matchAll(/([가-힣]{1,8})의\s/gu)].some(match => !['저', '나', '컴퓨터', '노트북', '데스크톱'].includes(match[1])) ? '다른 사람의 이야기일 수 있어요.'
      : /아니|않|못|없|싫|말고|제외|(?:^|\s)안\s|안써|안해/u.test(quote) ? '부정 표현은 직접 선택으로 확인해 주세요.'
      : /예전|과거|작년|지난|전에는|했었|썼|쓰던|하던|(?:했|였|었|았)(?:어요|습니다|고|지만|는데|던)/u.test(quote) ? '과거와 현재를 구분해서 직접 선택해 주세요.'
      : /만약|다면|경우|가정|언젠가|나중에|미래|계획|예정|생각|수도|아마|모르|고민|할까|일까|가능하면|[?？]|(?:하|되|쓰|사|으)면/u.test(quote) ? '조건이나 불확실한 뜻은 직접 선택으로 확인해 주세요.'
      : /무시|시스템|명령|규칙|JSON|프롬프트|confirmed|proposal|지시/iu.test(quote) ? '설정 지시문은 상담 조건으로 사용하지 않아요.' : null;
    if (reason) { held.push({ quote, start, end, reason }); continue; }
    const values = new Map(), add = (field, value) => { if (known.has(field)) values.set(`${field}:${value}`, { field, value }); };
    // Match explicit activities and common polite endings, not a mere product
    // name. The sentence-level uncertainty/subject guard still runs first.
    if (/웹\s*AI(?:를|로)?\s*(?:(?:문서|글)(?:를|을)?\s*)?(?:써요|씁니다|사용해요|사용합니다|작성해요|작성합니다)|(?:문서|글쓰기)(?:만|를|로)?\s*(?:해요|합니다|작업해요|작업합니다|작성해요|작성합니다)|(?:ChatGPT|챗지피티|클로드|Claude|Gemini|제미나)(?:를|로)?\s*(?:써요|씁니다|사용해요|사용합니다|대화해요|대화합니다)/iu.test(quote)) add('uses.web', true);
    if (/(?:화상회의|온라인\s*수업)(?:를|을|도)?\s*(?:해요|들어요|합니다)/u.test(quote)) add('uses.meeting', true);
    const video = /영상(?:을)?\s*편집(?:을)?\s*(?:해요|합니다)|(?:프리미어|캡컷|다빈치\s*리졸브|파이널\s*컷)(?:로|를)[^.]{0,30}편집(?:을)?\s*(?:해요|합니다)/u.test(quote);
    if (video) {
      add('uses.video', true);
      for (const [pattern, value] of [[/프리미어/u, 'premiere'], [/캡컷/u, 'capcut'], [/다빈치\s*리졸브/u, 'resolve'], [/파이널\s*컷/u, 'fcp']]) if (pattern.test(quote)) add('video.app', value);
      if (/4K/iu.test(quote)) add('video.res', '4k');
      if (/FHD/iu.test(quote)) add('video.res', 'fhd');
    }
    if (/(?:포토샵|라이트룸)(?:을|으로|으로도|도|을 써서)?[^.]{0,20}(?:보정해요|작업해요|써요|사용해요)/u.test(quote)) { add('uses.photo', true); add('photo', 'adobe'); }
    if (/(?:웹사이트|웹\s*개발)(?:를|을|도)?\s*(?:만들어요|해요)/u.test(quote)) { add('uses.code', true); add('code', 'web'); }
    if (/(?:아이폰|모바일|안드로이드)\s*앱(?:을|도)?\s*(?:만들어요|개발해요)/u.test(quote)) { add('uses.code', true); add('code', 'mobile'); }
    const local = /(?:로컬\s*AI|(?:내|제)\s*컴퓨터(?:에|에서)[^.]{0,20}AI|Ollama|올라마|LM\s*Studio)[^.]{0,35}(?:돌려요|돌립니다|실행해요|실행합니다|써요|씁니다|사용해요|사용합니다|설치해요|설치합니다)/iu.test(quote);
    const image = /(?:ComfyUI|컴피유아이|Stable\s*Diffusion|FLUX)(?:를|도)?\s*(?:돌려요|돌립니다|써요|씁니다|사용해요|사용합니다|설치해요|설치합니다)/iu.test(quote);
    if (local || image) {
      add('uses.localai', true);
      if (image || /이미지\s*생성/u.test(quote)) add('localai.image', true);
      for (const [pattern, value] of [[/\b(?:4|8)\s*B\b/iu, 'small'], [/\b(?:12|14)\s*B\b/iu, 'mid'], [/\b(?:27|32)\s*B\b/iu, 'large'], [/\b70\s*B\b/iu, 'huge']]) if (pattern.test(quote)) add(`localai.${value}`, true);
    }
    if (/PC\s*게임(?:을|도)?\s*(?:해요|합니다)|게임(?:을|도)?\s*할\s*거예요/iu.test(quote)) add('uses.game', true);
    const currentRam = /(?:현재|지금|제|내)\s*(?:(?:컴퓨터|노트북|데스크톱)(?:의)?\s*)?(?:램|RAM)(?:은|이|\s*용량은)?\s*(\d+)\s*GB\b/iu.exec(quote);
    const owned = /(?:컴퓨터|노트북|데스크톱)(?:이|가|을|를|은|는|으로)?\s*(?:있어요|있습니다|쓰고\s*있어요|사용\s*중이에요)/u.test(quote) || !!currentRam;
    if (owned) {
      add('owned', 'have');
      if (/노트북/u.test(quote)) add('current.kind', 'laptop');
      if (/데스크톱/u.test(quote)) add('current.kind', 'desktop');
      for (const match of quote.matchAll(/(?:램|RAM)(?:은|이|\s*용량은)?\s*(\d+)\s*GB\b/giu)) {
        const gb = Number(match[1]);
        // The source question's last option means "32GB or more". Keep the
        // exact quote but project only capacities represented by that catalog.
        if (Number.isSafeInteger(gb) && gb >= 32) add('current.ram', '32');
        else if ([4, 8, 16].includes(gb)) add('current.ram', String(gb));
      }
      if (/윈도우\s*11/u.test(quote)) add('current.os', 'win11');
      if (/윈도우\s*10/u.test(quote)) add('current.os', 'win10');
    }
    if (/(?:컴퓨터|노트북|데스크톱)(?:를|을)?\s*새로\s*살\s*거예요/u.test(quote)) add('owned', 'new');
    if (/윈도우가\s*편해요/u.test(quote)) add('os', 'win');
    if (/맥이\s*편해요/u.test(quote)) add('os', 'mac');
    const occasionalCarry = /가끔\s*들고\s*(?:다녀요|다닙니다|다녀야\s*(?:해요|합니다))/u.test(quote);
    if (occasionalCarry) add('place', 'both');
    else if (/(?:매일|자주)\s*들고\s*(?:다녀요|다닙니다|다녀야\s*(?:해요|합니다))|들고\s*다녀야\s*(?:해요|합니다)/u.test(quote)) add('place', 'carry');
    if (/(?:집|책상)에서만\s*(?:써요|씁니다|사용해요|사용합니다)/u.test(quote)) add('place', 'home');
    for (const [pattern, value] of [[/예산(?:은|이)?\s*100만\s*원\s*미만/u, 'lt100'], [/예산(?:은|이)?\s*100(?:만\s*원)?\s*(?:[~∼-]|에서)\s*150만\s*원/u, '100_150'], [/예산(?:은|이)?\s*150(?:만\s*원)?\s*(?:[~∼-]|에서)\s*250만\s*원/u, '150_250'], [/예산(?:은|이)?\s*250만\s*원\s*이상/u, 'gt250']]) if (pattern.test(quote)) add('budget', value);
    if (!values.size) held.push({ quote, start, end, reason: '지원하는 명시 표현과 맞지 않아요. 아래에서 직접 골라 주세요.' });
    for (const value of values.values()) if (!proposals.some(proposal => proposal.field === value.field && proposal.value === value.value)) proposals.push({ id: `${source.id}:p${proposals.length + 1}`, ...value, subject: 'self', stance: 'current', evidence: [{ sourceId: source.id, start, end, quote }] });
  }
  return { proposals, held: held.slice(0, 100), extractor: COMPUTER_EXTRACTOR };
}

export function createComputerInterpretation({ Interpretation, content, scope = { domain: 'SHIFT', workspace: 'computer-consultation', subject: 'local-session' }, clock = () => new Date().toISOString() }) {
  const catalog = createComputerCatalog(content), byId = new Map(catalog.fields.map(field => [field.id, field]));
  const steps = new Map(content.steps.map(step => [step.id, step]));
  let text = '', sources = [], proposals = [], reviews = [], held = [], manual = {}, revision = 0, sequence = 0, request = null, mode = null;
  let at = clock();
  const tick = () => { at = new Date(Math.max(Date.parse(clock()), Date.parse(at) + 1)).toISOString(); };
  const input = () => ({ contract: catalog.contract, scope, sources, proposals, reviews, at });
  function structured(flat) {
    const result = {};
    for (const [about, value] of Object.entries(flat)) {
      const [group, field] = about.split('.');
      if (field) result[group] = { ...(result[group] || {}), [field]: value }; else result[group] = value;
    }
    return result;
  }
  function answersFrom(understanding) {
    const output = { uses: [] };
    for (const field of understanding.fields) {
      if (!field.usable) continue;
      const definition = byId.get(field.id);
      if (definition.kind === 'boolean') {
        // Only explicit positive members form an answer. A negative statement or
        // absent member must not manufacture an empty completed multi-question.
        if (field.value === true) (output[definition.about] ||= []).push(definition.member);
      } else output[definition.about] = field.value;
    }
    // A clicked use chip overrides that member, not every other text-derived use.
    // A confirmed multi-question, in contrast, supplies a complete manual set.
    for (const [about, value] of Object.entries(manual)) {
      const definition = byId.get(about);
      if (definition?.kind === 'boolean') {
        const members = new Set(output[definition.about] || []);
        if (value) members.add(definition.member); else members.delete(definition.member);
        if (members.size || definition.about === 'uses') output[definition.about] = [...members]; else delete output[definition.about];
      } else output[about] = clone(value);
    }
    const current = structured(output);
    for (const [about] of Object.entries(output)) {
      const step = steps.get(about.split('.')[0]);
      if (step?.when && !step.when(current)) delete output[about];
    }
    for (const step of content.steps.filter(step => step.type === 'multi')) if (output[step.id]) output[step.id] = step.options.map(option => option.id).filter(id => output[step.id].includes(id));
    return output;
  }
  function retireDependentAnswers(before) {
    const result = Interpretation.resolve(input()), after = answersFrom(result.understanding);
    const previous = structured(before), current = structured(after);
    const retired = new Set();
    for (const step of content.steps) {
      if (!step.when) continue;
      // Turning off a parent retires its previous detail answers. Changing
      // which ownership situation is being assessed also needs fresh details,
      // even when both have/extra expose the same question group.
      const wasActive = step.when(previous), active = step.when(current);
      const changedOwner = before.owned !== undefined && before.owned !== after.owned
        && (wasActive || active) && !step.when({ ...current, owned: undefined });
      if ((wasActive && !active) || changedOwner) retired.add(step.id);
    }
    if (!retired.size) return;
    manual = Object.fromEntries(Object.entries(manual).filter(([key]) => !retired.has((byId.get(key)?.about || key).split('.')[0])));
    for (const field of result.understanding.fields) {
      if (!field.usable || !retired.has(byId.get(field.id).about.split('.')[0])) continue;
      const lineage = result.lineage.find(item => field.evidence.includes(item.observationId));
      if (!lineage) continue;
      tick();
      const event = Interpretation.review({ ...input(), id: `computer-review-${++sequence}`, proposalId: lineage.proposalId, action: 'withdraw' });
      reviews = [...reviews, event];
    }
  }
  function snapshot() {
    const result = Interpretation.resolve(input());
    return clone({ text, revision, mode, held, manual, sources, reviews, ...result, answers: answersFrom(result.understanding) });
  }
  function setText(value) {
    if (typeof value !== 'string' || value.length > MAX_COMPUTER_TEXT) throw new TypeError('Computer interpretation: text must be at most 4000 characters');
    if (text === value) return snapshot();
    text = value; sources = []; proposals = []; reviews = []; held = []; mode = null; request = null; revision += 1; tick();
    return snapshot();
  }
  function buildExtractionRequest() {
    if (!text.trim()) throw new TypeError('Computer interpretation: write a source first');
    revision += 1; tick();
    const pendingSources = [{ id: `computer-source-${++sequence}`, scope: clone(scope), at, text, actor: 'self' }];
    // Re-analysis leaves the previous review in place until a complete, valid
    // replacement arrives. Failure/stale delivery must not erase confirmed facts.
    request = { id: `computer-request-${sequence}`, revision, sources: pendingSources };
    return clone({ ...request, contract: catalog.contract, scope, catalog: catalog.fields,
      instructions: 'Return only cited proposals in the supplied field vocabulary. Proposals are unconfirmed; preserve uncertainty, past, hypothetical and other-person statements. Do not fill missing fields.' });
  }
  function ingest({ requestId, revision: responseRevision, proposals: incoming, held: deferred = [], extractor = 'host-proposals' }) {
    if (!request || request.id !== requestId || request.revision !== responseRevision || revision !== responseRevision) throw new Error('Computer interpretation: stale response');
    // Validate before committing: malformed citations/fields cannot erase a valid draft.
    Interpretation.prepare({ ...input(), sources: request.sources, proposals: incoming, reviews: [] });
    if (typeof extractor !== 'string' || !extractor.trim() || extractor.length > 80 || !Array.isArray(deferred) || deferred.length > 100) throw new TypeError('Computer interpretation: invalid response metadata');
    for (const item of deferred) if (!item || !Number.isInteger(item.start) || !Number.isInteger(item.end) || item.start < 0 || item.end <= item.start
      || typeof item.quote !== 'string' || !item.quote.trim() || request.sources[0].text.slice(item.start, item.end) !== item.quote || item.end > request.sources[0].text.length
      || typeof item.reason !== 'string' || !item.reason.trim() || item.reason.length > 240) throw new TypeError('Computer interpretation: invalid held quotation');
    sources = request.sources; proposals = clone(incoming); reviews = []; held = clone(deferred); mode = extractor; request = null;
    return snapshot();
  }
  function analyze() {
    const pending = buildExtractionRequest(), result = extractComputerProposals({ source: pending.sources[0], catalog });
    return ingest({ requestId: pending.id, revision: pending.revision, ...result });
  }
  function review(proposalId, action, value) {
    const before = snapshot().answers;
    tick();
    const event = Interpretation.review({ ...input(), id: `computer-review-${++sequence}`, proposalId, action, ...(action === 'correct' ? { value } : {}) });
    reviews = [...reviews, event]; revision += 1; request = null;
    retireDependentAnswers(before);
    return snapshot();
  }
  function setManual(about, value) {
    const step = steps.get(about.split('.')[0]);
    const field = catalog.fields.find(item => item.about === about);
    if (!step || !field) throw new TypeError('Computer interpretation: unknown manual field');
    if (step.type === 'multi') {
      if (!Array.isArray(value) || new Set(value).size !== value.length || value.some(member => !step.options.some(option => option.id === member))) throw new TypeError('Computer interpretation: invalid manual choices');
    } else if (!field.options.some(option => option.id === value)) throw new TypeError('Computer interpretation: invalid manual value');
    const before = snapshot().answers;
    if (step.type === 'multi') manual = Object.fromEntries(Object.entries(manual).filter(([key]) => byId.get(key)?.about !== about));
    manual = { ...manual, [about]: clone(value) }; revision += 1; request = null; tick();
    retireDependentAnswers(before);
    return snapshot();
  }
  function setManualMember(field, value) {
    if (byId.get(field)?.kind !== 'boolean' || typeof value !== 'boolean') throw new TypeError('Computer interpretation: invalid manual member');
    const before = snapshot().answers, definition = byId.get(field);
    if (Object.hasOwn(manual, definition.about)) {
      const members = new Set(manual[definition.about]);
      if (value) members.add(definition.member); else members.delete(definition.member);
      manual = { ...manual, [definition.about]: [...members] };
    } else manual = { ...manual, [field]: value };
    revision += 1; request = null; tick();
    retireDependentAnswers(before);
    return snapshot();
  }
  return Object.freeze({ catalog: clone(catalog), snapshot, setText, clearText: () => setText(''), buildExtractionRequest, ingest, analyze, review, setManual, setManualMember });
}
