'use strict';

// 현재 커밋에 대한 완료된 봇 총평만 센다. 과거 코멘트와 진행 중 인라인 지적은 완료 검수가 아니다.
const BOT_NAMES = /^(claude(?:\[bot\])?|claude-code(?:\[bot\])?|chatgpt-codex-connector(?:\[bot\])?|gemini-code-assist(?:\[bot\])?|coderabbitai(?:\[bot\])?)$/i;
function vendorOf(login) {
  if (!BOT_NAMES.test(login || '')) return null;
  if (/^claude/i.test(login)) return 'claude';
  if (/^(chatgpt|codex)/i.test(login)) return 'codex';
  if (/^gemini/i.test(login)) return 'gemini';
  return 'coderabbit';
}
function tally({ headSha, comments = [], reviews = [] }) {
  if (!/^[a-f0-9]{40}$/i.test(headSha || '')) throw new Error('full head SHA required');
  const latest = new Map();
  for (const row of [...comments, ...reviews]) {
    const user = row.user || {};
    if (user.type !== 'Bot' && !/\[bot\]$/.test(user.login || '')) continue;
    const vendor = vendorOf(user.login);
    if (!vendor) continue;
    const body = String(row.body || '');
    const mark = /^검수커밋:\s*([a-f0-9]{40})\s*$/mi.exec(body);
    const counts = /^합의표식:\s*P0=(\d+)\s+P1=(\d+)\s*$/m.exec(body);
    if (!mark || mark[1].toLowerCase() !== headSha.toLowerCase() || !counts || !/^검수완료:\s*true\s*$/mi.test(body)) continue;
    if (row.commit_id && row.commit_id.toLowerCase() !== headSha.toLowerCase()) continue;
    if (row.state === 'DISMISSED' || row.state === 'PENDING') continue;
    const time = Date.parse(row.updated_at || row.submitted_at || row.created_at || '');
    if (!Number.isFinite(time)) continue;
    const item = { vendor, p0: Number(counts[1]), p1: Number(counts[2]), time, id: Number(row.id) || 0 };
    const previous = latest.get(vendor);
    if (!previous || time > previous.time || (time === previous.time && item.id > previous.id)) latest.set(vendor, item);
  }
  const responses = [...latest.values()];
  const blocking = responses.filter(r => r.p0 + r.p1 > 0);
  const threshold = Math.min(2, responses.length);
  const state = !responses.length ? 'pending' : blocking.length >= threshold ? 'failure' : 'success';
  return { state, responses, blocking, threshold,
    description: !responses.length ? '현재 커밋 완료 검수 0 — 미확인'
      : blocking.length >= threshold ? `P0/P1 — ${blocking.map(r => r.vendor).join('+')} (문턱 ${threshold}/${responses.length})`
      : `현재 커밋 완료 ${responses.length} · 차단 지적 벤더 ${blocking.length}/${threshold}` };
}

module.exports = { vendorOf, tally };
