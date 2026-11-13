import { randomUUID } from 'node:crypto';
import { normalizeWorkspaceProfile } from './workspace-access.mjs';

// Company assignments come only from the invitation/access profile.
// This document stores descriptive work information and never grants access.
export const MEMBER_BRANDS = Object.freeze(['LAB', 'SHIFT', 'PULSE', 'PATH']);
const kind = 'memberOrganization';
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export function memberOrganization(store, userId) {
  const saved = store.get(kind, userId);
  let brands = [];
  try { brands = normalizeWorkspaceProfile(store.get('users', userId)?.workspaceProfile, { allowEmpty: true }).memberships.map(row => row.company); } catch { /* Unassigned or invalid profiles have no company assignment. */ }
  return {
    brands: MEMBER_BRANDS.filter(brand => brands.includes(brand)),
    jobTitle: typeof saved?.jobTitle === 'string' ? saved.jobTitle : '',
    responsibilities: typeof saved?.responsibilities === 'string' ? saved.responsibilities : '',
    revision: typeof saved?.revision === 'string' ? saved.revision : null,
    updatedAt: typeof saved?.updatedAt === 'string' ? saved.updatedAt : null,
  };
}

function field(value, label, max) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    throw fail(`${label}은 ${max}자 이내의 글로 적어 주세요.`);
  }
  return value.trim();
}

export function saveMemberOrganization(store, actor, userId, input, { clock = () => new Date().toISOString(), audit = () => {} } = {}) {
  if (!actor || actor.active === false || actor.role !== 'admin') throw fail('업무 정보는 관리자만 정할 수 있어요.', 403);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw fail('저장할 업무 정보를 확인해 주세요.');
  const fields = ['jobTitle', 'responsibilities', 'expectedRevision'];
  if (Object.keys(input).some(key => !fields.includes(key)) || fields.some(key => !Object.hasOwn(input, key))) {
    throw fail('업무 역할, 맡은 일과 확인한 판만 보내 주세요. 소속 회사는 회사·직무 설정에서 관리해요.');
  }
  if (input.expectedRevision !== null && (typeof input.expectedRevision !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u.test(input.expectedRevision))) {
    throw fail('업무 정보를 다시 읽은 뒤 저장해 주세요.');
  }
  const details = {
    jobTitle: field(input.jobTitle, '업무 역할', 80),
    responsibilities: field(input.responsibilities, '맡은 일', 600),
  };
  return store.transaction(() => {
    if (!store.get('users', userId)) throw fail('직원을 찾지 못했어요. 목록을 새로고침해 주세요.', 404);
    const before = memberOrganization(store, userId);
    if (before.revision !== input.expectedRevision) throw fail('다른 곳에서 업무 정보가 바뀌었어요. 최신 내용을 확인한 뒤 다시 수정해 주세요.', 409);
    const organization = { ...details, revision: randomUUID(), updatedAt: clock() };
    store.put(kind, userId, { id: userId, ...organization });
    audit(actor, 'member-organization-updated', userId, {});
    return { organization: memberOrganization(store, userId) };
  });
}
