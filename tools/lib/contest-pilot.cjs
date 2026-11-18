'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createHash, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { 동일공고 } = require('./grok-contests.cjs');
const { settleDisputes } = require('./contest-carbon.cjs');
const { atomicJson, acquireLock, replaceFile } = require('./backup-primitives.cjs');

const times = ['0830', '1430', '2000'];
const providers = ['grok', 'gemini'];
const digest = value => createHash('sha256').update(value).digest('hex');
const fieldNames = { ai: 'AI 허용·조건', deadline: '마감', deliverables: '제출물', presence: '한쪽에서만 발견' };

function read(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function save(file, value) {
  const text = JSON.stringify(value, null, 2) + '\n';
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text) return;
  atomicJson(file, value);
}

function openTrial(folder) {
  const dir = path.join(folder, 'Gemini공모전비교');
  const configPath = path.join(dir, '연결.json');
  if (!fs.existsSync(configPath)) return null;
  const config = read(configPath);
  const date = new Date(config.startDate + 'T00:00:00Z');
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== config.startDate ||
      !/^(Default|Profile \d+)$/.test(config.profileId) ||
      !/^[\w.+-]+@[\w.-]+\.[a-z]+$/i.test(config.account) ||
      !/^https:\/\/gemini\.google\.com\/(?:u\/\d+\/)?app\/[a-f0-9]{8,64}$/.test(config.threadUrl)) {
    throw Error('비공개 Gemini 공모전 연결 설정이 맞지 않습니다.');
  }
  const slots = Array.from({ length: 3 }, (_, i) => {
    const day = new Date(+date + i * 86400000).toISOString().slice(0, 10);
    return times.map(time => day + '_' + time);
  }).flat();
  const journal = path.join(dir, '비교현황.json');
  const previous = fs.existsSync(journal) ? read(journal) : null;
  const sameTrial = previous?.rounds?.length === slots.length && previous.rounds.every((r, i) => r.slot === slots[i]) &&
    previous.connection === digest(JSON.stringify(config));
  return { dir, config, slots, previous: sameTrial ? previous : null, closed: sameTrial && previous.closed === true };
}

function scheduled(slot) {
  return Date.parse(slot.slice(0, 10) + 'T' + slot.slice(11, 13) + ':' + slot.slice(13) + ':00+09:00');
}

function receiveGemini(config) {
  const exe = path.join(os.homedir(), '.local/share/ego/active_version_dir/ego-browser.exe');
  const source = fs.readFileSync(path.join(__dirname, '../gemini-contest-source.mjs'), 'utf8');
  const input = 'const geminiContest=' + JSON.stringify(config) + ';\n' + source;
  const run = spawnSync(exe, ['nodejs'], { input, encoding: 'utf8', windowsHide: true, timeout: 75000, maxBuffer: 8 * 1024 * 1024 });
  const line = /^SYNKGEMINIDATA=(.+)$/m.exec([run.stdout, run.stderr].filter(Boolean).join('\n'));
  if (run.status !== 0 || !line) throw Error('예약 계정의 Gemini 대화를 읽지 못했습니다. 다음 실행에서 다시 확인합니다.');
  const messages = JSON.parse(line[1]);
  if (!Array.isArray(messages)) throw Error('Gemini 응답 목록을 읽지 못했습니다.');
  return messages.flatMap(extractReports);
}

// 모델 답변 안의 JSON만 받는다. 중괄호가 들어 있는 인용문, 앞뒤 설명, 여러 코드 블록을 처리한다.
function extractReports(message) {
  const reports = [];
  let start = -1, depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < message.length; i++) {
    const ch = message[i];
    if (!depth && ch !== '{') continue;
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') quoted = false;
    } else if (ch === '"') quoted = true;
    else if (ch === '{') { if (depth++ === 0) start = i; }
    else if (ch === '}' && --depth === 0) {
      try {
        const object = JSON.parse(message.slice(start, i + 1));
        if (object.schema === 'synk-contest-pilot-v1' && object.source === 'gemini') reports.push(object);
      } catch { /* 본문 속 설명이나 미완성 JSON은 영수증으로 쓰지 않는다. */ }
    }
  }
  return reports;
}

function receiptPath(trial, slot, provider) {
  return path.join(trial.dir, '회차원본', slot + '.' + provider + '.json');
}

function sourceName(entry) {
  if (typeof entry === 'string') return normal(entry);
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return '';
  const label = [entry.url, entry.source, entry.name, entry.title, entry.reason].find(v => typeof v === 'string' && v.trim());
  return normal(label);
}

function isAvailable(report) {
  if (report.items.length) return true;
  if (!report.reports.length) return false;
  const failed = (report.unavailable || []).map(sourceName);
  return report.reports.some(entry => !failed.includes(sourceName(entry)) &&
    !/접근 (?:불가|실패)|확인 (?:불가|실패)|수신 실패|access denied|unavailable|failed|blocked/i.test(
      [sourceName(entry), entry?.status, entry?.reason].join(' ')));
}

function accept(trial, provider, report, now) {
  const isGemini = provider === 'gemini';
  const slot = isGemini ? report?.slot : report?.reportId;
  if (!trial.slots.includes(slot) || scheduled(slot) > +now) return false;
  const receivedAt = Date.parse(report.checkedAt);
  if (isGemini && (report.schema !== 'synk-contest-pilot-v1' || report.source !== provider ||
      !/(?:[+-]\d{2}:\d{2}|Z)$/i.test(report.checkedAt || '') || !Number.isFinite(receivedAt) ||
      receivedAt < scheduled(slot) - 15 * 60000 || receivedAt > +now + 5 * 60000)) {
    throw Error(slot + ' Gemini 결과의 출처나 실제 확인 시각이 맞지 않습니다.');
  }
  if (!isGemini && report.schema !== 'synk-grok-contests-v1') throw Error(slot + ' 그록 회차 형식이 다릅니다.');
  if (!Array.isArray(report.items) || report.items.length > 100 ||
      !Array.isArray(report.reports) || !report.reports.every(sourceName) ||
      (report.unavailable != null && (!Array.isArray(report.unavailable) || !report.unavailable.every(sourceName))) ||
      (report.reports.length === 0 && !report.unavailable?.length) ||
      !report.items.every(item => typeof item?.title === 'string' && item.title.trim() &&
        [item.officialUrl, item.discoveryUrl].some(u => typeof u === 'string' && /^https?:\/\//i.test(u)) &&
        (item.deliverables?.items == null || Array.isArray(item.deliverables.items) &&
         item.deliverables.items.every(x => typeof x === 'string')))) throw Error(slot + ' 조사 결과가 불완전합니다.');
  const file = receiptPath(trial, slot, provider);
  if (fs.existsSync(file)) {
    const old = read(file);
    if (JSON.stringify(old) === JSON.stringify(report)) return true;
    if (isAvailable(old) && !isAvailable(report) || Date.parse(old.checkedAt) > receivedAt) return false;
    const hash = digest(JSON.stringify(old));
    save(path.join(trial.dir, '이전원본', slot + '.' + provider + '.' + hash + '.json'), old);
  }
  save(file, report);
  return true;
}

function normal(text) {
  return String(text ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function fieldValues(row) {
  const ai = row.ai || {};
  const status = normal(ai.status) || 'unconfirmed';
  let condition = ai.conditions ?? ai.condition ?? (status === 'conditional' ? ai.quote : '');
  if (Array.isArray(condition)) condition = condition.map(normal).sort().join(' / ');
  const deadline = row.deadline || {};
  const time = normal(deadline.kst);
  const timestamp = time && /(?:[+-]\d{2}:\d{2}|z)$/.test(time) ? Date.parse(time) : NaN;
  return {
    ai: [status, normal(condition)],
    deadline: [normal(deadline.date), Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : time],
    deliverables: [...new Set((row.deliverables?.items || []).map(normal).filter(Boolean))].sort(),
  };
}

function compareSlot(grok, gemini) {
  const groups = [];
  for (const provider of providers) {
    for (const row of (provider === 'grok' ? grok : gemini).items) {
      let group = groups.find(g => g[provider].concat(g[provider === 'grok' ? 'gemini' : 'grok']).some(old => 동일공고(old, row)));
      if (!group) { group = { title: row.title, grok: [], gemini: [] }; groups.push(group); }
      group[provider].push(row);
    }
  }
  return groups.map(group => {
    const rows = [...group.grok, ...group.gemini];
    const values = rows.map(fieldValues);
    const fields = [];
    if (!group.grok.length || !group.gemini.length) fields.push('presence');
    for (const key of ['ai', 'deadline', 'deliverables']) {
      if (new Set(values.map(v => JSON.stringify(v[key]))).size > 1) fields.push(key);
    }
    const unverified = ['ai', 'deadline', 'deliverables'].filter(key => rows.some(row => {
      const claim = row[key];
      if (!claim?.url || !claim.quote) return true;
      if (key === 'ai') return !['allowed', 'conditional', 'prohibited'].includes(claim.status);
      return key === 'deadline' ? !claim.date : !claim.items?.length;
    }));
    return { ...group, duplicates: { grok: Math.max(0, group.grok.length - 1), gemini: Math.max(0, group.gemini.length - 1) }, fields, unverified };
  });
}

function needsReceipt(trial, slot, provider) {
  const file = receiptPath(trial, slot, provider);
  return !fs.existsSync(file) || !isAvailable(read(file));
}

function cardsFrom(html) {
  const line = /^const 자료 = (.+);$/m.exec(html || '');
  if (!line) return null;
  const map = JSON.parse(line[1]);
  return [...map.열린, ...map.진행].map(c => ({ title: c.전체이름 || c.이름, officialUrl: c.주소,
    ai: c.AI허용, deadline: c.마감글 || c.마감, deliverables: c.제출물, evidence: [c.AI주소, c.마감주소, c.제출물주소] }));
}

function checkMaps(summary, groups, remote) {
  if (!summary) return;
  const pc = summary.pc === 'rendered' ? cardsFrom(fs.readFileSync(summary.map, 'utf8')) : null;
  const web = summary.artifact?.status || 'unchecked';
  const live = remote ? cardsFrom(remote.html) : ['current', 'updated'].includes(web) ? pc : null;
  for (const group of groups) {
    const matches = c => [...group.grok, ...group.gemini].some(row => 동일공고(row, c) || normal(row.title) === normal(c.title));
    const localCards = pc?.filter(matches), webCards = live?.filter(matches);
    group.map = { pcMatches: localCards?.length ?? null, webMatches: webCards?.length ?? null };
    if (localCards?.length && webCards?.length) {
      group.map.sameFields = JSON.stringify(localCards) === JSON.stringify(webCards);
    }
  }
  return { pc: summary.pc, web, version: remote?.version || summary.artifact?.version,
    ...(summary.artifact?.reset && { retryAt: summary.artifact.reset }) };
}

function writeReport(dir, status) {
  const cell = value => String(value ?? '').replace(/[\r\n|]/g, ' ').replace(/([*_[\]<>\\])/g, '\\$1').trim();
  const time = s => s.slice(0, 10) + ' ' + s.slice(11, 13) + ':' + s.slice(13);
  const receipt = r => !r || r.status === 'pending' ? '도착 전' : r.status === 'unavailable' ? '접근 실패' :
    r.items + '건' + (r.unavailable.length ? ' · 일부 출처 접근 실패' : '');
  const text = ['# 맹꽁이와 Gemini 공모전 비교', '',
    '서울 시간 기준으로 ' + status.total + '회 중 ' + status.due + '회의 예정 시각이 지났고, 양쪽 결과가 도착한 ' + status.paired + '쌍을 비교했습니다.',
    '같은 회차에서 서로 다르게 보고한 공고는 ' + status.disputes + '건이며, 카본이 모든 쟁점의 공식 근거를 확인한 공고는 ' + status.confirmed + '건입니다.', '',
    '| 예정 시각 (KST) | 그록 | Gemini | 비교 |', '|---|---|---|---|'];
  for (const r of status.rounds) {
    const result = r.status === 'scheduled' ? '예정' : r.status === 'pending' ? '결과 대기' :
      '완료 · 불일치 ' + r.notices.filter(n => n.fields.length).length + '건';
    text.push('| ' + [time(r.slot), r.status === 'scheduled' ? '예정' : receipt(r.grok),
      r.status === 'scheduled' ? '예정' : receipt(r.gemini), result].join(' | ') + ' |');
  }
  const coverage = status.coverage;
  text.push('', '그록에만 나온 공고 ' + coverage.grokOnly + '건, Gemini에만 나온 공고 ' + coverage.geminiOnly +
    '건입니다. 회차 안에서 반복한 공고는 그록 ' + coverage.grokDuplicates + '건, Gemini ' + coverage.geminiDuplicates + '건입니다.');
  for (const r of status.rounds.filter(round => round.status === 'paired')) {
    if (!r.notices.length) continue;
    text.push('', '## ' + time(r.slot), '');
    for (const g of r.notices) {
      const fields = g.fields.map(f => fieldNames[f]).join(', ');
      const counts = g.map ? ' · 지도 카드 PC ' + (g.map.pcMatches ?? '미확인') + ', 웹 ' + (g.map.webMatches ?? '미확인') : '';
      text.push('- ' + cell(g.title) + ' · ' + (fields || '일치') + counts);
      if (g.unverified.length && !fields) text.push('  - 조사 결과에 공식 근거 또는 값이 빠진 항목 · ' + g.unverified.map(f => fieldNames[f]).join(', '));
      if (g.fields.includes('presence')) text.push('  - ' + (g.grok.length ? '그록' : 'Gemini') + '만 발견했습니다.');
      for (const f of g.carbon?.findings || []) {
        text.push('  - ' + fieldNames[f.field] + ' · ' + cell(f.value) +
          (f.url ? ' · “' + cell(f.quote) + '” [공식 원문](<' + encodeURI(f.url).replace(/>/g, '%3E') + '>)' : ''));
      }
      if (fields && !g.carbon?.findings?.length) text.push('  - ' + (g.carbon?.status === 'needs-official-source' ? '공식 원문 확인 대기' : '카본 확인 대기'));
    }
  }
  if (status.maps) {
    const webLabels = { current: 'PC와 대조 완료', updated: '게시 후 PC와 대조 완료', deferred: '구독 한도 대기', error: '확인 실패',
      skipped: '게시 대기', unchecked: '미확인' };
    text.push('', 'PC 지도는 ' + (status.maps.pc === 'rendered' ? '생성 완료' : '확인 필요') +
      ', 웹 지도는 ' + cell(webLabels[status.maps.web] || status.maps.web) + '입니다.');
  }
  for (const e of status.errors) text.push('', '실행 중 확인할 사항 · ' + cell(e));
  const file = path.join(dir, '비교결과.md');
  const temp = path.join(dir, randomUUID() + '.tmp');
  try { fs.writeFileSync(temp, text.join('\n') + '\n', { flag: 'wx' }); replaceFile(temp, file); }
  finally { fs.rmSync(temp, { force: true }); }
}

async function runTrial(trial, options = {}) {
  const release = acquireLock(path.join(trial.dir, '비교현황.json.lock'));
  if (!release) return { status: 'already-running', errors: [] };
  try {
    const current = openTrial(path.dirname(trial.dir));
    if (!current || current.closed) return { status: 'closed', errors: [] };
    const now = options.now || new Date();
    if (+now > scheduled(current.slots.at(-1)) + 3 * 86400000 && !(options.rawGrok || []).some(r => current.slots.includes(r?.reportId)) &&
        current.previous && now - Date.parse(current.previous.checkedAt) < 20 * 3600000) {
      return { status: 'retry-next-day', paired: current.previous.paired, total: current.slots.length, errors: [] };
    }
    return await runLocked(current, options);
  } finally { release(); }
}

async function runLocked(trial, { rawGrok = [], now = new Date(), receive = receiveGemini, settle = settleDisputes, map, remoteMap } = {}) {
  const due = trial.slots.filter(s => scheduled(s) <= +now);
  const errors = [];
  function ingest(provider, records) {
    for (const record of records) {
      try { accept(trial, provider, record, now); } catch (e) { errors.push(e.message); }
    }
  }
  ingest('grok', rawGrok);
  if (due.some(s => needsReceipt(trial, s, 'gemini'))) {
    try { ingest('gemini', await receive(trial.config)); } catch (e) { errors.push(e.message); }
  }
  const rounds = [];
  const allGroups = [];
  const todo = [];
  for (const slot of trial.slots) {
    const round = { slot, status: 'scheduled' };
    rounds.push(round);
    if (!due.includes(slot)) continue;
    const reports = {};
    for (const provider of providers) {
      const file = receiptPath(trial, slot, provider);
      reports[provider] = fs.existsSync(file) ? read(file) : null;
      const r = reports[provider];
      round[provider] = r ? { status: isAvailable(r) ? 'received' : 'unavailable', items: r.items.length, unavailable: r.unavailable || [] } : { status: 'pending' };
    }
    round.status = 'pending';
    if (providers.some(p => round[p].status !== 'received')) continue;
    round.status = 'paired';
    round.notices = compareSlot(reports.grok, reports.gemini);
    for (const group of round.notices.filter(g => g.fields.length)) {
      group.claimHash = digest(JSON.stringify([group.grok, group.gemini]));
      const prior = trial.previous?.rounds.find(r => r.slot === slot)?.notices?.find(n => n.claimHash === group.claimHash);
      if (prior?.carbon?.status === 'confirmed') group.carbon = prior.carbon;
      else todo.push(group);
    }
    allGroups.push(...round.notices);
  }
  const disputed = allGroups.filter(group => group.fields.length);
  try { if (todo.length) await settle(trial.dir, todo); } catch (e) { errors.push(e.message); }
  let maps;
  try { maps = checkMaps(map, allGroups, remoteMap); }
  catch { errors.push('지도 원문을 대조하지 못했습니다. 두 조사 원본과 비교 결과는 저장했습니다.'); }
  const status = {
    connection: digest(JSON.stringify(trial.config)), checkedAt: now.toISOString(), total: trial.slots.length, paired: rounds.filter(r => r.status === 'paired').length,
    due: due.length, disputes: disputed.length,
    confirmed: disputed.filter(c => c.carbon?.status === 'confirmed').length, errors, maps, rounds,
    coverage: {
      grokOnly: allGroups.filter(g => !g.gemini.length).length, geminiOnly: allGroups.filter(g => !g.grok.length).length,
      grokDuplicates: allGroups.reduce((n, g) => n + g.duplicates.grok, 0), geminiDuplicates: allGroups.reduce((n, g) => n + g.duplicates.gemini, 0),
    },
  };
  const last = scheduled(trial.slots.at(-1));
  // 조사 기간 뒤에도 늦게 도착한 원본과 웹 결과를 회수한다. 출처에 없는 요건은 그대로 미확인으로 끝낸다.
  const settled = status.confirmed === status.disputes || +now > last + 3 * 86400000 &&
    disputed.every(g => ['confirmed', 'needs-evidence', 'needs-official-source'].includes(g.carbon?.status));
  status.closed = status.paired === status.total && settled && !errors.length && ['current', 'updated'].includes(maps?.web);
  writeReport(trial.dir, status);
  save(path.join(trial.dir, '비교현황.json'), status);
  return { total: status.total, due: status.due, paired: status.paired, disputes: status.disputes, confirmed: status.confirmed, errors };
}

module.exports = { openTrial, runTrial, receiveGemini, extractReports, accept, needsReceipt, compareSlot, save };
