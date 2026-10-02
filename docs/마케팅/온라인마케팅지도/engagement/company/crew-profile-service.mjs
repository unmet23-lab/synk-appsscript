import AtlasWork from '../../../../../atlas/work.js';
import { randomUUID } from 'node:crypto';

const skills = [
  ['planning', '콘텐츠 기획'], ['research', '리서치'], ['copywriting', '카피라이팅'], ['design', '디자인'], ['filming', '영상 촬영'], ['video-editing', '영상 편집'], ['channel-operations', '채널 운영'], ['data-analysis', '데이터 분석'], ['development', '개발'], ['project-operations', '프로젝트 운영'],
].map(([id, label]) => Object.freeze({ id, label }));
export const CREW_PROFILE_CATALOG = Object.freeze({
  skills: Object.freeze(skills), preferredTasks: Object.freeze([...skills]),
  communication: Object.freeze([{ value: 'async', label: '기록으로 소통' }, { value: 'live', label: '실시간 대화' }, { value: 'flexible', label: '상황에 맞게' }]),
  workMode: Object.freeze([{ value: 'solo', label: '개별 작업' }, { value: 'pair', label: '짝 작업' }, { value: 'flexible', label: '상황에 맞게' }]),
});
export const CREW_PROFILE_SUGGESTIONS = CREW_PROFILE_CATALOG;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const engine = Object.freeze({ id: 'crew-work', version: AtlasWork.VERSION });
const fields = ['skills', 'preferredTasks', 'communication', 'workMode', 'availableHours', 'participates'];

export function createCrewProfileService({ store, clock }) {
  function current(user) {
    const row = typeof user?.id === 'string' ? store.get('users', user.id) : null;
    if (!row?.active || !['admin', 'manager', 'member', 'viewer'].includes(row.role)) throw fail('로그인 상태를 다시 확인해 주세요.', 401);
    return row;
  }
  function teamFor(id) { return typeof id === 'string' && id ? store.get('teams', id) : null; }
  function permissions(user) {
    const team = teamFor(user.teamId), allowed = user.role === 'admin' || (user.role === 'manager' && team?.active === true);
    return { canEvaluate: allowed, workScope: user.role === 'admin' ? 'company' : user.role === 'manager' && team?.active ? 'team' : null };
  }
  function profileFor(userId) {
    const row = store.get('crewWorkProfiles', userId);
    if (!row || row.userId !== userId || row.schemaVersion !== AtlasWork.PROFILE_SCHEMA_VERSION) return null;
    try {
      const normalized = AtlasWork.normalizeProfile({ ...Object.fromEntries(fields.map(key => [key, row[key]])), confirmed: true }, CREW_PROFILE_CATALOG.skills);
      const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null;
      return { ...normalized, userId, confirmedAt: timestamp(row.confirmedAt), updatedAt: timestamp(row.updatedAt), revision: revisionFor(userId) };
    } catch { return null; }
  }
  function revisionFor(userId) { return store.get('crewWorkRevisions', userId)?.revision ?? null; }
  function checkRevision(userId, input) {
    if (!object(input) || !Object.hasOwn(input, 'expectedRevision') || !(input.expectedRevision === null || typeof input.expectedRevision === 'string')) throw fail('업무카드를 다시 열어 현재 내용을 확인해 주세요.');
    if (input.expectedRevision !== revisionFor(userId)) throw fail('다른 화면에서 업무카드가 변경되었습니다. 현재 내용을 다시 확인한 뒤 저장해 주세요.', 409);
  }
  function own(user) {
    user = current(user);
    const profile = profileFor(user.id);
    return { engine, profile, revision: revisionFor(user.id), catalog: CREW_PROFILE_CATALOG, permissions: permissions(user), completeness: profile ? AtlasWork.information(profile) : null };
  }
  function save(user, input) {
    user = current(user);
    if (!object(input)) throw fail('업무카드 입력을 확인해 주세요.');
    const { expectedRevision, ...declaration } = input;
    const value = AtlasWork.normalizeProfile(declaration, CREW_PROFILE_CATALOG.skills), at = clock();
    store.transaction(() => {
      checkRevision(user.id, input);
      const prior = profileFor(user.id);
      const sharingOnly = prior?.confirmedAt && prior.participates !== value.participates && fields.filter(field => field !== 'participates').every(field => JSON.stringify(prior[field]) === JSON.stringify(value[field]));
      store.put('crewWorkProfiles', user.id, { ...value, userId: user.id, confirmedAt: sharingOnly ? prior.confirmedAt : at, updatedAt: at });
      store.put('crewWorkRevisions', user.id, { revision: randomUUID() });
    });
    return own(user);
  }
  function remove(user, input) {
    user = current(user);
    if (!object(input) || Object.keys(input).some(key => key !== 'expectedRevision')) throw fail('본인의 업무카드만 삭제할 수 있습니다.');
    store.transaction(() => {
      checkRevision(user.id, input);
      store.remove('crewWorkProfiles', user.id);
      // Retain only a content-free revision so an older empty form cannot revive deleted consent.
      store.put('crewWorkRevisions', user.id, { revision: randomUUID() });
    });
    return { ...own(user), ok: true };
  }
  function roster(user) {
    user = current(user);
    const allowed = permissions(user);
    if (!allowed.canEvaluate) throw fail('관리자 또는 활성 팀의 팀장만 업무카드를 살펴볼 수 있습니다.', 403);
    const team = user.role === 'manager' ? teamFor(user.teamId) : null;
    const people = store.all('users').filter(person => person.active && ['admin', 'manager', 'member', 'viewer'].includes(person.role) && (user.role === 'admin' || person.teamId === team.id));
    const members = people.map(person => {
      const personTeam = teamFor(person.teamId), profile = profileFor(person.id);
      const shared = !!(profile?.participates && profile.confirmedAt);
      return { id: person.id, name: person.name, teamId: personTeam?.active ? personTeam.id : null, teamName: personTeam?.active ? personTeam.name : null, shared, ...(shared ? { profile, completeness: AtlasWork.information(profile) } : {}) };
    });
    const sharedCount = members.filter(member => member.shared).length;
    return { engine, catalog: CREW_PROFILE_CATALOG, scope: { type: allowed.workScope, teamId: team?.id || null, teamName: team?.name || null }, members, summary: { activeCount: members.length, sharedCount, unsharedCount: members.length - sharedCount }, permissions: { canEvaluate: true } };
  }
  function evaluate(user, input) {
    // Resolve both current organization access and current sharing consent for every request.
    const visible = roster(user), criteria = AtlasWork.normalizeCriteria(input, CREW_PROFILE_CATALOG.skills);
    const allowed = new Set(visible.members.filter(member => member.shared).map(member => member.id));
    if (criteria.memberIds.some(id => !allowed.has(id))) throw fail('현재 범위에서 공유 중인 업무카드를 다시 선택해 주세요.', 404);
    return { ...AtlasWork.evaluate(criteria, visible.members, CREW_PROFILE_CATALOG.skills), scope: visible.scope };
  }
  return { own, save, remove, roster, evaluate };
}
