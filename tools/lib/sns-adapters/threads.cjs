'use strict';
// Provider contract: credential fields, connection check and publish implementation.

module.exports = function createAdapter({ apiMessage, fetchWithRetry, responseJson }) {
const fields = {"threads": [['accessToken', 'Threads access token', true], ['userId', 'Threads user ID', false]]};
async function threadsPublish(item, account, credential, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  if (!credential.userId) throw new Error('Threads userId가 필요합니다.');
  const remote = item.remoteMediaUrls?.[0];
  if ((item.images?.length || item.video) && !remote) {
    throw new Error('Threads 첨부 자료에는 승인된 HTTPS 미디어 URL이 필요합니다. 이미지를 빼고 게시하지 않습니다.');
  }
  const create = new URLSearchParams({ text: item.text });
  if (remote) {
    create.set('media_type', item.video ? 'VIDEO' : 'IMAGE');
    create.set(item.video ? 'video_url' : 'image_url', remote);
  } else create.set('media_type', 'TEXT');
  const response = await fetchWithRetry(`https://graph.threads.net/v1.0/${credential.userId}/threads`, {
    method: 'POST', headers: { authorization: `Bearer ${credential.accessToken}`, 'content-type': 'application/x-www-form-urlencoded' }, body: create,
  }, { fetchImpl });
  const body = await responseJson(response);
  if (!response.ok || !body.id) throw new Error(`Threads 컨테이너 생성 실패 ${response.status}: ${apiMessage(body)}`);
  const publish = await fetchWithRetry(`https://graph.threads.net/v1.0/${credential.userId}/threads_publish`, {
    method: 'POST',
    headers: { authorization: `Bearer ${credential.accessToken}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ creation_id: body.id }),
  }, { fetchImpl });
  const published = await responseJson(publish);
  if (!publish.ok || !published.id) throw new Error(`Threads 게시 실패 ${publish.status}: ${apiMessage(published)}`);
  return { state: 'published', id: published.id };
}

async function check(account, credential, fetchImpl) {
    if (!credential.userId) return { state: 'needs-config', detail: 'Threads userId 필요' };
    const response = await fetchWithRetry(`https://graph.threads.net/v1.0/${credential.userId}?fields=id,username`, {
      headers: { authorization: `Bearer ${credential.accessToken}` },
    }, { fetchImpl });
    const body = await responseJson(response);
    if (!response.ok) throw new Error(`Threads 연결 확인 실패 ${response.status}: ${apiMessage(body)}`);
    return { state: 'connected', detail: body.username || body.id };
  
}
return { fields: fields.threads, check, publish: threadsPublish, threadsPublish };
};
