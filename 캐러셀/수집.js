#!/usr/bin/env node
/**
 * 뉴스 수집 — 아침에 AI 뉴스 후보를 긁어 «오늘의 후보» 한 장으로 만든다.
 *
 * 쓰는 법:
 *   node 캐러셀/수집.js            → 캐러셀/오늘의후보.md (기본 20건)
 *   node 캐러셀/수집.js --건수 30
 *   node 캐러셀/수집.js --다룸 3   → 3번 후보를 「다룬 것」으로 표시(다음부터 안 뜬다)
 *
 * 흐름 (유호님 아침 5분):
 *   ① 이 스크립트가 후보를 모은다 → ② AI 가 그 목록을 읽고 원고 초안을 쓴다
 *   → ③ 유호님이 고른다 → ④ `node 캐러셀/굽기.js` 로 굽는다
 *
 * 왜 이 통로인가 (유호 확정 2026-08-27):
 *   「매일 뉴스 자동 수집 통로를 지어야지」 — 매일의 적은 알고리즘이 아니라 «지속»이고,
 *   지속의 적은 «빈 화면 앞에서 소재를 찾는 시간»이다. 그 시간을 0으로 만드는 것이 이 파일의 전부다.
 *
 * 설계 셋:
 *   ① **소스가 죽어도 안 멈춘다** — 한 곳이 404·타임아웃이어도 나머지로 계속한다(실측 08-27:
 *      ZDNet Korea 는 404 였다). 죽은 소스는 결과 머리에 «몇 곳 중 몇 곳»으로 분모와 함께 적는다.
 *   ② **다룬 것은 다시 안 뜬다** — `캐러셀/다룬것.jsonl` 이 링크를 기억한다. 이게 없으면
 *      같은 뉴스를 이틀 연속 올리는 사고가 반드시 난다.
 *   ③ **점수는 «판정 재료»지 자동 선택이 아니다** — 사람이 고른다. 순위는 참고용 정렬일 뿐.
 *
 * 함정:
 *   · RSS 파서를 안 쓰고 정규식으로 뜯는다(의존성 0). 대신 CDATA·엔티티를 손으로 푼다.
 *   · 한국 매체는 제목이 이미 한국어라 그대로, 영어 매체는 제목을 그대로 두고 원고에서 옮긴다
 *     — 여기서 기계 번역을 하면 뉘앙스가 죽고, 그 뉘앙스가 «판정»의 재료다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const 소스들 = [
  { 이름: 'Hacker News', url: 'https://hnrss.org/newest?q=AI&points=100', 결: 'en', 무게: 1.2 },
  { 이름: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', 결: 'en', 무게: 1.0 },
  { 이름: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/', 결: 'en', 무게: 1.0 },
  { 이름: 'OpenAI', url: 'https://openai.com/blog/rss.xml', 결: 'en', 무게: 1.4 },
  { 이름: 'Google AI', url: 'https://blog.google/technology/ai/rss/', 결: 'en', 무게: 1.3 },
  { 이름: 'AI타임스', url: 'https://www.aitimes.com/rss/allArticle.xml', 결: 'ko', 무게: 1.1 },
];

const 인자 = process.argv.slice(2);
const 값 = (플래그, 기본) => { const i = 인자.indexOf(플래그); return i >= 0 ? 인자[i + 1] : 기본; };
const 건수 = parseInt(값('--건수', '20'), 10);
const 다룸표시 = 값('--다룸', null);

const ROOT = path.resolve(__dirname, '..');
const 후보파일 = path.join(__dirname, '오늘의후보.md');
const 다룬것파일 = path.join(__dirname, '다룬것.jsonl');

// ── 다룬 것 장부 ──────────────────────────────────────────────────────
const 다룬링크 = new Set();
if (fs.existsSync(다룬것파일)) {
  for (const 줄 of fs.readFileSync(다룬것파일, 'utf8').split('\n')) {
    if (!줄.trim()) continue;
    try { 다룬링크.add(JSON.parse(줄).link); } catch { /* 깨진 줄은 건너뛴다 */ }
  }
}

// `--다룸 N` — 후보 N 번을 장부에 넣고 끝낸다
if (다룸표시) {
  if (!fs.existsSync(후보파일)) { console.error('🔴 오늘의후보.md 가 없다 — 먼저 수집을 돌린다'); process.exit(1); }
  const 본문 = fs.readFileSync(후보파일, 'utf8');
  const 줄 = 본문.split('\n').find(l => l.startsWith(`### ${다룸표시}.`));
  if (!줄) { console.error(`🔴 후보 ${다룸표시} 번을 못 찾았다`); process.exit(1); }
  const 링크 = (본문.split(줄)[1] || '').match(/https?:\/\/\S+/);
  const 제목 = 줄.replace(/^### \d+\.\s*/, '').trim();
  fs.appendFileSync(다룬것파일, JSON.stringify({ link: 링크 ? 링크[0] : 제목, title: 제목, at: new Date().toISOString().slice(0, 10) }) + '\n');
  console.log(`✅ 다룬 것으로 표시 — ${제목}`);
  process.exit(0);
}

// ── RSS 뜯기 (의존성 0) ───────────────────────────────────────────────
const 엔티티풀기 = s => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
  .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const 뽑기 = (덩, 태그들) => {
  for (const t of 태그들) {
    const m = 덩.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, 'i'));
    if (m) return 엔티티풀기(m[1]);
    const self = 덩.match(new RegExp(`<${t}[^>]*href=["']([^"']+)["']`, 'i')); // atom <link href=…/>
    if (self) return self[1];
  }
  return '';
};

(async () => {
  const 모음 = [];
  const 죽은소스 = [];
  await Promise.all(소스들.map(async (소스) => {
    try {
      const r = await fetch(소스.url, { signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const xml = await r.text();
      const 덩어리들 = xml.split(/<item[ >]|<entry[ >]/).slice(1, 26);
      for (const 덩 of 덩어리들) {
        const 제목 = 뽑기(덩, ['title']);
        const 링크 = (덩.match(/<link[^>]*>([^<]+)<\/link>/i) || [])[1] || 뽑기(덩, ['link']) || '';
        if (!제목 || !링크) continue;
        if (다룬링크.has(링크.trim())) continue;
        const 요약 = 뽑기(덩, ['description', 'summary', 'content:encoded']).slice(0, 260);
        const 날짜 = 뽑기(덩, ['pubDate', 'published', 'updated']);
        const 시각 = Date.parse(날짜) || 0;
        const 나이시간 = 시각 ? (Date.now() - 시각) / 3600000 : 48;
        // 점수 = 소스 무게 × 신선도 — 정렬 재료일 뿐, 고르는 건 사람이다(설계 ③)
        const 점수 = 소스.무게 * Math.max(0.1, 1 - 나이시간 / 72);
        모음.push({ 제목, 링크: 링크.trim(), 요약, 소스: 소스.이름, 결: 소스.결, 나이시간, 점수 });
      }
    } catch (e) { 죽은소스.push(`${소스.이름}(${e.message.slice(0, 24)})`); }
  }));

  // 제목 중복 제거(매체가 같은 발표를 각자 낸다)
  const 본것 = new Set();
  const 후보 = 모음
    .sort((a, b) => b.점수 - a.점수)
    .filter(x => { const k = x.제목.toLowerCase().replace(/[^a-z가-힣0-9]/g, '').slice(0, 40); if (본것.has(k)) return false; 본것.add(k); return true; })
    .slice(0, 건수);

  const 오늘 = new Date().toISOString().slice(0, 10);
  const 살아있는 = 소스들.length - 죽은소스.length;
  let out = `# 오늘의 후보 — ${오늘}\n\n`;
  out += `> 수집 = 소스 **${살아있는}/${소스들.length}곳** · 후보 **${후보.length}건**`;
  out += ` · 이미 다룬 것 ${다룬링크.size}건 제외\n`;
  if (죽은소스.length) out += `> ⚠ 못 읽은 소스: ${죽은소스.join(' · ')}\n`;
  out += `>\n> **고르는 것은 사람이다** — 순위는 신선도×소스 가중치일 뿐 판정이 아니다.\n`;
  out += `> 고르고 나면 \`node 캐러셀/수집.js --다룸 <번호>\` 로 표시(다음부터 안 뜬다).\n`;
  out += `> 원고 규율 = 공개선 12칸(\`docs/SHIFT/영상_공개선.md\` §2) · 틀 = 뉴스 → 왜 우리 얘기인가 → 🔑 내 판정\n\n---\n\n`;

  후보.forEach((x, i) => {
    const 시간표 = x.나이시간 < 1 ? '방금' : x.나이시간 < 24 ? `${Math.round(x.나이시간)}시간 전` : `${Math.round(x.나이시간 / 24)}일 전`;
    out += `### ${i + 1}. ${x.제목}\n`;
    out += `\`${x.소스}\` · ${시간표}${x.결 === 'ko' ? ' · 🇰🇷' : ''}\n\n`;
    if (x.요약) out += `${x.요약}…\n\n`;
    out += `${x.링크}\n\n`;
  });

  fs.writeFileSync(후보파일, out);
  console.log(`✅ ${후보.length}건 → ${path.relative(ROOT, 후보파일)}  (소스 ${살아있는}/${소스들.length}${죽은소스.length ? ' · 못 읽음: ' + 죽은소스.join(', ') : ''})`);
  console.log(`   다음: 후보를 읽고 원고를 쓴 뒤 → node 캐러셀/굽기.js 캐러셀/원고/NNN_이름.md`);
})();
