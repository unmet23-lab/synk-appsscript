'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { atomicJson } = require('./backup-primitives.cjs');
const { 주소, 사이트, 모음사이트, 회차시각 } = require('./grok-contests.cjs');

const slotName = /^\d{4}-\d{2}-\d{2}_(?:0830|1430|2000)$/;

function mapRow(group) {
  if (group.carbon?.model !== 'gemini-4-carbon-high' || group.carbon.dataVersion !== 2 || !Array.isArray(group.carbon.findings)) return null;
  const fields = Object.fromEntries(group.carbon.findings.flatMap(f => {
    const u = 주소(f.url);
    return u && !모음사이트.test(사이트(u)) && f.quote ? [[f.field, f]] : [];
  }));
  const geminiOnly = !group.grok.length;
  const presence = fields.presence?.code;
  if (geminiOnly && !presence) return null;
  const ai = fields.ai?.code ? fields.ai : null;
  const deadline = fields.deadline?.date ? fields.deadline : null;
  const delivery = fields.deliverables?.items?.length ? fields.deliverables : null;
  if (!presence && !ai && !deadline && !delivery) return null;
  const raw = group.grok[0] || group.gemini[0];
  const citation = f => ({ url: f.url, quote: f.quote, checkedBy: 'carbon' });
  return {
    title: raw.title, organizer: raw.organizer || '', edition: raw.edition || '', noticeId: raw.noticeId || '',
    video: geminiOnly && typeof raw.video === 'boolean' ? raw.video : null, discoveryUrl: 주소(raw.discoveryUrl),
    urls: [주소(raw.officialUrl)].filter(Boolean), officialUrl: fields.presence?.url || '',
    ai: ai ? { status: ai.code, ...citation(ai) } : { status: 'unconfirmed' },
    deadline: deadline ? { date: deadline.date, kst: deadline.kst, ...citation(deadline) } : { date: '', kst: '' },
    deliverables: delivery ? { items: delivery.items, ...citation(delivery) } : { items: [] },
    reviewed: true, geminiOnly, onlyExisting: !geminiOnly || presence !== 'open', ...(presence && { accepting: presence === 'open' }),
  };
}

function storeRound(dir, round) {
  if (!slotName.test(round.slot) || round.status !== 'paired') return;
  const file = path.join(dir, '지도반영', round.slot + '.json');
  const items = round.notices.map(mapRow).filter(Boolean);
  if (!items.length && !fs.existsSync(file)) return;
  const value = { schema: 'synk-contest-map-review-v1', reportId: round.slot, items };
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== JSON.stringify(value, null, 2) + '\n') atomicJson(file, value);
}

function includeReviews(folder, grokReports) {
  const dir = path.join(folder, 'Gemini공모전비교', '지도반영');
  if (!fs.existsSync(dir)) return grokReports;
  const reviewed = fs.readdirSync(dir).filter(name => name.endsWith('.json') && slotName.test(name.slice(0, -5))).map(name => {
    const record = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    if (record.schema !== 'synk-contest-map-review-v1' || record.reportId + '.json' !== name || !Array.isArray(record.items)) {
      throw Error('카본의 지도 반영 자료를 읽지 못했습니다. ' + name);
    }
    return record;
  });
  // 정기 원본이 먼저, 같은 회차의 검증이 그 다음, 이후 회차의 새 근거가 마지막이다.
  return [...grokReports, ...reviewed].sort((a, b) => 회차시각(a) - 회차시각(b));
}

module.exports = { mapRow, storeRound, includeReviews };
