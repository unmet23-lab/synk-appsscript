'use strict';

const { EMAIL } = require('./subscription-common.cjs');

const providers = new Set(['claude', 'gpt', 'gemini']);
const benefitStates = new Set(['linked', 'unlinked', 'not-shown']);
const normalized = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
const localDay = date => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');

function calendarDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

// Every observation belongs to the account shown when the official page was checked.
// The plan matters for the subscription benefit. A dated Flow activity total is historical.
function observation(row, kind, input, checkedAt) {
  const account = normalized(row.email);
  if (row.source !== 'auto' || !providers.has(row.service) || !EMAIL.test(account) ||
      account !== normalized(input?.account) || !Number.isSafeInteger(checkedAt) || checkedAt <= 0 || checkedAt > 8640000000000000) return null;
  if (kind === 'api') {
    const plan = normalized(row.plan);
    if (typeof input.plan !== 'string' || plan !== normalized(input.plan) || !benefitStates.has(input.status)) return null;
    return { account, plan, checkedAt, status: input.status, ...(input.source === 'official' ? { source:'official' } : {}) };
  }
  if (kind !== 'flow' || row.service !== 'gemini') return null;
  const { from, to, used } = input;
  if (!calendarDay(from) || !calendarDay(to) || from > to ||
      !Number.isSafeInteger(used) || used < 0 || used > 10000000) return null;
  const result = { account, checkedAt, from, to, used };
  if (input.source === 'official' && Number.isSafeInteger(input.wallet) && input.wallet >= 0 && input.wallet <= 10000000) {
    result.source = 'official';
    result.wallet = input.wallet;
  }
  return result;
}

function storedCheck(row, kind, input) {
  if (!input) return null;
  return observation(row, kind, input, input.checkedAt);
}

function checkForSave(row, input, now, official = false) {
  if (!row || row.source !== 'auto' || !providers.has(row.service) ||
      (input.kind !== 'api' && !(input.kind === 'flow' && row.service === 'gemini'))) {
    return { ok: false, code: 'INVALID_CREDIT_CHECK' };
  }
  if (!EMAIL.test(normalized(input.email)) || normalized(input.email) !== normalized(row.email) ||
      (input.kind === 'api' && (typeof input.plan !== 'string' || normalized(input.plan) !== normalized(row.plan)))) {
    return { ok: false, code: 'CREDIT_ACCOUNT_CHANGED' };
  }
  if (input.kind === 'flow' && input.to > localDay(new Date(now))) return { ok: false, code: 'INVALID_CREDIT_CHECK' };
  const value = observation(row, input.kind, { ...input, account: input.email, source:official ? 'official' : null }, now);
  if (!value) return { ok: false, code: 'INVALID_CREDIT_CHECK' };
  return { ok: true, field: input.kind === 'api' ? 'apiBenefit' : 'flowUsage', value };
}

module.exports = { storedCheck, checkForSave, localDay };
