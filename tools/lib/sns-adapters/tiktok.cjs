'use strict';
// Provider contract: credential fields, connection check and publish implementation.
const fs = require('node:fs');
module.exports = function createAdapter({ apiMessage, fetchWithRetry, mimeFor, resolveRepoPath, responseJson }) {
const fields = {"tiktok": [['accessToken', 'TikTok access token', true], ['refreshToken', 'TikTok refresh token', true], ['clientKey', 'Client key', false], ['clientSecret', 'Client secret', true], ['openId', 'Open ID', false]]};
async function tiktokPublish(item, account, credential, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  if (!item.video) throw new Error('TikTok video.mp4가 없습니다.');
  const controls = item.publish?.tiktok;
  if (!controls?.privacyLevel) throw new Error('TikTok 공개범위 검수값이 없습니다.');
  const file = resolveRepoPath(item.video);
  const size = fs.statSync(file).size;
  const chunkSize = Math.min(64 * 1024 * 1024, Math.max(5 * 1024 * 1024, Math.ceil(size / 1000 / (256 * 1024)) * 256 * 1024));
  const totalChunkCount = Math.ceil(size / chunkSize);
  const initResponse = await fetchWithRetry('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: { authorization: `Bearer ${credential.accessToken}`, 'content-type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      post_info: {
        title: item.text.slice(0, 2200),
        privacy_level: controls.privacyLevel,
        disable_duet: Boolean(controls.disableDuet),
        disable_comment: Boolean(controls.disableComment),
        disable_stitch: Boolean(controls.disableStitch),
        video_cover_timestamp_ms: Number(controls.coverTimestampMs || 1000),
      },
      source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunkSize, total_chunk_count: totalChunkCount },
    }),
  }, { fetchImpl });
  const init = await responseJson(initResponse);
  if (!initResponse.ok || init.error?.code !== 'ok') throw new Error(`TikTok 업로드 준비 실패 ${initResponse.status}: ${apiMessage(init)}`);
  const uploadUrl = init.data?.upload_url;
  const publishId = init.data?.publish_id;
  if (!uploadUrl || !publishId) throw new Error('TikTok upload_url/publish_id가 없습니다.');
  const fd = fs.openSync(file, 'r');
  try {
    for (let offset = 0; offset < size;) {
      const length = Math.min(chunkSize, size - offset);
      const end = offset + length - 1;
      const buffer = Buffer.allocUnsafe(length);
      fs.readSync(fd, buffer, 0, length, offset);
      const response = await fetchWithRetry(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': mimeFor(file), 'content-length': String(length), 'content-range': `bytes ${offset}-${end}/${size}` },
        body: buffer,
      }, { fetchImpl });
      if (!response.ok && response.status !== 201) {
        const body = await responseJson(response);
        throw new Error(`TikTok 영상 업로드 실패 ${response.status}: ${apiMessage(body)}`);
      }
      offset = end + 1;
    }
  } finally { fs.closeSync(fd); }
  return { state: 'processing', id: publishId };
}

async function check(account, credential, fetchImpl) {
    const response = await fetchWithRetry('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
      method: 'POST',
      headers: { authorization: `Bearer ${credential.accessToken}`, 'content-type': 'application/json; charset=UTF-8' },
      body: '{}',
    }, { fetchImpl });
    const body = await responseJson(response);
    if (!response.ok || body.error?.code !== 'ok') throw new Error(`TikTok 연결 확인 실패 ${response.status}: ${apiMessage(body)}`);
    return { state: 'connected', detail: body.data?.creator_username || '인증됨', controls: body.data };
  
}
return { fields: fields.tiktok, check, publish: tiktokPublish, tiktokPublish };
};
