'use strict';
const RESOURCES = Object.freeze(['path', 'platform-library', 'member-insight', 'member-understanding']);
const LIMITS = Object.freeze({ path: 64 * 1024, 'platform-library':64 * 1024, 'member-insight':256 * 1024, 'member-understanding':64 * 1024 });
const PLATFORM_OPERATIONS = Object.freeze({ platformLoad: 'platform-library', platformSave: 'platform-library', platformDelete: 'platform-library', insightLoad: 'member-insight', insightSave: 'member-insight', insightDelete: 'member-insight', understandingLoad: 'member-understanding', understandingSave: 'member-understanding', understandingDelete: 'member-understanding' });
const PERSONAL_OPERATIONS = Object.freeze(['personalLoad', 'personalSave', 'personalDelete']);
const invalid = () => { throw Object.assign(new Error('개인 자료 요청을 확인해 주세요.'), { code: 'INVALID_REQUEST' }); };
const uuid = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
function personalRequestSpec(operation, params = {}, product, resource) {
  if (product !== 'platform' || !RESOURCES.includes(resource) || !params || typeof params !== 'object' || Array.isArray(params)) invalid();
  const keys = allowed => { if (Object.keys(params).some(key => !allowed.includes(key))) invalid(); };
  const revision = value => { if (!Number.isSafeInteger(value) || value < 0) invalid(); return value; };
  if (operation === 'personalLoad') { keys([]); return { path: 'synk-personal?resource=' + encodeURIComponent(resource) }; }
  if (operation === 'personalSave') {
    keys(['expected_revision', 'state']);
    if (!params.state || typeof params.state !== 'object' || Array.isArray(params.state)) invalid();
    let state;
    try { state = JSON.stringify(params.state, (_key, value) => { if (value === undefined || ['function', 'symbol', 'bigint'].includes(typeof value) || typeof value === 'number' && !Number.isFinite(value)) invalid(); return value; }); } catch { invalid(); }
    if (Buffer.byteLength(state, 'utf8') > LIMITS[resource]) invalid();
    return { path: 'synk-personal', body: { resource, action: 'save', expected_revision: revision(params.expected_revision), state: JSON.parse(state) } };
  }
  if (operation === 'personalDelete') {
    keys(['expected_revision', ...(resource === 'member-understanding' ? ['document_version'] : [])]);
    if (Object.hasOwn(params, 'document_version') && ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(params.document_version)) invalid();
    return { path: 'synk-personal', body: { resource, action: 'delete', expected_revision: revision(params.expected_revision),
      ...(Object.hasOwn(params, 'document_version') ? { document_version: params.document_version } : {}) } };
  }
  invalid();
}
module.exports = { RESOURCES, LIMITS, PERSONAL_OPERATIONS, PLATFORM_OPERATIONS, uuid, personalRequestSpec };
