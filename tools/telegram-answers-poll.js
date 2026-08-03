#!/usr/bin/env node
// telegram-answers-poll — 결정 큐 봇(클라우드)의 답을 수거해 파일로 append한다.
//
// 어디서 도나: synk-memory repo의 GitHub Actions가 30분마다 실행한다(PC 무관).
// 왜 여기 있나: 로직의 정본은 이 repo다 — synk-memory 쪽에는 로직을 두지 않는다
// (헤르메스 껍데기 .py와 같은 원칙: 로직은 테스트가 있는 곳에 산다).
//
// 설계 원칙:
//   ①**유호님 것만 줍는다.** from.id와 chat.id가 둘 다 허용 ID이고 private 챗인
//     메시지만 수거한다 — 메신저로 들어온 텍스트는 곧 명령이 되므로(인젝션 표면),
//     남의 글은 기록조차 하지 않는다. 단 offset은 전진시켜 재수신을 막는다.
//   ②**원문 그대로 append.** 고르는 판단은 클로드가 나중에 한다 — 고르기를
//     수집 단계에 두면 틀렸을 때 답이 조용히 사라진다(결정 큐 봇과 같은 원칙).
//   ③**멱등.** offset 파일로 같은 메시지를 두 번 줍지 않는다.
//
// env: TELEGRAM_BOT_TOKEN(필수) · TELEGRAM_ALLOWED_USER(필수, 숫자 ID)
//      OFFSET_FILE · OUT_FILE (기본값은 아래)
'use strict';
const fs = require('fs');
const path = require('path');

const KST_MS = 9 * 60 * 60 * 1000; // 답변 스탬프는 유호님 시간(KST) — 서버는 UTC다

function kstStamp(unixSec) {
  const d = new Date(unixSec * 1000 + KST_MS);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/* 업데이트 배열에서 「유호님의 private 텍스트」만 고른다.
 * 반환: { entries: [{stamp, text}], maxUpdateId }
 * maxUpdateId는 걸러진 것도 포함해 전진한다(스팸이 큐를 막으면 안 된다). */
function collect(updates, allowedId) {
  const entries = [];
  let maxUpdateId = null;
  for (const u of updates || []) {
    if (typeof u.update_id === 'number' && (maxUpdateId === null || u.update_id > maxUpdateId)) {
      maxUpdateId = u.update_id;
    }
    const m = u.message;
    if (!m || typeof m.text !== 'string' || !m.text.trim()) continue;
    if (!m.from || !m.chat) continue;
    if (m.chat.type !== 'private') continue;
    if (String(m.from.id) !== String(allowedId)) continue;
    if (String(m.chat.id) !== String(allowedId)) continue;
    entries.push({ stamp: kstStamp(m.date || 0), text: m.text });
  }
  return { entries, maxUpdateId };
}

function renderEntries(entries) {
  // 원문 그대로 — 형식은 훅(synk-decision-log)이 만드는 로컬 파일과 같은 결로 최소만
  return entries.map((e) => `## ${e.stamp} (KST)\n${e.text}\n`).join('\n');
}

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowed = process.env.TELEGRAM_ALLOWED_USER;
  if (!token || !allowed) {
    console.log('[수거] 토큰/허용ID 미설정 — 건너뜀');
    return;
  }
  const offsetFile = process.env.OFFSET_FILE || path.join(process.cwd(), '_큐', '.telegram-offset');
  const outFile = process.env.OUT_FILE || path.join(process.cwd(), '_큐', '결정_답변.md');

  let offset = null;
  try { offset = Number(fs.readFileSync(offsetFile, 'utf8').trim()) || null; } catch {}

  const url = `https://api.telegram.org/bot${token}/getUpdates` + (offset ? `?offset=${offset + 1}` : '');
  const res = await fetch(url);
  const body = await res.json();
  if (!body.ok) throw new Error(`getUpdates 실패: ${JSON.stringify(body).slice(0, 200)}`);

  const { entries, maxUpdateId } = collect(body.result, allowed);

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  if (entries.length) {
    fs.appendFileSync(outFile, renderEntries(entries), 'utf8');
  }
  if (maxUpdateId !== null) {
    fs.writeFileSync(offsetFile, String(maxUpdateId), 'utf8');
  }
  console.log(`[수거] 답 ${entries.length}건 · offset=${maxUpdateId === null ? '변화없음' : maxUpdateId}`);
}

if (require.main === module) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
module.exports = { collect, renderEntries, kstStamp };
