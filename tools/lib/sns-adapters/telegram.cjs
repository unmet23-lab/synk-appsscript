'use strict';
// Provider contract: credential fields, connection check and publish implementation.
const fs = require('node:fs');
const path = require('node:path');
module.exports = function createAdapter({ apiMessage, fetchWithRetry, mimeFor, resolveRepoPath, responseJson }) {
const fields = {"telegram": [['botToken', 'BotFather bot token', true]]};
function splitText(text, limit) {
  const chunks = [];
  let remaining = text.trim();
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf('\n', limit);
    if (cut < Math.floor(limit * 0.6)) cut = remaining.lastIndexOf(' ', limit);
    if (cut < 1) cut = limit;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function telegramPublish(item, account, credential, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const base = `https://api.telegram.org/bot${credential.botToken}`;
  const messageIds = [];
  if (item.images?.length) {
    const file = resolveRepoPath(item.images[0]);
    const form = new FormData();
    form.append('chat_id', account.chatId);
    form.append('caption', item.title.slice(0, 1024));
    form.append('photo', new Blob([fs.readFileSync(file)], { type: mimeFor(file) }), path.basename(file));
    const response = await fetchWithRetry(`${base}/sendPhoto`, { method: 'POST', body: form }, { fetchImpl });
    const body = await responseJson(response);
    if (!response.ok || !body.ok) throw new Error(`Telegram 이미지 발행 실패: ${apiMessage(body)}`);
    messageIds.push(body.result.message_id);
  }
  for (const chunk of splitText(item.text, 4096)) {
    const response = await fetchWithRetry(`${base}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: account.chatId, text: chunk, link_preview_options: { is_disabled: true } }),
    }, { fetchImpl });
    const body = await responseJson(response);
    if (!response.ok || !body.ok) throw new Error(`Telegram 본문 발행 실패: ${apiMessage(body)}`);
    messageIds.push(body.result.message_id);
  }
  return { state: 'published', ids: messageIds, url: account.handle.startsWith('t.me/') ? `https://${account.handle}` : null };
}

async function check(account, credential, fetchImpl) {
    const base = `https://api.telegram.org/bot${credential.botToken}`;
    const meResponse = await fetchWithRetry(`${base}/getMe`, {}, { fetchImpl });
    const me = await responseJson(meResponse);
    if (!meResponse.ok || !me.ok) throw new Error(`Telegram Bot 확인 실패: ${apiMessage(me)}`);
    const chatResponse = await fetchWithRetry(`${base}/getChat`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: account.chatId }),
    }, { fetchImpl });
    const chat = await responseJson(chatResponse);
    return {
      state: chatResponse.ok && chat.ok ? 'connected' : 'bot-needs-channel-access',
      detail: chatResponse.ok && chat.ok ? `${me.result.username} → ${chat.result.title || account.chatId}` : apiMessage(chat),
    };
  
}
return { fields: fields.telegram, check, publish: telegramPublish, splitText, telegramPublish };
};
