#!/usr/bin/env node
// decision-queue — 유호님이 답해야 풀리는 것들을 하루 몇 건씩 폰으로 밀어주는 큐.
//
// 왜 있나: 실측된 병목은 AI 처리량이 아니라 **유호님의 미결 결정**이다(memory
// decision-queue-bottleneck). 그런데 ⏳ 항목은 메모리 28개 파일에 흩어져 있어
// **아무도 전체를 보지 않는다** — 세션마다 자기 트랙의 ⏳만 보고, 유호님은 목록조차 못 본다.
// 이 도구는 그 흩어진 것을 한 줄씩 모아 순위를 매기고, 헤르메스 cron이 텔레그램으로 민다.
//
// 설계 원칙 두 가지:
//   ①**읽기 전용.** 메모리도 repo도 쓰지 않는다(지휘층은 읽기 전용 — memory ai-stack-decision).
//     답변은 유호님이 텔레그램에 쓰고, 다음 세션에 클로드가 읽어 반영한다.
//   ②**굶는 항목이 없다.** 순위만 쓰면 하위 항목은 영원히 안 나온다 → 상위 풀 안에서
//     날짜로 회전시켜 언젠가는 전부 한 번씩 나온다.
//
// 사용법:
//   node tools/decision-queue.js              오늘 밀 3건(텔레그램용 평문)
//   node tools/decision-queue.js --all        전체 큐를 순위대로
//   node tools/decision-queue.js --json       기계 판독용
//   node tools/decision-queue.js --count 5    건수 지정
//   SYNK_MEMORY_DIR=... 로 대상 디렉터리 덮어쓰기(테스트용)
'use strict';
const fs = require('fs');
const path = require('path');
const { memoryDir, load, decisions } = require('./memory-graph.js');

const INDEX = 'MEMORY.md'; // 인덱스는 지도라 본문이 중복된다 — 큐에서 제외한다
const MAX_LEN = 300;       // 텔레그램 한 줄로 읽히는 길이

/* ── 추출 ──────────────────────────────────────────────────────────────────
 * ⏳ 가 있는 줄 하나 = 미결 항목 하나로 센다. 한 줄에 「⏳유호 3건」처럼
 * 뭉쳐 있는 것도 그대로 한 항목으로 둔다 — 쪼개려면 문장을 해석해야 하고,
 * 그 해석이 틀리면 없는 결정을 만들어낸다(있는 것을 덜 쪼개는 쪽이 안전하다).
 */
function stripMd(s) {
  return s
    .replace(/^#{1,6}\s+/, '')          // 헤더
    .replace(/^[-*]\s+/, '')            // 불릿
    .replace(/\[\[[^\]|>]*>?([^\]]*)\]\]/g, '$1') // [[막힘>x]] → x
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')      // [텍스트](링크)
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function extract(dir) {
  const items = [];
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.md') && n !== INDEX)) {
    const full = path.join(dir, f);
    const text = fs.readFileSync(full, 'utf8');
    // 자동 생성된 역링크 구간은 큐가 아니다
    const body = text.split('<!-- memory-graph:역링크 시작')[0];
    const mtime = fs.statSync(full).mtimeMs;
    body.split('\n').forEach((line, i) => {
      if (!line.includes('⏳')) return;
      const clean = stripMd(line);
      // 장식뿐인 줄(「## ⏳」 같은 헤더)만 거른다. **길이가 아니라 글자 수로 센다** —
      // 길이로 재면 `##` 같은 기호가 통과하고, 하한을 올리면 「⏳ 티원」 같은
      // 짧은 한국어 항목이 통째로 사라진다(한글은 2글자로도 완결된 항목이다).
      if (clean.replace(/⏳/g, '').replace(/[^\p{L}\p{N}]/gu, '').length < 2) return;
      items.push({
        topic: f.replace(/\.md$/, ''),
        line: i + 1,
        text: clean.length > MAX_LEN ? clean.slice(0, MAX_LEN - 1) + '…' : clean,
        mtime,
      });
    });
  }
  return items;
}

/* ── 차단자를 큐 항목으로 ───────────────────────────────────────────────────
 * '막힘>' 그래프에서 답해야 할 것은 **차단자**(결정-동의문구-몽골어병기 같은 것)이지
 * 그걸 기다리는 토픽이 아니다. 기다리는 토픽의 ⏳ 줄에 「이걸 풀면 3건 풀림」을 붙이면
 * **그 줄과 무관한 공로를 그 줄에 얹는 거짓말**이 된다(참인 채 거짓을 말하는 표시 —
 * memory report-card-public-link의 교훈). 차단자는 차단자대로 한 줄을 갖는다.
 */
function blockerItems(blockers) {
  return blockers
    .filter((b) => b.unblocks > 0)
    .map((b) => ({
      topic: b.blocker,
      line: 0,
      text: `${b.blocker.replace(/-/g, ' ')} — 이 결정을 기다리는 트랙: ${b.items.join(', ')}`,
      // 차단자는 항상 위. Infinity를 쓰면 차단자 둘을 비교할 때 Infinity-Infinity=NaN이라
      // 정렬이 불안정해진다(같은 입력에 다른 순서 → 회전이 날마다 튄다). 유한한 큰 값으로.
      mtime: Number.MAX_SAFE_INTEGER,
      unblocks: b.unblocks,
    }));
}

/* ── 순위 ──────────────────────────────────────────────────────────────────
 * 1순위 = 차단자(명시된 의존이라 가장 단단한 근거) · 2순위 = 최근 손댄 토픽.
 */
function rank(items, blockers) {
  const all = [...blockerItems(blockers), ...items.map((it) => ({ ...it, unblocks: 0 }))];
  return all.sort((a, b) => b.unblocks - a.unblocks || b.mtime - a.mtime || a.topic.localeCompare(b.topic));
}

/* ── 회전 ──────────────────────────────────────────────────────────────────
 * 같은 3건만 계속 나오면 나머지는 영영 안 보인다. 날짜를 걸음 수로 써서
 * 큐 전체를 한 바퀴 돌린다 — 순위는 시작점을 정할 뿐 독점하지 않는다.
 * 단 차단자가 걸린 항목은 회전과 무관하게 **항상 맨 앞에 한 자리**를 갖는다.
 */
function todayIndex(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
}

function pick(ranked, count, date) {
  if (!ranked.length) return [];
  const out = [];
  const usedTopics = new Set();
  // 차단자 한 자리 고정 — 날짜와 무관하게 늘 보인다
  const pinned = ranked.find((r) => r.unblocks > 0);
  if (pinned) { out.push(pinned); usedTopics.add(pinned.topic); }

  // 나머지는 회전. 같은 토픽이 하루치를 독점하면 3건이 사실상 1건이 되므로 토픽당 1건만.
  const rest = ranked.filter((r) => r !== pinned);
  if (rest.length) {
    const offset = todayIndex(date) % rest.length;
    for (let pass = 0; pass < 2 && out.length < count; pass++) {
      // 1차: 토픽 중복 없이 / 2차: 그래도 모자라면 중복 허용(항목 수가 적을 때)
      for (let i = 0; i < rest.length && out.length < count; i++) {
        const it = rest[(offset + i) % rest.length];
        if (out.includes(it)) continue;
        if (pass === 0 && usedTopics.has(it.topic)) continue;
        out.push(it); usedTopics.add(it.topic);
      }
    }
  }
  return out;
}

function build(opts = {}) {
  const dir = opts.dir || memoryDir();
  const date = opts.date || new Date();
  const count = opts.count || 3;
  const items = extract(dir);
  let blockers = [];
  try {
    const nodes = load(dir); // Map 또는 null을 그대로 돌려준다
    if (nodes) {
      blockers = (decisions(nodes).ranked || []).map((r) => ({
        blocker: r.blocker, unblocks: r.unblocks, items: r.items || [],
      }));
    }
  } catch { /* 그래프를 못 읽어도 큐 자체는 나와야 한다 */ }
  const ranked = rank(items, blockers);
  return { total: ranked.length, ranked, today: pick(ranked, count, date), blockers };
}

function render(r, date) {
  if (!r.total) return '';           // 빈 출력 = 헤르메스가 조용히 넘어간다
  const d = date || new Date();
  const p = (n) => String(n).padStart(2, '0');
  const lines = [`🗳 오늘의 결정 ${r.today.length}건 (미결 ${r.total}건 · ${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())})`, ''];
  r.today.forEach((it, i) => {
    const head = it.unblocks > 0
      ? `⛔ 막고 있는 결정 — 풀면 ${it.unblocks}건이 함께 풀립니다`
      : `[${it.topic}]`;
    lines.push(`${i + 1}. ${head}`);
    lines.push(`   ${it.text}`);
    lines.push('');
  });
  lines.push('답은 이 방에 그냥 쓰시면 됩니다 — 다음 작업 때 클로드가 읽고 반영합니다.');
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const ci = args.indexOf('--count');
  const count = ci >= 0 ? Number(args[ci + 1]) || 3 : 3;
  const r = build({ count });
  if (args.includes('--json')) return console.log(JSON.stringify(r, null, 2));
  if (args.includes('--all')) {
    console.log(`\n[결정 큐] 미결 ${r.total}건 — 순위대로\n`);
    r.ranked.forEach((it, i) => {
      const tag = it.unblocks > 0 ? ` ⛔${it.unblocks}건 해소` : '';
      console.log(`${String(i + 1).padStart(3)}. [${it.topic}]${tag}\n     ${it.text}`);
    });
    return console.log('');
  }
  const out = render(r);
  if (out) console.log(out);
}

if (require.main === module) main();
module.exports = { extract, rank, pick, build, render, stripMd, todayIndex };
