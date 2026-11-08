/* SYNK Temper: count measured practice evidence, never infer learning causality.
 * `measure` reads new-item independent attempts per concept and per comparison
 * arm (the arm recorded on each Atlas decision). `compare` checks two runs of the
 * same inputs, for example two implementations; it is not a learning measure.
 * `groups` reads the two arms of one comparison per evaluation-only group.
 * None is a significance test, a policy promotion gate or a cohort learner.
 * `check` is the guard of Core's moment-level challenge (flow.js reads it; the simulation
 * in temper-flow.js re-exports it). It depends on nothing, so neither depends on the other.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkTemper = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'temper-practice-2';
  const TRAIL = 'trail-practice-2';
  const scopeKey = scope => `${scope.domain}/${scope.workspace}/${scope.subject}`;
  const taskKey = p => JSON.stringify([p.taskId, p.taskVersion, p.itemKey, [...p.conceptIds].sort(), p.firstExposure,
    p.measure ? [p.measure.skillId, p.measure.modality, p.measure.difficulty, p.measure.familyKey,
      p.measure.audioRequired, p.measure.confounded, p.measure.responseFormat || 'unknown'] : null]);
  function summaries(input) {
    const rows = Array.isArray(input) ? input : [input];
    const seen = new Set();
    for (const row of rows) {
      if (!row || row.version !== TRAIL || !row.scope || !Array.isArray(row.attempts) || !Array.isArray(row.presentations)
        || !Array.isArray(row.help)) throw new TypeError('Temper: use a Trail practice summary');
      const key = scopeKey(row.scope);
      if (seen.has(key)) throw new TypeError('Temper: duplicate scope would double-count evidence');
      seen.add(key);
      const attempts = new Set();
      for (const attempt of row.attempts) {
        if (attempts.has(attempt.eventId)) throw new TypeError('Temper: duplicate attempt');
        attempts.add(attempt.eventId);
      }
    }
    return rows;
  }
  const bucket = () => ({ evaluated: 0, correct: 0, incorrect: 0, accuracy: null });
  const close = b => { if (b.evaluated) b.accuracy = b.correct / b.evaluated; return b; };
  // Re-check provenance rather than trusting a caller's derived flag.
  const counted = a => a.independent === true && !a.exclusionReason && a.assisted === false && a.exposure === 'new'
    && ['correct', 'incorrect'].includes(a.verdict)
    && (!a.measure || (!a.measure.confounded && (!a.measure.audioRequired || a.audio === 'completed')));
  function measure(input) {
    const rows = summaries(input);
    // Concept and arm names come from data, so their tables have no prototype to overwrite.
    const result = { scopes: rows.length, presented: 0, attempts: 0, independent: bucket(), byConcept: Object.create(null), byArm: Object.create(null),
      assisted: 0, unknownAssistance: 0, repeat: 0, unknownExposure: 0, unassessed: 0, skipped: 0, excludedAttempts: 0 };
    for (const row of rows) {
      result.presented += row.presentations.length;
      result.excludedAttempts += row.excludedAttempts || 0;
      for (const a of row.attempts) {
        result.attempts += 1;
        if (a.assisted === true) result.assisted += 1;
        else if (a.assisted === null) result.unknownAssistance += 1;
        if (a.exposure === 'repeat') result.repeat += 1;
        else if (a.exposure === 'unknown') result.unknownExposure += 1;
        if (a.verdict === 'unassessed') result.unassessed += 1;
        if (a.verdict === 'skipped') result.skipped += 1;
        if (!counted(a)) continue;
        const slot = (table, name) => table[name] || (table[name] = bucket());
        const targets = [result.independent, ...a.conceptIds.map(id => slot(result.byConcept, id)), slot(result.byArm, a.arm || 'unrecorded')];
        for (const b of targets) { b.evaluated += 1; b[a.verdict] += 1; }
      }
    }
    close(result.independent);
    Object.values(result.byConcept).forEach(close);
    Object.values(result.byArm).forEach(close);
    return { ...result, status: result.independent.evaluated ? 'measured' : 'no_sample', learningEffectClaim: false };
  }
  // The sum of two measures over disjoint attempts (for example a folded ledger and the log after it).
  function combine(a, b) {
    if (!a) return b; if (!b) return a;
    const sum = (x, y) => close({ evaluated: x.evaluated + y.evaluated, correct: x.correct + y.correct, incorrect: x.incorrect + y.incorrect, accuracy: null });
    const table = (x, y) => {
      const out = Object.create(null);
      for (const [k, v] of Object.entries(x || {})) out[k] = sum(v, bucket());
      for (const [k, v] of Object.entries(y || {})) out[k] = sum(out[k] || bucket(), v);
      return out;
    };
    const result = { scopes: Math.max(a.scopes, b.scopes), presented: a.presented + b.presented, attempts: a.attempts + b.attempts,
      independent: sum(a.independent, b.independent), byConcept: table(a.byConcept, b.byConcept), byArm: table(a.byArm, b.byArm),
      assisted: a.assisted + b.assisted, unknownAssistance: a.unknownAssistance + b.unknownAssistance, repeat: a.repeat + b.repeat,
      unknownExposure: a.unknownExposure + b.unknownExposure, unassessed: a.unassessed + b.unassessed, skipped: a.skipped + b.skipped,
      excludedAttempts: a.excludedAttempts + b.excludedAttempts };
    return { ...result, status: result.independent.evaluated ? 'measured' : 'no_sample', learningEffectClaim: false };
  }
  function compare({ before, after } = {}) {
    const left = summaries(before), right = summaries(after);
    const tasks = rows => new Map(rows.map(row => [scopeKey(row.scope), row.presentations.map(taskKey).sort()]));
    const l = tasks(left), r = tasks(right), reasons = [];
    if (JSON.stringify([...l.keys()].sort()) !== JSON.stringify([...r.keys()].sort())) reasons.push('scope_mismatch');
    else for (const [scope, set] of l) if (JSON.stringify(set) !== JSON.stringify(r.get(scope))) { reasons.push('task_mismatch'); break; }
    const b = measure(left), a = measure(right), comparable = reasons.length === 0;
    const measured = b.status === 'measured' && a.status === 'measured';
    return { version: VERSION, comparable, status: !comparable ? 'not_comparable' : !measured ? 'no_sample' : 'measured', reasons,
      before: b, after: a, independentAccuracyDifference: comparable && measured ? a.independent.accuracy - b.independent.accuracy : null,
      comparisonUnit: 'same-input-run', learningEffectClaim: false, causalClaim: false,
      limitations: ['Same inputs run twice: a check of the implementation, not of learning.',
        'Learning is read from new-item independent attempts per concept and per arm with measure().'] };
  }
  // Evaluation-only groups (공개판 설계 #evaluation-demographics, Atlas §7-4): before a new way is
  // widened, check that it is not worse for any group, including age bands and genders people
  // chose to give for statistics. The aggregation host joins `labels` (scope key → {dimension:
  // value}) from a store kept apart from Trail, Core and personalization; nothing here reads or
  // keeps who a person is. Each person counts once per arm (the mean of their new-item
  // independent accuracy), so a frequent user cannot speak for a group. A cell with fewer than
  // `minimum` people in either arm is not compared and its size is not reported. This shows where
  // a way looks worse; it is not a significance test and it does not promote anything.
  const MINIMUM_PER_CELL = 30;
  const label = value => typeof value === 'string' && /^[a-zA-Z0-9_.+-]{1,40}$/.test(value);
  function groups({ rows, labels, arms, minimum = MINIMUM_PER_CELL, tolerance = 0 } = {}) {
    const input = summaries(rows);
    if (!labels || typeof labels !== 'object' || Array.isArray(labels)) throw new TypeError('Temper: labels by scope are required');
    if (!Array.isArray(arms) || arms.length !== 2 || !arms.every(label) || arms[0] === arms[1]) throw new TypeError('Temper: name the baseline and candidate arms');
    if (!Number.isSafeInteger(minimum) || minimum < 1) throw new TypeError('Temper: minimum must be a positive integer');
    if (!(typeof tolerance === 'number' && tolerance >= 0 && tolerance < 1)) throw new TypeError('Temper: tolerance must be within [0, 1)');
    const [baseline, candidate] = arms;
    const cells = new Map();
    for (const row of input) {
      const given = Object.hasOwn(labels, scopeKey(row.scope)) ? labels[scopeKey(row.scope)] : null;
      if (!given) continue;
      if (typeof given !== 'object' || Array.isArray(given)) throw new TypeError('Temper: labels must be {dimension: value}');
      const tally = { [baseline]: [0, 0], [candidate]: [0, 0] };
      for (const a of row.attempts) {
        const arm = a.arm || 'unrecorded';
        if (!Object.hasOwn(tally, arm) || !counted(a)) continue;
        tally[arm][0] += 1; if (a.verdict === 'correct') tally[arm][1] += 1;
      }
      if (!tally[baseline][0] && !tally[candidate][0]) continue;
      for (const [dimension, value] of Object.entries(given)) {
        if (value == null || value === 'no_answer') continue;
        if (!label(dimension) || !label(value)) throw new TypeError('Temper: invalid group label');
        const key = `${dimension}=${value}`;
        if (!cells.has(key)) cells.set(key, { dimension, value, people: { [baseline]: [], [candidate]: [] } });
        for (const arm of arms) if (tally[arm][0]) cells.get(key).people[arm].push(tally[arm][1] / tally[arm][0]);
      }
    }
    const mean = list => list.reduce((sum, value) => sum + value, 0) / list.length;
    const report = [...cells.keys()].sort().map(key => {
      const cell = cells.get(key), before = cell.people[baseline], after = cell.people[candidate];
      if (before.length < minimum || after.length < minimum) return { dimension: cell.dimension, value: cell.value, status: 'waiting' };
      const difference = mean(after) - mean(before);
      return { dimension: cell.dimension, value: cell.value, status: difference < -tolerance ? 'worse' : 'not_worse',
        people: { baseline: before.length, candidate: after.length }, accuracy: { baseline: mean(before), candidate: mean(after) }, difference };
    });
    const named = status => report.filter(cell => cell.status === status).map(cell => `${cell.dimension}=${cell.value}`);
    return { version: VERSION, arms: { baseline, candidate }, minimum, tolerance, cells: report, worse: named('worse'), waiting: named('waiting'),
      unit: 'person-mean-of-new-item-independent-accuracy', learningEffectClaim: false, causalClaim: false, significanceTested: false };
  }
  // Personal observation opportunities, not assigned experiments or proof of effect. The
  // original reading chooses anchors before exclusions; the current reading can withdraw
  // them, never silently replace an excluded error with a more favourable later answer.
  // followup-3 (2026-11-08): a cell's anchor and each window's pair are read once and frozen in the ledger as the log folds
  // (ledger.followups, sealFollowups), so a repeated item never has to keep old entries alive. A cell runs in cycles: its next anchor
  // is the first qualified answer more than keepDays after the last. Only a fold by a writer that did not freeze leaves a floor: answers
  // up to it cannot become anchors, chosen by time alone. A late entry from another device marks only the row it overtakes.
  const FOLLOWUP = Object.freeze({ version: 'temper-followup-3', maxAnchorsPerGame: 96, keepDays: 45, table: 1,
    windows: Object.freeze([['d1', 1, 3], ['d7', 7, 10], ['d30', 30, 37]].map(Object.freeze)) });
  const cellOf = row => JSON.stringify([row.g, row.s, row.d, row.f, row.m, row.a]);
  const validRow = r => !!r && typeof r === 'object' && typeof r.id === 'string' && typeof r.g === 'string' && typeof r.s === 'string' && Number.isFinite(r.at)
    && (r.ps === undefined || Number.isFinite(r.ps))
    && (!r.p || Number.isFinite(r.ra) && Array.isArray(r.pf) && Array.isArray(r.fx) && r.fx.every(Array.isArray) && !!r.t && typeof r.t === 'object' && Object.values(r.t).every(pair => !!pair && Number.isFinite(pair.at)));
  // Another version's table, or one that does not read, counts as none.
  const sights = s => s === undefined || !!s && typeof s === 'object' && !Array.isArray(s) && Object.values(s).every(Number.isFinite);
  const tableOf = prior => { const t = prior?.followups; return t && t.v === FOLLOWUP.table && Array.isArray(t.rows) && t.rows.every(validRow) && sights(t.fs) ? t : null; };
  function floorOf(prior, table) {
    if (!prior) return -Infinity;
    // A writer that retained its anchors left them in the log: read it as it is until the next fold freezes them.
    const clean = table ? table.folded === prior.folded : !prior.folded || prior.followupsPreserved === true && !prior.followupsLost;
    const floor = Number.isFinite(table?.floor) ? table.floor : -Infinity;
    return clean ? floor : Math.max(floor, Number.isFinite(prior.cutoff) ? prior.cutoff : -Infinity);
  }
  function followups({ events, summary, original = summary, prior = null, complete = true, asOf = summary?.asOf } = {}) {
    summaries(summary); summaries(original);
    const now = Date.parse(asOf), day = 86400000, keep = FOLLOWUP.keepDays * day, own = scopeKey(summary.scope);
    if (!Array.isArray(events) || !Number.isFinite(now) || scopeKey(original.scope) !== own) throw new TypeError('Temper: invalid follow-up evidence');
    const visible = events.filter(e => scopeKey(e.scope) === own && Date.parse(e.at) <= now && Date.parse(e.recordedAt) <= now);
    const byId = new Map(visible.map(e => [e.id, e])), position = new Map(visible.map((e, i) => [e.id, i]));
    const withdrawn = new Set(prior?.withdrawn || []), excluded = new Set(visible.filter(e => e.type === 'record.excluded').map(e => e.targetId));
    const gone = id => excluded.has(id) || withdrawn.has(id);
    const completion = new Map(visible.filter(e => e.type === 'experience.completed').map(e => [e.decisionId, e]));
    const current = new Map(summary.attempts.map(a => [a.eventId, a]));
    const stamp = a => Date.parse(a.at), before = (a, b) => position.get(a.eventId ?? a.id) < position.get(b.eventId ?? b.id)
      && stamp(a) <= stamp(b) && Date.parse(a.recordedAt) <= Date.parse(b.recordedAt);
    const game = a => byId.get(a.decisionId)?.experienceId;
    // The same ability cell, not the same map edition (followup-2, 2026-11-08): a map that only grew keeps its pairs.
    // An ability that changes what it measures takes a new id; the modality recorded on each attempt stays in the cell.
    const tuple = a => JSON.stringify([game(a), a.measure?.skillId, a.measure?.difficulty,
      a.measure?.responseFormat, a.measure?.modality, a.measure?.audioRequired]);
    const framed = a => {
      const p = byId.get(a.presentationId), d = byId.get(a.decisionId), done = completion.get(a.decisionId);
      return p?.type === 'practice.presented' && d?.type === 'decision.made' && done && before(d, p) && before(p, a) && before(a, done);
    };
    const qualified = a => a?.attemptNo === 1 && a.measure && a.measure.responseFormat !== 'unknown'
      && !a.exclusionReason && [true, false].includes(a.assisted) && ['correct', 'incorrect'].includes(a.verdict) && framed(a);
    const aside = new Map();
    for (const e of visible) if (['practice.helped', 'practice.delivery'].includes(e.type)) { if (!aside.has(e.presentationId)) aside.set(e.presentationId, []); aside.get(e.presentationId).push(e); }
    const proofs = a => (aside.get(a.presentationId) || []).filter(e => before(e, a)).map(e => e.id);
    const invalidated = a => [a.eventId, a.presentationId, a.decisionId, completion.get(a.decisionId)?.id, ...proofs(a)].some(gone);
    const shown = new Map(), firstShown = new Map(), foldedShown = new Set();
    const trace = p => [`item:${p.itemKey}`, `family:${p.measure?.familyKey || p.itemKey}`];
    // Against frozen rows a late entry is judged by its time, never by log position or by having folded (Fable design gate, 2026-11-09):
    // appended entries sit last in the log, so the first sight of an item or family is the earliest one.
    for (const p of visible.filter(e => e.type === 'practice.presented')) for (const key of trace(p)) {
      const first = shown.get(key);
      if (!first || stamp(p) < stamp(first) || stamp(p) === stamp(first) && before(p, first)) shown.set(key, p);
      firstShown.set(key, Math.min(firstShown.get(key) ?? Infinity, stamp(p)));
    }
    for (const [, item, family] of prior?.presented || []) { foldedShown.add(`item:${item}`); foldedShown.add(`family:${family}`); }
    // A pair is chosen or read again only while no sight of its item or family has folded: Trail reads folded history as before everything.
    const fresh = a => trace(byId.get(a.presentationId)).every(key => !foldedShown.has(key) && shown.get(key)?.id === a.presentationId);
    // Help in the log by item and family: a frozen pair that is not read again was helped late if one came before its answer.
    const helpedAt = new Map();
    for (const h of visible) if (h.type === 'practice.helped' && byId.get(h.presentationId)?.type === 'practice.presented')
      for (const key of trace(byId.get(h.presentationId))) { if (!helpedAt.has(key)) helpedAt.set(key, []); helpedAt.get(key).push(h); }
    const ordered = [...original.attempts].sort((a, b) => stamp(a) - stamp(b) || position.get(a.eventId) - position.get(b.eventId));
    const inCell = new Map();
    for (const a of ordered) { const cell = tuple(a); if (!inCell.has(cell)) inCell.set(cell, []); inCell.get(cell).push(a); }
    const table = tableOf(prior), floor = floorOf(prior, table), usable = complete === true, iso = ms => new Date(ms).toISOString();
    // A late candidate is found by time: a folded first sight counts by the time the table froze for its family (fs — an item is shown
    // and folds with its family, so that time bounds both); folded without one (older than any live anchor, or by an older writer), it came first.
    const frozenSight = table?.fs || {};
    const timely = a => { const p = byId.get(a.presentationId), keys = trace(p), sight = frozenSight[keys[1]];
      return keys.every(key => shown.get(key)?.id === p.id) && (Number.isFinite(sight) ? sight >= stamp(p) : keys.every(key => !foldedShown.has(key))); };
    // One running anchor per cell: frozen first, then the log in time order. Later answers in its cycle change nothing;
    // an earlier one still in the log (another device's late entry) marks the frozen row instead of replacing it.
    const frozen = a => typeof a.at === 'number', when = a => (frozen(a) ? a.at : stamp(a));
    const chain = new Map(), cycles = new Map(), overtaken = new Set(), begin = (cell, a) => { chain.set(cell, a); if (!cycles.has(cell)) cycles.set(cell, []); cycles.get(cell).push(a); };
    // Two rows of one cell come only from a clock set back: the earlier starts the cycle, as a whole log reads it. A row past
    // this clock is not read yet, but the cycle before it (its frozen ps) still keeps an answer inside from starting another.
    const bounds = new Map();
    for (const row of [...(table?.rows || [])].sort((x, y) => x.at - y.at)) {
      const cell = cellOf(row), running = chain.get(cell);
      if (row.at > now) { if (Number.isFinite(row.ps)) bounds.set(cell, [...(bounds.get(cell) || []), row.ps]); }
      else if (!running || row.at > when(running) + keep) begin(cell, row);
    }
    const inside = (cell, at) => (bounds.get(cell) || []).some(ps => at >= ps && at <= ps + keep);
    for (const a of ordered) {
      if (!qualified(a)) continue;
      const cell = tuple(a), running = chain.get(cell);
      if (running && frozen(running) && stamp(a) < running.at) {
        // Inside the cycle before it (its start to keepDays after, frozen as ps) an answer changes nothing, as a whole log reads it.
        // Anything else marks the row, never replacing it; the next cycle opens from this chain, chosen by time alone.
        if (!(Number.isFinite(running.ps) && stamp(a) >= running.ps && stamp(a) <= running.ps + keep)) overtaken.add(running.id);
      } else if (stamp(a) > floor && (!running || stamp(a) > when(running) + keep) && !inside(cell, stamp(a))) begin(cell, a);
    }
    // The start of the cycle before each anchor, frozen with it.
    const prevStart = new Map();
    for (const list of cycles.values()) list.forEach((a, i) => { const ps = i ? when(list[i - 1]) : frozen(a) ? a.ps : undefined; if (Number.isFinite(ps)) prevStart.set(a, ps); });
    const withPs = a => (prevStart.has(a) ? { ps: prevStart.get(a) } : {});
    const toRow = a => {
      const actual = current.get(a.eventId), m = a.measure;
      return { g: game(a), s: m.skillId, d: m.difficulty, f: m.responseFormat, m: m.modality, a: m.audioRequired, tv: a.taskVersion, id: a.eventId, at: stamp(a), ra: Date.parse(a.recordedAt),
        i: a.itemKey, fa: m.familyKey, p: a.presentationId, dc: a.decisionId, cp: completion.get(a.decisionId).id, k: counted(a) && a.verdict === 'correct' ? 'retention' : 'recovery',
        x: invalidated(a) || !actual || !qualified(actual) ? 1 : 0, pf: proofs(a), fx: [], t: {}, ...withPs(a) };
    };
    const pairOf = a => {
      const actual = current.get(a.eventId), p = byId.get(a.presentationId);
      const pair = { id: a.eventId, at: stamp(a), pa: stamp(p), i: a.itemKey, fa: a.measure.familyKey, p: a.presentationId, dc: a.decisionId, cp: completion.get(a.decisionId).id, pf: proofs(a), x: 0, s: null, o: null, r: null };
      if (invalidated(a) || !actual) pair.x = 1;
      else if (!qualified(actual) || actual.exposure !== 'new' || actual.assisted === false && !counted(actual)) { pair.s = 'unavailable'; pair.r = actual.exclusionReason || 'unassessable-target'; }
      else { pair.s = 'observed'; pair.o = `${actual.assisted ? 'assisted' : 'independent'}-${actual.verdict}`; }
      return pair;
    };
    // A start without details only bounds its cell's next anchor: no rows.
    const live = [...chain.values()].filter(a => now - when(a) <= keep && (!frozen(a) || a.p)).sort((x, y) => when(x) - when(y));
    const used = new Map(), selected = new Set();
    for (const a of live) { const g = frozen(a) ? a.g : game(a), n = used.get(g) || 0; used.set(g, n + 1); if (n < FOLLOWUP.maxAnchorsPerGame) selected.add(a); }
    const items = [], rows = [];
    // Every live anchor is read, so a fold keeps it whole; the share only limits what is reported now.
    for (const anchor of live) {
      const row = frozen(anchor) ? { ...anchor, fx: [...(anchor.fx || [])], t: { ...anchor.t }, pf: anchor.pf || [] } : toRow(anchor), cell = cellOf(row);
      if ([row.id, row.p, row.dc, row.cp, ...row.pf].some(gone)) row.x = 1;
      if (overtaken.has(row.id)) row.l = 1;
      const logged = position.has(row.id) ? { eventId: row.id, at: iso(row.at), recordedAt: iso(row.ra) } : null;
      const follows = e => (logged ? before(logged, e) : row.at <= stamp(e) && row.ra <= Date.parse(e.recordedAt));
      for (const h of summary.help) if (h.presentationId === row.p && ['answer', 'explanation'].includes(h.level) && follows(h) && !row.fx.some(([id]) => id === h.eventId)) row.fx.push([h.eventId, stamp(h)]);
      row.fx = row.fx.filter(([id]) => !gone(id));
      const candidates = (inCell.get(cell) || []).filter(a => a.eventId !== row.id && a.attemptNo === 1
        && framed(a) && follows(byId.get(a.presentationId)) && a.measure.familyKey !== row.fa && a.itemKey !== row.i);
      const targets = candidates.filter(fresh), early = candidates.filter(timely);
      const measure = { skillId: row.s, modality: row.m, difficulty: row.d, audioRequired: row.a, responseFormat: row.f, taskVersion: row.tv };
      for (const [window, start, end] of FOLLOWUP.windows) {
        // A window opened before the floor may have lost its first answer: a later one never stands in for it.
        const due = row.at + start * day, expires = row.at + end * day, within = a => stamp(a) >= due && stamp(a) < expires;
        const first = early.find(within), found = due <= floor ? null : targets.find(within);
        // What is still in the log is read again; the table only stands in for what has left it. A frozen pair past this clock
        // (a device clock set back) is kept and marked as usual, but neither shown nor replaced until the clock reaches it.
        const stored = row.t[window] || null, ahead = !!stored && stored.at > now, kept = ahead ? null : stored;
        const reread = !ahead && !!found && (!kept || found.eventId === kept.id), pair = reread ? pairOf(found) : stored && { ...stored };
        if (pair) row.t[window] = pair;
        if (pair && [pair.id, pair.p, pair.dc, pair.cp, ...(pair.pf || [])].some(gone)) pair.x = 1;
        // A late entry: an earlier candidate for this window, the pair's item shown before it, or help before an answer the table still
        // calls independent (the log's reading would have counted it). Appended entries sit last in the log, so this reads their times.
        const late = key => firstShown.get(key) < pair.pa || /^independent/.test(pair.o) && (helpedAt.get(key) || []).some(h => stamp(h) < pair.at && !(pair.pf || []).includes(h.id));
        if (pair && (stored?.l || stored && first && stamp(first) < stored.at || [`item:${pair.i}`, `family:${pair.fa}`].some(late))) pair.l = 1;
        const shown = ahead ? null : pair;
        let status = now < due ? 'not_due' : now < expires ? 'due' : 'missed', outcome = null, reason = null;
        if (!usable) { status = 'unavailable'; reason = 'incomplete-history'; }
        else if (row.x) { status = 'invalidated'; reason = 'source-withdrawn'; }
        else if (row.l) { status = 'unavailable'; reason = 'adjusted-history'; }
        else if (shown?.x) { status = 'invalidated'; reason = 'target-withdrawn'; }
        else if (shown?.l) { status = 'unavailable'; reason = 'adjusted-history'; }
        else if (shown) { status = shown.s; outcome = shown.o; reason = shown.r; }
        else if (due <= floor) { status = 'unavailable'; reason = 'older-source-unavailable'; }
        if (selected.has(anchor)) items.push({ id: `${row.id}:${window}`, sourceAttemptId: row.id, sourceAt: iso(row.at), gameId: row.g, measure,
          kind: row.k, window, dueAt: iso(due), expiresAt: iso(expires), status, reason,
          targetAttemptId: shown?.id || null, targetAt: shown ? iso(shown.at) : null, outcome, correctionEventIds: row.fx.filter(([, at]) => !shown || at <= shown.pa).map(([id]) => id) });
      }
      rows.push(row);
    }
    // Each cell's cycle starts, oldest first: a fold keeps the last one at or before its cutoff.
    const starts = [...cycles.values()].map(list => list.map(a => (frozen(a) ? { g: a.g, s: a.s, d: a.d, f: a.f, m: a.m, a: a.a, id: a.id, at: a.at, ...withPs(a) }
      : { g: game(a), s: a.measure.skillId, d: a.measure.difficulty, f: a.measure.responseFormat, m: a.measure.modality, a: a.measure.audioRequired, id: a.eventId, at: stamp(a), ...withPs(a) })));
    const report = { policy: FOLLOWUP.version, asOf, observationOpportunities: true, evidenceComplete: usable,
      coverage: { folded: prior?.folded || 0, adjusted: prior?.adjusted || 0, limited: live.length > selected.size, excludedAnchors: live.length - selected.size,
        floor: Number.isFinite(floor) ? iso(floor) : null, reason: !usable ? 'incomplete-history' : floor > now - keep ? 'older-source-unavailable' : null },
      items, learningEffectClaim: false, causalClaim: false, policyPromotion: false };
    Object.defineProperty(report, 'sealing', { enumerable: false, value: { rows, starts, floor, now, later: (table?.rows || []).filter(row => row.at > now),
      // A family folded before without a frozen time was seen before anything left in the log: a later sight never stands in for it.
      sights: [...Object.entries(frozenSight), ...[...firstShown].filter(([key]) => Number.isFinite(frozenSight[key]) || !foldedShown.has(key))] } });
    return report;
  }
  // What a fold keeps: everything at or before the new cutoff stays as it was read now, whatever folds later; the rest is read from the log.
  // A pair past the cutoff stays too when an encounter with its item or family has just folded: folded history would hide it from the log's reading.
  function sealFollowups(report, { cutoff, folded, presented = [] }) {
    const { rows, starts, floor, now, later, sights: seen = [] } = report.sealing, full = new Map(rows.map(row => [row.id, row])), out = [];
    // First sights of each family at or before the cutoff, no older than the oldest anchor still live: later readings find late candidates by them.
    const fs = {}, oldest = now - FOLLOWUP.keepDays * 86400000;
    const first = new Map();
    for (const [key, at] of seen) if (key.startsWith('family:') && !(first.get(key) <= at)) first.set(key, at);
    for (const [key, at] of first) if (at <= cutoff && at >= oldest) fs[key] = at;
    const met = new Set(presented.flatMap(([, item, family]) => [`item:${item}`, `family:${family}`]));
    const held = pair => pair.at <= cutoff || pair.at > now || met.has(`item:${pair.i}`) || met.has(`family:${pair.fa}`);
    for (const cycle of starts) {
      const start = cycle.filter(a => a.at <= cutoff).at(-1), row = start && full.get(start.id);
      if (row) out.push({ ...row, t: Object.fromEntries(Object.entries(row.t).filter(([, pair]) => held(pair))) });
      else if (start) out.push(start);
    }
    // A row from past this clock (a device clock set back) stays for when the clock returns.
    return { v: FOLLOWUP.table, folded, ...(Number.isFinite(floor) ? { floor } : {}), ...(Object.keys(fs).length ? { fs } : {}), rows: [...out, ...later] };
  }
  // Help kept on the server only (its presentation folded here) that came before a frozen independent pair on that presentation marks
  // its window, as a late entry in the log would; help on another item of the family is counted in the ledger's `adjusted` only.
  function lateHelp(table, helps) {
    const hit = pair => /^independent/.test(pair.o) && helps.some(h => h.type === 'practice.helped' && h.presentationId === pair.p && Date.parse(h.at) < pair.at);
    if (!tableOf({ followups: table }) || !table.rows.some(row => row.t && Object.values(row.t).some(hit))) return table;
    return { ...table, rows: table.rows.map(row => (row.t && Object.values(row.t).some(hit) ? { ...row, t: Object.fromEntries(Object.entries(row.t).map(([w, pair]) => [w, hit(pair) ? { ...pair, l: 1 } : pair])) } : row)) };
  }
  // Two copies of one table meet when another tab wrote first. A mark is never taken back by a reading, and one an import made (lateHelp)
  // cannot be made again: whichever copy is kept, the same row, window and pair keep it.
  function carryMarks(table, others) {
    if (!tableOf({ followups: table })) return table;
    const marks = new Set();
    for (const other of others) if (other && other !== table && tableOf({ followups: other })) for (const row of other.rows) {
      if (row.l) marks.add(row.id);
      for (const [window, pair] of Object.entries(row.t || {})) if (pair.l) marks.add(`${row.id}:${window}:${pair.id}`);
    }
    let changed = false;
    const rows = !marks.size ? table.rows : table.rows.map(row => {
      const lost = Object.entries(row.t || {}).filter(([window, pair]) => !pair.l && marks.has(`${row.id}:${window}:${pair.id}`)).map(([window]) => window);
      if (!lost.length && (row.l || !marks.has(row.id))) return row;
      changed = true;
      return { ...row, ...(marks.has(row.id) ? { l: 1 } : {}), ...(lost.length ? { t: { ...row.t, ...Object.fromEntries(lost.map(window => [window, { ...row.t[window], l: 1 }])) } } : {}) };
    });
    return changed ? { ...table, rows } : table;
  }
  /* The last word on every knob change (Atlas design §7-2, implementation spec §6-3): one knob, one
   * step, inside bounds, never a declared-only knob, at most one change per response, and a knob just
   * eased is not raised again for two responses (easing right after a raise is always allowed:
   * comfort first). `frozen` is the stop switch: defaults for everyone. */
  // A knob just eased is not raised again within this many responses.
  const FLIP_WINDOW = 2;
  // After any raise, the person meets the new level at least this many times before another raise.
  const COOL_DOWN = 2;
  function check({ spec, knob, from, to, step, phase = 'response', history = [], frozen = false } = {}) {
    if (frozen) return { ok: false, rail: 'hold' };
    const k = spec?.knobs?.find(x => x.id === knob);
    if (!k) return { ok: false, rail: 'unknown-knob' };
    if (!Number.isInteger(from) || !Number.isInteger(to) || Math.abs(to - from) !== 1) return { ok: false, rail: 'one-step' };
    if (to < 0 || to >= k.values.length) return { ok: false, rail: 'bounds' };
    if (k.follows === 'declared') return { ok: false, rail: 'declared-only' };
    if (!['opening', 'response', 'accepted'].includes(phase) || !Number.isInteger(step) || !Array.isArray(history)) return { ok: false, rail: 'invalid' };
    if (phase !== 'opening') {
      const live = history.filter(c => c.phase !== 'opening');
      if (live.some(c => c.step === step)) return { ok: false, rail: 'one-change-per-response' };
      const recent = live.filter(c => c.knob === knob && step - c.step <= FLIP_WINDOW).at(-1);
      if (recent && to > from && recent.to < recent.from) return { ok: false, rail: 'no-bounce' };
      if (to > from && live.some(c => c.direction > 0 && step - c.step <= COOL_DOWN)) return { ok: false, rail: 'cool-down' };
    }
    return { ok: true, rail: null };
  }
  return Object.freeze({ VERSION, MINIMUM_PER_CELL, measure, combine, compare, groups, FOLLOWUP, followups, sealFollowups, lateHelp, carryMarks, FLIP_WINDOW, COOL_DOWN, check });
});
