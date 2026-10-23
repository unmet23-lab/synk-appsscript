'use strict';
// Provider contract: credential fields, connection check and publish implementation.
const fs = require('node:fs');
const path = require('node:path');
module.exports = function createAdapter({ apiMessage, fetchWithRetry, mimeFor, resolveRepoPath, responseJson }) {
const fields = {"facebook": [['accessToken', 'Page access token', true], ['pageId', 'Facebook Page ID', false], ['graphVersion', 'Graph API version', false]],
"instagram": [['accessToken', 'Meta access token', true], ['igUserId', 'Instagram professional account ID', false], ['graphVersion', 'Graph API version', false], ['mediaBaseUrl', 'Approved HTTPS media base URL', false]]};
async function facebookPublish(item, account, credential, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const version = credential.graphVersion || account.graphVersion;
  if (!version || !credential.pageId) throw new Error('Facebook graphVersion과 pageId가 필요합니다.');
  const base = `https://graph.facebook.com/${version}`;
  const mediaIds = [];
  for (const imagePath of item.images || []) {
    const file = resolveRepoPath(imagePath);
    const form = new FormData();
    form.append('published', 'false');
    form.append('source', new Blob([fs.readFileSync(file)], { type: mimeFor(file) }), path.basename(file));
    const response = await fetchWithRetry(`${base}/${credential.pageId}/photos`, {
      method: 'POST', headers: { authorization: `Bearer ${credential.accessToken}` }, body: form,
    }, { fetchImpl });
    const body = await responseJson(response);
    if (!response.ok || !body.id) throw new Error(`Facebook 사진 업로드 실패 ${response.status}: ${apiMessage(body)}`);
    mediaIds.push(body.id);
  }
  const form = new URLSearchParams({ message: item.text });
  mediaIds.forEach((id, index) => form.set(`attached_media[${index}]`, JSON.stringify({ media_fbid: id })));
  if (item.publish?.publishAt) {
    form.set('published', 'false');
    form.set('scheduled_publish_time', String(Math.floor(new Date(item.publish.publishAt).getTime() / 1000)));
  }
  const response = await fetchWithRetry(`${base}/${credential.pageId}/feed`, {
    method: 'POST',
    headers: { authorization: `Bearer ${credential.accessToken}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
  }, { fetchImpl });
  const body = await responseJson(response);
  if (!response.ok || !body.id) throw new Error(`Facebook 게시 실패 ${response.status}: ${apiMessage(body)}`);
  return { state: item.publish?.publishAt ? 'scheduled' : 'published', id: body.id };
}

async function check(account, credential, fetchImpl) {
    const version = credential.graphVersion || account.graphVersion;
    const id = account.platform === 'facebook' ? credential.pageId : credential.igUserId;
    if (!version || !id) return { state: 'needs-config', detail: 'graphVersion과 계정 ID 필요' };
    const response = await fetchWithRetry(`https://graph.facebook.com/${version}/${id}?fields=id,name,username`, {
      headers: { authorization: `Bearer ${credential.accessToken}` },
    }, { fetchImpl });
    const body = await responseJson(response);
    if (!response.ok) throw new Error(`Meta 연결 확인 실패 ${response.status}: ${apiMessage(body)}`);
    return { state: 'connected', detail: body.username || body.name || body.id };
  
}
return { facebook: { fields: fields.facebook, check, publish: facebookPublish }, instagram: { fields: fields.instagram, check, publish() { throw new Error('Instagram은 승인된 HTTPS 미디어 보관소 연결 후 활성화합니다.'); } }, facebookPublish };
};
