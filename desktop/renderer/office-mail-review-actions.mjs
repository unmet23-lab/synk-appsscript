import { isEditedMailRole, isValidMailRoleValue } from './office-mail-review-filter.mjs';
import { mailCodeText } from './office-mail-model.mjs';

const INVALIDATION_CODES = new Set(['SESSION', 'MAIL_CHANGED']);
const cleanCode = (v) => (typeof v === 'string' ? v.trim() : '');
const getReviewId = (task) => cleanCode(task?.mailReview?.reviewId);
const isPlainObject = (v) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

const ROLE_FIELDS = new Set(['from', 'folder']);
const ROLE_DECISIONS = new Set(['apply', 'exclude', 'edit']);

function confirmRoleDecisions(review, fields) {
  const rawChoices = review?.roleChoices;
  if (rawChoices != null && !Array.isArray(rawChoices)) return null;
  const choiceByField = new Map();
  for (const item of rawChoices ?? []) {
    if (!isPlainObject(item) || !ROLE_FIELDS.has(item.field) || choiceByField.has(item.field)) {
      return null;
    }
    if (!cleanCode(item.quote) || !isValidMailRoleValue(item.field, item.value)) {
      return null;
    }
    choiceByField.set(item.field, item);
  }

  const rawDecisions = fields.roleDecisions;
  if (choiceByField.size === 0) {
    if (rawDecisions != null && (!isPlainObject(rawDecisions) || Object.keys(rawDecisions).length > 0)) {
      return null;
    }
    return undefined;
  }
  if (!isPlainObject(rawDecisions) || Object.keys(rawDecisions).length !== choiceByField.size) return null;
  const roleDecisions = {};
  for (const [field, choice] of choiceByField) {
    const decision = rawDecisions[field];
    if (!Object.hasOwn(rawDecisions, field) || !ROLE_DECISIONS.has(decision)) return null;
    const actual = fields.filter[field];
    const base = review.filter?.[field];
    if (decision === 'apply' && actual !== choice.value) return null;
    if (decision === 'exclude' && actual !== base) return null;
    if (decision === 'edit' && !isEditedMailRole(field, actual, base, choice.value)) return null;
    roleDecisions[field] = decision;
  }
  return roleDecisions;
}

export function isMailReviewTask(task, id = task?.id) {
  return Boolean(id) && task?.id === id && task.provider === 'codex' && task.mailSearch === true &&
    !task.viaTerminal && task.status === 'failed' && task.reason === 'MAIL_REVIEW';
}

function resolveNote(code, action, fromStorage = false) {
  const key = cleanCode(code);
  if (key && key !== 'MAIL_REVIEW') {
    const mapped = mailCodeText(key);
    if (mapped) return mapped;
    if (key === 'SESSION') return '메일 세션이 만료되었습니다. 다시 확인해 주세요.';
    if (key === 'MAIL_CHANGED') return '메일함 상태가 바뀌었습니다. 목록을 다시 불러와 주세요.';
  }
  if (fromStorage || key.startsWith('STORAGE')) return '보관함 오류로 메일 요청을 처리할 수 없습니다.';
  return action === 'task-mail-renew'
    ? '메일 검색 조건을 다시 불러오지 못했습니다.'
    : '메일 확인 요청을 처리하지 못했습니다.';
}

export function createMailReviewActions({ api, findTask, enabled, storageCode, reread, changed } = {}) {
  let generation = 0;
  const entries = new Map();
  const latest = new Map();
  const notify = () => { if (typeof changed === 'function') changed(); };
  const safeReread = async () => {
    if (typeof reread === 'function') { try { await reread(); } catch {} }
  };
  const buildResult = (ok, res, failCode, id) => {
    if (!ok) return { ok: false, code: failCode };
    return isPlainObject(res.mailReview) ? { ok: true, mailReview: res.mailReview } : { ok: true, id: cleanCode(res.id) || id };
  };

  function reset() {
    generation += 1;
    entries.clear();
    latest.clear();
  }

  function sync(tasks) {
    if (entries.size === 0 && latest.size === 0) return;
    const rows = Array.isArray(tasks)
      ? tasks.filter((r) => r && typeof r === 'object' && typeof r.id === 'string').map((r) => [r.id, r])
      : [];
    const byId = new Map(rows);
    for (const [id, cur] of latest) {
      const task = byId.get(id);
      if (!isMailReviewTask(task, id)) latest.delete(id);
      else cur.seenRevision = getReviewId(task);
    }
    for (const [id, entry] of entries) {
      const task = byId.get(id);
      if (!isMailReviewTask(task, id)) {
        entries.delete(id);
        continue;
      }
      const nextRevision = getReviewId(task);
      if (nextRevision !== entry.revision) {
        if (entry.carryNote && entry.note) {
          entries.set(id, {
            revision: nextRevision,
            busy: false,
            pending: false,
            note: entry.note,
            accepted: false,
            renewalNeeded: !nextRevision,
          });
        } else {
          entries.delete(id);
        }
      }
    }
  }

  function ui() {
    const out = {};
    for (const [id, e] of entries) {
      if (!e.busy && !e.note && !e.accepted && !e.renewalNeeded) continue;
      out[id] = { busy: Boolean(e.busy), note: e.note || '', accepted: Boolean(e.accepted), renewalNeeded: Boolean(e.renewalNeeded) };
    }
    return out;
  }

  async function handle(action, id, fields) {
    if (action !== 'task-mail-confirm' && action !== 'task-mail-renew') return { ok: false, code: 'UNSUPPORTED_ACTION' };
    if (typeof id !== 'string' || !id.trim()) return { ok: false, code: 'INVALID_TASK' };
    const task = typeof findTask === 'function' ? findTask(id) : null;
    if (!isMailReviewTask(task, id)) return { ok: false, code: 'INVALID_TARGET' };

    const revision = getReviewId(task);
    let prev = entries.get(id);
    if (prev?.busy || prev?.pending) return { ok: false, code: 'BUSY' };
    if (prev && prev.revision !== revision) { entries.delete(id); prev = undefined; }
    if (prev?.accepted) return { ok: false, code: 'ALREADY_CONFIRMED' };

    const currentReviewId = getReviewId(task);
    const wasRenewalNeeded = Boolean(prev?.renewalNeeded);
    let confirmPayload = null;
    if (action === 'task-mail-confirm') {
      if (wasRenewalNeeded) return { ok: false, code: 'RENEWAL_REQUIRED' };
      if (!currentReviewId || fields?.reviewId !== task.mailReview?.reviewId) return { ok: false, code: 'REVIEW_MISMATCH' };
      if (!isPlainObject(fields?.filter)) return { ok: false, code: 'INVALID_FILTER' };
      const hasBound = (f) => [f?.after, f?.before].some((v) => (typeof v === 'string' ? Boolean(v.trim()) : v != null));
      const unboundedPeriodCase = (task.mailReview?.reason === 'period' || task.mailReview?.requiresPeriodChoice === true) &&
        !hasBound(task.mailReview?.filter) && !hasBound(fields.filter);
      if (unboundedPeriodCase && fields.allowUnboundedPeriod !== true) {
        return { ok: false, code: 'MAIL_PLAN' };
      }
      const allowUnboundedPeriod = unboundedPeriodCase && fields.allowUnboundedPeriod === true;
      const omitUnmet =
        fields.omitUnmet === true &&
        Array.isArray(task.mailReview?.unmet) &&
        task.mailReview.unmet.length > 0;
      if (task.mailReview?.requiresPeriodChoice === true && task.mailReview.reason === 'unsupported' &&
          task.mailReview.unmet?.length && !omitUnmet) return { ok: false, code: 'MAIL_PLAN' };
      const roleDecisions = confirmRoleDecisions(task.mailReview, fields);
      if (roleDecisions === null) return { ok: false, code: 'MAIL_PLAN' };
      confirmPayload = {
        reviewId: fields.reviewId,
        filter: fields.filter,
        ...(allowUnboundedPeriod ? { allowUnboundedPeriod: true } : {}),
        ...(omitUnmet ? { omitUnmet: true } : {}),
        ...(roleDecisions ? { roleDecisions } : {}),
      };
    } else if (currentReviewId && !wasRenewalNeeded) {
      return { ok: false, code: 'REVIEW_VALID' };
    }

    const storeErr = cleanCode(typeof storageCode === 'function' ? storageCode() : null);
    if (storeErr) {
      entries.set(id, { revision, busy: false, pending: false, note: resolveNote(storeErr, action, true), accepted: false, renewalNeeded: wasRenewalNeeded });
      notify();
      return { ok: false, code: storeErr };
    }
    if (typeof enabled !== 'function' || !enabled()) return { ok: false, code: 'MAIL_DISABLED' };
    if (typeof api?.taskAction !== 'function') return { ok: false, code: 'UNAVAILABLE' };

    const gen = generation;
    const entry = {
      revision,
      seenRevision: revision,
      busy: true,
      pending: true,
      note: '',
      accepted: false,
      renewalNeeded: wasRenewalNeeded,
      carryNote: false,
    };
    entries.set(id, entry);
    latest.set(id, entry);
    notify();

    let res;
    try {
      res = action === 'task-mail-confirm'
        ? await api.taskAction(id, 'confirmMail', confirmPayload)
        : await api.taskAction(id, 'reviewMail');
    } catch (err) {
      res = { ok: false, code: cleanCode(err?.code) || 'REQUEST_FAILED' };
    }
    if (gen !== generation) return { ok: false, code: 'STALE_SESSION' };

    const ok = Boolean(res && res.ok === true);
    const failCode = ok ? '' : cleanCode(res?.code) || 'REQUEST_FAILED';
    if (latest.get(id) !== entry || (entries.has(id) && entries.get(id) !== entry)) {
      entry.pending = false;
      return buildResult(ok, res, failCode, id);
    }

    const inv = !ok && INVALIDATION_CODES.has(failCode);
    const note = ok ? '' : resolveNote(failCode, action, false);
    const carryNote = Boolean(action === 'task-mail-confirm' && inv && note);
    const hadEntry = entries.get(id) === entry;
    if (hadEntry) {
      entry.busy = false;
      entry.accepted = ok && action === 'task-mail-confirm';
      entry.renewalNeeded = ok ? false : (action === 'task-mail-confirm' ? inv : Boolean(wasRenewalNeeded || inv));
      entry.note = note;
      entry.carryNote = carryNote;
    }
    await safeReread();
    entry.pending = false;
    if (gen !== generation) return { ok: false, code: 'STALE_SESSION' };
    if (latest.get(id) !== entry) {
      if (!latest.has(id)) notify();
      return buildResult(ok, res, failCode, id);
    }
    if (carryNote && !hadEntry && !entries.has(id)) {
      const nextRev = entry.seenRevision;
      entries.set(id, {
        revision: nextRev,
        busy: false,
        pending: false,
        note,
        accepted: false,
        renewalNeeded: !nextRev || nextRev === entry.revision,
      });
    } else if (!entry.accepted && !entry.note && !entry.renewalNeeded && entries.get(id) === entry) {
      entries.delete(id);
    }
    notify();
    return buildResult(ok, res, failCode, id);
  }

  return {
    handle, sync, ui, reset,
    blocksOther(id) {
      const entry = entries.get(id);
      return Boolean(entry?.busy || entry?.pending || entry?.accepted);
    },
  };
}
