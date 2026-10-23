'use strict';
// Provider contract: credential fields, connection check and publish implementation.
const fs = require('node:fs');
module.exports = function createAdapter({ apiMessage, fetchWithRetry, mimeFor, resolveRepoPath, responseJson }) {
const fields = {"linkedin": [['accessToken', 'LinkedIn access token', true], ['authorUrn', 'Author URN', false], ['apiVersion', 'LinkedIn API version YYYYMM', false]]};
async function linkedinPublish(item, account, credential, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const version = credential.apiVersion || account.apiVersion;
  if (!version || !credential.authorUrn) throw new Error('LinkedIn apiVersion과 authorUrn이 필요합니다.');
  const headers = {
    authorization: `Bearer ${credential.accessToken}`,
    'linkedin-version': version,
    'x-restli-protocol-version': '2.0.0',
    'content-type': 'application/json',
  };
  let content;
  if (item.document) {
    const initResponse = await fetchWithRetry('https://api.linkedin.com/rest/documents?action=initializeUpload', {
      method: 'POST', headers, body: JSON.stringify({ initializeUploadRequest: { owner: credential.authorUrn } }),
    }, { fetchImpl });
    const init = await responseJson(initResponse);
    if (!initResponse.ok) throw new Error(`LinkedIn 문서 준비 실패 ${initResponse.status}: ${apiMessage(init)}`);
    const uploadUrl = init.value?.uploadUrl;
    const document = init.value?.document;
    if (!uploadUrl || !document) throw new Error('LinkedIn 문서 업로드 URL/URN이 없습니다.');
    const file = resolveRepoPath(item.document);
    const uploadResponse = await fetchWithRetry(uploadUrl, {
      method: 'PUT', headers: { authorization: `Bearer ${credential.accessToken}`, 'content-type': mimeFor(file) }, body: fs.readFileSync(file),
    }, { fetchImpl });
    if (!uploadResponse.ok) throw new Error(`LinkedIn 문서 업로드 실패 ${uploadResponse.status}`);
    content = { media: { title: item.title, id: document } };
  }
  const response = await fetchWithRetry('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      author: credential.authorUrn,
      commentary: item.text,
      visibility: 'PUBLIC',
      distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      ...(content ? { content } : {}),
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  }, { fetchImpl });
  const body = await responseJson(response);
  if (!response.ok) throw new Error(`LinkedIn 게시 실패 ${response.status}: ${apiMessage(body)}`);
  return { state: 'published', id: response.headers.get('x-restli-id') || body.id || null };
}

async function check(account, credential, fetchImpl) {
    if (!credential.authorUrn) return { state: 'needs-config', detail: 'LinkedIn authorUrn 필요' };
    const response = await fetchWithRetry('https://api.linkedin.com/v2/userinfo', {
      headers: { authorization: `Bearer ${credential.accessToken}` },
    }, { fetchImpl });
    const body = await responseJson(response);
    if (!response.ok) throw new Error(`LinkedIn 연결 확인 실패 ${response.status}: ${apiMessage(body)}`);
    return { state: 'connected', detail: body.name || body.sub || credential.authorUrn };
  
}
return { fields: fields.linkedin, check, publish: linkedinPublish, linkedinPublish };
};
