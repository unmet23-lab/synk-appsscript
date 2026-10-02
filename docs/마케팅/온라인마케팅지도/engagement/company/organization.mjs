import { randomUUID } from 'node:crypto';

export const ORGANIZATION_ROLES = Object.freeze(['admin', 'manager', 'member', 'viewer']);
const roles = new Set(ORGANIZATION_ROLES);
const teamOf = value => typeof value?.teamId === 'string' && value.teamId.trim() ? value.teamId : null;
const validUser = user => !!user && typeof user.id === 'string' && !!user.id && user.active !== false && roles.has(user.role);
const owns = (user, channel) => Array.isArray(channel?.ownerIds) && channel.ownerIds.includes(user.id);
const sameTeam = (user, channel) => teamOf(user) !== null && teamOf(user) === teamOf(channel);

export function canReadChannel(user, channel) {
  if (!validUser(user) || !channel) return false;
  if (user.role === 'admin') return true;
  if (owns(user, channel)) return true;
  return (user.role === 'manager' || user.role === 'viewer') && sameTeam(user, channel);
}

export function canWriteChannel(user, channel) {
  return user?.role !== 'viewer' && canReadChannel(user, channel);
}

export function canManageOwners(user, channel) {
  return validUser(user) && !!channel && (user.role === 'admin' || (user.role === 'manager' && sameTeam(user, channel)));
}

function safeMember(user, full) {
  const result = {id:user.id, name:user.name, role:user.role, teamId:teamOf(user), active:user.active !== false};
  if (full) {
    if (typeof user.email === 'string') result.email = user.email;
    if (typeof user.createdAt === 'string') result.createdAt = user.createdAt;
  }
  return result;
}

export function visibleMembers(store, user) {
  if (!validUser(user)) return [];
  const members = store.all('users');
  if (user.role === 'admin') return members.map(member => safeMember(member, true));
  if (user.role === 'manager') return members.filter(member => member.id === user.id || sameTeam(user, member)).map(member => safeMember(member, true));
  const visibleOwnerIds = new Set(store.all('channels').filter(channel => canReadChannel(user, channel)).flatMap(channel => Array.isArray(channel.ownerIds) ? channel.ownerIds : []));
  visibleOwnerIds.add(user.id);
  return members.filter(member => visibleOwnerIds.has(member.id)).map(member => safeMember(member, member.id === user.id));
}

function instant(value, label = '적용 시각') {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!match || Number(match[2]) < 1 || Number(match[2]) > 12 || Number(match[3]) < 1 || Number(match[3]) > new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate()) throw new Error(`${label}에는 시간대가 포함된 올바른 날짜와 시간을 입력해 주세요.`);
  } else if (!(value instanceof Date) && typeof value !== 'number') throw new Error(`${label}을 확인해 주세요.`);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label}을 확인해 주세요.`);
  return date.toISOString();
}

function ownership(channel) {
  if (!channel || typeof channel.id !== 'string' || !channel.id) throw new Error('담당 채널을 확인해 주세요.');
  if (!Array.isArray(channel.ownerIds) || channel.ownerIds.some(id => typeof id !== 'string' || !id.trim())) throw new Error('담당자 목록을 확인해 주세요.');
  if (channel.teamId != null && (typeof channel.teamId !== 'string' || !channel.teamId.trim())) throw new Error('소속 팀을 확인해 주세요.');
  return {ownerIds:[...new Set(channel.ownerIds)], teamId:teamOf(channel)};
}

const sameOwnership = (left, right) => left.teamId === right.teamId && left.ownerIds.length === right.ownerIds.length && left.ownerIds.every(id => right.ownerIds.includes(id));

function channelEvents(events, channelId) {
  return events.map((event, index) => ({event, index, effective:Date.parse(event.effectiveAt), recorded:Date.parse(event.recordedAt)}))
    .filter(row => row.event.channelId === channelId && Number.isFinite(row.effective))
    .sort((a, b) => a.effective - b.effective || (Number.isSafeInteger(a.event.sequence) && Number.isSafeInteger(b.event.sequence) ? a.event.sequence - b.event.sequence : 0) || (Number.isFinite(a.recorded) && Number.isFinite(b.recorded) ? a.recorded - b.recorded : 0) || a.index - b.index)
    .map(row => row.event);
}

// The baseline says what was known at migration time; it cannot establish earlier ownership.
export function seedOwnership(store, channel, at = new Date()) {
  const state = ownership(channel), effectiveAt = instant(at);
  const existing = channelEvents(store.all('ownershipEvents'), channel.id);
  if (existing.length) return existing.find(event => event.baseline) || existing[0];
  const event = {id:`ownership-baseline:${channel.id}`, channelId:channel.id,
    beforeOwnerIds:[], afterOwnerIds:state.ownerIds, beforeTeamId:null, afterTeamId:state.teamId,
    effectiveAt, recordedAt:new Date().toISOString(), actorId:null, reason:'migration', baseline:true, sequence:0};
  store.put('ownershipEvents', event.id, event);
  return event;
}

// Call this inside the same Store transaction as the channel update. It only appends history.
export function recordOwnershipChange(store, before, after, {actorId = null, at = new Date(), reason = 'assignment'} = {}) {
  const previous = ownership(before), next = ownership(after), effectiveAt = instant(at);
  if (before.id !== after.id) throw new Error('같은 채널의 담당 변경만 기록할 수 있습니다.');
  if (actorId !== null && (typeof actorId !== 'string' || !actorId.trim())) throw new Error('변경 담당자를 확인해 주세요.');
  if (typeof reason !== 'string' || !reason.trim()) throw new Error('변경 사유를 입력해 주세요.');
  if (sameOwnership(previous, next)) return null;
  const existing = channelEvents(store.all('ownershipEvents'), before.id), last = existing.at(-1);
  if (last) {
    if (Date.parse(effectiveAt) < Date.parse(last.effectiveAt)) throw new Error('마지막 담당 변경보다 이전 시각으로 변경할 수 없습니다.');
    if (!sameOwnership(previous, {ownerIds:last.afterOwnerIds, teamId:last.afterTeamId ?? null})) throw new Error('담당 정보가 이미 변경됐습니다. 현재 정보를 다시 확인해 주세요.');
  } else seedOwnership(store, before, effectiveAt);
  const event = {id:randomUUID(), channelId:before.id,
    beforeOwnerIds:previous.ownerIds, afterOwnerIds:next.ownerIds, beforeTeamId:previous.teamId, afterTeamId:next.teamId,
    effectiveAt, recordedAt:new Date().toISOString(), actorId, reason:reason.trim().slice(0,400), baseline:false,
    sequence:Math.max(0,...existing.map(row => Number.isSafeInteger(row.sequence) ? row.sequence : 0))+1};
  store.put('ownershipEvents', event.id, event);
  return event;
}

// An event is effective inclusively: a snapshot at its exact timestamp belongs to its after-state.
export function ownerAt(events, channel, at) {
  const cutoff = Date.parse(instant(at, '조회 시각'));
  const latest = channelEvents(Array.isArray(events) ? events : [], channel?.id).filter(event => Date.parse(event.effectiveAt) <= cutoff).at(-1);
  if (!latest) return {ownerIds:[], teamId:null, known:false};
  return {ownerIds:[...latest.afterOwnerIds], teamId:latest.afterTeamId ?? null, known:true};
}
