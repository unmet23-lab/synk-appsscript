'use strict';
// Provider contract: credential fields, connection check and publish implementation.
const fs = require('node:fs');
module.exports = function createAdapter({ apiMessage, fetchWithRetry, mimeFor, resolveRepoPath, responseJson }) {
const fields = {"pinterest": [['accessToken', 'Pinterest access token', true], ['boardId', 'Board ID', false]]};
async function pinterestPublish(item, account, credential, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  if (!credential.boardId) throw new Error('Pinterest boardId가 필요합니다.');
  if (!item.images?.[0]) throw new Error('Pinterest 핀 이미지가 없습니다.');
  const image = resolveRepoPath(item.images[0]);
  const response = await fetchWithRetry('https://api.pinterest.com/v5/pins', {
    method: 'POST',
    headers: { authorization: `Bearer ${credential.accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      board_id: credential.boardId,
      title: item.title.slice(0, 100),
      description: item.text.slice(0, 500),
      alt_text: String(item.alt?.[0] || '').slice(0, 500),
      ...(item.link ? { link: item.link } : {}),
      media_source: { source_type: 'image_base64', content_type: mimeFor(image), data: fs.readFileSync(image).toString('base64') },
    }),
  }, { fetchImpl });
  const body = await responseJson(response);
  if (!response.ok) throw new Error(`Pinterest 핀 발행 실패 ${response.status}: ${apiMessage(body)}`);
  return { state: 'published', id: body.id, url: body.id ? `https://www.pinterest.com/pin/${body.id}/` : null };
}

async function check(account, credential, fetchImpl) {
    const response = await fetchWithRetry('https://api.pinterest.com/v5/user_account', {
      headers: { authorization: `Bearer ${credential.accessToken}` },
    }, { fetchImpl });
    const body = await responseJson(response);
    if (!response.ok) throw new Error(`Pinterest 연결 확인 실패 ${response.status}: ${apiMessage(body)}`);
    return { state: credential.boardId ? 'connected' : 'needs-board', detail: body.username || body.business_name || '인증됨' };
  
}
return { fields: fields.pinterest, check, publish: pinterestPublish, pinterestPublish };
};
