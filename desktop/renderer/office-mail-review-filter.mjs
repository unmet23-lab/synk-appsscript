const FOLDERS = new Set(['received', 'inbox', 'sent', 'inbox_sent', 'all']);
const PROVIDERS = new Set(['all', 'gmail', 'outlook']);
const ATTACHMENTS = new Set(['', 'has']);

// Match the search words accepted by the mail providers' filter validator.
function validSearchWord(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 80 &&
    value === value.trim() && /^[\p{L}\p{M}\p{N} .@_+\-]+$/u.test(value) &&
    !/\b(?:AND|OR|NOT|NEAR)\b/.test(value);
}

function fail(field, message) {
  return { ok: false, field, message };
}

function isValidUtcDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function addUtcDays(value, days) {
  const time = Date.parse(`${value}T00:00:00.000Z`);
  return new Date(time + days * 86_400_000).toISOString().slice(0, 10);
}

function inDateRange(value) {
  return value >= '1970-01-01' && value <= '2200-12-31';
}

export const isValidMailRoleValue = (field, value) =>
  typeof value === 'string' && (field === 'folder' ? FOLDERS.has(value) : field === 'from' && Boolean(value.trim()));

export function isEditedMailRole(field, value, initial, suggested) {
  if (!isValidMailRoleValue(field, value)) return false;
  if (field === 'from') {
    const sender = raw => String(raw ?? '').trim().toLowerCase();
    return sender(value) !== sender(initial) && sender(value) !== sender(suggested);
  }
  return value !== initial && value !== suggested;
}

export function makeMailFilterDraft(filter) {
  const src = filter && typeof filter === 'object' && !Array.isArray(filter) ? filter : {};
  const terms = Array.isArray(src.terms)
    ? src.terms.map((item) => String(item ?? '')).join('\n')
    : src.terms == null ? '' : String(src.terms);

  let through = '';
  if (src.before != null && src.before !== '') {
    const rawBefore = String(src.before);
    through = isValidUtcDate(rawBefore) && rawBefore >= '0001-01-01'
      ? addUtcDays(rawBefore, -1)
      : rawBefore;
  }

  return {
    terms,
    from: src.from == null ? '' : String(src.from),
    after: src.after == null ? '' : String(src.after),
    through,
    folder: src.folder === undefined ? 'received' : String(src.folder),
    provider: src.provider === undefined ? 'all' : String(src.provider),
    attachment: src.attachment === undefined ? '' : String(src.attachment),
  };
}

export function readMailFilterDraft(draft) {
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return fail('draft', '필터 입력이 올바르지 않습니다.');
  }
  if (typeof draft.folder !== 'string' || !FOLDERS.has(draft.folder)) {
    return fail('folder', '메일함 선택이 올바르지 않습니다.');
  }
  if (typeof draft.provider !== 'string' || !PROVIDERS.has(draft.provider)) {
    return fail('provider', '연결 계정 선택이 올바르지 않습니다.');
  }
  if (typeof draft.attachment !== 'string' || !ATTACHMENTS.has(draft.attachment)) {
    return fail('attachment', '첨부 조건 선택이 올바르지 않습니다.');
  }

  for (const [key, label] of [
    ['terms', '검색어'], ['from', '보낸 사람'],
    ['after', '시작 날짜'], ['through', '종료 날짜'],
  ]) {
    if (draft[key] !== undefined && typeof draft[key] !== 'string') {
      return fail(key, `${label} 입력이 올바르지 않습니다.`);
    }
  }

  const terms = (draft.terms ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (terms.length > 6) {
    return fail('terms', '검색어는 최대 6개까지 입력할 수 있습니다.');
  }
  if (terms.some((term) => !validSearchWord(term))) {
    return fail('terms', '검색어는 80자 이내 허용 문자만 쓰고 대문자 AND·OR·NOT·NEAR는 빼 주세요.');
  }

  const from = (draft.from ?? '').trim();
  if (from && !validSearchWord(from)) {
    return fail('from', '보낸 사람 이름이나 주소는 80자 이내 허용 문자만 입력할 수 있으며, 대문자 AND·OR·NOT·NEAR는 낱말로 쓸 수 없습니다.');
  }

  const after = (draft.after ?? '').trim();
  if (after && (!isValidUtcDate(after) || !inDateRange(after))) {
    return fail('after', '시작 날짜는 1970~2200년 사이의 실제 YYYY-MM-DD여야 합니다.');
  }

  const through = (draft.through ?? '').trim();
  let before = '';
  if (through) {
    if (!isValidUtcDate(through) || !inDateRange(through)) {
      return fail('through', '종료 날짜는 1970~2200년 사이의 실제 YYYY-MM-DD여야 합니다.');
    }
    before = addUtcDays(through, 1);
    if (!inDateRange(before)) {
      return fail('through', '종료 날짜가 허용된 마지막 날짜 범위를 넘습니다.');
    }
  }

  if (after && through && after > through) {
    return fail('through', '종료 날짜는 시작 날짜보다 빠를 수 없습니다.');
  }

  return {
    ok: true,
    filter: {
      terms,
      from,
      after,
      before,
      folder: draft.folder,
      provider: draft.provider,
      attachment: draft.attachment,
    },
  };
}
