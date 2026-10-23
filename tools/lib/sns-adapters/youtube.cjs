'use strict';
// Provider contract: credential fields, connection check and publish implementation.
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
module.exports = function createAdapter({ apiMessage, fetchWithRetry, mimeFor, resolveRepoPath, responseJson }) {
const fields = {"youtube": []};
async function googleAccessToken(credential, fetchImpl = fetch) {
  const response = await fetchWithRetry('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credential.clientId,
      client_secret: credential.clientSecret,
      refresh_token: credential.refreshToken,
      grant_type: 'refresh_token',
    }),
  }, { fetchImpl });
  const body = await responseJson(response);
  if (!response.ok || !body.access_token) throw new Error(`Google 인증 갱신 실패 ${response.status}: ${apiMessage(body)}`);
  return { accessToken: body.access_token, scope: body.scope || '' };
}

async function youtubeChannel(credential, fetchImpl = fetch) {
  const token = await googleAccessToken(credential, fetchImpl);
  const response = await fetchWithRetry('https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true', {
    headers: { authorization: `Bearer ${token.accessToken}` },
  }, { fetchImpl });
  const body = await responseJson(response);
  if (!response.ok) throw new Error(`YouTube 채널 확인 실패 ${response.status}: ${apiMessage(body)}`);
  const channel = body.items?.[0];
  if (!channel) throw new Error('YouTube 인증에서 채널이 보이지 않습니다.');
  return { token, channel };
}

function matchesYoutubeAccount(channel, account) {
  if (account.expectedChannelId) return channel.id === account.expectedChannelId;
  const wanted = String(account.expectedHandle || account.handle || '').replace(/^@/, '').toLowerCase();
  const custom = String(channel.snippet?.customUrl || '').replace(/^@/, '').toLowerCase();
  if (wanted && custom) return wanted === custom;
  return !account.expectedChannelTitle || channel.snippet?.title === account.expectedChannelTitle;
}

// 올린 영상을 재생목록에 넣는다. 같은 제목의 재생목록이 채널에 있으면 그것을 쓰고, 없으면 playlist.visibility(기본 비공개)로 만든다.
// 이미 들어 있는 영상은 다시 넣지 않는다. 방금 만든 재생목록은 몇 초 동안 조회·넣기에 「없다」(404)고 답한다(2026-10-08 실제 발행에서
// 겪음) — 그래서 새 목록은 조회를 건너뛰고(비어 있으니), 넣기가 404면 잠시 뒤 다시 한다.
async function youtubeAddToPlaylist(videoId, playlist, token, fetchImpl = fetch, { retryDelayMs = 3000, retries = 6 } = {}) {
  const auth = { authorization: `Bearer ${token.accessToken}` };
  let id = null;
  let created = false;
  let pageToken = '';
  do {
    const response = await fetchWithRetry(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { headers: auth }, { fetchImpl });
    const body = await responseJson(response);
    if (!response.ok) throw new Error(`YouTube 재생목록 조회 실패 ${response.status}: ${apiMessage(body)}`);
    id = (body.items || []).find((p) => p.snippet?.title === playlist.title)?.id || null;
    pageToken = body.nextPageToken || '';
  } while (!id && pageToken);
  if (!id) {
    const response = await fetchWithRetry('https://www.googleapis.com/youtube/v3/playlists?part=snippet,status', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({
        snippet: { title: playlist.title.slice(0, 150), description: String(playlist.description || '').slice(0, 5000), ...(playlist.language ? { defaultLanguage: playlist.language } : {}) },
        status: { privacyStatus: playlist.visibility || 'private' },
      }),
    }, { fetchImpl });
    const body = await responseJson(response);
    if (!response.ok || !body.id) throw new Error(`YouTube 재생목록 만들기 실패 ${response.status}: ${apiMessage(body)}`);
    id = body.id;
    created = true;
  }
  let itemId = null;
  if (!created) {
    const listed = await fetchWithRetry(`https://www.googleapis.com/youtube/v3/playlistItems?part=id&playlistId=${encodeURIComponent(id)}&videoId=${encodeURIComponent(videoId)}`, { headers: auth }, { fetchImpl });
    const listedBody = await responseJson(listed);
    if (!listed.ok) throw new Error(`YouTube 재생목록 항목 조회 실패 ${listed.status}: ${apiMessage(listedBody)}`);
    itemId = listedBody.items?.[0]?.id || null;
  }
  for (let attempt = 0; !itemId; attempt += 1) {
    const response = await fetchWithRetry('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet', {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ snippet: { playlistId: id, resourceId: { kind: 'youtube#video', videoId } } }),
    }, { fetchImpl });
    const body = await responseJson(response);
    if (response.ok) { itemId = body.id || 'added'; break; }
    if (response.status === 404 && created && attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      continue;
    }
    throw new Error(`YouTube 재생목록에 넣기 실패 ${response.status}: ${apiMessage(body)}`);
  }
  return { id, title: playlist.title, created, itemId, url: `https://www.youtube.com/playlist?list=${id}` };
}

// 2026-10-08 구글 인증이 같은 토큰에 무작위로 401을 돌려줬다(공개 전환, 그 아 가 업로드 시작·자막·재생목록 단계).
// 401은 요청을 받아들이지 않았다는 뜻이라 같은 요청을 잠시 뒤 다시 보내도 겹쳐 만들어지지 않는다 → YouTube API(업로드 주소 포함)의 401만 다시 묻는다.
function retryYoutube401(fetchImpl, { retries = 5, delayMs = 2000 } = {}) {
  return async (url, options) => {
    for (let attempt = 0; ; attempt += 1) {
      const response = await fetchImpl(url, options);
      if (response.status !== 401 || attempt >= retries || !/^https:\/\/www\.googleapis\.com\/(upload\/)?youtube\//.test(String(url))) return response;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  };
}

// 자막 언어는 파일 이름(subtitles-<언어>.srt)에서, 없으면 항목 언어. 올리기·이어 올리기(tools/유튜브이어올리기.cjs)가 같은 셈을 쓴다.
function subtitleLanguage(item, subtitlePath) {
  return /subtitles-([a-z-]+)\.srt$/i.exec(path.basename(subtitlePath))?.[1] || item.language || 'ko';
}

async function youtubeSetThumbnail(videoId, thumbnailFile, token, fetchImpl = fetch) {
  const response = await fetchWithRetry(`https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token.accessToken}`, 'content-type': mimeFor(thumbnailFile) },
    body: fs.readFileSync(thumbnailFile),
  }, { fetchImpl });
  const body = await responseJson(response);
  if (!response.ok) throw new Error(`YouTube 썸네일 업로드 실패 ${response.status}: ${apiMessage(body)}`);
  return true;
}

async function youtubeUploadCaption(videoId, subtitleFile, language, token, fetchImpl = fetch) {
  const boundary = `synk-${crypto.randomBytes(12).toString('hex')}`;
  const metadataPart = Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ snippet: { videoId, language, name: language, isDraft: false } })}\r\n`);
  const mediaHead = Buffer.from(`--${boundary}\r\nContent-Type: application/x-subrip\r\n\r\n`);
  const media = fs.readFileSync(subtitleFile);
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const response = await fetchWithRetry('https://www.googleapis.com/upload/youtube/v3/captions?part=snippet&uploadType=multipart', {
    method: 'POST',
    headers: { authorization: `Bearer ${token.accessToken}`, 'content-type': `multipart/related; boundary=${boundary}` },
    body: Buffer.concat([metadataPart, mediaHead, media, tail]),
  }, { fetchImpl });
  const body = await responseJson(response);
  if (!response.ok) throw new Error(`YouTube ${language} 자막 업로드 실패 ${response.status}: ${apiMessage(body)}`);
  return { language, id: body.id || null };
}

async function youtubeUpload(item, account, credential, options = {}) {
  const fetchImpl = retryYoutube401(options.fetchImpl || fetch, options.retry401);
  const { token, channel } = await youtubeChannel(credential, fetchImpl);
  if (!matchesYoutubeAccount(channel, account)) throw new Error(`${item.id}: YouTube 인증 채널이 다릅니다.`);
  const file = resolveRepoPath(item.video);
  const size = fs.statSync(file).size;
  const mime = mimeFor(file);
  const visibility = item.publish?.publishAt ? 'private' : (item.publish?.visibility || 'private');
  const metadata = {
    snippet: {
      title: item.title.slice(0, 100),
      description: item.text.slice(0, 5000),
      categoryId: account.categoryId || '22',
      defaultLanguage: item.language || undefined,
      defaultAudioLanguage: item.audioLanguage || undefined,
    },
    status: {
      privacyStatus: visibility,
      selfDeclaredMadeForKids: Boolean(account.madeForKids),
      ...(item.publish?.publishAt ? { publishAt: new Date(item.publish.publishAt).toISOString() } : {}),
    },
  };
  const start = await fetchWithRetry(`https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=${item.publish?.notifySubscribers ? 'true' : 'false'}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token.accessToken}`,
      'content-type': 'application/json; charset=UTF-8',
      'x-upload-content-length': String(size),
      'x-upload-content-type': mime,
    },
    body: JSON.stringify(metadata),
  }, { fetchImpl });
  if (!start.ok) {
    const body = await responseJson(start);
    throw new Error(`YouTube 업로드 시작 실패 ${start.status}: ${apiMessage(body)}`);
  }
  const uploadUrl = start.headers.get('location');
  if (!uploadUrl) throw new Error('YouTube 재개 가능 업로드 URL이 없습니다.');

  const chunkSize = 8 * 1024 * 1024;
  const fd = fs.openSync(file, 'r');
  let offset = 0;
  let video;
  try {
    while (offset < size) {
      const length = Math.min(chunkSize, size - offset);
      const buffer = Buffer.allocUnsafe(length);
      fs.readSync(fd, buffer, 0, length, offset);
      const end = offset + length - 1;
      const response = await fetchWithRetry(uploadUrl, {
        method: 'PUT',
        headers: {
          authorization: `Bearer ${token.accessToken}`,
          'content-type': mime,
          'content-length': String(length),
          'content-range': `bytes ${offset}-${end}/${size}`,
        },
        body: buffer,
      }, { fetchImpl });
      if (response.status === 308) {
        const range = response.headers.get('range');
        const match = range && range.match(/(\d+)-(\d+)$/);
        offset = match ? Number(match[2]) + 1 : end + 1;
        continue;
      }
      const body = await responseJson(response);
      if (!response.ok) throw new Error(`YouTube 영상 업로드 실패 ${response.status}: ${apiMessage(body)}`);
      video = body;
      offset = size;
    }
  } finally {
    fs.closeSync(fd);
  }
  if (!video?.id) throw new Error('YouTube가 영상 ID를 돌려주지 않았습니다.');

  const partial = { state: 'partial', id: video.id, url: `https://www.youtube.com/watch?v=${video.id}`, thumbnail: null, captions: [], ...(item.playlist ? { playlist: null } : {}) };
  const snapshot = () => ({ ...partial, captions: [...partial.captions] });
  const checkpoint = async () => { await options.onProgress?.(snapshot()); };
  try {
    // Persist the remote ID before any request that can fail after video creation.
    await checkpoint();
    if (item.thumbnail) {
      await youtubeSetThumbnail(video.id, resolveRepoPath(item.thumbnail), token, fetchImpl);
      partial.thumbnail = true;
      await checkpoint();
    }

    for (const subtitlePath of item.subtitles || []) {
      partial.captions.push(await youtubeUploadCaption(video.id, resolveRepoPath(subtitlePath), subtitleLanguage(item, subtitlePath), token, fetchImpl));
      await checkpoint();
    }
    if (item.playlist?.title) {
      partial.playlist = await youtubeAddToPlaylist(video.id, item.playlist, token, fetchImpl, options.playlistRetry);
      await checkpoint();
    }
    return { ...snapshot(), state: item.publish?.publishAt ? 'scheduled' : visibility };
  } catch (error) {
    error.partialResult = snapshot();
    error.message += ` (기존 YouTube 영상 ${video.id}; 새로 업로드하지 말고 기존 영상 확인 필요)`;
    throw error;
  }
}

async function check(account, credential, fetchImpl) {
    const { token, channel } = await youtubeChannel(credential, fetchImpl);
    return {
      state: matchesYoutubeAccount(channel, account) ? 'connected' : 'wrong-account',
      detail: channel.snippet?.title || channel.id,
      channelId: channel.id,
      handle: channel.snippet?.customUrl || null,
      scopes: String(token.scope).split(/\s+/).filter(Boolean),
    };
  
}
return { fields: fields.youtube, check, publish: youtubeUpload, googleAccessToken, youtubeChannel, matchesYoutubeAccount, youtubeAddToPlaylist, retryYoutube401, subtitleLanguage, youtubeSetThumbnail, youtubeUploadCaption, youtubeUpload };
};
