/* Explicit work-profile declarations and human-selected team review.
 * Pure calculations only. Callers own authentication, consent, identity, storage,
 * current organization scope and the verified confirmation timestamp.
 * This module does not read LAB learning logs or infer personal characteristics.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SynkAtlasWork = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 'atlas-work-1';
  const PROFILE_SCHEMA_VERSION = 1;
  const COMMUNICATION = Object.freeze(['async', 'live', 'flexible']);
  const WORK_MODE = Object.freeze(['solo', 'pair', 'flexible']);
  const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const fail = message => { throw new TypeError(message); };
  const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,120}$/.test(value);
  function fields(input, allowed) {
    if (!object(input) || Object.keys(input).some(key => !allowed.includes(key))) fail('입력할 수 있는 업무 항목을 확인해 주세요.');
  }
  function catalogEntries(catalog) {
    if (!Array.isArray(catalog) || !catalog.length || catalog.length > 100 || catalog.some(item => !object(item) || !validId(item.id) || typeof item.label !== 'string' || !item.label || item.label.length > 80) || new Set(catalog.map(item => item.id)).size !== catalog.length) fail('업무 기술 목록을 확인해 주세요.');
    return new Map(catalog.map(item => [item.id, item.label]));
  }
  function choices(value, allowed, { required = false } = {}) {
    if (!Array.isArray(value) || value.length > 12 || value.some(id => typeof id !== 'string' || !allowed.has(id))) fail('업무 기술 목록에서 항목을 선택해 주세요.');
    const result = [...new Set(value)];
    if (required && !result.length) fail('확인할 업무 기술을 한 개 이상 선택해 주세요.');
    return result;
  }
  function hours(value, nullable = true) {
    if (nullable && value === null) return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 80 || Math.round(value * 2) !== value * 2) fail('주당 가능 시간은 0~80시간 사이에서 0.5시간 단위로 입력해 주세요.');
    return value;
  }
  function option(value, options) {
    if (value === null) return null;
    if (!options.includes(value)) fail('협업 방식 목록에서 항목을 선택해 주세요.');
    return value;
  }
  function normalizeProfile(input, catalog) {
    fields(input, ['skills', 'preferredTasks', 'communication', 'workMode', 'availableHours', 'participates', 'confirmed']);
    if (input.confirmed !== true) fail('본인이 입력한 업무 정보를 확인한 뒤 저장해 주세요.');
    if (typeof input.participates !== 'boolean') fail('업무카드 공유 여부를 직접 선택해 주세요.');
    const allowed = catalogEntries(catalog);
    return { schemaVersion: PROFILE_SCHEMA_VERSION, skills: choices(input.skills ?? [], allowed), preferredTasks: choices(input.preferredTasks ?? [], allowed), communication: option(input.communication ?? null, COMMUNICATION), workMode: option(input.workMode ?? null, WORK_MODE), availableHours: hours(input.availableHours ?? null), participates: input.participates };
  }
  function information(profile) {
    const missing = [];
    if (!profile.skills.length) missing.push('skills');
    if (!profile.preferredTasks.length) missing.push('preferredTasks');
    if (profile.communication === null) missing.push('communication');
    if (profile.workMode === null) missing.push('workMode');
    if (profile.availableHours === null) missing.push('availableHours');
    return { complete: missing.length === 0, missing };
  }
  function normalizeCriteria(input, catalog) {
    fields(input, ['requiredSkills', 'memberIds', 'minAvailableHours']);
    if (!Array.isArray(input.memberIds) || !input.memberIds.length || input.memberIds.length > 20 || input.memberIds.some(id => !validId(id))) fail('검토할 크루를 1~20명 직접 선택해 주세요.');
    return { requiredSkills: choices(input.requiredSkills, catalogEntries(catalog), { required: true }), memberIds: [...new Set(input.memberIds)], minAvailableHours: hours(input.minAvailableHours, false) };
  }
  function evaluate(input, cards, catalog) {
    const criteria = normalizeCriteria(input, catalog), labels = catalogEntries(catalog);
    if (!Array.isArray(cards)) fail('확인된 업무카드를 전달해 주세요.');
    const available = new Map(cards.filter(card => card?.shared === true).map(card => [card.id, card]));
    const selected = criteria.memberIds.map(id => {
      const card = available.get(id);
      if (!card || card.profile?.schemaVersion !== PROFILE_SCHEMA_VERSION || card.profile.participates !== true || typeof card.profile.confirmedAt !== 'string' || !Number.isFinite(Date.parse(card.profile.confirmedAt))) fail('현재 공유된 업무카드만 검토할 수 있습니다.');
      return card;
    });
    const coverage = criteria.requiredSkills.map(skill => {
      const memberIds = selected.filter(card => card.profile.skills.includes(skill)).map(card => card.id);
      return { skill, label: labels.get(skill), covered: memberIds.length > 0, memberIds };
    });
    const missingSkills = coverage.filter(item => !item.covered).map(item => item.skill);
    const availability = selected.map(card => {
      const value = card.profile.availableHours;
      const status = value === null ? 'unknown' : value === 0 ? 'zero' : value < criteria.minAvailableHours ? 'insufficient' : 'available';
      return { userId: card.id, availableHours: value, status, meetsMinimum: value === null ? null : value >= criteria.minAvailableHours, shortfall: value === null ? null : Math.max(0, criteria.minAvailableHours - value) };
    });
    const countOptions = (field, values) => Object.fromEntries([...values, 'unknown'].map(value => [value, selected.filter(card => (card.profile[field] ?? 'unknown') === value).length]));
    const collaboration = { communication: countOptions('communication', COMMUNICATION), workMode: countOptions('workMode', WORK_MODE) };
    const warnings = [];
    if (missingSkills.length) warnings.push(`선택한 카드에서 확인되지 않은 업무 기술: ${missingSkills.map(id => labels.get(id)).join(', ')}. 미기재는 역량 부족을 뜻하지 않습니다.`);
    if (availability.some(item => item.status === 'unknown')) warnings.push('주당 가능 시간을 입력하지 않은 크루가 있습니다. 직접 확인해 주세요.');
    if (availability.some(item => item.status === 'zero')) warnings.push('주당 가능 시간을 0시간으로 입력한 크루가 있습니다. 참여 가능한 시점을 직접 확인해 주세요.');
    if (availability.some(item => item.status === 'insufficient')) warnings.push('요청한 시간보다 적은 가능 시간을 입력한 크루가 있습니다. 일정 조정이 가능한지 확인해 주세요.');
    if (selected.some(card => information(card.profile).missing.length)) warnings.push('아직 입력하지 않은 업무 정보가 있습니다. 미입력 항목은 추정하지 않았습니다.');
    if (collaboration.communication.async && collaboration.communication.live) warnings.push('기록 중심과 실시간 소통 선호가 함께 있습니다. 소통 시간을 미리 합의해 주세요.');
    if (collaboration.workMode.solo && collaboration.workMode.pair) warnings.push('개별 작업과 짝 작업 선호가 함께 있습니다. 업무를 나누는 방식을 미리 합의해 주세요.');
    return { engine: { id: 'crew-work', version: VERSION }, criteria, selected, coverage, missingSkills, availability, collaboration, complete: !missingSkills.length && availability.every(item => item.status === 'available'), warnings, metadata: { basis: 'self-confirmed-work-profile', automaticSelection: false, automaticAssignment: false, generative: false, externalCalls: false } };
  }
  return Object.freeze({ VERSION, PROFILE_SCHEMA_VERSION, COMMUNICATION, WORK_MODE, normalizeProfile, information, normalizeCriteria, evaluate });
});
